import { useEffect } from "react";
import { DuplicateClientScreen } from "./components/DuplicateClientScreen.js";
import { FloatingTab } from "./components/FloatingTab.js";
import { InstructionsModal } from "./components/InstructionsModal.js";
import { TranscriptModal } from "./components/TranscriptModal.js";
import { WakeWordListener } from "./components/WakeWordListener.js";
import { dispatch, useStore } from "./store/index.js";

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

  if (duplicateClient) {
    return <DuplicateClientScreen />;
  }

  return (
    <>
      {injectedVersion != null && (
        <iframe className="injected-stage" src={`/__injected?v=${injectedVersion}`} />
      )}
      <FloatingTab />
      <TranscriptModal />
      <InstructionsModal />
      <WakeWordListener />
    </>
  );
}
