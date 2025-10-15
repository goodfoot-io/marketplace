#!/usr/bin/env tsx

import { FilePrinter } from '../packages/print/src/lib/FilePrinter.js';

export function parseCommandLineArgs(args: string[]): { includes: string[]; excludes: string[] } {
  const includes: string[] = [];
  const excludes: string[] = [];

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--exclude' || args[i] === '-e') {
      if (i + 1 < args.length) {
        excludes.push(args[i + 1]);
        i += 2;
      } else {
        console.error(`Error: ${args[i]} requires a value`);
        process.exit(1);
      }
    } else {
      includes.push(args[i]);
      i++;
    }
  }

  // Default to all files if no includes specified
  if (includes.length === 0) {
    includes.push('**/*');
  }

  return { includes, excludes };
}

async function main() {
  const args = process.argv.slice(2);
  
  // When run via yarn workspace, PROJECT_CWD contains the original directory
  const originalCwd = process.env.PROJECT_CWD || process.cwd();
  if (originalCwd !== process.cwd()) {
    process.chdir(originalCwd);
  }
  
  const options = parseCommandLineArgs(args);
  const printer = new FilePrinter(options);
  
  try {
    await printer.execute();
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});