/**
 * Test fixture: SessionStart hook that persists an environment variable.
 *
 * Used to verify that persistEnvVar works correctly via the context parameter.
 * Sets E2E_TEST_VAR to a known value that can be read by a Stop hook.
 */

import { sessionStartHook, sessionStartOutput } from "../../src/index.js";

export default sessionStartHook({}, (_input, { logger, persistEnvVar }) => {
  const testValue = "PERSIST_ENV_VAR_E2E_SUCCESS";

  logger.info("SessionStart hook persisting env var", { name: "E2E_TEST_VAR", value: testValue });

  // Use the context parameter to persist the env var
  persistEnvVar("E2E_TEST_VAR", testValue);

  return sessionStartOutput({
    hookSpecificOutput: {
      additionalContext: "SessionStart hook set E2E_TEST_VAR environment variable.",
    },
  });
});
