/**
 * Verify normalization of synthetic worktree paths and session environment values.
 *
 * @summary Verify normalization of synthetic worktree paths and session environment values.
 */
import path from 'node:path';
import { expect, test } from 'vitest';
import { keyedEnvironment } from '../src/environment.ts';
import { environmentValue, stripSessionEnvironment } from '../src/index.ts';

test('a shared absolute PATH entry has the same cache value in separate worktrees', () => {
  const primary = '/workspace';
  const branch = '/tmp/cache-branch';
  const shared = `${primary}/.devcontainer/utilities`;
  const value = [shared, '/usr/bin'].join(path.delimiter);

  expect(environmentValue('PATH', value, primary)).toBe(environmentValue('PATH', value, branch));
  expect(environmentValue('PATH', value, primary)).toBe(value);
});

test('a shared absolute environment path has the same cache value in separate worktrees', () => {
  const primary = '/workspace';
  const branch = '/tmp/cache-branch';
  const shared = `${primary}/packages/example/.wrangler/state-dev`;

  expect(environmentValue('E2E_STATE_DEV', shared, primary)).toBe(environmentValue('E2E_STATE_DEV', shared, branch));
  expect(environmentValue('E2E_STATE_DEV', shared, primary)).toBe(shared);
});

test('antigravity and gemini agent metadata are classified as session variables and stripped', () => {
  const env = {
    PATH: '/usr/bin',
    ANTIGRAVITY_SOURCE_METADATA: '{"step": 1}',
    ANTIGRAVITY_CONVERSATION_ID: 'conv-123',
    ANTIGRAVITY_AGENT: '1',
    GEMINI_CLI: '1',
    AGY_SESSION: 'xyz'
  };

  stripSessionEnvironment(env);
  expect(env.ANTIGRAVITY_SOURCE_METADATA).toBeUndefined();
  expect(env.ANTIGRAVITY_CONVERSATION_ID).toBeUndefined();
  expect(env.ANTIGRAVITY_AGENT).toBeUndefined();
  expect(env.GEMINI_CLI).toBeUndefined();
  expect(env.AGY_SESSION).toBeUndefined();
  expect(env.PATH).toBe('/usr/bin');
});

test('Turbo task hash, UI and invocation directory metadata do not change a file cache key and are unobservable in cached suites', () => {
  const direct = { NODE_ENV: 'test' };
  const turbo = { ...direct, TURBO_HASH: 'task-hash-a', TURBO_IS_TUI: 'true', TURBO_INVOCATION_DIR: '/workspace' };
  const changedTask = {
    ...direct,
    TURBO_HASH: 'task-hash-b',
    TURBO_IS_TUI: 'false',
    TURBO_INVOCATION_DIR: '/tmp/cache-branch/packages/vitest-cache'
  };

  expect(keyedEnvironment(turbo)).toEqual(keyedEnvironment(direct));
  expect(keyedEnvironment(changedTask)).toEqual(keyedEnvironment(direct));
  stripSessionEnvironment(turbo);
  expect(turbo).toEqual(direct);
});

test('Turbo application ports and unknown variables remain observable and invalidate file cache keys', () => {
  for (const name of ['TURBO_IS_MFE', 'TURBO_CUSTOM_INPUT']) {
    const environment = { [name]: '3000' };
    stripSessionEnvironment(environment);
    expect(environment).toEqual({ [name]: '3000' });
    expect(keyedEnvironment(environment)).toEqual([[name, '3000']]);
    expect(keyedEnvironment(environment)).not.toEqual(keyedEnvironment({ [name]: '3001' }));
  }
});

test('Turbo metadata normalization preserves cache control values without keying them', () => {
  const environment = {
    TURBO_HASH: 'task-hash',
    TURBO_IS_TUI: 'true',
    DISABLE_TEST_CACHE: 'true',
    GOODFOOT_VITEST_FORCE: '1'
  };

  stripSessionEnvironment(environment);
  expect(environment).toEqual({ DISABLE_TEST_CACHE: 'true', GOODFOOT_VITEST_FORCE: '1' });
  expect(keyedEnvironment(environment)).toEqual([]);
});
