/**
 * Transport abstraction and the shared driver.
 *
 * Core owns the try/catch skeleton — stdin read, JSON parse, handler
 * invocation, outcome classification, buffered single-write emission, process
 * exit — and has **no knowledge of exit codes or stdout policy**: every wire
 * decision is delegated to the agent's {@link Transport.finalize}, a pure
 * mapping from {@link HookOutcome} to `{ stdout?, stderr?, exitCode }`. Agent
 * transports are data-heavy adapters; they must not re-implement driver logic.
 * @module
 * @example
 * ```typescript
 * const transport: Transport<MyOutput> = {
 *   finalize: (outcome) => {
 *     if (outcome.kind === "response") {
 *       return { stdout: JSON.stringify(outcome.output ?? {}), exitCode: 0 };
 *     }
 *     return { stderr: "blocked", exitCode: 2 };
 *   },
 * };
 *
 * await drive(transport, myHook);
 * ```
 */

import { logger } from "./logger.js";
import { parseStdinJson, readStdin } from "./stdin.js";
import type {
  HookContext,
  HookErrorPhase,
  HookFunction,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "./types.js";

/**
 * Error thrown by a hook handler to signal an intentional block.
 *
 * `drive()` classifies a caught {@link HookBlockError} **before** consulting
 * the `unexpectedError` policy: it always routes to the `block` outcome,
 * under every policy value, so an advisory event's in-flight block decision
 * survives a crash mid-computation. Any other throw is subject to policy as
 * usual. Agents may subclass or re-export this class; each agent's transport
 * owns the wire translation of the `block` outcome.
 */
export class HookBlockError extends Error {
  /**
   * Optional structured fields carried alongside the block reason (e.g.
   * extra wire fields the agent's translation may forward).
   */
  readonly fields?: Record<string, unknown>;

  /**
   * @param message - The block reason; becomes the error `message`.
   * @param fields - Optional additional structured fields.
   */
  public constructor(message: string, fields?: Record<string, unknown>) {
    super(message);
    this.name = "HookBlockError";
    this.fields = fields;
  }
}

/**
 * The classified result of one hook invocation, prior to wire mapping.
 *
 * Discriminated by `kind`; core produces exactly one outcome per invocation
 * and hands it to {@link Transport.finalize} exactly once.
 * @template TOutput - The agent's output type for the event.
 */
export type HookOutcome<TOutput> =
  /** The handler returned normally (`output: undefined` = empty response). */
  | { kind: "response"; output: TOutput | undefined }
  /** The handler threw a {@link HookBlockError}. */
  | { kind: "block"; error: HookBlockError }
  /** The handler (or a pre-handler phase) failed unexpectedly. */
  | { kind: "handlerError"; error: unknown; phase: HookErrorPhase }
  /** The handler returned a plain-text-protocol payload, per the transport's predicate. */
  | { kind: "rawStdout"; stdout: string };

/**
 * The wire-level result produced by a transport's finalize mapping.
 */
export interface FinalizedResult {
  /** Text to write to stdout, or undefined to write nothing. */
  stdout?: string;
  /** Text to write to stderr, or undefined to write nothing. */
  stderr?: string;
  /** Process exit code. */
  exitCode: number;
}

/**
 * Per-agent wire adapter.
 *
 * Implementations own all exit-code and stdout/stderr policy decisions:
 * `finalize` is a pure mapping from the classified outcome to the streams and
 * exit code the host CLI should observe. It must not throw and must not
 * perform I/O; `drive()` owns writing and exiting.
 *
 * The optional `rawStdout` predicate lets the transport declare which
 * returned outputs carry a plain-text protocol payload (e.g. worktree events
 * whose stdout is read verbatim by the host): when it returns a string for a
 * normally-returned output, `drive()` classifies the invocation as
 * `rawStdout` instead of `response`. The returned output is never modified.
 *
 * @template TOutput - The agent's output type for the event.
 */
export interface Transport<TOutput> {
  /**
   * Purely maps a classified outcome to wire text and an exit code.
   * Called exactly once per invocation.
   */
  finalize(outcome: HookOutcome<TOutput>): FinalizedResult;

  /**
   * Optional plain-text-protocol detector. See {@link Transport}.
   */
  rawStdout?(output: TOutput): string | undefined;
}

/** Exit code used only if a transport's finalize itself throws under the default policy. */
const FALLBACK_EXIT_ERROR = 1;
/** Exit code used only if a transport's finalize itself throws under the "continue" policy. */
const FALLBACK_EXIT_SUCCESS = 0;

/**
 * Reports an unexpected error through the caller's diagnostic sink and the
 * runtime logger. Both are best-effort: this function never throws, so a
 * broken sink or logger cannot itself fail the "continue" policy it backs.
 * @param onUnexpectedError - The caller's optional diagnostic callback
 * @param error - The unexpected error
 * @param phase - The runtime phase in which the error occurred
 */
function reportUnexpectedError(
  onUnexpectedError: UnexpectedErrorHandler | undefined,
  error: unknown,
  phase: HookErrorPhase,
): void {
  try {
    onUnexpectedError?.(error, phase);
  } catch {
    // Diagnostic sinks must not recursively fail the invocation.
  }
  try {
    logger.logError(error, `Unexpected error in ${phase} phase (fail-open)`, { phase });
  } catch {
    // The logger itself may be the thing that failed (e.g. log file write).
  }
}

/**
 * Clears logger context and closes any open log file, surfacing cleanup
 * failures through the same policy path as both source runtimes.
 */
function cleanup(policy: UnexpectedErrorPolicy, onUnexpectedError: UnexpectedErrorHandler | undefined): void {
  try {
    logger.clearContext();
    logger.close();
  } catch (error) {
    if (policy !== "continue") {
      throw error;
    }
    reportUnexpectedError(onUnexpectedError, error, "cleanup");
  }
}

/**
 * Classifies a caught value into an outcome.
 *
 * Precedence is the mechanism of record: `error instanceof HookBlockError`
 * routes to the `block` outcome **before** policy is consulted, mirroring the
 * precedence codex-hooks' runtime already gives `BlockError`. Every other
 * throw is subject to policy: `"continue"` swallows it into the empty
 * response; the default `"error"` policy yields `handlerError`.
 */
function classify<TOutput>(
  error: unknown,
  phase: HookErrorPhase,
  policy: UnexpectedErrorPolicy,
  onUnexpectedError: UnexpectedErrorHandler | undefined,
): HookOutcome<TOutput> {
  if (error instanceof HookBlockError) {
    return { kind: "block", error };
  }
  if (policy === "continue") {
    reportUnexpectedError(onUnexpectedError, error, phase);
    return { kind: "response", output: undefined };
  }
  return { kind: "handlerError", error, phase };
}

/**
 * Writes an unexpected (non-handler, runtime-owned) error's stacktrace to
 * stderr. Used for cleanup/finalize failures under the default `"error"`
 * policy, which exit with code 1 — these are not the handler's own
 * intentional signal.
 */
function writeUnexpectedErrorStderr(error: unknown): void {
  if (error instanceof Error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
  } else {
    process.stderr.write(`${String(error)}\n`);
  }
}

/**
 * Last-resort logger shutdown used only when the transport's finalize itself
 * threw — a broken mapping must not mask the original failure.
 */
function cleanupQuietly(): void {
  try {
    logger.clearContext();
    logger.close();
  } catch {
    // Nothing left to do; exiting immediately after.
  }
}

/**
 * Runs one hook invocation end to end: reads stdin, parses JSON, invokes the
 * handler, classifies the outcome, maps it once through the transport, writes
 * the resulting streams buffered (at most one write per stream), and exits
 * with the transport's exit code.
 *
 * Malformed/unreadable stdin is classified at its phase (`read`/`parse`) like
 * any other unexpected failure and logged identically to both source
 * runtimes; each agent's transport decides the wire shape for that
 * classification.
 *
 * @param transport - The agent's wire adapter.
 * @param hookFn - The hook function to execute (from a factory built on
 * {@link defineHook}).
 * @returns Never resolves normally: the process exits inside this function.
 */
export async function drive<TInput, TOutput>(
  transport: Transport<TOutput>,
  hookFn: HookFunction<TInput, TOutput, HookContext>,
): Promise<void> {
  const policy = hookFn.unexpectedError ?? "error";
  const onUnexpectedError = hookFn.onUnexpectedError;

  const outcome = await (async (): Promise<HookOutcome<TOutput>> => {
    let stdinContent: string;
    try {
      stdinContent = await readStdin();
    } catch (error) {
      logger.logError(error, "Failed to read stdin");
      return classify(error, "read", policy, onUnexpectedError);
    }

    let input: TInput;
    try {
      input = parseStdinJson(stdinContent) as TInput;
    } catch (error) {
      logger.logError(error, "Failed to parse stdin JSON");
      return classify(error, "parse", policy, onUnexpectedError);
    }

    logger.setContext(hookFn.eventName, input as Record<string, unknown>);
    const context = hookFn.createContext?.(input) ?? { logger };

    try {
      const result = await hookFn(input, context);
      if (result === null || result === undefined) {
        return { kind: "response", output: undefined };
      }
      const raw = transport.rawStdout?.(result);
      return raw !== undefined ? { kind: "rawStdout", stdout: raw } : { kind: "response", output: result };
    } catch (error) {
      return classify(error, "handler", policy, onUnexpectedError);
    }
  })();

  let finalized: FinalizedResult;
  try {
    finalized = transport.finalize(outcome);
  } catch (error) {
    if (policy === "continue") {
      reportUnexpectedError(onUnexpectedError, error, "serialize");
      cleanupQuietly();
      process.exit(FALLBACK_EXIT_SUCCESS);
    }
    writeUnexpectedErrorStderr(error);
    cleanupQuietly();
    process.exit(FALLBACK_EXIT_ERROR);
  }

  try {
    cleanup(policy, onUnexpectedError);
  } catch (error) {
    writeUnexpectedErrorStderr(error);
    process.exit(FALLBACK_EXIT_ERROR);
  }

  if (finalized.stderr !== undefined) {
    process.stderr.write(finalized.stderr);
  }
  if (finalized.stdout !== undefined) {
    try {
      process.stdout.write(finalized.stdout);
    } catch (error) {
      if (policy === "continue") {
        reportUnexpectedError(onUnexpectedError, error, "write");
        cleanupQuietly();
        process.exit(FALLBACK_EXIT_SUCCESS);
      }
      writeUnexpectedErrorStderr(error);
      cleanupQuietly();
      process.exit(FALLBACK_EXIT_ERROR);
    }
  }
  process.exit(finalized.exitCode);
}
