import type { Action } from "../actions.js";
import type { RootState } from "../store/index.js";

/**
 * The store/dispatch/subscribe surface every runner is constructed with.
 * Matches `(dispatch, subscribeToActions, getState)` so Phase 5's `main.tsx`
 * can wire all runners identically.
 */
export interface RunnerDeps {
  dispatch: (action: Action) => void;
  subscribeToActions: (fn: (a: Action) => void) => () => void;
  getState: () => RootState;
}
