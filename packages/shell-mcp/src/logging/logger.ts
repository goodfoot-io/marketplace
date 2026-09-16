import { closeSync, constants, fstatSync, openSync } from "node:fs";
import { resolve } from "node:path";
import { type ConsoleEvent, ConsoleRenderer } from "./console-renderer.js";
import { IsolatedSink, type LoggerHealth } from "./sink.js";

export type { LoggerHealth } from "./sink.js";
export type DiagnosticFields = Readonly<Record<string, string | number | boolean | null>>;

export interface Logger {
  log(kind: string, session: string, text: string, fields?: DiagnosticFields): void;
  display(event: ConsoleEvent): void;
  health(): LoggerHealth;
  close(timeoutMs: number): Promise<void>;
}

export interface LoggerOptions {
  logFile?: string;
  terminal?: boolean;
  color?: boolean;
}

/** Resolve at the entry point, before a launcher changes its child's cwd. */
export function resolveLogFile(value = process.env.SHELL_MCP_LOG, cwd = process.cwd()): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (value.includes("\0")) throw new Error("SHELL_MCP_LOG must be a file path without NUL characters");
  return resolve(cwd, value);
}

/** Open once at startup; never truncate, follow a symlink, or block on a FIFO. */
function openLogFile(path: string): number {
  let fd: number | undefined;
  try {
    fd = openSync(
      path,
      constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      0o600,
    );
    if (!fstatSync(fd).isFile()) throw new Error("destination must be a regular file");
    return fd;
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    throw new Error(`Cannot open SHELL_MCP_LOG ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * A human console and an optional JSONL diagnostic file, each with its own
 * isolated process and bounded queue. Neither sink can block process control or
 * the other sink. Process payloads belong to display(), never diagnostic logs.
 */
export class IsolatedLogger implements Logger {
  private readonly console: IsolatedSink;
  private readonly diagnostics: IsolatedSink | undefined;
  private readonly renderer: ConsoleRenderer;
  private closed = false;
  private serverInstanceId: string | undefined;

  constructor(byteLimit: number, recordLimit: number, options: LoggerOptions = {}) {
    const terminal = options.terminal ?? process.stdout.isTTY === true;
    const color = options.color ?? (terminal && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb");
    this.renderer = new ConsoleRenderer(terminal, color);
    // Validate the explicitly requested destination before starting any helpers.
    const fd = options.logFile === undefined ? undefined : openLogFile(options.logFile);
    this.console = new IsolatedSink(
      byteLimit,
      recordLimit,
      "inherit",
      (bytes, records) => `\n[shell-mcp: console output omitted: ${bytes} bytes in ${records} records]\n`,
      () => this.log("logger.failed", "server", "Console output is unavailable", { logger: "console", level: "error" }),
    );
    try {
      this.diagnostics =
        fd === undefined
          ? undefined
          : new IsolatedSink(
              byteLimit,
              recordLimit,
              fd,
              (bytes, records) =>
                this.record("logger.dropped", "server", "Diagnostic records omitted", {
                  logger: "diagnostics",
                  level: "warn",
                  bytes,
                  records,
                }),
              () => this.display({ type: "notice", text: "shell-mcp: diagnostic log failed; shell commands continue" }),
            );
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  }

  /** Gives diagnostic records a stable identity without adding console noise. */
  setServerInstanceId(id: string): void {
    this.serverInstanceId = id;
  }

  log(kind: string, session: string, text: string, fields: DiagnosticFields = {}): void {
    if (!this.closed) this.diagnostics?.enqueue(this.record(kind, session, text, fields));
  }

  display(event: ConsoleEvent): void {
    if (!this.closed) this.console.enqueue(this.renderer.render(event));
  }

  health(): LoggerHealth {
    const console = this.console.health();
    const file = this.diagnostics?.health();
    if (!file) return console;
    const states = [console.status, file.status];
    return {
      status: this.closed
        ? "closed"
        : states.includes("failed")
          ? "failed"
          : states.includes("lagging")
            ? "lagging"
            : "healthy",
      queued_bytes: console.queued_bytes + file.queued_bytes,
      queued_records: console.queued_records + file.queued_records,
      dropped_bytes: console.dropped_bytes + file.dropped_bytes,
      dropped_records: console.dropped_records + file.dropped_records,
      lag_ms: Math.max(console.lag_ms, file.lag_ms),
    };
  }

  async close(timeoutMs: number): Promise<void> {
    if (this.closed) return;
    this.console.enqueue(this.renderer.close());
    this.closed = true;
    await Promise.all([this.console.close(timeoutMs), this.diagnostics?.close(timeoutMs)]);
  }

  private record(kind: string, session: string, text: string, fields: DiagnosticFields): string {
    return `${JSON.stringify({
      ...fields,
      time: new Date().toISOString(),
      level: fields.level ?? "debug",
      logger: fields.logger ?? "process-manager",
      event: kind,
      serverInstanceId: this.serverInstanceId,
      sessionId: session === "server" ? undefined : session,
      message: text || undefined,
    })}\n`;
  }
}

export class NullLogger implements Logger {
  log(_kind: string, _session: string, _text: string, _fields?: DiagnosticFields): void {}
  display(_event: ConsoleEvent): void {}
  health(): LoggerHealth {
    return { status: "healthy", queued_bytes: 0, queued_records: 0, dropped_bytes: 0, dropped_records: 0, lag_ms: 0 };
  }
  async close(_timeoutMs: number): Promise<void> {}
}
