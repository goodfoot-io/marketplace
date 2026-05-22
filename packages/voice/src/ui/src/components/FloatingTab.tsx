import { useShallow } from "zustand/react/shallow";
import { dispatch, useStore } from "../store/index.js";
import { EqBars } from "./EqBars.js";
import { MicPicker } from "./MicPicker.js";
import { SettingsPanel } from "./SettingsPanel.js";
import { VoicePicker } from "./VoicePicker.js";

type TabState = "idle" | "connecting" | "active" | "paused";

/**
 * Q3: derives one of four states purely from the `voice` slice (NOT
 * conversation.status — that is server-side and does not reflect local
 * pause). Connection dot is driven by the separate `connection` slice.
 * Icon-only buttons (Q2). The session-start machinery lives entirely in
 * voiceSessionRunner; this component only dispatches `ui/*`.
 */
export function FloatingTab(): React.JSX.Element {
  const { xaiOpen, xaiStatus, sessionInFlight, paused } = useStore(
    useShallow((s) => ({
      xaiOpen: s.voice.xaiOpen,
      xaiStatus: s.voice.xaiStatus,
      sessionInFlight: s.voice.sessionInFlight,
      paused: s.voice.paused,
    })),
  );
  const connectionStatus = useStore((s) => s.connection.status);
  const autoplayAllowed = useStore((s) => s.audio.autoplayAllowed);
  const moreActionsOpen = useStore((s) => s.ui.moreActionsOpen);
  const waitingForContext = useStore((s) => s.ui.waitingForContext);
  const hasTranscript = useStore(
    (s) => (s.conversation.conversation?.transcript.length ?? 0) > 0,
  );

  let tabState: TabState;
  if (!xaiOpen && !sessionInFlight) {
    tabState = "idle";
  } else if (sessionInFlight && !xaiOpen) {
    tabState = "connecting";
  } else if (xaiOpen && !paused) {
    tabState = "active";
  } else {
    tabState = "paused";
  }

  const playPaused = tabState === "idle" || tabState === "paused";
  const primaryDisabled = tabState === "connecting";
  const autoplayBlocked = autoplayAllowed === false;

  return (
    <div className="floating-tab">
      <button
        className="icon-btn"
        type="button"
        disabled={primaryDisabled}
        aria-label={playPaused ? "Start conversation" : "Pause conversation"}
        title={autoplayBlocked && playPaused ? "Click to enable audio." : undefined}
        onClick={() => dispatch({ type: "ui/click/primary" })}
      >
        <span
          className={`codicon codicon-${playPaused ? "play" : "debug-pause"}`}
          aria-hidden="true"
        />
      </button>

      {tabState === "active" || tabState === "paused" ? (
        <button
          className="icon-btn"
          type="button"
          aria-label="Reset conversation"
          onClick={() => dispatch({ type: "ui/click/reset" })}
        >
          <span className="codicon codicon-refresh" aria-hidden="true" />
        </button>
      ) : null}

      <button
        className="icon-btn"
        type="button"
        aria-label="View transcript"
        onClick={() => dispatch({ type: "ui/click/transcript" })}
      >
        <span className="codicon codicon-comment-discussion" aria-hidden="true" />
      </button>

      <button
        className="icon-btn"
        type="button"
        aria-label="View instructions"
        onClick={() => dispatch({ type: "ui/click/instructions" })}
      >
        <span className="codicon codicon-book" aria-hidden="true" />
      </button>

      {tabState === "active" ? <EqBars dimmed={false} /> : null}

      <div className="connection" title={`Local: ${connectionStatus} · xAI: ${xaiStatus}`}>
        <span className="connection-dot">
          <span className="split-dot">
            <span className={`split-dot-half top ${connectionStatus}`} />
            <span className={`split-dot-half bottom ${xaiStatus}`} />
          </span>
          {waitingForContext ? <span className="comet" aria-hidden="true" /> : null}
        </span>
      </div>

      <div style={{ position: "relative" }}>
        <button
          className="icon-btn"
          type="button"
          aria-label="More actions"
          aria-expanded={moreActionsOpen}
          onClick={() => dispatch({ type: "ui/click/more-actions" })}
        >
          <span className="codicon codicon-ellipsis" aria-hidden="true" />
        </button>
        {moreActionsOpen ? (
          <div className="more-actions-popover" data-more-actions>
            <MicPicker />
            <VoicePicker />
            <button
              className="menu-item"
              type="button"
              disabled={!hasTranscript}
              onClick={() => dispatch({ type: "ui/click/download-transcript" })}
            >
              Download transcript (JSONL)
            </button>
            <SettingsPanel />
          </div>
        ) : null}
      </div>
    </div>
  );
}
