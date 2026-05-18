import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./index.css";
import { createAutoplayRunner } from "./runners/autoplayRunner.js";
import { createDeviceRunner } from "./runners/deviceRunner.js";
import { createErrorRunner } from "./runners/errorRunner.js";
import { createHostSocketRunner } from "./runners/hostSocketRunner.js";
import { createVoiceSessionRunner } from "./runners/voiceSessionRunner.js";
import { createWakeWordRunner } from "./runners/wakeWordRunner.js";
import { dispatch, getState, type RootState, subscribeToActions } from "./store/index.js";

// Boot the six effect runners BEFORE React mounts so every runner is
// subscribed to the action stream before the first dispatched action
// (the autoplay probe result) fires. Runners are plain modules — never
// React hooks, never imported by components. (wakeWordRunner publishes a
// listening intent the headless WakeWordListener component drives `use-ear`
// from; the runner itself stays React-free.)
const deps = { dispatch, subscribeToActions, getState };
createHostSocketRunner(deps);
createVoiceSessionRunner(deps);
createDeviceRunner(deps);
createErrorRunner(deps);
createAutoplayRunner(deps);
createWakeWordRunner(deps);

// ── Remote debug hook ────────────────────────────────────────────────────
// Exposes a JSON-safe store snapshot plus the recent action stream so a
// remote driver (e.g. Puppeteer `page.evaluate(() => window.__voice.state())`)
// can inspect runtime state without reaching into module-scoped internals.
// Read-only: dumping never mutates the store. The action ring buffer is the
// fastest way to see why a session did/didn't start (autoplay probe, gesture
// gate, session-in-flight, pause cuts).
const RECENT_ACTIONS_CAP = 200;
const recentActions: Array<{ t: number; type: string }> = [];
subscribeToActions((action) => {
  recentActions.push({ t: Date.now(), type: action.type });
  if (recentActions.length > RECENT_ACTIONS_CAP) recentActions.shift();
});

interface VoiceDebug {
  /** JSON-safe deep snapshot of the full Zustand store (RootState). */
  state: () => RootState;
  /** Last N dispatched action types with timestamps (oldest first). */
  actions: () => Array<{ t: number; type: string }>;
}
declare global {
  interface Window {
    __voice?: VoiceDebug;
  }
}
window.__voice = {
  state: () => {
    // JSON round-trip yields a detached, structured-clone-safe snapshot;
    // guard so a future non-serializable field degrades instead of throwing.
    try {
      return JSON.parse(JSON.stringify(getState())) as RootState;
    } catch {
      return getState();
    }
  },
  actions: () => recentActions.slice(),
};

const rootEl = document.getElementById("root");
if (rootEl === null) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
