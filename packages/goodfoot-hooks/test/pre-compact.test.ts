/**
 * Tests for the pre-compact PreCompact hook.
 */

import { existsSync, unlinkSync } from "node:fs";
import { Logger, type PreCompactInput } from "@goodfoot/claude-code-hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import hook from "../src/pre-compact.js";
import { getReloadFlagPath } from "../src/skill-tracker.js";

const logger = new Logger();

describe("Pre-Compact Hook", () => {
  const testSessionId = "test-session-precompact";
  const enablementFlag = getReloadFlagPath(testSessionId);

  beforeEach(() => {
    try {
      unlinkSync(enablementFlag);
    } catch {
      // File may not exist
    }
  });

  afterEach(() => {
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
    expect(hook.hookEventName).toBe("PreCompact");
  });

  it("enables skill reload before compaction", async () => {
    expect(existsSync(enablementFlag)).toBe(false);

    const mockInput: PreCompactInput = {
      hook_event_name: "PreCompact",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      trigger: "auto",
      custom_instructions: null,
    };

    await hook(mockInput, { logger });

    expect(existsSync(enablementFlag)).toBe(true);
  });

  it("works for manual compaction trigger", async () => {
    const mockInput: PreCompactInput = {
      hook_event_name: "PreCompact",
      session_id: testSessionId,
      transcript_path: "/tmp/transcript.jsonl",
      cwd: "/workspace",
      trigger: "manual",
      custom_instructions: "Some custom instructions",
    };

    await hook(mockInput, { logger });

    expect(existsSync(enablementFlag)).toBe(true);
  });
});
