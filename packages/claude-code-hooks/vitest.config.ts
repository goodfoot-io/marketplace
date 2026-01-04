import { defineProject, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: 'claude-code-hooks',
          globals: true,
          reporters: 'verbose',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
        }
      }),
      defineProject({
        test: {
          name: 'claude-code-hooks-e2e',
          globals: true,
          reporters: 'verbose',
          environment: 'node',
          include: ['e2e/**/*.e2e.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
          testTimeout: 60000
        }
      })
    ]
  }
});
