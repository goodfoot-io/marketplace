/**
 * Fingerprint installed package bytes and resolved dependency closure per phase.
 *
 * @summary Fingerprint installed package bytes and resolved dependency closure per phase.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import type { DigestStore } from './digest-store.ts';

const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));

type LockDependency = { name: string; peer: boolean };
type LockEntry = { source: string; dependencies: LockDependency[] };
type Installation = {
  locations: Map<string, string>;
  physicalLocations: Map<string, string>;
  entries: Map<string, LockEntry>;
};
type Edge = [name: string, kind: string, target: string | null];
type PackageNode = { locator: string; lock: string; content: string; edges: Edge[]; dependsOn: string[] };

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalLocator(locator: string) {
  return locator.replace(/@virtual:[^#]+#/, '@');
}

function within(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function quoted(value: string, context: string): string {
  try {
    const decoded = JSON.parse(value);
    if (typeof decoded === 'string') return decoded;
  } catch {
    throw new Error(`invalid Yarn ${context}: ${value}`);
  }
  throw new Error(`invalid Yarn ${context}: ${value}`);
}

/**
 * Require a captured field before generated installation evidence enters a cache key.
 * @param match - Matched generated-file grammar whose field is being read.
 * @param index - Captured field position selected by the owning parser.
 * @param context - Evidence description attached to a malformed grammar error.
 * @returns Present captured spelling without decoding or normalization.
 * @throws When the expected generated-file field is absent.
 */
function captured(match: RegExpExecArray, index: number, context: string): string {
  const value = match[index];
  if (value === undefined) throw new Error(`missing Yarn ${context} capture`);
  return value;
}

function installedState(root: string): Map<string, string> {
  const file = path.join(root, 'node_modules/.yarn-state.yml');
  const source = fs.readFileSync(file, 'utf8');
  const locations = new Map<string, string>();
  let locator: string | undefined;
  let inLocations = false;
  for (const line of source.split('\n')) {
    const heading = /^("(?:[^"\\]|\\.)+"):$/.exec(line);
    if (heading) {
      locator = quoted(captured(heading, 1, 'state locator'), 'state locator');
      inLocations = false;
      continue;
    }
    if (line === '  locations:') {
      if (!locator) throw new Error('Yarn state location without locator');
      inLocations = true;
      continue;
    }
    if (line.startsWith('  ') && !line.startsWith('    ')) inLocations = false;
    const location = /^ {4}- ("(?:[^"\\]|\\.)+")$/.exec(line);
    if (!inLocations || !location) continue;
    if (!locator) throw new Error('Yarn state location without locator');
    const relative = quoted(captured(location, 1, 'state location'), 'state location');
    const absolute = path.resolve(root, relative);
    if (!within(root, absolute) || !relative.split('/').includes('node_modules')) {
      throw new Error(`unsafe Yarn package location: ${relative}`);
    }
    const prior = locations.get(absolute);
    if (prior && prior !== locator) throw new Error(`ambiguous Yarn package location: ${relative}`);
    locations.set(absolute, locator);
  }
  if (!locations.size) throw new Error('empty Yarn installed package state');
  return locations;
}

function lockEntries(root: string): Map<string, LockEntry> {
  const source = fs.readFileSync(path.join(root, 'yarn.lock'), 'utf8');
  const entries = new Map<string, LockEntry>();
  const blocks = source.split(/(?=^\S.*:\s*$)/m);
  for (const block of blocks) {
    const resolution = /^ {2}resolution: ("(?:[^"\\]|\\.)+")$/m.exec(block);
    if (!resolution) continue;
    const locator = quoted(captured(resolution, 1, 'lock resolution'), 'lock resolution');
    if (entries.has(locator)) throw new Error(`duplicate Yarn lock resolution: ${locator}`);
    const dependencies: LockDependency[] = [];
    let section = '';
    for (const line of block.split('\n')) {
      const header = /^ {2}([A-Za-z][A-Za-z-]*):(?: .*)?$/.exec(line);
      if (header) {
        section = captured(header, 1, 'lock section');
        continue;
      }
      if (section !== 'dependencies' && section !== 'peerDependencies') continue;
      const entry = /^ {4}("(?:[^"\\]|\\.)+"|[^:]+): (.+)$/.exec(line);
      if (!entry) continue;
      const spelling = captured(entry, 1, 'dependency name');
      const name = spelling.startsWith('"') ? quoted(spelling, 'dependency name') : spelling;
      dependencies.push({ name, peer: section === 'peerDependencies' });
    }
    entries.set(locator, { source: block.trimEnd(), dependencies });
  }
  if (!entries.size) throw new Error('empty Yarn lockfile');
  return entries;
}

// A lockfile stanza's first line lists every descriptor range that resolves
// to this entry. Hoisting or a new caller's range rewrites that line without
// changing the resolved version or edges below it, so it is excluded here;
// Only this line is excluded; the resolution body still counts.
function lockDigest(source: string) {
  const withoutHeader = source.split('\n').slice(1).join('\n');
  return digest(withoutHeader);
}

function packageRoot(
  root: string,
  filename: string,
  locations: Map<string, string>,
  physicalLocations: Map<string, string>
): string {
  const absolute = fs.realpathSync(filename);
  let directory = fs.statSync(absolute).isDirectory() ? absolute : path.dirname(absolute);
  while (directory !== path.dirname(directory)) {
    if (locations.has(directory)) return directory;
    const logical = physicalLocations.get(directory);
    if (logical !== undefined) return logical;
    if (directory === root) break;
    directory = path.dirname(directory);
  }
  // create-worktree can link each installed package member individually. In
  // that layout the package directory is local, but resolving an imported
  // member points at the source checkout's node_modules tree.
  const parts = absolute.split(path.sep);
  for (let index = 0; index < parts.length; index++) {
    if (parts[index] !== 'node_modules') continue;
    const candidate = path.join(root, ...parts.slice(index));
    if (!fs.existsSync(candidate) || fs.realpathSync(candidate) !== absolute) continue;
    let parent = fs.statSync(candidate).isDirectory() ? candidate : path.dirname(candidate);
    while (within(root, parent)) {
      if (locations.has(parent)) return parent;
      if (parent === root) break;
      parent = path.dirname(parent);
    }
  }
  throw new Error(`unmapped installed package: ${filename}`);
}

function resolveInstalledPackage(from: string, name: string, locations: Map<string, string>) {
  const candidates = createRequire(path.join(from, 'package.json')).resolve.paths(name);
  if (!candidates) throw new Error(`cannot resolve package dependency ${name} from ${from}`);
  for (const folder of candidates) {
    const candidate = path.join(folder, name);
    if (locations.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Create phase-local installed-package closure observations. Completed closure digests are memoized; concurrent identical calls before completion may traverse independently. Traversal yields between package directories.
 *
 * @param repositoryRoot - Repository root with exact Yarn installation and lock state.
 * @param store - Phase-scoped content digest store.
 * @returns Package-root resolution and awaited closure fingerprint operations.
 * @throws For missing digest store, invalid root and later invalid/unresolved Yarn installation/required dependencies.
 */
export function createPackagePhase(repositoryRoot: string, store: DigestStore) {
  if (!store) throw new Error('createPackagePhase requires a digest store');
  const root = fs.realpathSync(repositoryRoot);
  let installation: Installation | undefined;
  const nodes = new Map<string, PackageNode>();
  const roots = new Map<string, string>();
  const closures = new Map<string, string>();

  function state() {
    if (!installation) {
      const locations = installedState(root);
      const physicalLocations = new Map<string, string>();
      for (const directory of locations.keys()) {
        const physical = fs.realpathSync(directory);
        // Workspace sources are local graph inputs, not installed package bytes.
        // Multiple virtual peer contexts legitimately symlink the same source tree.
        // Never choose one context by physical path; logical locations still retain
        // their exact peer edges when explicitly reached by dependency resolution.
        const locator = locations.get(directory);
        if (
          locator &&
          canonicalLocator(locator).includes('@workspace:') &&
          within(root, physical) &&
          !path.relative(root, physical).split(path.sep).includes('node_modules')
        )
          continue;
        const prior = physicalLocations.get(physical);
        if (prior && locations.get(prior) !== locations.get(directory)) {
          throw new Error(`ambiguous shared Yarn package location: ${directory}`);
        }
        physicalLocations.set(physical, directory);
      }
      installation = { locations, physicalLocations, entries: lockEntries(root) };
    }
    return installation;
  }

  function resolvedRoot(filename: string) {
    let value = roots.get(filename);
    if (!value) {
      const { locations, physicalLocations } = state();
      value = packageRoot(root, filename, locations, physicalLocations);
      roots.set(filename, value);
    }
    return value;
  }

  /**
   * Resolve unique installed package roots for effective imported members.
   *
   * @param resolvedPaths - Resolved installed member paths.
   * @returns Sorted unique logical installation roots.
   * @throws For unmapped/unsafe/ambiguous installation metadata.
   */
  function packageRoots(resolvedPaths: string[]) {
    return [...new Set(resolvedPaths.map((filename) => resolvedRoot(filename)))].sort();
  }

  function node(directory: string): PackageNode {
    let record = nodes.get(directory);
    if (record) return record;
    const { locations, entries } = state();
    const locator = locations.get(directory);
    // Yarn's node-modules state names virtual peer instances, while yarn.lock
    // records their underlying package resolution once. Virtual IDs vary by
    // worktree; the resolved edges and installed bytes preserve peer context.
    if (!locator) throw new Error(`installed package missing exact Yarn lock entry: ${directory}`);
    const underlying = canonicalLocator(locator);
    const lock = entries.get(locator) ?? entries.get(underlying);
    if (!lock) throw new Error(`installed package missing exact Yarn lock entry: ${directory}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const declarations = new Map<string, string>();
    for (const name of Object.keys(manifest.dependencies ?? {})) declarations.set(name, 'required');
    for (const name of Object.keys(manifest.optionalDependencies ?? {})) declarations.set(name, 'optional');
    for (const name of Object.keys(manifest.peerDependencies ?? {})) {
      declarations.set(name, manifest.peerDependenciesMeta?.[name]?.optional ? 'optional-peer' : 'peer');
    }
    // Yarn packageExtensions and virtual peer contexts are represented in the
    // lock entry, even when the published manifest omits the added dependency.
    for (const dependency of lock.dependencies) {
      if (!declarations.has(dependency.name)) declarations.set(dependency.name, dependency.peer ? 'peer' : 'required');
    }
    const edges: Edge[] = [];
    const dependsOn: string[] = [];
    for (const [name, kind] of [...declarations].sort(([a], [b]) => a.localeCompare(b))) {
      if (builtins.has(name.replace(/^node:/, ''))) {
        edges.push([name, kind, 'node:builtin']);
        continue;
      }
      const target = resolveInstalledPackage(directory, name, locations);
      if (!target && kind !== 'optional' && kind !== 'optional-peer') {
        throw new Error(`unresolved ${kind} dependency ${name} from ${locator}`);
      }
      const targetLocator = target ? locations.get(target) : undefined;
      edges.push([name, kind, targetLocator === undefined ? null : canonicalLocator(targetLocator)]);
      if (target) dependsOn.push(target);
    }
    record = {
      locator: underlying,
      lock: lockDigest(lock.source),
      content: store.treeDigest(directory),
      edges,
      dependsOn
    };
    nodes.set(directory, record);
    return record;
  }

  /**
   * Fingerprint exact installed transitive package bytes, lock bodies and resolved dependency edges.
   *
   * @param resolvedPaths - Resolved imported installed member paths.
   * @param toolchainSpecifiers - Additional installed runner/toolchain specifiers.
   * @param toolchainRoot - Consuming project's directory for Node package resolution.
   * @returns Canonical complete closure digest after bounded per-directory yields; completed results are phase-reused.
   * @throws For invalid toolchain input, missing required dependency or invalid installation/content evidence.
   */
  async function closure(resolvedPaths: string[], toolchainSpecifiers: string[], toolchainRoot: string) {
    if (!Array.isArray(toolchainSpecifiers)) throw new Error('toolchainSpecifiers must be an array');
    const { locations } = state();
    const starts = new Set(packageRoots(resolvedPaths));
    for (const name of toolchainSpecifiers) {
      const directory = resolveInstalledPackage(toolchainRoot, name, locations);
      if (!directory) throw new Error(`missing test toolchain package: ${name}`);
      starts.add(directory);
    }
    const key = `${[...starts].sort().join('\0')}\u0001${[...toolchainSpecifiers].sort().join('\0')}`;
    let value = closures.get(key);
    if (value) return value;
    const visited = new Set<string>();
    const pending = [...starts];
    const items: string[] = [];
    for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
      if (visited.has(directory)) continue;
      visited.add(directory);
      // Fresh installed-package hashes can block worker stop acknowledgements.
      // Let their IPC callbacks run between package directories.
      await setImmediate();
      const record = node(directory);
      items.push(
        JSON.stringify({ locator: record.locator, lock: record.lock, content: record.content, edges: record.edges })
      );
      pending.push(...record.dependsOn);
    }
    const hash = createHash('sha256');
    hash.update('vitest-installed-package-closure-v2\0');
    for (const item of items.sort()) {
      hash.update(item);
      hash.update('\0');
    }
    value = hash.digest('hex');
    closures.set(key, value);
    return value;
  }

  return { closure, packageRoots };
}
