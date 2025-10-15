import type { Rule, RuleViolation } from '../types.js';
import { findFiles } from '../utils/directory-utils.js';
import { resolveProjectPath, readFile, shouldSuppressError } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * MISSING_YAML_FRONTMATTER Rule
 *
 * Ensures all markdown files that require frontmatter have valid YAML frontmatter
 *
 * @description
 * Source files in the newsroom structure must include YAML frontmatter
 * with metadata about the source, including the required source_url field.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude uses YAML frontmatter only for non-derivable metadata"
 *
 * And: "Claude manages sources with proper naming and URLs:
 * - File naming: `[YYYYMMDD]-[original-filename]` (e.g., `20250113-climate-report.pdf`)
 * - Every source file MUST include exact source URLs in frontmatter
 * - Sources in `synthesis/` subdirectories are exempt from individual URL requirements"
 *
 * @enforcement
 * This rule checks all markdown files in:
 * - sources/ (all subdirectories)
 *
 * @notFixable
 * This rule is not automatically fixable because:
 * - Frontmatter structure varies by file type
 * - Required fields depend on the specific file purpose
 * - Values require human context and judgment
 */

function hasYamlFrontmatter(content: string): boolean {
  const lines = content.trim().split('\n');

  // Check if file starts with --- (allow trailing whitespace)
  if (lines.length < 3 || !lines[0].trim().startsWith('---') || lines[0].trim() !== '---') {
    return false;
  }

  // Look for closing --- within first 20 lines (allow trailing whitespace)
  for (let i = 1; i < Math.min(lines.length, 20); i++) {
    if (lines[i].trim() === '---') {
      return true;
    }
  }

  return false;
}

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    // Define patterns for files that require frontmatter
    // According to protocol, only source files MUST have frontmatter
    const filePatterns = [{ path: 'sources', pattern: '**/*.md', description: 'Source' }];

    for (const { path, pattern, description } of filePatterns) {
      const files = await findFiles(resolveProjectPath(storyPath, path), pattern);

      for (const file of files) {
        // Skip hidden files
        const fileName = file.split('/').pop() || '';
        if (fileName.startsWith('.')) continue;

        const relativePath = file.substring(storyPath.length + 1);

        // Skip files in synthesis subdirectories
        if (relativePath.startsWith('sources/synthesis/')) continue;

        try {
          const content = await readFile(file);
          if (!hasYamlFrontmatter(content)) {
            violations.push(
              createViolation(
                'MISSING_YAML_FRONTMATTER',
                `${description} file missing required YAML frontmatter (must start and end with --- delimiters)`,
                `${rootDir}/${storySlug}/${relativePath}`
              )
            );
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
  code: 'MISSING_YAML_FRONTMATTER',
  title: 'Missing YAML Frontmatter',
  check
};

export default rule;
