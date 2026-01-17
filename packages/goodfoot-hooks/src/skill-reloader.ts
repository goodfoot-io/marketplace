/**
 * Skill Reloader - SessionStart hook that reloads skills after context compaction.
 *
 * When a session starts due to compaction, this hook reads the tracked skills
 * and outputs instructions to reload them, preserving skill context across compaction.
 *
 * Implements one-shot behavior by deleting the enablement flag after running.
 *
 * @see https://code.claude.com/docs/en/hooks#sessionstart
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { sessionStartHook, sessionStartOutput } from "@goodfoot/claude-code-hooks";
import { getReloadFlagPath, getSkillsFilePath } from "./skill-tracker.js";

/**
 * Formats a list of skills for human-readable output.
 * - Single skill: 'skill1'
 * - Two skills: 'skill1' and 'skill2'
 * - Three or more: 'skill1', 'skill2', and 'skill3'
 */
function formatSkillList(skills: string[]): string {
  if (skills.length === 0) return "";
  if (skills.length === 1) return `'${skills[0]}'`;
  if (skills.length === 2) return `'${skills[0]}' and '${skills[1]}'`;

  const allButLast = skills.slice(0, -1).map((s) => `'${s}'`);
  const last = `'${skills[skills.length - 1]}'`;
  return `${allButLast.join(", ")}, and ${last}`;
}

export default sessionStartHook({ matcher: "compact" }, (input, { logger }) => {
  const enablementFlag = getReloadFlagPath(input.session_id);
  const skillsFile = getSkillsFilePath(input.session_id);

  // Check if enablement flag exists (set by PreCompact hook if implemented, or manually)
  if (!existsSync(enablementFlag)) {
    logger.debug("Skill reload not enabled for this session");
    return sessionStartOutput({});
  }

  // Check if skills file exists and has content
  if (!existsSync(skillsFile)) {
    logger.debug("No skills file found");
    try {
      unlinkSync(enablementFlag);
    } catch {
      // Ignore cleanup errors
    }
    return sessionStartOutput({});
  }

  let content: string;
  try {
    content = readFileSync(skillsFile, "utf-8");
  } catch (error) {
    logger.warn("Failed to read skills file", { error: String(error) });
    try {
      unlinkSync(enablementFlag);
    } catch {
      // Ignore cleanup errors
    }
    return sessionStartOutput({});
  }

  // Deduplicate and filter empty lines
  const skills = [...new Set(content.split("\n").filter((line) => line.trim()))];

  if (skills.length === 0) {
    logger.debug("No skills to reload");
    try {
      unlinkSync(enablementFlag);
    } catch {
      // Ignore cleanup errors
    }
    return sessionStartOutput({});
  }

  // Delete the enablement flag (one-shot behavior)
  try {
    unlinkSync(enablementFlag);
  } catch {
    // Ignore cleanup errors
  }

  const skillList = formatSkillList(skills);
  logger.info("Reloading skills after compaction", { skills, skillList });

  return sessionStartOutput({
    systemMessage: `Skill reloader: Restoring ${skillList} after context compaction`,
    hookSpecificOutput: {
      additionalContext: `Load skill ${skillList} before continuing`,
    },
  });
});

/**
 * Enables skill reload for the next compaction.
 * Call this from a PreCompact hook to enable the reload mechanism.
 */
export function enableSkillReload(sessionId: string): void {
  const enablementFlag = getReloadFlagPath(sessionId);
  writeFileSync(enablementFlag, "1", "utf-8");
}
