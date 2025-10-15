import type { Rule, RuleViolation } from '../types.js';
import path from 'path';
import { isDirectory, readDirectory, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * INVALID_REVIEW_FILENAME Rule
 *
 * Validates that review files follow the required naming convention.
 *
 * @description
 * Ensures all review feedback files follow the strict `[timestamp].md` naming convention.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude knows other timestamp formats:
 * - Performance reviews: `[YYMMDD]-[specialist].yaml` (e.g., `250113-researcher.yaml`)
 * - Review files: `[YYMMDDHHMM].md` (e.g., `2501131445.md`)
 * - Source files: `[YYYYMMDD]-[original-filename]` (e.g., `20250113-climate-report.pdf`)"
 *
 * @enforcement
 * Checks all .md files in review directories (`essay/[version]/reviews/[review-type]`)
 * and validates they follow the pattern: `[YYMMDDHHMM].md` where timestamp is exactly 10 digits.
 *
 * @notFixable
 * Cannot automatically fix as the correct timestamp is context-dependent.
 */
const FILENAME_PATTERN = /^\d{10}\.md$/;

// Validates YYMMDDHHMM format
function isValidTimestamp(filename: string): boolean {
  const match = filename.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.md$/);
  if (!match) return false;

  const [, , mm, dd, hh, min] = match;
  const month = parseInt(mm);
  const day = parseInt(dd);
  const hour = parseInt(hh);
  const minute = parseInt(min);

  // Basic validation (not exhaustive but catches obvious issues)
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug } of iterateStories(workspacePath)) {
    const essayPath = path.join(rootDir, storySlug, 'essay');
    const absoluteEssayPath = resolveProjectPath(workspacePath, essayPath);

    if (await isDirectory(absoluteEssayPath)) {
      const versions = await readDirectory(absoluteEssayPath);
      for (const version of versions) {
        const versionPath = path.join(essayPath, version);
        const absoluteVersionPath = resolveProjectPath(workspacePath, versionPath);
        if (await isDirectory(absoluteVersionPath)) {
          const reviewsPath = path.join(versionPath, 'reviews');
          const absoluteReviewsPath = resolveProjectPath(workspacePath, reviewsPath);

          if (await isDirectory(absoluteReviewsPath)) {
            const reviewTypes = await readDirectory(absoluteReviewsPath);
            for (const reviewType of reviewTypes) {
              const reviewTypePath = path.join(reviewsPath, reviewType);
              const absoluteReviewTypePath = resolveProjectPath(workspacePath, reviewTypePath);

              if (await isDirectory(absoluteReviewTypePath)) {
                const reviewFiles = await readDirectory(absoluteReviewTypePath);
                for (const filename of reviewFiles) {
                  if (filename.endsWith('.md') && (!FILENAME_PATTERN.test(filename) || !isValidTimestamp(filename))) {
                    const location = path.join(reviewTypePath, filename);
                    violations.push(
                      createViolation(
                        'INVALID_REVIEW_FILENAME',
                        `Story \`${storySlug}\` has review file \`${filename}\` that doesn't follow the naming convention \`[YYMMDDHHMM].md\` (e.g., 2501131445.md).`,
                        location,
                        'error'
                      )
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'INVALID_REVIEW_FILENAME',
  title: 'Invalid Review File Naming',
  check
};

export default rule;
