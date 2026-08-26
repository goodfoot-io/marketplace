/**
 * Generic hook factory primitive.
 *
 * `defineHook` is the agent-neutral seam every agent's per-event factory
 * builds on: the agent supplies its event name, its config shape, and an
 * optional policy gate enforcing that event's advisory allow-list. Core never
 * hardcodes an event list — validation is fully injected via
 * {@link HookPolicyGate} and fails closed when a gate rejects.
 * @module
 * @example
 * ```typescript
 * const hook = defineHook(
 *   "UserPromptSubmit",
 *   { unexpectedError: "continue" },
 *   async (input, { logger }) => {
 *     logger.info("Enriching prompt");
 *     return { additionalContext: "..." };
 *   },
 *   (eventName, policy) => policy === undefined || policy === "continue",
 * );
 * ```
 */

import type { HookConfig, HookContext, HookFunction, HookHandler, HookPolicyGate } from "./types.js";

/**
 * Creates a hook function for a specific agent event.
 *
 * @param eventName - The agent's event name (e.g. `"PreToolUse"`); attached
 * to the returned {@link HookFunction} as `eventName` for runtime inspection.
 * @param config - Hook configuration (matcher, timeout, unexpected-error
 * policy and diagnostics, optional context factory).
 * @param handler - The handler function to wrap.
 * @param policyGate - Optional per-event policy-validation closure injected
 * by the agent. Called with `(eventName, config.unexpectedError)`; returning
 * `false` or throwing rejects the configuration, and this function throws
 * (fail closed) instead of creating the hook.
 * @returns A wrapped hook function carrying its metadata for the driver.
 * @throws Error when `policyGate` rejects `(eventName, policy)`.
 */
export function defineHook<TInput, TOutput, TContext extends HookContext = HookContext>(
  eventName: string,
  config: HookConfig<TInput>,
  handler: HookHandler<TInput, TOutput, TContext>,
  policyGate?: HookPolicyGate,
): HookFunction<TInput, TOutput, TContext> {
  if (policyGate !== undefined) {
    let accepted: boolean;
    try {
      accepted = policyGate(eventName, config.unexpectedError);
    } catch (error) {
      throw new Error(`Policy gate rejected "${eventName}": ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!accepted) {
      throw new Error(`Policy gate rejected "${eventName}"`);
    }
  }

  const hookFn = async (input: TInput, context: TContext): Promise<TOutput | null> => {
    return await handler(input, context);
  };

  hookFn.eventName = eventName;
  hookFn.matcher = config.matcher;
  hookFn.timeout = config.timeout;
  hookFn.unexpectedError = config.unexpectedError;
  hookFn.onUnexpectedError = config.onUnexpectedError;
  hookFn.createContext = config.createContext;

  return hookFn;
}
