/**
 * Test fixture: WorktreeCreate hook that returns a worktree path.
 *
 * Used to verify WorktreeCreate command hooks emit the bare path on stdout
 * (plain text), not a JSON-serialized object — the protocol Claude Code uses
 * to `chdir` into the created worktree.
 */

import { worktreeCreateHook, worktreeCreateOutput } from "../../../src/agents/claude-code/index.js";

export default worktreeCreateHook({}, (input, { logger }) => {
  const worktreePath = `${input.cwd}/.worktrees/${input.name}`;
  logger.info("Worktree created", { name: input.name, worktreePath });
  return worktreeCreateOutput({ worktreePath });
});
