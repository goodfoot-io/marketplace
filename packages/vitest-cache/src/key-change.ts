/**
 * Explain changed result-key components and bounded input-file differences.
 *
 * @summary Explain changed result-key components and bounded input-file differences.
 */
import type { Components } from './publication.ts';

/** Result-key components, in key order. */
export const COMPONENTS = ['invocation', 'execution', 'inputs', 'packages', 'executables'] as const;

/** Changed input files listed in a key-change description before the rest are counted. */
const LISTED_FILES = 5;

/** A file's result key, its components, and the per-file input digests the `inputs` component hashes (kept in memory for diagnostics, never recorded). */
export type KeyEntry = { key: string; identity: string; components: Components; inputs: Map<string, string> };

/**
 * Which key components differ between two keys for the same file and, for `inputs`, which input files were added, removed or changed. When no file differs, the declared globs themselves changed.
 *
 * @param before - Earlier key/components and diagnostic per-input digests.
 * @param after - Later key/components and diagnostic per-input digests.
 * @returns Changed components with at most five file paths, or empty string when all components agree.
 */
export function describeKeyChange(before: KeyEntry, after: KeyEntry): string {
  const parts: string[] = [];
  for (const name of COMPONENTS) {
    if (before.components[name] === after.components[name]) continue;
    if (name !== 'inputs') {
      parts.push(name);
      continue;
    }
    const files: string[] = [];
    for (const [file, value] of after.inputs) {
      if (before.inputs.get(file) !== value) files.push(file);
    }
    for (const file of before.inputs.keys()) {
      if (!after.inputs.has(file)) files.push(file);
    }
    files.sort();
    if (!files.length) {
      parts.push('inputs: declared globs');
      continue;
    }
    const more = files.length - LISTED_FILES;
    parts.push(`inputs: ${files.slice(0, LISTED_FILES).join(', ')}${more > 0 ? `, +${more} more` : ''}`);
  }
  return parts.join('; ');
}
