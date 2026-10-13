/**
 * Verify host graph import aliases cache behavior with isolated temporary fixtures.
 *
 * @summary Verify host graph import aliases cache behavior with isolated temporary fixtures.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { collectHostGraph } from '../src/host-graph.ts';

// A host module (like a Vite plugin's own config-time import) that statically
// imports a specifier its own runtime plugin redirects elsewhere. Its production
// import only exists under a build the test suite never produces.
let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-host-alias-'));
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(path.join(root, 'build-test'), { recursive: true });
  writeFileSync(
    path.join(root, 'src', 'host-root.mjs'),
    "import value from '../missing/target.mjs';\nexport default value;\n"
  );
  writeFileSync(
    path.join(root, 'src', 'other-root.mjs'),
    "import value from '../missing/target.mjs';\nexport default value;\n"
  );
  writeFileSync(path.join(root, 'build-test', 'actual-target.mjs'), 'export default 42;\n');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test('an unaliased host import to a nonexistent target is unresolved', async () => {
  await expect(collectHostGraph(root, ['src/host-root.mjs'], {})).rejects.toThrow(
    `unresolved host import ../missing/target.mjs from ${path.join(root, 'src', 'host-root.mjs')}`
  );
});

test('a declared hostImportAliases entry redirects the edge to its real target', async () => {
  const importAliases = [
    {
      importer: path.join(root, 'src', 'host-root.mjs'),
      from: '../missing/target.mjs',
      to: path.join(root, 'build-test', 'actual-target.mjs')
    }
  ];
  const result = await collectHostGraph(root, ['src/host-root.mjs'], { importAliases });
  expect(result.files).toContain('src/host-root.mjs');
  expect(result.files).toContain('build-test/actual-target.mjs');
  expect(result.files).not.toContain('missing/target.mjs');
});

test('an alias whose target does not exist fails closed with the aliased path in the message', async () => {
  const importAliases = [
    {
      importer: path.join(root, 'src', 'host-root.mjs'),
      from: '../missing/target.mjs',
      to: path.join(root, 'build-test', 'does-not-exist.mjs')
    }
  ];
  await expect(collectHostGraph(root, ['src/host-root.mjs'], { importAliases })).rejects.toThrow(
    /unresolved host import alias \.\.\/missing\/target\.mjs from src\/host-root\.mjs -> .*does-not-exist\.mjs/
  );
});

test('an alias only redirects the declared importer, not every module using the same specifier', async () => {
  const importAliases = [
    {
      importer: path.join(root, 'src', 'host-root.mjs'),
      from: '../missing/target.mjs',
      to: path.join(root, 'build-test', 'actual-target.mjs')
    }
  ];
  // other-root.mjs has the identical unresolved specifier but is not the declared importer.
  await expect(collectHostGraph(root, ['src/other-root.mjs'], { importAliases })).rejects.toThrow(
    `unresolved host import ../missing/target.mjs from ${path.join(root, 'src', 'other-root.mjs')}`
  );
});

test('an alias whose declared importer does not exist is a contract error, fail closed', async () => {
  const importAliases = [
    {
      importer: path.join(root, 'src', 'no-such-file.mjs'),
      from: '../missing/target.mjs',
      to: path.join(root, 'build-test', 'actual-target.mjs')
    }
  ];
  await expect(collectHostGraph(root, ['src/host-root.mjs'], { importAliases })).rejects.toThrow(
    `hostImportAliases importer does not exist: ${path.join(root, 'src', 'no-such-file.mjs')}`
  );
});

test('a repository-relative importer and target resolve the same as absolute ones', async () => {
  const importAliases = [
    { importer: 'src/host-root.mjs', from: '../missing/target.mjs', to: 'build-test/actual-target.mjs' }
  ];
  const result = await collectHostGraph(root, ['src/host-root.mjs'], { importAliases });
  expect(result.files).toContain('build-test/actual-target.mjs');
});
