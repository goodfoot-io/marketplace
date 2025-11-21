import { defineProject, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      // Node.js environment for browser MCP server
      defineProject({
        test: {
          name: 'browser-mcp-server',
          globals: true,
          reporters: 'verbose',
          environment: 'node',
          setupFiles: [],
          include: ['tests/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
        }
      })
    ]
  }
});
