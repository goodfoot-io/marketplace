import { mkdtemp, readFile, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type RunningServer, startServer } from "../src/serve.js";

const MESSAGE = "Unsupported Media Type: Content-Type must be application/json";
const PROBE_HEADERS = { accept: "application/json", "user-agent": "oai-tunnel-client/0.0.14" };

interface RequestOptions {
  path?: string;
  headers?: Record<string, string>;
  body?: string;
  chunked?: boolean;
}

describe("tunnel authentication probe console suppression", () => {
  let server: RunningServer;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "shell-mcp-probe-"));
    server = await startServer({
      port: 0,
      readyFile: join(directory, "ready.json"),
      spoolRoot: join(directory, "spool"),
      logFile: join(directory, "diagnostics.jsonl"),
    });
  });

  afterEach(async () => {
    await server?.close();
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it("suppresses only the notice, preserving the SDK's 415 response and diagnostic file record", async () => {
    const display = vi.spyOn(server.logger, "display");
    const response = await send();
    expect(response.status).toBe(415);
    expect(JSON.parse(response.body)).toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: MESSAGE },
      id: null,
    });
    expect(display).not.toHaveBeenCalled();
    await server.close();
    const records = (await readFile(join(directory, "diagnostics.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records.find((record) => record.event === "mcp.error")).toMatchObject({
      message: MESSAGE,
      level: "error",
      consoleSuppressed: true,
      requestPattern: "tunnel-auth-probe",
      serverInstanceId: server.serverInstanceId,
    });
  });

  it("checks actual empty body length, including an empty chunked request", async () => {
    const display = vi.spyOn(server.logger, "display");
    expect((await send({ chunked: true })).status).toBe(415);
    expect(display).not.toHaveBeenCalled();
  });

  const nearMisses: Array<[string, RequestOptions]> = [
    ["no tunnel user agent", { headers: { accept: "application/json" } }],
    ["another user agent", { headers: { ...PROBE_HEADERS, "user-agent": "curl/8.0" } }],
    ["incomplete tunnel user agent", { headers: { ...PROBE_HEADERS, "user-agent": "oai-tunnel-client/" } }],
    [
      "a user agent with extra tokens",
      { headers: { ...PROBE_HEADERS, "user-agent": "oai-tunnel-client/0.0.14 other" } },
    ],
    ["no Accept header", { headers: { "user-agent": PROBE_HEADERS["user-agent"] } }],
    ["normal MCP Accept header", { headers: { ...PROBE_HEADERS, accept: "application/json, text/event-stream" } }],
    ["explicit wrong Content-Type", { headers: { ...PROBE_HEADERS, "content-type": "text/plain" } }],
    ["an empty Content-Type header", { headers: { ...PROBE_HEADERS, "content-type": "" } }],
    ["nonempty request body", { body: "{}" }],
    ["whitespace-only body", { body: "\n" }],
    ["nonempty chunked body", { body: "{}", chunked: true }],
    ["a query string", { path: "/mcp?request=other" }],
  ];
  it.each(nearMisses)("keeps errors visible for %s", async (_name, options) => {
    const display = vi.spyOn(server.logger, "display").mockImplementation(() => {});
    const log = vi.spyOn(server.logger, "log");
    expect((await send(options)).status).toBe(415);
    expect(display).toHaveBeenCalledExactlyOnceWith({ type: "notice", text: `shell-mcp: ${MESSAGE}` });
    const diagnostic = log.mock.calls.find((call) => call[0] === "mcp.error");
    expect(diagnostic?.[3]).not.toHaveProperty("consoleSuppressed");
  });

  it("does not change other protocol rejections from the tunnel client", async () => {
    const log = vi.spyOn(server.logger, "log");
    const response = await send({
      headers: { ...PROBE_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "probe-test", version: "1" },
        },
      }),
    });
    expect(response.status).toBe(406);
    expect(response.body).toContain("Not Acceptable");
    expect(log.mock.calls.some((call) => call[3]?.consoleSuppressed === true)).toBe(false);
  });

  it("keeps probe suppression request-local with simultaneous malformed requests", async () => {
    const display = vi.spyOn(server.logger, "display").mockImplementation(() => {});
    const log = vi.spyOn(server.logger, "log");
    const responses = await Promise.all(
      Array.from({ length: 16 }, (_, i) => send(i % 2 === 0 ? {} : { chunked: true, body: "{}" })),
    );
    expect(responses.every((response) => response.status === 415)).toBe(true);
    expect(display).toHaveBeenCalledTimes(8);
    const records = log.mock.calls.filter((call) => call[0] === "mcp.error");
    expect(records).toHaveLength(16);
    expect(records.filter((call) => call[3]?.consoleSuppressed === true)).toHaveLength(8);
  });

  it("leaves valid MCP requests working between repeated probes", async () => {
    const display = vi.spyOn(server.logger, "display");
    expect((await send()).status).toBe(415);
    const valid = await send({
      headers: { ...PROBE_HEADERS, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "probe-test", version: "1" },
        },
      }),
    });
    expect(valid.status).toBe(200);
    expect((await send()).status).toBe(415);
    expect(display).not.toHaveBeenCalled();
  });

  function send(options: RequestOptions = {}): Promise<{ status: number; body: string }> {
    const body = options.body ?? "";
    return new Promise((resolve, reject) => {
      const request = httpRequest(
        {
          hostname: "127.0.0.1",
          port: server.port,
          path: options.path ?? "/mcp",
          method: "POST",
          headers: {
            ...(options.headers ?? PROBE_HEADERS),
            ...(options.chunked
              ? { "transfer-encoding": "chunked" }
              : { "content-length": String(Buffer.byteLength(body)) }),
          },
        },
        (response) => {
          let text = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            text += chunk;
          });
          response.on("error", reject);
          response.on("end", () => resolve({ status: response.statusCode ?? 0, body: text }));
        },
      );
      request.on("error", reject);
      request.setTimeout(5000, () => request.destroy(new Error("HTTP probe test timed out")));
      request.end(body);
    });
  }
});
