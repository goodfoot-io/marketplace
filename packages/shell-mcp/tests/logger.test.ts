import { type ChildProcess, fork } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";

interface FixtureMessage {
  readonly kind: "ready" | "health" | "closed";
  readonly health?: {
    readonly status: string;
    readonly queued_bytes: number;
    readonly queued_records: number;
    readonly dropped_bytes: number;
    readonly dropped_records: number;
    readonly lag_ms: number;
  };
}

const children: ChildProcess[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await onceExit(child);
  }
});

describe("isolated logger", () => {
  it("keeps IPC responsive with a bounded backlog behind blocked stdout", async () => {
    const child = fork(new URL("./fixtures/logger-blocked.mjs", import.meta.url), [], {
      execArgv: ["--import", "tsx"],
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    children.push(child);
    const diagnostic: string[] = [];
    child.stderr?.on("data", (data: Buffer) => diagnostic.push(data.toString("utf8")));
    await waitFor(child, "ready");
    await delay(400);
    const started = performance.now();
    const healthPromise = waitFor(child, "health");
    child.send("health");
    const health = (await healthPromise).health;
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(health).toBeDefined();
    expect(health?.dropped_bytes).toBeGreaterThan(0);
    expect(health?.queued_bytes).toBeLessThanOrEqual(32_768);
    expect(health?.queued_records).toBeLessThanOrEqual(32);
    expect(health?.lag_ms).toBeGreaterThan(0);
    expect(diagnostic.join("")).toBe("");

    const closed = waitFor(child, "closed");
    child.send("stop");
    await closed;
    await onceExit(child);
    expect(child.exitCode).toBe(0);
  }, 6_000);
});

function waitFor(child: ChildProcess, kind: FixtureMessage["kind"], timeoutMs = 3_000): Promise<FixtureMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`Timed out waiting for ${kind}`)), timeoutMs);
    const message = (value: FixtureMessage): void => {
      if (value?.kind === kind) finish(undefined, value);
    };
    const error = (value: Error): void => finish(value);
    const exit = (code: number | null, signal: NodeJS.Signals | null): void =>
      finish(new Error(`Fixture exited before ${kind}: ${code ?? signal}`));
    const finish = (errorValue?: Error, value?: FixtureMessage): void => {
      clearTimeout(timer);
      child.off("message", message);
      child.off("error", error);
      child.off("exit", exit);
      if (errorValue) reject(errorValue);
      else if (value) resolve(value);
    };
    child.on("message", message);
    child.once("error", error);
    child.once("exit", exit);
  });
}

function onceExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", () => resolve()));
}
