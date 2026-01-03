/**
 * E2E tests for PostToolUse hooks.
 *
 * PostToolUse hooks run after a tool has executed and can:
 * - Inject context based on tool results
 * - Log tool usage
 * - Modify the conversation flow
 */

import * as fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from './setup.js';
import { readHooksJson } from './test-utils.js';

describe('E2E: PostToolUse Hooks', () => {
  describe('Context injection', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('post-tool-use-context-hook.ts');
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it('generates valid hooks.json with PostToolUse event and Bash matcher', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.PostToolUse).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.PostToolUse)).toBe(true);

      const bashEntry = hooksJson.hooks.PostToolUse?.find((entry) => entry.matcher === 'Bash');
      expect(bashEntry).toBeDefined();
    });
  });
});
