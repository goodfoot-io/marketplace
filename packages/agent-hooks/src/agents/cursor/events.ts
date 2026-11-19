/** Cursor event capabilities; not inferred from another agent's event names. */
import type { UnexpectedErrorPolicy } from "../../core/types.js";
import type { HookEventName } from "./types.js";

export const HOOK_EVENT_NAMES = [
  "sessionStart",
  "preToolUse",
  "postToolUse",
  "beforeSubmitPrompt",
  "stop",
  "subagentStop",
] as const satisfies readonly HookEventName[];

/** sessionStart has no documented matcher semantics. */
export const EVENTS_WITH_MATCHER = [
  "preToolUse",
  "postToolUse",
  "beforeSubmitPrompt",
  "stop",
  "subagentStop",
] as const satisfies readonly HookEventName[];

export const PERMISSION_EVENTS = ["preToolUse", "beforeSubmitPrompt"] as const;
export const LOOP_EVENTS = ["stop", "subagentStop"] as const;
/** Only context-enrichment events may opt into swallowing unexpected failures. */
export const ADVISORY_EVENTS = ["sessionStart", "postToolUse"] as const;
export const EXCLUDED_FROM_ADVISORY = ["preToolUse", "beforeSubmitPrompt", "stop", "subagentStop"] as const;
export type AdvisoryEventName = (typeof ADVISORY_EVENTS)[number];
export type ExcludedEventName = (typeof EXCLUDED_FROM_ADVISORY)[number];
export type IsExcludedEvent<E extends HookEventName> = E extends ExcludedEventName ? true : false;
export type AllowedUnexpectedErrorPolicy<E extends HookEventName> = E extends AdvisoryEventName
  ? UnexpectedErrorPolicy
  : "error";
