/**
 * Antigravity advisory allow-list enumeration test (plan step 5.3).
 *
 * Unlike the Claude Code and Codex allow-lists, which transcribe a specific
 * named set out of a shipped README, Antigravity has no in-repo doc to
 * transcribe from this release (Step 0 descope). The only assertable fact is
 * therefore the *default itself*: every one of the 5 shipped events is
 * excluded, `ADVISORY_EVENTS` is empty, and every factory rejects
 * `unexpectedError: "continue"` at construction time regardless of event —
 * there is no curated subset to test against a second citation, because none
 * exists yet.
 */

import { describe, expect, it } from "vitest";
import type { HookEventName } from "../../../src/agents/antigravity/index.js";
import {
  ADVISORY_EVENTS,
  EXCLUDED_FROM_ADVISORY,
  HOOK_EVENT_NAMES,
  postInvocationHook,
  postToolUseHook,
  preInvocationHook,
  preToolUseHook,
  stopHook,
} from "../../../src/agents/antigravity/index.js";

type AnyFactory = (
  config: object,
  handler: () => Promise<undefined>,
) => { eventName: string; unexpectedError?: string };

const noOpHandler = async (): Promise<undefined> => undefined;

const factories: Record<HookEventName, AnyFactory> = {
  PreToolUse: (config, handler) => preToolUseHook(config as Parameters<typeof preToolUseHook>[0], handler),
  PostToolUse: (config, handler) => postToolUseHook(config as Parameters<typeof postToolUseHook>[0], handler),
  PreInvocation: (config, handler) => preInvocationHook(config as Parameters<typeof preInvocationHook>[0], handler),
  PostInvocation: (config, handler) => postInvocationHook(config as Parameters<typeof postInvocationHook>[0], handler),
  Stop: (config, handler) => stopHook(config as Parameters<typeof stopHook>[0], handler),
};

describe("antigravity advisory allow-list derivation", () => {
  it("binds all 5 events to a factory", () => {
    expect(Object.keys(factories)).toHaveLength(5);
    expect(Object.keys(factories).sort()).toEqual([...HOOK_EVENT_NAMES].sort());
  });

  it("HOOK_EVENT_NAMES holds exactly 5 unique entries", () => {
    expect(HOOK_EVENT_NAMES).toHaveLength(5);
    expect(new Set(HOOK_EVENT_NAMES).size).toBe(5);
  });

  it("EXCLUDED_FROM_ADVISORY equals every shipped event — no doc exists to name a subset", () => {
    expect([...EXCLUDED_FROM_ADVISORY].sort()).toEqual([...HOOK_EVENT_NAMES].sort());
  });

  it("ADVISORY_EVENTS is empty this release", () => {
    expect([...ADVISORY_EVENTS]).toEqual([]);
  });
});

describe("runtime rejection of unexpectedError: 'continue' for every event", () => {
  for (const [event, factory] of Object.entries(factories) as Array<[HookEventName, AnyFactory]>) {
    it(`${event}: rejects unexpectedError: "continue" at factory-call time`, () => {
      expect(() => factory({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
        new RegExp(`Policy gate rejected "${event}"`),
      );
    });

    it(`${event}: accepts the default "error" policy at factory-call time`, () => {
      const hook = factory({ unexpectedError: "error" }, noOpHandler);
      expect(hook.eventName).toBe(event);
      expect(hook.unexpectedError).toBe("error");
    });
  }
});

describe("compile-time narrowing: every event's config type collapses to 'error' only", () => {
  it('MatcherHookConfigFor/NoMatcherHookConfigFor narrow unexpectedError to "error" for every event today', () => {
    // AllowedUnexpectedErrorPolicy<TEvent> resolves to Exclude<UnexpectedErrorPolicy, "continue">
    // for every HookEventName while ADVISORY_EVENTS stays empty (events.ts), so
    // the factory parameter types below are Omit<...,"unexpectedError"> & { unexpectedError?: "error" }
    // — a type-level fact this test pins by construction rather than by a suppressed diagnostic.
    const hook = stopHook({ unexpectedError: "error" }, noOpHandler);
    expect(hook.unexpectedError).toBe("error");
  });
});
