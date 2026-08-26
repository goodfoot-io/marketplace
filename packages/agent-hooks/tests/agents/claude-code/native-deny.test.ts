/**
 * Native-deny table for `PreToolUse` and `PermissionRequest` (plan step 2.2,
 * second table): both events are forced-exclusion — never advisory — but a
 * thrown `HookBlockError` reaches their handlers regardless of policy
 * (`drive()` classifies it before consulting policy). The translation must
 * therefore produce each event's *native* deny shape — a tool-scoped refusal,
 * distinct from `{ continue: false }`, which halts the whole session — never
 * the session-scoped fallback.
 */

import { describe, expect, it } from "vitest";
import { createClaudeCodeTransport } from "../../../src/agents/claude-code/transport.js";
import { HookBlockError } from "../../../src/core/transport.js";

const REASON = "blocked: writes outside workspace";

describe("PreToolUse: thrown HookBlockError produces the native permissionDecision deny", () => {
  it("under the default 'error' policy", () => {
    const transport = createClaudeCodeTransport("PreToolUse", "error");
    const result = transport.finalize({ kind: "block", error: new HookBlockError(REASON) });
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout ?? "") as {
      continue?: boolean;
      stopReason?: string;
      hookSpecificOutput?: { hookEventName?: string; permissionDecision?: string; permissionDecisionReason?: string };
    };
    expect(payload.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
    expect(payload.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(payload.hookSpecificOutput?.permissionDecisionReason).toBe(REASON);
    expect("continue" in payload).toBe(false);
    expect("stopReason" in payload).toBe(false);
  });

  it("identically under the (rejected-at-factory-time) 'continue' policy", () => {
    const transport = createClaudeCodeTransport("PreToolUse", "continue");
    const result = transport.finalize({ kind: "block", error: new HookBlockError(REASON) });
    const payload = JSON.parse(result.stdout ?? "") as { hookSpecificOutput?: { permissionDecision?: string } };
    expect(payload.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  it("merges extra fields from the error for callers that need them", () => {
    const transport = createClaudeCodeTransport("PreToolUse", "error");
    const result = transport.finalize({
      kind: "block",
      error: new HookBlockError(REASON, { systemMessage: "ask a human" }),
    });
    const payload = JSON.parse(result.stdout ?? "") as Record<string, unknown>;
    expect(payload.systemMessage).toBe("ask a human");
    expect((payload.hookSpecificOutput as Record<string, unknown>)?.permissionDecision).toBe("deny");
  });
});

describe("PermissionRequest: thrown HookBlockError produces the native decision deny", () => {
  it("under the default 'error' policy", () => {
    const transport = createClaudeCodeTransport("PermissionRequest", "error");
    const result = transport.finalize({ kind: "block", error: new HookBlockError(REASON) });
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout ?? "") as {
      continue?: boolean;
      stopReason?: string;
      hookSpecificOutput?: { hookEventName?: string; decision?: { behavior?: string; message?: string } };
    };
    expect(payload.hookSpecificOutput?.hookEventName).toBe("PermissionRequest");
    expect(payload.hookSpecificOutput?.decision?.behavior).toBe("deny");
    expect(payload.hookSpecificOutput?.decision?.message).toBe(REASON);
    expect("continue" in payload).toBe(false);
    expect("stopReason" in payload).toBe(false);
  });

  it("carries extra fields from error.fields at the payload top level per the contract shape", () => {
    const transport = createClaudeCodeTransport("PermissionRequest", "error");
    const result = transport.finalize({
      kind: "block",
      error: new HookBlockError(REASON, { interrupt: true }),
    });
    const payload = JSON.parse(result.stdout ?? "") as {
      interrupt?: boolean;
      hookSpecificOutput?: { decision?: Record<string, unknown> };
    };
    expect(payload.hookSpecificOutput?.decision?.behavior).toBe("deny");
    expect(payload.interrupt).toBe(true);
  });
});
