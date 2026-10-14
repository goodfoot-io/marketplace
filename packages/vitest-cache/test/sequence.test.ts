/**
 * Verify sequence cache behavior with isolated temporary fixtures.
 *
 * @summary Verify sequence cache behavior with isolated temporary fixtures.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { compareByDeclaredRank, declaredRank, validateSequence, verifySequence } from '../src/sequence.ts';

test('validateSequence rejects a non-array, an empty array, and a non-string entry', () => {
  expect(() => validateSequence(null)).toThrow(/nonempty array/);
  expect(() => validateSequence([])).toThrow(/nonempty array/);
  expect(() => validateSequence(['a.test.ts', 7])).toThrow(/nonempty strings/);
  expect(() => validateSequence(['a.test.ts', ''])).toThrow(/nonempty strings/);
});

test('validateSequence rejects a path outside the repository', () => {
  expect(() => validateSequence(['/absolute.test.ts'])).toThrow(/non-repository path/);
  expect(() => validateSequence(['../escape.test.ts'])).toThrow(/non-repository path/);
  expect(() => validateSequence(['a/../../escape.test.ts'])).toThrow(/non-repository path/);
});

test('validateSequence rejects a duplicate entry, including a separator-only difference', () => {
  expect(() => validateSequence(['a.test.ts', 'a.test.ts'])).toThrow(/duplicate entry/);
  expect(() => validateSequence(['a/b.test.ts', 'a\\b.test.ts'])).toThrow(/duplicate entry/);
});

test('validateSequence accepts a well-formed declaration and returns it unchanged', () => {
  const declaration = ['heavy.test.ts', 'lighter.test.ts'];
  expect(validateSequence(declaration)).toBe(declaration);
});

test('verifySequence fails loudly when a declared file no longer exists', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-sequence-'));
  try {
    mkdirSync(path.join(root, 'test-do'), { recursive: true });
    writeFileSync(path.join(root, 'test-do', 'present.test.ts'), 'export {};\n');
    await expect(verifySequence(['test-do/present.test.ts'], root)).resolves.toEqual(['test-do/present.test.ts']);
    await expect(verifySequence(['test-do/present.test.ts', 'test-do/missing.test.ts'], root)).rejects.toThrow(
      /no longer exists: test-do\/missing\.test\.ts/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('declaredRank and compareByDeclaredRank order declared files first, heaviest first', () => {
  const rank = declaredRank(['heavy.test.ts', 'medium.test.ts']);
  expect(compareByDeclaredRank(rank, 'heavy.test.ts', 'medium.test.ts')).toBeLessThan(0);
  expect(compareByDeclaredRank(rank, 'medium.test.ts', 'heavy.test.ts')).toBeGreaterThan(0);
  expect(compareByDeclaredRank(rank, 'heavy.test.ts', 'heavy.test.ts')).toBe(0);
});

test('compareByDeclaredRank runs every undeclared file after every declared one, alphabetically among themselves', () => {
  const rank = declaredRank(['heavy.test.ts']);
  expect(compareByDeclaredRank(rank, 'heavy.test.ts', 'undeclared.test.ts')).toBeLessThan(0);
  expect(compareByDeclaredRank(rank, 'zebra.test.ts', 'alpha.test.ts')).toBeGreaterThan(0);
  expect(compareByDeclaredRank(rank, 'alpha.test.ts', 'zebra.test.ts')).toBeLessThan(0);
});

test('compareByDeclaredRank normalizes path separators so declaration and lookup agree', () => {
  const rank = declaredRank(['nested/heavy.test.ts']);
  expect(compareByDeclaredRank(rank, 'nested\\heavy.test.ts', 'other.test.ts')).toBeLessThan(0);
});
