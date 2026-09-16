#!/usr/bin/env node
/**
 * Starts the built server in public mode behind a Cloudflare Instant Tunnel:
 * `cloudflared tunnel --url`, the account-less `*.trycloudflare.com` quick
 * tunnel that needs no Cloudflare login, DNS record, or named tunnel.
 *
 * The ordering is forced by the OAuth identity. Public mode bakes the
 * advertised HTTPS base URL into the issuer, the resource indicator, and every
 * discovery document, so the server cannot start until the tunnel reports its
 * URL. The tunnel therefore starts first, its URL is parsed from the child's
 * log, and the server starts afterwards with that exact base URL.
 *
 * Startup is fail-closed. The script refuses to run without the build, the
 * cloudflared binary, and a free loopback port; after both children are up, it
 * requires the public route to answer with this instance's own identity
 * (`/healthz`, the protected-resource metadata, and the authenticated MCP
 * challenge) before it reports an endpoint. A child that exits on its own takes
 * the whole arrangement down with a non-zero status, and an orderly stop always
 * retires the server before the tunnel so the server can remove the readiness
 * claim it owns.
 *
 * The startup secret is printed once by the server on this process's inherited
 * stdout, where the operator reads it for the browser consent step. This script
 * never captures, reprints, logs, or persists it. The tunnel URL is not a
 * credential: reachability only exposes the OAuth 2.1 surface, and a client
 * still needs the startup secret to obtain a token.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SERVER_ENTRY = join(PACKAGE_ROOT, "build", "dist", "src", "main.js");
const LISTEN_HOST = "127.0.0.1";
/** Must match DEFAULT_PORT in src/config.ts. */
const DEFAULT_PORT = 38147;
/** Every Cloudflare quick tunnel is a hostname on this zone. */
const TUNNEL_URL = /https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.trycloudflare\.com/u;
/** Cloudflare refuses new account-less tunnels per source address: HTTP 429. */
const TUNNEL_RATE_LIMIT = /provisioning failed with status 429|error code: 1015/iu;
const TUNNEL_SETUP_TIMEOUT_MS = 30_000;
const SERVER_READY_TIMEOUT_MS = 20_000;
const ROUTE_VERIFY_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
/** The server's own shutdown budget is `shutdownMs` (10s) from src/config.ts. */
const SERVER_STOP_GRACE_MS = 12_000;
const TUNNEL_STOP_GRACE_MS = 5_000;
const FORCE_KILL_GRACE_MS = 2_000;
/** Options this script owns; passing them after `--` would be a silent conflict. */
const MANAGED_SERVER_OPTIONS = new Set(["--mode", "--url", "--port", "--ready-file"]);

const USAGE = `Usage: start-tunnel.mjs [options] [-- server options]

Starts the built server in public mode behind a Cloudflare Instant Tunnel and
reports the MCP endpoint only after the public route answers with this
instance's own OAuth identity.

  --port=<1-65535>        Loopback port the server binds and the tunnel
                          publishes (default ${DEFAULT_PORT}).
  --ready-file=<path>     Atomic readiness-claim location (default: a
                          ready-public-<port>.json claim in the system temp
                          directory).
  --cloudflared=<path>    cloudflared executable (default: $CLOUDFLARED, then
                          cloudflared on PATH).
  -h, --help              Print this message.

  -- <options>            Pass the remaining options to the server, for example
                          -- --workdir=/srv --disable-pty. --mode, --url,
                          --port, and --ready-file belong to this script.`;

class UsageRequested extends Error {
  constructor() {
    super("usage requested");
    this.name = "UsageRequested";
  }
}

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

/** Raised when the run ends on a signal or on a child exiting on its own. */
class Halted extends Error {
  constructor(outcome) {
    super("halted");
    this.name = "Halted";
    this.outcome = outcome;
  }
}

function parseArgs(argv) {
  const options = { port: DEFAULT_PORT, readyFile: undefined, cloudflared: undefined, serverArgs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") {
      options.serverArgs = argv.slice(index + 1);
      break;
    }
    if (argument === "--help" || argument === "-h") throw new UsageRequested();
    if (!argument.startsWith("--")) throw new UsageError(`unexpected argument: ${argument}`);
    const separator = argument.indexOf("=");
    const key = separator === -1 ? argument : argument.slice(0, separator);
    const value = separator === -1 ? undefined : argument.slice(separator + 1);
    if (key === "--port") options.port = parsePort(value);
    else if (key === "--ready-file") options.readyFile = requireValue(key, value);
    else if (key === "--cloudflared") options.cloudflared = requireValue(key, value);
    else throw new UsageError(`unknown option: ${key}`);
  }
  for (const argument of options.serverArgs) {
    const key = argument.split("=")[0];
    if (MANAGED_SERVER_OPTIONS.has(key))
      throw new UsageError(`${key} is owned by this script and cannot be passed after --`);
  }
  return options;
}

function parsePort(value) {
  if (value === undefined || !/^\d+$/u.test(value)) throw new UsageError("--port requires an integer");
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
    throw new UsageError("--port must be 1-65535; the tunnel needs a fixed origin port");
  return port;
}

function requireValue(key, value) {
  if (value === undefined || value === "") throw new UsageError(`${key} requires a value`);
  return value;
}

/** Resolves the tunnel binary and proves it runs before anything is published. */
function resolveCloudflared(explicit) {
  const command = explicit ?? process.env.CLOUDFLARED ?? "cloudflared";
  const probe = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (probe.error?.code === "ENOENT")
    throw new Error(
      `${command} is not executable; install cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) or pass --cloudflared=<path>`,
    );
  if (probe.error !== undefined) throw new Error(`${command} could not be run: ${probe.error.message}`);
  if (probe.status !== 0) throw new Error(`${command} --version exited ${String(probe.status)}`);
  const version = `${probe.stdout}${probe.stderr}`.trim().split("\n")[0];
  return { command, version: version === undefined || version === "" ? command : version };
}

/** Fails closed on a busy port instead of letting the server hit EADDRINUSE. */
async function assertPortFree(port) {
  const probe = createServer();
  try {
    await new Promise((resolvePromise, reject) => {
      const onError = (error) => reject(error);
      probe.once("error", onError);
      probe.listen(port, LISTEN_HOST, () => {
        probe.off("error", onError);
        resolvePromise();
      });
    });
  } catch (error) {
    if (error?.code === "EADDRINUSE")
      throw new Error(`${LISTEN_HOST}:${port} is already in use; stop that listener or pass --port=<n>`);
    throw error;
  } finally {
    await new Promise((resolvePromise) => probe.close(() => resolvePromise()));
  }
}

/** Starts the tunnel and resolves with the public URL cloudflared reports. */
function spawnTunnel(command, port) {
  const target = `http://${LISTEN_HOST}:${port}`;
  const child = spawn(command, ["tunnel", "--no-autoupdate", "--url", target], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let settled = false;
  let rateLimited = false;
  const url = new Promise((resolvePromise, rejectPromise) => {
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      handler(value);
    };
    const timer = setTimeout(
      () =>
        finish(
          rejectPromise,
          new Error(`cloudflared did not report a tunnel URL within ${TUNNEL_SETUP_TIMEOUT_MS / 1000}s`),
        ),
      TUNNEL_SETUP_TIMEOUT_MS,
    );
    const onExit = (code, signal) =>
      finish(rejectPromise, new Error(`cloudflared exited before creating a tunnel (${describeExit(code, signal)})`));
    child.once("exit", onExit);
    for (const stream of [child.stdout, child.stderr]) {
      createInterface({ input: stream, crlfDelay: Infinity }).on("line", (line) => {
        const text = line.trim();
        if (text === "") return;
        console.error(`[cloudflared] ${text}`);
        if (TUNNEL_RATE_LIMIT.test(text) && !rateLimited) {
          rateLimited = true;
          console.error(
            "remote-managed-tunnel: Cloudflare refused this source address a new quick tunnel; account-less tunnels are rate-limited, so retry later or publish with a named tunnel.",
          );
        }
        const match = TUNNEL_URL.exec(text);
        if (match !== null) finish(resolvePromise, match[0]);
      });
    }
  });
  return { child, url };
}

/** Waits for the readiness claim this script's own server instance wrote. */
async function waitForClaim(path, pid, publicBase) {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  let observed = "no claim";
  while (Date.now() < deadline) {
    const claim = readClaim(path);
    if (claim !== undefined) {
      if (claim.pid === pid && claim.stage === "ready" && claim.mode === "public" && claim.publicUrl === publicBase)
        return claim;
      observed = `pid ${String(claim.pid)}, stage ${String(claim.stage)}, mode ${String(claim.mode)}, publicUrl ${String(claim.publicUrl)}`;
    }
    await delay(50);
  }
  throw new Error(
    `the server did not publish its readiness claim within ${SERVER_READY_TIMEOUT_MS / 1000}s (${path} held ${observed})`,
  );
}

/**
 * Requires the public route to answer with this instance's identity: the health
 * route, the protected-resource metadata, and the MCP challenge a real client
 * sees first. A quick tunnel's DNS can lag its creation, so failures retry
 * until the deadline rather than failing on the first 502.
 */
async function verifyPublicRoute(publicBase, mcpUrl) {
  const deadline = Date.now() + ROUTE_VERIFY_TIMEOUT_MS;
  const hostname = new URL(publicBase).hostname;
  let last = "no attempt completed";
  let reportedAt = 0;
  while (Date.now() < deadline) {
    try {
      const health = await getJson(`${publicBase}/healthz`);
      if (health.mode !== "public") throw new Error(`health route reported mode ${String(health.mode)}`);
      if (health.public_endpoint !== mcpUrl)
        throw new Error(`health route advertised ${String(health.public_endpoint)} instead of ${mcpUrl}`);
      const metadata = await getJson(`${publicBase}/.well-known/oauth-protected-resource`);
      if (metadata.resource !== mcpUrl)
        throw new Error(`protected-resource metadata named ${String(metadata.resource)} instead of ${mcpUrl}`);
      const servers = Array.isArray(metadata.authorization_servers) ? metadata.authorization_servers : [];
      if (!servers.includes(publicBase))
        throw new Error("protected-resource metadata omitted this tunnel as the authorization server");
      const challenge = await fetch(mcpUrl, {
        headers: { accept: "application/json, text/event-stream" },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (challenge.status !== 401)
        throw new Error(`an unauthenticated MCP request returned ${challenge.status} instead of 401`);
      const header = challenge.headers.get("www-authenticate") ?? "";
      if (!header.includes("resource_metadata") || !header.includes(hostname))
        throw new Error("the MCP challenge did not advertise this tunnel as the protected resource");
      return;
    } catch (error) {
      last = message(error);
      if (Date.now() - reportedAt > 10_000) {
        console.error(`remote-managed-tunnel: waiting for the public route: ${last}`);
        reportedAt = Date.now();
      }
      await delay(1_000);
    }
  }
  throw new Error(
    `the public route did not answer with this instance's identity within ${ROUTE_VERIFY_TIMEOUT_MS / 1000}s (last failure: ${last})`,
  );
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return await response.json();
}

function readClaim(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed !== null && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Removes a claim only when it is this run's own and its process is gone. A
 * forced stop can leave the file behind; a live instance's claim is never
 * touched, and the next start overwrites whatever remains.
 */
function removeStaleClaim(path, pid) {
  if (typeof pid !== "number") return;
  const claim = readClaim(path);
  if (claim?.pid !== pid || isAlive(pid)) return;
  try {
    rmSync(path, { force: true });
  } catch {
    // Leaving the file is safe: the next start replaces the claim atomically.
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function signalChild(child, signal) {
  // The primary signal targets the process so its own orderly shutdown runs; a
  // forced kill takes the whole group so managed bash processes cannot outlive
  // the server that owns them.
  const targets = signal === "SIGKILL" && child.pid !== undefined ? [-child.pid, child.pid] : [child.pid];
  for (const target of targets) {
    try {
      process.kill(target, signal);
      return;
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
}

async function stopChild(child, signal, graceMs) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = waitForChildExit(child, graceMs);
  signalChild(child, signal);
  if (await exited) return;
  signalChild(child, "SIGKILL");
  await waitForChildExit(child, FORCE_KILL_GRACE_MS);
}

function waitForChildExit(child, timeout) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => resolvePromise(false), timeout);
    child.once("exit", () => {
      clearTimeout(timer);
      resolvePromise(true);
    });
  });
}

function describeExit(code, signal) {
  return signal === null || signal === undefined ? `exit code ${String(code)}` : `signal ${String(signal)}`;
}

function describeChildExit(name, code, signal) {
  return new Error(`${name} exited on its own (${describeExit(code, signal)}); the public route is gone`);
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function reportReady({ publicBase, mcpUrl, readyFile, claim, serverPid }) {
  console.log("remote-managed-tunnel: the public route answered with this instance's own OAuth identity");
  console.log(`remote-managed-tunnel:   MCP URL   ${mcpUrl}`);
  console.log(`remote-managed-tunnel:   issuer    ${publicBase}`);
  console.log(`remote-managed-tunnel:   server    pid ${String(serverPid)}, instance ${String(claim.serverInstanceId)}`);
  console.log(`remote-managed-tunnel:   readiness ${readyFile}`);
  console.log("remote-managed-tunnel: point the client at the MCP URL with OAuth. When the client opens the");
  console.log("remote-managed-tunnel: consent page, enter the startup secret the server printed above (once).");
  console.log(
    "remote-managed-tunnel: Ctrl+C retires the server before the tunnel; the URL and every credential expire with this run.",
  );
}

async function run(options) {
  if (!existsSync(SERVER_ENTRY)) {
    console.error(`remote-managed-tunnel: ${SERVER_ENTRY} is missing; build the server first:`);
    console.error("remote-managed-tunnel: yarn workspace @goodfoot/remote-managed-shell run build");
    return 1;
  }
  let cloudflared;
  try {
    cloudflared = resolveCloudflared(options.cloudflared);
    await assertPortFree(options.port);
  } catch (error) {
    console.error(`remote-managed-tunnel: ${message(error)}`);
    return 1;
  }

  const readyFile =
    options.readyFile ?? join(tmpdir(), "remote-managed-shell", `ready-public-${String(options.port)}.json`);
  const state = { stopping: false, tunnel: undefined, server: undefined, serverPid: undefined };

  // One stop channel for both a signal from the operator and a child that dies
  // on its own; `step` turns control leaving it into a Halted error caught once.
  let halt;
  const halted = new Promise((resolvePromise) => {
    halt = resolvePromise;
  });
  const step = (work) =>
    Promise.race([
      work,
      halted.then((outcome) => {
        throw new Halted(outcome);
      }),
    ]);
  const onSignal = (signal) => {
    if (state.stopping) {
      // A second signal abandons the orderly stop for an immediate one.
      if (state.server !== undefined) signalChild(state.server, "SIGKILL");
      if (state.tunnel !== undefined) signalChild(state.tunnel, "SIGKILL");
      return;
    }
    halt({ kind: "signal", signal });
  };
  const onSigint = () => onSignal("SIGINT");
  const onSigterm = () => onSignal("SIGTERM");
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);

  const stopEverything = async () => {
    state.stopping = true;
    // Server first: its orderly shutdown terminates managed work and removes
    // the readiness claim it owns.
    if (state.server !== undefined) await stopChild(state.server, "SIGINT", SERVER_STOP_GRACE_MS);
    if (state.tunnel !== undefined) await stopChild(state.tunnel, "SIGINT", TUNNEL_STOP_GRACE_MS);
    removeStaleClaim(readyFile, state.serverPid);
  };
  const conclude = async (outcome) => {
    await stopEverything();
    if (outcome.kind === "signal") {
      console.log(
        `remote-managed-tunnel: received ${outcome.signal}; the server retired its claim and the tunnel is closed`,
      );
      return 0;
    }
    console.error(`remote-managed-tunnel: ${message(outcome.error)}`);
    return 1;
  };

  try {
    console.log(`remote-managed-tunnel: ${cloudflared.version}`);
    console.log(`remote-managed-tunnel: requesting an Instant Tunnel for http://${LISTEN_HOST}:${options.port}`);
    const tunnel = spawnTunnel(cloudflared.command, options.port);
    state.tunnel = tunnel.child;
    tunnel.child.on("exit", (code, signal) =>
      halt({ kind: "failure", error: describeChildExit("cloudflared", code, signal) }),
    );

    const publicBase = await step(tunnel.url);
    const mcpUrl = `${publicBase}/mcp`;
    console.log(`remote-managed-tunnel: tunnel established at ${publicBase}`);
    console.log("remote-managed-tunnel: starting the server in public mode; its secret and authorization URL follow");

    const server = spawn(
      process.execPath,
      [
        SERVER_ENTRY,
        "--mode=public",
        `--url=${publicBase}`,
        `--port=${String(options.port)}`,
        `--ready-file=${readyFile}`,
        ...options.serverArgs,
      ],
      { cwd: PACKAGE_ROOT, stdio: ["ignore", "inherit", "inherit"], detached: true },
    );
    state.server = server;
    state.serverPid = server.pid;
    server.on("exit", (code, signal) =>
      halt({ kind: "failure", error: describeChildExit("the server", code, signal) }),
    );

    const claim = await step(waitForClaim(readyFile, server.pid, publicBase));
    await step(verifyPublicRoute(publicBase, mcpUrl));
    reportReady({ publicBase, mcpUrl, readyFile, claim, serverPid: server.pid });

    return await conclude(await halted);
  } catch (error) {
    return await conclude(error instanceof Halted ? error.outcome : { kind: "failure", error });
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  }
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageRequested) {
      console.log(USAGE);
      return 0;
    }
    if (error instanceof UsageError) {
      console.error(`remote-managed-tunnel: ${error.message}\n`);
      console.error(USAGE);
      return 2;
    }
    throw error;
  }
  return await run(options);
}

await main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(`remote-managed-tunnel: failed: ${message(error)}`);
    process.exitCode = 1;
  },
);
