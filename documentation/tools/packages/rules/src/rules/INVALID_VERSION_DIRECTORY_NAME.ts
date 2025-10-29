import type { Rule, RuleViolation } from '../types.js';
import { isDirectory, readDirectory, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * INVALID_VERSION_DIRECTORY_NAME Rule
 *
 * Ensures version directories follow the required naming convention
 *
 * @description
 * Version directories must follow a specific format that includes a timestamp
 * and a descriptive reason that explains what changed in that version.
 *
 * @rationale
 * From protocols/organization-protocol.md:
 * "**5. Timestamp Versioning**: Claude uses the format `[YYMMDDHHMM]-[reason]/` where:
 * - `YYMMDDHHMM`: 10-digit timestamp (YY=year, MM=month, DD=day, HH=hour, MM=minute)
 * - Always uses 24-hour format (00-23)
 * - Always uses America/New_York timezone
 * - Example: `2501131445` = January 13, 2025, 14:45 America/New_York
 * - `reason`: 2-3 word lowercase slug with hyphens describing why the version was created"
 *
 * @enforcement
 * This rule is applied to:
 * - All version directories in essay/ directories
 * - Validates directory naming format
 *
 * @pattern
 * Valid pattern: /^\d{10}-[a-z]+(-[a-z]+){1,2}$/
 * - Must start with 10-digit timestamp (YYMMDDHHMM)
 * - Followed by hyphen and descriptive reason (2-3 words, lowercase with hyphens)
 * - Directory name (no file extension)
 *
 * @notFixable
 * This rule is not automatically fixable because:
 * - The correct status descriptor requires understanding the changes
 * - Date might need to be corrected based on actual modification time
 * - Version number sequence must be maintained
 * - Renaming could break references in changelog
 */

// Common temporal/hyperbolic terms to avoid
const AVOIDED_TERMS = [
  'final',
  'complete',
  'last',
  'finished',
  'done',
  'perfected',
  'ultimate',
  'masterful',
  'perfect',
  'best'
];

// Valid status descriptors based on examples
const VALID_STATUS_EXAMPLES = [
  'initial',
  'audience-feedback',
  'fact-checked',
  'restructured',
  'citations-added',
  'edited',
  'reviewed',
  'revised',
  'corrected'
];

const VERSION_PATTERN = /^\d{10}-[a-z]+(-[a-z]+){1,2}$/;

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const essayPath = resolveProjectPath(storyPath, 'essay');

    if (await isDirectory(essayPath)) {
      const directories = await readDirectory(essayPath);

      for (const dir of directories) {
        // Skip working directory and changelog file
        if (dir === 'working' || dir === 'changelog.md') continue;

        // Check directories that might be version attempts (contain hyphens, but exclude known non-version directories)
        const isDirPath = await isDirectory(resolveProjectPath(essayPath, dir));
        const excludedDirs = ['review-metadata', 'fact-check', 'data-translation', 'some-other-dir'];
        const mightBeVersion = dir.includes('-') && !dir.startsWith('.') && !excludedDirs.includes(dir);

        if (isDirPath && mightBeVersion) {
          const match = VERSION_PATTERN.test(dir);

          if (!match) {
            violations.push(
              createViolation(
                'INVALID_VERSION_DIRECTORY_NAME',
                `Version directory \`${dir}\` doesn't match required pattern: [YYMMDDHHMM]-[reason] (e.g., 2501130945-initial-research)`,
                `${rootDir}/${storySlug}/essay/${dir}`
              )
            );
          } else {
            // Validate the timestamp part
            const timestampStr = dir.substring(0, 10);
            const year = parseInt('20' + timestampStr.substring(0, 2));
            const month = parseInt(timestampStr.substring(2, 4));
            const day = parseInt(timestampStr.substring(4, 6));
            const hour = parseInt(timestampStr.substring(6, 8));
            const minute = parseInt(timestampStr.substring(8, 10));

            // Check if it's a valid date and time
            const testDate = new Date(year, month - 1, day, hour, minute);
            const isValidTimestamp =
              testDate.getFullYear() === year &&
              testDate.getMonth() === month - 1 &&
              testDate.getDate() === day &&
              testDate.getHours() === hour &&
              testDate.getMinutes() === minute &&
              month >= 1 &&
              month <= 12 &&
              day >= 1 &&
              day <= 31 &&
              hour >= 0 &&
              hour <= 23 &&
              minute >= 0 &&
              minute <= 59;

            if (!isValidTimestamp) {
              violations.push(
                createViolation(
                  'INVALID_VERSION_DIRECTORY_NAME',
                  `Version directory \`${dir}\` has invalid timestamp "${timestampStr}" - use valid YYMMDDHHMM format`,
                  `${rootDir}/${storySlug}/essay/${dir}`
                )
              );
            } else {
              // Check for avoided terms in the reason part
              const reasonPart = dir.substring(11); // After timestamp and hyphen
              const reasonWords = reasonPart.split('-');

              for (const word of reasonWords) {
                if (AVOIDED_TERMS.includes(word)) {
                  violations.push(
                    createViolation(
                      'INVALID_VERSION_DIRECTORY_NAME',
                      `Version directory \`${dir}\` uses avoided term "${word}" - use descriptive reason like: ${VALID_STATUS_EXAMPLES.join(', ')}`,
                      `${rootDir}/${storySlug}/essay/${dir}`,
                      'warning'
                    )
                  );
                  break;
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

// Export the rule as default
const rule: Rule = {
  code: 'INVALID_VERSION_DIRECTORY_NAME',
  title: 'Invalid Version Directory Name',
  check
};

export default rule;
