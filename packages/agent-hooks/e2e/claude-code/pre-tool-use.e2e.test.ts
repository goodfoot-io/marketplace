/**
 * E2E tests for PreToolUse hooks.
 *
 * PreToolUse hooks run before a tool is executed and can:
 * - Block the tool execution
 * - Allow it to proceed
 * - Modify context
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LogEvent } from "../../src/core/logger.js";
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from "./setup.js";
import { CLAUDE_AVAILABLE, readHooksJson, runClaude } from "./test-utils.js";

describe("E2E: PreToolUse Hooks", () => {
  describe("Bash denial", () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook("deny-bash-hook.ts");
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it.skipIf(!CLAUDE_AVAILABLE)("denies Bash commands when hook is active", () => {
      const markerPath = path.join(pluginDir, "bash-execution-marker.txt");
      const logPath = path.join(pluginDir, "denial-events.jsonl");
      const command = `printf 'HOOKTEST123' > '${markerPath.replace(/'/g, "'\\''")}'`;
      const result = runClaude({
        prompt: `Run this exact bash command:\n${command}\nIf blocked, report the hook's exact reason.`,
        pluginDir,
        tools: ["Bash"],
        env: { AGENT_HOOKS_LOG_FILE: logPath },
      });

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout + result.stderr).toContain("Bash commands are blocked by test hook");
      expect(fs.existsSync(markerPath)).toBe(false);
      const events: LogEvent[] = fs
        .readFileSync(logPath, "utf-8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(events).toContainEqual(
        expect.objectContaining({
          level: "info",
          message: "Denying Bash command",
          context: { command },
        }),
      );
    });

    it("generates valid hooks.json with PreToolUse event and Bash matcher", () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.PreToolUse)).toBe(true);

      const bashEntry = hooksJson.hooks.PreToolUse?.find((entry) => entry.matcher === "Bash");
      expect(bashEntry).toBeDefined();
      expect(bashEntry?.hooks.length).toBeGreaterThan(0);
    });
  });

  describe("Multi-tool matcher", () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook("pre-tool-use-multi-matcher-hook.ts");
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it("generates hooks.json with regex alternation matcher", () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      const hooksJson = readHooksJson(hooksJsonPath);

      const entry = hooksJson.hooks.PreToolUse?.find((e) => e.matcher === "Read|Glob|Grep");
      expect(entry).toBeDefined();
    });
  });

  describe("Error handling: Hook that throws", () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook("error-hook.ts");
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it("generates valid hooks.json for error hook", () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks).toBeDefined();

      // New format: hooks.PreToolUse is an array of matcher entries
      expect(hooksJson.hooks.PreToolUse).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.PreToolUse)).toBe(true);

      const readEntry = hooksJson.hooks.PreToolUse?.find((entry) => entry.matcher === "Read");
      expect(readEntry).toBeDefined();
    });
  });
});
