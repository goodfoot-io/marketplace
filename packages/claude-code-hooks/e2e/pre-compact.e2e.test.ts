/**
 * E2E tests for PreCompact hooks.
 *
 * PreCompact hooks run before context compaction and can:
 * - Inject system messages to preserve during compaction
 * - Add context that should survive summarization
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanDist } from './setup.js';
import { readHooksJson } from './test-utils.js';

describe('E2E: PreCompact Hooks', () => {
  afterAll(() => {
    cleanDist();
  });

  describe('System message injection', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('pre-compact-hook.ts');
    });

    it('generates hooks.json with PreCompact event (no matcher)', () => {
      const hooksJsonPath = path.join(pluginDir, 'hooks.json');
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.PreCompact).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.PreCompact)).toBe(true);
    });
  });
});
