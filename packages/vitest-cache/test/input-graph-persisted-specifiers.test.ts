/**
 * Verify persisted import specifiers: reused across processes only for unchanged, settled modules under the same transform environment.
 *
 * @summary Verify cross-process specifier records are reused only when provably current.
 */
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { createViteServer } from 'vitest/node';
import { collectInputGraph } from '../src/input-graph.ts';

const cleanups: (() => unknown)[] = [];
const racyWindowMs = 2_000;

afterEach(async () => {
  for (let cleanup = cleanups.pop(); cleanup; cleanup = cleanups.pop()) await cleanup();
});

/**
 * A repository whose files have settled past the racy window, with a fresh Vite server per call so no in-memory edge cache is shared.
 *
 * @param files - Relative fixture path/source map.
 * @returns Temporary root, specifier folder and a graph reader that counts transforms.
 */
async function fixture(files: Record<string, string>) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'vitest-cache-persist-')));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  const write = (source: Record<string, string>) => {
    for (const [relative, content] of Object.entries(source)) {
      mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      writeFileSync(path.join(root, relative), content);
    }
  };
  write(files);
  const folder = path.join(root, '.edges');
  const graph = async (entry: string, environmentKey = 'environment-a') => {
    const server = await createViteServer({
      root: path.join(root, 'app'),
      configFile: false,
      logLevel: 'silent',
      appType: 'custom',
      server: { middlewareMode: true, watch: null, hmr: false }
    });
    cleanups.push(() => server.close());
    const environment = server.environments.ssr;
    const transform = environment.transformRequest.bind(environment);
    let transforms = 0;
    environment.transformRequest = (async (...args: Parameters<typeof transform>) => {
      transforms++;
      return transform(...args);
    }) as typeof environment.transformRequest;
    const result = await collectInputGraph({ moduleId: path.join(root, entry), project: { vite: server } }, root, {
      persist: { folder, environmentKey }
    });
    return { result, transforms: () => transforms };
  };
  return { root, folder, write, graph };
}

/**
 * Wait out the racy window: ctime cannot be backdated, so freshly written files need real elapsed time.
 *
 * @returns Promise resolved once recent writes are old enough to trust.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, racyWindowMs + 200));

const files = {
  'app/entry.test.ts': "import { a } from './a.ts';\nexport const value = a;\n",
  'app/a.ts': "import { b } from './b.ts';\nexport const a = b;\n",
  'app/b.ts': 'export const b = 1;\n'
};

test('a settled module reuses its persisted specifiers in a new process and yields the same graph', async () => {
  const { graph } = await fixture(files);
  await settle();
  const cold = await graph('app/entry.test.ts');
  expect(cold.transforms()).toBe(3);
  const warm = await graph('app/entry.test.ts');
  expect(warm.transforms()).toBe(0);
  expect(warm.result).toEqual(cold.result);
  expect(warm.result.files).toEqual(['app/a.ts', 'app/b.ts', 'app/entry.test.ts']);
});

test('editing a module invalidates its record so newly imported files join the graph', async () => {
  const { graph, write } = await fixture({ ...files, 'app/c.ts': 'export const c = 2;\n' });
  await settle();
  await graph('app/entry.test.ts');
  write({ 'app/b.ts': "import { c } from './c.ts';\nexport const b = c;\n" });
  const after = await graph('app/entry.test.ts');
  expect(after.result.files).toEqual(['app/a.ts', 'app/b.ts', 'app/c.ts', 'app/entry.test.ts']);
  expect(after.transforms()).toBeGreaterThan(0);
});

test('records written under a different transform environment are not reused', async () => {
  const { graph } = await fixture(files);
  await settle();
  await graph('app/entry.test.ts', 'environment-a');
  const other = await graph('app/entry.test.ts', 'environment-b');
  expect(other.transforms()).toBe(3);
});

test('modules changed within the racy window are transformed again rather than trusted', async () => {
  const { graph } = await fixture(files);
  await graph('app/entry.test.ts');
  const again = await graph('app/entry.test.ts');
  expect(again.transforms()).toBe(3);
});

test('a corrupt or foreign-schema record is ignored', async () => {
  const { graph, folder } = await fixture(files);
  await settle();
  await graph('app/entry.test.ts');
  for (const [index, name] of readdirSync(folder).entries()) {
    writeFileSync(path.join(folder, name), index === 0 ? '{not json' : JSON.stringify({ schema: 2, specifiers: [] }));
  }
  const recovered = await graph('app/entry.test.ts');
  expect(recovered.transforms()).toBe(3);
  expect(recovered.result.files).toEqual(['app/a.ts', 'app/b.ts', 'app/entry.test.ts']);
});
