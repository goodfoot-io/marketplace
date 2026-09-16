import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { delay, mono } from "../util/time.js";

export type Stream = "stdout" | "stderr" | "terminal";
export interface SpawnSpec {
  bash: string;
  cmd: string;
  login: boolean;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  tty: boolean;
}
export interface Hooks {
  output(stream: Stream, data: Buffer): void;
  streamEnd(stream: Stream): void;
  started(): void;
  outcome(code: number | null, signal: string | null): void;
  failed(error: string): void;
  lost(error: string): void;
  scopeEmpty(): void;
}
export interface PtyLike {
  pid: number;
  write(data: string): void;
  resize?(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(callback: (data: string | Buffer) => void): unknown;
  onExit(callback: (event: { exitCode: number; signal?: number }) => void): unknown;
}
export interface PtyModule {
  spawn(file: string, args: string[], options: Record<string, unknown>): PtyLike;
}

/** Optional native PTY loading is deliberately runtime-only so pipe mode works without node-pty. */
export async function loadPty(disabled = false): Promise<PtyModule | null> {
  if (disabled) return null;
  try {
    const moduleName = "node-pty";
    const value: unknown = await import(moduleName);
    const candidate = value as { spawn?: unknown };
    return typeof candidate.spawn === "function" ? (candidate as PtyModule) : null;
  } catch {
    return null;
  }
}

/** Owns one Bash leader and its detached process group; it has no request lifetime. */
export class Scope {
  private child: ChildProcess | undefined;
  private pty: PtyLike | undefined;
  private pgid: number | undefined;
  private stopping: Promise<"confirmed" | "unverified" | "failed"> | undefined;
  private leaderTerminal = false;
  private streamsClosed = 0;
  private empty = false;
  private anchored = false;
  private sendControl: (value: object) => void = () => {};

  constructor(
    private readonly spec: SpawnSpec,
    private readonly hooks: Hooks,
    private readonly termGraceMs = 2_000,
    private readonly killGraceMs = 1_500,
    private readonly ptyModule: PtyModule | null = null,
  ) {}

  get pid(): number | undefined {
    return this.pgid;
  }
  get isTerminal(): boolean {
    return this.leaderTerminal;
  }

  async start(): Promise<void> {
    if (this.spec.tty) {
      if (!this.ptyModule) throw new Error("PTY module unavailable");
      const pty = this.ptyModule.spawn(this.spec.bash, [this.spec.login ? "-lc" : "-c", this.spec.cmd], {
        name: "xterm-256color",
        cols: 120,
        rows: 40,
        cwd: this.spec.cwd,
        encoding: null,
        env: this.spec.env ?? process.env,
      });
      this.pty = pty;
      this.pgid = pty.pid;
      pty.onData((data) => this.hooks.output("terminal", Buffer.isBuffer(data) ? data : Buffer.from(data)));
      pty.onExit((event) => {
        this.leaderTerminal = true;
        this.hooks.outcome(event.exitCode, event.signal === undefined ? null : String(event.signal));
        this.hooks.streamEnd("terminal");
        this.markEmptyIfGone();
      });
      this.hooks.started();
      return;
    }
    const compiledWorker = fileURLToPath(new URL("./scope-worker.js", import.meta.url));
    const sourceWorker = fileURLToPath(new URL("./scope-worker.ts", import.meta.url));
    const workerArguments = existsSync(compiledWorker) ? [compiledWorker] : ["--import", "tsx", sourceWorker];
    const child = spawn(process.execPath, workerArguments, { detached: true, stdio: ["pipe", "pipe", "pipe", "ipc"] });
    this.anchored = true;
    this.child = child;
    this.pgid = child.pid;
    if (!child.stdin || !child.stdout || !child.stderr) {
      child.kill("SIGKILL");
      throw new Error("Scope worker did not expose configured pipes");
    }
    this.sendControl = (value) => {
      if (child.connected) child.send(value);
    };
    child.stdout.on("data", (data: Buffer) => this.hooks.output("stdout", data));
    child.stderr.on("data", (data: Buffer) => this.hooks.output("stderr", data));
    child.stdout.once("end", () => {
      this.streamsClosed++;
      this.hooks.streamEnd("stdout");
      this.markEmptyIfGone();
    });
    child.stderr.once("end", () => {
      this.streamsClosed++;
      this.hooks.streamEnd("stderr");
      this.markEmptyIfGone();
    });
    child.stdin.on("error", () => undefined);
    child.on("message", (value) => this.receive(value));
    child.once("error", (error) => {
      this.leaderTerminal = true;
      this.hooks.failed(error.message);
      this.hooks.streamEnd("stdout");
      this.hooks.streamEnd("stderr");
    });
    child.once("exit", () => this.anchorExit());
    child.once("spawn", () => this.sendControl({ type: "start", command: this.spec }));
  }

  write(chars: string, close: boolean, done: (error?: Error) => void): void {
    if (this.pty) {
      try {
        this.pty.write(chars);
        done();
      } catch (error) {
        done(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }
    const input = this.child?.stdin;
    if (!input || input.destroyed || input.writableEnded) {
      done(new Error("stdin unavailable"));
      return;
    }
    if (close) input.end(chars, () => done());
    else input.write(chars, (error) => done(error ?? undefined));
  }

  interrupt(): boolean {
    if (this.pty) {
      try {
        this.pty.write("\x03");
        return true;
      } catch {
        return false;
      }
    }
    return this.signal("SIGINT");
  }

  stop(): Promise<"confirmed" | "unverified" | "failed"> {
    if (!this.stopping) this.stopping = this.cleanup();
    return this.stopping;
  }

  abandonOutput(): void {
    this.child?.stdout?.destroy();
    this.child?.stderr?.destroy();
    this.child?.stdin?.destroy();
  }

  private signal(signal: NodeJS.Signals): boolean {
    if (this.pgid === undefined || this.empty) return false;
    try {
      process.kill(-this.pgid, signal);
      return true;
    } catch {
      return false;
    }
  }

  private receive(value: unknown): void {
    const message = value as { type?: string; code?: number | null; signal?: string | null; error?: string };
    if (message.type === "leader_started") this.hooks.started();
    else if (message.type === "leader_exit") {
      this.leaderTerminal = true;
      this.hooks.outcome(message.code ?? null, message.signal ?? null);
      this.markEmptyIfGone();
    } else if (message.type === "failed_to_start") {
      this.leaderTerminal = true;
      this.hooks.failed(message.error ?? "Bash failed to start");
      this.markEmptyIfGone();
    } else if (message.type === "scope_empty") {
      this.empty = true;
      this.hooks.scopeEmpty();
    }
  }

  private anchorExit(): void {
    if (this.anchored && !this.leaderTerminal)
      this.hooks.lost("Group anchor exited without a leader outcome; do not re-execute blindly.");
  }

  private groupExists(): boolean {
    if (this.pgid === undefined) return false;
    try {
      process.kill(-this.pgid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  }

  private markEmptyIfGone(): void {
    if (this.empty || !this.leaderTerminal) return;
    if (this.streamsClosed < (this.pty ? 1 : 2)) return;
    if (!this.groupExists()) {
      this.empty = true;
      this.hooks.scopeEmpty();
      return;
    }
    setTimeout(() => {
      if (!this.groupExists() && !this.empty) {
        this.empty = true;
        this.hooks.scopeEmpty();
      }
    }, 25).unref();
  }

  private async cleanup(): Promise<"confirmed" | "unverified" | "failed"> {
    if (this.empty) return "confirmed";
    if (!this.signal("SIGTERM")) return this.groupExists() ? "failed" : "confirmed";
    const end = mono() + this.termGraceMs;
    while (mono() < end && !this.empty) await delay(20);
    if (this.empty || !this.groupExists()) return "confirmed";
    if (this.pty) {
      try {
        this.pty.kill("SIGKILL");
      } catch {
        return "failed";
      }
    } else {
      const pgid = this.pgid;
      if (pgid === undefined) return "unverified";
      try {
        process.kill(-pgid, "SIGKILL");
      } catch {
        return "unverified";
      }
    }
    const killEnd = mono() + this.killGraceMs;
    while (mono() < killEnd) {
      if (!this.groupExists()) {
        this.empty = true;
        this.hooks.scopeEmpty();
        return "confirmed";
      }
      await delay(25);
    }
    return "unverified";
  }
}
