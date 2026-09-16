/**
 * Tests for the skeleton server: configuration parsing, the readiness
 * handshake, and the `echo` tool reached two ways — through the SDK client on
 * the modern protocol, and through a raw 2025-era handshake of the kind the
 * MCP Inspector CLI performs.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_PORT, isLoopbackHostname, parseArgs } from "../src/config.js";
import { type ReadyFile, type RunningServer, startServer } from "../src/serve.js";

describe("configuration", () => {
  it("defaults to loopback-only local mode", () => {
    expect(parseArgs([])).toEqual({ mode: "local", port: DEFAULT_PORT });
  });

  it("accepts a public URL in public mode", () => {
    const config = parseArgs(["--mode=public", "--url=https://shell.example.net"]);
    expect(config.mode).toBe("public");
    expect(config.publicUrl).toBe("https://shell.example.net/");
  });

  it("rejects a public URL in local mode", () => {
    expect(() => parseArgs(["--url=https://shell.example.net"])).toThrow(ConfigError);
  });

  it("requires a public URL in public mode", () => {
    expect(() => parseArgs(["--mode=public"])).toThrow(ConfigError);
  });

  it("rejects a public URL that names the local host", () => {
    for (const url of ["https://localhost:8443", "https://127.0.0.1", "https://[::1]:8443", "https://0.0.0.0"]) {
      expect(() => parseArgs(["--mode=public", `--url=${url}`]), url).toThrow(ConfigError);
    }
  });

  it("rejects plain http as a public URL", () => {
    expect(() => parseArgs(["--mode=public", "--url=http://shell.example.net"])).toThrow(ConfigError);
  });

  it("rejects unknown arguments and malformed values", () => {
    expect(() => parseArgs(["--verbose"])).toThrow(ConfigError);
    expect(() => parseArgs(["--port=seventy"])).toThrow(ConfigError);
    expect(() => parseArgs(["--port=70000"])).toThrow(ConfigError);
    expect(() => parseArgs(["--ready-file="])).toThrow(ConfigError);
  });

  it("recognises loopback hostnames by name and by literal", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("app.localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("127.13.13.13")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("shell.example.net")).toBe(false);
    expect(isLoopbackHostname("127.example.net")).toBe(false);
  });
});

describe("server over HTTP", () => {
  let server: RunningServer;
  let readyDirectory: string;

  beforeAll(async () => {
    readyDirectory = await mkdtemp(join(tmpdir(), "remote-managed-shell-test-"));
    server = await startServer({
      mode: "local",
      port: 0,
      readyFile: join(readyDirectory, "ready.json"),
    });
  });

  afterAll(async () => {
    await server.close();
    await rm(readyDirectory, { recursive: true, force: true });
  });

  it("publishes a readiness file naming the bound port", async () => {
    const ready = JSON.parse(await readFile(server.readyFile ?? "", "utf8")) as ReadyFile;
    expect(ready.port).toBe(server.port);
    expect(ready.host).toBe("127.0.0.1");
    expect(ready.mode).toBe("local");
    expect(ready.pid).toBe(process.pid);
    expect(ready.endpoint).toBe(server.endpoint.href);
  });

  it("leaves a replacement instance's readiness file alone", async () => {
    const path = join(readyDirectory, "foreign-ready.json");
    const instance = await startServer({ mode: "local", port: 0, readyFile: path });
    const replacement = { ...(JSON.parse(await readFile(path, "utf8")) as ReadyFile), pid: process.pid + 1 };
    await writeFile(path, `${JSON.stringify(replacement, null, 2)}\n`, "utf8");

    await instance.close();

    expect((JSON.parse(await readFile(path, "utf8")) as ReadyFile).pid).toBe(replacement.pid);
  });

  it("answers a client on the modern protocol", async () => {
    const client = new Client({ name: "echo-test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(server.endpoint));
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toContain("echo");
      expect(tools.find((tool) => tool.name === "echo")?.annotations?.readOnlyHint).toBe(true);

      const result = await client.callTool({ name: "echo", arguments: { text: "round trip" } });
      expect(result.structuredContent).toEqual({ text: "round trip" });
      expect(result.content).toEqual([{ type: "text", text: "round trip" }]);
    } finally {
      await client.close();
    }
  });

  it("serves a 2025-era client the same tools", async () => {
    const initialize = await postJsonRpc(server.endpoint, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "legacy-probe", version: "0.0.0" },
      },
    });
    expect(initialize.status).toBe(200);
    const initialized = await readJsonRpcMessage(initialize);
    expect(initialized.result).toBeDefined();

    const list = await readJsonRpcMessage(
      await postJsonRpc(server.endpoint, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    );
    const tools = (list.result as { tools: { name: string }[] }).tools;
    expect(tools.map((tool) => tool.name)).toContain("echo");

    const call = await readJsonRpcMessage(
      await postJsonRpc(server.endpoint, {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "echo", arguments: { text: "legacy round trip" } },
      }),
    );
    expect(call.result).toEqual({
      content: [{ type: "text", text: "legacy round trip" }],
      structuredContent: { text: "legacy round trip" },
    });
  });

  it("rejects a request to an unknown route", async () => {
    const response = await fetch(new URL("/not-mcp", server.endpoint), { method: "POST" });
    expect(response.status).toBe(404);
  });
});

function postJsonRpc(endpoint: URL, body: unknown): Promise<Response> {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

/** Reads a JSON-RPC message from either a plain JSON or an SSE response. */
async function readJsonRpcMessage(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!contentType.includes("text/event-stream")) {
    return JSON.parse(text) as Record<string, unknown>;
  }
  const frames = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((frame) => frame.length > 0);
  const last = frames.at(-1);
  if (last === undefined) {
    throw new Error(`no SSE data frame in response: ${text}`);
  }
  return JSON.parse(last) as Record<string, unknown>;
}
