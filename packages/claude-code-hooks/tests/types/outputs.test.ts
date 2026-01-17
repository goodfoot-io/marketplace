/**
 * Type inference tests for output builder types.
 *
 * These tests verify TypeScript correctly enforces type constraints at compile time.
 * They verify the wire format structure and correct return types.
 * @module
 */

import { describe, expect, it } from "vitest";
import {
  EXIT_CODES,
  notificationOutput,
  permissionRequestOutput,
  postToolUseFailureOutput,
  postToolUseOutput,
  preCompactOutput,
  preToolUseOutput,
  sessionEndOutput,
  sessionStartOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  userPromptSubmitOutput,
} from "../../src/outputs.js";

describe("preToolUseOutput type constraints", () => {
  describe("valid option combinations", () => {
    it("allows valid permissionDecision allow", () => {
      const _output = preToolUseOutput({
        hookSpecificOutput: { permissionDecision: "allow" },
      });
    });

    it("allows permissionDecision allow with updatedInput", () => {
      const _output = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: "allow",
          updatedInput: { command: "ls -la" },
        },
      });
    });

    it("allows valid permissionDecision deny", () => {
      const _output = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "Not allowed",
        },
      });
    });

    it("allows valid permissionDecision ask", () => {
      const _output = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: "ask",
          permissionDecisionReason: "Confirm this action?",
        },
      });
    });

    it("allows empty options (default behavior)", () => {
      const _output = preToolUseOutput({});
    });

    it("allows updatedInput without decision", () => {
      const _output = preToolUseOutput({
        hookSpecificOutput: { updatedInput: { command: "safe-cmd" } },
      });
    });

    it("allows common options with hookSpecificOutput", () => {
      const _output = preToolUseOutput({
        hookSpecificOutput: { permissionDecision: "allow" },
        systemMessage: "Allowed with message",
      });
    });

    it("allows stopReason (uses exit code 2)", () => {
      const _output = preToolUseOutput({
        stopReason: "Operation blocked",
      });
    });
  });

  describe("return type verification", () => {
    it("returns PreToolUseOutput type with stdout and _type", () => {
      const output = preToolUseOutput({
        hookSpecificOutput: { permissionDecision: "allow" },
      });
      expect(output).toHaveProperty("stdout");
      expect(output).toHaveProperty("_type", "PreToolUse");
    });
  });
});

describe("permissionRequestOutput type constraints", () => {
  describe("valid option combinations", () => {
    it("allows valid allow decision", () => {
      const _output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: { behavior: "allow" },
        },
      });
    });

    it("allows allow with updatedInput", () => {
      const _output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: "allow",
            updatedInput: { file_path: "/safe/path" },
          },
        },
      });
    });

    it("allows allow with updatedPermissions", () => {
      const _output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: "allow",
            updatedPermissions: [],
          },
        },
      });
    });

    it("allows valid deny decision", () => {
      const _output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: { behavior: "deny" },
        },
      });
    });

    it("allows deny with message", () => {
      const _output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: "deny",
            message: "Permission denied",
          },
        },
      });
    });

    it("allows deny with interrupt", () => {
      const _output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: "deny",
            interrupt: true,
          },
        },
      });
    });

    it("allows empty options (fall through)", () => {
      const _output = permissionRequestOutput({});
    });
  });
});

describe("stopOutput type constraints", () => {
  describe("valid option combinations", () => {
    it("allows approve decision", () => {
      const _output = stopOutput({ decision: "approve" });
    });

    it("allows block decision with exit code 2", () => {
      const _output = stopOutput({ decision: "block" });
    });

    it("allows block with reason", () => {
      const _output = stopOutput({
        decision: "block",
        reason: "Cannot stop yet",
      });
    });

    it("allows empty options (no default decision)", () => {
      const output = stopOutput({});
      expect(output.stdout.decision).toBeUndefined();
    });

    it("allows systemMessage with decision", () => {
      const _output = stopOutput({
        decision: "block",
        reason: "Pending changes",
        systemMessage: "Please commit changes first",
      });
    });
  });

  describe("decision value type checking", () => {
    it("decision is typed as approve or block", () => {
      const approveOutput = stopOutput({ decision: "approve" });
      expect(approveOutput.stdout.decision).toBe("approve");

      const blockOutput = stopOutput({ decision: "block" });
      expect(blockOutput.stdout.decision).toBe("block");
    });
  });
});

describe("output builders with additionalContext in hookSpecificOutput", () => {
  it("postToolUseOutput accepts additionalContext", () => {
    const _output = postToolUseOutput({
      hookSpecificOutput: { additionalContext: "Extra info for Claude" },
    });
  });

  it("postToolUseOutput accepts updatedMCPToolOutput", () => {
    const _output = postToolUseOutput({
      hookSpecificOutput: { updatedMCPToolOutput: { modified: true } },
    });
  });

  it("postToolUseFailureOutput accepts additionalContext", () => {
    const _output = postToolUseFailureOutput({
      hookSpecificOutput: { additionalContext: "Try another approach" },
    });
  });

  it("userPromptSubmitOutput accepts additionalContext", () => {
    const _output = userPromptSubmitOutput({
      hookSpecificOutput: { additionalContext: "Project uses TypeScript strict mode" },
    });
  });

  it("sessionStartOutput accepts additionalContext", () => {
    const _output = sessionStartOutput({
      hookSpecificOutput: { additionalContext: JSON.stringify({ initialized: true }) },
    });
  });

  it("subagentStartOutput accepts additionalContext", () => {
    const _output = subagentStartOutput({
      hookSpecificOutput: { additionalContext: "Focus on finding patterns" },
    });
  });
});

describe("output builders without hook-specific options", () => {
  it("sessionEndOutput only accepts common options", () => {
    const _output = sessionEndOutput({});
  });

  it("sessionEndOutput accepts systemMessage", () => {
    const _output = sessionEndOutput({
      systemMessage: "Cleanup complete",
    });
  });

  it("subagentStopOutput accepts decision and reason", () => {
    const _output = subagentStopOutput({
      decision: "block",
      reason: "Task incomplete",
    });
  });

  it("notificationOutput only accepts common options", () => {
    const _output = notificationOutput({});
  });

  it("preCompactOutput only accepts common options", () => {
    const _output = preCompactOutput({});
  });

  it("preCompactOutput accepts systemMessage", () => {
    const _output = preCompactOutput({
      systemMessage: "Remember: strict mode enabled",
    });
  });
});

describe("common options on all builders", () => {
  const builders = [
    { name: "preToolUseOutput", fn: preToolUseOutput },
    { name: "postToolUseOutput", fn: postToolUseOutput },
    { name: "postToolUseFailureOutput", fn: postToolUseFailureOutput },
    { name: "userPromptSubmitOutput", fn: userPromptSubmitOutput },
    { name: "sessionStartOutput", fn: sessionStartOutput },
    { name: "sessionEndOutput", fn: sessionEndOutput },
    { name: "stopOutput", fn: stopOutput },
    { name: "subagentStartOutput", fn: subagentStartOutput },
    { name: "subagentStopOutput", fn: subagentStopOutput },
    { name: "notificationOutput", fn: notificationOutput },
    { name: "preCompactOutput", fn: preCompactOutput },
    { name: "permissionRequestOutput", fn: permissionRequestOutput },
  ];

  describe("stopReason option", () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts stopReason option`, () => {
        const _output = fn({ stopReason: "Blocked" });
      });
    }
  });

  describe("continue option", () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts continue option`, () => {
        const output = fn({ continue: true });
        expect(output.stdout.continue).toBe(true);
      });
    }
  });

  describe("suppressOutput option", () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts suppressOutput option`, () => {
        const output = fn({ suppressOutput: true });
        expect(output.stdout.suppressOutput).toBe(true);
      });
    }
  });

  describe("systemMessage option", () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts systemMessage option`, () => {
        const output = fn({ systemMessage: "System message" });
        expect(output.stdout.systemMessage).toBe("System message");
      });
    }
  });
});

describe("Specific output type structure", () => {
  it("has required stdout property", () => {
    const output = preToolUseOutput({});
    expect(typeof output.stdout).toBe("object");
  });

  it("has _type property for hook identification", () => {
    const output = preToolUseOutput({});
    expect(output._type).toBe("PreToolUse");
  });

  it("stopReason is stored in stdout.stopReason", () => {
    const successOutput = preToolUseOutput({});
    expect(successOutput.stdout.stopReason).toBeUndefined();

    const blockOutput = preToolUseOutput({ stopReason: "Reason" });
    expect(blockOutput.stdout.stopReason).toBe("Reason");
  });
});

describe("EXIT_CODES constants", () => {
  it("SUCCESS is 0", () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
  });

  it("ERROR is 1", () => {
    expect(EXIT_CODES.ERROR).toBe(1);
  });

  it("BLOCK is 2", () => {
    expect(EXIT_CODES.BLOCK).toBe(2);
  });
});
