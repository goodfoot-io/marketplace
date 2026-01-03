/**
 * E2E tests for PermissionRequest hooks.
 *
 * PermissionRequest hooks run when Claude requests permission and can:
 * - Auto-allow certain tools
 * - Auto-deny dangerous operations
 * - Apply custom permission logic
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanDist } from './setup.js';
import { readHooksJson } from './test-utils.js';

describe('E2E: PermissionRequest Hooks', () => {
  afterAll(() => {
    cleanDist();
  });

  describe('Auto-allow', () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook('permission-auto-allow-hook.ts');
    });

    it('generates hooks.json with PermissionRequest event and Bash matcher', () => {
      const hooksJsonPath = path.join(pluginDir, 'hooks.json');
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.PermissionRequest).toBeDefined();

      const bashEntry = hooksJson.hooks.PermissionRequest?.find((entry) => entry.matcher === 'Bash');
      expect(bashEntry).toBeDefined();
    });
  });
});
