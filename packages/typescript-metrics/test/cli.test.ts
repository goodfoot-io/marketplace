import { execSync } from "node:child_process";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");
const cliPath = path.join(__dirname, "../src/metrics.ts");

// Helper to run CLI command
function runCli(args: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node --import tsx ${cliPath} ${args}`, {
      cwd: cwd || fixtureRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout: string; stderr: string; status: number };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || "",
      exitCode: execError.status || 1,
    };
  }
}

describe("CLI", () => {
  it("should print help with -h or --help", () => {
    const result1 = runCli("-h");
    expect(result1.stdout).toContain("typescript-metrics");
    expect(result1.stdout).toContain("Usage:");
    expect(result1.stdout).toContain("Options:");
    expect(result1.exitCode).toBe(0);

    const result2 = runCli("--help");
    expect(result2.stdout).toContain("typescript-metrics");
    expect(result2.exitCode).toBe(0);
  });

  it("should print version with -v or --version", () => {
    const result1 = runCli("-v");
    expect(result1.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result1.exitCode).toBe(0);

    const result2 = runCli("--version");
    expect(result2.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result2.exitCode).toBe(0);
  });

  it("should output markdown report by default", { timeout: 30000 }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("", pkgADir);
    expect(result.exitCode).toBe(0);

    // Should be markdown, not JSON
    expect(result.stdout).toContain("# Codebase Health Report");
    expect(() => JSON.parse(result.stdout)).toThrow();
  });

  it("should output valid JSON with --json flag", { timeout: 30000 }, () => {
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

  it("should parse --metrics flag correctly", () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --metrics coupling,cycles", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.metrics).toHaveProperty("coupling");
    expect(parsed.metrics).toHaveProperty("cycles");
    expect(parsed.metrics).not.toHaveProperty("complexity");
    expect(parsed.metrics).not.toHaveProperty("duplication");
  });

  it("should parse --skip-path-metrics flag", { timeout: 30000 }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --skip-path-metrics", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.options.skipPathMetrics).toBe(true);
  });

  it("should parse --layers flag", { timeout: 30000 }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --layers shared,data,domain,feature,ui,app", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.options.layers).toEqual(["shared", "data", "domain", "feature", "ui", "app"]);
  });

  it("should parse --min-tokens flag", { timeout: 30000 }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --min-tokens 100", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.options.minTokens).toBe(100);
  });

  it("should parse --top-k flag", { timeout: 30000 }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json --top-k 5", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.options.topK).toBe(5);
  });

  it("should use default targets when run in package directory", { timeout: 30000 }, () => {
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");
    const result = runCli("--json", pkgADir);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.targets).toContain("(package default)");
  });

  it("should error when no package.json and no args", () => {
    const tmpDir = path.join(fixtureRoot, "packages");
    const result = runCli("", tmpDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No package.json found");
  });

  it("should exit 0 on success", () => {
    const result = runCli("-h");
    expect(result.exitCode).toBe(0);
  });

  it("should exit 1 on error", () => {
    const tmpDir = path.join(fixtureRoot, "packages");
    const result = runCli("", tmpDir);
    expect(result.exitCode).toBe(1);
  });
});
