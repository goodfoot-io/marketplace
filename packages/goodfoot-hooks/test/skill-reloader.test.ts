/**
 * Tests for the skill-reloader SessionStart hook.
 */

import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import {
  Logger,
  type SessionStartContext,
  type SessionStartHookSpecificOutput,
  type SessionStartInput,
} from "@goodfoot/claude-code-hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import hook, { enableSkillReload } from "../src/skill-reloader.js";
import { getReloadFlagPath, getSkillsFilePath } from "../src/skill-tracker.js";

const logger = new Logger();

const mockContext: SessionStartContext = {
  logger,
  persistEnvVar: () => {},
  persistEnvVars: () => {},
};

describe("Skill Reloader Hook", () => {
  const testSessionId = "test-session-456";
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
    expect(hook.hookEventName).toBe("SessionStart");
  });

  it("has matcher for compact source", () => {
    expect(hook.matcher).toBe("compact");
  });

  it("does nothing when enablement flag is not set", async () => {
    writeFileSync(skillsFile, "skill-a\nskill-b\n", "utf-8");

    const mockInput: SessionStartInput = {
      hook_event_name: "SessionStart",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      source: "compact",
    };

    const result = await hook(mockInput, mockContext);

    expect(result.stdout.systemMessage).toBeUndefined();
    expect(result.stdout.hookSpecificOutput).toBeUndefined();
  });

  it("outputs reload instructions when enabled with skills", async () => {
    writeFileSync(skillsFile, "skill-a\nskill-b\n", "utf-8");
    enableSkillReload(testSessionId);

    const mockInput: SessionStartInput = {
      hook_event_name: "SessionStart",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      source: "compact",
    };

    const result = await hook(mockInput, mockContext);

    expect(result.stdout.systemMessage).toContain("Skill reloader");
    expect(result.stdout.systemMessage).toContain("skill-a");
    expect(result.stdout.systemMessage).toContain("skill-b");
    const hookOutput = result.stdout.hookSpecificOutput as { hookEventName: string } & SessionStartHookSpecificOutput;
    expect(hookOutput?.additionalContext).toContain("Load skill");
  });

  it("deduplicates skills in output", async () => {
    writeFileSync(skillsFile, "skill-a\nskill-a\nskill-b\nskill-b\n", "utf-8");
    enableSkillReload(testSessionId);

    const mockInput: SessionStartInput = {
      hook_event_name: "SessionStart",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      source: "compact",
    };

    const result = await hook(mockInput, mockContext);

    // Should mention each skill only once in human-readable format
    const message = result.stdout.systemMessage ?? "";
    const countA = (message.match(/skill-a/g) ?? []).length;
    const countB = (message.match(/skill-b/g) ?? []).length;
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  it("deletes enablement flag after running (one-shot)", async () => {
    writeFileSync(skillsFile, "skill-a\n", "utf-8");
    enableSkillReload(testSessionId);

    expect(existsSync(enablementFlag)).toBe(true);

    const mockInput: SessionStartInput = {
      hook_event_name: "SessionStart",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      source: "compact",
    };

    await hook(mockInput, mockContext);

    expect(existsSync(enablementFlag)).toBe(false);
  });

  it("formats single skill correctly", async () => {
    writeFileSync(skillsFile, "only-skill\n", "utf-8");
    enableSkillReload(testSessionId);

    const mockInput: SessionStartInput = {
      hook_event_name: "SessionStart",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      source: "compact",
    };

    const result = await hook(mockInput, mockContext);

    expect(result.stdout.systemMessage).toContain("'only-skill'");
    expect(result.stdout.systemMessage).not.toContain("and");
  });

  it("formats two skills correctly", async () => {
    writeFileSync(skillsFile, "skill-a\nskill-b\n", "utf-8");
    enableSkillReload(testSessionId);

    const mockInput: SessionStartInput = {
      hook_event_name: "SessionStart",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      source: "compact",
    };

    const result = await hook(mockInput, mockContext);

    expect(result.stdout.systemMessage).toContain("'skill-a' and 'skill-b'");
  });

  it("formats three or more skills correctly", async () => {
    writeFileSync(skillsFile, "skill-a\nskill-b\nskill-c\n", "utf-8");
    enableSkillReload(testSessionId);

    const mockInput: SessionStartInput = {
      hook_event_name: "SessionStart",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      source: "compact",
    };

    const result = await hook(mockInput, mockContext);

    expect(result.stdout.systemMessage).toContain("'skill-a', 'skill-b', and 'skill-c'");
  });
});
