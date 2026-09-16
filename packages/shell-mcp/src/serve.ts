import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { DEFAULT_LIMITS, LISTEN_HOST, MCP_PATH, type ServerConfig } from "./config.js";
import { IsolatedLogger, type Logger } from "./logging/logger.js";
import { captureStartupWarnings } from "./logging/sdk-diagnostics.js";
import { ProcessManager } from "./process-manager.js";
import { createServer } from "./server.js";

export interface ReadyFile {
  pid: number;
  serverInstanceId: string;
  stage: "ready";
  host: string;
  port: number;
  endpoint: string;
  capabilities: { tools: number; transport: "streamable-http-json"; maxWaitMs: number };
  startedAt: string;
}

export interface RunningServer {
  host: string;
  port: number;
  endpoint: URL;
  readyFile: string;
  serverInstanceId: string;
  logger: Logger;
  close(): Promise<void>;
}

export async function startServer(config: ServerConfig): Promise<RunningServer> {
  const limits = config.limits ?? DEFAULT_LIMITS;
  const logger = new IsolatedLogger(limits.loggerBytes, limits.loggerRecords, { logFile: config.logFile });
  const manager = new ProcessManager({
    cwd: config.workdir ?? process.cwd(),
    bash: config.bash ?? "/bin/bash",
    spoolRoot: config.spoolRoot,
    pty: !(config.disablePty ?? false),
    logger,
    limits: {
      activeSessions: limits.activeSessions,
      maxWaitMs: limits.maxWaitMs,
      outputBytesPerSession: limits.memoryPerSession,
      operationIds: limits.operationIds,
      writeIdsPerSession: limits.writesPerSession,
      inputPayloadBytes: limits.inputBytes,
      termGraceMs: limits.termGraceMs,
      cleanupObserveMs: limits.killGraceMs,
      responseEvents: limits.outputEvents,
      diskPerSession: limits.diskPerSession,
      diskGlobal: limits.diskGlobal,
      segmentBytes: limits.segmentBytes,
      segmentEvents: limits.segmentEvents,
      segments: limits.segments,
      spoolQueueBytes: limits.spoolQueueBytes,
      spoolQueueEntries: limits.spoolQueueEntries,
    },
  });
  logger.setServerInstanceId(manager.instanceId);
  // The SDK's shared onerror callback does not carry its Request. Keep this
  // display-only exception request-local, including across concurrent awaits.
  const tunnelAuthProbe = new AsyncLocalStorage<boolean>();
  const reportError = (kind: string, error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    const suppressProbeNotice =
      kind === "mcp.error" &&
      error instanceof Error &&
      message === "Unsupported Media Type: Content-Type must be application/json" &&
      tunnelAuthProbe.getStore() === true;
    logger.log(kind, "server", message, {
      logger: "server",
      level: "error",
      stack: error instanceof Error ? (error.stack ?? "") : "",
      ...(suppressProbeNotice ? { consoleSuppressed: true, requestPattern: "tunnel-auth-probe" } : {}),
    });
    if (!suppressProbeNotice) logger.display({ type: "notice", text: `shell-mcp: ${message}` });
  };
  const mcpHandler = captureStartupWarnings(logger, () =>
    createMcpHandler(() => createServer(manager), {
      legacy: "stateless",
      responseMode: "json",
      onerror: (error) => reportError("mcp.error", error),
    }),
  );

  let boundPortValue = 0;
  const fetchHandler = {
    fetch: async (incoming: Request): Promise<Response> => {
      const bounded = await boundedRequest(incoming, 524_288);
      if (bounded instanceof Response) return bounded;
      const { request, bodyBytes } = bounded;
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        return Response.json(
          {
            status: "ok",
            server_instance_id: manager.instanceId,
            endpoint: `http://${LISTEN_HOST}:${boundPortValue}${MCP_PATH}`,
          },
          { headers: { "cache-control": "no-store" } },
        );
      }
      if (url.pathname !== MCP_PATH)
        return Response.json({ error: "not_found", message: `MCP is served at ${MCP_PATH}` }, { status: 404 });
      if (request.method === "GET") return sseKeepaliveResponse();
      return tunnelAuthProbe.run(isTunnelAuthProbe(request, bodyBytes), () => mcpHandler.fetch(request));
    },
  };
  const nodeHandler = toNodeHandler(fetchHandler, {
    onerror: (error) => reportError("http.error", error),
  });
  const httpServer = createHttpServer((request, response) => {
    void serveNodeRequest(request, response, nodeHandler).catch((error: unknown) => {
      reportError("http.unhandled", error);
      if (response.headersSent) response.destroy();
      else sendJson(response, 500, { error: "internal_error" });
    });
  });

  try {
    await listen(httpServer, config.port);
    const port = boundPort(httpServer, config.port);
    boundPortValue = port;
    const endpoint = new URL(`http://${LISTEN_HOST}:${port}${MCP_PATH}`);
    const readyFile = config.readyFile ?? join(tmpdir(), "shell-mcp", `ready-${port}.json`);
    await writeReadyFile(readyFile, {
      pid: process.pid,
      serverInstanceId: manager.instanceId,
      stage: "ready",
      host: LISTEN_HOST,
      port,
      endpoint: endpoint.href,
      capabilities: { tools: 5, transport: "streamable-http-json", maxWaitMs: limits.maxWaitMs },
      startedAt: new Date().toISOString(),
    });
    logger.log("server.ready", "server", "", {
      logger: "server",
      level: "info",
      endpoint: endpoint.href,
      readyFile,
      pid: process.pid,
    });
    let closePromise: Promise<void> | undefined;
    return {
      host: LISTEN_HOST,
      port,
      endpoint,
      readyFile,
      serverInstanceId: manager.instanceId,
      logger,
      close: () => (closePromise ??= closeRunning(httpServer, mcpHandler, manager, readyFile, manager.instanceId)),
    };
  } catch (error) {
    httpServer.closeAllConnections();
    await manager.shutdown();
    await mcpHandler.close();
    throw error;
  }
}

/**
 * tunnel-client's WWW-Authenticate discovery sends an empty POST with this
 * user-agent family and Accept header, but no Content-Type. Match the observed
 * request shape, not a claimed identity; it still receives the SDK's HTTP 415.
 * Never trust Content-Length alone to decide whether a request has a body.
 */
function isTunnelAuthProbe(request: Request, bodyBytes: number): boolean {
  const url = new URL(request.url);
  return (
    request.method === "POST" &&
    url.pathname === MCP_PATH &&
    url.search === "" &&
    request.headers.get("accept") === "application/json" &&
    !request.headers.has("content-type") &&
    /^oai-tunnel-client\/\S+$/u.test(request.headers.get("user-agent") ?? "") &&
    bodyBytes === 0
  );
}

async function boundedRequest(
  request: Request,
  maximum: number,
): Promise<{ request: Request; bodyBytes: number } | Response> {
  if (request.method === "GET" || request.method === "HEAD" || request.body === null) return { request, bodyBytes: 0 };
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maximum)
    return Response.json({ error: "request_too_large" }, { status: 413 });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      return Response.json({ error: "request_too_large" }, { status: 413 });
    }
    chunks.push(item.value);
  }
  const body = Buffer.allocUnsafe(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    request: new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
      signal: request.signal,
    }),
    bodyBytes: size,
  };
}

async function serveNodeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  handler: ReturnType<typeof toNodeHandler>,
): Promise<void> {
  const length = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(length) && length > 524_288) {
    sendJson(response, 413, { error: "request_too_large" });
    return;
  }
  await handler(request, response);
}

async function closeRunning(
  server: ReturnType<typeof createHttpServer>,
  handler: ReturnType<typeof createMcpHandler>,
  manager: ProcessManager,
  readyFile: string,
  instanceId: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
  await Promise.allSettled([manager.shutdown(), handler.close()]);
  await removeReadyFileIfOwned(readyFile, instanceId);
}

function listen(server: ReturnType<typeof createHttpServer>, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once("error", onError);
    server.listen(port, LISTEN_HOST, () => {
      server.off("error", onError);
      resolve();
    });
  });
}

function boundPort(server: ReturnType<typeof createHttpServer>, requested: number): number {
  const address = server.address();
  return address !== null && typeof address === "object" ? address.port : requested;
}

/**
 * `createMcpHandler`'s stateless legacy path answers a GET on the MCP route
 * with a 405 — the canonical stateless-transport behavior, since there is no
 * session for it to stream from. Some MCP clients (observed: ChatGPT's
 * connector) treat a 405 there as a dead connection and surface a hard
 * "reconnect" prompt instead of just retrying over POST. This answers GET
 * with a minimal, honestly-empty SSE stream instead: a well-formed
 * `text/event-stream` response that opens and immediately closes with
 * nothing to report, never a session-bound push channel this stateless
 * server cannot back.
 */
function sseKeepaliveResponse(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": ok\n\n"));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = `${JSON.stringify(body)}\n`;
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(payload)),
  });
  response.end(payload);
}

async function writeReadyFile(path: string, contents: ReadyFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${contents.serverInstanceId}.tmp`;
  await writeFile(temporary, `${JSON.stringify(contents, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

async function removeReadyFileIfOwned(path: string, instanceId: string): Promise<void> {
  let parsed: ReadyFile;
  try {
    parsed = JSON.parse(await readFile(path, "utf8")) as ReadyFile;
  } catch {
    return;
  }
  if (parsed.serverInstanceId === instanceId) await rm(path, { force: true });
}
