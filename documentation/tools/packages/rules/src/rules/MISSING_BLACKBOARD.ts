import type { Rule, RuleViolation } from '../types.js';
import { fileExists, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';

/**
 * MISSING_BLACKBOARD Rule
 *
 * Ensures every story has a blackboard.yaml file at `agents/blackboard.yaml`
 *
 * @description
 * The blackboard serves as shared memory for all agents working on a story.
 * It contains project metadata, shared knowledge, agent activity tracking,
 * and specialist requests.
 *
 * @rationale
 * From protocols/organization-protocol.md: "**2. Blackboard Coordination**: All agent communication occurs through `blackboard.yaml` with message notifications. No file locking required."
 *
 * @enforcement
 * This rule is applied to all stories in:
 * - /active/
 * - /review/
 * - /published/
 * - /archive/
 *
 * The rule does NOT apply to:
 * - _templates directories
 * - Hidden directories (starting with .)
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
    const blackboardPath = resolveProjectPath(storyPath, 'agents/blackboard.yaml');

    if (!(await fileExists(blackboardPath))) {
      violations.push(
        createViolation(
          'MISSING_BLACKBOARD',
          `Story \`${storySlug}\` is missing required blackboard.yaml`,
          `${rootDir}/${storySlug}/agents/blackboard.yaml`
        )
      );
    }
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'MISSING_BLACKBOARD',
  title: 'Missing Blackboard File',
  check
};

export default rule;
