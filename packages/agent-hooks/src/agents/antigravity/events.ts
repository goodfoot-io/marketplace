/**
 * Antigravity hook event names and the (currently empty) advisory allow-list.
 *
 * Unlike Claude Code's and Codex's allow-lists, which transcribe a named set
 * of enrichment hooks out of a shipped README, Antigravity has no in-repo
 * doc to transcribe from this release (Step 0 descope — see the plan's Step
 * 5 blockquote). The allow-list therefore defaults to **every event
 * excluded**, not a curated subset, until a future card's `CONTRACT.md`
 * names a specific enrichment hook safe to opt into `unexpectedError:
 * "continue"`.
 *
 * That default is itself gated on a second precondition: because Antigravity
 * has no exit-code channel at all (every event is payload-only — see
 * `transport.ts` and `outputs.ts`'s {@link AntigravityBlockError}), a
 * fail-open swallow on this agent has no narrower fallback than Claude
 * Code's or Codex's — there is no stderr+exit-2 loud path to fall back to.
 * `AntigravityBlockError` landing first (this same step) is what makes it
 * safe to ever widen this list at all: an intentional block computed
 * mid-throw still survives `unexpectedError: "continue"` via `drive()`'s
 * pre-policy classification, exactly as it does for the other two agents.
 * @module
 */

import type { UnexpectedErrorPolicy } from "../../core/types.js";
import type { HookEventName } from "./types.js";

/** All Antigravity hook event names as a readonly array. */
export const HOOK_EVENT_NAMES = [
  "PreToolUse",
  "PostToolUse",
  "PreInvocation",
  "PostInvocation",
  "Stop",
] as const satisfies readonly HookEventName[];

/** The two events whose config accepts a `matcher` (plan step 5.3: "matcher on the two ToolUse events"). */
export const EVENTS_WITH_MATCHER: readonly HookEventName[] = ["PreToolUse", "PostToolUse"];

/**
 * Events never allowed the fail-open `unexpectedError: "continue"` policy.
 *
 * Every shipped event, by default — see module docs. This is a stated
 * default (plan Decisions: "advisory list default empty until CONTRACT.md
 * justifies an entry"), not a silent gap.
 */
export const EXCLUDED_FROM_ADVISORY = [...HOOK_EVENT_NAMES] as const satisfies readonly HookEventName[];

/** The exclusion set as a literal union. Currently every event. */
export type ExcludedEventName = (typeof EXCLUDED_FROM_ADVISORY)[number];

/** Type-level membership check: `true` for every event name today. */
export type IsExcludedEvent<TEventName extends HookEventName> = TEventName extends ExcludedEventName ? true : false;

/** The advisory allow-list as a literal union: every event except {@link ExcludedEventName} — currently `never`. */
export type AdvisoryEventName = Exclude<HookEventName, ExcludedEventName>;

/** The advisory allow-list. Empty until a future `CONTRACT.md` names an entry. */
export const ADVISORY_EVENTS: readonly AdvisoryEventName[] = HOOK_EVENT_NAMES.filter(
  (eventName): eventName is AdvisoryEventName =>
    !(EXCLUDED_FROM_ADVISORY as readonly HookEventName[]).includes(eventName),
);

/**
 * The policy type an event may carry, narrowed by allow-list membership.
 * Every event collapses to `"error"` today, since {@link ADVISORY_EVENTS} is
 * empty.
 */
export type AllowedUnexpectedErrorPolicy<TEventName extends HookEventName> =
  IsExcludedEvent<TEventName> extends true ? Exclude<UnexpectedErrorPolicy, "continue"> : UnexpectedErrorPolicy;
