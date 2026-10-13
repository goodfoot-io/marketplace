import { loadCacheContract, withTestOutput } from '@goodfoot/vitest-cache/policy';
import { defineConfig } from 'vitest/config';

export default withTestOutput(
  defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      exclude: ['node_modules', 'build', 'dist'],
      coverage: {
        provider: 'v8',
        reporter: ['lcov', 'text'],
        reportsDirectory: './coverage'
      }
    }
  }),
  loadCacheContract(new URL('./vitest.cache.json', import.meta.url))
);
