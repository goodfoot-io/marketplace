/**
 * OpenCode factory-surface test: the barrel exports exactly the expected
 * runtime values, hardcoded by name — not by count alone. Mirrors
 * `tests/agents/codex/factory-surface.test.ts`'s pattern, adapted for
 * OpenCode's three composition-helper functions plus its constant lists
 * (rather than Codex's 10 per-event hook factories).
 */

import { describe, expect, it } from "vitest";
import * as surface from "../../../src/agents/opencode/index.js";
import {
  ADVISORY_EVENTS,
  applyOpenCodeErrorPolicy,
  createRootSessionRegistry,
  defineOpenCodePlugin,
  guardAdvisory,
  OPENCODE_HOOK_NAMES,
  POLICY_ENFORCING_EVENTS,
} from "../../../src/agents/opencode/index.js";

const EXPECTED_RUNTIME_EXPORTS = [
  "ADVISORY_EVENTS",
  "OPENCODE_HOOK_NAMES",
  "POLICY_ENFORCING_EVENTS",
  "applyOpenCodeErrorPolicy",
  "createRootSessionRegistry",
  "defineOpenCodePlugin",
  "guardAdvisory",
] as const;

describe("opencode factory surface", () => {
  it("exports exactly the expected runtime values", () => {
    expect(Object.keys(surface).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS].sort());
  });

  it("binds each function export to a function", () => {
    expect(applyOpenCodeErrorPolicy).toBeTypeOf("function");
    expect(createRootSessionRegistry).toBeTypeOf("function");
    expect(defineOpenCodePlugin).toBeTypeOf("function");
    expect(guardAdvisory).toBeTypeOf("function");
  });

  it("binds each list export to a readonly array", () => {
    expect(Array.isArray(OPENCODE_HOOK_NAMES)).toBe(true);
    expect(Array.isArray(ADVISORY_EVENTS)).toBe(true);
    expect(Array.isArray(POLICY_ENFORCING_EVENTS)).toBe(true);
  });
});
