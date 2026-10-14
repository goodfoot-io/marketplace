/**
 * Validate asynchronous worker observations for host cache-key orchestration.
 * @summary Keep phase-affine filesystem work and every asynchronous key hash off the main thread.
 */
import path from 'node:path';
import { FingerprintPool } from './fingerprint-pool.ts';
import {
  emptyFingerprintStatistics,
  type FingerprintStatistics,
  fingerprintStatisticNames
} from './fingerprint-protocol.ts';

/** Session-owned asynchronous fingerprint backend and its bounded reused worker resources. */
export class FingerprintRuntime {
  private readonly pool = new FingerprintPool();
  private serial = 0;
  private readonly observations = emptyFingerprintStatistics();
  readonly root: string;
  readonly folder: string | null;

  private invalid(message: string): never {
    const error = new Error(message);
    this.pool.invalidate(error);
    throw error;
  }

  private digest(value: unknown): string {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) this.invalid('invalid fingerprint worker digest');
    return value;
  }

  /**
   * Bind filesystem jobs to one repository and stat-validated store.
   * @param root - Physical repository root.
   * @param folder - Owned persistent digest folder, or null for memory-only observations.
   */
  constructor(root: string, folder: string | null) {
    this.root = root;
    this.folder = folder;
  }

  /**
   * Allocate a fresh phase identifier without sharing stat observations across phases.
   * @returns Worker-affine phase identifier.
   */
  phase(): number {
    return ++this.serial;
  }

  /**
   * Hash canonical JSON descriptions as one queued command, including tiny key preimages.
   * @param values - Canonical descriptions in result order.
   * @returns SHA-256 digests in input order.
   * @throws Worker, protocol or serialization errors.
   */
  async json(values: unknown[]): Promise<string[]> {
    const result = await this.pool.run('local', { kind: 'json', values });
    if (!Array.isArray(result) || result.length !== values.length)
      this.invalid('invalid fingerprint worker JSON result');
    return result.map((value: unknown) => this.digest(value));
  }

  /**
   * Hash one dependent key description and require its sole worker result.
   * @param value - Canonical invocation or completed component description.
   * @returns Checked SHA-256 digest.
   * @throws Worker, protocol or serialization errors.
   */
  async jsonOne(value: unknown): Promise<string> {
    const results = await this.json([value]);
    const result = results[0];
    if (result === undefined) this.invalid('missing fingerprint worker JSON result');
    return result;
  }

  /**
   * Observe local leaves, executable bytes and execution description inside one worker command.
   * @param phase - Fresh phase identifier.
   * @param files - Local graph leaves.
   * @param declarations - Canonical declared globs.
   * @param executables - Executable basenames resolved against the live shared environment.
   * @param execution - Canonical execution description.
   * @returns Checked input map and input/executable/execution component digests.
   * @throws Backend guards, worker or protocol errors.
   */
  async local(phase: number, files: string[], declarations: string[], executables: string[], execution: unknown) {
    const result = await this.pool.run('local', {
      kind: 'local',
      phase,
      root: this.root,
      folder: this.folder,
      files,
      declarations,
      executables,
      execution
    });
    if (
      !result ||
      typeof result !== 'object' ||
      !('inputs' in result) ||
      !Array.isArray(result.inputs) ||
      !('inputDigest' in result) ||
      !('execution' in result) ||
      !('executables' in result)
    )
      this.invalid('invalid fingerprint worker local result');
    const inputs = new Map<string, string>();
    let previous: string | null = null;
    for (const entry of result.inputs) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || typeof entry[1] !== 'string')
        this.invalid('invalid fingerprint worker input');
      const [file, value] = entry;
      if (
        !file ||
        path.isAbsolute(file) ||
        file.split(/[\\/]/).includes('..') ||
        (previous !== null && file <= previous) ||
        !/^(?:[a-f0-9]{64}|missing|directory|link\0[^\0]+\0(?:[a-f0-9]{64}|missing|directory))$/.test(value)
      )
        this.invalid('invalid fingerprint worker input token');
      inputs.set(file, value);
      previous = file;
    }
    return {
      inputs,
      inputDigest: this.digest(result.inputDigest),
      execution: this.digest(result.execution),
      executables: result.executables === null ? null : this.digest(result.executables)
    };
  }

  /**
   * Fingerprint installed closure with fresh phase guards and retained completed tree snapshots.
   * @param phase - Fresh phase identifier.
   * @param paths - Resolved external imported paths.
   * @param toolchain - Required installed package specifiers.
   * @param toolchainRoot - Project directory for package resolution.
   * @returns Canonical installed closure component.
   * @throws Invalid installations, filesystem guards, worker or protocol errors.
   */
  async closure(phase: number, paths: string[], toolchain: string[], toolchainRoot: string): Promise<string> {
    return this.digest(
      await this.pool.run('closure', {
        kind: 'closure',
        phase,
        root: this.root,
        folder: this.folder,
        paths,
        toolchain,
        toolchainRoot
      })
    );
  }

  /**
   * Release both workers' phase maps and drain outstanding role commands.
   * @param phase - Completed phase identifier.
   * @returns Logical local-file digest count for diagnostics.
   * @throws Worker failure after both releases have settled.
   */
  async release(phase: number): Promise<number> {
    const results = await Promise.allSettled(
      ['local', 'closure'].map((role) =>
        this.pool.run(role === 'local' ? 'local' : 'closure', { kind: 'release', phase })
      )
    );
    const statistics = emptyFingerprintStatistics();
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
      const value: unknown = result.value;
      if (!value || typeof value !== 'object') this.invalid('invalid fingerprint worker statistics');
      const fields = new Map<string, unknown>(Object.entries(value));
      for (const name of fingerprintStatisticNames) {
        const count = fields.get(name);
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)
          this.invalid('invalid fingerprint worker statistics');
        statistics[name] += count;
      }
    }
    for (const name of fingerprintStatisticNames) this.observations[name] += statistics[name];
    return statistics.filesRead;
  }

  /**
   * Original backend counters accumulated only after complete phase release.
   * @returns Independent completed-phase statistics, including fresh physical observations and byte reads.
   */
  get stats(): FingerprintStatistics {
    return { ...this.observations };
  }

  /**
   * Stop workers and recover resources before the host publishes positive results.
   * @returns Complete worker cleanup, rejecting fatal worker failures.
   */
  async dispose(): Promise<void> {
    await this.pool.dispose();
    this.pool.assertHealthy();
  }
}
