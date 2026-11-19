/** Shared factory/build-time validation prevents silently ignored security options. */
import { ADVISORY_EVENTS, EVENTS_WITH_MATCHER, LOOP_EVENTS, PERMISSION_EVENTS } from "./events.js";
import type { HookConfig } from "./hooks.js";
import type { HookEventName } from "./types.js";

/** Validate both JavaScript callers and statically extracted build configuration. */
export function validateHookConfig(event: HookEventName, config: HookConfig): void {
  if (
    config.matcher !== undefined &&
    (typeof config.matcher !== "string" || !(EVENTS_WITH_MATCHER as readonly string[]).includes(event))
  ) {
    throw new Error(`${event} does not accept this matcher`);
  }
  if (
    config.failClosed !== undefined &&
    (typeof config.failClosed !== "boolean" || !(PERMISSION_EVENTS as readonly string[]).includes(event))
  ) {
    throw new Error(`failClosed is only supported on Cursor permission-bearing events`);
  }
  if (
    config.timeout !== undefined &&
    (typeof config.timeout !== "number" || !Number.isFinite(config.timeout) || config.timeout <= 0)
  ) {
    throw new Error("Cursor timeout must be a finite positive number of milliseconds");
  }
  if (
    config.loopLimit !== undefined &&
    (!(LOOP_EVENTS as readonly string[]).includes(event) ||
      (config.loopLimit !== null && (!Number.isSafeInteger(config.loopLimit) || config.loopLimit < 0)))
  ) {
    throw new Error("loopLimit must be a nonnegative integer or null, on stop/subagentStop only");
  }
  if (
    config.unexpectedError !== undefined &&
    config.unexpectedError !== "error" &&
    (config.unexpectedError !== "continue" || !(ADVISORY_EVENTS as readonly string[]).includes(event))
  ) {
    throw new Error(`Policy gate rejected "${event}"`);
  }
}

/** Permission hooks default to host-enforced fail-closed behavior, including timeouts. */
export function defaultFailClosed(event: HookEventName, value?: boolean): boolean | undefined {
  return (PERMISSION_EVENTS as readonly string[]).includes(event) ? (value ?? true) : undefined;
}
