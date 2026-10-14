#!/usr/bin/env node
/**
 * Run Vitest with output capture and commit staged cache records after acceptance.
 *
 * @summary Run Vitest with output capture and commit staged cache records after acceptance.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { constants as osConstants, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { errorMessage } from './errors.ts';
import { commitStage } from './publication.ts';
import { createTestOutputCapture } from './test-output-capture.mjs';
import { testVerbose } from './test-verbose.mjs';

// Every workerd-pool Vitest suite runs through this entry: it owns the child's
// stdout/stderr so test-output-capture can judge framed fixture records and
// workerd runtime records. Vitest resolves from the invoking package, and the
// child inherits this process's Node flags (for example `--import tsx`).
const require = createRequire(join(process.cwd(), 'package.json'));
const cli = resolve(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

// Other Vitest options, including file and name selectors, pass through
// unchanged. Watch and verbose runs have no capture boundary.
if (process.argv[2] !== 'run' || testVerbose()) {
  await import(pathToFileURL(cli).href);
} else {
  const capture = await createTestOutputCapture(process.cwd());
  // The child stages cache results here; they become reusable only after the
  // capture check below accepts the run's native diagnostics.
  const stageDirectory = await mkdtemp(join(tmpdir(), 'goodfoot-vitest-stage-'));
  const stage = join(stageDirectory, 'stage.json');
  const child = spawn(process.execPath, [...process.execArgv, cli, ...process.argv.slice(2)], {
    env: { ...process.env, GOODFOOT_TEST_OUTPUT_RESULT: capture.resultPath, GOODFOOT_VITEST_CACHE_ACK: stage },
    stdio: ['inherit', 'pipe', 'pipe']
  });
  /** @param {NodeJS.Signals} signal - Original parent termination signal forwarded to the child. */
  const forward = (signal) => child.kill(signal);
  const onInterrupt = () => forward('SIGINT');
  const onTerminate = () => forward('SIGTERM');
  const onHangup = () => forward('SIGHUP');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  process.on('SIGHUP', onHangup);
  try {
    /** @type {unknown} */
    let drainError;
    const drains = Promise.all([
      capture.pump(child.stdout, process.stdout),
      capture.pump(child.stderr, process.stderr)
    ]).catch((error) => {
      drainError = error;
      child.kill('SIGTERM');
    });
    /** @type {Promise<number>} */
    const exited = new Promise((resolveExit, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) =>
        resolveExit(code ?? 128 + (signal === null ? 1 : (osConstants.signals[signal] ?? 1)))
      );
    });
    const outcome = await exited;
    await drains;
    if (drainError) throw drainError;
    process.exitCode = await capture.finish(outcome);
    if (capture.accepted()) {
      try {
        await commitStage(stage);
      } catch (error) {
        process.stderr.write(`vitest cache: results not recorded: ${errorMessage(error)}\n`);
      }
    }
  } catch (error) {
    child.kill('SIGTERM');
    process.stderr.write(`[test-output] Vitest capture failed: ${errorMessage(error)}\n`);
    process.exitCode = await capture.finish(1);
  } finally {
    await rm(stageDirectory, { recursive: true, force: true });
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
    process.off('SIGHUP', onHangup);
  }
}
