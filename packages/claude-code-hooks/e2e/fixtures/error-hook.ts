/**
 * Test fixture: PreToolUse hook that throws an error.
 *
 * Used to verify that hook errors are handled gracefully and produce
 * clean error output without crashing.
 */

import { preToolUseHook } from "../../src/index.js";

export default preToolUseHook({ matcher: "Read" }, (_input, { logger }) => {
  logger.info("About to throw test error");

  throw new Error("E2E_TEST_ERROR: Intentional hook error for testing");
});
