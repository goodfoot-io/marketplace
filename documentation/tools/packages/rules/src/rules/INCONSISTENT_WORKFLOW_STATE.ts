/**
 * Rule: INCONSISTENT_WORKFLOW_STATE
 *
 * @description Ensures that a project's workflow state is valid by checking that prerequisite files
 * exist before files from later workflow phases. This prevents projects from entering invalid states
 * where later-phase outputs exist without their required dependencies.
 *
 * @rationale The newsroom-protocol.md defines a strict file-driven workflow where phases are
 * determined by file presence. Each phase has prerequisites that must be met. For example,
 * essay.md (Evaluation phase) cannot exist without workspace/research-notes.md (Synthesis phase).
 *
 * @enforcement This rule checks for illogical file combinations in version directories:
 * - essay.md without workspace/research-notes.md
 * - Reviews without essay.md
 * - Final review without all verification reviews
 * - Data translation review without fact-check review
 *
 * @notFixable State inconsistencies require manual intervention to determine which files
 * should exist and which should be removed or created.
 */

import type { Rule, RuleViolation } from '../types.js';
import { relative, resolve } from 'path';
import { fileExists, readDirectory, isDirectory } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * Helper function to get the latest version directory
 */
async function getLatestVersionPath(storyPath: string): Promise<string | null> {
  const essayPath = resolve(storyPath, 'essay');

  try {
    const entries = await readDirectory(essayPath);
    const versionDirs: string[] = [];

    for (const entry of entries) {
      const entryPath = resolve(essayPath, entry);
      if ((await fileExists(entryPath)) && (await isDirectory(entryPath))) {
        if (/^\d{10}-[a-z]+(-[a-z]+)*$/.test(entry)) {
          versionDirs.push(entry);
        }
      }
    }

    versionDirs.sort((a, b) => b.localeCompare(a)); // Sort descending to get latest first

    return versionDirs.length > 0 ? resolve(essayPath, versionDirs[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Check for reviews of a specific type
 */
async function hasReviewType(versionPath: string, reviewType: string): Promise<boolean> {
  const reviewTypePath = resolve(versionPath, 'reviews', reviewType);

  try {
    const entries = await readDirectory(reviewTypePath);
    // Check if any .md files exist in the review type directory
    return entries.some((entry) => {
      if (typeof entry === 'string') {
        return entry.endsWith('.md');
      }
      return false;
    });
  } catch {
    return false;
  }
}

/**
 * Get all review types that exist
 */
async function getExistingReviewTypes(versionPath: string): Promise<string[]> {
  const reviewsPath = resolve(versionPath, 'reviews');
  const reviewTypes: string[] = [];

  try {
    const entries = await readDirectory(reviewsPath);

    for (const entry of entries) {
      // Handle string entries
      if (typeof entry === 'string') {
        const entryPath = resolve(reviewsPath, entry);
        if (await isDirectory(entryPath)) {
          // Check if this review type has any .md files
          if (await hasReviewType(versionPath, entry)) {
            reviewTypes.push(entry);
          }
        }
      }
    }
  } catch {
    // No reviews directory
  }

  return reviewTypes;
}

/**
 * Workflow phase validation
 */
async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { storyPath, storySlug } of iterateStories(workspacePath)) {
    const latestVersionPath = await getLatestVersionPath(storyPath);

    if (!latestVersionPath) {
      continue; // No versions yet
    }

    // Define file paths
    const essayPath = resolve(latestVersionPath, 'essay.md');
    const researchNotesPath = resolve(latestVersionPath, 'workspace', 'research-notes.md');

    // Check: essay.md without research-notes.md (Evaluation without Synthesis)
    if ((await fileExists(essayPath)) && !(await fileExists(researchNotesPath))) {
      violations.push(
        createViolation(
          'INCONSISTENT_WORKFLOW_STATE',
          `Story '${storySlug}' is in Evaluation phase (essay.md exists) but is missing prerequisite file from Synthesis phase (workspace/research-notes.md).`,
          relative(workspacePath, researchNotesPath)
        )
      );
    }

    // Check: Any reviews without essay.md
    const existingReviews = await getExistingReviewTypes(latestVersionPath);
    if (existingReviews.length > 0 && !(await fileExists(essayPath))) {
      violations.push(
        createViolation(
          'INCONSISTENT_WORKFLOW_STATE',
          `Story '${storySlug}' has reviews (${existingReviews.join(', ')}) but is missing essay.md. Reviews cannot exist without an essay to review.`,
          relative(workspacePath, essayPath)
        )
      );
    }

    // Check: Final review without required verification reviews
    const hasFinalReview = await hasReviewType(latestVersionPath, 'final');
    if (hasFinalReview) {
      const requiredVerificationReviews = ['fact-check', 'citation', 'quality'];
      const missingReviews: string[] = [];

      for (const reviewType of requiredVerificationReviews) {
        if (!(await hasReviewType(latestVersionPath, reviewType))) {
          missingReviews.push(reviewType);
        }
      }

      if (missingReviews.length > 0) {
        violations.push(
          createViolation(
            'INCONSISTENT_WORKFLOW_STATE',
            `Story '${storySlug}' has final review but is missing required verification reviews: ${missingReviews.join(', ')}.`,
            relative(workspacePath, resolve(latestVersionPath, 'reviews'))
          )
        );
      }
    }

    // Check: Data translation review without fact-check review
    const hasDataTranslation = await hasReviewType(latestVersionPath, 'data-translation');
    const hasFactCheck = await hasReviewType(latestVersionPath, 'fact-check');

    if (hasDataTranslation && !hasFactCheck) {
      violations.push(
        createViolation(
          'INCONSISTENT_WORKFLOW_STATE',
          `Story '${storySlug}' has data-translation review but is missing fact-check review. Data translation requires fact-checking to be completed first.`,
          relative(workspacePath, resolve(latestVersionPath, 'reviews', 'fact-check'))
        )
      );
    }
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'INCONSISTENT_WORKFLOW_STATE',
  title: 'Workflow state inconsistency detected',
  check
};

export default rule;
