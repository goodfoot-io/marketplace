import { describe, expect, expectTypeOf, it } from "vitest";
import { validateHookConfig } from "../../../src/agents/cursor/config.js";
import type { HookConfigFor, PostToolUseInput, SessionStartInput } from "../../../src/agents/cursor/index.js";
import {
  ADVISORY_EVENTS,
  beforeSubmitPromptHook,
  beforeSubmitPromptOutput,
  CursorBlockError,
  createCursorTransport,
  HOOK_EVENT_NAMES,
  postToolUseHook,
  postToolUseOutput,
  preToolUseHook,
  preToolUseOutput,
  sessionStartHook,
  sessionStartOutput,
  stopHook,
  stopOutput,
  subagentStopHook,
  subagentStopOutput,
} from "../../../src/agents/cursor/index.js";

describe("Cursor's event-specific public surface", () => {
  it("exports exactly the six implemented native events", () => {
    expect(HOOK_EVENT_NAMES).toEqual([
      "sessionStart",
      "preToolUse",
      "postToolUse",
      "beforeSubmitPrompt",
      "stop",
      "subagentStop",
    ]);
    expect(ADVISORY_EVENTS).toEqual(["sessionStart", "postToolUse"]);
    for (const hook of [
      sessionStartHook({}, () => undefined),
      preToolUseHook({}, () => undefined),
      postToolUseHook({}, () => undefined),
      beforeSubmitPromptHook({}, () => undefined),
      stopHook({}, () => undefined),
      subagentStopHook({}, () => undefined),
    ]) {
      expect(hook.eventName).toBe(hook.hookEventName);
      expect(HOOK_EVENT_NAMES).toContain(hook.hookEventName);
    }
  });

  it("preserves type-safe inputs and rejects capabilities absent from the host contract", () => {
    sessionStartHook({}, (input) => {
      expectTypeOf(input).toEqualTypeOf<SessionStartInput>();
      return undefined;
    });
    postToolUseHook({}, (input) => {
      expectTypeOf(input).toEqualTypeOf<PostToolUseInput>();
      expectTypeOf(input.tool_output).toEqualTypeOf<string>();
      return undefined;
    });
    expectTypeOf<HookConfigFor<"sessionStart">["matcher"]>().toEqualTypeOf<undefined>();
    expectTypeOf<HookConfigFor<"postToolUse">["failClosed"]>().toEqualTypeOf<undefined>();
    expectTypeOf<HookConfigFor<"preToolUse">["unexpectedError"]>().toEqualTypeOf<"error" | undefined>();
    expectTypeOf<HookConfigFor<"stop">["loopLimit"]>().toEqualTypeOf<number | null | undefined>();
    // These are deliberately compile-only checks: tsc must reject cross-event replies.
    if (false as boolean) {
      // @ts-expect-error stop replies cannot be returned by a sessionStart hook
      sessionStartHook({}, () => stopOutput());
      // @ts-expect-error prompt submission cannot inject additional context
      beforeSubmitPromptOutput({ additionalContext: "not supported" });
      // @ts-expect-error ask is not enforced by Cursor
      preToolUseOutput({ permission: "ask" });
      // @ts-expect-error permission hooks may not swallow unexpected failures
      preToolUseHook({ unexpectedError: "continue" }, () => undefined);
    }
  });

  it("translates builder options to exact native JSON without extra envelopes", () => {
    expect(sessionStartOutput({ env: { MODE: "test" }, additionalContext: "context" })).toEqual({
      _type: "sessionStart",
      stdout: { env: { MODE: "test" }, additional_context: "context" },
    });
    expect(postToolUseOutput({ updatedMcpToolOutput: { result: 1 }, additionalContext: "checked" }).stdout).toEqual({
      updated_mcp_tool_output: { result: 1 },
      additional_context: "checked",
    });
    expect(
      preToolUseOutput({
        permission: "deny",
        userMessage: "no",
        agentMessage: "reason",
        updatedInput: { command: "echo safe" },
      }).stdout,
    ).toEqual({
      permission: "deny",
      user_message: "no",
      agent_message: "reason",
      updated_input: { command: "echo safe" },
    });
    expect(beforeSubmitPromptOutput({ continue: false, userMessage: "no" }).stdout).toEqual({
      continue: false,
      user_message: "no",
    });
    expect(stopOutput({ followupMessage: "finish" }).stdout).toEqual({ followup_message: "finish" });
    expect(subagentStopOutput({ followupMessage: "finish" }).stdout).toEqual({ followup_message: "finish" });
    expect(sessionStartOutput().stdout).toEqual({});
    expect(postToolUseOutput().stdout).toEqual({});
    expect(preToolUseOutput().stdout).toEqual({ permission: "allow" });
    expect(beforeSubmitPromptOutput().stdout).toEqual({ continue: true });
    expect(stopOutput().stdout).toEqual({});
  });

  it("defaults permission hooks to failClosed but preserves an explicit false", () => {
    const permissionHook = preToolUseHook({ timeout: 4500 }, () => undefined);
    expect(permissionHook.failClosed).toBe(true);
    expect(permissionHook.timeout).toBe(4500);
    expect(beforeSubmitPromptHook({}, () => undefined).failClosed).toBe(true);
    expect(preToolUseHook({ failClosed: false }, () => undefined).failClosed).toBe(false);
    expect(sessionStartHook({}, () => undefined).failClosed).toBeUndefined();
    expect(stopHook({ loopLimit: null }, () => undefined).loopLimit).toBeNull();
  });

  it.each([
    ["sessionStart", { matcher: "startup" }],
    ["sessionStart", { failClosed: true }],
    ["postToolUse", { loopLimit: 3 }],
    ["preToolUse", { unexpectedError: "continue" }],
    ["beforeSubmitPrompt", { unexpectedError: "continue" }],
    ["stop", { unexpectedError: "continue" }],
    ["subagentStop", { unexpectedError: "continue" }],
    ["preToolUse", { timeout: 0 }],
    ["preToolUse", { timeout: -100 }],
    ["preToolUse", { timeout: Infinity }],
    ["stop", { loopLimit: -1 }],
    ["stop", { loopLimit: 1.5 }],
  ] as const)("rejects unsupported %s config %j at runtime too", (event, config) => {
    expect(() => validateHookConfig(event, config)).toThrow();
  });

  it("rejects ask even when JavaScript bypasses the type checker", () => {
    expect(() => preToolUseOutput({ permission: "ask" } as never)).toThrow(/allow or deny/);
  });

  it("translates intentional blocks into event-native permission outputs", () => {
    const outcome = { kind: "block", error: new CursorBlockError("blocked") } as const;
    expect(createCursorTransport("preToolUse").finalize(outcome)).toEqual({
      stdout: JSON.stringify({ permission: "deny", user_message: "blocked", agent_message: "blocked" }),
      exitCode: 0,
    });
    expect(createCursorTransport("beforeSubmitPrompt").finalize(outcome)).toEqual({
      stdout: JSON.stringify({ continue: false, user_message: "blocked" }),
      exitCode: 0,
    });
    expect(createCursorTransport("postToolUse").finalize(outcome)).toEqual({ stderr: "blocked\n", exitCode: 2 });
  });
});
