import { type ChildProcess, fork } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { inputs } from "../src/contracts.js";
import type { ConsoleEvent } from "../src/logging/console-renderer.js";
import { type DiagnosticFields, NullLogger } from "../src/logging/logger.js";
import { LauncherRelay } from "../src/logging/relay.js";
import { ProcessManager } from "../src/process-manager.js";
import type { ReadyFile } from "../src/serve.js";

class CaptureLogger extends NullLogger {
  readonly events: ConsoleEvent[] = [];
  readonly diagnostics: Array<{ kind: string; text: string; fields: DiagnosticFields }> = [];
  override display(event: ConsoleEvent): void {
    this.events.push(event);
  }
  override log(kind: string, _session: string, text: string, fields: DiagnosticFields = {}): void {
    this.diagnostics.push({ kind, text, fields });
  }
}

const directories: string[] = [];
const managers: ProcessManager[] = [];
const children: ChildProcess[] = [];
function directory(): string {
  const path = mkdtempSync(join(tmpdir(), "shell-console-"));
  directories.push(path);
  return path;
}
function manager(logger: CaptureLogger, bash?: string): ProcessManager {
  const instance = new ProcessManager({ logger, bash, cwd: directory(), spoolRoot: directory(), pty: false });
  managers.push(instance);
  return instance;
}
async function waitFor(check: () => boolean): Promise<void> {
  const deadline = performance.now() + 10_000;
  while (!check()) {
    if (performance.now() > deadline) throw new Error("Timed out waiting for shell state");
    await delay(10);
  }
}
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await waitFor(() => child.exitCode !== null || child.signalCode !== null);
}
afterEach(async () => {
  for (const instance of managers.splice(0)) await instance.shutdown();
  for (const child of children.splice(0)) await stop(child);
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("console events from real Bash processes", () => {
  it("displays accepted commands and inputs once, never on retries or cursor reads", async () => {
    const logger = new CaptureLogger();
    const instance = manager(logger);
    const args = inputs.exec_command.parse({
      expected_server_instance_id: instance.instanceId,
      operation_id: "interactive",
      cmd: "printf 'Name: '; read -r name; printf 'Hello, %s\\n' \"$name\"",
      yield_time_ms: 0,
    });
    const started = await instance.execCommand(args);
    await waitFor(() => logger.events.some((event) => event.type === "output" && event.text.includes("Name:")));
    await instance.execCommand(args);
    const input = inputs.write_stdin.parse({
      session_id: started.session_id,
      write_id: "name",
      chars: "John-private-marker\n",
    });
    await instance.writeStdin(input);
    await instance.writeStdin(input);
    await waitFor(() => logger.events.some((event) => event.type === "complete")).catch((error: unknown) => {
      throw new Error(
        `Completion missing: ${JSON.stringify({ events: logger.events, diagnostics: logger.diagnostics })}`,
        { cause: error },
      );
    });
    await instance.readProcess(
      inputs.read_process.parse({ session_id: started.session_id, cursor: started.earliest_cursor }),
    );
    expect(logger.events.filter((event) => event.type === "command")).toHaveLength(1);
    expect(logger.events.filter((event) => event.type === "input")).toHaveLength(1);
    expect(logger.events.filter((event) => event.type === "complete")).toHaveLength(1);
    expect(JSON.stringify(logger.diagnostics)).not.toContain("John-private-marker");
    expect(JSON.stringify(logger.diagnostics)).not.toContain(args.cmd);
    expect(logger.diagnostics.find((record) => record.kind === "stdin.settled")?.fields.deliveryStatus).toBe(
      "handed_off",
    );
  });

  it("does not return to a prompt at leader exit while a descendant still owns output", async () => {
    const logger = new CaptureLogger();
    const instance = manager(logger);
    await instance.execCommand(
      inputs.exec_command.parse({
        expected_server_instance_id: instance.instanceId,
        operation_id: "late-output",
        cmd: "(sleep 0.4; printf 'late descendant output\\n') & exit 0",
        yield_time_ms: 0,
      }),
    );
    await waitFor(() => logger.diagnostics.some((record) => record.kind === "command.exited"));
    expect(logger.events.some((event) => event.type === "complete")).toBe(false);
    await waitFor(() => logger.events.some((event) => event.type === "complete"));
    const outputIndex = logger.events.findIndex(
      (event) => event.type === "output" && event.text.includes("late descendant"),
    );
    const completionIndex = logger.events.findIndex((event) => event.type === "complete");
    expect(outputIndex).toBeGreaterThan(-1);
    expect(completionIndex).toBeGreaterThan(outputIndex);
  });

  it("includes decoder tails and reports failed spawns without a false success prompt", async () => {
    const logger = new CaptureLogger();
    const instance = manager(logger);
    await instance.execCommand(
      inputs.exec_command.parse({
        expected_server_instance_id: instance.instanceId,
        operation_id: "utf8-tail",
        cmd: "printf '\\342'",
        yield_time_ms: 0,
      }),
    );
    await waitFor(() => logger.events.some((event) => event.type === "complete"));
    expect(logger.events.some((event) => event.type === "output" && event.text === "\uFFFD")).toBe(true);
    const failedLogger = new CaptureLogger();
    const failed = manager(failedLogger, "/no/such/bash");
    await failed.execCommand(
      inputs.exec_command.parse({
        expected_server_instance_id: failed.instanceId,
        operation_id: "bad-spawn",
        cmd: "true",
        yield_time_ms: 0,
      }),
    );
    await waitFor(() => failedLogger.events.some((event) => event.type === "complete"));
    expect(failedLogger.events.find((event) => event.type === "complete")).toMatchObject({
      reason: "failed_to_start",
      code: null,
    });
  });
});

describe("real CLI and JSONL file", () => {
  it("keeps the console natural, resolves a relative log path, and accepts bounded launcher diagnostics", async () => {
    const cwd = directory();
    const readyFile = join(cwd, "ready.json");
    const child = fork(
      new URL("../src/main.ts", import.meta.url),
      [`--port=0`, `--ready-file=${readyFile}`, `--workdir=${cwd}`],
      {
        cwd,
        execArgv: ["--import", import.meta.resolve("tsx")],
        env: { ...process.env, SHELL_MCP_LOG: "diagnostics.jsonl", NO_COLOR: "1" },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    children.push(child);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf8");
    });
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf8");
    });
    await waitFor(() => existsSync(readyFile) || child.exitCode !== null);
    expect(child.exitCode, stderr).toBe(null);
    const ready = JSON.parse(readFileSync(readyFile, "utf8")) as ReadyFile;
    const client = new Client({ name: "console-integration", version: "1" });
    await client.connect(new StreamableHTTPClientTransport(new URL(ready.endpoint)));
    try {
      const result = await client.callTool({
        name: "exec_command",
        arguments: {
          expected_server_instance_id: ready.serverInstanceId,
          operation_id: "cli-output",
          cmd: "printf 'stdout-private-marker\\n'; printf 'stderr-marker\\n' >&2",
          yield_time_ms: 2000,
        },
      });
      expect(result.isError).not.toBe(true);
      const relay = new LauncherRelay(child, true, 2048, 4);
      relay.log("tunnel.test", "first line\nsecond line", { logger: "launcher", level: "info" });
      for (let i = 0; i < 100; i++) relay.log("tunnel.burst", `record ${i}`);
      await waitFor(
        () =>
          existsSync(join(cwd, "diagnostics.jsonl")) &&
          readFileSync(join(cwd, "diagnostics.jsonl"), "utf8").includes('"event":"logger.dropped"'),
      );
      relay.notice("Tunnel test ready");
      await waitFor(() => stdout.includes("Tunnel test ready"));
      relay.close();
    } finally {
      await client.close();
    }
    await stop(child);
    expect(stderr).toBe("");
    expect(stdout).toContain("shell-mcp ready on 127.0.0.1:");
    expect(stdout).toContain(`${cwd} $ printf`);
    expect(stdout).toContain("stdout-private-marker\n");
    expect(stdout).toContain("stderr-marker\n");
    expect(stdout).not.toContain("[output.");
    expect(stdout).not.toContain("mcp.invocation");
    expect(stdout).not.toContain("\x1b[");
    const logFile = join(cwd, "diagnostics.jsonl");
    const text = readFileSync(logFile, "utf8");
    const records = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records.find((record) => record.event === "tunnel.test")).toMatchObject({
      logger: "launcher",
      message: "first line\nsecond line",
      serverInstanceId: ready.serverInstanceId,
    });
    expect(records.every((record) => typeof record.time === "string")).toBe(true);
    expect(records.find((record) => record.event === "sdk.warning")?.message).toContain("drops mid-call notifications");
    expect(records.find((record) => record.event === "logger.dropped")?.records).toBeGreaterThan(0);
    expect(text).not.toContain("stdout-private-marker");
    expect(text).not.toContain("stderr-marker");
    expect(statSync(logFile).mode & 0o777).toBe(0o600);
    expect(existsSync(readyFile)).toBe(false);
  });
});
