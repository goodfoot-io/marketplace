import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('exported Vitest setup preserves a failing process exit without diagnostics', () => {
  const setupModule = fileURLToPath(new URL('../src/vitest-global-setup.ts', import.meta.url));
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', 'await import(process.argv[1]); process.exitCode = 1;', setupModule],
    { encoding: 'utf8', timeout: 2000, maxBuffer: 65536 }
  );

  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.status).toBe(1);
  expect(child.stdout).toBe('');
  expect(child.stderr).toBe('');
});
