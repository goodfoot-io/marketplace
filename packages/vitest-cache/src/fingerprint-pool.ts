/**
 * Reuse two role-affine fingerprint workers with bounded FIFO admission and fail-closed cleanup.
 * @summary Offload coarse local and installed-closure jobs, including small key serialization.
 */
import { SHARE_ENV, Worker } from 'node:worker_threads';
import { allocateFilesystemOwner, filesystemBudget, recoverFilesystemBudget } from './filesystem-batch.ts';
import type { FingerprintCommand } from './fingerprint-protocol.ts';

/** Maximum waiting commands per worker, in addition to its single active command. */
export const fingerprintQueueLimit = 32;
/** Persistent worker roles preserve phase-local memoization without transferring file bytes. */
type Role = 'local' | 'closure';
type Pending = {
  id: number;
  command: FingerprintCommand;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};
type Lane = { worker: Worker; owner: number; queue: Pending[]; active: Pending | null; drained: (() => void) | null };

/** A session-owned two-worker controller; idle workers never keep a CLI alive. */
export class FingerprintPool {
  private readonly lanes = new Map<Role, Lane>();
  private serial = 0;
  private closed = false;
  private failure: Error | null = null;
  private stopping: Promise<void> | null = null;

  /**
   * Admit a coarse command in FIFO order on its memoization role.
   * @param role - Local inputs/key serialization or installed closure.
   * @param command - Paths or small canonical descriptions, never file buffers.
   * @returns Validated-at-call-site worker result.
   * @throws For queue exhaustion, operation failure, stopped pool or worker/protocol failure.
   */
  run(role: Role, command: FingerprintCommand): Promise<unknown> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.closed) return Promise.reject(new Error('fingerprint pool is closed'));
    let lane = this.lanes.get(role);
    if (!lane) {
      const owner = allocateFilesystemOwner();
      try {
        const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
        const worker = new Worker(new URL(`./fingerprint-worker.${extension}`, import.meta.url), {
          workerData: { budget: filesystemBudget, slot: owner },
          env: SHARE_ENV
        });
        lane = { worker, owner, queue: [], active: null, drained: null };
        this.lanes.set(role, lane);
        const current = lane;
        worker.on('message', (response: unknown) => this.receive(current, response));
        worker.on('error', (error: unknown) => this.poison(error instanceof Error ? error : new Error(String(error))));
        worker.on('exit', (code) => {
          if (!this.stopping || current.active) this.poison(new Error(`fingerprint worker exited (${code})`));
        });
        worker.unref();
      } catch (error) {
        recoverFilesystemBudget(owner);
        const failure = error instanceof Error ? error : new Error(String(error));
        this.poison(failure);
        return Promise.reject(failure);
      }
    }
    if (lane.queue.length >= fingerprintQueueLimit)
      return Promise.reject(new Error('fingerprint worker queue is full'));
    const current = lane;
    return new Promise<unknown>((resolve, reject) => {
      current.queue.push({ id: ++this.serial, command, resolve, reject });
      this.dispatch(current);
    });
  }

  private dispatch(lane: Lane): void {
    if (lane.active || this.failure) return;
    if (this.closed) {
      lane.worker.unref();
      return;
    }
    const next = lane.queue.shift();
    if (!next) {
      lane.worker.unref();
      return;
    }
    lane.active = next;
    lane.worker.ref();
    try {
      lane.worker.postMessage({ id: next.id, command: next.command });
    } catch (error) {
      this.poison(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private receive(lane: Lane, response: unknown): void {
    if (this.failure) return;
    const pending = lane.active;
    if (
      !pending ||
      !response ||
      typeof response !== 'object' ||
      !('id' in response) ||
      response.id !== pending.id ||
      'error' in response === 'value' in response ||
      ('error' in response && typeof response.error !== 'string')
    ) {
      this.poison(new Error('invalid fingerprint worker response'));
      return;
    }
    lane.active = null;
    lane.drained?.();
    lane.drained = null;
    if ('error' in response && typeof response.error === 'string') pending.reject(new Error(response.error));
    else if ('value' in response) pending.resolve(response.value);
    this.dispatch(lane);
  }

  private poison(error: Error): void {
    this.failure ??= error;
    for (const lane of this.lanes.values()) {
      lane.active?.reject(this.failure);
      lane.active = null;
      lane.drained?.();
      lane.drained = null;
      for (const pending of lane.queue.splice(0)) pending.reject(this.failure);
    }
    void this.stop().catch((failure: unknown) => {
      this.failure ??= failure instanceof Error ? failure : new Error(String(failure));
    });
  }

  private stop(): Promise<void> {
    this.stopping ??= Promise.all(
      [...this.lanes.values()].map(async (lane) => {
        if (!this.failure && lane.active)
          await new Promise<void>((resolve) => {
            lane.drained = resolve;
          });
        await lane.worker.terminate();
        recoverFilesystemBudget(lane.owner);
      })
    ).then(() => {
      this.lanes.clear();
    });
    return this.stopping;
  }

  /**
   * Reject remaining callers, drain started filesystem work and stop before publication.
   * @returns Worker and permit cleanup completion.
   */
  dispose(): Promise<void> {
    this.closed = true;
    const error = new Error('fingerprint pool is closed');
    for (const lane of this.lanes.values()) {
      lane.active?.reject(error);
      for (const pending of lane.queue.splice(0)) pending.reject(error);
    }
    return this.stop();
  }

  /**
   * Poison all admitted work after a checked payload violates the worker protocol.
   * @param error - Invalid checked response evidence.
   */
  invalidate(error: Error): void {
    this.poison(error);
  }

  /**
   * Reject publication after a fatal worker or protocol failure.
   * @throws The original fatal failure, if any.
   */
  assertHealthy(): void {
    if (this.failure) throw this.failure;
  }
}
