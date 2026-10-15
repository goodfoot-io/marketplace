/**
 * Walk the transformed Vite input graph with phase-scoped observations.
 *
 * @summary Walk the transformed Vite input graph with phase-scoped observations.
 */
import { createHash, randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import { createRequire, isBuiltin } from 'node:module';
import path from 'node:path';
import { parseAst } from 'vite';
import type { TestProject } from 'vitest/node';
import { errorMessage } from './errors.ts';
import { filesystemMetadata, physicalPath } from './filesystem-batch.ts';
import { moduleEdges } from './host-graph.ts';

/** The Vite server Vitest runs on. */
type ViteDevServer = TestProject['vite'];
type DevEnvironment = ViteDevServer['environments'][string];
/** The part of a Vitest `TestSpecification` the walk reads. */
type GraphSpecification = { moduleId: string; project: { vite: Pick<ViteDevServer, 'environments'> } };
/** Observed installed external member, repository-local path or outside-root classification. */
export type LocalClassification =
  | { external: string; relative: null; outside: false }
  | { external: null; relative: string | null; outside: boolean };
/** Fresh-phase physical classification/stat observations; cached observations never freeze filesystem contents. */
export type WalkCache = { classify: Map<string, LocalClassification>; signature: Map<string, string> };
type ModuleEdges = { dependencies: (string | null)[]; declaredGlobs: string[] };
/** Discovered repository-local inputs, installed external members and explicit dynamic-domain globs. */
export type InputGraph = { files: string[]; externalPaths: string[]; declared: string[] };

const resolvedEdges = new WeakMap<DevEnvironment, Map<string, Promise<ModuleEdges>>>();
const resolvedSignatures = new WeakMap<DevEnvironment, Map<string, string>>();

/**
 * Vite's test environment can vary by pool; SSR is the transformation fallback.
 *
 * @param specification - Current test module/project Vite environment.
 * @returns Vitest test environment or SSR fallback.
 */
function testEnvironment(specification: GraphSpecification) {
  const environments = specification.project.vite.environments;
  return environments.__vitest__ ?? environments.ssr;
}

/**
 * Create fresh phase-scoped observation maps. Cached realpath/lstat observations do not prevent concurrent filesystem changes; later phases revalidate.
 *
 * @returns Empty path-classification and stat-signature maps.
 */
export function createWalkCache(): WalkCache {
  return { classify: new Map(), signature: new Map() };
}

/**
 * Asynchronous realpath + repo-relative/external classification of `pathname`, memoized per phase.
 *
 * @param root - Physical repository root.
 * @param pathname - Path to observe.
 * @param cache - Phase-scoped classification observations.
 * @returns Installed external path, repository-relative file or outside-repository classification.
 * @throws On realpath failure.
 */
async function classifyLocalFile(root: string, pathname: string, cache: Map<string, LocalClassification>) {
  let result = cache.get(pathname);
  if (result) return result;
  const file = await physicalPath(pathname);
  if (file.split(path.sep).includes('node_modules')) {
    result = { external: file, relative: null, outside: false };
  } else {
    const relative = path.relative(root, file);
    const outside = !relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
    result = { external: null, relative: outside ? null : relative.split(path.sep).join('/'), outside };
  }
  cache.set(pathname, result);
  return result;
}

async function localFile(
  root: string,
  id: unknown,
  externalPaths: Set<string>,
  cache: Map<string, LocalClassification>
) {
  if (typeof id !== 'string' || id.startsWith('\0') || id.startsWith('virtual:') || id.startsWith('/@id/')) {
    throw new Error(`untracked virtual test dependency: ${String(id)}`);
  }
  const pathname = id.replace(/[?#].*$/, '');
  if (!path.isAbsolute(pathname)) throw new Error(`unresolved test dependency: ${id}`);
  const result = await classifyLocalFile(root, pathname, cache);
  if (result.external) {
    externalPaths.add(result.external);
    return null;
  }
  if (result.outside) throw new Error(`test dependency outside repository: ${id}`);
  return result.relative;
}

function cloudflareRuntimeModule(id: string) {
  return (
    id === 'cloudflare:workers' ||
    id === 'cloudflare:test' ||
    /^\/?(?:@id\/__x00__|\0)cloudflare:test-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)
  );
}

async function resolveImport(
  environment: DevEnvironment,
  imported: string,
  importer: string,
  opaqueImports: Set<string>
): Promise<string | null> {
  // The pool synthesizes cloudflare:test with a fresh UUID for every Vitest
  // invocation. Its code comes from the versioned pool package; the caller
  // must hash the installed pool package and any Worker entrypoint/config read by it.
  if (isBuiltin(imported) || cloudflareRuntimeModule(imported)) return null;
  // Vite represents files outside the project root as /@fs/<absolute path>.
  // Compare the physical path before asking Vite to resolve generated outputs.
  if (imported.startsWith('/@fs/')) {
    const physical = imported.slice('/@fs'.length).replace(/[?#].*$/, '');
    if (opaqueImports.has(physical)) return null;
  }
  if (path.isAbsolute(imported) && opaqueImports.has(imported.replace(/[?#].*$/, ''))) return null;
  if (imported.startsWith('.')) {
    const physical = path.resolve(path.dirname(importer), imported.replace(/[?#].*$/, ''));
    if (opaqueImports.has(physical)) return null;
    const resolved = await environment.pluginContainer.resolveId(imported, importer);
    if (!resolved?.id) throw new Error(`unresolved test import ${imported} from ${importer}`);
    return cloudflareRuntimeModule(resolved.id) ? null : resolved.id;
  }
  // The module's id keeps the request query (`?raw`, `?url`) that decides
  // whether it is a leaf input; `file` drops it.
  const module = await environment.moduleGraph.getModuleByUrl(imported);
  let id = module?.id ?? module?.file;
  if (!id) id = (await environment.pluginContainer.resolveId(imported, importer))?.id;
  if (!id) throw new Error(`unresolved test import ${imported} from ${importer}`);
  if (!path.isAbsolute(id) && !id.startsWith('\0') && !id.startsWith('virtual:') && !id.startsWith('/@id/')) {
    id = createRequire(importer).resolve(id);
  }
  return cloudflareRuntimeModule(id) ? null : id;
}

/**
 * Raw assets and data files are inputs, not modules with further imports. Vite can hand back their source text for transformRequest, which is not JavaScript. Any other request must transform and parse, or the walk throws.
 *
 * @param id - Resolved request ID retaining query semantics.
 * @param relative - Repository-relative physical file path.
 * @returns Whether request query or file extension is a non-module leaf input.
 */
function leafRequest(id: string, relative: string) {
  return /[?&](?:raw|url|inline)(?:[&=]|$)/.test(id) || /\.(?:sql|json|md|txt|wasm|css|html|svg)$/.test(relative);
}

async function statSignature(file: string) {
  const stat = await filesystemMetadata(() => fsp.lstat(file, { bigint: true }));
  return `${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
}

/**
 * Reuse one phase-scoped stat observation; memoization does not establish immutable filesystem contents.
 *
 * @param file - Physical file path.
 * @param cache - Phase-scoped stat signature map.
 * @returns Observed inode/size/mtime/ctime signature.
 * @throws On filesystem stat failure.
 */
async function cachedStatSignature(file: string, cache: Map<string, string>) {
  let signature = cache.get(file);
  if (signature === undefined) {
    signature = await statSignature(file);
    cache.set(file, signature);
  }
  return signature;
}

/** Persisted pre-resolution import specifiers of one transformed module; resolution is always redone. */
type PersistedSpecifiers = {
  schema: 1;
  signature: string;
  recordedAtNs: string;
  specifiers: string[];
  unresolved: boolean;
};
const racyWindowNs = 2_000_000_000n;

function specifierRecordPath(folder: string, environmentKey: string, absolute: string) {
  const id = createHash('sha256').update(`${environmentKey}\0${absolute}`).digest('hex');
  return path.join(folder, `${id}.json`);
}

/**
 * Read previously derived import specifiers for an unchanged module under an identical transform environment.
 * A record is trusted only when the file's signature is unchanged and its newest timestamp predates the record by the racy window.
 *
 * @param folder - Persistent specifier record folder.
 * @param environmentKey - Digest of the transform environment the record must have been derived under.
 * @param absolute - Absolute module path.
 * @param signature - Current stat signature of the module.
 * @param newestNs - Newest mtime/ctime of the module in nanoseconds.
 * @returns The record when it is current and outside the racy window, otherwise null.
 */
async function readSpecifiers(
  folder: string,
  environmentKey: string,
  absolute: string,
  signature: string,
  newestNs: bigint
): Promise<PersistedSpecifiers | null> {
  try {
    const value: unknown = JSON.parse(
      await fsp.readFile(specifierRecordPath(folder, environmentKey, absolute), 'utf8')
    );
    if (
      typeof value !== 'object' ||
      value === null ||
      (value as PersistedSpecifiers).schema !== 1 ||
      (value as PersistedSpecifiers).signature !== signature ||
      !Array.isArray((value as PersistedSpecifiers).specifiers) ||
      !(value as PersistedSpecifiers).specifiers.every((entry) => typeof entry === 'string') ||
      typeof (value as PersistedSpecifiers).unresolved !== 'boolean' ||
      typeof (value as PersistedSpecifiers).recordedAtNs !== 'string' ||
      !/^\d+$/.test((value as PersistedSpecifiers).recordedAtNs)
    )
      return null;
    const record = value as PersistedSpecifiers;
    return newestNs <= BigInt(record.recordedAtNs) - racyWindowNs ? record : null;
  } catch {
    return null;
  }
}

async function writeSpecifiers(folder: string, environmentKey: string, absolute: string, record: PersistedSpecifiers) {
  const file = specifierRecordPath(folder, environmentKey, absolute);
  const temporary = path.join(folder, `.${randomUUID()}.tmp`);
  try {
    await fsp.mkdir(folder, { recursive: true, mode: 0o700 });
    await fsp.writeFile(temporary, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    await fsp.rename(temporary, file);
  } catch {
    await fsp.rm(temporary, { force: true }).catch(() => undefined);
  }
}

/**
 * Discover transformed physical input edges without evaluating test modules; unsafe or unresolved inputs throw, and the enclosing runner may turn that failure into a cache miss.
 *
 * @param specification - Test module and current Vite project environment.
 * @param repositoryRoot - Repository root bounding local inputs.
 * @param options - Declared extra roots, opaque outputs, dynamic domains and phase observations.
 * @param options.roots - Extra original module roots; defaults to the test module.
 * @param options.opaqueImports - Generated outputs whose declared build inputs are fingerprinted instead.
 * @param options.dynamicImports - Declared dependency globs for nonliteral imports.
 * @param options.cache - Shared observations scoped to this fingerprint phase.
 * @param options.persist - Cross-process specifier records and the transform-environment key they are valid under.
 * @param options.persist.folder - Persistent specifier record folder.
 * @param options.persist.environmentKey - Digest of the transform environment the records are valid under.
 * @returns Sorted local files, external installed paths and declared dynamic-domain globs.
 * @throws For unsafe/unmapped/virtual input, unsupported environment, unresolved import or parse/transform failure.
 */
export async function collectInputGraph(
  specification: GraphSpecification,
  repositoryRoot: string,
  options: {
    roots?: string[];
    opaqueImports?: string[];
    dynamicImports?: Record<string, string[]>;
    cache?: WalkCache;
    persist?: { folder: string; environmentKey: string };
  } = {}
): Promise<InputGraph> {
  const root = await physicalPath(repositoryRoot);
  const opaqueImports = new Set<string>();
  for (const relative of options.opaqueImports ?? []) {
    if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
      throw new Error(`unsafe opaque test import: ${relative}`);
    }
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error(`unsafe opaque test import: ${relative}`);
    opaqueImports.add(absolute);
  }
  const environment = testEnvironment(specification);
  if (!environment?.transformRequest || !environment.moduleGraph) {
    throw new Error(`no Vite dependency graph for ${specification.moduleId}`);
  }
  let edgeCache = resolvedEdges.get(environment);
  if (!edgeCache) {
    edgeCache = new Map();
    resolvedEdges.set(environment, edgeCache);
  }
  let signatures = resolvedSignatures.get(environment);
  if (!signatures) {
    signatures = new Map();
    resolvedSignatures.set(environment, signatures);
  }
  const opaqueKey = [...opaqueImports].sort().join('\0');
  const dynamicImportDeclarations = options.dynamicImports ?? {};
  const cache = options.cache ?? createWalkCache();
  const roots = options.roots ?? [specification.moduleId];
  const pending = roots.map((entry) => (path.isAbsolute(entry) ? entry : path.resolve(root, entry)));
  const files = new Set<string>();
  // A file reached as a leaf and also as a module must still have its module
  // edges walked, so inputs and walked modules are tracked separately.
  const walked = new Set<string>();
  const externalPaths = new Set<string>();
  const declared = new Set<string>();
  // Visit the import graph one frontier at a time: modules in a frontier transform and resolve
  // concurrently, while the membership checks below run synchronously between awaits.
  const visit = async (id: string): Promise<string[]> => {
    const relative = await localFile(root, id, externalPaths, cache.classify);
    if (relative === null) return [];
    files.add(relative);
    if (leafRequest(id, relative) || walked.has(relative)) return [];
    walked.add(relative);
    const absolute = path.join(root, relative);
    // A changed file signature makes a cached transform stale even under the
    // same edgeKey history; invalidate it in the environment before re-reading.
    const signature = await cachedStatSignature(absolute, cache.signature);
    if (signatures.get(absolute) !== signature) {
      signatures.set(absolute, signature);
      const modules = environment.moduleGraph.getModulesByFile?.(absolute);
      if (modules) {
        for (const mod of modules) environment.moduleGraph.invalidateModule?.(mod);
      }
    }
    const edgeKey = `${opaqueKey}\0${absolute}\0${signature}`;
    let edges = edgeCache.get(edgeKey);
    if (!edges) {
      edges = (async () => {
        const [, , mtime = '0', ctime = '0'] = signature.split(':');
        const newest = BigInt(mtime) > BigInt(ctime) ? BigInt(mtime) : BigInt(ctime);
        const persisted = options.persist
          ? await readSpecifiers(options.persist.folder, options.persist.environmentKey, absolute, signature, newest)
          : null;
        let specifiers: string[];
        let unresolved: boolean;
        if (persisted) {
          specifiers = persisted.specifiers;
          unresolved = persisted.unresolved;
        } else {
          const transformed = await environment.transformRequest(absolute);
          if (!transformed) throw new Error(`cannot transform test dependency: ${relative}`);
          let tree: ReturnType<typeof parseAst>;
          try {
            tree = parseAst(transformed.code);
          } catch (error) {
            throw new Error(`cannot parse transformed dependency ${relative}: ${errorMessage(error)}`);
          }
          const found = moduleEdges(tree);
          unresolved = found.unresolved;
          specifiers = [...(transformed.deps ?? []), ...(transformed.dynamicDeps ?? []), ...found.imports];
          if (options.persist) {
            await writeSpecifiers(options.persist.folder, options.persist.environmentKey, absolute, {
              schema: 1,
              signature,
              recordedAtNs: String(BigInt(Date.now()) * 1_000_000n),
              specifiers,
              unresolved
            });
          }
        }
        const declaredGlobs: string[] = [];
        if (unresolved) {
          const globs = dynamicImportDeclarations[relative];
          if (!globs) {
            throw new Error(
              `unresolved dynamic import in ${relative}; declare its dependency domain in dynamicImports`
            );
          }
          declaredGlobs.push(...globs);
        }
        const dependencies = await Promise.all(
          specifiers.map((imported) => resolveImport(environment, imported, absolute, opaqueImports))
        );
        return { dependencies, declaredGlobs };
      })();
      edgeCache.set(edgeKey, edges);
    }
    const result = await edges;
    for (const glob of result.declaredGlobs) declared.add(glob);
    return result.dependencies.filter((dependency): dependency is string => Boolean(dependency));
  };
  let frontier = pending;
  while (frontier.length) frontier = (await Promise.all(frontier.map(visit))).flat();
  return { files: [...files].sort(), externalPaths: [...externalPaths].sort(), declared: [...declared].sort() };
}
