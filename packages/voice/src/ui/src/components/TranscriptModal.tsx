import { useEffect, useRef } from "react";
import { dispatch, useStore } from "../store/index.js";
import { TranscriptContent } from "./TranscriptContent.js";

/**
 * Q4: role="dialog", aria-modal, focus on mount, focus restore on unmount,
 * tab trap. Q5: scroll-anchor — on open, if conversation.atBottom, scroll
 * the body to the bottom. Q6: the "assistant is responding" affordance is now
 * an assistant-style placeholder bubble rendered by TranscriptContent (the
 * green counterpart to the user speaking placeholder), not a separate strip.
 */
export function TranscriptModal(): React.JSX.Element | null {
  const open = useStore((s) => s.ui.modal === "transcript");
  const atBottom = useStore((s) => s.conversation.atBottom);
  const transcript = useStore((s) => s.conversation.conversation?.transcript);
  const streamDrafts = useStore((s) => s.conversation.streamDrafts);

  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
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

  // Q5: scroll anchor — runs on open, whenever atBottom is re-asserted,
  // and whenever transcript content changes (streaming deltas or new items)
  // so live content stays followed while the modal is open.
  useEffect(() => {
    if (open && atBottom && bodyRef.current !== null) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [open, atBottom, transcript, streamDrafts]);

  if (!open) {
    return null;
  }

  const onTrapKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "Tab") {
      return;
    }
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) {
      return;
    }
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => dispatch({ type: "ui/click/modal-backdrop" })}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcript-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onTrapKeyDown}
      >
        <div className="modal-header">
          <span className="modal-title" id="transcript-title">
            Conversation
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
        <div
          className="modal-body"
          ref={bodyRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            dispatch({
              type: "ui/scroll/transcript",
              atBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 80,
            });
          }}
        >
          <TranscriptContent />
        </div>
      </div>
    </div>
  );
}
