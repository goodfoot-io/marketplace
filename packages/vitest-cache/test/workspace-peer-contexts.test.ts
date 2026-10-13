/**
 * Keep source workspaces distinct from installed packages with ambiguous peers.
 *
 * @summary Verify workspace peer aliases cannot disable unrelated package fingerprints.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
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

test.each(['manifest', 'lock', 'state', 'retarget', 'replacement', 'ambiguity'])(
  'fresh phases observe %s mutations after metadata reuse',
  async (mutation) => {
    const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-metadata-'));
    try {
      for (const name of ['first', 'second']) {
        mkdirSync(path.join(root, name), { recursive: true });
        writeFileSync(path.join(root, name, 'package.json'), '{"name":"fixture"}');
        writeFileSync(path.join(root, name, 'index.js'), `export const value = '${name}';`);
      }
      mkdirSync(path.join(root, 'node_modules'));
      const installed = path.join(root, 'node_modules/fixture');
      symlinkSync(path.join(root, 'first'), installed);
      const state =
        '"fixture@npm:1.0.0":\n  locations:\n    - "node_modules/fixture"\n  aliases:\n    - "ignored@npm:1.0.0"\n';
      const lock = '"fixture@npm:1.0.0":\n  resolution: "fixture@npm:1.0.0"\n';
      writeFileSync(path.join(root, 'node_modules/.yarn-state.yml'), state);
      writeFileSync(path.join(root, 'yarn.lock'), lock);
      const closure = () => createPackagePhase(root, new DigestStore(null)).closure([], ['fixture'], root);
      const before = await closure();
      expect(await closure()).toBe(before);
      if (mutation === 'manifest') {
        writeFileSync(path.join(installed, 'package.json'), '{"dependencies":{"missing":"*"}}');
      } else if (mutation === 'lock') {
        writeFileSync(path.join(root, 'yarn.lock'), `${lock}  dependencies:\n    missing: "*"\n`);
      } else if (mutation === 'state') {
        writeFileSync(
          path.join(root, 'node_modules/.yarn-state.yml'),
          state.replace('fixture@npm:1.0.0', 'fixture@npm:2.0.0')
        );
      } else if (mutation === 'ambiguity') {
        symlinkSync(path.join(root, 'first'), path.join(root, 'node_modules/alias'));
        writeFileSync(
          path.join(root, 'node_modules/.yarn-state.yml'),
          `${state}"alias@npm:1.0.0":\n  locations:\n    - "node_modules/alias"\n`
        );
      } else {
        unlinkSync(installed);
        if (mutation === 'retarget') symlinkSync(path.join(root, 'second'), installed);
        else {
          mkdirSync(installed);
          writeFileSync(path.join(installed, 'package.json'), '{"name":"fixture"}');
          writeFileSync(path.join(installed, 'index.js'), 'export const replaced = true;');
        }
      }
      if (mutation === 'retarget' || mutation === 'replacement') expect(await closure()).not.toBe(before);
      else
        await expect(closure()).rejects.toThrow(
          mutation === 'state'
            ? 'missing exact Yarn lock entry'
            : mutation === 'ambiguity'
              ? 'ambiguous shared Yarn package location'
              : 'unresolved required dependency missing'
        );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
);
