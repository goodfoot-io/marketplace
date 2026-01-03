/**
 * E2E tests for hooks.json structure validation.
 *
 * These tests verify the generated hooks.json format and metadata.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { buildSingleHook, cleanDist } from './setup.js';
import { readHooksJson } from './test-utils.js';

describe('E2E: hooks.json Structure Validation', () => {
  afterAll(() => {
    cleanDist();
  });

  it('includes __generated metadata with files and timestamp', () => {
    const pluginDir = buildSingleHook('deny-bash-hook.ts');
    const hooksJsonPath = path.join(pluginDir, 'hooks.json');
    const hooksJson = readHooksJson(hooksJsonPath);

    expect(hooksJson.__generated).toBeDefined();
    expect(Array.isArray(hooksJson.__generated.files)).toBe(true);
    expect(hooksJson.__generated.files.length).toBeGreaterThan(0);
    expect(typeof hooksJson.__generated.timestamp).toBe('string');
  });

  it('compiled hook files are executable', () => {
    const pluginDir = buildSingleHook('deny-bash-hook.ts');
    const hooksJsonPath = path.join(pluginDir, 'hooks.json');
    const hooksJson = readHooksJson(hooksJsonPath);

    const entry = hooksJson.hooks.PreToolUse?.[0];
    const hookCommand = entry?.hooks[0].command;

    // Verify the file exists and ends with .mjs
    expect(hookCommand).toBeDefined();
    expect(fs.existsSync(hookCommand ?? '')).toBe(true);
    expect(hookCommand?.endsWith('.mjs')).toBe(true);
  });
});
