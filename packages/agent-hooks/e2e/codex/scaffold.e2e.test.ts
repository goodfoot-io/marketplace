/**
 * E2E tests for the codex scaffold command.
 *
 * Installs the scaffolded project's own dependencies (via a `file:`
 * reference to this package) and runs its build/typecheck/lint/test
 * scripts exactly as a real consumer would — the generated hook source's
 * import specifier, the generated biome.json's file scoping, and generated
 * example code's soundness against Codex's real (mostly `unknown`) input
 * types are only exercised end-to-end here, not by the scaffold unit tests
 * (which only inspect generated file contents) or the runtime-and-build e2e
 * suite (which imports the source module directly, bypassing the generated
 * import specifier entirely).
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runTsxCli } from "../claude-code/test-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, "..", "..", "src", "cli.ts");
const PACKAGE_ROOT = path.join(__dirname, "..", "..");

// See e2e/claude-code/scaffold.e2e.test.ts for why this lives under the
// home directory rather than os.tmpdir(): npm installs here pull down
// typescript/vitest/biome per run, which can exceed a small tmpfs overlay.
const SCAFFOLD_TEST_OUTPUT = path.join(os.homedir(), ".agent-hooks-codex-scaffold-e2e");

function runScaffoldCli(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = runTsxCli(CLI_PATH, args, { cwd: path.dirname(CLI_PATH) });
  return { exitCode: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function useLocalPackage(testDir: string): void {
  const packageJsonPath = path.join(testDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as Record<string, unknown>;
  const deps = packageJson.dependencies as Record<string, string>;
  deps["@goodfoot/agent-hooks"] = `file:${PACKAGE_ROOT}`;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function cleanScaffoldTestOutput(): void {
  if (fs.existsSync(SCAFFOLD_TEST_OUTPUT)) {
    fs.rmSync(SCAFFOLD_TEST_OUTPUT, { recursive: true });
  }
}

describe("E2E: codex scaffold command", () => {
  beforeAll(() => {
    cleanScaffoldTestOutput();
    fs.mkdirSync(SCAFFOLD_TEST_OUTPUT, { recursive: true });
  });

  afterAll(() => {
    cleanScaffoldTestOutput();
  });

  it("a scaffolded project with every hook type installs, builds, typechecks, lints, and tests cleanly", () => {
    const testDir = path.join(SCAFFOLD_TEST_OUTPUT, "all-hooks");
    const allHooks = [
      "PreToolUse",
      "PostToolUse",
      "PermissionRequest",
      "UserPromptSubmit",
      "SessionStart",
      "SubagentStart",
      "Stop",
      "SubagentStop",
      "PreCompact",
      "PostCompact",
    ];

    const scaffoldResult = runScaffoldCli([
      "--agent",
      "codex",
      "--scaffold",
      testDir,
      "--hooks",
      allHooks.join(","),
      "-o",
      "dist/hooks.json",
    ]);
    expect(scaffoldResult.exitCode).toBe(0);

    useLocalPackage(testDir);

    const installResult = spawnSync("npm install", {
      cwd: testDir,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 120000,
      shell: true,
    });
    expect(installResult.status).toBe(0);

    const buildResult = spawnSync("npm run build", {
      cwd: testDir,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 60000,
      shell: true,
    });
    expect(buildResult.status).toBe(0);
    expect(fs.existsSync(path.join(testDir, "dist", "hooks.json"))).toBe(true);

    const typecheckResult = spawnSync("npm run typecheck", {
      cwd: testDir,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 60000,
      shell: true,
    });
    expect(typecheckResult.status).toBe(0);

    const lintResult = spawnSync("npm run lint", {
      cwd: testDir,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 60000,
      shell: true,
    });
    expect(lintResult.status).toBe(0);

    const testResult = spawnSync("npm test", {
      cwd: testDir,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 60000,
      shell: true,
    });
    expect(testResult.status).toBe(0);
  }, 240000);
});
