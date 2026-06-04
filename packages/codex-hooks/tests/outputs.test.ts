import { describe, expect, it } from "vitest";
import {
  permissionRequestOutput,
  postCompactOutput,
  postToolUseOutput,
  preCompactOutput,
  preToolUseLegacyBlockOutput,
  preToolUseOutput,
  sessionStartOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  userPromptSubmitOutput,
} from "../src/outputs.js";

describe("output builders", () => {
  it("builds a conservative pre-tool-use permission deny payload", () => {
    expect(
      preToolUseOutput({
        systemMessage: "Denied",
        permissionDecision: "deny",
        permissionDecisionReason: "No destructive shell commands.",
      }).stdout,
    ).toEqual({
      systemMessage: "Denied",
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "No destructive shell commands.",
      },
    });
  });

  it("supports permissionDecision allow with updatedInput and additionalContext", () => {
    expect(
      preToolUseOutput({
        permissionDecision: "allow",
        permissionDecisionReason: "Looks safe",
        updatedInput: { command: "ls -la" },
        additionalContext: "Rewrote command to be less broad",
      }).stdout,
    ).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: "Looks safe",
        updatedInput: { command: "ls -la" },
        additionalContext: "Rewrote command to be less broad",
      },
    });
  });

  it("supports permissionDecision ask", () => {
    expect(
      preToolUseOutput({
        permissionDecision: "ask",
        permissionDecisionReason: "Need confirmation",
      }).stdout,
    ).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "Need confirmation",
      },
    });
  });

  it("supports the legacy pre-tool-use block helper", () => {
    expect(preToolUseLegacyBlockOutput({ decision: "block", reason: "Stop" }).stdout).toEqual({
      decision: "block",
      reason: "Stop",
    });
  });

  it("maps plain context-injecting outputs to hookSpecificOutput", () => {
    expect(sessionStartOutput({ additionalContext: "Hello" }).stdout).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "Hello",
      },
    });

    expect(userPromptSubmitOutput({ additionalContext: "Prompt context" }).stdout).toEqual({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "Prompt context",
      },
    });
  });

  it("builds stop and post-tool-use block payloads", () => {
    expect(stopOutput({ decision: "block", reason: "Stop requested" }).stdout).toEqual({
      decision: "block",
      reason: "Stop requested",
    });

    expect(postToolUseOutput({ decision: "block", reason: "Bad output" }).stdout).toEqual({
      decision: "block",
      reason: "Bad output",
    });
  });

  it("post-tool-use can emit updatedMCPToolOutput", () => {
    expect(
      postToolUseOutput({
        updatedMCPToolOutput: { content: [{ type: "text", text: "rewritten" }] },
      }).stdout,
    ).toEqual({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        updatedMCPToolOutput: { content: [{ type: "text", text: "rewritten" }] },
      },
    });
  });

  it("permissionRequest emits a minimal allow decision by default", () => {
    expect(permissionRequestOutput({ behavior: "allow" }).stdout).toEqual({
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: { behavior: "allow" },
      },
    });
  });

  it("permissionRequest only emits reserved fields when set", () => {
    expect(
      permissionRequestOutput({
        behavior: "deny",
        message: "Not allowed",
        interrupt: true,
        updatedInput: { command: "ls" },
        updatedPermissions: { something: true },
      }).stdout,
    ).toEqual({
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: {
          behavior: "deny",
          message: "Not allowed",
          interrupt: true,
          updatedInput: { command: "ls" },
          updatedPermissions: { something: true },
        },
      },
    });
  });

  it("subagentStartOutput maps additionalContext", () => {
    expect(subagentStartOutput({ additionalContext: "Booting agent" }).stdout).toEqual({
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: "Booting agent",
      },
    });
  });

  it("subagentStopOutput emits block payload", () => {
    expect(subagentStopOutput({ decision: "block", reason: "No output" }).stdout).toEqual({
      decision: "block",
      reason: "No output",
    });
  });

  it("preCompactOutput emits universal fields only", () => {
    expect(preCompactOutput({ systemMessage: "compacting" }).stdout).toEqual({
      systemMessage: "compacting",
    });
  });

  it("postCompactOutput emits universal fields only", () => {
    expect(postCompactOutput({ continue: false, stopReason: "done" }).stdout).toEqual({
      continue: false,
      stopReason: "done",
    });
  });
});
