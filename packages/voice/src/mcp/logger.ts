/**
 * JSONL diagnostic logger for the voice MCP server.
 *
 * When `VOICE_SERVER_LOG_PATH` is set, controller events and errors are
 * appended as JSONL records. `transcript.delta` events are excluded (they are
 * high-frequency partial-transcript noise). When unset, the logger is a no-op.
 *
 * IMPORTANT: this never writes to stdout — stdout carries the MCP JSON-RPC
 * stream. Records go to the configured file; internal failures go to stderr.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface DiagnosticLogger {
  /** Append a controller-event record (skips `transcript.delta`). */
  logEvent(record: { seq: number; event: string; timestamp: string; data: unknown }): void;
  /** Append an error record. */
  logError(message: string, meta?: Record<string, unknown>): void;
}

const NOOP: DiagnosticLogger = {
  logEvent: () => {},
  logError: () => {},
};

/**
 * Creates a diagnostic logger that appends JSONL to `logPath`.
 *
 * @param logPath - Absolute log file path, or undefined to disable logging.
 * @returns A logger; a no-op logger when `logPath` is undefined.
 */
export function createDiagnosticLogger(logPath: string | undefined): DiagnosticLogger {
  if (logPath === undefined) return NOOP;

  mkdirSync(dirname(logPath), { recursive: true });

  function write(line: string): void {
    try {
      appendFileSync(logPath as string, line, "utf8");
    } catch (err: unknown) {
      process.stderr.write(`[voice-mcp] log write failed: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  return {
    logEvent: (record) => {
      if (record.event === "transcript.delta") return;
      write(`${JSON.stringify(record)}\n`);
    },
    logError: (message, meta) => {
      write(`${JSON.stringify({ kind: "error", timestamp: new Date().toISOString(), message, ...(meta ?? {}) })}\n`);
    },
  };
}
