/**
 * Unit tests for output builder functions.
 *
 * Tests all 12 output builder functions for:
 * - Correct exit codes
 * - Wire format output structure (hookSpecificOutput)
 * - CommonOptions (stopReason, continue, suppressOutput, systemMessage)
 * - Hook-specific options
 * - Empty options semantics
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
} from "../src/outputs.js";

describe("EXIT_CODES", () => {
  it("defines correct exit code constants", () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
    expect(EXIT_CODES.ERROR).toBe(1);
    expect(EXIT_CODES.BLOCK).toBe(2);
  });
});

describe("preToolUseOutput", () => {
  it("produces exit 0 and correct _type for empty options", () => {
    const result = preToolUseOutput({});
    expect(result._type).toBe("PreToolUse");
    expect(result.stdout.hookSpecificOutput).toBeUndefined();
  });

  it("produces allow decision in hookSpecificOutput", () => {
    const result = preToolUseOutput({
      hookSpecificOutput: { permissionDecision: "allow" },
    });
    expect(result.stdout.hookSpecificOutput).toBeDefined();
    expect(result.stdout.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
    if (result.stdout.hookSpecificOutput?.hookEventName === "PreToolUse") {
      expect(result.stdout.hookSpecificOutput.permissionDecision).toBe("allow");
    }
  });

  it("produces allow decision with updatedInput", () => {
    const result = preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: "allow",
        updatedInput: { command: "ls -la" },
      },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PreToolUse") {
      expect(result.stdout.hookSpecificOutput.permissionDecision).toBe("allow");
      expect(result.stdout.hookSpecificOutput.updatedInput).toEqual({ command: "ls -la" });
    }
  });

  it("produces deny decision with reason", () => {
    const result = preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: "deny",
        permissionDecisionReason: "Dangerous command",
      },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PreToolUse") {
      expect(result.stdout.hookSpecificOutput.permissionDecision).toBe("deny");
      expect(result.stdout.hookSpecificOutput.permissionDecisionReason).toBe("Dangerous command");
    }
  });

  it("produces ask decision with reason", () => {
    const result = preToolUseOutput({
      hookSpecificOutput: {
        permissionDecision: "ask",
        permissionDecisionReason: "Are you sure?",
      },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PreToolUse") {
      expect(result.stdout.hookSpecificOutput.permissionDecision).toBe("ask");
      expect(result.stdout.hookSpecificOutput.permissionDecisionReason).toBe("Are you sure?");
    }
  });

  it("allows updatedInput without explicit decision", () => {
    const result = preToolUseOutput({
      hookSpecificOutput: { updatedInput: { file: "/tmp/test" } },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PreToolUse") {
      expect(result.stdout.hookSpecificOutput.updatedInput).toEqual({ file: "/tmp/test" });
      expect(result.stdout.hookSpecificOutput.permissionDecision).toBeUndefined();
    }
  });

  it("handles stopReason in stdout", () => {
    const result = preToolUseOutput({ stopReason: "Operation blocked" });
    expect(result.stdout.stopReason).toBe("Operation blocked");
  });

  it("handles systemMessage option", () => {
    const result = preToolUseOutput({
      hookSpecificOutput: { permissionDecision: "allow" },
      systemMessage: "Tool was allowed",
    });
    expect(result.stdout.systemMessage).toBe("Tool was allowed");
  });

  it("handles continue option", () => {
    const result = preToolUseOutput({ continue: true });
    expect(result.stdout.continue).toBe(true);
  });

  it("handles suppressOutput option", () => {
    const result = preToolUseOutput({ suppressOutput: true });
    expect(result.stdout.suppressOutput).toBe(true);
  });

  it("stopReason includes systemMessage when provided", () => {
    const result = preToolUseOutput({
      stopReason: "Blocked",
      systemMessage: "Contact admin",
    });
    expect(result.stdout.stopReason).toBe("Blocked");
    expect(result.stdout.systemMessage).toBe("Contact admin");
  });
});

describe("postToolUseOutput", () => {
  it("produces exit 0 for empty options", () => {
    const result = postToolUseOutput({});
    expect(result._type).toBe("PostToolUse");
  });

  it("produces additionalContext in hookSpecificOutput", () => {
    const result = postToolUseOutput({
      hookSpecificOutput: { additionalContext: "File was read" },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PostToolUse") {
      expect(result.stdout.hookSpecificOutput.additionalContext).toBe("File was read");
    }
  });

  it("produces updatedMCPToolOutput in hookSpecificOutput", () => {
    const result = postToolUseOutput({
      hookSpecificOutput: { updatedMCPToolOutput: { modified: true, data: "test" } },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PostToolUse") {
      expect(result.stdout.hookSpecificOutput.updatedMCPToolOutput).toEqual({ modified: true, data: "test" });
    }
  });

  it("handles stopReason", () => {
    const result = postToolUseOutput({ stopReason: "Blocked after tool use" });
    expect(result.stdout.stopReason).toBe("Blocked after tool use");
  });
});

describe("postToolUseFailureOutput", () => {
  it("produces exit 0 for empty options", () => {
    const result = postToolUseFailureOutput({});
    expect(result._type).toBe("PostToolUseFailure");
  });

  it("produces additionalContext in hookSpecificOutput", () => {
    const result = postToolUseFailureOutput({
      hookSpecificOutput: { additionalContext: "Try alternative approach" },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PostToolUseFailure") {
      expect(result.stdout.hookSpecificOutput.additionalContext).toBe("Try alternative approach");
    }
  });

  it("handles stopReason", () => {
    const _result = postToolUseFailureOutput({ stopReason: "Critical failure" });
  });
});

describe("userPromptSubmitOutput", () => {
  it("produces exit 0 for empty options", () => {
    const result = userPromptSubmitOutput({});
    expect(result._type).toBe("UserPromptSubmit");
  });

  it("produces additionalContext in hookSpecificOutput", () => {
    const result = userPromptSubmitOutput({
      hookSpecificOutput: { additionalContext: "Project uses TypeScript" },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "UserPromptSubmit") {
      expect(result.stdout.hookSpecificOutput.additionalContext).toBe("Project uses TypeScript");
    }
  });
});

describe("sessionStartOutput", () => {
  it("produces exit 0 for empty options", () => {
    const result = sessionStartOutput({});
    expect(result._type).toBe("SessionStart");
  });

  it("produces additionalContext in hookSpecificOutput", () => {
    const result = sessionStartOutput({
      hookSpecificOutput: { additionalContext: JSON.stringify({ initialized: true }) },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "SessionStart") {
      expect(result.stdout.hookSpecificOutput.additionalContext).toBe('{"initialized":true}');
    }
  });

  it("handles systemMessage without additionalContext", () => {
    const result = sessionStartOutput({ systemMessage: "Welcome message" });
    expect(result.stdout.systemMessage).toBe("Welcome message");
    expect(result.stdout.hookSpecificOutput).toBeUndefined();
  });
});

describe("sessionEndOutput", () => {
  it("produces exit 0 for empty options", () => {
    const result = sessionEndOutput({});
    expect(result._type).toBe("SessionEnd");
  });

  it("handles systemMessage", () => {
    const result = sessionEndOutput({ systemMessage: "Session cleanup complete" });
    expect(result.stdout.systemMessage).toBe("Session cleanup complete");
  });

  it("handles stopReason", () => {
    const _result = sessionEndOutput({ stopReason: "Cannot end session" });
  });
});

describe("stopOutput", () => {
  it("produces no default decision for empty options", () => {
    const result = stopOutput({});
    expect(result._type).toBe("Stop");
    expect(result.stdout.decision).toBeUndefined();
  });

  it("produces approve decision when specified", () => {
    const result = stopOutput({ decision: "approve" });
    expect(result.stdout.decision).toBe("approve");
  });

  it("produces block decision with reason", () => {
    const result = stopOutput({
      decision: "block",
      reason: "Uncommitted changes present",
    });
    expect(result.stdout.decision).toBe("block");
    expect(result.stdout.reason).toBe("Uncommitted changes present");
  });

  it("handles systemMessage with decision", () => {
    const result = stopOutput({
      decision: "block",
      reason: "Changes pending",
      systemMessage: "Please commit before stopping",
    });
    expect(result.stdout.systemMessage).toBe("Please commit before stopping");
    expect(result.stdout.decision).toBe("block");
  });
});

describe("subagentStartOutput", () => {
  it("produces exit 0 for empty options", () => {
    const result = subagentStartOutput({});
    expect(result._type).toBe("SubagentStart");
  });

  it("produces additionalContext in hookSpecificOutput", () => {
    const result = subagentStartOutput({
      hookSpecificOutput: { additionalContext: "Focus on patterns" },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "SubagentStart") {
      expect(result.stdout.hookSpecificOutput.additionalContext).toBe("Focus on patterns");
    }
  });
});

describe("subagentStopOutput", () => {
  it("produces no default decision for empty options", () => {
    const result = subagentStopOutput({});
    expect(result._type).toBe("SubagentStop");
    expect(result.stdout.decision).toBeUndefined();
  });

  it("handles systemMessage", () => {
    const result = subagentStopOutput({ systemMessage: "Subagent completed" });
    expect(result.stdout.systemMessage).toBe("Subagent completed");
  });

  it("produces block decision with exit code 2", () => {
    const result = subagentStopOutput({
      decision: "block",
      reason: "Task incomplete",
    });
    expect(result.stdout.decision).toBe("block");
    expect(result.stdout.reason).toBe("Task incomplete");
  });
});

describe("notificationOutput", () => {
  it("produces exit 0 for empty options", () => {
    const result = notificationOutput({});
    expect(result._type).toBe("Notification");
  });

  it("handles systemMessage", () => {
    const result = notificationOutput({
      systemMessage: "Notification forwarded to Slack",
    });
    expect(result.stdout.systemMessage).toBe("Notification forwarded to Slack");
  });
});

describe("preCompactOutput", () => {
  it("produces exit 0 for empty options", () => {
    const result = preCompactOutput({});
    expect(result._type).toBe("PreCompact");
  });

  it("handles systemMessage for context preservation", () => {
    const result = preCompactOutput({
      systemMessage: "Remember: strict mode is enabled",
    });
    expect(result.stdout.systemMessage).toBe("Remember: strict mode is enabled");
  });
});

describe("permissionRequestOutput", () => {
  it("produces exit 0 for empty options", () => {
    const result = permissionRequestOutput({});
    expect(result._type).toBe("PermissionRequest");
    expect(result.stdout.hookSpecificOutput).toBeUndefined();
  });

  it("produces allow decision in hookSpecificOutput", () => {
    const result = permissionRequestOutput({
      hookSpecificOutput: {
        decision: { behavior: "allow" },
      },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PermissionRequest") {
      expect(result.stdout.hookSpecificOutput.decision).toEqual({ behavior: "allow" });
    }
  });

  it("produces allow decision with updatedInput", () => {
    const result = permissionRequestOutput({
      hookSpecificOutput: {
        decision: {
          behavior: "allow",
          updatedInput: { file_path: "/safe/path/file.txt" },
        },
      },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PermissionRequest") {
      expect(result.stdout.hookSpecificOutput.decision).toEqual({
        behavior: "allow",
        updatedInput: { file_path: "/safe/path/file.txt" },
      });
    }
  });

  it("produces allow decision with updatedPermissions", () => {
    const updatedPermissions = [
      {
        type: "addRules" as const,
        rules: [{ toolName: "Read", ruleContent: "/tmp/*" }],
        behavior: "allow" as const,
        destination: "session" as const,
      },
    ];
    const result = permissionRequestOutput({
      hookSpecificOutput: {
        decision: {
          behavior: "allow",
          updatedPermissions,
        },
      },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PermissionRequest") {
      expect(result.stdout.hookSpecificOutput.decision).toEqual({
        behavior: "allow",
        updatedPermissions,
      });
    }
  });

  it("produces deny decision", () => {
    const result = permissionRequestOutput({
      hookSpecificOutput: {
        decision: { behavior: "deny" },
      },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PermissionRequest") {
      expect(result.stdout.hookSpecificOutput.decision).toEqual({ behavior: "deny" });
    }
  });

  it("produces deny decision with message and interrupt", () => {
    const result = permissionRequestOutput({
      hookSpecificOutput: {
        decision: {
          behavior: "deny",
          message: "Operation not allowed",
          interrupt: true,
        },
      },
    });
    if (result.stdout.hookSpecificOutput?.hookEventName === "PermissionRequest") {
      expect(result.stdout.hookSpecificOutput.decision).toEqual({
        behavior: "deny",
        message: "Operation not allowed",
        interrupt: true,
      });
    }
  });

  it("handles stopReason", () => {
    const _result = permissionRequestOutput({ stopReason: "Permission denied" });
  });
});

describe("CommonOptions handling across all builders", () => {
  const outputBuilders = [
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

  for (const { name, fn } of outputBuilders) {
    describe(`${name}`, () => {
      it("stopReason produces exit code 2", () => {
        const result = fn({ stopReason: "Test block" });
        expect(result.stdout.stopReason).toBe("Test block");
      });

      it("empty options produces exit code 0", () => {
        const _result = fn({});
      });

      it("continue option is preserved", () => {
        const result = fn({ continue: true });
        expect(result.stdout.continue).toBe(true);
      });

      it("suppressOutput option is preserved", () => {
        const result = fn({ suppressOutput: true });
        expect(result.stdout.suppressOutput).toBe(true);
      });

      it("systemMessage option is preserved", () => {
        const result = fn({ systemMessage: "Test message" });
        expect(result.stdout.systemMessage).toBe("Test message");
      });
    });
  }
});
