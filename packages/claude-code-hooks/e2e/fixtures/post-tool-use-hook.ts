/**
 * Test fixture: PostToolUse hook with additionalContext.
 *
 * Used to verify PostToolUse hooks are built correctly.
 */

import { postToolUseHook, postToolUseOutput } from "../../src/index.js";

export default postToolUseHook({ matcher: "Read" }, (input, { logger }) => {
  logger.info("Tool completed", {
    tool_name: input.tool_name,
  });
  return postToolUseOutput({
    hookSpecificOutput: { additionalContext: "Build test: Read completed" },
  });
});
