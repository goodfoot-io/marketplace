import type { Rule, RuleViolation } from '../types.js';
import { findDuplicateTemplatesDirs } from '../utils/directory-utils.js';
import { createViolation } from '../utils/parse-utils.js';

/**
 * DUPLICATE_TEMPLATES_DIR Rule
 *
 * Ensures _templates directories only exist at the workspace root
 *
 * @description
 * The _templates directory contains reusable assets (personas, rubrics, workflows)
 * that should be shared across all stories. Having duplicate _templates directories
 * in other locations can lead to confusion and inconsistency.
 *
 * @rationale
 * From protocols/organization-protocol.md: "_templates/                               # Shared rubrics and workflows"
 *
 * And from the mandatory practices section: "Claude never: 1. Creates custom directory structures"
 *
 * @enforcement
 * This rule checks for _templates directories in:
 * - /active/_templates/
 * - /review/_templates/
 * - /published/_templates/
 * - /archive/_templates/
 * - Any story directory (e.g., /active/story-name/_templates/)
 *
 * @notFixable
 * This rule is not automatically fixable because:
 * - Templates may need to be merged or deduplicated
 * - Some templates might be story-specific customizations
 * - Requires human judgment to consolidate properly
 * - May affect references to template files
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];

  const duplicates = await findDuplicateTemplatesDirs(workspacePath);

  for (const duplicatePath of duplicates) {
    violations.push(
      createViolation(
        'DUPLICATE_TEMPLATES_DIR',
        `Duplicate _templates directory found - should only exist at root`,
        duplicatePath
      )
    );
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'DUPLICATE_TEMPLATES_DIR',
  title: 'Duplicate Templates Directory',
  check
};

export default rule;
