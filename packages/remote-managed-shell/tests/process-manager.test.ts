import { afterEach, describe, expect, it } from "vitest";
import { ProcessManager } from "../src/process-manager.js";

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

describe("ProcessManager", () => {
  let manager: ProcessManager;
  afterEach(async () => {
    await manager?.shutdown();
  });

  it("captures fast stdout/stderr and ordinary nonzero exit", async () => {
    manager = new ProcessManager({ pty: false });
    const result = await manager.execCommand(execInput(manager, "fast", "printf out; printf err >&2; exit 7"));
    expect(result.status).toBe("exited");
    expect(result.exit_code).toBe(7);
    const settled = result.output_closed
      ? result
      : await manager.readProcess({
          session_id: result.session_id,
          cursor: result.next_cursor,
          wait_ms: 500,
          max_output_bytes: 16_384,
        });
    expect(settled.output_closed).toBe(true);
    const output = [...result.output, ...settled.output];
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
      const page = await manager.readProcess({
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
    const observed = await manager.readProcess({
      session_id: started.session_id,
      cursor: write.next_cursor,
      wait_ms: 500,
      max_output_bytes: 16_384,
    });
    if (!observed.output_closed)
      await manager.readProcess({
        session_id: started.session_id,
        cursor: observed.next_cursor,
        wait_ms: 500,
        max_output_bytes: 16_384,
      });
    const listed = await manager.listProcesses({ include_completed: true, limit: 50 });
    expect(listed.processes[0].output_closed).toBe(true);
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
    const page = await manager.readProcess({
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
    const began = performance.now();
    const page = await manager.readProcess({
      session_id: started.session_id,
      cursor: "start",
      wait_ms: 3_000,
      max_output_bytes: 100,
    });
    expect(outputText(page.output)).toContain("wake");
    expect(performance.now() - began).toBeLessThan(2_000);
  });

  it("retains an operation tombstone after its detailed result expires", async () => {
    manager = new ProcessManager({ pty: false, limits: { retentionMs: 20 } });
    const started = await manager.execCommand(execInput(manager, "expired", "printf once"));
    await new Promise((resolve) => setTimeout(resolve, 50));
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
    const listed = await manager.listProcesses({ operation_id: "expired", include_completed: true, limit: 50 });
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
