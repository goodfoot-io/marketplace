import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Action, VoiceToken } from "../src/ui/src/actions.js";
import type { RootState } from "../src/ui/src/store/index.js";
import { createVoiceSessionRunner } from "../src/ui/src/runners/voiceSessionRunner.js";

// ─────────────────────────────────────────────────────────────────────────────
// Repro for: "voice reset detaches the browser mic from the audio pipeline,
// requiring a page reload to restore a live session."
//
// Hypothesis under test: when a fresh `host/voice/session/token` arrives after
// a reset and `establishVoiceSession()` hits the SILENT early-return at
// voiceSessionRunner.ts L545 (`if (refs.xaiWs) return;`) — because a prior
// in-flight establish set `refs.xaiWs` AFTER teardown ran (token/establish
// racing teardown) — the mic→analyser→encoder pipeline is never rebuilt AND
// no observable signal (dispatch / sendToHost / window error) is emitted. The
// user only sees a flat equalizer and an unresponsive agent, with nothing in
// the action stream explaining why, so a page reload is the only recovery.
//
// This test drives the runner through exactly that race and asserts that an
// observable "post-reset rebuild was skipped/aborted" signal reaches the
// dispatch stream. No such signal exists today, so this MUST FAIL against
// current source.
// ─────────────────────────────────────────────────────────────────────────────

// ── Browser-global mocks (vitest env is node; runner touches these) ──────────

class FakeAudioWorklet {
  constructor(private readonly gate: () => Promise<void>) {}
  addModule(_url: string): Promise<void> {
    // Suspends establishVoiceSession() at `await ctx.audioWorklet.addModule`,
    // giving the test a deterministic window to interleave the reset.
    return this.gate();
  }
}

class FakeAudioContext {
  state = "running";
  audioWorklet: FakeAudioWorklet;
  constructor(gate: () => Promise<void>) {
    this.audioWorklet = new FakeAudioWorklet(gate);
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
  createMediaStreamSource(): { connect: () => void } {
    return { connect: () => undefined };
  }
  createAnalyser(): {
    fftSize: number;
    frequencyBinCount: number;
    getByteFrequencyData: () => void;
  } {
    return { fftSize: 0, frequencyBinCount: 8, getByteFrequencyData: () => undefined };
  }
}

class FakeAudioWorkletNode {
  port = { onmessage: null as unknown };
}

class FakeMediaStreamTrack {
  id = "track-1";
  enabled = true;
  readyState = "live";
  addEventListener(): void {}
  removeEventListener(): void {}
  stop(): void {}
}

class FakeMediaStream {
  private readonly track = new FakeMediaStreamTrack();
  getAudioTracks(): FakeMediaStreamTrack[] {
    return [this.track];
  }
  getTracks(): FakeMediaStreamTrack[] {
    return [this.track];
  }
}

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  // Never transitions to OPEN/CLOSED in this test: the socket "lingers", which
  // is precisely the stale-ref condition that makes L545 fire silently.
  readyState = FakeWebSocket.CONNECTING;
  constructor(
    public url: string,
    public protocols?: string[],
  ) {}
  addEventListener(): void {}
  removeEventListener(): void {}
  send(): void {}
  close(): void {}
}

let micWorkletGate: { resolve: () => void; promise: Promise<void> };

function freshGate(): { resolve: () => void; promise: Promise<void> } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { resolve, promise };
}

const originalGlobals: Record<string, unknown> = {};

function installGlobal(name: string, value: unknown): void {
  originalGlobals[name] = (globalThis as Record<string, unknown>)[name];
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  micWorkletGate = freshGate();

  installGlobal(
    "AudioContext",
    class extends FakeAudioContext {
      constructor() {
        super(() => micWorkletGate.promise);
      }
    },
  );
  installGlobal("AudioWorkletNode", FakeAudioWorkletNode);
  installGlobal("WebSocket", FakeWebSocket);
  installGlobal("MediaStream", FakeMediaStream);
  installGlobal("Blob", class {});
  installGlobal("URL", {
    createObjectURL: () => "blob:fake",
    revokeObjectURL: () => undefined,
  });
  installGlobal("requestAnimationFrame", () => 1);
  installGlobal("cancelAnimationFrame", () => undefined);
  installGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () => Promise.resolve(new FakeMediaStream()),
      enumerateDevices: () => Promise.resolve([]),
    },
  });
});

afterEach(() => {
  for (const [name, value] of Object.entries(originalGlobals)) {
    if (value === undefined) {
      delete (globalThis as Record<string, unknown>)[name];
    } else {
      Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true,
      });
    }
  }
});

// ── Minimal in-test store satisfying the runner's getState() reads ───────────

function makeState(): RootState {
  return {
    connection: { status: "connected" },
    conversation: {} as RootState["conversation"],
    audio: {
      permission: "granted",
      devices: [],
      selectedDeviceId: null,
      ready: true,
    } as unknown as RootState["audio"],
    voice: {
      xaiOpen: false,
      xaiStatus: "idle",
      sessionInFlight: true,
      paused: false,
    } as unknown as RootState["voice"],
    ui: {} as RootState["ui"],
    stage: {} as RootState["stage"],
  } as RootState;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("voiceSessionRunner reset → post-reset token silent skip", () => {
  it("emits an observable signal when the post-reset rebuild is skipped at the xaiWs guard", async () => {
    const dispatched: Action[] = [];
    let listener: ((a: Action) => void) | undefined;
    const state = makeState();

    const unsubscribe = createVoiceSessionRunner({
      dispatch: (action) => {
        dispatched.push(action);
      },
      subscribeToActions: (fn) => {
        listener = fn;
        return () => {
          listener = undefined;
        };
      },
      getState: () => state,
    });

    const emit = (action: Action): void => {
      listener?.(action);
    };

    const token: VoiceToken = { clientSecret: "secret-1", model: "grok-realtime" };

    // 1. First token arrives → establishVoiceSession() starts, acquires the
    //    mic, and suspends inside startMicEncoder at `audioWorklet.addModule`.
    //    refs.xaiWs is NOT yet set (the WS is created only after this await).
    emit({ type: "host/voice/session/token", token });
    await flush();

    // 2. While establish #1 is still suspended, the user clicks reset. The
    //    daemon-bound sendToHost("conversation.reset") is a no-op here (no host
    //    socket), teardownVoice() runs and calls freshRefs() — clearing refs.
    emit({ type: "ui/click/reset" });
    await flush();

    // 3. Establish #1 resumes PAST the await and sets refs.xaiWs = ws AFTER
    //    teardown already ran. This is the stale/lingering xaiWs the
    //    hypothesis describes (establish racing teardown).
    micWorkletGate.resolve();
    await flush();

    const signalsBefore = dispatched.length;

    // 4. A fresh post-reset token arrives. establishVoiceSession() now hits
    //    `if (refs.xaiWs) return;` (L545) and returns SILENTLY: the
    //    mic→analyser→encoder pipeline is never rebuilt and nothing is
    //    dispatched to explain the dead session.
    emit({ type: "host/voice/session/token", token: { ...token, clientSecret: "secret-2" } });
    await flush();

    const newSignals = dispatched.slice(signalsBefore);

    // The defect: the runner must surface SOME observable signal when the
    // post-reset rebuild is skipped/aborted at the xaiWs guard, so the UI can
    // recover or report instead of silently leaving a flat equalizer. Any
    // dispatched action that communicates the skip/abort/error would satisfy
    // this; today the guard emits nothing.
    const skipSignal = newSignals.find((a) => {
      const t = a.type;
      return (
        t.includes("error") ||
        t.includes("fail") ||
        t.includes("skip") ||
        t.includes("abort") ||
        t === "connection/status" ||
        t === "voice/session/in-flight"
      );
    });

    expect(
      skipSignal,
      `Expected a post-reset rebuild-skipped signal in the dispatch stream, ` +
        `got: ${JSON.stringify(newSignals.map((a) => a.type))}`,
    ).toBeDefined();

    unsubscribe();
  });
});
