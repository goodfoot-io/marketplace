/**
 * Fail unclaimed diagnostics and retain bounded failed-run console evidence.
 *
 * @summary Fail unclaimed diagnostics and retain bounded failed-run console evidence.
 */
import { hash } from 'node:crypto';
import { appendFileSync, closeSync, mkdtempSync, openSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { experimental_getRunnerTask } from 'vitest/node';
import { nativeDiagnosticClaims, workerdDiagnosticClaims } from './test-output-capture.mjs';
import { openResources, WORKER_TEARDOWN } from './test-worker-teardown.mjs';

/** Canonical original runner callback contract. @typedef {import('vitest/node').Reporter} VitestReporter */

/**
 * Preserve diagnostics that Vitest's passed-only reporter cannot attach to a failed task.
 * @implements {VitestReporter}
 */
export default class TestOutputReporter {
  /** @type {import('./test-worker-teardown.mjs').ObservedVitest | undefined} */
  context;
  /**
   * Bind the configured cache reporter passing-test accessor.
   * @param {object} root - Configured reporter options.
   * @param {() => number} root.cachedPassingTests - Accessor bound to the original root reporter.
   * @throws When the accessor is not callable.
   */
  constructor({ cachedPassingTests }) {
    if (typeof cachedPassingTests !== 'function')
      throw new TypeError('Test output reporter requires the cache passing-test accessor');
    this.cachedPassingTests = cachedPassingTests;
  }

  /**
   * Original host context; Vitest initializes reporters before emitting lifecycle events.
   * @returns {import('./test-worker-teardown.mjs').ObservedVitest} Initialized original context.
   * @throws When a reporter event precedes initialization.
   */
  get vitest() {
    if (this.context === undefined) throw new Error('Test output reporter is not initialized');
    return this.context;
  }

  /**
   * Bind original Vitest context for later diagnostic ownership.
   *
   * @param {Parameters<NonNullable<import('vitest/node').Reporter['onInit']>>[0]} context - Original configured Vitest context.
   */
  onInit(context) {
    this.context = context;
  }

  /**
   * Fail unclaimed stderr after honoring explicit Vitest onConsoleLog filtering; preserve unattributed output.
   *
   * @param {Parameters<NonNullable<import('vitest/node').Reporter['onUserConsoleLog']>>[0]} log - Original console event with task identity/type/content.
   */
  onUserConsoleLog(log) {
    // A passing assertion alone cannot make an unclaimed warning/error quiet.
    // Expected diagnostics are intercepted and asserted by the owning product
    // tests (for example expectTelemetry); they never reach this reporter.
    if (log.type === 'stderr') {
      const task = log.taskId === undefined ? undefined : this.vitest.state.idMap.get(log.taskId);
      // Honor the configured `onConsoleLog` filter exactly as Vitest's default reporter does.
      const entity = task && this.vitest.state.getReportedEntity(task);
      if (this.vitest.config.onConsoleLog?.(log.content, log.type, entity) === false) return;
      const owner = `${task?.file?.filepath ?? this.vitest.config.root} > ${task?.name ?? 'unattributed diagnostic'}`;
      this.vitest.logger.errorStream.write(`stderr | ${owner}\n${log.content}\n`);
      this.vitest.state.catchError(
        {
          name: 'UnexpectedTestDiagnostic',
          message: `Unclaimed test stderr: ${owner}\n${log.content}`
        },
        'Unexpected Test Diagnostic'
      );
      process.exitCode = 1;
      return;
    }
    if (this.vitest.config.silent !== 'passed-only') return;
    if (log.taskId && this.vitest.state.idMap.has(log.taskId)) return;
    const output = this.vitest.logger.outputStream;
    output.write(`${log.type} | unattributed diagnostic\n${log.content}\n`);
  }

  /**
   * Vitest calls this when the process is still running `teardownTimeout` after
   * close, then prints "close timed out" and calls `process.exit()` with the
   * exit code the tests left, which is 0 for a passing run. Fail the run and
   * report what is still open.
   */
  onProcessTimeout() {
    process.exitCode = 1;
    const workers = this.vitest[WORKER_TEARDOWN]?.pending() ?? [];
    this.vitest.logger.errorStream.write(
      `\n[test-output] The process was still running ${this.vitest.config.teardownTimeout} ms after Vitest closed; failing the run.\n` +
        `  open resources: ${openResources()}\n` +
        workers.map((worker) => `  pool worker not stopped: ${worker}\n`).join('')
    );
  }

  /**
   * Append exact fixture diagnostic claims and actual test outcome to private verdict inventory.
   *
   * @param {Parameters<NonNullable<import('vitest/node').Reporter['onTestCaseResult']>>[0]} testCase - Completed original test case.
   * @throws For verdict artifact append failure.
   */
  onTestCaseResult(testCase) {
    const metadata = testCase.meta();
    const expected = nativeDiagnosticClaims(
      'goodfootExpectedNative' in metadata ? metadata.goodfootExpectedNative : undefined
    );
    const expectedWorkerd = workerdDiagnosticClaims(
      'goodfootExpectedWorkerd' in metadata ? metadata.goodfootExpectedWorkerd : undefined
    );
    if ((expected.length || expectedWorkerd.length) && process.env.GOODFOOT_TEST_OUTPUT_RESULT) {
      appendFileSync(
        process.env.GOODFOOT_TEST_OUTPUT_RESULT,
        `${JSON.stringify({
          owner: testCase.fullName,
          state: testCase.result().state,
          expected,
          expectedWorkerd
        })}\n`,
        { mode: 0o600 }
      );
    }
  }

  /**
   * Fail explicit patterns with no executed/reused assertions and preserve failed/unhandled-run console evidence.
   *
   * @param {Parameters<NonNullable<import('vitest/node').Reporter['onTestRunEnd']>>[0]} modules - Original executed test modules.
   * @param {Parameters<NonNullable<import('vitest/node').Reporter['onTestRunEnd']>>[1]} errors - Unhandled run errors.
   * @param {Parameters<NonNullable<import('vitest/node').Reporter['onTestRunEnd']>>[2]} reason - Run completion/interruption reason.
   */
  onTestRunEnd(modules, errors, reason) {
    const pattern = this.vitest.getGlobalTestNamePattern();
    if (pattern) {
      let completed = this.cachedPassingTests();
      for (const module of modules) {
        for (const test of module.children.allTests()) {
          const state = test.result().state;
          if (state === 'passed' || state === 'failed') completed++;
        }
      }
      if (!completed) {
        process.exitCode = 1;
        this.vitest.logger.errorStream.write(
          `\n[test-output] Explicit test-name pattern ${pattern} executed no tests and reused no passing tests; failing the run.\n`
        );
      }
    }
    if (this.vitest.config.silent !== 'passed-only') return;
    const unhandled = errors.length > 0 || reason === 'interrupted';
    const affected = unhandled
      ? modules
      : modules.filter((module) => experimental_getRunnerTask(module).result?.state === 'fail');
    if (!affected.length) return;
    // A background error can fail the run even when its test already passed.
    // Do not dump an entire large suite into the terminal. Retain every captured
    // console record on disk and show a bounded tail alongside Vitest's errors.
    const root = this.vitest.config.root;
    const worktree = hash('sha256', root, 'hex').slice(0, 12);
    const directory = mkdtempSync(join(tmpdir(), `goodfoot-test-output-${worktree}-`));
    const artifact = join(directory, 'unhandled-console.log');
    const fd = openSync(artifact, 'wx', 0o600);
    let bytes = 0;
    let records = 0;
    /** @type {Buffer} */
    let tail = Buffer.alloc(0);
    /** @param {string} text - Exact original console evidence appended to the private failed-run artifact. */
    const save = (text) => {
      const buffer = Buffer.from(text);
      let offset = 0;
      while (offset < buffer.length) offset += writeSync(fd, buffer, offset);
      bytes += buffer.length;
      tail = Buffer.concat([tail, buffer.subarray(-8192)]).subarray(-8192);
    };
    /** @param {import('vitest/node').RunnerTask} task - Original task whose retained console records are visited. */
    const visit = (task) => {
      // Vitest already replays failed-task logs. A passing task can own
      // afterAll output, or precede an unhandled rejection that fails the run.
      if (task.result?.state !== 'fail') {
        for (const log of task.logs ?? []) {
          records++;
          save(`${log.type} | ${task.name}\n${log.content}\n`);
        }
      }
      if ('tasks' in task) for (const child of task.tasks) visit(child);
    };
    try {
      save(`Worktree/package: ${root}\n`);
      for (const module of affected) visit(experimental_getRunnerTask(module));
    } finally {
      closeSync(fd);
    }
    if (!records) {
      rmSync(directory, { recursive: true, force: true });
      return;
    }
    this.vitest.logger.errorStream.write(
      `\n[test-output] Console diagnostics for the failed run${bytes > tail.length ? ' (truncated to the last 8192 bytes)' : ''}. Complete artifact: ${artifact}\n${tail.toString('utf8')}\n`
    );
  }
}
