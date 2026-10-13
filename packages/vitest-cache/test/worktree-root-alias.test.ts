/**
 * Verify worktree root alias cache behavior with isolated temporary fixtures.
 *
 * @summary Verify worktree root alias cache behavior with isolated temporary fixtures.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, vi } from 'vitest';
import type { TestProject, TestSpecification, Vitest } from 'vitest/node';
import { ContentCacheReporter } from '../src/index.ts';
import { pendingTestFiles, publishPlan } from '../src/plan.ts';

/**
 * The reporter reads only these parts of Vitest's host objects; the fakes below model them and nothing else.
 *
 * @returns Minimal current project fields observed by the reporter.
 */
function fakeProject(): TestProject {
  return { name: 'fixture', config: { provide: { goodfootCacheInputs: { fallback: [] } } } } as unknown as TestProject;
}

function fakeVitest(root: string, config: string, onClose: (callback: () => Promise<void>) => void): Vitest {
  return { config: { root, config, reporters: [], watch: false }, onClose } as unknown as Vitest;
}

function fakeSpecification(project: TestProject, moduleId: string): TestSpecification {
  return { project, moduleId } as unknown as TestSpecification;
}

/**
 * Sentinel that fails if reporter never registered its close callback.
 *
 * @throws Always; this is an unreachable fixture callback after correct initialization.
 */
async function unregistered(): Promise<void> {
  throw new Error('the reporter did not register a close callback');
}

/**
 * A reporter initialized against a fake Vitest host, and the close callback that host received.
 *
 * @param root - Temporary repository root.
 * @param config - Fixture Vitest configuration.
 * @returns Initialized reporter and test context for alias assertions.
 */
function initializedReporter(root: string, config: string): { reporter: ContentCacheReporter; close(): Promise<void> } {
  let close: () => Promise<void> = unregistered;
  const reporter = new ContentCacheReporter();
  reporter.onInit(
    fakeVitest(root, config, (callback) => {
      close = callback;
    })
  );
  return { reporter, close: () => close() };
}

test('cache planning accepts a repository root alias and rejects a genuinely external config', async () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'vitest-cache-root-alias-'));
  const repository = path.join(temporary, 'repository');
  const alias = path.join(temporary, 'alias');
  mkdirSync(repository);
  execFileSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: repository });
  writeFileSync(path.join(repository, 'package.json'), '{"name":"root-alias-fixture"}');
  writeFileSync(path.join(repository, 'vitest.config.mjs'), 'export default {};\n');
  writeFileSync(path.join(repository, 'example.test.mjs'), 'export {};\n');
  writeFileSync(path.join(temporary, 'external.config.mjs'), 'export default {};\n');
  symlinkSync(repository, alias, 'dir');
  // Model the uninstrumented Vitest host rather than this test's pool worker.
  const execArgv = process.execArgv;
  process.execArgv = [];
  vi.stubEnv('NODE_OPTIONS', '');
  for (const name of Object.keys(process.env)) {
    if (/^(?:NODE_PATH|NODE_V8_COVERAGE|TS_NODE_.+|TSX_.+)$/.test(name)) vi.stubEnv(name, '');
  }
  // Planning is the subject here, so the caller's cache-eligibility switches must not turn it off.
  vi.stubEnv('DISABLE_TEST_CACHE', '');
  vi.stubEnv('GOODFOOT_TEST_VERBOSE', '');
  vi.stubEnv('GOODFOOT_VITEST_FORCE', '');
  const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    for (const root of [repository, alias]) {
      const project = fakeProject();
      const specification = fakeSpecification(project, path.join(root, 'example.test.mjs'));
      const { reporter, close } = initializedReporter(root, path.join(root, 'vitest.config.mjs'));
      try {
        await reporter.onTestRunStart([specification]);
        expect(pendingTestFiles(project)).toEqual([specification.moduleId]);
        expect(warnings).not.toHaveBeenCalled();
      } finally {
        await close();
      }
    }

    const project = fakeProject();
    const { reporter, close } = initializedReporter(repository, path.join(temporary, 'external.config.mjs'));
    try {
      await reporter.onTestRunStart([fakeSpecification(project, path.join(repository, 'example.test.mjs'))]);
      expect(pendingTestFiles(project)).toBeNull();
      expect(warnings).toHaveBeenCalledWith(expect.stringContaining('test input outside repository'));
    } finally {
      await close();
    }
  } finally {
    process.execArgv = execArgv;
    vi.unstubAllEnvs();
    warnings.mockRestore();
    publishPlan(null);
    rmSync(temporary, { recursive: true, force: true });
  }
});
