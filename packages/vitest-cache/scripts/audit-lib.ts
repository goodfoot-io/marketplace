/**
 * Inventory selected tests and heuristically inspect possible undeclared import IO.
 *
 * @summary Inventory selected tests and heuristically inspect possible undeclared import IO.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from '@typescript/typescript6';
import type { CacheContract, UncachedContract } from '../src/contract.ts';

/** The parts of a Vitest configuration the inventory reads. */
type InventoryConfig = {
  test?: {
    projects?: InventoryConfig[];
    include?: string[];
    exclude?: string[];
    provide?: { goodfootCacheInputs?: CacheContract | UncachedContract };
  };
};

type ImportRecord = { file: string; ownIo: string[]; unresolved: string[]; dependencies: string[] };

const ioModules = /^(?:node:)?(?:fs(?:\/promises)?|child_process|sqlite)$/;
const ioNames =
  /\b(?:Bun\.file|Deno\.(?:read|open|stat)|import\.meta\.glob|process\.binding|ts\.(?:createProgram|readConfigFile|findConfigFile|parseJsonConfigFileContent))\b/;

function sourceFile(file: string) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

function imports(tree: ts.SourceFile) {
  const names: string[] = [];
  let unresolvedDynamic = false;
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) names.push(node.moduleSpecifier.text);
      else unresolvedDynamic = true;
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0];
      if (node.arguments.length === 1 && argument !== undefined && ts.isStringLiteral(argument))
        names.push(argument.text);
      else unresolvedDynamic = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return { names, unresolvedDynamic };
}

function compilerOptions(project: string): ts.CompilerOptions {
  const configFile = ts.findConfigFile(project, ts.sys.fileExists, 'tsconfig.json');
  if (!configFile) return {};
  const read = ts.readConfigFile(configFile, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configFile));
  if (parsed.errors.length)
    throw new Error(parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
  return parsed.options;
}

/**
 * Import/execute a concrete object-form Vitest config and inventory selected test globs; function, array and uncached configurations are unsupported.
 *
 * @param configPath - Concrete config file path.
 * @returns Repository/project/config identity, selected tests and unlisted/stale/unmatched declarations.
 * @throws For invalid config contract, import/glob/stat/Git failure.
 */
export async function inventory(configPath: string) {
  const absolute = fs.realpathSync(configPath);
  const project = path.dirname(absolute);
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: project,
    encoding: 'utf8',
    timeout: 2000
  }).trim();
  const config: InventoryConfig = (await import(pathToFileURL(absolute).href)).default;
  const selected = new Set<string>();
  for (const entry of config.test?.projects ?? [config]) {
    const exclude = entry.test?.exclude ?? config.test?.exclude ?? [];
    for (const glob of entry.test?.include ?? config.test?.include ?? ['**/*.{test,spec}.?(c|m)[jt]s?(x)']) {
      for (const relative of fs.globSync(glob, { cwd: project, exclude })) {
        const file = path.join(project, relative);
        if (fs.statSync(file).isFile()) selected.add(path.relative(root, file).split(path.sep).join('/'));
      }
    }
  }
  const inputs = config.test?.provide?.goodfootCacheInputs;
  if (!inputs || Array.isArray(inputs) || 'uncached' in inputs)
    throw new Error('config needs a cached, object-form goodfootCacheInputs contract');
  const listed = inputs.files ?? {};
  const declarations = [
    ...new Set([...(inputs.all ?? []), ...(inputs.fallback ?? []), ...Object.values(listed).flat()])
  ];
  const unmatchedInputs = declarations
    .filter((declaration) => fs.globSync(declaration, { cwd: root }).length === 0)
    .sort();
  const tests = [...selected].sort();
  const unlisted = tests.filter((file) => !Object.hasOwn(listed, file));
  const stale = Object.keys(listed)
    .filter((file) => !selected.has(file))
    .sort();
  return {
    root,
    project,
    config: absolute,
    fallback: inputs.fallback ?? null,
    tests,
    unlisted,
    stale,
    unmatchedInputs
  };
}

/**
 * Heuristically inspect possible IO and unresolved dynamic edges through resolved local imports; this is not a safe cache-declaration proof.
 *
 * @param root - Repository root.
 * @param project - Project used for compiler resolution.
 * @param files - Repository-relative selected tests.
 * @returns Per-test reachable local module count, possible IO and selected unresolved edges; arbitrary unresolved nonlocal imports are not all reported.
 * @throws For invalid compiler config or source/filesystem read failure.
 */
export function auditImports(root: string, project: string, files: string[]) {
  const options = compilerOptions(project);
  const records = new Map<string, ImportRecord>();
  const examine = (relative: string): ImportRecord => {
    const known = records.get(relative);
    if (known) return known;
    const absolute = path.join(root, relative);
    const tree = sourceFile(absolute);
    const parsed = imports(tree);
    const ownIo: string[] = [];
    const dependencies: string[] = [];
    const unresolved: string[] = [];
    if (ioNames.test(tree.text)) ownIo.push('dynamic IO API');
    if (parsed.unresolvedDynamic) unresolved.push('variable import or require');
    for (const name of parsed.names) {
      if (ioModules.test(name)) {
        ownIo.push(name);
        continue;
      }
      const resolved = ts.resolveModuleName(name, absolute, options, ts.sys).resolvedModule?.resolvedFileName;
      if (!resolved) {
        if (name.startsWith('.') || name.startsWith('/') || name.startsWith('~') || name.startsWith('@goodfoot/'))
          unresolved.push(name);
        continue;
      }
      const physical = fs.realpathSync(resolved);
      const child = path.relative(root, physical);
      if (child.startsWith('..') || path.isAbsolute(child)) {
        unresolved.push(name);
        continue;
      }
      if (!child.split(path.sep).includes('node_modules')) dependencies.push(child.split(path.sep).join('/'));
    }
    const record = {
      file: relative,
      ownIo: [...new Set(ownIo)].sort(),
      unresolved: [...new Set(unresolved)].sort(),
      dependencies: [...new Set(dependencies)].sort()
    };
    records.set(relative, record);
    for (const child of record.dependencies) examine(child);
    return record;
  };
  const results: { file: string; modules: number; io: string[]; unresolved: string[] }[] = [];
  for (const file of files) {
    const pending = [file];
    const seen = new Set<string>();
    const io = new Set<string>();
    const unresolved = new Set<string>();
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      if (seen.has(next)) continue;
      seen.add(next);
      const record = examine(next);
      for (const kind of record.ownIo) io.add(`${next}: ${kind}`);
      for (const name of record.unresolved) unresolved.add(`${next}: ${name}`);
      pending.push(...record.dependencies);
    }
    results.push({ file, modules: seen.size, io: [...io].sort(), unresolved: [...unresolved].sort() });
  }
  return results;
}
