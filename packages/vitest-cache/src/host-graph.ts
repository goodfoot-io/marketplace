/**
 * Discover host module and resolution inputs without executing test modules.
 *
 * @summary Discover host module and resolution inputs without executing test modules.
 */
import fs from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import path from 'node:path';
import type { Node } from 'estree';
import { parseAst, transformWithOxc } from 'vite';
import type { HostImportAlias } from './contract.ts';
import { errnoCode, errorMessage } from './errors.ts';

type HostResolution = { type: 'skip' } | { type: 'external'; path: string } | { type: 'files'; paths: string[] };
type Classified = { external: true; real: string } | { external: false; real: string; relative: string };
/** Phase-scoped nearest manifest/tsconfig/extends observations reused across source files. */
export type ResolutionCache = {
  root: string;
  packageJsonCache: Map<string, string | null>;
  tsconfigCache: Map<string, string | null>;
  chainCache: Map<string, string[]>;
};

const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const PARSEABLE = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx']);
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.js', '.cjs', '.jsx', '.json'];
const TS_SIBLINGS: Record<string, string[] | undefined> = {
  '.js': ['.ts', '.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts']
};

function isExistingFile(candidate: string) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isExistingDirectory(candidate: string) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Visit every object reachable from `node`. Non-node objects (a template element's `value`, for example) reach `visit` too; they carry no node `type`, so no visitor's type check matches them.
 *
 * @param node - Parsed object/array graph.
 * @param visit - Visitor receiving object values, including non-AST objects.
 */
function walk(node: unknown, visit: (node: Node) => void) {
  const pending = [node];
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    visit(current as Node);
    for (const value of Object.values(current)) {
      if (value && typeof value === 'object') pending.push(value);
    }
  }
}

function literalSource(node: Node | null | undefined): string | undefined {
  if (!node) return undefined;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1) {
    // A template with an invalid escape has no cooked value; it is not a literal source.
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

function isCreateRequireCallee(node: Node) {
  return (
    (node.type === 'Identifier' && node.name === 'createRequire') ||
    (node.type === 'MemberExpression' &&
      !node.computed &&
      node.property?.type === 'Identifier' &&
      node.property.name === 'createRequire')
  );
}

function isImportMetaUrl(node: Node | undefined) {
  return (
    node?.type === 'MemberExpression' &&
    !node.computed &&
    node.property?.type === 'Identifier' &&
    node.property.name === 'url' &&
    node.object.type === 'MetaProperty' &&
    node.object.meta.name === 'import' &&
    node.object.property.name === 'meta'
  );
}

/**
 * Walk a parsed module AST for its module-graph edges: static import/export sources, dynamic import() (including Vite's SSR-rewritten __vite_ssr_dynamic_import__ call), require(), and require obtained from createRequire(). A non-literal target on any dynamic form is unresolved; boundRequire.resolve(...) is resolution only, not an edge.
 *
 * @param tree - Parsed module AST.
 * @returns Literal module edge specifiers and whether a dynamic target remains unresolved.
 */
export function moduleEdges(tree: unknown) {
  const bound = new Set<string>();
  walk(tree, (node) => {
    if (
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      node.init?.type === 'CallExpression' &&
      isCreateRequireCallee(node.init.callee)
    ) {
      bound.add(node.id.name);
    }
  });

  const imports: string[] = [];
  let unresolved = false;
  const literalOrUnresolved = (sourceNode: Node | undefined) => {
    const value = literalSource(sourceNode);
    if (value === undefined) unresolved = true;
    else imports.push(value);
  };

  walk(tree, (node) => {
    if (node.type === 'ImportExpression') {
      literalOrUnresolved(node.source);
      return;
    }
    if (
      node.type === 'ImportDeclaration' ||
      node.type === 'ExportNamedDeclaration' ||
      node.type === 'ExportAllDeclaration'
    ) {
      if (node.source) literalOrUnresolved(node.source);
      return;
    }
    if (node.type !== 'CallExpression') return;
    const callee = node.callee;
    if (callee.type === 'Identifier' && callee.name === '__vite_ssr_dynamic_import__') {
      literalOrUnresolved(node.arguments[0]);
      return;
    }
    if (callee.type === 'Identifier' && (callee.name === 'require' || bound.has(callee.name))) {
      literalOrUnresolved(node.arguments[0]);
      return;
    }
    if (callee.type === 'CallExpression' && isCreateRequireCallee(callee.callee)) {
      literalOrUnresolved(node.arguments[0]);
    }
  });

  return { imports, unresolved };
}

// `loadCacheContract`/`loadTestSequence` (src/test-output-policy.mjs) read
// a JSON file whose entries the cache key already threads through
// per-file/per-project — a suite's whole cache contract or declared sequence
// is never itself a host runtime dependency. Skipping their own `new
// URL(...)` argument here is what makes editing one contract entry key only
// the files that entry applies to (see index.ts's `pick()`)
// instead of every file sharing the config as a host root.
const CONTRACT_DATA_LOADERS = new Set(['loadCacheContract', 'loadTestSequence']);

function urlEdges(tree: unknown) {
  const excluded = new Set<Node>();
  walk(tree, (node) => {
    if (node.type !== 'CallExpression') return;
    if (node.callee?.type !== 'Identifier' || !CONTRACT_DATA_LOADERS.has(node.callee.name)) return;
    const argument = node.arguments[0];
    if (argument) excluded.add(argument);
  });
  const targets: string[] = [];
  walk(tree, (node) => {
    if (node.type !== 'NewExpression') return;
    if (node.callee?.type !== 'Identifier' || node.callee.name !== 'URL') return;
    if (!isImportMetaUrl(node.arguments[1])) return;
    if (excluded.has(node)) return;
    const value = literalSource(node.arguments[0]);
    if (value !== undefined) targets.push(value);
  });
  return targets;
}

async function parseModule(absolute: string, ext: string) {
  const code = fs.readFileSync(absolute, 'utf8');
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return parseAst(code);
  const lang = ext === '.tsx' ? 'tsx' : ext === '.jsx' ? 'jsx' : 'ts';
  const transformed = await transformWithOxc(code, absolute, { lang, target: 'esnext' });
  return parseAst(transformed.code);
}

function resolveExtensionless(base: string) {
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (isExistingFile(candidate)) return candidate;
  }
  return undefined;
}

function resolveDirectory(base: string) {
  const indexed = resolveExtensionless(path.join(base, 'index'));
  if (indexed) return indexed;
  const manifestPath = path.join(base, 'package.json');
  if (isExistingFile(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (typeof manifest.main === 'string') {
      const target = path.resolve(base, manifest.main);
      const resolved = isExistingFile(target) ? target : resolveExtensionless(target);
      if (resolved) return resolved;
    }
  }
  return undefined;
}

/**
 * File/extensionless/directory resolution shared by relative, absolute and export-target specifiers.
 *
 * @param base - Physical path candidate.
 * @returns Existing file/extensionless/directory-main target or undefined.
 */
function resolveHostPath(base: string): string | undefined {
  if (isExistingFile(base)) return base;
  if (isExistingDirectory(base)) return resolveDirectory(base);
  const ext = path.extname(base);
  const siblings = TS_SIBLINGS[ext];
  if (siblings) {
    const stem = base.slice(0, -ext.length);
    for (const siblingExt of siblings) {
      const candidate = `${stem}${siblingExt}`;
      if (isExistingFile(candidate)) return candidate;
    }
  }
  return resolveExtensionless(base);
}

function packageNameAndSubpath(specifier: string) {
  const segments = specifier.split('/');
  const nameLength = specifier.startsWith('@') ? 2 : 1;
  const name = segments.slice(0, nameLength).join('/');
  const rest = segments.slice(nameLength);
  return { name, subpath: rest.length ? `./${rest.join('/')}` : '.' };
}

function findPackageDirectory(importer: string, name: string) {
  const candidates = createRequire(importer).resolve.paths(name) ?? [];
  for (const dir of candidates) {
    const candidate = path.join(dir, name);
    if (isExistingFile(path.join(candidate, 'package.json'))) return candidate;
  }
  return undefined;
}

/**
 * exports/imports maps are subpath-keyed when every key starts with '.' or '#'; otherwise it's one condition map for '.'.
 *
 * @param map - Unknown package imports/exports map.
 * @returns Whether every nonempty map key begins with dot or hash.
 */
function isSubpathKeyed(map: unknown): map is Record<string, unknown> {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return false;
  const keys = Object.keys(map);
  return keys.length > 0 && keys.every((key) => key.startsWith('.') || key.startsWith('#'));
}

function collectConditionTargets(value: unknown, sink: string[]) {
  if (typeof value === 'string') {
    sink.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectConditionTargets(item, sink);
  } else if (value && typeof value === 'object') {
    for (const [condition, conditionValue] of Object.entries(value)) {
      // TypeScript's declaration conditions never select host runtime code.
      if (condition === 'types' || condition.startsWith('types@')) continue;
      collectConditionTargets(conditionValue, sink);
    }
  }
}

function matchSubpathPattern(pattern: string, subpath: string) {
  const star = pattern.indexOf('*');
  if (star === -1) return undefined;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) return undefined;
  if (subpath.length < prefix.length + suffix.length) return undefined;
  return subpath.slice(prefix.length, subpath.length - suffix.length);
}

/**
 * Every runtime target reachable for `subpath`, across condition branches and `*` patterns.
 *
 * @param map - Unknown package imports/exports map.
 * @param subpath - Exact requested package subpath.
 * @returns Every runtime target reachable across condition and wildcard branches.
 */
function resolveExportsTargets(map: unknown, subpath: string) {
  const sink: string[] = [];
  if (!isSubpathKeyed(map)) {
    if (subpath === '.') collectConditionTargets(map, sink);
    return sink;
  }
  if (Object.hasOwn(map, subpath)) collectConditionTargets(map[subpath], sink);
  for (const [pattern, value] of Object.entries(map)) {
    if (pattern === subpath || !pattern.includes('*')) continue;
    const match = matchSubpathPattern(pattern, subpath);
    if (match === undefined) continue;
    const raw: string[] = [];
    collectConditionTargets(value, raw);
    for (const target of raw) sink.push(target.includes('*') ? target.replaceAll('*', match) : target);
  }
  return sink;
}

function resolveNoExportsSubpath(packageDir: string, manifest: Record<string, unknown>, subpath: string): string[] {
  if (subpath !== '.') {
    const target = resolveHostPath(path.resolve(packageDir, subpath));
    return target ? [target] : [];
  }
  if (typeof manifest.module === 'string') {
    const target = resolveHostPath(path.resolve(packageDir, manifest.module));
    if (target) return [target];
  }
  if (typeof manifest.main === 'string') {
    const target = resolveHostPath(path.resolve(packageDir, manifest.main));
    if (target) return [target];
  }
  const indexed = resolveExtensionless(path.join(packageDir, 'index'));
  return indexed ? [indexed] : [];
}

function isSkippableSpecifier(specifier: string) {
  return specifier.startsWith('node:') || specifier.startsWith('cloudflare:') || builtins.has(specifier);
}

function resolveBareSpecifier(importer: string, specifier: string): HostResolution {
  const { name, subpath } = packageNameAndSubpath(specifier);
  const packageDir = findPackageDirectory(importer, name);
  if (!packageDir) throw new Error(`unresolved host import ${specifier} from ${importer}`);
  const real = fs.realpathSync.native(packageDir);
  if (real.split(path.sep).includes('node_modules')) return { type: 'external', path: real };
  const manifestPath = path.join(real, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const targets = manifest.exports
    ? resolveExportsTargets(manifest.exports, subpath)
        .map((target) => path.resolve(real, target))
        .filter((target) => isExistingFile(target))
    : resolveNoExportsSubpath(real, manifest, subpath);
  if (!targets.length) throw new Error(`unresolved host import ${specifier} from ${importer}`);
  return { type: 'files', paths: [manifestPath, ...targets] };
}

function resolveImportsSpecifier(
  root: string,
  importer: string,
  specifier: string,
  packageJsonCache: Map<string, string | null>
): HostResolution {
  const manifestPath = nearestFile(root, path.dirname(importer), 'package.json', packageJsonCache);
  if (!manifestPath) throw new Error(`unresolved host import ${specifier} from ${importer}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const importsField = manifest.imports;
  if (!importsField || typeof importsField !== 'object') {
    throw new Error(`unresolved host import ${specifier} from ${importer}`);
  }
  const packageDir = path.dirname(manifestPath);
  const targets = resolveExportsTargets(importsField, specifier)
    .filter((target) => target.startsWith('.'))
    .map((target) => path.resolve(packageDir, target))
    .filter((target) => isExistingFile(target));
  if (!targets.length) throw new Error(`unresolved host import ${specifier} from ${importer}`);
  return { type: 'files', paths: [manifestPath, ...targets] };
}

function resolveHostImport(
  root: string,
  importer: string,
  specifier: string,
  packageJsonCache: Map<string, string | null>
): HostResolution {
  if (isSkippableSpecifier(specifier)) return { type: 'skip' };
  if (specifier.startsWith('#')) return resolveImportsSpecifier(root, importer, specifier, packageJsonCache);
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const base = specifier.startsWith('.') ? path.resolve(path.dirname(importer), specifier) : specifier;
    const resolved = resolveHostPath(base);
    if (!resolved) throw new Error(`unresolved host import ${specifier} from ${importer}`);
    return { type: 'files', paths: [resolved] };
  }
  return resolveBareSpecifier(importer, specifier);
}

function classify(root: string, absolute: string): Classified {
  const real = fs.realpathSync.native(absolute);
  if (real.split(path.sep).includes('node_modules')) return { external: true, real };
  const relative = path.relative(root, real);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('host dependency outside repository');
  }
  return { external: false, real, relative: relative.split(path.sep).join('/') };
}

function withinRepo(root: string, absolute: string) {
  try {
    const real = fs.realpathSync.native(absolute);
    if (real.split(path.sep).includes('node_modules')) return false;
    const relative = path.relative(root, real);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

/**
 * Build a per-importer specifier redirect table from a contract's `hostImportAliases` entries (`{ importer, from, to }`, absolute or repository-relative paths and the literal specifier they replace). Mirrors a Vite plugin's `resolveId` redirect so the host graph, which resolves imports with its own static walker rather than through Vite, follows the same edge the plugin actually sends the runtime to.
 *
 * @param root - Repository root bounding relative alias paths.
 * @param importAliases - Declared exact importer/specifier/target redirects.
 * @returns Physical-importer redirect table.
 * @throws When an importer cannot be resolved physically.
 */
function aliasTable(root: string, importAliases: HostImportAlias[]) {
  const table = new Map<string, Map<string, string>>();
  for (const { importer, from, to } of importAliases) {
    const importerAbsolute = path.isAbsolute(importer) ? importer : path.resolve(root, importer);
    const toAbsolute = path.isAbsolute(to) ? to : path.resolve(root, to);
    let importerReal: string;
    try {
      importerReal = fs.realpathSync.native(importerAbsolute);
    } catch {
      throw new Error(`hostImportAliases importer does not exist: ${importerAbsolute}`);
    }
    let bySpecifier = table.get(importerReal);
    if (!bySpecifier) {
      bySpecifier = new Map();
      table.set(importerReal, bySpecifier);
    }
    bySpecifier.set(from, toAbsolute);
  }
  return table;
}

/**
 * Fingerprint modules that run on the host, outside the test environment: the Vitest config file and its imports, global setup files, and auxiliary Worker scripts bundled with esbuild. Config-time reads outside the import graph are declared in the suite's cache contract.
 *
 * @param repositoryRoot - Repository root bounding local modules.
 * @param roots - Original host entrypoints.
 * @param root0 - Declared dynamic domains and exact importer redirects.
 * @param root0.dynamicImports - Declared nonliteral import dependency globs.
 * @param root0.importAliases - Exact host importer redirects mirroring configured plugin behavior.
 * @returns Sorted local host files, installed external members and dynamic-domain globs.
 * @throws For unsafe/unresolved host edges, missing dynamic domains or parse errors.
 */
export async function collectHostGraph(
  repositoryRoot: string,
  roots: string[],
  {
    dynamicImports = {},
    importAliases = []
  }: { dynamicImports?: Record<string, string[]>; importAliases?: HostImportAlias[] } = {}
) {
  const root = fs.realpathSync.native(repositoryRoot);
  const aliases = aliasTable(root, importAliases);
  const files = new Set<string>();
  const externalPaths = new Set<string>();
  const declared = new Set<string>();
  const visited = new Set<string>();
  const packageJsonCache = new Map<string, string | null>();
  const pending = roots.map((entry) => (path.isAbsolute(entry) ? entry : path.resolve(root, entry)));

  for (let absolute = pending.pop(); absolute !== undefined; absolute = pending.pop()) {
    const classified = classify(root, absolute);
    if (classified.external) {
      externalPaths.add(classified.real);
      continue;
    }
    if (visited.has(classified.real)) continue;
    visited.add(classified.real);
    files.add(classified.relative);
    const ext = path.extname(classified.real);
    if (!PARSEABLE.has(ext)) continue;

    let tree: Awaited<ReturnType<typeof parseModule>>;
    try {
      tree = await parseModule(classified.real, ext);
    } catch (error) {
      throw new Error(`cannot parse host module ${classified.relative}: ${errorMessage(error)}`);
    }
    const { imports, unresolved } = moduleEdges(tree);
    if (unresolved) {
      const globs = dynamicImports[classified.relative];
      if (!globs) {
        throw new Error(
          `unresolved dynamic import in ${classified.relative}; declare its dependency domain in dynamicImports`
        );
      }
      for (const glob of globs) declared.add(glob);
    }
    for (const specifier of imports) {
      const aliased = aliases.get(classified.real)?.get(specifier);
      if (aliased !== undefined) {
        if (!isExistingFile(aliased))
          throw new Error(`unresolved host import alias ${specifier} from ${classified.relative} -> ${aliased}`);
        pending.push(aliased);
        continue;
      }
      const result = resolveHostImport(root, classified.real, specifier, packageJsonCache);
      if (result.type === 'skip') continue;
      if (result.type === 'external') {
        externalPaths.add(result.path);
        continue;
      }
      pending.push(...result.paths);
    }
    for (const literal of urlEdges(tree)) {
      const candidate = path.resolve(path.dirname(classified.real), literal);
      if (!isExistingFile(candidate) || !withinRepo(root, candidate)) continue;
      pending.push(candidate);
    }
  }

  return { files: [...files].sort(), externalPaths: [...externalPaths].sort(), declared: [...declared].sort() };
}

/**
 * Walk from `startDir` up to (and including) `root` for the nearest `filename`; memoized per directory.
 *
 * @param root - Repository ascent boundary.
 * @param startDir - Original source directory.
 * @param filename - Ancestor filename to find.
 * @param cache - Phase-scoped directory lookup observations.
 * @returns Nearest file through root, or null when absent.
 */
function nearestFile(
  root: string,
  startDir: string,
  filename: string,
  cache: Map<string, string | null>
): string | null {
  const visitedDirs: string[] = [];
  let dir = startDir;
  for (;;) {
    const cached = cache.get(dir);
    if (cached !== undefined) {
      for (const visitedDir of visitedDirs) cache.set(visitedDir, cached);
      return cached;
    }
    const candidate = path.join(dir, filename);
    if (isExistingFile(candidate)) {
      for (const visitedDir of visitedDirs) cache.set(visitedDir, candidate);
      cache.set(dir, candidate);
      return candidate;
    }
    visitedDirs.push(dir);
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const visitedDir of visitedDirs) cache.set(visitedDir, null);
  return null;
}

function toRepoRelative(root: string, absolute: string) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function parseJsonc(text: string): unknown {
  const withoutBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutLineComments = withoutBlockComments.replace(/(^|[^:])\/\/.*$/gm, '$1');
  const withoutTrailingCommas = withoutLineComments.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}

function resolveTsconfigExtends(configDir: string, specifier: string) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    let candidate = path.resolve(configDir, specifier);
    if (!isExistingFile(candidate)) candidate = `${candidate}.json`;
    if (isExistingDirectory(candidate)) candidate = path.join(candidate, 'tsconfig.json');
    return isExistingFile(candidate) ? candidate : undefined;
  }
  const req = createRequire(path.join(configDir, 'tsconfig.json'));
  for (const attempt of [specifier, `${specifier}/tsconfig.json`, `${specifier}.json`]) {
    try {
      return req.resolve(attempt);
    } catch (error) {
      const code = errnoCode(error);
      if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    }
  }
  return undefined;
}

function tsconfigChain(configPath: string, cache: Map<string, string[]>, visiting: Set<string>): string[] {
  const cached = cache.get(configPath);
  if (cached) return cached;
  if (visiting.has(configPath)) return [configPath];
  visiting.add(configPath);
  const result = [configPath];
  let parsed: unknown;
  try {
    parsed = parseJsonc(fs.readFileSync(configPath, 'utf8'));
  } catch {
    cache.set(configPath, result);
    return result;
  }
  const extendsField = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).extends : undefined;
  const specifiers = extendsField === undefined ? [] : Array.isArray(extendsField) ? extendsField : [extendsField];
  const configDir = path.dirname(configPath);
  for (const specifier of specifiers) {
    if (typeof specifier !== 'string') continue;
    const target = resolveTsconfigExtends(configDir, specifier);
    if (!target) continue;
    const real = fs.realpathSync.native(target);
    if (real.split(path.sep).includes('node_modules')) continue;
    result.push(...tsconfigChain(real, cache, visiting));
  }
  cache.set(configPath, result);
  return result;
}

/**
 * A shared cache for `resolutionInputsForFile`, scoped to one fingerprinting phase. `nearestFile` and `tsconfigChain` walk parent directories; sharing their memoization across every file keyed in a phase, rather than starting fresh per file, avoids re-walking ancestor directories many files share.
 *
 * @param repositoryRoot - Physical repository root.
 * @returns Fresh phase-scoped ancestor manifest/tsconfig/extends observations.
 */
export function createResolutionCache(repositoryRoot: string): ResolutionCache {
  return {
    root: fs.realpathSync.native(repositoryRoot),
    packageJsonCache: new Map(),
    tsconfigCache: new Map(),
    chainCache: new Map()
  };
}

function resolutionEntriesForFile(cache: ResolutionCache, file: string) {
  const { root } = cache;
  const absolute = path.resolve(root, file);
  const dir = path.dirname(absolute);
  const results = new Set<string>();
  const manifestPath = nearestFile(root, dir, 'package.json', cache.packageJsonCache);
  if (manifestPath) results.add(toRepoRelative(root, manifestPath));
  const ext = path.extname(file);
  if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') {
    const tsconfigPath = nearestFile(root, dir, 'tsconfig.json', cache.tsconfigCache);
    if (tsconfigPath) {
      for (const entry of tsconfigChain(tsconfigPath, cache.chainCache, new Set())) {
        results.add(toRepoRelative(root, entry));
      }
    }
  }
  return results;
}

/**
 * One file's nearest package.json, and for TS sources the nearest tsconfig.json plus its local (non-node_modules) `extends` chain, against a cache shared across many files (see `createResolutionCache`).
 *
 * @param cache - Current phase resolution observation cache.
 * @param file - Repository-relative source path.
 * @returns Sorted nearest manifest and local TypeScript extends-chain inputs.
 */
export function resolutionInputsForFile(cache: ResolutionCache, file: string) {
  return [...resolutionEntriesForFile(cache, file)].sort();
}
