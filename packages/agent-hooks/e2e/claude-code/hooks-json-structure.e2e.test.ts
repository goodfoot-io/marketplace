/**
 * E2E tests for hooks.json structure validation.
 *
 * These tests verify the generated hooks.json format and metadata.
 */

import * as fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSingleHook, cleanOutputDir, getHooksJsonPath } from "./setup.js";
import { readHooksJson, readHooksMeta } from "./test-utils.js";

describe("E2E: hooks.json Structure Validation", () => {
  let pluginDir: string;

  beforeAll(() => {
    pluginDir = buildSingleHook("deny-bash-hook.ts");
  });

  afterAll(() => {
    cleanOutputDir(pluginDir);
  });

  it("carries no keys beyond hooks and tracks generated files in the sidecar", () => {
    const hooksJsonPath = getHooksJsonPath(pluginDir);
    const hooksJson = readHooksJson(hooksJsonPath);

    // The host rejects unknown keys here, so tracking must live beside it
    expect(Object.keys(hooksJson)).toEqual(["hooks"]);

    const meta = readHooksMeta(hooksJsonPath);
    expect(Array.isArray(meta.files)).toBe(true);
    expect(meta.files.length).toBeGreaterThan(0);
  });

  it("compiled hook files are executable", () => {
    const hooksJsonPath = getHooksJsonPath(pluginDir);
    const hooksJson = readHooksJson(hooksJsonPath);

    const entry = hooksJson.hooks.PreToolUse?.[0];
    const hookCommand = entry?.hooks[0].command;

    // Verify the command uses node "$CLAUDE_PLUGIN_ROOT" template
    expect(hookCommand).toBeDefined();
    expect(hookCommand).toMatch(/^node "\$CLAUDE_PLUGIN_ROOT"\//);
    expect(hookCommand?.endsWith(".mjs")).toBe(true);

    // Resolve the actual file path and verify it exists (strip 'node ' prefix and quotes)
    const pathPart = hookCommand?.replace(/^node /, "").replace(/"/g, "");
    const resolvedPath = pathPart?.replace("$CLAUDE_PLUGIN_ROOT", pluginDir);
    expect(fs.existsSync(resolvedPath ?? "")).toBe(true);
  });
});
