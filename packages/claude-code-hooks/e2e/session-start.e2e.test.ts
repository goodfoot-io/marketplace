/**
 * E2E tests for SessionStart hooks.
 *
 * SessionStart hooks run when a new session begins and can:
 * - Inject initial context
 * - Set up session state
 * - Configure session behavior
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanDist } from './setup.js';
import { CLAUDE_AVAILABLE, runClaude, readHooksJson } from './test-utils.js';

describe.skipIf(!CLAUDE_AVAILABLE)('E2E: SessionStart Hooks', () => {
  afterAll(() => {
    cleanDist();
  });

  describe.only('Context injection (no matcher)', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('session-context-hook.ts');
    });

    it('injects context that Claude acknowledges', () => {
      const result = runClaude({
        prompt: 'What is the magic test word that was injected? Just say the word.',
        pluginDir,
        tools: []
      });

      expect(result.stdout.toLowerCase()).toContain('banana');
    });

    it('generates hooks.json with SessionStart event (no matcher)', () => {
      const hooksJsonPath = path.join(pluginDir, 'hooks.json');
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

    it('generates hooks.json with SessionStart event and startup matcher', () => {
      const hooksJsonPath = path.join(pluginDir, 'hooks.json');
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.SessionStart).toBeDefined();

      const startupEntry = hooksJson.hooks.SessionStart?.find((entry) => entry.matcher === 'startup');
      expect(startupEntry).toBeDefined();
      expect(startupEntry?.hooks.length).toBeGreaterThan(0);
    });
  });
});
