/**
 * Test fixture: PreCompact hook that logs compaction events.
 *
 * Used to verify that PreCompact hooks are triggered before context compaction
 * and can inject system messages that persist after compaction.
 */

import { preCompactHook, preCompactOutput } from "../../src/index.js";

export default preCompactHook({}, (input, { logger }) => {
  logger.info("PreCompact hook triggered", { trigger: input.trigger });

  return preCompactOutput({
    systemMessage: "E2E_PRECOMPACT: Important context preserved through compaction.",
  });
});
