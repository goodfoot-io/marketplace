import type { Rule, RuleViolation } from '../types.js';
import * as path from 'path';
import { fileExists } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';

/**
 * MISSING_ROOT_TEMPLATES Rule
 *
 * Ensures the root _templates/ directory exists
 *
 * @description
 * The _templates/ directory contains reusable assets shared across all stories,
 * including personas, rubrics, and workflows.
 *
 * @rationale
 * From protocols/organization-protocol.md: "_templates/                               # Shared rubrics and workflows"
 *
 * @enforcement
 * This rule checks for the existence of _templates/ at the workspace root
 *
 * @fixable
 * This rule can automatically create the missing directory structure
 */

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const templatesPath = path.join(workspacePath, '_templates');

  if (!(await fileExists(templatesPath))) {
    return [
      createViolation(
        'MISSING_ROOT_TEMPLATES',
        'Missing required `_templates/` directory at workspace root',
        '_templates'
      )
    ];
  }

  return null;
}

// Export the rule as default
const rule: Rule = {
  code: 'MISSING_ROOT_TEMPLATES',
  title: 'Missing Root Templates Directory',
  check
};

export default rule;
