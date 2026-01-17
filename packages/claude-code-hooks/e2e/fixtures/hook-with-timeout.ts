/**
 * Test fixture: Hook with explicit timeout configuration.
 *
 * Used to verify that the build process correctly extracts timeout values.
 */

import { preToolUseHook, preToolUseOutput } from "../../src/index.js";

export default preToolUseHook({ matcher: "Write", timeout: 5000 }, (input, { logger }) => {
  logger.info("Hook with timeout triggered", { tool_name: input.tool_name });
  return preToolUseOutput({
    hookSpecificOutput: { permissionDecision: "allow" },
  });
});
