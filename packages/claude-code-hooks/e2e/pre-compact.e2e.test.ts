/**
 * E2E tests for PreCompact hooks.
 *
 * PreCompact hooks run before context compaction and can:
 * - Inject system messages to preserve during compaction
 * - Add context that should survive summarization
 */

import * as fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from './setup.js';
import { readHooksJson } from './test-utils.js';

describe('E2E: PreCompact Hooks', () => {
  describe('System message injection', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('pre-compact-hook.ts');
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it('generates hooks.json with PreCompact event (no matcher)', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.PreCompact).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.PreCompact)).toBe(true);
    });
  });
});
