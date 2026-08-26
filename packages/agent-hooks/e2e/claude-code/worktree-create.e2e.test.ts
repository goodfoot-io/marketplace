/**
 * E2E tests for WorktreeCreate hooks.
 *
 * WorktreeCreate is a command hook whose wire protocol is the **bare worktree path
 * on stdout** (plain text), not JSON. Claude Code reads the hook's stdout verbatim
 * and `chdir`s into it. These tests build a real hook and execute the compiled
 * binary to verify stdout is the bare path and not `JSON.stringify(...)` output.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from "./setup.js";
import { readHooksJson } from "./test-utils.js";

describe("E2E: WorktreeCreate Hooks", () => {
  let pluginDir: string;

  beforeAll(() => {
    pluginDir = buildSingleHook("worktree-create-hook.ts");
  });

  afterAll(() => {
    cleanOutputDir(pluginDir);
  });

  it("generates valid hooks.json with WorktreeCreate event", () => {
    const hooksJsonPath = getHooksJsonPath(pluginDir);
    expect(fs.existsSync(hooksJsonPath)).toBe(true);

    const hooksJson = readHooksJson(hooksJsonPath);
    expect(hooksJson.hooks.WorktreeCreate).toBeDefined();
    expect(hooksJson.hooks.WorktreeCreate?.[0]?.hooks[0].command).toContain(".mjs");
  });

  it("emits the bare worktree path on stdout (not JSON)", () => {
    const hooksJsonPath = getHooksJsonPath(pluginDir);
    const command = readHooksJson(hooksJsonPath).hooks.WorktreeCreate?.[0]?.hooks[0].command;
    expect(command).toBeDefined();

    // command format: "node $CLAUDE_PLUGIN_ROOT/hooks/bin/<file>.mjs"
    const filename = path.basename(command as string);
    const binPath = path.join(pluginDir, "hooks", "bin", filename);

    const mockInput = JSON.stringify({
      hook_event_name: "WorktreeCreate",
      session_id: "test-session",
      cwd: "/repo",
      name: "feature-branch",
    });

    const execResult = spawnSync("node", [binPath], {
      input: mockInput,
      encoding: "utf-8",
      timeout: 5000,
    });

    expect(execResult.status).toBe(0);
    // Bare path, written verbatim — no JSON braces, no quotes.
    expect(execResult.stdout).toBe("/repo/.worktrees/feature-branch");
    expect(execResult.stdout).not.toContain("{");
    expect(execResult.stdout).not.toContain("hookSpecificOutput");
  });
});
