import type { Rule, RuleViolation } from '../types.js';
import { isDirectory, readDirectory, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { ROOT_DIRECTORIES, isValidStorySlug, isStoryDirectory } from '../utils/story-utils.js';

/**
 * INVALID_STORY_SLUG Rule
 *
 * Ensures story directory names follow the required naming convention
 *
 * @description
 * Story slugs must be lowercase with hyphens separating words.
 *
 * @rationale
 * From protocols/organization-protocol.md: "- **Story Slugs**: `climate-agriculture`, `genetic-testing-ethics`, `tiktok-attention-span`"
 *
 * @enforcement
 * This rule checks all directories in:
 * - /active/
 * - /review/
 * - /published/
 * - /archive/
 *
 * The rule excludes:
 * - Hidden directories (starting with .)
 * - System directories (like _templates)
 *
 * @pattern
 * Valid pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/
 * - Must start with lowercase letter or number
 * - Can contain hyphens between words
 * - Must end with lowercase letter or number
 * - No underscores or uppercase allowed
 *
 * @notFixable
 * This rule is not automatically fixable because:
 * - Renaming directories could break references
 * - The correct name requires human judgment
 * - May affect version control history
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for (const rootDir of ROOT_DIRECTORIES) {
    const rootPath = resolveProjectPath(workspacePath, rootDir);
    if (!(await isDirectory(rootPath))) continue;

    const items = await readDirectory(rootPath);

    for (const item of items) {
      // Skip if this isn't a story directory
      if (!isStoryDirectory(item)) continue;

      const itemPath = resolveProjectPath(rootPath, item);
      if (!(await isDirectory(itemPath))) continue;

      // Check if the slug is valid
      if (!isValidStorySlug(item)) {
        violations.push(
          createViolation(
            'INVALID_STORY_SLUG',
            `Story slug \`${item}\` must be lowercase with hyphens only`,
            `${rootDir}/${item}`,
            'warning'
          )
        );
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'INVALID_STORY_SLUG',
  title: 'Invalid Story Slug Format',
  check
  // No fix function since this rule is not fixable
};

export default rule;
