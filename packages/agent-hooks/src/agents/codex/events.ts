/**
 * Codex hook event names and the advisory fail-open allow-list.
 *
 * `HOOK_EVENT_NAMES` mirrors the `HookEventName` union in `types.ts` (10
 * events). The advisory allow-list is **not** authored here: per the plan's
 * derivation rule it is transcribed from `codex-hooks/README.md` — quoted
 * below above the provenance notes — and `ADVISORY_EVENTS` is derived
 * mechanically as "every event except the exclusion set". The unit test in
 * `tests/agents/codex/` transcribes the same sentence a second time,
 * independently, so the runtime list and the test oracle are two copies of
 * the citation rather than one list read twice.
 * @module
 */

import type { UnexpectedErrorPolicy } from "../../core/types.js";
import type { HookEventName } from "./types.js";

/**
 * All Codex hook event names as a readonly array (same order as the
 * `HookEventName` union).
 */
export const HOOK_EVENT_NAMES = [
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "UserPromptSubmit",
  "SessionStart",
  "SubagentStart",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
] as const satisfies readonly HookEventName[];

/**
 * Events never allowed the fail-open `unexpectedError: "continue"` policy.
 *
 * Transcribed verbatim from codex-hooks/README.md (Fail-Open Execution
 * section):
 *
 * > Only opt in for **advisory enrichment hooks** — ones that add optional
 * > context and whose failure should be invisible to the user (e.g.
 * > `UserPromptSubmit`, `SessionStart`, `SubagentStart` context nudges). Do
 * > not use `"continue"` for hooks that make permission, safety, or policy
 * > decisions (`PreToolUse`, `PermissionRequest`, blocking
 * > `PostToolUse`/`Stop`/`SubagentStop` checks) — silently swallowing a
 * > failure there means the hook's decision was silently skipped.
 *
 * Provenance of each element:
 *
 * - `PreToolUse`, `PermissionRequest`, blocking `PostToolUse`/`Stop`/
 *   `SubagentStop` — named verbatim in the README sentence above.
 * - `PreCompact`, `PostCompact` — **not mentioned anywhere in the README**;
 *   excluded by default (fail-closed) until a future card's docs justify an
 *   entry. This is a stated default, not a silent gap (plan Decisions).
 */
export const EXCLUDED_FROM_ADVISORY = [
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
] as const satisfies readonly HookEventName[];

/** The exclusion set as a literal union. */
export type ExcludedEventName = (typeof EXCLUDED_FROM_ADVISORY)[number];

/** Type-level membership check: `true` only for excluded event names. */
export type IsExcludedEvent<TEventName extends HookEventName> = TEventName extends ExcludedEventName ? true : false;

/** The advisory allow-list as a literal union: every event except {@link ExcludedEventName}. */
export type AdvisoryEventName = Exclude<HookEventName, ExcludedEventName>;

/**
 * The advisory allow-list: every Codex event except
 * {@link EXCLUDED_FROM_ADVISORY} — exactly the README's three named
 * enrichment hooks. Only these accept `unexpectedError: "continue"`,
 * enforced at factory-call time by the injected policy gate and at compile
 * time by the excluded events' narrowed config types.
 */
export const ADVISORY_EVENTS: readonly AdvisoryEventName[] = HOOK_EVENT_NAMES.filter(
  (eventName): eventName is AdvisoryEventName =>
    !(EXCLUDED_FROM_ADVISORY as readonly HookEventName[]).includes(eventName),
);

/**
 * The policy type an event may carry, narrowed by allow-list membership:
 * advisory events keep `"error" | "continue"`; every excluded event collapses
 * to `"error"`.
 */
export type AllowedUnexpectedErrorPolicy<TEventName extends HookEventName> =
  IsExcludedEvent<TEventName> extends true ? Exclude<UnexpectedErrorPolicy, "continue"> : UnexpectedErrorPolicy;
