#!/usr/bin/env node
/**
 * Daemon entry point for rvs.
 * Spawned as a detached child by `rvs start`. Communicates config via env vars.
 */

import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { createRealtimeVoiceServer } from "../index.js";
import type { JsonValue, RealtimeVoiceToolContext, RealtimeVoiceServerEvents, RealtimeVoiceToolMap } from "../types.js";

// ---------------------------------------------------------------------------
// Config from env
// ---------------------------------------------------------------------------

const port = parseInt(process.env["RVS_PORT"] ?? String(20000 + (process.ppid % 10000)), 10);
const apiKey = process.env["RVS_API_KEY"] ?? "";
const instructions = process.env["RVS_INSTRUCTIONS"] ?? "";
const title = process.env["RVS_TITLE"];
const model = process.env["RVS_MODEL"];
const voice = process.env["RVS_VOICE"];

const controlPort = port + 1;
const tmpDir = `/tmp/voice-${port}`;
const eventsFile = `${tmpDir}/events.jsonl`;
const cursorFile = `${tmpDir}/cursor`;
const pidFile = `${tmpDir}/daemon.pid`;

// ---------------------------------------------------------------------------
// JSONL event log
// ---------------------------------------------------------------------------

let seq = 0;

function appendEvent(event: string, data: Record<string, unknown>): void {
  seq += 1;
  const line =
    JSON.stringify({ seq, event, timestamp: new Date().toISOString(), data: serializeData(data) }) + "\n";
  appendFileSync(eventsFile, line, "utf8");
}

// Recursively serialize Date values to ISO strings
function serializeData(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeData) as JsonValue[];
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

// ---------------------------------------------------------------------------
// Ask tool state
// ---------------------------------------------------------------------------

let questionCounter = 0;
const pendingQuestions = new Map<number, (answer: string) => void>();

// ---------------------------------------------------------------------------
// Client registry & lifecycle
// ---------------------------------------------------------------------------

interface RegisteredClient {
  clientId: string;
  pid: number;
}

const registeredClients = new Map<string, RegisteredClient>();
let clientIdCounter = 0;
let firstRegisterDeadline: ReturnType<typeof setTimeout> | null = null;

function startFirstRegisterTimer(): void {
  firstRegisterDeadline = setTimeout(() => {
    if (registeredClients.size === 0) {
      shutdown();
    }
  }, 30_000);
}

function checkClients(): void {
  for (const [clientId, client] of registeredClients) {
    try {
      process.kill(client.pid, 0);
    } catch {
      registeredClients.delete(clientId);
    }
  }
  if (registeredClients.size === 0 && firstRegisterDeadline === null) {
    // All clients gone
    shutdown();
  }
}

function shutdown(): void {
  controller.stop().finally(() => {
    cleanup();
    process.exit(0);
  });
}

function cleanup(): void {
  try {
    rmSync(pidFile);
  } catch (_err: unknown) {
    void _err; // pid file may not exist — not fatal
  }
}

// ---------------------------------------------------------------------------
// Build controller
// ---------------------------------------------------------------------------

const askTool = {
  description:
    "Recall information not available in this conversation — prior context, user preferences, file contents, external state, or anything the backing agent can look up. Phrase the query as a specific lookup key, not a conversational question. The result will be supplied by the agent monitoring this session.",
  parameters: z.object({ question: z.string() }),
  execute: async ({ question }: { question: string }, { signal }: RealtimeVoiceToolContext): Promise<JsonValue> => {
    const questionId = ++questionCounter;
    appendEvent("question", { questionId, question });
    const answer = await new Promise<string>((resolve, reject) => {
      pendingQuestions.set(questionId, resolve);
      signal.addEventListener("abort", () => {
        pendingQuestions.delete(questionId);
        reject(new Error("aborted"));
      });
    });
    return { answer };
  },
};

const realtimeConfig = {
  instructions,
  ...(model !== undefined ? { model } : {}),
  ...(voice !== undefined ? { voice } : {}),
};

const uiConfig = title !== undefined ? { title } : {};

const controller = createRealtimeVoiceServer({
  port,
  apiKey,
  realtime: realtimeConfig,
  tools: { ask: askTool },
  ui: uiConfig,
});

// ---------------------------------------------------------------------------
// Wire controller events to JSONL
// ---------------------------------------------------------------------------

type KnownEventKey = keyof RealtimeVoiceServerEvents<RealtimeVoiceToolMap>;

const knownEvents: KnownEventKey[] = [
  "server.started",
  "server.stopped",
  "browser.client.connected",
  "browser.client.disconnected",
  "browser.client.rejected",
  "browser.audio.error",
  "browser.audio.deviceChange",
  "conversation.started",
  "conversation.paused",
  "conversation.resumed",
  "conversation.ended",
  "conversation.reset",
  "conversation.error",
  "realtime.updated",
  "transcript.delta",
  "transcript.item",
  "tool.call.started",
  "tool.call.completed",
  "tool.call.failed",
  "tool.call.interrupted",
  "log",
];

for (const eventName of knownEvents) {
  controller.on(eventName, (data) => {
    appendEvent(eventName, data as unknown as Record<string, unknown>);
  });
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

mkdirSync(tmpDir, { recursive: true });
writeFileSync(pidFile, String(process.pid), "utf8");

controller.on("server.started", (event) => {
  // Emit startup JSON to stdout for the spawning CLI
  const line = JSON.stringify({ port: event.port, url: event.url, createdAt: event.createdAt.toISOString() });
  process.stdout.write(line + "\n");
});

controller.start().catch((err: unknown) => {
  process.stderr.write(JSON.stringify({ error: String(err) }) + "\n");
  cleanup();
  process.exit(1);
});

startFirstRegisterTimer();

// Check client liveness every 5s
setInterval(checkClients, 5_000);

// ---------------------------------------------------------------------------
// Control HTTP server
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function serializeStatus(): unknown {
  return serializeData(controller.status as unknown as Record<string, unknown>);
}

const controlServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://localhost:${controlPort}`);
  const pathname = url.pathname;

  try {
    if (method === "GET" && pathname === "/status") {
      sendJson(res, 200, serializeStatus());
      return;
    }

    if (method === "POST" && pathname === "/server/stop") {
      sendJson(res, 200, { ok: true });
      setImmediate(() => shutdown());
      return;
    }

    if (method === "POST" && pathname === "/conversation/start") {
      await controller.startConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/conversation/pause") {
      await controller.pauseConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/conversation/resume") {
      await controller.resumeConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/conversation/end") {
      await controller.endConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/conversation/reset") {
      await controller.resetConversation();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/inject/user") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { text: string; source?: string; triggerResponse?: boolean };
      const item = await controller.injectUserMessage({
        text: parsed.text,
        source: parsed.source as "textInput" | "system" | undefined,
        triggerResponse: parsed.triggerResponse,
      });
      sendJson(res, 200, serializeData(item as unknown as Record<string, unknown>));
      return;
    }

    if (method === "POST" && pathname === "/inject/assistant") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { text: string; source?: string };
      const item = await controller.injectAssistantMessage({
        text: parsed.text,
        source: parsed.source as "assistantText" | "system" | undefined,
      });
      sendJson(res, 200, serializeData(item as unknown as Record<string, unknown>));
      return;
    }

    if (method === "POST" && pathname === "/inject/system") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { text: string; triggerResponse?: boolean };
      const item = await controller.injectSystemMessage({
        text: parsed.text,
        triggerResponse: parsed.triggerResponse,
      });
      sendJson(res, 200, serializeData(item as unknown as Record<string, unknown>));
      return;
    }

    if (method === "POST" && pathname === "/tool/cancel") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { callId: string };
      await controller.cancelToolCall(parsed.callId);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && pathname === "/tool/answer") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { questionId: number; answer: string };
      const resolve = pendingQuestions.get(parsed.questionId);
      if (resolve === undefined) {
        sendJson(res, 404, { error: "Question not found", code: "QUESTION_NOT_FOUND" });
      } else {
        pendingQuestions.delete(parsed.questionId);
        resolve(parsed.answer);
        sendJson(res, 200, { ok: true });
      }
      return;
    }

    if (method === "POST" && pathname === "/client/register") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { pid: number };
      const clientId = `client-${++clientIdCounter}`;
      registeredClients.set(clientId, { clientId, pid: parsed.pid });
      // Cancel the 30s no-registration shutdown timer
      if (firstRegisterDeadline !== null) {
        clearTimeout(firstRegisterDeadline);
        firstRegisterDeadline = null;
      }
      sendJson(res, 200, { clientId });
      return;
    }

    if (method === "POST" && pathname === "/client/unregister") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw) as { clientId: string };
      registeredClients.delete(parsed.clientId);
      sendJson(res, 200, { ok: true });
      if (registeredClients.size === 0) {
        setImmediate(() => shutdown());
      }
      return;
    }

    if (method === "GET" && pathname === "/watch") {
      const eventsParam = url.searchParams.get("events");
      const afterParam = url.searchParams.get("after");
      const filterEvents = eventsParam ? eventsParam.split(",").filter(Boolean) : [];
      const after = afterParam ? parseInt(afterParam, 10) : 0;

      let content: string;
      try {
        content = readFileSync(eventsFile, "utf8");
      } catch {
        content = "";
      }

      const lines = content.split("\n").filter(Boolean);
      const matching: string[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as { seq: number; event: string };
          if (parsed.seq > after) {
            if (filterEvents.length === 0 || filterEvents.includes(parsed.event)) {
              matching.push(line);
            }
          }
        } catch (_err: unknown) {
          void _err; // skip malformed lines
        }
      }

      const responseBody = matching.join("\n") + (matching.length > 0 ? "\n" : "");
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Content-Length": Buffer.byteLength(responseBody),
      });
      res.end(responseBody);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err: unknown) {
    sendJson(res, 500, { error: String(err) });
  }
});

controlServer.listen(controlPort, "localhost");

// ---------------------------------------------------------------------------
// Signal handling
// ---------------------------------------------------------------------------

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
