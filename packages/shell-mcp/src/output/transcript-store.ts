import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomId } from "../util/opaque.js";

export type TranscriptStream = "stdout" | "stderr" | "terminal";

export interface TranscriptEvent {
  seq: number;
  stream: TranscriptStream;
  start: number;
  /** UTF-8 replacement view used by the tool contract. */
  bytes: Buffer;
  text: string;
  /** Bytes received from the operating-system stream, before decoding. */
  raw: Buffer;
}

export interface TranscriptLimits {
  memoryPerSession: number;
  memoryGlobal: number;
  diskPerSession: number;
  diskGlobal: number;
  segmentBytes: number;
  segmentEvents: number;
  maxSegments: number;
  pendingBytes: number;
  pendingEntries: number;
  root: string;
}

export interface TranscriptHealth {
  status: "healthy" | "degraded" | "closed";
  reason: string | null;
  pendingBytes: number;
  diskBytes: number;
}

interface Segment {
  path: string;
  start: number;
  end: number;
  bytes: number;
  events: number;
  complete: boolean;
}

interface RecordOnDisk {
  seq: number;
  stream: TranscriptStream;
  start: number;
  text: string;
  bytes: string;
  raw: string;
}

interface SessionStore {
  memory: TranscriptEvent[];
  memoryBytes: number;
  segments: Segment[];
  pending: Array<{ event: TranscriptEvent; encoded: Buffer; reserved: number }>;
  pendingBytes: number;
  draining: boolean;
  nextOutputByte: number;
  earliestByte: number;
  outputLossBytes: number;
  rawSpoolDroppedBytes: number;
  lossRanges: Array<{ start: number; end: number; reason: string }>;
  health: TranscriptHealth;
  expired: boolean;
}

/**
 * A bounded, append-only transcript. Recent events are kept in memory while a
 * single bounded writer drains newline-delimited records into bounded segment
 * files. Segment metadata is intentionally small; event indexes are rebuilt
 * from a segment when a read needs it.
 */
export class TranscriptStore {
  private readonly sessions = new Map<string, SessionStore>();
  private readonly retirements = new Map<string, Promise<void>>();
  private readonly root: string;
  private readonly limits: TranscriptLimits;
  private globalMemory = 0;
  private globalDisk = 0;
  private globalPending = 0;
  private closed = false;
  private rootFailure: unknown;
  private closeTask?: Promise<void>;
  private rootReady: Promise<void>;
  private readonly onChange?: (sessionId: string) => void;

  constructor(limits: TranscriptLimits, onChange?: (sessionId: string) => void) {
    this.limits = { ...limits };
    this.root = limits.root;
    this.onChange = onChange;
    this.rootReady = mkdir(this.root, { recursive: true })
      .then(() => undefined)
      .catch((error) => {
        this.rootFailure = error;
      });
  }

  create(sessionId: string): void {
    this.state(sessionId);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  append(sessionId: string, event: TranscriptEvent): void {
    if (this.closed) return;
    const state = this.state(sessionId);
    state.nextOutputByte = Math.max(state.nextOutputByte, event.start + event.bytes.length);
    state.memory.push(event);
    state.memoryBytes += event.bytes.length;
    this.globalMemory += event.bytes.length;

    const encoded = Buffer.from(
      `${JSON.stringify({
        seq: event.seq,
        stream: event.stream,
        start: event.start,
        text: event.text,
        bytes: event.bytes.toString("base64"),
        raw: event.raw.toString("base64"),
      })}\n`,
      "utf8",
    );
    const canQueue =
      state.pending.length < this.limits.pendingEntries &&
      state.pendingBytes + encoded.length <= this.limits.pendingBytes &&
      this.globalPending + encoded.length <= this.limits.pendingBytes &&
      this.globalDisk + this.globalPending + encoded.length <= this.limits.diskGlobal &&
      this.diskFor(state) + state.pendingBytes + encoded.length <= this.limits.diskPerSession;
    if (canQueue) {
      state.pending.push({ event, encoded, reserved: encoded.length });
      state.pendingBytes += encoded.length;
      this.globalPending += encoded.length;
      state.health.pendingBytes = state.pendingBytes;
      void this.drain(sessionId, state);
    } else {
      this.degrade(state, "transcript spool quota or pending-write bound reached");
    }
    this.evict(sessionId, state);
  }

  nextByte(sessionId: string): number {
    return this.sessions.get(sessionId)?.nextOutputByte ?? 0;
  }
  earliestByte(sessionId: string): number {
    return this.sessions.get(sessionId)?.earliestByte ?? 0;
  }
  outputLoss(sessionId: string): number {
    return this.sessions.get(sessionId)?.outputLossBytes ?? 0;
  }
  rawSpoolLoss(sessionId: string): number {
    return this.sessions.get(sessionId)?.rawSpoolDroppedBytes ?? 0;
  }
  retainedBytes(): number {
    let total = 0;
    for (const state of this.sessions.values()) total += Math.max(0, state.nextOutputByte - state.earliestByte);
    return total;
  }
  loss(sessionId: string): boolean {
    return (this.sessions.get(sessionId)?.lossRanges.length ?? 0) > 0;
  }
  health(sessionId: string): TranscriptHealth {
    const state = this.sessions.get(sessionId);
    return state
      ? { ...state.health, diskBytes: this.diskFor(state) }
      : { status: "closed", reason: null, pendingBytes: 0, diskBytes: 0 };
  }

  async page(
    sessionId: string,
    position: number,
    budget: number,
    maxEvents: number,
  ): Promise<{ position: number; output: Array<Record<string, unknown>> }> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error(`Transcript store is unavailable for session ${sessionId}.`);
    if (position < state.earliestByte) {
      throw new TranscriptGapError(
        "CURSOR_EXPIRED",
        "Requested output is outside the retained range.",
        state.earliestByte,
        state.nextOutputByte,
        state.outputLossBytes,
      );
    }
    const events = await this.eventsFrom(state, position);
    if (events.length === 0) {
      const gap = state.lossRanges.find((range) => range.end > position && range.start < state.nextOutputByte);
      if (gap) {
        throw new TranscriptGapError(
          "OUTPUT_GAP",
          "Transcript history contains a missing tail segment.",
          gap.end,
          state.nextOutputByte,
          state.outputLossBytes,
        );
      }
    }
    let current = position;
    let remaining = budget;
    const output: Array<Record<string, unknown>> = [];
    for (const event of events) {
      if (event.start + event.bytes.length <= current) continue;
      if (event.start > current && this.hasGap(state, current, event.start)) {
        throw new TranscriptGapError(
          "OUTPUT_GAP",
          "Transcript history contains a missing segment.",
          event.start,
          state.nextOutputByte,
          state.outputLossBytes,
        );
      }
      const offset = Math.max(0, current - event.start);
      const text = prefix(event.bytes.subarray(offset), remaining);
      if (!text) continue;
      const bytes = Buffer.byteLength(text, "utf8");
      output.push({ seq: event.seq, stream: event.stream, offset, data: text });
      current += bytes;
      remaining -= bytes;
      if (remaining <= 0 || output.length >= maxEvents) break;
    }
    return { position: current, output };
  }

  canRetire(sessionId: string): boolean {
    return !this.sessions.has(sessionId) || this.retirements.has(sessionId) || this.retirements.size < 64;
  }

  retire(sessionId: string): Promise<void> | null {
    const existing = this.retirements.get(sessionId);
    if (existing) return existing;
    const state = this.sessions.get(sessionId);
    if (!state) return Promise.resolve();
    if (this.retirements.size >= 64) return null;
    for (const event of state.memory) this.globalMemory -= event.bytes.length;
    this.globalPending -= state.pendingBytes;
    this.globalDisk -= this.diskFor(state);
    state.memory.length = 0;
    state.pending.length = 0;
    state.segments.length = 0;
    state.expired = true;
    state.earliestByte = state.nextOutputByte;
    this.sessions.delete(sessionId);
    const retirement = this.finishRetirement(sessionId, state).finally(() => {
      this.retirements.delete(sessionId);
      this.onChange?.(sessionId);
    });
    this.retirements.set(sessionId, retirement);
    return retirement;
  }

  async close(): Promise<void> {
    if (this.closeTask) return this.closeTask;
    this.closeTask = this.doClose();
    return this.closeTask;
  }

  private async doClose(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.rootReady.catch(() => undefined);
    await Promise.all(
      [...this.sessions.values()].map(async (state) => {
        while (state.draining) await new Promise((resolveWait) => setTimeout(resolveWait, 0));
      }),
    );
    while (this.retirements.size > 0) await Promise.all([...this.retirements.values()]);
    await rm(this.root, { recursive: true, force: true });
    this.sessions.clear();
    this.globalMemory = 0;
    this.globalDisk = 0;
    this.globalPending = 0;
  }

  private async finishRetirement(sessionId: string, state: SessionStore): Promise<void> {
    while (state.draining) await new Promise((resolveWait) => setTimeout(resolveWait, 0));
    try {
      await rm(join(this.root, sessionId), { recursive: true, force: true });
    } catch (error) {
      state.health.status = "degraded";
      state.health.reason = `transcript cleanup failed: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`;
    }
  }

  private state(sessionId: string): SessionStore {
    let state = this.sessions.get(sessionId);
    if (!state) {
      state = {
        memory: [],
        memoryBytes: 0,
        segments: [],
        pending: [],
        pendingBytes: 0,
        draining: false,
        nextOutputByte: 0,
        earliestByte: 0,
        outputLossBytes: 0,
        rawSpoolDroppedBytes: 0,
        lossRanges: [],
        health: { status: "healthy", reason: null, pendingBytes: 0, diskBytes: 0 },
        expired: false,
      };
      this.sessions.set(sessionId, state);
    }
    return state;
  }

  private async drain(sessionId: string, state: SessionStore): Promise<void> {
    if (state.draining) return;
    state.draining = true;
    try {
      await this.rootReady;
      if (this.rootFailure) throw this.rootFailure;
      while (state.pending.length && !this.closed && !state.expired) {
        const item = state.pending.shift();
        if (!item) break;
        state.pendingBytes -= item.encoded.length;
        this.globalPending -= item.encoded.length;
        state.health.pendingBytes = state.pendingBytes;
        try {
          const segment = this.segmentFor(sessionId, state, item.event, item.encoded.length);
          await mkdir(join(this.root, sessionId), { recursive: true });
          await appendFile(segment.path, item.encoded, { flag: "a" });
          segment.bytes += item.encoded.length;
          segment.end = item.event.start + item.event.bytes.length;
          segment.events++;
          segment.complete = segment.bytes >= this.limits.segmentBytes || segment.events >= this.limits.segmentEvents;
          if (state.expired || this.closed) {
            await rm(segment.path, { force: true });
          } else {
            this.globalDisk += item.encoded.length;
            this.markPersisted(state, item.event);
            this.evict(sessionId, state);
            this.trimSegments(state);
          }
        } catch (error) {
          this.degrade(
            state,
            `transcript spool write failed: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`,
          );
          this.recordEventLoss(state, item.event);
          this.evict(sessionId, state);
        }
        this.onChange?.(sessionId);
      }
    } catch (error) {
      this.degrade(
        state,
        `transcript spool initialization failed: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`,
      );
      while (state.pending.length) {
        const item = state.pending.shift();
        if (!item) break;
        state.pendingBytes -= item.encoded.length;
        this.globalPending -= item.encoded.length;
      }
      state.health.pendingBytes = 0;
      this.evict(sessionId, state);
    } finally {
      state.draining = false;
      state.health.pendingBytes = state.pendingBytes;
      this.onChange?.(sessionId);
    }
  }

  private segmentFor(sessionId: string, state: SessionStore, event: TranscriptEvent, recordBytes: number): Segment {
    const current = state.segments[state.segments.length - 1];
    if (current && !current.complete && current.bytes + recordBytes <= this.limits.segmentBytes) return current;
    const path = join(this.root, sessionId, `segment-${randomId("segment")}.log`);
    const segment: Segment = { path, start: event.start, end: event.start, bytes: 0, events: 0, complete: false };
    state.segments.push(segment);
    return segment;
  }

  private markPersisted(_state: SessionStore, event: TranscriptEvent): void {
    // A marker is attached without adding another index or retaining another copy.
    Object.defineProperty(event, "__spooled", { value: true, configurable: true });
  }

  private evict(_sessionId: string, state: SessionStore): void {
    while (
      (state.memoryBytes > this.limits.memoryPerSession || this.globalMemory > this.limits.memoryGlobal) &&
      state.memory.length
    ) {
      const event = state.memory[0];
      if (!event) break;
      const persisted = (event as TranscriptEvent & { __spooled?: boolean }).__spooled === true;
      if (!persisted && state.pending.length && state.pending[0]?.event === event) {
        // Keep the in-flight range readable until publication completes.
        break;
      }
      state.memory.shift();
      state.memoryBytes -= event.bytes.length;
      this.globalMemory -= event.bytes.length;
      if (!persisted) this.recordEventLoss(state, event);
      this.recomputeEarliest(state);
    }
    this.trimSegments(state);
  }

  private trimSegments(state: SessionStore): void {
    while (
      state.segments.length > this.limits.maxSegments ||
      this.diskFor(state) > this.limits.diskPerSession ||
      this.globalDisk > this.limits.diskGlobal
    ) {
      const first = state.segments[0];
      if (!first || first === state.segments[state.segments.length - 1]) break;
      state.segments.shift();
      this.globalDisk -= first.bytes;
      void rm(first.path, { force: true });
      for (const event of state.memory) {
        if (event.start < first.end && event.start + event.bytes.length > first.start)
          Object.defineProperty(event, "__spooled", { value: false, configurable: true });
      }
      const firstMemory = state.memory[0];
      const lastMemory = state.memory[state.memory.length - 1];
      const covered =
        firstMemory !== undefined &&
        lastMemory !== undefined &&
        firstMemory.start <= first.start &&
        lastMemory.start + lastMemory.bytes.length >= first.end;
      if (!covered) this.recordLoss(state, first.start, first.end, Math.max(0, first.end - first.start), 0);
    }
  }

  private diskFor(state: SessionStore): number {
    return state.segments.reduce((sum, segment) => sum + segment.bytes, 0);
  }
  private degrade(state: SessionStore, reason: string): void {
    state.health.status = "degraded";
    state.health.reason ??= reason;
  }
  private recordEventLoss(state: SessionStore, event: TranscriptEvent): void {
    const marker = event as TranscriptEvent & { __lossRecorded?: boolean };
    if (marker.__lossRecorded) return;
    Object.defineProperty(event, "__lossRecorded", { value: true, configurable: true });
    this.recordLoss(state, event.start, event.start + event.bytes.length, event.bytes.length, event.raw.length);
  }
  private recordLoss(state: SessionStore, start: number, end: number, _bytes: number, rawBytes: number): void {
    if (end <= start) return;
    const reason = state.health.reason ?? "quota";
    const existing = state.lossRanges
      .filter((range) => range.end > start && range.start < end)
      .map((range) => ({ start: Math.max(start, range.start), end: Math.min(end, range.end) }))
      .sort((left, right) => left.start - right.start);
    let covered = 0;
    let coveredEnd = start;
    for (const range of existing) {
      if (range.end <= coveredEnd) continue;
      const from = Math.max(range.start, coveredEnd);
      covered += range.end - from;
      coveredEnd = range.end;
    }
    const uncovered = end - start - covered;
    state.outputLossBytes += Math.max(0, uncovered);
    if (existing.length === 0) state.rawSpoolDroppedBytes += rawBytes;
    const merged = [...state.lossRanges, { start, end, reason }].sort((left, right) => left.start - right.start);
    state.lossRanges = [];
    for (const range of merged) {
      const previous = state.lossRanges[state.lossRanges.length - 1];
      if (previous && previous.end >= range.start && previous.reason === range.reason)
        previous.end = Math.max(previous.end, range.end);
      else if (state.lossRanges.length < 64) state.lossRanges.push({ ...range });
      else {
        const last = state.lossRanges[63];
        if (last) last.end = Math.max(last.end, range.end);
      }
    }
    this.recomputeEarliest(state);
  }
  private hasGap(state: SessionStore, start: number, end: number): boolean {
    return state.lossRanges.some((range) => range.start < end && range.end > start);
  }
  private recomputeEarliest(state: SessionStore): void {
    const starts = [state.nextOutputByte];
    if (state.memory.length) starts.push(state.memory[0]?.start);
    if (state.segments.length) starts.push(state.segments[0]?.start);
    state.earliestByte = Math.min(...starts);
  }
  private async eventsFrom(state: SessionStore, position: number): Promise<TranscriptEvent[]> {
    const found = new Map<number, TranscriptEvent>();
    for (const event of state.memory) if (event.start + event.bytes.length > position) found.set(event.seq, event);
    for (const segment of state.segments) {
      if (segment.end <= position || segment.bytes === 0) continue;
      let records: RecordOnDisk[];
      try {
        records = (await readFile(segment.path, "utf8"))
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as RecordOnDisk);
      } catch (error) {
        this.degrade(
          state,
          `transcript spool read failed: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`,
        );
        throw new TranscriptGapError(
          "STORAGE_UNAVAILABLE",
          "A retained transcript segment cannot be read.",
          position,
          state.nextOutputByte,
          state.outputLossBytes,
        );
      }
      for (const record of records) {
        const bytes = Buffer.from(record.bytes, "base64");
        if (record.start + bytes.length <= position) continue;
        found.set(record.seq, {
          seq: record.seq,
          stream: record.stream,
          start: record.start,
          text: record.text,
          bytes,
          raw: Buffer.from(record.raw, "base64"),
        });
      }
    }
    return [...found.values()].sort((left, right) => left.start - right.start || left.seq - right.seq);
  }
}

export class TranscriptGapError extends Error {
  constructor(
    readonly code: "CURSOR_EXPIRED" | "OUTPUT_GAP" | "STORAGE_UNAVAILABLE",
    message: string,
    readonly earliest: number,
    readonly latest: number,
    readonly dropped: number,
  ) {
    super(message);
  }
}

function prefix(bytes: Buffer, budget: number): string {
  if (bytes.length <= budget) return bytes.toString("utf8");
  const text = bytes.toString("utf8");
  let used = 0;
  let result = "";
  for (const character of text) {
    const width = Buffer.byteLength(character, "utf8");
    if (used + width > budget) break;
    result += character;
    used += width;
  }
  return result;
}
