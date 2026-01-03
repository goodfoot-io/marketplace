/**
 * E2E tests for UserPromptSubmit hooks.
 *
 * UserPromptSubmit hooks run when a user submits a prompt and can:
 * - Inject context based on the prompt
 * - Modify the prompt before processing
 * - Add system messages
 */

import * as fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from './setup.js';
import { CLAUDE_AVAILABLE, runClaude, readHooksJson } from './test-utils.js';

describe('E2E: UserPromptSubmit Hooks', () => {
  describe('Context injection', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('user-prompt-submit-hook.ts');
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it.skipIf(!CLAUDE_AVAILABLE)('injects context on prompt submission that Claude sees', () => {
      const result = runClaude({
        prompt: 'What is the projectName from the JSON context? Just say the name.',
        pluginDir,
        tools: []
      });

      expect(result.stdout.toLowerCase()).toContain('acme');
    });

    it('generates hooks.json with UserPromptSubmit event (no matcher supported)', () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.UserPromptSubmit).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.UserPromptSubmit)).toBe(true);
    });
  });
});
