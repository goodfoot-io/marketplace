import type { Rule, RuleViolation } from '../types.js';
import { getMissingStoryDirectories } from '../utils/directory-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * MISSING_REQUIRED_DIRECTORY Rule
 *
 * Ensures every story has all required subdirectories
 *
 * @description
 * Each story must have a complete directory structure to support
 * the multi-agent workflow and maintain organizational standards.
 *
 * @rationale
 * From protocols/organization-protocol.md:
 * "Claude creates new projects using these exact commands:
 * ```bash
 * # New project
 * mkdir -p active/[story-slug]/{agents/{messages,performance-reviews},sources/{documents,interviews,data,synthesis,archives},essay}
 * touch active/[story-slug]/essay/changelog.md
 * ```"
 *
 * @enforcement
 * This rule is applied to all stories in:
 * - /active/
 * - /review/
 * - /published/
 * - /archive/
 *
 * @creation
 * When creating directories:
 * ```bash
 * mkdir -p active/[story-slug]/{agents/{messages,performance-reviews},sources/{documents,interviews,data},essay}
 * ```
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const missingDirs = await getMissingStoryDirectories(storyPath);

    for (const missingDir of missingDirs) {
      violations.push(
        createViolation(
          'MISSING_REQUIRED_DIRECTORY',
          `Story \`${storySlug}\` is missing required directory: \`${missingDir}\``,
          `${rootDir}/${storySlug}/${missingDir}`
        )
      );
    }
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'MISSING_REQUIRED_DIRECTORY',
  title: 'Missing Required Directory',
  check
};

export default rule;
