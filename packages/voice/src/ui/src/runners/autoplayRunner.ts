import type { RunnerDeps } from "./types.js";

/**
 * Boot-time silent-audio autoplay probe. Ports the vanilla SPA's
 * `canAutoplay()` (the data: mp3 + `new Audio().play()` probe and the
 * `navigator.userActivation.hasBeenActive === false` short-circuit).
 *
 * Outcome → `browser/autoplay/probed { allowed }`. The audio reducer flips
 * `audio.autoplayAllowed` from `null` to `true | false` and clears the
 * deferred-intent flag `pendingSessionStart` (set by Q12's `null` sub-case
 * when the user clicked during the probe window).
 *
 * Q22 resume paths: if a click was captured while the probe was pending
 * (`pendingSessionStart === true`), re-enter the start flow by re-dispatching
 * the canonical `ui/click/primary`. By the time we re-dispatch, the audio
 * reducer has already applied the resolved `autoplayAllowed` value, so
 * `voiceSessionRunner`'s start branch picks the correct sub-case
 * (allowed → start session; blocked → getUserMedia unblocks + starts in the
 * same activation). Mic acquisition stays solely in `voiceSessionRunner`;
 * `autoplayRunner` never touches audio refs. The probe fires at most once.
 */

const SILENT_MP3 = "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";

async function canAutoplay(dispatch: RunnerDeps["dispatch"]): Promise<boolean> {
  if (navigator.userActivation && navigator.userActivation.hasBeenActive === false) {
    return false;
  }
  try {
    const probe = new Audio(SILENT_MP3);
    probe.volume = 0;
    await probe.play();
    probe.pause();
    return true;
  } catch (error) {
    // Catch-and-continue (Q54): surface the blocked probe, never silent.
    dispatch({
      type: "browser/window/error",
      message: `canAutoplay.probe.blocked: ${String(error instanceof Error ? error.message : error)}`,
    });
    return false;
  }
}

export function createAutoplayRunner({ dispatch, subscribeToActions, getState }: RunnerDeps): () => void {
  let probed = false;
  // The `browser/autoplay/probed` reducer case clears `pendingSessionStart`,
  // and listeners run post-reducer — so the deferred-intent flag cannot be
  // observed from the listener. Snapshot it just before dispatching the probe
  // result, then act on the snapshot once the reducer has applied
  // `autoplayAllowed`.
  let deferredIntentAtProbe = false;

  const unsubscribe = subscribeToActions((action) => {
    if (action.type !== "browser/autoplay/probed") return;
    if (!deferredIntentAtProbe) return;
    deferredIntentAtProbe = false;
    // Q22: a click landed during the probe window. Re-enter the canonical
    // start path; voiceSessionRunner's start branch now sees the resolved
    // autoplayAllowed value (allowed → start; blocked → getUserMedia unblocks
    // and starts in the same activation).
    dispatch({ type: "ui/click/primary" });
  });

  void canAutoplay(dispatch).then((allowed) => {
    if (probed) return;
    probed = true;
    deferredIntentAtProbe = getState().audio.pendingSessionStart;
    dispatch({ type: "browser/autoplay/probed", allowed });
  });

  return unsubscribe;
}
