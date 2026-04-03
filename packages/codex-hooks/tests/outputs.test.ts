import { describe, expect, it } from "vitest";
import {
  postToolUseOutput,
  preToolUseLegacyBlockOutput,
  preToolUseOutput,
  sessionStartOutput,
  stopOutput,
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
});
