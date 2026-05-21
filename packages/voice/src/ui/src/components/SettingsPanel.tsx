import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { dispatch, useStore } from "../store/index.js";

/**
 * Renders the host-configured `ui.settings` items inside the more-actions
 * popover, beneath the mic picker. Each `button` item is an action button; if
 * it carries a `confirmation`, clicking opens an inline confirm/cancel prompt
 * before the invoke is sent. The control is disabled while its callback is in
 * flight, and the last success/error result is surfaced inline.
 *
 * Invocation is fire-and-forget over the host socket: clicking dispatches
 * `ui/click/setting` (the reducer marks the id in-flight and hostSocketRunner
 * sends `settings.invoke`); the result arrives later as `host/settings/result`.
 */
export function SettingsPanel(): React.JSX.Element | null {
  const { settings, settingsInFlight, settingsResults } = useStore(
    useShallow((s) => ({
      settings: s.ui.settings,
      settingsInFlight: s.ui.settingsInFlight,
      settingsResults: s.ui.settingsResults,
    })),
  );

  // Id of the item whose confirmation prompt is currently open, if any.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (settings.length === 0) return null;

  return (
    <div className="settings-panel">
      {settings.map((item) => {
        const inFlight = settingsInFlight.has(item.id);
        const result = settingsResults.get(item.id);
        const confirming = confirmingId === item.id;

        const invoke = (): void => {
          setConfirmingId(null);
          dispatch({ type: "ui/click/setting", id: item.id });
        };

        const onClick = (): void => {
          if (item.confirmation) {
            setConfirmingId(item.id);
            return;
          }
          invoke();
        };

        return (
          <div key={item.id} className="setting-item">
            <button className="menu-item" type="button" disabled={inFlight} onClick={onClick}>
              {item.label}
            </button>
            {confirming && item.confirmation ? (
              <div className="setting-confirm">
                <div className="setting-confirm-text">{item.confirmation.text}</div>
                <div className="setting-confirm-actions">
                  <button
                    className="setting-confirm-btn danger"
                    type="button"
                    disabled={inFlight}
                    onClick={invoke}
                  >
                    {item.confirmation.confirmLabel ?? "Confirm"}
                  </button>
                  <button
                    className="setting-confirm-btn"
                    type="button"
                    onClick={() => setConfirmingId(null)}
                  >
                    {item.confirmation.cancelLabel ?? "Cancel"}
                  </button>
                </div>
              </div>
            ) : null}
            {result && !result.ok ? (
              <div className="setting-result error">{result.error ?? "Action failed."}</div>
            ) : null}
            {result?.ok ? <div className="setting-result ok">Done.</div> : null}
          </div>
        );
      })}
    </div>
  );
}
