import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'claude-code-hooks-e2e',
    globals: true,
    environment: 'node',
    include: ['e2e/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    // E2E tests are slower due to Claude API calls
    testTimeout: 120000,
    hookTimeout: 60000
  }
});
