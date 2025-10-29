import type { Rule, RuleViolation } from '../types.js';
import * as path from 'path';
import { TEMPLATE_SUBDIRECTORIES } from '../utils/directory-utils.js';
import { fileExists, isDirectory } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';

/**
 * MISSING_TEMPLATE_SUBDIR Rule
 *
 * Ensures the required subdirectories exist within _templates/
 *
 * @description
 * The _templates/ directory must contain specific subdirectories for
 * organizing reusable assets across all stories.
 *
 * @rationale
 * From protocols/organization-protocol.md: "_templates/                               # Shared rubrics and workflows"
 *
 * @enforcement
 * This rule checks for required subdirectories within _templates/
 * Only runs if _templates/ exists
 *
 * @fixable
 * This rule can automatically create missing subdirectories
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const templatesPath = path.join(workspacePath, '_templates');

  // Only check if _templates exists
  if (!(await fileExists(templatesPath))) {
    return null;
  }

  const violations: RuleViolation[] = [];

  // Check main subdirectories
  for (const subdir of TEMPLATE_SUBDIRECTORIES) {
    const subdirPath = path.join(templatesPath, subdir);
    if (!(await isDirectory(subdirPath))) {
      violations.push(
        createViolation(
          'MISSING_TEMPLATE_SUBDIR',
          `Missing required subdirectory \`_templates/${subdir}/\``,
          `_templates/${subdir}`
        )
      );
    }
  }

  return violations.length > 0 ? violations : null;
}

// Export the rule as default
const rule: Rule = {
  code: 'MISSING_TEMPLATE_SUBDIR',
  title: 'Missing Template Subdirectory',
  check
};

export default rule;
