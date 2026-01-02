import { defineProject, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: 'claude-code-hooks-e2e',
          globals: true,
          reporters: 'verbose',
          environment: 'node',
          include: ['e2e/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
          // E2E tests are slower due to Claude API calls
          testTimeout: 120000,
          hookTimeout: 60000,
          // Run tests sequentially to avoid API rate limiting
          sequence: {
            concurrent: false
          },
          // Retry flaky tests
          retry: 1
        }
      })
    ]
  }
});
