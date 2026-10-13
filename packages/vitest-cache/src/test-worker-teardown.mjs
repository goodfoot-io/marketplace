/**
 * Observe pool worker shutdown and veto unsafe passing-run publication.
 *
 * @summary Observe pool worker shutdown and veto unsafe passing-run publication.
 */
import { relative } from 'node:path';

/**
 * Vitest context key for the {@link WorkerTeardownLedger}. The result cache
 * (`index.ts`) reads the ledger under this key and records nothing
 * for a run that has a custom pool runner the ledger does not cover.
 */
export const WORKER_TEARDOWN = Symbol.for('goodfoot.vitest.worker-teardown');

/**
 * Original host context extended only by the actually installed teardown ledger.
 * @typedef {import('vitest/node').Vitest & {[WORKER_TEARDOWN]?: WorkerTeardownLedger}} ObservedVitest
 */
/**
 * One real custom pool worker and its observed stop-completion custody.
 * Timestamps use Date.now milliseconds; unset timestamps represent unobserved stages.
 * @typedef {{worker: import('vitest/node').PoolWorker, projectName: string, poolName: string, ordinal: number, files: string[], startedAt: number | undefined, stopCalledAt: number | undefined, settledAt: number | undefined, stoppedAt: number | undefined, failed: boolean, stopping: Promise<void> | undefined, done: Promise<void>, finish: () => void}} TrackedPoolWorker
 */
/** Canonical consumed pool teardown contract. @typedef {import('./index.ts').WorkerTeardownLedger} WorkerTeardownPort */

/**
 * Makes custom pool-runner teardown fail the run.
 *
 * Vitest 4.1 only logs a pool worker that takes longer than `teardownTimeout`
 * to stop or whose stop rejects ("Timeout terminating ... worker", "Failed to
 * terminate ... worker"). The run keeps the exit status of its tests. When the
 * runner's stop handshake times out, `PoolRunner.stop()` returns without
 * calling the pool worker's own `stop()`. For `@cloudflare/vitest-plugin` that
 * is the call that closes the socket and disposes Miniflare, so the workerd
 * process is left running.
 *
 * The ledger wraps each project's `poolRunner` and records every pool worker
 * that starts. Each `stop()` is bounded by `teardownTimeout`; a timeout or
 * rejection sets a failing exit code and reports the project, pool worker, its
 * last test files, the teardown stage, the elapsed time, and the process's open
 * resource classes. When Vitest closes, the ledger calls `stop()` itself on any
 * started worker that Vitest has not stopped within `teardownTimeout`, and
 * records that as a failure.
 * @implements {WorkerTeardownPort}
 */
class WorkerTeardownLedger {
  /** Original context supplying the logger, configured teardown window and installed ledger slot. @type {ObservedVitest} */
  #vitest;
  /** Started original workers retained until their real stop observation settles. @type {Set<TrackedPoolWorker>} */
  #entries = new Set();
  /** Replacement runners whose actual workers are observed by this ledger. @type {WeakSet<import('vitest/node').PoolRunnerInitializer>} */
  #guarded = new WeakSet();
  /** Original failure descriptions that veto positive cache publication. @type {string[]} */
  #failures = [];
  /** Single sweep retained across concurrent close/reporting consumers. @type {Promise<{failures: string[]}> | undefined} */
  #settled;
  /** Per-project worker ordinals used only for diagnostic ownership. @type {Map<string, number>} */
  #ordinals = new Map();

  /**
   * Register original context close observation.
   * @param {ObservedVitest} vitest - Configured Vitest context whose worker lifecycle is observed.
   */
  constructor(vitest) {
    this.#vitest = vitest;
    vitest.onClose(async () => {
      await this.settled();
    });
  }

  /** Configured teardown wait window in milliseconds; this is not an execution or capacity measurement. */
  get #budget() {
    return this.#vitest.config.teardownTimeout;
  }

  /**
   * Wrap `project.config.poolRunner` so each pool worker it creates is tracked.
   *
   * @param {import('vitest/node').TestProject} project - Original Vitest project whose custom pool runner is wrapped.
   */
  guard(project) {
    const runner = project.config.poolRunner;
    if (runner == null || this.#guarded.has(runner)) return;
    /** @type {import('vitest/node').PoolRunnerInitializer} */
    const guarded = {
      name: runner.name,
      createPoolWorker: (options) => this.#track(project.name, runner.name, runner.createPoolWorker(options))
    };
    this.#guarded.add(guarded);
    project.config.poolRunner = guarded;
  }

  /**
   * True when every pool worker the project's runner creates is tracked.
   *
   * @param {import('vitest/node').TestProject} project - Current Vitest project.
   * @returns {boolean} Whether no custom runner exists or the current runner is tracked.
   */
  covers(project) {
    const runner = project.config.poolRunner;
    return runner == null || this.#guarded.has(runner);
  }

  /**
   * Resolves after every started pool worker has stopped or failed to stop. Memoized: the first call, at Vitest close, starts the sweep.
   *
   * @returns {Promise<{failures: string[]}>} Memoized sweep result containing every observed worker teardown failure.
   */
  settled() {
    this.#settled ??= this.#sweep();
    return this.#settled;
  }

  /**
   * One line per started pool worker whose `stop()` has not completed successfully.
   *
   * @returns {string[]} Diagnostic lines for started workers without successful stop completion.
   */
  pending() {
    const now = Date.now();
    return [...this.#entries].filter((entry) => !entry.stoppedAt).map((entry) => this.#describe(entry, now));
  }

  /**
   * Record an original pool worker and intercept only its existing lifecycle methods.
   * @param {string} projectName - Original project label for failure ownership.
   * @param {string} poolName - Configured pool runner label.
   * @param {import('vitest/node').PoolWorker} worker - Real worker returned by the configured runner.
   * @returns {import('vitest/node').PoolWorker} The same worker with observed lifecycle methods.
   */
  #track(projectName, poolName, worker) {
    const ordinal = (this.#ordinals.get(projectName) ?? 0) + 1;
    this.#ordinals.set(projectName, ordinal);
    /** @type {(() => void) | undefined} */
    let finish;
    /** @type {TrackedPoolWorker} */
    const entry = {
      worker,
      projectName,
      poolName,
      ordinal,
      files: [],
      startedAt: undefined,
      stopCalledAt: undefined,
      settledAt: undefined,
      stoppedAt: undefined,
      failed: false,
      stopping: undefined,
      done: new Promise((resolve) => {
        finish = resolve;
      }),
      finish: () => {
        entry.settledAt ??= Date.now();
        if (finish === undefined) throw new Error('Pool worker completion resolver is unavailable');
        finish();
      }
    };
    const start = worker.start.bind(worker);
    const stop = worker.stop.bind(worker);
    const send = worker.send.bind(worker);
    worker.start = (...args) => {
      if (!entry.startedAt) {
        entry.startedAt = Date.now();
        this.#entries.add(entry);
      }
      return start(...args);
    };
    worker.send = (message) => {
      const files = message.type === 'run' || message.type === 'collect' ? message.context.files : undefined;
      if (Array.isArray(files)) entry.files = files.map((file) => (typeof file === 'string' ? file : file.filepath));
      return send(message);
    };
    worker.stop = () => {
      entry.stopping ??= this.#stop(entry, stop);
      return entry.stopping;
    };
    return worker;
  }

  /**
   * Observe the real stop promise under the configured timeout without accepting late completion.
   * @param {TrackedPoolWorker} entry - Original worker whose stop has begun.
   * @param {import('vitest/node').PoolWorker['stop']} stop - Bound original stop method.
   * @returns {Promise<void>} Completion only when the real stop resolves within the budget.
   * @throws For rejected or timed-out original stop, after recording failure and settling observation.
   */
  async #stop(entry, stop) {
    const stopCalledAt = Date.now();
    entry.stopCalledAt = stopCalledAt;
    const budget = this.#budget;
    const underlying = Promise.resolve().then(stop);
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    let timedOut = false;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new Error(`pool worker stop() did not finish within teardownTimeout (${budget} ms)`));
      }, budget);
    });
    try {
      await Promise.race([underlying, timeout]);
      entry.stoppedAt = Date.now();
    } catch (error) {
      entry.failed = true;
      this.#fail(entry, 'pool worker stop()', error instanceof Error ? error.message : String(error));
      if (timedOut) {
        underlying.then(
          () => {
            entry.stoppedAt = Date.now();
            this.#report(
              `${this.#label(entry)}: stop() finished late, ${entry.stoppedAt - stopCalledAt} ms after it began`
            );
          },
          (late) =>
            this.#report(
              `${this.#label(entry)}: stop() rejected late: ${late instanceof Error ? late.message : String(late)}`
            )
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
      entry.finish();
    }
  }

  /**
   * Wait for tracked stops, invoke any missing original stop and veto unobserved coverage.
   * @returns {Promise<{failures: string[]}>} Every original teardown failure after observations settle.
   */
  async #sweep() {
    for (const project of this.#vitest.projects) {
      if (!this.covers(project)) {
        this.#failRun(
          `project ${project.name} uses pool runner ${project.config.poolRunner?.name}, which the teardown guard does not cover`
        );
      }
    }
    const deadline = Date.now() + this.#budget;
    for (;;) {
      const waiting = [...this.#entries].filter((entry) => !entry.settledAt);
      const remaining = deadline - Date.now();
      if (!waiting.length || remaining <= 0) break;
      /** @type {ReturnType<typeof setTimeout> | undefined} */
      let timer;
      await Promise.race([
        Promise.all(waiting.map((entry) => entry.done)),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(undefined), remaining);
        })
      ]);
      clearTimeout(timer);
    }
    for (const entry of this.#entries) {
      if (entry.stopCalledAt) continue;
      this.#fail(
        entry,
        'Vitest runner stop',
        `Vitest did not call the pool worker's stop() within teardownTimeout (${this.#budget} ms) of closing; calling it directly`
      );
      entry.worker.stop().catch(() => {});
    }
    // Every stop() has now begun and each is bounded by its own
    // teardownTimeout, so this wait is bounded too.
    await Promise.all([...this.#entries].map((entry) => entry.done));
    return { failures: [...this.#failures] };
  }

  /**
   * Attach an observed failure to its original worker and teardown stage.
   * @param {TrackedPoolWorker} entry - Original worker failure owner.
   * @param {string} stage - Observed teardown operation.
   * @param {string} reason - Exact original failure description.
   */
  #fail(entry, stage, reason) {
    this.#failRun(`${this.#describe(entry, Date.now(), stage)}: ${reason}`);
  }

  /**
   * Veto positive run publication and retain the original failure description.
   * @param {string} message - Failure already attached to its owner/stage.
   */
  #failRun(message) {
    process.exitCode = 1;
    this.#failures.push(message);
    this.#report(`${message}\n  open resources: ${openResources()}`);
  }

  /** @param {string} message - Diagnostic written through the original Vitest logger. */
  #report(message) {
    this.#vitest.logger.error(`[test-teardown] ${message}`);
  }

  /**
   * @param {TrackedPoolWorker} entry - Worker selected for a stable diagnostic label.
   * @returns {string} Original project/pool label and observed worker ordinal.
   */
  #label(entry) {
    return `project ${entry.projectName}, ${entry.poolName} worker #${entry.ordinal}`;
  }

  /**
   * @param {TrackedPoolWorker} entry - Original worker and its latest observed lifecycle.
   * @param {number} now - Current Date.now milliseconds for elapsed wall-time diagnostics.
   * @param {string} [stage] - Explicit failed stage, otherwise derived from observed lifecycle.
   * @returns {string} Bounded file ownership and teardown-stage description.
   */
  #describe(entry, now, stage) {
    const root = this.#vitest.config.root;
    const shown = entry.files.slice(0, 3).map((file) => relative(root, file));
    const files = entry.files.length
      ? `; last files ${shown.join(', ')}${entry.files.length > shown.length ? ` (+${entry.files.length - shown.length} more)` : ''}`
      : '';
    const phase =
      stage ??
      (entry.failed
        ? 'pool worker stop() failed'
        : entry.stopCalledAt
          ? 'pool worker stop()'
          : 'awaiting Vitest runner stop');
    const elapsed = entry.stopCalledAt ? `, ${now - entry.stopCalledAt} ms into stop()` : '';
    return `${this.#label(entry)}${files} (stage: ${phase}${elapsed})`;
  }
}

/**
 * Counts of the libuv handle and request classes keeping this process alive.
 *
 * @returns {string} Counts of active libuv resource classes, or none; not causal leak proof.
 */
export function openResources() {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const type of process.getActiveResourcesInfo()) counts.set(type, (counts.get(type) ?? 0) + 1);
  return [...counts].map(([type, count]) => `${type} x${count}`).join(', ') || 'none';
}

/**
 * Vite plugin that installs the ledger on every project with a custom `poolRunner`. Runs after other plugins' `configureVitest` hooks, because `@cloudflare/vitest-plugin` assigns the pool runner in its own hook.
 *
 * @returns {import('vitest/config').Plugin} Post-configure plugin installing the ledger for custom pool runners.
 */
export function workerTeardownPlugin() {
  return {
    name: 'goodfoot-worker-teardown',
    configureVitest: {
      order: 'post',
      /**
       * @param {import('vitest/node').VitestPluginContext} context - Actual configured project and host context.
       */
      handler({ vitest, project }) {
        if (project.config.poolRunner == null) return;
        /** @type {ObservedVitest} */
        const observed = vitest;
        observed[WORKER_TEARDOWN] ??= new WorkerTeardownLedger(observed);
        observed[WORKER_TEARDOWN].guard(project);
      }
    }
  };
}
