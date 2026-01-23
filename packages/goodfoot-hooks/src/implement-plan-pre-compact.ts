/**
 * Pre-Compact hook that enables implement-plan reload before compaction occurs.
 *
 * Before context compaction, this hook checks if an active project exists by
 * looking for a plan.md file in an active project directory. If found, it sets
 * an enablement flag that triggers the implement-plan-reloader hook to restore
 * instructions after compaction completes.
 *
 * @see https://code.claude.com/docs/en/hooks#precompact
 */

import { preCompactHook, preCompactOutput } from "@goodfoot/claude-code-hooks";
import { sync as globSync } from "glob";
import { enableImplementPlanReload } from "./implement-plan-reloader.js";

export default preCompactHook({}, (input, { logger }) => {
  // Check for active projects
  const activeProjects = globSync("projects/active/*/plan.md", { cwd: input.cwd });

  if (activeProjects.length === 0) {
    logger.debug("No active project found, skipping implement-plan reload enablement");
    return preCompactOutput({});
  }

  enableImplementPlanReload(input.session_id);
  logger.info("Enabled implement-plan reload for post-compaction", {
    sessionId: input.session_id,
    activeProjects,
  });

  return preCompactOutput({});
});
