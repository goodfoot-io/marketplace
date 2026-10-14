/**
 * Check fail-closed native installation and fresh-install loading in isolated processes.
 * @summary Ambient process/toolchain probes deliberately remain uncached.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('unsupported platforms and missing compilers fail without leaving partial native artifacts', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'native-install-'));
  try {
    const scripts = path.join(root, 'scripts');
    fs.mkdirSync(scripts);
    const installer = path.join(scripts, 'install-native.mjs');
    fs.copyFileSync(fileURLToPath(new URL('../scripts/install-native.mjs', import.meta.url)), installer);
    const unsupported = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `Object.defineProperty(process, 'platform', { value: 'win32' }); await import(${JSON.stringify(installer)});`
      ],
      { encoding: 'utf8', timeout: 5000 }
    );
    expect(unsupported.error).toBeUndefined();
    expect(unsupported.status).not.toBe(0);
    expect(unsupported.stderr).toContain('requires Linux or macOS');
    expect(fs.existsSync(path.join(root, 'build'))).toBe(false);
    const failed = spawnSync(process.execPath, [installer], {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, CC: path.join(root, 'missing-compiler') }
    });
    expect(failed.error).toBeUndefined();
    expect(failed.status).not.toBe(0);
    expect(failed.stderr).toContain('ENOENT');
    expect(fs.readdirSync(path.join(root, 'build', 'Release'))).toEqual([]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fresh installations with scripts disabled reject cache loading with an actionable error', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'native-disabled-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    const dist = path.join(root, 'dist');
    fs.mkdirSync(dist);
    for (const name of ['native-metadata.js', 'filesystem-batch.js']) {
      fs.copyFileSync(fileURLToPath(new URL(`../dist/${name}`, import.meta.url)), path.join(dist, name));
    }
    const missing = spawnSync(process.execPath, [path.join(dist, 'native-metadata.js')], {
      encoding: 'utf8',
      timeout: 5000
    });
    expect(missing.error).toBeUndefined();
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain('enable install scripts and install with a C11 compiler');
    expect(fs.existsSync(path.join(root, 'build'))).toBe(false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
