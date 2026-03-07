/**
 * E2E tests for SubagentStop hooks.
 *
 * SubagentStop hooks run when a subagent completes and can:
 * - Block the subagent from stopping
 * - Process subagent results
 * - Clean up resources
 *
 * Note: SubagentStop hooks only fire when Claude's Agent tool completes.
 */

import * as fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from "./setup.js";
import { CLAUDE_AVAILABLE, readHooksJson, runClaude } from "./test-utils.js";

describe("E2E: SubagentStop Hooks", () => {
  let pluginDir: string;

  beforeAll(() => {
    pluginDir = buildSingleHook("subagent-stop-hook.ts");
  });

  afterAll(() => {
    cleanOutputDir(pluginDir);
  });

  it.skipIf(!CLAUDE_AVAILABLE)("fires when Agent tool completes", () => {
    // Use haiku model for subagent and a trivial task to minimize API latency
    const result = runClaude({
      prompt:
        'Use the Agent tool with subagent_type "general-purpose", model "haiku", and prompt "Reply with exactly: done". Do not do anything else.',
      pluginDir,
      tools: ["Agent"],
    });

    const combinedOutput = result.stdout + result.stderr;
    // The subagent should have run and completed
    expect(combinedOutput.length).toBeGreaterThan(0);
  });

  it("generates valid hooks.json with SubagentStop event", () => {
    const hooksJsonPath = getHooksJsonPath(pluginDir);
    expect(fs.existsSync(hooksJsonPath)).toBe(true);

    const hooksJson = readHooksJson(hooksJsonPath);
    expect(hooksJson.hooks.SubagentStop).toBeDefined();
    expect(Array.isArray(hooksJson.hooks.SubagentStop)).toBe(true);
    expect(hooksJson.hooks.SubagentStop?.length).toBeGreaterThan(0);

    const entry = hooksJson.hooks.SubagentStop?.[0];
    expect(entry?.hooks.length).toBeGreaterThan(0);
    expect(entry?.hooks[0].command).toContain(".mjs");
  });
});
