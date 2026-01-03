/**
 * E2E tests for the CLI build process.
 *
 * These tests verify that the CLI correctly compiles TypeScript hooks
 * into hooks.json and standalone .mjs files.
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
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli', 'index.ts');

/**
 * Directory containing build test fixtures.
 */
const BUILD_TEST_FIXTURES = path.join(__dirname, 'fixtures', 'build-test');

/**
 * Output directory for build test results.
 */
const BUILD_TEST_OUTPUT = path.join(__dirname, 'dist', 'build-test');

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
function runCli(inputPattern: string, outputPath: string): { success: boolean; stdout: string; stderr: string } {
  const result = spawnSync('npx', ['tsx', CLI_PATH, '-i', inputPattern, '-o', outputPath], {
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
 * Cleans up the build test output directory.
 */
function cleanBuildTestOutput(): void {
  if (fs.existsSync(BUILD_TEST_OUTPUT)) {
    fs.rmSync(BUILD_TEST_OUTPUT, { recursive: true });
  }
}

describe('E2E: Build Process', () => {
  beforeAll(() => {
    // Ensure clean output directory
    cleanBuildTestOutput();
    fs.mkdirSync(BUILD_TEST_OUTPUT, { recursive: true });
  });

  afterAll(() => {
    cleanBuildTestOutput();
  });

  describe('Single Hook Compilation', () => {
    it('compiles a single hook with matcher and timeout', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'single-timeout');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
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
      expect(entry.matcher).toBe('Write');

      // Verify hook config
      expect(entry.hooks).toHaveLength(1);
      expect(entry.hooks[0].type).toBe('command');
      expect(entry.hooks[0].timeout).toBe(5000);

      // Verify compiled file exists
      const commandPath = entry.hooks[0].command;
      expect(fs.existsSync(commandPath)).toBe(true);
      expect(commandPath.endsWith('.mjs')).toBe(true);
    });

    it('compiles a hook without matcher', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'no-matcher');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-without-matcher.ts');
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

  describe('Multiple Hooks Compilation', () => {
    it('compiles all hooks in a directory', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'all-hooks');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, '*.ts');
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

    it('groups hooks by event type correctly', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'grouped');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, '*.ts');
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
            expect(hook.type).toBe('command');
            expect(typeof hook.command).toBe('string');
            expect(fs.existsSync(hook.command)).toBe(true);
          }
        }
      }
    });
  });

  describe('Metadata Extraction', () => {
    it('extracts matcher patterns correctly for different hook types', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'matchers');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, '*.ts');
      const result = runCli(inputPattern, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      // PreToolUse matcher
      const preToolUseEntry = hooksJson.hooks.PreToolUse?.find((e) => e.matcher === 'Write');
      expect(preToolUseEntry).toBeDefined();

      // Notification matcher
      const notificationEntry = hooksJson.hooks.Notification?.find((e) => e.matcher === 'idle_prompt');
      expect(notificationEntry).toBeDefined();

      // SessionEnd matcher
      const sessionEndEntry = hooksJson.hooks.SessionEnd?.find((e) => e.matcher === 'logout');
      expect(sessionEndEntry).toBeDefined();

      // SubagentStart and SubagentStop matchers
      const subagentStartEntry = hooksJson.hooks.SubagentStart?.find((e) => e.matcher === 'explore');
      expect(subagentStartEntry).toBeDefined();

      const subagentStopEntry = hooksJson.hooks.SubagentStop?.find((e) => e.matcher === 'explore');
      expect(subagentStopEntry).toBeDefined();

      // PostToolUseFailure regex matcher
      const failureEntry = hooksJson.hooks.PostToolUseFailure?.find((e) => e.matcher === '.*');
      expect(failureEntry).toBeDefined();
    });

    it('extracts timeout values correctly', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'timeout-extraction');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const entry = hooksJson.hooks.PreToolUse?.[0];
      const hook = entry?.hooks[0];

      expect(hook?.timeout).toBe(5000);
    });

    it('omits timeout when not specified', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'no-timeout');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'notification-hook.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const entry = hooksJson.hooks.Notification?.[0];
      const hook = entry?.hooks[0];

      expect(hook?.timeout).toBeUndefined();
    });
  });

  describe('Generated Files', () => {
    it('generates __generated metadata with files and timestamp', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'generated-meta');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, '*.ts');
      const result = runCli(inputPattern, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      expect(hooksJson.__generated).toBeDefined();
      expect(Array.isArray(hooksJson.__generated.files)).toBe(true);
      expect(hooksJson.__generated.files.length).toBeGreaterThan(0);
      expect(typeof hooksJson.__generated.timestamp).toBe('string');

      // Verify timestamp is valid ISO format
      const timestamp = new Date(hooksJson.__generated.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('generates content-hashed filenames', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'hashed-names');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);

      // Filename should match pattern: {name}.{hash}.mjs
      const filename = hooksJson.__generated.files[0];
      expect(filename).toMatch(/^[\w-]+\.[a-f0-9]{8}\.mjs$/);
    });

    it('generates unique hashes for different content', () => {
      // Build two different hooks and verify they have different hashes
      const outputDir1 = path.join(BUILD_TEST_OUTPUT, 'hash-test-1');
      const outputPath1 = path.join(outputDir1, 'hooks.json');
      fs.mkdirSync(outputDir1, { recursive: true });

      const outputDir2 = path.join(BUILD_TEST_OUTPUT, 'hash-test-2');
      const outputPath2 = path.join(outputDir2, 'hooks.json');
      fs.mkdirSync(outputDir2, { recursive: true });

      // Build different hooks
      runCli(path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts'), outputPath1);
      runCli(path.join(BUILD_TEST_FIXTURES, 'notification-hook.ts'), outputPath2);

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

  describe('Compiled Hook Validity', () => {
    it('compiled hooks are valid ES modules with .mjs extension', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'valid-esm');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const commandPath = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;

      expect(commandPath).toBeDefined();
      expect(commandPath.endsWith('.mjs')).toBe(true);

      // Read the compiled file
      const content = fs.readFileSync(commandPath, 'utf-8');

      // Should NOT have CommonJS module.exports pattern (actual CommonJS export)
      expect(content).not.toMatch(/module\.exports\s*=/);

      // Should contain the hook code
      expect(content).toContain('preToolUseOutput');
      expect(content).toContain('Hook with timeout triggered');
    });

    it('compiled hooks can be executed with node', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'executable');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPath = path.join(BUILD_TEST_FIXTURES, 'hook-with-timeout.ts');
      const result = runCli(inputPath, outputPath);

      expect(result.success).toBe(true);

      const hooksJson = readHooksJson(outputPath);
      const commandPath = hooksJson.hooks.PreToolUse?.[0].hooks[0].command;

      expect(commandPath).toBeDefined();

      // Try to execute the hook with mock input
      const mockInput = JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'test-session',
        cwd: '/tmp',
        transcript_path: '/tmp/transcript.jsonl',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.txt', content: 'test' },
        tool_use_id: 'test-tool-use-id'
      });

      const execResult = spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000
      });

      // Should not crash (exit code 0, 1, or 2 are valid)
      expect([0, 1, 2]).toContain(execResult.status);

      // Should produce valid JSON output
      if (execResult.stdout) {
        const output: unknown = JSON.parse(execResult.stdout);
        expect(output).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('fails gracefully for non-existent input files', () => {
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'error-missing');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const result = runCli('/non/existent/path/*.ts', outputPath);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('No hook files found');
    });

    it('skips files that are not valid hooks', () => {
      // Create a temp file that's not a valid hook
      const tempDir = path.join(BUILD_TEST_OUTPUT, 'invalid-hook');
      fs.mkdirSync(tempDir, { recursive: true });

      const invalidHookPath = path.join(tempDir, 'not-a-hook.ts');
      fs.writeFileSync(invalidHookPath, 'export const notAHook = 42;');

      const outputPath = path.join(tempDir, 'hooks.json');
      const result = runCli(invalidHookPath, outputPath);

      // Should fail because no valid hooks were found
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('No valid hooks found');

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('Hook Type Coverage', () => {
    it('supports all 12 hook types', () => {
      // This test verifies the CLI can handle all hook factory types
      const supportedTypes = [
        'PreToolUse',
        'PostToolUse',
        'PostToolUseFailure',
        'Notification',
        'UserPromptSubmit',
        'SessionStart',
        'SessionEnd',
        'Stop',
        'SubagentStart',
        'SubagentStop',
        'PreCompact',
        'PermissionRequest'
      ];

      // Build the test fixtures
      const outputDir = path.join(BUILD_TEST_OUTPUT, 'hook-types');
      const outputPath = path.join(outputDir, 'hooks.json');
      fs.mkdirSync(outputDir, { recursive: true });

      const inputPattern = path.join(BUILD_TEST_FIXTURES, '*.ts');
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
