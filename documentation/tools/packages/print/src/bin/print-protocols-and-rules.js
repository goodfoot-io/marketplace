#!/usr/bin/env node
/* eslint-env node */

import { FilePrinter } from '../lib/FilePrinter.js';

async function main() {
  const printer = new FilePrinter({
    includes: [
      '../../../protocols/specialists/**/*',
      '../../../protocols/newsroom-protocol.md',
      '../../../protocols/organization-protocol.md',
      '../../../protocols/parser-maintenance-protocol.md',
      '../../../protocols/protocol-and-rule-aggregate-evaluation-protocol.md',
      '../rules/**/*'
    ],
    excludes: [
      'yarn.lock',
      '.gitignore',
      '.yarnrc.yml',
      'eslint.config.mjs',
      'jest.config.cjs',
      'prettier.config.mjs',
      'node_modules',
      '**/node_modules',
      '**/*.test.ts',
      '**/tests/**',
      '**/.yarn/**',
      '**/dist/**',
      '**/build/**'
    ]
  });

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
