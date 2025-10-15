import type { Rule, RuleViolation } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { readDirectory, isDirectory, fileExists } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * REDUNDANT_FRONTMATTER_FIELD Rule
 *
 * Ensures YAML frontmatter doesn't duplicate derivable information
 *
 * @description
 * YAML frontmatter should only contain information that cannot be derived
 * from file structure or filesystem metadata. This prevents redundancy and
 * ensures single source of truth.
 *
 * @rationale
 * From protocols/organization-protocol.md:
 * "Claude uses YAML frontmatter only for non-derivable metadata"
 *
 * And: "Claude never duplicates derivable information like version (from directory name),
 * story_slug (from parent directory), timestamps (from filesystem), or specialist
 * (from file path context)."
 *
 * @enforcement
 * Checks all markdown files for redundant fields that can be derived from:
 * - Directory structure (version, story_slug, specialist)
 * - Filesystem metadata (created, last_updated, timestamps)
 * - File path context (path, filename, directory)
 *
 * @notFixable
 * Removal of fields requires understanding which fields are truly derivable
 * in each specific context.
 */

async function check(rootPath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  // Define forbidden fields that should be derived from structure
  const forbiddenFields = [
    'version',
    'story_slug',
    'timestamp',
    'created',
    'last_updated',
    'specialist',
    'date_accessed', // Should use filesystem creation time
    'date_created', // Should use filesystem creation time
    'date_modified', // Should use filesystem modification time
    'path', // Redundant with file path
    'filename', // Redundant with file path
    'directory' // Redundant with file path
  ];

  // Check files in all relevant story directories
  for await (const { storyPath } of iterateStories(rootPath, ['active', 'published', 'archive'])) {
    await checkDirectory(storyPath);
  }

  async function checkDirectory(dirPath: string): Promise<void> {
    if (!(await fileExists(dirPath)) || !(await isDirectory(dirPath))) {
      return;
    }

    const entries = await readDirectory(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);

      if (await isDirectory(fullPath)) {
        // Recursively check subdirectories, but skip node_modules and .git
        if (entry !== 'node_modules' && entry !== '.git') {
          await checkDirectory(fullPath);
        }
      } else if (entry.endsWith('.md')) {
        // Check markdown file
        await checkFile(fullPath);
      }
    }
  }

  async function checkFile(filePath: string): Promise<void> {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(rootPath, filePath);

    // Extract frontmatter
    const frontmatterMatch = fileContent.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return;
    }

    let frontmatter: unknown;
    try {
      frontmatter = yaml.load(frontmatterMatch[1]);
    } catch {
      // Invalid YAML, let other rules handle this
      return;
    }

    if (!frontmatter || typeof frontmatter !== 'object') {
      return;
    }

    // Check for forbidden fields
    for (const field of forbiddenFields) {
      if (field in frontmatter) {
        violations.push(
          createViolation(
            'REDUNDANT_FRONTMATTER_FIELD',
            `Redundant frontmatter field "${field}" should be derived from file structure or filesystem metadata`,
            relativePath
          )
        );
      }
    }

    // Additional context-specific checks
    if (filePath.includes('/essay/') && filePath.endsWith('/essay.md')) {
      // Essay files shouldn't duplicate version info
      if ('version_number' in frontmatter || 'version_name' in frontmatter) {
        violations.push(
          createViolation(
            'REDUNDANT_FRONTMATTER_FIELD',
            'Essay files should not include version information in frontmatter - this is derived from directory name',
            relativePath
          )
        );
      }
    }

    if (filePath.includes('/reviews/')) {
      // Review files shouldn't duplicate reviewer identity
      if ('reviewer' in frontmatter || 'reviewed_by' in frontmatter) {
        violations.push(
          createViolation(
            'REDUNDANT_FRONTMATTER_FIELD',
            'Review files should not include reviewer identity in frontmatter - this is derived from directory structure',
            relativePath
          )
        );
      }
    }

    if (filePath.includes('/sources/')) {
      // Source files have specific requirements
      if ('file_type' in frontmatter || 'source_type' in frontmatter) {
        violations.push(
          createViolation(
            'REDUNDANT_FRONTMATTER_FIELD',
            'Source files should not include file/source type in frontmatter - this is derived from directory structure',
            relativePath
          )
        );
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'REDUNDANT_FRONTMATTER_FIELD',
  title: 'Redundant Frontmatter Field',
  check
};

export default rule;
