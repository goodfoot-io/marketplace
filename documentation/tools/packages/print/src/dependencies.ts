#!/usr/bin/env node

// Re-export the DependencyFinder for library usage
export { DependencyFinder, type DependencyFinderOptions } from './lib/DependencyFinder.js';

// If this file is run directly, execute the CLI functionality
if (import.meta.url === `file://${process.argv[1]}`) {
  const { DependencyFinder } = await import('./lib/DependencyFinder.js');

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: print-dependencies <file-path>');
    process.exit(1);
  }

  const finder = new DependencyFinder({ targetGlobs: [args[0]] });
  try {
    const result = await finder.execute();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
