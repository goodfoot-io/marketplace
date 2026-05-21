import { useCallback, useEffect, useRef } from "react";
import { DuplicateClientScreen } from "./components/DuplicateClientScreen.js";
import { FloatingTab } from "./components/FloatingTab.js";
import { InstructionsModal } from "./components/InstructionsModal.js";
import { TranscriptModal } from "./components/TranscriptModal.js";
import { WakeWordListener } from "./components/WakeWordListener.js";
import { dispatch, useStore } from "./store/index.js";

/**
 * Builds a CSS-selector path to `el`, rooted at its document `<body>`. Each
 * segment is `#id` when the element carries an id, else `tag:nth-of-type(n)`
 * (1-based among same-tag siblings). Walks up `parentElement` until `<body>`
 * (exclusive); the body itself is the implicit root and is not emitted. Returns
 * `body` when `el` is the body (or has no ancestry to walk).
 */
function cssPath(el: Element): string {
  const segments: string[] = [];
  let current: Element | null = el;
  while (current && current.tagName.toLowerCase() !== "body") {
    if (current.id) {
      segments.unshift(`#${current.id}`);
      break;
    }
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (child) => child.tagName.toLowerCase() === tag,
      );
      const index = sameTag.indexOf(current) + 1;
      segments.unshift(`${tag}:nth-of-type(${index})`);
    } else {
      segments.unshift(tag);
    }
    current = parent;
  }
  return segments.length > 0 ? `body > ${segments.join(" > ")}` : "body";
}

/**
 * Root. Q11: duplicate-client → swap to DuplicateClientScreen (React render,
 * no innerHTML; voiceSessionRunner already tore down audio synchronously).
 * Q4: single global Escape handler → ui/key/escape (reducer closes whatever
 * is open). Global outside-click closes the more-actions popover. Empty
 * stage — no background content (Q1).
 */
export function App(): React.JSX.Element {
  const duplicateClient = useStore((s) => s.ui.duplicateClient);
  const moreActionsOpen = useStore((s) => s.ui.moreActionsOpen);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        dispatch({ type: "ui/key/escape" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!moreActionsOpen) {
      return;
    }
    const onClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-more-actions]") !== null) {
        return;
      }
      if (target?.closest('[aria-label="More actions"]') !== null) {
        return;
      }
      dispatch({ type: "ui/click/modal-backdrop" });
    };
    // Defer registration so the opening click does not immediately close it.
    const id = window.setTimeout(() => document.addEventListener("click", onClick), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", onClick);
    };
  }, [moreActionsOpen]);

  const injectedVersion = useStore((s) => s.stage.injectedVersion);

  // The stage iframe is same-origin and mounts only while a custom-HTML stage
  // is displayed, so attaching the click listener to its `contentDocument`
  // captures clicks inside the stage only — never the voice overlays (which
  // live in the parent document). The document is swapped on every file-mode
  // live-reload (the `src` changes with `injectedVersion`), firing a fresh
  // `load`; `attachStageClick` detaches any prior listener first so a reload
  // re-attaches cleanly. The ref keeps the detacher reachable for unmount.
  const detachStageClickRef = useRef<(() => void) | null>(null);

  const attachStageClick = useCallback((iframe: HTMLIFrameElement): void => {
    detachStageClickRef.current?.();
    detachStageClickRef.current = null;
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) return;
    const onClick = (event: MouseEvent): void => {
      const target = event.composedPath()[0];
      if (!(target instanceof Element)) return;
      dispatch({
        type: "ui/html/click",
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
        width: win.innerWidth,
        height: win.innerHeight,
        path: cssPath(target),
      });
    };
    doc.addEventListener("click", onClick);
    detachStageClickRef.current = () => doc.removeEventListener("click", onClick);
  }, []);

  // Detach when the stage clears (iframe unmounts) or the App unmounts.
  useEffect(() => {
    if (injectedVersion == null) {
      detachStageClickRef.current?.();
      detachStageClickRef.current = null;
    }
    return () => {
      detachStageClickRef.current?.();
      detachStageClickRef.current = null;
    };
  }, [injectedVersion]);

  if (duplicateClient) {
    return <DuplicateClientScreen />;
  }

  return (
    <>
      {injectedVersion != null && (
        <iframe
          className="injected-stage"
          src={`/__injected?v=${injectedVersion}`}
          onLoad={(e) => attachStageClick(e.currentTarget)}
        />
      )}
      <FloatingTab />
      <TranscriptModal />
      <InstructionsModal />
      <WakeWordListener />
    </>
  );
}
