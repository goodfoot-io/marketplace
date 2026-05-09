/**
 * Optional file logger. Active when VOICE_LOG_PATH is set.
 * Appends JSONL lines to that path. Failures are swallowed so logging
 * can never crash the caller.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const logPath = process.env["VOICE_LOG_PATH"];
let initialized = false;

function ensureDir(): void {
  if (initialized || logPath === undefined) return;
  try {
    mkdirSync(dirname(logPath), { recursive: true });
  } catch (err: unknown) {
    process.stderr.write(`voice log: mkdir failed: ${String(err)}\n`);
  }
  initialized = true;
}

export function isLogEnabled(): boolean {
  return logPath !== undefined && logPath.length > 0;
}

export function logLine(record: Record<string, unknown>): void {
  if (logPath === undefined || logPath.length === 0) return;
  ensureDir();
  try {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...record }) + "\n";
    appendFileSync(logPath, line, "utf8");
  } catch (err: unknown) {
    process.stderr.write(`voice log: append failed: ${String(err)}\n`);
  }
}

export function logEvent(source: string, event: string, data: unknown): void {
  if (event === "transcript.delta") return;
  logLine({ kind: "event", source, event, data: serialize(data) });
}

export function logError(source: string, context: string, err: unknown): void {
  logLine({
    kind: "error",
    source,
    context,
    error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
  });
}

/**
 * Mirror stdout and stderr writes from this process to VOICE_LOG_PATH.
 * Originals still go to the underlying terminal/pipe — the log file is
 * an additional sink. No-op if VOICE_LOG_PATH is unset.
 */
export function mirrorStdio(): void {
  if (logPath === undefined || logPath.length === 0) return;
  ensureDir();

  type WriteFn = (
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ) => boolean;

  const origStdout = process.stdout.write.bind(process.stdout) as WriteFn;
  const origStderr = process.stderr.write.bind(process.stderr) as WriteFn;

  const append = (chunk: string | Uint8Array): void => {
    try {
      const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      appendFileSync(logPath, text, "utf8");
    } catch (err: unknown) {
      origStderr(`voice log: mirror append failed: ${String(err)}\n`);
    }
  };

  const wrap = (orig: WriteFn): WriteFn => {
    return ((chunk, encodingOrCb, cb) => {
      append(chunk);
      return orig(chunk, encodingOrCb, cb);
    }) as WriteFn;
  };

  process.stdout.write = wrap(origStdout) as typeof process.stdout.write;
  process.stderr.write = wrap(origStderr) as typeof process.stderr.write;
}

function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}
