/**
 * Verify eligibility audit output preserves the distinction between omitted and empty fallback inputs.
 *
 * @summary Verify fallback eligibility in real configuration inventories.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { inventory } from '../scripts/audit-lib.ts';

test('inventory distinguishes unreviewed files from an explicit empty fallback', async () => {
  const root = mkdtempSync(fileURLToPath(new URL('../.audit-inventory-', import.meta.url)));
  try {
    writeFileSync(path.join(root, 'example.test.ts'), "import { test } from 'vitest';\ntest('example', () => {});\n");
    for (const [name, contract, expected] of [
      ['omitted', {}, null],
      ['empty', { fallback: [] }, []]
    ] as const) {
      const config = path.join(root, `${name}.mjs`);
      writeFileSync(
        config,
        `export default { test: { include: ['example.test.ts'], provide: { goodfootCacheInputs: ${JSON.stringify(contract)} } } };\n`
      );
      const result = await inventory(config);
      expect(result.fallback).toEqual(expected);
      expect(result.tests).toHaveLength(1);
      expect(result.unlisted).toEqual(result.tests);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
