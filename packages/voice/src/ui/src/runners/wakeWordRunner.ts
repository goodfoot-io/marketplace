import { DEFAULT_WAKE_WORD } from "../../../types.js";
import type { RunnerDeps } from "./types.js";

/**
 * wakeWordRunner owns the decision logic for the "say the wake phrase to
 * resume" feature. It is a plain effect runner (never a React hook): it
 * tracks the controller-configured wake phrase (from `host/state`, mirroring
 * the `connectOnPageLoad` flow) and whether the conversation is currently
 * paused, then publishes a single derived "should listen + which phrase"
 * intent.
 *
 * The actual microphone listening is done by `use-ear`, which is a
 * React-hook-only package (`useEar`) with no exported non-hook primitive.
 * Per the runner contract (no React in runners), the runner does NOT call
 * the hook; instead the headless `WakeWordListener` component subscribes to
 * the intent published here and runs `useEar` at a React boundary. All
 * policy (enabled?, paused?, what phrase, what to do on detection) lives in
 * this runner; the component is a thin, stateless bridge.
 *
 * Critical mic-contention constraint: while paused, the conversation's mic
 * capture is cut (`applyPauseAudioCut` disables the track + suspends the
 * audio contexts), so `use-ear`'s own Web Speech recognizer + keep-alive
 * AudioContext may safely run. The instant the conversation resumes, paused
 * flips false, the published intent goes inactive, and the component tears
 * `use-ear` down — so the wake recognizer never contends with the live
 * conversation mic.
 *
 * On detection the runner dispatches the canonical `ui/click/primary`
 * action — the exact same action the FloatingTab Play button dispatches.
 * In `voiceSessionRunner`, with `voice.xaiOpen && voice.paused`, that routes
 * through `onPrimaryClick`'s resume branch (`conversation.resume` +
 * `applyResume`), so wake-word resume is byte-for-byte the Play path.
 */

/**
 * The runner's published listening intent. `active` is true only when the
 * feature is enabled (phrase !== null) AND the conversation is paused; in
 * that state `phrase` is the (non-empty) wake phrase to listen for.
 */
export interface WakeWordIntent {
  active: boolean;
  phrase: string;
}

export interface WakeWordController {
  /** Current intent snapshot. */
  getIntent(): WakeWordIntent;
  /** Subscribe to intent changes; returns an unsubscribe fn. */
  subscribe(listener: (intent: WakeWordIntent) => void): () => void;
  /**
   * Invoked by the React bridge when `use-ear` detects the wake phrase.
   * Idempotent against rapid double-fires: ignored unless the conversation
   * is still paused (the resume it triggers will flip paused false and the
   * intent inactive before any echo can re-enter).
   */
  onWakeWordDetected(): void;
}

// Module-singleton controller so the headless React bridge can reach the
// runner's published intent without prop-drilling or a context (the runner
// is booted in main.tsx before React mounts; the component renders after).
let activeController: WakeWordController | undefined;

/** The React bridge reads the live runner controller via this accessor. */
export function getWakeWordController(): WakeWordController | undefined {
  return activeController;
}

export function createWakeWordRunner({ dispatch, subscribeToActions, getState }: RunnerDeps): () => void {
  // The configured phrase: null = feature disabled. Until the first
  // host/state arrives we assume the controller default ("Hey Computer"),
  // matching the daemon's normalized default so a pause before the first
  // state envelope still arms the listener.
  let phrase: string | null = DEFAULT_WAKE_WORD;
  let paused = false;

  let intent: WakeWordIntent = { active: false, phrase: DEFAULT_WAKE_WORD };
  const listeners = new Set<(intent: WakeWordIntent) => void>();

  const recomputeIntent = (): void => {
    const active = phrase !== null && paused;
    // Keep a stable phrase string even when inactive so the bridge's hook
    // options object is stable across pause cycles for an unchanged config.
    const nextPhrase = phrase ?? intent.phrase;
    if (intent.active === active && intent.phrase === nextPhrase) return;
    intent = { active, phrase: nextPhrase };
    for (const listener of listeners) listener(intent);
  };

  const controller: WakeWordController = {
    getIntent: () => intent,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onWakeWordDetected: () => {
      // Guard against echoes: only act while still paused and enabled. The
      // dispatched resume flips voice.paused → false, which recomputes the
      // intent inactive and tears the recognizer down, so a late second
      // detection from the same utterance is a no-op here.
      if (phrase === null) return;
      if (!getState().voice.paused) return;
      // Exactly what the Play button dispatches → voiceSessionRunner's
      // onPrimaryClick resume branch (conversation.resume + applyResume).
      dispatch({ type: "ui/click/primary" });
    },
  };
  activeController = controller;

  const unsubscribe = subscribeToActions((action) => {
    switch (action.type) {
      case "host/state": {
        // Track the controller-resolved phrase, mirroring how the
        // connectOnPageLoad flag flows controller → state envelope →
        // host/state. null means the SDK config disabled the feature.
        const next = action.data.wakeWord;
        if (next !== phrase) {
          phrase = next;
          recomputeIntent();
        }
        break;
      }
      case "voice/paused": {
        if (action.paused !== paused) {
          paused = action.paused;
          recomputeIntent();
        }
        break;
      }
      default:
        break;
    }
  });

  return () => {
    unsubscribe();
    listeners.clear();
    if (activeController === controller) activeController = undefined;
    // Drop intent to inactive so any still-mounted bridge stops use-ear.
    intent = { active: false, phrase: intent.phrase };
  };
}
