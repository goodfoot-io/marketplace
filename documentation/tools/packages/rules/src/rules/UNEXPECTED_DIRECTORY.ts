import type { Rule } from '../types/rule.js';
import type { RuleViolation } from '../types.js';
import { join } from 'path';
import { readDirectory, isDirectory, shouldSuppressError } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * UNEXPECTED_DIRECTORY Rule
 *
 * Detects directories that shouldn't exist according to the organization protocol
 *
 * @description
 * Validates that story directories only contain expected subdirectories as defined
 * by the protocol. Catches structural violations like essay.md/ directories,
 * misnamed directories, or directories in wrong locations.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude knows the exact directory structure that must be maintained"
 *
 * And: "Claude never: 1. Creates custom directory structures"
 *
 * @enforcement
 * Scans all story directories and validates:
 * - Only expected top-level directories exist (agents, sources, essay)
 * - No file-like directories (e.g., essay.md/)
 * - Proper nesting within expected structure
 * - No custom or misplaced directories
 * - Only allowed review types in review directories
 *
 * @notFixable
 * Cannot automatically fix as directory purpose is unclear - requires human decision
 */

// Allowed review types per organization-protocol.md
const ALLOWED_REVIEW_TYPES = new Set([
  'audience',
  'citation',
  'data-translation',
  'editorial',
  'fact-check',
  'final',
  'quality'
]);

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    await checkStoryDirectory(storyPath, rootDir, storySlug, violations);
  }

  return violations.length > 0 ? violations : null;
}

async function checkStoryDirectory(
  storyPath: string,
  rootDir: string,
  storySlug: string,
  violations: RuleViolation[]
): Promise<void> {
  try {
    const contents = await readDirectory(storyPath);

    // Expected directories at story root level
    const expectedDirs = new Set(['agents', 'sources', 'essay']);
    const expectedFiles = new Set(['link-status-ledger.json', 'link-overrides.yaml', 'synthesis-archive.md']); // Link management files and synthesis archive allowed at story root

    for (const item of contents) {
      const itemPath = join(storyPath, item);
      const isDir = await isDirectory(itemPath);

      if (isDir) {
        // Check for unexpected directories at story root
        if (!expectedDirs.has(item)) {
          // Common violations
          if (item.endsWith('.md')) {
            violations.push(
              createViolation(
                'UNEXPECTED_DIRECTORY',
                `Story \`${storySlug}\` contains directory \`${item}/\` that appears to be named like a file. Check for structural violations`,
                `${rootDir}/${storySlug}/${item}/`,
                'error'
              )
            );
          } else if (item.match(/^v\d+/)) {
            violations.push(
              createViolation(
                'UNEXPECTED_DIRECTORY',
                `Story \`${storySlug}\` has version directory \`${item}/\` at root level. Version directories should be in \`essay/\``,
                `${rootDir}/${storySlug}/${item}/`,
                'error'
              )
            );
          } else if (item === 'reviews') {
            violations.push(
              createViolation(
                'UNEXPECTED_DIRECTORY',
                `Story \`${storySlug}\` has \`reviews/\` at root level. Reviews should be in \`essay/working/reviews/\` or \`essay/[YYMMDDHHMM-reason]/reviews/\``,
                `${rootDir}/${storySlug}/${item}/`,
                'error'
              )
            );
          } else {
            violations.push(
              createViolation(
                'UNEXPECTED_DIRECTORY',
                `Story \`${storySlug}\` contains unexpected directory \`${item}/\`. Expected directories: ${Array.from(expectedDirs).join(', ')}`,
                `${rootDir}/${storySlug}/${item}/`,
                'warning'
              )
            );
          }
        } else {
          // Check expected directories for proper internal structure
          await checkExpectedDirectoryStructure(itemPath, rootDir, storySlug, item, violations);
        }
      } else {
        // Check for unexpected files at story root
        if (!expectedFiles.has(item) && !item.startsWith('.')) {
          violations.push(
            createViolation(
              'UNEXPECTED_DIRECTORY',
              `Story \`${storySlug}\` contains unexpected file \`${item}\` at root level. Files should be in appropriate subdirectories`,
              `${rootDir}/${storySlug}/${item}`,
              'warning'
            )
          );
        }
      }
    }
  } catch (error: unknown) {
    // Only suppress known file system errors for missing/inaccessible directories
    if (shouldSuppressError(error)) {
      // Skip directories that don't exist or can't be read due to permissions
      return;
    }
    // Re-throw unexpected errors (memory issues, etc.)
    throw error;
  }
}

async function checkExpectedDirectoryStructure(
  dirPath: string,
  rootDir: string,
  storySlug: string,
  dirName: string,
  violations: RuleViolation[]
): Promise<void> {
  try {
    const contents = await readDirectory(dirPath);

    if (dirName === 'essay') {
      for (const item of contents) {
        const itemPath = join(dirPath, item);
        const isDir = await isDirectory(itemPath);

        if (isDir) {
          // Allow working/ and timestamp-based version directories
          if (!item.match(/^\d{10}-/)) {
            if (item !== 'changelog.md') {
              violations.push(
                createViolation(
                  'UNEXPECTED_DIRECTORY',
                  `Story \`${storySlug}\` has unexpected directory \`essay/${item}/\`. Expected version directories ([YYMMDDHHMM]-[reason])`,
                  `${rootDir}/${storySlug}/essay/${item}/`,
                  'warning'
                )
              );
            }
          } else {
            // It's a version directory, so check its contents
            await checkVersionDirectory(itemPath, rootDir, storySlug, item, violations);
          }
        }
      }
    } else if (dirName === 'sources') {
      // Expected subdirectories in sources/
      const expectedSourcesDirs = new Set(['documents', 'interviews', 'data', 'synthesis', 'archives']);

      for (const item of contents) {
        const itemPath = join(dirPath, item);
        const isDir = await isDirectory(itemPath);

        if (isDir && !expectedSourcesDirs.has(item) && !item.startsWith('.')) {
          violations.push(
            createViolation(
              'UNEXPECTED_DIRECTORY',
              `Story \`${storySlug}\` has unexpected directory \`sources/${item}/\`. Expected: documents/, interviews/, data/, synthesis/, archives/`,
              `${rootDir}/${storySlug}/sources/${item}/`,
              'warning'
            )
          );
        }
      }
    } else if (dirName === 'agents') {
      // Expected subdirectories in agents/
      const expectedAgentsDirs = new Set(['messages', 'performance-reviews']);

      for (const item of contents) {
        const itemPath = join(dirPath, item);
        const isDir = await isDirectory(itemPath);

        if (isDir && !expectedAgentsDirs.has(item)) {
          violations.push(
            createViolation(
              'UNEXPECTED_DIRECTORY',
              `Story \`${storySlug}\` has unexpected directory \`agents/${item}/\`. Expected: messages/, performance-reviews/`,
              `${rootDir}/${storySlug}/agents/${item}/`,
              'warning'
            )
          );
        }
      }
    }
  } catch (error: unknown) {
    // Only suppress known file system errors for missing/inaccessible directories
    if (shouldSuppressError(error)) {
      // Skip directories that don't exist or can't be read due to permissions
      return;
    }
    // Re-throw unexpected errors (memory issues, etc.)
    throw error;
  }
}

async function checkVersionDirectory(
  versionPath: string,
  rootDir: string,
  storySlug: string,
  versionDirName: string,
  violations: RuleViolation[]
): Promise<void> {
  try {
    const contents = await readDirectory(versionPath);
    const expectedDirs = new Set(['workspace', 'reviews']);

    for (const item of contents) {
      const itemPath = join(versionPath, item);
      const isDir = await isDirectory(itemPath);

      if (isDir) {
        if (item === 'reviews') {
          // Check review directory for allowed review types
          await checkReviewDirectory(itemPath, rootDir, storySlug, versionDirName, violations);
        } else if (!expectedDirs.has(item)) {
          violations.push(
            createViolation(
              'UNEXPECTED_DIRECTORY',
              `Version directory \`${versionDirName}\` contains unexpected directory \`${item}/\`. Expected: workspace/, reviews/`,
              `${rootDir}/${storySlug}/essay/${versionDirName}/${item}/`,
              'warning'
            )
          );
        }
      }
    }
  } catch (error: unknown) {
    if (shouldSuppressError(error)) {
      return;
    }
    throw error;
  }
}

async function checkReviewDirectory(
  reviewPath: string,
  rootDir: string,
  storySlug: string,
  versionDirName: string,
  violations: RuleViolation[]
): Promise<void> {
  try {
    const contents = await readDirectory(reviewPath);
    for (const item of contents) {
      const itemPath = join(reviewPath, item);
      const isDir = await isDirectory(itemPath);

      if (isDir && !ALLOWED_REVIEW_TYPES.has(item) && !item.startsWith('.')) {
        violations.push(
          createViolation(
            'UNEXPECTED_DIRECTORY',
            `Review directory \`${versionDirName}/reviews/\` contains unexpected review type \`${item}/\`. Allowed types: ${Array.from(ALLOWED_REVIEW_TYPES).join(', ')}`,
            `${rootDir}/${storySlug}/essay/${versionDirName}/reviews/${item}/`,
            'warning'
          )
        );
      }
    }
  } catch (error: unknown) {
    if (shouldSuppressError(error)) {
      return;
    }
    throw error;
  }
}

const rule: Rule = {
  code: 'UNEXPECTED_DIRECTORY',
  title: 'Unexpected Directory Structure',
  check
};

export default rule;
