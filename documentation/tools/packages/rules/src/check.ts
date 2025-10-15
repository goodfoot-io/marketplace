#!/usr/bin/env node

// Check command - validates newsroom workspace organization
// Run with: rules-check

import { OrganizationParser } from './index.js';

async function main() {
  const parser = new OrganizationParser();

  // Parse the workspace directory (project root)
  const workspacePath = '../../..';

  console.log('# Newsroom Organization Check\n');
  console.log('Validating workspace structure against organizational standards...\n');
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
          violation.code.includes('PREFIX')
        ) {
          category = 'Naming Conventions';
        } else if (
          violation.code.includes('SOURCE') ||
          violation.code.includes('YAML') ||
          violation.code.includes('FRONTMATTER')
        ) {
          category = 'Content Requirements';
        } else if (
          violation.code.includes('STATUS') ||
          violation.code.includes('STATE') ||
          violation.code.includes('DATE_FORMAT')
        ) {
          category = 'Status File Issues';
        } else if (violation.code.includes('ERROR')) {
          category = 'System Errors';
        }
      }

      if (!groupedViolations.has(category)) {
        groupedViolations.set(category, []);
      }
      groupedViolations.get(category)!.push(violation);
    }

    // Output violations by group
    for (const [category, violations] of groupedViolations) {
      console.log(`## ${category}\n`);

      for (const violation of violations) {
        console.log(`### ${violation.code}: ${violation.title}\n`);
        console.log(`**Description**: ${violation.description}`);
        if (violation.location) {
          console.log(`**Path**: \`${violation.location}\``);
        }
        console.log(`**Severity**: ${violation.severity}`);
        console.log();
      }
    }

    // Summary statistics
    console.log('## Summary\n');
    const errors = result.violations.filter((v) => v.severity === 'error').length;
    const warnings = result.violations.filter((v) => v.severity === 'warning').length;

    console.log(`- **Total violations**: ${result.violations.length}`);
    console.log(`- **Errors**: ${errors}`);
    console.log(`- **Warnings**: ${warnings}`);
    console.log(`- **Rules checked**: ${result.checkedRules.join(', ')}`);
  }
}

main().catch(console.error);
