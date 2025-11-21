import { defineProject, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: 'example',
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
