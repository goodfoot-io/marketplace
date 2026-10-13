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

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { preparePackageSnapshot, prepareYarnProject, runTsxCli, runYarnProject } from "../claude-code/test-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, "..", "..", "src", "cli.ts");
const PACKAGE_ROOT = path.join(__dirname, "..", "..");

const SCAFFOLD_TEST_OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-codex-scaffold-e2e-"));

function runScaffoldCli(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = runTsxCli(CLI_PATH, args, { cwd: path.dirname(CLI_PATH) });
  return { exitCode: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function useLocalPackage(testDir: string): void {
  const packageJsonPath = path.join(testDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as Record<string, unknown>;
  const deps = packageJson.dependencies as Record<string, string>;
  deps["@goodfoot/agent-hooks"] = `file:${preparePackageSnapshot(PACKAGE_ROOT, SCAFFOLD_TEST_OUTPUT)}`;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  prepareYarnProject(testDir);
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

    const installResult = runYarnProject(testDir, ["install"], 90000);
    expect(installResult.status, `${installResult.stdout}\n${installResult.stderr}`).toBe(0);
    expect(installResult.stdout).not.toMatch(/YN0002|YN0060|YN0086/);
    expect(installResult.stderr).toBe("");

    const buildResult = runYarnProject(testDir, ["run", "build"], 20000);
    expect(buildResult.status, `${buildResult.stdout}\n${buildResult.stderr}`).toBe(0);
    expect(fs.existsSync(path.join(testDir, "dist", "hooks.json"))).toBe(true);

    const typecheckResult = runYarnProject(testDir, ["run", "typecheck"], 20000);
    expect(typecheckResult.status, `${typecheckResult.stdout}\n${typecheckResult.stderr}`).toBe(0);

    const lintResult = runYarnProject(testDir, ["run", "lint"], 20000);
    expect(lintResult.status, `${lintResult.stdout}\n${lintResult.stderr}`).toBe(0);

    const testResult = runYarnProject(testDir, ["run", "test"], 20000);
    expect(testResult.status, `${testResult.stdout}\n${testResult.stderr}`).toBe(0);
  }, 240000);
});
