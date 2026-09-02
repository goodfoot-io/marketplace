import { defineProject, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      // Node.js environment for test utilities
      defineProject({
        test: {
          name: 'test-utilities',
          globals: true,
          reporters: 'verbose',
          environment: 'node',
          globalSetup: ['./src/vitest-global-setup.ts'],
          setupFiles: ['./src/vitest-setup.ts'],
          include: ['tests/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
        }
      })
    ]
  }
});
