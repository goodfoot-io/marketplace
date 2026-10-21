/**
 * OpenCode plugin authoring primitives — behavior specification.
 *
 * Invalid-input checks construct the malformed value at runtime (never via
 * `@ts-expect-error`) so the assertion exercises the same runtime guard a
 * JavaScript caller — unchecked by the type system — would hit.
 */

import { describe, expect, it } from "vitest";
import {
  createRootSessionRegistry,
  defineOpenCodePlugin,
  guardAdvisory,
  type Plugin,
} from "../../../src/agents/opencode/index.js";

describe("defineOpenCodePlugin", () => {
  it("returns { id, setup } unchanged for a valid definition", () => {
    const setup: Plugin = async () => {};
    const result = defineOpenCodePlugin({ id: "my-plugin", setup });
    expect(result).toEqual({ id: "my-plugin", setup });
  });

  it("rejects a missing id", () => {
    const setup: Plugin = async () => {};
    const malformed = { setup } as unknown as Parameters<typeof defineOpenCodePlugin>[0];
    expect(() => defineOpenCodePlugin(malformed)).toThrowError(/id/i);
  });

  it("rejects an empty-string id", () => {
    const setup: Plugin = async () => {};
    expect(() => defineOpenCodePlugin({ id: "", setup })).toThrowError(/id/i);
  });

  it("rejects a non-function setup", () => {
    const malformed = { id: "my-plugin", setup: {} } as unknown as Parameters<typeof defineOpenCodePlugin>[0];
    expect(() => defineOpenCodePlugin(malformed)).toThrowError(/setup/i);
  });
});

describe("createRootSessionRegistry", () => {
  it("treats a session observed without a parentId as a root session", () => {
    const registry = createRootSessionRegistry();
    registry.observe("session-1");
    expect(registry.isRoot("session-1")).toBe(true);
  });

  it("treats a session observed with a parentId as non-root", () => {
    const registry = createRootSessionRegistry();
    registry.observe("session-1");
    registry.observe("session-2", "session-1");
    expect(registry.isRoot("session-2")).toBe(false);
  });

  it("a session first observed via session.created is not resumed", () => {
    const registry = createRootSessionRegistry();
    registry.observe("session-1");
    expect(registry.isResumed("session-1")).toBe(false);
  });

  it("a session id observed only through later activity, never session.created, is resumed", () => {
    // Live testing of a prior implementation found that a resumed session
    // does not necessarily re-emit session.created — it may first appear
    // only through a later event (session.updated, message.updated) for a
    // session id the registry has never seen.
    const registry = createRootSessionRegistry();
    registry.observeResumed("session-resumed");
    expect(registry.isResumed("session-resumed")).toBe(true);
  });

  it("observing the same session id twice is idempotent", () => {
    const registry = createRootSessionRegistry();
    registry.observe("session-1", "parent-1");
    registry.observe("session-1", "parent-1");
    expect(registry.isRoot("session-1")).toBe(false);
  });
});

describe("guardAdvisory", () => {
  it("preserves native AISDK mutable event fields", async () => {
    const event: Parameters<import("../../../src/agents/opencode/index.js").OpenCodeHookHandler<"aisdk.sdk">>[0] = {
      model: {} as never,
      package: "provider",
      options: {},
    };
    const sdk = { provider: "custom" };
    const guarded = guardAdvisory(
      "aisdk.sdk",
      (input) => {
        input.sdk = sdk;
      },
      "continue",
    );
    await guarded(event);
    expect(event.sdk).toBe(sdk);
  });

  it("propagates a throw when policy is 'error' (the default)", async () => {
    const failing = async (_input: unknown, _output: unknown): Promise<void> => {
      throw new Error("boom");
    };
    const guarded = guardAdvisory("tool.execute.before", failing as never, undefined);
    await expect(guarded({} as never)).rejects.toThrowError("boom");
  });

  it("swallows a throw and calls onError when policy is 'continue'", async () => {
    const failing = async (_input: unknown, _output: unknown): Promise<void> => {
      throw new Error("boom");
    };
    const seen: unknown[] = [];
    const guarded = guardAdvisory("tool.execute.before", failing as never, "continue", (error) => seen.push(error));
    await expect(guarded({} as never)).resolves.toBeUndefined();
    expect(seen).toHaveLength(1);
  });
});
