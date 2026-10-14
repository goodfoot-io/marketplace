/**
 * Verify fallback inputs cache behavior with isolated temporary fixtures.
 *
 * @summary Verify fallback inputs cache behavior with isolated temporary fixtures.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { type CacheContract, validateContract } from '../src/contract.ts';
import { fingerprintFiles } from '../src/fingerprint.ts';

test('a declared input edit invalidates only the files that declare it', async () => {
  const pure = 'packages/app/test/price.test.ts';
  const sqlite = 'packages/app/test/price.sqlite.test.ts';
  const audited = 'packages/app/test/validation.test.ts';
  const migration = 'packages/app/migrations/0001_schema.sql';
  const contract: CacheContract = {
    files: { [sqlite]: ['packages/app/migrations/**'], [audited]: [] },
    fallback: []
  };
  validateContract(contract);
  const pureInputs = contract.files?.[pure] ?? contract.fallback;
  const sqliteInputs = contract.files?.[sqlite] ?? contract.fallback;
  const auditedInputs = contract.files?.[audited];

  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-fallback-'));
  const put = (relative: string, content: string) => {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };

  try {
    put(pure, 'export const value = 1;\n');
    put(sqlite, 'export const value = 3;\n');
    put(audited, 'export const value = 2;\n');
    put(migration, '-- original migration\n');
    const pureBefore = await fingerprintFiles(root, [pure], pureInputs);
    const sqliteBefore = await fingerprintFiles(root, [sqlite], sqliteInputs);
    const auditedBefore = await fingerprintFiles(root, [audited], auditedInputs);

    put(migration, '-- original migration\n-- unrelated edit\n');

    expect(await fingerprintFiles(root, [audited], auditedInputs)).toBe(auditedBefore);
    expect(await fingerprintFiles(root, [sqlite], sqliteInputs)).not.toBe(sqliteBefore);
    expect(await fingerprintFiles(root, [pure], pureInputs)).toBe(pureBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
