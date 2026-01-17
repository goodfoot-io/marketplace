/**
 * Tests for the skill-tracker PostToolUse hook.
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { Logger, type PostToolUseInput } from "@goodfoot/claude-code-hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import hook, { getSkillsFilePath } from "../src/skill-tracker.js";

const logger = new Logger();

describe("Skill Tracker Hook", () => {
  const testSessionId = "test-session-123";
  const skillsFile = getSkillsFilePath(testSessionId);

  beforeEach(() => {
    // Clean up before each test
    try {
      unlinkSync(skillsFile);
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
  });

  it("exports a valid hook function", () => {
    expect(hook).toBeDefined();
    expect(typeof hook).toBe("function");
  });

  it("has correct hookEventName metadata", () => {
    expect(hook.hookEventName).toBe("PostToolUse");
  });

  it("has matcher for Skill tool", () => {
    expect(hook.matcher).toBe("Skill");
  });

  it("tracks skill invocation to file", async () => {
    const mockInput: PostToolUseInput = {
      hook_event_name: "PostToolUse",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      tool_name: "Skill",
      tool_input: { skill: "test-skill" },
      tool_response: {},
      tool_use_id: "tool-123",
    };

    await hook(mockInput, { logger });

    expect(existsSync(skillsFile)).toBe(true);
    const content = readFileSync(skillsFile, "utf-8");
    expect(content).toContain("test-skill");
  });

  it("appends multiple skills to file", async () => {
    const createInput = (skill: string): PostToolUseInput => ({
      hook_event_name: "PostToolUse",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      tool_name: "Skill",
      tool_input: { skill },
      tool_response: {},
      tool_use_id: `tool-${skill}`,
    });

    await hook(createInput("skill-a"), { logger });
    await hook(createInput("skill-b"), { logger });
    await hook(createInput("skill-c"), { logger });

    const content = readFileSync(skillsFile, "utf-8");
    expect(content).toContain("skill-a");
    expect(content).toContain("skill-b");
    expect(content).toContain("skill-c");
  });

  it("handles missing skill name gracefully", async () => {
    const mockInput: PostToolUseInput = {
      hook_event_name: "PostToolUse",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      tool_name: "Skill",
      tool_input: {}, // No skill property
      tool_response: {},
      tool_use_id: "tool-123",
    };

    const result = await hook(mockInput, { logger });

    expect(result).toBeDefined();
    expect(existsSync(skillsFile)).toBe(false);
  });
});
