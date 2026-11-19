/** Typed Cursor factories backed by the shared hook driver. */
import { defineHook } from "../../core/define-hook.js";
import type { HookConfig as CoreConfig, HookFunction as CoreFunction, HookContext } from "../../core/types.js";
import { defaultFailClosed, validateHookConfig } from "./config.js";
import type { AllowedUnexpectedErrorPolicy, EVENTS_WITH_MATCHER, LOOP_EVENTS, PERMISSION_EVENTS } from "./events.js";
import type { OutputByEvent } from "./outputs.js";
import type { HookEventName, InputByEvent } from "./types.js";

export type { HookContext, UnexpectedErrorHandler, UnexpectedErrorPolicy } from "../../core/types.js";

export interface HookConfig extends Omit<CoreConfig, "createContext"> {
  /** Defaults to true on permission-bearing events. Emitted into the Cursor manifest. */
  failClosed?: boolean;
  /** Cursor's per-script follow-up cap. Omit for 5, or use null for no cap. */
  loopLimit?: number | null;
}

export type HookConfigFor<E extends HookEventName> = Omit<
  HookConfig,
  "matcher" | "failClosed" | "loopLimit" | "unexpectedError"
> & {
  matcher?: E extends (typeof EVENTS_WITH_MATCHER)[number] ? string : never;
  failClosed?: E extends (typeof PERMISSION_EVENTS)[number] ? boolean : never;
  loopLimit?: E extends (typeof LOOP_EVENTS)[number] ? number | null : never;
  unexpectedError?: AllowedUnexpectedErrorPolicy<E>;
};

export interface HookFunction<E extends HookEventName>
  extends CoreFunction<InputByEvent[E], OutputByEvent[E] | undefined> {
  hookEventName: E;
  failClosed?: boolean;
  loopLimit?: number | null;
}

type Handler<E extends HookEventName> = (
  input: InputByEvent[E],
  context: HookContext,
) => OutputByEvent[E] | undefined | null | Promise<OutputByEvent[E] | undefined | null>;

function factory<E extends HookEventName>(event: E) {
  return (config: HookConfigFor<E>, handler: Handler<E>): HookFunction<E> => {
    validateHookConfig(event, config);
    const hook = defineHook<InputByEvent[E], OutputByEvent[E] | undefined>(event, config, handler);
    return Object.assign(hook, {
      hookEventName: event,
      failClosed: defaultFailClosed(event, config.failClosed),
      loopLimit: config.loopLimit,
    });
  };
}

/** Session initialization is fire-and-forget; it cannot block session creation. */
export const sessionStartHook = factory("sessionStart");
/** Gate tool execution or replace its input. */
export const preToolUseHook = factory("preToolUse");
/** Enrich successful results; MCP output replacement is MCP-only. */
export const postToolUseHook = factory("postToolUse");
/** Allow or prevent prompt submission; this event cannot inject context. */
export const beforeSubmitPromptHook = factory("beforeSubmitPrompt");
/** Request an automatic follow-up after the agent finishes. */
export const stopHook = factory("stop");
/** Follow-ups are consumed only for completed subagents. */
export const subagentStopHook = factory("subagentStop");
