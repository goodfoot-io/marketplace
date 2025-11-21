import { defineProject, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      // Node.js environment for MCP file server
      defineProject({
        test: {
          name: 'mcp-file',
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
