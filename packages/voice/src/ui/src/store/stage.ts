import type { Action } from "../actions.js";

export interface StageState {
  injectedVersion: number | null;
}

export const initialStageState: StageState = {
  injectedVersion: null,
};

export function stageReducer(state: StageState, action: Action): StageState {
  switch (action.type) {
    case "host/state": {
      const next = action.data.injectedVersion ?? null;
      if (next === state.injectedVersion) return state;
      return { ...state, injectedVersion: next };
    }
    case "host/stage": {
      const next = action.data.injectedVersion;
      if (next === state.injectedVersion) return state;
      return { ...state, injectedVersion: next };
    }
    default:
      return state;
  }
}
