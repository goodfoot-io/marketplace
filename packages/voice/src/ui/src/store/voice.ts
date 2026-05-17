import type { Action } from "../actions.js";

export interface VoiceState {
  xaiOpen: boolean;
  xaiStatus: "connecting" | "connected" | "disconnected" | "error";
  connectedSent: boolean;
  sessionInFlight: boolean;
  paused: boolean;
  responseActive: boolean;
  speakingItemId: string | null;
  // The in-flight user utterance's item id. Unlike `speakingItemId` (which
  // clears on speech_stopped to stop the "actively talking" pulse), this
  // persists from speech_started until the assistant's next response starts —
  // long enough to bridge the ~200ms gap between speech_stopped and the
  // transcript text landing, so the placeholder never flickers out. The
  // controller keys the eventual user transcript item by this same xAI item
  // id, so the synthetic→real handoff is atomic (same id).
  pendingUserItemId: string | null;
  nextPlaybackTime: number;
  playbackEndsAt: number;
  deferredSendsPending: boolean;
}

export const initialVoiceState: VoiceState = {
  xaiOpen: false,
  xaiStatus: "disconnected",
  connectedSent: false,
  sessionInFlight: false,
  paused: false,
  responseActive: false,
  speakingItemId: null,
  pendingUserItemId: null,
  nextPlaybackTime: 0,
  playbackEndsAt: 0,
  deferredSendsPending: false,
};

export function voiceReducer(state: VoiceState, action: Action): VoiceState {
  switch (action.type) {
    case "xai/ws/connecting":
      if (state.xaiStatus === "connecting") return state;
      return { ...state, xaiStatus: "connecting" };
    case "xai/ws/open":
      return { ...state, xaiOpen: true, xaiStatus: "connected" };
    case "xai/ws/error":
      // Only flag status; the close handler that follows performs teardown.
      if (state.xaiStatus === "error") return state;
      return { ...state, xaiStatus: "error" };
    case "xai/ws/close":
      // Teardown: xAI session closed.
      return {
        ...state,
        xaiOpen: false,
        xaiStatus: "disconnected",
        responseActive: false,
        nextPlaybackTime: 0,
        playbackEndsAt: 0,
        deferredSendsPending: false,
        pendingUserItemId: null,
      };
    case "xai/response/created":
      // Vanilla cleared speakingItemId on response.created. Do NOT clear
      // pendingUserItemId here: response.created can race ahead of the user's
      // transcript text landing in the store, and clearing it mid-gap makes
      // the placeholder vanish before the real bubble appears (flicker). The
      // synthetic placeholder is suppressed atomically by same-id transcript
      // presence; pendingUserItemId is retired later, on response.done.
      return { ...state, responseActive: true, speakingItemId: null };
    case "xai/response/done":
    case "xai/response/failed":
      // The user transcript item is long present by response.done, so
      // retiring the pending id here cannot reopen the placeholder gap; it
      // also bounds the id's lifetime if an utterance produced no transcript.
      return { ...state, responseActive: false, pendingUserItemId: null };
    case "xai/response/cancelled":
      // Vanilla cleared speakingItemId on response.cancelled.
      return { ...state, responseActive: false, speakingItemId: null };
    case "xai/input-audio-buffer/speech-started":
      // Vanilla set speakingItemId to the in-progress user item id. Also pin
      // pendingUserItemId so the placeholder survives past speech_stopped
      // until the transcript text (same id) replaces it.
      return {
        ...state,
        speakingItemId: action.itemId || null,
        pendingUserItemId: action.itemId || state.pendingUserItemId,
      };
    case "xai/input-audio-buffer/speech-stopped":
    case "xai/conversation/item/added":
      // Vanilla cleared speakingItemId on speech_stopped / conversation.item.added.
      if (state.speakingItemId === null) return state;
      return { ...state, speakingItemId: null };
    case "xai/response/output-item/added":
      return { ...state, speakingItemId: action.itemId };
    case "voice/session/in-flight":
      if (state.sessionInFlight === action.inFlight) return state;
      return { ...state, sessionInFlight: action.inFlight };
    case "voice/paused":
      if (state.paused === action.paused) return state;
      return { ...state, paused: action.paused };
    case "voice/playback/cursor":
      return {
        ...state,
        nextPlaybackTime: action.nextPlaybackTime,
        playbackEndsAt: action.playbackEndsAt,
      };
    case "voice/playback/cut":
      return { ...state, nextPlaybackTime: 0, playbackEndsAt: 0, deferredSendsPending: false };
    case "host/voice/send":
      if (action.gate !== "playback-drained") return state;
      return { ...state, deferredSendsPending: true };
    case "voice/playback/drained":
      if (!state.deferredSendsPending) return state;
      return { ...state, deferredSendsPending: false };
    default:
      return state;
  }
}
