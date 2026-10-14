/**
 * Verify tree file bodies cannot impersonate subsequent member headers.
 *
 * @summary Verify distinct effective file trees have distinct digests.
 */

import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';

test.each(['regular file', 'symlinked file'])('%s bodies cannot impersonate another tree member', async (kind) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'tree-framing-'));
  try {
    const single = path.join(fixture, 'single');
    const multiple = path.join(fixture, 'multiple');
    await mkdir(single);
    await mkdir(multiple);
    await chmod(single, 0o755);
    await chmod(multiple, 0o755);

    const combined = Buffer.from(['X', 'b', 'file', '420', 'Y'].join('\0'));
    const singleFile = kind === 'regular file' ? path.join(single, 'a') : path.join(fixture, 'target');
    await writeFile(singleFile, combined);
    await chmod(singleFile, 0o644);
    if (kind === 'symlinked file') await symlink(singleFile, path.join(single, 'a'));

    await writeFile(path.join(multiple, 'a'), 'X');
    await writeFile(path.join(multiple, 'b'), 'Y');
    await chmod(path.join(multiple, 'a'), 0o644);
    await chmod(path.join(multiple, 'b'), 0o644);

    const singleDigest = await new DigestStore(null).treeDigest(single);
    const multipleDigest = await new DigestStore(null).treeDigest(multiple);
    expect(singleDigest).not.toBe(multipleDigest);
  } finally {
    await rm(fixture, { force: true, recursive: true });
  }
});
