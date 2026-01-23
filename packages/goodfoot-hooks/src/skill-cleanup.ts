/**
 * Skill Cleanup - SessionEnd hook that cleans up temporary skill tracking files.
 *
 * When a session truly ends (NOT during compaction), this hook removes
 * session-scoped temporary files used by the skill reload system.
 *
 * @see https://code.claude.com/docs/en/hooks#sessionend
 */

import { unlinkSync } from "node:fs";
import { sessionEndHook, sessionEndOutput } from "@goodfoot/claude-code-hooks";
import { getSkillsFilePath } from "./skill-tracker.js";

export default sessionEndHook({}, (input, { logger }) => {
  const skillsFile = getSkillsFilePath(input.session_id);

  try {
    unlinkSync(skillsFile);
    logger.info("Session cleanup completed", { file: skillsFile });
  } catch {
    // File may not exist, which is fine
  }

  return sessionEndOutput({});
});
