/**
 * Verify runner tools resolve from their consuming workspace's installation.
 *
 * @summary Verify nested Yarn toolchain resolution and content invalidation.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';
import { createPackagePhase } from '../src/package-closure.ts';

test('nested workspace tools resolve independently and only their consumers invalidate', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-toolchain-'));
  try {
    const first = path.join(root, 'packages/first');
    const second = path.join(root, 'packages/second');
    const locations = ['packages/first/node_modules/vite', 'packages/second/node_modules/vite'];
    for (const [index, relative] of locations.entries()) {
      const directory = path.join(root, relative);
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        path.join(directory, 'package.json'),
        JSON.stringify({ name: 'vite', version: `${index + 1}.0.0` })
      );
      writeFileSync(path.join(directory, 'index.js'), `export const version = ${index + 1};\n`);
    }
    mkdirSync(path.join(root, 'node_modules'));
    writeFileSync(
      path.join(root, 'node_modules/.yarn-state.yml'),
      locations.map((relative, index) => `"vite@npm:${index + 1}.0.0":\n  locations:\n    - "${relative}"\n`).join('\n')
    );
    writeFileSync(
      path.join(root, 'yarn.lock'),
      locations
        .map(
          (_, index) =>
            `"vite@npm:${index + 1}.0.0":\n  version: ${index + 1}.0.0\n  resolution: "vite@npm:${index + 1}.0.0"\n`
        )
        .join('\n')
    );
    const phase = () => createPackagePhase(root, new DigestStore(path.join(root, 'digests')));
    const initial = phase();
    const firstKey = await initial.closure([], ['vite'], first);
    const secondKey = await initial.closure([], ['vite'], second);
    expect(firstKey).not.toBe(secondKey);
    await expect(initial.closure([], ['vite'], root)).rejects.toThrow('missing test toolchain package: vite');

    writeFileSync(path.join(first, 'node_modules/vite/index.js'), 'export const version = 3;\n');
    const changed = phase();
    expect(await changed.closure([], ['vite'], first)).not.toBe(firstKey);
    expect(await changed.closure([], ['vite'], second)).toBe(secondKey);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
