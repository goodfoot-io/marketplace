/**
 * Unit tests for the runtime module.
 *
 * Tests wire format output conversion for hook outputs.
 */

import { describe, expect, it } from "vitest";
import {
  notificationOutput,
  permissionRequestOutput,
  postToolUseOutput,
  preToolUseOutput,
  sessionStartOutput,
  stopOutput,
  userPromptSubmitOutput,
} from "../src/outputs.js";
import { convertToHookOutput } from "../src/runtime.js";

describe("convertToHookOutput", () => {
  /**
   * Helper to safely access hookSpecificOutput as a record.
   * @param result - The output from convertToHookOutput
   * @returns The hookSpecificOutput property as a record
   */
  function getHookSpecific(result: ReturnType<typeof convertToHookOutput>): Record<string, unknown> {
    return result.stdout.hookSpecificOutput as unknown as Record<string, unknown>;
  }

  describe("PreToolUse wire format", () => {
    it("passes through hookSpecificOutput with permissionDecision", () => {
      const specificOutput = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "Dangerous command",
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(result.stdout.hookSpecificOutput).toBeDefined();
      expect(hookSpecific.hookEventName).toBe("PreToolUse");
      expect(hookSpecific.permissionDecision).toBe("deny");
      expect(hookSpecific.permissionDecisionReason).toBe("Dangerous command");
    });

    it("includes updatedInput in hookSpecificOutput", () => {
      const specificOutput = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: "allow",
          updatedInput: { command: "ls -la" },
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.updatedInput).toEqual({ command: "ls -la" });
    });
  });

  describe("PostToolUse wire format", () => {
    it("passes through stopReason in stdout", () => {
      const specificOutput = postToolUseOutput({
        stopReason: "Output contains sensitive data",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.stopReason).toBe("Output contains sensitive data");
    });

    it("passes through additionalContext in hookSpecificOutput", () => {
      const specificOutput = postToolUseOutput({
        hookSpecificOutput: {
          additionalContext: "File was modified",
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(result.stdout.hookSpecificOutput).toBeDefined();
      expect(hookSpecific.additionalContext).toBe("File was modified");
    });

    it("includes updatedMCPToolOutput in hookSpecificOutput", () => {
      const specificOutput = postToolUseOutput({
        hookSpecificOutput: {
          updatedMCPToolOutput: { sanitized: true },
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.updatedMCPToolOutput).toEqual({ sanitized: true });
    });
  });

  describe("UserPromptSubmit wire format", () => {
    it("passes through stopReason for blocking", () => {
      const specificOutput = userPromptSubmitOutput({
        stopReason: "Prompt validation failed",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.stopReason).toBe("Prompt validation failed");
    });

    it("passes through additionalContext in hookSpecificOutput", () => {
      const specificOutput = userPromptSubmitOutput({
        hookSpecificOutput: {
          additionalContext: "User is admin",
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.additionalContext).toBe("User is admin");
    });
  });

  describe("PermissionRequest wire format", () => {
    it("passes through decision in hookSpecificOutput", () => {
      const specificOutput = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: "allow",
            updatedInput: { file_path: "/safe/path" },
          },
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(result.stdout.hookSpecificOutput).toBeDefined();
      expect(hookSpecific.hookEventName).toBe("PermissionRequest");
      expect(hookSpecific.decision).toEqual({
        behavior: "allow",
        updatedInput: { file_path: "/safe/path" },
      });
    });

    it("handles deny decision with message and interrupt", () => {
      const specificOutput = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: "deny",
            message: "Not allowed",
            interrupt: true,
          },
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.decision).toEqual({
        behavior: "deny",
        message: "Not allowed",
        interrupt: true,
      });
    });
  });

  describe("Stop wire format", () => {
    it("keeps decision at top level for Stop hooks", () => {
      const specificOutput = stopOutput({
        decision: "block",
        reason: "Uncommitted changes",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.decision).toBe("block");
      expect(result.stdout.reason).toBe("Uncommitted changes");
    });

    it("handles approve decision", () => {
      const specificOutput = stopOutput({
        decision: "approve",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.decision).toBe("approve");
    });
  });

  describe("SessionStart wire format", () => {
    it("passes through additionalContext in hookSpecificOutput", () => {
      const specificOutput = sessionStartOutput({
        hookSpecificOutput: {
          additionalContext: "Project: my-app",
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.additionalContext).toBe("Project: my-app");
    });
  });

  describe("common fields", () => {
    it("preserves continue, suppressOutput, systemMessage", () => {
      const specificOutput = sessionStartOutput({
        continue: true,
        suppressOutput: true,
        systemMessage: "Welcome",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.continue).toBe(true);
      expect(result.stdout.suppressOutput).toBe(true);
      expect(result.stdout.systemMessage).toBe("Welcome");
    });

    it("passes through stopReason in stdout", () => {
      const specificOutput = notificationOutput({
        stopReason: "Notification blocked",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.stopReason).toBe("Notification blocked");
    });
  });
});
