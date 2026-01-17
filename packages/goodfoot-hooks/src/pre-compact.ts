/**
 * Pre-Compact hook that enables skill reload after compaction.
 *
 * Before context compaction, this hook sets an enablement flag that triggers
 * the skill-reloader hook to reload tracked skills after compaction completes.
 *
 * @see https://code.claude.com/docs/en/hooks#precompact
 */

import { preCompactHook, preCompactOutput } from "@goodfoot/claude-code-hooks";
import { enableSkillReload } from "./skill-reloader.js";

export default preCompactHook({}, (input, { logger }) => {
  enableSkillReload(input.session_id);
  logger.info("Enabled skill reload for post-compaction", { sessionId: input.session_id });

  return preCompactOutput({});
});
