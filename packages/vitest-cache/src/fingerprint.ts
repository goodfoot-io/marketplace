/**
 * Compute phase-scoped content keys from declared leaves, executables and package closure.
 *
 * @summary Compute phase-scoped content keys from declared leaves, executables and package closure.
 */
import { execFile } from 'node:child_process';
import { createHash, hash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { DigestStore } from './digest-store.ts';
import { errnoCode } from './errors.ts';
import {
  batchedMap,
  filesystemMetadata,
  lstatMetadata,
  physicalPath,
  readDirectoryMetadata
} from './filesystem-batch.ts';
import { readContent } from './filesystem-content.ts';
import { createPackagePhase } from './package-closure.ts';

const executeFile = promisify(execFile);

function digest(value: string) {
  return hash('sha256', value, 'hex');
}

/**
 * Expand a directory into leaf entries, writing logical paths under `prefix` even when the bytes physically live elsewhere (a symlinked directory expands its target's members under the link's own path). `ancestorsReal` is the set of already-visited realpaths on this branch, used to reject a symlink that would recurse into itself.
 *
 * @param physicalDirectory - Physical directory containing effective bytes.
 * @param prefix - Logical repository-relative leaf prefix.
 * @param results - Mutable leaf set.
 * @param ancestorsReal - Ancestor realpaths used to reject recursive directory symlinks.
 * @throws For cycles, unsupported member types or filesystem errors.
 */
async function expandPhysicalDirectory(
  physicalDirectory: string,
  prefix: string,
  results: Set<string>,
  ancestorsReal: Set<string>
) {
  // Installed residue is not an input, so a folder holding only node_modules
  // is recorded as empty.
  const entries = (await readDirectoryMetadata(physicalDirectory)).filter((entry) => entry.name !== 'node_modules');
  if (entries.length === 0) {
    results.add(`${prefix}/`);
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const childPrefix = `${prefix}/${entry.name}`;
    const childPhysical = path.join(physicalDirectory, entry.name);
    if (entry.isDirectory()) {
      await expandPhysicalDirectory(childPhysical, childPrefix, results, ancestorsReal);
    } else if (entry.isSymbolicLink()) {
      results.add(childPrefix);
      let real: string;
      try {
        real = await physicalPath(childPhysical);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') continue; // dangling symlink: recorded as its own entry only
        throw error;
      }
      let stat: fs.BigIntStats;
      try {
        stat = await lstatMetadata(real);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') continue;
        throw error;
      }
      if (stat.isDirectory()) {
        if (ancestorsReal.has(real)) throw new Error(`declared test input symlink cycle: ${childPrefix}`);
        await expandPhysicalDirectory(real, childPrefix, results, new Set([...ancestorsReal, real]));
      }
    } else if (entry.isFile()) {
      results.add(childPrefix);
    } else {
      throw new Error(`unsupported declared test input: ${childPrefix}`);
    }
  }
}

async function expandGlob(root: string, declaration: string) {
  const matches = fs.promises.glob(declaration, { cwd: root, withFileTypes: false });
  const results = new Set<string>();
  for await (const match of matches) {
    const relative = match.split(path.sep).join('/');
    if (relative.split('/').includes('node_modules')) continue;
    const absolute = path.join(root, match);
    let lstat: fs.BigIntStats;
    try {
      lstat = await lstatMetadata(absolute);
    } catch (error) {
      if (errnoCode(error) === 'ENOENT' || errnoCode(error) === 'ENOTDIR') continue;
      throw error;
    }
    if (lstat.isDirectory()) {
      await expandPhysicalDirectory(absolute, relative, results, new Set([await physicalPath(absolute)]));
    } else if (lstat.isSymbolicLink()) {
      results.add(relative);
      let real: string;
      try {
        real = await physicalPath(absolute);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') continue;
        throw error;
      }
      let stat: fs.BigIntStats;
      try {
        stat = await lstatMetadata(real);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') continue;
        throw error;
      }
      if (stat.isDirectory()) await expandPhysicalDirectory(real, relative, results, new Set([real]));
    } else if (lstat.isFile()) {
      results.add(relative);
    } else {
      throw new Error(`unsupported declared test input: ${relative}`);
    }
  }
  return [...results].sort();
}

async function resolveExecutable(name: string) {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.resolve(directory || '.', name);
    try {
      await filesystemMetadata(() => fs.promises.access(candidate, fs.constants.X_OK));
      const real = await physicalPath(candidate);
      if ((await lstatMetadata(real)).isFile()) return candidate;
    } catch {
      // Continue the same PATH search after inaccessible or non-file candidates.
    }
  }
  return undefined;
}

/**
 * One phase of input fingerprinting, scoped to a single Vitest cache-key
 * computation phase: before global setup, after global setup, and at
 * publication each get their own phase, and each re-verifies its inputs
 * rather than trusting an earlier phase's memoized value.
 *
 * Every glob expansion, file digest and executable digest is memoized once
 * per phase, so common declared inputs (baseline files, executables) shared
 * by many test files in one run reuse phase observations. Actual file
 * bytes are read through `store`, a DigestStore, which additionally
 * persists stat-validated digests across phases and processes.
 */
export class FingerprintPhase {
  readonly root: string;
  readonly store: DigestStore;
  private rootObservation: Promise<string> | null = null;
  readonly pendingGlobs = new Map<string, Promise<string[]>>();
  readonly globMemo = new Map<string, string[]>();
  readonly pendingFiles = new Map<string, Promise<string>>();
  readonly pendingExecutables = new Map<string, Promise<string>>();
  readonly fileDigestMemo = new Map<string, string>();
  readonly executableMemo = new Map<string, string>();
  packagePhase: ReturnType<typeof createPackagePhase> | null = null;
  readonly counters = { filesRead: 0, globs: 0, executables: 0 };
  readonly start = Date.now();

  /**
   * Create fresh fingerprint observations against the supplied phase digest store.
   * @param repositoryRoot - Physical repository root for safe relative input expansion.
   * @param root0 - Required phase-local content store.
   * @param root0.store - Stat-validated digest store whose observations share this phase.
   * @throws When no store is supplied.
   */
  constructor(repositoryRoot: string, { store }: { store: DigestStore }) {
    if (!store) throw new Error('FingerprintPhase requires a digest store');
    this.root = path.resolve(repositoryRoot);
    this.store = store;
  }

  private async physicalRoot(): Promise<string> {
    this.rootObservation ??= physicalPath(this.root);
    const observation = this.rootObservation;
    try {
      return await observation;
    } catch (error) {
      if (this.rootObservation === observation) this.rootObservation = null;
      throw error;
    }
  }

  private async leaves(declaration: string): Promise<string[]> {
    const completed = this.globMemo.get(declaration);
    if (completed) return completed;
    const pending = this.pendingGlobs.get(declaration);
    if (pending) return pending;
    this.counters.globs++;
    const operation = this.physicalRoot().then((root) => expandGlob(root, declaration));
    this.pendingGlobs.set(declaration, operation);
    try {
      const value = await operation;
      this.globMemo.set(declaration, value);
      return value;
    } finally {
      this.pendingGlobs.delete(declaration);
    }
  }

  /**
   * Expand safe declared globs into sorted unique logical leaves, memoized per phase.
   *
   * @param declarations - Repository-relative input globs.
   * @returns Sorted unique effective leaves including empty directory/link markers.
   * @throws For absolute/parent traversal declarations, cycles, unsupported members or unexpected filesystem failures.
   */
  async expand(declarations: string[]) {
    const results = new Set<string>();
    for (const declaration of declarations) {
      if (path.isAbsolute(declaration) || declaration.split(/[\\/]/).includes('..')) {
        throw new Error(`unsafe declared test input: ${declaration}`);
      }
      for (const leaf of await this.leaves(declaration)) results.add(leaf);
    }
    return [...results].sort();
  }

  /**
   * Memoize one logical-path digest computation per phase, including missing/directory markers.
   *
   * @param relative - Logical repository-relative input path.
   * @returns Effective content/link digest or explicit missing/directory marker.
   * @throws For unsupported input or filesystem failure.
   */
  async fileDigest(relative: string): Promise<string> {
    const memoized = this.fileDigestMemo.get(relative);
    if (memoized !== undefined) return memoized;
    const pending = this.pendingFiles.get(relative);
    if (pending) return pending;
    this.counters.filesRead++;
    const operation = this.computeFileDigest(relative);
    this.pendingFiles.set(relative, operation);
    try {
      const value = await operation;
      this.fileDigestMemo.set(relative, value);
      return value;
    } finally {
      this.pendingFiles.delete(relative);
    }
  }

  /**
   * Observe effective path/link bytes without the phase memo.
   *
   * @param relative - Logical input path.
   * @returns Effective digest or explicit missing/directory/link marker.
   * @throws For unsupported member or filesystem failure.
   */
  async computeFileDigest(relative: string): Promise<string> {
    if (relative.endsWith('/')) return 'directory';
    const absolute = path.join(await this.physicalRoot(), relative);
    let lstat: fs.BigIntStats;
    try {
      lstat = await lstatMetadata(absolute);
    } catch (error) {
      if (errnoCode(error) === 'ENOENT' || errnoCode(error) === 'ENOTDIR') return 'missing';
      throw error;
    }
    if (lstat.isSymbolicLink()) {
      const link = await filesystemMetadata(() => fs.promises.readlink(absolute));
      let real: string;
      try {
        real = await physicalPath(absolute);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') return `link\0${link}\0missing`;
        throw error;
      }
      let stat: fs.BigIntStats;
      try {
        stat = await lstatMetadata(real);
      } catch (error) {
        if (errnoCode(error) === 'ENOENT' || errnoCode(error) === 'ENOTDIR') return `link\0${link}\0missing`;
        throw error;
      }
      // A directory target's members are already covered as their own leaf
      // entries under the link path by expand(); record only the link text.
      if (stat.isDirectory()) return `link\0${link}\0directory`;
      return `link\0${link}\0${await this.store.fileDigest(real)}`;
    }
    if (lstat.isFile()) return this.store.fileDigest(absolute);
    throw new Error(`unsupported test input: ${relative}`);
  }

  /**
   * Collect sorted graph/declared leaf digests; phase reuse may avoid physical byte reads.
   *
   * @param files - Repository-local graph file paths.
   * @param declarations - Additional safe declared globs.
   * @returns Sorted path/digest map including missing/directory markers.
   * @throws For unsafe paths, unsupported members or fingerprint failures.
   */
  async inputDigests(files: string[], declarations: string[] = []): Promise<Map<string, string>> {
    const declared = await this.expand(declarations);
    // Values stay `string`: each is a local cache key outside the owner payload digest rules, so none is a `CanonicalSha256Digest`. The forms are the file content hash (SHA-256 lowercase hex), the markers `missing` and `directory`, and the symlink tokens `link\0<target>\0missing`, `link\0<target>\0directory` and `link\0<target>\0<hex>`, which are hash-preimage text, not digests.
    const leaves = [...new Set([...files, ...declared])].sort();
    const entries = await batchedMap(leaves, async (file): Promise<[string, string]> => {
      if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error(`unsafe test input: ${file}`);
      return [file, await this.fileDigest(file)];
    });
    return new Map(entries);
  }

  /**
   * Digest graph files plus declared globs. Glob membership is hashed, so additions and removals both invalidate.
   *
   * @param files - Repository-local graph file paths.
   * @param declarations - Declared input glob text.
   * @returns Canonical input digest covering declaration text and effective leaf membership/content.
   */
  async graphDigest(files: string[], declarations: string[] = []) {
    return inputsDigest(await this.inputDigests(files, declarations), declarations);
  }

  /**
   * Fingerprint resolved executable bytes and selected rustup target when applicable.
   *
   * @param name - Executable basename resolved through PATH.
   * @returns Phase-memoized exact executable digest.
   * @throws For missing executable or read/rustup resolution failure.
   */
  async executableDigest(name: string): Promise<string> {
    const memoized = this.executableMemo.get(name);
    if (memoized !== undefined) return memoized;
    const pending = this.pendingExecutables.get(name);
    if (pending) return pending;
    this.counters.executables++;
    const operation = this.computeExecutableDigest(name);
    this.pendingExecutables.set(name, operation);
    try {
      const value = await operation;
      this.executableMemo.set(name, value);
      return value;
    } finally {
      this.pendingExecutables.delete(name);
    }
  }

  private async computeExecutableDigest(name: string): Promise<string> {
    const file = await resolveExecutable(name);
    if (!file) throw new Error(`missing test executable: ${name}`);
    const parts = [name, await this.store.fileDigest(file)];
    if (['cargo', 'rustc', 'rustfmt'].includes(name) && path.basename(await physicalPath(file)) === 'rustup') {
      const selected = (
        await executeFile(await physicalPath(file), ['which', name], { encoding: 'utf8' })
      ).stdout.trim();
      parts.push(await this.store.fileDigest(selected));
    }
    const value = digest(parts.join('\0'));
    return value;
  }

  /**
   * Fingerprint unique executables and relevant Cargo config bytes.
   *
   * @param names - Declared executable names.
   * @returns Canonical executable/config digest.
   * @throws For missing executables or filesystem/command failure.
   */
  async executablesDigest(names: string[]) {
    const rust = names.some((name) => ['cargo', 'rustc', 'rustfmt', 'worker-build'].includes(name));
    const hash = createHash('sha256');
    for (const name of [...new Set(names)].sort()) {
      hash.update(await this.executableDigest(name));
      hash.update('\0');
    }
    if (rust) {
      for (const directory of new Set(
        [path.join(os.homedir(), '.cargo'), process.env.CARGO_HOME].filter((value): value is string => Boolean(value))
      )) {
        for (const filename of ['config', 'config.toml']) {
          const file = path.join(directory, filename);
          hash.update(filename);
          hash.update('\0');
          try {
            hash.update(await readContent(file));
          } catch (error) {
            if (errnoCode(error) !== 'ENOENT' && errnoCode(error) !== 'ENOTDIR') throw error;
            hash.update('missing');
          }
          hash.update('\0');
        }
      }
    }
    return hash.digest('hex');
  }

  /**
   * Lazily share one installed-package closure phase.
   *
   * @returns Phase-local packageRoots/closure operations.
   */
  packages() {
    if (!this.packagePhase) this.packagePhase = createPackagePhase(this.root, this.store);
    return this.packagePhase;
  }

  /**
   * Phase timings and counters. filesRead counts logical-path digest computations,
   * including missing/directory markers; bytesRead/filesStatted come from DigestStore
   * and describe actual byte reads/stat calls, not every key observation.
   * @returns Current counters and elapsed wall milliseconds.
   */
  get stats() {
    return {
      filesRead: this.counters.filesRead,
      globs: this.counters.globs,
      executables: this.counters.executables,
      ms: Date.now() - this.start,
      ...this.store.stats
    };
  }
}

/**
 * The `inputs` key component: the declarations' own text, then every input path with its digest (`FingerprintPhase.inputDigests`).
 *
 * @param digests - Sorted per-input digest map.
 * @param declarations - Declaration text, sorted for hashing but not deduplicated by this function.
 * @returns Canonical SHA-256 input component digest.
 */
export function inputsDigest(digests: Map<string, string>, declarations: string[]) {
  const hash = createHash('sha256');
  hash.update('vitest-file-inputs-v2\0');
  for (const declaration of [...declarations].sort()) {
    hash.update(declaration);
    hash.update('\0');
  }
  for (const [file, value] of digests) {
    hash.update(file);
    hash.update('\0');
    hash.update(value);
    hash.update('\0');
  }
  return hash.digest('hex');
}

/**
 * One-shot graphDigest with a fresh phase and a memory-only store.
 *
 * @param repositoryRoot - Physical repository root.
 * @param files - Graph file paths.
 * @param declarations - Additional declared input globs.
 * @returns Fresh memory-only canonical input digest.
 */
export async function fingerprintFiles(repositoryRoot: string, files: string[], declarations: string[] = []) {
  const phase = new FingerprintPhase(await physicalPath(repositoryRoot), { store: new DigestStore(null) });
  return phase.graphDigest(files, declarations);
}
