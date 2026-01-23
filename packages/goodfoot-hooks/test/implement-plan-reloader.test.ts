/**
 * Tests for the implement-plan-reloader SessionStart hook.
 */

import { existsSync, unlinkSync } from "node:fs";
import {
  Logger,
  type SessionStartContext,
  type SessionStartHookSpecificOutput,
  type SessionStartInput,
} from "@goodfoot/claude-code-hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import hook, { enableImplementPlanReload, getImplementPlanReloadFlagPath } from "../src/implement-plan-reloader.js";

const logger = new Logger();

const mockContext: SessionStartContext = {
  logger,
  persistEnvVar: () => {},
  persistEnvVars: () => {},
};

const testSessionId = "test-session-789";

function createMockInput(): SessionStartInput {
  return {
    hook_event_name: "SessionStart",
    session_id: testSessionId,
    transcript_path: "/tmp/transcript.jsonl",
    cwd: "/workspace",
    source: "compact",
  };
}

function getAdditionalContext(
  hookOutput: { hookEventName: string } & SessionStartHookSpecificOutput,
): string | undefined {
  return hookOutput.additionalContext;
}

describe("Implement-Plan Reloader Hook", () => {
  const enablementFlag = getImplementPlanReloadFlagPath(testSessionId);

  function cleanupFlag(): void {
    try {
      unlinkSync(enablementFlag);
    } catch {
      // File may not exist
    }
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

    expect(result.stdout.systemMessage).toBeUndefined();
    expect(result.stdout.hookSpecificOutput).toBeUndefined();
  });

  it("outputs instructions when flag is set", async () => {
    enableImplementPlanReload(testSessionId);

    const result = await hook(createMockInput(), mockContext);

    expect(result.stdout.systemMessage).toContain("Implement-plan reloader");
    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    expect(getAdditionalContext(hookOutput)).toBeDefined();
  });

  it("clears flag after running (one-shot)", async () => {
    enableImplementPlanReload(testSessionId);
    expect(existsSync(enablementFlag)).toBe(true);

    await hook(createMockInput(), mockContext);

    expect(existsSync(enablementFlag)).toBe(false);
  });

  it("output contains operational-guidelines section", async () => {
    enableImplementPlanReload(testSessionId);

    const result = await hook(createMockInput(), mockContext);

    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    const content = getAdditionalContext(hookOutput) ?? "";
    expect(content).toContain("<operational-guidelines>");
    expect(content).toContain("</operational-guidelines>");
  });

  it("output contains Step 2 (Locate and Read Plan)", async () => {
    enableImplementPlanReload(testSessionId);

    const result = await hook(createMockInput(), mockContext);

    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    expect(getAdditionalContext(hookOutput)).toContain("## Step 2: Locate and Read Plan");
  });

  it("output contains Steps 4-11", async () => {
    enableImplementPlanReload(testSessionId);

    const result = await hook(createMockInput(), mockContext);

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
    enableImplementPlanReload(testSessionId);

    const result = await hook(createMockInput(), mockContext);

    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    expect(getAdditionalContext(hookOutput)).not.toContain("## Step 1:");
  });

  it("output excludes Step 3 (Move Project to Active)", async () => {
    enableImplementPlanReload(testSessionId);

    const result = await hook(createMockInput(), mockContext);

    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    expect(getAdditionalContext(hookOutput)).not.toContain("## Step 3:");
  });
});
