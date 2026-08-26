/**
 * Test fixture: SessionStart hook without a matcher.
 *
 * Used to verify hooks without matchers are handled correctly.
 */

import { sessionStartHook, sessionStartOutput } from "../../../src/agents/claude-code/index.js";

export default sessionStartHook({}, (input, { logger }) => {
  logger.info("Session started", { session_id: input.session_id });
  return sessionStartOutput({
    hookSpecificOutput: { additionalContext: "Build test: Session initialized" },
  });
});
