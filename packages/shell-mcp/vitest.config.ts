import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shell-mcp',
    environment: 'node',
    reporters: 'verbose',
    // tests/process-manager.test.ts polls settlement (spawn, exit, stream
    // close) for up to its own SETTLE_TIMEOUT_MS (20s) on the stated
    // assumption that a loaded host can be slower than a fixed window; that
    // tolerance is pointless if Vitest's 5s default per-test timeout kills
    // the test first, which is what actually produced the intermittent
    // failure this replaces.
    testTimeout: 20_000,
    include: ['tests/**/*.test.ts'],
    // The compiled output lives under build/, which is not in vitest's default
    // exclude list: a stale build/dist/tests/*.test.js would otherwise be
    // collected and run a second time.
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
  }
});
