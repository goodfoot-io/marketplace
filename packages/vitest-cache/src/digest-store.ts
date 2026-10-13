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
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { errnoCode } from './errors.ts';
import { currentUid } from './publication.ts';

const schemaVersion = 3;
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^-?\d+$/.test(value);
}

function isStatEntry(value: unknown): value is StatEntry {
  if (!isObject(value) || typeof value.relative !== 'string') return false;
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

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
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
 * @returns Verified earlier member metadata or null when unavailable, recent or changed.
 * @throws For filesystem failures other than absent/not-directory members.
 */
function verifyTreeSnapshot(
  directory: string,
  snapshot: TreeSnapshot | null | undefined,
  counters: Counters
): StatEntry[] | null {
  if (!snapshot) return null;
  const threshold = BigInt(snapshot.recordedAtNs) - racyWindowNs;
  for (const member of [snapshot.root, ...snapshot.members]) {
    // A directory's timestamps establish that its member list has not changed.
    // Recent directory timestamps cannot establish that under a coarse clock.
    if (member.type === 'directory' && (BigInt(member.mtimeNs) > threshold || BigInt(member.ctimeNs) > threshold))
      return null;
    const isTarget = member.relative.endsWith('\0target');
    const relative = isTarget ? member.relative.slice(0, -7) : member.relative;
    let filename = path.join(directory, relative);
    try {
      if (isTarget) filename = fs.realpathSync.native(filename);
      const stat = fs.lstatSync(filename, { bigint: true, throwIfNoEntry: false });
      counters.filesStatted++;
      if (!stat || JSON.stringify(statEntry(member.relative, stat)) !== JSON.stringify(member)) return null;
    } catch (error) {
      if (errnoCode(error) === 'ENOENT' || errnoCode(error) === 'ENOTDIR') return null;
      throw error;
    }
  }
  return snapshot.members;
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
function walkTree(
  directory: string,
  relative: string,
  options: { skip: Skip | undefined; hash: Hash | null; members: StatEntry[]; counters: Counters }
) {
  const { skip, hash, members, counters } = options;
  counters.directoriesRead++;
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length === 0) return;
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.endsWith('.tsbuildinfo')) continue;
    if (skip?.(entry.name)) continue;
    const member = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    const stat = fs.lstatSync(absolute, { bigint: true });
    counters.filesStatted++;
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
        const bytes = fs.readFileSync(absolute);
        counters.bytesRead += bytes.length;
        hash.update(bytes);
      }
    } else if (stat.isDirectory()) {
      if (hash) {
        hash.update('directory\0');
        hash.update(String(stat.mode & 0o777n));
        hash.update('\0');
      }
      walkTree(absolute, member, options);
    } else if (stat.isSymbolicLink()) {
      const target = fs.realpathSync.native(absolute);
      const targetStat = fs.lstatSync(target, { bigint: true });
      counters.filesStatted++;
      members.push(statEntry(`${member}\u0000target`, targetStat));
      // create-worktree links installed members back to the source checkout.
      // Hash effective bytes so an equivalent installation has the same key.
      if (targetStat.isFile()) {
        if (hash) {
          hash.update('file\0');
          hash.update(String(targetStat.mode & 0o777n));
          hash.update('\0');
          const bytes = fs.readFileSync(target);
          counters.bytesRead += bytes.length;
          hash.update(bytes);
        }
      } else if (targetStat.isDirectory()) {
        if (hash) {
          hash.update('directory\0');
          hash.update(String(targetStat.mode & 0o777n));
          hash.update('\0');
        }
        walkTree(target, member, options);
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
  readyFolder() {
    const folder = this.folder;
    if (folder === null) throw new Error('digest store has no persistent folder');
    if (this.folderReady) return folder;
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(folder);
    if (!stat.isDirectory()) throw new Error(`digest store path is not a directory: ${folder}`);
    if (stat.uid !== currentUid()) throw new Error(`digest store folder not owned by current user: ${folder}`);
    if ((stat.mode & 0o022) !== 0) throw new Error(`digest store folder is group- or other-writable: ${folder}`);
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
  readRecord(id: string): DigestRecord | null {
    if (this.memory) return this.memory.get(id) ?? null;
    const folder = this.readyFolder();
    const file = path.join(folder, `${id}.json`);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(file);
    } catch (error) {
      if (errnoCode(error) === 'ENOENT') return null;
      throw error;
    }
    if (!stat.isFile() || stat.uid !== currentUid() || (stat.mode & 0o022) !== 0) return null;
    try {
      const record: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      return isDigestRecord(record) ? record : null;
    } catch (error) {
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  }

  /**
   * Persist digest metadata in memory or exclusive temporary-file rename.
   *
   * @param id - Original digest record ID.
   * @param record - Exact stat signature/content digest and record time.
   * @throws For persistent folder validation or write/rename failure.
   */
  writeRecord(id: string, record: DigestRecord) {
    if (this.memory) {
      this.memory.set(id, record);
      return;
    }
    const folder = this.readyFolder();
    const file = path.join(folder, `${id}.json`);
    const temporary = path.join(folder, `.${randomUUID()}.tmp`);
    fs.writeFileSync(temporary, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  }

  /**
   * Compute or stat-validate the effective file/mode digest, memoized in this phase.
   *
   * @param absolutePath - Absolute physical input path.
   * @returns SHA-256 digest of mode and file bytes after symlink resolution.
   * @throws For unsupported nonfile input or filesystem failure.
   */
  fileDigest(absolutePath: string) {
    const key = path.resolve(absolutePath);
    const memoized = this.fileMemo.get(key);
    if (memoized !== undefined) return memoized;
    const members: StatEntry[] = [];
    const lstat = fs.lstatSync(key, { bigint: true });
    this.stats.filesStatted++;
    members.push(statEntry('.', lstat));
    let finalPath = key;
    let finalStat = lstat;
    if (lstat.isSymbolicLink()) {
      finalPath = fs.realpathSync.native(key);
      finalStat = fs.lstatSync(finalPath, { bigint: true });
      this.stats.filesStatted++;
      members.push(statEntry('.\u0000target', finalStat));
    }
    if (!finalStat.isFile()) throw new Error(`unsupported digest input: ${absolutePath}`);
    const signature = digest(JSON.stringify(members));
    const id = recordId('file', key);
    const record = this.readRecord(id);
    if (reusable(record, members, signature)) {
      this.stats.reused++;
      this.fileMemo.set(key, record.digest);
      return record.digest;
    }
    const bytes = fs.readFileSync(finalPath);
    this.stats.bytesRead += bytes.length;
    const hash = createHash('sha256');
    hash.update(String(finalStat.mode & 0o777n));
    hash.update('\0');
    hash.update(bytes);
    const value = hash.digest('hex');
    this.stats.computed++;
    this.writeRecord(id, { schema: schemaVersion, path: key, signature, digest: value, recordedAtNs: String(nowNs()) });
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
  treeDigest(directoryPath: string, { skip }: { skip?: Skip } = {}) {
    const directory = fs.realpathSync.native(directoryPath);
    const memoized = skip ? undefined : this.treeMemo.get(directory);
    if (memoized !== undefined) return memoized;
    const id = recordId('tree', directory);
    const candidate = skip ? null : this.readRecord(id);
    const record = candidate?.path === directory ? candidate : null;
    if (record) {
      const counters = { filesStatted: 0, bytesRead: 0, directoriesRead: 0 };
      const snapshot = this.treeSnapshots.get(directory) ?? record.inventory;
      let members = verifyTreeSnapshot(directory, snapshot, counters);
      let observedRoot: StatEntry | undefined;
      if (!members) {
        observedRoot = statEntry('.', fs.lstatSync(directory, { bigint: true }));
        counters.filesStatted++;
        members = [];
        walkTree(directory, '', { skip, hash: null, members, counters });
      }
      this.stats.filesStatted += counters.filesStatted;
      this.stats.directoriesRead += counters.directoriesRead;
      const signature = digest(JSON.stringify(members));
      if (reusable(record, members, signature)) {
        this.stats.reused++;
        this.treeMemo.set(directory, record.digest);
        if (!skip && members !== snapshot?.members) this.rememberTree(directory, members, observedRoot);
        return record.digest;
      }
    }
    const hash = createHash('sha256');
    hash.update('vitest-tree-digest-v2\0');
    const freshMembers: StatEntry[] = [];
    const freshCounters = { filesStatted: 0, bytesRead: 0, directoriesRead: 0 };
    const freshRoot = statEntry('.', fs.lstatSync(directory, { bigint: true }));
    freshCounters.filesStatted++;
    walkTree(directory, '', { skip, hash, members: freshMembers, counters: freshCounters });
    this.stats.filesStatted += freshCounters.filesStatted;
    this.stats.directoriesRead += freshCounters.directoriesRead;
    this.stats.bytesRead += freshCounters.bytesRead;
    const value = hash.digest('hex');
    this.stats.computed++;
    const freshSignature = digest(JSON.stringify(freshMembers));
    if (!skip) {
      const inventory = this.rememberTree(directory, freshMembers, freshRoot);
      this.writeRecord(id, {
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
  rememberTree(directory: string, members: StatEntry[], observedRoot?: StatEntry) {
    const root = observedRoot ?? statEntry('.', fs.lstatSync(directory, { bigint: true }));
    if (!observedRoot) this.stats.filesStatted++;
    const snapshot = { root, members, recordedAtNs: String(nowNs()) };
    this.treeSnapshots.set(directory, snapshot);
    return snapshot;
  }
}
