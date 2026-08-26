/**
 * Unit tests for the runtime module.
 *
 * Tests wire format output conversion for hook outputs, plus the execute()
 * entrypoint's phase-by-phase error handling under both the default "error"
 * policy and the opt-in "continue" fail-open policy.
 */

import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HookFunction } from "../src/agents/claude-code/hooks.js";
import { userPromptSubmitHook } from "../src/agents/claude-code/hooks.js";
import type { SpecificHookOutput } from "../src/agents/claude-code/outputs.js";
import {
  EXIT_CODES,
  notificationOutput,
  permissionRequestOutput,
  postToolUseOutput,
  preToolUseOutput,
  sessionStartOutput,
  stopOutput,
  teammateIdleOutput,
  userPromptSubmitOutput,
  worktreeCreateOutput,
  worktreeRemoveOutput,
} from "../src/agents/claude-code/outputs.js";
import { convertToHookOutput, execute } from "../src/agents/claude-code/transport.js";
import type { HookInput, UserPromptSubmitInput } from "../src/agents/claude-code/types.js";
import { logger } from "../src/core/logger.js";

describe("convertToHookOutput", () => {
  /**
   * Helper to safely access hookSpecificOutput as a record.
   * @param result - The output from convertToHookOutput
   * @returns The hookSpecificOutput property as a record
   */
  function getHookSpecific(result: ReturnType<typeof convertToHookOutput>): Record<string, unknown> {
    return result.stdout.hookSpecificOutput as unknown as Record<string, unknown>;
  }

  describe("PreToolUse wire format", () => {
    it("passes through hookSpecificOutput with permissionDecision", () => {
      const specificOutput = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "Dangerous command",
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(result.stdout.hookSpecificOutput).toBeDefined();
      expect(hookSpecific.hookEventName).toBe("PreToolUse");
      expect(hookSpecific.permissionDecision).toBe("deny");
      expect(hookSpecific.permissionDecisionReason).toBe("Dangerous command");
    });

    it("includes updatedInput in hookSpecificOutput", () => {
      const specificOutput = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: "allow",
          updatedInput: { command: "ls -la" },
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.updatedInput).toEqual({ command: "ls -la" });
    });
  });

  describe("PostToolUse wire format", () => {
    it("passes through stopReason in stdout", () => {
      const specificOutput = postToolUseOutput({
        stopReason: "Output contains sensitive data",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.stopReason).toBe("Output contains sensitive data");
    });

    it("passes through additionalContext in hookSpecificOutput", () => {
      const specificOutput = postToolUseOutput({
        hookSpecificOutput: {
          additionalContext: "File was modified",
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(result.stdout.hookSpecificOutput).toBeDefined();
      expect(hookSpecific.additionalContext).toBe("File was modified");
    });

    it("includes updatedMCPToolOutput in hookSpecificOutput", () => {
      const specificOutput = postToolUseOutput({
        hookSpecificOutput: {
          updatedMCPToolOutput: { sanitized: true },
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.updatedMCPToolOutput).toEqual({ sanitized: true });
    });
  });

  describe("UserPromptSubmit wire format", () => {
    it("passes through stopReason for blocking", () => {
      const specificOutput = userPromptSubmitOutput({
        stopReason: "Prompt validation failed",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.stopReason).toBe("Prompt validation failed");
    });

    it("passes through additionalContext in hookSpecificOutput", () => {
      const specificOutput = userPromptSubmitOutput({
        hookSpecificOutput: {
          additionalContext: "User is admin",
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.additionalContext).toBe("User is admin");
    });
  });

  describe("PermissionRequest wire format", () => {
    it("passes through decision in hookSpecificOutput", () => {
      const specificOutput = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: "allow",
            updatedInput: { file_path: "/safe/path" },
          },
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(result.stdout.hookSpecificOutput).toBeDefined();
      expect(hookSpecific.hookEventName).toBe("PermissionRequest");
      expect(hookSpecific.decision).toEqual({
        behavior: "allow",
        updatedInput: { file_path: "/safe/path" },
      });
    });

    it("handles deny decision with message and interrupt", () => {
      const specificOutput = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: "deny",
            message: "Not allowed",
            interrupt: true,
          },
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.decision).toEqual({
        behavior: "deny",
        message: "Not allowed",
        interrupt: true,
      });
    });
  });

  describe("Stop wire format", () => {
    it("keeps decision at top level for Stop hooks", () => {
      const specificOutput = stopOutput({
        decision: "block",
        reason: "Uncommitted changes",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.decision).toBe("block");
      expect(result.stdout.reason).toBe("Uncommitted changes");
    });

    it("handles approve decision", () => {
      const specificOutput = stopOutput({
        decision: "approve",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.decision).toBe("approve");
    });
  });

  describe("SessionStart wire format", () => {
    it("passes through additionalContext in hookSpecificOutput", () => {
      const specificOutput = sessionStartOutput({
        hookSpecificOutput: {
          additionalContext: "Project: my-app",
        },
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.additionalContext).toBe("Project: my-app");
    });
  });

  describe("stderr passthrough", () => {
    it("passes through stderr when present in specific output", () => {
      const specificOutput = teammateIdleOutput({ stderr: "feedback" });
      const result = convertToHookOutput(specificOutput);
      expect(result.stderr).toBe("feedback");
    });

    it("omits stderr when absent in specific output", () => {
      const specificOutput = teammateIdleOutput({});
      const result = convertToHookOutput(specificOutput);
      expect(result.stderr).toBeUndefined();
    });
  });

  describe("rawStdout passthrough (worktree command-hook protocol)", () => {
    it("threads rawStdout from worktreeCreateOutput", () => {
      const specificOutput = worktreeCreateOutput({ worktreePath: "/abs/path/to/worktree" });
      const result = convertToHookOutput(specificOutput);
      expect(result.rawStdout).toBe("/abs/path/to/worktree");
    });

    it("threads rawStdout from worktreeRemoveOutput when worktreePath is provided", () => {
      const specificOutput = worktreeRemoveOutput({ worktreePath: "/abs/path/to/worktree" });
      const result = convertToHookOutput(specificOutput);
      expect(result.rawStdout).toBe("/abs/path/to/worktree");
    });

    it("omits rawStdout for worktreeRemoveOutput without a worktreePath", () => {
      const specificOutput = worktreeRemoveOutput({});
      const result = convertToHookOutput(specificOutput);
      expect(result.rawStdout).toBeUndefined();
    });

    it("omits rawStdout for non-worktree outputs", () => {
      const specificOutput = sessionStartOutput({});
      const result = convertToHookOutput(specificOutput);
      expect(result.rawStdout).toBeUndefined();
    });
  });

  describe("common fields", () => {
    it("preserves continue, suppressOutput, systemMessage", () => {
      const specificOutput = sessionStartOutput({
        continue: true,
        suppressOutput: true,
        systemMessage: "Welcome",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.continue).toBe(true);
      expect(result.stdout.suppressOutput).toBe(true);
      expect(result.stdout.systemMessage).toBe("Welcome");
    });

    it("passes through stopReason in stdout", () => {
      const specificOutput = notificationOutput({
        stopReason: "Notification blocked",
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.stopReason).toBe("Notification blocked");
    });
  });
});

class ProcessExitSignal extends Error {
  public constructor(public readonly code: number | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

class FakeStdin extends EventEmitter {
  public setEncoding(): this {
    return this;
  }
}

function baseInput(overrides: Partial<UserPromptSubmitInput> = {}): UserPromptSubmitInput {
  return {
    hook_event_name: "UserPromptSubmit",
    session_id: "test-session",
    cwd: "/tmp",
    transcript_path: "/tmp/transcript.jsonl",
    prompt: "hello",
    ...overrides,
  } as UserPromptSubmitInput;
}

interface RunResult {
  exitCode: number | undefined;
  stdout: string;
  stderr: string;
}

async function runExecuteWithStdin<TInput extends HookInput, TOutput extends SpecificHookOutput>(
  hookFn: HookFunction<TInput, TOutput>,
  stdinContent: string | "error",
): Promise<RunResult> {
  const fakeStdin = new FakeStdin();
  Object.defineProperty(process, "stdin", { value: fakeStdin, configurable: true });

  let stdout = "";
  let stderr = "";
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdout += String(chunk);
    return true;
  });
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderr += String(chunk);
    return true;
  });
  const exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number | string | null): never => {
    throw new ProcessExitSignal(typeof code === "number" ? code : undefined);
  });

  const runPromise = execute(hookFn).catch((error) => {
    if (error instanceof ProcessExitSignal) {
      return error;
    }
    throw error;
  });

  queueMicrotask(() => {
    if (stdinContent === "error") {
      fakeStdin.emit("error", new Error("stdin read failed"));
    } else {
      fakeStdin.emit("data", stdinContent);
      fakeStdin.emit("end");
    }
  });

  const result = await runPromise;
  const exitCode = result instanceof ProcessExitSignal ? result.code : undefined;

  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  exitSpy.mockRestore();

  return { exitCode, stdout, stderr };
}

const originalStdin = process.stdin;

describe("execute", () => {
  afterEach(() => {
    Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
    vi.restoreAllMocks();
  });

  describe("default (error) policy", () => {
    it("writes structured output and exits 0 on success", async () => {
      const hook = userPromptSubmitHook({}, () =>
        userPromptSubmitOutput({ hookSpecificOutput: { additionalContext: "extra context" } }),
      );
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(JSON.parse(result.stdout)).toEqual({
        hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "extra context" },
      });
      expect(result.stderr).toBe("");
    });

    it("writes a stack trace and exits 2 (BLOCK) when the handler throws", async () => {
      const hook = userPromptSubmitHook({}, () => {
        throw new Error("handler exploded");
      });
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
      expect(result.stderr).toContain("handler exploded");
      expect(result.stdout).toBe("");
    });

    it("fails open unconditionally (independent of policy) on malformed stdin JSON", async () => {
      const hook = userPromptSubmitHook({}, () => userPromptSubmitOutput({}));
      const result = await runExecuteWithStdin(hook, "{not json");
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(JSON.parse(result.stdout)).toEqual({});
    });

    it("fails open unconditionally (independent of policy) when stdin itself errors", async () => {
      const hook = userPromptSubmitHook({}, () => userPromptSubmitOutput({}));
      const result = await runExecuteWithStdin(hook, "error");
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(JSON.parse(result.stdout)).toEqual({});
    });

    it("never writes stdout on the intentional stderr/BLOCK path, so Claude Code cannot mistake it for success", async () => {
      const hook = userPromptSubmitHook({}, () => ({ ...teammateIdleOutput({ stderr: "please continue" }) }) as never);
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
      expect(result.stderr).toBe("please continue");
      expect(result.stdout).toBe("");
    });
  });

  describe("continue policy", () => {
    it("emits {} and exits 0 when the handler throws", async () => {
      const onUnexpectedError = vi.fn();
      const hook = userPromptSubmitHook({ unexpectedError: "continue", onUnexpectedError }, () => {
        throw new Error("handler exploded");
      });
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(result.stdout).toBe("{}");
      expect(onUnexpectedError).toHaveBeenCalledTimes(1);
      expect(onUnexpectedError).toHaveBeenCalledWith(expect.any(Error), "handler");
    });

    it("emits {} and exits 0 for malformed stdin (already unconditional, but still holds under continue)", async () => {
      const hook = userPromptSubmitHook({ unexpectedError: "continue" }, () => userPromptSubmitOutput({}));
      const result = await runExecuteWithStdin(hook, "{not json");
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(JSON.parse(result.stdout)).toEqual({});
    });

    it("still honors an explicit stderr/BLOCK return from the handler", async () => {
      const onUnexpectedError = vi.fn();
      const hook = userPromptSubmitHook(
        { unexpectedError: "continue", onUnexpectedError },
        () => ({ ...teammateIdleOutput({ stderr: "blocked on purpose" }) }) as never,
      );
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
      expect(result.stderr).toBe("blocked on purpose");
      expect(result.stdout).toBe("");
      expect(onUnexpectedError).not.toHaveBeenCalled();
    });

    it("emits {} and exits 0 when stdout.write fails", async () => {
      const onUnexpectedError = vi.fn();
      const hook = userPromptSubmitHook({ unexpectedError: "continue", onUnexpectedError }, () =>
        userPromptSubmitOutput({ hookSpecificOutput: { additionalContext: "context" } }),
      );

      const fakeStdin = new FakeStdin();
      Object.defineProperty(process, "stdin", { value: fakeStdin, configurable: true });
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number | string | null): never => {
        throw new ProcessExitSignal(typeof code === "number" ? code : undefined);
      });
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      let writeAttempts = 0;
      const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => {
        writeAttempts += 1;
        throw new Error("EPIPE");
      });

      const runPromise = execute(hook).catch((error) => {
        if (error instanceof ProcessExitSignal) {
          return error;
        }
        throw error;
      });
      queueMicrotask(() => {
        fakeStdin.emit("data", JSON.stringify(baseInput()));
        fakeStdin.emit("end");
      });
      const result = await runPromise;

      expect(result).toBeInstanceOf(ProcessExitSignal);
      expect((result as ProcessExitSignal).code).toBe(EXIT_CODES.SUCCESS);
      // Never retries with a fallback payload once a write was attempted, so
      // stdout can never end up with concatenated/invalid JSON.
      expect(writeAttempts).toBe(1);
      expect(onUnexpectedError).toHaveBeenCalledWith(expect.any(Error), "write");

      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("does not let a failing diagnostic sink escape or block cleanup", async () => {
      const onUnexpectedError = vi.fn(() => {
        throw new Error("diagnostic sink is broken too");
      });
      const hook = userPromptSubmitHook({ unexpectedError: "continue", onUnexpectedError }, () => {
        throw new Error("handler exploded");
      });
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(result.stdout).toBe("{}");
    });

    it("does not let logger cleanup failures escape", async () => {
      const closeSpy = vi.spyOn(logger, "close").mockImplementation(() => {
        throw new Error("close failed");
      });
      const onUnexpectedError = vi.fn();
      const hook = userPromptSubmitHook({ unexpectedError: "continue", onUnexpectedError }, () =>
        userPromptSubmitOutput({ hookSpecificOutput: { additionalContext: "context" } }),
      );
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(onUnexpectedError).toHaveBeenCalledWith(expect.any(Error), "cleanup");
      closeSpy.mockRestore();
    });
  });
});
