import type { ConversationSnapshot, ConversationStatus, TranscriptDeltaEvent } from "../../../types.js";
import type { Action } from "../actions.js";

export interface ConversationState {
  status: ConversationStatus;
  conversation: ConversationSnapshot | null;
  // `undefined` means no broadcast received yet; `""` means broadcast with empty instructions.
  instructions: string | undefined;
  streamDrafts: Map<string, TranscriptDeltaEvent>;
  atBottom: boolean;
  previousConversationId: string | null;
}

export const initialConversationState: ConversationState = {
  status: "starting",
  conversation: null,
  instructions: undefined,
  streamDrafts: new Map(),
  atBottom: true,
  previousConversationId: null,
};

export function conversationReducer(state: ConversationState, action: Action): ConversationState {
  switch (action.type) {
    case "host/state": {
      const conversation = action.data.conversation ?? null;
      const nextStatus = conversation?.status ?? state.status;
      const nextConversationId = conversation?.id ?? null;
      // Q23/Q59: detect a new conversation id and atomically clear stream drafts,
      // re-anchor scroll, and update previousConversationId.
      if (nextConversationId !== state.previousConversationId) {
        return {
          ...state,
          status: nextStatus,
          conversation,
          instructions: action.data.instructions,
          streamDrafts: new Map(),
          atBottom: true,
          previousConversationId: nextConversationId,
        };
      }
      return {
        ...state,
        status: nextStatus,
        conversation,
        instructions: action.data.instructions,
      };
    }
    case "host/transcript/delta": {
      const next = new Map(state.streamDrafts);
      next.set(action.delta.itemId, action.delta);
      return { ...state, streamDrafts: next };
    }
    case "ui/scroll/transcript":
      if (state.atBottom === action.atBottom) return state;
      return { ...state, atBottom: action.atBottom };
    default:
      return state;
  }
}
