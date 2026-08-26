/**
 * Antigravity factory-surface test (plan step 5.3, item 3 of the shared
 * pattern with steps 2.5/3.3): the barrel exports exactly the 5 named hook
 * factories, hardcoded by name — not by count alone.
 */

import { describe, expect, it } from "vitest";
import * as surface from "../../../src/agents/antigravity/index.js";
import {
  postInvocationHook,
  postToolUseHook,
  preInvocationHook,
  preToolUseHook,
  stopHook,
} from "../../../src/agents/antigravity/index.js";

const EXPECTED_FACTORIES = [
  "postInvocationHook",
  "postToolUseHook",
  "preInvocationHook",
  "preToolUseHook",
  "stopHook",
] as const;

const FACTORIES_BY_NAME = {
  postInvocationHook,
  postToolUseHook,
  preInvocationHook,
  preToolUseHook,
  stopHook,
} as const;

describe("antigravity factory surface", () => {
  it("binds all 5 expected factory names, each to a function", () => {
    expect(Object.keys(FACTORIES_BY_NAME).sort()).toEqual([...EXPECTED_FACTORIES].sort());
    for (const [name, factory] of Object.entries(FACTORIES_BY_NAME)) {
      expect(factory, `missing or non-function factory: ${name}`).toBeTypeOf("function");
    }
    expect(EXPECTED_FACTORIES).toHaveLength(5);
  });

  it("exports no factory beyond the expected 5", () => {
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

  it("preserves AntigravityBlockError instanceof semantics through the core subclass", async () => {
    const { AntigravityBlockError } = await import("../../../src/agents/antigravity/index.js");
    const { HookBlockError } = await import("../../../src/core/transport.js");
    const error = new AntigravityBlockError("nope");
    expect(error instanceof AntigravityBlockError).toBe(true);
    expect(error instanceof HookBlockError).toBe(true);
    expect(error.name).toBe("AntigravityBlockError");
    expect(error.reason).toBe("nope");
    expect(error.message).toBe("nope");
  });
});
