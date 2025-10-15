import type { Rule, RuleViolation } from '../types.js';
import { join, relative } from 'path';
import { isDirectory } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * LEGACY_AGENTS_DIRECTORY_FOUND Rule
 *
 * Detects the legacy hidden .agents/ directory and suggests renaming it
 *
 * @description
 * The protocol has moved from a hidden `.agents/` directory to a visible `agents/`
 * directory for better transparency. This rule detects the old directory and
 * provides a fix to rename it.
 *
 * @rationale
 * From protocols/organization-protocol.md: "│   ├── agents/                           # Agent coordination (visible)"
 *
 * @enforcement
 * Checks for the existence of `.agents/` at the story root. If found, it creates
 * a violation.
 *
 * @fixable
 * The fix renames the `.agents/` directory to `agents/`.
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { storySlug, storyPath } of iterateStories(workspacePath)) {
    const legacyAgentsPath = join(storyPath, '.agents');
    if (await isDirectory(legacyAgentsPath)) {
      violations.push(
        createViolation(
          'LEGACY_AGENTS_DIRECTORY_FOUND',
          `Legacy hidden directory \`.agents/\` found in story \`${storySlug}\`. Should be renamed to \`agents/\``,
          relative(workspacePath, legacyAgentsPath)
        )
      );
    }
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'LEGACY_AGENTS_DIRECTORY_FOUND',
  title: 'Legacy .agents/ Directory Found',
  check
};

export default rule;
