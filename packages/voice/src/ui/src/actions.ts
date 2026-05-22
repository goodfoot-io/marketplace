import type {
  BrowserAudioInputDevice,
  JsonValue,
  ServerEnvelope,
  TranscriptDeltaEvent,
  TranscriptItem,
} from "../../types.js";
import type { XAIClientEvent, XAIVoice } from "../../xai-realtime-api.js";

// Wire-type name mappings (plan → actual exported names in types.ts):
//  - plan `BroadcastState` → the `state` ServerEnvelope member's `data` payload (no such
//    standalone exported name exists; derived here from ServerEnvelope).
//  - plan `VoiceToken`     → the `voice.session.token` ServerEnvelope member's `data`.
//  - plan `AudioDevice`    → `BrowserAudioInputDevice` (actual exported name).

/** The `data` payload of the server's `state` broadcast envelope. */
export type BroadcastState = Extract<ServerEnvelope, { type: "state" }>["data"];

/** The `data` payload of the server's `voice.session.token` broadcast envelope. */
export type VoiceToken = Extract<ServerEnvelope, { type: "voice.session.token" }>["data"];

/** Audio input device descriptor (plan: `AudioDevice`). */
export type AudioDevice = BrowserAudioInputDevice;

export type Action =
  // xAI WS lifecycle (browser-synthesized; NOT forwarded as voice.event to host)
  | { type: "xai/ws/connecting" }
  | { type: "xai/ws/open" }
  | { type: "xai/ws/close"; code: number; reason: string }
  | { type: "xai/ws/error" }
  // xAI realtime server events — full set from XAIServerEvent
  | { type: "xai/error"; code: string; message: string }
  | { type: "xai/session/created" }
  | { type: "xai/session/updated" }
  | { type: "xai/conversation/created" }
  | { type: "xai/conversation/item/added"; itemId: string; role: string }
  | { type: "xai/conversation/item/deleted"; itemId: string }
  | {
      type: "xai/conversation/item/input-audio-transcription/completed";
      itemId: string;
      transcript: string;
    }
  | { type: "xai/input-audio-buffer/speech-started"; itemId: string }
  | { type: "xai/input-audio-buffer/speech-stopped" }
  | { type: "xai/input-audio-buffer/committed" }
  | { type: "xai/input-audio-buffer/cleared" }
  | { type: "xai/response/created" }
  | { type: "xai/response/done" }
  | { type: "xai/response/cancelled" }
  | { type: "xai/response/failed" }
  | { type: "xai/response/output-item/added"; itemId: string }
  | { type: "xai/response/output-item/done"; itemId: string }
  | { type: "xai/response/content-part/added" }
  | { type: "xai/response/content-part/done" }
  | { type: "xai/response/output-audio/delta"; b64: string }
  | { type: "xai/response/output-audio/done" }
  | { type: "xai/response/output-audio-transcript/delta"; delta: string }
  | { type: "xai/response/output-audio-transcript/done" }
  | { type: "xai/response/text/delta"; delta: string }
  | { type: "xai/response/text/done" }
  | { type: "xai/response/function-call-arguments/delta" }
  | { type: "xai/response/function-call-arguments/done" }
  | { type: "xai/response/mcp-call-arguments/delta" }
  | { type: "xai/response/mcp-call-arguments/done" }
  | { type: "xai/response/mcp-call/in-progress" }
  | { type: "xai/response/mcp-call/completed" }
  | { type: "xai/response/mcp-call/failed" }
  | { type: "xai/mcp-list-tools/in-progress" }
  | { type: "xai/mcp-list-tools/completed" }
  | { type: "xai/mcp-list-tools/failed" }
  | { type: "xai/unknown"; raw: unknown }
  // Host daemon events
  | { type: "host/state"; data: BroadcastState }
  | { type: "host/stage"; data: { injectedVersion: number | null } }
  | { type: "host/transcript/item"; item: TranscriptItem }
  | { type: "host/transcript/delta"; delta: TranscriptDeltaEvent }
  | { type: "host/voice/session/start" }
  | { type: "host/voice/session/token"; token: VoiceToken }
  | { type: "host/voice/session/close"; code: number; reason: string }
  | { type: "host/voice/send"; event: XAIClientEvent; gate?: "playback-drained" }
  | {
      type: "host/browser-audio/device-change";
      devices: AudioDevice[];
      selectedDeviceId: string | null;
    }
  | { type: "host/duplicate-client" }
  | { type: "host/wait-for-context/start" }
  | { type: "host/wait-for-context/end" }
  | { type: "host/settings/result"; id: string; ok: boolean; error?: string }
  // Browser / audio system events
  | { type: "browser/autoplay/probed"; allowed: boolean }
  | { type: "browser/devices/enumerated"; devices: AudioDevice[] }
  | { type: "browser/permission/granted" }
  | { type: "browser/permission/denied" }
  | { type: "browser/mic/stream-acquired"; deviceId: string; trackId: string }
  | { type: "browser/mic/stream-failed"; error: { code: string; message: string } }
  | { type: "browser/mic/track-ended" }
  | { type: "browser/window/error"; message: string }
  | { type: "browser/window/unhandled-rejection"; reason: string }
  // UI interactions
  | { type: "ui/click/primary" }
  | { type: "ui/click/reset" }
  | { type: "ui/click/transcript" }
  | { type: "ui/click/instructions" }
  | { type: "ui/click/more-actions" }
  | { type: "ui/click/modal-backdrop" }
  | { type: "ui/click/modal-close" }
  | { type: "ui/click/download-transcript" }
  | { type: "ui/key/escape" }
  | { type: "ui/select/mic-device"; deviceId: string }
  | { type: "ui/select/voice"; voice: XAIVoice | null }
  | { type: "ui/scroll/transcript"; atBottom: boolean }
  | { type: "ui/click/setting"; id: string }
  | {
      type: "ui/html/click";
      x: number;
      y: number;
      width: number;
      height: number;
      path: string;
    }
  // Inbound: the HTML iframe posted a message out to the parent.
  | { type: "ui/html/message"; payload: JsonValue }
  // Outbound: a host envelope asking us to postMessage into the HTML iframe.
  | { type: "host/html/post-message"; payload: JsonValue }
  // Connection lifecycle (host WebSocket)
  | { type: "connection/status"; status: "connecting" | "connected" | "disconnected" | "error" }
  // Voice session lifecycle
  | { type: "voice/session/in-flight"; inFlight: boolean }
  | { type: "voice/paused"; paused: boolean }
  | { type: "voice/playback/cursor"; nextPlaybackTime: number; playbackEndsAt: number }
  | { type: "voice/playback/cut" }
  | { type: "voice/playback/drained" }
  | { type: "voice/queue/pre-open-cap-hit" };
