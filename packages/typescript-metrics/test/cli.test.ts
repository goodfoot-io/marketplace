import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadavg } from "node:os";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");
const cliPath = path.join(__dirname, "../src/metrics.ts");

// These are correctness checks, not throughput measurements. Each command is
// bounded independently; two-command tests budget both children plus cleanup.
const childTimeout = 90_000;
const singleCommandTimeout = childTimeout + 15_000;
const twoCommandTimeout = childTimeout * 2 + 15_000;

// Helper to run CLI command
function runCli(args: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  const started = performance.now();
  const cpuStarted = process.cpuUsage();
  try {
    const stdout = execFileSync(process.execPath, ["--import", "tsx", cliPath, ...args.split(" ").filter(Boolean)], {
      cwd: cwd || fixtureRoot,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: childTimeout,
      killSignal: "SIGKILL",
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    if (typeof error !== "object" || error === null) throw error;
    const stdout = "stdout" in error && typeof error.stdout === "string" ? error.stdout : "";
    const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
    const status = "status" in error && typeof error.status === "number" ? error.status : null;
    const signal = "signal" in error && typeof error.signal === "string" ? error.signal : null;
    const code = "code" in error && typeof error.code === "string" ? error.code : null;
    if (status === null || status === 0 || signal || code === "ETIMEDOUT") {
      let cpuPressure = "unavailable";
      try {
        cpuPressure = readFileSync("/proc/pressure/cpu", "utf8").trim();
      } catch {
        // CPU pressure is an optional Linux diagnostic, not a test prerequisite.
      }
      throw new Error(
        `CLI transport failure: ${JSON.stringify({
          args,
          cwd: cwd || fixtureRoot,
          timeoutMs: childTimeout,
          elapsedMs: performance.now() - started,
          parentCpu: process.cpuUsage(cpuStarted),
          loadavg: loadavg(),
          cpuPressure,
          status,
          signal,
          code,
          stdout: stdout.slice(-4096),
          stderr: stderr.slice(-4096),
        })}`,
        { cause: error },
      );
    }
    return { stdout, stderr, exitCode: status };
  }
}

describe("CLI", () => {
  it("should print help with -h or --help", { timeout: twoCommandTimeout }, () => {
    const result1 = runCli("-h");
    expect(result1.stdout).toContain("typescript-metrics");
    expect(result1.stdout).toContain("Usage:");
    expect(result1.stdout).toContain("Options:");
    expect(result1.exitCode).toBe(0);

    const result2 = runCli("--help");
    expect(result2.stdout).toContain("typescript-metrics");
    expect(result2.exitCode).toBe(0);
  });

  it("should print version with -v or --version", { timeout: twoCommandTimeout }, () => {
    const result1 = runCli("-v");
    expect(result1.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result1.exitCode).toBe(0);

    const result2 = runCli("--version");
    expect(result2.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result2.exitCode).toBe(0);
  });

  it("should output markdown report by default", { timeout: singleCommandTimeout }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("", pkgADir);
    expect(result.exitCode).toBe(0);

    // Should be markdown, not JSON
    expect(result.stdout).toContain("# Codebase Health Report");
    expect(() => JSON.parse(result.stdout)).toThrow();
  });

  it("should output valid JSON with --json flag", { timeout: singleCommandTimeout }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json", pkgADir);
    expect(result.exitCode).toBe(0);

    // Should be valid JSON
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("version");
    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("targets");
    expect(parsed).toHaveProperty("options");
    expect(parsed).toHaveProperty("metrics");
  });

  it("should parse --metrics flag correctly", { timeout: singleCommandTimeout }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --metrics coupling,cycles", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.metrics).toHaveProperty("coupling");
    expect(parsed.metrics).toHaveProperty("cycles");
    expect(parsed.metrics).not.toHaveProperty("complexity");
    expect(parsed.metrics).not.toHaveProperty("duplication");
  });

  it("should parse --skip-path-metrics flag", { timeout: singleCommandTimeout }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --skip-path-metrics", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.options.skipPathMetrics).toBe(true);
  });

  it("should parse --layers flag", { timeout: singleCommandTimeout }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --layers shared,data,domain,feature,ui,app", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.options.layers).toEqual(["shared", "data", "domain", "feature", "ui", "app"]);
  });

  it("should parse --min-tokens flag", { timeout: singleCommandTimeout }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --min-tokens 100", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.options.minTokens).toBe(100);
  });

  it("should parse --top-k flag", { timeout: singleCommandTimeout }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --top-k 5", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.options.topK).toBe(5);
  });

  it("should use default targets when run in package directory", { timeout: singleCommandTimeout }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.targets).toContain("(package default)");
  });

  it("should error when no package.json and no args", { timeout: singleCommandTimeout }, () => {
    const tmpDir = path.join(fixtureRoot, "packages");
    const result = runCli("", tmpDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No package.json found");
  });

  it("should exit 0 on success", { timeout: singleCommandTimeout }, () => {
    const result = runCli("-h");
    expect(result.exitCode).toBe(0);
  });

  it("should exit 1 on error", { timeout: singleCommandTimeout }, () => {
    const tmpDir = path.join(fixtureRoot, "packages");
    const result = runCli("", tmpDir);
    expect(result.exitCode).toBe(1);
  });
});
