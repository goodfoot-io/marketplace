import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The MCP server coalesces streaming user-speech transcripts so each spoken
 * turn reaches `claude/channel` EXACTLY ONCE, carrying the FINAL text — never an
 * earlier partial, and never a duplicate (the bug this guards against: xAI's
 * final ASR result often lands after the colleague's response has produced its
 * own `transcript.item`, and re-fires a finalized turn under the same item id).
 *
 * The controller is mocked so the test can drive `transcript.item` events
 * directly and assert what is delivered over the channel.
 */

// Holder assigned before each `createVoiceMcpServer` call; the hoisted mock
// factory reads `controller` from it at construction time.
const mockState = vi.hoisted(() => ({ controller: null as unknown }));

vi.mock("../src/index.js", () => ({
  createVoiceAgentServer: () => mockState.controller,
}));

interface DiagnosticLogger {
  logEvent: (record: { seq: number; event: string; timestamp: string; data: unknown }) => void;
  logError: (message: string, meta?: Record<string, unknown>) => void;
}

interface VoiceMcpServer {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

type CreateVoiceMcpServer = (
  config: {
    enabled: boolean;
    apiKey: string;
    keySource: "env" | "file" | "none";
    secretsPath: string;
    port: number;
    logPath: string | undefined;
    watchTypes: string[];
  },
  options: { transport?: Transport; logger?: DiagnosticLogger },
) => Promise<VoiceMcpServer>;

const testDir = dirname(fileURLToPath(import.meta.url));
const sourceEntry = resolve(testDir, "../src/mcp/server.ts");
const runIfSourceExists = existsSync(sourceEntry) ? describe : describe.skip;

let createVoiceMcpServer: CreateVoiceMcpServer;
const cleanups: Array<() => Promise<void> | void> = [];

beforeAll(async () => {
  if (!existsSync(sourceEntry)) return;
  ({ createVoiceMcpServer } = (await import("../src/mcp/server.js")) as unknown as {
    createVoiceMcpServer: CreateVoiceMcpServer;
  });
});

afterEach(async () => {
  await Promise.allSettled(cleanups.splice(0).map((fn) => fn()));
});

/** A minimal controller stub: a real EventEmitter plus the lifecycle methods the server awaits. */
function makeFakeController(): EventEmitter {
  return Object.assign(new EventEmitter(), {
    start: async (): Promise<void> => {},
    stop: async (): Promise<void> => {},
  });
}

/** A `transcript.item` controller-event payload. */
function transcriptItem(source: string, id: string, text: string): unknown {
  return {
    item: { id, conversationId: "c1", role: source === "microphone" ? "user" : "assistant", source, text },
    createdAt: new Date(),
  };
}

interface ChannelNote {
  type: string;
  seq: string;
  role?: string;
  revises?: string;
  content: string;
}

runIfSourceExists("MCP server — user-transcript coalescing", () => {
  it("delivers each user turn once with final text — no partials, no duplicates", async () => {
    const controller = makeFakeController();
    mockState.controller = controller;

    const port = await getFreePort();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const server = await createVoiceMcpServer(
      {
        enabled: true,
        apiKey: "test-api-key",
        keySource: "env",
        secretsPath: "/tmp/voice-coalesce-secrets.json",
        port,
        logPath: undefined,
        watchTypes: ["transcript.item"],
      },
      { transport: serverTransport, logger: { logEvent: () => {}, logError: () => {} } },
    );
    cleanups.push(() => server.stop());

    const notes: ChannelNote[] = [];
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    client.fallbackNotificationHandler = async (n): Promise<void> => {
      if (n.method !== "notifications/claude/channel") return;
      const params = n.params as { content?: unknown; meta?: Record<string, unknown> } | undefined;
      const meta = (params?.meta ?? {}) as Record<string, unknown>;
      notes.push({
        type: String(meta.type ?? ""),
        seq: String(meta.seq ?? ""),
        role: meta.role as string | undefined,
        revises: meta.revises as string | undefined,
        content: typeof params?.content === "string" ? params.content : "",
      });
    };

    const startPromise = server.start();
    await client.connect(clientTransport);
    await startPromise;

    // 1. User starts a turn (partial ASR).
    controller.emit("transcript.item", transcriptItem("microphone", "u1", "what's the weather"));
    // 2. Colleague responds — its completed transcript must NOT flush the user's
    //    still-in-flight turn as a partial.
    controller.emit("transcript.item", transcriptItem("assistantAudio", "a1", "Let me check."));
    // 3. The user's FINAL ASR lands late, under the same item id.
    controller.emit("transcript.item", transcriptItem("microphone", "u1", "what's the weather in Boston"));
    // 4. A new user turn (different item id) settles u1 — delivered once, final text.
    controller.emit("transcript.item", transcriptItem("microphone", "u2", "thanks"));
    // 5. A stray re-fire of the already-delivered turn must be dropped.
    controller.emit("transcript.item", transcriptItem("microphone", "u1", "what's the weather in Boston"));
    // 6. Session teardown flushes the last buffered turn (u2).
    controller.emit("conversation.ended", { conversationId: "c1", createdAt: new Date() });

    await waitFor(() => notes.filter((n) => n.type === "transcript.item").length >= 3);
    // Give any erroneous extra delivery a chance to arrive, then assert it didn't.
    await sleep(50);

    const transcripts = notes.filter((n) => n.type === "transcript.item");
    const userTurns = transcripts.filter((n) => n.role === "user");
    const colleagueTurns = transcripts.filter((n) => n.role === "colleague");

    // Exactly two user turns: u1 (final) and u2 — no partial, no duplicate.
    expect(userTurns.map((n) => n.content)).toEqual(["what's the weather in Boston", "thanks"]);
    // The premature partial was never sent.
    expect(userTurns.some((n) => n.content === "what's the weather")).toBe(false);
    // Corrections are not used — turns are plain, with no `revises` marker.
    expect(userTurns.every((n) => n.revises === undefined)).toBe(true);
    // The colleague turn was delivered immediately, exactly once.
    expect(colleagueTurns.map((n) => n.content)).toEqual(["Let me check."]);

    await client.close();
  });

  it("delivers a single buffered turn via its quiet window when nothing else settles it", async () => {
    const controller = makeFakeController();
    mockState.controller = controller;

    const port = await getFreePort();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const server = await createVoiceMcpServer(
      {
        enabled: true,
        apiKey: "test-api-key",
        keySource: "env",
        secretsPath: "/tmp/voice-coalesce-quiet-secrets.json",
        port,
        logPath: undefined,
        watchTypes: ["transcript.item"],
      },
      { transport: serverTransport, logger: { logEvent: () => {}, logError: () => {} } },
    );
    cleanups.push(() => server.stop());

    const notes: ChannelNote[] = [];
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    client.fallbackNotificationHandler = async (n): Promise<void> => {
      if (n.method !== "notifications/claude/channel") return;
      const params = n.params as { content?: unknown; meta?: Record<string, unknown> } | undefined;
      const meta = (params?.meta ?? {}) as Record<string, unknown>;
      notes.push({
        type: String(meta.type ?? ""),
        seq: String(meta.seq ?? ""),
        role: meta.role as string | undefined,
        revises: meta.revises as string | undefined,
        content: typeof params?.content === "string" ? params.content : "",
      });
    };

    const startPromise = server.start();
    await client.connect(clientTransport);
    await startPromise;

    controller.emit("transcript.item", transcriptItem("microphone", "u1", "hi"));
    controller.emit("transcript.item", transcriptItem("microphone", "u1", "hi there"));

    // The quiet window is 1500ms; wait past it for the settled delivery.
    await waitFor(() => notes.some((n) => n.type === "transcript.item"), 4000);
    await sleep(50);

    const userTurns = notes.filter((n) => n.type === "transcript.item" && n.role === "user");
    expect(userTurns.map((n) => n.content)).toEqual(["hi there"]);

    await client.close();
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function waitFor(pred: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await sleep(10);
  }
}

async function getFreePort(): Promise<number> {
  const server: Server = createServer();
  return await new Promise((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a TCP port")));
        return;
      }
      const { port } = address;
      server.close(() => resolvePort(port));
    });
  });
}
