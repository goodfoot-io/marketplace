/**
 * Wire transport for Claude Code hooks.
 *
 * Rewritten against the core `drive()`/`Transport` interface (plan step 2.1);
 * the wire semantics carried over from the source runtime are:
 *
 * - success → output JSON serialized to stdout, exit 0 (empty object `{}`
 *   when the handler returned nothing);
 * - a returned `stderr` payload → that message written to stderr, exit code
 *   `EXIT_CODES.BLOCK` (2) and **no stdout write at all** — Claude Code's
 *   hook-result parser treats any stdout that parses as JSON as success
 *   regardless of exit code, so blocking via stderr only takes effect when
 *   stdout carries no JSON;
 * - an unexpected handler error under the default `"error"` policy → its
 *   stacktrace on stderr, exit 2, no stdout;
 * - malformed/unreadable stdin → fail-open unconditionally, `{}` + exit 0;
 * - worktree events (`WorktreeCreate`, always; `WorktreeRemove`, when a path
 *   is supplied) carry their plain-text payload in `rawStdout`, which is
 *   written verbatim — the host reads stdout as the worktree path.
 *
 * Plus the class-finding fix new to this package: a caught
 * {@link HookBlockError} — classified by `drive()` **before** policy is ever
 * consulted — is translated per event via {@link BLOCK_SHAPE_BY_EVENT}
 * (`PreToolUse`/`PermissionRequest` get their narrower native deny shapes,
 * every other event gets `{ continue: false, stopReason }`), so an advisory
 * event's intentional block survives even when the decision computation
 * itself throws mid-way.
 * @module
 * @example
 * ```typescript
 * // In a compiled hook file
 * import { execute } from './transport.js';
 * import myHook from './my-hook.js';
 *
 * execute(myHook);
 * ```
 * @see https://code.claude.com/docs/en/hooks
 */

import { logger } from "../../core/logger.js";
import type { FinalizedResult, HookBlockError, HookOutcome, Transport } from "../../core/transport.js";
import { drive } from "../../core/transport.js";
import type { HookFunction } from "../../core/types.js";
import { HOOK_EVENT_NAMES } from "./events.js";
import type { SpecificHookOutput, SyncHookJSONOutput } from "./outputs.js";
import { EXIT_CODES } from "./outputs.js";
import type { HookEventName, HookInput } from "./types.js";

// ============================================================================
// Block Translation
// ============================================================================

/**
 * Per-event translation table for a caught {@link HookBlockError}.
 *
 * Absent events fall back to the whole-session shape
 * (`{ continue: false, stopReason }`). The two entries present here are the
 * events whose native protocol refuses *that one tool call* rather than
 * halting the session — reusing exactly the shapes `outputs.ts`'s builders
 * produce natively:
 *
 * - `PreToolUse` → `hookSpecificOutput.permissionDecision: "deny"`
 * - `PermissionRequest` → `hookSpecificOutput.decision.behavior: "deny"`
 */
export const BLOCK_SHAPE_BY_EVENT: Readonly<Partial<Record<HookEventName, (reason: string) => SyncHookJSONOutput>>> = {
  PermissionRequest: (reason) => ({
    hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: reason } },
  }),
  PreToolUse: (reason) => ({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }),
};

/**
 * Translates a caught {@link HookBlockError} into this event's block wire
 * payload. The lookup is per event ({@link BLOCK_SHAPE_BY_EVENT}), never a
 * single template applied everywhere; `error.fields` — when supplied by the
 * thrower — is merged on top for callers needing extra wire fields (e.g.
 * `interrupt` on a permission deny).
 */
function translateBlockToPayload(eventName: string, error: HookBlockError): SyncHookJSONOutput {
  const reason = error.message;
  const known = (HOOK_EVENT_NAMES as readonly string[]).includes(eventName) ? (eventName as HookEventName) : undefined;
  const payload: SyncHookJSONOutput =
    known !== undefined
      ? (BLOCK_SHAPE_BY_EVENT[known]?.(reason) ?? { continue: false, stopReason: reason })
      : { continue: false, stopReason: reason };
  if (error.fields !== undefined) {
    Object.assign(payload, error.fields);
  }
  return payload;
}

// ============================================================================
// Output Conversion
// ============================================================================

/**
 * Converts a SpecificHookOutput to HookOutput for wire format.
 *
 * SpecificHookOutput types have: { _type, stdout, stderr?, rawStdout? }
 * HookOutput has: { stdout, stderr?, rawStdout? }
 *
 * Since output builders now produce wire-format directly, this function
 * simply strips the `_type` discriminator field.
 * @param specificOutput - The specific output from a hook handler
 * @returns HookOutput ready for serialization
 * @see https://code.claude.com/docs/en/hooks#hook-output-structure
 */
export function convertToHookOutput(specificOutput: SpecificHookOutput): {
  stdout: SyncHookJSONOutput;
  stderr?: string;
  rawStdout?: string;
} {
  const { stdout, stderr, rawStdout } = specificOutput;
  const result: { stdout: SyncHookJSONOutput; stderr?: string; rawStdout?: string } = { stdout };
  if (stderr !== undefined) {
    result.stderr = stderr;
  }
  if (rawStdout !== undefined) {
    result.rawStdout = rawStdout;
  }
  return result;
}

/** Renders any thrown value the way the source runtime wrote it to stderr. */
function formatErrorText(error: unknown): string {
  return error instanceof Error ? `${error.stack ?? error.message}\n` : `${String(error)}\n`;
}

/**
 * Plain-text-protocol detector: which factories' outputs carry a bare-string
 * stdout payload the host reads verbatim. `WorktreeCreate` always does (its
 * builder requires `worktreePath`); `WorktreeRemove` only when a path was
 * supplied. Every other event returns undefined and stays on the JSON path.
 */
function detectRawStdout(output: SpecificHookOutput): string | undefined {
  if (output._type === "WorktreeCreate" || output._type === "WorktreeRemove") {
    return output.rawStdout;
  }
  return undefined;
}

// ============================================================================
// Transport
// ============================================================================

/**
 * Builds the Claude Code wire transport for one event.
 *
 * `policy`/`onUnexpectedError` close over the executing hook's configuration
 * purely to reproduce the source runtime's serialize-failure wiring: under
 * `"continue"` a serialization failure still emits `{}` at exit 0, while the
 * default `"error"` policy surfaces the stacktrace and exits
 * `EXIT_CODES.ERROR`. Every other policy decision (block precedence,
 * swallow-vs-surface of unexpected throws) lives in `drive()`.
 * @param eventName - The bound hook event name (drives the block translation)
 * @param policy - The executing hook's resolved fail-open policy
 * @param onUnexpectedError - Optional diagnostic sink, forwarded for parity
 * with the source runtime's serialize-failure reporting.
 */
export function createClaudeCodeTransport(
  eventName: string,
  policy: "error" | "continue",
  onUnexpectedError?: (error: unknown, phase: "serialize") => void,
): Transport<SpecificHookOutput> {
  return {
    finalize(outcome: HookOutcome<SpecificHookOutput>): FinalizedResult {
      switch (outcome.kind) {
        case "response": {
          const converted =
            outcome.output === null || outcome.output === undefined ? undefined : convertToHookOutput(outcome.output);

          // Exit-code BLOCK: the handler's own intentional signal (e.g.
          // `teammateIdleOutput({ stderr })`), unaffected by `policy`. No
          // stdout write on this path — see module docs.
          if (converted?.stderr !== undefined) {
            return { stderr: converted.stderr, exitCode: EXIT_CODES.BLOCK };
          }

          let serializedText: string;
          try {
            serializedText =
              converted?.rawStdout !== undefined ? converted.rawStdout : JSON.stringify(converted?.stdout ?? {});
          } catch (error) {
            logger.logError(error, "Failed to serialize hook output");
            if (policy !== "continue") {
              return { stderr: formatErrorText(error), exitCode: EXIT_CODES.ERROR };
            }
            onUnexpectedError?.(error, "serialize");
            serializedText = "{}";
          }
          return { stdout: serializedText, exitCode: EXIT_CODES.SUCCESS };
        }

        case "rawStdout":
          return { stdout: outcome.stdout, exitCode: EXIT_CODES.SUCCESS };

        case "block": {
          // Intentional block signal via HookBlockError: translated per event
          // onto the success channel (JSON stdout, exit 0) — never the
          // exit-code BLOCK path above, which carries no machine-readable
          // decision.
          return {
            stdout: JSON.stringify(translateBlockToPayload(eventName, outcome.error)),
            exitCode: EXIT_CODES.SUCCESS,
          };
        }

        case "handlerError": {
          // Malformed/unreadable stdin fails open unconditionally, matching
          // the source runtime's long-standing default for every hook.
          if (outcome.phase === "read" || outcome.phase === "parse") {
            logger.error(
              `Invalid JSON input: ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}`,
            );
            return { stdout: "{}", exitCode: EXIT_CODES.SUCCESS };
          }

          // Unexpected handler throw surfaced under the default policy:
          // stacktrace to stderr, exit 2 (BLOCK), no JSON on stdout.
          logger.error(
            `Hook handler error: ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}`,
          );
          return { stderr: formatErrorText(outcome.error), exitCode: EXIT_CODES.BLOCK };
        }
      }
    },

    rawStdout: detectRawStdout,
  };
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Executes a hook handler with full runtime orchestration (delegates to the
 * shared core driver with this agent's transport).
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
 * import { execute } from '@goodfoot/agent-hooks/claude-code/runtime';
 * import { preToolUseHook, preToolUseOutput } from '@goodfoot/agent-hooks/claude-code';
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
export async function execute<TInput extends HookInput, TOutput extends SpecificHookOutput>(
  hookFn: HookFunction<TInput, TOutput>,
): Promise<void> {
  const policy = hookFn.unexpectedError ?? "error";
  const transport = createClaudeCodeTransport(hookFn.eventName, policy, hookFn.onUnexpectedError);
  // Soundness note: a factory-built hook whose context extends the base (only
  // SessionStart today) attaches its own `createContext`, so `drive()` hands
  // the handler the extended context it declares; the variance narrowing here
  // never substitutes the base context for a required extended one.
  //
  // NOTE on the stream-write phase: the shared driver performs the buffered
  // stream writes after `finalize` without an unexpectedError-policy gate.
  // The source runtime gated that phase like every other unexpected failure
  // (reported + exit 0 under "continue", stacktrace + ERROR(1) under the
  // default policy); reproducing that here is impossible without re-catching
  // `drive()`'s own completion exits, which would intercept every legitimate
  // `process.exit` path. The gate belongs where the writes happen: see the
  // task-2 report for the exact core need.
  await drive(transport, hookFn as HookFunction<TInput, TOutput>);
}
