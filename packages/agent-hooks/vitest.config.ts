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
      })
    ]
  }
});
