export interface RuleViolation {
  code: string;
  title: string;
  description: string;
  location: string; // Path relative to workspace root
  severity?: 'error' | 'warning';
}

export type RuleFunction = (workspacePath: string) => Promise<RuleViolation[] | null>;

export interface ParseResult {
  violations: RuleViolation[];
  checkedRules: string[];
}

// Re-export Rule type
export type { Rule } from './types/rule.js';
