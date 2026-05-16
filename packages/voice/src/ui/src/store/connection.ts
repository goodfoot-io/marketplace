import type { Action } from "../actions.js";

export interface ConnectionState {
  status: "connecting" | "connected" | "disconnected" | "error";
  reconnectMs: number;
}

export const initialConnectionState: ConnectionState = {
  status: "connecting",
  reconnectMs: 250,
};

export function connectionReducer(state: ConnectionState, action: Action): ConnectionState {
  switch (action.type) {
    case "connection/status":
      if (state.status === action.status) return state;
      return { ...state, status: action.status };
    default:
      return state;
  }
}
