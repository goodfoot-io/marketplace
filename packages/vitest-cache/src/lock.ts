/**
 * Serialize same-worktree package tests with owned POSIX advisory locks.
 *
 * @summary Serialize same-worktree package tests with owned POSIX advisory locks.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { hash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { errnoCode } from './errors.ts';
import { currentUid } from './publication.ts';

/**
 * Whether an ancestor process holds an exclusive flock on `file`.
 *
 * @param file - Exact worktree lock path.
 * @returns Whether an ancestor process holds this lock.
 * @throws For unsupported process inspection or filesystem failure not treated as absent.
 */
function ancestorHoldsLock(file: string) {
  const visited = new Set();
  for (let pid = process.ppid; pid > 0 && !visited.has(pid); ) {
    visited.add(pid);
    try {
      for (const fd of fs.readdirSync(`/proc/${pid}/fd`)) {
        try {
          if (
            fs.readlinkSync(`/proc/${pid}/fd/${fd}`) === file &&
            /FLOCK\s+ADVISORY\s+WRITE/.test(fs.readFileSync(`/proc/${pid}/fdinfo/${fd}`, 'utf8'))
          ) {
            return true;
          }
        } catch (error) {
          if (!['ENOENT', 'ESRCH', 'EACCES'].includes(errnoCode(error) ?? '')) throw error;
        }
      }
    } catch (error) {
      if (!['ENOENT', 'ESRCH', 'EACCES'].includes(errnoCode(error) ?? '')) throw error;
    }
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      pid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
    } catch (error) {
      if (['ENOENT', 'ESRCH'].includes(errnoCode(error) ?? '')) break;
      throw error;
    }
  }
  return false;
}

/**
 * The package name used for its `tests:<package>` execution lock. Package commands serialize setup, execution and shared outputs with that lock. A run nested under an owner of that lock proceeds under the ancestor's ownership. There is no timed lock stealing.
 *
 * @param directory - Starting package directory.
 * @returns Nearest nonempty owning package name.
 * @throws For malformed package metadata, filesystem reads or absence of a named package ancestor.
 */
function packageName(directory: string) {
  for (let current = directory; ; current = path.dirname(current)) {
    const manifest = path.join(current, 'package.json');
    if (fs.existsSync(manifest)) {
      const { name } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (typeof name === 'string' && name) return name;
    }
    if (current === path.dirname(current)) throw new Error(`no named package owns ${directory}`);
  }
}

function lockFile(root: string, id: string) {
  const gitDirectory = fs.realpathSync(
    execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' }).trim()
  );
  const directory = path.join(gitDirectory, 'goodfoot-vitest-locks');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.uid !== currentUid() || stat.mode & 0o022)
    throw new Error('unsafe task lock directory');
  return path.join(directory, hash('sha256', id, 'hex'));
}

function flock(fd: number, ...args: string[]) {
  const result = spawnSync('flock', [...args, '3'], { stdio: ['ignore', 'inherit', 'inherit', fd] });
  if (result.error) throw result.error;
  return result.status === 0;
}

/**
 * Acquire the test lock for the package that owns `root`; returns a release function.
 *
 * @param root - Current package/root directory.
 * @returns Identified inherited or acquired lock with idempotent release callback.
 * @throws For unsafe lock storage, unavailable flock or acquisition failure.
 */
export function acquireTestLock(root: string) {
  const id = `tests:${packageName(root)}`;
  const file = lockFile(root, id);
  if (ancestorHoldsLock(file)) return { id, inherited: true, release() {} };
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat && (!stat.isFile() || stat.uid !== currentUid() || stat.mode & 0o022)) throw new Error('unsafe task lock');
  const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
  try {
    if (!flock(fd, '--exclusive', '--nonblock')) {
      console.log(`vitest cache: waiting for ${id}, held by another test run in this worktree`);
      if (!flock(fd, '--exclusive')) throw new Error(`unable to acquire ${id}`);
    }
  } catch (error) {
    fs.closeSync(fd);
    throw error;
  }
  let released = false;
  return {
    id,
    inherited: false,
    release() {
      if (released) return;
      released = true;
      try {
        flock(fd, '--unlock');
      } finally {
        fs.closeSync(fd);
      }
    }
  };
}
