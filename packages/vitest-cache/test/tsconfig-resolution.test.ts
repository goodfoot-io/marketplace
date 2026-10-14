/**
 * Verify expected package-resolution misses and unexpected config errors in cache inputs.
 *
 * @summary Verify TypeScript config package resolution failures.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { createResolutionCache, resolutionInputsForFile } from '../src/host-graph.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-config-resolution-'));
  writeFileSync(path.join(root, 'source.ts'), 'export {};\n');
  writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: 'config-package' }));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

test('a missing config package leaves the nearest config as an input', async () => {
  expect(await resolutionInputsForFile(createResolutionCache(root), 'source.ts')).toEqual(['tsconfig.json']);
});

test('an export-blocked package root can resolve its exported tsconfig subpath', async () => {
  const configPackage = path.join(root, 'config-package');
  mkdirSync(configPackage);
  mkdirSync(path.join(root, 'node_modules'));
  writeFileSync(
    path.join(configPackage, 'package.json'),
    JSON.stringify({ name: 'config-package', exports: { './tsconfig.json': './tsconfig.json' } })
  );
  writeFileSync(path.join(configPackage, 'tsconfig.json'), '{}\n');
  symlinkSync(configPackage, path.join(root, 'node_modules', 'config-package'), 'dir');
  expect(await resolutionInputsForFile(createResolutionCache(root), 'source.ts')).toEqual([
    'config-package/tsconfig.json',
    'tsconfig.json'
  ]);
});

test('a malformed config package manifest propagates instead of becoming a missing input', async () => {
  const configPackage = path.join(root, 'node_modules', 'config-package');
  mkdirSync(configPackage, { recursive: true });
  writeFileSync(path.join(configPackage, 'package.json'), '{invalid');
  await expect(resolutionInputsForFile(createResolutionCache(root), 'source.ts')).rejects.toThrow(
    /Invalid package config/
  );
});
