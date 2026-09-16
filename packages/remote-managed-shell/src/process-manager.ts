import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadPty, Scope, type Stream } from "./adapters/adapter.js";
import { type ExecInput, inputs, type ListInput, type ReadInput, type WriteInput } from "./contracts.js";
import { DomainError, requireThat } from "./errors.js";
import { type Logger, NullLogger } from "./logging/logger.js";
import { type TranscriptEvent, TranscriptGapError, TranscriptStore } from "./output/transcript-store.js";
import { CursorCodec, hash, randomId } from "./util/opaque.js";
import { deadline, mono } from "./util/time.js";
import { Utf8 } from "./util/utf8.js";

export interface ProcessManagerLimits {
  activeSessions: number;
  maxWaitMs: number;
  outputBytesPerSession: number;
  outputBytesGlobal: number;
  operationIds: number;
  writeIds: number;
  writeIdsPerSession: number;
  inputPayloadBytes: number;
  inputPerSession: number;
  inputGlobal: number;
  inputQueueRecords: number;
  retentionMs: number;
  completedRecords: number;
  responseEvents: number;
  termGraceMs: number;
  cleanupObserveMs: number;
  diskPerSession: number;
  diskGlobal: number;
  segmentBytes: number;
  segmentEvents: number;
  segments: number;
  spoolQueueBytes: number;
  spoolQueueEntries: number;
}
const defaultLimits: ProcessManagerLimits = {
  activeSessions: 32,
  maxWaitMs: 20_000,
  outputBytesPerSession: 1_048_576,
  outputBytesGlobal: 33_554_432,
  operationIds: 10_000,
  writeIds: 100_000,
  writeIdsPerSession: 10_000,
  inputPayloadBytes: 65_536,
  inputPerSession: 262_144,
  inputGlobal: 4_194_304,
  inputQueueRecords: 256,
  retentionMs: 86_400_000,
  completedRecords: 1_000,
  responseEvents: 128,
  termGraceMs: 2_000,
  cleanupObserveMs: 1_500,
  diskPerSession: 268_435_456,
  diskGlobal: 2_147_483_648,
  segmentBytes: 1_048_576,
  segmentEvents: 256,
  segments: 1024,
  spoolQueueBytes: 4_194_304,
  spoolQueueEntries: 256,
};

interface Event {
  seq: number;
  stream: Stream;
  start: number;
  bytes: Buffer;
  text: string;
  raw: Buffer;
}
interface WriteEntry {
  fingerprint: string;
  record: Record<string, unknown>;
}
interface Session {
  id: string;
  operationId: string;
  fingerprint: string;
  cmd: string;
  cwd: string;
  label: string | null;
  tty: boolean;
  login: boolean;
  createdAt: string;
  createdMono: number;
  startedAt: string | null;
  startedMono: number | null;
  exitedAt: string | null;
  outputClosedAt: string | null;
  lastOutputAt: string | null;
  status: "starting" | "running" | "exited" | "failed_to_start";
  stateVersion: number;
  exitCode: number | null;
  signal: string | null;
  stopReason: "user" | "timeout" | "shutdown" | null;
  cleanup: {
    scope: "managed_process_group";
    status: "not_requested" | "in_progress" | "confirmed" | "unverified" | "failed";
    detail: string;
  };
  stdinOpen: boolean;
  outputClosed: boolean;
  invalidUtf8: boolean;
  spawnError: { code: string; message: string } | null;
  events: Event[];
  closedStreams: Set<Stream>;
  decoders: Map<Stream, Utf8>;
  rawPending: Map<Stream, Buffer>;
  nextSeq: number;
  nextOutputByte: number;
  earliestByte: number;
  outputLossBytes: number;
  rawSpoolDroppedBytes: number;
  transcript: TranscriptStore;
  writes: Map<string, WriteEntry>;
  queuedInputBytes: number;
  queuedInputRecords: number;
  inputOrder: number;
  inputTail: Promise<void>;
  scope: Scope | undefined;
  cleanupTask?: Promise<"confirmed" | "unverified" | "failed">;
  resultExpiresAt: number | null;
  resultExpired: boolean;
  waiters: Set<() => void>;
  createdOrder: number;
  activeCounted: boolean;
}
export interface ProcessManagerOptions {
  instanceId?: string;
  mode?: "local" | "public";
  cwd?: string;
  bash?: string;
  env?: NodeJS.ProcessEnv;
  limits?: Partial<ProcessManagerLimits>;
  pty?: boolean;
  logger?: Logger;
  spoolRoot?: string;
}
// biome-ignore lint/suspicious/noExplicitAny: MCP tool results are heterogeneous JSON records whose concrete shape is selected by result_kind.
export type ManagerResult = Record<string, any>;

/** One manager owns every accepted process scope for the lifetime of one server instance. */
export class ProcessManager {
  readonly instanceId: string;
  readonly mode: "local" | "public";
  readonly limits: ProcessManagerLimits;
  private readonly cwd: string;
  private readonly bash: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly ptyRequested: boolean;
  private readonly cursor: CursorCodec;
  private readonly sessions = new Map<string, Session>();
  private readonly operations = new Map<string, { sessionId: string; fingerprint: string; resultExpired: boolean }>();
  private readonly transcripts: TranscriptStore;
  private creationCounter = 0;
  private active = 0;
  private inputGlobal = 0;
  private writeCount = 0;
  private shuttingDown = false;
  private pty: Awaited<ReturnType<typeof loadPty>> | undefined;
  private ptyLoaded = false;
  private ptyLoad?: ReturnType<typeof loadPty>;
  private shutdownTask?: Promise<void>;
  private readonly logger: Logger;

  constructor(options: ProcessManagerOptions = {}) {
    this.instanceId = options.instanceId ?? randomId("srv");
    this.mode = options.mode ?? "local";
    this.limits = { ...defaultLimits, ...options.limits };
    this.cwd = resolve(options.cwd ?? process.cwd());
    this.bash = options.bash ?? "/bin/bash";
    this.env = options.env ?? { ...process.env };
    this.ptyRequested = options.pty ?? true;
    this.cursor = new CursorCodec(this.instanceId);
    this.logger = options.logger ?? new NullLogger();
    this.transcripts = new TranscriptStore(
      {
        memoryPerSession: this.limits.outputBytesPerSession,
        memoryGlobal: this.limits.outputBytesGlobal,
        diskPerSession: this.limits.diskPerSession,
        diskGlobal: this.limits.diskGlobal,
        segmentBytes: this.limits.segmentBytes,
        segmentEvents: this.limits.segmentEvents,
        maxSegments: this.limits.segments,
        pendingBytes: this.limits.spoolQueueBytes,
        pendingEntries: this.limits.spoolQueueEntries,
        root: options.spoolRoot ?? `${tmpdir()}/remote-managed-shell-transcripts-${this.instanceId}`,
      },
      (sessionId) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          this.syncTranscript(session);
          this.signal(session);
        }
      },
    );
  }

  async execCommand(raw: ExecInput): Promise<ManagerResult> {
    const input = inputs.exec_command.parse(raw);
    requireThat(
      Buffer.byteLength(input.cmd, "utf8") <= 65_536,
      "INVALID_ARGUMENT",
      "Command exceeds the UTF-8 byte limit.",
    );
    requireThat(
      input.label === undefined || Buffer.byteLength(input.label, "utf8") <= 128,
      "INVALID_ARGUMENT",
      "Label exceeds the UTF-8 byte limit.",
    );
    requireThat(
      input.expected_server_instance_id === this.instanceId,
      "SERVER_INSTANCE_MISMATCH",
      "The expected server instance does not match this manager.",
    );
    const cwd = resolve(input.workdir ?? this.cwd);
    const fingerprint = hash(
      JSON.stringify({ cmd: input.cmd, cwd, login: input.login, tty: input.tty, timeout_ms: input.timeout_ms ?? null }),
    );
    const previous = this.operations.get(input.operation_id);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new DomainError(
          "OPERATION_ID_CONFLICT",
          "operation_id is already bound to different execution arguments.",
          { operation_id: input.operation_id },
        );
      if (previous.resultExpired)
        throw new DomainError(
          "OPERATION_RESULT_EXPIRED",
          "The operation identity is retained but its result has expired.",
          { operation_id: input.operation_id, session_id: previous.sessionId },
        );
      const session = this.sessions.get(previous.sessionId);
      requireThat(session, "SESSION_EXPIRED", "The accepted operation record is no longer available.");
      return this.processResult(
        session,
        await this.observe(session, 0, input.max_output_bytes, input.yield_time_ms, undefined),
        true,
      );
    }
    requireThat(!this.shuttingDown, "SHUTTING_DOWN", "This server is shutting down.");
    requireThat(this.active < this.limits.activeSessions, "CAPACITY_EXCEEDED", "The active session limit is full.");
    requireThat(
      this.operations.size < this.limits.operationIds,
      "CAPACITY_EXCEEDED",
      "The operation identity registry is full.",
    );
    if (input.tty && !this.ptyLoaded) {
      await this.loadPtyAdapter();
      const raced = this.operations.get(input.operation_id);
      if (raced) {
        if (raced.fingerprint !== fingerprint)
          throw new DomainError(
            "OPERATION_ID_CONFLICT",
            "operation_id is already bound to different execution arguments.",
            { operation_id: input.operation_id },
          );
        if (raced.resultExpired)
          throw new DomainError(
            "OPERATION_RESULT_EXPIRED",
            "The operation identity is retained but its result has expired.",
            { operation_id: input.operation_id, session_id: raced.sessionId },
          );
        const racedSession = this.sessions.get(raced.sessionId);
        requireThat(racedSession, "SESSION_EXPIRED", "The accepted operation record is no longer available.");
        return this.processResult(
          racedSession,
          await this.observe(racedSession, 0, input.max_output_bytes, input.yield_time_ms, undefined),
          true,
        );
      }
      requireThat(!this.shuttingDown, "SHUTTING_DOWN", "This server is shutting down.");
      requireThat(this.active < this.limits.activeSessions, "CAPACITY_EXCEEDED", "The active session limit is full.");
      requireThat(
        this.operations.size < this.limits.operationIds,
        "CAPACITY_EXCEEDED",
        "The operation identity registry is full.",
      );
    }
    if (input.tty) requireThat(this.pty, "PTY_UNAVAILABLE", "The optional PTY adapter is unavailable.");
    const session: Session = {
      id: randomId("sess"),
      operationId: input.operation_id,
      fingerprint,
      cmd: input.cmd,
      cwd,
      label: input.label ?? null,
      tty: input.tty,
      login: input.login,
      createdAt: new Date().toISOString(),
      createdMono: mono(),
      startedAt: null,
      startedMono: null,
      exitedAt: null,
      outputClosedAt: null,
      lastOutputAt: null,
      status: "starting",
      stateVersion: 0,
      exitCode: null,
      signal: null,
      stopReason: null,
      cleanup: { scope: "managed_process_group", status: "not_requested", detail: "No cleanup was requested." },
      stdinOpen: true,
      outputClosed: false,
      invalidUtf8: false,
      spawnError: null,
      events: [],
      closedStreams: new Set(),
      decoders: new Map(),
      rawPending: new Map(),
      nextSeq: 1,
      nextOutputByte: 0,
      earliestByte: 0,
      outputLossBytes: 0,
      rawSpoolDroppedBytes: 0,
      transcript: this.transcripts,
      writes: new Map(),
      queuedInputBytes: 0,
      queuedInputRecords: 0,
      inputOrder: 0,
      inputTail: Promise.resolve(),
      scope: undefined,
      cleanupTask: undefined,
      resultExpiresAt: null,
      resultExpired: false,
      waiters: new Set(),
      createdOrder: ++this.creationCounter,
      activeCounted: true,
    };
    this.sessions.set(session.id, session);
    this.operations.set(input.operation_id, { sessionId: session.id, fingerprint, resultExpired: false });
    this.active++;
    this.log("command.accepted", session, `${input.cmd}\n[cwd=${cwd}]`);
    session.scope = new Scope(
      { bash: this.bash, cmd: input.cmd, login: input.login, cwd, env: this.env, tty: input.tty },
      this.hooks(session),
      this.limits.termGraceMs,
      this.limits.cleanupObserveMs,
      this.pty ?? null,
    );
    try {
      await session.scope.start();
    } catch (error) {
      this.hooks(session).failed(error instanceof Error ? error.message : String(error));
    }
    if (input.timeout_ms !== null) {
      deadline(input.timeout_ms, () => {
        if (session.status === "running" || session.status === "starting") {
          session.stopReason = "timeout";
          void this.terminateProcess({ session_id: session.id, wait_ms: this.limits.cleanupObserveMs });
        }
      });
    }
    return this.processResult(
      session,
      await this.observeInitial(session, input.max_output_bytes, input.yield_time_ms),
      false,
    );
  }

  async readProcess(raw: ReadInput): Promise<ManagerResult> {
    const input = inputs.read_process.parse(raw);
    const session = this.session(input.session_id);
    requireThat(!session.resultExpired, "SESSION_EXPIRED", "The retained process result has expired.", {
      session_id: session.id,
      operation_id: session.operationId,
    });
    const position = this.decodeOutput(session, input.cursor);
    return this.processResult(
      session,
      await this.observe(session, position, input.max_output_bytes, input.wait_ms, input.known_state_version),
      false,
    );
  }

  async writeStdin(raw: WriteInput): Promise<ManagerResult> {
    const input = inputs.write_stdin.parse(raw);
    const session = this.session(input.session_id);
    const charsBytes = Buffer.byteLength(input.chars, "utf8");
    requireThat(
      charsBytes <= this.limits.inputPayloadBytes,
      "INVALID_ARGUMENT",
      "Input payload exceeds the configured limit.",
    );
    const cursorPosition = input.cursor ? this.decodeOutput(session, input.cursor) : undefined;
    const fingerprint = hash(
      JSON.stringify({ chars: input.chars, close_stdin: input.close_stdin, interrupt: input.interrupt }),
    );
    const previous = session.writes.get(input.write_id);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new DomainError("WRITE_ID_CONFLICT", "write_id is already bound to different input.", {
          write_id: input.write_id,
        });
      const page =
        cursorPosition !== undefined
          ? await this.observe(session, cursorPosition, input.max_output_bytes, input.yield_time_ms, undefined)
          : undefined;
      return { ...this.processResult(session, page, true), write: { ...previous.record, replayed: true } };
    }
    requireThat(this.writeCount < this.limits.writeIds, "CAPACITY_EXCEEDED", "The write identity registry is full.");
    requireThat(
      session.writes.size < this.limits.writeIdsPerSession,
      "CAPACITY_EXCEEDED",
      "The session write identity registry is full.",
    );
    requireThat(
      this.inputGlobal + charsBytes <= this.limits.inputGlobal,
      "INPUT_QUEUE_FULL",
      "The global input queue is full.",
    );
    requireThat(
      session.queuedInputBytes + charsBytes <= this.limits.inputPerSession &&
        session.queuedInputRecords < this.limits.inputQueueRecords,
      "INPUT_QUEUE_FULL",
      "The session input queue is full.",
    );
    if (!input.interrupt) {
      requireThat(session.stdinOpen, "STDIN_CLOSED", "stdin is already closed.");
      if (input.close_stdin)
        requireThat(!session.tty, "UNSUPPORTED_OPERATION", "Pipe EOF is unsupported for PTY sessions.");
    }
    const record: Record<string, unknown> = {
      write_id: input.write_id,
      accepted: true,
      reservation_order: ++session.inputOrder,
      delivery_status: "queued",
      bytes_accepted: charsBytes,
      chars_bytes: charsBytes,
      close_stdin: input.close_stdin,
      interrupt: input.interrupt,
      accepted_at: new Date().toISOString(),
      settled_at: null,
      detail: "Reserved for delivery.",
      replayed: false,
    };
    session.writes.set(input.write_id, { fingerprint, record });
    this.writeCount++;
    session.queuedInputBytes += charsBytes;
    session.queuedInputRecords++;
    this.inputGlobal += charsBytes;
    this.log(
      "stdin.accepted",
      session,
      `write_id=${input.write_id} chars=${JSON.stringify(input.chars)} close=${String(input.close_stdin)} interrupt=${String(input.interrupt)}`,
    );
    session.inputTail = session.inputTail.then(async () => {
      try {
        if (input.interrupt) {
          const accepted = session.scope?.interrupt() ?? false;
          record.delivery_status = accepted ? "handed_off" : "failed";
          record.detail = accepted
            ? "SIGINT/control byte handed to the managed scope."
            : "The managed scope no longer accepted SIGINT.";
        } else {
          await new Promise<void>((resolveWrite, rejectWrite) =>
            session.scope?.write(input.chars, input.close_stdin, (error) =>
              error ? rejectWrite(error) : resolveWrite(),
            ),
          );
          record.delivery_status = "handed_off";
          record.detail = input.close_stdin
            ? "Bytes handed off and stdin EOF queued."
            : "Bytes handed off to child stdin.";
          if (input.close_stdin) session.stdinOpen = false;
        }
      } catch (error) {
        record.delivery_status = "indeterminate";
        record.detail = error instanceof Error ? error.message.slice(0, 256) : "Input delivery outcome is unknown.";
      }
      record.settled_at = new Date().toISOString();
      this.log(
        "stdin.settled",
        session,
        `write_id=${input.write_id} status=${String(record.delivery_status)} detail=${String(record.detail)}`,
      );
      session.queuedInputBytes -= charsBytes;
      session.queuedInputRecords--;
      this.inputGlobal -= charsBytes;
      session.stateVersion++;
      this.signal(session);
    });
    await session.inputTail;
    const page =
      cursorPosition !== undefined
        ? await this.observe(session, cursorPosition, input.max_output_bytes, input.yield_time_ms, undefined)
        : undefined;
    return { ...this.processResult(session, page, false), write: { ...record } };
  }

  async terminateProcess(raw: { session_id: string; wait_ms?: number }): Promise<ManagerResult> {
    const session = this.session(raw.session_id);
    if (session.cleanup.status === "not_requested") {
      session.stopReason = session.stopReason ?? "user";
      session.cleanup = {
        scope: "managed_process_group",
        status: "in_progress",
        detail: "Termination requested; cleanup is being observed.",
      };
      session.stateVersion++;
      this.signal(session);
      session.cleanupTask = (session.scope?.stop() ?? Promise.resolve("unverified" as const)).then((status) => {
        session.cleanup.status = status;
        session.cleanup.detail =
          status === "confirmed"
            ? "Managed process group is confirmed empty."
            : "Managed scope cleanup remains unverified.";
        session.stateVersion++;
        this.signal(session);
        return status;
      });
    }
    await this.waitForCondition(
      session,
      Math.min(raw.wait_ms ?? this.limits.maxWaitMs, this.limits.maxWaitMs),
      () => session.cleanup.status !== "in_progress",
    );
    return this.processResult(session, undefined, false);
  }

  async listProcesses(raw: ListInput = {} as ListInput): Promise<ManagerResult> {
    const input = inputs.list_processes.parse(raw);
    await this.loadPtyAdapter();
    let ceiling = this.creationCounter;
    let offset = 0;
    if (input.page_token) {
      const decoded = this.cursor.decode(input.page_token, "list", "");
      requireThat(decoded, "CURSOR_INVALID", "The list page token is invalid.");
      offset = decoded.position;
      ceiling = decoded.ceiling;
    }
    let rows = [...this.sessions.values()].filter(
      (session) =>
        session.createdOrder <= ceiling &&
        (input.include_completed || session.status === "running" || session.status === "starting"),
    );
    if (input.operation_id) rows = rows.filter((session) => session.operationId === input.operation_id);
    rows.sort((a, b) => a.createdOrder - b.createdOrder);
    const selected = rows.slice(offset, offset + input.limit);
    return {
      server_instance_id: this.instanceId,
      result_kind: "listing",
      mode: this.mode,
      processes: selected.map((session) => this.snapshot(session)),
      next_page_token:
        offset + selected.length < rows.length
          ? this.cursor.encode("list", "", offset + selected.length, ceiling)
          : null,
      operation: input.operation_id ? (selected[0] ? this.snapshot(selected[0]) : null) : null,
      capabilities: {
        tty_supported: this.pty !== null && this.pty !== undefined,
        tty_status: this.ptyRequested ? (this.pty ? "available" : "unavailable") : "disabled",
        max_wait_ms: this.limits.maxWaitMs,
        cleanup_scope: "managed_process_group",
        restart_recovery: false,
      },
      environment: { platform: process.platform, arch: process.arch, bash: this.bash },
      limits: { ...this.limits },
      health: {
        active_sessions: this.active,
        input_queued_bytes: this.inputGlobal,
        retained_output_bytes: this.transcripts.retainedBytes(),
        logger: this.logger.health(),
      },
      pagination: "Creation-ordered snapshot ceiling; new records appear only in a new traversal.",
    };
  }

  exec(input: ExecInput): Promise<ManagerResult> {
    return this.execCommand(input);
  }
  read(input: ReadInput): Promise<ManagerResult> {
    return this.readProcess(input);
  }
  write(input: WriteInput): Promise<ManagerResult> {
    return this.writeStdin(input);
  }
  terminate(input: { session_id: string; wait_ms?: number }): Promise<ManagerResult> {
    return this.terminateProcess(input);
  }
  logInvocation(tool: string, outcome: "started" | "succeeded" | "failed"): void {
    this.logger.log("mcp.invocation", "server", `${tool} ${outcome}`);
  }
  shutdown(): Promise<void> {
    if (!this.shutdownTask) this.shutdownTask = this.performShutdown();
    return this.shutdownTask;
  }

  private async performShutdown(): Promise<void> {
    this.shuttingDown = true;
    const sessions = [...this.sessions.values()].filter((session) => session.activeCounted || !session.outputClosed);
    for (const session of sessions) session.stopReason ??= "shutdown";
    await Promise.all(
      sessions.map((session) =>
        this.terminateProcess({ session_id: session.id, wait_ms: this.limits.cleanupObserveMs }),
      ),
    );
    await Promise.allSettled(
      sessions
        .map((session) => session.cleanupTask)
        .filter((task): task is Promise<"confirmed" | "unverified" | "failed"> => task !== undefined),
    );
    await this.transcripts.close();
    await this.logger.close(this.limits.cleanupObserveMs);
  }

  private async loadPtyAdapter(): Promise<void> {
    if (this.ptyLoaded) return;
    this.ptyLoad ??= loadPty(!this.ptyRequested);
    this.pty = await this.ptyLoad;
    this.ptyLoaded = true;
  }

  private session(id: string): Session {
    const value = this.sessions.get(id);
    if (!value) throw new DomainError("SESSION_UNKNOWN", "Unknown session handle.", { session_id: id });
    return value;
  }
  private hooks(session: Session) {
    return {
      output: (stream: Stream, data: Buffer) => {
        const decoder = session.decoders.get(stream) ?? new Utf8();
        session.decoders.set(stream, decoder);
        const raw = Buffer.concat([session.rawPending.get(stream) ?? Buffer.alloc(0), data]);
        const text = decoder.push(data);
        if (!text) {
          session.rawPending.set(stream, raw);
          return;
        }
        session.rawPending.delete(stream);
        const bytes = Buffer.from(text, "utf8");
        const event: TranscriptEvent = {
          seq: session.nextSeq++,
          stream,
          start: session.nextOutputByte,
          bytes,
          text,
          raw,
        };
        session.transcript.append(session.id, event);
        session.nextOutputByte += bytes.length;
        this.syncTranscript(session);
        session.lastOutputAt = new Date().toISOString();
        session.invalidUtf8 ||= decoder.invalid;
        this.log(`output.${stream}`, session, text);
        session.stateVersion++;
        this.signal(session);
      },
      streamEnd: (stream: Stream) => {
        const decoder = session.decoders.get(stream);
        const tail = decoder?.end() ?? "";
        if (tail) {
          const raw = session.rawPending.get(stream) ?? Buffer.alloc(0);
          session.rawPending.delete(stream);
          const bytes = Buffer.from(tail, "utf8");
          const event: TranscriptEvent = {
            seq: session.nextSeq++,
            stream,
            start: session.nextOutputByte,
            bytes,
            text: tail,
            raw,
          };
          session.transcript.append(session.id, event);
          session.nextOutputByte += bytes.length;
          session.invalidUtf8 ||= decoder?.invalid ?? false;
          this.syncTranscript(session);
        }
        session.closedStreams.add(stream);
        if (
          (session.tty && session.closedStreams.has("terminal")) ||
          (!session.tty && session.closedStreams.has("stdout") && session.closedStreams.has("stderr"))
        ) {
          session.outputClosed = true;
          session.outputClosedAt = new Date().toISOString();
          this.releaseActive(session);
          this.armResultExpiry(session);
          this.trimCompleted();
        }
        this.log(`stream.${stream}.closed`, session, "");
        session.stateVersion++;
        this.signal(session);
      },
      started: () => {
        session.status = "running";
        session.startedAt = new Date().toISOString();
        session.startedMono = mono();
        this.log("command.started", session, "");
        session.stateVersion++;
        this.signal(session);
      },
      outcome: (code: number | null, signal: string | null) => {
        if (session.status === "exited" || session.status === "failed_to_start") return;
        session.status = "exited";
        session.exitCode = code;
        session.signal = signal;
        session.stdinOpen = false;
        session.exitedAt = new Date().toISOString();
        this.log("command.exited", session, `code=${String(code)} signal=${String(signal)}`);
        if (session.outputClosed) {
          this.armResultExpiry(session);
          this.trimCompleted();
        }
        session.stateVersion++;
        this.signal(session);
      },
      failed: (message: string) => {
        if (session.status === "failed_to_start" || session.status === "exited") return;
        session.status = "failed_to_start";
        session.stdinOpen = false;
        session.spawnError = { code: "SPAWN_FAILED", message: message.slice(0, 256) };
        session.exitedAt = new Date().toISOString();
        this.log("command.failed_to_start", session, message.slice(0, 256));
        if (session.outputClosed) {
          this.armResultExpiry(session);
          this.trimCompleted();
        }
        session.stateVersion++;
        this.signal(session);
      },
      lost: (message: string) => {
        session.cleanup.status = "unverified";
        session.cleanup.detail = message.slice(0, 256);
        this.log("scope.lost", session, session.cleanup.detail);
        session.stateVersion++;
        this.signal(session);
      },
      scopeEmpty: () => {
        session.cleanup = {
          scope: "managed_process_group",
          status: "confirmed",
          detail: "Managed process group is empty.",
        };
        this.log("scope.empty", session, "");
        session.stateVersion++;
        this.signal(session);
      },
    };
  }
  private log(kind: string, session: Session, text: string): void {
    try {
      this.logger.log(kind, session.id, text);
    } catch {
      /* logger failure is reflected by health and never breaks process control */
    }
  }
  private releaseActive(session: Session): void {
    if (session.activeCounted) {
      session.activeCounted = false;
      this.active = Math.max(0, this.active - 1);
    }
  }
  private signal(session: Session): void {
    for (const waiter of session.waiters) waiter();
  }
  private waitForCondition(session: Session, waitMs: number, condition: () => boolean): Promise<void> {
    if (waitMs <= 0 || condition()) return Promise.resolve();
    return new Promise((resolveWait) => {
      const check = () => {
        if (!condition()) return;
        clearTimeout(timer);
        session.waiters.delete(check);
        resolveWait();
      };
      const timer = setTimeout(() => {
        session.waiters.delete(check);
        resolveWait();
      }, waitMs);
      session.waiters.add(check);
    });
  }
  private async observe(
    session: Session,
    position: number,
    budget: number,
    waitMs: number,
    known: number | undefined,
  ): Promise<{ from: number; position: number; output: Record<string, unknown>[]; effectiveWaitMs: number }> {
    const effective = Math.min(waitMs, this.limits.maxWaitMs);
    const startVersion = session.stateVersion;
    if (
      !this.available(session, position) &&
      !(known !== undefined && known !== startVersion) &&
      !this.complete(session, position)
    )
      await this.waitForCondition(
        session,
        effective,
        () =>
          this.available(session, position) ||
          (known !== undefined && known !== session.stateVersion) ||
          this.complete(session, position),
      );
    const page = await this.page(session, position, budget);
    return { from: position, position: page.position, output: page.output, effectiveWaitMs: effective };
  }
  private async observeInitial(
    session: Session,
    budget: number,
    waitMs: number,
  ): Promise<{ from: number; position: number; output: Record<string, unknown>[]; effectiveWaitMs: number }> {
    const effective = Math.min(waitMs, this.limits.maxWaitMs);
    await this.waitForCondition(
      session,
      effective,
      () => session.status === "exited" || session.status === "failed_to_start",
    );
    const page = await this.page(session, 0, budget);
    return { from: 0, position: page.position, output: page.output, effectiveWaitMs: effective };
  }
  private available(session: Session, position: number): boolean {
    return session.nextOutputByte > position;
  }
  private complete(session: Session, position: number): boolean {
    return (
      (session.status === "exited" || session.status === "failed_to_start") &&
      session.outputClosed &&
      !this.available(session, position)
    );
  }
  private async page(
    session: Session,
    position: number,
    budget: number,
  ): Promise<{ position: number; output: Record<string, unknown>[] }> {
    this.syncTranscript(session);
    try {
      return await session.transcript.page(session.id, position, budget, this.limits.responseEvents);
    } catch (error) {
      if (!(error instanceof TranscriptGapError)) throw error;
      throw new DomainError(error.code, error.message, {
        earliest_cursor: this.cursor.encode("output", session.id, error.earliest),
        latest_cursor: this.cursor.encode("output", session.id, error.latest),
        recovery_cursor: this.cursor.encode("output", session.id, error.earliest),
        output_loss: error.dropped
          ? {
              occurred: true,
              reason: error.code === "STORAGE_UNAVAILABLE" ? "storage_failure" : "quota_eviction",
              dropped_bytes: error.dropped,
              raw_spool_dropped_bytes: session.rawSpoolDroppedBytes,
            }
          : null,
      });
    }
  }
  private decodeOutput(session: Session, token: string): number {
    if (token === "start") return 0;
    const decoded = this.cursor.decode(token, "output", session.id);
    requireThat(decoded, "CURSOR_INVALID", "The cursor is invalid for this session.");
    return decoded.position;
  }
  private processResult(
    session: Session,
    page: { from: number; position: number; output: ManagerResult[]; effectiveWaitMs: number } | undefined,
    replayed: boolean,
  ): ManagerResult {
    const position = page?.position ?? session.nextOutputByte;
    const from = page?.from ?? position;
    const output = page?.output ?? [];
    return {
      ...this.snapshot(session),
      result_kind: "process",
      accepted: true,
      replayed,
      read_from_cursor: this.cursor.encode("output", session.id, from),
      next_cursor: this.cursor.encode("output", session.id, position),
      earliest_cursor: this.cursor.encode("output", session.id, session.earliestByte),
      latest_cursor: this.cursor.encode("output", session.id, session.nextOutputByte),
      output,
      has_more_output: session.nextOutputByte > position,
      backlog_bytes: Math.max(0, session.nextOutputByte - position),
      output_bytes: output.reduce((sum, event) => sum + Buffer.byteLength(String(event.data), "utf8"), 0),
      observation_complete: this.complete(session, position),
      effective_wait_ms: page?.effectiveWaitMs ?? 0,
    };
  }
  private snapshot(session: Session): Record<string, unknown> {
    this.syncTranscript(session);
    const spool = session.transcript.health(session.id);
    return {
      server_instance_id: this.instanceId,
      session_id: session.id,
      operation_id: session.operationId,
      status: session.status,
      state_version: session.stateVersion,
      exit_code: session.exitCode,
      signal: session.signal,
      stop_reason: session.stopReason,
      cleanup: { ...session.cleanup },
      stdin_open: session.stdinOpen,
      tty: session.tty,
      elapsed_ms: Math.max(0, Math.round(mono() - (session.startedMono ?? session.createdMono))),
      output_closed: session.outputClosed,
      label: session.label,
      command_summary: session.cmd.length > 256 ? `${session.cmd.slice(0, 256)}…` : session.cmd,
      command_summary_truncated: session.cmd.length > 256,
      spawn_directory: session.cwd,
      created_at: session.createdAt,
      started_at: session.startedAt,
      exited_at: session.exitedAt,
      output_closed_at: session.outputClosedAt,
      last_output_at: session.lastOutputAt,
      retention: {
        target_ms: this.limits.retentionMs,
        result_expires_at: session.resultExpiresAt ? new Date(session.resultExpiresAt).toISOString() : null,
        result_expired: session.resultExpired,
        policy: "Bounded segmented transcript with explicit quota loss.",
      },
      spawn_error: session.spawnError,
      earliest_cursor: this.cursor.encode("output", session.id, session.earliestByte),
      latest_cursor: this.cursor.encode("output", session.id, session.nextOutputByte),
      retained_bytes: session.nextOutputByte - session.earliestByte,
      output_loss: session.outputLossBytes
        ? {
            occurred: true,
            reason: spool.status === "degraded" ? "spool_degraded" : "quota_eviction",
            dropped_bytes: session.outputLossBytes,
            raw_spool_dropped_bytes: session.rawSpoolDroppedBytes,
          }
        : null,
      spool: {
        status: spool.status,
        reason: spool.reason,
        pending_bytes: spool.pendingBytes,
        disk_bytes: spool.diskBytes,
      },
      text_encoding: "utf-8 replacement text; raw bytes retained in transcript when spooled",
      invalid_utf8_observed: session.invalidUtf8,
      terminal_view: session.tty,
    };
  }
  private syncTranscript(session: Session): void {
    session.earliestByte = session.transcript.earliestByte(session.id);
    session.outputLossBytes = session.transcript.outputLoss(session.id);
    session.rawSpoolDroppedBytes = session.transcript.rawSpoolLoss(session.id);
  }
  private trimCompleted(): void {
    const completed = [...this.sessions.values()]
      .filter(
        (value) =>
          value.outputClosed && value.status !== "running" && value.status !== "starting" && !value.resultExpired,
      )
      .sort((left, right) => left.createdOrder - right.createdOrder);
    while (completed.length > this.limits.completedRecords) {
      const oldest = completed.shift();
      if (oldest) this.expireSession(oldest);
    }
  }
  private expireSession(session: Session): void {
    if (session.resultExpired) return;
    session.resultExpired = true;
    const operation = this.operations.get(session.operationId);
    if (operation) operation.resultExpired = true;
    session.transcript.expire(session.id);
    session.events.length = 0;
    session.earliestByte = session.nextOutputByte;
    session.cmd = session.cmd.length > 256 ? `${session.cmd.slice(0, 256)}…` : session.cmd;
  }
  private armResultExpiry(session: Session): void {
    if (session.resultExpiresAt !== null || session.status === "starting" || session.status === "running") return;
    session.resultExpiresAt = Date.now() + this.limits.retentionMs;
    setTimeout(() => {
      if (session.resultExpiresAt !== null && Date.now() >= session.resultExpiresAt) this.expireSession(session);
    }, this.limits.retentionMs).unref();
  }
}
