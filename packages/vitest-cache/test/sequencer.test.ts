/**
 * Verify cache sequencing against Vitest's current result API and real file sizes.
 *
 * @summary Verify Vitest result history and file size ordering.
 */
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { type CachedTestFileResult, createVitest } from 'vitest/node';
import { ContentCacheSequencer } from '../src/index.ts';

const cleanups: (() => unknown)[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (let cleanup = cleanups.pop(); cleanup; cleanup = cleanups.pop()) await cleanup();
});

/**
 * Discover real Vitest specifications without executing the fixture tests.
 * @returns Vitest context, discovered specifications and temporary root.
 */
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-sequencer-'));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(path.join(root, 'small.test.ts'), 'export {};\n');
  writeFileSync(path.join(root, 'large.test.ts'), `export {};\n// ${'x'.repeat(1000)}\n`);
  const ctx = await createVitest('test', { root, config: false, watch: false }, { logLevel: 'silent' });
  cleanups.push(() => ctx.close());
  const specifications = await ctx.globTestSpecifications();
  return { ctx, specifications, root };
}

test('files without result history run largest first using filesystem sizes', async () => {
  const { ctx, specifications } = await fixture();
  const results = vi.spyOn(ctx.cache, 'getTestSpecificationResult').mockReturnValue(undefined);
  const sorted = await new ContentCacheSequencer(ctx).sort(specifications);
  expect(sorted.map((specification) => path.basename(specification.moduleId))).toEqual([
    'large.test.ts',
    'small.test.ts'
  ]);
  expect(results.mock.calls.map(([specification]) => specification)).toEqual(specifications);
});

test('an unknown file size runs before a known size', async () => {
  const { ctx, specifications, root } = await fixture();
  vi.spyOn(ctx.cache, 'getTestSpecificationResult').mockReturnValue(undefined);
  unlinkSync(path.join(root, 'small.test.ts'));
  const sorted = await new ContentCacheSequencer(ctx).sort(specifications);
  expect(sorted.map((specification) => path.basename(specification.moduleId))).toEqual([
    'small.test.ts',
    'large.test.ts'
  ]);
});

test('recorded failures and then durations take priority over file sizes', async () => {
  const { ctx, specifications } = await fixture();
  const history = new Map<string, CachedTestFileResult>([
    ['small.test.ts', { failed: true, duration: 1 }],
    ['large.test.ts', { failed: false, duration: 100 }]
  ]);
  vi.spyOn(ctx.cache, 'getTestSpecificationResult').mockImplementation((specification) =>
    history.get(path.basename(specification.moduleId))
  );
  const sequencer = new ContentCacheSequencer(ctx);
  expect((await sequencer.sort(specifications)).map((specification) => path.basename(specification.moduleId))).toEqual([
    'small.test.ts',
    'large.test.ts'
  ]);
  history.set('small.test.ts', { failed: false, duration: 200 });
  expect((await sequencer.sort(specifications)).map((specification) => path.basename(specification.moduleId))).toEqual([
    'small.test.ts',
    'large.test.ts'
  ]);
});
