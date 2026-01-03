/**
 * E2E tests for SessionStart hooks.
 *
 * SessionStart hooks run when a new session begins and can:
 * - Inject initial context
 * - Set up session state
 * - Configure session behavior
 */

import * as fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from './setup.js';
import { CLAUDE_AVAILABLE, runClaude, readHooksJson } from './test-utils.js';

describe('E2E: SessionStart Hooks', () => {
  describe('Context injection (no matcher)', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('session-context-hook.ts');
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });
    it.skipIf(!CLAUDE_AVAILABLE)('injects context that Claude acknowledges', () => {
      const result = runClaude({
        prompt: 'What is the category from the JSON context? Do not include other content in your response.',
        pluginDir,
        tools: []
      });

      expect(result.stdout.toLowerCase()).toContain('clothing');
    });

    it('generates hooks.json with SessionStart event (no matcher)', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.SessionStart).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.SessionStart)).toBe(true);

      // Should have an entry without a matcher (matches all sources)
      const entry = hooksJson.hooks.SessionStart?.[0];
      expect(entry?.matcher).toBeUndefined();
    });
  });

  describe('Startup matcher', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('session-start-matcher-hook.ts');
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it('generates hooks.json with SessionStart event and startup matcher', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.SessionStart).toBeDefined();

      const startupEntry = hooksJson.hooks.SessionStart?.find((entry) => entry.matcher === 'startup');
      expect(startupEntry).toBeDefined();
      expect(startupEntry?.hooks.length).toBeGreaterThan(0);
    });
  });
});
