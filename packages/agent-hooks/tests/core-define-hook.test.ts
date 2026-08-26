/**
 * Unit tests for `core/define-hook.ts` — the factory primitive and its
 * injected per-event policy-validation seam.
 */

import { describe, expect, it, vi } from "vitest";
import { defineHook } from "../src/core/define-hook.js";
import { logger } from "../src/core/logger.js";
import type { HookContext, UnexpectedErrorPolicy } from "../src/core/types.js";

describe("defineHook", () => {
  it("wraps the handler: input and context flow through, return value and null pass back", async () => {
    const handler = vi.fn(async (input: Record<string, unknown>) => ({ echoed: input.hello }));
    const hookFn = defineHook<Record<string, unknown>, { echoed: unknown }>("FakeEvent", {}, handler);

    const context: HookContext = { logger };
    await expect(hookFn({ hello: "world" }, context)).resolves.toStrictEqual({ echoed: "world" });
    expect(handler).toHaveBeenCalledWith({ hello: "world" }, context);

    const nullHook = defineHook<Record<string, unknown>, never>("FakeEvent", {}, async () => null);
    await expect(nullHook({}, context)).resolves.toBe(null);
  });

  it("attaches config metadata to the returned hook function", () => {
    const createContext = (input: Record<string, unknown>) => ({ logger, note: input });
    const onUnexpectedError = () => {};
    const hookFn = defineHook<Record<string, unknown>, object>(
      "MyEvent",
      {
        matcher: "Bash",
        timeout: 5000,
        unexpectedError: "continue",
        onUnexpectedError,
        createContext,
      },
      async () => ({}),
    );

    expect(hookFn.eventName).toBe("MyEvent");
    expect(hookFn.matcher).toBe("Bash");
    expect(hookFn.timeout).toBe(5000);
    expect(hookFn.unexpectedError).toBe("continue");
    expect(hookFn.onUnexpectedError).toBe(onUnexpectedError);
    expect(hookFn.createContext).toBe(createContext);
  });

  it("creates hooks without a gate", () => {
    expect(() => defineHook<Record<string, unknown>, object>("AnyEvent", {}, async () => ({}))).not.toThrow();
  });

  it("invokes the gate with (eventName, configured policy) before creating the hook", () => {
    const gate = vi.fn(() => true);
    defineHook<Record<string, unknown>, object>("MyEvent", { unexpectedError: "continue" }, async () => ({}), gate);
    expect(gate).toHaveBeenCalledTimes(1);
    expect(gate).toHaveBeenCalledWith("MyEvent", "continue" satisfies UnexpectedErrorPolicy);

    const gateNoPolicy = vi.fn(() => true);
    defineHook<Record<string, unknown>, object>("Other", {}, async () => ({}), gateNoPolicy);
    expect(gateNoPolicy).toHaveBeenCalledWith("Other", undefined);
  });

  it("fails closed when the gate returns false", () => {
    expect(() =>
      defineHook<Record<string, unknown>, object>(
        "PreToolUse",
        { unexpectedError: "continue" },
        async () => ({}),
        () => false,
      ),
    ).toThrow(/Policy gate rejected "PreToolUse"/);
  });

  it("propagates a gate that throws, wrapping it as a rejection of the event configuration", () => {
    const throwingGate = () => {
      throw new Error("event not advisory");
    };
    expect(() =>
      defineHook<Record<string, unknown>, object>(
        "Stop",
        { unexpectedError: "continue" },
        async () => ({}),
        throwingGate,
      ),
    ).toThrow(/Policy gate rejected "Stop": event not advisory/);
  });

  it("a rejecting gate means no hook function is ever constructed", () => {
    const handler = vi.fn(async () => ({}));
    try {
      defineHook<Record<string, unknown>, object>("Forbidden", {}, handler, () => false);
    } catch {
      // expected
    }
    expect(handler).not.toHaveBeenCalled();
  });
});
