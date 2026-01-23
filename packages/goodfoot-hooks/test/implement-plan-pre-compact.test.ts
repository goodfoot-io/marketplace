/**
 * Tests for the implement-plan-pre-compact PreCompact hook.
 */

import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger, type PreCompactInput } from "@goodfoot/claude-code-hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import hook from "../src/implement-plan-pre-compact.js";
import { getImplementPlanReloadFlagPath } from "../src/implement-plan-reloader.js";

const logger = new Logger();
const testSessionId = "test-session-precompact-impl";

function createMockInput(cwd: string): PreCompactInput {
  return {
    hook_event_name: "PreCompact",
    session_id: testSessionId,
    transcript_path: "/tmp/transcript.jsonl",
    cwd,
    trigger: "auto",
    custom_instructions: null,
  };
}

describe("Implement-Plan Pre-Compact Hook", () => {
  const enablementFlag = getImplementPlanReloadFlagPath(testSessionId);
  let testWorkspace: string;

  function cleanupFlag(): void {
    try {
      unlinkSync(enablementFlag);
    } catch {
      // File may not exist
    }
  }

  function cleanupWorkspace(): void {
    try {
      rmSync(testWorkspace, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  }

  beforeEach(() => {
    cleanupFlag();
    testWorkspace = join(tmpdir(), `test-workspace-${Date.now()}`);
    mkdirSync(testWorkspace, { recursive: true });
  });

  afterEach(() => {
    cleanupFlag();
    cleanupWorkspace();
  });

  it("exports a valid hook function", () => {
    expect(hook).toBeDefined();
    expect(typeof hook).toBe("function");
  });

  it("has correct hookEventName metadata", () => {
    expect(hook.hookEventName).toBe("PreCompact");
  });

  it("does NOT set flag when no active project exists", async () => {
    expect(existsSync(enablementFlag)).toBe(false);

    await hook(createMockInput(testWorkspace), { logger });

    expect(existsSync(enablementFlag)).toBe(false);
  });

  it("sets flag when active project exists", async () => {
    const activeProjectDir = join(testWorkspace, "projects", "active", "test-project");
    mkdirSync(activeProjectDir, { recursive: true });
    writeFileSync(join(activeProjectDir, "plan.md"), "# Test Plan\n", "utf-8");

    expect(existsSync(enablementFlag)).toBe(false);

    await hook(createMockInput(testWorkspace), { logger });

    expect(existsSync(enablementFlag)).toBe(true);
  });
});
