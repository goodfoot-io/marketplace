import type { Rule, RuleViolation } from '../types.js';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { isDirectory, categorizeError } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';

/**
 * UNEXPECTED_ROOT_DIRECTORY Rule
 *
 * Detects directories at the workspace root that are not defined in the organization protocol
 *
 * @description
 * Validates that only expected directories exist at the workspace root level.
 * This ensures the workspace structure remains clean and compliant with the
 * organizational standards.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude recognizes system directories as read-only:
 * - `/protocols/` - System and agent protocols
 * - `/tools/` - Repository integrity verification (monorepo)
 * - `/documentation/` - System documentation
 * - `/analysis/` - Performance analysis reports"
 *
 * @enforcement
 * Scans the workspace root and reports any directories not in the allowed list.
 * Hidden directories (starting with .) are ignored.
 *
 * @notFixable
 * Cannot automatically remove unexpected directories - requires human decision
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  // Allowed directories at workspace root per organization-protocol.md
  const allowedDirs = new Set([
    'active',
    'published',
    'archive',
    'tools',
    '_templates',
    // System directories (read-only)
    'protocols',
    'documentation',
    'analysis'
  ]);

  try {
    const contents = await readdir(workspacePath);

    for (const item of contents) {
      // Skip hidden directories (start with .)
      if (item.startsWith('.')) {
        continue;
      }

      const itemPath = join(workspacePath, item);
      const isDir = await isDirectory(itemPath);

      if (isDir && !allowedDirs.has(item)) {
        violations.push(
          createViolation(
            'UNEXPECTED_ROOT_DIRECTORY',
            `Unexpected directory \`${item}/\` at workspace root. Allowed directories: ${Array.from(allowedDirs).join(', ')}`,
            item,
            'warning'
          )
        );
      }
    }
  } catch (error) {
    const category = categorizeError(error);

    if (category === 'suppress') {
      // ENOENT, ENOTDIR, EACCES - workspace doesn't exist or isn't accessible
      // Let other rules handle these cases
      return null;
    } else if (category === 'warn') {
      console.warn(`UNEXPECTED_ROOT_DIRECTORY: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } else {
      // Serious errors should be propagated
      throw error;
    }
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'UNEXPECTED_ROOT_DIRECTORY',
  title: 'Unexpected Root Directory',
  check
};

export default rule;
