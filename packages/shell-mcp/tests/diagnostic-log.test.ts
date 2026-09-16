import { type ChildProcess, execFileSync, fork } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import { IsolatedLogger, NullLogger } from "../src/logging/logger.js";
import { captureStartupWarnings } from "../src/logging/sdk-diagnostics.js";
import { IsolatedSink } from "../src/logging/sink.js";

const paths: string[] = [];
const closable: Array<{ close(ms: number): Promise<void> }> = [];
const children: ChildProcess[] = [];
function directory(): string {
  const path = mkdtempSync(join(tmpdir(), "shell-log-"));
  paths.push(path);
  return path;
}
async function waitFor(check: () => boolean): Promise<void> {
  const deadline = performance.now() + 5000;
  while (!check()) {
    if (performance.now() > deadline) throw new Error("Timed out waiting for diagnostic writer");
    await delay(10);
  }
}
afterEach(async () => {
  for (const instance of closable.splice(0)) await instance.close(1000);
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.send("stop");
      await waitFor(() => child.exitCode !== null || child.signalCode !== null);
    }
  }
  for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("optional diagnostic file", () => {
  it("appends one JSON record per line across restarts with owner-only creation permissions", async () => {
    const path = join(directory(), "diagnostics.jsonl");
    for (const index of [1, 2]) {
      const logger = new IsolatedLogger(65_536, 64, { logFile: path });
      closable.push(logger);
      logger.setServerInstanceId(`server-${index}`);
      logger.log("test.event", "session", "multiline\nmessage", {
        logger: "test",
        operationId: `op-${index}`,
        bytes: 3,
      });
      await logger.close(2000);
    }
    const records = readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      serverInstanceId: "server-1",
      sessionId: "session",
      message: "multiline\nmessage",
      bytes: 3,
    });
    expect(records[1]).toMatchObject({ serverInstanceId: "server-2" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("refuses missing parent directories, symlinks, directories and FIFOs without starting", () => {
    const root = directory();
    const target = join(root, "target");
    writeFileSync(target, "preserve");
    const link = join(root, "symlink");
    symlinkSync(target, link);
    const fifo = join(root, "fifo");
    execFileSync("mkfifo", [fifo]);
    for (const path of [join(root, "missing", "log"), root, link, fifo]) {
      expect(() => new IsolatedLogger(65_536, 64, { logFile: path })).toThrow("Cannot open SHELL_MCP_LOG");
    }
    expect(readFileSync(target, "utf8")).toBe("preserve");
  });

  it("writes file diagnostics while the console's inherited stdout is blocked", async () => {
    const path = join(directory(), "diagnostics.jsonl");
    const child = fork(new URL("./fixtures/logger-blocked.mjs", import.meta.url), [], {
      execArgv: ["--import", import.meta.resolve("tsx")],
      env: { ...process.env, SHELL_TEST_LOG: path },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    children.push(child);
    let ready = false;
    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    child.on("message", (value: { kind?: string }) => {
      if (value.kind === "ready") ready = true;
    });
    await waitFor(() => ready);
    await delay(400);
    child.send("diagnostic");
    await waitFor(() => existsSync(path) && readFileSync(path, "utf8").includes("test.probe"));
    expect(stderr).toBe("");
  });

  it("accounts for failed destinations and reports dropped output after recovery", async () => {
    const root = directory();
    const path = join(root, "output");
    writeFileSync(path, "");
    const readOnly = openSync(path, "r");
    let failures = 0;
    const broken = new IsolatedSink(
      1024,
      8,
      readOnly,
      () => "",
      () => {
        failures++;
      },
    );
    closeSync(readOnly);
    closable.push(broken);
    broken.enqueue("cannot write");
    await waitFor(() => broken.health().status === "failed");
    expect(failures).toBe(1);
    expect(broken.health().dropped_records).toBe(1);
    const writable = openSync(path, "a");
    const good = new IsolatedSink(
      512,
      4,
      writable,
      (bytes, records) => `Dropped ${bytes} bytes / ${records} records\n`,
    );
    closeSync(writable);
    closable.push(good);
    good.enqueue("x".repeat(1024));
    good.enqueue("still working\n");
    await good.close(2000);
    expect(readFileSync(path, "utf8")).toContain("Dropped 1024 bytes / 1 records");
    expect(readFileSync(path, "utf8")).toContain("still working");
  });

  it("restores the SDK warning destination even when construction throws", () => {
    const warn = console.warn;
    const logger = new NullLogger();
    expect(() =>
      captureStartupWarnings(logger, () => {
        console.warn("diagnostic");
        throw new Error("construction failed");
      }),
    ).toThrow("construction failed");
    expect(console.warn).toBe(warn);
  });
});
