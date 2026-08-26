/**
 * Claude Code hook event names and the advisory fail-open allow-list.
 *
 * `HOOK_EVENT_NAMES` is copied verbatim from `claude-code-hooks/src/types.ts`
 * (all 30 events, same order). The advisory allow-list is **not** authored
 * here: per the plan's derivation rule it is transcribed from CARD.md:75 —
 * quoted below above `EXCLUDED_FROM_ADVISORY` — and `ADVISORY_EVENTS` is
 * derived mechanically as "every event except the exclusion set". The unit
 * test in `tests/agents/claude-code/` transcribes the same sentence a second
 * time, independently, so the runtime list and the test oracle are two
 * copies of the citation rather than one list read twice.
 * @module
 */

import type { UnexpectedErrorPolicy } from "../../core/types.js";
import type { HookEventName } from "./types.js";

/**
 * All Claude Code hook event names as a readonly array.
 *
 * Useful for iteration and validation.
 * @example
 * ```typescript
 * for (const eventName of HOOK_EVENT_NAMES) {
 *   console.log(`Supported hook: ${eventName}`);
 * }
 * ```
 */
export const HOOK_EVENT_NAMES = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "Notification",
  "UserPromptExpansion",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
  "PermissionRequest",
  "PermissionDenied",
  "Setup",
  "TeammateIdle",
  "TaskCreated",
  "TaskCompleted",
  "Elicitation",
  "ElicitationResult",
  "ConfigChange",
  "InstructionsLoaded",
  "WorktreeCreate",
  "WorktreeRemove",
  "CwdChanged",
  "FileChanged",
  "MessageDisplay",
] as const satisfies readonly HookEventName[];

/**
 * Events never allowed the fail-open `unexpectedError: "continue"` policy.
 *
 * Transcribed verbatim from CARD.md:75:
 *
 * > `unexpectedError: "continue"` is rejected at the type level and at
 * > runtime for any event not on that agent's advisory list (never
 * > `PreToolUse`, `PermissionRequest`, blocking `Stop`/`SubagentStop`,
 * > `WorktreeCreate`/`WorktreeRemove` on Claude Code; ...).
 *
 * The first five refuse because a swallowed failure silently grants the very
 * decision the hook was supposed to make; the worktree pair additionally
 * speaks a plain-text stdout protocol with no safe generic fallback, so a
 * swallowed failure would write literal `{}` where the host expects a path.
 */
export const EXCLUDED_FROM_ADVISORY = [
  "PreToolUse",
  "PermissionRequest",
  "Stop",
  "SubagentStop",
  "WorktreeCreate",
  "WorktreeRemove",
] as const satisfies readonly HookEventName[];

/**
 * Type-level membership check for the advisory allow-list.
 *
 * Resolves to `true` only for event names excluded from the allow-list.
 */
export type IsExcludedEvent<TEventName extends HookEventName> = TEventName extends ExcludedEventName ? true : false;

/** The exclusion set as a literal union. */
export type ExcludedEventName = (typeof EXCLUDED_FROM_ADVISORY)[number];

/** The advisory allow-list as a literal union: every event except {@link ExcludedEventName}. */
export type AdvisoryEventName = Exclude<HookEventName, ExcludedEventName>;

/**
 * The advisory allow-list: every Claude Code event except
 * {@link EXCLUDED_FROM_ADVISORY}. Only these events accept
 * `unexpectedError: "continue"` — enforced at factory-call time by the
 * policy gate injected into {@link ../core/define-hook.ts|defineHook} and at
 * compile time by the excluded events' narrowed config types.
 */
export const ADVISORY_EVENTS: readonly AdvisoryEventName[] = HOOK_EVENT_NAMES.filter(
  (eventName): eventName is AdvisoryEventName =>
    !(EXCLUDED_FROM_ADVISORY as readonly HookEventName[]).includes(eventName),
);

/**
 * The policy type an event may carry, narrowed by allow-list membership.
 *
 * Advisory events keep the full `"error" | "continue"` union; every excluded
 * event collapses to `"error"`, so passing `"continue"` there is rejected at
 * compile time (and again at factory-call time by the runtime gate).
 */
export type AllowedUnexpectedErrorPolicy<TEventName extends HookEventName> =
  IsExcludedEvent<TEventName> extends true ? Exclude<UnexpectedErrorPolicy, "continue"> : UnexpectedErrorPolicy;
