import type { Action } from "../actions.js";

export interface StageState {
  injectedVersion: number | null;
  // Path of an injected-by-path file the host reports as missing/unreadable,
  // or null. When set, the App shows a de-emphasized "no longer present" notice
  // (with a clear button) instead of the stage iframe. The host keeps polling,
  // so a re-written file flips this back to null and re-renders automatically.
  injectedAbsentPath: string | null;
}

export const initialStageState: StageState = {
  injectedVersion: null,
  injectedAbsentPath: null,
};

export function stageReducer(state: StageState, action: Action): StageState {
  switch (action.type) {
    case "host/state": {
      const version = action.data.injectedVersion ?? null;
      const absentPath = action.data.injectedAbsentPath ?? null;
      if (version === state.injectedVersion && absentPath === state.injectedAbsentPath) return state;
      return { ...state, injectedVersion: version, injectedAbsentPath: absentPath };
    }
    case "host/stage": {
      const version = action.data.injectedVersion;
      const absentPath = action.data.injectedAbsentPath;
      if (version === state.injectedVersion && absentPath === state.injectedAbsentPath) return state;
      return { ...state, injectedVersion: version, injectedAbsentPath: absentPath };
    }
    default:
      return state;
  }
}
