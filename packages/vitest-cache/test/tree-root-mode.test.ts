/**
 * Verify installed tree digests include the package root directory mode.
 *
 * @summary Verify root mode changes invalidate persistent tree digests.
 */

import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';

test('a chmod-only change on the tree root changes its persistent digest', async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'tree-root-mode-'));
  try {
    const tree = path.join(fixture, 'package');
    const records = path.join(fixture, 'records');
    mkdirSync(tree);
    chmodSync(tree, 0o755);
    writeFileSync(path.join(tree, 'tool'), 'tool');
    // Age the original metadata so unchanged records qualify for persistent reuse.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2100);

    const before = await new DigestStore(records).treeDigest(tree);
    const unchanged = new DigestStore(records);
    expect(await unchanged.treeDigest(tree)).toBe(before);
    expect(unchanged.stats.reused).toBe(1);

    chmodSync(tree, 0o700);

    const after = await new DigestStore(records).treeDigest(tree);
    expect(after).not.toBe(before);
  } finally {
    rmSync(fixture, { force: true, recursive: true });
  }
});
