/**
 * Verify workspace provider native assets participate in the real cache key.
 * @summary Mutate owned provider assets sequentially and restore them before cleanup.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repository = path.resolve(packageRoot, '../..');
const fixture = mkdtempSync(path.join(packageRoot, '.native-provider-fixture-'));
const assets = ['native/metadata.c', 'build/Release/metadata.node'];
const originals = assets.map((asset) => readFileSync(path.join(packageRoot, asset)));

/**
 * Execute the real isolated fixture with native public Vitest selectors.
 * @returns Captured successful runner output.
 * @throws On timeout, runner failure or spawn failure.
 */
function execute(): string {
  const run = spawnSync('yarn', ['exec', 'vitest', 'run', '--config', path.join(fixture, 'vitest.config.ts')], {
    cwd: packageRoot,
    encoding: 'utf8',
    timeout: 120_000
  });
  if (run.error) throw run.error;
  const output = run.stdout + run.stderr;
  assert.equal(run.status, 0, output);
  return output;
}

try {
  const testFile = path.join(fixture, 'cached.test.ts');
  const relative = path.relative(repository, testFile).split(path.sep).join('/');
  writeFileSync(
    testFile,
    "import { test, expect } from 'vitest'; test('native provider fixture', () => expect(1).toBe(1));\n"
  );
  writeFileSync(
    path.join(fixture, 'vitest.config.ts'),
    `
import { defineConfig } from 'vitest/config';
import { withTestOutput } from '../dist/test-output-policy.mjs';
export default withTestOutput(defineConfig({ test: { include: [${JSON.stringify(testFile)}], maxWorkers: 1 } }),
  { files: { ${JSON.stringify(relative)}: [] } });
`
  );
  assert.match(execute(), /1 file\(s\) executed \(miss: new 1\)/);
  assert.match(execute(), /1 passing test\(s\) reused; 0 file\(s\) executed/);
  for (const [index, asset] of assets.entries()) {
    const original = originals[index];
    if (!original) throw new Error('Missing native provider baseline');
    const filename = path.join(packageRoot, asset);
    writeFileSync(filename, Buffer.concat([original, Buffer.from('\n/* Workspace native provider mutation. */\n')]));
    assert.match(execute(), /1 file\(s\) executed \(miss: inputs 1\)/);
    writeFileSync(filename, original);
    assert.match(execute(), /1 passing test\(s\) reused; 0 file\(s\) executed/);
  }
  console.log('Workspace native source and binary each invalidate inputs; restoration reuses passing results.');
} finally {
  for (const [index, asset] of assets.entries()) {
    const original = originals[index];
    if (original) writeFileSync(path.join(packageRoot, asset), original);
  }
  rmSync(fixture, { recursive: true, force: true });
}
