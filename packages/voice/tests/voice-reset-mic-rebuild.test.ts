/**
 * Repro: after a voice reset (ui/click/reset → host/voice/session/token →
 * establishVoiceSession → acquireMicStream → startMeters), the rebuilt
 * AudioContext can stay "suspended" (no fresh user gesture). startMeters()
 * calls audioCtx.resume() and ONLY dispatches browser/window/error if resume()
 * REJECTS. A suspended context whose resume() RESOLVES without changing state
 * is fully silent: the analyser never advances, the equalizer stays flat, and
 * NO mic-disconnected / rebuild-failed signal is surfaced — forcing a reload.
 *
 * This test drives the reset → token → establish path with exactly that
 * AudioContext and asserts the runner surfaces SOME observable signal that
 * metering did not become live. It MUST FAIL on current code (no such signal).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Action, VoiceToken } from "../src/ui/src/actions.js";
import { createVoiceSessionRunner } from "../src/ui/src/runners/voiceSessionRunner.js";
import type { RootState } from "../src/ui/src/store/index.js";

// ── Browser global mocks ────────────────────────────────────────────────────

/**
 * An AudioContext that boots "suspended" and whose resume() RESOLVES without
 * ever transitioning to "running" — exactly the post-teardown / no-gesture
 * state the bug hinges on. createMediaStreamSource / createAnalyser are stubbed
 * so startMeters() and startMicEncoder() can build their graph.
 */
class StuckSuspendedAudioContext {
  state: "suspended" | "running" | "closed" = "suspended";
  currentTime = 0;
  destination = {};

  resume(): Promise<void> {
    // Resolves but the context never actually starts (no user gesture).
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = "closed";
    return Promise.resolve();
  }

  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: (_data: Uint8Array): void => {
        // A suspended context produces no audio: bins stay all-zero.
      },
      connect: (): void => {},
    };
  }

  createMediaStreamSource() {
    return { connect: (): void => {} };
  }

  createGain() {
    return { connect: (): void => {}, gain: { value: 1 } };
  }

  get audioWorklet() {
    return { addModule: (): Promise<void> => Promise.resolve() };
  }
}

class FakeMediaStreamTrack {
  id = "track-1";
  kind = "audio";
  enabled = true;
  readyState = "live";
  stop(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
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
  static readonly OPEN = 1;
  readonly OPEN = 1;
  readyState = 0;
  addEventListener(): void {}
  removeEventListener(): void {}
  send(): void {}
  close(): void {}
}

class FakeAudioWorkletNode {
  port = { onmessage: null as unknown, postMessage: (): void => {} };
  connect(): void {}
}

const savedDescriptors: Record<string, PropertyDescriptor | undefined> = {};
function stub(name: string, value: unknown): void {
  if (!(name in savedDescriptors)) {
    savedDescriptors[name] = Object.getOwnPropertyDescriptor(globalThis, name);
  }
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}
function restoreGlobals(): void {
  for (const [name, descriptor] of Object.entries(savedDescriptors)) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete (globalThis as Record<string, unknown>)[name];
    }
  }
}

// ── Minimal store harness (the runner's DI surface) ─────────────────────────

function makeState(): RootState {
  return {
    audio: {
      permission: "granted",
      selectedDeviceId: "default",
      ready: true,
      autoplayAllowed: true,
    },
    voice: {
      xaiOpen: false,
      sessionInFlight: true,
      paused: false,
    },
  } as unknown as RootState;
}

describe("voice reset leaves the mic detached when the rebuilt AudioContext stays suspended", () => {
  let unsubscribe: () => void;
  let dispatched: Action[];

  beforeEach(() => {
    stub("AudioContext", StuckSuspendedAudioContext);
    stub("WebSocket", FakeWebSocket);
    stub("AudioWorkletNode", FakeAudioWorkletNode);
    stub("Blob", class FakeBlob {});
    stub("URL", { createObjectURL: () => "blob:fake", revokeObjectURL: () => {} });
    stub("requestAnimationFrame", (_cb: FrameRequestCallback) => 1);
    stub("cancelAnimationFrame", () => {});
    stub("location", { protocol: "https:", host: "localhost" });
    stub("navigator", {
      mediaDevices: {
        getUserMedia: () => Promise.resolve(new FakeMediaStream()),
        enumerateDevices: () =>
          Promise.resolve([{ kind: "audioinput", deviceId: "default", label: "Default", groupId: "g" }]),
      },
    });
    stub("atob", (s: string) => s);
    stub("btoa", (s: string) => s);
  });

  afterEach(() => {
    unsubscribe?.();
    restoreGlobals();
  });

  it("surfaces a mic-disconnected / rebuild-failed signal instead of going silently flat", async () => {
    const state = makeState();
    dispatched = [];

    const subscribers: ((a: Action) => void)[] = [];
    const deps = {
      dispatch: (action: Action) => {
        dispatched.push(action);
      },
      subscribeToActions: (fn: (a: Action) => void) => {
        subscribers.push(fn);
        return () => {
          const i = subscribers.indexOf(fn);
          if (i >= 0) subscribers.splice(i, 1);
        };
      },
      getState: () => state,
    };

    unsubscribe = createVoiceSessionRunner(deps);
    const emit = (action: Action): void => {
      for (const fn of [...subscribers]) fn(action);
    };

    // 1. User clicks reset: teardown + tell daemon to reset.
    emit({ type: "ui/click/reset" });

    // 2. Daemon mints a fresh token; the runner re-establishes the session,
    //    re-acquires the mic, and rebuilds the AudioContext via startMeters().
    const token: VoiceToken = {
      clientSecret: "secret-abc",
      model: "grok-realtime",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    emit({ type: "host/voice/session/token", token });

    // Let establishVoiceSession()'s async chain (acquireMicStream →
    // startMeters → startMicEncoder) settle.
    await new Promise((r) => setTimeout(r, 30));

    // The mic stream WAS acquired (so the user expects a live equalizer)...
    expect(dispatched.some((a) => a.type === "browser/mic/stream-acquired")).toBe(true);

    // ...but the rebuilt AudioContext is stuck "suspended": the analyser will
    // never advance and the equalizer stays flat. The runner MUST surface an
    // observable signal that metering/rebuild did not become live so the UI
    // can recover without a manual page reload. On current code it surfaces
    // NOTHING (resume() resolved, so the lone window/error path never fires).
    const signalsMeteringNotLive = dispatched.some(
      (a) =>
        a.type === "browser/mic/stream-failed" || a.type === "browser/window/error" || a.type === "connection/status",
    );

    expect(signalsMeteringNotLive).toBe(true);
  });
});
