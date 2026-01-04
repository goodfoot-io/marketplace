/**
 * E2E tests for PreToolUse hooks.
 *
 * PreToolUse hooks run before a tool is executed and can:
 * - Block the tool execution
 * - Allow it to proceed
 * - Modify context
 */

import * as fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from './setup.js';
import { CLAUDE_AVAILABLE, runClaude, readHooksJson } from './test-utils.js';

describe('E2E: PreToolUse Hooks', () => {
  describe('Bash denial', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('deny-bash-hook.ts');
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it.skipIf(!CLAUDE_AVAILABLE)('denies Bash commands when hook is active', () => {
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

    it('generates valid hooks.json with PreToolUse event and Bash matcher', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.PreToolUse)).toBe(true);

      const bashEntry = hooksJson.hooks.PreToolUse?.find((entry) => entry.matcher === 'Bash');
      expect(bashEntry).toBeDefined();
      expect(bashEntry?.hooks.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-tool matcher', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('pre-tool-use-multi-matcher-hook.ts');
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it('generates hooks.json with regex alternation matcher', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      const hooksJson = readHooksJson(hooksJsonPath);

      const entry = hooksJson.hooks.PreToolUse?.find((e) => e.matcher === 'Read|Glob|Grep');
      expect(entry).toBeDefined();
    });
  });

  describe('Error handling: Hook that throws', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('error-hook.ts');
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it('generates valid hooks.json for error hook', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks).toBeDefined();

      // New format: hooks.PreToolUse is an array of matcher entries
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.PreToolUse)).toBe(true);

      const readEntry = hooksJson.hooks.PreToolUse?.find((entry) => entry.matcher === 'Read');
      expect(readEntry).toBeDefined();
    });
  });
});
