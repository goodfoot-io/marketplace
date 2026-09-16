import { isIP } from "node:net";
import { resolve } from "node:path";

export const DEFAULT_PORT = 38147;
export const LISTEN_HOST = "127.0.0.1";
export const MCP_PATH = "/mcp";
export type ServerMode = "local" | "public";

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
  authClients: number;
  authPending: number;
  authCodes: number;
  authAccessTokens: number;
  authRefreshTokens: number;
  authCodeTtlMs: number;
  authAccessTtlMs: number;
  authRefreshTtlMs: number;
  authFetchTimeoutMs: number;
  authDocumentBytes: number;
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
  operationIds: 10_000,
  writesPerSession: 10_000,
  inputBytes: 65_536,
  termGraceMs: 2_000,
  killGraceMs: 1_500,
  shutdownMs: 10_000,
  loggerBytes: 8_388_608,
  loggerRecords: 8_192,
  authClients: 32,
  authPending: 64,
  authCodes: 32,
  authAccessTokens: 64,
  authRefreshTokens: 64,
  authCodeTtlMs: 60_000,
  authAccessTtlMs: 900_000,
  authRefreshTtlMs: 86_400_000,
  authFetchTimeoutMs: 3_000,
  authDocumentBytes: 65_536,
  diskPerSession: 268_435_456,
  diskGlobal: 2_147_483_648,
  segmentBytes: 1_048_576,
  segmentEvents: 256,
  segments: 1024,
  spoolQueueBytes: 4_194_304,
  spoolQueueEntries: 256,
});

export interface ServerConfig {
  mode: ServerMode;
  port: number;
  publicUrl?: string;
  readyFile?: string;
  bash?: string;
  workdir?: string;
  spoolRoot?: string;
  disablePty?: boolean;
  limits?: Limits;
}

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}
export class UsageRequested extends Error {
  override readonly name = "UsageRequested";
}

export const USAGE = `Usage: remote-managed-shell [--mode=local|public] [options]

  --mode=local            Loopback-only mode (default); --url is forbidden.
  --mode=public           Advertise the operator-owned HTTPS URL from --url.
  --url=<https-url>       Required in public mode; no query, fragment, credentials,
                          loopback, or special-use IP address.
  --port=<0-65535>        Loopback listen port (default ${DEFAULT_PORT}; 0 is ephemeral).
  --ready-file=<path>     Atomic readiness-file location.
  --bash=<path>           Bash executable (default /bin/bash).
  --workdir=<path>        Default command working directory.
  --max-wait-ms=<0-20000> Maximum observation wait for this validated profile.
  --disable-pty           Refuse tty:true starts even when node-pty is installed.
  --help                  Print this message.`;

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
    "--mode",
    "--url",
    "--port",
    "--ready-file",
    "--bash",
    "--workdir",
    "--spool-dir",
    "--max-wait-ms",
    "--disable-pty",
  ]);
  for (const key of values.keys()) if (!allowed.has(key)) throw new ConfigError(`Unknown option: ${key}`);
  const mode = values.get("--mode") ?? "local";
  if (mode !== "local" && mode !== "public") throw new ConfigError(`--mode must be local or public, got ${mode}`);
  const rawUrl = values.get("--url");
  if (mode === "local" && rawUrl !== undefined) throw new ConfigError("--url is forbidden in local mode");
  if (mode === "public" && rawUrl === undefined) throw new ConfigError("--mode=public requires --url");
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
  return {
    mode,
    port,
    ...(rawUrl === undefined ? {} : { publicUrl: normalizePublicUrl(rawUrl) }),
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

export function normalizePublicUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ConfigError("--url must be an absolute HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new ConfigError("--url must be HTTPS without credentials, query, or fragment");
  }
  url.pathname = url.pathname.replace(/\/+$/u, "");
  if (isLocalOrSpecialHostname(url.hostname))
    throw new ConfigError(`--url must name a public host, got ${url.hostname}`);
  return url.href.replace(/\/$/u, "");
}

export function isLocalOrSpecialHostname(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (bare === "localhost" || bare.endsWith(".localhost") || bare === "0.0.0.0" || bare === "::" || bare === "::1")
    return true;
  const family = isIP(bare);
  if (family === 4) {
    const [a = 0, b = 0] = bare.split(".").map(Number);
    const value =
      ((a * 256 + b) * 256 + (bare.split(".")[2] ? Number(bare.split(".")[2]) : 0)) * 256 +
      Number(bare.split(".")[3] ?? 0);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 2 || b === 168)) ||
      (value >= 0xc0586300 && value <= 0xc05863ff) ||
      (a === 198 && b >= 18 && b <= 19) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }
  if (family === 6) {
    const value = ipv6ToBigInt(bare);
    if (value === null) return false;
    const firstByte = Number(value >> 120n);
    if (
      value === 0n ||
      value === 1n ||
      firstByte === 0xff ||
      (firstByte & 0xfe) === 0xfc ||
      (firstByte === 0xfe && (Number((value >> 112n) & 0xffn) & 0xc0) === 0x80)
    )
      return true;
    // Documentation, benchmarking, protocol-assignment, and discard-only ranges.
    if (
      inIpv6Range(value, "20010db8000000000000000000000000", "20010db8ffffffffffffffffffffffff") ||
      inIpv6Range(value, "20010002000000000000000000000000", "20010002ffffffffffffffffffffffff") ||
      inIpv6Range(value, "00000000000001000000000000000000", "0000000000000100ffffffffffffffff")
    )
      return true;
    const mapped = Number((value >> 32n) & 0xffffffffn) === 0xffff;
    const compatible = value >> 32n === 0n;
    const sixToFour = Number(value >> 112n) === 0x2002;
    const embedded = Number((sixToFour ? value >> 80n : value) & 0xffffffffn);
    return (
      (mapped || compatible || sixToFour) &&
      isLocalOrSpecialHostname(
        `${embedded >>> 24}.${(embedded >>> 16) & 255}.${(embedded >>> 8) & 255}.${embedded & 255}`,
      )
    );
  }
  return false;
}

function ipv6ToBigInt(value: string): bigint | null {
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (left.some((part) => !/^[0-9a-f]{1,4}$/u.test(part)) || right.some((part) => !/^[0-9a-f]{1,4}$/u.test(part)))
    return null;
  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && left.length + right.length >= 8) return null;
  const parts = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  return parts.reduce((result, part) => (result << 16n) | BigInt(Number.parseInt(part, 16)), 0n);
}

function inIpv6Range(value: bigint, start: string, end: string): boolean {
  return value >= BigInt(`0x${start}`) && value <= BigInt(`0x${end}`);
}

/** Backwards-compatible name retained for callers of the prepared skeleton. */
export const isLoopbackHostname = isLocalOrSpecialHostname;

export function advertisedBase(config: ServerConfig, boundPort: number): string {
  return config.publicUrl ?? `http://${LISTEN_HOST}:${boundPort}`;
}
