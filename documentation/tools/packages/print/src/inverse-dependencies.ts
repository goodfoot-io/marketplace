#!/usr/bin/env node

// Re-export the InverseDependencyFinder for library usage
export { InverseDependencyFinder, type InverseDependencyFinderOptions } from './lib/InverseDependencyFinder.js';

// If this file is run directly, execute the CLI functionality
if (import.meta.url === `file://${process.argv[1]}`) {
  const { InverseDependencyFinder } = await import('./lib/InverseDependencyFinder.js');

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: print-inverse-dependencies <file-path>');
    process.exit(1);
  }

  const finder = new InverseDependencyFinder({ targetGlobs: [args[0]] });
  try {
    const dependents = await finder.execute();

    if (dependents.length === 0) {
      console.log(`No files depend on ${args[0]}`);
    } else {
      console.log(`Files that depend on ${args[0]}:`);
      dependents.forEach((dep: string) => console.log(`  ${dep}`));
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
