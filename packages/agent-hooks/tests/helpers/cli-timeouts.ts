/** Bounded deadlines shared by real CLI subprocess tests and their Vitest project. */
export const CLI_SPAWN_TIMEOUT_MS = 45_000;

/** Topology tests run three CLI builds sequentially; reserve another 15s for assertions and I/O. */
export const CLI_TEST_TIMEOUT_MS = 3 * CLI_SPAWN_TIMEOUT_MS + 15_000;

/** Cold topology setup copies the source tree; leave headroom beyond a single CLI invocation. */
export const CLI_HOOK_TIMEOUT_MS = CLI_SPAWN_TIMEOUT_MS + 15_000;
