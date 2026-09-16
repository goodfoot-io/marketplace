import { type ChildProcess, fork } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface LoggerHealth {
  readonly status: "healthy" | "lagging" | "failed" | "closed";
  /** Bytes waiting for the helper, including the one in-flight record. */
  readonly queued_bytes: number;
  /** Records waiting for the helper, including the one in-flight record. */
  readonly queued_records: number;
  readonly dropped_bytes: number;
  readonly dropped_records: number;
  readonly lag_ms: number;
}

interface Item {
  readonly text: string;
  readonly size: number;
  readonly queuedAt: number;
}

interface HelperMessage {
  readonly ack?: true;
  readonly failed?: true;
}

/**
 * Sends diagnostic output through a child process so a blocked terminal cannot
 * block the manager's event loop. The queue is finite and drops newest records
 * when it reaches either configured bound. `queued_*` is one consistent
 * pending-work measure: it includes both queued and in-flight data.
 */
export class IsolatedSink {
  readonly helper: ChildProcess;
  private readonly queue: Item[] = [];
  private inFlight: Item | undefined;
  private pendingBytes = 0;
  private droppedBytes = 0;
  private droppedRecords = 0;
  private failedState = false;
  private unreportedBytes = 0;
  private unreportedRecords = 0;
  private closedState = false;

  constructor(
    private readonly byteLimit: number,
    private readonly recordLimit: number,
    destination: number | "inherit" = "inherit",
    private readonly lossNotice: (bytes: number, records: number) => string = () => "",
    private readonly onFailure: () => void = () => {},
  ) {
    const helper = resolveHelper();
    this.helper = fork(helper.path, [], {
      execArgv: helper.execArgv,
      stdio: ["ignore", destination, "ignore", "ipc"],
      serialization: "advanced",
    });
    this.helper.on("message", (message: HelperMessage) => {
      if (message?.failed === true) {
        this.fail();
      } else if (message?.ack === true && this.inFlight !== undefined) {
        this.pendingBytes -= this.inFlight.size;
        this.inFlight = undefined;
        this.pump();
      }
    });
    this.helper.on("error", () => this.fail());
    this.helper.on("exit", () => {
      if (!this.closedState) this.fail();
    });
  }

  health(): LoggerHealth {
    const oldest = this.inFlight ?? this.queue[0];
    const lag = oldest === undefined ? 0 : Math.max(0, Math.round(performance.now() - oldest.queuedAt));
    return {
      status: this.closedState ? "closed" : this.failedState ? "failed" : lag > 1_000 ? "lagging" : "healthy",
      queued_bytes: this.pendingBytes,
      queued_records: this.queue.length + (this.inFlight === undefined ? 0 : 1),
      dropped_bytes: this.droppedBytes,
      dropped_records: this.droppedRecords,
      lag_ms: lag,
    };
  }

  enqueue(text: string): void {
    if (text === "") return;
    const size = Buffer.byteLength(text, "utf8");
    const records = this.queue.length + (this.inFlight === undefined ? 0 : 1);
    if (
      this.failedState ||
      this.closedState ||
      size > this.byteLimit ||
      this.pendingBytes + size > this.byteLimit ||
      records >= this.recordLimit
    ) {
      this.droppedBytes += size;
      this.droppedRecords++;
      this.unreportedBytes += size;
      this.unreportedRecords++;
      this.pump();
      return;
    }
    this.queue.push({ text, size, queuedAt: performance.now() });
    this.pendingBytes += size;
    this.pump();
  }

  private pump(): void {
    if (this.inFlight !== undefined || this.failedState || this.closedState || !this.helper.connected) return;
    let item = this.queue.shift();
    if (item === undefined && this.unreportedRecords > 0) {
      const text = this.lossNotice(this.unreportedBytes, this.unreportedRecords);
      this.unreportedBytes = 0;
      this.unreportedRecords = 0;
      const size = Buffer.byteLength(text, "utf8");
      if (size > 0 && size <= this.byteLimit) {
        item = { text, size, queuedAt: performance.now() };
        this.pendingBytes += size;
      }
    }
    if (item === undefined) return;
    this.inFlight = item;
    try {
      this.helper.send({ text: item.text }, (error?: Error | null) => {
        if (error) this.fail();
      });
    } catch {
      this.fail();
    }
  }

  /** Marks all pending records as dropped exactly once and stops further sends. */
  private fail(): void {
    if (this.failedState || this.closedState) return;
    this.failedState = true;
    this.droppedBytes += this.pendingBytes;
    this.droppedRecords += this.queue.length + (this.inFlight === undefined ? 0 : 1);
    this.pendingBytes = 0;
    this.queue.length = 0;
    this.inFlight = undefined;
    this.onFailure();
  }

  async close(timeoutMs: number): Promise<void> {
    if (this.closedState) return;
    this.pump();
    const deadline = performance.now() + Math.max(0, timeoutMs);
    while (this.pendingBytes > 0 && !this.failedState && performance.now() < deadline) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.min(10, Math.max(1, deadline - performance.now()))),
      );
    }
    if (this.pendingBytes > 0) this.fail();
    this.closedState = true;
    if (this.helper.connected) this.helper.disconnect();
    if (this.helper.exitCode === null) this.helper.kill("SIGKILL");
  }
}

function resolveHelper(): { path: string; execArgv: string[] } {
  const compiled = fileURLToPath(new URL("./helper.js", import.meta.url));
  if (existsSync(compiled)) return { path: compiled, execArgv: [] };
  const source = fileURLToPath(new URL("./helper.ts", import.meta.url));
  return { path: source, execArgv: ["--import", import.meta.resolve("tsx")] };
}
