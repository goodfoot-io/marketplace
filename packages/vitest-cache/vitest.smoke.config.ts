/**
 * Run optional load-sensitive integration and resource checks without result reuse.
 * @summary Keep smoke checks outside default functional test discovery.
 */
import { defineConfig } from 'vitest/config';
import { withTestOutput } from './src/test-output-policy.mjs';
import { integrationTestTimeout } from './test/child-process.ts';

export default withTestOutput(
  defineConfig({ test: { include: ['smoke/**/*.test.ts'], maxWorkers: 1, testTimeout: integrationTestTimeout } }),
  { uncached: 'optional load-sensitive integration and resource smoke checks' }
);
