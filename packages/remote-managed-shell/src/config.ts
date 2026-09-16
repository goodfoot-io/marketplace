/**
 * Command-line configuration for the server process.
 *
 * Both startup modes share one composition root (see `serve.ts`). The mode
 * chooses only where the server says it is reachable: `local` is confined to
 * loopback and makes no external connection, `public` advertises an
 * operator-supplied URL that this process never creates, probes, or supervises.
 * Routes, tools, and transport behavior are identical in both modes.
 */

/** Default listen port. Fixed so local development and smoke tests are predictable. */
export const DEFAULT_PORT = 38147;

/** The loopback address the server actually listens on, in both modes. */
export const LISTEN_HOST = "127.0.0.1";

/** The single HTTP route serving MCP traffic. */
export const MCP_PATH = "/mcp";

export type ServerMode = "local" | "public";

export interface ServerConfig {
  readonly mode: ServerMode;
  /** Port the server listens on; `0` asks the OS for an ephemeral port. */
  readonly port: number;
  /** Operator-supplied public URL; present only in `public` mode. */
  readonly publicUrl?: string;
  /** Path of the readiness file, when one is requested. */
  readonly readyFile?: string;
}

/** A usage error: the arguments cannot describe a runnable server. */
export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

/** Signals that the caller asked for usage text rather than a server. */
export class UsageRequested extends Error {
  override readonly name = "UsageRequested";
}

export const USAGE = `Usage: remote-managed-shell [--mode=local|public] [options]

  --mode=local            Listen on loopback only (default). No external connection.
  --mode=public           Advertise the operator-supplied URL given by --url.
  --url=<https-url>       Public URL this server is reachable at. Required for
                          public mode, rejected for local mode. Must be https and
                          must not name a loopback host.
  --port=<0-65535>        Listen port (default ${DEFAULT_PORT}; 0 picks a free port).
  --ready-file=<path>     Write an atomic readiness file once the port is bound.
  --help                  Print this message.`;

/**
 * Parses command-line arguments into a validated configuration.
 *
 * Unknown arguments and malformed values are failures rather than warnings: a
 * server started with an argument it did not understand is not the server the
 * operator asked for.
 *
 * @param argv - Arguments after the script path, e.g. `process.argv.slice(2)`.
 * @returns The validated configuration.
 * @throws ConfigError when an argument is unknown or invalid.
 */
export function parseArgs(argv: readonly string[]): ServerConfig {
  let mode: ServerMode = "local";
  let port = DEFAULT_PORT;
  let publicUrl: string | undefined;
  let readyFile: string | undefined;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      throw new UsageRequested();
    }
    const [flag, value] = splitFlag(arg);
    switch (flag) {
      case "--mode":
        if (value !== "local" && value !== "public") {
          throw new ConfigError(`--mode must be "local" or "public", got ${String(value)}`);
        }
        mode = value;
        break;
      case "--port":
        port = parsePort(value);
        break;
      case "--url":
        publicUrl = parsePublicUrl(value);
        break;
      case "--ready-file":
        if (value === undefined || value.length === 0) {
          throw new ConfigError("--ready-file requires a path");
        }
        readyFile = value;
        break;
      default:
        throw new ConfigError(`Unknown argument: ${arg}`);
    }
  }

  if (mode === "public" && publicUrl === undefined) {
    throw new ConfigError("--mode=public requires --url=<https-url>");
  }
  if (mode === "local" && publicUrl !== undefined) {
    throw new ConfigError("--url is only valid with --mode=public; local mode is loopback only");
  }

  const config: ServerConfig = {
    mode,
    port,
    ...(publicUrl === undefined ? {} : { publicUrl }),
    ...(readyFile === undefined ? {} : { readyFile }),
  };
  return config;
}

function splitFlag(arg: string): [string, string | undefined] {
  const separator = arg.indexOf("=");
  if (separator === -1) {
    return [arg, undefined];
  }
  return [arg.slice(0, separator), arg.slice(separator + 1)];
}

function parsePort(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new ConfigError(`--port must be an integer, got ${String(value)}`);
  }
  const port = Number(value);
  if (port > 65535) {
    throw new ConfigError(`--port must be 0-65535, got ${value}`);
  }
  return port;
}

function parsePublicUrl(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new ConfigError("--url requires a URL");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(`--url is not a valid absolute URL: ${value}`);
  }
  if (url.protocol !== "https:") {
    throw new ConfigError(`--url must use https, got ${url.protocol}`);
  }
  if (isLoopbackHostname(url.hostname)) {
    throw new ConfigError(`--url must not name a loopback host: ${url.hostname}`);
  }
  return url.href;
}

/**
 * Whether a URL hostname names this machine.
 *
 * Covers the names and literals that reach the local host: `localhost` and its
 * subdomains, any `127.0.0.0/8` address, IPv6 `::1`, and the unspecified
 * addresses that bind every interface. Used to keep a public URL from claiming
 * to be the loopback-only local mode.
 *
 * @param hostname - URL hostname, optionally bracketed for IPv6.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const bare = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  const lower = bare.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) {
    return true;
  }
  if (lower === "::1" || lower === "::" || lower === "0.0.0.0") {
    return true;
  }
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower);
}
