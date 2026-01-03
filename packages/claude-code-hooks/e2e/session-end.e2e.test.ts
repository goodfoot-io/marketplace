/**
 * E2E tests for SessionEnd hooks.
 *
 * SessionEnd hooks run when a Claude session ends and can:
 * - Clean up resources
 * - Log session metrics
 * - Persist state
 *
 * Note: SessionEnd hooks may not fire in --print mode since the session
 * lifecycle is different from interactive mode.
 */

import * as fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from './setup.js';
import { readHooksJson } from './test-utils.js';

describe('E2E: SessionEnd Hooks', () => {
  let pluginDir: string;

  beforeAll(() => {
    pluginDir = buildSingleHook('session-end-hook.ts');
  });

  afterAll(() => {
    cleanOutputDir(pluginDir);
  });

  it('generates valid hooks.json with SessionEnd event', () => {
    const hooksJsonPath = getHooksJsonPath(pluginDir);
    expect(fs.existsSync(hooksJsonPath)).toBe(true);

    const hooksJson = readHooksJson(hooksJsonPath);
    expect(hooksJson.hooks.SessionEnd).toBeDefined();
    expect(Array.isArray(hooksJson.hooks.SessionEnd)).toBe(true);
    expect(hooksJson.hooks.SessionEnd?.length).toBeGreaterThan(0);

    const entry = hooksJson.hooks.SessionEnd?.[0];
    expect(entry?.hooks.length).toBeGreaterThan(0);
    expect(entry?.hooks[0].command).toContain('.mjs');
  });
});
