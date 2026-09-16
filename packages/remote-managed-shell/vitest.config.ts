import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'remote-managed-shell',
    environment: 'node',
    reporters: 'verbose',
    include: ['tests/**/*.test.ts'],
    // The compiled output lives under build/, which is not in vitest's default
    // exclude list: a stale build/dist/tests/*.test.js would otherwise be
    // collected and run a second time.
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
  }
});
