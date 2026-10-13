/**
 * Verify nonimport source read cache behavior with isolated temporary fixtures.
 *
 * @summary Verify nonimport source read cache behavior with isolated temporary fixtures.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { fingerprintFiles } from '../src/fingerprint.ts';

test('a source-scanning test invalidates when an unimported source file is added', () => {
  const scannedTest = 'packages/app/test/source-scan.test.ts';
  const addedSource = 'packages/app/src/__cache_probe.ts';
  // A test that scans source text declares the scanned tree as a non-import input.
  const inputs = ['packages/app/src/**'];
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-source-read-'));

  try {
    const testPath = path.join(root, scannedTest);
    mkdirSync(path.dirname(testPath), { recursive: true });
    writeFileSync(testPath, 'export const value = 1;\n');
    const before = fingerprintFiles(root, [scannedTest], inputs);

    const sourcePath = path.join(root, addedSource);
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, "export const cacheProbe = 'UPDATE repos SET org_id = ? WHERE id = ?';\n");

    expect(fingerprintFiles(root, [scannedTest], inputs)).not.toBe(before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
