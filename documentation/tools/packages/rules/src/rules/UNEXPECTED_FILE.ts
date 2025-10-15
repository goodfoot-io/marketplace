import type { Rule, RuleViolation } from '../types.js';
import * as fs from 'fs/promises';
import { join } from 'path';
import { shouldSuppressError } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * UNEXPECTED_FILE Rule
 *
 * Detects files in wrong locations according to the organization protocol
 *
 * @description
 * Validates that files are placed in appropriate directories according to their
 * type and purpose.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude follows mandatory organizational practices:
 * 1. Version Isolation: Each version self-contained
 * 2. No Orphan Files: All files in designated directories only
 * 3. Timestamp Versioning: Use `[YYMMDDHHMM]-[reason]/` format
 * 4. Source Documentation: All materials in `sources/` with exact URLs
 * 5. Repository Validation: Run `rules-check` before completing work"
 *
 * @enforcement
 * Scans all directories and validates file placement based on a whitelist of
 * allowed file patterns for each directory.
 *
 * @notFixable
 * Cannot automatically fix as correct destination depends on file content and purpose.
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];
  for await (const { storyPath } of iterateStories(workspacePath, ['active', 'published', 'archive'])) {
    await checkDirectory(storyPath, storyPath, violations);
  }
  return violations.length > 0 ? violations : null;
}

async function checkDirectory(basePath: string, dirPath: string, violations: RuleViolation[]): Promise<void> {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const itemPath = join(dirPath, item.name);
      if (item.isDirectory()) {
        await checkDirectory(basePath, itemPath, violations);
      } else if (item.isFile()) {
        checkFileLocation(basePath, itemPath, violations);
      }
    }
  } catch (error: unknown) {
    if (!shouldSuppressError(error)) throw error;
  }
}

function checkFileLocation(basePath: string, filePath: string, violations: RuleViolation[]): void {
  const relativePath = filePath.substring(basePath.length + 1);
  const parts = relativePath.split('/');
  const filename = parts.pop() || '';
  const dir = parts.join('/');

  // No files at the root of a story except specific allowed files
  if (dir === '') {
    if (filename === '.status') {
      violations.push(createViolation('UNEXPECTED_FILE', 'Legacy file `.status` is not allowed', relativePath));
    } else if (
      filename === 'link-status-ledger.json' ||
      filename === 'link-overrides.yaml' ||
      filename === 'synthesis-archive.md'
    ) {
      // These files are allowed at the story root
      return;
    } else if (!filename.startsWith('.')) {
      violations.push(createViolation('UNEXPECTED_FILE', 'Files are not allowed at the story root', relativePath));
    }
    return;
  }

  const locationRules: { [key: string]: RegExp | null } = {
    agents: /^blackboard\.yaml$/,
    'agents/performance-reviews': /^\d{6}-[a-z-]+\.yaml$/,
    essay: /^changelog\.md$/,
    'essay/\\d{10}-\\S+/reviews/\\S+': /^\d{10}\.md$/,
    'essay/\\d{10}-\\S+': /^(essay|rubric|user-feedback)\.md$/,
    'essay/\\d{10}-\\S+/workspace': /^(research-notes|outline|research-synthesis|partial-work)\.md$/,
    'sources/documents': /^\d{8}-.+/, // Enforce YYYYMMDD- prefix
    'sources/interviews': /^\d{8}-.+/, // Enforce YYYYMMDD- prefix
    'sources/data': /^\d{8}-.+/, // Enforce YYYYMMDD- prefix
    'sources/archives': /^\d{8}-.+/, // Enforce YYYYMMDD- prefix for archive files
    'sources/synthesis': null, // Allow ANY file
    'agents/messages': /^.+\.msg$/ // Only allow .msg files
  };

  let matched = false;
  for (const [ruleDir, rulePattern] of Object.entries(locationRules)) {
    const ruleDirRegex = new RegExp(`^${ruleDir}$`);
    if (ruleDirRegex.test(dir)) {
      if (rulePattern === null || rulePattern.test(filename)) {
        matched = true;
        break;
      }
    }
  }

  if (!matched) {
    violations.push(createViolation('UNEXPECTED_FILE', `Unexpected file \`${filename}\` in \`${dir}\``, relativePath));
  }
}

const rule: Rule = {
  code: 'UNEXPECTED_FILE',
  title: 'File in Wrong Location',
  check
};

export default rule;
