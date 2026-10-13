/**
 * Build the complete published ESM package, including checked JavaScript helpers.
 *
 * @summary Emit JavaScript and declarations without requiring consumer TypeScript loaders.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from '@typescript/typescript6';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../dist/', import.meta.url);
rmSync(output, { recursive: true, force: true });
const compiled = spawnSync('yarn', ['exec', 'tsc', '-p', 'tsconfig.build.json'], {
  cwd: root,
  stdio: 'inherit',
  timeout: 120_000
});
if (compiled.error) throw compiled.error;
if (compiled.status !== 0) throw new Error(`Package compilation failed (${compiled.status})`);
for (const name of readdirSync(new URL('../src/', import.meta.url))) {
  if (name.endsWith('.d.mts') || name.endsWith('.d.ts')) {
    copyFileSync(new URL(`../src/${name}`, import.meta.url), new URL(name, output));
  }
}

// TypeScript rewrites runtime imports, but leaves declaration specifiers unchanged.
// Rewrite only module-specifier AST nodes, preserving documentation and other strings.
for (const name of readdirSync(output)) {
  if (!name.endsWith('.d.ts') && !name.endsWith('.d.mts')) continue;
  const file = new URL(name, output);
  const source = ts.createSourceFile(name, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const result = ts.transform(source, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (
          ts.isStringLiteral(node) &&
          (ts.isImportDeclaration(node.parent) ||
            ts.isExportDeclaration(node.parent) ||
            (ts.isLiteralTypeNode(node.parent) && ts.isImportTypeNode(node.parent.parent))) &&
          node.text.startsWith('.') &&
          /\.(?:ts|mts)$/.test(node.text)
        ) {
          return ts.factory.createStringLiteral(node.text.replace(/\.mts$/, '.mjs').replace(/\.ts$/, '.js'));
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit, ts.isSourceFile) ?? node;
    }
  ]);
  const transformed = result.transformed[0];
  if (!transformed) throw new Error(`Missing declaration transform: ${name}`);
  const augmentation = name === 'index.d.ts' ? "import './provided-context.js';\n" : '';
  writeFileSync(file, augmentation + ts.createPrinter().printFile(transformed));
  result.dispose();
}
chmodSync(new URL('vitest-entry.mjs', output), 0o755);
