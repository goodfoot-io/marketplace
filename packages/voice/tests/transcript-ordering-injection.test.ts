import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

type TranscriptItem = { id: string; role: string; text: string };
type TimelineEntry = { id: string; type: string; transcriptItemId?: string };
type ConversationSnapshot = {
  transcript: readonly TranscriptItem[];
  timeline: readonly TimelineEntry[];
};

type ConversationController = {
  start: () => Promise<void> | void;
  stop: () => Promise<void> | void;
  startConversation: () => Promise<void> | void;
  readonly currentConversation?: ConversationSnapshot;
  injectSystemMessage: (input: { text: string }) => Promise<{ role: string; text: string }>;
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

runIfSourceExists("transcript ordering — injected turn under the ASR/response race", () => {
  it("keeps an injected turn in its true chronological slot — the user slot anchors first, its final ASR text fills late", async () => {
    const fakeRealtime = new FakeRealtimeConnection();
    const controller = await makeController({ __voiceFactory: () => fakeRealtime });
    await controller.start();
    controllers.push(controller);
    const browser = await openReadyBrowserClient(controller);

    // 1. The user speaks; xAI commits the utterance and emits the user slot
    //    anchor (conversation.item.added) right away — its final ASR text is
    //    still pending. This is xAI's real event order.
    fakeRealtime.emit("input_audio_buffer.speech_started", {});
    fakeRealtime.emit("input_audio_buffer.speech_stopped", {});
    fakeRealtime.emit("input_audio_buffer.committed", {});
    fakeRealtime.emit("conversation.item.added", {
      item: {
        id: "user_1",
        role: "user",
        content: [{ type: "input_audio", transcript: "" }],
      },
    });

    // 2. An injected system turn is added next (e.g. `voice context` /
    //    `voice topics`), appended to the timeline immediately.
    await controller.injectSystemMessage({ text: "voice context: user is on the billing page" });

    // 3. The assistant response begins and completes.
    fakeRealtime.emit("response.created", {});
    fakeRealtime.emit("response.output_audio_transcript.done", {
      item_id: "assistant_1",
      transcript: "Sure, here is the answer.",
    });
    fakeRealtime.emit("response.done", {});

    // 4. The user's final ASR transcript fills the already-anchored slot in
    //    place under the same item id — it must NOT reorder the turn.
    fakeRealtime.emit("conversation.item.input_audio_transcription.completed", {
      item_id: "user_1",
      transcript: "What is my balance?",
    });

    await new Promise((r) => setTimeout(r, 20));
    browser.close();

    const snapshot = controller.currentConversation;
    expect(snapshot).toBeDefined();

    const textById = new Map(snapshot?.transcript.map((t) => [t.id, t]));
    const renderedOrder = snapshot?.timeline
      .filter(
        (e): e is TimelineEntry & { transcriptItemId: string } =>
          e.type === "transcript" && e.transcriptItemId !== undefined,
      )
      .map((e) => textById.get(e.transcriptItemId)?.text ?? "<missing>");

    // True chronological order: the user spoke first, the injected context
    // turn was added next, and the assistant reply followed.
    expect(renderedOrder).toEqual([
      "What is my balance?",
      "voice context: user is on the billing page",
      "Sure, here is the answer.",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function openReadyBrowserClient(controller: TestConversationController): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${controller.__testPort}/ws`);
  const state = await waitForOpenOrClose(socket);
  if (state !== "open") {
    throw new Error("Expected the browser client to connect");
  }
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
