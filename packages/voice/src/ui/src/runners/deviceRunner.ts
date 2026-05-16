import type { AudioDevice } from "../actions.js";
import type { RunnerDeps } from "./types.js";

/**
 * deviceRunner owns the `navigator.mediaDevices.devicechange` listener and the
 * active mic track's `ended` wiring (Q52 — unwired in the vanilla SPA).
 *
 * The vanilla SPA only enumerated devices inside refreshAudio/getUserMedia.
 * Here we additionally re-enumerate whenever the OS device set changes and
 * surface a hot-unplug of the active track as `browser/mic/track-ended`.
 *
 * `watchMicTrack` is exported so `voiceSessionRunner` (which owns the track)
 * can register the live track without sharing the track ref through the store.
 */

let activeTrack: MediaStreamTrack | undefined;
let activeTrackEndedHandler: (() => void) | undefined;

async function enumerate(): Promise<AudioDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label || "Microphone",
      groupId: device.groupId,
    }));
}

/**
 * Register (or clear) the active mic track. When it fires `ended` (device
 * unplugged, OS revoked), dispatch `browser/mic/track-ended`.
 */
export function watchMicTrack(track: MediaStreamTrack | undefined, dispatch: RunnerDeps["dispatch"]): void {
  if (activeTrack && activeTrackEndedHandler) {
    activeTrack.removeEventListener("ended", activeTrackEndedHandler);
  }
  activeTrack = track;
  activeTrackEndedHandler = undefined;
  if (!track) return;
  const handler = (): void => {
    dispatch({ type: "browser/mic/track-ended" });
  };
  activeTrackEndedHandler = handler;
  track.addEventListener("ended", handler);
}

export function createDeviceRunner({ dispatch }: RunnerDeps): () => void {
  const onDeviceChange = (): void => {
    enumerate()
      .then((devices) => {
        dispatch({ type: "browser/devices/enumerated", devices });
      })
      .catch((error: unknown) => {
        dispatch({
          type: "browser/window/error",
          message: `devicechange enumerate failed: ${String(error instanceof Error ? error.message : error)}`,
        });
      });
  };

  navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

  return () => {
    navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
    if (activeTrack && activeTrackEndedHandler) {
      activeTrack.removeEventListener("ended", activeTrackEndedHandler);
    }
    activeTrack = undefined;
    activeTrackEndedHandler = undefined;
  };
}
