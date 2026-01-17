/**
 * Test fixture: UserPromptSubmit hook that adds project context.
 *
 * Injects context about the current date that Claude should acknowledge.
 */

import { userPromptSubmitHook, userPromptSubmitOutput } from "../../src/index.js";

export default userPromptSubmitHook({}, (input, { logger }) => {
  logger.info("UserPromptSubmit hook triggered", { promptLength: input.prompt.length });

  return userPromptSubmitOutput({
    hookSpecificOutput: {
      additionalContext: JSON.stringify({ projectName: "acme-app", version: "3.2.1" }),
    },
  });
});
