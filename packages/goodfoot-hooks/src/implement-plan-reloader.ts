/**
 * Implement-Plan Reloader - SessionStart hook that restores implement-plan instructions after context compaction.
 *
 * When a session starts due to compaction, this hook checks if implement-plan
 * was running (via a flag file keyed by Claude PID) and outputs the instructions
 * to restore the workflow context.
 *
 * The flag is set by implement-plan.md when it starts running, using embedded bash
 * to find the Claude PID and write the flag file.
 *
 * Implements one-shot behavior by deleting the enablement flag after running.
 *
 * @see https://code.claude.com/docs/en/hooks#sessionstart
 */

import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { sessionStartHook, sessionStartOutput } from "@goodfoot/claude-code-hooks";
import { IMPLEMENT_PLAN_INSTRUCTIONS } from "./implement-plan-instructions.js";

/**
 * Finds the Claude process PID by walking up the process tree.
 * Returns null if no Claude process is found within 10 levels.
 */
export function findClaudePid(): number | null {
  let currentPid = process.ppid;
  const maxDepth = 10;

  for (let depth = 0; depth < maxDepth && currentPid > 1; depth++) {
    try {
      const comm = execSync(`ps -p ${currentPid} -o comm=`, { encoding: "utf-8" }).trim();
      if (comm === "claude") {
        return currentPid;
      }
      const ppid = execSync(`ps -p ${currentPid} -o ppid=`, { encoding: "utf-8" }).trim();
      currentPid = parseInt(ppid, 10);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Returns the path to the implement-plan reload enablement flag file.
 * Uses the Claude PID to tie the flag to the current Claude session.
 */
export function getImplementPlanReloadFlagPath(claudePid: number): string {
  return `/tmp/claude_implement_plan_reload_${claudePid}.enabled`;
}

export default sessionStartHook({ matcher: "compact" }, (_input, { logger }) => {
  const claudePid = findClaudePid();

  if (claudePid === null) {
    logger.debug("Could not find Claude PID");
    return sessionStartOutput({});
  }

  const enablementFlag = getImplementPlanReloadFlagPath(claudePid);

  // Check if enablement flag exists (set by implement-plan.md when it started)
  if (!existsSync(enablementFlag)) {
    logger.debug("Implement-plan reload not enabled for this session", { claudePid });
    return sessionStartOutput({});
  }

  // Delete the enablement flag (one-shot behavior)
  try {
    unlinkSync(enablementFlag);
  } catch {
    // Ignore cleanup errors
  }

  logger.info("Reloading implement-plan instructions after compaction", { claudePid });

  return sessionStartOutput({
    systemMessage: "Implement-plan reloader: Instructions restored after context compaction",
    hookSpecificOutput: {
      additionalContext: IMPLEMENT_PLAN_INSTRUCTIONS,
    },
  });
});
