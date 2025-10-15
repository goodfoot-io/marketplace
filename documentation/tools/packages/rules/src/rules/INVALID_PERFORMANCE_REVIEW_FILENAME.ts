import type { Rule, RuleViolation } from '../types.js';
import path from 'path';
import { isDirectory, readDirectory, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * INVALID_PERFORMANCE_REVIEW_FILENAME Rule
 *
 * Validates the filename format of performance review files.
 *
 * @description
 * This rule ensures that all files within `agents/performance-reviews/` follow
 * the `[YYMMDD]-[specialist].yaml` naming convention. The date must be a valid
 * 6-digit date, and the specialist name should be lowercase with hyphens.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude knows other timestamp formats:
 * - Performance reviews: `[YYMMDD]-[specialist].yaml` (e.g., `250113-researcher.yaml`)"
 *
 * @enforcement
 * The rule checks every file in the `agents/performance-reviews/` directory for each story.
 * It uses a regular expression to validate the filename format.
 *
 * @notFixable
 * Renaming files requires human intervention to ensure the correct date and
 * specialist name are used.
 */
const FILENAME_PATTERN = /^\d{6}-[a-z-]+\.yaml$/;

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug } of iterateStories(workspacePath)) {
    const reviewPath = path.join(rootDir, storySlug, 'agents', 'performance-reviews');
    const absoluteReviewPath = resolveProjectPath(workspacePath, reviewPath);

    if (await isDirectory(absoluteReviewPath)) {
      const files = await readDirectory(absoluteReviewPath);
      for (const file of files) {
        if (!FILENAME_PATTERN.test(file)) {
          const location = path.join(reviewPath, file);
          violations.push(
            createViolation(
              'INVALID_PERFORMANCE_REVIEW_FILENAME',
              `Invalid performance review filename: \`${file}\`. Expected format is \`[YYMMDD]-[specialist].yaml\`.`,
              location,
              'error'
            )
          );
        }
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'INVALID_PERFORMANCE_REVIEW_FILENAME',
  title: 'Invalid Performance Review File Naming',
  check
};

export default rule;
