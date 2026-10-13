/**
 * From the repository root:
 * node packages/vitest-cache/scripts/benchmark.ts --package <path> --runs 5 --output /tmp/fingerprints.json
 *
 * Measures two real cache phases after warmup, without running tests or global
 * setup, for the first two test files of the package at --package (relative to
 * --root). --root selects another checkout; --profile writes a CPU profile for
 * the measured repetitions.
 * @summary Measure discovery and two fingerprint phases without executing test bodies or global setup.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import inspector from 'node:inspector/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { createVitest, type Vitest } from 'vitest/node';
import { ContentCacheReporter, ContentCacheSequencer } from '../src/index.ts';
import { pendingTestFiles } from '../src/plan.ts';

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: process.cwd() },
    package: { type: 'string' },
    config: { type: 'string' },
    runs: { type: 'string', default: '5' },
    output: { type: 'string' },
    profile: { type: 'string' }
  }
});
assert(values.package, '--package is required');
const runs = Number(values.runs);
assert(Number.isInteger(runs) && runs > 0, '--runs must be a positive integer');
const root = fs.realpathSync(values.root);
const packageRoot = path.join(root, values.package);
const configNames = [
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.config.cts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vitest.config.cjs'
];
const configCandidates = values.config
  ? [path.resolve(packageRoot, values.config)]
  : configNames.map((name) => path.join(packageRoot, name)).filter((candidate) => fs.existsSync(candidate));
assert.equal(configCandidates.length, 1, 'provide --config when no unique Vitest configuration exists');
const configPath = configCandidates[0];
assert(configPath && fs.statSync(configPath).isFile(), 'Vitest configuration must be a file');
const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-fingerprint-benchmark-'));
process.env.TMPDIR = cacheRoot;
process.env.GOODFOOT_VITEST_FORCE = '1';
process.argv = [process.execPath, 'vitest', 'run'];
const profilePath = values.profile;
let ctx: Vitest | undefined;
let profiler: inspector.Session | undefined;
const warnings: string[] = [];
const warn = console.warn;
console.warn = (...args) => {
  warnings.push(args.join(' '));
  warn(...args);
};
try {
  ctx = await createVitest('test', {
    root: packageRoot,
    config: configPath,
    watch: false
  });
  const specifications = await ctx.globTestSpecifications();
  const selected = specifications.sort((a, b) => a.moduleId.localeCompare(b.moduleId)).slice(0, 2);
  assert(selected.length > 0, 'benchmark test files must exist');
  const vitest = ctx;
  const reporter = new ContentCacheReporter();
  // Vite bundles the config's reporter class separately. Use this module's
  // instance for both the eligibility check and the benchmark callbacks.
  ctx.config.reporters = [reporter];
  reporter.onInit(ctx);
  const sequencer = new ContentCacheSequencer(ctx);
  const measure = async () => {
    const started = performance.now();
    await reporter.onTestRunStart(selected);
    assert.deepEqual(
      pendingTestFiles(vitest.getRootProject()),
      selected.map((specification) => specification.moduleId),
      'cache planning must fingerprint every selected file'
    );
    const pending = await sequencer.sort(selected);
    assert.equal(pending.length, selected.length, 'forced fingerprinting must retain every selected file');
    assert.deepEqual(warnings, [], 'every selected file must be cacheable without warnings');
    return performance.now() - started;
  };
  const warmupMs = await measure();
  if (profilePath) {
    profiler = new inspector.Session();
    profiler.connect();
    await profiler.post('Profiler.enable');
    await profiler.post('Profiler.start');
  }
  const samplesMs = [];
  for (let index = 0; index < runs; index++) samplesMs.push(await measure());
  if (profiler && profilePath) {
    const { profile } = await profiler.post('Profiler.stop');
    fs.writeFileSync(profilePath, JSON.stringify(profile));
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const medianMs =
    sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[runs / 2 - 1] + sorted[runs / 2]) / 2;
  const result = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    root,
    package: values.package,
    files: selected.map((specification) => path.relative(root, specification.moduleId)),
    phasesPerRun: 2,
    warmupMs,
    samplesMs,
    medianMs,
    minMs: sorted[0],
    maxMs: sorted.at(-1)
  };
  if (values.output) fs.writeFileSync(values.output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  profiler?.disconnect();
  if (ctx) await ctx.close();
  console.warn = warn;
  fs.rmSync(cacheRoot, { recursive: true, force: true });
}
