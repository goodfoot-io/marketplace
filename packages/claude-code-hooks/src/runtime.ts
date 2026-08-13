/**
 * Runtime module for Claude Code hooks.
 *
 * Handles stdin/stdout/exit code semantics for compiled hook execution.
 * This module is the core orchestrator that:
 * - Reads JSON from stdin (wire format with snake_case properties)
 * - Invokes the hook handler
 * - Writes output to stdout
 * - Manages exit codes
 * @module
 * @example
 * ```typescript
 * // In a compiled hook file
 * import { execute } from '@goodfoot/claude-code-hooks/runtime';
 * import myHook from './my-hook.js';
 *
 * execute(myHook);
 * ```
 * @see https://code.claude.com/docs/en/hooks
 */

import { persistEnvVar, persistEnvVars } from "./env.js";
import type {
  HookContext,
  HookErrorPhase,
  HookFunction,
  SessionStartContext,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "./hooks.js";
import { logger } from "./logger.js";
import type { HookOutput, SpecificHookOutput } from "./outputs.js";
import { EXIT_CODES } from "./outputs.js";
import type { HookInput } from "./types.js";

// ============================================================================
// Stdin/Stdout Handling
// ============================================================================

/**
 * Reads all data from stdin.
 * @returns Promise resolving to the complete stdin content
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];

    // Set encoding first to ensure data events receive strings
    process.stdin.setEncoding("utf-8");

    process.stdin.on("data", (chunk: string) => {
      chunks.push(chunk);
    });

    process.stdin.on("end", () => {
      resolve(chunks.join(""));
    });

    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Parses stdin JSON input.
 * @param stdinContent - Raw stdin content
 * @returns Parsed input (wire format with snake_case properties)
 * @throws Error if JSON is malformed
 */
function parseStdinInput(stdinContent: string): HookInput {
  // Parse JSON - input uses wire format (snake_case) directly
  const rawInput: unknown = JSON.parse(stdinContent);
  return rawInput as HookInput;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Creates an error output for malformed stdin JSON.
 * @param error - The parse error
 * @returns HookOutput with empty stdout
 */
function createMalformedInputOutput(error: unknown): HookOutput {
  logger.error(`Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`);
  return { stdout: {} };
}

/**
 * Writes handler error stacktrace to stderr and exits with code 2.
 *
 * When a hook handler throws an exception under the default `"error"` policy:
 * - Stacktrace (with sourcemaps if available) is output to stderr
 * - Process exits with code 2 (BLOCK)
 * - No JSON is output to stdout
 * @param error - The error thrown by the handler
 */
function handleHandlerError(error: unknown): never {
  // Write stack trace to stderr (sourcemaps are applied automatically by Node.js)
  if (error instanceof Error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
  } else {
    process.stderr.write(`${String(error)}\n`);
  }

  // Log to file if configured
  logger.error(`Hook handler error: ${error instanceof Error ? error.message : String(error)}`);

  // Clear logger context and close
  logger.clearContext();
  logger.close();

  // Exit with code 2 (BLOCK) - no JSON output
  process.exit(EXIT_CODES.BLOCK);
}

/**
 * Writes an unexpected (non-handler, runtime-owned) error's stacktrace to
 * stderr. Used for serialize/write/cleanup failures under the default
 * `"error"` policy, which exit with code 1 (ERROR) — distinct from
 * `handleHandlerError`'s BLOCK(2), since these are not the handler's own
 * intentional signal.
 * @param error - The unexpected error
 */
function writeUnexpectedErrorStderr(error: unknown): void {
  if (error instanceof Error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
  } else {
    process.stderr.write(`${String(error)}\n`);
  }
}

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
 * Handles an unexpected (non-handler) runtime failure per the configured
 * policy: under `"continue"`, reports it and returns so the caller can fall
 * back to the empty output; under the default `"error"` policy, writes a
 * stack trace and exits with code 1 (ERROR) — this call does not return in
 * that branch.
 * @param error - The unexpected error
 * @param phase - The runtime phase in which the error occurred
 * @param policy - The hook's configured fail-open policy
 * @param onUnexpectedError - The caller's optional diagnostic callback
 */
function handleUnexpectedError(
  error: unknown,
  phase: HookErrorPhase,
  policy: UnexpectedErrorPolicy,
  onUnexpectedError: UnexpectedErrorHandler | undefined,
): void {
  if (policy === "continue") {
    reportUnexpectedError(onUnexpectedError, error, phase);
    return;
  }
  writeUnexpectedErrorStderr(error);
  process.exit(EXIT_CODES.ERROR);
}

/** Clears logger context and closes any open log file, per the configured policy. */
function cleanup(policy: UnexpectedErrorPolicy, onUnexpectedError: UnexpectedErrorHandler | undefined): void {
  try {
    logger.clearContext();
    logger.close();
  } catch (error) {
    handleUnexpectedError(error, "cleanup", policy, onUnexpectedError);
  }
}

/**
 * Converts a SpecificHookOutput to HookOutput for wire format.
 *
 * SpecificHookOutput types have: { _type, stdout, stderr? }
 * HookOutput has: { stdout, stderr? }
 *
 * Since output builders now produce wire-format directly, this function
 * simply strips the `_type` discriminator field.
 * @param specificOutput - The specific output from a hook handler
 * @returns HookOutput ready for serialization
 * @see https://code.claude.com/docs/en/hooks#hook-output-structure
 * @example
 * ```typescript
 * const specificOutput = preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } });
 * const hookOutput = convertToHookOutput(specificOutput);
 * // hookOutput: { stdout: { hookSpecificOutput: { ... } } }
 * ```
 */
export function convertToHookOutput(specificOutput: SpecificHookOutput): HookOutput {
  const { stdout, stderr, rawStdout } = specificOutput;
  const result: HookOutput = { stdout };
  if (stderr !== undefined) {
    result.stderr = stderr;
  }
  if (rawStdout !== undefined) {
    result.rawStdout = rawStdout;
  }
  return result;
}

// ============================================================================
// Execute Function
// ============================================================================

/**
 * Executes a hook handler with full runtime orchestration.
 *
 * This is the main entry point that compiled hooks use. When a compiled hook
 * runs as a CLI:
 *
 * 1. Reads all stdin
 * 2. Parses JSON (wire format with snake_case properties)
 * 3. Sets up logger context (hookType, input)
 * 4. Calls handler with input and context (logger)
 * 5. Handles any errors, logs them
 * 6. Writes JSON to stdout
 * 7. Closes logger
 * 8. Exits with appropriate code
 * @param hookFn - The hook function to execute (from hook factory)
 * @example
 * ```typescript
 * // In compiled hook file
 * import { execute } from '@goodfoot/claude-code-hooks/runtime';
 * import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';
 *
 * const myHook = preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   logger.info('Processing Bash command');
 *   return preToolUseOutput({ allow: true });
 * });
 *
 * execute(myHook);
 * ```
 * @see https://code.claude.com/docs/en/hooks
 */
/**
 * Internal signal wrapping a handler-thrown error under the default
 * `"error"` policy. Thrown (never caught locally) so that
 * {@link handleHandlerError} - which calls `process.exit` and must never
 * return - is invoked exactly once, from `execute()`'s outermost catch,
 * rather than from underneath a `try` that could re-intercept it.
 */
class HandlerThrewError {
  public constructor(public readonly original: unknown) {}
}

/**
 * Reads stdin, parses it, and invokes the handler.
 *
 * Malformed/unreadable stdin already fails open unconditionally (independent
 * of `unexpectedError`), matching the runtime's long-standing default for
 * every hook. A handler throw is gated by `policy`: the default `"error"`
 * policy throws {@link HandlerThrewError} for `execute()` to route to
 * {@link handleHandlerError}; the `"continue"` policy reports the error and
 * resolves to `undefined` so the caller falls back to the empty output.
 */
async function runHandlerPhases<TInput extends HookInput, TOutput extends SpecificHookOutput>(
  hookFn: HookFunction<TInput, TOutput>,
  policy: UnexpectedErrorPolicy,
  onUnexpectedError: UnexpectedErrorHandler | undefined,
  setPhase: (phase: HookErrorPhase) => void,
): Promise<HookOutput | undefined> {
  let stdinContent: string;
  try {
    stdinContent = await readStdin();
  } catch (error) {
    logger.logError(error, "Failed to read stdin");
    return createMalformedInputOutput(error);
  }

  setPhase("parse");
  let input: TInput;
  try {
    input = parseStdinInput(stdinContent) as TInput;
  } catch (error) {
    logger.logError(error, "Failed to parse stdin JSON");
    return createMalformedInputOutput(error);
  }

  // Set logger context
  const hookEventName = hookFn.hookEventName;
  logger.setContext(hookEventName, input);

  // Build context - SessionStart hooks get extended context with persistEnvVar
  const context: HookContext | SessionStartContext =
    hookEventName === "SessionStart" ? { logger, persistEnvVar, persistEnvVars } : { logger };

  setPhase("handler");
  try {
    const specificOutput = await hookFn(input, context as Parameters<typeof hookFn>[1]);
    return specificOutput !== null ? convertToHookOutput(specificOutput) : undefined;
  } catch (error) {
    if (policy !== "continue") {
      throw new HandlerThrewError(error);
    }
    reportUnexpectedError(onUnexpectedError, error, "handler");
    return undefined;
  }
}

export async function execute<TInput extends HookInput, TOutput extends SpecificHookOutput>(
  hookFn: HookFunction<TInput, TOutput>,
): Promise<void> {
  const policy = hookFn.unexpectedError ?? "error";
  const onUnexpectedError = hookFn.onUnexpectedError;
  let phase: HookErrorPhase = "read";

  let output: HookOutput | undefined;
  try {
    output = await runHandlerPhases(hookFn, policy, onUnexpectedError, (p) => {
      phase = p;
    });
  } catch (error) {
    if (error instanceof HandlerThrewError) {
      // Not caught by any further try/catch: `handleHandlerError` writes
      // stderr, cleans up, and exits with code 2. Never returns.
      handleHandlerError(error.original);
    }
    handleUnexpectedError(error, phase, policy, onUnexpectedError);
    output = undefined;
  }

  // Exit-code BLOCK: the handler's own intentional signal (e.g.
  // `teammateIdleOutput({ stderr })`), unaffected by `policy` - only
  // *unexpected* exceptions are ever swallowed. Claude Code's hook-result
  // parser treats any stdout that parses as valid JSON as a success outcome
  // regardless of exit code - even exit 2 - so blocking via stderr only
  // takes effect when stdout carries no JSON at all. The stdout write is
  // therefore skipped entirely on this path (matching handleHandlerError's
  // existing no-stdout convention), never attempted alongside it.
  if (output?.stderr !== undefined) {
    phase = "cleanup";
    cleanup(policy, onUnexpectedError);
    process.stderr.write(output.stderr);
    process.exit(EXIT_CODES.BLOCK);
  }

  // Buffered until serialization succeeds so a failure can never produce
  // output concatenated onto an already-written partial response. Command
  // hooks with a plain-text protocol (e.g. WorktreeCreate, where Claude Code
  // reads stdout as the worktree path and chdirs into it) carry their
  // payload in `rawStdout` and bypass JSON serialization.
  phase = "serialize";
  let serializedText: string;
  try {
    serializedText = output?.rawStdout !== undefined ? output.rawStdout : JSON.stringify(output?.stdout ?? {});
  } catch (error) {
    handleUnexpectedError(error, "serialize", policy, onUnexpectedError);
    serializedText = "{}";
  }

  phase = "write";
  try {
    process.stdout.write(serializedText);
  } catch (error) {
    handleUnexpectedError(error, "write", policy, onUnexpectedError);
  }

  phase = "cleanup";
  cleanup(policy, onUnexpectedError);

  // Exit with success (handler errors exit via handleHandlerError with code 2)
  process.exit(EXIT_CODES.SUCCESS);
}
