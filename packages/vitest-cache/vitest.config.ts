/**
 * Configure the retained cache package validation suite.
 *
 * @summary Configure the retained cache package validation suite.
 */
import { defineConfig } from 'vitest/config';
import { loadCacheContract, withTestOutput } from './src/test-output-policy.mjs';

export default withTestOutput(
  defineConfig({ test: { include: ['test/**/*.test.ts'], maxWorkers: 1 } }),
  loadCacheContract(new URL('./vitest.cache.json', import.meta.url))
);
