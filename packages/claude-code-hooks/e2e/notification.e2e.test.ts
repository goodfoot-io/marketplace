/**
 * E2E tests for Notification hooks.
 *
 * Notification hooks run when Claude sends notifications and can:
 * - Log notifications
 * - Forward to external services
 * - Filter or modify notifications
 */

import * as fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from './setup.js';
import { readHooksJson } from './test-utils.js';

describe('E2E: Notification Hooks', () => {
  let pluginDir: string;

  beforeAll(() => {
    pluginDir = buildSingleHook('notification-hook.ts');
  });

  afterAll(() => {
    cleanOutputDir(pluginDir);
  });

  it('builds and compiles notification hook correctly', () => {
    const hooksJsonPath = getHooksJsonPath(pluginDir);
    expect(fs.existsSync(hooksJsonPath)).toBe(true);

    const hooksJson = readHooksJson(hooksJsonPath);
    const notificationHooks = hooksJson.hooks.Notification;
    expect(notificationHooks).toBeDefined();
    expect(notificationHooks!.length).toBeGreaterThan(0);

    const entry = notificationHooks![0];
    expect(entry.hooks.length).toBeGreaterThan(0);
    expect(entry.hooks[0].command).toContain('.mjs');
  });
});
