/**
 * Plugin authoring primitives for `@goodfoot/agent-hooks/opencode`.
 *
 * `defineOpenCodePlugin` validates the `{ id, server }` module contract that
 * OpenCode's real loader (`getServerPlugin`, verified live against
 * `sst/opencode`'s `packages/opencode/src/plugin/index.ts`) accepts as a
 * default export. `createRootSessionRegistry` and `guardAdvisory` are
 * optional composition helpers a `server` factory may call — not a required
 * framework, since a plugin author can also return a raw {@link Hooks}
 * object built directly from `./types.js`.
 * @module
 */

import type { AdvisoryEventName } from "./events.js";
import { applyOpenCodeErrorPolicy, type UnexpectedErrorHandler, type UnexpectedErrorPolicy } from "./policy.js";
import type { OpenCodeHookHandler, Plugin, PluginInput, PluginModule } from "./types.js";

/**
 * Validates and returns an OpenCode plugin module definition.
 *
 * @param definition - `id` must be a non-empty string; `server` must be a
 * function matching upstream's {@link Plugin} signature.
 * @returns `definition`, unchanged, once validated.
 * @throws Error when `id` is missing/empty or `server` is not a function.
 */
export function defineOpenCodePlugin(_definition: { id: string; server: Plugin }): PluginModule {
  throw new Error("Not Implemented");
}

/**
 * Tracks OpenCode session parentage and resumption across a plugin's
 * lifetime.
 *
 * Live testing of a prior implementation of this pattern found that a
 * *resumed* session does not necessarily re-emit `session.created` — it may
 * first appear only through later activity (e.g. `session.updated`,
 * `message.updated`) for a session id the registry has never observed. This
 * registry treats that as the resumed-session signal `isResumed` reports.
 */
export interface RootSessionRegistry {
  /**
   * Records that `sessionId` was observed via a `session.created` event,
   * optionally as a child of `parentId`. Idempotent: observing the same
   * `sessionId` twice does not change its recorded parentage or resumed
   * status.
   */
  observe(sessionId: string, parentId?: string): void;

  /**
   * Records that `sessionId` was observed via any event *other than*
   * `session.created` — the resumed-session signal. Idempotent the same way
   * as {@link observe}; calling either method after the other for the same
   * `sessionId` does not change its already-recorded resumed status.
   */
  observeResumed(sessionId: string, parentId?: string): void;

  /** `true` when `sessionId` has no recorded parent. */
  isRoot(sessionId: string): boolean;

  /**
   * `true` when `sessionId` was first observed through a non-`session.created`
   * event name rather than through `session.created` itself.
   */
  isResumed(sessionId: string): boolean;
}

/** Creates a fresh, empty {@link RootSessionRegistry}. */
export function createRootSessionRegistry(): RootSessionRegistry {
  throw new Error("Not Implemented");
}

/**
 * Wraps an advisory OpenCode callback with {@link applyOpenCodeErrorPolicy},
 * restricted at the type level to {@link AdvisoryEventName}s — a
 * policy-enforcing callback name is a compile-time error here, since
 * swallowing its failure would silently skip a security decision.
 *
 * @param name - An advisory callback name from `./types.js`'s `Hooks` map.
 * @param handler - The callback implementation to guard.
 * @param policy - The configured policy; `undefined` behaves as `"error"`.
 * @param onError - Best-effort diagnostic sink for a swallowed `"continue"` error.
 */
export function guardAdvisory<TName extends AdvisoryEventName>(
  _name: TName,
  _handler: OpenCodeHookHandler<TName>,
  _policy: UnexpectedErrorPolicy | undefined,
  _onError?: UnexpectedErrorHandler,
): OpenCodeHookHandler<TName> {
  throw new Error("Not Implemented");
}

export type { PluginInput };
