import { describe, expect, it } from "vitest";
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
} from "../src/hooks.js";

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

  it("creates a PermissionRequest hook with matcher", () => {
    const hook = permissionRequestHook({ matcher: "Bash" }, () => undefined);
    expect(hook.hookEventName).toBe("PermissionRequest");
    expect(hook.matcher).toBe("Bash");
  });

  it("creates a SubagentStart hook with matcher", () => {
    const hook = subagentStartHook({ matcher: "researcher" }, () => undefined);
    expect(hook.hookEventName).toBe("SubagentStart");
    expect(hook.matcher).toBe("researcher");
  });

  it("creates a SubagentStop hook with matcher", () => {
    const hook = subagentStopHook({ matcher: "researcher" }, () => undefined);
    expect(hook.hookEventName).toBe("SubagentStop");
    expect(hook.matcher).toBe("researcher");
  });

  it("creates a PreCompact hook with matcher", () => {
    const hook = preCompactHook({ matcher: "manual" }, () => undefined);
    expect(hook.hookEventName).toBe("PreCompact");
    expect(hook.matcher).toBe("manual");
  });

  it("creates a PostCompact hook with matcher", () => {
    const hook = postCompactHook({ matcher: "auto" }, () => undefined);
    expect(hook.hookEventName).toBe("PostCompact");
    expect(hook.matcher).toBe("auto");
  });
});
