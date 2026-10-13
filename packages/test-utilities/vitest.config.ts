import { loadCacheContract, withTestOutput } from '@goodfoot/vitest-cache/policy';
import { defineProject, defineConfig } from 'vitest/config';

export default withTestOutput(
  defineConfig({
    test: {
      reporters: 'verbose',
      projects: [
        // Node.js environment for test utilities
        defineProject({
          test: {
            name: 'test-utilities',
            globals: true,
            environment: 'node',
            provide: { testPostgres: null },
            globalSetup: ['./tests/global-setup.ts'],
            setupFiles: ['./src/vitest-setup.ts'],
            include: ['tests/**/*.test.ts'],
            exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
          }
        })
      ]
    }
  }),
  loadCacheContract(new URL('./vitest.cache.json', import.meta.url))
);
