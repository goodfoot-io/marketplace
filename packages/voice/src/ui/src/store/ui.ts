import type { VoiceAgentSettingDescriptor } from "../../../types.js";
import type { Action } from "../actions.js";

/** Last invocation outcome for a settings item, keyed by descriptor id. */
export interface SettingResult {
  ok: boolean;
  error?: string;
}

export interface UiState {
  modal: "none" | "transcript" | "instructions";
  moreActionsOpen: boolean;
  duplicateClient: boolean;
  // Configured settings items (callbacks stripped) from the latest host state.
  settings: VoiceAgentSettingDescriptor[];
  // Ids of settings whose callback is currently in flight (control disabled).
  settingsInFlight: Set<string>;
  // Last invocation outcome per settings id (success/error surfaced inline).
  settingsResults: Map<string, SettingResult>;
  // True while the avatar is waiting for context (wait_for_context). Drives the
  // comet orbiting the connection indicator (replaces the old audio metronome).
  waitingForContext: boolean;
}

export const initialUiState: UiState = {
  modal: "none",
  moreActionsOpen: false,
  duplicateClient: false,
  settings: [],
  settingsInFlight: new Set(),
  settingsResults: new Map(),
  waitingForContext: false,
};

/** Shallow-equal two settings descriptor arrays by their wire-relevant fields. */
function sameSettings(a: VoiceAgentSettingDescriptor[], b: VoiceAgentSettingDescriptor[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x?.id !== y?.id ||
      x?.type !== y?.type ||
      x?.label !== y?.label ||
      x?.confirmation?.text !== y?.confirmation?.text ||
      x?.confirmation?.confirmLabel !== y?.confirmation?.confirmLabel ||
      x?.confirmation?.cancelLabel !== y?.confirmation?.cancelLabel
    ) {
      return false;
    }
  }
  return true;
}

export function uiReducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case "ui/click/transcript":
      return { ...state, modal: "transcript", moreActionsOpen: false };
    case "ui/click/instructions":
      return { ...state, modal: "instructions", moreActionsOpen: false };
    case "ui/click/modal-backdrop":
    case "ui/click/modal-close":
      if (state.modal === "none" && !state.moreActionsOpen) return state;
      return { ...state, modal: "none", moreActionsOpen: false };
    case "ui/key/escape":
      if (state.modal === "none" && !state.moreActionsOpen) return state;
      return { ...state, modal: "none", moreActionsOpen: false };
    case "ui/click/more-actions":
      return { ...state, moreActionsOpen: !state.moreActionsOpen };
    case "host/duplicate-client":
      if (state.duplicateClient) return state;
      return { ...state, duplicateClient: true };
    case "host/state": {
      const next = action.data.settings;
      if (sameSettings(state.settings, next)) return state;
      return { ...state, settings: next };
    }
    case "ui/click/setting": {
      if (state.settingsInFlight.has(action.id)) return state;
      const settingsInFlight = new Set(state.settingsInFlight);
      settingsInFlight.add(action.id);
      // Clear any prior result so the inline surface reflects only this attempt.
      const settingsResults = new Map(state.settingsResults);
      settingsResults.delete(action.id);
      return { ...state, settingsInFlight, settingsResults };
    }
    case "host/settings/result": {
      const settingsInFlight = new Set(state.settingsInFlight);
      settingsInFlight.delete(action.id);
      const settingsResults = new Map(state.settingsResults);
      settingsResults.set(action.id, { ok: action.ok, error: action.error });
      return { ...state, settingsInFlight, settingsResults };
    }
    case "host/wait-for-context/start":
      return state.waitingForContext ? state : { ...state, waitingForContext: true };
    case "host/wait-for-context/end":
      return state.waitingForContext ? { ...state, waitingForContext: false } : state;
    default:
      return state;
  }
}
