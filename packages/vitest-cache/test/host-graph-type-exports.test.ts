/**
 * Resolve workspace runtime exports without executing their declaration graph.
 *
 * @summary Keep TypeScript-only export conditions outside runtime host imports.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { collectHostGraph } from '../src/host-graph.ts';

test('workspace type export conditions do not introduce unresolved declaration imports', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'vitest-cache-type-exports-'));
  try {
    const workspace = path.join(root, 'packages/typed');
    mkdirSync(workspace, { recursive: true });
    mkdirSync(path.join(root, 'node_modules'));
    symlinkSync(workspace, path.join(root, 'node_modules/typed'));
    writeFileSync(path.join(root, 'host.mjs'), "import 'typed';\n");
    writeFileSync(
      path.join(workspace, 'package.json'),
      JSON.stringify({
        name: 'typed',
        exports: {
          '.': { types: './index.d.mts', 'types@>=6': './versioned.d.ts', default: './index.mjs' }
        }
      })
    );
    writeFileSync(path.join(workspace, 'index.d.mts'), "import './context.js';\nexport declare const value: number;\n");
    writeFileSync(path.join(workspace, 'versioned.d.ts'), "import './versioned-context.js';\n");
    writeFileSync(path.join(workspace, 'index.mjs'), "export { value } from './implementation.mjs';\n");
    writeFileSync(path.join(workspace, 'implementation.mjs'), 'export const value = 42;\n');
    const graph = await collectHostGraph(root, ['host.mjs']);
    expect(graph.files).toEqual([
      'host.mjs',
      'packages/typed/implementation.mjs',
      'packages/typed/index.mjs',
      'packages/typed/package.json'
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
