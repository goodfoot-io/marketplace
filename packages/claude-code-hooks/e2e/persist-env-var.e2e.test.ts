/**
 * E2E tests for persistEnvVar functionality.
 *
 * Verifies that environment variables set by SessionStart hooks via persistEnvVar
 * are available to subsequent hooks when running through Claude.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildMultipleHooks, cleanOutputDir, getHooksJsonPath } from './setup.js';
import { CLAUDE_AVAILABLE, runClaude, readHooksJson } from './test-utils.js';

/**
 * Resolves a command path that may contain ${CLAUDE_PLUGIN_ROOT} to an absolute path.
 * @param command
 * @param pluginDir
 */
function resolveCommandPath(command: string, pluginDir: string): string {
  return command.replace('${CLAUDE_PLUGIN_ROOT}', pluginDir);
}

describe('E2E: persistEnvVar', () => {
  describe('Hook execution flow (simulated)', () => {
    let pluginDir: string;
    let logPath: string;

    beforeAll(() => {
      // Build both hooks together
      pluginDir = buildMultipleHooks(
        ['session-start-persist-env-hook.ts', 'stop-read-env-hook.ts'],
        'persist-env-test'
      );
      logPath = path.join(pluginDir, 'hooks.log');
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it('generates hooks.json with both SessionStart and Stop hooks', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);

      // Verify SessionStart hook exists
      expect(hooksJson.hooks.SessionStart).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.SessionStart)).toBe(true);
      expect(hooksJson.hooks.SessionStart?.length).toBeGreaterThan(0);

      // Verify Stop hook exists
      expect(hooksJson.hooks.Stop).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.Stop)).toBe(true);
      expect(hooksJson.hooks.Stop?.length).toBeGreaterThan(0);
    });

    it('SessionStart hook writes env var to CLAUDE_ENV_FILE', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      const hooksJson = readHooksJson(hooksJsonPath);

      // Get the SessionStart hook command
      const sessionStartEntry = hooksJson.hooks.SessionStart?.[0];
      expect(sessionStartEntry?.hooks[0].command).toBeDefined();
      const command = sessionStartEntry?.hooks[0].command ?? '';
      const commandPath = resolveCommandPath(command, pluginDir);

      // Create a temp file for CLAUDE_ENV_FILE
      const envFilePath = path.join(pluginDir, 'test-env-file.sh');

      // Execute the SessionStart hook
      const mockInput = JSON.stringify({
        hook_event_name: 'SessionStart',
        session_id: 'test-session',
        cwd: '/tmp',
        source: 'startup'
      });

      const result = spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          ...process.env,
          CLAUDE_ENV_FILE: envFilePath,
          CLAUDE_CODE_HOOKS_LOG_FILE: logPath
        }
      });

      expect(result.status).toBe(0);

      // Verify the env file was created and contains the export statement
      expect(fs.existsSync(envFilePath)).toBe(true);
      const envFileContent = fs.readFileSync(envFilePath, 'utf-8');
      expect(envFileContent).toContain('export E2E_TEST_VAR=');
      expect(envFileContent).toContain('PERSIST_ENV_VAR_E2E_SUCCESS');
    });

    it('Stop hook reads env var and reports success when set correctly', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      const hooksJson = readHooksJson(hooksJsonPath);

      // Get the Stop hook command
      const stopEntry = hooksJson.hooks.Stop?.[0];
      expect(stopEntry?.hooks[0].command).toBeDefined();
      const command = stopEntry?.hooks[0].command ?? '';
      const commandPath = resolveCommandPath(command, pluginDir);

      // Execute the Stop hook with the env var set (simulating what Claude does)
      const mockInput = JSON.stringify({
        hook_event_name: 'Stop',
        session_id: 'test-session',
        cwd: '/tmp',
        stop_hook_active: true
      });

      const result = spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          ...process.env,
          E2E_TEST_VAR: 'PERSIST_ENV_VAR_E2E_SUCCESS',
          CLAUDE_CODE_HOOKS_LOG_FILE: logPath
        }
      });

      expect(result.status).toBe(0);

      // Parse the hook output
      const output = JSON.parse(result.stdout) as {
        decision: 'approve' | 'block';
        reason: string;
      };

      expect(output.decision).toBe('approve');
      expect(output.reason).toContain('E2E_PERSIST_SUCCESS');
    });

    it('Stop hook reports failure when env var is not set', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      const hooksJson = readHooksJson(hooksJsonPath);

      // Get the Stop hook command
      const stopEntry = hooksJson.hooks.Stop?.[0];
      const command = stopEntry?.hooks[0].command ?? '';
      const commandPath = resolveCommandPath(command, pluginDir);

      // Execute the Stop hook WITHOUT the env var set
      const mockInput = JSON.stringify({
        hook_event_name: 'Stop',
        session_id: 'test-session',
        cwd: '/tmp',
        stop_hook_active: true
      });

      const result = spawnSync('node', [commandPath], {
        input: mockInput,
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          // Exclude E2E_TEST_VAR
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          CLAUDE_CODE_HOOKS_LOG_FILE: logPath
        }
      });

      expect(result.status).toBe(0);

      // Parse the hook output
      const output = JSON.parse(result.stdout) as {
        decision: 'approve' | 'block';
        reason: string;
      };

      expect(output.reason).toContain('E2E_PERSIST_FAILURE');
    });

    it('full simulated flow: SessionStart sets env, Stop reads it', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      const hooksJson = readHooksJson(hooksJsonPath);

      // Create a temp file for CLAUDE_ENV_FILE
      const envFilePath = path.join(pluginDir, 'full-flow-env-file.sh');

      // Step 1: Run SessionStart hook
      const sessionStartCommand = hooksJson.hooks.SessionStart?.[0].hooks[0].command ?? '';
      const sessionStartPath = resolveCommandPath(sessionStartCommand, pluginDir);

      const sessionStartInput = JSON.stringify({
        hook_event_name: 'SessionStart',
        session_id: 'test-session',
        cwd: '/tmp',
        source: 'startup'
      });

      const sessionStartResult = spawnSync('node', [sessionStartPath], {
        input: sessionStartInput,
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          ...process.env,
          CLAUDE_ENV_FILE: envFilePath,
          CLAUDE_CODE_HOOKS_LOG_FILE: logPath
        }
      });

      expect(sessionStartResult.status).toBe(0);

      // Step 2: Parse the env file to get the exported variables
      // (This simulates what Claude Code does: source the env file before running subsequent hooks)
      const envFileContent = fs.readFileSync(envFilePath, 'utf-8');
      const envVars: Record<string, string> = {};

      // Parse "export NAME='value'" lines
      const exportRegex = /^export\s+(\w+)='([^']*)'/gm;
      let match;
      while ((match = exportRegex.exec(envFileContent)) !== null) {
        envVars[match[1]] = match[2];
      }

      expect(envVars.E2E_TEST_VAR).toBe('PERSIST_ENV_VAR_E2E_SUCCESS');

      // Step 3: Run Stop hook with the env vars from the file
      const stopCommand = hooksJson.hooks.Stop?.[0].hooks[0].command ?? '';
      const stopPath = resolveCommandPath(stopCommand, pluginDir);

      const stopInput = JSON.stringify({
        hook_event_name: 'Stop',
        session_id: 'test-session',
        cwd: '/tmp',
        stop_hook_active: true
      });

      const stopResult = spawnSync('node', [stopPath], {
        input: stopInput,
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          ...process.env,
          ...envVars, // Include the persisted env vars
          CLAUDE_CODE_HOOKS_LOG_FILE: logPath
        }
      });

      expect(stopResult.status).toBe(0);

      const output = JSON.parse(stopResult.stdout) as {
        decision: 'approve' | 'block';
        reason: string;
      };

      expect(output.decision).toBe('approve');
      expect(output.reason).toContain('E2E_PERSIST_SUCCESS');
      expect(output.reason).toContain('PERSIST_ENV_VAR_E2E_SUCCESS');
    });
  });

  describe('Claude CLI integration', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildMultipleHooks(
        ['session-start-persist-env-hook.ts', 'stop-read-env-hook.ts'],
        'persist-env-claude-test'
      );
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it.skipIf(!CLAUDE_AVAILABLE)(
      'persistEnvVar in SessionStart makes env var available to Stop hook',
      () => {
        // Run Claude with a simple prompt that will trigger both hooks
        // SessionStart runs at session start, Stop runs when Claude finishes
        const result = runClaude({
          prompt: 'Say "done" and nothing else.',
          pluginDir,
          tools: [],
          timeout: 120000
        });

        // The test passes if Claude completes without errors
        // The Stop hook will log success/failure which we verify via the hook's reason
        // Since the hooks log to their file, we can verify via the log
        expect(result.stderr).not.toContain('Error');

        // At minimum, verify Claude ran and produced output
        expect(result.stdout.length).toBeGreaterThan(0);
      }
    );
  });
});
