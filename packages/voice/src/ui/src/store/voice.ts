import type { Action } from "../actions.js";

export interface VoiceState {
  xaiOpen: boolean;
  connectedSent: boolean;
  sessionInFlight: boolean;
  paused: boolean;
  responseActive: boolean;
  speakingItemId: string | null;
  nextPlaybackTime: number;
  playbackEndsAt: number;
  deferredSendsPending: boolean;
}

export const initialVoiceState: VoiceState = {
  xaiOpen: false,
  connectedSent: false,
  sessionInFlight: false,
  paused: false,
  responseActive: false,
  speakingItemId: null,
  nextPlaybackTime: 0,
  playbackEndsAt: 0,
  deferredSendsPending: false,
};

export function voiceReducer(state: VoiceState, action: Action): VoiceState {
  switch (action.type) {
    case "xai/ws/open":
      return { ...state, xaiOpen: true };
    case "xai/ws/close":
      // Teardown: xAI session closed.
      return {
        ...state,
        xaiOpen: false,
        responseActive: false,
        nextPlaybackTime: 0,
        playbackEndsAt: 0,
        deferredSendsPending: false,
      };
    case "xai/response/created":
      // Vanilla cleared speakingItemId on response.created.
      return { ...state, responseActive: true, speakingItemId: null };
    case "xai/response/done":
    case "xai/response/failed":
      return { ...state, responseActive: false };
    case "xai/response/cancelled":
      // Vanilla cleared speakingItemId on response.cancelled.
      return { ...state, responseActive: false, speakingItemId: null };
    case "xai/input-audio-buffer/speech-started":
      // Vanilla set speakingItemId to the in-progress user item id.
      return { ...state, speakingItemId: action.itemId || null };
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
