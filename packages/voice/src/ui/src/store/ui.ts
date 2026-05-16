import type { Action } from "../actions.js";

export interface UiState {
  modal: "none" | "transcript" | "instructions";
  moreActionsOpen: boolean;
  duplicateClient: boolean;
}

export const initialUiState: UiState = {
  modal: "none",
  moreActionsOpen: false,
  duplicateClient: false,
};

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
    default:
      return state;
  }
}
