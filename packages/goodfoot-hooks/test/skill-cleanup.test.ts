/**
 * Tests for the skill-cleanup SessionEnd hook.
 */

import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { Logger, type SessionEndInput } from "@goodfoot/claude-code-hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import hook from "../src/skill-cleanup.js";
import { getSkillsFilePath } from "../src/skill-tracker.js";

const logger = new Logger();

describe("Skill Cleanup Hook", () => {
  const testSessionId = "test-session-789";
  const skillsFile = getSkillsFilePath(testSessionId);

  beforeEach(() => {
    try {
      unlinkSync(skillsFile);
    } catch {
      // File may not exist
    }
  });

  afterEach(() => {
    try {
      unlinkSync(skillsFile);
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

  it("handles missing files gracefully", async () => {
    expect(existsSync(skillsFile)).toBe(false);

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
  });
});
