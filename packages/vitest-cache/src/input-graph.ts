/**
 * Walk the transformed Vite input graph with phase-scoped observations.
 *
 * @summary Walk the transformed Vite input graph with phase-scoped observations.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseAst } from 'vite';
import type { TestProject } from 'vitest/node';
import { errorMessage } from './errors.ts';
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
 * realpathSync + repo-relative/external classification of `pathname`, memoized per phase.
 *
 * @param root - Physical repository root.
 * @param pathname - Path to observe.
 * @param cache - Phase-scoped classification observations.
 * @returns Installed external path, repository-relative file or outside-repository classification.
 * @throws On realpath failure.
 */
function classifyLocalFile(root: string, pathname: string, cache: Map<string, LocalClassification>) {
  let result = cache.get(pathname);
  if (result) return result;
  const file = fs.realpathSync(pathname);
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

function localFile(root: string, id: unknown, externalPaths: Set<string>, cache: Map<string, LocalClassification>) {
  if (typeof id !== 'string' || id.startsWith('\0') || id.startsWith('virtual:') || id.startsWith('/@id/')) {
    throw new Error(`untracked virtual test dependency: ${String(id)}`);
  }
  const pathname = id.replace(/[?#].*$/, '');
  if (!path.isAbsolute(pathname)) throw new Error(`unresolved test dependency: ${id}`);
  const result = classifyLocalFile(root, pathname, cache);
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
  if (imported.startsWith('node:') || cloudflareRuntimeModule(imported)) return null;
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

function statSignature(file: string) {
  const stat = fs.lstatSync(file, { bigint: true });
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
function cachedStatSignature(file: string, cache: Map<string, string>) {
  let signature = cache.get(file);
  if (signature === undefined) {
    signature = statSignature(file);
    cache.set(file, signature);
  }
  return signature;
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
  } = {}
): Promise<InputGraph> {
  const root = fs.realpathSync(repositoryRoot);
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
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const relative = localFile(root, id, externalPaths, cache.classify);
    if (relative === null) continue;
    files.add(relative);
    if (leafRequest(id, relative) || walked.has(relative)) continue;
    walked.add(relative);
    const absolute = path.join(root, relative);
    // A changed file signature makes a cached transform stale even under the
    // same edgeKey history; invalidate it in the environment before re-reading.
    const signature = cachedStatSignature(absolute, cache.signature);
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
        const transformed = await environment.transformRequest(absolute);
        if (!transformed) throw new Error(`cannot transform test dependency: ${relative}`);
        let tree: ReturnType<typeof parseAst>;
        try {
          tree = parseAst(transformed.code);
        } catch (error) {
          throw new Error(`cannot parse transformed dependency ${relative}: ${errorMessage(error)}`);
        }
        const { imports: dynamic, unresolved } = moduleEdges(tree);
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
          [...(transformed.deps ?? []), ...(transformed.dynamicDeps ?? []), ...dynamic].map((imported) =>
            resolveImport(environment, imported, absolute, opaqueImports)
          )
        );
        return { dependencies, declaredGlobs };
      })();
      edgeCache.set(edgeKey, edges);
    }
    const result = await edges;
    for (const dependency of result.dependencies) {
      if (dependency) pending.push(dependency);
    }
    for (const glob of result.declaredGlobs) declared.add(glob);
  }
  return { files: [...files].sort(), externalPaths: [...externalPaths].sort(), declared: [...declared].sort() };
}
