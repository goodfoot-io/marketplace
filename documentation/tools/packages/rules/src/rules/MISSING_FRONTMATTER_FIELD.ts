import type { Rule, RuleViolation } from '../types.js';
import * as yaml from 'js-yaml';
import { findFiles } from '../utils/directory-utils.js';
import { resolveProjectPath, readFile, shouldSuppressError } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * MISSING_FRONTMATTER_FIELD Rule
 *
 * Ensures YAML frontmatter contains all required non-derivable fields
 *
 * @description
 * Various files must include specific non-derivable fields in their YAML
 * frontmatter. This rule does NOT check for fields that can be derived
 * from file structure or filesystem metadata.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude uses YAML frontmatter only for non-derivable metadata"
 *
 * And: "Claude never duplicates derivable information like version (from directory name), story_slug (from parent directory), timestamps (from filesystem), or specialist (from file path context)."
 *
 * @enforcement
 * This rule checks YAML frontmatter in:
 * - essay/[version]/essay.md files
 * - sources/[subdir]/*.md files
 * - essay/[version]/reviews/[type]/*.md files
 * - essay/[version]/workspace/*.md files
 *
 * @notFixable
 * This rule is not automatically fixable because:
 * - Field values require context and human judgment
 * - Source URLs require actual research
 * - Quality assessments need human evaluation
 */

interface FrontmatterRequirements {
  [pattern: string]: string[];
}

const FRONTMATTER_REQUIREMENTS: FrontmatterRequirements = {
  essay: ['title', 'status', 'contributors', 'target_audience'],
  review: ['overall_effectiveness', 'key_issues', 'recommended_changes', 'priority'],
  source: ['source_url'], // Only source_url is required; other fields are optional
  archive: ['original_url', 'archived_date', 'archived_by', 'archive_method', 'title'], // Archive-specific requirements
  workspace: ['phase', 'sources_reviewed', 'key_gaps', 'next_priorities']
};

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const lines = content.trim().split('\n');

  if (lines.length < 3 || lines[0] !== '---') {
    return null;
  }

  let endIndex = -1;
  for (let i = 1; i < Math.min(lines.length, 30); i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return null;
  }

  const yamlContent = lines.slice(1, endIndex).join('\n');

  try {
    return yaml.load(yamlContent) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getRequiredFields(filePath: string): string[] {
  // Archive files (in sources/archives/)
  if (filePath.includes('/sources/archives/') && filePath.endsWith('.md')) {
    return FRONTMATTER_REQUIREMENTS['archive'];
  }
  // Other source files
  else if (filePath.includes('/sources/') && filePath.endsWith('.md')) {
    return FRONTMATTER_REQUIREMENTS['source'];
  }
  // Review files
  else if (filePath.includes('/reviews/') && filePath.endsWith('.md')) {
    return FRONTMATTER_REQUIREMENTS['review'];
  }
  // Workspace files
  else if (filePath.includes('/workspace/') && filePath.endsWith('.md')) {
    return FRONTMATTER_REQUIREMENTS['workspace'];
  }
  // Essay files (directly in essay/[version]/ directory)
  else if (filePath.includes('/essay/') && filePath.endsWith('/essay.md')) {
    return FRONTMATTER_REQUIREMENTS['essay'];
  }
  return [];
}

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    // Define file patterns to check
    const filePatterns = [
      { path: 'sources', pattern: '**/*.md', type: 'source' },
      { path: 'essay', pattern: '*/essay.md', type: 'essay' },
      { path: 'essay', pattern: '*/reviews/**/*.md', type: 'review' },
      { path: 'essay', pattern: '*/workspace/*.md', type: 'workspace' }
    ];

    for (const { path, pattern, type } of filePatterns) {
      const files = await findFiles(resolveProjectPath(storyPath, path), pattern);

      for (const file of files) {
        try {
          const content = await readFile(file);
          const frontmatter = parseFrontmatter(content);

          if (frontmatter) {
            const requiredFields = getRequiredFields(file);
            const relativePath = file.replace(storyPath + '/', '');
            const missingFields: string[] = [];

            for (const field of requiredFields) {
              if (!(field in frontmatter) || frontmatter[field] === null || frontmatter[field] === '') {
                missingFields.push(field);
              }
            }

            if (missingFields.length > 0) {
              const fieldsList = missingFields.join(', ');
              const fileType = type.charAt(0).toUpperCase() + type.slice(1);
              violations.push(
                createViolation(
                  'MISSING_FRONTMATTER_FIELD',
                  `${fileType} file missing required frontmatter field${missingFields.length > 1 ? 's' : ''}: ${fieldsList}`,
                  `${rootDir}/${storySlug}/${relativePath}`
                )
              );
            }
          }
        } catch (error: unknown) {
          // Only suppress known file system errors for missing/inaccessible files
          if (shouldSuppressError(error)) {
            // Skip files that don't exist or can't be read due to permissions
            continue;
          }
          // Re-throw unexpected errors (parse errors, memory issues, etc.)
          throw error;
        }
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'MISSING_FRONTMATTER_FIELD',
  title: 'Missing Frontmatter Field',
  check
};

export default rule;
