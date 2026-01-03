/**
 * E2E tests for Stop hooks.
 *
 * Stop hooks run when Claude is about to stop execution and can:
 * - Block the stop with a reason
 * - Allow the stop to proceed
 * - Inject final context
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanDist } from './setup.js';
import { readHooksJson } from './test-utils.js';

describe('E2E: Stop Hooks', () => {
  afterAll(() => {
    cleanDist();
  });

  describe('Block with reason', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('stop-block-hook.ts');
    });

    it('generates valid hooks.json for stop hook', () => {
      const hooksJsonPath = path.join(pluginDir, 'hooks.json');
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks).toBeDefined();
      expect(typeof hooksJson.hooks).toBe('object');

      // New format: hooks.Stop is an array of matcher entries
      expect(hooksJson.hooks.Stop).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.Stop)).toBe(true);
      expect(hooksJson.hooks.Stop?.length).toBeGreaterThan(0);

      const stopEntry = hooksJson.hooks.Stop?.[0];
      expect(stopEntry?.hooks).toBeDefined();
      expect(stopEntry?.hooks.length).toBeGreaterThan(0);

      const compiledHook = stopEntry?.hooks[0];
      expect(compiledHook?.type).toBe('command');
      expect(compiledHook?.command).toBeDefined();
      expect(fs.existsSync(compiledHook?.command ?? '')).toBe(true);
    });
  });
});
