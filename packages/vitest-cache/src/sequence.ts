/**
 * Validate fallback suite dispatch order without changing test selection.
 *
 * @summary Validate fallback suite dispatch order without changing test selection.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * A suite's declared execution order: repository-relative test file paths,
 * heaviest first. `ContentCacheSequencer` prefers this over Vitest's own
 * file-size fallback whenever a pair of files lacks recorded duration
 * history for both sides, so a cold run (no `results.json`) still dispatches
 * the suite's known-heavy files first. Real recorded duration, when present
 * for both compared files, still wins: the declaration is a fallback, not an
 * override.
 */

function normalize(entry: string) {
  return entry.split(/[\\/]/).join('/');
}

/**
 * Validate a declared sequence's shape at config load, so a malformed declaration fails before any file runs rather than degrading silently at sort time.
 *
 * @param declaration - Unknown suite order declaration.
 * @returns Original nonempty repository-relative declaration after validation.
 * @throws For invalid/non-string/unsafe/duplicate normalized paths.
 */
export function validateSequence(declaration: unknown): string[] {
  if (!Array.isArray(declaration) || declaration.length === 0)
    throw new Error('invalid test sequence: must be a nonempty array of repository-relative file paths');
  const seen = new Set();
  for (const entry of declaration) {
    if (typeof entry !== 'string' || !entry.length)
      throw new Error('invalid test sequence: entries must be nonempty strings');
    if (entry.startsWith('/') || entry.split(/[\\/]/).includes('..'))
      throw new Error(`invalid test sequence: non-repository path ${entry}`);
    const key = normalize(entry);
    if (seen.has(key)) throw new Error(`invalid test sequence: duplicate entry ${entry}`);
    seen.add(key);
  }
  return declaration;
}

/**
 * Fail loudly when a declared file no longer exists on disk: a stale declaration silently degrades to running that file last, which nobody would notice. `root` is the repository root the declared paths are relative to.
 *
 * @param declaration - Validated declared order.
 * @param root - Repository root for existence checks.
 * @returns Original declaration after every path exists.
 * @throws When a declared path is missing.
 */
export function verifySequence(declaration: string[], root: string) {
  for (const entry of declaration) {
    if (!fs.existsSync(path.join(root, entry)))
      throw new Error(`test sequence declares a file that no longer exists: ${entry}`);
  }
  return declaration;
}

/**
 * A declared sequence as a path -> priority map (lower runs earlier).
 *
 * @param declaration - Validated declared order.
 * @returns Normalized path-to-index map; lower indices dispatch first.
 */
export function declaredRank(declaration: string[]) {
  const rank = new Map<string, number>();
  declaration.forEach((entry, index) => {
    rank.set(normalize(entry), index);
  });
  return rank;
}

/**
 * Order two repository-relative paths by declared rank, heaviest (lowest index) first. Files absent from the declaration share one rank after every declared file and are then ordered alphabetically, so the result is deterministic even for files the declaration never named.
 *
 * @param rank - Declared normalized priority map.
 * @param relativeA - First repository-relative test path.
 * @param relativeB - Second repository-relative test path.
 * @returns Negative/zero/positive comparator by declared priority then bytewise lexical path.
 */
export function compareByDeclaredRank(rank: Map<string, number>, relativeA: string, relativeB: string) {
  const a = normalize(relativeA);
  const b = normalize(relativeB);
  const rankA = rank.get(a) ?? rank.size;
  const rankB = rank.get(b) ?? rank.size;
  if (rankA !== rankB) return rankA - rankB;
  return a < b ? -1 : a > b ? 1 : 0;
}
