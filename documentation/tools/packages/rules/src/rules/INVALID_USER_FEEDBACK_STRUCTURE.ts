import type { Rule, RuleViolation } from '../types.js';
import { stat } from 'fs/promises';
import path from 'path';
import { fileExists, isDirectory, readDirectory, readFile, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * INVALID_USER_FEEDBACK_STRUCTURE Rule
 *
 * Validates that user-feedback.md files adhere to the required multi-entry format.
 *
 * @description
 * This rule ensures that `user-feedback.md` files follow the multi-entry format,
 * where each entry is separated by `---`. Each entry must contain the required
 * sections: `## Request`, `## Intent Analysis`, and `## Implementation`.
 *
 * @rationale
 * From protocols/organization-protocol.md:
 * "**User feedback files** maintain core sections for each entry:
 * ```markdown
 * ## Request
 * [User's exact words]
 *
 * ## Intent Analysis
 * - Literal request: [What they asked for]
 * - Underlying goal: [What they want to achieve]
 * - Success criteria: [How they'll measure success]
 *
 * ## Implementation
 * - Priorities: [Most critical aspects]
 * - Specialists needed: [Who can address the need]
 * - Key context: [Important details from conversation]
 *
 * ---
 * ```"
 *
 * @enforcement
 * The rule checks every `user-feedback.md` file in each version directory. It splits
 * the file content by `---` and verifies that each resulting entry contains the
 * three mandatory `##`-prefixed section headers.
 *
 * @notFixable
 * The structure of `user-feedback.md` requires manual intervention to correctly
 * capture user intent. The rule cannot automatically generate the required sections.
 */
async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];
  const requiredSections = ['## Request', '## Intent Analysis', '## Implementation'];

  for await (const { rootDir, storySlug } of iterateStories(workspacePath)) {
    const essayPath = path.join(rootDir, storySlug, 'essay');
    const absoluteEssayPath = resolveProjectPath(workspacePath, essayPath);
    if (!(await isDirectory(absoluteEssayPath))) {
      continue;
    }

    const versions = await readDirectory(absoluteEssayPath);
    for (const version of versions) {
      const versionPath = path.join(essayPath, version);
      const absoluteVersionPath = resolveProjectPath(workspacePath, versionPath);

      try {
        if ((await stat(absoluteVersionPath)).isDirectory()) {
          const feedbackFile = 'user-feedback.md';
          const feedbackFilePath = path.join(versionPath, feedbackFile);
          const absoluteFeedbackFilePath = resolveProjectPath(workspacePath, feedbackFilePath);

          if (await fileExists(absoluteFeedbackFilePath)) {
            const content = await readFile(absoluteFeedbackFilePath);
            const entries = content.split('---').filter((e) => e.trim());

            if (entries.length === 0 && content.trim() !== '' && content.trim() !== '---') {
              const hasAllSections = requiredSections.every((section) => content.includes(section));
              if (!hasAllSections) {
                const missingSections = requiredSections.filter((section) => !content.includes(section));
                violations.push(
                  createViolation(
                    'INVALID_USER_FEEDBACK_STRUCTURE',
                    `The \`user-feedback.md\` file in version \`${version}\` of story \`${storySlug}\` is missing required sections: ${missingSections.join(
                      ', '
                    )}.`,
                    feedbackFilePath,
                    'error'
                  )
                );
              }
            } else if (entries.length > 0) {
              entries.forEach((entry, index) => {
                const missingSections = requiredSections.filter((section) => !entry.includes(section));
                if (missingSections.length > 0) {
                  violations.push(
                    createViolation(
                      'INVALID_USER_FEEDBACK_STRUCTURE',
                      `Entry ${
                        index + 1
                      } in \`user-feedback.md\` for version \`${version}\` of story \`${storySlug}\` is missing required sections: ${missingSections.join(
                        ', '
                      )}.`,
                      feedbackFilePath,
                      'error'
                    )
                  );
                }
              });
            }
          }
        }
      } catch {
        // Ignore errors from stat, e.g. if a file is not a directory
      }
    }
  }
  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'INVALID_USER_FEEDBACK_STRUCTURE',
  title: 'Invalid User Feedback Structure',
  check
};

export default rule;
