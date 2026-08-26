/**
 * Wire transport for Codex hooks, rewritten against the core
 * `drive()`/`Transport` interface; the wire semantics carry over
 * `codex-hooks/src/runtime.ts` verbatim:
 *
 * - **BlockError → its reason written to stderr + exit 2, regardless of
 *   policy** — a single translation for every event including
 *   `SubagentStart`; there is deliberately no per-event table here (Codex
 *   has no narrower native deny shape than the stderr channel). The source
 *   runtime already classified `BlockError` ahead of the policy branch; that
 *   precedence now lives in `drive()` via {@link BlockError} extending the
 *   core `HookBlockError`.
 * - every other unexpected failure (stdin read, parse, handler, serialize,
 *   write, cleanup) under the default `"error"` policy → stacktrace on
 *   stderr + exit 1 (`ERROR`) — note Codex exits **1**, unlike Claude Code's
 *   handler-error exit 2; under `"continue"` → reported and swallowed to the
 *   event's valid empty output `{}` at exit 0. Malformed stdin is therefore
 *   NOT unconditionally fail-open on Codex — the policy decides, exactly as
 *   in the source runtime.
 * - success → `JSON.stringify(output.stdout)` at exit 0; a `null`/`undefined`
 *   result serializes as `{}`, valid for every event's output schema.
 * - a returned `stderr` **field** on an output object is carried by
 *   `convertToHookOutput` but discarded by the success path — the source
 *   runtime only ever serialized `output.stdout`; blocking is expressed
 *   exclusively through the thrown-`BlockError` channel.
 *
 * String returns (`"Loaded from text"`) are normalized into the event's
 * additionalContext output for the three text-output events; any other event
 * rejecting plain text throws exactly like the source, flowing through the
 * standard policy-gated error path.
 * @module
 * @example
 * ```typescript
 * // In a compiled hook file
 * import { execute } from './transport.js';
 * import myHook from './my-hook.js';
 *
 * execute(myHook);
 * ```
 */

import type { FinalizedResult, HookOutcome, Transport } from "../../core/transport.js";
import { drive } from "../../core/transport.js";
import { EVENTS_WITH_TEXT_OUTPUT } from "./constants.js";
import type { HookFunction } from "./hooks.js";
import {
  BlockError,
  EXIT_CODES,
  type SpecificHookOutput,
  sessionStartOutput,
  subagentStartOutput,
  userPromptSubmitOutput,
} from "./outputs.js";
import type { HookEventName, HookInput } from "./types.js";

/**
 * Converts a SpecificHookOutput to the wire shape by stripping the `_type`
 * discriminator (source parity: builders produce wire-format directly).
 */
export function convertToHookOutput(output: SpecificHookOutput): {
  stdout: SpecificHookOutput["stdout"];
  stderr?: string;
} {
  return output.stderr !== undefined ? { stdout: output.stdout, stderr: output.stderr } : { stdout: output.stdout };
}

function formatErrorText(error: unknown): string {
  return error instanceof Error ? `${error.stack ?? error.message}\n` : `${String(error)}\n`;
}

/**
 * Normalizes a plain-string handler return into the event's additionalContext
 * output; non-text events reject strings with the source package's exact
 * error, which then flows through the standard policy-gated error path.
 */
export function normalizeStringOutput(hookEventName: HookEventName, result: string): SpecificHookOutput {
  if (!EVENTS_WITH_TEXT_OUTPUT.has(hookEventName)) {
    throw new Error(`${hookEventName} hooks cannot return plain text`);
  }
  if (hookEventName === "SessionStart") {
    return sessionStartOutput({ additionalContext: result });
  }
  if (hookEventName === "SubagentStart") {
    return subagentStartOutput({ additionalContext: result });
  }
  return userPromptSubmitOutput({ additionalContext: result });
}

// ============================================================================
// Transport
// ============================================================================

/**
 * Builds the Codex wire transport. Unlike the Claude Code adapter there is no
 * per-event block-shape table: every caught {@link BlockError} translates to
 * `stderr: reason + "\n"` at exit 2 under every policy value, and no
 * `rawStdout` predicate exists because Codex has no plain-text-stdout
 * protocol events (the `rawOutput()` builder is ordinary JSON passthrough).
 */
export function createCodexTransport(): Transport<SpecificHookOutput | undefined> {
  return {
    finalize(outcome: HookOutcome<SpecificHookOutput | undefined>): FinalizedResult {
      switch (outcome.kind) {
        case "response":
        case "rawStdout": {
          // The rawStdout outcome cannot occur for Codex (no plain-text
          // protocol events, no rawStdout predicate) but the union demands
          // handling; it serializes as the empty response.
          const stdoutJson =
            outcome.kind === "response" && outcome.output !== null && outcome.output !== undefined
              ? JSON.stringify(convertToHookOutput(outcome.output).stdout)
              : "{}";
          return { stdout: stdoutJson, exitCode: EXIT_CODES.SUCCESS };
        }

        case "block": {
          const reason = outcome.error instanceof BlockError ? outcome.error.reason : outcome.error.message;
          return { stderr: `${reason}\n`, exitCode: EXIT_CODES.BLOCK };
        }

        case "handlerError": {
          // Codex surfaces EVERY unexpected failure — stdin read/parse
          // included — through one policy gate exiting ERROR(1) on the
          // default policy; malformed stdin is not unconditionally fail-open
          // here (that is Claude Code's rule, not Codex's).
          return { stderr: formatErrorText(outcome.error), exitCode: EXIT_CODES.ERROR };
        }
      }
    },
  };
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Executes a hook handler with full runtime orchestration (delegates to the
 * shared core driver with this agent's transport). String returns are
 * normalized before the driver sees them so that a plain-text violation
 * classifies through the same policy gate as any other handler failure,
 * matching the source runtime's observable wire behaviour.
 */
export async function execute<TInput extends HookInput, TOutput>(
  hookFn: HookFunction<TInput, TOutput, HookEventName>,
): Promise<void> {
  const eventName = hookFn.hookEventName;

  const composed = ((input: TInput, context: Parameters<typeof hookFn>[1]) => {
    const result = hookFn(input, context);
    const normalize = (value: TOutput | null): TOutput | null => {
      if (typeof value === "string") {
        return normalizeStringOutput(eventName, value) as unknown as TOutput;
      }
      return value;
    };
    return result instanceof Promise ? result.then(normalize) : normalize(result as TOutput | null);
  }) as unknown as HookFunction<TInput, TOutput, HookEventName>;

  composed.eventName = hookFn.eventName ?? eventName;
  composed.matcher = hookFn.matcher;
  composed.timeout = hookFn.timeout;
  composed.unexpectedError = hookFn.unexpectedError;
  composed.onUnexpectedError = hookFn.onUnexpectedError;
  composed.createContext = hookFn.createContext;

  await drive(createCodexTransport(), composed as Parameters<typeof drive>[1]);
}
