import { dispatch } from "../store/index.js";

/**
 * Shown in place of the stage iframe when the host reports that an
 * injected-by-path HTML file is missing/unreadable (state.injectedAbsentPath).
 *
 * This is an informational/quiet state, NOT an error: the host keeps polling
 * the path, so re-writing the file makes the real stage reappear on its own and
 * this notice goes away. The "Clear" button is de-emphasized — it's an escape
 * hatch (drop the injected HTML entirely, like setHtml(null) from the MCP
 * server), not the expected next action.
 */
export function StageAbsentNotice({ path }: { path: string }): React.JSX.Element {
  return (
    <div className="stage-absent" role="status" aria-live="polite">
      <div className="stage-absent-card">
        <p className="stage-absent-message">HTML file no longer present</p>
        <pre className="stage-absent-path">{path}</pre>
        <p className="stage-absent-hint">
          Waiting for the file to reappear — it will render again automatically if re-written.
        </p>
        <button
          type="button"
          className="stage-absent-clear"
          onClick={() => dispatch({ type: "ui/click/clear-html" })}
        >
          Clear HTML
        </button>
      </div>
    </div>
  );
}
