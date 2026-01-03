/**
 * E2E tests for UserPromptSubmit hooks.
 *
 * UserPromptSubmit hooks run when a user submits a prompt and can:
 * - Inject context based on the prompt
 * - Modify the prompt before processing
 * - Add system messages
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanDist } from './setup.js';
import { CLAUDE_AVAILABLE, runClaude, readHooksJson } from './test-utils.js';

describe.skipIf(!CLAUDE_AVAILABLE)('E2E: UserPromptSubmit Hooks', () => {
  afterAll(() => {
    cleanDist();
  });

  describe.only('Context injection', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('user-prompt-submit-hook.ts');
    });

    it('injects context on prompt submission that Claude sees', () => {
      const result = runClaude({
        prompt: 'Say the secret word. Do not include any other content in your response.',
        pluginDir,
        tools: []
      });

      expect(result.stdout.toLowerCase()).toContain('turnip');
    });

    it('generates hooks.json with UserPromptSubmit event (no matcher supported)', () => {
      const hooksJsonPath = path.join(pluginDir, 'hooks.json');
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.UserPromptSubmit).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.UserPromptSubmit)).toBe(true);
    });
  });
});
