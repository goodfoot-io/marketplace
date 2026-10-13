/**
 * Keep source workspaces distinct from installed packages with ambiguous peers.
 *
 * @summary Verify workspace peer aliases cannot disable unrelated package fingerprints.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { DigestStore } from '../src/digest-store.ts';
import { createPackagePhase } from '../src/package-closure.ts';

test.each(['workspace', 'installed'])('physical %s aliases retain safe package resolution', async (kind) => {
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-peer-contexts-'));
  try {
    const physical = kind === 'workspace' ? 'packages/cache' : 'node_modules/physical-cache';
    for (const directory of [physical, 'node_modules/vite', 'node_modules/first', 'node_modules/second']) {
      mkdirSync(path.join(root, directory), { recursive: true });
    }
    writeFileSync(path.join(root, physical, 'package.json'), '{"name":"cache","version":"1.0.0"}');
    writeFileSync(path.join(root, physical, 'index.js'), 'export const cache = true;');
    writeFileSync(path.join(root, 'node_modules/vite/package.json'), '{"name":"vite","version":"8.3.4"}');
    writeFileSync(path.join(root, 'node_modules/vite/index.js'), 'export const version = "8.3.4";');
    const protocol = kind === 'workspace' ? 'workspace:packages/cache' : 'npm:1.0.0';
    const state = ['"vite@npm:8.3.4":\n  locations:\n    - "node_modules/vite"'];
    for (const context of ['first', 'second']) {
      symlinkSync(path.join(root, physical), path.join(root, 'node_modules', context, 'cache'));
      state.push(`"cache@virtual:${context}#${protocol}":\n  locations:\n    - "node_modules/${context}/cache"`);
    }
    writeFileSync(path.join(root, 'node_modules/.yarn-state.yml'), state.join('\n'));
    writeFileSync(
      path.join(root, 'yarn.lock'),
      '"vite@npm:8.3.4":\n  version: 8.3.4\n  resolution: "vite@npm:8.3.4"\n'
    );
    const phase = createPackagePhase(root, new DigestStore(null));
    const closure = phase.closure([], ['vite'], root);
    if (kind === 'workspace') await expect(closure).resolves.toMatch(/^[a-f0-9]{64}$/);
    else await expect(closure).rejects.toThrow('ambiguous shared Yarn package location');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
