#!/usr/bin/env node

// This file is preserved for backward compatibility
// The actual implementation has been moved to modular files

// Re-export the main classes and functions
export { FilePrinter, type FilePrinterOptions } from './lib/FilePrinter.js';
export { parseCommandLineArgs } from './bin/print-cli.js';

// If this file is run directly, execute the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  void import('./bin/print-cli.js');
}
