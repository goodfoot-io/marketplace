/**
 * Exercise bounded hashing and failure cleanup against real filesystem inputs.
 * @summary Verify large effective file bytes without file-sized allocations.
 */
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'digest-stream-'));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('large files, effective links and sorted trees preserve exact SHA framing and byte counters', async () => {
  const root = fixture();
  const tree = path.join(root, 'tree');
  mkdirSync(tree);
  chmodSync(tree, 0o755);
  const size = 17 * 1024 * 1024 + 39;
  const file = path.join(tree, 'a-binary');
  const bytes = Buffer.allocUnsafe(size);
  for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
  writeFileSync(file, bytes, { mode: 0o644 });
  symlinkSync(file, path.join(tree, 'z-link'));
  const expectedFile = createHash('sha256').update('420\0').update(bytes).digest('hex');
  const store = new DigestStore(null);
  expect(await store.fileDigest(file)).toBe(expectedFile);
  expect(await store.fileDigest(path.join(tree, 'z-link'))).toBe(expectedFile);
  const expectedTree = createHash('sha256').update('vitest-tree-digest-v4\0.\0directory\0' + '493\0');
  expectedTree
    .update('a-binary\0file\0' + '420\0')
    .update(`${size}\0`)
    .update(bytes)
    .update('\0');
  expectedTree
    .update('z-link\0file\0' + '420\0')
    .update(`${size}\0`)
    .update(bytes)
    .update('\0');
  expect(await store.treeDigest(tree)).toBe(expectedTree.digest('hex'));
  expect(store.stats.bytesRead).toBe(size * 4);
  chmodSync(file, 0o755);
  const changed = new DigestStore(null);
  expect(await changed.fileDigest(file)).toBe(createHash('sha256').update('493\0').update(bytes).digest('hex'));
  expect(await changed.treeDigest(tree)).not.toBe(await store.treeDigest(tree));
});
