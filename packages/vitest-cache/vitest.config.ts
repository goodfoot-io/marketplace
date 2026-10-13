/**
 * Configure the retained cache package validation suite.
 *
 * @summary Configure the retained cache package validation suite.
 */
import { defineConfig } from 'vitest/config';
import { withTestOutput } from './src/test-output-policy.mjs';

export default withTestOutput(defineConfig({ test: { include: ['test/**/*.test.ts'], maxWorkers: 1 } }), {
  uncached: 'Existing cache-tool checks create isolated filesystem fixtures'
});
