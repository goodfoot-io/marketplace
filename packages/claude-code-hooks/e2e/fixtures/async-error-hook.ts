/**
 * Test fixture: PreToolUse hook that throws an error asynchronously.
 *
 * Used to verify that async hook errors are handled gracefully and produce
 * clean error output without crashing.
 */

import { preToolUseHook } from "../../src/index.js";

export default preToolUseHook({ matcher: "Read" }, async (_input, { logger }) => {
  logger.info("About to throw async test error");

  // Simulate async operation before throwing
  await Promise.resolve();

  throw new Error("E2E_ASYNC_TEST_ERROR: Intentional async hook error for testing");
});
