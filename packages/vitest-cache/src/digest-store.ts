/**
 * Persistent, stat-validated content digests.
 *
 * Records are metadata verification, not a lockfile shortcut: content is
 * re-read whenever a member's on-disk metadata (device, inode, size, mode,
 * mtime or ctime) changes. A record is trusted only when every member's
 * newest timestamp is at least racyWindowNs older than when the record was
 * written, mirroring Git's racily-clean index rule -- a file touched within
 * the same coarse clock tick as the record is re-read rather than trusted.
 *
 * One DigestStore instance reuses completed path digests within a phase.
 * Tree verification and fresh inventory recording can perform additional stats;
 * memoization does not freeze concurrent filesystem changes.
 * @summary Reuse content digests only after stat signatures and racy timestamp checks.
 */

import type { Hash } from 'node:crypto';
import { createHash, hash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { errnoCode } from './errors.ts';
import {
  batchedMap,
  filesystemMetadata,
  lstatMetadata,
  physicalPath,
  readDirectoryMetadata,
  withFilesystemStream
} from './filesystem-batch.ts';
import { readContent } from './filesystem-content.ts';
import { verifyNativeMetadata } from './native-metadata.ts';
import { currentUid } from './publication.ts';

const schemaVersion = 4;
const statEntryFields = ['relative', 'type', 'dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode'];
const racyWindowNs = 2_000_000_000n;

/** Canonical observed physical metadata strings used for stat signature/racy-window verification; not a filesystem immutability lock. */
export type StatEntry = {
  relative: string;
  type: string;
  dev: string;
  ino: string;
  size: string;
  mtimeNs: string;
  ctimeNs: string;
  mode: string;
};
/** One persisted path record; `digest` is a local cache key (SHA-256 lowercase hex of the file content), outside the owner payload digest rules. */
type DigestRecord = {
  schema: number;
  path: string;
  signature: string;
  digest: string;
  recordedAtNs: string;
  inventory?: TreeSnapshot;
};
/** Previously observed directory/member metadata and record time requiring fresh verification before reuse. */
export type TreeSnapshot = { root: StatEntry; members: StatEntry[]; recordedAtNs: string };
type Counters = { filesStatted: number; bytesRead: number; directoriesRead: number };
type Skip = (name: string) => boolean;
type ParsedRecord = { source: Buffer; record: DigestRecord | null };

// Pure descriptions only: callers still check record ownership and read its
// current bytes before consulting this bounded, process-local parsing cache.
const parsedRecords = new Map<string, ParsedRecord>();
const maximumParsedSourceBytes = 8 * 1024 * 1024;
const maximumParsedRecords = 512;
let parsedSourceBytes = 0;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^-?\d+$/.test(value);
}

function isStatEntry(value: unknown): value is StatEntry {
  if (!isObject(value) || typeof value.relative !== 'string') return false;
  const fields = Object.keys(value);
  if (fields.length !== statEntryFields.length || !fields.every((field, index) => field === statEntryFields[index]))
    return false;
  const relative = value.relative.endsWith('\0target') ? value.relative.slice(0, -7) : value.relative;
  if (relative !== '.' && relative.split('/').some((part) => !part || part === '.' || part === '..')) return false;
  if (relative.includes('\\') || relative.includes('\0') || path.isAbsolute(relative)) return false;
  return (
    typeof value.type === 'string' &&
    ['file', 'directory', 'symlink'].includes(value.type) &&
    [value.dev, value.ino, value.size, value.mtimeNs, value.ctimeNs, value.mode].every(isTimestamp)
  );
}

function isTreeSnapshot(value: unknown): value is TreeSnapshot {
  return (
    isObject(value) &&
    isStatEntry(value.root) &&
    value.root.relative === '.' &&
    value.root.type === 'directory' &&
    Array.isArray(value.members) &&
    value.members.every(isStatEntry) &&
    value.members.every((member) => member.relative !== '.') &&
    isTimestamp(value.recordedAtNs)
  );
}

function isDigestRecord(value: unknown): value is DigestRecord {
  return (
    isObject(value) &&
    value.schema === schemaVersion &&
    typeof value.path === 'string' &&
    typeof value.signature === 'string' &&
    /^[a-f0-9]{64}$/.test(value.signature) &&
    typeof value.digest === 'string' &&
    /^[a-f0-9]{64}$/.test(value.digest) &&
    isTimestamp(value.recordedAtNs) &&
    (value.inventory === undefined || isTreeSnapshot(value.inventory))
  );
}

function freezeRecord(record: DigestRecord) {
  const pending: unknown[] = [record];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== 'object' || value === null) continue;
    Object.freeze(value);
    for (const nested of Object.values(value)) pending.push(nested);
  }
  return record;
}

function forgetParsedRecord(filename: string) {
  const previous = parsedRecords.get(filename);
  if (previous) {
    parsedSourceBytes -= previous.source.length;
    parsedRecords.delete(filename);
  }
}

function parseRecord(filename: string, source: Buffer): DigestRecord | null {
  const previous = parsedRecords.get(filename);
  if (previous?.source.equals(source)) {
    parsedRecords.delete(filename);
    parsedRecords.set(filename, previous);
    return previous.record;
  }
  forgetParsedRecord(filename);
  let record: DigestRecord | null = null;
  try {
    const value: unknown = JSON.parse(source.toString('utf8'));
    if (isDigestRecord(value)) record = freezeRecord(value);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  if (source.length > maximumParsedSourceBytes) return record;
  while (parsedRecords.size >= maximumParsedRecords || parsedSourceBytes + source.length > maximumParsedSourceBytes) {
    const oldest = parsedRecords.keys().next().value;
    if (oldest === undefined) break;
    forgetParsedRecord(oldest);
  }
  parsedRecords.set(filename, { source, record });
  parsedSourceBytes += source.length;
  return record;
}

function digest(value: string) {
  return hash('sha256', value, 'hex');
}

function recordId(kind: string, subjectPath: string) {
  return digest(`${kind}\0${subjectPath}`);
}

function statEntry(relative: string, stat: fs.BigIntStats): StatEntry {
  return {
    relative,
    type: stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    size: stat.size.toString(),
    mtimeNs: stat.mtimeNs.toString(),
    ctimeNs: stat.ctimeNs.toString(),
    mode: stat.mode.toString()
  };
}

async function hashFileAsync(filename: string, observed: fs.BigIntStats, hash: Hash, counters: Counters) {
  await withFilesystemStream(async () => {
    await hashFileAsyncReserved(filename, observed, hash, counters);
  });
}

async function hashFileAsyncReserved(filename: string, observed: fs.BigIntStats, hash: Hash, counters: Counters) {
  const verify = (stat: fs.BigIntStats) => {
    counters.filesStatted++;
    if (
      !stat.isFile() ||
      stat.dev !== observed.dev ||
      stat.ino !== observed.ino ||
      stat.size !== observed.size ||
      stat.mode !== observed.mode ||
      stat.mtimeNs !== observed.mtimeNs ||
      stat.ctimeNs !== observed.ctimeNs
    )
      throw new Error(`digest input changed while hashing: ${filename}`);
  };
  const descriptor = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
  try {
    const large = observed.size >= 1_048_576n;
    if (large) verify(await filesystemMetadata(() => descriptor.stat({ bigint: true })));
    // 1 MiB amortizes read calls for native binaries without
    // allocating proportional to file size. Small files need only their size.
    const buffer = Buffer.allocUnsafe(Number(observed.size < 1_048_576n ? observed.size + 1n : 1_048_576n) || 1);
    let total = 0n;
    while (true) {
      const { bytesRead: count } = await descriptor.read(buffer, 0, buffer.length, null);
      if (count === 0) break;
      counters.bytesRead += count;
      total += BigInt(count);
      hash.update(buffer.subarray(0, count));
      if (total > observed.size) throw new Error(`digest input changed while hashing: ${filename}`);
    }
    if (large) verify(await filesystemMetadata(() => descriptor.stat({ bigint: true })));
    verify(await lstatMetadata(filename));
    if (total !== observed.size) throw new Error(`digest input changed while hashing: ${filename}`);
  } finally {
    await descriptor.close();
  }
}

function nowNs() {
  return BigInt(Date.now()) * 1_000_000n;
}

function reusable(record: DigestRecord | null, members: StatEntry[], signature: string): record is DigestRecord {
  if (!record || record.signature !== signature) return false;
  const threshold = BigInt(record.recordedAtNs) - racyWindowNs;
  return members.every((member) => {
    const mtime = BigInt(member.mtimeNs);
    const ctime = BigInt(member.ctimeNs);
    return (mtime > ctime ? mtime : ctime) <= threshold;
  });
}

/**
 * Verify a previous walk without enumerating unchanged directories again.
 *
 * @param directory - Physical installed package directory.
 * @param snapshot - Earlier directory/member metadata snapshot, when available.
 * @param counters - Mutable stat/read counters.
 * @returns Verified earlier root and member metadata or null when unavailable, recent or changed.
 * @throws For filesystem failures other than absent/not-directory members.
 */
async function verifyTreeSnapshot(
  directory: string,
  snapshot: TreeSnapshot | null | undefined,
  counters: Counters
): Promise<TreeSnapshot | null> {
  if (!snapshot) return null;
  const threshold = BigInt(snapshot.recordedAtNs) - racyWindowNs;
  const members = [snapshot.root, ...snapshot.members];
  if (
    members.some(
      (member) =>
        member.type === 'directory' && (BigInt(member.mtimeNs) > threshold || BigInt(member.ctimeNs) > threshold)
    )
  )
    return null;
  const observed = await verifyNativeMetadata(directory, members);
  counters.filesStatted += observed.checked;
  return observed.matches ? snapshot : null;
}

/**
 * Enumerate `directory` into `members`; with a `hash`, also hash every member's content.
 *
 * @param directory - Physical directory to enumerate.
 * @param relative - Logical relative path within the installed package.
 * @param options - Traversal skip/hash/member/counter accumulation.
 * @param options.skip - Optional member-name exclusion predicate.
 * @param options.hash - Hash accumulator or null for metadata-only enumeration.
 * @param options.members - Mutable metadata inventory.
 * @param options.counters - Mutable actual stat/byte-read counters.
 * @throws For unsupported members, failed reads or unsupported link targets.
 */
async function walkTree(
  directory: string,
  relative: string,
  options: { skip: Skip | undefined; hash: Hash | null; members: StatEntry[]; counters: Counters }
) {
  const { skip, hash, members, counters } = options;
  counters.directoriesRead++;
  const entries = (await readDirectoryMetadata(directory)).sort((a, b) => a.name.localeCompare(b.name));
  const included = entries.filter(
    (entry) => entry.name !== 'node_modules' && !entry.name.endsWith('.tsbuildinfo') && !skip?.(entry.name)
  );
  const observations = await batchedMap(included, async (entry) => {
    const absolute = path.join(directory, entry.name);
    const stat = await lstatMetadata(absolute);
    counters.filesStatted++;
    return { entry, stat };
  });
  for (const { entry, stat } of observations) {
    const member = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    members.push(statEntry(member, stat));
    if (hash) {
      hash.update(member);
      hash.update('\0');
    }
    if (stat.isFile()) {
      if (hash) {
        hash.update('file\0');
        hash.update(String(stat.mode & 0o777n));
        hash.update('\0');
        await hashFileAsync(absolute, stat, hash, counters);
      }
    } else if (stat.isDirectory()) {
      if (hash) {
        hash.update('directory\0');
        hash.update(String(stat.mode & 0o777n));
        hash.update('\0');
      }
      await walkTree(absolute, member, options);
    } else if (stat.isSymbolicLink()) {
      const target = await physicalPath(absolute);
      const targetStat = await lstatMetadata(target);
      counters.filesStatted++;
      members.push(statEntry(`${member}\u0000target`, targetStat));
      // create-worktree links installed members back to the source checkout.
      // Hash effective bytes so an equivalent installation has the same key.
      if (targetStat.isFile()) {
        if (hash) {
          hash.update('file\0');
          hash.update(String(targetStat.mode & 0o777n));
          hash.update('\0');
          await hashFileAsync(target, targetStat, hash, counters);
        }
      } else if (targetStat.isDirectory()) {
        if (hash) {
          hash.update('directory\0');
          hash.update(String(targetStat.mode & 0o777n));
          hash.update('\0');
        }
        await walkTree(target, member, options);
      } else throw new Error(`unsupported installed package link: ${absolute}`);
    } else throw new Error(`unsupported installed package member: ${absolute}`);
    if (hash) hash.update('\0');
  }
}

/** Phase-scoped effective content hashing backed by optional persistent stat-validated records; concurrent filesystem mutation is not excluded. */
export class DigestStore {
  /**
   * Persistent record folder; null keeps records in memory.
   */
  readonly folder: string | null;
  folderReady = false;
  readonly memory: Map<string, DigestRecord> | null;
  readonly fileMemo = new Map<string, string>();
  readonly treeMemo = new Map<string, string>();
  readonly pendingFiles = new Map<string, Promise<string>>();
  readonly pendingTrees = new Map<string, Promise<string>>();
  readonly treeSnapshots: Map<string, TreeSnapshot>;
  readonly stats = { reused: 0, computed: 0, bytesRead: 0, filesStatted: 0, directoriesRead: 0 };

  /**
   * Create phase-scoped digest observations with optional persistent records.
   * @param folder - Persistent record folder, or null for memory-only records.
   * @param root0 - Optional shared tree metadata snapshots requiring verification.
   * @param root0.treeSnapshots - Earlier phase snapshots, revalidated before reuse.
   */
  constructor(
    folder: string | null,
    { treeSnapshots = new Map() }: { treeSnapshots?: Map<string, TreeSnapshot> } = {}
  ) {
    this.folder = folder ?? null;
    this.memory = this.folder === null ? new Map() : null;
    this.treeSnapshots = treeSnapshots;
  }

  /**
   * The persistent record folder, created and ownership-checked on first use.
   *
   * @returns Owned persistent record folder after write-mode checks.
   * @throws For memory-only store, unsafe ownership/mode or filesystem failure.
   */
  async readyFolder() {
    const folder = this.folder;
    if (folder === null) throw new Error('digest store has no persistent folder');
    if (this.folderReady) return folder;
    await filesystemMetadata(() => fs.promises.mkdir(folder, { recursive: true, mode: 0o700 }));
    const stat = await lstatMetadata(folder);
    if (!stat.isDirectory()) throw new Error(`digest store path is not a directory: ${folder}`);
    if (stat.uid !== BigInt(currentUid())) throw new Error(`digest store folder not owned by current user: ${folder}`);
    if ((stat.mode & 0o022n) !== 0n) throw new Error(`digest store folder is group- or other-writable: ${folder}`);
    this.folderReady = true;
    return folder;
  }

  /**
   * Read a versioned digest metadata record with checked string fields.
   *
   * @param id - Original digest record ID.
   * @returns Validated record or null for absence/unsafe shape or mode.
   * @throws For other filesystem or parsing-related non-SyntaxError failures.
   */
  async readRecord(id: string): Promise<DigestRecord | null> {
    if (this.memory) return this.memory.get(id) ?? null;
    const folder = await this.readyFolder();
    const file = path.resolve(folder, `${id}.json`);
    let stat: fs.BigIntStats;
    try {
      stat = await lstatMetadata(file);
    } catch (error) {
      if (errnoCode(error) === 'ENOENT') return null;
      throw error;
    }
    if (!stat.isFile() || stat.uid !== BigInt(currentUid()) || (stat.mode & 0o022n) !== 0n) return null;
    return parseRecord(file, await readContent(file));
  }

  /**
   * Persist digest metadata in memory or exclusive temporary-file rename.
   *
   * @param id - Original digest record ID.
   * @param record - Exact stat signature/content digest and record time.
   * @throws For persistent folder validation or write/rename failure.
   */
  async writeRecord(id: string, record: DigestRecord) {
    if (this.memory) {
      this.memory.set(id, record);
      return;
    }
    const folder = await this.readyFolder();
    const file = path.join(folder, `${id}.json`);
    const temporary = path.join(folder, `.${randomUUID()}.tmp`);
    try {
      await withFilesystemStream(() =>
        fs.promises.writeFile(temporary, JSON.stringify(record), { flag: 'wx', mode: 0o600 })
      );
      await filesystemMetadata(() => fs.promises.rename(temporary, file));
    } finally {
      await filesystemMetadata(() => fs.promises.rm(temporary, { force: true }));
    }
  }

  /**
   * Compute or stat-validate the effective file/mode digest, memoized in this phase.
   *
   * @param absolutePath - Absolute physical input path.
   * @returns SHA-256 digest of mode and file bytes after symlink resolution.
   * @throws For unsupported nonfile input or filesystem failure.
   */
  async fileDigest(absolutePath: string): Promise<string> {
    const key = path.resolve(absolutePath);
    const pending = this.pendingFiles.get(key);
    if (pending) return pending;
    const operation = this.computeFileDigest(key);
    this.pendingFiles.set(key, operation);
    try {
      return await operation;
    } finally {
      this.pendingFiles.delete(key);
    }
  }

  private async computeFileDigest(key: string): Promise<string> {
    const memoized = this.fileMemo.get(key);
    if (memoized !== undefined) return memoized;
    const members: StatEntry[] = [];
    const lstat = await lstatMetadata(key);
    this.stats.filesStatted++;
    members.push(statEntry('.', lstat));
    let finalPath = key;
    let finalStat = lstat;
    if (lstat.isSymbolicLink()) {
      finalPath = await physicalPath(key);
      finalStat = await lstatMetadata(finalPath);
      this.stats.filesStatted++;
      members.push(statEntry('.\u0000target', finalStat));
    }
    if (!finalStat.isFile()) throw new Error(`unsupported digest input: ${key}`);
    const signature = digest(JSON.stringify(members));
    const id = recordId('file', key);
    const record = await this.readRecord(id);
    if (reusable(record, members, signature)) {
      this.stats.reused++;
      this.fileMemo.set(key, record.digest);
      return record.digest;
    }
    const hash = createHash('sha256');
    hash.update(String(finalStat.mode & 0o777n));
    hash.update('\0');
    await hashFileAsync(finalPath, finalStat, hash, this.stats);
    const value = hash.digest('hex');
    this.stats.computed++;
    await this.writeRecord(id, {
      schema: schemaVersion,
      path: key,
      signature,
      digest: value,
      recordedAtNs: String(nowNs())
    });
    this.fileMemo.set(key, value);
    return value;
  }

  /**
   * Compute or stat-validate canonical installed tree content, preserving effective symlink bytes. Filtered trees bypass persistent inventories and phase memoization.
   *
   * @param directoryPath - Installed package directory.
   * @param root0 - Optional member exclusion predicate.
   * @param root0.skip - Optional member-name exclusion predicate.
   * @returns Canonical SHA-256 tree digest, phase-memoized by real directory.
   * @throws For unsupported members, unsafe persistent folder or filesystem failure; invalid/unsafe individual records are cache misses.
   */
  async treeDigest(directoryPath: string, { skip }: { skip?: Skip } = {}) {
    const directory = await physicalPath(directoryPath);
    if (skip) return this.computeTreeDigest(directory, skip);
    const pending = this.pendingTrees.get(directory);
    if (pending) return pending;
    const operation = this.computeTreeDigest(directory);
    this.pendingTrees.set(directory, operation);
    try {
      return await operation;
    } finally {
      this.pendingTrees.delete(directory);
    }
  }

  /**
   * Observe and hash one physical tree after in-flight operation coalescing.
   * @param directory - Physical package directory.
   * @param skip - Optional member exclusion predicate.
   * @returns Verified effective tree digest.
   * @throws For filesystem observation or content hashing failures.
   */
  private async computeTreeDigest(directory: string, skip?: Skip) {
    const memoized = skip ? undefined : this.treeMemo.get(directory);
    if (memoized !== undefined) return memoized;
    const id = recordId('tree', directory);
    const candidate = skip ? null : await this.readRecord(id);
    const record = candidate?.path === directory ? candidate : null;
    if (record) {
      const counters = { filesStatted: 0, bytesRead: 0, directoriesRead: 0 };
      const snapshot = this.treeSnapshots.get(directory) ?? record.inventory;
      const verified = await verifyTreeSnapshot(directory, snapshot, counters);
      let members: StatEntry[];
      let observedRoot: StatEntry;
      if (verified) {
        members = verified.members;
        observedRoot = verified.root;
      } else {
        observedRoot = statEntry('.', await lstatMetadata(directory));
        counters.filesStatted++;
        members = [];
        await walkTree(directory, '', { skip, hash: null, members, counters });
      }
      this.stats.filesStatted += counters.filesStatted;
      this.stats.directoriesRead += counters.directoriesRead;
      const observed = [observedRoot, ...members];
      const signature = digest(JSON.stringify(observed));
      if (reusable(record, observed, signature)) {
        this.stats.reused++;
        this.treeMemo.set(directory, record.digest);
        if (!skip && members !== snapshot?.members) await this.rememberTree(directory, members, observedRoot);
        return record.digest;
      }
    }
    const hash = createHash('sha256');
    hash.update('vitest-tree-digest-v3\0');
    const freshMembers: StatEntry[] = [];
    const freshCounters = { filesStatted: 0, bytesRead: 0, directoriesRead: 0 };
    const freshRoot = statEntry('.', await lstatMetadata(directory));
    freshCounters.filesStatted++;
    hash.update(`.\0directory\0${BigInt(freshRoot.mode) & 511n}\0`);
    await walkTree(directory, '', { skip, hash, members: freshMembers, counters: freshCounters });
    this.stats.filesStatted += freshCounters.filesStatted;
    this.stats.directoriesRead += freshCounters.directoriesRead;
    this.stats.bytesRead += freshCounters.bytesRead;
    const value = hash.digest('hex');
    this.stats.computed++;
    const freshSignature = digest(JSON.stringify([freshRoot, ...freshMembers]));
    if (!skip) {
      const inventory = await this.rememberTree(directory, freshMembers, freshRoot);
      await this.writeRecord(id, {
        schema: schemaVersion,
        path: directory,
        signature: freshSignature,
        digest: value,
        recordedAtNs: String(nowNs()),
        inventory
      });
    }
    if (!skip) this.treeMemo.set(directory, value);
    return value;
  }

  /**
   * Retain current tree metadata for later stat-verified phases.
   *
   * @param directory - Physical package directory.
   * @param members - Observed canonical member metadata.
   * @param observedRoot - Root observed before enumerating its members, when available.
   * @returns Snapshot retained for later phases or persistent storage.
   * @throws For directory stat failure.
   */
  async rememberTree(directory: string, members: StatEntry[], observedRoot?: StatEntry) {
    const root = observedRoot ?? statEntry('.', await lstatMetadata(directory));
    if (!observedRoot) this.stats.filesStatted++;
    const snapshot = { root, members, recordedAtNs: String(nowNs()) };
    this.treeSnapshots.set(directory, snapshot);
    return snapshot;
  }
}
