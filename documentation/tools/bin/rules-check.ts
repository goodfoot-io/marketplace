#!/usr/bin/env tsx

import * as path from 'path';
import { OrganizationParser } from '../packages/rules/src/index.js';
import { findWorkspaceRoot } from '../packages/rules/src/utils/workspace-utils.js';

async function main() {
  const parser = new OrganizationParser();

  // Find the workspace root
  const workspacePath = findWorkspaceRoot();
  const currentPath = process.cwd();
  const relativePath = path.relative(workspacePath, currentPath);

  console.log('# Newsroom Organization Check\n');
  console.log(`**Workspace root:** ${workspacePath}`);
  if (relativePath) {
    console.log(`**Current directory:** ${relativePath}`);
  }
  console.log('\nValidating workspace structure against organizational standards...\n');
  console.log('Loading rules...\n');

  const result = await parser.parse(workspacePath);

  if (result.violations.length === 0) {
    console.log('✅ **No violations found!** The workspace is fully compliant.\n');
  } else {
    console.log(`Found **${result.violations.length} violations**:\n`);

    // Group violations by category based on code patterns
    const groupedViolations = new Map<string, typeof result.violations>();

    for (const violation of result.violations) {
      let category = 'Other Issues';

      if (violation.code) {
        if (
          violation.code.includes('DIRECTORY') ||
          violation.code.includes('TEMPLATES') ||
          violation.code === 'MISSING_STATUS_FILE' ||
          violation.code === 'MISSING_BLACKBOARD'
        ) {
          category = 'Directory Structure';
        } else if (
          violation.code.includes('SLUG') ||
          violation.code.includes('FILENAME') ||
          violation.code.includes('DATE_PREFIX') ||
          violation.code.includes('VERSION')
        ) {
          category = 'Naming Conventions';
        } else if (
          violation.code.includes('SOURCE') ||
          violation.code.includes('FRONTMATTER') ||
          violation.code.includes('YAML') ||
          violation.code.includes('BLACKBOARD_STRUCTURE') ||
          violation.code.includes('USER_FEEDBACK_STRUCTURE') ||
          violation.code.includes('LINK')
        ) {
          category = 'Content Issues';
        } else if (violation.code.includes('FILE')) {
          category = 'File Organization';
        }
      }

      if (!groupedViolations.has(category)) {
        groupedViolations.set(category, []);
      }
      groupedViolations.get(category)!.push(violation);
    }

    // Sort categories by number of violations
    const sortedCategories = Array.from(groupedViolations.entries()).sort((a, b) => b[1].length - a[1].length);

    for (const [category, violations] of sortedCategories) {
      console.log(`## ${category} (${violations.length})`);
      console.log();

      for (const violation of violations) {
        console.log(`### ${violation.title || violation.code}`);
        if (violation.location) {
          console.log(`**Location:** \`${violation.location}\``);
        }
        console.log(`**Rule:** ${violation.code}`);
        if (violation.fixable) {
          console.log('**Status:** ✅ Auto-fixable');
        }
        console.log(`**Message:** ${violation.description}`);
        console.log();
      }
    }

    console.log('---\n');
    console.log('Please manually resolve the violations listed above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});