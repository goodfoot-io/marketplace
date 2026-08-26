/**
 * Advisory allow-list enumeration test (plan step 2.2).
 *
 * The runtime list in `events.ts` and the exclusion array below are TWO
 * INDEPENDENT TRANSCRIPTIONS of the same citation, so this test cannot pass
 * by asserting the implementation against itself. The citation is CARD.md:75
 * (Acceptance Signals, fail-open allow-list bullet), quoted verbatim:
 *
 * > `unexpectedError: "continue"` is rejected at the type level and at
 * > runtime for any event not on that agent's advisory list (never
 * > `PreToolUse`, `PermissionRequest`, blocking `Stop`/`SubagentStop`,
 * > `WorktreeCreate`/`WorktreeRemove` on Claude Code; never
 * > permission/blocking events on Codex; Antigravity list derived from its
 * > docs).
 *
 * The Claude Code clause — "never `PreToolUse`, `PermissionRequest`, blocking
 * `Stop`/`SubagentStop`, `WorktreeCreate`/`WorktreeRemove` on Claude Code" —
 * is transcribed a second time as TEST_EXCLUDED below. A reader can diff the
 * array against the quotation by eye without re-opening CARD.md.
 */

import { describe, expect, it } from "vitest";
import type { HookEventName } from "../../../src/agents/claude-code/index.js";
import {
  ADVISORY_EVENTS,
  configChangeHook,
  cwdChangedHook,
  EXCLUDED_FROM_ADVISORY,
  elicitationHook,
  elicitationResultHook,
  fileChangedHook,
  HOOK_EVENT_NAMES,
  instructionsLoadedHook,
  messageDisplayHook,
  notificationHook,
  permissionDeniedHook,
  permissionRequestHook,
  postCompactHook,
  postToolBatchHook,
  postToolUseFailureHook,
  postToolUseHook,
  preCompactHook,
  preToolUseHook,
  sessionEndHook,
  sessionStartHook,
  setupHook,
  stopFailureHook,
  stopHook,
  subagentStartHook,
  subagentStopHook,
  taskCompletedHook,
  taskCreatedHook,
  teammateIdleHook,
  userPromptExpansionHook,
  userPromptSubmitHook,
  worktreeCreateHook,
  worktreeRemoveHook,
} from "../../../src/agents/claude-code/index.js";
import type { HookConfig } from "../../../src/core/types.js";

/** Second independent transcription of the CARD.md:75 exclusion set. */
const TEST_EXCLUDED: readonly string[] = [
  "PreToolUse",
  "PermissionRequest",
  "Stop",
  "SubagentStop",
  "WorktreeCreate",
  "WorktreeRemove",
];

const noOpHandler = async () => null;

/**
 * Event-to-factory binding for all 30 events, name by name. The config
 * parameter is deliberately widened to `object` here — this table exists to
 * exercise the RUNTIME gate, including configurations the compile-time
 * narrowing rejects; each entry narrows back to its own factory's accepted
 * config shape via `Parameters<typeof factory>[0]` (which resolves to the
 * plain-config overload for the typed-overload factories).
 */
type AnyFactory = (config: object, handler: typeof noOpHandler) => { eventName: string };

const factories: Record<HookEventName, AnyFactory> = {
  PreToolUse: (config, handler) => preToolUseHook(config as Parameters<typeof preToolUseHook>[0], handler),
  PostToolUse: (config, handler) => postToolUseHook(config as Parameters<typeof postToolUseHook>[0], handler),
  PostToolUseFailure: (config, handler) =>
    postToolUseFailureHook(config as Parameters<typeof postToolUseFailureHook>[0], handler),
  PostToolBatch: (config, handler) => postToolBatchHook(config as HookConfig, handler),
  Notification: (config, handler) => notificationHook(config as HookConfig, handler),
  UserPromptExpansion: (config, handler) => userPromptExpansionHook(config as HookConfig, handler),
  UserPromptSubmit: (config, handler) => userPromptSubmitHook(config as HookConfig, handler),
  SessionStart: (config, handler) => sessionStartHook(config as HookConfig, handler),
  SessionEnd: (config, handler) => sessionEndHook(config as HookConfig, handler),
  Stop: (config, handler) => stopHook(config as Parameters<typeof stopHook>[0], handler),
  StopFailure: (config, handler) => stopFailureHook(config as HookConfig, handler),
  SubagentStart: (config, handler) => subagentStartHook(config as HookConfig, handler),
  SubagentStop: (config, handler) => subagentStopHook(config as Parameters<typeof subagentStopHook>[0], handler),
  PreCompact: (config, handler) => preCompactHook(config as HookConfig, handler),
  PostCompact: (config, handler) => postCompactHook(config as HookConfig, handler),
  PermissionRequest: (config, handler) =>
    permissionRequestHook(config as Parameters<typeof permissionRequestHook>[0], handler),
  PermissionDenied: (config, handler) => permissionDeniedHook(config as HookConfig, handler),
  Setup: (config, handler) => setupHook(config as HookConfig, handler),
  TeammateIdle: (config, handler) => teammateIdleHook(config as HookConfig, handler),
  TaskCreated: (config, handler) => taskCreatedHook(config as HookConfig, handler),
  TaskCompleted: (config, handler) => taskCompletedHook(config as HookConfig, handler),
  Elicitation: (config, handler) => elicitationHook(config as HookConfig, handler),
  ElicitationResult: (config, handler) => elicitationResultHook(config as HookConfig, handler),
  ConfigChange: (config, handler) => configChangeHook(config as HookConfig, handler),
  InstructionsLoaded: (config, handler) => instructionsLoadedHook(config as HookConfig, handler),
  WorktreeCreate: (config, handler) => worktreeCreateHook(config as Parameters<typeof worktreeCreateHook>[0], handler),
  WorktreeRemove: (config, handler) => worktreeRemoveHook(config as Parameters<typeof worktreeRemoveHook>[0], handler),
  CwdChanged: (config, handler) => cwdChangedHook(config as HookConfig, handler),
  FileChanged: (config, handler) => fileChangedHook(config as HookConfig, handler),
  MessageDisplay: (config, handler) => messageDisplayHook(config as HookConfig, handler),
};

describe("advisory allow-list derivation", () => {
  it("binds all 30 events to a factory", () => {
    expect(Object.keys(factories)).toHaveLength(30);
    expect(Object.keys(factories).sort()).toEqual([...HOOK_EVENT_NAMES].sort());
  });

  it("HOOK_EVENT_NAMES holds exactly 30 unique entries", () => {
    expect(HOOK_EVENT_NAMES).toHaveLength(30);
    expect(new Set(HOOK_EVENT_NAMES).size).toBe(30);
  });

  it("EXCLUDED_FROM_ADVISORY equals the second transcription of the CARD.md:75 set", () => {
    expect([...EXCLUDED_FROM_ADVISORY]).toEqual(TEST_EXCLUDED);
  });

  it("ADVISORY_EVENTS equals all 30 events minus the test-transcribed exclusions", () => {
    const expectedAdvisory = HOOK_EVENT_NAMES.filter((eventName) => !TEST_EXCLUDED.includes(eventName));
    expect(expectedAdvisory).toHaveLength(24);
    expect([...ADVISORY_EVENTS]).toEqual(expectedAdvisory);
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

    it(`${event}: still accepts undefined and "error" policies`, () => {
      expect(() => factory({}, noOpHandler)).not.toThrow();
      const hook = factory({ unexpectedError: "error" }, noOpHandler);
      expect(hook.eventName).toBe(event);
    });
  }
});

describe("compile-time rejection of unexpectedError: 'continue' outside the allow-list", () => {
  it('excluded events do not accept "continue" in their config types', () => {
    // Each call below must remain a TYPE error (validated by yarn typecheck
    // via the expect-error markers) AND a runtime throw (asserted here), so
    // JS callers and type-loopholes both fail closed.
    // @ts-expect-error PreToolUse excludes the continue policy
    expect(() => preToolUseHook({ matcher: "Bash", unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "PreToolUse"',
    );
    // @ts-expect-error PermissionRequest excludes the continue policy
    expect(() => permissionRequestHook({ matcher: "Read", unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "PermissionRequest"',
    );
    // @ts-expect-error Stop excludes the continue policy
    expect(() => stopHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError('Policy gate rejected "Stop"');
    // @ts-expect-error SubagentStop excludes the continue policy
    expect(() => subagentStopHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "SubagentStop"',
    );
    // @ts-expect-error WorktreeCreate excludes the continue policy
    expect(() => worktreeCreateHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "WorktreeCreate"',
    );
    // @ts-expect-error WorktreeRemove excludes the continue policy
    expect(() => worktreeRemoveHook({ unexpectedError: "continue" }, noOpHandler)).toThrowError(
      'Policy gate rejected "WorktreeRemove"',
    );
  });

  it("advisory events keep accepting both policy values at compile time", () => {
    const advisory = userPromptSubmitHook({ unexpectedError: "continue" }, noOpHandler);
    const failing = stopHook({ unexpectedError: "error" }, noOpHandler);
    expect(advisory.unexpectedError).toBe("continue");
    expect(failing.unexpectedError).toBe("error");
  });

  it("typed single-tool overload narrows the policy identically for excluded events", () => {
    // @ts-expect-error typed overload rejects continue for PreToolUse too
    const makeBadHook = () => preToolUseHook({ matcher: "Write", unexpectedError: "continue" }, async () => null);
    expect(makeBadHook).toThrowError('Policy gate rejected "PreToolUse"');
    const ok = preToolUseHook({ matcher: "Write" }, async (input) => {
      expect(input.tool_input).toBeDefined();
      return null;
    });
    expect(ok.matcher).toBe("Write");
  });
});
