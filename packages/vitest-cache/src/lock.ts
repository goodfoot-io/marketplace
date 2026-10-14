/**
 * Serialize same-worktree package tests with owned POSIX advisory locks.
 *
 * @summary Serialize same-worktree package tests with owned POSIX advisory locks.
 */
import { execFile, spawn } from 'node:child_process';
import { hash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

import { errnoCode } from './errors.ts';
import { currentUid } from './publication.ts';

/**
 * Whether an ancestor process holds an exclusive flock on `file`.
 *
 * @param file - Exact worktree lock path.
 * @returns Whether an ancestor process holds this lock.
 * @throws For unsupported process inspection or filesystem failure not treated as absent.
 */
async function ancestorHoldsLock(file: string) {
  const visited = new Set();
  for (let pid = process.ppid; pid > 0 && !visited.has(pid); ) {
    visited.add(pid);
    try {
      for (const fd of await fsp.readdir(`/proc/${pid}/fd`)) {
        try {
          if (
            (await fsp.readlink(`/proc/${pid}/fd/${fd}`)) === file &&
            /FLOCK\s+ADVISORY\s+WRITE/.test(await fsp.readFile(`/proc/${pid}/fdinfo/${fd}`, 'utf8'))
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
      const stat = await fsp.readFile(`/proc/${pid}/stat`, 'utf8');
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
async function packageName(directory: string) {
  for (let current = directory; ; current = path.dirname(current)) {
    const manifest = path.join(current, 'package.json');
    if (
      await fsp.access(manifest).then(
        () => true,
        (error: unknown) => {
          if (errnoCode(error) === 'ENOENT') return false;
          throw error;
        }
      )
    ) {
      const { name } = JSON.parse(await fsp.readFile(manifest, 'utf8'));
      if (typeof name === 'string' && name) return name;
    }
    if (current === path.dirname(current)) throw new Error(`no named package owns ${directory}`);
  }
}

async function lockFile(root: string, id: string) {
  const gitDirectory = await fsp.realpath(
    (await exec('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' })).stdout.trim()
  );
  const directory = path.join(gitDirectory, 'goodfoot-vitest-locks');
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fsp.lstat(directory);
  if (!stat.isDirectory() || stat.uid !== currentUid() || stat.mode & 0o022)
    throw new Error('unsafe task lock directory');
  return path.join(directory, hash('sha256', id, 'hex'));
}

async function flock(fd: number, ...args: string[]) {
  return new Promise<boolean>((resolve, reject) => {
    const child = spawn('flock', [...args, '3'], { stdio: ['ignore', 'inherit', 'inherit', fd] });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code === 0));
  });
}

/**
 * Acquire the test lock for the package that owns `root`; returns a release function.
 *
 * @param root - Current package/root directory.
 * @returns Identified inherited or acquired lock with idempotent release callback.
 * @throws For unsafe lock storage, unavailable flock or acquisition failure.
 */
export async function acquireTestLock(root: string) {
  const id = `tests:${await packageName(root)}`;
  const file = await lockFile(root, id);
  if (await ancestorHoldsLock(file)) return { id, inherited: true, async release() {} };
  const stat = await fsp.lstat(file).catch((error: unknown) => {
    if (errnoCode(error) === 'ENOENT') return null;
    throw error;
  });
  if (stat && (!stat.isFile() || stat.uid !== currentUid() || stat.mode & 0o022)) throw new Error('unsafe task lock');
  const fd = await fsp.open(file, fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
  try {
    if (!(await flock(fd.fd, '--exclusive', '--nonblock'))) {
      console.log(`vitest cache: waiting for ${id}, held by another test run in this worktree`);
      if (!(await flock(fd.fd, '--exclusive'))) throw new Error(`unable to acquire ${id}`);
    }
  } catch (error) {
    await fd.close();
    throw error;
  }
  let released = false;
  return {
    id,
    inherited: false,
    async release() {
      if (released) return;
      released = true;
      try {
        await flock(fd.fd, '--unlock');
      } finally {
        await fd.close();
      }
    }
  };
}
