#!/usr/bin/env tsx

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ProtocolDriftChecker } from '../packages/rules/src/drift-check.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    // Pass the rules package directory to the checker
    const rulesPackagePath = join(__dirname, '../packages/rules');
    const checker = new ProtocolDriftChecker(rulesPackagePath);

    if (command === 'mark-reviewed') {
      // Parse rule names and review notes from command line
      const ruleNames = args.slice(1).filter((arg) => !arg.startsWith('--notes=') && arg !== '--all');
      const notesArg = args.find((arg) => arg.startsWith('--notes='));
      const reviewNotes = notesArg ? notesArg.substring(8) : undefined;
      const markAll = args.includes('--all');
      
      await checker.markRulesReviewed(markAll || ruleNames.length === 0 ? undefined : ruleNames, reviewNotes);
      console.log('✅ Rules marked as reviewed.');
    } else {
      // Default: show drift report
      const driftInfo = await checker.checkAllRules();
      const report = checker.formatReport(driftInfo);
      console.log(report);

      const needsAction = driftInfo.some((rule) => rule.status !== 'UP_TO_DATE');
      if (needsAction) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});