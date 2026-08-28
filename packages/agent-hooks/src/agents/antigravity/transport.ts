/**
 * Wire transport for Antigravity hooks, built against the core
 * `drive()`/`Transport` interface — the same seam Claude Code's and Codex's
 * transports are rewritten/re-exported against.
 *
 * Antigravity's wire semantics are the simplest of the four shipped agents,
 * and also the least forgiving: **every reply exits 0, unconditionally.**
 * There is no exit-code channel at all — not the 2-of-30-events native-deny
 * split Claude Code has, not Codex's uniform stderr+exit-2 `BlockError`
 * channel. Every decision (allow/deny/ask and its finer variants) and every
 * unexpected-failure diagnostic lives inside the JSON stdout payload:
 *
 * - success → `JSON.stringify(output.stdout)` at exit 0; `null`/`undefined`
 *   serializes as `{}`.
 * - a caught {@link AntigravityBlockError} → `{ decision: "deny", reason,
 *   ...fields }` on stdout at exit 0 — this is why the class is a stated
 *   prerequisite (`outputs.ts` module docs, `events.ts` module docs): with no
 *   exit-code fallback, a block computed mid-throw has nowhere else to land.
 *   The host acts on that decision for `PreToolUse`; on the other four events
 *   it is a well-formed reply carrying no decision the host recognizes.
 * - an unexpected handler/runtime failure → its stacktrace on stderr
 *   (diagnostic only, not a wire signal) plus the empty response `{}` on
 *   stdout, still at exit 0.
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
import type { HookFunction } from "./hooks.js";
import { AntigravityBlockError, EXIT_CODES, type SpecificHookOutput } from "./outputs.js";
import type { HookEventName, HookInput } from "./types.js";

function formatErrorText(error: unknown): string {
  return error instanceof Error ? `${error.stack ?? error.message}\n` : `${String(error)}\n`;
}

// ============================================================================
// Transport
// ============================================================================

/**
 * Builds the Antigravity wire transport. Every branch returns
 * `exitCode: EXIT_CODES.SUCCESS` — see module docs — so the only thing that
 * varies per outcome is what lands on stdout (the machine-readable payload)
 * versus stderr (a diagnostic no host is asserted to read).
 */
export function createAntigravityTransport(): Transport<SpecificHookOutput | undefined> {
  return {
    finalize(outcome: HookOutcome<SpecificHookOutput | undefined>): FinalizedResult {
      switch (outcome.kind) {
        case "response":
        case "rawStdout": {
          // rawStdout cannot occur here — no rawStdout predicate is
          // registered below — but the union demands handling.
          const stdoutJson =
            outcome.kind === "response" && outcome.output !== null && outcome.output !== undefined
              ? JSON.stringify(outcome.output.stdout)
              : "{}";
          return { stdout: stdoutJson, exitCode: EXIT_CODES.SUCCESS };
        }

        case "block": {
          const reason = outcome.error instanceof AntigravityBlockError ? outcome.error.reason : outcome.error.message;
          const fields = outcome.error.fields ?? {};
          return { stdout: JSON.stringify({ decision: "deny", reason, ...fields }), exitCode: EXIT_CODES.SUCCESS };
        }

        case "handlerError": {
          return {
            stderr: formatErrorText(outcome.error),
            stdout: "{}",
            exitCode: EXIT_CODES.SUCCESS,
          };
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
 * shared core driver with this agent's transport).
 */
export async function execute<TInput extends HookInput, TOutput>(
  hookFn: HookFunction<TInput, TOutput, HookEventName>,
): Promise<void> {
  await drive(createAntigravityTransport(), hookFn as unknown as Parameters<typeof drive>[1]);
}
