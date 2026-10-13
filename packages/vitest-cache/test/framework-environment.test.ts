/**
 * Verify real Vitest worker environment changes invalidate passing result records.
 *
 * @summary Verify Vite-resolved environment cache invalidation without direct env-file reads.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('changing Vite-resolved worker env executes the file after a warm hit', { timeout: 90000 }, () => {
  const root = mkdtempSync(fileURLToPath(new URL('../.framework-env-', import.meta.url)));
  try {
    const results = path.join(root, 'results');
    mkdirSync(results);
    symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), path.join(root, 'node_modules'), 'dir');
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'framework-env-fixture', type: 'module' }));
    writeFileSync(
      path.join(root, 'vitest.config.ts'),
      `import { defineConfig } from 'vitest/config';
import { withTestOutput } from '@goodfoot/vitest-cache/policy';
export default withTestOutput(defineConfig({ test: { include: ['probe.test.ts'], maxWorkers: 1 } }), { fallback: [] });\n`
    );
    writeFileSync(
      path.join(root, 'probe.test.ts'),
      `import { appendFileSync } from 'node:fs';
import { expect, test } from 'vitest';
test('observes resolved worker env', () => {
  expect(['initial', 'changed']).toContain(import.meta.env.VITE_CACHE_ENV_PROBE);
  appendFileSync(process.env.CACHE_ENV_EXECUTIONS, 'executed\\n');
});\n`
    );
    const marker = path.join(root, 'executions.txt');
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      TMPDIR: results,
      CACHE_ENV_EXECUTIONS: marker,
      GOODFOOT_TEST_VERBOSE: '0',
      GOODFOOT_VITEST_FORCE: '',
      DISABLE_TEST_CACHE: 'false'
    };
    delete environment.VITE_CACHE_ENV_PROBE;
    const run = () => {
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
          'run',
          '--root',
          root,
          '--config',
          path.join(root, 'vitest.config.ts')
        ],
        { encoding: 'utf8', env: environment, timeout: 25000 }
      );
      if (result.error) throw result.error;
      expect(result.status, result.stdout + result.stderr).toBe(0);
      return result.stdout + result.stderr;
    };
    const count = () => readFileSync(marker, 'utf8').trim().split('\n').length;
    // Only synthetic owned fixture values are written; Vite reads them normally.
    writeFileSync(path.join(root, '.env.test'), 'VITE_CACHE_ENV_PROBE=initial\n');
    run();
    expect(count()).toBe(1);
    expect(run()).toContain('1 passing test(s) reused');
    expect(count()).toBe(1);
    writeFileSync(path.join(root, '.env.test'), 'VITE_CACHE_ENV_PROBE=changed\n');
    expect(run()).toContain('1 file(s) executed');
    expect(count()).toBe(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
