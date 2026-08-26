/**
 * Codex advisory allow-list enumeration test (plan step 3.1a).
 *
 * The runtime list in `events.ts` and the arrays below are TWO INDEPENDENT
 * TRANSCRIPTIONS of the same citation, so this test cannot pass by asserting
 * the implementation against itself. The citation is codex-hooks/README.md,
 * Fail-Open Execution section, transcribed verbatim:
 *
 * > `unexpectedError` defaults to `"error"` (the behavior above the fold),
 * > so existing hooks are unaffected. Only opt in for **advisory enrichment
 * > hooks** — ones that add optional context and whose failure should be
 * > invisible to the user (e.g. `UserPromptSubmit`, `SessionStart`,
 * > `SubagentStart` context nudges). Do not use `"continue"` for hooks that
 * > make permission, safety, or policy decisions (`PreToolUse`,
 * > `PermissionRequest`, blocking `PostToolUse`/`Stop`/`SubagentStop`
 * > checks) — silently swallowing a failure there means the hook's decision
 * > was silently skipped.
 *
 * Second independent transcription, written directly below:
 * - advisory: UserPromptSubmit, SessionStart, SubagentStart;
 * - never: PreToolUse, PermissionRequest, PostToolUse, Stop, SubagentStop;
 * - PreCompact / PostCompact: named nowhere in the README — EXCLUDED by
 *   default, fail-closed, until a future card's docs justify an entry.
 */

import { describe, expect, it } from "vitest";
import type { HookEventName } from "../../../src/agents/codex/index.js";
import {
  ADVISORY_EVENTS,
  EXCLUDED_FROM_ADVISORY,
  HOOK_EVENT_NAMES,
  permissionRequestHook,
  postCompactHook,
  postToolUseHook,
  preCompactHook,
  preToolUseHook,
  sessionStartHook,
  stopHook,
  subagentStartHook,
  subagentStopHook,
  userPromptSubmitHook,
} from "../../../src/agents/codex/index.js";

/** Second independent transcription of the README-derived lists. */
const TEST_ADVISORY: readonly string[] = ["UserPromptSubmit", "SessionStart", "SubagentStart"];
const TEST_EXCLUDED: readonly string[] = [
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
];

type AnyFactory = (config: object, handler: () => Promise<undefined>) => { eventName: string };

const noOpHandler = async (): Promise<undefined> => undefined;

const factories: Record<HookEventName, AnyFactory> = {
  PreToolUse: (config, handler) => preToolUseHook(config as Parameters<typeof preToolUseHook>[0], handler),
  PostToolUse: (config, handler) => postToolUseHook(config as Parameters<typeof postToolUseHook>[0], handler),
  PermissionRequest: (config, handler) =>
    permissionRequestHook(config as Parameters<typeof permissionRequestHook>[0], handler),
  UserPromptSubmit: (config, handler) =>
    userPromptSubmitHook(config as Parameters<typeof userPromptSubmitHook>[0], handler),
  SessionStart: (config, handler) => sessionStartHook(config as Parameters<typeof sessionStartHook>[0], handler),
  SubagentStart: (config, handler) => subagentStartHook(config as Parameters<typeof subagentStartHook>[0], handler),
  Stop: (config, handler) => stopHook(config as Parameters<typeof stopHook>[0], handler),
  SubagentStop: (config, handler) => subagentStopHook(config as Parameters<typeof subagentStopHook>[0], handler),
  PreCompact: (config, handler) => preCompactHook(config as Parameters<typeof preCompactHook>[0], handler),
  PostCompact: (config, handler) => postCompactHook(config as Parameters<typeof postCompactHook>[0], handler),
};

describe("codex advisory allow-list derivation", () => {
  it("binds all 10 events to a factory", () => {
    expect(Object.keys(factories)).toHaveLength(10);
    expect(Object.keys(factories).sort()).toEqual([...HOOK_EVENT_NAMES].sort());
  });

  it("HOOK_EVENT_NAMES holds exactly 10 unique entries", () => {
    expect(HOOK_EVENT_NAMES).toHaveLength(10);
    expect(new Set(HOOK_EVENT_NAMES).size).toBe(10);
  });

  it("EXCLUDED_FROM_ADVISORY equals the second transcription of the README-derived set", () => {
    expect([...EXCLUDED_FROM_ADVISORY]).toEqual(TEST_EXCLUDED);
  });

  it("ADVISORY_EVENTS equals exactly the three README-named enrichment hooks", () => {
    expect([...ADVISORY_EVENTS]).toEqual(TEST_ADVISORY);
  });

  it("PreCompact and PostCompact are explicitly fail-closed by default", () => {
    for (const event of ["PreCompact", "PostCompact"] as const) {
      expect(TEST_EXCLUDED).toContain(event);
      expect(() => factories[event]({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
        new RegExp(`Policy gate rejected "${event}"`),
      );
    }
  });
});

describe("runtime rejection of unexpectedError: 'continue' outside the allow-list", () => {
  for (const [event, factory] of Object.entries(factories) as Array<[HookEventName, AnyFactory]>) {
    const excluded = TEST_EXCLUDED.includes(event);
    it(`${event}: ${excluded ? "rejects" : "accepts"} unexpectedError: "continue" at factory-call time`, () => {
      const continueConfig: object = { unexpectedError: "continue" };
      if (excluded) {
        expect(() => factory(continueConfig, noOpHandler)).toThrowError(new RegExp(`Policy gate rejected "${event}"`));
      } else {
        const hook = factory(continueConfig, noOpHandler);
        expect(hook.eventName).toBe(event);
      }
    });
  }
});

describe("compile-time rejection of unexpectedError: 'continue' outside the allow-list", () => {
  it("excluded events do not accept 'continue' in their config types", () => {
    // Each call must remain a TYPE error (validated by yarn typecheck via
    // these markers) AND a runtime throw (asserted).
    // @ts-expect-error PreToolUse excludes the continue policy
    expect(() => preToolUseHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "PreToolUse"',
    );
    // @ts-expect-error PostToolUse excludes the continue policy
    expect(() => postToolUseHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "PostToolUse"',
    );
    // @ts-expect-error PermissionRequest excludes the continue policy
    expect(() => permissionRequestHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "PermissionRequest"',
    );
    // @ts-expect-error Stop excludes the continue policy
    expect(() => stopHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError('Policy gate rejected "Stop"');
    // @ts-expect-error SubagentStop excludes the continue policy
    expect(() => subagentStopHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "SubagentStop"',
    );
    // @ts-expect-error PreCompact is excluded by default pending doc clarification
    expect(() => preCompactHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "PreCompact"',
    );
    // @ts-expect-error PostCompact is excluded by default pending doc clarification
    expect(() => postCompactHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "PostCompact"',
    );
  });

  it("advisory events keep accepting both policy values at compile time", () => {
    const advisory = userPromptSubmitHook({ unexpectedError: "continue" }, noOpHandler);
    const failing = stopHook({ unexpectedError: "error" }, noOpHandler);
    expect(advisory.unexpectedError).toBe("continue");
    expect(failing.unexpectedError).toBe("error");
  });
});
