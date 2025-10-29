export interface RuleViolation {
  code: string;
  title: string;
  description: string;
  location: string; // Path relative to workspace root
  severity?: 'error' | 'warning';
  fixable?: boolean;
}

export interface FixResult {
  fixed: boolean;
  message: string; // Description of what was done or why it failed
}
