/**
 * Verify package names across configuration, environment and native diagnostic boundaries.
 *
 * @summary Verify package configuration and diagnostic identifiers.
 */
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test, vi } from 'vitest';
import { createVitest } from 'vitest/node';
import { keyedEnvironment } from '../src/environment.ts';
import { createTestOutputCapture } from '../src/test-output-capture.mjs';
import { frameExpectedNativeError } from '../src/test-output-native.mjs';
import { withTestOutput } from '../src/test-output-policy.mjs';
import TestOutputReporter from '../src/test-output-reporter.mjs';
import { testVerbose } from '../src/test-verbose.mjs';

const cleanups: (() => unknown)[] = [];

afterEach(async () => {
  for (let cleanup = cleanups.pop(); cleanup; cleanup = cleanups.pop()) await cleanup();
  vi.unstubAllEnvs();
});

test('the package verbosity switch accepts only unset, empty, 0 or 1', () => {
  expect(testVerbose({})).toBe(false);
  for (const value of ['', '0']) expect(testVerbose({ GOODFOOT_TEST_VERBOSE: value })).toBe(false);
  expect(testVerbose({ GOODFOOT_TEST_VERBOSE: '1' })).toBe(true);
  expect(() => testVerbose({ GOODFOOT_TEST_VERBOSE: 'yes' })).toThrow('GOODFOOT_TEST_VERBOSE must be unset, 0, or 1');
});

test('cache controls do not split keys and capture paths normalize to enabled', () => {
  const environment = { GOODFOOT_VITEST_FORCE: '1', GOODFOOT_VITEST_CACHE_ACK: '/tmp/stage-a.json' };
  expect(keyedEnvironment(environment)).toEqual([]);
  expect(keyedEnvironment({ ...environment, GOODFOOT_TEST_OUTPUT_RESULT: '/tmp/capture-a.jsonl' })).toEqual([
    ['GOODFOOT_TEST_OUTPUT_RESULT', 'enabled']
  ]);
  expect(keyedEnvironment({ GOODFOOT_TEST_OUTPUT_RESULT: '/tmp/capture-b.jsonl' })).toEqual([
    ['GOODFOOT_TEST_OUTPUT_RESULT', 'enabled']
  ]);
});

test('configuration provides the package context keys from its environment switches', () => {
  vi.stubEnv('GOODFOOT_TEST_VERBOSE', '0');
  vi.stubEnv('GOODFOOT_TEST_OUTPUT_RESULT', '/tmp/capture.jsonl');
  const contract = { uncached: 'identity checks' };
  const configuration = withTestOutput({ test: {} }, contract);
  expect(configuration.test?.provide).toEqual({
    goodfootTestVerbose: false,
    goodfootNativeCapture: true,
    goodfootCacheInputs: contract
  });
  expect(configuration.test?.silent).toBe('passed-only');
  vi.stubEnv('GOODFOOT_TEST_VERBOSE', '1');
  const verbose = withTestOutput({ test: {} }, contract);
  expect(verbose.test?.provide?.goodfootTestVerbose).toBe(true);
  expect(verbose.test?.provide?.goodfootNativeCapture).toBe(false);
  expect(verbose.test?.silent).toBe(false);
});

test('real Vitest metadata, native frames and capture reconcile using package identifiers', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-identity-'));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), path.join(root, 'node_modules'), 'dir');
  const token = '00000000-0000-0000-0000-000000000001';
  const message = 'expected fixture diagnostic';
  const workerdMessage = 'fixture stream rejection';
  writeFileSync(
    path.join(root, 'claims.test.ts'),
    `import { test } from 'vitest';
test('claims diagnostics', ({ task }) => {
  task.meta.goodfootExpectedNative = [{ token: '${token}', message: '${message}' }];
  task.meta.goodfootExpectedWorkerd = [{ shape: 'promise-rejection', message: '${workerdMessage}', count: 1 }];
});\n`
  );
  const capture = createTestOutputCapture(root);
  cleanups.push(() => rmSync(path.dirname(capture.resultPath), { recursive: true, force: true }));
  vi.stubEnv('GOODFOOT_TEST_OUTPUT_RESULT', capture.resultPath);
  const reporter = new TestOutputReporter({ cachedPassingTests: () => 0 });
  const ctx = await createVitest(
    'test',
    {
      root,
      config: false,
      watch: false,
      reporters: [{ onTestCaseResult: (testCase) => reporter.onTestCaseResult(testCase) }]
    },
    { logLevel: 'silent' }
  );
  cleanups.push(() => ctx.close());
  const result = await ctx.start();
  expect(result.unhandledErrors).toEqual([]);
  expect(readFileSync(capture.resultPath, 'utf8')).toContain('"state":"passed"');
  const error = frameExpectedNativeError(new Error(message), token);
  expect(error.stack).toMatch(/^__GOODFOOT_EXPECTED_NATIVE__/);
  const bytes = Buffer.from(
    `uncaught exception; source = Uncaught (in promise); stack = ${error.stack}\n` +
      `uncaught exception; source = Uncaught (in promise); exception = ${workerdMessage}\n`
  );
  const forwarded: Buffer[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      forwarded.push(Buffer.from(chunk));
      callback();
    }
  });
  await capture.pump(Readable.from([bytes.subarray(0, 17), bytes.subarray(17)]), destination);
  expect(capture.finish(0)).toBe(0);
  expect(capture.accepted()).toBe(true);
  expect(Buffer.concat(forwarded).length).toBe(0);
});
