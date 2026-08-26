import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HookFunction } from "../../src/agents/codex/hooks.js";
import { userPromptSubmitHook } from "../../src/agents/codex/hooks.js";
import { BlockError, EXIT_CODES } from "../../src/agents/codex/outputs.js";
import { execute } from "../../src/agents/codex/transport.js";
import type { HookEventName, HookInput, UserPromptSubmitInput } from "../../src/agents/codex/types.js";
import { logger } from "../../src/core/logger.js";

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
    cwd: "/workspace",
    hook_event_name: "UserPromptSubmit",
    model: "gpt-5-codex",
    session_id: "sess-1",
    transcript_path: null,
    permission_mode: "default",
    prompt: "hello",
    turn_id: "turn-1",
    ...overrides,
  };
}

interface RunResult {
  exitCode: number | undefined;
  stdout: string;
  stderr: string;
}

async function runExecuteWithStdin<TInput extends HookInput, TOutput>(
  hookFn: HookFunction<TInput, TOutput, HookEventName>,
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

describe("execute", () => {
  const originalStdin = process.stdin;

  afterEach(() => {
    Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
    vi.restoreAllMocks();
  });

  describe("default (error) policy", () => {
    it("writes structured output and exits 0 on success", async () => {
      const hook = userPromptSubmitHook({}, () => "extra context");
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(JSON.parse(result.stdout)).toEqual({
        hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "extra context" },
      });
      expect(result.stderr).toBe("");
    });

    it("writes the BlockError reason and exits 2, regardless of policy", async () => {
      const hook = userPromptSubmitHook({}, () => {
        throw new BlockError("nope");
      });
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
      expect(result.stderr).toBe("nope\n");
      expect(result.stdout).toBe("");
    });

    it("writes a stack trace and exits non-zero when the handler throws", async () => {
      const hook = userPromptSubmitHook({}, () => {
        throw new Error("handler exploded");
      });
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.ERROR);
      expect(result.stderr).toContain("handler exploded");
      expect(result.stdout).toBe("");
    });

    it("exits non-zero on malformed stdin JSON", async () => {
      const hook = userPromptSubmitHook({}, () => undefined);
      const result = await runExecuteWithStdin(hook, "{not json");
      expect(result.exitCode).toBe(EXIT_CODES.ERROR);
      expect(result.stdout).toBe("");
    });

    it("exits non-zero when stdin itself errors", async () => {
      const hook = userPromptSubmitHook({}, () => undefined);
      const result = await runExecuteWithStdin(hook, "error");
      expect(result.exitCode).toBe(EXIT_CODES.ERROR);
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

    it("emits {} and exits 0 for malformed stdin", async () => {
      const onUnexpectedError = vi.fn();
      const hook = userPromptSubmitHook({ unexpectedError: "continue", onUnexpectedError }, () => undefined);
      const result = await runExecuteWithStdin(hook, "{not json");
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(result.stdout).toBe("{}");
      expect(onUnexpectedError).toHaveBeenCalledWith(expect.any(Error), "parse");
    });

    it("emits {} and exits 0 when stdin itself errors", async () => {
      const onUnexpectedError = vi.fn();
      const hook = userPromptSubmitHook({ unexpectedError: "continue", onUnexpectedError }, () => undefined);
      const result = await runExecuteWithStdin(hook, "error");
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(result.stdout).toBe("{}");
      expect(onUnexpectedError).toHaveBeenCalledWith(expect.any(Error), "read");
    });

    it("still writes the BlockError reason and exits 2", async () => {
      const onUnexpectedError = vi.fn();
      const hook = userPromptSubmitHook({ unexpectedError: "continue", onUnexpectedError }, () => {
        throw new BlockError("blocked on purpose");
      });
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
      expect(result.stderr).toBe("blocked on purpose\n");
      expect(onUnexpectedError).not.toHaveBeenCalled();
    });

    it("emits {} and exits 0 when stdout.write fails", async () => {
      const onUnexpectedError = vi.fn();
      const hook = userPromptSubmitHook({ unexpectedError: "continue", onUnexpectedError }, () => "context");

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
      const hook = userPromptSubmitHook({ unexpectedError: "continue", onUnexpectedError }, () => "context");
      const result = await runExecuteWithStdin(hook, JSON.stringify(baseInput()));
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(onUnexpectedError).toHaveBeenCalledWith(expect.any(Error), "cleanup");
      closeSpy.mockRestore();
    });
  });
});
