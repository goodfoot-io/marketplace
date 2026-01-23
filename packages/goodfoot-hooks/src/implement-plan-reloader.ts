/**
 * Implement-Plan Reloader - SessionStart hook that restores implement-plan instructions after context compaction.
 *
 * When a session starts due to compaction, this hook outputs the implement-plan
 * instructions to restore the workflow context, allowing the agent to continue
 * executing the plan from where it left off.
 *
 * Implements one-shot behavior by deleting the enablement flag after running.
 *
 * @see https://code.claude.com/docs/en/hooks#sessionstart
 */

import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { sessionStartHook, sessionStartOutput } from "@goodfoot/claude-code-hooks";
import { IMPLEMENT_PLAN_INSTRUCTIONS } from "./implement-plan-instructions.js";

/**
 * Returns the path to the implement-plan reload enablement flag file.
 */
export function getImplementPlanReloadFlagPath(sessionId: string): string {
  return `/tmp/claude_implement_plan_reload_${sessionId}.enabled`;
}

export default sessionStartHook({ matcher: "compact" }, (input, { logger }) => {
  const enablementFlag = getImplementPlanReloadFlagPath(input.session_id);

  // Check if enablement flag exists (set by PreCompact hook or manually)
  if (!existsSync(enablementFlag)) {
    logger.debug("Implement-plan reload not enabled for this session");
    return sessionStartOutput({});
  }

  // Delete the enablement flag (one-shot behavior)
  try {
    unlinkSync(enablementFlag);
  } catch {
    // Ignore cleanup errors
  }

  logger.info("Reloading implement-plan instructions after compaction");

  return sessionStartOutput({
    systemMessage: "Implement-plan reloader: Instructions restored after context compaction",
    hookSpecificOutput: {
      additionalContext: IMPLEMENT_PLAN_INSTRUCTIONS,
    },
  });
});

/**
 * Enables implement-plan reload for the next compaction.
 * Call this from a PreCompact hook to enable the reload mechanism.
 */
export function enableImplementPlanReload(sessionId: string): void {
  const enablementFlag = getImplementPlanReloadFlagPath(sessionId);
  writeFileSync(enablementFlag, "1", "utf-8");
}
