import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { z } from "zod";

type ConversationController = {
  start: () => Promise<void> | void;
  stop: () => Promise<void> | void;
  startConversation: () => Promise<void> | void;
  readonly currentConversation?: { toolCalls: readonly { status: string; result?: unknown }[] };
  on: (eventName: string, handler: (event: unknown) => void) => () => void;
  injectUserMessage: (input: { text: string }) => Promise<{ role: string; source: string; text: string }>;
  injectAssistantMessage: (input: { text: string }) => Promise<{ role: string; source: string; text: string }>;
  injectSystemMessage: (input: { text: string }) => Promise<{ role: string; source: string; text: string }>;
  updateVoiceSession: (config: unknown) => Promise<void> | void;
  cancelToolCall: (toolCallId: string) => Promise<void> | void;
};

type TestConversationController = ConversationController & { __testPort: number };

type CreateVoiceAgentServer = (options: {
  apiKey: string;
  browserSession?: {
    firstMessage?: string;
    firstMessageRole?: "assistant" | "system" | "user";
  };
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

runIfSourceExists("createVoiceAgentServer", () => {
  it("fails closed before the server lifecycle has started", async () => {
    const controller = await makeController();

    await expectCallToFail(() => controller.injectUserMessage({ text: "hello" }));
    await expectCallToFail(() => controller.injectAssistantMessage({ text: "hello" }));
    await expectCallToFail(() => controller.injectSystemMessage({ text: "hello" }));
    await expectCallToFail(() => controller.updateVoiceSession({ instructions: "updated" }));
    await expectCallToFail(() => controller.cancelToolCall("call_123"));
  });

  it("starts and stops its local server without leaving the port bound", async () => {
    const port = await getFreePort();
    const controller = await makeController({ port });

    await controller.start();
    controllers.push(controller);

    await expect(canConnect(port)).resolves.toBe(true);

    await controller.stop();
    controllers.pop();

    await expect(canConnect(port)).resolves.toBe(false);

    const nextController = await makeController({ port });
    await nextController.start();
    controllers.push(nextController);

    await expect(canConnect(port)).resolves.toBe(true);
  });

  it("rejects invalid realtime updates", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);

    await expectCallToFail(() =>
      controller.updateVoiceSession({
        instructions: "",
        temperature: "hot",
      }),
    );
  });

  it("rejects cancelToolCall when no matching tool call is active", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);

    await expectCallToFail(() => controller.cancelToolCall("missing_tool_call"));
  });

  it("accepts injected user, assistant, and system messages after start", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const browser = await openReadyBrowserClient(controller);

    await expect(controller.injectUserMessage({ text: "user message" })).resolves.toMatchObject({
      role: "user",
      source: "system",
      text: "user message",
    });
    await expect(controller.injectAssistantMessage({ text: "assistant message" })).resolves.toMatchObject({
      role: "assistant",
      source: "system",
      text: "assistant message",
    });
    await expect(controller.injectSystemMessage({ text: "system message" })).resolves.toMatchObject({
      role: "system",
      source: "system",
      text: "system message",
    });
    browser.close();
  });

  it("accepts firstMessage configuration during startup", async () => {
    const controller = await makeController({
      browserSession: {
        firstMessage: "Start by greeting the caller.",
        firstMessageRole: "assistant",
      },
    });

    await expect(controller.start()).resolves.toBeUndefined();
    controllers.push(controller);
    const browser = await openReadyBrowserClient(controller);
    browser.close();
  });

  it("does not allow two browser clients to control the same server at once", async () => {
    const port = await getFreePort();
    const controller = await makeController({ port });
    await controller.start();
    controllers.push(controller);

    const firstClient = await openBrowserClient(port);
    try {
      const secondClient = new WebSocket(`ws://127.0.0.1:${port}`);
      try {
        await expect(waitForOpenOrClose(secondClient)).resolves.toBe("closed");
      } finally {
        secondClient.close();
      }
    } finally {
      firstClient.close();
    }
  });

  it("executes realtime function calls through configured zod-backed tools", async () => {
    const fakeRealtime = new FakeRealtimeConnection();
    const completed: unknown[] = [];
    const controller = await makeController({
      __voiceFactory: () => fakeRealtime,
      tools: {
        remember: {
          description: "Remember text",
          parameters: z.object({ text: z.string() }),
          execute: ({ text }: { text: string }) => ({ remembered: text }),
        },
      },
    });
    controller.on("tool.call.completed", (event) => completed.push(event));
    await controller.start();
    controllers.push(controller);
    const browser = await openReadyBrowserClient(controller);

    fakeRealtime.emit("response.function_call_arguments.done", {
      item_id: "tool_1",
      call_id: "call_1",
      name: "remember",
      arguments: JSON.stringify({ text: "alpha" }),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(completed).toHaveLength(1);
    expect(controller.currentConversation?.toolCalls[0]).toMatchObject({
      status: "completed",
      result: { remembered: "alpha" },
    });
    expect(fakeRealtime.sent).toContainEqual({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: "call_1",
        output: JSON.stringify({ remembered: "alpha" }),
      },
    });
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
    realtime: {
      instructions: "You are a test assistant.",
    },
    tools: {},
    __voiceFactory: () => new FakeRealtimeConnection(),
    ...overrides,
  });
  return Object.assign(controller, { __testPort: port }) as TestConversationController;
}

async function expectCallToFail(action: () => Promise<unknown> | unknown) {
  let failed = false;
  try {
    await action();
  } catch {
    failed = true;
  }

  expect(failed).toBe(true);
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

async function canConnect(port: number): Promise<boolean> {
  return await new Promise((resolveCanConnect) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const timer = setTimeout(() => {
      socket.terminate();
      resolveCanConnect(false);
    }, 250);

    socket.once("open", () => {
      clearTimeout(timer);
      socket.close();
      resolveCanConnect(true);
    });

    socket.once("error", () => {
      clearTimeout(timer);
      resolveCanConnect(false);
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
