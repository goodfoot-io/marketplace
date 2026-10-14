/**
 * Exercise installed cache implementation inputs shared by linked Git worktrees.
 * @summary Verify reusable results and installed-provider invalidation outside the active worktree.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { integrationTestTimeout, runScript } from './child-process.ts';

test('shared installed implementation publishes, reuses across worktrees, and hashes provider bytes', {
  timeout: integrationTestTimeout
}, async () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'vitest-cache-shared-install-'));
  const repository = path.join(temporary, 'repository');
  const worktree = path.join(temporary, 'worktree');
  const modules = path.join(temporary, 'shared', 'node_modules');
  const installed = path.join(modules, '@goodfoot', 'vitest-cache');
  const packageRoot = fileURLToPath(new URL('../', import.meta.url));
  const consumer = new URL('../node_modules/vitest/dist/node.js', import.meta.url).href;
  const vite = new URL('../node_modules/vite/dist/node/index.js', import.meta.url).href;
  try {
    mkdirSync(repository);
    mkdirSync(installed, { recursive: true });
    // The suite's build prerequisite supplies exactly the published JavaScript runtime.
    for (const directory of ['dist', 'native', 'scripts', 'build']) {
      cpSync(path.join(packageRoot, directory), path.join(installed, directory), { recursive: true });
    }
    cpSync(path.join(packageRoot, 'package.json'), path.join(installed, 'package.json'));
    // Thin adapters retain real Vitest/Vite APIs without installing a second dependency tree.
    for (const [name, target, subpath] of [
      ['vitest', consumer, './node'],
      ['vite', vite, '.']
    ]) {
      const directory = path.join(modules, name);
      mkdirSync(directory);
      writeFileSync(
        path.join(directory, 'package.json'),
        JSON.stringify({
          name,
          version: '1.0.0',
          type: 'module',
          exports: { [subpath]: './index.mjs' }
        })
      );
      writeFileSync(path.join(directory, 'index.mjs'), `export * from ${JSON.stringify(target)};\n`);
    }
    const packages = ['@goodfoot/vitest-cache', 'vitest', 'vite'];
    writeFileSync(
      path.join(modules, '.yarn-state.yml'),
      packages
        .map(
          (name) =>
            `${JSON.stringify(`${name}@npm:1.0.0`)}:\n  locations:\n    - ${JSON.stringify(`node_modules/${name}`)}\n`
        )
        .join('')
    );
    writeFileSync(
      path.join(repository, 'yarn.lock'),
      packages
        .map(
          (name) => `${JSON.stringify(`${name}@npm:1.0.0`)}:\n  resolution: ${JSON.stringify(`${name}@npm:1.0.0`)}\n`
        )
        .join('\n')
    );
    writeFileSync(path.join(repository, 'package.json'), '{"name":"shared-runtime-fixture","type":"module"}\n');
    writeFileSync(path.join(repository, 'vitest.config.mjs'), 'export default {};\n');
    writeFileSync(path.join(repository, 'example.test.mjs'), 'export {};\n');
    const git = (args: string[]) => execFileSync('git', args, { cwd: repository, timeout: 5000 });
    git(['init', '--quiet']);
    git(['add', '.']);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture']);
    git(['worktree', 'add', '--quiet', '--detach', worktree]);
    for (const root of [repository, worktree]) symlinkSync(modules, path.join(root, 'node_modules'), 'dir');
    const controller = pathToFileURL(path.join(installed, 'dist/index.js')).href;
    const output = await runScript(`
      import assert from 'node:assert/strict';
      import fs from 'node:fs/promises';
      import path from 'node:path';
      import { createVitest } from ${JSON.stringify(consumer)};
      import { ContentCacheReporter, ContentCacheSequencer } from ${JSON.stringify(controller)};
      for (const name of Object.keys(process.env)) {
        if (/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|TS_NODE_.+|TSX_.+|GOODFOOT_VITEST_.+|GOODFOOT_TEST_VERBOSE|DISABLE_TEST_CACHE)$/.test(name)) delete process.env[name];
      }
      // The real runner supplies transformation/selection; only passing outcome metadata is modeled.
      async function run(root, expectedPending) {
        smokeCheckpoint('create '+root);
        const ctx = await createVitest('test', {root, config:path.join(root,'vitest.config.mjs'),watch:false}, {logLevel:'silent'});
        const reporter = new ContentCacheReporter();
        ctx.config.reporters = [reporter];
        reporter.onInit(ctx);
        ctx.projects[0].config.provide.goodfootCacheInputs = {fallback:[]};
        const specifications = await ctx.globTestSpecifications();
        assert.equal(specifications.length, 1);
        try {
          await reporter.onTestRunStart(specifications);
          const pending = await new ContentCacheSequencer(ctx).sort(specifications);
          assert.equal(pending.length, expectedPending, 'unchanged installed runtime must reuse its passing result');
          await reporter.onTestRunEnd(pending.map(specification => ({
            project:specification.project,moduleId:specification.moduleId,ok:()=>true,
            children:{allTests:()=>[{}]}
          })), [], 'passed');
        } finally { await ctx.close(); }
      }
      await run(${JSON.stringify(repository)},1);
      await run(${JSON.stringify(worktree)},0);
      for (const asset of ['dist/test-verbose.mjs','native/metadata.c','build/Release/metadata.node']) {
        const filename = path.join(${JSON.stringify(installed)},asset);
        const contents = await fs.readFile(filename);
        await fs.writeFile(filename,Buffer.concat([contents,Buffer.from('\\n/* installed-byte probe */\\n')]));
        try { await run(${JSON.stringify(worktree)},1); }
        finally { await fs.writeFile(filename,contents); }
        await run(${JSON.stringify(worktree)},0);
      }
      console.log('shared installed results reused and provider bytes invalidated');
    `);
    expect(output).toContain('shared installed results reused and provider bytes invalidated');
    expect(output).toContain('miss: packages 1');
    expect(output).not.toContain('uncacheable');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
