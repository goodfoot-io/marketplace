import { resolve } from "node:path";
import { resolveLogFile } from "./logging/logger.js";

export const DEFAULT_PORT = 38147;
export const LISTEN_HOST = "127.0.0.1";
export const MCP_PATH = "/mcp";
export const OPERATION_ID_CAPACITY = 64;

export interface Limits {
  activeSessions: number;
  maxWaitMs: number;
  outputBytes: number;
  outputEvents: number;
  memoryPerSession: number;
  operationIds: number;
  writesPerSession: number;
  inputBytes: number;
  termGraceMs: number;
  killGraceMs: number;
  shutdownMs: number;
  loggerBytes: number;
  loggerRecords: number;
  diskPerSession: number;
  diskGlobal: number;
  segmentBytes: number;
  segmentEvents: number;
  segments: number;
  spoolQueueBytes: number;
  spoolQueueEntries: number;
}

export const DEFAULT_LIMITS: Limits = Object.freeze({
  activeSessions: 32,
  maxWaitMs: 20_000,
  outputBytes: 16_384,
  outputEvents: 128,
  memoryPerSession: 1_048_576,
  operationIds: OPERATION_ID_CAPACITY,
  writesPerSession: 10_000,
  inputBytes: 65_536,
  termGraceMs: 2_000,
  killGraceMs: 1_500,
  shutdownMs: 10_000,
  loggerBytes: 8_388_608,
  loggerRecords: 8_192,
  diskPerSession: 268_435_456,
  diskGlobal: 2_147_483_648,
  segmentBytes: 1_048_576,
  segmentEvents: 256,
  segments: 1024,
  spoolQueueBytes: 4_194_304,
  spoolQueueEntries: 256,
});

export interface ServerConfig {
  port: number;
  readyFile?: string;
  bash?: string;
  workdir?: string;
  spoolRoot?: string;
  logFile?: string;
  disablePty?: boolean;
  limits?: Limits;
}

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}
export class UsageRequested extends Error {
  override readonly name = "UsageRequested";
}

export const USAGE = `Usage: shell-mcp [options]
       shell-mcp openai [options]

  openai                  Run under an OpenAI Secure MCP Tunnel: the server and
                          the tunnel client are supervised as one unit. Options
                          after it go to the launcher, whose own --help lists
                          them.

  --port=<0-65535>        Loopback listen port (default ${DEFAULT_PORT}; 0 is ephemeral).
  --ready-file=<path>     Atomic readiness-file location.
  --bash=<path>           Bash executable (default /bin/bash).
  --workdir=<path>        Default command working directory.
  --spool-dir=<path>      Session transcript spool directory (default: a fresh
                          per-instance directory under the system temp directory).
  --max-wait-ms=<0-20000> Maximum observation wait for this validated profile.
  --disable-pty           Refuse tty:true starts even when node-pty is installed.
  --help                  Print this message.

Environment:
  SHELL_MCP_LOG=<path>     Append JSONL diagnostics to a file; unset/empty disables it.
  NO_COLOR                Disable console colors.`;

export function parseArgs(argv: readonly string[]): ServerConfig {
  const values = new Map<string, string>();
  for (const argument of argv) {
    if (argument === "--help" || argument === "-h") throw new UsageRequested();
    const separator = argument.indexOf("=");
    const key = separator === -1 ? argument : argument.slice(0, separator);
    const value = separator === -1 ? "true" : argument.slice(separator + 1);
    if (!key.startsWith("--")) throw new ConfigError(`Unknown argument: ${argument}`);
    if (values.has(key)) throw new ConfigError(`Repeated option: ${key}`);
    values.set(key, value);
  }
  const allowed = new Set([
    "--port",
    "--ready-file",
    "--bash",
    "--workdir",
    "--spool-dir",
    "--max-wait-ms",
    "--disable-pty",
  ]);
  for (const key of values.keys()) if (!allowed.has(key)) throw new ConfigError(`Unknown option: ${key}`);
  const port = parseInteger(values.get("--port") ?? String(DEFAULT_PORT), "--port", 0, 65_535);
  const maxWaitMs = parseInteger(
    values.get("--max-wait-ms") ?? String(DEFAULT_LIMITS.maxWaitMs),
    "--max-wait-ms",
    0,
    20_000,
  );
  const readyFile = values.get("--ready-file");
  if (readyFile === "") throw new ConfigError("--ready-file requires a path");
  const bash = values.get("--bash") ?? "/bin/bash";
  if (bash.length === 0) throw new ConfigError("--bash requires a path");
  const workdir = values.get("--workdir") ?? process.cwd();
  if (workdir.length === 0) throw new ConfigError("--workdir requires a path");
  const spoolDirectory = values.get("--spool-dir");
  const logFile = resolveLogFile();
  return {
    port,
    ...(logFile === undefined ? {} : { logFile }),
    ...(readyFile === undefined ? {} : { readyFile: resolve(readyFile) }),
    bash,
    workdir: resolve(workdir),
    ...(spoolDirectory === undefined ? {} : { spoolRoot: resolve(spoolDirectory) }),
    disablePty: values.has("--disable-pty"),
    limits: { ...DEFAULT_LIMITS, maxWaitMs },
  };
}

function parseInteger(value: string, name: string, minimum: number, maximum: number): number {
  if (!/^\d+$/u.test(value)) throw new ConfigError(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new ConfigError(`${name} must be ${minimum}-${maximum}`);
  return parsed;
}
