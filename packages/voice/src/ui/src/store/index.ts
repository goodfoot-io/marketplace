import { useStore as useZustandStore } from "zustand";
import { persist, redux } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { Action } from "../actions.js";
import { type AudioState, audioReducer, initialAudioState } from "./audio.js";
import { type ConnectionState, connectionReducer, initialConnectionState } from "./connection.js";
import { type ConversationState, conversationReducer, initialConversationState } from "./conversation.js";
import { initialStageState, type StageState, stageReducer } from "./stage.js";
import { initialUiState, type UiState, uiReducer } from "./ui.js";
import { initialVoiceState, type VoiceState, voiceReducer } from "./voice.js";

export interface RootState {
  connection: ConnectionState;
  conversation: ConversationState;
  audio: AudioState;
  voice: VoiceState;
  ui: UiState;
  stage: StageState;
}

const initialState: RootState = {
  connection: initialConnectionState,
  conversation: initialConversationState,
  audio: initialAudioState,
  voice: initialVoiceState,
  ui: initialUiState,
  stage: initialStageState,
};

/** Top-level reducer fanning out to the six slice reducers. */
export function reducer(state: RootState, action: Action): RootState {
  const connection = connectionReducer(state.connection, action);
  const conversation = conversationReducer(state.conversation, action);
  const audio = audioReducer(state.audio, action);
  const voice = voiceReducer(state.voice, action);
  const ui = uiReducer(state.ui, action);
  const stage = stageReducer(state.stage, action);
  if (
    connection === state.connection &&
    conversation === state.conversation &&
    audio === state.audio &&
    voice === state.voice &&
    ui === state.ui &&
    stage === state.stage
  ) {
    return state;
  }
  return { connection, conversation, audio, voice, ui, stage };
}

const store = createStore(
  persist(redux(reducer, initialState), {
    name: "voice:audio",
    // Only the chosen input device survives reloads/reconnects; everything
    // else (permission, device list, readiness) must be re-derived live.
    partialize: (state) => ({ audio: { selectedDeviceId: state.audio.selectedDeviceId } }),
    // Default persist merge is a shallow top-level spread, which would
    // replace the entire `audio` slice with just `{ selectedDeviceId }`.
    // Deep-merge so the rest of the freshly-initialized audio state stays intact.
    merge: (persisted, current) => {
      const saved = persisted as { audio?: { selectedDeviceId?: string | null } } | undefined;
      const selectedDeviceId = saved?.audio?.selectedDeviceId ?? current.audio.selectedDeviceId;
      return { ...current, audio: { ...current.audio, selectedDeviceId } };
    },
  }),
);

export type Store = typeof store;

export function getState(): RootState {
  return store.getState();
}

export function useStore<T>(selector: (state: RootState) => T): T {
  return useZustandStore(store, selector);
}

const actionListeners: Array<(a: Action) => void> = [];
const dispatchQueue: Action[] = [];
let dispatching = false;

export function dispatch(action: Action): void {
  if (dispatching) {
    // Re-entrant call: queue the action instead of processing inline.
    // This keeps stack depth O(1) and ensures all listeners for the
    // in-flight action complete before any follow-on action's listeners run.
    dispatchQueue.push(action);
    return;
  }
  dispatching = true;
  try {
    // Process this action and drain any follow-on actions enqueued by listeners.
    let current: Action | undefined = action;
    while (current !== undefined) {
      store.dispatch(current); // reducer runs; state updates
      for (const fn of actionListeners) fn(current); // listeners see post-action state
      current = dispatchQueue.shift();
    }
  } finally {
    dispatching = false;
  }
}

export function subscribeToActions(fn: (a: Action) => void): () => void {
  actionListeners.push(fn);
  return () => {
    const i = actionListeners.indexOf(fn);
    if (i !== -1) actionListeners.splice(i, 1);
  };
}
