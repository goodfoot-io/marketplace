/**
 * Verify the real read-site audit CLI recognizes equivalent Node import forms.
 *
 * @summary Compare bare and prefixed filesystem and subprocess bindings without executing fixture IO.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('read-sites reports bare and node-prefixed default, namespace and named aliases equally', {
  timeout: 15000
}, () => {
  const root = mkdtempSync(fileURLToPath(new URL('../.read-sites-', import.meta.url)));
  try {
    writeFileSync(
      path.join(root, 'vitest.config.mjs'),
      "export default { test: { include: ['probe.test.ts'], provide: { goodfootCacheInputs: { fallback: [] } } } };\n"
    );
    writeFileSync(path.join(root, 'tsconfig.json'), '{"compilerOptions":{"types":[]},"include":["probe.test.ts"]}');
    const expressions: string[] = [];
    const imports: string[] = [];
    for (const [binding, prefix] of [
      ['bare', ''],
      ['prefixed', 'node:']
    ]) {
      for (const [module, member] of [
        ['fs', 'readFileSync'],
        ['fs/promises', 'readFile'],
        ['child_process', 'spawnSync']
      ]) {
        const name = `${binding}${module.replace(/[^a-z]/g, '')}`;
        imports.push(
          `import ${name}Default from '${prefix}${module}';`,
          `import * as ${name}Namespace from '${prefix}${module}';`,
          `import { ${member} as ${name}Named } from '${prefix}${module}';`
        );
        expressions.push(
          `${name}Default.${member}('owned')`,
          `${name}Namespace.${member}('owned')`,
          `${name}Named('owned')`
        );
      }
    }
    writeFileSync(
      path.join(root, 'probe.test.ts'),
      `${imports.join('\n')}\nexport function neverExecuted() {\n${expressions.map((expression) => `  ${expression};`).join('\n')}\n}\n`
    );
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('../scripts/read-sites.ts', import.meta.url)),
        path.join(root, 'vitest.config.mjs'),
        '--all'
      ],
      { cwd: root, encoding: 'utf8', timeout: 10000 }
    );
    if (result.error) throw result.error;
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    const relative = path.relative(
      fileURLToPath(new URL('../../../', import.meta.url)),
      path.join(root, 'probe.test.ts')
    );
    expect(JSON.parse(result.stdout)).toEqual({
      config: path.join(root, 'vitest.config.mjs'),
      modules: [relative],
      sites: expressions.map((expression, index) => ({ file: relative, line: imports.length + index + 2, expression }))
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
