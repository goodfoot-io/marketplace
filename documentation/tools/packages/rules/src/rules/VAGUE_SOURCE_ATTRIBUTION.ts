import type { Rule, RuleViolation } from '../types.js';
import { isDirectory, readDirectory, resolveProjectPath, readFile, shouldSuppressError } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';
import { containsVagueAttribution, getFirstLines, URL_PATTERN } from '../utils/validation-utils.js';

/**
 * VAGUE_SOURCE_ATTRIBUTION Rule
 *
 * Ensures research files include specific source URLs, not vague attributions
 *
 * @description
 * Research files must include exact source URLs to ensure credibility and
 * allow verification. Vague attributions undermine the quality of research.
 *
 * @rationale
 * From protocols/organization-protocol.md: "Claude manages sources with proper naming and URLs:
 * - File naming: `[YYYYMMDD]-[original-filename]` (e.g., `20250113-climate-report.pdf`)
 * - Every source file MUST include exact source URLs in frontmatter
 * - Sources in `synthesis/` subdirectories are exempt from individual URL requirements"
 *
 * @enforcement
 * This rule checks:
 * 1. Markdown files in sources/data/ for vague attribution phrases
 * 2. Presence of at least one URL in the first 50 lines
 * 3. Proper source attribution format
 *
 * @notFixable
 * This rule is not automatically fixable because:
 * - Requires finding the actual sources referenced
 * - Needs human research to locate proper URLs
 * - May require contacting original authors or researchers
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const sourcesPath = resolveProjectPath(storyPath, 'sources');

    if (await isDirectory(sourcesPath)) {
      // Check all subdirectories under sources/
      const sourceSubdirs = await readDirectory(sourcesPath);

      for (const subdir of sourceSubdirs) {
        const subdirPath = resolveProjectPath(sourcesPath, subdir);

        // Skip if it's not a directory
        if (!(await isDirectory(subdirPath))) continue;

        // Skip synthesis directory - synthesis files are exempt from URL requirements
        if (subdir === 'synthesis') continue;

        // Process data subdirectory
        if (subdir === 'data') {
          const dataContents = await readDirectory(subdirPath);
          for (const item of dataContents) {
            const itemPath = resolveProjectPath(subdirPath, item);

            // Process regular markdown files in data directory
            if (item.endsWith('.md') && !item.startsWith('.') && !(await isDirectory(itemPath))) {
              try {
                const content = await readFile(itemPath);
                const lines = getFirstLines(content, 50);

                const firstSection = lines.join('\n');

                // Check for vague attributions
                const vaguePhrase = containsVagueAttribution(firstSection);
                const hasUrl = URL_PATTERN.test(firstSection);
                const hasSourceLine = /^Source:\s+http/m.test(firstSection);
                const hasAnySourceLine = /^Source:\s+/m.test(firstSection);

                if (vaguePhrase) {
                  violations.push(
                    createViolation(
                      'VAGUE_SOURCE_ATTRIBUTION',
                      `Research file contains vague attribution "${vaguePhrase}" - must provide specific, exact source URLs`,
                      `${rootDir}/${storySlug}/sources/${subdir}/${item}`,
                      'error'
                    )
                  );
                } else if (hasAnySourceLine && (!hasUrl || !hasSourceLine)) {
                  // Only check for missing URL if there's a Source: line but it's not a proper URL
                  violations.push(
                    createViolation(
                      'VAGUE_SOURCE_ATTRIBUTION',
                      `Research file missing proper source attribution with exact URL`,
                      `${rootDir}/${storySlug}/sources/${subdir}/${item}`,
                      'error'
                    )
                  );
                }
              } catch (error: unknown) {
                if (!shouldSuppressError(error)) {
                  throw error;
                }
              }
            }
          }
          continue;
        }

        // Process other subdirectories normally
        const files = await readDirectory(subdirPath);

        for (const file of files) {
          // Only check markdown files
          if (!file.endsWith('.md')) continue;

          // Skip hidden files
          if (file.startsWith('.')) continue;

          const filePath = resolveProjectPath(subdirPath, file);

          // Skip if it's a directory
          if (await isDirectory(filePath)) continue;

          try {
            const content = await readFile(filePath);
            const lines = getFirstLines(content, 50);
            const firstSection = lines.join('\n');

            // Check for vague attributions
            const vaguePhrase = containsVagueAttribution(firstSection);
            const hasUrl = URL_PATTERN.test(firstSection);
            const hasSourceLine = /^Source:\s+http/m.test(firstSection);
            const hasAnySourceLine = /^Source:\s+/m.test(firstSection);

            if (vaguePhrase) {
              violations.push(
                createViolation(
                  'VAGUE_SOURCE_ATTRIBUTION',
                  `Research file contains vague attribution "${vaguePhrase}" - must provide specific, exact source URLs`,
                  `${rootDir}/${storySlug}/sources/${subdir}/${file}`,
                  'error'
                )
              );
            } else if (hasAnySourceLine && (!hasUrl || !hasSourceLine)) {
              // Only check for missing URL if there's a Source: line but it's not a proper URL
              violations.push(
                createViolation(
                  'VAGUE_SOURCE_ATTRIBUTION',
                  `Research file missing proper source attribution with exact URL`,
                  `${rootDir}/${storySlug}/sources/${subdir}/${file}`,
                  'error'
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
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'VAGUE_SOURCE_ATTRIBUTION',
  title: 'Vague Source Attribution',
  check
};

export default rule;
