/**
 * Verify the real publication tarball in an independent Yarn consumer.
 *
 * @summary Gate releases on installed runtime, declarations and cache lifecycle behavior.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const fixture = mkdtempSync(path.join(tmpdir(), 'vitest-cache-package-'));
const consumer = path.join(fixture, 'consumer');
const temporary = path.join(fixture, 'tmp');
mkdirSync(consumer);
mkdirSync(temporary);
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_OPTIONS: '',
  TMPDIR: temporary,
  TMP: temporary,
  TEMP: temporary
};
delete environment.GOODFOOT_VITEST_FORCE;
delete environment.GOODFOOT_TEST_VERBOSE;
delete environment.DISABLE_TEST_CACHE;

/**
 * Execute a bounded real command and retain diagnostic evidence on failure.
 * @param command - Executable name.
 * @param args - Exact command arguments.
 * @param cwd - Explicit working directory.
 * @param expected - Required exit code.
 * @returns Captured stdout and stderr.
 * @throws On spawn failure, timeout or unexpected status.
 */
function run(command: string, args: string[], cwd = consumer, expected = 0) {
  const result = spawnSync(command, args, { cwd, env: environment, encoding: 'utf8', timeout: 180_000 });
  if (result.error) throw result.error;
  const output = result.stdout + result.stderr;
  assert.equal(result.status, expected, `${command} ${args.join(' ')}\n${output}`);
  return output;
}

/**
 * Write an owned consumer file without touching producer sources.
 * @param name - Consumer-relative filename.
 * @param content - Exact file contents.
 */
function write(name: string, content: string) {
  writeFileSync(path.join(consumer, name), content);
}

try {
  const archive = path.join(fixture, 'package.tgz');
  run('yarn', ['pack', '--out', archive], packageRoot);
  const members = run('tar', ['-tzf', archive]).trim().split('\n');
  assert(members.includes('package/dist/vitest-entry.mjs'));
  assert(members.includes('package/native/metadata.c'));
  assert(members.includes('package/native/node-api/LICENSE'));
  assert(members.includes('package/scripts/install-native.mjs'));
  assert(members.every((name) => !name.endsWith('.node')));
  assert(
    members.every((name) =>
      /^package\/(?:dist\/|native\/(?:(?:metadata\.c|timestamp\.h)$|node-api\/(?:node_api(?:_types)?\.h$|js_native_api(?:_types)?\.h$|LICENSE$))|scripts\/install-native\.mjs$|package\.json$|README\.md$|OUTPUT\.md$)/.test(
        name
      )
    ),
    members.join('\n')
  );
  assert(members.every((name) => !/\.ts$/.test(name) || name.endsWith('.d.ts')));
  run('git', ['init', '-q']);
  write(
    'package.json',
    JSON.stringify(
      {
        name: 'vitest-cache-publication-consumer',
        private: true,
        type: 'module',
        packageManager: 'yarn@4.12.0',
        devDependencies: {
          '@goodfoot/vitest-cache': `file:${archive}`,
          vitest: '5.0.4',
          vite: '8.3.4',
          '@typescript/typescript6': '6.0.2',
          '@types/node': '26.6.5'
        }
      },
      null,
      2
    )
  );
  write('yarn.lock', '');
  write('.yarnrc.yml', 'nodeLinker: node-modules\n');
  const installed = run('yarn', ['install']);
  assert(!/YN0002|YN0060|YN0086/.test(installed), installed);
  run('yarn', ['install', '--immutable']);
  run(process.execPath, [
    '--input-type=module',
    '-e',
    `
    import assert from 'node:assert/strict';
    for (const name of ['', '/plan', '/policy', '/native', '/verbose']) {
      const loaded = await import('@goodfoot/vitest-cache' + name);
      assert(Object.keys(loaded).length > 0);
    }
  `
  ]);
  run('yarn', ['exec', 'goodfoot-vitest', '--help']);
  write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        target: 'ES2023',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: ['node']
      },
      include: ['*.ts']
    })
  );
  write(
    'consumer.ts',
    `
import { defineConfig } from 'vitest/config';
import { ContentCacheReporter, validateContract } from '@goodfoot/vitest-cache';
import { setupNeeded } from '@goodfoot/vitest-cache/plan';
import { withTestOutput, loadCacheContract } from '@goodfoot/vitest-cache/policy';
import { frameExpectedNativeError } from '@goodfoot/vitest-cache/native';
import { testVerbose } from '@goodfoot/vitest-cache/verbose';
const contract = validateContract({ fallback: [] });
const config = defineConfig({ test: { include: ['*.test.ts'] } });
defineConfig(withTestOutput(config, contract));
defineConfig(withTestOutput(async () => config, contract));
new ContentCacheReporter();
void setupNeeded;
void loadCacheContract;
const error: TypeError = frameExpectedNativeError(new TypeError('owned'), undefined);
const verbose: boolean = testVerbose({ GOODFOOT_TEST_VERBOSE: '0' });
void error; void verbose;
`
  );
  run('yarn', ['exec', 'tsc6']);
  write('vitest.cache.json', JSON.stringify({ files: { 'cached.test.ts': ['input.txt'] } }));
  write(
    'vitest.config.ts',
    `
import { defineConfig } from 'vitest/config';
import { withTestOutput, loadCacheContract } from '@goodfoot/vitest-cache/policy';
export default withTestOutput(defineConfig({ test: { include: ['cached.test.ts'], maxWorkers: 1 } }),
  loadCacheContract(new URL('./vitest.cache.json', import.meta.url)));
`
  );
  write('input.txt', 'first');
  const passing = `import { test, expect } from 'vitest';
import { readFileSync, appendFileSync } from 'node:fs';
test('real declared input', () => {
  appendFileSync('executions.txt', 'executed\\n');
  expect(readFileSync('input.txt', 'utf8')).toMatch(/^(first|second)$/);
});`;
  write('cached.test.ts', passing);
  const cold = run('yarn', ['exec', 'vitest', 'run']);
  assert.match(cold, /0 file\(s\), 0 passing test\(s\) reused; 1 file\(s\) executed \(miss: new 1\)/);
  const warm = run('yarn', ['exec', 'vitest', 'run']);
  assert.match(warm, /1 file\(s\), 1 passing test\(s\) reused; 0 file\(s\) executed/);
  assert.equal(readFileSync(path.join(consumer, 'executions.txt'), 'utf8'), 'executed\n');
  write('input.txt', 'second');
  const invalidated = run('yarn', ['exec', 'vitest', 'run']);
  assert.match(invalidated, /1 file\(s\) executed \(miss: inputs 1\)/);
  assert.equal(readFileSync(path.join(consumer, 'executions.txt'), 'utf8'), 'executed\nexecuted\n');
  write('cached.test.ts', passing.replace('/^(first|second)$/', '/^deliberate-failure$/'));
  for (let attempt = 0; attempt < 2; attempt++) {
    const failed = run('yarn', ['exec', 'vitest', 'run'], consumer, 1);
    assert.match(failed, /1 failed/);
    assert.match(failed, /0 file\(s\), 0 passing test\(s\) reused; 1 file\(s\) executed/);
  }
  write('cached.test.ts', passing);
  run('yarn', ['exec', 'vitest', 'run']);
  assert.match(run('yarn', ['exec', 'vitest', 'run']), /1 passing test\(s\) reused; 0 file\(s\) executed/);
  const provider = path.join(consumer, 'node_modules/@goodfoot/vitest-cache/dist/test-verbose.mjs');
  const providerSource = readFileSync(provider, 'utf8');
  writeFileSync(provider, `${providerSource}\n// Owned installed-provider invalidation probe.\n`);
  assert.match(run('yarn', ['exec', 'vitest', 'run']), /1 file\(s\) executed \(miss: packages 1\)/);
  writeFileSync(provider, providerSource);
  assert.match(run('yarn', ['exec', 'vitest', 'run']), /1 passing test\(s\) reused; 0 file\(s\) executed/);
  for (const asset of ['build/Release/metadata.node', 'native/metadata.c']) {
    const filename = path.join(consumer, 'node_modules/@goodfoot/vitest-cache', asset);
    const contents = readFileSync(filename);
    writeFileSync(
      filename,
      Buffer.concat([contents, Buffer.from('\n/* Owned native-provider invalidation probe. */\n')])
    );
    assert.match(run('yarn', ['exec', 'vitest', 'run']), /1 file\(s\) executed \(miss: packages 1\)/);
    writeFileSync(filename, contents);
    assert.match(run('yarn', ['exec', 'vitest', 'run']), /1 passing test\(s\) reused; 0 file\(s\) executed/);
  }
  run('yarn', ['exec', 'goodfoot-vitest', 'run']);
  assert.match(run('yarn', ['exec', 'goodfoot-vitest', 'run']), /1 passing test\(s\) reused; 0 file\(s\) executed/);
  console.log(
    'Publication consumer passed: tarball contents, plain Node imports/bin, strict types, cold/warm reuse, input/provider invalidation, repeated failure and restored reuse.'
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
