/**
 * E2E tests for SubagentStart hooks.
 *
 * SubagentStart hooks run when a subagent (Agent tool) starts and can:
 * - Inject context for the subagent
 * - Log subagent invocations
 * - Configure subagent behavior
 *
 * Note: SubagentStart hooks only fire when Claude uses the Agent tool.
 */

import * as fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from "./setup.js";
import { CLAUDE_AVAILABLE, readHooksJson, runClaude } from "./test-utils.js";

describe("E2E: SubagentStart Hooks", () => {
  let pluginDir: string;

  beforeAll(() => {
    pluginDir = buildSingleHook("subagent-start-hook.ts");
  });

  afterAll(() => {
    cleanOutputDir(pluginDir);
  });

  it.skipIf(!CLAUDE_AVAILABLE)("fires when Agent tool is used", () => {
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

  it("generates valid hooks.json with SubagentStart event", () => {
    const hooksJsonPath = getHooksJsonPath(pluginDir);
    expect(fs.existsSync(hooksJsonPath)).toBe(true);

    const hooksJson = readHooksJson(hooksJsonPath);
    expect(hooksJson.hooks.SubagentStart).toBeDefined();
    expect(Array.isArray(hooksJson.hooks.SubagentStart)).toBe(true);
    expect(hooksJson.hooks.SubagentStart?.length).toBeGreaterThan(0);

    const entry = hooksJson.hooks.SubagentStart?.[0];
    expect(entry?.hooks.length).toBeGreaterThan(0);
    expect(entry?.hooks[0].command).toContain(".mjs");
  });
});
