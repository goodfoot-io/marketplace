import type { Rule, RuleViolation } from '../types.js';
import * as yaml from 'js-yaml';
import { readFile, resolveProjectPath, isDirectory, readDirectory, shouldSuppressError } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';
import { URL_PATTERN } from '../utils/validation-utils.js';

/**
 * MISSING_SOURCE_URL Rule
 *
 * Ensures all source files include exact source URLs in YAML frontmatter
 *
 * @description
 * Source files must include exact source URLs in their YAML frontmatter
 * to maintain traceability and credibility. The source_url field is required
 * in the frontmatter for all source documents.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude manages sources with proper naming and URLs:
 * - File naming: `[YYYYMMDD]-[original-filename]` (e.g., `20250113-climate-report.pdf`)
 * - Every source file MUST include exact source URLs in frontmatter
 * - Sources in `synthesis/` subdirectories are exempt from individual URL requirements"
 *
 * @enforcement
 * This rule is applied to:
 * - All .md files in sources/ directories and subdirectories
 * - Checks for source_url field in YAML frontmatter
 * - Validates that the URL is properly formatted
 *
 * @notFixable
 * This rule is not automatically fixable because:
 * - The correct source URL requires human research
 * - Cannot determine the original source programmatically
 * - May require access to external resources
 */

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

async function checkSourcesRecursively(
  basePath: string,
  currentPath: string,
  rootDir: string,
  storySlug: string,
  violations: RuleViolation[],
  relativePath: string = ''
): Promise<void> {
  const items = await readDirectory(currentPath);

  for (const item of items) {
    const itemPath = resolveProjectPath(currentPath, item);
    const newRelativePath = relativePath ? `${relativePath}/${item}` : item;

    if (await isDirectory(itemPath)) {
      // Skip the synthesis directory and its contents entirely.
      if (item === 'synthesis') {
        continue;
      }
      // Recursively check other subdirectories
      await checkSourcesRecursively(basePath, itemPath, rootDir, storySlug, violations, newRelativePath);
    } else if (item.endsWith('.md') && !item.startsWith('.')) {
      // Check markdown files
      try {
        const content = await readFile(itemPath);
        const frontmatter = parseFrontmatter(content);

        if (!frontmatter) {
          const isArchiveFile = newRelativePath.startsWith('archives/') || relativePath === 'archives';
          const urlFieldName = isArchiveFile ? 'original_url' : 'source_url';
          violations.push(
            createViolation(
              'MISSING_SOURCE_URL',
              `Source file \`${item}\` must have YAML frontmatter with ${urlFieldName} field`,
              `${rootDir}/${storySlug}/sources/${newRelativePath}`,
              'error'
            )
          );
        } else {
          // Check if this is an archive file
          const isArchiveFile = newRelativePath.startsWith('archives/') || relativePath === 'archives';
          const urlFieldName = isArchiveFile ? 'original_url' : 'source_url';
          const sourceUrl = frontmatter[urlFieldName];

          if (!sourceUrl) {
            violations.push(
              createViolation(
                'MISSING_SOURCE_URL',
                `Source file \`${item}\` missing required ${urlFieldName} field in frontmatter`,
                `${rootDir}/${storySlug}/sources/${newRelativePath}`,
                'error'
              )
            );
          } else if (typeof sourceUrl !== 'string' || !URL_PATTERN.test(sourceUrl)) {
            violations.push(
              createViolation(
                'MISSING_SOURCE_URL',
                `Source file \`${item}\` has invalid ${urlFieldName} format (must be a valid URL)`,
                `${rootDir}/${storySlug}/sources/${newRelativePath}`,
                'error'
              )
            );
          }
        }
      } catch (error: unknown) {
        if (!shouldSuppressError(error)) {
          throw error;
        }
      }
    }
  }
}

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const sourcesPath = resolveProjectPath(storyPath, 'sources');

    if (await isDirectory(sourcesPath)) {
      await checkSourcesRecursively(sourcesPath, sourcesPath, rootDir, storySlug, violations);
    }
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'MISSING_SOURCE_URL',
  title: 'Missing Source URL',
  check
};

export default rule;
