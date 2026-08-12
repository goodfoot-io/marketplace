/**
 * E2E tests for the CLI's inline-sourcemap behavior (--no-sourcemap).
 *
 * By default the CLI embeds an inline sourcemap in every compiled bundle.
 * `--no-sourcemap` opts out, shrinking the emitted bytes while keeping the
 * shebang and the hooks.json manifest intact, and the bundle must still run.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runTsxCli } from "./test-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to the CLI script.
 */
const CLI_PATH = path.join(__dirname, "..", "src", "cli.ts");

/**
 * Directory containing build test fixtures.
 */
const SOURCEMAP_TEST_FIXTURES = path.join(__dirname, "fixtures");

/**
 * Output directory for sourcemap test results.
 */
const SOURCEMAP_TEST_OUTPUT = path.join(__dirname, "dist", "sourcemap-test");

/**
 * The shebang written into every compiled bundle by compileAllHooks.
 */
const SHEBANG = "#!/usr/bin/env -S node --enable-source-maps";

/**
 * Runs the CLI to build hooks from TypeScript source files.
 * @param inputPath - Path to the input hook file
 * @param outputPath - Path where hooks.json will be written
 * @param extraArgs - Extra CLI arguments (e.g. --no-sourcemap)
 * @returns Object with success status and captured stdout/stderr
 */
function runCli(
  inputPath: string,
  outputPath: string,
  extraArgs: string[] = [],
): { success: boolean; stdout: string; stderr: string } {
  const result = runTsxCli(CLI_PATH, ["-i", inputPath, "-o", outputPath, ...extraArgs], {
    cwd: path.dirname(CLI_PATH),
  });

  return {
    success: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/**
 * Cleans up the sourcemap test output directory.
 */
function cleanTestOutput(): void {
  if (fs.existsSync(SOURCEMAP_TEST_OUTPUT)) {
    fs.rmSync(SOURCEMAP_TEST_OUTPUT, { recursive: true });
  }
}

describe("E2E: Sourcemap Handling", () => {
  beforeAll(() => {
    cleanTestOutput();
    fs.mkdirSync(SOURCEMAP_TEST_OUTPUT, { recursive: true });
  });

  afterAll(() => {
    cleanTestOutput();
  });

  it("builds with --no-sourcemap: bundles lack the sourcemap, keep the shebang, and hooks.json generates", () => {
    const outputDir = path.join(SOURCEMAP_TEST_OUTPUT, "no-sourcemap");
    const outputPath = path.join(outputDir, "hooks.json");
    fs.mkdirSync(outputDir, { recursive: true });

    const inputPath = path.join(SOURCEMAP_TEST_FIXTURES, "hook-with-timeout.ts");
    const result = runCli(inputPath, outputPath, ["--no-sourcemap"]);

    expect(result.success).toBe(true);

    // hooks.json still generates
    const hooksJson = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as {
      __generated: { files: string[] };
    };
    expect(hooksJson.__generated.files).toHaveLength(1);

    // The emitted bundle lacks the sourcemap comment and keeps the shebang
    const bundlePath = path.join(outputDir, "bin", hooksJson.__generated.files[0]);
    expect(fs.existsSync(bundlePath)).toBe(true);
    const content = fs.readFileSync(bundlePath, "utf-8");
    expect(content).not.toContain("sourceMappingURL");
    expect(content.startsWith(SHEBANG)).toBe(true);
  });

  it("builds with defaults: bundle still contains the inline sourcemap", () => {
    const outputDir = path.join(SOURCEMAP_TEST_OUTPUT, "default");
    const outputPath = path.join(outputDir, "hooks.json");
    fs.mkdirSync(outputDir, { recursive: true });

    const inputPath = path.join(SOURCEMAP_TEST_FIXTURES, "hook-with-timeout.ts");
    const result = runCli(inputPath, outputPath);

    expect(result.success).toBe(true);

    const hooksJson = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as {
      __generated: { files: string[] };
    };
    const bundlePath = path.join(outputDir, "bin", hooksJson.__generated.files[0]);
    const content = fs.readFileSync(bundlePath, "utf-8");
    expect(content).toContain("sourceMappingURL=data:application/json;base64,");
  });

  it("built hook still executes when compiled with --no-sourcemap", () => {
    const outputDir = path.join(SOURCEMAP_TEST_OUTPUT, "no-sourcemap-run");
    const outputPath = path.join(outputDir, "hooks.json");
    fs.mkdirSync(outputDir, { recursive: true });

    const inputPath = path.join(SOURCEMAP_TEST_FIXTURES, "hook-with-timeout.ts");
    const result = runCli(inputPath, outputPath, ["--no-sourcemap"]);
    expect(result.success).toBe(true);

    const hooksJson = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const command = hooksJson.hooks.PreToolUse?.[0]?.hooks[0]?.command;
    expect(command).toBeDefined();
    const commandPath = command?.replace(/^node "\$CLAUDE_PLUGIN_ROOT"\//, `${outputDir}/`) ?? "";
    expect(fs.existsSync(commandPath)).toBe(true);

    // Execute the compiled hook with mock PreToolUse input
    const mockInput = JSON.stringify({
      hook_event_name: "PreToolUse",
      session_id: "test-session",
      cwd: "/tmp",
      transcript_path: "/tmp/transcript.jsonl",
      tool_name: "Write",
      tool_input: { file_path: "/tmp/test.txt", content: "test" },
      tool_use_id: "test-tool-use-id",
    });

    const execResult = spawnSync("node", [commandPath], {
      input: mockInput,
      encoding: "utf-8",
      timeout: 5000,
    });

    expect(execResult.status).toBe(0);
    const output = JSON.parse(execResult.stdout) as Record<string, unknown>;
    expect(output).toHaveProperty("hookSpecificOutput");
  });
});
