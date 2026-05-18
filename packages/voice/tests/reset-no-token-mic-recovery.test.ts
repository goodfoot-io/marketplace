import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Action } from "../src/ui/src/actions.js";
import { createVoiceSessionRunner } from "../src/ui/src/runners/voiceSessionRunner.js";
import type { RootState } from "../src/ui/src/store/index.js";
import { initialAudioState } from "../src/ui/src/store/audio.js";
import { initialConnectionState } from "../src/ui/src/store/connection.js";
import { initialConversationState } from "../src/ui/src/store/conversation.js";
import { initialStageState } from "../src/ui/src/store/stage.js";
import { initialUiState } from "../src/ui/src/store/ui.js";
import { initialVoiceState } from "../src/ui/src/store/voice.js";

/**
 * Repro for: after `ui/click/reset` tears down the mic pipeline, if no fresh
 * `host/voice/session/token` is delivered, the browser side performs NO
 * fallback mic re-acquisition and emits NO observable signal that the session
 * is dead. The equalizer stays flat indefinitely with no indication why,
 * forcing a page reload.
 *
 * This test fires `ui/click/reset`, advances time WITHOUT delivering a token,
 * and asserts the runner produces a bounded observable recovery signal
 * (a dispatch and/or a sendToHost). On current code nothing is emitted after
 * the reset's `voice/session/in-flight {inFlight:false}`, so this FAILS.
 */

// ── Browser global mocks ──────────────────────────────────────────────────

class FakeWebSocket {
  static OPEN = 1;
  readyState = 1;
  send(): void {}
  close(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}

class FakeAudioContext {
  state = "running";
  destination = {};
  audioWorklet = { addModule: async (): Promise<void> => {} };
  createGain(): unknown {
    return { gain: { value: 1 }, connect() {}, disconnect() {} };
  }
  createAnalyser(): unknown {
    return { fftSize: 0, connect() {}, disconnect() {}, getByteFrequencyData() {} };
  }
  createMediaStreamSource(): unknown {
    return { connect() {}, disconnect() {} };
  }
  async resume(): Promise<void> {}
  async close(): Promise<void> {}
}

function installBrowserGlobals(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  g.WebSocket = FakeWebSocket as unknown;
  g.AudioContext = FakeAudioContext as unknown;
  g.AudioWorkletNode = class {
    port = { onmessage: null, postMessage(): void {} };
    connect(): void {}
    disconnect(): void {}
  } as unknown;
  g.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(performance.now?.() ?? 0), 16) as unknown as number;
  }) as unknown;
  g.cancelAnimationFrame = ((id: number): void => {
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  }) as unknown;
  const fakeNavigator = {
    mediaDevices: {
      getUserMedia: async (): Promise<unknown> => ({
        getTracks: () => [],
        getAudioTracks: () => [],
      }),
      enumerateDevices: async (): Promise<unknown[]> => [],
      addEventListener(): void {},
      removeEventListener(): void {},
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    value: fakeNavigator,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "location", {
    value: { protocol: "http:", host: "localhost" },
    configurable: true,
    writable: true,
  });
}

function makeRootState(): RootState {
  return {
    connection: { ...initialConnectionState },
    conversation: { ...initialConversationState },
    audio: { ...initialAudioState },
    voice: { ...initialVoiceState },
    ui: { ...initialUiState },
    stage: { ...initialStageState },
  };
}

describe("voice reset with no token leaves mic detached and silent", () => {
  beforeEach(() => {
    installBrowserGlobals();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("emits a bounded recovery/mic-disconnected signal when no token follows reset", () => {
    const dispatched: Action[] = [];
    let listener: ((a: Action) => void) | undefined;

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
      getState: makeRootState,
    });

    expect(listener).toBeDefined();

    // Fire the reset. This synchronously tears down the pipeline and
    // dispatches `voice/session/in-flight {inFlight:false}`. No token follows.
    listener?.({ type: "ui/click/reset" });

    const afterResetCount = dispatched.length;

    // Advance well past any reasonable bounded recovery window. No
    // `host/voice/session/token` is ever delivered.
    vi.advanceTimersByTime(30_000);
    vi.runOnlyPendingTimers();

    // Post-fix expectation: within a bounded interval the runner must surface
    // an observable signal that the mic pipeline is dead and was not rebuilt
    // (or auto-re-acquire the mic). We accept ANY new dispatched action after
    // the reset that signals recovery intent / mic-disconnected state.
    const signalsAfterReset = dispatched.slice(afterResetCount);

    expect(
      signalsAfterReset,
      `Expected a bounded recovery / mic-disconnected signal after reset with no ` +
        `token, but the runner stayed silent. Dispatched after reset: ` +
        `${JSON.stringify(signalsAfterReset)}`,
    ).not.toHaveLength(0);

    unsubscribe();
  });
});
