import { existsSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * The voice server uses one fixed port shared across spawned instances. When
 * the port is already owned by another instance, `createVoiceMcpServer` must
 * return an inert server: no tools advertised and no web server started.
 */

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

runIfSourceExists("MCP server — port already in use", () => {
  it("starts inert (no tools, no web server) when the port is occupied", async () => {
    // Occupy the port with an unrelated listener.
    const port = await getFreePort();
    const occupier = createServer();
    await new Promise<void>((res) => occupier.listen(port, "127.0.0.1", res));
    cleanups.push(() => new Promise<void>((res) => occupier.close(() => res())));

    const errors: string[] = [];
    const logger: DiagnosticLogger = { logEvent: () => {}, logError: (m) => errors.push(m) };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const server = await createVoiceMcpServer(
      {
        enabled: true,
        apiKey: "test-api-key",
        keySource: "env",
        secretsPath: "/tmp/voice-port-busy-secrets.json",
        port,
        logPath: undefined,
        watchTypes: [],
      },
      { transport: serverTransport, logger },
    );
    cleanups.push(() => server.stop());

    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    const startPromise = server.start();
    await client.connect(clientTransport);
    await startPromise;

    // No tools advertised: the inert server declares no `tools` capability, so
    // tools/list is not even a supported method.
    expect(client.getServerCapabilities()?.tools).toBeUndefined();
    await expect(client.listTools()).rejects.toThrow();

    // The conflict was logged.
    expect(errors.some((m) => m.includes("port already in use"))).toBe(true);

    await client.close();
  });

  it("starts normally (tools advertised) when the port is free", async () => {
    const port = await getFreePort();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const server = await createVoiceMcpServer(
      {
        enabled: true,
        apiKey: "test-api-key",
        keySource: "env",
        secretsPath: "/tmp/voice-port-free-secrets.json",
        port,
        logPath: undefined,
        watchTypes: [],
      },
      { transport: serverTransport, logger: { logEvent: () => {}, logError: () => {} } },
    );
    cleanups.push(() => server.stop());

    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    const startPromise = server.start();
    await client.connect(clientTransport);
    await startPromise;

    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);

    await client.close();
  });

  it("starts normally when a sibling releases the port mid-probe (no false positive)", async () => {
    // Occupy the port, then release it shortly after the probe begins. The
    // retrying check must observe the port become free and start normally
    // rather than wedging into inert mode over the transient hold.
    const port = await getFreePort();
    const occupier = createServer();
    await new Promise<void>((res) => occupier.listen(port, "127.0.0.1", res));

    const errors: string[] = [];
    const logger: DiagnosticLogger = { logEvent: () => {}, logError: (m) => errors.push(m) };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Release the port ~300ms in — after the first probe attempt, before the
    // retries are exhausted (5 attempts × 250ms).
    setTimeout(() => occupier.close(), 300);

    const server = await createVoiceMcpServer(
      {
        enabled: true,
        apiKey: "test-api-key",
        keySource: "env",
        secretsPath: "/tmp/voice-port-race-secrets.json",
        port,
        logPath: undefined,
        watchTypes: [],
      },
      { transport: serverTransport, logger },
    );
    cleanups.push(() => server.stop());

    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    const startPromise = server.start();
    await client.connect(clientTransport);
    await startPromise;

    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(errors.some((m) => m.includes("port already in use"))).toBe(false);

    await client.close();
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
