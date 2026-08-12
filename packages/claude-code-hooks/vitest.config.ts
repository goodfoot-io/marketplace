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
          // Match vitest.e2e.config.ts: e2e tests spawn the CLI via `npx tsx`
          // (and scaffold tests run npm installs inside generated projects),
          // which can exceed the 10s hook / 60s test defaults under load.
          testTimeout: 120000,
          hookTimeout: 60000,
        }
      })
    ]
  }
});
