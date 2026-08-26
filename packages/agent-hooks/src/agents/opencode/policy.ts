/**
 * OpenCode error-policy application.
 *
 * Reuses only the host-neutral policy vocabulary from
 * {@link ../../core/types.ts} — not {@link ../../core/define-hook.ts|defineHook}
 * itself, which is built around a single one-shot handler call and doesn't
 * fit OpenCode's long-lived, heterogeneous callback map.
 * @module
 */

import type { UnexpectedErrorHandler, UnexpectedErrorPolicy } from "../../core/types.js";

export type { UnexpectedErrorHandler, UnexpectedErrorPolicy };

/**
 * Wraps an advisory OpenCode callback so an unexpected throw is handled
 * per `policy` instead of propagating to the OpenCode server process.
 *
 * - `"error"` (default): rethrows unchanged.
 * - `"continue"`: swallows the error, invokes `onError` (if provided) as a
 *   best-effort diagnostic sink, and resolves instead of rejecting.
 *
 * Never call this for a policy-enforcing callback (see
 * {@link ./events.ts|POLICY_ENFORCING_EVENTS}) — {@link ./plugin.ts|guardAdvisory}
 * is the only intended caller and restricts callback names accordingly.
 *
 * @param name - The callback name, used only for the diagnostic sink.
 * @param handler - The callback implementation to guard.
 * @param policy - The configured policy; `undefined` behaves as `"error"`.
 * @param onError - Best-effort diagnostic sink for a swallowed `"continue"` error.
 * @throws Error the handler threw is thrown when `policy` is `"error"`.
 */
export function applyOpenCodeErrorPolicy<TArgs extends unknown[]>(
  _name: string,
  _handler: (...args: TArgs) => Promise<void>,
  _policy: UnexpectedErrorPolicy | undefined,
  _onError?: UnexpectedErrorHandler,
): (...args: TArgs) => Promise<void> {
  throw new Error("Not Implemented");
}
