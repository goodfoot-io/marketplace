#!/usr/bin/env tsx

import { InverseDependencyFinder } from '../packages/print/src/lib/InverseDependencyFinder.js';

function parseArgs(args: string[]): { targetGlobs: string[]; projectPath?: string } {
  const targetGlobs: string[] = [];
  let projectPath: string | undefined;

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--project' && i + 1 < args.length) {
      projectPath = args[i + 1];
      i += 2;
    } else {
      targetGlobs.push(args[i]);
      i++;
    }
  }

  return { targetGlobs, projectPath };
}

async function main() {
  const args = process.argv.slice(2);
  const { targetGlobs, projectPath } = parseArgs(args);

  if (targetGlobs.length === 0) {
    console.error('Usage: inverse-dependencies <targetGlob1> [targetGlob2 ...] [--project <path/to/tsconfig.json>]');
    console.error('Error: At least one input glob pattern for target files is required.');
    process.exit(1);
  }

  // When run via yarn workspace, PROJECT_CWD contains the original directory
  const originalCwd = process.env.PROJECT_CWD || process.cwd();
  if (originalCwd !== process.cwd()) {
    process.chdir(originalCwd);
  }

  const finder = new InverseDependencyFinder({ targetGlobs, projectPath });

  try {
    const dependentFiles = await finder.execute();
    if (dependentFiles.length > 0) {
      console.log(dependentFiles.join(' '));
    }
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'MODULE_NOT_FOUND' &&
      error.message.includes('@manypkg/get-packages')
    ) {
      console.error(
        "Please install '@manypkg/get-packages' (e.g., yarn add -D @manypkg/get-packages) for automatic package detection."
      );
    } else {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});
