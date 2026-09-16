import { mkdtemp, readFile, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ReadyFile, type RunningServer, startServer } from "../src/serve.js";
import { TOOL_NAMES } from "../src/server.js";

interface RawResponse {
  status: number;
  body: string;
}

describe("unauthenticated server over real HTTP", () => {
  let server: RunningServer;
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "remote-managed-shell-http-"));
    server = await startServer({ port: 0, readyFile: join(directory, "ready.json") });
  });

  afterAll(async () => {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("publishes a readiness record with no external identity", async () => {
    const ready = JSON.parse(await readFile(server.readyFile, "utf8")) as ReadyFile;
    expect(ready.serverInstanceId).toBe(server.serverInstanceId);
    expect(ready.stage).toBe("ready");
    expect(ready.host).toBe("127.0.0.1");
    expect(ready.port).toBe(server.port);
    expect(ready.endpoint).toBe(server.endpoint.href);
    expect(ready.capabilities).toEqual({ tools: 5, transport: "streamable-http-json", maxWaitMs: 20_000 });
    for (const absent of [
      "mode",
      "publicUrl",
      "publicEndpoint",
      "publicUrlStatus",
      "issuer",
      "protectedResourceMetadata",
    ])
      expect(ready, absent).not.toHaveProperty(absent);

    const health = await fetch(new URL("/healthz", server.endpoint));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      status: "ok",
      server_instance_id: server.serverInstanceId,
      endpoint: server.endpoint.href,
    });
  });

  it("serves no discovery surface", async () => {
    for (const path of [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/mcp",
    ]) {
      const response = await fetch(new URL(path, server.endpoint));
      expect(response.status, path).toBe(404);
    }
  });

  it("serves an anonymous MCP request carrying any Host and any Origin", async () => {
    const response = await rawRequest(
      "/mcp",
      {
        host: "shell.example.net",
        origin: "https://shell.example.net",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      initializeBody(),
    );
    expect(response.status).toBe(200);
    expect(response.body).toContain('"jsonrpc":"2.0"');
  });

  it("ignores an arbitrary bearer and bounds request bodies", async () => {
    const unknown = await initialize(server, "unknown-instance-token");
    expect(unknown.status).toBe(200);

    const oversized = await fetch(server.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(524_289),
    });
    expect(oversized.status).toBe(413);
  });

  it("answers an anonymous GET on the MCP route with a minimal SSE stream, not the legacy 405", async () => {
    const anonymous = await fetch(server.endpoint, { method: "GET", headers: { accept: "text/event-stream" } });
    expect(anonymous.status).toBe(200);
    expect(anonymous.headers.get("content-type")).toContain("text/event-stream");
    expect(await anonymous.text()).toBe(": ok\n\n");
  });

  it("runs the exact five-tool surface through the SDK client without claiming a security scheme", async () => {
    const client = new Client({ name: "integration", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(server.endpoint));
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
      for (const tool of listed.tools) expect(tool._meta?.securitySchemes, tool.name).toBeUndefined();

      const discovery = await client.callTool({ name: "list_processes", arguments: {} });
      const listing = discovery.structuredContent as Record<string, unknown>;
      expect(listing.server_instance_id).toBe(server.serverInstanceId);
      const started = await client.callTool({
        name: "exec_command",
        arguments: {
          expected_server_instance_id: server.serverInstanceId,
          operation_id: "http-integration-1",
          cmd: "printf 'out'; printf 'err' >&2; exit 7",
          yield_time_ms: 2_000,
        },
      });
      const process = started.structuredContent as Record<string, unknown>;
      expect(process.session_id).toEqual(expect.any(String));
      expect(process.exit_code).toBe(7);
      expect(
        (process.output as Array<{ stream: string; data: string }>).map((event) => [event.stream, event.data]),
      ).toEqual(
        expect.arrayContaining([
          ["stdout", "out"],
          ["stderr", "err"],
        ]),
      );
      const recovered = await client.callTool({
        name: "list_processes",
        arguments: { operation_id: "http-integration-1" },
      });
      expect((recovered.structuredContent as { operation: { session_id: string } }).operation.session_id).toBe(
        process.session_id,
      );
    } finally {
      await client.close();
    }
  });

  it("preserves a replacement readiness claim when the older instance closes", async () => {
    const readyFile = join(directory, "replacement-ready.json");
    const first = await startServer({ port: 0, readyFile });
    const second = await startServer({ port: 0, readyFile });
    try {
      await first.close();
      const ready = JSON.parse(await readFile(readyFile, "utf8")) as ReadyFile;
      expect(ready.serverInstanceId).toBe(second.serverInstanceId);
      expect(ready.pid).toBe(process.pid);
    } finally {
      await first.close();
      await second.close();
    }
  });

  /**
   * `fetch` refuses to spell a `Host` of our choosing, so the one assertion
   * about a `Host` the design did not anticipate is made over raw HTTP.
   */
  function rawRequest(path: string, headers: Record<string, string>, body: string): Promise<RawResponse> {
    return new Promise((resolve, reject) => {
      const request = httpRequest(
        {
          host: "127.0.0.1",
          port: server.port,
          path,
          method: "POST",
          headers: { ...headers, "content-length": String(Buffer.byteLength(body)) },
        },
        (response) => {
          let text = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            text += chunk;
          });
          response.on("end", () => resolve({ status: response.statusCode ?? 0, body: text }));
        },
      );
      request.once("error", reject);
      request.end(body);
    });
  }

  function initializeBody(): string {
    return JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "probe", version: "0" } },
    });
  }

  function initialize(target: RunningServer, bearer?: string): Promise<Response> {
    return fetch(target.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(bearer === undefined ? {} : { authorization: `Bearer ${bearer}` }),
      },
      body: initializeBody(),
    });
  }
});
