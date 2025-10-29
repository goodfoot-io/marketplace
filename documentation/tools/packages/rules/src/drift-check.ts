import { execSync } from 'child_process';
import { readdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { fileExists } from './utils/file-utils.js';

interface RuleDriftInfo {
  rulePath: string;
  ruleName: string;
  lastModified: Date;
  lastCommitHash: string;
  protocolChangesSince: number;
  protocolCommits: GitCommit[];
  status: 'UP_TO_DATE' | 'NEEDS_REVIEW' | 'STALE';
}

interface GitCommit {
  hash: string;
  date: Date;
  message: string;
  author: string;
}

interface ProtocolReview {
  last_review: string;
  protocol_commit: string;
  rules_reviewed: string[];
  reviewer: string;
  review_notes?: string;
}

/**
 * Protocol Drift Checker
 *
 * Analyzes git history to determine which rules may be outdated
 * based on changes to the organization protocol since the rule was last modified.
 */
export class ProtocolDriftChecker {
  private workspacePath: string;
  private rulesPath: string;
  private protocolPath: string;
  private reviewFilePath: string;

  constructor(workspacePath: string = process.cwd()) {
    // If we're already in the rules directory, use current path
    // Otherwise, assume we're in the workspace root
    const isInRules = workspacePath.endsWith('rules') || workspacePath.includes('packages/rules');
    this.workspacePath = isInRules ? join(workspacePath, '../../..') : workspacePath;
    this.rulesPath = join(this.workspacePath, 'tools/packages/rules/src/rules');
    this.protocolPath = join(this.workspacePath, 'protocols/organization-protocol.md');
    this.reviewFilePath = join(this.workspacePath, 'tools/packages/rules/protocol-reviews.json');
  }

  /**
   * Check all rules for protocol drift
   */
  async checkAllRules(): Promise<RuleDriftInfo[]> {
    const ruleFiles = await this.getRuleFiles();
    const driftInfo: RuleDriftInfo[] = [];
    const lastReview = await this.getLastReview();

    for (const ruleFile of ruleFiles) {
      const relativePath = `tools/packages/rules/src/rules/${ruleFile}`;

      try {
        const info = this.analyzeRuleDrift(relativePath, lastReview);
        driftInfo.push(info);
      } catch (error) {
        console.warn(
          `Warning: Could not analyze ${ruleFile}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return driftInfo.sort((a, b) => b.protocolChangesSince - a.protocolChangesSince);
  }

  /**
   * Analyze drift for a specific rule file
   */
  analyzeRuleDrift(relativePath: string, lastReview?: ProtocolReview): RuleDriftInfo {
    const ruleName = relativePath.split('/').pop()?.replace('.ts', '') || 'unknown';

    // Get last commit that modified this rule
    const ruleLastCommit = this.getLastCommitForFile(relativePath);

    // Determine the baseline commit for checking protocol changes
    let baselineCommit = ruleLastCommit.hash;

    // If we have a review record and this rule was reviewed, use the review commit as baseline
    if (lastReview && lastReview.rules_reviewed.includes(ruleName)) {
      const reviewDate = new Date(lastReview.last_review);
      const ruleModifiedDate = ruleLastCommit.date;

      // Use the later of rule modification or review date
      if (reviewDate > ruleModifiedDate) {
        baselineCommit = lastReview.protocol_commit;
      }
    }

    // Get protocol changes since baseline
    const protocolCommits = this.getProtocolChangesSince(baselineCommit);

    // Determine status based on time and changes
    const daysSinceBaseline = Math.floor(
      (Date.now() - new Date(lastReview?.last_review || ruleLastCommit.date).getTime()) / (1000 * 60 * 60 * 24)
    );

    let status: RuleDriftInfo['status'] = 'UP_TO_DATE';
    if (protocolCommits.length > 0) {
      status = daysSinceBaseline > 30 ? 'STALE' : 'NEEDS_REVIEW';
    }

    return {
      rulePath: relativePath,
      ruleName,
      lastModified: ruleLastCommit.date,
      lastCommitHash: ruleLastCommit.hash,
      protocolChangesSince: protocolCommits.length,
      protocolCommits,
      status
    };
  }

  /**
   * Mark rules as reviewed for current protocol state
   */
  async markRulesReviewed(ruleNames?: string[], reviewNotes?: string): Promise<void> {
    // Get the latest commit of the protocol file, not HEAD
    const protocolCommit = execSync(`git log -1 --format="%H" -- "${this.protocolPath}"`, {
      cwd: this.workspacePath,
      encoding: 'utf8'
    }).trim();

    const reviewer = execSync('git config user.name', {
      cwd: this.workspacePath,
      encoding: 'utf8'
    }).trim();

    const allRuleNames = ruleNames || (await this.getAllRuleNames());

    const review: ProtocolReview = {
      last_review: new Date().toISOString(),
      protocol_commit: protocolCommit,
      rules_reviewed: allRuleNames,
      reviewer,
      review_notes: reviewNotes
    };

    await writeFile(this.reviewFilePath, JSON.stringify(review, null, 2));

    console.log(`✅ Marked ${allRuleNames.length} rules as reviewed`);
    console.log(`📝 Review recorded at protocol commit ${protocolCommit.substring(0, 7)}`);
    if (reviewNotes) {
      console.log(`💬 Notes: ${reviewNotes}`);
    }
  }

  /**
   * Get all rule names
   */
  async getAllRuleNames(): Promise<string[]> {
    const files = await this.getRuleFiles();
    return files.map((file) => file.replace('.ts', ''));
  }

  /**
   * Get the last review record
   */
  private async getLastReview(): Promise<ProtocolReview | undefined> {
    try {
      if (!(await fileExists(this.reviewFilePath))) {
        return undefined;
      }

      const content = await readFile(this.reviewFilePath, 'utf8');
      return JSON.parse(content) as ProtocolReview;
    } catch (error) {
      console.warn(`Warning: Could not read review file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    }
  }

  /**
   * Get all TypeScript rule files
   */
  private async getRuleFiles(): Promise<string[]> {
    if (!(await fileExists(this.rulesPath))) {
      throw new Error(`Rules directory not found: ${this.rulesPath}`);
    }

    const files = await readdir(this.rulesPath);
    return files.filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));
  }

  /**
   * Get the last commit that modified a specific file
   */
  private getLastCommitForFile(filePath: string): GitCommit {
    try {
      const output = execSync(`git log -1 --format="%H|%ai|%s|%an" -- "${filePath}"`, {
        cwd: this.workspacePath,
        encoding: 'utf8'
      }).trim();

      if (!output) {
        throw new Error(`No git history found for ${filePath}`);
      }

      const [hash, dateStr, message, author] = output.split('|');
      return {
        hash,
        date: new Date(dateStr),
        message,
        author
      };
    } catch (error) {
      throw new Error(
        `Failed to get git history for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all commits that modified the protocol since a given commit
   */
  private getProtocolChangesSince(sinceCommit: string): GitCommit[] {
    try {
      const output = execSync(`git log ${sinceCommit}..HEAD --format="%H|%ai|%s|%an" -- "${this.protocolPath}"`, {
        cwd: this.workspacePath,
        encoding: 'utf8'
      }).trim();

      if (!output) {
        return [];
      }

      return output.split('\n').map((line) => {
        const [hash, dateStr, message, author] = line.split('|');
        return {
          hash,
          date: new Date(dateStr),
          message,
          author
        };
      });
    } catch {
      // If sinceCommit doesn't exist or other git errors, return empty array
      return [];
    }
  }

  /**
   * Format drift analysis as markdown report
   */
  formatReport(driftInfo: RuleDriftInfo[]): string {
    const sections = {
      STALE: driftInfo.filter((r) => r.status === 'STALE'),
      NEEDS_REVIEW: driftInfo.filter((r) => r.status === 'NEEDS_REVIEW'),
      UP_TO_DATE: driftInfo.filter((r) => r.status === 'UP_TO_DATE')
    };

    let report = '# Protocol Drift Analysis\n\n';

    if (sections.STALE.length > 0) {
      report += '## ⚠️ Stale Rules (>30 days since protocol changes)\n\n';
      for (const rule of sections.STALE) {
        report += this.formatRuleSection(rule);
      }
    }

    if (sections.NEEDS_REVIEW.length > 0) {
      report += '## 🔍 Rules Needing Review\n\n';
      for (const rule of sections.NEEDS_REVIEW) {
        report += this.formatRuleSection(rule);
      }
    }

    if (sections.UP_TO_DATE.length > 0) {
      report += '## ✅ Up to Date Rules\n\n';
      for (const rule of sections.UP_TO_DATE) {
        report += `- **${rule.ruleName}** (last updated: ${this.formatDate(rule.lastModified)})\n`;
      }
      report += '\n';
    }

    // Summary
    report += '## Summary\n\n';
    report += `- **Total rules**: ${driftInfo.length}\n`;
    report += `- **Stale**: ${sections.STALE.length}\n`;
    report += `- **Need review**: ${sections.NEEDS_REVIEW.length}\n`;
    report += `- **Up to date**: ${sections.UP_TO_DATE.length}\n`;

    return report;
  }

  /**
   * Format a single rule section for the report
   */
  private formatRuleSection(rule: RuleDriftInfo): string {
    let section = `### ${rule.ruleName}\n\n`;
    section += `**Last updated**: ${this.formatDate(rule.lastModified)} (${rule.lastCommitHash.substring(0, 7)})\n`;
    section += `**Protocol changes since**: ${rule.protocolChangesSince}\n\n`;

    if (rule.protocolCommits.length > 0) {
      section += '**Recent protocol changes**:\n';
      for (const commit of rule.protocolCommits.slice(0, 5)) {
        // Show up to 5 recent changes
        section += `- ${this.formatDate(commit.date)}: ${commit.message} (${commit.hash.substring(0, 7)})\n`;
      }
      if (rule.protocolCommits.length > 5) {
        section += `- ... and ${rule.protocolCommits.length - 5} more changes\n`;
      }
      section += '\n';
    }

    return section;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return '1 day ago';
    } else if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else {
      return date.toISOString().split('T')[0];
    }
  }
}

/**
 * CLI entry point for drift checking
 */
export async function checkProtocolDrift(workspacePath?: string): Promise<void> {
  try {
    const checker = new ProtocolDriftChecker(workspacePath);
    const driftInfo = await checker.checkAllRules();
    const report = checker.formatReport(driftInfo);

    console.log(report);

    // Exit with error code if there are stale rules
    const staleCount = driftInfo.filter((r) => r.status === 'STALE').length;
    if (staleCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking protocol drift:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * CLI entry point for marking rules as reviewed
 */
export async function markRulesAsReviewed(
  workspacePath?: string,
  ruleNames?: string[],
  reviewNotes?: string
): Promise<void> {
  try {
    const checker = new ProtocolDriftChecker(workspacePath);
    await checker.markRulesReviewed(ruleNames, reviewNotes);
  } catch (error) {
    console.error('Error marking rules as reviewed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args[0] === 'mark-reviewed') {
    // Parse rule names and review notes from command line
    const ruleNames = args.slice(1).filter((arg) => !arg.startsWith('--notes=') && arg !== '--all');
    const notesArg = args.find((arg) => arg.startsWith('--notes='));
    const reviewNotes = notesArg ? notesArg.substring(8) : undefined;
    const markAll = args.includes('--all');

    void markRulesAsReviewed(
      undefined,
      markAll ? undefined : ruleNames.length > 0 ? ruleNames : undefined,
      reviewNotes
    );
  } else {
    void checkProtocolDrift();
  }
}
