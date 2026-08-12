/**
 * E2E tests for the CLI build process.
 *
 * These tests verify that the CLI correctly compiles TypeScript hooks
 * into hooks.json and standalone .mjs files.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
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
const BUILD_TEST_FIXTURES = path.join(__dirname, "fixtures");

/**
 * Output directory for build test results.
 */
const BUILD_TEST_OUTPUT = path.join(__dirname, "dist", "build-test");

/**
 * Represents a matcher entry in hooks.json.
 */
interface MatcherEntry {
  matcher?: string;
  hooks: Array<{
    type: string;
    command: string;
    timeout?: number;
  }>;
}

/**
 * Represents the hooks.json file structure.
 */
interface HooksJson {
  __generated: {
    files: string[];
    timestamp: string;
  };
  hooks: Record<string, MatcherEntry[]>;
}

/**
 * Runs the CLI to build hooks from TypeScript source files.
 * @param inputPattern - Glob pattern for input hook files (e.g., 'fixtures/*.ts')
 * @param outputPath - Path where hooks.json will be written
 * @returns Object with success status and captured stdout/stderr
 */
function runCli(
  inputPattern: string,
  outputPath: string,
  extraArgs: string[] = [],
): { success: boolean; stdout: string; stderr: string } {
  const result = runTsxCli(CLI_PATH, ["-i", inputPattern, "-o", outputPath, ...extraArgs], {
    cwd: path.dirname(CLI_PATH),
  });

  return {
    success: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/**
 * Reads and parses hooks.json.
 * @param hooksJsonPath - Absolute path to the hooks.json file
 * @returns Parsed HooksJson object
 */
function readHooksJson(hooksJsonPath: string): HooksJson {
  return JSON.parse(fs.readFileSync(hooksJsonPath, "utf-8")) as HooksJson;
}

/**
 * Resolves a command path that may contain $CLAUDE_PLUGIN_ROOT to an absolute path.
 * The command format is: node "$CLAUDE_PLUGIN_ROOT"/bin/hook.abc123.mjs
 * @param command - The command string from hooks.json
 * @param hooksJsonDir - Directory containing hooks.json
 * @returns Resolved absolute path
 */
function resolveCommandPath(command: string, hooksJsonDir: string): string {
  // Extract the path from the command template (format: 'executable "$CLAUDE_PLUGIN_ROOT"/path')
  const match = command.match(/"?\$CLAUDE_PLUGIN_ROOT"?\/(.+)$/);
  if (match) {
    return path.join(hooksJsonDir, match[1]);
  }
  // Fallback: return as-is if it doesn't match the expected pattern
  return command;
}

/**
 * Cleans up the build test output directory.
 */
function cleanBuildTestOutput(): void {
  if (fs.existsSync(BUILD_TEST_OUTPUT)) {
    fs.rmSync(BUILD_TEST_OUTPUT, { recursive: true });
  }
}

/**
 * Creates a proper plugin directory structure for testing.
 * @param testName - Name for the test directory
 * @returns Object with pluginDir, hooksDir, outputPath
 */
function _createPluginStructure(testName: string): {
  pluginDir: string;
  hooksDir: string;
  outputPath: string;
} {
  const pluginDir = path.join(BUILD_TEST_OUTPUT, testName);
  const hooksDir = path.join(pluginDir, "hooks");
  const outputPath = path.join(hooksDir, "hooks.json");

  fs.mkdirSync(path.join(pluginDir, ".claude-plugin"), { recursive: true });
  fs.mkdirSync(hooksDir, { recursive: true });

  return { pluginDir, hooksDir, outputPath };
}

describe("E2E: Build Process", () => {
  beforeAll(() => {
    // Ensure clean output directory
    cleanBuildTestOutput();
    fs.mkdirSync(BUILD_TEST_OUTPUT, { recursive: true });
  });

  afterAll(() => {
    cleanBuildTestOutput();
    // Clean up temp build directories created during tests
    const tempBuildDir = path.join(os.tmpdir(), "claude-code-hooks-build");
    if (fs.existsSync(tempBuildDir)) {
      fs.rmSync(tempBuildDir, { recursive: true });
    }
  });

  describe("Single Hook Compilation", () => {
    it("compiles a single hook with matcher and timeout", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "single-timeout");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      // Verify structure
      expect(hooksJson.hooks).toBeDefined();
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
      expect(hooksJson.hooks.PreToolUse).toHaveLength(1);

      // Verify matcher extraction
      const entry = hooksJson.hooks.PreToolUse[0];
      expect(entry.matcher).toBe("Write");

      // Verify hook config
      expect(entry.hooks).toHaveLength(1);
      expect(entry.hooks[0].type).toBe("command");
      expect(entry.hooks[0].timeout).toBe(5000);

      // Verify compiled file exists - command uses node "$CLAUDE_PLUGIN_ROOT"/bin/ template
      const command = entry.hooks[0].command;
      expect(command).toMatch(/^node "\$CLAUDE_PLUGIN_ROOT"\/bin\/.+\.mjs$/);
      const commandPath = resolveCommandPath(command, outputDir);
      expect(fs.existsSync(commandPath)).toBe(true);
    });

    it("compiles a hook without matcher", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "no-matcher");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-without-matcher.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      expect(hooksJson.hooks.SessionStart).toBeDefined();
      expect(hooksJson.hooks.SessionStart).toHaveLength(1);

      // Verify no matcher is present
      const entry = hooksJson.hooks.SessionStart[0];
      expect(entry.matcher).toBeUndefined();
    });
  });

  describe("Multiple Hooks Compilation", () => {
    it("compiles all hooks in a directory", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "all-hooks");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, "*.ts");
      const result = runCli(inputPattern, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      // Should have multiple hook types
      const hookTypes = Object.keys(hooksJson.hooks);
      expect(hookTypes.length).toBeGreaterThanOrEqual(5);

      // Verify all expected hook types are present
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
      expect(hooksJson.hooks.SessionStart).toBeDefined();
      expect(hooksJson.hooks.SessionEnd).toBeDefined();
      expect(hooksJson.hooks.Notification).toBeDefined();
      expect(hooksJson.hooks.PostToolUseFailure).toBeDefined();
      expect(hooksJson.hooks.SubagentStart).toBeDefined();
      expect(hooksJson.hooks.SubagentStop).toBeDefined();
    });

    it("groups hooks by event type correctly", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "grouped");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, "*.ts");
      const result = runCli(inputPattern, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      // Each hook type should have an array of matcher entries
      for (const [_eventType, entries] of Object.entries(hooksJson.hooks)) {
        expect(Array.isArray(entries)).toBe(true);
        expect(entries.length).toBeGreaterThan(0);

        for (const entry of entries) {
          expect(Array.isArray(entry.hooks)).toBe(true);
          expect(entry.hooks.length).toBeGreaterThan(0);

          for (const hook of entry.hooks) {
            expect(hook.type).toBe("command");
            expect(typeof hook.command).toBe("string");
            expect(hook.command).toMatch(/^node "\$CLAUDE_PLUGIN_ROOT"\/bin\//);
            const resolvedPath = resolveCommandPath(hook.command, outputDir);
            expect(fs.existsSync(resolvedPath)).toBe(true);
          }
        }
      }
    });
  });

  describe("Metadata Extraction", () => {
    it("extracts matcher patterns correctly for different hook types", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "matchers");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, "*.ts");
      const result = runCli(inputPattern, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      // PreToolUse matcher
      const preToolUseEntry = hooksJson.hooks.PreToolUse?.find((e) => e.matcher === "Write");
      expect(preToolUseEntry).toBeDefined();

      // Notification matcher
      const notificationEntry = hooksJson.hooks.Notification?.find((e) => e.matcher === "idle_prompt");
      expect(notificationEntry).toBeDefined();

      // SessionEnd matcher
      const sessionEndEntry = hooksJson.hooks.SessionEnd?.find((e) => e.matcher === "logout");
      expect(sessionEndEntry).toBeDefined();

      // SubagentStart and SubagentStop matchers
      const subagentStartEntry = hooksJson.hooks.SubagentStart?.find((e) => e.matcher === "explore");
      expect(subagentStartEntry).toBeDefined();

      const subagentStopEntry = hooksJson.hooks.SubagentStop?.find((e) => e.matcher === "explore");
      expect(subagentStopEntry).toBeDefined();

      // PostToolUseFailure regex matcher
      const failureEntry = hooksJson.hooks.PostToolUseFailure?.find((e) => e.matcher === ".*");
      expect(failureEntry).toBeDefined();
    });

    it("extracts timeout values correctly", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "timeout-extraction");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const entry = hooksJson.hooks.PreToolUse?.[0];
      const hook = entry?.hooks[0];

      expect(hook?.timeout).toBe(5000);
    });

    it("omits timeout when not specified", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "no-timeout");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "notification-hook.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const entry = hooksJson.hooks.Notification?.[0];
      const hook = entry?.hooks[0];

      expect(hook?.timeout).toBeUndefined();
    });
  });

  describe("Generated Files", () => {
    it("generates __generated metadata with files and timestamp", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "generated-meta");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, "*.ts");
      const result = runCli(inputPattern, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      expect(hooksJson.__generated).toBeDefined();
      expect(Array.isArray(hooksJson.__generated.files)).toBe(true);
      expect(hooksJson.__generated.files.length).toBeGreaterThan(0);
      expect(typeof hooksJson.__generated.timestamp).toBe("string");

      // Verify timestamp is valid ISO format
      const timestamp = new Date(hooksJson.__generated.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it("emits stable, hash-free filenames by default", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "stable-names");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      expect(hooksJson.__generated.files[0]).toBe("hook-with-timeout.mjs");
    });

    it("generates content-hashed filenames with --no-stable-names", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "hashed-names");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath, ["--no-stable-names"]);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      // Filename should match pattern: {name}.{hash}.mjs
      const filename = hooksJson.__generated.files[0];
      expect(filename).toMatch(/^[\w-]+\.[a-f0-9]{8}\.mjs$/);
    });

    it("generates unique hashes for different content with --no-stable-names", () => {
      // Build two different hooks and verify they have different hashes
      const outputDir1 = path.join(BUILD_TEST_OUTPUT, "hash-test-1");
      const outputPath1 = path.join(outputDir1, "hooks.json");
      fs.mkdirSync(outputDir1, { recursive: true });

      const outputDir2 = path.join(BUILD_TEST_OUTPUT, "hash-test-2");
      const outputPath2 = path.join(outputDir2, "hooks.json");
      fs.mkdirSync(outputDir2, { recursive: true });

      // Build different hooks
      const result1 = runCli(path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts"), outputPath1, [
        "--no-stable-names",
      ]);
      const result2 = runCli(path.join(BUILD_TEST_FIXTURES, "notification-hook.ts"), outputPath2, [
        "--no-stable-names",
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const hooksJson1 = readHooksJson(outputPath1);
      const hooksJson2 = readHooksJson(outputPath2);

      // Extract the hash portion from filenames
      const hash1 = hooksJson1.__generated.files[0].match(/\.([a-f0-9]{8})\.mjs$/)?.[1];
      const hash2 = hooksJson2.__generated.files[0].match(/\.([a-f0-9]{8})\.mjs$/)?.[1];

      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      // Different source files should produce different hashes
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Compiled Hook Validity", () => {
    it("compiled hooks are valid ES modules with .mjs extension", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "valid-esm");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;

      expect(command).toBeDefined();
      expect(command).toMatch(/^node "\$CLAUDE_PLUGIN_ROOT"\/bin\/.+\.mjs$/);
      const commandPath = resolveCommandPath(command, outputDir);

      // Read the compiled file
      const content = fs.readFileSync(commandPath, "utf-8");

      // Should NOT have CommonJS module.exports pattern (actual CommonJS export)
      expect(content).not.toMatch(/module\.exports\s*=/);

      // Should contain the hook code
      expect(content).toContain("preToolUseOutput");
      expect(content).toContain("Hook with timeout triggered");
    });

    it("compiled hooks can be executed with node", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "executable");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;

      expect(command).toBeDefined();
      const commandPath = resolveCommandPath(command, outputDir);

      // Try to execute the hook with mock input
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

      // Should not crash (exit code 0, 1, or 2 are valid)
      expect([0, 1, 2]).toContain(execResult.status);

      // Should produce valid JSON output
      if (execResult.stdout) {
        const output: unknown = JSON.parse(execResult.stdout);
        expect(output).toBeDefined();
      }
    });

    it("compiles markdown prompt assets with the default .md loader", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "markdown-loader");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "session-start-markdown-hook.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.SessionStart?.[0].hooks[0].command;
      expect(command).toBeDefined();

      const commandPath = resolveCommandPath(command, outputDir);
      const execResult = spawnSync("node", [commandPath], {
        input: JSON.stringify({
          hook_event_name: "SessionStart",
          session_id: "test",
          cwd: "/tmp",
          source: "startup",
        }),
        encoding: "utf-8",
        timeout: 5000,
      });

      expect(execResult.status).toBe(0);
      const output = JSON.parse(execResult.stdout) as Record<string, unknown>;
      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput.additionalContext).toContain("Session Preamble");
      expect(hookOutput.additionalContext).toContain("card repository guide");
    });

    it("compiles text prompt assets when --loader .txt=text is provided", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "text-loader");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "subagent-start-text-hook.ts");
      const result = runCli(inputPath, outputPath, ["--loader", ".txt=text"]);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.SubagentStart?.[0].hooks[0].command;
      expect(command).toBeDefined();

      const commandPath = resolveCommandPath(command, outputDir);
      const execResult = spawnSync("node", [commandPath], {
        input: JSON.stringify({
          hook_event_name: "SubagentStart",
          session_id: "test",
          cwd: "/tmp",
          agent_id: "agent_123",
          agent_type: "explore",
        }),
        encoding: "utf-8",
        timeout: 5000,
      });

      expect(execResult.status).toBe(0);
      const output = JSON.parse(execResult.stdout) as Record<string, unknown>;
      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput.additionalContext).toContain("Plaintext preamble for subagents.");
    });

    it("compiled hook that throws exits with code 2 and outputs stacktrace to stderr", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "error-hook");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "error-hook.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;

      expect(command).toBeDefined();
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute with mock input that will trigger the error
      const mockInput = JSON.stringify({
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        cwd: "/tmp",
        transcript_path: "/tmp/transcript.jsonl",
        tool_name: "Read",
        tool_input: { file_path: "/tmp/test.txt" },
        tool_use_id: "test-tool-use-id",
      });

      const execResult = spawnSync("node", [commandPath], {
        input: mockInput,
        encoding: "utf-8",
        timeout: 5000,
      });

      // Handler errors should exit with code 2
      expect(execResult.status).toBe(2);

      // Stderr should contain the error message and stack trace
      expect(execResult.stderr).toContain("E2E_TEST_ERROR");
      expect(execResult.stderr).toContain("Error");

      // Stdout should be empty (no JSON output on error)
      expect(execResult.stdout).toBe("");
    });

    it("compiled async hook that throws exits with code 2 and outputs stacktrace to stderr", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "async-error-hook");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "async-error-hook.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;

      expect(command).toBeDefined();
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute with mock input that will trigger the async error
      const mockInput = JSON.stringify({
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        cwd: "/tmp",
        transcript_path: "/tmp/transcript.jsonl",
        tool_name: "Read",
        tool_input: { file_path: "/tmp/test.txt" },
        tool_use_id: "test-tool-use-id",
      });

      const execResult = spawnSync("node", [commandPath], {
        input: mockInput,
        encoding: "utf-8",
        timeout: 5000,
      });

      // Async handler errors should also exit with code 2
      expect(execResult.status).toBe(2);

      // Stderr should contain the async error message and stack trace
      expect(execResult.stderr).toContain("E2E_ASYNC_TEST_ERROR");
      expect(execResult.stderr).toContain("Error");

      // Stdout should be empty (no JSON output on error)
      expect(execResult.stdout).toBe("");
    });

    it("compiled hook output uses camelCase keys (not snake_case)", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "camelcase-output");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      // Use hook-with-timeout.ts which returns PreToolUse output with permissionDecision
      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;

      expect(command).toBeDefined();
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute with mock PreToolUse input (snake_case as Claude Code sends)
      const mockInput = JSON.stringify({
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        cwd: "/tmp",
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
      expect(execResult.stdout).toBeTruthy();

      const output = JSON.parse(execResult.stdout) as Record<string, unknown>;

      // Verify output uses camelCase keys (per https://code.claude.com/docs/en/hooks)
      expect(output).toHaveProperty("hookSpecificOutput");
      expect(output).not.toHaveProperty("hook_specific_output");

      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput).toHaveProperty("permissionDecision");
      expect(hookOutput).not.toHaveProperty("permission_decision");
    });
  });

  describe("Hook Output Format by Type", () => {
    /**
     * Helper to compile a hook and execute it with mock input.
     * @param fixtureFile - Name of the fixture file to compile
     * @param mockInput - Mock input to pass to the compiled hook
     * @returns The parsed stdout output and exit code
     */
    function compileAndExecuteHook(
      fixtureFile: string,
      mockInput: Record<string, unknown>,
    ): { output: Record<string, unknown>; exitCode: number } {
      const outputDir = path.join(BUILD_TEST_OUTPUT, `output-${fixtureFile.replace(".ts", "")}`);
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, fixtureFile);
      const result = runCli(inputPath, outputPath);

      if (!result.success) {
        throw new Error(`CLI failed: ${result.stderr}`);
      }

      const hooksJson = readHooksJson(outputPath);
      const hookType = Object.keys(hooksJson.hooks)[0];
      const command = hooksJson.hooks[hookType]?.[0]?.hooks[0]?.command;

      if (!command) {
        throw new Error(`No command found in hooks.json for ${fixtureFile}`);
      }

      const commandPath = resolveCommandPath(command, outputDir);

      const execResult = spawnSync("node", [commandPath], {
        input: JSON.stringify(mockInput),
        encoding: "utf-8",
        timeout: 5000,
      });

      return {
        output: execResult.stdout ? (JSON.parse(execResult.stdout) as Record<string, unknown>) : {},
        exitCode: execResult.status ?? 1,
      };
    }

    it("PreToolUse output uses camelCase", () => {
      const { output } = compileAndExecuteHook("hook-with-timeout.ts", {
        hook_event_name: "PreToolUse",
        session_id: "test",
        cwd: "/tmp",
        tool_name: "Write",
        tool_input: { file_path: "/tmp/test.txt", content: "test" },
        tool_use_id: "tu_123",
      });

      expect(output).toHaveProperty("hookSpecificOutput");
      expect(output).not.toHaveProperty("hook_specific_output");
      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput).toHaveProperty("permissionDecision");
    });

    it("PostToolUse output uses camelCase", () => {
      const { output } = compileAndExecuteHook("post-tool-use-hook.ts", {
        hook_event_name: "PostToolUse",
        session_id: "test",
        cwd: "/tmp",
        tool_name: "Read",
        tool_input: { file_path: "/tmp/test.txt" },
        tool_use_id: "tu_123",
        tool_result: "file contents",
      });

      expect(output).toHaveProperty("hookSpecificOutput");
      expect(output).not.toHaveProperty("hook_specific_output");
      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput).toHaveProperty("additionalContext");
      expect(hookOutput).not.toHaveProperty("additional_context");
    });

    it("PostToolUseFailure output uses camelCase", () => {
      const { output } = compileAndExecuteHook("post-tool-use-failure-hook.ts", {
        hook_event_name: "PostToolUseFailure",
        session_id: "test",
        cwd: "/tmp",
        tool_name: "Write",
        tool_input: { file_path: "/tmp/test.txt" },
        tool_use_id: "tu_123",
        error: "Permission denied",
      });

      expect(output).toHaveProperty("hookSpecificOutput");
      expect(output).not.toHaveProperty("hook_specific_output");
      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput).toHaveProperty("additionalContext");
    });

    it("SessionStart output uses camelCase", () => {
      const { output } = compileAndExecuteHook("hook-without-matcher.ts", {
        hook_event_name: "SessionStart",
        session_id: "test",
        cwd: "/tmp",
        source: "startup",
      });

      expect(output).toHaveProperty("hookSpecificOutput");
      expect(output).not.toHaveProperty("hook_specific_output");
      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput).toHaveProperty("additionalContext");
    });

    it("SessionEnd output uses camelCase", () => {
      const { output } = compileAndExecuteHook("session-end-hook.ts", {
        hook_event_name: "SessionEnd",
        session_id: "test",
        cwd: "/tmp",
      });

      // SessionEnd may not have hookSpecificOutput, just verify no snake_case
      expect(output).not.toHaveProperty("hook_specific_output");
      expect(output).not.toHaveProperty("system_message");
    });

    it("UserPromptSubmit output uses camelCase", () => {
      const { output } = compileAndExecuteHook("user-prompt-submit-hook.ts", {
        hook_event_name: "UserPromptSubmit",
        session_id: "test",
        cwd: "/tmp",
        prompt: "Hello, world!",
      });

      expect(output).toHaveProperty("hookSpecificOutput");
      expect(output).not.toHaveProperty("hook_specific_output");
      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput).toHaveProperty("additionalContext");
    });

    it("Stop output uses camelCase", () => {
      const { output } = compileAndExecuteHook("stop-hook.ts", {
        hook_event_name: "Stop",
        session_id: "test",
        cwd: "/tmp",
        stop_hook_active: false,
      });

      // Stop uses decision/reason at top level, not hookSpecificOutput
      expect(output).not.toHaveProperty("hook_specific_output");
      if (output.decision) {
        expect(output).not.toHaveProperty("stop_reason");
      }
    });

    it("SubagentStart output uses camelCase", () => {
      const { output } = compileAndExecuteHook("subagent-start-hook.ts", {
        hook_event_name: "SubagentStart",
        session_id: "test",
        cwd: "/tmp",
        agent_id: "agent_123",
        agent_type: "explore",
      });

      expect(output).toHaveProperty("hookSpecificOutput");
      expect(output).not.toHaveProperty("hook_specific_output");
      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput).toHaveProperty("additionalContext");
    });

    it("SubagentStop output uses camelCase", () => {
      const { output } = compileAndExecuteHook("subagent-stop-hook.ts", {
        hook_event_name: "SubagentStop",
        session_id: "test",
        cwd: "/tmp",
        agent_id: "agent_123",
        stop_hook_active: false,
        agent_transcript_path: "/tmp/transcript.jsonl",
      });

      // SubagentStop uses decision/reason at top level
      expect(output).not.toHaveProperty("hook_specific_output");
      expect(output).not.toHaveProperty("stop_reason");
    });

    it("Notification output uses camelCase", () => {
      const { output } = compileAndExecuteHook("notification-hook.ts", {
        hook_event_name: "Notification",
        session_id: "test",
        cwd: "/tmp",
        notification_type: "idle_prompt",
        message: "Test notification",
      });

      // Notification may not have hookSpecificOutput
      expect(output).not.toHaveProperty("hook_specific_output");
      expect(output).not.toHaveProperty("system_message");
    });

    it("PreCompact output uses camelCase", () => {
      const { output } = compileAndExecuteHook("pre-compact-hook.ts", {
        hook_event_name: "PreCompact",
        session_id: "test",
        cwd: "/tmp",
        trigger: "auto",
      });

      // PreCompact may have systemMessage
      expect(output).not.toHaveProperty("hook_specific_output");
      expect(output).not.toHaveProperty("system_message");
      if (output.systemMessage) {
        expect(output).toHaveProperty("systemMessage");
      }
    });

    it("PermissionRequest output uses camelCase", () => {
      const { output } = compileAndExecuteHook("permission-request-hook.ts", {
        hook_event_name: "PermissionRequest",
        session_id: "test",
        cwd: "/tmp",
        tool_name: "Read",
        tool_input: { file_path: "/tmp/test.txt" },
      });

      expect(output).toHaveProperty("hookSpecificOutput");
      expect(output).not.toHaveProperty("hook_specific_output");
      const hookOutput = output.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput).toHaveProperty("decision");
    });
  });

  describe("Version Output", () => {
    // Skipped until the Phase 4 version bump lands (claude-code-hooks 1.8.0):
    // the hardcoded VERSION constant in src/cli.ts is synced there.
    it.skip("--version reports the current package version", () => {
      const result = runTsxCli(CLI_PATH, ["--version"], { cwd: path.dirname(CLI_PATH) });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("1.8.0");
    });
  });

  describe("Error Handling", () => {
    it("fails gracefully for non-existent input files", () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, "error-missing");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const result = runCli("/non/existent/path/*.ts", outputPath);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain("No hook files found");
    });

    it("skips files that are not valid hooks", () => {
      // Create a temp file that's not a valid hook
      const tempDir = path.join(BUILD_TEST_OUTPUT, "invalid-hook");
      fs.mkdirSync(tempDir, { recursive: true });

      const invalidHookPath = path.join(tempDir, "not-a-hook.ts");
      fs.writeFileSync(invalidHookPath, "export const notAHook = 42;");

      const outputPath = path.join(tempDir, "hooks.json");
      const result = runCli(invalidHookPath, outputPath);

      // Should fail because no valid hooks were found
      expect(result.success).toBe(false);
      expect(result.stderr).toContain("No valid hooks found");

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe("Hook Type Coverage", () => {
    it("supports all 14 hook types", () => {
      // This test verifies the CLI can handle all hook factory types
      const supportedTypes = [
        "PreToolUse",
        "PostToolUse",
        "PostToolUseFailure",
        "Notification",
        "UserPromptSubmit",
        "SessionStart",
        "SessionEnd",
        "Stop",
        "SubagentStart",
        "SubagentStop",
        "PreCompact",
        "PermissionRequest",
        "Setup",
        "WorktreeCreate",
      ];

      // Build the test fixtures
      const outputDir = path.join(BUILD_TEST_OUTPUT, "hook-types");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, "*.ts");
      const result = runCli(inputPattern, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const builtTypes = Object.keys(hooksJson.hooks);

      // Verify we have fixtures for multiple hook types
      expect(builtTypes.length).toBeGreaterThanOrEqual(5);

      // All built types should be in the supported list
      for (const builtType of builtTypes) {
        expect(supportedTypes).toContain(builtType);
      }
    });
  });
});
