/** Claude Code adapter for the shared TypeScript validation. */
import { getFilePath, postToolUseHook, postToolUseOutput } from "@goodfoot/agent-hooks/claude-code";
import { checkTypeScriptFile } from "./shared/validation.js";

export default postToolUseHook({ matcher: "Write|Edit|MultiEdit", timeout: 60000 }, (input, { logger }) => {
  const filePath = getFilePath(input);
  if (!filePath) return null;
  const result = checkTypeScriptFile(filePath, logger);
  if (!result) return null;
  return postToolUseOutput({
    systemMessage: result.systemMessage,
    hookSpecificOutput: { additionalContext: result.additionalContext },
  });
});
