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
import { getReloadFlagPath, getSkillsFilePath } from "./skill-tracker.js";

export default sessionEndHook({}, (input, { logger }) => {
  const skillsFile = getSkillsFilePath(input.session_id);
  const enablementFlag = getReloadFlagPath(input.session_id);

  let cleanedFiles = 0;

  try {
    unlinkSync(skillsFile);
    cleanedFiles++;
    logger.debug("Deleted skills file", { file: skillsFile });
  } catch {
    // File may not exist, which is fine
  }

  try {
    unlinkSync(enablementFlag);
    cleanedFiles++;
    logger.debug("Deleted enablement flag", { file: enablementFlag });
  } catch {
    // File may not exist, which is fine
  }

  if (cleanedFiles > 0) {
    logger.info("Session cleanup completed", { cleanedFiles });
  }

  return sessionEndOutput({
    systemMessage: "Session cleanup: Skill tracking files removed",
  });
});
