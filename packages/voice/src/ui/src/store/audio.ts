import type { Action, AudioDevice } from "../actions.js";

export interface AudioState {
  permission: "unknown" | "granted" | "denied";
  devices: AudioDevice[];
  selectedDeviceId: string | null;
  ready: boolean;
  autoplayAllowed: boolean | null;
  pendingSessionStart: boolean;
}

export const initialAudioState: AudioState = {
  permission: "unknown",
  devices: [],
  selectedDeviceId: null,
  ready: false,
  autoplayAllowed: null,
  pendingSessionStart: false,
};

export function audioReducer(state: AudioState, action: Action): AudioState {
  switch (action.type) {
    case "browser/autoplay/probed":
      // Q22: probe resolved — clear the deferred-intent flag; the runner acts on it.
      return { ...state, autoplayAllowed: action.allowed, pendingSessionStart: false };
    case "browser/devices/enumerated":
      return { ...state, devices: action.devices };
    case "host/browser-audio/device-change":
      return {
        ...state,
        devices: action.devices,
        selectedDeviceId: action.selectedDeviceId,
      };
    case "ui/select/mic-device":
      if (state.selectedDeviceId === action.deviceId) return state;
      return { ...state, selectedDeviceId: action.deviceId };
    case "browser/permission/granted":
      return { ...state, permission: "granted", ready: true };
    case "browser/permission/denied":
      return { ...state, permission: "denied" };
    case "browser/mic/stream-failed":
      return { ...state, permission: "denied", ready: false };
    case "host/voice/session/start":
      // Q22: capture deferred start intent while probe pending or autoplay blocked.
      if (state.autoplayAllowed === true) return state;
      if (state.pendingSessionStart) return state;
      return { ...state, pendingSessionStart: true };
    case "voice/session/in-flight":
      // Q22: in-flight clears any captured deferred start intent.
      if (!action.inFlight || !state.pendingSessionStart) return state;
      return { ...state, pendingSessionStart: false };
    default:
      return state;
  }
}
