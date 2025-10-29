import type { Rule } from '../types/rule.js';
import type { RuleViolation } from '../types.js';
import { join } from 'path';
import { fileExists, isDirectory } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * MISSING_CHANGELOG Rule
 *
 * Ensures each story has a changelog.md file in the essay/ directory
 *
 * @description
 * Validates that stories with essay directories contain a changelog.md file
 * to track version history and evolution of the content. This file is essential
 * for maintaining an audit trail of all changes and revisions.
 *
 * @rationale
 * From protocols/organization-protocol.md: "│   │   └── changelog.md                  # Version history"
 *
 * @enforcement
 * Checks all stories that have an essay/ directory and ensures they contain
 * a changelog.md file. Only stories with essay directories are checked since
 * stories without essays don't require version tracking.
 *
 * @fixable
 * Can automatically create a basic changelog.md template with initial content
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const essayPath = join(storyPath, 'essay');

    // Only check stories that have an essay directory
    if (await isDirectory(essayPath)) {
      const changelogPath = join(essayPath, 'changelog.md');

      if (!(await fileExists(changelogPath))) {
        violations.push(
          createViolation(
            'MISSING_CHANGELOG',
            `Story \`${storySlug}\` is missing required \`essay/changelog.md\` file for version history tracking`,
            `${rootDir}/${storySlug}/essay/changelog.md`,
            'error'
          )
        );
      }
    }
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'MISSING_CHANGELOG',
  title: 'Missing Version History File',
  check
};

export default rule;
