import type { ChildProcess } from "node:child_process";
import type { DiagnosticFields, Logger } from "./logger.js";

type Record =
  | { type: "diagnostic"; event: string; text: string; fields: DiagnosticFields }
  | { type: "notice"; text: string };

interface Pending {
  record: Record;
  bytes: number;
}

/**
 * The supervised server owns the only log-file writer. The launcher forwards
 * diagnostics through a finite, acknowledged queue, never an unbounded pipe or
 * a second append writer. Lifecycle notices still work with file logging off.
 */
export class LauncherRelay {
  private readonly queue: Pending[] = [];
  private inFlight: Pending | undefined;
  private bytes = 0;
  private dropped = 0;
  private closed = false;
  private readonly acknowledge = (value: unknown): void => {
    if (!value || typeof value !== "object" || !("shellMcpLogAck" in value) || value.shellMcpLogAck !== true) return;
    if (this.inFlight) this.bytes -= this.inFlight.bytes;
    this.inFlight = undefined;
    this.pump();
  };

  constructor(
    private readonly child: ChildProcess,
    private readonly diagnostics: boolean,
    private readonly byteLimit = 262_144,
    private readonly recordLimit = 256,
  ) {
    child.on("message", this.acknowledge);
    child.once("exit", () => this.close());
  }

  log(event: string, text: string, fields: DiagnosticFields = {}): void {
    if (this.diagnostics) this.enqueue({ type: "diagnostic", event, text, fields });
  }

  notice(text: string): void {
    this.enqueue({ type: "notice", text });
  }

  close(): void {
    this.closed = true;
    this.child.off("message", this.acknowledge);
    this.queue.length = 0;
    this.bytes = 0;
    this.inFlight = undefined;
  }

  private enqueue(record: Record): void {
    const bytes = Buffer.byteLength(JSON.stringify(record), "utf8");
    if (
      this.closed ||
      bytes > 65_536 ||
      this.bytes + bytes > this.byteLimit ||
      this.queue.length + (this.inFlight ? 1 : 0) >= this.recordLimit
    ) {
      this.dropped++;
      return;
    }
    this.bytes += bytes;
    this.queue.push({ record, bytes });
    this.pump();
  }

  private pump(): void {
    if (this.closed || this.inFlight || !this.child.connected) return;
    let next = this.queue.shift();
    if (!next && this.dropped > 0) {
      const record: Record = {
        type: "diagnostic",
        event: "logger.dropped",
        text: "Launcher diagnostics omitted",
        fields: { logger: "launcher", level: "warn", records: this.dropped },
      };
      this.dropped = 0;
      const bytes = Buffer.byteLength(JSON.stringify(record), "utf8");
      if (bytes <= this.byteLimit) {
        next = { record, bytes };
        this.bytes += bytes;
      }
    }
    if (!next) return;
    this.inFlight = next;
    try {
      this.child.send({ shellMcpLog: next.record }, (error) => {
        if (error) this.close();
      });
    } catch {
      this.close();
    }
  }
}

/** Validate the private parent IPC envelope; never expose it as an MCP tool. */
export function receiveLauncherRecord(value: unknown, logger: Logger): boolean {
  if (!value || typeof value !== "object" || !("shellMcpLog" in value)) return false;
  const record = value.shellMcpLog;
  if (
    !record ||
    typeof record !== "object" ||
    !("type" in record) ||
    !("text" in record) ||
    typeof record.text !== "string"
  )
    return false;
  if (Buffer.byteLength(JSON.stringify(record), "utf8") > 65_536) return false;
  if (record.type === "notice") {
    logger.display({ type: "notice", text: record.text });
    return true;
  }
  if (
    record.type !== "diagnostic" ||
    !("event" in record) ||
    typeof record.event !== "string" ||
    !("fields" in record) ||
    !record.fields ||
    typeof record.fields !== "object"
  )
    return false;
  const fields: { [key: string]: string | number | boolean | null } = {};
  for (const [key, field] of Object.entries(record.fields)) {
    if (field !== null && typeof field !== "string" && typeof field !== "number" && typeof field !== "boolean")
      return false;
    fields[key] = field;
  }
  logger.log(record.event, "server", record.text, fields);
  return true;
}
