/**
 * Verify input graph leaf requests cache behavior with isolated temporary fixtures.
 *
 * @summary Verify input graph leaf requests cache behavior with isolated temporary fixtures.
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { createViteServer } from 'vitest/node';
import { fingerprintFiles } from '../src/fingerprint.ts';
import { collectInputGraph } from '../src/input-graph.ts';

const cleanups: (() => unknown)[] = [];

afterEach(async () => {
  for (let cleanup = cleanups.pop(); cleanup; cleanup = cleanups.pop()) await cleanup();
});

/**
 * A repository at `root` whose Vite project is `root/app`, so an import of a repository file outside `app` reaches the walk as a `/@fs/` URL.
 *
 * @param files - Relative fixture path/source map.
 * @returns Temporary repository root and graph reader; server/root disposal is registered with afterEach.
 */
async function fixture(files: Record<string, string>) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'vitest-cache-leaf-')));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  for (const [relative, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), content);
  }
  const server = await createViteServer({
    root: path.join(root, 'app'),
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, watch: null, hmr: false }
  });
  cleanups.push(() => server.close());
  const graph = (entry: string) =>
    collectInputGraph({ moduleId: path.join(root, entry), project: { vite: server } }, root);
  return { root, graph };
}

test('a ?raw TOML import outside the Vite root is a content-hashed input, and editing it changes the key', async () => {
  const { root, graph } = await fixture({
    'app/entry.test.ts': "import config from '../config/wrangler.toml?raw';\nexport const value = config.length;\n",
    // Not valid JavaScript, so walking it as a module instead of a leaf fails.
    'config/wrangler.toml': 'account-id = "first"\n'
  });

  const { files } = await graph('app/entry.test.ts');
  expect(files).toEqual(['app/entry.test.ts', 'config/wrangler.toml']);

  const before = fingerprintFiles(root, files);
  writeFileSync(path.join(root, 'config/wrangler.toml'), 'account-id = "second"\n');
  expect(fingerprintFiles(root, files)).not.toBe(before);
});

test('a module first reached as a ?raw leaf still has its module imports walked', async () => {
  const { graph } = await fixture({
    // The walk pops dependencies in reverse order, so `helper.ts?raw` is
    // reached before `consumer.ts` imports `helper.ts` as a module.
    'app/entry.test.ts':
      "import './consumer.ts';\nimport source from './helper.ts?raw';\nexport const value = source.length;\n",
    'app/consumer.ts': "import { helper } from './helper.ts';\nexport const consumed = helper;\n",
    'app/helper.ts': "import { deep } from './deep.ts';\nexport const helper = deep;\n",
    'app/deep.ts': 'export const deep = 1;\n'
  });

  const { files } = await graph('app/entry.test.ts');
  expect(files).toEqual(['app/consumer.ts', 'app/deep.ts', 'app/entry.test.ts', 'app/helper.ts']);
});

test('bare, subpath and prefixed Node builtins are runtime inputs rather than unresolved files', async () => {
  const { graph } = await fixture({
    'app/entry.test.ts':
      "import path from 'path';\nimport * as fs from 'fs/promises';\nimport * as http from 'node:http';\nexport const value = [path.sep, fs.readFile, http.createServer];\n"
  });

  const result = await graph('app/entry.test.ts');
  expect(result.files).toEqual(['app/entry.test.ts']);
  expect(result.externalPaths).toEqual([]);
});

test('a non-asset, non-data import Vite cannot transform makes the graph, and so reuse, fail', async () => {
  const { graph } = await fixture({
    'app/entry.test.ts': "import config from '../config/wrangler.toml';\nexport const value = config;\n",
    // `account-id = ...` is not valid JavaScript, so the walk cannot read this
    // module's imports once Vite hands back the TOML text unchanged.
    'config/wrangler.toml': 'account-id = "first"\n'
  });

  await expect(graph('app/entry.test.ts')).rejects.toThrow(/config\/wrangler\.toml/);
});
