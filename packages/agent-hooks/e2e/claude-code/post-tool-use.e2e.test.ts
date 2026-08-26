/**
 * E2E tests for PostToolUse hooks.
 *
 * PostToolUse hooks run after a tool has executed and can:
 * - Inject context based on tool results
 * - Log tool usage
 * - Modify the conversation flow
 */

import * as fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from "./setup.js";
import { CLAUDE_AVAILABLE, readHooksJson, runClaude } from "./test-utils.js";

describe("E2E: PostToolUse Hooks", () => {
  describe("Context injection", () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook("post-tool-use-context-hook.ts");
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it.skipIf(!CLAUDE_AVAILABLE)("injects context after Bash tool execution", () => {
      const result = runClaude({
        prompt: "Run: echo POSTTEST123 - then confirm you saw the hook context message",
        pluginDir,
        tools: ["Bash"],
      });

      const combinedOutput = result.stdout + result.stderr;
      // The hook should have added context (check if Claude acknowledges it)
      // Claude may paraphrase, so check for key terms from the hook output
      const hasHookOutput =
        combinedOutput.includes("E2E_POST_TOOL_CONTEXT") ||
        combinedOutput.includes("Command completed successfully") ||
        combinedOutput.includes("hook context");
      expect(hasHookOutput).toBe(true);
    });

    it("generates valid hooks.json with PostToolUse event and Bash matcher", () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.PostToolUse).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.PostToolUse)).toBe(true);

      const bashEntry = hooksJson.hooks.PostToolUse?.find((entry) => entry.matcher === "Bash");
      expect(bashEntry).toBeDefined();
    });
  });
});
