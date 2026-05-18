import { useEffect, useState } from "react";
import { useEar } from "use-ear";
import { getWakeWordController, type WakeWordIntent } from "../runners/wakeWordRunner.js";

/**
 * Headless React bridge for the wake-word resume feature.
 *
 * `use-ear` ships only as a React hook (`useEar`) — there is no exported
 * non-hook primitive — so the hook cannot live in a plain runner. All
 * policy (enabled?, paused?, which phrase, what to do on detection) is owned
 * by `wakeWordRunner`; this component is the thin, stateless boundary that
 * actually drives the hook from the runner's published intent. It renders
 * nothing.
 *
 * Lifecycle / mic-contention: the inner `WakeEar` is mounted ONLY while the
 * runner's intent is `active` (feature enabled AND conversation paused).
 * When the conversation resumes, the intent flips inactive, `WakeEar`
 * unmounts, and its effect cleanup calls `stop()` + tears down the Web
 * Speech recognizer and `use-ear`'s keep-alive AudioContext — so the wake
 * recognizer never contends with the resumed conversation mic. Remounting
 * `WakeEar` per pause cycle (rather than toggling `start`/`stop` on a
 * persistent instance) guarantees a full resource release every resume.
 */
export function WakeWordListener(): React.JSX.Element | null {
  const controller = getWakeWordController();
  const [intent, setIntent] = useState<WakeWordIntent>(
    () => controller?.getIntent() ?? { active: false, phrase: "" },
  );

  useEffect(() => {
    if (!controller) return;
    // Sync immediately in case the intent changed between the initial
    // render and the effect commit, then track every subsequent change.
    setIntent(controller.getIntent());
    return controller.subscribe(setIntent);
  }, [controller]);

  if (!controller || !intent.active || intent.phrase.length === 0) {
    return null;
  }

  // Keyed by phrase so a live config change (host/state) cleanly tears down
  // the old recognizer and starts a fresh one for the new phrase.
  return <WakeEar key={intent.phrase} phrase={intent.phrase} onDetected={controller.onWakeWordDetected} />;
}

function WakeEar({ phrase, onDetected }: { phrase: string; onDetected: () => void }): null {
  const { start, stop, isSupported } = useEar({
    wakeWords: [phrase],
    onWakeWord: () => {
      onDetected();
    },
    // The conversation runs in English; use-ear defaults to ja-JP.
    language: "en-US",
    // Tolerate Web Speech mis-hearings of a short phrase ("hey computer"
    // ↔ "hey computers"/"a computer"). Exact substring match alone is too
    // brittle for a wake word; fuzzy match keeps it responsive.
    similarityThreshold: 0.75,
    // Keep listening after a (possibly non-matching) result so the user can
    // retry the phrase without the recognizer going idle. keepAlive keeps
    // the audio session up between Web Speech restarts.
    continuous: true,
    keepAlive: true,
  });

  useEffect(() => {
    if (!isSupported) return;
    start();
    // Unmount (resume / disable / teardown) → stop the recognizer and
    // release use-ear's audio resources before the conversation mic resumes.
    // `start`/`stop` are useCallback-stable for a given useEar instance, so
    // listing them keeps the deps exhaustive without re-running the effect.
    return () => {
      stop();
    };
  }, [isSupported, start, stop]);

  return null;
}
