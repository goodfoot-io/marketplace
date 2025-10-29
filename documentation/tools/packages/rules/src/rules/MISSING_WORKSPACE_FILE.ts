import type { Rule, RuleViolation } from '../types.js';

/**
 * MISSING_WORKSPACE_FILE Rule
 *
 * [DEPRECATED - This rule contradicts the organization protocol]
 *
 * @description
 * This rule has been disabled because it contradicts the organization protocol's
 * principle of specialist autonomy: "Specialists create the files they need when
 * they need them... not as empty placeholders."
 *
 * @rationale
 * The protocol emphasizes file-driven workflow where the presence/absence of files
 * indicates workflow state. Requiring all workspace files in every version breaks
 * this mechanism and forces creation of empty placeholders.
 *
 * @deprecated
 * Different version types have different needs - not all versions require all files.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function check(_workspacePath: string): Promise<RuleViolation[] | null> {
  // Rule deprecated - contradicts organization protocol's specialist autonomy principle
  // Files should be created "when needed" not as empty placeholders
  return await Promise.resolve(null);
}

const rule: Rule = {
  code: 'MISSING_WORKSPACE_FILE',
  title: 'Missing Required Workspace File',
  check
};

export default rule;
