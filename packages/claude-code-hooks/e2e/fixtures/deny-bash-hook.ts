/**
 * Test fixture: PreToolUse hook that denies all Bash commands.
 *
 * Used to verify that PreToolUse hooks can successfully block tool execution.
 */

import { preToolUseHook, preToolUseOutput } from "../../src/index.js";

export default preToolUseHook({ matcher: "Bash" }, (input, { logger }) => {
  const command = (input.tool_input as { command?: string }).command ?? "";
  logger.info("Denying Bash command", { command });

  return preToolUseOutput({
    hookSpecificOutput: {
      permissionDecision: "deny",
      permissionDecisionReason: "Bash commands are blocked by test hook",
    },
  });
});
