/**
 * Factory-surface test (plan step 2.5): the barrel exports exactly the 30
 * named hook factories derived from the source package — hardcoded here by
 * name, not by count alone, so a port that lands 26 of 30 fails even though
 * no single test file is "missing". Includes `postToolBatchHook`, which the
 * source package defined but never re-exported (pre-existing bug fixed by
 * this port per the plan's Decisions entry).
 */

import { describe, expect, it } from "vitest";
import * as surface from "../../../src/agents/claude-code/index.js";
import {
  configChangeHook,
  cwdChangedHook,
  elicitationHook,
  elicitationResultHook,
  fileChangedHook,
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

/**
 * The 30 factory names, enumerated directly from
 * `grep -oE "^export (const|function) [a-zA-Z]+Hook\b" claude-code-hooks/src/hooks.ts`
 * (overload declarations deduplicated).
 */
const EXPECTED_FACTORIES = [
  "configChangeHook",
  "cwdChangedHook",
  "elicitationHook",
  "elicitationResultHook",
  "fileChangedHook",
  "instructionsLoadedHook",
  "messageDisplayHook",
  "notificationHook",
  "permissionDeniedHook",
  "permissionRequestHook",
  "postCompactHook",
  "postToolBatchHook",
  "postToolUseFailureHook",
  "postToolUseHook",
  "preCompactHook",
  "preToolUseHook",
  "sessionEndHook",
  "sessionStartHook",
  "setupHook",
  "stopFailureHook",
  "stopHook",
  "subagentStartHook",
  "subagentStopHook",
  "taskCompletedHook",
  "taskCreatedHook",
  "teammateIdleHook",
  "userPromptExpansionHook",
  "userPromptSubmitHook",
  "worktreeCreateHook",
  "worktreeRemoveHook",
] as const;

/** Each expected factory bound by its exact export name. */
const FACTORIES_BY_NAME = {
  configChangeHook,
  cwdChangedHook,
  elicitationHook,
  elicitationResultHook,
  fileChangedHook,
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
} as const;

describe("factory surface", () => {
  it("binds all 30 expected factory names, each to a function", () => {
    expect(Object.keys(FACTORIES_BY_NAME).sort()).toEqual([...EXPECTED_FACTORIES].sort());
    for (const [name, factory] of Object.entries(FACTORIES_BY_NAME)) {
      expect(factory, `missing or non-function factory: ${name}`).toBeTypeOf("function");
    }
    expect(EXPECTED_FACTORIES).toHaveLength(30);
  });

  it("exports no factory beyond the expected 30", () => {
    const exportedFactoryNames = Object.keys(surface)
      .filter((key) => key.endsWith("Hook"))
      .sort();
    expect(exportedFactoryNames).toEqual([...EXPECTED_FACTORIES].sort());
  });

  it("binds each factory to its own event name", () => {
    const hook = postToolBatchHook({}, async () => null);
    expect(hook.eventName).toBe("PostToolBatch");
    expect(hook.eventName).toBeDefined();
  });
});
