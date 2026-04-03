import { describe, expect, it } from "vitest";
import { postToolUseHook, preToolUseHook, sessionStartHook, stopHook, userPromptSubmitHook } from "../src/hooks.js";

describe("hook factories", () => {
  it("attach metadata for matcher-aware events", () => {
    const hook = preToolUseHook({ matcher: "Bash", timeout: 5_000, statusMessage: "Checking" }, () => undefined);
    expect(hook.hookEventName).toBe("PreToolUse");
    expect(hook.matcher).toBe("Bash");
    expect(hook.timeout).toBe(5_000);
    expect(hook.statusMessage).toBe("Checking");
  });

  it("omit matcher metadata for matcherless events", () => {
    const hook = userPromptSubmitHook({ timeout: 2_000 }, () => undefined);
    expect(hook.hookEventName).toBe("UserPromptSubmit");
    expect(hook.matcher).toBeUndefined();
  });

  it("creates each supported hook type", () => {
    expect(postToolUseHook({ matcher: "Bash" }, () => undefined).hookEventName).toBe("PostToolUse");
    expect(sessionStartHook({ matcher: "startup" }, () => undefined).hookEventName).toBe("SessionStart");
    expect(stopHook({}, () => undefined).hookEventName).toBe("Stop");
  });
});
