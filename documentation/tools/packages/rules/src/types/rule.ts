import type { RuleViolation } from '../types.js';

/**
 * A rule module that checks for violations
 */
export interface Rule {
  /**
   * Unique identifier for this rule (e.g., 'MISSING_BLACKBOARD')
   */
  code: string;

  /**
   * Human-readable title for this rule
   */
  title: string;

  /**
   * Check for violations of this rule
   */
  check(workspacePath: string): Promise<RuleViolation[] | null>;
}
