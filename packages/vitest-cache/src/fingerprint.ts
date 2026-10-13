/**
 * Compute phase-scoped content keys from declared leaves, executables and package closure.
 *
 * @summary Compute phase-scoped content keys from declared leaves, executables and package closure.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DigestStore } from './digest-store.ts';
import { errnoCode } from './errors.ts';
import { createPackagePhase } from './package-closure.ts';

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
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
function expandPhysicalDirectory(
  physicalDirectory: string,
  prefix: string,
  results: Set<string>,
  ancestorsReal: Set<string>
) {
  // Installed residue is not an input, so a folder holding only node_modules
  // is recorded as empty.
  const entries = fs
    .readdirSync(physicalDirectory, { withFileTypes: true })
    .filter((entry) => entry.name !== 'node_modules');
  if (entries.length === 0) {
    results.add(`${prefix}/`);
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const childPrefix = `${prefix}/${entry.name}`;
    const childPhysical = path.join(physicalDirectory, entry.name);
    if (entry.isDirectory()) {
      expandPhysicalDirectory(childPhysical, childPrefix, results, ancestorsReal);
    } else if (entry.isSymbolicLink()) {
      results.add(childPrefix);
      let real: string;
      try {
        real = fs.realpathSync.native(childPhysical);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') continue; // dangling symlink: recorded as its own entry only
        throw error;
      }
      let stat: fs.Stats;
      try {
        stat = fs.statSync(real);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') continue;
        throw error;
      }
      if (stat.isDirectory()) {
        if (ancestorsReal.has(real)) throw new Error(`declared test input symlink cycle: ${childPrefix}`);
        expandPhysicalDirectory(real, childPrefix, results, new Set([...ancestorsReal, real]));
      }
    } else if (entry.isFile()) {
      results.add(childPrefix);
    } else {
      throw new Error(`unsupported declared test input: ${childPrefix}`);
    }
  }
}

function expandGlob(root: string, declaration: string) {
  const matches = fs.globSync(declaration, { cwd: root, withFileTypes: false });
  const results = new Set<string>();
  for (const match of matches) {
    const relative = match.split(path.sep).join('/');
    if (relative.split('/').includes('node_modules')) continue;
    const absolute = path.join(root, match);
    const lstat = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (!lstat) continue; // race: glob matched, entry gone since
    if (lstat.isDirectory()) {
      expandPhysicalDirectory(absolute, relative, results, new Set([fs.realpathSync.native(absolute)]));
    } else if (lstat.isSymbolicLink()) {
      results.add(relative);
      let real: string;
      try {
        real = fs.realpathSync.native(absolute);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') continue;
        throw error;
      }
      let stat: fs.Stats;
      try {
        stat = fs.statSync(real);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') continue;
        throw error;
      }
      if (stat.isDirectory()) expandPhysicalDirectory(real, relative, results, new Set([real]));
    } else if (lstat.isFile()) {
      results.add(relative);
    } else {
      throw new Error(`unsupported declared test input: ${relative}`);
    }
  }
  return [...results].sort();
}

function resolveExecutable(name: string) {
  return (process.env.PATH ?? '')
    .split(path.delimiter)
    .map((directory) => path.resolve(directory || '.', name))
    .find((candidate) => {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return fs.statSync(candidate).isFile();
      } catch {
        return false;
      }
    });
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
  readonly globMemo = new Map<string, string[]>();
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
   * @throws When no store is supplied or root realpath fails.
   */
  constructor(repositoryRoot: string, { store }: { store: DigestStore }) {
    if (!store) throw new Error('FingerprintPhase requires a digest store');
    this.root = fs.realpathSync.native(repositoryRoot);
    this.store = store;
  }

  /**
   * Expand safe declared globs into sorted unique logical leaves, memoized per phase.
   *
   * @param declarations - Repository-relative input globs.
   * @returns Sorted unique effective leaves including empty directory/link markers.
   * @throws For absolute/parent traversal declarations, cycles, unsupported members or unexpected filesystem failures.
   */
  expand(declarations: string[]) {
    const results = new Set<string>();
    for (const declaration of declarations) {
      if (path.isAbsolute(declaration) || declaration.split(/[\\/]/).includes('..')) {
        throw new Error(`unsafe declared test input: ${declaration}`);
      }
      let leaves = this.globMemo.get(declaration);
      if (!leaves) {
        this.counters.globs++;
        leaves = expandGlob(this.root, declaration);
        this.globMemo.set(declaration, leaves);
      }
      for (const leaf of leaves) results.add(leaf);
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
  fileDigest(relative: string) {
    const memoized = this.fileDigestMemo.get(relative);
    if (memoized !== undefined) return memoized;
    this.counters.filesRead++;
    const value = this.computeFileDigest(relative);
    this.fileDigestMemo.set(relative, value);
    return value;
  }

  /**
   * Observe effective path/link bytes without the phase memo.
   *
   * @param relative - Logical input path.
   * @returns Effective digest or explicit missing/directory/link marker.
   * @throws For unsupported member or filesystem failure.
   */
  computeFileDigest(relative: string): string {
    if (relative.endsWith('/')) return 'directory';
    const absolute = path.join(this.root, relative);
    const lstat = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (!lstat) return 'missing';
    if (lstat.isSymbolicLink()) {
      const link = fs.readlinkSync(absolute);
      let real: string;
      try {
        real = fs.realpathSync.native(absolute);
      } catch (error: unknown) {
        const code: string | undefined = errnoCode(error);
        if (code === 'ENOENT' || code === 'ENOTDIR') return `link\0${link}\0missing`;
        throw error;
      }
      const stat = fs.statSync(real, { throwIfNoEntry: false });
      if (!stat) return `link\0${link}\0missing`;
      // A directory target's members are already covered as their own leaf
      // entries under the link path by expand(); record only the link text.
      if (stat.isDirectory()) return `link\0${link}\0directory`;
      return `link\0${link}\0${this.store.fileDigest(real)}`;
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
  inputDigests(files: string[], declarations: string[] = []): Map<string, string> {
    const declared = this.expand(declarations);
    // Values stay `string`: each is a local cache key outside the owner payload digest rules, so none is a `CanonicalSha256Digest`. The forms are the file content hash (SHA-256 lowercase hex), the markers `missing` and `directory`, and the symlink tokens `link\0<target>\0missing`, `link\0<target>\0directory` and `link\0<target>\0<hex>`, which are hash-preimage text, not digests.
    const digests = new Map<string, string>();
    for (const file of [...new Set([...files, ...declared])].sort()) {
      if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error(`unsafe test input: ${file}`);
      digests.set(file, this.fileDigest(file));
    }
    return digests;
  }

  /**
   * Digest graph files plus declared globs. Glob membership is hashed, so additions and removals both invalidate.
   *
   * @param files - Repository-local graph file paths.
   * @param declarations - Declared input glob text.
   * @returns Canonical input digest covering declaration text and effective leaf membership/content.
   */
  graphDigest(files: string[], declarations: string[] = []) {
    return inputsDigest(this.inputDigests(files, declarations), declarations);
  }

  /**
   * Fingerprint resolved executable bytes and selected rustup target when applicable.
   *
   * @param name - Executable basename resolved through PATH.
   * @returns Phase-memoized exact executable digest.
   * @throws For missing executable or read/rustup resolution failure.
   */
  executableDigest(name: string) {
    const memoized = this.executableMemo.get(name);
    if (memoized !== undefined) return memoized;
    this.counters.executables++;
    const file = resolveExecutable(name);
    if (!file) throw new Error(`missing test executable: ${name}`);
    const parts = [name, this.store.fileDigest(file)];
    if (['cargo', 'rustc', 'rustfmt'].includes(name) && path.basename(fs.realpathSync.native(file)) === 'rustup') {
      const selected = execFileSync(fs.realpathSync.native(file), ['which', name], { encoding: 'utf8' }).trim();
      parts.push(this.store.fileDigest(selected));
    }
    const value = digest(parts.join('\0'));
    this.executableMemo.set(name, value);
    return value;
  }

  /**
   * Fingerprint unique executables and relevant Cargo config bytes.
   *
   * @param names - Declared executable names.
   * @returns Canonical executable/config digest.
   * @throws For missing executables or filesystem/command failure.
   */
  executablesDigest(names: string[]) {
    const rust = names.some((name) => ['cargo', 'rustc', 'rustfmt', 'worker-build'].includes(name));
    const hash = createHash('sha256');
    for (const name of [...new Set(names)].sort()) {
      hash.update(this.executableDigest(name));
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
          hash.update(fs.existsSync(file) ? fs.readFileSync(file) : 'missing');
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
export function fingerprintFiles(repositoryRoot: string, files: string[], declarations: string[] = []) {
  const phase = new FingerprintPhase(repositoryRoot, { store: new DigestStore(null) });
  return phase.graphDigest(files, declarations);
}
