#!/usr/bin/env tsx

import { DependencyFinder } from '../packages/print/src/lib/DependencyFinder.js';

function parseArgs(args: string[]): string[] {
  if (args.length === 0) {
    console.error('Usage: dependencies <glob1> [glob2 ...]');
    console.error('Error: At least one input glob pattern is required.');
    process.exit(1);
  }
  return args;
}

async function main() {
  const args = process.argv.slice(2);
  
  // When run via yarn workspace, PROJECT_CWD contains the original directory
  const originalCwd = process.env.PROJECT_CWD || process.cwd();
  if (originalCwd !== process.cwd()) {
    process.chdir(originalCwd);
  }
  
  const targetGlobs = parseArgs(args);
  const finder = new DependencyFinder({ targetGlobs });

  try {
    const dependencies = await finder.execute();
    if (dependencies.length > 0) {
      console.log(dependencies.join(' '));
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});