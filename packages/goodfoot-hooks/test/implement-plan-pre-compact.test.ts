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

describe("Implement-Plan Pre-Compact Hook", () => {
  const testSessionId = "test-session-precompact-impl";
  const enablementFlag = getImplementPlanReloadFlagPath(testSessionId);
  let testWorkspace: string;

  beforeEach(() => {
    // Clean up enablement flag
    try {
      unlinkSync(enablementFlag);
    } catch {
      // File may not exist
    }

    // Create temp workspace
    testWorkspace = join(tmpdir(), `test-workspace-${Date.now()}`);
    mkdirSync(testWorkspace, { recursive: true });
  });

  afterEach(() => {
    // Clean up enablement flag
    try {
      unlinkSync(enablementFlag);
    } catch {
      // File may not exist
    }

    // Clean up temp workspace
    try {
      rmSync(testWorkspace, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
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

    const mockInput: PreCompactInput = {
      hook_event_name: "PreCompact",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: testWorkspace,
      trigger: "auto",
      custom_instructions: null,
    };

    await hook(mockInput, { logger });

    expect(existsSync(enablementFlag)).toBe(false);
  });

  it("sets flag when active project exists", async () => {
    // Create active project structure
    const activeProjectDir = join(testWorkspace, "projects", "active", "test-project");
    mkdirSync(activeProjectDir, { recursive: true });
    writeFileSync(join(activeProjectDir, "plan.md"), "# Test Plan\n", "utf-8");

    expect(existsSync(enablementFlag)).toBe(false);

    const mockInput: PreCompactInput = {
      hook_event_name: "PreCompact",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: testWorkspace,
      trigger: "auto",
      custom_instructions: null,
    };

    await hook(mockInput, { logger });

    expect(existsSync(enablementFlag)).toBe(true);
  });
});
