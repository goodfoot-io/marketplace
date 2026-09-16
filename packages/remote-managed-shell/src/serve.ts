import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { AuthService } from "./auth/index.js";
import { advertisedBase, DEFAULT_LIMITS, LISTEN_HOST, MCP_PATH, type ServerConfig, type ServerMode } from "./config.js";
import { IsolatedLogger } from "./logging/logger.js";
import { ProcessManager } from "./process-manager.js";
import { createServer } from "./server.js";

export interface ReadyFile {
  pid: number;
  serverInstanceId: string;
  stage: "ready";
  mode: ServerMode;
  host: string;
  port: number;
  endpoint: string;
  publicUrl: string | null;
  publicEndpoint: string | null;
  publicUrlStatus: "not_configured" | "configured_unverified";
  issuer: string;
  protectedResourceMetadata: string;
  capabilities: { tools: number; oauth: "2.1"; transport: "streamable-http-json"; maxWaitMs: number };
  startedAt: string;
}

export interface RunningServer {
  mode: ServerMode;
  host: string;
  port: number;
  endpoint: URL;
  readyFile: string;
  serverInstanceId: string;
  authorizationUrl: URL;
  startupSecret: string;
  close(): Promise<void>;
}

export async function startServer(config: ServerConfig): Promise<RunningServer> {
  const limits = config.limits ?? DEFAULT_LIMITS;
  const logger = new IsolatedLogger(limits.loggerBytes, limits.loggerRecords);
  const manager = new ProcessManager({
    mode: config.mode,
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
  const mcpHandler = createMcpHandler(() => createServer(manager), {
    legacy: "stateless",
    responseMode: "json",
    onerror: (error) => console.error(`remote-managed-shell: MCP handler error: ${error.message}`),
  });

  let auth: AuthService | undefined;
  let boundPortValue = 0;
  const fetchHandler = {
    fetch: async (incoming: Request): Promise<Response> => {
      const bounded = await boundedRequest(incoming, 524_288);
      if (bounded instanceof Response) return bounded;
      const request = bounded;
      if (!auth) return Response.json({ error: "starting" }, { status: 503 });
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        return Response.json(
          {
            status: "ok",
            mode: config.mode,
            server_instance_id: manager.instanceId,
            local_endpoint: `http://${LISTEN_HOST}:${boundPortValue}${MCP_PATH}`,
            public_endpoint: config.publicUrl === undefined ? null : auth.mcpEndpoint,
            public_url_status: config.publicUrl === undefined ? "not_configured" : "configured_unverified",
          },
          { headers: { "cache-control": "no-store" } },
        );
      }
      const authResponse = await auth.route(request);
      if (authResponse) {
        await logAuthResponse(logger, "authorization", request, authResponse);
        return authResponse;
      }
      if (url.pathname !== MCP_PATH)
        return Response.json({ error: "not_found", message: `MCP is served at ${MCP_PATH}` }, { status: 404 });
      const authenticated = await auth.authenticate(request);
      if (authenticated instanceof Response) {
        await logAuthResponse(logger, "resource", request, authenticated);
        return authenticated;
      }
      logger.log("auth.resource", "auth", `accepted client=${authenticated.clientId ?? "unknown"}`);
      if (request.method === "GET") return sseKeepaliveResponse();
      return mcpHandler.fetch(request, { authInfo: authenticated });
    },
  };
  const nodeHandler = toNodeHandler(fetchHandler, {
    onerror: (error) => console.error(`remote-managed-shell: request error: ${error.message}`),
  });
  const guards = config.mode === "local" ? [localhostHostValidation(), localhostOriginValidation()] : [];
  const httpServer = createHttpServer((request, response) => {
    void serveNodeRequest(request, response, guards, nodeHandler).catch((error: unknown) => {
      console.error(
        `remote-managed-shell: unhandled request failure: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (response.headersSent) response.destroy();
      else sendJson(response, 500, { error: "internal_error" });
    });
  });

  try {
    await listen(httpServer, config.port);
    const port = boundPort(httpServer, config.port);
    boundPortValue = port;
    const localBase = `http://${LISTEN_HOST}:${port}`;
    auth = new AuthService({
      mode: config.mode,
      baseUrl: advertisedBase(config, port),
      limits: {
        clientCacheEntries: limits.authClients,
        maxPendingAuthorization: limits.authPending,
        maxCodes: limits.authCodes,
        maxAccessTokens: limits.authAccessTokens,
        maxRefreshTokens: limits.authRefreshTokens,
        codeTtlMs: limits.authCodeTtlMs,
        accessTokenTtlMs: limits.authAccessTtlMs,
        refreshTokenTtlMs: limits.authRefreshTtlMs,
        clientFetchTimeoutMs: limits.authFetchTimeoutMs,
        clientDocumentBytes: limits.authDocumentBytes,
      },
    });
    const endpoint = new URL(`${localBase}${MCP_PATH}`);
    const readyFile = config.readyFile ?? join(tmpdir(), "remote-managed-shell", `ready-${port}.json`);
    await writeReadyFile(readyFile, {
      pid: process.pid,
      serverInstanceId: manager.instanceId,
      stage: "ready",
      mode: config.mode,
      host: LISTEN_HOST,
      port,
      endpoint: endpoint.href,
      publicUrl: config.publicUrl ?? null,
      publicEndpoint: config.publicUrl === undefined ? null : auth.mcpEndpoint,
      publicUrlStatus: config.publicUrl === undefined ? "not_configured" : "configured_unverified",
      issuer: auth.issuer,
      protectedResourceMetadata: auth.protectedResourceMetadataUrl,
      capabilities: { tools: 5, oauth: "2.1", transport: "streamable-http-json", maxWaitMs: limits.maxWaitMs },
      startedAt: new Date().toISOString(),
    });
    let closePromise: Promise<void> | undefined;
    return {
      mode: config.mode,
      host: LISTEN_HOST,
      port,
      endpoint,
      readyFile,
      serverInstanceId: manager.instanceId,
      authorizationUrl: auth.authorizationUrl,
      startupSecret: auth.startupSecret,
      close: () =>
        (closePromise ??= closeRunning(
          httpServer,
          mcpHandler,
          manager,
          auth as AuthService,
          readyFile,
          manager.instanceId,
        )),
    };
  } catch (error) {
    httpServer.closeAllConnections();
    await manager.shutdown();
    await mcpHandler.close();
    await auth?.close();
    throw error;
  }
}

async function logAuthResponse(
  logger: IsolatedLogger,
  boundary: "authorization" | "resource",
  request: Request,
  response: Response,
): Promise<void> {
  let reason = response.ok ? "accepted" : `http_${response.status}`;
  if (!response.ok && response.headers.get("content-type")?.includes("application/json")) {
    const body = (await response
      .clone()
      .json()
      .catch(() => undefined)) as { error?: unknown } | undefined;
    if (typeof body?.error === "string") reason = body.error;
  }
  const url = new URL(request.url);
  const client = request.method === "GET" ? url.searchParams.get("client_id") : null;
  logger.log(
    `auth.${boundary}`,
    "auth",
    `${request.method} ${url.pathname} status=${response.status} reason=${reason}${client ? ` client=${client}` : ""}`,
  );
}

async function boundedRequest(request: Request, maximum: number): Promise<Request | Response> {
  if (request.method === "GET" || request.method === "HEAD" || request.body === null) return request;
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
  return new Request(request.url, { method: request.method, headers: request.headers, body, signal: request.signal });
}

async function serveNodeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  guards: Array<(request: IncomingMessage, response: ServerResponse) => boolean>,
  handler: ReturnType<typeof toNodeHandler>,
): Promise<void> {
  for (const guard of guards) if (!guard(request, response)) return;
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
  auth: AuthService,
  readyFile: string,
  instanceId: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
  await Promise.allSettled([manager.shutdown(), handler.close(), auth.close()]);
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
