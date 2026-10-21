/** OpenCode V2 plugin authoring helpers. @module */
import type { AdvisoryEventName } from "./events.js";
import { applyOpenCodeErrorPolicy, type UnexpectedErrorHandler, type UnexpectedErrorPolicy } from "./policy.js";
import type { OpenCodeHookHandler, PluginInput, PluginModule } from "./types.js";

/** Validates a V2 plugin definition before OpenCode loads it. */
export function defineOpenCodePlugin(definition: PluginModule): PluginModule {
  if (typeof definition.id !== "string" || definition.id.trim().length === 0) {
    throw new Error('defineOpenCodePlugin: "id" must be a non-empty string');
  }
  if (typeof definition.setup !== "function") {
    throw new Error('defineOpenCodePlugin: "setup" must be a function');
  }
  return definition;
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
  const parentBySessionId = new Map<string, string | undefined>();
  const resumedSessionIds = new Set<string>();

  const recordIfUnseen = (sessionId: string, parentId: string | undefined, resumed: boolean): void => {
    if (parentBySessionId.has(sessionId)) {
      return;
    }
    parentBySessionId.set(sessionId, parentId);
    if (resumed) {
      resumedSessionIds.add(sessionId);
    }
  };

  return {
    observe(sessionId, parentId) {
      recordIfUnseen(sessionId, parentId, false);
    },
    observeResumed(sessionId, parentId) {
      recordIfUnseen(sessionId, parentId, true);
    },
    isRoot(sessionId) {
      return parentBySessionId.get(sessionId) === undefined;
    },
    isResumed(sessionId) {
      return resumedSessionIds.has(sessionId);
    },
  };
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
  name: TName,
  handler: OpenCodeHookHandler<TName>,
  policy: UnexpectedErrorPolicy | undefined,
  onError?: UnexpectedErrorHandler,
): OpenCodeHookHandler<TName> {
  return applyOpenCodeErrorPolicy(
    name,
    handler as (...args: unknown[]) => Promise<void> | void,
    policy,
    onError,
  ) as OpenCodeHookHandler<TName>;
}

export type { PluginInput };
