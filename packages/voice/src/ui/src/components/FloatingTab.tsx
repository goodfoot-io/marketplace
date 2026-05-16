import { useShallow } from "zustand/react/shallow";
import { dispatch, useStore } from "../store/index.js";
import { EqBars } from "./EqBars.js";
import { MicPicker } from "./MicPicker.js";

type TabState = "idle" | "connecting" | "active" | "paused";

/**
 * Q3: derives one of four states purely from the `voice` slice (NOT
 * conversation.status — that is server-side and does not reflect local
 * pause). Connection dot is driven by the separate `connection` slice.
 * Icon-only buttons (Q2). The session-start machinery lives entirely in
 * voiceSessionRunner; this component only dispatches `ui/*`.
 */
export function FloatingTab(): React.JSX.Element {
  const { xaiOpen, sessionInFlight, paused } = useStore(
    useShallow((s) => ({
      xaiOpen: s.voice.xaiOpen,
      sessionInFlight: s.voice.sessionInFlight,
      paused: s.voice.paused,
    })),
  );
  const connectionStatus = useStore((s) => s.connection.status);
  const autoplayAllowed = useStore((s) => s.audio.autoplayAllowed);
  const moreActionsOpen = useStore((s) => s.ui.moreActionsOpen);
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
        {autoplayBlocked && playPaused ? (
          <span className="shield-badge codicon codicon-shield" aria-hidden="true" />
        ) : null}
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

      <div className="connection">
        <span className={`dot ${connectionStatus}`} />
        {connectionStatus === "connecting" ? (
          <span>Connecting...</span>
        ) : connectionStatus === "disconnected" ? (
          <span>Disconnected</span>
        ) : connectionStatus === "error" ? (
          <span>Connection Error</span>
        ) : null}
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
            <button
              className="menu-item"
              type="button"
              disabled={!hasTranscript}
              onClick={() => dispatch({ type: "ui/click/download-transcript" })}
            >
              Download transcript (JSONL)
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
