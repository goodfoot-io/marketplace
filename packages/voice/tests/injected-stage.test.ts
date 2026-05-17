import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

type InjectedController = {
  start: () => Promise<void> | void;
  stop: () => Promise<void> | void;
  setHtml: (input: { html: string } | { path: string } | null) => Promise<void>;
  on: (eventName: string, handler: (event: unknown) => void) => () => void;
};

type TestInjectedController = InjectedController & { __testPort: number };

type CreateVoiceAgentServer = (options: {
  apiKey: string;
  port: number;
  realtime: { instructions: string; model?: string; voice?: string };
  tools: Record<string, unknown>;
  __voiceFactory?: () => FakeRealtimeConnection;
}) => InjectedController;

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
const controllers: InjectedController[] = [];
const tmpDirs: string[] = [];

beforeAll(async () => {
  if (!existsSync(sourceEntry)) {
    return;
  }

  ({ createVoiceAgentServer } = (await import("../src/index.js")) as unknown as {
    createVoiceAgentServer: CreateVoiceAgentServer;
  });
});

afterEach(async () => {
  await Promise.allSettled(controllers.splice(0).map((c) => c.stop()));
  await Promise.allSettled(tmpDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

runIfSourceExists("setHtml — injected stage", () => {
  it("setHtml({ html }) serves the body verbatim at /__injected with no-store and no title substitution", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    const rawHtml = "<html><head><title>__REALTIME_VOICE_TITLE__</title></head><body>hello</body></html>";
    await controller.setHtml({ html: rawHtml });

    const res = await fetch(`http://127.0.0.1:${port}/__injected?v=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    // Must be byte-identical — no __REALTIME_VOICE_TITLE__ substitution
    expect(body).toBe(rawHtml);
  });

  it("injectedVersion increments on each setHtml call and is present on the state envelope", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    const v0 = await readStateInjectedVersion(port);
    expect(v0).toBeNull();

    await controller.setHtml({ html: "<p>first</p>" });
    const v1 = await readStateInjectedVersion(port);
    expect(typeof v1).toBe("number");
    expect(v1).toBeGreaterThan(0);

    await controller.setHtml({ html: "<p>second</p>" });
    const v2 = await readStateInjectedVersion(port);
    expect(typeof v2).toBe("number");
    expect(v2 as number).toBeGreaterThan(v1 as number);
  });

  it("setHtml({ html }) broadcasts a stage.injected delta to connected sockets", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await waitForOpenOrClose(socket);

    const deltaPromise = waitForMessage(socket, (msg) => msg.type === "stage.injected");
    await controller.setHtml({ html: "<p>delta</p>" });
    const delta = await deltaPromise;

    socket.close();

    expect(delta).toMatchObject({
      type: "stage.injected",
      data: { injectedVersion: expect.any(Number) },
    });
  });

  it("setHtml({ path }) reads the file and serves its contents at /__injected", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    const dir = await makeTmpDir();
    const filePath = join(dir, "test.html");
    const content = "<html><body>from file</body></html>";
    await writeFile(filePath, content, "utf-8");

    await controller.setHtml({ path: filePath });

    const res = await fetch(`http://127.0.0.1:${port}/__injected?v=1`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(content);
  });

  it("editing the watched file produces a new injectedVersion (live re-render)", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    const dir = await makeTmpDir();
    const filePath = join(dir, "live.html");
    await writeFile(filePath, "<p>v1</p>", "utf-8");

    await controller.setHtml({ path: filePath });
    const v1 = await readStateInjectedVersion(port);

    // Overwrite in place — simple edit
    await writeFile(filePath, "<p>v2</p>", "utf-8");

    // Wait for the debounced watcher to fire and version to bump
    const v2 = await pollUntil(
      () => readStateInjectedVersion(port),
      (v) => typeof v === "number" && v !== v1,
      1500,
    );

    expect(typeof v2).toBe("number");
    expect(v2 as number).toBeGreaterThan(v1 as number);

    const res = await fetch(`http://127.0.0.1:${port}/__injected?v=${v2 as number}`);
    expect(await res.text()).toBe("<p>v2</p>");
  });

  it("watcher survives an atomic replace (write-to-temp + rename)", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    const dir = await makeTmpDir();
    const filePath = join(dir, "atomic.html");
    await writeFile(filePath, "<p>original</p>", "utf-8");

    await controller.setHtml({ path: filePath });
    const v1 = await readStateInjectedVersion(port);

    // Atomic replace: write to a temp file then rename over target
    const tmpFile = join(dir, "atomic.html.tmp");
    await writeFile(tmpFile, "<p>replaced</p>", "utf-8");
    await rename(tmpFile, filePath);

    const v2 = await pollUntil(
      () => readStateInjectedVersion(port),
      (v) => typeof v === "number" && v !== v1,
      1500,
    );

    expect(typeof v2).toBe("number");
    const res = await fetch(`http://127.0.0.1:${port}/__injected?v=${v2 as number}`);
    expect(await res.text()).toBe("<p>replaced</p>");
  });

  it("missing/unreadable path: error doc served, injected.error emitted, setHtml does not throw, server stays up", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    const errorEvents: unknown[] = [];
    controller.on("injected.error", (e) => errorEvents.push(e));

    const missingPath = "/tmp/voice-test-does-not-exist-XXXXXXXX.html";

    // Must not throw
    await expect(controller.setHtml({ path: missingPath })).resolves.toBeUndefined();

    // An error event should have been emitted
    await pollUntilTrue(() => errorEvents.length > 0, 500);
    expect(errorEvents.length).toBeGreaterThan(0);

    // Error document is served — not a 404
    const res = await fetch(`http://127.0.0.1:${port}/__injected?v=1`);
    expect(res.status).toBe(200);
    const body = await res.text();
    // The error document must mention the path
    expect(body).toContain(missingPath);

    // Server must still accept new connections
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const state = await waitForOpenOrClose(socket);
    socket.close();
    expect(state).toBe("open");
  });

  it("setHtml(null) clears: /__injected returns 404, injectedVersion is null on state envelope", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    await controller.setHtml({ html: "<p>set</p>" });
    const vSet = await readStateInjectedVersion(port);
    expect(vSet).not.toBeNull();

    await controller.setHtml(null);

    const vCleared = await readStateInjectedVersion(port);
    expect(vCleared).toBeNull();

    const res = await fetch(`http://127.0.0.1:${port}/__injected`);
    expect(res.status).toBe(404);
  });

  it("a freshly-connected socket after a prior setHtml receives the current injectedVersion via initial state broadcast", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    await controller.setHtml({ html: "<p>restore</p>" });
    const vBefore = await readStateInjectedVersion(port);
    expect(typeof vBefore).toBe("number");

    // New socket — must receive injectedVersion in its first state message
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const stateMsg = await waitForMessage(socket, (m) => m.type === "state");
    socket.close();

    expect(stateMsg).toMatchObject({
      type: "state",
      data: { injectedVersion: vBefore },
    });
  });

  it("overlapping setHtml calls: only the last watcher and version remain (no leaked watcher)", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);
    const port = (controller as TestInjectedController).__testPort;

    const dir = await makeTmpDir();
    const fileA = join(dir, "a.html");
    const fileB = join(dir, "b.html");
    await writeFile(fileA, "<p>A</p>", "utf-8");
    await writeFile(fileB, "<p>B</p>", "utf-8");

    // Fire both without awaiting the first
    const p1 = controller.setHtml({ path: fileA });
    const p2 = controller.setHtml({ path: fileB });
    await Promise.all([p1, p2]);

    const version = await readStateInjectedVersion(port);
    expect(typeof version).toBe("number");

    const res = await fetch(`http://127.0.0.1:${port}/__injected?v=${version as number}`);
    // Last write wins — must serve B
    expect(await res.text()).toBe("<p>B</p>");

    // Edit A — should NOT trigger a new version (watcher for A is torn down)
    const versionSnapshot = version;
    await writeFile(fileA, "<p>A-edited</p>", "utf-8");
    await new Promise((r) => setTimeout(r, 200));
    const versionAfterAEdit = await readStateInjectedVersion(port);
    expect(versionAfterAEdit).toBe(versionSnapshot);
  });

  it("stop() releases the watcher so the process can exit cleanly (no leaked handle)", async () => {
    const controller = await makeController();
    await controller.start();
    controllers.push(controller);

    const dir = await makeTmpDir();
    const filePath = join(dir, "watched.html");
    await writeFile(filePath, "<p>watched</p>", "utf-8");
    await controller.setHtml({ path: filePath });

    // stop() must resolve without hanging (watcher released)
    await expect(
      Promise.race([
        controller.stop(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("stop() timed out")), 1000)),
      ]),
    ).resolves.toBeUndefined();

    // Remove from afterEach cleanup since we already stopped it
    const idx = controllers.indexOf(controller);
    if (idx !== -1) controllers.splice(idx, 1);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeController(
  overrides: Partial<Parameters<CreateVoiceAgentServer>[0]> = {},
): Promise<TestInjectedController> {
  const port = overrides.port ?? (await getFreePort());
  const controller = createVoiceAgentServer({
    apiKey: "test-api-key",
    port,
    realtime: { instructions: "You are a test assistant." },
    tools: {},
    __voiceFactory: () => new FakeRealtimeConnection(),
    ...overrides,
  });
  return Object.assign(controller, { __testPort: port }) as TestInjectedController;
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

async function makeTmpDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "voice-test-"));
  tmpDirs.push(dir);
  return dir;
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

async function waitForMessage(
  socket: WebSocket,
  predicate: (msg: { type: string; data?: unknown }) => boolean,
  timeoutMs = 500,
): Promise<{ type: string; data?: unknown }> {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out waiting for matching message"));
    }, timeoutMs);

    socket.on("message", (raw) => {
      const msg = JSON.parse((raw as Buffer).toString()) as { type: string; data?: unknown };
      if (predicate(msg)) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });
}

async function readStateInjectedVersion(port: number): Promise<number | null> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  try {
    const msg = await waitForMessage(socket, (m) => m.type === "state");
    const data = msg.data as Record<string, unknown>;
    const v = data.injectedVersion;
    return v === null || v === undefined ? null : (v as number);
  } finally {
    socket.close();
  }
}

async function pollUntil<T>(fn: () => Promise<T>, predicate: (v: T) => boolean, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (predicate(v)) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`pollUntil timed out after ${timeoutMs}ms`);
}

async function pollUntilTrue(fn: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error(`pollUntilTrue timed out after ${timeoutMs}ms`);
}

// Ensure the mkdir import is used (needed for potential nested dir creation in tests)
void mkdir;
