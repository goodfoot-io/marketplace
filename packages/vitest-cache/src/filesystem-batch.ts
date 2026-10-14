/**
 * Bounded asynchronous filesystem observations with deterministic result order.
 * @summary Drain each bounded batch before reporting errors.
 */
import fs from 'node:fs';

/** Maximum number of outstanding metadata operations in one batch. */
export const filesystemBatchSize = 32;
/** Maximum concurrent content descriptors; streamed hashes use at-most-1-MiB buffers. */
export const filesystemStreamLimit = 4;
const notificationSlot = filesystemBatchSize + filesystemStreamLimit;
/** Atomic ownership slots: thirty-two metadata, four streams and one wake generation. */
export const filesystemBudget = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * (notificationSlot + 1));
let permits = new Int32Array(filesystemBudget);
let owner = 1;
const owners = new Set<number>();

/**
 * Allocate distinct ownership across concurrent controller instances.
 * @returns Reserved worker ownership identifier.
 * @throws When the process already has sixty-four live fingerprint workers.
 */
export function allocateFilesystemOwner(): number {
  for (let identifier = 2; identifier <= 65; identifier++) {
    if (!owners.has(identifier)) {
      owners.add(identifier);
      return identifier;
    }
  }
  throw new Error('too many live fingerprint workers');
}

/**
 * Join the host's metadata and streaming budget before observing filesystem inputs.
 * @param buffer - Shared atomic ownership slots owned by the host module.
 * @param identifier - Distinct worker ownership identifier.
 * @throws For an invalid shared buffer or ownership identifier.
 */
export function joinFilesystemBudget(buffer: SharedArrayBuffer, identifier: number): void {
  if (
    buffer.byteLength !== filesystemBudget.byteLength ||
    !Number.isInteger(identifier) ||
    identifier < 2 ||
    identifier > 65
  )
    throw new Error('invalid filesystem worker budget');
  permits = new Int32Array(buffer);
  owner = identifier;
}

async function reserve(first: number, limit: number): Promise<number> {
  for (;;) {
    const generation = Atomics.load(permits, notificationSlot);
    for (let slot = first; slot < first + limit; slot++) {
      if (Atomics.compareExchange(permits, slot, 0, owner) === 0) return slot;
    }
    await Atomics.waitAsync(permits, notificationSlot, generation).value;
  }
}

function wake(): void {
  Atomics.add(permits, notificationSlot, 1);
  Atomics.notify(permits, notificationSlot);
}

function release(slot: number): void {
  if (Atomics.compareExchange(permits, slot, owner, 0) !== owner)
    throw new Error('filesystem permit ownership changed');
  wake();
}

/**
 * Recover atomic ownership only after a worker has fully stopped, including native operations.
 * @param identifier - Terminated worker ownership identifier.
 * @throws For an invalid ownership identifier.
 */
export function recoverFilesystemBudget(identifier: number): void {
  if (!Number.isInteger(identifier) || identifier < 2 || identifier > 65)
    throw new Error('invalid filesystem worker owner');
  for (let slot = 0; slot < notificationSlot; slot++) Atomics.compareExchange(permits, slot, identifier, 0);
  owners.delete(identifier);
  wake();
}

async function observeBounded<T, U>(input: T, observe: (input: T) => Promise<U>): Promise<U> {
  const slot = await reserve(0, filesystemBatchSize);
  try {
    return await observe(input);
  } finally {
    release(slot);
  }
}

/**
 * Reserve one shared metadata slot for a sequential filesystem observation.
 * @param operation - Sequential metadata operations without nested reservations.
 * @returns Observed metadata.
 * @throws Filesystem observation errors after cleanup.
 */
export function filesystemMetadata<T>(operation: () => Promise<T>): Promise<T> {
  return observeBounded(undefined, operation);
}

/**
 * Observe inputs in bounded batches, retaining input order and draining failed batches.
 * @param inputs - Ordered inputs.
 * @param observe - Asynchronous observation for one input.
 * @returns Results in input order.
 * @throws The first input-order failure after all started observations settle.
 */
export async function batchedMap<T, U>(inputs: readonly T[], observe: (input: T) => Promise<U>): Promise<U[]> {
  const values: U[] = [];
  for (let offset = 0; offset < inputs.length; offset += filesystemBatchSize) {
    const results = await Promise.allSettled(
      inputs.slice(offset, offset + filesystemBatchSize).map((input) => {
        try {
          return observe(input);
        } catch (error) {
          return Promise.reject(error);
        }
      })
    );
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
    }
    for (const result of results) {
      if (result.status === 'fulfilled') values.push(result.value);
    }
  }
  return values;
}

/**
 * Resolve physical paths using Node's native asynchronous implementation.
 * @param filename - Logical filesystem path.
 * @returns Resolved physical path.
 * @throws Native filesystem resolution errors.
 */
export function physicalPath(filename: string): Promise<string> {
  return filesystemMetadata(
    () =>
      new Promise<string>((resolve, reject) => {
        fs.realpath.native(filename, (error, resolved) => {
          if (error) reject(error);
          else resolve(resolved);
        });
      })
  );
}

/**
 * Read physical metadata with the callback API and shared leaf-operation bound.
 * @param filename - Physical path to observe without following its final link.
 * @returns Nanosecond-resolution physical metadata.
 * @throws Native filesystem observation errors.
 */
export function lstatMetadata(filename: string): Promise<fs.BigIntStats> {
  return filesystemMetadata(
    () =>
      new Promise<fs.BigIntStats>((resolve, reject) => {
        fs.lstat(filename, { bigint: true }, (error, stat) => {
          if (error) reject(error);
          else resolve(stat);
        });
      })
  );
}

/**
 * Enumerate directory entries with the callback API and shared metadata bound.
 * @param directory - Physical directory to enumerate.
 * @returns Native directory entries before canonical ordering and filtering.
 * @throws Native filesystem enumeration errors.
 */
export function readDirectoryMetadata(directory: string): Promise<fs.Dirent<string>[]> {
  return filesystemMetadata(
    () =>
      new Promise<fs.Dirent<string>[]>((resolve, reject) => {
        fs.readdir(directory, { withFileTypes: true }, (error, entries) => {
          if (error) reject(error);
          else resolve(entries);
        });
      })
  );
}

/**
 * Reserve a shared descriptor/buffer slot through operation cleanup.
 * @param operation - Open, stream and finally close one descriptor.
 * @returns Completed operation result.
 * @throws Operation errors after its descriptor cleanup finishes.
 */
export async function withFilesystemStream<T>(operation: () => Promise<T>): Promise<T> {
  const slot = await reserve(filesystemBatchSize, filesystemStreamLimit);
  try {
    return await operation();
  } finally {
    release(slot);
  }
}
