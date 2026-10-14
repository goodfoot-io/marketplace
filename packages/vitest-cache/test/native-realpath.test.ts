/**
 * Verify physical filesystem resolution preserves fingerprint inputs and failures.
 *
 * @summary Verify native realpath behavior for aliases, linked worktrees and invalid links.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';
import { FingerprintPhase, fingerprintFiles } from '../src/fingerprint.ts';

let temporary: string;
let root: string;

beforeEach(async () => {
  temporary = mkdtempSync(path.join(tmpdir(), 'vitest-cache-native-realpath-'));
  root = path.join(temporary, 'repository');
  mkdirSync(root);
});

afterEach(async () => {
  rmSync(temporary, { recursive: true, force: true });
});

test('physical and chained alias roots fingerprint the same effective file and directory links', async () => {
  mkdirSync(path.join(root, 'inputs'));
  writeFileSync(path.join(root, 'inputs', 'source.ts'), 'export const value = 1;\n');
  symlinkSync('inputs/source.ts', path.join(root, 'file-link'));
  symlinkSync('inputs', path.join(root, 'directory-link'), 'dir');
  const alias = path.join(temporary, 'alias');
  const chained = path.join(temporary, 'chained');
  symlinkSync(root, alias, 'dir');
  symlinkSync(alias, chained, 'dir');
  const physical = fingerprintFiles(root, [], ['inputs', 'file-link', 'directory-link']);
  expect(fingerprintFiles(chained, [], ['inputs', 'file-link', 'directory-link'])).toBe(physical);
  expect(realpathSync.native(chained)).toBe(realpathSync(chained));
  const store = new DigestStore(null);
  expect(store.fileDigest(path.join(root, 'file-link'))).toBe(store.fileDigest(path.join(root, 'inputs/source.ts')));
  expect(await store.treeDigest(path.join(root, 'directory-link'))).toBe(
    await store.treeDigest(path.join(root, 'inputs'))
  );
});

test('linked Git worktrees preserve equal fingerprints through root aliases', async () => {
  writeFileSync(path.join(root, 'input.ts'), 'export const value = 1;\n');
  execFileSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: root });
  execFileSync('git', ['add', 'input.ts'], { cwd: root });
  execFileSync(
    'git',
    ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'fixture'],
    {
      cwd: root
    }
  );
  const worktree = path.join(temporary, 'worktree');
  execFileSync('git', ['worktree', 'add', '--quiet', '--detach', worktree], { cwd: root });
  const alias = path.join(temporary, 'worktree-alias');
  symlinkSync(worktree, alias, 'dir');
  expect(fingerprintFiles(alias, ['input.ts'])).toBe(fingerprintFiles(root, ['input.ts']));
  expect(new FingerprintPhase(alias, { store: new DigestStore(null) }).root).toBe(realpathSync(worktree));
});

test('missing and non-directory link targets retain markers while loops fail closed', async () => {
  writeFileSync(path.join(root, 'file'), 'bytes');
  symlinkSync('absent', path.join(root, 'dangling'));
  symlinkSync('file/child', path.join(root, 'not-directory'));
  symlinkSync('loop', path.join(root, 'loop'));
  symlinkSync('.', path.join(root, 'directory-cycle'), 'dir');
  const phase = new FingerprintPhase(root, { store: new DigestStore(null) });
  expect(phase.fileDigest('absent')).toBe('missing');
  expect(phase.fileDigest('dangling')).toBe('link\0absent\0missing');
  expect(phase.fileDigest('not-directory')).toBe('link\0file/child\0missing');
  expect(phase.expand(['dangling', 'not-directory'])).toEqual(['dangling', 'not-directory']);
  expect(() => phase.fileDigest('loop')).toThrow(expect.objectContaining({ code: 'ELOOP' }));
  expect(() => phase.expand(['loop'])).toThrow(expect.objectContaining({ code: 'ELOOP' }));
  expect(() => phase.expand(['directory-cycle'])).toThrow('declared test input symlink cycle');
  expect(() => new FingerprintPhase(path.join(root, 'absent'), { store: new DigestStore(null) })).toThrow(
    expect.objectContaining({ code: 'ENOENT' })
  );
  await expect(new DigestStore(null).treeDigest(path.join(root, 'absent'))).rejects.toThrow(
    expect.objectContaining({ code: 'ENOENT' })
  );
});
