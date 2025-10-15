import type { Rule, RuleViolation } from '../types.js';
import { isDirectory, readDirectory, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';
import { hasDatePrefix } from '../utils/validation-utils.js';

/**
 * MISSING_SOURCE_DATE_PREFIX Rule
 *
 * Ensures source files have the required date prefix
 *
 * @description
 * Source files should be prefixed with a date to track when they were
 * collected or accessed, making it easier to understand the timeline
 * of research and identify potentially outdated sources.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude manages sources with proper naming and URLs:
 * - File naming: `[YYYYMMDD]-[original-filename]` (e.g., `20250113-climate-report.pdf`)"
 *
 * @enforcement
 * This rule is applied to all files in:
 * - sources/documents/
 * - sources/interviews/
 * - sources/data/
 * - sources/archives/
 *
 * @pattern
 * Required prefix format: YYYYMMDD-
 * Example: 20250110-filename.ext
 *
 * @notFixable
 * This rule is not automatically fixable because:
 * - The correct date might be the access date, publication date, or collection date
 * - Requires human judgment to determine the appropriate date
 * - May need to check file metadata or content to determine date
 */

const SOURCE_SUBDIRS = ['documents', 'interviews', 'data', 'archives'] as const;

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const sourcesPath = resolveProjectPath(storyPath, 'sources');

    if (await isDirectory(sourcesPath)) {
      for (const subdir of SOURCE_SUBDIRS) {
        const subdirPath = resolveProjectPath(sourcesPath, subdir);

        if (await isDirectory(subdirPath)) {
          const files = await readDirectory(subdirPath);

          for (const file of files) {
            // Skip hidden files
            if (file.startsWith('.')) continue;

            const filePath = resolveProjectPath(subdirPath, file);

            // Skip all directories (we only check files)
            if (await isDirectory(filePath)) continue;

            if (!hasDatePrefix(file)) {
              violations.push(
                createViolation(
                  'MISSING_SOURCE_DATE_PREFIX',
                  `Source file \`${file}\` missing required date prefix (YYYYMMDD-) - example: 20250110-${file}`,
                  `${rootDir}/${storySlug}/sources/${subdir}/${file}`,
                  'warning'
                )
              );
            }
          }
        }
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'MISSING_SOURCE_DATE_PREFIX',
  title: 'Missing Source Date Prefix',
  check
};

export default rule;
