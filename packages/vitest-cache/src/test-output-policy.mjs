/**
 * Compose explicit cache, output and worker-teardown policy into Vitest configuration.
 *
 * @summary Compose explicit cache, output and worker-teardown policy into Vitest configuration.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types as nodeTypes } from 'node:util';
import {
  ContentCacheReporter,
  ContentCacheSequencer,
  stripSessionEnvironment,
  validateContract,
  validateSequence,
  verifySequence
} from './index.ts';
import { testVerbose } from './test-verbose.mjs';
import { workerTeardownPlugin } from './test-worker-teardown.mjs';

const reporterPath = fileURLToPath(new URL('./test-output-reporter.mjs', import.meta.url));
// The checkout (main worktree or linked worktree) that contains this package.
const repositoryRoot = realpathSync(
  execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dirname(reporterPath), encoding: 'utf8' }).trim()
);
// The install state this checkout's packages resolve against.
const installState = readFileSync(join(repositoryRoot, 'node_modules', '.yarn-state.yml'));
// Vitest keys its module cache metadata by the nearest install state above
// the Vitest working directory, and deletes the whole cache directory when
// that disagrees with the directory's metadata. Every run that shares a
// directory must therefore see the same install state: the directory is keyed
// by that state, and a run whose nearest install state differs (for example a
// checkout that resolves this package from another checkout) does not use the
// shared cache, so it can never delete a directory other runs are writing.
const installHash = createHash('sha256').update(installState).digest('hex').slice(0, 16);
/**
 * Find the install state Vitest's lockfile check reads for a working directory.
 * @param {string} directory - Vitest working directory.
 * @returns {Buffer | undefined} Nearest `node_modules/.yarn-state.yml` content, or undefined when none exists.
 */
function nearestInstallState(directory) {
  for (let current = directory; ; current = dirname(current)) {
    const candidate = join(current, 'node_modules', '.yarn-state.yml');
    if (existsSync(candidate)) return readFileSync(candidate);
    if (dirname(current) === current) return undefined;
  }
}
const workingInstallState = nearestInstallState(process.cwd());
const moduleCacheShared = workingInstallState?.equals(installState) === true;
const moduleCachePath = join(repositoryRoot, 'node_modules', '.experimental-vitest-cache', installHash);
mkdirSync(moduleCachePath, { recursive: true });

/**
 * Read a JSON cache contract. Keeping large per-file tables out of the runner configuration's module graph means editing one file's declaration changes only that file's selected inputs, not every file's configuration digest.
 *
 * @param url - JSON contract file URL.
 * @returns Validated object-form cached contract; explicitly uncached JSON refuses.
 * @throws For read/JSON/shape failures or uncached declaration.
 * @type {import('./test-output-policy.d.mts').CacheContractLoader}
 */
export const loadCacheContract = function loadCacheContract(url) {
  // Callers read fields before withTestOutput runs, so validate here to make the declared CacheContract true.
  const contract = validateContract(JSON.parse(readFileSync(url, 'utf8')));
  if ('uncached' in contract) throw new Error(`${url.href} must declare a cache contract, not { uncached }`);
  return contract;
};

/**
 * Read a suite's declared execution order (see `sequence.ts`): the repository-relative paths of its heaviest files, heaviest first. Kept out of the cache contract because it governs dispatch order, not cache keys.
 *
 * @param url - JSON declared sequence file URL.
 * @returns Parsed unknown JSON; withTestOutput later validates order shape and path existence.
 * @throws For file read or JSON parsing errors.
 * @type {import('./test-output-policy.d.mts').TestSequenceLoader}
 */
export const loadTestSequence = function loadTestSequence(url) {
  /** @type {unknown} */
  const sequence = JSON.parse(readFileSync(url, 'utf8'));
  return sequence;
};

/**
 * Bind an actual configured reporter's optional cache accessor across bundled module copies.
 * @param {unknown} reporter - Original configured reporter; arrays and names have no accessor.
 * @returns {(() => number) | undefined} Bound original count accessor when present.
 * @throws When a configured accessor returns a nonnumeric count.
 */
function passingTestAccessor(reporter) {
  if (
    !reporter ||
    Array.isArray(reporter) ||
    (typeof reporter !== 'object' && typeof reporter !== 'function') ||
    !('cachedPassingTests' in reporter)
  )
    return undefined;
  const accessor = reporter.cachedPassingTests;
  if (typeof accessor !== 'function') return undefined;
  return () => {
    /** @type {unknown} */
    const count = Reflect.apply(accessor, reporter, []);
    if (typeof count !== 'number') throw new TypeError('Cache passing-test accessor must return a number');
    return count;
  };
}

/**
 * Keep CLI-selected and machine-readable reporters; append the diagnostic guard.
 * @returns {import('vitest/config').Plugin} Original-context output guard plugin.
 */
function diagnosticPlugin() {
  return {
    name: 'goodfoot-test-output',
    configureVitest({ vitest }) {
      if (
        !vitest.config.reporters.some(
          (reporter) => reporter === reporterPath || (Array.isArray(reporter) && reporter[0] === reporterPath)
        )
      ) {
        // Config-path projects can import a separate copy of the cache module.
        // Bind the configured root instance rather than this plugin's imports.
        const producers = vitest.config.reporters.flatMap((reporter) => {
          const accessor = passingTestAccessor(reporter);
          return accessor === undefined ? [] : [accessor];
        });
        if (producers.length > 1) throw new Error('Test output policy requires at most one configured cache reporter');
        const producer = producers[0];
        // CLI reporter overrides can remove the cache reporter entirely. With
        // no producer, no cache session is created and no passing tests reused.
        const cachedPassingTests = producer ?? (() => 0);
        vitest.config.reporters.push([reporterPath, { cachedPassingTests }]);
      }
    }
  };
}

/**
 * Apply output policy to an already evaluated configuration object.
 * @overload
 * @param {import('vitest/config').ViteUserConfig} configuration - Original Vitest configuration object.
 * @param {Parameters<import('./test-output-policy.d.mts').TestOutputObjectPolicy>[1]} contract - Explicit cache inputs or sole uncached reason.
 * @param {Parameters<import('./test-output-policy.d.mts').TestOutputObjectPolicy>[2]} [sequence] - Declared suite order validated before use.
 * @returns {import('vitest/config').ViteUserConfig} Policy-bearing configuration object.
 */
/**
 * Await the original configuration factory before applying output policy.
 * @overload
 * @param {import('vitest/config').ViteUserConfigFn} configuration - Synchronous or asynchronous original factory.
 * @param {Parameters<import('./test-output-policy.d.mts').TestOutputFactoryPolicy>[1]} contract - Explicit cache inputs or sole uncached reason.
 * @param {Parameters<import('./test-output-policy.d.mts').TestOutputFactoryPolicy>[2]} [sequence] - Declared suite order validated before use.
 * @returns {import('vitest/config').ViteUserConfigFnPromise} Awaited factory returning the policy-bearing object.
 */
/**
 * Apply output defaults without changing runner, selection, or isolation. `contract` is required: a cache contract naming inputs read outside the import graph, or `{ uncached: reason }` for suites whose results depend on live or measured state. `sequence`, when given, is a suite's declared execution order (`loadTestSequence`); it only reorders dispatch among the suite's own files and never changes which files run or their results.
 *
 * @param {import('vitest/config').ViteUserConfig | import('vitest/config').ViteUserConfigFn} configuration - Object or original configuration factory.
 * @param {import('./contract.ts').CacheContract | import('./contract.ts').UncachedContract} contract - Explicit cached inputs or sole uncached reason.
 * @param {unknown} [sequence] - Optional unknown declared suite order, validated before use.
 * @returns {import('vitest/config').ViteUserConfig | import('vitest/config').ViteUserConfigFnPromise} Policy-bearing object or awaited factory.
 * @throws For invalid contract/order, stale sequence or invalid host setup.
 */
function applyTestOutput(configuration, contract, sequence) {
  validateContract(contract);
  const declaredSequence =
    sequence === undefined ? undefined : verifySequence(validateSequence(sequence), repositoryRoot);
  if (typeof configuration === 'function') {
    return async (environment) => withTestOutput(await configuration(environment), contract, sequence);
  }
  // Cached suites run with the environment their result key models.
  if (!('uncached' in contract)) stripSessionEnvironment(process.env);
  const verbose = testVerbose();
  /**
   * @param {import('vitest/config').ViteUserConfig} project - Original resolved root or inline project configuration.
   * @param {boolean} [ownPlugins] - Whether this configuration needs its own policy plugins.
   * @returns {import('vitest/config').ViteUserConfig} Configuration with the existing output/cache hooks.
   */
  const attach = (project, ownPlugins = true) => {
    const plugins = project.plugins;
    const test = project.test;
    const originalReporters = test?.reporters ?? ['default'];
    const reporters = Array.isArray(originalReporters) ? originalReporters : [originalReporters];
    return {
      ...project,
      plugins: [...(plugins ?? []), ...(ownPlugins ? [diagnosticPlugin(), workerTeardownPlugin()] : [])],
      test: {
        ...test,
        // Vitest's disk cache returns host file paths to the module runner.
        // Cloudflare's workerd pool cannot read those paths from its isolate.
        fsModuleCache:
          moduleCacheShared &&
          (test?.fsModuleCache ??
            !(plugins ?? []).some(
              (plugin) =>
                plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name === '@cloudflare/vitest-plugin'
            )),
        fsModuleCachePath: moduleCachePath,
        sequence: { ...test?.sequence, sequencer: ContentCacheSequencer },
        reporters: [...reporters, new ContentCacheReporter()],
        provide: {
          ...test?.provide,
          goodfootTestVerbose: verbose,
          goodfootNativeCapture: !verbose && Boolean(process.env.GOODFOOT_TEST_OUTPUT_RESULT),
          goodfootCacheInputs: contract,
          ...(declaredSequence !== undefined ? { goodfootTestSequence: declaredSequence } : {})
        }
      }
    };
  };
  const configured = attach(configuration);
  if (configured.test === undefined) throw new Error('Output policy did not attach the test configuration');
  configured.test.silent = verbose ? false : 'passed-only';
  if (configured.test.projects) {
    /**
     * @param {import('vitest/config').TestProjectInlineConfiguration} project - Resolved inline project.
     * @returns {import('vitest/config').ViteUserConfig} Policy configuration preserving declaring-config inheritance.
     */
    const attachInline = (project) => attach(project, project.extends === false || typeof project.extends === 'string');
    configured.test.projects = configured.test.projects.map((project) => {
      // Vitest awaits actual promised inline configurations. Attach only after
      // resolution so their test selection and plugins are retained.
      if (nodeTypes.isPromise(project)) return project.then(attachInline);
      return typeof project === 'object' && project !== null ? attachInline(project) : project;
    });
  }
  return configured;
}

/**
 * Publish the checked runtime implementation.
 * Runtime checking uses this installation’s Vitest types; the public declaration preserves the caller’s configuration across Yarn peer contexts.
 */
export const withTestOutput = applyTestOutput;
