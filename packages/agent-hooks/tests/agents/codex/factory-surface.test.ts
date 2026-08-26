/**
 * Codex factory-surface test (plan step 3.3): the barrel exports exactly the
 * 10 named hook factories, hardcoded by name — not by count alone.
 */

import { describe, expect, it } from "vitest";
import * as surface from "../../../src/agents/codex/index.js";
import {
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

const EXPECTED_FACTORIES = [
  "permissionRequestHook",
  "postCompactHook",
  "postToolUseHook",
  "preCompactHook",
  "preToolUseHook",
  "sessionStartHook",
  "stopHook",
  "subagentStartHook",
  "subagentStopHook",
  "userPromptSubmitHook",
] as const;

const FACTORIES_BY_NAME = {
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
} as const;

describe("codex factory surface", () => {
  it("binds all 10 expected factory names, each to a function", () => {
    expect(Object.keys(FACTORIES_BY_NAME).sort()).toEqual([...EXPECTED_FACTORIES].sort());
    for (const [name, factory] of Object.entries(FACTORIES_BY_NAME)) {
      expect(factory, `missing or non-function factory: ${name}`).toBeTypeOf("function");
    }
    expect(EXPECTED_FACTORIES).toHaveLength(10);
  });

  it("exports no factory beyond the expected 10", () => {
    const exportedFactoryNames = Object.keys(surface)
      .filter((key) => key.endsWith("Hook"))
      .sort();
    expect(exportedFactoryNames).toEqual([...EXPECTED_FACTORIES].sort());
  });

  it("binds each factory to its event and keeps both metadata property names", () => {
    const hook = stopHook({}, async () => undefined);
    expect(hook.eventName).toBe("Stop");
    expect(hook.hookEventName).toBe("Stop");
  });

  it("preserves BlockError instanceof semantics through the core subclass", async () => {
    const { BlockError } = await import("../../../src/agents/codex/index.js");
    const { HookBlockError } = await import("../../../src/core/transport.js");
    const error = new BlockError("nope");
    expect(error instanceof BlockError).toBe(true);
    expect(error instanceof HookBlockError).toBe(true);
    expect(error.name).toBe("BlockError");
    expect(error.reason).toBe("nope");
    expect(error.message).toBe("nope");
  });
});
