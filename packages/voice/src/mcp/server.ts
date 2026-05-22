/**
 * Voice MCP server factory.
 *
 * Embeds the `createVoiceAgentServer` controller in-process and exposes its
 * lifecycle as MCP tools, while bridging controller events to `claude/channel`
 * notifications (the same events `voice watch` streams, delivered as raw event
 * JSON). This module imports ONLY the core voice library (`../index.js`) — it
 * shares no code with the CLI or daemon.
 *
 * Tools:
 *   conversation({ action }) — pause | resume | reset | status (start/end are automatic with the page)
 *   set({ context?, topics?, instructions? }) — steer the live session
 *   inject({ role, message, source?, triggerResponse? }) — add a transcript item
 *   html({ path? }) — render an HTML file as the stage (no path clears it)
 *
 * @module voice/mcp/server
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createNetServer } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import {
  createVoiceAgentServer,
  type InjectedAssistantMessageSource,
  type InjectedErrorEvent,
  type InjectedUserMessageSource,
  type JsonValue,
  type ServerEnvelope,
  type TranscriptItemEvent,
  type VoiceAgentServerEvents,
  type VoiceAgentSettingItem,
  type VoiceAgentToolMap,
} from "../index.js";
import type { VoiceMcpConfig } from "./config.js";
import { createDiagnosticLogger, type DiagnosticLogger } from "./logger.js";
import { deleteStoredKey, validateKey, writeStoredKey } from "./secrets.js";
import { deleteStoredPersonality, readStoredPersonality, writeStoredPersonality } from "./settings.js";

const CHANNEL_METHOD = "notifications/claude/channel";

/** The MCP tools this server exposes to the steering agent. */
const VOICE_TOOL_NAMES = ["conversation", "set", "inject", "html", "postMessageToHtml"] as const;

/** Synthetic channel event emitted on conversation start to activate the agent. */
const AGENT_ACTIVATE_EVENT = "agent.activate";

/** Synthetic channel event emitted on session end (close/reload/reset) to deactivate the agent. */
const AGENT_DEACTIVATE_EVENT = "agent.deactivate";

/** Synthetic channel event primed once per session before the first `html.click`. */
const HTML_CLICKS_ABOUT_EVENT = "html.clicks.about";

/** One-time primer explaining the `html.click` events that follow it. */
const HTML_CLICKS_ABOUT_MESSAGE =
  "Heads up: the user can click inside the HTML stage you put up, and each click arrives as an `html.click` event. " +
  "Its data is `{x, y, width, height, path}` — x/y are the click position within the width×height stage viewport, " +
  "and path is the CSS selector of the clicked element. Use it to tell what the user interacted with on a stage you can't see.";

/** Joins labels into a natural list: `a` / `a and b` / `a, b, and c`. */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * One-sentence description of each event that can arrive on the channel, keyed
 * by event name. The {@link AGENT_ACTIVATE_EVENT} start message includes only
 * the descriptions for events actually being monitored. Pure-internal events
 * (log, voice.session.updated, transcript.delta, server.started/stopped) are
 * intentionally omitted — a monitored event without an entry is listed by name.
 */
const EVENT_DESCRIPTIONS: Record<string, string> = {
  "transcript.item":
    'A completed spoken turn — data.item.source "microphone" is the user, "assistantAudio"/"assistantText" is your colleague. Steer the next turn with set(); do not relay it back, the user already heard it. Your colleague knows only their persona plus the context/topics you set — they can\'t see the HTML stage or your tools, so when they\'re wrong (e.g. denying they have a stage) correct them with set({context}).',
  "conversation.error": "The realtime session errored (data.error); tell the user and offer to retry.",
  "browser.audio.error":
    "The user's microphone/audio device failed (data.error); have them check browser mic permissions.",
  "browser.audio.deviceChange": "The user's audio devices or mic-permission state changed (data.audio).",
  "browser.client.connected": "The browser opened the voice page and connected.",
  "browser.client.disconnected": "The browser closed, which ends the conversation.",
  "browser.client.rejected": "A second browser tried to connect while one was already active and was refused.",
  "conversation.started": "A conversation began.",
  "conversation.paused": "The conversation was held (pause control or, if enabled, the wake word stopped it).",
  "conversation.resumed": "The conversation resumed from a pause.",
  "conversation.reset": "History was cleared and a fresh session started.",
  "conversation.ended": "The conversation ended and the session was released.",
  "response.completed": "Your colleague finished their current spoken response.",
  "tool.call.started": "Your colleague invoked their check_with_colleague tool.",
  "tool.call.completed": "Your colleague's check_with_colleague tool call finished.",
  "tool.call.failed": "A check_with_colleague tool call failed (data.phase, data.error).",
  "tool.call.interrupted": "A check_with_colleague tool call was interrupted (e.g. the user barged in).",
  "injected.error": "An injected message or HTML stage failed (data.code, data.message).",
  "html.click":
    "The user clicked inside the custom HTML; data.path is the clicked element, x/y its position within the width×height viewport.",
  "html.message":
    "The HTML posted a message out to you (data.payload, arbitrary JSON). Whatever the document chose to send — react with set/html/postMessageToHtml as fits.",
  wait_for_context:
    "Your colleague called check_with_colleague and paused — they need you. Respond with set({context|topics}) (and/or html) to hand them the right context/topics; that resumes them.",
};

/**
 * Builds the {@link AGENT_ACTIVATE_EVENT} start message: how to load the tools,
 * a pointer to the handbook, and a one-line description of each monitored event.
 * `wait_for_context` is force-notified regardless of `watchTypes`, so it is
 * always described.
 *
 * @param watchTypes - Event names delivered as channel notifications.
 * @returns The prose message string.
 */
function buildActivateMessage(watchTypes: string[]): string {
  const lead =
    "A voice conversation has started — the user loaded the page and their microphone is live. " +
    "If the voice MCP tools are not already loaded, load them by name with your tool loader " +
    `(e.g. ToolSearch \`select:${VOICE_TOOL_NAMES.join(",")}\`), then steer with \`set\` (topics/context). ` +
    "When a visual would help, write an HTML file — either a visual representation of what the user asked for, " +
    "or a sophisticated, minimally-worded presentation slide that adds to the conversation rather than transcribing it — " +
    "then stage it with `html({ path })` and describe it with `set({ context })` (your colleague can't see the stage). " +
    "For interactive HTML, `postMessageToHtml(payload)` pushes JSON into the document and it can post back as `html.message`. " +
    'Default to using TailwindCSS and DaisyUI by embedding the CDN: `<link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" /><script src"https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>`' +
    "Load the `voice:handbook` skill for troubleshooting and usage details. " +
    "React to the events below; do not narrate them back — the user already hears the voice.";

  const names = [...new Set([...watchTypes, "wait_for_context"])];
  const described = names.filter((n) => EVENT_DESCRIPTIONS[n] !== undefined);
  const lines = described.map((n) => `- ${n}: ${EVENT_DESCRIPTIONS[n]}`);
  const undescribed = names.filter((n) => EVENT_DESCRIPTIONS[n] === undefined);
  if (undescribed.length > 0) lines.push(`- (also monitored, no description: ${undescribed.join(", ")})`);

  return [lead, "", ...lines].join("\n");
}

/** Default `<personality>` block, replaced wholesale by `set({ personality })` (latest-wins). */
const DEFAULT_PERSONALITY = "Speak naturally and directly. Match the user's vocal and conversational style.";

/**
 * Default persona used until the agent calls `set({ instructions })`.
 * The controller requires non-empty `realtime.instructions` at construction;
 * `set({ instructions })` replaces this wholesale (latest-wins).
 */
const DEFAULT_BASE_INSTRUCTIONS = `\
You speak with the user in a voice conversation, and a colleague works alongside \
you off-mic. Speak naturally and directly. Don't be sycophantic, don't repeat \
yourself or the user, and don't end turns by offering more help.

## Your inputs
- \`<personality>\`: who you are — your tone, manner, and persona. Embody it.
- \`<context>\`: what you know — background, facts, and answers.
- \`<topics>\`: what to discuss with the user, drawing on \`<context>\`.

Treat \`<context>\` and \`<topics>\` as your own knowledge, never as a briefing: \
don't mention a brief, script, instructions, or setup, and don't explain how you \
know something — just use it as if you always had. (Referring to your colleague, \
below, is fine.)

## Your colleague
A colleague works with you the whole time, off-mic — the user only ever hears \
you. You handle the conversation; they handle everything behind it: looking \
things up, doing real tasks, and running the screen the user sees (they can see \
it, you can't). They keep a live transcript of the conversation, so they always \
know where things stand and you never explain yourself to them — and they can \
get or do almost anything, so you are never stuck.

Reach them with \`check_with_colleague\`. Call it the moment you'd otherwise \
guess, stall, or say you don't know, can't do something, can't show an image, or \
have run out of topics. You pass nothing — they read the transcript and hand back \
the right \`<context>\` and \`<topics>\`, or update the screen. A short filler \
("Let me check with my colleague.") while you wait is natural; refusing or \
claiming a limitation is not. Fold what comes back in as your own.

## The screen
The user sees a screen your colleague controls — images, slides, diagrams, \
charts. You can't see it, but you're told when the user clicks something on it or \
when the screen sends a message. So you can always show, draw, or display a \
visual, and you can speak to what's on screen or what the user clicked: just \
\`check_with_colleague\`. When the user means "this", "that", or "which one I \
clicked" and you're unsure, don't guess — \`check_with_colleague\`.

If you don't know what a click or screen message represents, do not proactively \
bring it up to the user or narrate it. Stay silent on it, or quietly \
\`check_with_colleague\` to find out what it means before saying anything. Never \
announce a raw click or message you can't interpret.`;

/**
 * Server instructions shown at MCP connect. Kept minimal: voice is available
 * and the user opens the web page to start a conversation. The channel
 * mechanics are not explained here — the start message handles them.
 *
 * @param port - The web/UI server port.
 * @returns The instructions string.
 */
function buildChannelInstructions(port: number): string {
  return (
    `Voice conversations are available. The user starts one by opening http://localhost:${port} in a browser. ` +
    "If they cannot connect or something is not working, load the `voice:handbook` skill."
  );
}

/** Server instructions shown when no API key is configured (inert mode). */
const UNCONFIGURED_INSTRUCTIONS =
  "The voice MCP server is not configured: the XAI_API_KEY environment variable is unset. " +
  "No tools or channel are available. Set XAI_API_KEY and restart the server to enable voice.";

/** Shared `<style>` for the unconfigured pages — centered, dark, consistent. */
const UNCONFIGURED_STYLE = `
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
    background: #0b0b0c; color: #e7e7ea;
  }
  .msg { text-align: center; padding: 2rem; max-width: 32rem; }
  h1 { font-size: 1.4rem; font-weight: 600; margin: 0 0 .75rem; }
  p { margin: 0 0 1rem; color: #a1a1aa; line-height: 1.5; }
  p:last-child { margin-bottom: 0; }
  code { background: #1c1c1f; padding: .15em .4em; border-radius: .3em; color: #e7e7ea; }
  form { margin: 1.25rem 0; display: flex; gap: .5rem; }
  input {
    flex: 1; padding: .55rem .7rem; border-radius: .4rem;
    border: 1px solid #2a2a2e; background: #141416; color: #e7e7ea; font-size: .95rem;
  }
  input:focus { outline: none; border-color: #4b4b52; }
  button {
    padding: .55rem 1rem; border-radius: .4rem; border: 1px solid #2a2a2e;
    background: #1c1c1f; color: #e7e7ea; font-size: .95rem; cursor: pointer;
  }
  button:hover { border-color: #4b4b52; }
  .error { color: #ff6b6b; }
`;

/** Escape text for safe inclusion in HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * The key-entry form served (in place of the voice UI) when no API key is set.
 * Submits the key as `application/x-www-form-urlencoded` back to the same
 * origin. `error` renders an inline message above the form.
 *
 * @param error - Optional inline error message to display.
 * @returns The full HTML document.
 */
function unconfiguredFormHtml(error?: string): string {
  const errorBlock = error !== undefined ? `<p class="error">${escapeHtml(error)}</p>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voice — configuration required</title>
<style>${UNCONFIGURED_STYLE}</style>
</head>
<body>
  <div class="msg">
    <h1>Voice is not configured</h1>
    <p>Enter your xAI API key to enable voice. It is stored locally and used to start voice sessions.</p>
    ${errorBlock}
    <form method="POST" action="/">
      <input type="password" name="key" placeholder="xAI API key" autocomplete="off" autofocus required>
      <button type="submit">Save</button>
    </form>
    <p>Alternatively, set the <code>XAI_API_KEY</code> environment variable and restart the server.</p>
  </div>
</body>
</html>
`;
}

/**
 * The confirmation page shown after a valid key is saved. Auto-reloads after
 * ~3s (the server self-restarts to re-read the key) and includes a manual
 * fallback line.
 *
 * @returns The full HTML document.
 */
function savedHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voice — starting</title>
<meta http-equiv="refresh" content="3">
<style>${UNCONFIGURED_STYLE}</style>
<script>setTimeout(function () { location.reload(); }, 3000);</script>
</head>
<body>
  <div class="msg">
    <h1>Saved — starting voice…</h1>
    <p>The voice server is restarting to pick up your key. This page will reload shortly.</p>
    <p>If voice doesn't reconnect, reload the plugin / restart Claude Code.</p>
  </div>
</body>
</html>
`;
}

/** Controller events mirrored to the channel / diagnostic log. */
type KnownEventKey = keyof VoiceAgentServerEvents<VoiceAgentToolMap>;

// Keyed by event name so `VoiceAgentServerEvents` in types.ts is the single
// source of truth: every event there must appear here (a missing key is a
// compile error) and unknown keys are rejected. TypeScript types are erased at
// runtime and StrictEventEmitter exposes no catch-all, so the names must still
// be listed — but the type now guards completeness instead of silent drift.
const EVENT_NAMES: Record<KnownEventKey, true> = {
  "server.started": true,
  "server.stopped": true,
  "browser.client.connected": true,
  "browser.client.disconnected": true,
  "browser.client.rejected": true,
  "browser.audio.error": true,
  "browser.audio.deviceChange": true,
  "conversation.started": true,
  "conversation.paused": true,
  "conversation.resumed": true,
  "conversation.ended": true,
  "conversation.reset": true,
  "conversation.error": true,
  "response.completed": true,
  "voice.session.updated": true,
  "transcript.delta": true,
  "transcript.item": true,
  "tool.call.started": true,
  "tool.call.completed": true,
  "tool.call.failed": true,
  "tool.call.interrupted": true,
  "injected.error": true,
  "html.click": true,
  "html.message": true,
  log: true,
};

const KNOWN_EVENTS = Object.keys(EVENT_NAMES) as KnownEventKey[];

/** Recursively serialize Date values to ISO strings so payloads are pure JSON. */
function serializeData(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeData);
  if (typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeData(v);
    }
    return out;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

/** Coerces a serialized payload to an object for field access. */
function asObject(data: JsonValue): Record<string, JsonValue> {
  return data !== null && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, JsonValue>) : {};
}

/** Reads `error.message` from a serialized event payload. */
function errorMessage(d: Record<string, JsonValue>): string {
  const e = asObject(d.error ?? null);
  return typeof e.message === "string" ? e.message : "unknown error";
}

/** Reads `toolName` from a serialized tool-call payload. */
function toolLabel(d: Record<string, JsonValue>): string {
  return typeof d.toolName === "string" ? d.toolName : "a tool";
}

/** `user` for user-originated sources, `colleague` for the voice agent. */
function speakerRole(source: string): string {
  return source === "microphone" || source === "textInput" ? "user" : "colleague";
}

/** `{ code }` attribute when the payload's error carries a code. */
function errorAttrs(d: Record<string, JsonValue>): Record<string, string> {
  const e = asObject(d.error ?? null);
  return typeof e.code === "string" ? { code: e.code } : {};
}

/** A channel notification body plus the event-specific `<channel>` attributes. */
interface ChannelMessage {
  content: string;
  attrs: Record<string, string>;
}

/**
 * Maps an event to its `<channel>` tag body (`content`) and event-specific
 * routing attributes (`attrs`). The caller adds `type` (the event name) and
 * `seq`. `content` is the substantive body — verbatim text where there is one
 * (transcript, error message), else a short human sentence; {@link AGENT_ACTIVATE_EVENT}
 * keeps its full instruction message.
 *
 * @param event - Event name.
 * @param data - Serialized event payload.
 * @returns The body and attributes for the `<channel>` tag.
 */
function channelMessage(event: string, data: JsonValue): ChannelMessage {
  const d = asObject(data);
  switch (event) {
    case AGENT_ACTIVATE_EVENT:
      return { content: typeof d.message === "string" ? d.message : "Voice conversation started.", attrs: {} };
    case AGENT_DEACTIVATE_EVENT:
      return { content: typeof d.message === "string" ? d.message : "The voice conversation has ended.", attrs: {} };
    case HTML_CLICKS_ABOUT_EVENT:
      return { content: typeof d.message === "string" ? d.message : HTML_CLICKS_ABOUT_MESSAGE, attrs: {} };
    case "transcript.item": {
      const item = asObject(d.item);
      const source = typeof item.source === "string" ? item.source : "";
      return { content: typeof item.text === "string" ? item.text : "", attrs: { role: speakerRole(source) } };
    }
    case "transcript.delta": {
      const source = typeof d.source === "string" ? d.source : "";
      const soFar = typeof d.fullTextSoFar === "string" ? d.fullTextSoFar : "";
      return { content: soFar, attrs: { role: speakerRole(source), streaming: "true" } };
    }
    case "conversation.error":
      return { content: errorMessage(d), attrs: errorAttrs(d) };
    case "browser.audio.error":
      return { content: errorMessage(d), attrs: errorAttrs(d) };
    case "browser.audio.deviceChange": {
      const audio = asObject(d.audio);
      const ready = audio.ready === true;
      const permission = typeof audio.permission === "string" ? audio.permission : "unknown";
      return {
        content: ready ? "Microphone ready." : "Waiting for a ready microphone.",
        attrs: { ready: String(ready), permission },
      };
    }
    case "browser.client.connected":
      return { content: "Browser connected; the conversation starts once the mic is ready.", attrs: {} };
    case "browser.client.disconnected":
      return { content: "Browser disconnected — the conversation has ended.", attrs: {} };
    case "browser.client.rejected":
      return { content: "A second browser tried to connect and was rejected; one is already active.", attrs: {} };
    case "conversation.started":
      return { content: "Conversation started.", attrs: {} };
    case "conversation.paused":
      return { content: "Conversation paused.", attrs: {} };
    case "conversation.resumed":
      return { content: "Conversation resumed.", attrs: {} };
    case "conversation.reset":
      return { content: "History cleared; a fresh session started.", attrs: {} };
    case "conversation.ended":
      return { content: "Conversation ended.", attrs: {} };
    case "response.completed":
      return { content: "Your colleague finished their response.", attrs: {} };
    case "voice.session.updated":
      return { content: "Voice session updated.", attrs: {} };
    case "wait_for_context":
      return {
        content:
          "Your colleague called check_with_colleague and paused — they need you. Respond with set({context|topics}) (and/or html) to hand them the right context/topics; that resumes them.",
        attrs: {},
      };
    case "tool.call.started":
      return { content: "Your colleague invoked a tool.", attrs: { tool: toolLabel(d) } };
    case "tool.call.completed":
      return { content: "The tool call completed.", attrs: { tool: toolLabel(d) } };
    case "tool.call.failed":
      return { content: errorMessage(d), attrs: { tool: toolLabel(d), ...errorAttrs(d) } };
    case "tool.call.interrupted":
      return { content: "The tool call was interrupted.", attrs: { tool: toolLabel(d) } };
    case "injected.error":
      return {
        content: typeof d.message === "string" ? d.message : "injection failed",
        attrs: typeof d.code === "string" ? { code: d.code } : {},
      };
    case "html.click": {
      const path = typeof d.path === "string" ? d.path : "";
      const num = (value: JsonValue): string => (typeof value === "number" ? String(value) : "");
      return {
        content: path,
        attrs: { x: num(d.x), y: num(d.y), width: num(d.width), height: num(d.height) },
      };
    }
    case "html.message":
      // Arbitrary JSON the HTML chose to send; surface it verbatim as the body.
      return { content: typeof d.payload === "string" ? d.payload : JSON.stringify(d.payload ?? null), attrs: {} };
    case "server.started":
      return { content: "Voice server started.", attrs: {} };
    case "server.stopped":
      return { content: "Voice server stopped.", attrs: {} };
    case "log":
      return {
        content: typeof d.message === "string" ? d.message : "",
        attrs: typeof d.level === "string" ? { level: d.level } : {},
      };
    default:
      return { content: event, attrs: {} };
  }
}

export interface VoiceMcpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  mcpServer: McpServer;
}

export interface CreateVoiceMcpServerOptions {
  /** Override the MCP transport (defaults to stdio). Used in tests. */
  transport?: Transport;
  /** Override the diagnostic logger. Used in tests. */
  logger?: DiagnosticLogger;
}

/** Shape `{ success }` (plus optional extras) into an MCP tool result. */
function toolResult(result: Record<string, JsonValue>): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, JsonValue>;
} {
  return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
}

/** Read a full request body to a string (capped to guard against abuse). */
async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  const MAX_BYTES = 64 * 1024;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > MAX_BYTES) break;
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Extract the submitted key from a request body. Accepts both
 * `application/x-www-form-urlencoded` (`key=...`) and a JSON object (`{key}`).
 */
function parseSubmittedKey(body: string, contentType: string): string | undefined {
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(body) as { key?: unknown };
      return typeof parsed.key === "string" ? parsed.key.trim() : undefined;
    } catch {
      return undefined;
    }
  }
  const params = new URLSearchParams(body);
  const key = params.get("key");
  return key !== null ? key.trim() : undefined;
}

/** Send an HTML response with an explicit content-length. */
function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
  });
  res.end(html);
}

/**
 * Builds the inert server used when no API key is configured.
 *
 * The MCP server connects but advertises neither the `claude/channel`
 * capability nor any tools. The web server serves a key-entry form: a GET
 * renders the form, a POST validates the submitted key against xAI and either
 * re-renders the form with an inline error, or persists the key and
 * self-restarts (so the host respawns the server and re-reads the key).
 * Nothing here can throw on a missing key.
 *
 * @param config - Environment-derived configuration.
 * @param options - Optional transport override (used in tests).
 * @param logger - Diagnostic logger.
 * @returns An inert {@link VoiceMcpServer}.
 */
function createUnconfiguredServer(
  config: VoiceMcpConfig,
  options: CreateVoiceMcpServerOptions,
  logger: DiagnosticLogger,
): VoiceMcpServer {
  const mcp = new McpServer(
    { name: "voice-mcp-server", version: "1.0.0" },
    { instructions: UNCONFIGURED_INSTRUCTIONS },
  );

  const web = createHttpServer((req, res) => {
    void (async (): Promise<void> => {
      if (req.method !== "POST") {
        sendHtml(res, 200, unconfiguredFormHtml());
        return;
      }

      const body = await readRequestBody(req);
      const key = parseSubmittedKey(body, req.headers["content-type"] ?? "");
      if (key === undefined || key === "") {
        sendHtml(res, 400, unconfiguredFormHtml("Enter a key."));
        return;
      }

      const { valid, reachable } = await validateKey(key);
      if (!reachable) {
        sendHtml(
          res,
          502,
          unconfiguredFormHtml("Couldn't reach xAI to validate the key. Check your connection and try again."),
        );
        return;
      }
      if (!valid) {
        sendHtml(res, 401, unconfiguredFormHtml("That key was rejected by xAI. Check it and try again."));
        return;
      }

      try {
        writeStoredKey(key);
      } catch (err: unknown) {
        logger.logError("failed to write secrets file", { error: String(err) });
        sendHtml(
          res,
          500,
          unconfiguredFormHtml("Could not save the key to disk. Check file permissions and try again."),
        );
        return;
      }

      // Saved: render the "starting" page, flush, then self-restart so the
      // host respawns the server and re-reads the now-stored key.
      const html = savedHtml();
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": Buffer.byteLength(html),
        Connection: "close",
      });
      res.end(html, () => {
        process.stderr.write("[voice-mcp] xAI API key saved — restarting to apply.\n");
        process.exit(0);
      });
    })().catch((err: unknown) => {
      logger.logError("unconfigured request handling failed", { error: String(err) });
      if (!res.headersSent) sendHtml(res, 500, unconfiguredFormHtml("Something went wrong. Try again."));
    });
  });
  web.on("error", (err: unknown) => {
    logger.logError("unconfigured web server error", { error: String(err) });
  });

  return {
    mcpServer: mcp,
    async start(): Promise<void> {
      const transport = options.transport ?? new StdioServerTransport();
      await mcp.connect(transport);
      web.listen(config.port, "localhost");
      process.stderr.write(`[voice-mcp] no xAI API key — serving key-entry form on http://localhost:${config.port}\n`);
    },
    async stop(): Promise<void> {
      await new Promise<void>((resolve) => web.close(() => resolve()));
      await mcp.close();
    },
  };
}

/**
 * Builds the invisible server used when `VOICE` is disabled.
 *
 * Connects an empty MCP server over stdio — no tools, no `claude/channel`
 * capability, no instructions — and starts no web server, controller, or
 * logger. The process is spawned statically from `.mcp.json`, so connecting
 * empty (rather than exiting) keeps it from appearing as a failed server in
 * `/mcp`; it simply contributes nothing.
 *
 * @param options - Optional transport override (used in tests).
 * @returns An invisible {@link VoiceMcpServer}.
 */
function createDisabledServer(options: CreateVoiceMcpServerOptions): VoiceMcpServer {
  const mcp = new McpServer({ name: "voice-mcp-server", version: "1.0.0" }, {});

  return {
    mcpServer: mcp,
    async start(): Promise<void> {
      const transport = options.transport ?? new StdioServerTransport();
      await mcp.connect(transport);
      process.stderr.write("[voice-mcp] VOICE is disabled — server inactive.\n");
    },
    async stop(): Promise<void> {
      await mcp.close();
    },
  };
}

/** One-time instruction explaining why no voice tools are exposed. */
function portBusyInstructions(port: number): string {
  return (
    `The voice server is already running on port ${port} (another Claude Code session owns it), ` +
    "so this instance is inactive: no voice tools are available and no web server was started. " +
    "To use voice here, end the other session (or close its browser tab) and reconnect this one."
  );
}

/**
 * Builds the inert server used when the configured port is already in use by
 * another instance.
 *
 * Connects an empty MCP server over stdio — no tools, no `claude/channel`
 * capability, no controller, no web server — with an instruction explaining the
 * port conflict. Mirrors {@link createDisabledServer} but stays diagnosable via
 * the instruction and a stderr line.
 *
 * @param config - Environment-derived configuration (for the port number).
 * @param options - Optional transport override (used in tests).
 * @returns An inert {@link VoiceMcpServer}.
 */
function createPortBusyServer(config: VoiceMcpConfig, options: CreateVoiceMcpServerOptions): VoiceMcpServer {
  const mcp = new McpServer(
    { name: "voice-mcp-server", version: "1.0.0" },
    { instructions: portBusyInstructions(config.port) },
  );

  return {
    mcpServer: mcp,
    async start(): Promise<void> {
      const transport = options.transport ?? new StdioServerTransport();
      await mcp.connect(transport);
      process.stderr.write(
        `[voice-mcp] port ${config.port} already in use — another voice server is running; this instance is inactive.\n`,
      );
    },
    async stop(): Promise<void> {
      await mcp.close();
    },
  };
}

/**
 * Attempts to bind `127.0.0.1:port` once — the exact thing the controller's web
 * server does. Resolves `true` only if the bind is refused with `EADDRINUSE`
 * (the port is genuinely held by another listener); resolves `false` if the
 * bind succeeds (port is free — it is closed again immediately) or fails for
 * any other reason (so a real bind error surfaces through the controller rather
 * than being silently swallowed into inert mode).
 *
 * A bind probe is used rather than a connect probe because it answers the only
 * question that matters — "can this process claim the port?" — and avoids
 * false positives from intermediaries that accept connections on a port nothing
 * is actually serving.
 */
function probePortBoundOnce(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const probe = createNetServer();
    probe.once("error", (err: NodeJS.ErrnoException) => {
      resolve(err.code === "EADDRINUSE");
    });
    probe.listen(port, "127.0.0.1", () => {
      probe.close(() => resolve(false));
    });
  });
}

/**
 * Whether `127.0.0.1:port` is held by another listener. Retries a few times
 * before concluding it is in use: a just-exited sibling instance can still own
 * the port for a moment, and we must not wedge this one into inert mode over a
 * transient race. The happy path (a free port) returns `false` on the first
 * attempt with no delay; only an occupied port pays the retry cost.
 *
 * @param port - The port to check.
 * @returns `true` only if the port is occupied on every attempt.
 */
async function isPortInUse(port: number): Promise<boolean> {
  const attempts = 5;
  const delayMs = 250;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!(await probePortBoundOnce(port))) return false;
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return true;
}

/**
 * Creates a voice MCP server bound to the given configuration.
 *
 * @param config - Environment-derived configuration.
 * @param options - Optional transport/logger overrides for tests.
 * @returns An object with `start`, `stop`, and `mcpServer`.
 */
export async function createVoiceMcpServer(
  config: VoiceMcpConfig,
  options: CreateVoiceMcpServerOptions = {},
): Promise<VoiceMcpServer> {
  // VOICE disabled → invisible: an empty MCP server, nothing else. Checked
  // before the logger so a disabled server has zero side effects. Takes
  // precedence over the missing-key notice.
  if (!config.enabled) {
    return createDisabledServer(options);
  }

  const logger = options.logger ?? createDiagnosticLogger(config.logPath);

  // The voice server uses one fixed port, but each Claude Code session spawns
  // its own stdio subprocess. If another instance already owns the port, this
  // one must not fight for it: binding the web server would throw EADDRINUSE,
  // and advertising the tools would let the model drive a UI this process does
  // not host. Detect an already-running instance and stay inert instead — no
  // tools advertised, no web server. (The probe is a connect attempt, so it
  // resolves immediately on a free port — no effect on the normal path.)
  if (await isPortInUse(config.port)) {
    logger.logError("port already in use — starting inert (no tools, no web server)", { port: config.port });
    return createPortBusyServer(config, options);
  }

  // No API key → stay inert: connect MCP with no channel and no tools, and
  // serve a configuration notice instead of the voice UI. Never throws.
  if (config.apiKey.trim() === "") {
    return createUnconfiguredServer(config, options, logger);
  }

  const watch = new Set(config.watchTypes);

  // Live steering state. `baseInstructions` is replaced wholesale by
  // `set({ instructions })`; <personality>/<context>/<topics> blocks are appended
  // (latest-wins). `personality` always has a value (the default). `instructions`,
  // `context`, and `topics` are session-scoped — RESET on `conversation.ended` so
  // they never leak across sessions — whereas `personality` PERSISTS (it is
  // disk-backed and survives reloads).
  let baseInstructions = DEFAULT_BASE_INSTRUCTIONS;
  // Personality PERSISTS across reloads (loaded from the settings file on start,
  // written on `set`), unlike context/topics which are session-scoped. Defaults
  // when nothing is stored.
  let latestPersonality = readStoredPersonality() ?? DEFAULT_PERSONALITY;
  let latestContext: string | null = null;
  let latestTopics: string | null = null;

  // One-time-per-session guard: the `html.clicks.about` primer is force-notified
  // exactly once, immediately before the first DELIVERED `html.click`. Reset on
  // `conversation.ended` so each session re-primes. `html.clicks.about` and
  // `html.click` are distinct events, so the primer's own emit cannot recurse
  // back into this hook.
  let htmlClicksAboutSent = false;

  function rebuildInstructions(): string {
    let result = baseInstructions;
    result += `\n\n<personality>${latestPersonality}</personality>`;
    if (latestContext !== null) result += `\n\n<context>${latestContext}</context>`;
    if (latestTopics !== null) result += `\n\n<topics>${latestTopics}</topics>`;
    return result;
  }

  const mcp = new McpServer(
    { name: "voice-mcp-server", version: "1.0.0" },
    { capabilities: { experimental: { "claude/channel": {} } }, instructions: buildChannelInstructions(config.port) },
  );

  const activateMessage = buildActivateMessage(config.watchTypes);

  // ---------------------------------------------------------------------------
  // Event → claude/channel bridge
  // ---------------------------------------------------------------------------

  let seq = 0;

  // Serializes channel-notification delivery. `mcp.server.notification()` is
  // async and was previously fired-and-forgotten, so bursts (e.g. rapid
  // html.click events) could land out of `seq` order on the wire. Chaining each
  // send onto the previous one's settlement guarantees sends leave in seq order.
  let notifyTail: Promise<void> = Promise.resolve();

  /**
   * Build a `{ seq, event, timestamp, data }` record (the same shape
   * `voice watch` streams), log it, and — unless filtered out — deliver it as a
   * `claude/channel` notification. `forceNotify` bypasses the `watchTypes`
   * filter for control signals (e.g. `wait_for_context`) the steering agent
   * must always receive.
   *
   * Per the Claude Code channels spec, notification params are `{ content, meta }`:
   * `content` is the `<channel>` tag body (the substantive text, shown to the
   * user) and each `meta` entry becomes a tag attribute. The caller-independent
   * attributes `type` (event name) and `seq` are added here; `channelMessage`
   * supplies the body and event-specific attributes (role, tool, code, ...).
   * The full event JSON is still written to the diagnostic log.
   */
  function emit(event: string, data: unknown, opts?: { forceNotify?: boolean }): void {
    seq += 1;
    const record = { seq, event, timestamp: new Date().toISOString(), data: serializeData(data) };
    logger.logEvent(record);

    if (opts?.forceNotify !== true && !watch.has(event)) return;
    // Skip system-sourced transcript items — those are our own injections
    // echoing back, exactly as `voice watch` filters them. Check the raw event
    // (typed `unknown`) so we read the native `TranscriptItem.source` field.
    if (event === "transcript.item" && (data as TranscriptItemEvent).item.source === "system") return;

    // Prime the steering agent once per session, immediately before the first
    // DELIVERED `html.click` (so it respects whether `html.click` is watched).
    // The primer is a distinct, force-notified event, so this does not recurse.
    if (event === "html.click" && !htmlClicksAboutSent) {
      htmlClicksAboutSent = true;
      emit(HTML_CLICKS_ABOUT_EVENT, { message: HTML_CLICKS_ABOUT_MESSAGE }, { forceNotify: true });
    }

    const { content, attrs } = channelMessage(record.event, record.data);
    notifyTail = notifyTail
      .then(() =>
        mcp.server.notification({
          method: CHANNEL_METHOD,
          params: { content, meta: { type: record.event, seq: String(record.seq), ...attrs } },
        }),
      )
      .catch((err: unknown) => {
        logger.logError("channel notification failed", { event, error: String(err) });
      });
  }

  // `check_with_colleague` is exposed ONLY to the realtime voice model (via the
  // controller's `tools`) — never as an MCP tool. When the avatar hits a gap in
  // its <context>/<topics>, it calls this instead of guessing; the server then
  // force-notifies the steering agent over the channel (as the internal
  // `wait_for_context` event) and pauses VAD-driven auto-response until fresh
  // context/topics arrive (re-enabled in `set`).
  let waitingForContext = false;

  const checkWithColleagueTool = {
    description:
      "Reach your colleague — the teammate who works off-mic. Call this the moment you'd otherwise guess, stall, say you don't know or can't do or show something, or run out of topics. You pass nothing; your colleague reads the live transcript and sends back the right context and topics, or updates the screen. Always prefer this over guessing or admitting a limitation.",
    parameters: z.object({}),
    execute: async (): Promise<JsonValue> => {
      waitingForContext = true;
      emit("wait_for_context", {}, { forceNotify: true });
      controller.broadcastToBrowser({ type: "wait_for_context.start" } satisfies ServerEnvelope);
      if (controller.status.conversation === "active") {
        try {
          await controller.setAutoResponse(false);
        } catch (err: unknown) {
          emit("conversation.error", { error: String(err) });
        }
      }
      return { ok: true };
    },
  };

  // Resolve the wait_for_context "waiting" state: stop the on-screen waiting
  // indicator (wait_for_context.end) and re-enable VAD-driven auto-response.
  // Called when fresh context/topics arrive (in `set`) or when the HTML stage
  // changes (in `html`) — either is a response to the avatar's wait, so the
  // waiting noise must stop. No-op when not waiting.
  async function clearWaitingForContext(): Promise<void> {
    if (!waitingForContext) return;
    waitingForContext = false;
    controller.broadcastToBrowser({ type: "wait_for_context.end" } satisfies ServerEnvelope);
    try {
      await controller.setAutoResponse(true);
    } catch (err: unknown) {
      emit("conversation.error", { error: String(err) });
    }
  }

  // Expose a Clear-key button ONLY when the key came from the secrets file —
  // an env-var key is not ours to delete. Clearing removes the stored key and
  // self-restarts so the host respawns into the unconfigured (form) mode.
  const settings: VoiceAgentSettingItem[] =
    config.keySource === "file"
      ? [
          {
            type: "button",
            label: "Clear xAI API key",
            confirmation: { text: "Are you sure you want to remove the xAI API key? This cannot be undone." },
            callback: async () => {
              deleteStoredKey();
              process.exit(0);
            },
          },
        ]
      : [];

  const controller = createVoiceAgentServer({
    port: config.port,
    apiKey: config.apiKey,
    realtime: { instructions: baseInstructions },
    tools: { check_with_colleague: checkWithColleagueTool },
    browserSession: { connectOnPageLoad: true },
    ...(settings.length > 0 ? { ui: { settings } } : {}),
  });

  for (const eventName of KNOWN_EVENTS) {
    controller.on(eventName, (data) => emit(eventName, data));
  }

  // The conversation auto-starts when the browser connects (connectOnPageLoad)
  // and auto-ends when it disconnects — both handled by the controller. On
  // start, push any persona/context/topics staged beforehand to the realtime
  // session, and open proactively ONLY when there is context or topics to speak
  // to. With neither set, the avatar stays silent so the user speaks first.
  controller.on("conversation.started", () => {
    // Signal the steering agent that a conversation is live and that it must
    // load the voice MCP tools (which arrive deferred in a Claude Code session)
    // before it can steer. Force-notified so it is always delivered regardless
    // of VOICE_SERVER_WATCH_TYPES.
    emit(AGENT_ACTIVATE_EVENT, { message: activateMessage, tools: [...VOICE_TOOL_NAMES] }, { forceNotify: true });

    const shouldOpen = latestContext !== null || latestTopics !== null;
    controller
      .updateVoiceSession({ instructions: rebuildInstructions() })
      .then(() => {
        if (!shouldOpen) return;
        return controller.requestResponse().catch((err: unknown) => {
          logger.logError("opening response failed", { error: String(err) });
        });
      })
      .catch((err: unknown) => {
        logger.logError("updateVoiceSession on start failed", { error: String(err) });
      });
  });

  // A session ends when the user closes/reloads the page or resets — all of
  // which emit `conversation.ended` (a reset emits it internally, then a fresh
  // `conversation.started`). Tell the agent the session ended (the deactivate,
  // mirroring agent.activate), reporting only the steering it had set, then
  // clear that steering so it never leaks into the next session.
  controller.on("conversation.ended", () => {
    // `personality` is NOT cleared — it persists across sessions (disk-backed).
    const cleared: string[] = [];
    if (baseInstructions !== DEFAULT_BASE_INSTRUCTIONS) cleared.push("instructions");
    if (latestContext !== null) cleared.push("context");
    if (latestTopics !== null) cleared.push("topics");

    let message = "The user ended the voice conversation (reloaded, reset, or closed the page).";
    if (cleared.length > 0) {
      message += ` The ${joinList(cleared)} you set ${cleared.length === 1 ? "has" : "have"} been cleared.`;
    }
    emit(AGENT_DEACTIVATE_EVENT, { message, cleared }, { forceNotify: true });

    baseInstructions = DEFAULT_BASE_INSTRUCTIONS;
    latestContext = null;
    latestTopics = null;
    // Re-prime the html.click explainer for the next session.
    htmlClicksAboutSent = false;
  });

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------

  mcp.registerTool(
    "conversation",
    {
      description:
        "Adjust a running voice conversation. The conversation starts and ends automatically with the browser page (load → start, close → end), so this tool only controls a conversation that is already running.",
      inputSchema: {
        action: z
          .enum(["pause", "resume", "reset", "status"])
          .describe(
            "Lifecycle action: pause (hold audio), resume (resume from pause), reset (clear history and restart fresh), status (return server/conversation state plus browser connection and audio/mic detail — no transcript).",
          ),
      },
    },
    async ({ action }) => {
      switch (action) {
        case "pause":
          await controller.pauseConversation();
          break;
        case "resume":
          await controller.resumeConversation();
          break;
        case "reset":
          await controller.resetConversation();
          break;
        case "status":
          return toolResult({
            success: true,
            status: {
              // Coarse lifecycle states.
              server: controller.status.server,
              conversation: controller.status.conversation,
              // Browser + connection detail (no transcript).
              browser: serializeData(controller.browserClient),
              realtimeConnected: controller.realtimeConnected,
              responseInFlight: controller.responseInFlight,
            },
          });
      }
      return toolResult({ success: true });
    },
  );

  mcp.registerTool(
    "set",
    {
      description:
        "Steer the live voice session. Use `topics` to set what your colleague should talk about next (a <topics> block), `context` to give them background knowledge to absorb silently (a <context> block), and `personality` to set their tone/manner/persona (a <personality> block). Passing an empty string clears `topics`/`context`; `personality` persists across reloads (saved to disk) — set it to null to reset it to the default. Changes trigger a fresh response when the conversation is active. (`instructions` overwrites the base persona and is configured at startup — leave it unset.)",
      inputSchema: {
        topics: z
          .string()
          .optional()
          .describe("Subjects and questions to steer toward, woven in as a <topics> block (latest-wins)."),
        context: z
          .string()
          .optional()
          .describe(
            "Background knowledge and facts your colleague absorbs silently as a <context> block (latest-wins).",
          ),
        personality: z
          .string()
          .nullable()
          .optional()
          .describe(
            "How your colleague speaks and behaves — tone, manner, persona — as a <personality> block. Persists across reloads (saved to disk, latest-wins). Pass null to reset it to the default.",
          ),
        instructions: z
          .string()
          .optional()
          .describe(
            "Advanced — the base voice persona, configured at startup. Do not set this for normal steering; use topics/context/personality instead.",
          ),
      },
    },
    async ({ context, topics, personality, instructions }) => {
      const wantsContextOrTopics = context !== undefined || topics !== undefined;
      let changed = false;
      if (instructions !== undefined) {
        // Empty/whitespace falls back to the placeholder so realtime stays valid.
        baseInstructions = instructions.trim() === "" ? DEFAULT_BASE_INSTRUCTIONS : instructions;
        changed = true;
      }
      if (personality !== undefined) {
        // null (or empty) resets to the default and clears it from disk;
        // otherwise persist the new personality across reloads.
        if (personality === null || personality.trim() === "") {
          latestPersonality = DEFAULT_PERSONALITY;
          deleteStoredPersonality();
        } else {
          latestPersonality = personality;
          writeStoredPersonality(personality);
        }
        changed = true;
      }
      if (context !== undefined) {
        latestContext = context.trim() === "" ? null : context;
        changed = true;
      }
      if (topics !== undefined) {
        latestTopics = topics.trim() === "" ? null : topics;
        changed = true;
      }
      if (!changed) return toolResult({ success: true });

      // `set` never starts a conversation — that happens automatically on page
      // load. Before the conversation is running, just stage the values: the
      // conversation.started handler applies them (and opens, since context or
      // topics is set) when the page loads.
      const status = controller.status.conversation;
      if (status !== "active" && status !== "paused") {
        return toolResult({ success: true, staged: true });
      }

      // wait_for_context re-entry: fresh context/topics has arrived, so end the
      // wait and re-enable VAD-driven auto-response for later turns.
      if (wantsContextOrTopics && (latestContext !== null || latestTopics !== null)) {
        await clearWaitingForContext();
      }

      await controller.updateVoiceSession({ instructions: rebuildInstructions() });
      controller.requestResponse().catch((err: unknown) => {
        logger.logError("set: requestResponse failed", { error: String(err) });
      });
      return toolResult({ success: true });
    },
  );

  mcp.registerTool(
    "inject",
    {
      description:
        "Inject a message into the conversation transcript. role user/assistant/system. `source` overrides the default source label. For user/system roles, `triggerResponse` requests a model response. Prefer `set` for steering; `inject` is the low-level primitive.",
      inputSchema: {
        role: z.enum(["user", "assistant", "system"]).describe("Transcript role to attribute the message to."),
        message: z.string().describe("The message text to add to the transcript."),
        source: z
          .string()
          .optional()
          .describe(
            "Overrides the default source label (user: textInput|system; assistant: assistantText|system). Omit to use the role's default.",
          ),
        triggerResponse: z
          .boolean()
          .optional()
          .describe("For user/system roles, request a model response after injecting. Ignored for assistant."),
      },
    },
    async ({ role, message, source, triggerResponse }) => {
      switch (role) {
        case "user":
          await controller.injectUserMessage({
            text: message,
            source: source as InjectedUserMessageSource | undefined,
            triggerResponse,
          });
          break;
        case "assistant":
          await controller.injectAssistantMessage({
            text: message,
            source: source as InjectedAssistantMessageSource | undefined,
          });
          break;
        case "system":
          await controller.injectSystemMessage({ text: message, triggerResponse });
          break;
      }
      return toolResult({ success: true });
    },
  );

  mcp.registerTool(
    "html",
    {
      description:
        "Render an HTML file full-viewport behind the voice UI. Pass `path` to an HTML file on disk; the stage live-reloads whenever the file is saved. Call with no `path` to clear the stage. Only absolute/CDN asset URLs work inside the iframe.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe("Absolute path to an HTML file to serve and live-reload on every save. Omit to clear the stage."),
      },
    },
    async ({ path }) => {
      let injectedError: { code: string; message: string } | undefined;
      const onInjectedError = (evt: InjectedErrorEvent): void => {
        injectedError = { code: evt.code, message: evt.message };
      };
      controller.once("injected.error", onInjectedError);
      try {
        await controller.setHtml(path !== undefined && path.trim() !== "" ? { path } : null);
      } finally {
        controller.off("injected.error", onInjectedError);
      }
      if (injectedError !== undefined) {
        return toolResult({ success: false, error: { code: injectedError.code, message: injectedError.message } });
      }
      // Changing the stage is a response to the avatar's wait — stop the
      // wait_for_context waiting state so the avatar isn't left muted/waiting.
      await clearWaitingForContext();
      return toolResult({ success: true });
    },
  );

  mcp.registerTool(
    "postMessageToHtml",
    {
      description:
        "Send an arbitrary JSON payload to the mounted HTML; the browser postMessages it into the HTML's window, where a `message` listener can react. The HTML can post back to you as an `html.message` event. No-op if no HTML is mounted.",
      inputSchema: {
        // Arbitrary JSON — MCP args are already JSON, so the value is a JsonValue.
        payload: z.unknown().describe("Arbitrary JSON delivered verbatim to the HTML window's `message` event."),
      },
    },
    async ({ payload }) => {
      const { delivered } = controller.postMessageToHtml(payload as JsonValue);
      return delivered
        ? toolResult({ success: true })
        : toolResult({ success: false, error: { code: "NO_HTML", message: "No HTML is currently mounted." } });
    },
  );

  return {
    mcpServer: mcp,
    async start(): Promise<void> {
      // The `claude/channel` capability flows one direction only: this server
      // DECLARES it (see the McpServer construction above) and Claude Code
      // inspects that during `initialize`, then gates delivery behind a
      // client-side user-confirmation dialog. The approval is never reported
      // back to the server — it is absent from the client's ClientCapabilities
      // (`getClientCapabilities()` shows only `elicitation`/`roots`) and there
      // is no acknowledging request or notification. Per the channels spec,
      // notifications are fire-and-forget and silently dropped if the channel
      // is not enabled. So we do NOT gate startup on it: declare the capability,
      // start unconditionally, and let the client handle approval.
      //
      // We still log the client's full info and capabilities once the handshake
      // completes — purely diagnostic, to make the connecting client (name,
      // version, negotiated capabilities) visible in the JSONL log. Arm the
      // listener BEFORE `connect()` so the handshake cannot fire ahead of it;
      // both objects are populated by the time `oninitialized` runs.
      mcp.server.oninitialized = (): void => {
        logger.logEvent({
          seq: 0,
          event: "mcp.client.initialized",
          timestamp: new Date().toISOString(),
          data: {
            clientInfo: serializeData(mcp.server.getClientVersion() ?? null),
            capabilities: serializeData(mcp.server.getClientCapabilities() ?? null),
          },
        });
      };
      const transport = options.transport ?? new StdioServerTransport();
      await mcp.connect(transport);
      await controller.start();
    },
    async stop(): Promise<void> {
      await controller.stop();
      await mcp.close();
    },
  };
}
