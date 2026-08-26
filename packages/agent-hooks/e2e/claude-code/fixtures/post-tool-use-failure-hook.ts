/**
 * Test fixture: PostToolUseFailure hook that logs failure details.
 *
 * Used to verify PostToolUseFailure hooks are built correctly.
 */

import { postToolUseFailureHook, postToolUseFailureOutput } from "../../../src/agents/claude-code/index.js";

export default postToolUseFailureHook({ matcher: ".*" }, (input, { logger }) => {
  logger.info("Tool failed", {
    tool_name: input.tool_name,
    error: input.error,
  });
  return postToolUseFailureOutput({
    hookSpecificOutput: { additionalContext: "Build test: Tool failure logged" },
  });
});
