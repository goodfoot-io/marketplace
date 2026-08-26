import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: 'agent-hooks',
          globals: true,
          reporters: 'verbose',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
        }
      }),
      defineProject({
        test: {
          name: 'agent-hooks-e2e',
          globals: true,
          reporters: 'verbose',
          environment: 'node',
          include: ['e2e/claude-code/*.e2e.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
          // Ported from claude-code-hooks' e2e project: e2e tests spawn the CLI
          // via tsx (and scaffold tests run npm installs inside generated
          // projects), which can exceed the 10s hook / 60s test defaults under load.
          testTimeout: 120000,
          hookTimeout: 60000,
        }
      })
    ]
  }
});
