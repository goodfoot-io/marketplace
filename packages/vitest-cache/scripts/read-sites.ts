/**
 * List selected named/namespace Node API and ts.sys syntactic read sites,
 * truncating displayed expressions to 260 characters. This heuristic is not
 * an exhaustive dynamic IO audit or proof of a safe cache declaration.
 *
 * @summary List syntactic Node filesystem and TypeScript system read sites.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from '@typescript/typescript6';
import { auditImports, inventory } from './audit-lib.ts';

const config = process.argv[2];
if (!config) throw new Error('usage: node scripts/read-sites.ts <vitest-config>');
const result = await inventory(path.resolve(config));
const audited = auditImports(
  result.root,
  result.project,
  process.argv.includes('--all') ? result.tests : result.unlisted
);
const modules = new Set(audited.flatMap((row) => row.io.flatMap((entry) => entry.split(': ', 1))));
const sites: { file: string; line: number; expression: string }[] = [];
const ioName = /^(?:read|readdir|stat|lstat|access|exists|glob|open|copy|createRead|realpath|exec|spawn)/i;

for (const file of [...modules].sort()) {
  const absolute = path.join(result.root, file);
  const source = fs.readFileSync(absolute, 'utf8');
  const tree = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true);
  const bindings = new Set<string>();
  const namespaces = new Set<string>();
  for (const statement of tree.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !/^node:(?:fs(?:\/promises)?|child_process)$/.test(statement.moduleSpecifier.text)
    )
      continue;
    const clause = statement.importClause;
    if (clause?.name) namespaces.add(clause.name.text);
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings))
      namespaces.add(clause.namedBindings.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (ioName.test((element.propertyName ?? element.name).text)) bindings.add(element.name.text);
      }
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const named = ts.isIdentifier(callee) && bindings.has(callee.text);
      const member =
        ts.isPropertyAccessExpression(callee) &&
        ioName.test(callee.name.text) &&
        callee.expression
          .getText(tree)
          .split('.', 1)
          .some((namespace) => namespaces.has(namespace));
      const typeScriptSystem =
        /^ts\.(?:createProgram|readConfigFile|findConfigFile|parseJsonConfigFileContent|sys\.(?:readFile|readDirectory|fileExists|directoryExists))$/.test(
          callee.getText(tree)
        );
      if (named || member || typeScriptSystem) {
        const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
        sites.push({ file, line, expression: node.getText(tree).replace(/\s+/g, ' ').slice(0, 260) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
}
console.log(JSON.stringify({ config: result.config, modules: [...modules].sort(), sites }, null, 2));
