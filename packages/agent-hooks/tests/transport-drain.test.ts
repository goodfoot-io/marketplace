import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineHook } from "../src/core/define-hook.js";
import { logger } from "../src/core/logger.js";
import { drive, type Transport } from "../src/core/transport.js";

vi.mock("../src/core/stdin.js", () => ({
  readStdin: () => Promise.resolve("{}"),
  parseStdinJson: JSON.parse,
}));

class ProcessExitError extends Error {
  public constructor(public readonly code: number | string | null | undefined) {
    super("process exited");
  }
}

describe("drive() waits for output delivery before exiting", () => {
  let delivered: string[];
  let deliveredAtExit: string[];

  beforeEach(() => {
    delivered = [];
    deliveredAtExit = [];
    vi.spyOn(logger, "setContext").mockImplementation(() => {});
    vi.spyOn(logger, "clearContext").mockImplementation(() => {});
    vi.spyOn(logger, "close").mockImplementation(() => {});
    vi.spyOn(logger, "logError").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation((code): never => {
      deliveredAtExit = [...delivered];
      throw new ProcessExitError(code);
    });
    for (const [name, stream] of [
      ["stdout", process.stdout],
      ["stderr", process.stderr],
    ] as const) {
      vi.spyOn(stream, "write").mockImplementation(
        (chunk: unknown, encodingOrCallback?: unknown, callback?: unknown) => {
          const done = typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
          setImmediate(() => {
            delivered.push(`${name}:${String(chunk)}`);
            if (typeof done === "function") done();
          });
          // Accepted into the buffer does not mean delivered to the reader.
          return true;
        },
      );
    }
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    vi.restoreAllMocks();
  });

  it.each([
    { stdout: "context", exitCode: 0 },
    { stderr: "blocked", exitCode: 2 },
    { stdout: "context", stderr: "diagnostic", exitCode: 0 },
  ])("flushes finalized output $stdout / $stderr", async (result) => {
    const hook = defineHook("Test", {}, () => ({}));
    const failure = await drive({ finalize: () => result }, hook).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ProcessExitError);
    expect((failure as ProcessExitError).code).toBe(result.exitCode);
    expect(deliveredAtExit).toEqual([
      ...(result.stderr === undefined ? [] : [`stderr:${result.stderr}`]),
      ...(result.stdout === undefined ? [] : [`stdout:${result.stdout}`]),
    ]);
  });

  it.each(["finalize", "cleanup"] as const)("flushes runtime error stderr after %s fails", async (phase) => {
    const error = new Error(`${phase} failed`);
    const transport: Transport<object> = {
      finalize: () => {
        if (phase === "finalize") throw error;
        return { stdout: "unused", exitCode: 0 };
      },
    };
    if (phase === "cleanup")
      vi.spyOn(logger, "close").mockImplementation(() => {
        throw error;
      });
    const hook = defineHook("Test", {}, () => ({}));
    const failure = await drive(transport, hook).catch((caught: unknown) => caught);
    expect(failure).toBeInstanceOf(ProcessExitError);
    expect((failure as ProcessExitError).code).toBe(1);
    expect(deliveredAtExit).toEqual([`stderr:${error.stack}\n`]);
  });

  it.each(["error", "continue"] as const)("handles asynchronous stdout failures under %s policy", async (policy) => {
    const error = new Error("asynchronous EPIPE");
    const onUnexpectedError = vi.fn();
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((_chunk: unknown, encodingOrCallback?: unknown, callback?: unknown) => {
        const done = typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
        setImmediate(() => {
          if (typeof done === "function") done(error);
        });
        return false;
      });
    const hook = defineHook("Test", { unexpectedError: policy, onUnexpectedError }, () => ({}));
    const failure = await drive({ finalize: () => ({ stdout: "payload", exitCode: 0 }) }, hook).catch(
      (caught: unknown) => caught,
    );
    expect(failure).toBeInstanceOf(ProcessExitError);
    expect((failure as ProcessExitError).code).toBe(policy === "continue" ? 0 : 1);
    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    if (policy === "continue") {
      expect(onUnexpectedError).toHaveBeenCalledWith(error, "write");
      expect(deliveredAtExit).toEqual([]);
    } else {
      expect(deliveredAtExit).toEqual([`stderr:${error.stack}\n`]);
    }
  });
});
