import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./index.css";
import { createAutoplayRunner } from "./runners/autoplayRunner.js";
import { createDeviceRunner } from "./runners/deviceRunner.js";
import { createErrorRunner } from "./runners/errorRunner.js";
import { createHostSocketRunner } from "./runners/hostSocketRunner.js";
import { createVoiceSessionRunner } from "./runners/voiceSessionRunner.js";
import { dispatch, getState, subscribeToActions } from "./store/index.js";

// Boot the five effect runners BEFORE React mounts so every runner is
// subscribed to the action stream before the first dispatched action
// (the autoplay probe result) fires. Runners are plain modules — never
// React hooks, never imported by components.
const deps = { dispatch, subscribeToActions, getState };
createHostSocketRunner(deps);
createVoiceSessionRunner(deps);
createDeviceRunner(deps);
createErrorRunner(deps);
createAutoplayRunner(deps);

const rootEl = document.getElementById("root");
if (rootEl === null) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
