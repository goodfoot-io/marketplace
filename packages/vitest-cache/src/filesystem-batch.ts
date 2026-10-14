/**
 * Bounded asynchronous filesystem observations with deterministic result order.
 * @summary Drain each bounded batch before reporting errors.
 */
import fs from 'node:fs';

/** Maximum number of outstanding metadata operations in one batch. */
export const filesystemBatchSize = 32;
let activeObservations = 0;
const waitingObservations: (() => void)[] = [];

async function observeBounded<T, U>(input: T, observe: (input: T) => Promise<U>): Promise<U> {
  if (activeObservations >= filesystemBatchSize)
    await new Promise<void>((resolve) => waitingObservations.push(resolve));
  else activeObservations++;
  try {
    return await observe(input);
  } finally {
    const next = waitingObservations.shift();
    if (next) next();
    else activeObservations--;
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

/** Maximum concurrent streaming descriptors and their at-most-1-MiB buffers. */
export const filesystemStreamLimit = 4;
let activeStreams = 0;
const waitingStreams: (() => void)[] = [];

/**
 * Reserve a shared descriptor/buffer slot through operation cleanup.
 * @param operation - Open, stream and finally close one descriptor.
 * @returns Completed operation result.
 * @throws Operation errors after its descriptor cleanup finishes.
 */
export async function withFilesystemStream<T>(operation: () => Promise<T>): Promise<T> {
  if (activeStreams >= filesystemStreamLimit) await new Promise<void>((resolve) => waitingStreams.push(resolve));
  else activeStreams++;
  try {
    return await operation();
  } finally {
    const next = waitingStreams.shift();
    if (next) next();
    else activeStreams--;
  }
}
