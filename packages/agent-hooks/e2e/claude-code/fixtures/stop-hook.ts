/**
 * Test fixture: Stop hook with decision.
 *
 * Used to verify Stop hooks are built correctly.
 */

import { stopHook, stopOutput } from "../../../src/agents/claude-code/index.js";

export default stopHook({}, (input, { logger }) => {
  logger.info("Stop requested", { stop_hook_active: input.stop_hook_active });
  return stopOutput({
    decision: "approve",
    reason: "Build test: Approved stop",
  });
});
