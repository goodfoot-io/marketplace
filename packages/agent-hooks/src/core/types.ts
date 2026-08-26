/**
 * Shared core types for `@goodfoot/agent-hooks`.
 *
 * Core is agent-neutral: it owns the policy vocabulary, the hook-function
 * shape, and the context contract, but never an event list — each agent
 * (Claude Code, Codex, Antigravity) injects its own event names and its own
 * advisory allow-list through {@link HookPolicyGate}.
 * @module
 */

import type { Logger } from "./logger.js";

/**
 * Policy governing what happens when an *unexpected* error occurs.
 *
 * `"error"` (default) preserves existing behavior: an unhandled exception
 * anywhere in the runtime (stdin read/parse already fail open unconditionally;
 * this governs handler throws, output serialization, the stdout write, and
 * logger cleanup) surfaces the failure to the agent transport, which owns the
 * wire rules for it.
 *
 * `"continue"` is an opt-in fail-open policy for advisory hooks whose only
 * purpose is to enrich context. Under this policy, unexpected runtime
 * failures are swallowed, the empty response is produced if no response was
 * already produced, and the process exits 0 instead of surfacing a failed-hook
 * banner to the user. A {@link HookBlockError} thrown by a handler is
 * unaffected: it is always classified as a block outcome regardless of policy.
 */
export type UnexpectedErrorPolicy = "error" | "continue";

/**
 * The runtime phase in which an unexpected error occurred.
 */
export type HookErrorPhase = "read" | "parse" | "handler" | "serialize" | "write" | "cleanup";

/**
 * Best-effort diagnostic sink for unexpected errors under the "continue"
 * policy. Called in addition to (not instead of) the runtime's own logger.
 * Errors thrown by this handler are swallowed — a broken diagnostic sink
 * must never itself fail the invocation.
 */
export type UnexpectedErrorHandler = (error: unknown, phase: HookErrorPhase) => void;

/**
 * Configuration options shared by every agent's hook factories.
 *
 * Agent-specific config fields (e.g. Claude Code's typed matchers) extend
 * this interface; core only owns the fields both source packages share.
 */
export interface HookConfig<TInput = unknown> {
  /**
   * Regular expression pattern for matching hook events, if the agent's
   * event model supports matching.
   */
  matcher?: string;

  /**
   * Handler execution timeout in milliseconds.
   */
  timeout?: number;

  /**
   * Opt-in fail-open policy for unexpected runtime failures. Defaults to
   * `"error"`. See {@link UnexpectedErrorPolicy} for the full contract.
   */
  unexpectedError?: UnexpectedErrorPolicy;

  /**
   * Best-effort diagnostic callback invoked when `unexpectedError: "continue"`
   * swallows an unexpected runtime failure. See {@link UnexpectedErrorHandler}.
   */
  onUnexpectedError?: UnexpectedErrorHandler;

  /**
   * Optional per-event context factory. When provided, the driver calls it
   * with the parsed input to build the context handed to the handler;
   * otherwise handlers receive the base context (`{ logger }`).
   */
  createContext?: (input: TInput) => HookContext;
}

/**
 * The base execution context passed to every hook handler.
 *
 * Agents may extend the context per event (e.g. Claude Code's SessionStart
 * context adds env-persistence utilities) via their own factory typing on top
 * of {@link defineHook}'s `createContext` seam.
 */
export interface HookContext {
  logger: Logger;
}

/**
 * A user-provided hook handler.
 */
export type HookHandler<TInput, TOutput, TContext extends HookContext = HookContext> = (
  input: TInput,
  context: TContext,
) => TOutput | null | Promise<TOutput | null>;

/**
 * The result of a hook factory — a function that wraps the handler.
 *
 * This is what gets exported from hook files and invoked by the driver.
 * @template TInput - The input type for this hook
 * @template TOutput - The output type for this hook
 * @template TContext - The context type (defaults to {@link HookContext})
 */
export interface HookFunction<TInput, TOutput, TContext extends HookContext = HookContext> {
  /**
   * Execute the hook handler with the given input and context.
   * @param input - The hook input data
   * @param context - The hook execution context
   * @returns The hook output, or null for an empty response
   */
  (input: TInput, context: TContext): Promise<TOutput | null>;

  /**
   * The agent event name this hook is for.
   */
  eventName: string;

  /**
   * The matcher pattern, if configured.
   */
  matcher?: string;

  /**
   * The timeout in milliseconds, if configured.
   */
  timeout?: number;

  /**
   * The fail-open policy, if configured. See {@link UnexpectedErrorPolicy}.
   */
  unexpectedError?: UnexpectedErrorPolicy;

  /**
   * The diagnostic callback for the "continue" policy, if configured.
   * See {@link UnexpectedErrorHandler}.
   */
  onUnexpectedError?: UnexpectedErrorHandler;

  /**
   * Optional per-event context factory. See {@link HookConfig.createContext}.
   */
  createContext?: (input: TInput) => HookContext;
}

/**
 * Per-event policy-validation seam injected by each agent.
 *
 * An agent's per-event factory passes its gate closure; core invokes it with
 * the event name and the configured (possibly undefined) policy. A gate
 * rejects by returning `false`, or by throwing — either way {@link defineHook}
 * fails closed and throws before any hook is created. Core never hardcodes an
 * event list: the advisory allow-list lives entirely in the agent's gate.
 */
export type HookPolicyGate = (eventName: string, policy: UnexpectedErrorPolicy | undefined) => boolean;
