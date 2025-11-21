import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'build'],
    setupFiles: ['@goodfoot/test-utilities/vitest-setup'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      reportsDirectory: 'coverage',
      enabled: false
    }
  },
  resolve: {
    alias: {
      '@goodfoot/test-utilities': '@goodfoot/test-utilities/src'
    }
  }
});
