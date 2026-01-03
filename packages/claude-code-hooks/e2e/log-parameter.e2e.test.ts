/**
 * E2E tests for the --log CLI parameter.
 *
 * These tests verify that the --log parameter correctly configures
 * hook runtime logging, equivalent to CLAUDE_CODE_HOOKS_LOG_FILE.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to the CLI script.
 */
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli.ts');

/**
 * Directory containing build test fixtures.
 */
const BUILD_TEST_FIXTURES = path.join(__dirname, 'fixtures');

/**
 * Output directory for log parameter test results.
 */
const LOG_TEST_OUTPUT = path.join(__dirname, 'dist', 'log-test');

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
 * @param logPath - Optional log file path for hook runtime logging
 * @returns Object with success status and captured stdout/stderr
 */
function runCli(
  inputPattern: string,
  outputPath: string,
  logPath?: string
): { success: boolean; stdout: string; stderr: string } {
  const args = ['tsx', CLI_PATH, '-i', inputPattern, '-o', outputPath];
  if (logPath) {
    args.push('--log', logPath);
  }

  const result = spawnSync('npx', args, {
    cwd: path.dirname(CLI_PATH),
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  return {
    success: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

/**
 * Reads and parses hooks.json.
 * @param hooksJsonPath - Absolute path to the hooks.json file
 * @returns Parsed HooksJson object
 */
function readHooksJson(hooksJsonPath: string): HooksJson {
  return JSON.parse(fs.readFileSync(hooksJsonPath, 'utf-8')) as HooksJson;
}

/**
 * Resolves a command path that may contain ${CLAUDE_PLUGIN_ROOT:-./} to an absolute path.
 * @param command - The command string from hooks.json (e.g., "${CLAUDE_PLUGIN_ROOT:-./}/build/hook.abc123.mjs")
 * @param hooksJsonDir - Directory containing hooks.json (used as default for ./)
 * @returns Resolved absolute path
 */
function resolveCommandPath(command: string, hooksJsonDir: string): string {
  // Extract the path from the command template (e.g., "build/hook.abc123.mjs")
  const match = command.match(/\$\{CLAUDE_PLUGIN_ROOT:-\.\/\}\/(.+)$/);
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

describe('E2E: --log CLI Parameter', () => {
  beforeAll(() => {
    cleanLogTestOutput();
    fs.mkdirSync(LOG_TEST_OUTPUT, { recursive: true });
  });

  afterAll(() => {
    cleanLogTestOutput();
  });

  describe('Runtime Logging with --log', () => {
    it('compiled hook writes to log file specified by --log', () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, 'runtime-log');
      const outputPath = path.join(outputDir, 'hooks.json');
      const logPath = path.join(outputDir, 'hooks.log');
      fs.mkdirSync(outputDir, { recursive: true });

      // Compile with --log parameter
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath, logPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;

      expect(command).toBeDefined();
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute the hook with mock input
      const mockInput = JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        cwd: '/tmp',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.txt', content: 'test' },
        tool_use_id: 'test-tool-use-id'
      });

      const execResult = spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000
      });

      expect(execResult.status).toBe(0);

      // Verify log file was created and contains log entries
      expect(fs.existsSync(logPath)).toBe(true);

      const logContent = fs.readFileSync(logPath, 'utf-8');
      expect(logContent.length).toBeGreaterThan(0);

      // Log should be JSON lines format
      const logLines = logContent.trim().split('\n');
      expect(logLines.length).toBeGreaterThan(0);

      // Each line should be valid JSON
      for (const line of logLines) {
        const logEntry = JSON.parse(line) as Record<string, unknown>;
        expect(logEntry).toHaveProperty('timestamp');
        expect(logEntry).toHaveProperty('level');
        expect(logEntry).toHaveProperty('message');
      }

      // Should contain the log message from the hook
      expect(logContent).toContain('Hook with timeout triggered');
    });

    it('compiled hook creates log file directory if it does not exist', () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, 'log-mkdir');
      const outputPath = path.join(outputDir, 'hooks.json');
      const logDir = path.join(outputDir, 'logs', 'deep', 'nested');
      const logPath = path.join(logDir, 'hooks.log');
      fs.mkdirSync(outputDir, { recursive: true });

      // Compile with --log parameter pointing to non-existent directory
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath, logPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute the hook
      const mockInput = JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        cwd: '/tmp',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.txt', content: 'test' },
        tool_use_id: 'test-tool-use-id'
      });

      spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000
      });

      // Verify log file was created in the nested directory
      expect(fs.existsSync(logPath)).toBe(true);
    });
  });

  describe('Log Configuration Conflict Detection', () => {
    it('throws error when --log and CLAUDE_CODE_HOOKS_LOG_FILE conflict', () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, 'conflict');
      const outputPath = path.join(outputDir, 'hooks.json');
      const cliLogPath = path.join(outputDir, 'cli.log');
      const envLogPath = path.join(outputDir, 'env.log');
      fs.mkdirSync(outputDir, { recursive: true });

      // Compile with --log parameter
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath, cliLogPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute the hook with conflicting CLAUDE_CODE_HOOKS_LOG_FILE env var
      const mockInput = JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        cwd: '/tmp',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.txt', content: 'test' },
        tool_use_id: 'test-tool-use-id'
      });

      const execResult = spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          ...process.env,
          CLAUDE_CODE_HOOKS_LOG_FILE: envLogPath
        }
      });

      // Should fail with exit code 1 (error)
      expect(execResult.status).toBe(1);

      // Stderr should contain conflict error message
      expect(execResult.stderr).toContain('Log file configuration conflict');
      expect(execResult.stderr).toContain('CLI --log=');
      expect(execResult.stderr).toContain('CLAUDE_CODE_HOOKS_LOG_FILE=');
    });

    it('allows matching --log and CLAUDE_CODE_HOOKS_LOG_FILE paths', () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, 'matching');
      const outputPath = path.join(outputDir, 'hooks.json');
      const logPath = path.join(outputDir, 'same.log');
      fs.mkdirSync(outputDir, { recursive: true });

      // Compile with --log parameter
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath, logPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute the hook with MATCHING CLAUDE_CODE_HOOKS_LOG_FILE env var
      const mockInput = JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        cwd: '/tmp',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.txt', content: 'test' },
        tool_use_id: 'test-tool-use-id'
      });

      const execResult = spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          ...process.env,
          CLAUDE_CODE_HOOKS_LOG_FILE: logPath // Same as --log
        }
      });

      // Should succeed - no conflict when paths match
      expect(execResult.status).toBe(0);
      expect(execResult.stderr).not.toContain('Log file configuration conflict');

      // Log file should exist with entries
      expect(fs.existsSync(logPath)).toBe(true);
    });

    it('works without --log when only CLAUDE_CODE_HOOKS_LOG_FILE is set', () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, 'env-only');
      const outputPath = path.join(outputDir, 'hooks.json');
      const logPath = path.join(outputDir, 'env.log');
      fs.mkdirSync(outputDir, { recursive: true });

      // Compile WITHOUT --log parameter
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath); // No logPath

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      // Execute the hook with CLAUDE_CODE_HOOKS_LOG_FILE env var
      const mockInput = JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        cwd: '/tmp',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.txt', content: 'test' },
        tool_use_id: 'test-tool-use-id'
      });

      const execResult = spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          ...process.env,
          CLAUDE_CODE_HOOKS_LOG_FILE: logPath
        }
      });

      // Should succeed
      expect(execResult.status).toBe(0);
      expect(execResult.stderr).not.toContain('Log file configuration conflict');

      // Log file should exist with entries from env var config
      expect(fs.existsSync(logPath)).toBe(true);
      const logContent = fs.readFileSync(logPath, 'utf-8');
      expect(logContent).toContain('Hook with timeout triggered');
    });
  });

  describe('Log File Path Resolution', () => {
    it('resolves relative --log paths to absolute paths in compiled hook', () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, 'relative-path');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      // Use a relative path for --log
      const relativePath = './logs/relative-test.log';
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');

      const result = runCli(inputPath, outputPath, relativePath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      // Read compiled hook content to verify the path was injected
      const content = fs.readFileSync(commandPath, 'utf-8');

      // Should contain an absolute path (starts with /) and the log filename
      expect(content).toMatch(/CLAUDE_CODE_HOOKS_CLI_LOG_FILE.*=.*"\/.*relative-test\.log"/);

      // Extract the actual resolved path from the compiled content
      const pathMatch = content.match(/process\.env\["CLAUDE_CODE_HOOKS_CLI_LOG_FILE"\]\s*=\s*"([^"]+)"/);
      expect(pathMatch).toBeTruthy();
      const resolvedLogPath = pathMatch![1];

      // Should be an absolute path
      expect(path.isAbsolute(resolvedLogPath)).toBe(true);

      // Execute the hook and verify log file is created at the resolved path
      const mockInput = JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        cwd: '/tmp',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.txt', content: 'test' },
        tool_use_id: 'test-tool-use-id'
      });

      spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000
      });

      // Log file should be created at the resolved absolute path
      expect(fs.existsSync(resolvedLogPath)).toBe(true);
    });
  });

  describe('Compiled Hook Content', () => {
    it('injects CLAUDE_CODE_HOOKS_CLI_LOG_FILE env var when --log is used', () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, 'inject-env');
      const outputPath = path.join(outputDir, 'hooks.json');
      const logPath = path.join(outputDir, 'hooks.log');
      fs.mkdirSync(outputDir, { recursive: true });

      // Compile with --log parameter
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath, logPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      // Read the compiled hook content
      const content = fs.readFileSync(commandPath, 'utf-8');

      // Should contain the injected env var assignment
      expect(content).toContain('CLAUDE_CODE_HOOKS_CLI_LOG_FILE');
      expect(content).toContain(logPath);
    });

    it('does not inject log path assignment when --log is not used', () => {
      const outputDir = path.join(LOG_TEST_OUTPUT, 'no-inject');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      // Compile WITHOUT --log parameter
      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath); // No logPath

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const command = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;
      const commandPath = resolveCommandPath(command, outputDir);

      // Read the compiled hook content
      const content = fs.readFileSync(commandPath, 'utf-8');

      // The runtime code references CLAUDE_CODE_HOOKS_CLI_LOG_FILE to check for it,
      // but there should be no assignment setting a specific path at the top of the file.
      // When --log is used, we inject: process.env['CLAUDE_CODE_HOOKS_CLI_LOG_FILE'] = "/some/path";
      // This pattern should NOT appear when --log is not used.
      const assignmentPattern = /process\.env\[['"]CLAUDE_CODE_HOOKS_CLI_LOG_FILE['"]\]\s*=\s*['"]/;
      expect(content).not.toMatch(assignmentPattern);
    });
  });
});
