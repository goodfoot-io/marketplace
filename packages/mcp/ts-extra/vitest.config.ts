import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['@goodfoot/test-utilities/vitest-setup'],
    include: ['tests/**/*.test.ts']
  }
});
