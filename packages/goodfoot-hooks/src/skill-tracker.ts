/**
 * Skill Tracker - PostToolUse hook that records Skill tool invocations.
 *
 * Records each invoked skill name to a session-scoped file for later
 * reload after context compaction.
 *
 * @see https://code.claude.com/docs/en/hooks#posttooluse
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { postToolUseHook, postToolUseOutput } from "@goodfoot/claude-code-hooks";

interface SkillToolInput {
  skill: string;
  args?: string;
}

function isSkillToolInput(input: unknown): input is SkillToolInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "skill" in input &&
    typeof (input as SkillToolInput).skill === "string"
  );
}

/**
 * Returns the path to the skills tracking file for a session.
 */
export function getSkillsFilePath(sessionId: string): string {
  return `/tmp/claude_skills_${sessionId}.txt`;
}

export default postToolUseHook({ matcher: "Skill" }, (input, { logger }) => {
  const toolInput = input.tool_input;

  if (!isSkillToolInput(toolInput)) {
    logger.debug("No skill name found in tool input");
    return postToolUseOutput({});
  }

  const skillName = toolInput.skill;
  const skillsFile = getSkillsFilePath(input.session_id);

  try {
    const dir = dirname(skillsFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(skillsFile, `${skillName}\n`, "utf-8");
    logger.info("Tracked skill invocation", { skill: skillName, file: skillsFile });
  } catch (error) {
    logger.warn("Failed to track skill", { skill: skillName, error: String(error) });
  }

  return postToolUseOutput({});
});
