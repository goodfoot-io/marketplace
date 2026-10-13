/**
 * Verify contract all field reaches key cache behavior with isolated temporary fixtures.
 *
 * @summary Verify contract all field reaches key cache behavior with isolated temporary fixtures.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { fingerprintFiles } from '../src/fingerprint.ts';

/** Declaration text affects the input key even when a new glob matches no files. */
test("a change to contract.all changes a file's key even though it resolves no new files", () => {
  const target = 'probe/__probe_all_field__.test.ts';
  const filesEntry = ['probe/fixture-input.txt'];
  const all = ['probe/shared-baseline.txt'];
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-all-field-'));
  try {
    const testPath = path.join(root, target);
    mkdirSync(path.dirname(testPath), { recursive: true });
    writeFileSync(testPath, 'export const value = 1;\n');
    writeFileSync(path.join(root, 'probe', 'fixture-input.txt'), 'fixture\n');
    writeFileSync(path.join(root, 'probe', 'shared-baseline.txt'), 'baseline\n');
    const before = fingerprintFiles(root, [target], [...all, ...filesEntry]);
    const changedAll = [...all, 'probe/no-such-baseline-file.txt'];
    const after = fingerprintFiles(root, [target], [...changedAll, ...filesEntry]);
    expect(after).not.toBe(before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** Repeating an already-declared input leaves the deduplicated key input set unchanged. */
test('a path already in the declared set does not change the key when repeated', () => {
  const target = 'probe/__probe_dup_field__.test.ts';
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-all-field-dup-'));
  try {
    const testPath = path.join(root, target);
    mkdirSync(path.dirname(testPath), { recursive: true });
    writeFileSync(testPath, 'export const value = 1;\n');
    writeFileSync(path.join(root, 'probe', 'already-declared.txt'), 'shared\n');
    const dedupe = (declarations: string[]) => [...new Set(declarations)].sort();
    const before = fingerprintFiles(root, [target], dedupe(['probe/already-declared.txt']));
    const after = fingerprintFiles(
      root,
      [target],
      dedupe(['probe/already-declared.txt', 'probe/already-declared.txt'])
    );
    expect(after).toBe(before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
