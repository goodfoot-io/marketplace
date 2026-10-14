/**
 * Compile and execute the timestamp boundary harness with the ambient C toolchain.
 * @summary This toolchain-dependent test intentionally executes without cached results.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('checked native timestamps accept signed64 boundaries and reject modulo aliases', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'native-timestamp-'));
  try {
    const executable = path.join(root, 'timestamp');
    const compiled = spawnSync(
      process.env.CC || 'cc',
      [
        '-std=c11',
        '-Wall',
        '-Wextra',
        '-Werror',
        fileURLToPath(new URL('./native-timestamp.c', import.meta.url)),
        '-o',
        executable
      ],
      { encoding: 'utf8', timeout: 10_000 }
    );
    expect(compiled.error).toBeUndefined();
    expect(compiled.status, compiled.stderr).toBe(0);
    const checked = spawnSync(executable, [], { encoding: 'utf8', timeout: 5_000 });
    expect(checked.error).toBeUndefined();
    expect(checked.status, checked.stderr).toBe(0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
