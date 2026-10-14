/**
 * Plan content-cache reuse and publish passing records only after teardown acceptance.
 *
 * @summary Plan content-cache reuse and publish passing records only after teardown acceptance.
 */
import { execFileSync } from 'node:child_process';
import { hash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Reporter, TestModule, TestProject, TestRunEndReason, TestSpecification, Vitest } from 'vitest/node';
import { BaseSequencer, parseCLI, version as vitestVersion } from 'vitest/node';
import type { CacheContract, HostImportAlias, Scoped } from './contract.ts';
import type { TreeSnapshot } from './digest-store.ts';
import { DigestStore } from './digest-store.ts';
import { keyedEnvironment, nodeLoaderPolicy } from './environment.ts';
import { errnoCode, errorMessage } from './errors.ts';
import { FingerprintPhase, inputsDigest } from './fingerprint.ts';
import {
  collectHostGraph,
  createResolutionCache,
  type ResolutionCache,
  resolutionInputsForFile
} from './host-graph.ts';
import type { InputGraph, WalkCache } from './input-graph.ts';
import { collectInputGraph, createWalkCache } from './input-graph.ts';
import type { KeyEntry } from './key-change.ts';
import { COMPONENTS, describeKeyChange } from './key-change.ts';
import { acquireTestLock } from './lock.ts';
import type { Plan } from './plan.ts';
import { publishPlan } from './plan.ts';
import type { Components, StagedRecord } from './publication.ts';
import { commitRecords, readIndex, readRecord, revokeRecord, writeStage } from './publication.ts';
import { compareByDeclaredRank, declaredRank } from './sequence.ts';
import { sharedCacheFolder } from './shared-digest-root.ts';

export { validateContract } from './contract.ts';
export { environmentValue, stripSessionEnvironment } from './environment.ts';
export { commitStage } from './publication.ts';
export { validateSequence, verifySequence } from './sequence.ts';

/** Current run reuse/publication eligibility; forced execution may publish, unsupported diagnostic modes may do neither. */
export type Policy =
  | { reuse: true; publish: true; reason: null; toolchain: string[] }
  | { reuse: false; publish: boolean; reason: string; toolchain: string[] };
/** Explicit dynamic/opaque graph declarations and current phase observation maps. */
export type GraphOptions = { dynamicImports: Record<string, string[]>; opaqueImports: string[]; cache: WalkCache };
/** Original configured Vitest run cache journal for planned/executed identities, staged positive records, diagnostic counters and teardown veto. */
export type Session = {
  ctx: Vitest;
  top: string;
  folder: string;
  /** Directory of the digest store, under the run folder; it holds digest records and is not itself a digest. */
  digestFolder: string;
  treeSnapshots: Map<string, TreeSnapshot>;
  invocation: string;
  policy: Policy;
  selection: Map<string, string[]>;
  planned: Map<string, { hit: boolean }>;
  plannedProjects: Set<string>;
  executed: Map<string, { specification: TestSpecification; entry: KeyEntry }>;
  misses: Map<string, string>;
  uncacheableIdentities: Set<string>;
  stage: StagedRecord[] | null;
  veto: string | null;
  cached: number;
  cachedTests: number;
  uncacheable: number;
  fingerprintMs: number;
  filesRead: number;
};
/** Observable pool runner coverage and settled worker failure inventory required before cache publication. */
export type WorkerTeardownLedger = {
  /**
   * Check observable custom pool-runner coverage.
   * @param project - Original configured Vitest project.
   * @returns Whether its current runner is tracked or needs no custom ledger.
   */
  covers(project: TestProject): boolean;
  /**
   * Wait for the original started-worker sweep to settle.
   * @returns Recorded teardown failure inventory; an empty list is accepted only for covered runners.
   */
  settled(): Promise<{ failures: unknown[] }>;
  /**
   * Describe started workers whose stop has not completed successfully.
   * @returns Original project/worker/stage descriptions for timeout diagnostics.
   */
  pending(): string[];
};

const sessions = new WeakMap<Vitest, Session>();

const TEARDOWN = Symbol.for('goodfoot.vitest-cache.teardown');
/** Pool-worker teardown ledger installed by `test-worker-teardown.mjs`. */
const WORKER_TEARDOWN = Symbol.for('goodfoot.vitest.worker-teardown');
/** Set by a wrapping command that verifies output after Vitest exits; it commits the stage itself. */
const ACK_VARIABLE = 'GOODFOOT_VITEST_CACHE_ACK';
/** This package's source directory. Every run's key covers its contents. */
const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
/** The diagnostic reporter that `withTestOutput` appends to every configuration. */
const OUTPUT_REPORTER = path.join(SOURCE_DIRECTORY, 'test-output-reporter.mjs');
/** Modules every run loads on the host: the configuration policy, reporter, and output capture. */
const BASELINE_HOST_ROOTS = [
  path.join(SOURCE_DIRECTORY, 'test-output-policy.mjs'),
  OUTPUT_REPORTER,
  path.join(SOURCE_DIRECTORY, 'test-output-capture.mjs')
];
/** Parsed CLI options that choose files, projects, or output, not how a selected test executes. */
const NONSEMANTIC_OPTIONS = new Set([
  '--',
  'run',
  'watch',
  'project',
  'shard',
  'changed',
  'related',
  'bail',
  't',
  'testNamePattern',
  'color',
  'silent',
  'hideSkippedTests',
  'logHeapUsage',
  'printConsoleTrace',
  'passWithNoTests',
  'config',
  'root',
  'dir'
]);
const CONSOLE_REPORTERS = new Set(['default', 'dot', 'verbose', 'tree', 'basic', 'agent', 'minimal']);
const ENVIRONMENT_PACKAGES: Record<string, string | undefined> = {
  jsdom: 'jsdom',
  'happy-dom': 'happy-dom',
  'edge-runtime': '@edge-runtime/vm'
};
function digest(value: string) {
  return hash('sha256', value, 'hex');
}

function git(root: string, ...args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function repository(root: string) {
  const top = fs.realpathSync.native(git(root, 'rev-parse', '--show-toplevel'));
  const common = fs.realpathSync.native(path.resolve(root, git(root, 'rev-parse', '--git-common-dir')));
  return { top, common };
}

function relativeInput(top: string, filename: string, allowRoot: boolean = false) {
  const absolute = path.isAbsolute(filename) ? filename : path.resolve(top, filename);
  // Vitest may retain a symlink spelling of the worktree root. Compare the
  // physical paths so aliases share identities and external targets fail closed.
  const relative = path.relative(top, fs.realpathSync.native(absolute));
  if (
    (!relative && !allowRoot) ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`test input outside repository: ${filename}`);
  }
  return relative.split(path.sep).join('/');
}

function identityOf(projectName: string, relative: string) {
  return `${projectName}\0${relative}`;
}

function describe(identity: string) {
  const [project, file] = identity.split('\0');
  return project ? `${project} ${file}` : file;
}

/**
 * A project's declared execution order (see `sequence.ts`), or `null` when it has none.
 *
 * @param project - Current Vitest project.
 * @returns Declared normalized rank map or null when absent.
 */
function projectSequence(project: TestProject) {
  const declared = project.config.provide?.goodfootTestSequence;
  return declared ? declaredRank(declared) : null;
}

/**
 * Vitest's `BaseSequencer.sort`, except that files lacking recorded duration history are ordered by the project's declared sequence, when it has one, instead of by file size.
 *
 * @param ctx - Current Vitest context and recorded result history.
 * @param top - Repository root needed for declared ordering, or null.
 * @param specifications - Original selected test specifications.
 * @returns Copy ordered by group/project/isolation, actual recorded results, declared fallback then file size.
 */
function orderSpecifications(ctx: Vitest, top: string | null, specifications: TestSpecification[]) {
  const cache = ctx.cache;
  const results = new Map(
    specifications.map((specification) => [specification, cache.getTestSpecificationResult(specification)])
  );
  const sizes = new Map<string, number | undefined>();
  const sizeOf = (moduleId: string) => {
    if (!sizes.has(moduleId)) {
      try {
        sizes.set(moduleId, fs.statSync(moduleId).size);
      } catch (error) {
        const code = errnoCode(error);
        if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
        sizes.set(moduleId, undefined);
      }
    }
    return sizes.get(moduleId);
  };
  const ranks = new Map<TestProject, Map<string, number> | null>();
  const rankFor = (project: TestProject) => {
    let rank = ranks.get(project);
    if (rank === undefined) {
      rank = projectSequence(project);
      ranks.set(project, rank);
    }
    return rank;
  };
  return [...specifications].sort((a, b) => {
    const groupOrderDiff = a.project.config.sequence.groupOrder - b.project.config.sequence.groupOrder;
    if (groupOrderDiff !== 0) return groupOrderDiff;
    if (a.project.name !== b.project.name) return a.project.name < b.project.name ? -1 : 1;
    if (a.project.config.isolate && !b.project.config.isolate) return -1;
    if (!a.project.config.isolate && b.project.config.isolate) return 1;
    const aState = results.get(a);
    const bState = results.get(b);
    if (aState && bState) {
      if (aState.failed && !bState.failed) return -1;
      if (!aState.failed && bState.failed) return 1;
      return bState.duration - aState.duration;
    }
    const rank = rankFor(a.project);
    if (rank && !top) throw new Error('a declared test sequence needs the repository root');
    if (rank && top) return compareByDeclaredRank(rank, relativeInput(top, a.moduleId), relativeInput(top, b.moduleId));
    const sizeA = sizeOf(a.moduleId);
    const sizeB = sizeOf(b.moduleId);
    if (sizeA === undefined || sizeB === undefined)
      return sizeA === undefined && sizeB !== undefined ? -1 : sizeB === undefined && sizeA !== undefined ? 1 : 0;
    return sizeB - sizeA;
  });
}

/**
 * The cached contract of `project`; an uncached suite has no key.
 *
 * @param project - Current Vitest project.
 * @returns Cached suite input contract.
 * @throws For missing or explicitly uncached declaration.
 */
function contractOf(project: TestProject): CacheContract {
  const contract = project.config.provide?.goodfootCacheInputs;
  if (!contract || typeof contract !== 'object')
    throw new Error(`project ${project.name || '<root>'} has no cache contract`);
  if ('uncached' in contract) throw new Error(`suite is uncached: ${contract.uncached}`);
  return contract;
}

function uncachedReason(specifications: TestSpecification[]) {
  for (const project of new Set(specifications.map((specification) => specification.project))) {
    const contract = project.config.provide?.goodfootCacheInputs;
    if (!contract) return `project ${project.name || '<root>'} has no cache contract`;
    if ('uncached' in contract) return contract.uncached;
  }
  return null;
}

function reporterAllowed(reporter: Vitest['config']['reporters'][number]) {
  const name = Array.isArray(reporter) ? reporter[0] : reporter;
  if (name instanceof ContentCacheReporter) return true;
  if (typeof name === 'string') return CONSOLE_REPORTERS.has(name) || name === OUTPUT_REPORTER;
  return false;
}

/**
 * Reuse and publication policy for this process. Forced runs execute every selected file and still publish; diagnostic, instrumented and alternate modes neither reuse nor publish.
 *
 * @param ctx - Current Vitest CLI/configuration context.
 * @returns Reuse/publication policy: forced executes but may publish, diagnostic/instrumented/alternate modes do neither.
 */
function eligibility(ctx: Vitest): Policy {
  const off = (reason: string): Policy => ({ reuse: false, publish: false, reason, toolchain: [] });
  if (process.env.DISABLE_TEST_CACHE === 'true') return off('DISABLE_TEST_CACHE=true');
  if (process.env.GOODFOOT_TEST_VERBOSE === '1') return off('verbose diagnostics');
  const force = process.env.GOODFOOT_VITEST_FORCE;
  if (force !== undefined && force !== '' && force !== '0' && force !== '1')
    return off('GOODFOOT_VITEST_FORCE must be 0 or 1');
  const config = ctx.config;
  if (config.watch) return off('watch mode');
  if (config.coverage?.enabled) return off('coverage');
  if (config.update) return off('snapshot update');
  if (config.inspect || config.inspectBrk) return off('inspector');
  if (config.ui || config.browser?.enabled || config.standalone || config.mergeReports) return off('alternate mode');
  if (config.typecheck?.enabled) return off('typecheck mode');
  if (config.outputFile) return off('reporter output file');
  if (!config.reporters.every(reporterAllowed)) return off('custom reporter');
  if (
    process.argv.some((arg) =>
      /^--(?:inspect|reporter|outputFile|mergeReports|clearCache|help|version|ui|api|browser)(?:[.=]|$)/.test(arg)
    )
  )
    return off('diagnostic command-line mode');
  const loaders = nodeLoaderPolicy();
  if ('reason' in loaders) return off(loaders.reason);
  if (force === '1') return { reuse: false, publish: true, reason: 'forced', toolchain: loaders.toolchain };
  return { reuse: true, publish: true, reason: null, toolchain: loaders.toolchain };
}

function normalizedOptions(top: string) {
  const { options } = parseCLI(['vitest', ...process.argv.slice(2)]);
  const relative: (value: unknown) => unknown = (value): unknown =>
    typeof value === 'string' ? value.replaceAll(top, '<repo>') : Array.isArray(value) ? value.map(relative) : value;
  return Object.fromEntries(
    Object.entries(options)
      .filter(([name]) => !NONSEMANTIC_OPTIONS.has(name))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, value]) => [name, relative(value)])
  );
}

function createSession(ctx: Vitest, policy: Policy): Session {
  const { top, common } = repository(ctx.config.root);
  const folder = sharedCacheFolder(common);
  const rootConfig = ctx.vite?.config?.configFile ?? ctx.config.config;
  const invocation = digest(
    JSON.stringify({
      node: process.version,
      vitest: vitestVersion,
      platform: process.platform,
      arch: process.arch,
      execArgv: process.execArgv.map((arg) => arg.replaceAll(top, '<repo>')),
      options: normalizedOptions(top),
      config: typeof rootConfig === 'string' ? relativeInput(top, rootConfig) : null,
      root: relativeInput(top, ctx.config.root, true),
      env: keyedEnvironment(process.env, top)
    })
  );
  return {
    ctx,
    top,
    folder,
    digestFolder: path.join(folder, 'digests'),
    treeSnapshots: new Map(),
    invocation,
    policy,
    selection: new Map(),
    planned: new Map(),
    plannedProjects: new Set(),
    executed: new Map(),
    misses: new Map(),
    uncacheableIdentities: new Set(),
    stage: null,
    veto: null,
    cached: 0,
    cachedTests: 0,
    uncacheable: 0,
    fingerprintMs: 0,
    filesRead: 0
  };
}

/** One fingerprinting pass. Fresh phases reobserve graph/stat inputs; DigestStore may reuse stat-validated byte digests, so not every file is physically reread. */
class Phase {
  readonly session: Session;
  readonly fingerprint: FingerprintPhase;
  readonly hostGraphs = new Map<string, Promise<InputGraph>>();
  readonly setupGraphs = new Map<TestProject, Promise<InputGraph>>();
  readonly resolution = new Map<string, string[]>();
  // Fresh phase observations shared by keyed files: classification, signature
  // and nearest-file lookups reuse their specific memo entries. Separate host,
  // input and digest operations may still stat the same physical path.
  readonly walkCache = createWalkCache();
  readonly resolutionCache: ResolutionCache;
  readonly started = performance.now();

  constructor(session: Session) {
    this.session = session;
    // A fresh store per phase: its stat memo must not carry across phases.
    this.fingerprint = new FingerprintPhase(session.top, {
      store: new DigestStore(session.digestFolder, { treeSnapshots: session.treeSnapshots })
    });
    this.resolutionCache = createResolutionCache(session.top);
  }

  hostGraph(roots: string[], dynamicImports: Record<string, string[]>, importAliases: HostImportAlias[]) {
    const key = `${[...new Set(roots)].sort().join('\0')}\0${JSON.stringify(importAliases)}`;
    let graph = this.hostGraphs.get(key);
    if (!graph) {
      graph = collectHostGraph(this.session.top, [...new Set(roots)].sort(), { dynamicImports, importAliases });
      this.hostGraphs.set(key, graph);
    }
    return graph;
  }

  setupGraph(specification: TestSpecification, graphOptions: GraphOptions) {
    const project = specification.project;
    let graph = this.setupGraphs.get(project);
    if (!graph) {
      const roots = project.config.setupFiles ?? [];
      graph = roots.length
        ? collectInputGraph(specification, this.session.top, { ...graphOptions, roots })
        : Promise.resolve({ files: [], externalPaths: [], declared: [] });
      this.setupGraphs.set(project, graph);
    }
    return graph;
  }

  resolutionInputs(files: string[]) {
    const inputs = new Set<string>();
    for (const file of files) {
      let entries = this.resolution.get(file);
      if (!entries) {
        entries = resolutionInputsForFile(this.resolutionCache, file);
        this.resolution.set(file, entries);
      }
      for (const entry of entries) inputs.add(entry);
    }
    return [...inputs];
  }

  finish() {
    this.session.fingerprintMs += performance.now() - this.started;
    this.session.filesRead += this.fingerprint.stats.filesRead;
  }
}

function isCloudflare(specification: TestSpecification) {
  return (
    specification.pool?.includes('cloudflare') ||
    specification.project.vite.config.plugins.some((plugin) => plugin?.name === '@cloudflare/vitest-plugin')
  );
}

function environmentPackages(project: TestProject, moduleId: string) {
  const names = new Set([project.config.environment]);
  const source = fs.readFileSync(moduleId, 'utf8');
  for (const match of source.matchAll(/@vitest-environment\s+([\w-]+)/g)) {
    const environment = match[1];
    if (environment !== undefined) names.add(environment);
  }
  return [...names].map((name) => ENVIRONMENT_PACKAGES[name]).filter((name): name is string => name !== undefined);
}

function globalSetups(ctx: Vitest, project: TestProject) {
  return [...(ctx.getRootProject().config.globalSetup ?? []), ...(project.config.globalSetup ?? [])];
}

/**
 * Non-isolated projects share module and global state between files. Unless the project declares a per-file hygiene gate that is one of its setup files, a file's result is keyed by the complete selection it ran with.
 *
 * @param session - Current cache session.
 * @param specifications - Exact selected test specifications.
 * @returns Sorted nonisolated co-selection map unless declared setup hygiene applies.
 */
function selectionFor(session: Session, specifications: TestSpecification[]) {
  const selection = new Map<string, string[]>();
  for (const specification of specifications) {
    const project = specification.project;
    if (project.config.isolate !== false) continue;
    const hygiene = contractOf(project).sharedStateHygiene?.[project.name];
    const setups = (project.config.setupFiles ?? []).map((file) => relativeInput(session.top, file));
    if (hygiene && setups.includes(hygiene)) continue;
    let files = selection.get(project.name);
    if (!files) {
      files = [];
      selection.set(project.name, files);
    }
    files.push(relativeInput(session.top, specification.moduleId));
  }
  for (const files of selection.values()) files.sort();
  return selection;
}

async function keyFor(phase: Phase, specification: TestSpecification): Promise<KeyEntry> {
  const session = phase.session;
  const { ctx, top } = session;
  const project = specification.project;
  const relative = relativeInput(top, specification.moduleId);
  const contract = contractOf(project);
  const pick = (scope: Scoped | undefined) => [
    ...(scope?.all ?? []),
    ...(scope?.projects?.[project.name] ?? []),
    ...(scope?.files?.[relative] ?? [])
  ];
  const fileInputs =
    contract.files && Object.hasOwn(contract.files, relative) ? contract.files[relative] : contract.fallback;
  if (!Array.isArray(fileInputs))
    throw new Error(`${relative} is not in the cache contract and the suite declares no fallback`);
  const declared = [
    `${relativeInput(top, SOURCE_DIRECTORY)}/**`,
    `${relativeInput(top, path.join(SOURCE_DIRECTORY, '..', 'native'))}/**`,
    relativeInput(top, path.join(SOURCE_DIRECTORY, '..', 'scripts', 'install-native.mjs')),
    relativeInput(top, path.join(SOURCE_DIRECTORY, '..', 'build', 'Release', 'metadata.node')),
    ...(contract.all ?? []),
    ...(contract.projects?.[project.name] ?? []),
    ...fileInputs
  ];
  const wrangler = pick(contract.wrangler);
  if (isCloudflare(specification) && !wrangler.length)
    throw new Error(`Cloudflare project ${project.name || '<root>'} declares no wrangler configuration`);
  for (const file of wrangler) {
    const directory = path.posix.dirname(file);
    declared.push(file, `${directory}/.dev.vars*`, `${directory}/.env*`);
  }
  const dynamicImports = contract.dynamicImports ?? {};

  // Host-side modules: runner configuration, its build-time dependencies,
  // global setup, and auxiliary bundles.
  const externals: string[] = [];
  const hostRoots = [...BASELINE_HOST_ROOTS, ...globalSetups(ctx, project), ...pick(contract.hostRoots)];
  for (const file of [ctx.vite?.config?.configFile ?? ctx.config.config, project.vite.config.configFile]) {
    if (typeof file === 'string') hostRoots.push(file);
  }
  for (const file of [
    ...(ctx.vite?.config?.configFileDependencies ?? []),
    ...(project.vite.config.configFileDependencies ?? [])
  ]) {
    const real = fs.realpathSync.native(file);
    if (real.split(path.sep).includes('node_modules')) externals.push(real);
    else hostRoots.push(real);
  }
  const host = await phase.hostGraph(
    hostRoots.map((file) => relativeInput(top, file)),
    dynamicImports,
    contract.hostImportAliases ?? []
  );
  const graphOptions: GraphOptions = {
    dynamicImports,
    opaqueImports: contract.opaqueImports ?? [],
    cache: phase.walkCache
  };
  const setup = await phase.setupGraph(specification, graphOptions);
  const test = await collectInputGraph(specification, top, {
    ...graphOptions,
    roots: [specification.moduleId, ...pick(contract.roots).map((file) => path.join(top, file))]
  });
  const files = [...new Set([...host.files, ...setup.files, ...test.files])].sort();
  declared.push(...host.declared, ...setup.declared, ...test.declared, ...phase.resolutionInputs(files));

  const toolchain = new Set(['vitest', 'vite', ...session.policy.toolchain, ...pick(contract.toolchain)]);
  if (isCloudflare(specification)) toolchain.add('@cloudflare/vitest-plugin');
  for (const name of environmentPackages(project, specification.moduleId)) toolchain.add(name);
  const executables = pick(contract.executables);
  const pattern = specification.testNamePattern ?? project.config.testNamePattern;
  const execution = {
    project: project.name,
    root: relativeInput(top, project.config.root, true),
    file: relative,
    pool: specification.pool,
    isolate: project.config.isolate,
    // Match Vitest's worker serialization without reopening framework env files.
    env: Object.entries({ ...project.vite.config.env, ...project.config.env }).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0
    ),
    // A positional file filter yields `[]`; only listed lines narrow the run.
    lines: specification.testLines?.length ? specification.testLines : null,
    name: pattern ? [pattern.source ?? String(pattern), pattern.flags ?? ''] : null,
    ids: specification.testIds?.length ? specification.testIds : null,
    tags: specification.testTagsFilter?.length ? specification.testTagsFilter : null,
    selection: session.selection.get(project.name) ?? null
  };
  const declarations = [...new Set(declared)].sort();
  const inputs = phase.fingerprint.inputDigests(files, declarations);
  const components: Components = {
    invocation: session.invocation,
    execution: digest(JSON.stringify(execution)),
    inputs: inputsDigest(inputs, declarations),
    packages: await phase.fingerprint
      .packages()
      .closure(
        [...externals, ...host.externalPaths, ...setup.externalPaths, ...test.externalPaths],
        [...toolchain].sort(),
        project.config.root
      ),
    executables: executables.length ? phase.fingerprint.executablesDigest(executables) : null
  };
  return {
    key: digest(JSON.stringify(COMPONENTS.map((name) => components[name]))),
    identity: identityOf(project.name, relative),
    components,
    inputs
  };
}

function missReason(session: Session, entry: KeyEntry) {
  if (!session.policy.reuse) return session.policy.reason;
  const previous = readIndex(session.folder, entry.identity);
  if (!previous) return 'new';
  const changed = COMPONENTS.filter((name) => previous[name] !== entry.components[name]);
  return changed.length ? changed.join('+') : 'unrecorded';
}

async function shardOf(ctx: Vitest, specifications: TestSpecification[]) {
  if (!ctx.config.shard) return specifications;
  return new BaseSequencer(ctx).shard([...specifications]);
}

/** Preserve suite ordering while omitting verified passing content hits and retaining all uncacheable selected files. */
export class ContentCacheSequencer extends BaseSequencer {
  /**
   * Fingerprint after setup and return only cache misses while retaining original order and selected identities.
   *
   * @param specifications - Selected original Vitest specifications.
   * @returns Ordered pending test files; reused passing files are excluded.
   */
  async sort(specifications: TestSpecification[]) {
    const session = sessions.get(this.ctx);
    // Without a session (caching disabled) the repository root is resolved
    // here, and only when a project declares a sequence.
    let top = session?.top ?? null;
    if (!top && specifications.some((specification) => projectSequence(specification.project)))
      top = repository(this.ctx.config.root).top;
    const sorted = orderSpecifications(this.ctx, top, specifications);
    if (!session) return sorted;
    // Global setup has run. Re-fingerprint so a hit reflects the state tests
    // would observe; the pre-setup decision only chose which setups to run.
    const phase = new Phase(session);
    session.selection = selectionFor(session, sorted);
    const pending: TestSpecification[] = [];
    try {
      for (const specification of sorted) {
        const identity = identityOf(specification.project.name, relativeInput(session.top, specification.moduleId));
        let entry: KeyEntry;
        try {
          entry = await keyFor(phase, specification);
        } catch (error) {
          console.warn(`vitest cache: ${errorMessage(error)}; running ${describe(identity)} without a reusable result`);
          session.uncacheable++;
          session.uncacheableIdentities.add(identity);
          pending.push(specification);
          continue;
        }
        const record = session.policy.reuse ? readRecord(session.folder, entry.key) : null;
        if (record) {
          session.cached++;
          session.cachedTests += record.tests;
          continue;
        }
        const planned = session.planned.get(identity);
        if (planned?.hit) {
          const project = specification.project.name;
          console.warn(
            `vitest cache: ${relativeInput(session.top, specification.moduleId)} changed after the setup decision${session.plannedProjects.has(project) ? '' : `; project ${project || '<root>'} skipped its global setup`}`
          );
        }
        if (!session.misses.has(identity)) session.misses.set(identity, missReason(session, entry));
        session.executed.set(identity, { specification, entry });
        pending.push(specification);
      }
    } finally {
      phase.finish();
    }
    if (pending.length === 0 && session.cached > 0) {
      // Vitest's own no-test-files message follows immediately after this
      // print, and reads as if nothing ran at all. Say why before it does.
      console.log(
        `vitest cache: every declared file was reused (${session.cached} file(s), ${session.cachedTests} passing test(s)); nothing needs to execute this run`
      );
      this.ctx.config.passWithNoTests = true;
    }
    return pending;
  }
}

/** Plan and stage per-file content results; publish only after original output/global/pool teardown acceptance. */
export class ContentCacheReporter implements Reporter {
  ctx: Vitest | undefined = undefined;
  lock: ReturnType<typeof acquireTestLock> | undefined = undefined;

  /**
   * The Vitest instance from `onInit`; every other hook runs after it.
   *
   * @returns Original initialized Vitest context.
   * @throws When reporter is used before onInit.
   */
  get vitest() {
    if (!this.ctx) throw new Error('vitest cache reporter used before onInit');
    return this.ctx;
  }

  /**
   * Passing tests reused by this configured reporter's current selected run.
   *
   * @returns Passing assertion count reused by this configured reporter, or zero before initialization.
   */
  cachedPassingTests() {
    return this.ctx ? (sessions.get(this.ctx)?.cachedTests ?? 0) : 0;
  }

  /**
   * Bind this reporter to the original Vitest context and close callback.
   *
   * @param ctx - Original configured Vitest context.
   */
  onInit(ctx: Vitest) {
    this.ctx = ctx;
    ctx.onClose(() => this.#close());
  }

  /**
   * Plan cache reuse before global setup, preserving unknown selection when fingerprinting is unavailable.
   *
   * @param specifications - Original selected test specifications.
   * @throws For lock/discovery failures not handled by cache-miss paths.
   */
  async onTestRunStart(specifications: readonly TestSpecification[]) {
    const ctx = this.vitest;
    publishPlan(null);
    sessions.delete(ctx);
    if (!ctx.config.watch && !this.lock) this.lock = acquireTestLock(ctx.config.root);
    if (!specifications.length) return;
    const uncached = uncachedReason([...specifications]);
    if (uncached) return;
    const policy = eligibility(ctx);
    if (!policy.publish) {
      console.log(`vitest cache: not used (${policy.reason})`);
      return;
    }
    let session: Session;
    try {
      session = createSession(ctx, policy);
    } catch (error) {
      console.warn(`vitest cache: ${errorMessage(error)}; running without the cache`);
      return;
    }
    sessions.set(ctx, session);
    // Decide which projects need global setup before Vitest runs it.
    const selected = await shardOf(ctx, [...specifications]);
    session.selection = selectionFor(session, selected);
    const plan: Plan = { all: [], projects: new Map() };
    const phase = new Phase(session);
    try {
      for (const specification of selected) {
        const project = specification.project.name;
        let projectFiles = plan.projects.get(project);
        if (!projectFiles) {
          projectFiles = [];
          plan.projects.set(project, projectFiles);
        }
        const identity = identityOf(project, relativeInput(session.top, specification.moduleId));
        let hit = false;
        try {
          const entry = await keyFor(phase, specification);
          hit = Boolean(policy.reuse && readRecord(session.folder, entry.key));
          if (!hit) session.misses.set(identity, missReason(session, entry));
        } catch {
          // The sequencer phase reports the reason when it keys this file again.
          session.misses.set(identity, 'uncacheable');
        }
        session.planned.set(identity, { hit });
        if (!hit) {
          plan.all.push(specification.moduleId);
          projectFiles.push(specification.moduleId);
        }
      }
    } finally {
      phase.finish();
    }
    session.plannedProjects = new Set([...plan.projects].filter(([, files]) => files.length).map(([name]) => name));
    publishPlan(plan);
  }

  /**
   * Revalidate passing executed files and stage stable records; publication waits for complete accepted teardown.
   *
   * @param modules - Executed module outcomes.
   * @param errors - Unhandled run errors.
   * @param reason - Completed/interrupted run reason.
   */
  async onTestRunEnd(modules: readonly TestModule[], errors: readonly unknown[], reason: TestRunEndReason) {
    const session = sessions.get(this.vitest);
    if (!session) return;
    session.veto =
      reason === 'interrupted' ? 'the run was interrupted' : errors.length ? 'the run had unhandled errors' : null;
    const stage: StagedRecord[] = [];
    const phase = new Phase(session);
    try {
      for (const module of modules) {
        const identity = identityOf(module.project.name, relativeInput(session.top, module.moduleId));
        const executed = session.executed.get(identity);
        if (!executed) {
          // An uncacheable file was already reported at sort time.
          if (!session.uncacheableIdentities.has(identity)) {
            console.warn(`vitest cache: no sort-phase key for this identity; ${describe(identity)} not recorded`);
          }
          continue;
        }
        if (!module.ok()) {
          // A failure supersedes any earlier pass for the same key, including one a forced run bypassed.
          console.warn(`vitest cache: failed; ${describe(identity)} record revoked`);
          revokeRecord(session.folder, executed.entry.key);
          continue;
        }
        const tests = [...module.children.allTests('passed')].length;
        if (!tests) {
          console.warn(`vitest cache: no passing tests; ${describe(identity)} not recorded`);
          continue;
        }
        if (session.veto) continue;
        let fresh: KeyEntry;
        try {
          fresh = await keyFor(phase, executed.specification);
        } catch (error) {
          console.warn(`vitest cache: ${errorMessage(error)}; ${describe(identity)} not recorded`);
          continue;
        }
        if (fresh.key !== executed.entry.key) {
          console.warn(
            `vitest cache: inputs changed during the run (${describeKeyChange(executed.entry, fresh)}); ${describe(identity)} not recorded`
          );
          continue;
        }
        stage.push({ key: fresh.key, tests, identity, components: fresh.components });
      }
    } catch (error) {
      session.veto = `publication check failed: ${errorMessage(error)}`;
    } finally {
      phase.finish();
    }
    session.stage = stage;
    this.#guardTeardown(session);
    const misses = new Map<string, number>();
    for (const identity of session.executed.keys()) {
      const reason = session.misses.get(identity) ?? 'uncacheable';
      misses.set(reason, (misses.get(reason) ?? 0) + 1);
    }
    const missText = [...misses].map(([name, count]) => `${name} ${count}`).join(', ');
    console.log(
      `vitest cache: ${session.cached} file(s), ${session.cachedTests} passing test(s) reused; ${session.executed.size} file(s) executed${missText ? ` (miss: ${missText})` : ''}${session.uncacheable ? `; ${session.uncacheable} uncacheable file(s) executed` : ''}; fingerprint ${Math.round(session.fingerprintMs)} ms, ${session.filesRead} file reads`
    );
  }

  /**
   * Pool workers stop while Vitest closes, concurrently with this reporter's close callback, and Vitest only logs a worker that fails to stop. Wait for the teardown ledger to settle. A project with a custom pool runner that the ledger does not cover has no observable teardown outcome.
   *
   * @returns Explicit unobservable/failed worker teardown reason or null when covered teardown settles cleanly.
   */
  async #workerTeardownVeto() {
    const ctx = this.vitest as Vitest & { [WORKER_TEARDOWN]?: WorkerTeardownLedger };
    const custom = ctx.projects.filter((project) => project.config.poolRunner != null);
    if (!custom.length) return null;
    const ledger = ctx[WORKER_TEARDOWN];
    if (!ledger || custom.some((project) => !ledger.covers(project))) {
      return 'pool worker teardown outcome is not observable';
    }
    const { failures } = await ledger.settled();
    return failures.length ? 'pool worker teardown failed' : null;
  }

  /**
   * Record global teardown failures: Vitest logs them but does not fail the run. `_teardownGlobalSetup` is Vitest's internal teardown entry point.
   *
   * @param session - Current session receiving global teardown veto.
   */
  #guardTeardown(session: Session) {
    const ctx = this.vitest;
    const projects: Set<TestProject & { [TEARDOWN]?: boolean; _teardownGlobalSetup?: unknown }> = new Set([
      ...ctx.projects,
      ctx.getRootProject()
    ]);
    for (const project of projects) {
      if (project[TEARDOWN]) continue;
      const teardown = project._teardownGlobalSetup;
      if (typeof teardown !== 'function') {
        session.veto ??= 'global teardown outcome is not observable';
        continue;
      }
      project[TEARDOWN] = true;
      project._teardownGlobalSetup = async function guardedTeardown(this: unknown, ...args: unknown[]) {
        try {
          return await teardown.apply(this, args);
        } catch (error) {
          session.veto ??= 'global teardown failed';
          throw error;
        }
      };
    }
  }

  async #close() {
    try {
      const session = sessions.get(this.vitest);
      if (!session?.stage?.length) return;
      const workerVeto = await this.#workerTeardownVeto();
      if (workerVeto) session.veto ??= workerVeto;
      if (session.veto) {
        console.warn(`vitest cache: results not recorded because ${session.veto}`);
        return;
      }
      const acknowledgement = process.env[ACK_VARIABLE];
      if (acknowledgement) writeStage(acknowledgement, session.folder, session.stage);
      else commitRecords(session.folder, session.stage);
    } catch (error) {
      console.warn(`vitest cache: results not recorded: ${errorMessage(error)}`);
    } finally {
      this.lock?.release();
      this.lock = undefined;
    }
  }
}
