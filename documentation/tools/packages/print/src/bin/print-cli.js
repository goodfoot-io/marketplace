#!/usr/bin/env node
/* eslint-env node */

import { FilePrinter } from '../lib/FilePrinter.js';

export function parseCommandLineArgs(args = process.argv.slice(2)) {
  const includes = [];
  const excludes = [];

  let i = 0;
  while (i < args.length) {
    if (args[i] === '-e' || args[i] === '--exclude') {
      if (i + 1 < args.length) {
        excludes.push(args[i + 1]);
        i += 2;
      } else {
        console.error('Error: -e/--exclude requires a pattern');
        process.exit(1);
      }
    } else {
      includes.push(args[i]);
      i++;
    }
  }

  // Default to '**/*' if no patterns provided
  if (includes.length === 0) {
    includes.push('**/*');
  }

  return { includes, excludes };
}

// If this file is run directly, execute the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const { includes, excludes } = parseCommandLineArgs();

  const printer = new FilePrinter({
    includes,
    excludes,
    cwd: process.cwd()
  });

  try {
    await printer.execute();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
