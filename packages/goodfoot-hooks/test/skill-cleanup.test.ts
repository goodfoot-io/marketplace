/**
 * Tests for the skill-cleanup SessionEnd hook.
 */

import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { Logger, type SessionEndInput } from "@goodfoot/claude-code-hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import hook from "../src/skill-cleanup.js";
import { getReloadFlagPath, getSkillsFilePath } from "../src/skill-tracker.js";

const logger = new Logger();

describe("Skill Cleanup Hook", () => {
  const testSessionId = "test-session-789";
  const skillsFile = getSkillsFilePath(testSessionId);
  const enablementFlag = getReloadFlagPath(testSessionId);

  beforeEach(() => {
    // Clean up before each test
    try {
      unlinkSync(skillsFile);
    } catch {
      // File may not exist
    }
    try {
      unlinkSync(enablementFlag);
    } catch {
      // File may not exist
    }
  });

  afterEach(() => {
    // Clean up after each test
    try {
      unlinkSync(skillsFile);
    } catch {
      // File may not exist
    }
    try {
      unlinkSync(enablementFlag);
    } catch {
      // File may not exist
    }
  });

  it("exports a valid hook function", () => {
    expect(hook).toBeDefined();
    expect(typeof hook).toBe("function");
  });

  it("has correct hookEventName metadata", () => {
    expect(hook.hookEventName).toBe("SessionEnd");
  });

  it("cleans up skills file", async () => {
    writeFileSync(skillsFile, "skill-a\nskill-b\n", "utf-8");
    expect(existsSync(skillsFile)).toBe(true);

    const mockInput: SessionEndInput = {
      hook_event_name: "SessionEnd",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      reason: "prompt_input_exit",
    };

    await hook(mockInput, { logger });

    expect(existsSync(skillsFile)).toBe(false);
  });

  it("cleans up enablement flag", async () => {
    writeFileSync(enablementFlag, "1", "utf-8");
    expect(existsSync(enablementFlag)).toBe(true);

    const mockInput: SessionEndInput = {
      hook_event_name: "SessionEnd",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      reason: "prompt_input_exit",
    };

    await hook(mockInput, { logger });

    expect(existsSync(enablementFlag)).toBe(false);
  });

  it("cleans up both files when both exist", async () => {
    writeFileSync(skillsFile, "skill-a\n", "utf-8");
    writeFileSync(enablementFlag, "1", "utf-8");

    const mockInput: SessionEndInput = {
      hook_event_name: "SessionEnd",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      reason: "prompt_input_exit",
    };

    await hook(mockInput, { logger });

    expect(existsSync(skillsFile)).toBe(false);
    expect(existsSync(enablementFlag)).toBe(false);
  });

  it("handles missing files gracefully", async () => {
    // Ensure files don't exist
    expect(existsSync(skillsFile)).toBe(false);
    expect(existsSync(enablementFlag)).toBe(false);

    const mockInput: SessionEndInput = {
      hook_event_name: "SessionEnd",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      reason: "prompt_input_exit",
    };

    // Should not throw
    const result = await hook(mockInput, { logger });

    expect(result).toBeDefined();
    expect(result.stdout.systemMessage).toContain("cleanup");
  });

  it("returns cleanup confirmation message", async () => {
    const mockInput: SessionEndInput = {
      hook_event_name: "SessionEnd",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      reason: "other",
    };

    const result = await hook(mockInput, { logger });

    expect(result.stdout.systemMessage).toBe("Session cleanup: Skill tracking files removed");
  });
});
