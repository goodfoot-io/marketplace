/**
 * Verify ignored install input cache behavior with isolated temporary fixtures.
 *
 * @summary Verify ignored install input cache behavior with isolated temporary fixtures.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { fingerprintFiles } from '../src/fingerprint.ts';

test('a declared source glob ignores installed residue but hashes source changes', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-declared-input-'));
  try {
    const source = path.join(root, 'public', 'guide.md');
    mkdirSync(path.dirname(source), { recursive: true });
    writeFileSync(source, 'first\n');
    const bin = path.join(root, 'public', 'packages', 'cli', 'node_modules', '.bin');
    mkdirSync(path.dirname(path.dirname(bin)), { recursive: true });
    const before = await fingerprintFiles(root, [], ['public/**']);

    mkdirSync(bin, { recursive: true });
    symlinkSync('../../src/bin.ts', path.join(bin, 'ao'));
    expect(await fingerprintFiles(root, [], ['public/**'])).toBe(before);

    writeFileSync(source, 'second\n');
    expect(await fingerprintFiles(root, [], ['public/**'])).not.toBe(before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
