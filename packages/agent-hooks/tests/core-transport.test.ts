/**
 * Unit tests for `core/transport.ts` — the shared driver contract.
 *
 * These tests are core's primary evidence: they exercise `drive()` against a
 * fake transport (no real agent exists in this step), table-driven over every
 * outcome variant and every `unexpectedError` policy value, plus the dedicated
 * {@link HookBlockError}-precedence table and stdin parse-failure coverage
 * faithful to both source runtimes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineHook } from "../src/core/define-hook.js";
import { logger } from "../src/core/logger.js";
import {
  drive,
  type FinalizedResult,
  HookBlockError,
  type HookOutcome,
  type Transport,
} from "../src/core/transport.js";
import type { HookContext, HookFunction, UnexpectedErrorHandler } from "../src/core/types.js";

const stdinState = vi.hoisted(() => ({
  content: "",
  failure: undefined as unknown | undefined,
}));

vi.mock("../src/core/stdin.js", () => ({
  // Thin adapter over a controllable buffer: process.stdin cannot be driven
  // portably in-process, so the I/O boundary is stubbed and everything behind
  // it (parse, classify, finalize, emit) runs for real.
  readStdin: () =>
    stdinState.failure !== undefined ? Promise.reject(stdinState.failure) : Promise.resolve(stdinState.content),
  parseStdinJson: (content: string) => JSON.parse(content) as unknown,
}));

class ProcessExitError extends Error {
  public constructor(public readonly code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

interface FakeOutput {
  value?: string;
  raw?: string;
  continue?: boolean;
  stopReason?: string;
  decision?: string;
  hookSpecificOutput?: Record<string, unknown>;
}

class FakeTransport implements Transport<FakeOutput> {
  public readonly finalizeCalls: HookOutcome<FakeOutput>[] = [];

  public readonly rawStdoutCalls: FakeOutput[] = [];

  public constructor(private readonly result: FinalizedResult = { stdout: "{}", exitCode: 0 }) {}

  public finalize(outcome: HookOutcome<FakeOutput>): FinalizedResult {
    this.finalizeCalls.push(outcome);
    return this.result;
  }

  public rawStdout(output: FakeOutput): string | undefined {
    this.rawStdoutCalls.push(output);
    return typeof output.raw === "string" ? output.raw : undefined;
  }
}

type AnyHook = HookFunction<Record<string, unknown>, FakeOutput, HookContext>;

function makeHook(
  handler: (input: Record<string, unknown>, context: HookContext) => Promise<FakeOutput | null> | FakeOutput | null,
  config: {
    unexpectedError?: "error" | "continue";
    onUnexpectedError?: UnexpectedErrorHandler;
    createContext?: (input: Record<string, unknown>) => HookContext;
  } = {},
): AnyHook {
  return defineHook<Record<string, unknown>, FakeOutput>("FakeEvent", config, async (input, context) =>
    handler(input, context),
  );
}

async function runDrive(
  transport: FakeTransport,
  hookFn: AnyHook,
): Promise<{ exitCode: number | string | null | undefined }> {
  const rejection = await drive(transport, hookFn).then(
    () => {
      throw new Error("drive() must never resolve: it owns process.exit");
    },
    (error: unknown) => error,
  );
  expect(rejection).toBeInstanceOf(ProcessExitError);
  return { exitCode: (rejection as ProcessExitError).code };
}

const POLICIES = [
  { label: "default (unset)", policy: undefined },
  { label: '"error"', policy: "error" },
  { label: '"continue"', policy: "continue" },
] as const;

describe("drive() outcome × policy matrix", () => {
  let _exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdinState.content = '{"hello":"world"}';
    stdinState.failure = undefined;
    _exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ProcessExitError(code);
    }) as never);
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.clearContext();
  });

  it("handler return value passes through unmodified as response under every policy value", async () => {
    for (const { label, policy } of POLICIES) {
      vi.mocked(process.stdout.write).mockClear();
      vi.mocked(process.stderr.write).mockClear();
      const transport = new FakeTransport();
      const hookFn = makeHook(() => ({ value: "ok" }), { unexpectedError: policy });
      const { exitCode } = await runDrive(transport, hookFn);

      expect(transport.finalizeCalls, `finalize once under ${label}`).toHaveLength(1);
      expect(transport.finalizeCalls[0], `response outcome under ${label}`).toStrictEqual({
        kind: "response",
        output: { value: "ok" },
      });
      expect(exitCode, `exit code from finalize under ${label}`).toBe(0);
      expect(process.stdout.write, `single buffered stdout write under ${label}`).toHaveBeenCalledTimes(1);
      expect(vi.mocked(process.stdout.write).mock.calls[0]?.[0], `stdout payload under ${label}`).toBe("{}");
      expect(process.stderr.write, `no stderr under ${label}`).not.toHaveBeenCalled();
    }
  });

  it("null handler return classifies as the empty response under every policy value", async () => {
    for (const { label, policy } of POLICIES) {
      const transport = new FakeTransport();
      const hookFn = makeHook(() => null, { unexpectedError: policy });
      await runDrive(transport, hookFn);

      expect(transport.finalizeCalls, `finalize once under ${label}`).toHaveLength(1);
      expect(transport.finalizeCalls[0], `empty response under ${label}`).toStrictEqual({
        kind: "response",
        output: undefined,
      });
    }
  });

  it("rawStdout predicate match classifies as rawStdout under every policy value", async () => {
    for (const { label, policy } of POLICIES) {
      const transport = new FakeTransport();
      const hookFn = makeHook(() => ({ raw: "/path/to/worktree" }), { unexpectedError: policy });
      await runDrive(transport, hookFn);

      expect(transport.rawStdoutCalls, `predicate consulted under ${label}`).toHaveLength(1);
      expect(transport.finalizeCalls, `finalize once under ${label}`).toHaveLength(1);
      expect(transport.finalizeCalls[0], `rawStdout outcome under ${label}`).toStrictEqual({
        kind: "rawStdout",
        stdout: "/path/to/worktree",
      });
    }
  });

  it("plain Error under the default and explicit error policies yields handlerError at the handler phase", async () => {
    for (const { label, policy } of POLICIES.filter((p) => p.policy !== "continue")) {
      const transport = new FakeTransport();
      const original = new Error("boom");
      const hookFn = makeHook(
        () => {
          throw original;
        },
        { unexpectedError: policy },
      );
      await runDrive(transport, hookFn);

      expect(transport.finalizeCalls, `finalize once under ${label}`).toHaveLength(1);
      expect(transport.finalizeCalls[0]).toMatchObject({ kind: "handlerError", phase: "handler" });
      expect((transport.finalizeCalls[0] as { error: unknown }).error, `same thrown value under ${label}`).toBe(
        original,
      );
    }
  });

  it("plain Error under the continue policy is swallowed into the empty response", async () => {
    const transport = new FakeTransport();
    const reported: Array<[unknown, string]> = [];
    const onUnexpectedError: UnexpectedErrorHandler = (error, phase) => {
      reported.push([error, phase]);
    };
    const original = new Error("boom");
    const hookFn = makeHook(
      () => {
        throw original;
      },
      { unexpectedError: "continue", onUnexpectedError },
    );
    await runDrive(transport, hookFn);

    expect(transport.finalizeCalls).toHaveLength(1);
    expect(transport.finalizeCalls[0]).toStrictEqual({ kind: "response", output: undefined });
    expect(reported).toStrictEqual([[original, "handler"]]);
  });

  it("emits exactly what finalize returns: both streams buffered single-write, then its exit code", async () => {
    const transport = new FakeTransport({ stdout: "OUT", stderr: "ERR", exitCode: 3 });
    const hookFn = makeHook(() => ({ value: "x" }));
    const { exitCode } = await runDrive(transport, hookFn);

    expect(exitCode).toBe(3);
    expect(process.stdout.write).toHaveBeenCalledTimes(1);
    expect(vi.mocked(process.stdout.write).mock.calls[0]?.[0]).toBe("OUT");
    expect(process.stderr.write).toHaveBeenCalledTimes(1);
    expect(vi.mocked(process.stderr.write).mock.calls[0]?.[0]).toBe("ERR");
  });

  it("finalize result without streams writes nothing but still exits with its code", async () => {
    const transport = new FakeTransport({ exitCode: 7 });
    const hookFn = makeHook(() => ({ value: "x" }));
    const { exitCode } = await runDrive(transport, hookFn);

    expect(exitCode).toBe(7);
    expect(process.stdout.write).not.toHaveBeenCalled();
    expect(process.stderr.write).not.toHaveBeenCalled();
  });

  it("passes the transport-provided context factory output to the handler, base { logger } otherwise", async () => {
    const customContext: HookContext = { logger };
    let receivedDefault: HookContext | undefined;
    const defaultHook = makeHook((_input, context) => {
      receivedDefault = context;
      return null;
    });
    await runDrive(new FakeTransport(), defaultHook);
    expect(receivedDefault).toBeDefined();
    expect(Object.keys(receivedDefault ?? {})).toStrictEqual(["logger"]);

    let receivedCustom: HookContext | undefined;
    const customHook = makeHook(
      (_input, context) => {
        receivedCustom = context;
        return null;
      },
      { createContext: () => customContext },
    );
    await runDrive(new FakeTransport(), customHook);
    expect(receivedCustom).toBe(customContext);
  });
});

describe("HookBlockError precedence (classified before policy)", () => {
  let _exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdinState.content = '{"hello":"world"}';
    stdinState.failure = undefined;
    _exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ProcessExitError(code);
    }) as never);
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.clearContext();
  });

  it("a thrown HookBlockError yields the block outcome under every policy value, never swallowed", async () => {
    for (const { label, policy } of POLICIES) {
      const transport = new FakeTransport();
      const blockError = new HookBlockError("blocked: writes outside workspace", { tool: "Bash" });
      const hookFn = makeHook(
        () => {
          throw blockError;
        },
        { unexpectedError: policy },
      );
      await runDrive(transport, hookFn);

      expect(transport.finalizeCalls, `finalize once under ${label}`).toHaveLength(1);
      const outcome = transport.finalizeCalls[0];
      expect(outcome.kind, `block outcome under ${label}`).toBe("block");
      if (outcome.kind !== "block") {
        throw new Error("unreachable");
      }
      expect(outcome.error, `identical error instance under ${label}`).toBe(blockError);
      expect(outcome.error.message).toBe("blocked: writes outside workspace");
      expect(outcome.error.fields).toStrictEqual({ tool: "Bash" });
    }
  });

  it("a response whose output carries block-signaling fields reaches finalize unmodified under every policy value", async () => {
    const signalingOutputs: FakeOutput[] = [
      { continue: false, stopReason: "halt" },
      { decision: "block" },
      { hookSpecificOutput: { permissionDecision: "deny" } },
    ];
    for (const output of signalingOutputs) {
      for (const { label, policy } of POLICIES) {
        const transport = new FakeTransport();
        const hookFn = makeHook(() => output, { unexpectedError: policy });
        await runDrive(transport, hookFn);

        expect(transport.finalizeCalls, `finalize once under ${label}`).toHaveLength(1);
        expect(transport.finalizeCalls[0], `unmodified ${JSON.stringify(output)} under ${label}`).toStrictEqual({
          kind: "response",
          output,
        });
        const recorded = transport.finalizeCalls[0];
        if (recorded.kind === "response") {
          expect(recorded.output, `identity preserved under ${label}`).toBe(output);
        }
      }
    }
  });
});

describe("stdin parse/read failure behavior (faithful to both sources)", () => {
  let _exitSpy: ReturnType<typeof vi.spyOn>;
  let loggedErrors: string[];

  beforeEach(() => {
    stdinState.content = "";
    stdinState.failure = undefined;
    _exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ProcessExitError(code);
    }) as never);
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    loggedErrors = [];
    logger.on("error", (event) => {
      loggedErrors.push(event.message);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.clearContext();
  });

  it("malformed stdin JSON under the default and explicit error policies classifies as handlerError at the parse phase", async () => {
    for (const { label, policy } of POLICIES.filter((p) => p.policy !== "continue")) {
      const transport = new FakeTransport();
      stdinState.content = "{not-json";
      const hookFn = makeHook(() => null, { unexpectedError: policy });
      await runDrive(transport, hookFn);

      expect(transport.finalizeCalls, `finalize exactly once under ${label}`).toHaveLength(1);
      const outcome = transport.finalizeCalls[0];
      expect(outcome.kind, `handlerError under ${label}`).toBe("handlerError");
      if (outcome.kind !== "handlerError") {
        throw new Error("unreachable");
      }
      expect(outcome.phase, `parse phase under ${label}`).toBe("parse");
      expect(outcome.error, `real SyntaxError under ${label}`).toBeInstanceOf(SyntaxError);
      expect(
        loggedErrors.some((message) => message.includes("Failed to parse stdin JSON")),
        `logged like both sources under ${label}`,
      ).toBe(true);
    }
  });

  it("malformed stdin JSON under the continue policy is swallowed into the empty response", async () => {
    const transport = new FakeTransport();
    const reported: Array<[unknown, string]> = [];
    stdinState.content = "{not-json";
    const hookFn = makeHook(() => null, {
      unexpectedError: "continue",
      onUnexpectedError: (error, phase) => {
        reported.push([error, phase]);
      },
    });
    await runDrive(transport, hookFn);

    expect(transport.finalizeCalls).toHaveLength(1);
    expect(transport.finalizeCalls[0]).toStrictEqual({ kind: "response", output: undefined });
    expect(reported).toHaveLength(1);
    expect(reported[0]?.[1]).toBe("parse");
    expect(reported[0]?.[0]).toBeInstanceOf(SyntaxError);
    expect(loggedErrors.some((message) => message.includes("Failed to parse stdin JSON"))).toBe(true);
  });

  it("stdin read failure mirrors the parse-failure treatment at the read phase", async () => {
    const transport = new FakeTransport();
    stdinState.failure = new Error("stdin closed");
    const hookFn = makeHook(() => null);
    await runDrive(transport, hookFn);

    expect(transport.finalizeCalls).toHaveLength(1);
    const outcome = transport.finalizeCalls[0];
    expect(outcome.kind).toBe("handlerError");
    if (outcome.kind !== "handlerError") {
      throw new Error("unreachable");
    }
    expect(outcome.phase).toBe("read");
    expect(loggedErrors.some((message) => message.includes("Failed to read stdin"))).toBe(true);
  });

  it("the handler is never invoked when stdin cannot be parsed", async () => {
    const transport = new FakeTransport();
    let handlerRan = false;
    stdinState.content = "{not-json";
    const hookFn = makeHook(() => {
      handlerRan = true;
      return null;
    });
    await runDrive(transport, hookFn);
    expect(handlerRan).toBe(false);
  });
});
