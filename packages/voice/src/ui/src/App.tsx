import { useCallback, useEffect, useRef } from "react";
import type { JsonValue } from "../../types.js";
import { DuplicateClientScreen } from "./components/DuplicateClientScreen.js";
import { FloatingTab } from "./components/FloatingTab.js";
import { InstructionsModal } from "./components/InstructionsModal.js";
import { StageAbsentNotice } from "./components/StageAbsentNotice.js";
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
  const injectedAbsentPath = useStore((s) => s.stage.injectedAbsentPath);

  // The stage iframe is same-origin and mounts only while a custom-HTML stage
  // is displayed, so attaching the click listener to its `contentDocument`
  // captures clicks inside the stage only — never the voice overlays (which
  // live in the parent document). The document is swapped on every file-mode
  // live-reload (the `src` changes with `injectedVersion`), firing a fresh
  // `load`; `attachStageClick` detaches any prior listener first so a reload
  // re-attaches cleanly. The ref keeps the detacher reachable for unmount.
  const detachStageClickRef = useRef<(() => void) | null>(null);

  // The live stage iframe element, captured on load. Used to validate the
  // source of inbound postMessages (only the real stage window may drive
  // `ui/html/message`) — see the window `message` listener below.
  const stageIframeRef = useRef<HTMLIFrameElement | null>(null);

  const attachStageClick = useCallback((iframe: HTMLIFrameElement): void => {
    stageIframeRef.current = iframe;
    detachStageClickRef.current?.();
    detachStageClickRef.current = null;
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) return;
    const onClick = (event: MouseEvent): void => {
      const target = event.composedPath()[0];
      // The same-origin stage iframe is a SEPARATE JS realm, so its elements are
      // instances of the iframe's `Element` (`win.Element`), not the parent
      // window's. A bare `instanceof Element` is always false here, dropping
      // every stage click. Test against the iframe realm's constructor.
      if (!(target instanceof win.Element)) return;
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
      stageIframeRef.current = null;
    }
    return () => {
      detachStageClickRef.current?.();
      detachStageClickRef.current = null;
    };
  }, [injectedVersion]);

  // Inbound HTML→colleague channel: the stage document may `postMessage` out to
  // its parent (window.parent.postMessage(payload, origin)). Accept only
  // same-origin messages whose source IS the live stage iframe window — this
  // keeps other frames, extensions, and cross-origin senders from driving the
  // channel — and relay the payload as `ui/html/message`.
  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== stageIframeRef.current?.contentWindow) return;
      dispatch({ type: "ui/html/message", payload: event.data as JsonValue });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
      {injectedAbsentPath != null && <StageAbsentNotice path={injectedAbsentPath} />}
      <FloatingTab />
      <TranscriptModal />
      <InstructionsModal />
      <WakeWordListener />
    </>
  );
}
