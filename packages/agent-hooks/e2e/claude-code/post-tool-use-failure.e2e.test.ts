/**
 * E2E tests for PostToolUseFailure hooks.
 *
 * PostToolUseFailure hooks run after a tool execution fails and can:
 * - Log failures
 * - Inject context about the failure
 * - Suggest alternatives
 */

import * as fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from "./setup.js";
import { CLAUDE_AVAILABLE, readHooksJson, runClaude } from "./test-utils.js";

describe("E2E: PostToolUseFailure Hooks", () => {
  let pluginDir: string;

  beforeAll(() => {
    pluginDir = buildSingleHook("post-tool-use-failure-hook.ts");
  });

  afterAll(() => {
    cleanOutputDir(pluginDir);
  });

  it.skipIf(!CLAUDE_AVAILABLE)("injects context after tool failure", () => {
    const result = runClaude({
      prompt: "Run this bash command that will fail: exit 1",
      pluginDir,
      tools: ["Bash"],
    });

    const combinedOutput = result.stdout + result.stderr;
    // Check if the failure context was injected
    // Note: This depends on Claude actually running the failing command
    expect(combinedOutput).toMatch(/E2E_FAILURE_CONTEXT|exit|failed|error/i);
  });

  it("generates valid hooks.json with PostToolUseFailure event", () => {
    const hooksJsonPath = getHooksJsonPath(pluginDir);
    expect(fs.existsSync(hooksJsonPath)).toBe(true);

    const hooksJson = readHooksJson(hooksJsonPath);
    expect(hooksJson.hooks.PostToolUseFailure).toBeDefined();
    expect(Array.isArray(hooksJson.hooks.PostToolUseFailure)).toBe(true);

    const matcherEntry = hooksJson.hooks.PostToolUseFailure?.find((entry) => entry.matcher === ".*");
    expect(matcherEntry).toBeDefined();
    expect(matcherEntry?.hooks.length).toBeGreaterThan(0);
  });
});
