/**
 * Test fixture: Stop hook that reads a persisted environment variable.
 *
 * Used to verify that persistEnvVar from a SessionStart hook makes the
 * environment variable available to subsequent hooks.
 *
 * Signals success/failure via the reason field in the stop output,
 * which Claude will see and can report back.
 */

import { stopHook, stopOutput } from "../../../src/agents/claude-code/index.js";

export default stopHook({}, (_input, { logger }) => {
  const expectedValue = "PERSIST_ENV_VAR_E2E_SUCCESS";
  const actualValue = process.env.E2E_TEST_VAR;

  logger.info("Stop hook checking env var", { expected: expectedValue, actual: actualValue });

  if (actualValue === expectedValue) {
    return stopOutput({
      decision: "approve",
      reason: `E2E_PERSIST_SUCCESS: Environment variable E2E_TEST_VAR was correctly set to '${actualValue}'`,
    });
  }

  return stopOutput({
    decision: "approve",
    reason: `E2E_PERSIST_FAILURE: Expected E2E_TEST_VAR='${expectedValue}' but got '${actualValue ?? "undefined"}'`,
  });
});
