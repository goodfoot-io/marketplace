import type { XAIVoice } from "../../../xai-realtime-api.js";
import { dispatch, useStore } from "../store/index.js";

/**
 * Voice picker rendered inside the more-actions popover, beneath the mic
 * picker. Mirrors MicPicker: render-only, the selection dispatches
 * `ui/select/voice` and is persisted across reloads exactly like the chosen
 * mic device. The choice is applied entirely browser-side — voiceSessionRunner
 * rewrites the `voice` field of the daemon's session.update before forwarding
 * it to xAI — so the daemon is never told which voice is selected. A changed
 * voice takes effect on the next conversation start / reset.
 */
const VOICES: { id: XAIVoice; label: string }[] = [
  { id: "eve", label: "Eve" },
  { id: "ara", label: "Ara" },
  { id: "rex", label: "Rex" },
  { id: "sal", label: "Sal" },
  { id: "leo", label: "Leo" },
  { id: "uxren5fsalk9", label: "John" },
];

// Matches the daemon's DEFAULT_REALTIME_VOICE. Only used to show a sensible
// selection when the user has not made an explicit choice yet (selectedVoice
// is null and the runner leaves the daemon's configured voice untouched).
const DEFAULT_VOICE: XAIVoice = "eve";

export function VoicePicker(): React.JSX.Element {
  const selectedVoice = useStore((s) => s.voice.selectedVoice);

  return (
    <div>
      <label className="field-label" htmlFor="voiceSelect">
        Voice
      </label>
      <select
        id="voiceSelect"
        value={selectedVoice ?? DEFAULT_VOICE}
        onChange={(e) => dispatch({ type: "ui/select/voice", voice: e.target.value as XAIVoice })}
      >
        {VOICES.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.label}
          </option>
        ))}
      </select>
    </div>
  );
}
