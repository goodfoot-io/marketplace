/**
 * Locate persistent repository-shared stat-validated digest storage.
 *
 * @summary Locate persistent repository-shared stat-validated digest storage.
 */
import { hash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ownedDirectory } from './publication.ts';

function digest(value: string) {
  return hash('sha256', value, 'hex');
}

/**
 * The cache folder shared by every worktree of the repository at `commonGitDirectory`. A `digests` subfolder here backs a `DigestStore` (see `digest-store.ts`) of stat-validated file and installed-package-tree digests; any tool that fingerprints content for this repository -- not only Vitest's own result cache -- uses the same subfolder rather than paying to rehash unchanged bytes once per tool or per worktree. This folder is shared, cross-process state: nothing here deletes it, and callers must not either.
 *
 * @param commonGitDirectory - Physical common Git directory shared across repository worktrees.
 * @returns Owned shared cache folder keyed by that exact directory.
 * @throws For missing POSIX UID, unsafe folder or filesystem failure.
 */
export async function sharedCacheFolder(commonGitDirectory: string) {
  return ownedDirectory(path.join(os.tmpdir(), 'goodfoot-vitest-cache', digest(commonGitDirectory)));
}
