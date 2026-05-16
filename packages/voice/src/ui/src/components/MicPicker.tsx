import { useShallow } from "zustand/react/shallow";
import { dispatch, useStore } from "../store/index.js";

/**
 * Q9: mic device picker rendered inside the more-actions popover.
 * Q46: when permission is denied, shows an error state with a Retry button.
 * Render-only — device selection dispatches `ui/select/mic-device`;
 * voiceSessionRunner owns the actual getUserMedia / pipeline rebuild.
 */
export function MicPicker(): React.JSX.Element {
  const { permission, devices, selectedDeviceId } = useStore(
    useShallow((s) => ({
      permission: s.audio.permission,
      devices: s.audio.devices,
      selectedDeviceId: s.audio.selectedDeviceId,
    })),
  );

  if (permission === "denied") {
    return (
      <div className="error-block">
        <div className="error-title">Microphone error</div>
        <div>Microphone access denied — allow access in browser settings.</div>
        <button
          className="retry"
          type="button"
          onClick={() => dispatch({ type: "ui/click/primary" })}
        >
          Retry
        </button>
      </div>
    );
  }

  if (devices.length === 0) {
    return <div className="mic-note">Microphone access is required to use voice.</div>;
  }

  return (
    <div>
      <label className="field-label" htmlFor="micSelect">
        Microphone
      </label>
      <select
        id="micSelect"
        value={selectedDeviceId ?? devices[0]?.deviceId ?? ""}
        onChange={(e) => dispatch({ type: "ui/select/mic-device", deviceId: e.target.value })}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
    </div>
  );
}
