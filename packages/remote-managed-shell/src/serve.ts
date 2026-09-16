/**
 * HTTP composition for the MCP server: one route, one transport, both startup
 * modes.
 *
 * The server always listens on loopback. `public` mode additionally records the
 * operator-supplied URL it is reachable at, but publishing that URL is a
 * separate mechanism the operator runs — this process never creates, probes, or
 * supervises it (which is also why no tunnel client is a dependency here).
 */

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { LISTEN_HOST, MCP_PATH, type ServerConfig, type ServerMode } from "./config.js";
import { createServer } from "./server.js";

/** Contents of the readiness file written once the listen port is bound. */
export interface ReadyFile {
  readonly pid: number;
  readonly mode: ServerMode;
  readonly host: string;
  readonly port: number;
  /** Absolute URL of the MCP route. */
  readonly endpoint: string;
  /** Operator-supplied public URL, in `public` mode only. */
  readonly publicUrl?: string;
  readonly startedAt: string;
}

/** A running server: what it bound, where it is, and how to stop it. */
export interface RunningServer {
  readonly mode: ServerMode;
  readonly host: string;
  /** The port actually bound, which differs from the requested one when it was `0`. */
  readonly port: number;
  /** Absolute URL of the MCP route. */
  readonly endpoint: URL;
  /** Path of the readiness file, when one is written. */
  readonly readyFile?: string;
  /** Stops accepting connections and releases the port. Idempotent. */
  close(): Promise<void>;
}

/**
 * Starts the server for a validated configuration.
 *
 * Resolves once the port is bound and the readiness file (if one was
 * requested) is in place, so a caller that sees the resolved value or the
 * ready file can connect immediately.
 *
 * @param config - Configuration from {@link parseArgs}.
 * @returns The running server.
 */
export async function startServer(config: ServerConfig): Promise<RunningServer> {
  const handler = createMcpHandler(() => createServer(), {
    onerror: (error) => {
      console.error(`remote-managed-shell: handler error: ${error.message}`);
    },
  });
  const nodeHandler = toNodeHandler(handler, {
    onerror: (error) => {
      console.error(`remote-managed-shell: request error: ${error.message}`);
    },
  });

  // Loopback-only mode rejects a Host or Origin naming anything else, so a
  // browser on this host cannot be used to reach the server. Public mode leaves
  // this to the authentication boundary built on top of this skeleton: the
  // operator's publishing mechanism rewrites the Host header, so the loopback
  // allowlist would reject every request that arrives through it.
  const guards = config.mode === "local" ? [localhostHostValidation(), localhostOriginValidation()] : [];

  const httpServer = createHttpServer((req, res) => {
    void serveRequest(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`remote-managed-shell: unhandled request failure: ${message}`);
      if (res.headersSent) {
        res.destroy();
        return;
      }
      sendJson(res, 500, { error: "internal_error" });
    });
  });

  async function serveRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (requestPath(req) !== MCP_PATH) {
      sendJson(res, 404, { error: "not_found", message: `MCP is served at ${MCP_PATH}` });
      return;
    }
    for (const guard of guards) {
      // A guard that returns false has already answered the request.
      if (!guard(req, res)) {
        return;
      }
    }
    await nodeHandler(req, res);
  }

  try {
    await listen(httpServer, config.port);
  } catch (error) {
    await handler.close();
    throw error;
  }

  const port = boundPort(httpServer, config.port);
  const endpoint = new URL(`http://${LISTEN_HOST}:${port}${MCP_PATH}`);
  const readyFile = config.readyFile ?? join(tmpdir(), "remote-managed-shell", `ready-${port}.json`);

  await writeReadyFile(readyFile, {
    pid: process.pid,
    mode: config.mode,
    host: LISTEN_HOST,
    port,
    endpoint: endpoint.href,
    ...(config.publicUrl === undefined ? {} : { publicUrl: config.publicUrl }),
    startedAt: new Date().toISOString(),
  });

  let closed = false;
  return {
    mode: config.mode,
    host: LISTEN_HOST,
    port,
    endpoint,
    readyFile,
    close: async (): Promise<void> => {
      if (closed) {
        return;
      }
      closed = true;
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          resolve();
        });
        // close() waits for open connections; a client holding a keep-alive
        // socket would otherwise delay shutdown until its own timeout.
        httpServer.closeAllConnections();
      });
      await handler.close();
      await removeReadyFileIfOwned(readyFile);
    },
  };
}

function listen(server: ReturnType<typeof createHttpServer>, port: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };
    server.once("error", onError);
    server.listen(port, LISTEN_HOST, () => {
      server.off("error", onError);
      resolve();
    });
  });
}

function boundPort(server: ReturnType<typeof createHttpServer>, requested: number): number {
  const address = server.address();
  if (address !== null && typeof address === "object") {
    return address.port;
  }
  return requested;
}

function requestPath(req: IncomingMessage): string {
  // The base is a placeholder: only the path is read, and a malformed request
  // line yields a path that matches no route.
  return new URL(req.url ?? "/", `http://${LISTEN_HOST}`).pathname;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = `${JSON.stringify(body)}\n`;
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Writes the readiness file atomically: the file appears only once it holds a
 * complete record, so a reader that sees it never reads a partial port.
 */
async function writeReadyFile(path: string, contents: ReadyFile): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(contents, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

/**
 * Removes the readiness file only when it still names this process.
 *
 * `dev` runs under a watcher that restarts on every source change, and a
 * restart makes the old and new instance share one path. Deleting
 * unconditionally would let a shutting-down instance erase its replacement's
 * readiness claim — the one file a client waits on to learn the port. A file
 * that cannot be read or parsed is left alone: this process cannot prove it
 * owns it, and leaving a stale claim is recoverable where deleting a live one
 * is not.
 */
async function removeReadyFileIfOwned(path: string): Promise<void> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch {
    return;
  }
  try {
    if ((JSON.parse(contents) as ReadyFile).pid !== process.pid) {
      return;
    }
  } catch {
    return;
  }
  await rm(path, { force: true });
}
