/**
 * Test fixture: SessionStart hook that injects project context.
 *
 * Injects a simple project configuration that Claude should acknowledge.
 */

import { sessionStartHook, sessionStartOutput } from "../../src/index.js";

export default sessionStartHook({}, (_input, { logger }) => {
  logger.info("Injecting session context");

  return sessionStartOutput({
    hookSpecificOutput: {
      additionalContext: `JSON Context: ${JSON.stringify({ category: "clothing", price: 12499 })}`,
    },
  });
});
