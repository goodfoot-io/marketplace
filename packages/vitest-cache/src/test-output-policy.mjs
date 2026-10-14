/**
 * Compose explicit cache, output and worker-teardown policy into Vitest configuration.
 *
 * @summary Compose explicit cache, output and worker-teardown policy into Vitest configuration.
 */
import { execFile } from 'node:child_process';
import { hash } from 'node:crypto';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types as nodeTypes, promisify } from 'node:util';
import { errnoCode } from './errors.ts';

const exec = promisify(execFile);

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
/**
 * Observe install-state agreement before selecting a shared module cache directory.
 * @returns {Promise<{repositoryRoot: string, moduleCachePath: string, moduleCacheShared: boolean}>} Fresh checkout and install-state observations.
 */
async function moduleCache() {
  const repositoryRoot = await realpath(
    (
      await exec('git', ['rev-parse', '--show-toplevel'], {
        cwd: dirname(reporterPath),
        encoding: 'utf8'
      })
    ).stdout.trim()
  );
  const installState = await readFile(join(repositoryRoot, 'node_modules', '.yarn-state.yml'));
  const installHash = hash('sha256', installState, 'hex').slice(0, 16);
  let workingInstallState;
  for (let current = process.cwd(); ; current = dirname(current)) {
    try {
      workingInstallState = await readFile(join(current, 'node_modules', '.yarn-state.yml'));
      break;
    } catch (error) {
      if (errnoCode(error) !== 'ENOENT') throw error;
    }
    if (dirname(current) === current) break;
  }
  const moduleCacheShared = workingInstallState?.equals(installState) === true;
  const moduleCachePath = join(repositoryRoot, 'node_modules', '.experimental-vitest-cache', installHash);
  await mkdir(moduleCachePath, { recursive: true });
  return { repositoryRoot, moduleCachePath, moduleCacheShared };
}

/**
 * Read a JSON cache contract. Keeping large per-file tables out of the runner configuration's module graph means editing one file's declaration changes only that file's selected inputs, not every file's configuration digest.
 *
 * @param url - JSON contract file URL.
 * @returns Validated object-form cached contract; explicitly uncached JSON refuses.
 * @throws For read/JSON/shape failures or uncached declaration.
 * @type {import('./test-output-policy.d.mts').CacheContractLoader}
 */
export const loadCacheContract = async function loadCacheContract(url) {
  // Callers read fields before withTestOutput runs, so validate here to make the declared CacheContract true.
  const contract = validateContract(JSON.parse(await readFile(url, 'utf8')));
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
export const loadTestSequence = async function loadTestSequence(url) {
  /** @type {unknown} */
  const sequence = JSON.parse(await readFile(url, 'utf8'));
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
 * @returns {Promise<import('vitest/config').ViteUserConfig>} Awaited policy-bearing configuration object.
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
 * @param {import('./contract.ts').CacheContract | import('./contract.ts').UncachedContract | Promise<import('./contract.ts').CacheContract | import('./contract.ts').UncachedContract>} contract - Explicit cached inputs or sole uncached reason.
 * @param {unknown} [sequence] - Optional unknown declared suite order, validated before use.
 * @returns {Promise<import('vitest/config').ViteUserConfig> | import('vitest/config').ViteUserConfigFnPromise} Policy-bearing object or awaited factory.
 * @throws For invalid contract/order, stale sequence or invalid host setup.
 */
function applyTestOutput(configuration, contract, sequence) {
  if (typeof configuration === 'function') {
    return async (environment) => withTestOutput(await configuration(environment), contract, sequence);
  }
  return applyObject(configuration, contract, sequence);
}

/**
 * Await disk-backed policy inputs before attaching their validated values.
 * @param {import('vitest/config').ViteUserConfig} configuration - Original configuration object.
 * @param {import('./contract.ts').CacheContract | import('./contract.ts').UncachedContract | Promise<import('./contract.ts').CacheContract | import('./contract.ts').UncachedContract>} candidate - Explicit policy or loader promise.
 * @param {unknown} sequence - Optional declaration or loader promise.
 * @returns {Promise<import('vitest/config').ViteUserConfig>} Accepted policy-bearing configuration.
 */
async function applyObject(configuration, candidate, sequence) {
  const contract = validateContract(await candidate);
  const { repositoryRoot, moduleCachePath, moduleCacheShared } = await moduleCache();
  const selectedSequence = await sequence;
  const declaredSequence =
    selectedSequence === undefined
      ? undefined
      : await verifySequence(validateSequence(selectedSequence), repositoryRoot);
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
