import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { dispatch, useStore } from "../store/index.js";

/**
 * Q7/Q8/Q53: instructions is `string | undefined`. `undefined` → explicit
 * "Loading…" placeholder (no broadcast yet, makes a broken wire visible);
 * `""` → renders empty (server set no instructions); a string → markdown.
 * No `?? ""` coercion. disallowedElements strips script/iframe/object/embed.
 */
export function InstructionsModal(): React.JSX.Element | null {
  const open = useStore((s) => s.ui.modal === "instructions");
  const instructions = useStore((s) => s.conversation.instructions);

  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      onClick={() => dispatch({ type: "ui/click/modal-backdrop" })}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructions-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title" id="instructions-title">
            Instructions
          </span>
          <button
            className="modal-close"
            type="button"
            aria-label="Close"
            onClick={() => dispatch({ type: "ui/click/modal-close" })}
          >
            <span className="codicon codicon-close" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body instructions-body">
          {instructions === undefined ? (
            <p className="loading-state">Loading instructions…</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              disallowedElements={["script", "iframe", "object", "embed"]}
              unwrapDisallowed
            >
              {instructions}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
