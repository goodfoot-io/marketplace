import type { ServerEnvelope } from "../../../types.js";
import type { Action } from "../actions.js";
import type { RunnerDeps } from "./types.js";

/**
 * hostSocketRunner owns the daemon WebSocket (`/ws`). It ports the vanilla
 * SPA's `connect()`, `handleMessage()`, `sendMessage()`, and `dlog()` paths.
 *
 * Runner-private state (NOT in the store):
 *  - the WebSocket ref + reconnect backoff (250ms → 5000ms, ×2 per the SPA)
 *  - `debugBuffer: string[]` — wire-log frames captured while the WS is closed.
 *
 * Q24 (flush ordering): on `open`, every buffered frame is sent via raw
 * `ws.send(...)` BEFORE any action is dispatched. Only after the flush loop
 * completes does the runner dispatch `connection/status connected`. Because
 * the wire-log middleware fires solely on dispatched actions and no dispatch
 * happens until the flush finishes, the buffered frames provably reach the
 * daemon before the first live `browser.debug` frame.
 *
 * Q28 (voice.event forwarding): every action whose type starts with `xai/`
 * but NOT `xai/ws/` is serialized as `{ type: "voice.event", data: { event } }`
 * and sent to the daemon (the audit/transcript trail). `xai/ws/*` are
 * browser-synthesized lifecycle actions with no xAI server body and are
 * excluded — they are already captured by the browser.debug wire log.
 *
 * `sendToHost` is exported so `voiceSessionRunner` can emit the daemon
 * envelopes the vanilla SPA sent (`conversation.start`,
 * `voice.session.requested`, `voice.session.connected`,
 * `voice.session.failed`, `browser.audio.error`, `audio.device.*`,
 * `conversation.pause|resume|reset`) without sharing the WS ref.
 */

let ws: WebSocket | undefined;
let reconnectMs = 250;
let connected = false;
const debugBuffer: string[] = [];

// Action types whose payloads are too large to wire-log (Q24/Q28).
const WIRE_LOG_FILTER = new Set<Action["type"]>(["xai/response/output-audio/delta"]);

// The raw xAI server frame is needed to forward as `voice.event`. The action
// stream does not carry the original envelope, so hostSocketRunner records the
// last raw xAI frame it dispatched and pairs it with the synthesized action.
let lastRawXaiFrame: unknown;

function wsUrl(): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
}

/** Send a daemon envelope. Mirrors the vanilla SPA's `sendMessage(type,data)`. */
export function sendToHost(type: string, data?: unknown): void {
  const frame = JSON.stringify({ type, data });
  if (type === "browser.debug") {
    // Wire-log frame: buffer while closed (Q24), else send directly.
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(frame);
    } else {
      debugBuffer.push(frame);
    }
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(frame);
  }
}

/** Map a parsed ServerEnvelope to its `host/*` action(s). */
function envelopeToActions(message: ServerEnvelope): Action[] {
  switch (message.type) {
    case "duplicate.client":
      return [{ type: "host/duplicate-client" }];
    case "state":
      return [{ type: "host/state", data: message.data }];
    case "transcript.item":
      return [{ type: "host/transcript/item", item: message.data }];
    case "transcript.delta":
      return [{ type: "host/transcript/delta", delta: message.data }];
    case "browser.audio.deviceChange":
      return [
        {
          type: "host/browser-audio/device-change",
          devices: message.data.devices.map((device) => ({
            deviceId: device.deviceId,
            label: device.label,
            groupId: device.groupId,
          })),
          selectedDeviceId: message.data.selectedDeviceId ?? null,
        },
      ];
    case "voice.session.start":
      return [{ type: "host/voice/session/start" }];
    case "voice.session.token":
      return [{ type: "host/voice/session/token", token: message.data }];
    case "voice.session.close":
      return [
        {
          type: "host/voice/session/close",
          code: message.data.code,
          reason: message.data.reason,
        },
      ];
    case "voice.send":
      return [
        {
          type: "host/voice/send",
          event: message.data.event,
          gate: message.data.gate,
        },
      ];
    case "stage.injected":
      return [
        {
          type: "host/stage",
          data: {
            injectedVersion: message.data.injectedVersion,
            injectedAbsentPath: message.data.injectedAbsentPath,
          },
        },
      ];
    case "html.postMessage":
      return [{ type: "host/html/post-message", payload: message.data.payload }];
    case "wait_for_context.start":
      return [{ type: "host/wait-for-context/start" }];
    case "wait_for_context.end":
      return [{ type: "host/wait-for-context/end" }];
    case "settings.result":
      return [
        {
          type: "host/settings/result",
          id: message.data.id,
          ok: message.data.ok,
          error: message.data.error,
        },
      ];
    case "audio.output.delta":
      // Visualizer-only relay; playback is driven by the xAI WS path. The
      // vanilla SPA deliberately ignores this.
      return [];
    case "error":
      // No dedicated error action in the union; surface via the debug wire log.
      return [];
    default:
      return [];
  }
}

export function createHostSocketRunner({ dispatch, subscribeToActions, getState }: RunnerDeps): () => void {
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = (): void => {
    dispatch({ type: "connection/status", status: "connecting" });
    const socket = new WebSocket(wsUrl());
    ws = socket;
    connected = false;

    socket.addEventListener("open", () => {
      reconnectMs = 250;
      // Q24: flush every buffered wire-log frame BEFORE any dispatch.
      // A failed flush must not abort the open path or dispatch early
      // (that would emit a live browser.debug before the flush completes,
      // violating Q24 ordering). Collect failures and surface them AFTER
      // the connected dispatch.
      const flushFailures: string[] = [];
      for (const frame of debugBuffer) {
        try {
          socket.send(frame);
        } catch (error) {
          flushFailures.push(String(error instanceof Error ? error.message : error));
        }
      }
      debugBuffer.length = 0;
      connected = true;
      // First dispatch — the wire-log middleware now emits its first live
      // browser.debug, which arrives after every buffered frame.
      dispatch({ type: "connection/status", status: "connected" });
      for (const message of flushFailures) {
        dispatch({
          type: "browser/window/error",
          message: `debugBuffer.flush.failed: ${message}`,
        });
      }
    });

    socket.addEventListener("message", (event) => {
      let parsed: ServerEnvelope;
      try {
        parsed = JSON.parse(String(event.data)) as ServerEnvelope;
      } catch (error) {
        dispatch({
          type: "browser/window/error",
          message: `ws.in.parseError: ${String(error instanceof Error ? error.message : error)}`,
        });
        return;
      }
      for (const action of envelopeToActions(parsed)) {
        dispatch(action);
      }
    });

    socket.addEventListener("close", () => {
      connected = false;
      ws = undefined;
      dispatch({ type: "connection/status", status: "disconnected" });
      if (closed) return;
      reconnectTimer = setTimeout(connect, reconnectMs);
      reconnectMs = Math.min(reconnectMs * 2, 5000);
    });

    socket.addEventListener("error", () => {
      dispatch({ type: "connection/status", status: "error" });
    });
  };

  const unsubscribe = subscribeToActions((action) => {
    // Q28: forward xAI server-frame actions (not xai/ws/* lifecycle) as
    // voice.event so the daemon keeps its transcript/tool wiring.
    if (action.type.startsWith("xai/") && !action.type.startsWith("xai/ws/")) {
      if (lastRawXaiFrame !== undefined) {
        sendToHost("voice.event", { event: lastRawXaiFrame });
      }
    }

    // Q49: download transcript — finalized items only, no stream drafts.
    if (action.type === "ui/click/download-transcript") {
      downloadTranscript(getState);
    }

    // Clear button on the absent-file notice: ask the host to drop the
    // injected HTML entirely (same effect as setHtml(null) from the MCP
    // server). The host broadcasts a fresh state with injectedAbsentPath=null,
    // which removes the notice.
    if (action.type === "ui/click/clear-html") {
      sendToHost("html.clear");
    }

    // Settings button invoke: send the id to the host, which fires the
    // configured callback and replies with `settings.result`. The reducer
    // already marked the id in-flight when the action dispatched.
    if (action.type === "ui/click/setting") {
      sendToHost("settings.invoke", { id: action.id });
    }

    // Click inside the same-origin stage iframe: forward to the host as
    // `html.click` so the controller can emit it on the channel. Only fires
    // while a custom-HTML stage is mounted (the listener lives on the iframe
    // document), so conversation-UI clicks never reach here.
    if (action.type === "ui/html/click") {
      sendToHost("html.click", {
        x: action.x,
        y: action.y,
        width: action.width,
        height: action.height,
        path: action.path,
      });
    }

    // Inbound: the stage iframe posted a message out (App validated its
    // origin+source) — relay the payload to the host as `html.message`, which
    // the controller emits on the channel.
    if (action.type === "ui/html/message") {
      sendToHost("html.message", { payload: action.payload });
    }

    // Outbound: the host asked us to deliver a payload into the stage iframe.
    // The same-origin iframe is the only `.injected-stage`; post to its window
    // with our own origin as targetOrigin. No-op if the stage isn't mounted.
    if (action.type === "host/html/post-message") {
      const iframe = document.querySelector<HTMLIFrameElement>("iframe.injected-stage");
      iframe?.contentWindow?.postMessage(action.payload, window.location.origin);
    }

    // Wire-log middleware: every dispatched action → browser.debug, except
    // the high-frequency audio payloads (Q24/Q28).
    if (!WIRE_LOG_FILTER.has(action.type)) {
      sendToHost("browser.debug", {
        label: "action",
        info: action,
        t: Date.now(),
      });
    }
  });

  connect();

  return () => {
    closed = true;
    unsubscribe();
    if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
    try {
      ws?.close();
    } catch (error) {
      // Teardown is terminal — the action bus may be gone, so report to the
      // console rather than dispatching.
      console.error("hostSocketRunner.teardown.close.failed", error);
    }
    ws = undefined;
  };
}

/**
 * Record the raw xAI server frame so the next synthesized `xai/*` action can
 * be forwarded as `voice.event` with its original body (Q28). Called by
 * `voiceSessionRunner` immediately before it dispatches the xAI action.
 */
export function recordRawXaiFrame(frame: unknown): void {
  lastRawXaiFrame = frame;
}

function downloadTranscript(getState: RunnerDeps["getState"]): void {
  const conversation = getState().conversation.conversation;
  const items = conversation?.transcript ?? [];
  if (items.length === 0) return;
  const jsonl = `${items.map((item) => JSON.stringify(item)).join("\n")}\n`;
  const blob = new Blob([jsonl], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const convId = conversation?.id ?? "conversation";
  anchor.href = url;
  anchor.download = `transcript-${convId}-${stamp}.jsonl`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Test/observability hook: whether the host WS is currently open. */
export function isHostConnected(): boolean {
  return connected;
}
