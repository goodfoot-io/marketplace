/**
 * E2E tests for the --log CLI parameter.
 *
 * These tests verify that the --log parameter correctly configures
 * hook runtime logging, equivalent to CLAUDE_CODE_HOOKS_LOG_FILE.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
 * Output directory for log parameter test results.
 */
const LOG_TEST_OUTPUT = path.join(__dirname, "dist", "log-test");

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
 * @param inputPattern - Glob pattern for input hook files
 * @param outputPath - Path where hooks.json will be written
 * @param options - Optional log configuration
 * @returns Object with success status and captured stdout/stderr
 */
function runCli(
  inputPattern: string,
  outputPath: string,
  options: { logPath?: string; logEnvVar?: string } = {},
): { success: boolean; stdout: string; stderr: string } {
  const args = ["tsx", CLI_PATH, "-i", inputPattern, "-o", outputPath];
  if (options.logPath) {
    args.push("--log", options.logPath);
  }
  if (options.logEnvVar) {
    args.push("--log-env-var", options.logEnvVar);
  }

  const result = spawnSync("npx", args, {
    cwd: path.dirname(CLI_PATH),
    encoding: "utf-8",
    stdio: "pipe",
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
 * The command format is: "node $CLAUDE_PLUGIN_ROOT/build/hook.abc123.mjs"
 * @param command - The command string from hooks.json
 * @param hooksJsonDir - Directory containing hooks.json
 * @returns Resolved absolute path
 */
function resolveCommandPath(command: string, hooksJsonDir: string): string {
  // Extract the path from the command template (format: "executable $CLAUDE_PLUGIN_ROOT/path")
  const match = command.match(/\$CLAUDE_PLUGIN_ROOT\/(.+)$/);
  if (match) {
    return path.join(hooksJsonDir, match[1]);
  }
  // Fallback: return as-is if it doesn't match the expected pattern
  return command;
}

/**
 * Cleans up the log test output directory.
 */
function cleanLogTestOutput(): void {
  if (fs.existsSync(LOG_TEST_OUTPUT)) {
    fs.rmSync(LOG_TEST_OUTPUT, { recursive: true });
  }
}

describe("E2E: --log CLI Parameter", () => {
  beforeAll(() => {
    cleanLogTestOutput();
    fs.mkdirSync(LOG_TEST_OUTPUT, { recursive: true });
  });

  afterAll(() => {
    cleanLogTestOutput();
  });

  describe("Runtime Logging with --log", () => {
    it("compiled hook writes to log file specified by --log", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "runtime-log");
      const outputPath = path.join(outputDir, "hooks.json");
      const logPath = path.join(outputDir, "hooks.log");
      fs.mkdirSync(outputDir, { recursive: true });

      // Compile with --log parameter
      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath, { logPath });

      expect(result.success).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;

      expect(command).toBeDefined();
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute the hook with mock input
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

      // Verify log file was created and contains log entries
      expect(fs.existsSync(logPath)).toBe(true);

      const logContent = fs.readFileSync(logPath, "utf-8");
      expect(logContent.length).toBeGreaterThan(0);

      // Log should be JSON lines format
      const logLines = logContent.trim().split("\n");
      expect(logLines.length).toBeGreaterThan(0);

      // Each line should be valid JSON
      for (const line of logLines) {
        const logEntry = JSON.parse(line) as Record<string, unknown>;
        expect(logEntry).toHaveProperty("timestamp");
        expect(logEntry).toHaveProperty("level");
        expect(logEntry).toHaveProperty("message");
      }

      // Should contain the log message from the hook
      expect(logContent).toContain("Hook with timeout triggered");
    });

    it("compiled hook creates log file directory if it does not exist", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "log-mkdir");
      const outputPath = path.join(outputDir, "hooks.json");
      const logDir = path.join(outputDir, "logs", "deep", "nested");
      const logPath = path.join(logDir, "hooks.log");
      fs.mkdirSync(outputDir, { recursive: true });

      // Compile with --log parameter pointing to non-existent directory
      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath, { logPath });

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute the hook
      const mockInput = JSON.stringify({
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        cwd: "/tmp",
        tool_name: "Write",
        tool_input: { file_path: "/tmp/test.txt", content: "test" },
        tool_use_id: "test-tool-use-id",
      });

      spawnSync("node", [commandPath], {
        input: mockInput,
        encoding: "utf-8",
        timeout: 5000,
      });

      // Verify log file was created in the nested directory
      expect(fs.existsSync(logPath)).toBe(true);
    });
  });

  describe("Runtime env var override", () => {
    it("runtime CLAUDE_CODE_HOOKS_LOG_FILE overrides --log compiled path", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "runtime-override");
      const outputPath = path.join(outputDir, "hooks.json");
      const compiledLogPath = path.join(outputDir, "compiled.log");
      const runtimeLogPath = path.join(outputDir, "runtime.log");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath, { logPath: compiledLogPath });

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

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
        env: { ...process.env, CLAUDE_CODE_HOOKS_LOG_FILE: runtimeLogPath },
      });

      // Runtime env var wins — hook succeeds, log written to runtime path
      expect(execResult.status).toBe(0);
      expect(fs.existsSync(runtimeLogPath)).toBe(true);
      expect(fs.existsSync(compiledLogPath)).toBe(false);
    });

    it("works without --log when only CLAUDE_CODE_HOOKS_LOG_FILE is set at runtime", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "env-only");
      const outputPath = path.join(outputDir, "hooks.json");
      const logPath = path.join(outputDir, "env.log");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

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
        env: { ...process.env, CLAUDE_CODE_HOOKS_LOG_FILE: logPath },
      });

      expect(execResult.status).toBe(0);
      expect(fs.existsSync(logPath)).toBe(true);
      const logContent = fs.readFileSync(logPath, "utf-8");
      expect(logContent).toContain("Hook with timeout triggered");
    });
  });

  describe("Log File Path Resolution", () => {
    it("resolves relative --log paths to absolute paths in compiled hook", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "relative-path");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      // Use a relative path for --log
      const relativePath = "./logs/relative-test.log";
      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");

      const result = runCli(inputPath, outputPath, { logPath: relativePath });

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      // Read compiled hook content to verify the path was injected
      const content = fs.readFileSync(commandPath, "utf-8");

      // Should contain an absolute path (starts with /) and the log filename
      expect(content).toMatch(/CLAUDE_CODE_HOOKS_LOG_FILE.*=.*"\/.*relative-test\.log"/);

      // Extract the actual resolved path from the compiled content
      const pathMatch = content.match(/process\.env\['CLAUDE_CODE_HOOKS_LOG_FILE'\]\s*=\s*"([^"]+)"/);
      expect(pathMatch).toBeTruthy();
      const resolvedLogPath = pathMatch?.[1];
      if (!resolvedLogPath) {
        throw new Error("Expected resolvedLogPath to be defined");
      }

      // Should be an absolute path
      expect(path.isAbsolute(resolvedLogPath)).toBe(true);

      // Execute the hook and verify log file is created at the resolved path
      const mockInput = JSON.stringify({
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        cwd: "/tmp",
        tool_name: "Write",
        tool_input: { file_path: "/tmp/test.txt", content: "test" },
        tool_use_id: "test-tool-use-id",
      });

      spawnSync("node", [commandPath], {
        input: mockInput,
        encoding: "utf-8",
        timeout: 5000,
      });

      // Log file should be created at the resolved absolute path
      expect(fs.existsSync(resolvedLogPath)).toBe(true);
    });
  });

  describe("Compiled Hook Content", () => {
    it("injects CLAUDE_CODE_HOOKS_LOG_FILE assignment when --log is used", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "inject-env");
      const outputPath = path.join(outputDir, "hooks.json");
      const logPath = path.join(outputDir, "hooks.log");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath, { logPath });

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      const content = fs.readFileSync(commandPath, "utf-8");

      // Banner should set CLAUDE_CODE_HOOKS_LOG_FILE to the hardcoded path
      expect(content).toContain("CLAUDE_CODE_HOOKS_LOG_FILE");
      expect(content).toContain(logPath);
      // Should not use the old CLI_LOG_FILE var
      expect(content).not.toContain("CLAUDE_CODE_HOOKS_CLI_LOG_FILE");
    });

    it("does not inject log path assignment when neither --log nor --log-env-var is used", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "no-inject");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      const content = fs.readFileSync(commandPath, "utf-8");

      // No log path or env var name should be hardcoded
      const logFileAssignment = /process\.env\[['"]CLAUDE_CODE_HOOKS_LOG_FILE['"]\]\s*=\s*['"]/;
      const logEnvVarAssignment = /process\.env\[['"]CLAUDE_CODE_HOOKS_LOG_ENV_VAR['"]\]\s*=\s*['"]/;
      expect(content).not.toMatch(logFileAssignment);
      expect(content).not.toMatch(logEnvVarAssignment);
    });

    it("injects CLAUDE_CODE_HOOKS_LOG_ENV_VAR when --log-env-var is used", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "inject-env-var");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath, { logEnvVar: "MY_CUSTOM_LOG_FILE" });

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      const content = fs.readFileSync(commandPath, "utf-8");

      // Banner should record the env var name, not a hardcoded path
      expect(content).toContain("CLAUDE_CODE_HOOKS_LOG_ENV_VAR");
      expect(content).toContain("MY_CUSTOM_LOG_FILE");
      // No hardcoded log file path should appear
      const logFileAssignment = /process\.env\[['"]CLAUDE_CODE_HOOKS_LOG_FILE['"]\]\s*=\s*['"]/;
      expect(content).not.toMatch(logFileAssignment);
    });
  });

  describe("--log-env-var runtime behaviour", () => {
    it("uses the named env var for log output at runtime", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "log-env-var-runtime");
      const outputPath = path.join(outputDir, "hooks.json");
      const logPath = path.join(outputDir, "custom.log");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath, { logEnvVar: "MY_CUSTOM_LOG_FILE" });

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

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
        env: { ...process.env, MY_CUSTOM_LOG_FILE: logPath },
      });

      expect(execResult.status).toBe(0);
      expect(fs.existsSync(logPath)).toBe(true);
      const logContent = fs.readFileSync(logPath, "utf-8");
      expect(logContent).toContain("Hook with timeout triggered");
    });

    it("produces no log file when the named env var is not set at runtime", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "log-env-var-unset");
      const outputPath = path.join(outputDir, "hooks.json");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath, { logEnvVar: "MY_UNSET_LOG_FILE" });

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      const mockInput = JSON.stringify({
        hook_event_name: "PreToolUse",
        session_id: "test-session",
        cwd: "/tmp",
        tool_name: "Write",
        tool_input: { file_path: "/tmp/test.txt", content: "test" },
        tool_use_id: "test-tool-use-id",
      });

      // Run without MY_UNSET_LOG_FILE in the environment
      const { MY_UNSET_LOG_FILE: _removed, ...envWithout } = process.env;
      const execResult = spawnSync("node", [commandPath], {
        input: mockInput,
        encoding: "utf-8",
        timeout: 5000,
        env: envWithout,
      });

      expect(execResult.status).toBe(0);
      // No log file should have been created anywhere in the output dir
      const logFiles = fs.readdirSync(outputDir).filter((f) => f.endsWith(".log"));
      expect(logFiles).toHaveLength(0);
    });

    it("rejects --log and --log-env-var used together at compile time", () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, "log-conflict");
      const outputPath = path.join(outputDir, "hooks.json");
      const logPath = path.join(outputDir, "hooks.log");
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, "hook-with-timeout.ts");
      const result = runCli(inputPath, outputPath, { logPath, logEnvVar: "MY_LOG_FILE" });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain("Cannot use --log and --log-env-var together");
    });
  });
});
