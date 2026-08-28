/**
 * Antigravity hook event names, the grouped/flat structural split, and the
 * (empty) advisory allow-list.
 *
 * The host's hook reference — pinned in this directory's `CONTRACT.md` —
 * names five events and splits them structurally: `PreToolUse` and
 * `PostToolUse` wrap their handlers in a `{ matcher, hooks }` group, while
 * `PreInvocation`, `PostInvocation`, and `Stop` list handler objects
 * directly and ignore any matcher. {@link EVENTS_WITH_MATCHER} is that split,
 * and `cli-support.ts` emits `hooks.json` from it.
 *
 * The advisory allow-list is empty, and stays empty: the reference names no
 * event as safe to fail open. That default is load-bearing here in a way it
 * is not on the other two agents, because Antigravity has no exit-code
 * channel at all (every event is payload-only — see `transport.ts` and
 * `outputs.ts`'s {@link AntigravityBlockError}), so a fail-open swallow has
 * no loud path to degrade to. `AntigravityBlockError` is what would make
 * widening the list safe at all: an intentional block computed mid-throw
 * still survives `unexpectedError: "continue"` via `drive()`'s pre-policy
 * classification, exactly as it does for the other two agents.
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

/**
 * The two events whose `hooks.json` entry is grouped under a `matcher`. The
 * other three are flat: the host ignores a matcher on them entirely.
 */
export const EVENTS_WITH_MATCHER: readonly HookEventName[] = ["PreToolUse", "PostToolUse"];

/**
 * Events never allowed the fail-open `unexpectedError: "continue"` policy.
 *
 * Every shipped event. The host's hook reference names no event as safe to
 * fail open, so this is a transcribed conclusion, not a placeholder.
 */
export const EXCLUDED_FROM_ADVISORY = [...HOOK_EVENT_NAMES] as const satisfies readonly HookEventName[];

/** The exclusion set as a literal union. Currently every event. */
export type ExcludedEventName = (typeof EXCLUDED_FROM_ADVISORY)[number];

/** Type-level membership check: `true` for every event name today. */
export type IsExcludedEvent<TEventName extends HookEventName> = TEventName extends ExcludedEventName ? true : false;

/** The advisory allow-list as a literal union: every event except {@link ExcludedEventName} — currently `never`. */
export type AdvisoryEventName = Exclude<HookEventName, ExcludedEventName>;

/** The advisory allow-list. Empty: `CONTRACT.md` names no event safe to fail open. */
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
