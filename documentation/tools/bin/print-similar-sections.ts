#!/usr/bin/env tsx

import { SimilarSectionsFinder } from '../packages/print/src/lib/SimilarSectionsFinder.js';
import * as yaml from 'js-yaml';

interface ParsedArgs {
  filePathA: string;
  filePathB: string;
  windowSize: number;
  similarity: number;
}

function parseArgs(args: string[]): ParsedArgs {
  // Extract file paths (first two arguments)
  const filePathA = args[0];
  const filePathB = args[1];

  if (!filePathA || !filePathB) {
    console.error('Usage: print-similar-sections <file-path-a> <file-path-b> [--window-size=N] [--similarity=N]');
    console.error('Error: Both file paths are required.');
    console.error('');
    console.error('Options:');
    console.error('  --window-size=N    Size of text window to compare (default: 100)');
    console.error('  --similarity=N     Minimum similarity threshold 0-1 (default: 0.8)');
    process.exit(1);
  }

  // Parse optional arguments
  let windowSize = 100;
  let similarity = 0.8;

  for (const arg of args.slice(2)) {
    if (arg.startsWith('--window-size=')) {
      const value = parseInt(arg.split('=')[1], 10);
      if (isNaN(value) || value <= 0) {
        console.error('Error: --window-size must be a positive integer');
        process.exit(1);
      }
      windowSize = value;
    } else if (arg.startsWith('--similarity=')) {
      const value = parseFloat(arg.split('=')[1]);
      if (isNaN(value) || value < 0 || value > 1) {
        console.error('Error: --similarity must be a number between 0 and 1');
        process.exit(1);
      }
      similarity = value;
    } else {
      console.error(`Error: Unknown option ${arg}`);
      process.exit(1);
    }
  }

  return {
    filePathA,
    filePathB,
    windowSize,
    similarity
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  // When run via yarn workspace, PROJECT_CWD contains the original directory
  const originalCwd = process.env.PROJECT_CWD || process.cwd();
  if (originalCwd !== process.cwd()) {
    process.chdir(originalCwd);
  }
  
  const { filePathA, filePathB, windowSize, similarity } = parseArgs(args);
  
  const finder = new SimilarSectionsFinder({
    filePathA,
    filePathB,
    windowSize,
    similarity
  });

  try {
    const results = await finder.execute();
    
    // Output results as YAML
    const output = yaml.dump(results, {
      indent: 2,
      lineWidth: -1, // Disable line wrapping
      noRefs: true,   // Don't use YAML references
      quotingType: '"', // Use double quotes
      forceQuotes: false
    });
    
    console.log(output);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});