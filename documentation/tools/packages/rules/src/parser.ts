import type { Rule } from './types/rule.js';
import type { ParseResult, RuleViolation } from './types.js';
import { loadRules } from './rule-loader.js';

export class OrganizationParser {
  private rules: Map<string, Rule> | null = null;

  /**
   * Ensures rules are loaded
   */
  private async ensureRulesLoaded(): Promise<void> {
    if (!this.rules) {
      this.rules = await loadRules();
    }
  }

  /**
   * Parse the workspace and check for violations
   */
  async parse(workspacePath: string, ruleCodes?: string[]): Promise<ParseResult> {
    await this.ensureRulesLoaded();

    const violations: RuleViolation[] = [];
    const checkedRules: string[] = [];

    const rulesToRun = ruleCodes || Array.from(this.rules!.keys());

    for (const ruleCode of rulesToRun) {
      const rule = this.rules!.get(ruleCode);
      if (!rule) {
        console.warn(`Unknown rule: ${ruleCode}`);
        continue;
      }

      try {
        const ruleViolations = await rule.check(workspacePath);
        if (ruleViolations) {
          violations.push(...ruleViolations);
        }
        checkedRules.push(ruleCode);
      } catch (error) {
        violations.push({
          code: 'RULE_ERROR',
          title: 'Rule Execution Error',
          description: `Error running rule "${ruleCode}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          location: 'parser',
          severity: 'error'
        });
      }
    }

    return {
      violations,
      checkedRules
    };
  }

  /**
   * Check a specific rule
   */
  async checkRule(workspacePath: string, ruleCode: string): Promise<RuleViolation[] | null> {
    await this.ensureRulesLoaded();

    const rule = this.rules!.get(ruleCode);
    if (!rule) {
      throw new Error(`Unknown rule: ${ruleCode}`);
    }

    return await rule.check(workspacePath);
  }

  /**
   * List all available rules
   */
  async listRules(): Promise<string[]> {
    await this.ensureRulesLoaded();
    return Array.from(this.rules!.keys());
  }

  /**
   * Add a custom rule
   */
  async addRule(rule: Rule): Promise<void> {
    await this.ensureRulesLoaded();
    this.rules!.set(rule.code, rule);
  }

  /**
   * Remove a rule
   */
  async removeRule(code: string): Promise<void> {
    await this.ensureRulesLoaded();
    this.rules!.delete(code);
  }
}
