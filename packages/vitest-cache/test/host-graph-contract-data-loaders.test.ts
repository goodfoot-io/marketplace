/**
 * Verify host graph contract data loaders cache behavior with isolated temporary fixtures.
 *
 * @summary Verify host graph contract data loaders cache behavior with isolated temporary fixtures.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { collectHostGraph } from '../src/host-graph.ts';

// A large per-file table loaded through loadCacheContract/loadTestSequence
// (src/test-output-policy.mjs) must not itself become a host graph edge:
// every file sharing the config as a host root would then key on the whole
// table's bytes, defeating the separate-JSON design (editing one file's
// declaration would re-run every file). An ordinary `new URL(...)` asset
// reference elsewhere in the same config must still be followed.
let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-host-contract-data-'));
  writeFileSync(path.join(root, 'contract.json'), '{}\n');
  writeFileSync(path.join(root, 'sequence.json'), '[]\n');
  writeFileSync(path.join(root, 'asset.mjs'), 'export default 1;\n');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test('a loadCacheContract argument is not followed as a host graph edge', async () => {
  writeFileSync(
    path.join(root, 'config.mjs'),
    "function loadCacheContract(url) { return url; }\nloadCacheContract(new URL('./contract.json', import.meta.url));\n"
  );
  const result = await collectHostGraph(root, ['config.mjs'], {});
  expect(result.files).toEqual(['config.mjs']);
});

test('a loadTestSequence argument is not followed as a host graph edge', async () => {
  writeFileSync(
    path.join(root, 'config.mjs'),
    "function loadTestSequence(url) { return url; }\nloadTestSequence(new URL('./sequence.json', import.meta.url));\n"
  );
  const result = await collectHostGraph(root, ['config.mjs'], {});
  expect(result.files).toEqual(['config.mjs']);
});

test('a new URL(...) not passed to a contract data loader is still followed', async () => {
  writeFileSync(
    path.join(root, 'config.mjs'),
    "import { fileURLToPath } from 'node:url';\nexport default fileURLToPath(new URL('./asset.mjs', import.meta.url));\n"
  );
  const result = await collectHostGraph(root, ['config.mjs'], {});
  expect(result.files).toEqual(['asset.mjs', 'config.mjs']);
});

test('a same-shaped call under a different name is still followed', async () => {
  writeFileSync(
    path.join(root, 'config.mjs'),
    "function loadSomethingElse(url) { return url; }\nloadSomethingElse(new URL('./asset.mjs', import.meta.url));\n"
  );
  const result = await collectHostGraph(root, ['config.mjs'], {});
  expect(result.files).toEqual(['asset.mjs', 'config.mjs']);
});
