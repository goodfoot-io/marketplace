import { afterEach, describe, expect, it } from "vitest";
import type { ReadInput } from "../src/contracts.js";
import { type ManagerResult, ProcessManager } from "../src/process-manager.js";

/**
 * Settlement (spawn, exit, stream close, retention expiry) is event-driven and
 * can arrive long after the caller's first yield on a loaded host, so these
 * tests wait for the state they assert instead of trusting one fixed window.
 *
 * The settle budget must stay strictly below Vitest's `testTimeout` (see
 * vitest.config.ts). Equal budgets are why a stall used to report as a bare
 * "Test timed out in 20000ms": the framework killed the test at the instant its
 * own deadline expired, so the assertions that would have named the missing
 * state never ran. Every read is also bounded on its own, because a call that
 * never returns is never re-examined by the deadline below it.
 */
const SETTLE_TIMEOUT_MS = 20_000;
const READ_WATCHDOG_MS = 5_000;

const execInput = (
  manager: ProcessManager,
  operation_id: string,
  cmd: string,
  extra: Record<string, unknown> = {},
) => ({
  expected_server_instance_id: manager.instanceId,
  operation_id,
  cmd,
  login: false,
  tty: false,
  timeout_ms: null,
  yield_time_ms: 500,
  max_output_bytes: 16_384,
  ...extra,
});

function outputText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((event) =>
      event !== null && typeof event === "object" && "data" in event ? String((event as { data: unknown }).data) : "",
    )
    .join("");
}

/**
 * A call that never returns must fail by name. Without this the pending promise
 * is never re-examined, so the test's own deadline cannot fire and the run
 * reports a bare framework timeout instead of the call that stalled.
 */
async function within<T>(label: string, call: Promise<T>, ms: number): Promise<T> {
  let watchdog: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      call,
      new Promise<never>((_resolve, reject) => {
        watchdog = setTimeout(() => reject(new Error(`${label} did not return within ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(watchdog);
  }
}

function readWithin(manager: ProcessManager, input: ReadInput): Promise<ManagerResult> {
  return within(`readProcess for ${input.session_id}`, manager.readProcess(input), READ_WATCHDOG_MS);
}

/**
 * Poll until the session reports its output closed, and hand back everything
 * observed. Expiry names the state that was on the wire — which of exit, stream
 * close, or output was still missing is the whole diagnosis.
 */
async function settle(
  manager: ProcessManager,
  sessionId: string,
  first: ManagerResult,
): Promise<{ settled: ManagerResult; output: ManagerResult[] }> {
  let settled = first;
  const output: ManagerResult[] = [...(first.output as ManagerResult[])];
  const expiry = Date.now() + SETTLE_TIMEOUT_MS;
  while (!settled.output_closed) {
    const remaining = expiry - Date.now();
    if (remaining <= 0) throw new Error(await unsettledState(manager, sessionId, settled, output));
    settled = await readWithin(manager, {
      session_id: sessionId,
      cursor: settled.next_cursor as string,
      wait_ms: Math.min(500, remaining),
      max_output_bytes: 16_384,
    });
    output.push(...(settled.output as ManagerResult[]));
  }
  return { settled, output };
}

async function unsettledState(
  manager: ProcessManager,
  sessionId: string,
  settled: ManagerResult,
  output: ManagerResult[],
): Promise<string> {
  let listed: ManagerResult | string;
  try {
    listed = await manager.listProcesses({ include_completed: true, limit: 50 });
  } catch (error) {
    listed = error instanceof Error ? error.message : String(error);
  }
  const processes = typeof listed === "string" ? [] : ((listed.processes as ManagerResult[] | undefined) ?? []);
  const session = processes.find((entry) => entry.session_id === sessionId) ?? null;
  return [
    `output never closed within ${SETTLE_TIMEOUT_MS}ms: session ${sessionId}`,
    `last observed: ${JSON.stringify({
      status: settled.status,
      exit_code: settled.exit_code,
      output_closed: settled.output_closed,
      spool: settled.spool,
      output: outputText(output),
    })}`,
    `listing: ${JSON.stringify(session ?? listed)}`,
  ].join("\n");
}

describe("ProcessManager", () => {
  let manager: ProcessManager;
  afterEach(async () => {
    await manager?.shutdown();
  });

  it("captures fast stdout/stderr and ordinary nonzero exit", async () => {
    manager = new ProcessManager({ pty: false });
    const result = await within(
      "execCommand for the fast command",
      manager.execCommand(execInput(manager, "fast", "printf out; printf err >&2; exit 7")),
      SETTLE_TIMEOUT_MS,
    );
    const { settled, output } = await settle(manager, result.session_id, result);
    expect(settled.status).toBe("exited");
    expect(settled.exit_code).toBe(7);
    expect(settled.output_closed).toBe(true);
    expect(output).toEqual(
      expect.arrayContaining([
        { stream: "stdout", data: "out", seq: expect.any(Number), offset: 0 },
        { stream: "stderr", data: "err", seq: expect.any(Number), offset: 0 },
      ]),
    );
    const listing = await manager.listProcesses({ include_completed: true, limit: 50 });
    expect(listing.capabilities).toMatchObject({ tty_supported: false, tty_status: "disabled" });
  });

  it("replays an accepted operation and rejects conflicting reuse", async () => {
    manager = new ProcessManager({ pty: false });
    const first = await manager.execCommand(execInput(manager, "once", "printf one"));
    const replay = await manager.execCommand(execInput(manager, "once", "printf one"));
    expect(replay.session_id).toBe(first.session_id);
    expect(replay.replayed).toBe(true);
    await expect(manager.execCommand(execInput(manager, "once", "printf two"))).rejects.toMatchObject({
      code: "OPERATION_ID_CONFLICT",
    });
  });

  it("rejects tampered and cross-session cursors", async () => {
    manager = new ProcessManager({ pty: false });
    const first = await manager.execCommand(execInput(manager, "cursor-a", "printf a"));
    const second = await manager.execCommand(execInput(manager, "cursor-b", "printf b"));
    const cursor = String(first.next_cursor);
    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("A") ? "B" : "A"}`;
    await expect(
      manager.readProcess({
        session_id: first.session_id as string,
        cursor: tampered,
        wait_ms: 0,
        max_output_bytes: 16_384,
      }),
    ).rejects.toMatchObject({ code: "CURSOR_INVALID" });
    await expect(
      manager.readProcess({ session_id: second.session_id as string, cursor, wait_ms: 0, max_output_bytes: 16_384 }),
    ).rejects.toMatchObject({ code: "CURSOR_INVALID" });
  });

  it("pages a newline-free multibyte event with a precise cursor", async () => {
    manager = new ProcessManager({ pty: false });
    const first = await manager.execCommand(
      execInput(manager, "pages", "printf '0123456789🙂abcdefghij'", { max_output_bytes: 4 }),
    );
    let output = outputText(first.output);
    let cursor = first.next_cursor;
    while (!first.observation_complete || first.has_more_output) {
      const page = await readWithin(manager, {
        session_id: first.session_id,
        cursor,
        wait_ms: 100,
        max_output_bytes: 4,
      });
      output += outputText(page.output);
      cursor = page.next_cursor;
      if (page.observation_complete && !page.has_more_output) break;
    }
    expect(output).toBe("0123456789🙂abcdefghij");
  });

  it("delivers stdin plus EOF once and replays the write record", async () => {
    manager = new ProcessManager({ pty: false });
    const started = await manager.execCommand(
      execInput(manager, "input", "read value; printf '<%s>' \"$value\"", { yield_time_ms: 0 }),
    );
    const write = await manager.writeStdin({
      session_id: started.session_id,
      write_id: "input-1",
      chars: "answer\n",
      close_stdin: true,
      interrupt: false,
      yield_time_ms: 0,
      max_output_bytes: 16_384,
    });
    expect(write.write).toMatchObject({ delivery_status: "handed_off", close_stdin: true, replayed: false });
    const replay = await manager.writeStdin({
      session_id: started.session_id,
      write_id: "input-1",
      chars: "answer\n",
      close_stdin: true,
      interrupt: false,
      yield_time_ms: 0,
      max_output_bytes: 16_384,
    });
    expect(replay.write).toMatchObject({ replayed: true, delivery_status: "handed_off" });
    await expect(
      manager.writeStdin({
        session_id: started.session_id,
        write_id: "input-2",
        chars: "again",
        close_stdin: false,
        interrupt: false,
        yield_time_ms: 0,
        max_output_bytes: 16_384,
      }),
    ).rejects.toMatchObject({ code: "STDIN_CLOSED" });
    const observed = await readWithin(manager, {
      session_id: started.session_id,
      cursor: write.next_cursor,
      wait_ms: 500,
      max_output_bytes: 16_384,
    });
    await settle(manager, started.session_id, observed);
    const listed = await manager.listProcesses({ include_completed: true, limit: 50 });
    expect(listed.processes[0].output_closed).toBe(true);
  });

  it("rejects an invalid cursor without delivering the accompanying stdin", async () => {
    manager = new ProcessManager({ pty: false });
    const started = await manager.execCommand(
      execInput(manager, "poisoned-cursor", "read value; printf '<%s>' \"$value\"", { yield_time_ms: 0 }),
    );
    await expect(
      manager.writeStdin({
        session_id: started.session_id,
        write_id: "poison",
        chars: "poisoned\n",
        close_stdin: true,
        interrupt: false,
        cursor: "not-a-valid-cursor-token",
        yield_time_ms: 0,
        max_output_bytes: 16_384,
      }),
    ).rejects.toMatchObject({ code: "CURSOR_INVALID" });
    const write = await manager.writeStdin({
      session_id: started.session_id,
      write_id: "answer",
      chars: "answer\n",
      close_stdin: true,
      interrupt: false,
      yield_time_ms: 0,
      max_output_bytes: 16_384,
    });
    expect(write.write).toMatchObject({ delivery_status: "handed_off", close_stdin: true });
    const observed = await readWithin(manager, {
      session_id: started.session_id,
      cursor: write.next_cursor,
      wait_ms: 500,
      max_output_bytes: 16_384,
    });
    const { output } = await settle(manager, started.session_id, observed);
    expect(outputText(output)).toBe("<answer>");
  });

  it("keeps output readable after leader exit while a descendant holds the pipe", async () => {
    manager = new ProcessManager({ pty: false });
    const first = await manager.execCommand(
      execInput(manager, "late", "(sleep .5; printf late) & exit 0", { yield_time_ms: 300 }),
    );
    let status = first.status;
    for (let attempt = 0; attempt < 40 && status !== "exited"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      const listed = await manager.listProcesses({ include_completed: true, limit: 50 });
      const processes = listed.processes as Array<{ session_id: string; status: string }>;
      status = processes.find((process) => process.session_id === first.session_id)?.status ?? status;
    }
    expect(status).toBe("exited");
    const page = await readWithin(manager, {
      session_id: first.session_id,
      cursor: first.next_cursor,
      wait_ms: 1_000,
      max_output_bytes: 100,
    });
    expect(outputText(page.output)).toContain("late");
  });

  it("keeps an output waiter registered across unrelated state changes", async () => {
    manager = new ProcessManager({ pty: false });
    const started = await manager.execCommand(
      execInput(manager, "waiter", "sleep .15; printf wake", { yield_time_ms: 0 }),
    );
    const waitMs = 3_000;
    const began = performance.now();
    let page = await readWithin(manager, {
      session_id: started.session_id,
      cursor: "start",
      wait_ms: waitMs,
      max_output_bytes: 100,
    });
    const elapsed = performance.now() - began;
    const output = [...page.output];
    // This read spans the session's starting -> running transition. That
    // transition must not settle the waiter: without a known_state_version and
    // while the session is incomplete, the only legal way to observe no output
    // is for the wait budget to have expired. An empty page that arrived early
    // is that premature wake, whatever the host's load.
    if (outputText(output) === "" && page.status !== "exited" && page.status !== "failed_to_start") {
      expect(elapsed).toBeGreaterThanOrEqual(waitMs - 250);
    }
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (outputText(output) === "" && Date.now() < deadline) {
      page = await readWithin(manager, {
        session_id: started.session_id,
        cursor: page.next_cursor,
        wait_ms: waitMs,
        max_output_bytes: 100,
      });
      output.push(...page.output);
    }
    expect(outputText(output)).toContain("wake");
  });

  it("retains an operation tombstone after its detailed result expires", async () => {
    manager = new ProcessManager({ pty: false, limits: { retentionMs: 20 } });
    const started = await manager.execCommand(execInput(manager, "expired", "printf once"));
    // The retention clock starts only once the session settles, so poll for the
    // tombstone instead of sleeping a fixed interval.
    let listed = await manager.listProcesses({ operation_id: "expired", include_completed: true, limit: 50 });
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (listed.operation?.retention?.result_expired !== true && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      listed = await manager.listProcesses({ operation_id: "expired", include_completed: true, limit: 50 });
    }
    await expect(manager.execCommand(execInput(manager, "expired", "printf once"))).rejects.toMatchObject({
      code: "OPERATION_RESULT_EXPIRED",
    });
    await expect(
      manager.readProcess({
        session_id: started.session_id,
        cursor: "start",
        wait_ms: 0,
        max_output_bytes: 100,
      }),
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(listed.operation).toMatchObject({ operation_id: "expired", retention: { result_expired: true } });
  });

  it("reports bounded group termination", async () => {
    manager = new ProcessManager({ pty: false });
    const started = await manager.execCommand(
      execInput(manager, "stop", "trap '' TERM; while :; do sleep .05; done", { yield_time_ms: 10 }),
    );
    const stopped = await manager.terminateProcess({ session_id: started.session_id, wait_ms: 2_000 });
    expect(["in_progress", "confirmed", "unverified"]).toContain(stopped.cleanup.status);
    expect(stopped.stop_reason).toBe("user");
  });
});
