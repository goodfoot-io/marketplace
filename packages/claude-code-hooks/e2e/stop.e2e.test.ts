/**
 * E2E tests for Stop hooks.
 *
 * Stop hooks run when Claude is about to stop execution and can:
 * - Block the stop with a reason
 * - Allow the stop to proceed
 * - Inject final context
 */

import * as fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from "./setup.js";
import { readHooksJson } from "./test-utils.js";

describe("E2E: Stop Hooks", () => {
  describe("Block with reason", () => {
    let pluginDir: string;

    beforeAll(() => {
      pluginDir = buildSingleHook("stop-block-hook.ts");
    });

    afterAll(() => {
      cleanOutputDir(pluginDir);
    });

    it("generates valid hooks.json for stop hook", () => {
      const hooksJsonPath = getHooksJsonPath(pluginDir);
      expect(fs.existsSync(hooksJsonPath)).toBe(true);

      const hooksJson = readHooksJson(hooksJsonPath);
      expect(hooksJson.hooks).toBeDefined();
      expect(typeof hooksJson.hooks).toBe("object");

      // New format: hooks.Stop is an array of matcher entries
      expect(hooksJson.hooks.Stop).toBeDefined();
      expect(Array.isArray(hooksJson.hooks.Stop)).toBe(true);
      expect(hooksJson.hooks.Stop?.length).toBeGreaterThan(0);

      const stopEntry = hooksJson.hooks.Stop?.[0];
      expect(stopEntry?.hooks).toBeDefined();
      expect(stopEntry?.hooks.length).toBeGreaterThan(0);

      const compiledHook = stopEntry?.hooks[0];
      expect(compiledHook?.type).toBe("command");
      expect(compiledHook?.command).toBeDefined();
      expect(compiledHook?.command).toMatch(/^node "\$CLAUDE_PLUGIN_ROOT"\//);

      // Resolve the template path and verify file exists
      const pathPart = compiledHook?.command?.replace(/^node /, "").replace(/"/g, "");
      const resolvedPath = pathPart?.replace("$CLAUDE_PLUGIN_ROOT", pluginDir);
      expect(fs.existsSync(resolvedPath ?? "")).toBe(true);
    });
  });
});
