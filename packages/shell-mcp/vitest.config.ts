import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shell-mcp',
    environment: 'node',
    reporters: 'verbose',
    // tests/process-manager.test.ts waits out settlement (spawn, exit, stream
    // close) on the stated assumption that a loaded host can be slower than a
    // fixed window. That tolerance only holds if this ceiling sits above the
    // test's own budgets: the framework timing a test out first reports a bare
    // "Test timed out in Nms" and the state the test had observed is never
    // named, which is exactly how a CI stall used to arrive with no evidence.
    // The budgets it must clear are the exec bound (SETTLE_TIMEOUT_MS, 20s),
    // the settle budget (another 20s), and the per-read watchdog (5s) on top of
    // either; 45s leaves the test room to fail with its own diagnosis.
    testTimeout: 45_000,
    include: ['tests/**/*.test.ts'],
    // The compiled output lives under build/, which is not in vitest's default
    // exclude list: a stale build/dist/tests/*.test.js would otherwise be
    // collected and run a second time.
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
  }
});
