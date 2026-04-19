/**
 * Tests for the implement-plan-reloader SessionStart hook.
 */

import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import {
  Logger,
  type SessionStartContext,
  type SessionStartHookSpecificOutput,
  type SessionStartInput,
} from "@goodfoot/claude-code-hooks";
import { afterEach, assert, beforeEach, describe, expect, it } from "vitest";
import hook, { findClaudePid, getImplementPlanReloadFlagPath } from "../src/implement-plan-reloader.js";

const logger = new Logger();

const mockContext: SessionStartContext = {
  logger,
  persistEnvVar: () => {},
  persistEnvVars: () => {},
};

function createMockInput(): SessionStartInput {
  return {
    hook_event_name: "SessionStart",
    session_id: "test-session-789",
    transcript_path: "/tmp/transcript.jsonl",
    cwd: "/workspace",
    source: "compact",
  };
}

function getAdditionalContext(
  hookOutput: { hookEventName: string } & SessionStartHookSpecificOutput,
): string | undefined {
  return hookOutput?.additionalContext;
}

describe("Implement-Plan Reloader Hook", () => {
  // Get the real Claude PID - tests run under Claude so this will work
  const claudePid = findClaudePid();
  const enablementFlag = claudePid ? getImplementPlanReloadFlagPath(claudePid) : null;

  function cleanupFlag(): void {
    if (!enablementFlag) return;
    try {
      unlinkSync(enablementFlag);
    } catch (_e) {
      void _e;
    }
  }

  function enableReload(): void {
    if (!enablementFlag) return;
    writeFileSync(enablementFlag, "1", "utf-8");
  }

  beforeEach(cleanupFlag);
  afterEach(cleanupFlag);

  it("exports a valid hook function", () => {
    expect(hook).toBeDefined();
    expect(typeof hook).toBe("function");
  });

  it("has correct hookEventName metadata", () => {
    expect(hook.hookEventName).toBe("SessionStart");
  });

  it("has matcher for compact source", () => {
    expect(hook.matcher).toBe("compact");
  });

  it("does nothing when enablement flag is not set", async () => {
    const result = await hook(createMockInput(), mockContext);
    expect(result).toBeNull();
  });

  it("outputs instructions when flag is set", async () => {
    if (!claudePid) return; // Skip if not running under Claude
    enableReload();

    const result = await hook(createMockInput(), mockContext);
    assert(result !== null);

    expect(result.stdout.systemMessage).toContain("Implement-plan reloader");
    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    expect(getAdditionalContext(hookOutput)).toBeDefined();
  });

  it("clears flag after running (one-shot)", async () => {
    if (!claudePid || !enablementFlag) return; // Skip if not running under Claude
    enableReload();
    expect(existsSync(enablementFlag)).toBe(true);

    await hook(createMockInput(), mockContext);

    expect(existsSync(enablementFlag)).toBe(false);
  });

  it("output contains operational-guidelines section", async () => {
    if (!claudePid) return; // Skip if not running under Claude
    enableReload();

    const result = await hook(createMockInput(), mockContext);
    assert(result !== null);

    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    const content = getAdditionalContext(hookOutput) ?? "";
    expect(content).toContain("<operational-guidelines>");
    expect(content).toContain("</operational-guidelines>");
  });

  it("output contains Step 2 (Locate and Read Plan)", async () => {
    if (!claudePid) return; // Skip if not running under Claude
    enableReload();

    const result = await hook(createMockInput(), mockContext);
    assert(result !== null);

    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    expect(getAdditionalContext(hookOutput)).toContain("## Step 2: Locate and Read Plan");
  });

  it("output contains Steps 4-11", async () => {
    if (!claudePid) return; // Skip if not running under Claude
    enableReload();

    const result = await hook(createMockInput(), mockContext);
    assert(result !== null);

    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    const content = getAdditionalContext(hookOutput) ?? "";

    expect(content).toContain("## Step 4: Assess Coherence");
    expect(content).toContain("## Step 5: Select Model and Dispatch Tasks");
    expect(content).toContain("## Step 6: Validation Gate");
    expect(content).toContain("## Step 7: Refactor");
    expect(content).toContain("## Step 8: Post-Refactor Validation");
    expect(content).toContain("## Step 9: Evaluate Quality");
    expect(content).toContain("## Step 10: Report Results");
    expect(content).toContain("## Step 11: Final Commit and Move Project");
  });

  it("output excludes Step 1 (Establish Baseline)", async () => {
    if (!claudePid) return; // Skip if not running under Claude
    enableReload();

    const result = await hook(createMockInput(), mockContext);
    assert(result !== null);

    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    expect(getAdditionalContext(hookOutput)).not.toContain("## Step 1:");
  });

  it("output excludes Step 3 (Move Project to Active)", async () => {
    if (!claudePid) return; // Skip if not running under Claude
    enableReload();

    const result = await hook(createMockInput(), mockContext);
    assert(result !== null);

    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    expect(getAdditionalContext(hookOutput)).not.toContain("## Step 3:");
  });
});

describe("findClaudePid", () => {
  it("returns a number when running under Claude", () => {
    const pid = findClaudePid();
    // When running under Claude, this should return a number
    // When not running under Claude, it returns null
    if (pid !== null) {
      expect(typeof pid).toBe("number");
      expect(pid).toBeGreaterThan(0);
    }
  });
});

describe("getImplementPlanReloadFlagPath", () => {
  it("returns path with PID", () => {
    const path = getImplementPlanReloadFlagPath(12345);
    expect(path).toBe("/tmp/claude_implement_plan_reload_12345.enabled");
  });
});
