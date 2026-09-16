#!/usr/bin/env node
/**
 * Starts the built server on loopback and holds it behind an OpenAI Secure MCP
 * Tunnel: one `tunnel-client run` child polling the operator's tunnel with their
 * runtime key and forwarding connector traffic to this server's `/mcp` route.
 *
 * Nothing forces an ordering between the two children. The server has no
 * external identity to configure — it advertises no URL, serves no discovery
 * document, and issues no challenge — so the server starts first only because
 * tunnel-client's startup MCP probe is one-shot: a client that probed before the
 * listener existed would latch a connection failure into `/readyz` forever
 * instead of retrying it.
 *
 * Startup is fail-closed. The script refuses to run without the build, the
 * tunnel-client binary, a tunnel id, a key reference, and a free loopback port;
 * after both children are up it requires the server's own readiness claim and
 * tunnel-client's `/readyz`, which turns green only when that client's MCP
 * initialize probe reached this server. A child that exits on its own takes the
 * whole arrangement down with a non-zero status, and an orderly stop always
 * retires the server before the tunnel so the server can remove the readiness
 * claim it owns.
 *
 * The runtime key is never handled as a value here: it reaches tunnel-client as
 * the `env:VARNAME` or `file:/path` reference that CLI requires, so no key ever
 * appears in this process's command line. Nothing local can prove that an
 * OpenAI-side caller reached the shell — a healthy client only proves the hop
 * this host owns.
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
/** The control plane tunnel-client polls; its own default, restated for the report. */
const DEFAULT_BASE_URL = "https://api.openai.com";
/** Port 0 lets the OS pick; the URL file below reports what it picked. */
const HEALTH_LISTEN_ADDR = "127.0.0.1:0";
/** A tunnel id is `tunnel_` plus 32 lowercase alphanumerics; tunnel-client owns the exact check. */
const TUNNEL_ID_PREFIX = "tunnel_";
/** The only two forms `--control-plane.api-key` accepts. */
const KEY_REFERENCE_PREFIXES = ["env:", "file:"];
const TUNNEL_HEALTH_TIMEOUT_MS = 30_000;
const READY_TIMEOUT_MS = 60_000;
const SERVER_READY_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 10_000;
/** The server's own shutdown budget is `shutdownMs` (10s) from src/config.ts. */
const SERVER_STOP_GRACE_MS = 12_000;
const TUNNEL_STOP_GRACE_MS = 8_000;
const FORCE_KILL_GRACE_MS = 2_000;
/** Options this script owns; passing them after `--` would be a silent conflict. */
const MANAGED_SERVER_OPTIONS = new Set(["--port", "--ready-file"]);

const USAGE = `Usage: start-tunnel.mjs [options] [-- server options]

Starts the built server on loopback behind an OpenAI Secure MCP Tunnel and
reports the endpoint only after the server published its readiness claim and
tunnel-client's MCP probe reached it.

  --port=<1-65535>        Loopback port the server binds and the tunnel
                          forwards to (default ${DEFAULT_PORT}).
  --ready-file=<path>     Atomic readiness-claim location (default: a
                          ready-<port>.json claim in the system temp
                          directory).
  --tunnel-client=<path>  tunnel-client executable (default: $TUNNEL_CLIENT,
                          then tunnel-client on PATH).
  --tunnel-id=<id>        Tunnel to serve (default: $CONTROL_PLANE_TUNNEL_ID).
                          Create one at
                          https://platform.openai.com/settings/organization/tunnels
  --api-key=<reference>   env:VARNAME or file:/path holding the runtime key,
                          never the key itself. Default: env:CONTROL_PLANE_API_KEY
                          when that variable is set, then env:OPENAI_API_KEY.
  -h, --help              Print this message.

  -- <options>            Pass the remaining options to the server, for example
                          -- --workdir=/srv --disable-pty. --port and
                          --ready-file belong to this script.

Environment: CONTROL_PLANE_TUNNEL_ID, CONTROL_PLANE_API_KEY, TUNNEL_CLIENT,
and CONTROL_PLANE_BASE_URL (default ${DEFAULT_BASE_URL}).`;

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
  const options = {
    port: DEFAULT_PORT,
    readyFile: undefined,
    tunnelClient: undefined,
    tunnelId: undefined,
    apiKey: undefined,
    serverArgs: [],
  };
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
    else if (key === "--tunnel-client") options.tunnelClient = requireValue(key, value);
    else if (key === "--tunnel-id") options.tunnelId = parseTunnelId(value);
    else if (key === "--api-key") options.apiKey = parseKeyReference(value);
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

/** A tunnel id is not a credential; the prefix check catches a pasted key. */
function parseTunnelId(value) {
  if (value === undefined || !value.startsWith(TUNNEL_ID_PREFIX))
    throw new UsageError(`--tunnel-id takes a tunnel id (${TUNNEL_ID_PREFIX}<32 lowercase letters or digits>)`);
  return value;
}

/** Only a reference crosses this command line; the key itself never does. */
function parseKeyReference(value) {
  const separator = value === undefined ? -1 : value.indexOf(":");
  const scheme = separator === -1 ? "" : `${value.slice(0, separator)}:`;
  const target = separator === -1 ? "" : value.slice(separator + 1);
  if (!KEY_REFERENCE_PREFIXES.includes(scheme) || target === "")
    throw new UsageError(
      "--api-key takes an env:VARNAME or file:/path reference, never the key itself; a literal key would be visible in the process list",
    );
  return value;
}

/** Resolves the tunnel client and proves it runs before anything is spawned. */
function resolveTunnelClient(explicit) {
  const command = explicit ?? process.env.TUNNEL_CLIENT ?? "tunnel-client";
  const probe = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (probe.error?.code === "ENOENT")
    throw new Error(
      `${command} is not executable; install tunnel-client (brew install openai/tools/tunnel-client, or the image at ghcr.io/openai/tunnel-client) or pass --tunnel-client=<path>`,
    );
  if (probe.error !== undefined) throw new Error(`${command} could not be run: ${probe.error.message}`);
  if (probe.status !== 0) throw new Error(`${command} --version exited ${String(probe.status)}`);
  const version = `${probe.stdout}${probe.stderr}`.trim().split("\n")[0];
  return { command, version: version === undefined || version === "" ? command : version };
}

/** Names the tunnel to serve; the id itself is not a credential. */
function resolveTunnelId(explicit) {
  const id = explicit ?? process.env.CONTROL_PLANE_TUNNEL_ID;
  if (id === undefined || id === "")
    throw new Error(
      "no tunnel to serve: set CONTROL_PLANE_TUNNEL_ID or pass --tunnel-id=<id>; create one at https://platform.openai.com/settings/organization/tunnels",
    );
  return id;
}

/**
 * Resolves a key *reference* for tunnel-client and proves it points at
 * something. The key itself is deliberately never read: it stays in the
 * environment or in the file, and only the reference crosses this process's
 * command line.
 */
function resolveApiKeyReference(explicit) {
  const reference = explicit ?? defaultKeyReference();
  if (reference === undefined)
    throw new Error(
      "no runtime key reference: set CONTROL_PLANE_API_KEY, or pass --api-key=env:<VARNAME> or --api-key=file:/path/to/secret",
    );
  const target = reference.slice(reference.indexOf(":") + 1);
  if (reference.startsWith("env:")) {
    const value = process.env[target];
    if (value === undefined || value === "")
      throw new Error(`--api-key=env:${target} names a variable that is not set to a non-empty value`);
  } else if (!existsSync(target)) {
    throw new Error(`--api-key=file:${target} does not exist`);
  }
  return reference;
}

function defaultKeyReference() {
  for (const name of ["CONTROL_PLANE_API_KEY", "OPENAI_API_KEY"]) {
    const value = process.env[name];
    if (value !== undefined && value !== "") return `env:${name}`;
  }
  return undefined;
}

/** The control plane the client polls; the tunnel's MCP endpoint hangs off it. */
function resolveBaseUrl() {
  const raw = process.env.CONTROL_PLANE_BASE_URL;
  const base = raw === undefined || raw === "" ? DEFAULT_BASE_URL : raw;
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(`CONTROL_PLANE_BASE_URL is not a URL: ${base}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    throw new Error(`CONTROL_PLANE_BASE_URL must be http or https: ${base}`);
  return parsed.href.replace(/\/+$/u, "");
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

/** Starts tunnel-client against the loopback route and streams its log. */
function spawnTunnelClient({ command, port, tunnelId, apiKeyReference, baseUrl, healthUrlFile }) {
  const child = spawn(
    command,
    [
      "run",
      `--control-plane.tunnel-id=${tunnelId}`,
      `--control-plane.api-key=${apiKeyReference}`,
      `--control-plane.base-url=${baseUrl}`,
      `--mcp.server-url=http://${LISTEN_HOST}:${port}/mcp`,
      `--health.listen-addr=${HEALTH_LISTEN_ADDR}`,
      `--health.url-file=${healthUrlFile}`,
    ],
    { cwd: PACKAGE_ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream, crlfDelay: Infinity }).on("line", (line) => {
      const text = line.trim();
      if (text !== "") console.error(`[tunnel-client] ${text}`);
    });
  }
  return child;
}

/**
 * Waits for the health base URL tunnel-client writes atomically at startup. An
 * empty file means the write has not landed yet; a non-empty file that is not
 * an HTTP URL is final, because the client never writes a partial one.
 */
async function waitForHealthUrl(path) {
  const deadline = Date.now() + TUNNEL_HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const health = readHealthUrl(path);
    if (typeof health === "string" && health.startsWith("http://")) return health;
    if (health !== undefined) throw new Error(`${path} holds ${JSON.stringify(health)}, not an HTTP health URL`);
    await delay(50);
  }
  throw new Error(
    `tunnel-client did not publish its health URL within ${TUNNEL_HEALTH_TIMEOUT_MS / 1000}s (${path} was never written)`,
  );
}

/** Returns the URL, the unparsable content, or undefined while the write is pending. */
function readHealthUrl(path) {
  let text;
  try {
    text = readFileSync(path, "utf8").trim();
  } catch {
    return undefined;
  }
  if (text === "") return undefined;
  try {
    const parsed = new URL(text);
    if (parsed.protocol === "http:") return parsed.origin;
  } catch {
    // Reported as the raw content below.
  }
  return text;
}

/**
 * Requires tunnel-client's own readiness verdict. `/readyz` is green only after
 * its one-shot startup MCP initialize probe succeeded against this server, so a
 * non-200 body names the component that is not up yet.
 */
async function waitForReady(healthBase) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let last = "no attempt completed";
  let reportedAt = 0;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${healthBase}/readyz`, {
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = (await response.text()).trim();
      if (response.ok) return body === "" ? "ready" : body;
      last = `readyz returned ${response.status}${body === "" ? "" : `: ${body}`}`;
    } catch (error) {
      last = message(error);
    }
    if (Date.now() - reportedAt > 10_000) {
      console.error(`remote-managed-tunnel: waiting for tunnel-client readiness: ${last}`);
      reportedAt = Date.now();
    }
    await delay(500);
  }
  throw new Error(
    `tunnel-client did not report ready within ${READY_TIMEOUT_MS / 1000}s (last failure: ${last}); the tunnel cannot forward until its MCP probe passes`,
  );
}

/** Waits for the readiness claim this script's own server instance wrote. */
async function waitForClaim(path, pid, endpoint) {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  let observed = "no claim";
  while (Date.now() < deadline) {
    const claim = readClaim(path);
    if (claim !== undefined) {
      if (claim.pid === pid && claim.stage === "ready" && claim.endpoint === endpoint) return claim;
      observed = `pid ${String(claim.pid)}, stage ${String(claim.stage)}, endpoint ${String(claim.endpoint)}`;
    }
    await delay(50);
  }
  throw new Error(
    `the server did not publish its readiness claim within ${SERVER_READY_TIMEOUT_MS / 1000}s (${path} held ${observed})`,
  );
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
  if (child.pid === undefined) return;
  // The primary signal targets the process so its own orderly shutdown runs; a
  // forced kill takes the whole group so managed bash processes cannot outlive
  // the server that owns them.
  const targets = signal === "SIGKILL" ? [-child.pid, child.pid] : [child.pid];
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

function describeChildExit(name, consequence, code, signal) {
  return new Error(`${name} exited on its own (${describeExit(code, signal)}); ${consequence}`);
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function reportReady({ connectorUrl, tunnelId, healthBase, ready, readyFile, claim, serverPid, tunnelPid }) {
  console.log("remote-managed-tunnel: ready: the server published its claim and tunnel-client's MCP probe reached it");
  console.log(`remote-managed-tunnel:   connector ${connectorUrl}`);
  console.log(`remote-managed-tunnel:   tunnel    ${tunnelId}`);
  console.log(
    `remote-managed-tunnel:   server    pid ${String(serverPid)}, instance ${String(claim.serverInstanceId)}, ${String(claim.endpoint)}`,
  );
  console.log(`remote-managed-tunnel:   client    pid ${String(tunnelPid)}, health ${healthBase} (${ready})`);
  console.log(`remote-managed-tunnel:   readiness ${readyFile}`);
  console.log("remote-managed-tunnel: point the connector at that endpoint, or select the tunnel id in ChatGPT. This");
  console.log("remote-managed-tunnel: server serves no discovery document and issues no challenge, so the connector");
  console.log("remote-managed-tunnel: completes no authorization step. Nothing local proves an OpenAI-side caller");
  console.log("remote-managed-tunnel: reached this shell: a healthy client proves the hop this host owns.");
  console.log("remote-managed-tunnel: Ctrl+C retires the server before the tunnel; the tunnel id outlives the run.");
}

async function run(options) {
  if (!existsSync(SERVER_ENTRY)) {
    console.error(`remote-managed-tunnel: ${SERVER_ENTRY} is missing; build the server first:`);
    console.error("remote-managed-tunnel: yarn workspace @goodfoot/remote-managed-shell run build");
    return 1;
  }
  let tunnelClient;
  let tunnelId;
  let apiKeyReference;
  let baseUrl;
  try {
    tunnelClient = resolveTunnelClient(options.tunnelClient);
    tunnelId = resolveTunnelId(options.tunnelId);
    apiKeyReference = resolveApiKeyReference(options.apiKey);
    baseUrl = resolveBaseUrl();
    await assertPortFree(options.port);
  } catch (error) {
    console.error(`remote-managed-tunnel: ${message(error)}`);
    return 1;
  }

  const readyFile =
    options.readyFile ?? join(tmpdir(), "remote-managed-shell", `ready-${String(options.port)}.json`);
  const healthUrlFile = join(tmpdir(), "remote-managed-shell", `tunnel-health-${String(options.port)}.url`);
  const serverEndpoint = `http://${LISTEN_HOST}:${String(options.port)}/mcp`;
  const connectorUrl = `${baseUrl}/v1/mcp/${tunnelId}`;
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
    // the readiness claim it owns. The tunnel cannot admit work into a listener
    // that is already gone.
    if (state.server !== undefined) await stopChild(state.server, "SIGINT", SERVER_STOP_GRACE_MS);
    if (state.tunnel !== undefined) await stopChild(state.tunnel, "SIGINT", TUNNEL_STOP_GRACE_MS);
    removeStaleClaim(readyFile, state.serverPid);
    try {
      // tunnel-client removes this on its own orderly shutdown; a forced stop
      // can leave it behind, and the next start overwrites it either way.
      rmSync(healthUrlFile, { force: true });
    } catch {
      // Leaving the file is safe.
    }
  };
  const conclude = async (outcome) => {
    await stopEverything();
    if (outcome.kind === "signal") {
      console.log(
        `remote-managed-tunnel: received ${outcome.signal}; the server retired its claim and tunnel-client is closed`,
      );
      return 0;
    }
    console.error(`remote-managed-tunnel: ${message(outcome.error)}`);
    return 1;
  };

  try {
    // The server goes first: tunnel-client's startup probe runs once, so a
    // client that probed before this listener existed would never turn green.
    const server = spawn(
      process.execPath,
      [SERVER_ENTRY, `--port=${String(options.port)}`, `--ready-file=${readyFile}`, ...options.serverArgs],
      { cwd: PACKAGE_ROOT, stdio: ["ignore", "inherit", "inherit"], detached: true },
    );
    state.server = server;
    state.serverPid = server.pid;
    server.on("error", (error) => halt({ kind: "failure", error }));
    server.on("exit", (code, signal) =>
      halt({
        kind: "failure",
        error: describeChildExit(
          "the server",
          "the loopback listener the tunnel forwards to is gone",
          code,
          signal,
        ),
      }),
    );

    const claim = await step(waitForClaim(readyFile, server.pid, serverEndpoint));
    console.log(
      `remote-managed-tunnel: server ready at ${serverEndpoint} (instance ${String(claim.serverInstanceId)})`,
    );
    console.log(`remote-managed-tunnel: ${tunnelClient.version}`);
    console.log(`remote-managed-tunnel: starting tunnel-client for ${tunnelId}`);

    rmSync(healthUrlFile, { force: true });
    const tunnel = spawnTunnelClient({
      command: tunnelClient.command,
      port: options.port,
      tunnelId,
      apiKeyReference,
      baseUrl,
      healthUrlFile,
    });
    state.tunnel = tunnel;
    tunnel.on("error", (error) => halt({ kind: "failure", error }));
    tunnel.on("exit", (code, signal) =>
      halt({
        kind: "failure",
        error: describeChildExit("tunnel-client", "the tunnel is no longer being served", code, signal),
      }),
    );

    const healthBase = await step(waitForHealthUrl(healthUrlFile));
    const ready = await step(waitForReady(healthBase));
    reportReady({
      connectorUrl,
      tunnelId,
      healthBase,
      ready,
      readyFile,
      claim,
      serverPid: server.pid,
      tunnelPid: tunnel.pid,
    });

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
