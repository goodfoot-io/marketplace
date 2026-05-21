import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

type ConversationSnapshot = {
  transcript: readonly { id: string; role: string; text: string }[];
  timeline: readonly { type: string; transcriptItemId?: string }[];
};

type ConversationController = {
  start: () => Promise<void> | void;
  stop: () => Promise<void> | void;
  startConversation: () => Promise<void> | void;
  readonly currentConversation?: ConversationSnapshot;
  on: (eventName: string, handler: (event: unknown) => void) => () => void;
};

type TestConversationController = ConversationController & { __testPort: number };

type CreateVoiceAgentServer = (options: {
  apiKey: string;
  port: number;
  realtime: { instructions: string; model?: string; voice?: string };
  tools: Record<string, unknown>;
  __voiceFactory?: () => FakeRealtimeConnection;
}) => ConversationController;

class FakeRealtimeConnection {
  readonly sent: unknown[] = [];
  readonly handlers = new Map<string, Set<(event: unknown) => void>>();

  send(event: unknown): void {
    this.sent.push(event);
  }

  close(): void {}

  on(eventName: string, handler: (event: unknown) => void): void {
    const handlers = this.handlers.get(eventName) ?? new Set<(event: unknown) => void>();
    handlers.add(handler);
    this.handlers.set(eventName, handlers);
  }

  emit(eventName: string, event: unknown): void {
    for (const handler of this.handlers.get(eventName) ?? []) {
      handler(event);
    }
  }
}

const testDir = dirname(fileURLToPath(import.meta.url));
const sourceEntry = resolve(testDir, "../src/index.ts");
const runIfSourceExists = existsSync(sourceEntry) ? describe : describe.skip;

let createVoiceAgentServer: CreateVoiceAgentServer;
const controllers: ConversationController[] = [];

beforeAll(async () => {
  if (!existsSync(sourceEntry)) {
    return;
  }
  ({ createVoiceAgentServer } = (await import("../src/index.js")) as unknown as {
    createVoiceAgentServer: CreateVoiceAgentServer;
  });
});

afterEach(async () => {
  await Promise.allSettled(controllers.splice(0).map((controller) => controller.stop()));
});

runIfSourceExists("transcript chronological ordering under the xAI ASR/response race", () => {
  it("places the user utterance before the assistant reply that answered it — the user's conversation.item.added anchors the slot before the assistant transcript, even when the final ASR text arrives late", async () => {
    const fakeRealtime = new FakeRealtimeConnection();
    const controller = await makeController({ __voiceFactory: () => fakeRealtime });
    await controller.start();
    controllers.push(controller);
    const browser = await openReadyBrowserClient(controller);

    const userItemId = "item_user_1";
    const assistantItemId = "item_assistant_1";

    // REAL xAI ORDER: the user's slot anchor (conversation.item.added) is emitted
    // right after the utterance commits — BEFORE the assistant response — even
    // though its final ASR transcript (transcription.completed) lands late, after
    // the assistant has already replied.
    fakeRealtime.emit("input_audio_buffer.speech_started", {});
    fakeRealtime.emit("input_audio_buffer.speech_stopped", {});
    fakeRealtime.emit("input_audio_buffer.committed", {});

    // 1. The user slot is created first, with the transcript still pending.
    fakeRealtime.emit("conversation.item.added", {
      item: {
        id: userItemId,
        role: "user",
        content: [{ type: "input_audio", transcript: "" }],
      },
    });

    // 2. The assistant turn's response + transcript-done land next.
    fakeRealtime.emit("response.created", { response: { id: "resp_1" } });
    fakeRealtime.emit("response.output_audio_transcript.done", {
      item_id: assistantItemId,
      transcript: "The capital of France is Paris.",
    });

    // 3. The user's final ASR transcript arrives late and fills the slot in
    //    place — it must NOT move the user turn after the assistant reply.
    fakeRealtime.emit("conversation.item.input_audio_transcription.completed", {
      item_id: userItemId,
      transcript: "What is the capital of France?",
    });

    await new Promise((resolve) => setTimeout(resolve, 30));

    const snapshot = controller.currentConversation;
    expect(snapshot).toBeDefined();

    const idForTimelineSlot = (transcriptItemId?: string) =>
      snapshot?.transcript.find((t) => t.id === transcriptItemId);

    const orderedRoles = (snapshot?.timeline ?? [])
      .filter((entry) => entry.type === "transcript")
      .map((entry) => idForTimelineSlot(entry.transcriptItemId)?.role);

    const userIndex = orderedRoles.indexOf("user");
    const assistantIndex = orderedRoles.indexOf("assistant");

    expect(userIndex).toBeGreaterThanOrEqual(0);
    expect(assistantIndex).toBeGreaterThanOrEqual(0);

    // The user utterance must occupy its true conversational slot: before the
    // assistant reply that answered it.
    expect(userIndex).toBeLessThan(assistantIndex);

    browser.close();
  });
});

async function makeController(
  overrides: Partial<Parameters<CreateVoiceAgentServer>[0]> = {},
): Promise<TestConversationController> {
  const port = overrides.port ?? (await getFreePort());
  const controller = createVoiceAgentServer({
    apiKey: "test-api-key",
    port,
    realtime: { instructions: "You are a test assistant." },
    tools: {},
    __voiceFactory: () => new FakeRealtimeConnection(),
    ...overrides,
  });
  return Object.assign(controller, { __testPort: port }) as TestConversationController;
}

async function getFreePort(): Promise<number> {
  const server = createServer();
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

async function openBrowserClient(port: number): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const state = await waitForOpenOrClose(socket);
  if (state !== "open") {
    throw new Error("Expected the first browser client to connect");
  }
  return socket;
}

async function openReadyBrowserClient(controller: TestConversationController): Promise<WebSocket> {
  const socket = await openBrowserClient(controller.__testPort);
  socket.send(
    JSON.stringify({
      type: "audio.device.state",
      data: {
        permission: "granted",
        devices: [{ deviceId: "default", label: "Default microphone" }],
        selectedDeviceId: "default",
        ready: true,
      },
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  await controller.startConversation();
  return socket;
}

async function waitForOpenOrClose(socket: WebSocket): Promise<"open" | "closed"> {
  return await new Promise((resolveState, reject) => {
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out waiting for websocket state"));
    }, 500);

    socket.once("open", () => {
      clearTimeout(timer);
      resolveState("open");
    });

    socket.once("close", () => {
      clearTimeout(timer);
      resolveState("closed");
    });

    socket.once("error", () => {
      clearTimeout(timer);
      resolveState("closed");
    });
  });
}
