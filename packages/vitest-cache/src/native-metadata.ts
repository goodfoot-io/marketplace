/**
 * Portable Node-API batches of authoritative physical metadata verification.
 * @summary Copy native inputs and retain the shared filesystem concurrency bound.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import type { StatEntry } from './digest-store.ts';
import { filesystemBatchSize, filesystemMetadata } from './filesystem-batch.ts';

/**
 * Load a required platform-local addon with an actionable disabled-install diagnostic.
 * @returns Checked dynamically loaded addon value.
 * @throws When the platform or required compiled addon is unavailable.
 */
function loadNative(): unknown {
  if (process.platform !== 'linux' && process.platform !== 'darwin') {
    throw new Error('vitest-cache native metadata requires Linux or macOS');
  }
  try {
    return createRequire(import.meta.url)('../build/Release/metadata.node');
  } catch (cause) {
    throw new Error(
      'Required vitest-cache native metadata is unavailable; enable install scripts and install with a C11 compiler',
      { cause }
    );
  }
}
const loaded = loadNative();
if (typeof loaded !== 'object' || loaded === null || !('check' in loaded) || typeof loaded.check !== 'function') {
  throw new Error('Required native metadata addon has an invalid interface');
}
const check = loaded.check;
const signedMinimum = -(1n << 63n);
const signedMaximum = (1n << 63n) - 1n;
const unsignedMaximum = (1n << 64n) - 1n;
const metadataFields: (keyof Pick<StatEntry, 'dev' | 'ino' | 'size' | 'mode' | 'mtimeNs' | 'ctimeNs'>)[] = [
  'dev',
  'ino',
  'size',
  'mode',
  'mtimeNs',
  'ctimeNs'
];

/** Result of freshly checking every member; counts successful physical observations. */
export type MetadataVerification = { matches: boolean; checked: number };

/**
 * Check each physical member, freshly resolving effective symlink targets.
 * @param directory - Physical installed package directory.
 * @param members - Ordered canonical metadata from the earlier snapshot.
 * @returns Fresh equality and number of successful lstat observations.
 * @throws Native filesystem errors after the complete started batch drains.
 */
export async function verifyNativeMetadata(
  directory: string,
  members: readonly StatEntry[]
): Promise<MetadataVerification> {
  let matches = true;
  const prepared: { paths: string[]; targets: Buffer; baseline: Buffer; length: number }[] = [];
  for (let offset = 0; offset < members.length; offset += filesystemBatchSize) {
    const batch = members.slice(offset, offset + filesystemBatchSize);
    const paths: string[] = [];
    const targets = Buffer.alloc(batch.length);
    const baseline = Buffer.alloc(batch.length * 48);
    for (const [index, member] of batch.entries()) {
      const kind = Number(BigInt(member.mode) & 0o170000n);
      const type =
        kind === 0o120000 ? 'symlink' : kind === 0o040000 ? 'directory' : kind === 0o100000 ? 'file' : 'other';
      if (type !== member.type) matches = false;
      const target = member.relative.endsWith('\0target');
      targets[index] = target ? 1 : 0;
      paths.push(path.join(directory, target ? member.relative.slice(0, -7) : member.relative));
      for (const [fieldIndex, field] of metadataFields.entries()) {
        const value = BigInt(member[field]);
        const timestamp = field === 'mtimeNs' || field === 'ctimeNs';
        const minimum = timestamp ? signedMinimum : 0n;
        const maximum = timestamp || field === 'size' ? signedMaximum : unsignedMaximum;
        if (value < minimum || value > maximum) return { matches: false, checked: 0 };
        baseline.writeBigUInt64LE(BigInt.asUintN(64, value), index * 48 + fieldIndex * 8);
      }
    }
    prepared.push({ paths, targets, baseline, length: batch.length });
  }
  // Batches are independent observations: issue them together so the shared permit budget, not
  // one-at-a-time round trips, bounds concurrency, and drain every started batch before failing.
  const settled = await Promise.allSettled(
    prepared.map((batch) => filesystemMetadata(() => check(batch.paths, batch.targets, batch.baseline)))
  );
  let checked = 0;
  for (const [index, result] of settled.entries()) {
    if (result.status === 'rejected') throw result.reason;
    const observed: unknown = result.value;
    const length = prepared[index]?.length ?? 0;
    if (
      typeof observed !== 'object' ||
      observed === null ||
      !('matches' in observed) ||
      typeof observed.matches !== 'boolean' ||
      !('checked' in observed) ||
      typeof observed.checked !== 'number' ||
      !Number.isInteger(observed.checked) ||
      observed.checked < 0 ||
      observed.checked > length
    )
      throw new Error('Invalid native metadata result');
    matches &&= observed.matches;
    checked += observed.checked;
  }
  return { matches, checked };
}
