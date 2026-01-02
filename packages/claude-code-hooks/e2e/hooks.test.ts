/**
 * E2E tests for Claude Code hooks using the actual `claude` CLI.
 *
 * These tests build hook fixtures and execute them via the claude CLI
 * to verify hook behavior in real-world scenarios.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildSingleHook, cleanDist } from './setup.js';

/**
 * Quick synchronous check if Claude CLI binary exists.
 */
function isClaudeBinaryAvailable(): boolean {
  try {
    execSync('which claude', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const CLAUDE_AVAILABLE = isClaudeBinaryAvailable();

/**
 * Run claude CLI with given options.
 */
function runClaude(options: { prompt: string; pluginDir?: string; timeout?: number; tools?: string[] }): {
  stdout: string;
  stderr: string;
} {
  const { prompt, pluginDir, timeout = 60000, tools } = options;

  // Build args: flags first, then prompt, then --plugin-dir and --tools
  // The prompt must come BEFORE --tools and --plugin-dir due to CLI arg parsing
  const args: string[] = ['--print', '--model', 'haiku', '--no-session-persistence', '--dangerously-skip-permissions'];

  // Add prompt before --plugin-dir and --tools
  args.push(prompt);

  if (pluginDir) {
    args.push('--plugin-dir', pluginDir);
  }

  if (tools && tools.length > 0) {
    args.push('--tools', tools.join(','));
  }

  const cmd = `claude ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`;
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { stdout, stderr: '' };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
      return {
        stdout: String((error as { stdout: unknown }).stdout || ''),
        stderr: String((error as { stderr: unknown }).stderr || '')
      };
    }
    throw error;
  }
}

describe.skipIf(!CLAUDE_AVAILABLE)('E2E: Hook Integration Tests', () => {
  afterAll(() => {
    cleanDist();
  });

  describe('PreToolUse: Bash denial', () => {
    let pluginDir: string;

    beforeAll(async () => {
      pluginDir = await buildSingleHook('deny-bash-hook.ts');
    });

    it('denies Bash commands when hook is active', () => {
      const result = runClaude({
        prompt: 'Run this exact bash command: echo HOOKTEST123 - do not explain, just run it',
        pluginDir,
        tools: ['Bash']
      });

      // When the hook denies the command, the Bash tool doesn't execute,
      // so we should NOT see the echo output in stdout
      const combinedOutput = result.stdout + result.stderr;
      expect(combinedOutput).not.toContain('HOOKTEST123');
    });
  });

  describe('SessionStart: Context injection', () => {
    let pluginDir: string;

    beforeAll(async () => {
      pluginDir = await buildSingleHook('session-context-hook.ts');
    });

    it('injects context that Claude acknowledges', () => {
      const result = runClaude({
        prompt: 'What is the magic test word that was injected? Just say the word.',
        pluginDir,
        tools: []
      });

      expect(result.stdout.toLowerCase()).toContain('banana');
    });
  });

  describe('Stop: Block with reason', () => {
    let pluginDir: string;

    beforeAll(async () => {
      pluginDir = await buildSingleHook('stop-block-hook.ts');
    });

    it('generates valid hooks.json for stop hook', () => {
      const hooksJsonPath = path.join(pluginDir, 'hooks.json');
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf-8'));
      expect(hooksJson.hooks).toBeDefined();
      expect(typeof hooksJson.hooks).toBe('object');

      // New format: hooks.Stop is an array of matcher entries
      expect(hooksJson.hooks.Stop).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.Stop)).toBe(true);
      expect(hooksJson.hooks.Stop.length).toBeGreaterThan(0);

      const stopEntry = hooksJson.hooks.Stop[0];
      expect(stopEntry.hooks).toBeDefined();
      expect(stopEntry.hooks.length).toBeGreaterThan(0);

      const compiledHook = stopEntry.hooks[0];
      expect(compiledHook.type).toBe('command');
      expect(fs.existsSync(compiledHook.command)).toBe(true);
    });
  });

  describe('Error handling: Hook that throws', () => {
    let pluginDir: string;

    beforeAll(async () => {
      pluginDir = await buildSingleHook('error-hook.ts');
    });

    it('generates valid hooks.json for error hook', () => {
      const hooksJsonPath = path.join(pluginDir, 'hooks.json');
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf-8'));
      expect(hooksJson.hooks).toBeDefined();

      // New format: hooks.PreToolUse is an array of matcher entries
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.PreToolUse)).toBe(true);

      const readEntry = hooksJson.hooks.PreToolUse.find((entry: { matcher?: string }) => entry.matcher === 'Read');
      expect(readEntry).toBeDefined();
    });
  });
});
