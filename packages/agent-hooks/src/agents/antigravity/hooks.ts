/**
 * Typed factory functions for Antigravity hooks, built on the shared core
 * {@link ../../core/define-hook.ts|defineHook}.
 *
 * This release ships the typed factory surface and output builders only
 * (plan Step 5, item-6 descope) — no `CONTRACT.md`-derived e2e file, no
 * `./antigravity` export. Every factory injects the advisory allow-list
 * policy gate, so `unexpectedError: "continue"` fails closed at
 * factory-call time for every event ({@link ADVISORY_EVENTS} is empty this
 * release); {@link HookConfigFor} additionally narrows the policy field at
 * compile time.
 *
 * Antigravity's config surface is a single conditional type rather than the
 * separate matcher/no-matcher interface pair Claude Code and Codex use: only
 * two of the five events (`PreToolUse`, `PostToolUse`) carry a `matcher`
 * ({@link EVENTS_WITH_MATCHER} in `events.ts`), and a conditional type on the
 * bound event expresses that distinction without duplicating the base field
 * list twice.
 * @module
 */

import { defineHook } from "../../core/define-hook.js";
import type {
  HookConfig as CoreHookConfig,
  HookContext,
  HookPolicyGate,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "../../core/types.js";
import { ADVISORY_EVENTS, type AllowedUnexpectedErrorPolicy } from "./events.js";
import type {
  PostInvocationOutput,
  PostToolUseOutput,
  PreInvocationOutput,
  PreToolUseOutput,
  StopOutput,
} from "./outputs.js";
import type {
  HookEventName,
  PostInvocationInput,
  PostToolUseInput,
  PreInvocationInput,
  PreToolUseInput,
  StopInput,
} from "./types.js";

export type { HookContext, UnexpectedErrorHandler, UnexpectedErrorPolicy };

/** The two events whose bound config accepts a `matcher`, as a literal union. */
type EventWithMatcher = "PreToolUse" | "PostToolUse";

/** The base field list every Antigravity hook config shares. */
export interface HookConfig {
  matcher?: string;
  timeout?: number;
  unexpectedError?: UnexpectedErrorPolicy;
  onUnexpectedError?: UnexpectedErrorHandler;
}

/**
 * Per-event config: `matcher` only appears in the type for
 * {@link EventWithMatcher}, and `unexpectedError` is narrowed per event by
 * the advisory allow-list ({@link AllowedUnexpectedErrorPolicy}).
 * @template TEvent - The event the factory binds.
 */
export type HookConfigFor<TEvent extends HookEventName> = Omit<HookConfig, "matcher" | "unexpectedError"> &
  (TEvent extends EventWithMatcher ? Pick<HookConfig, "matcher"> : Record<never, never>) & {
    unexpectedError?: AllowedUnexpectedErrorPolicy<TEvent>;
  };

type PreToolUseResult = PreToolUseOutput | undefined;
type PostToolUseResult = PostToolUseOutput | undefined;
type PreInvocationResult = PreInvocationOutput | undefined;
type PostInvocationResult = PostInvocationOutput | undefined;
type StopResult = StopOutput | undefined;

/**
 * A bound Antigravity hook: the wrapped handler plus its driver metadata.
 * Carries both `hookEventName` (this surface's historical property name)
 * and `eventName` (the core driver's property), identical values.
 * @template TInput - The input type for this hook
 * @template TOutput - The output type for this hook
 * @template TEvent - The literal event name this hook is bound to
 */
export interface HookFunction<TInput, TOutput, TEvent extends string> {
  (input: TInput, context: HookContext): Promise<TOutput | null>;
  hookEventName: TEvent;
  eventName: string;
  matcher?: string;
  timeout?: number;
  unexpectedError?: UnexpectedErrorPolicy;
  onUnexpectedError?: UnexpectedErrorHandler;
  createContext?: (input: TInput) => HookContext;
}

/**
 * Rejects `unexpectedError: "continue"` unless the bound event is on
 * {@link ADVISORY_EVENTS} — every event, this release, since that list is
 * currently empty.
 */
const advisoryPolicyGate: HookPolicyGate = (eventName, policy) =>
  policy !== "continue" || (ADVISORY_EVENTS as readonly string[]).includes(eventName);

function bindHook<TInput, TOutput, TEvent extends HookEventName>(
  event: TEvent,
  config: HookConfig,
  handler: (input: TInput, context: HookContext) => TOutput | Promise<TOutput>,
): HookFunction<TInput, TOutput, TEvent> {
  const coreConfig: CoreHookConfig<TInput> = {
    matcher: config.matcher,
    timeout: config.timeout,
    unexpectedError: config.unexpectedError,
    onUnexpectedError: config.onUnexpectedError,
  };
  const bound = defineHook<TInput, TOutput>(event, coreConfig, handler, advisoryPolicyGate) as unknown as HookFunction<
    TInput,
    TOutput,
    TEvent
  >;
  bound.hookEventName = event;
  return bound;
}

/** Creates a PreToolUse hook handler. */
export function preToolUseHook(
  config: HookConfigFor<"PreToolUse">,
  handler: (input: PreToolUseInput, context: HookContext) => PreToolUseResult | Promise<PreToolUseResult>,
): HookFunction<PreToolUseInput, PreToolUseResult, "PreToolUse"> {
  return bindHook("PreToolUse", config, handler);
}

/** Creates a PostToolUse hook handler. */
export function postToolUseHook(
  config: HookConfigFor<"PostToolUse">,
  handler: (input: PostToolUseInput, context: HookContext) => PostToolUseResult | Promise<PostToolUseResult>,
): HookFunction<PostToolUseInput, PostToolUseResult, "PostToolUse"> {
  return bindHook("PostToolUse", config, handler);
}

/** Creates a PreInvocation hook handler. */
export function preInvocationHook(
  config: HookConfigFor<"PreInvocation">,
  handler: (input: PreInvocationInput, context: HookContext) => PreInvocationResult | Promise<PreInvocationResult>,
): HookFunction<PreInvocationInput, PreInvocationResult, "PreInvocation"> {
  return bindHook("PreInvocation", config, handler);
}

/** Creates a PostInvocation hook handler. */
export function postInvocationHook(
  config: HookConfigFor<"PostInvocation">,
  handler: (input: PostInvocationInput, context: HookContext) => PostInvocationResult | Promise<PostInvocationResult>,
): HookFunction<PostInvocationInput, PostInvocationResult, "PostInvocation"> {
  return bindHook("PostInvocation", config, handler);
}

/** Creates a Stop hook handler. */
export function stopHook(
  config: HookConfigFor<"Stop">,
  handler: (input: StopInput, context: HookContext) => StopResult | Promise<StopResult>,
): HookFunction<StopInput, StopResult, "Stop"> {
  return bindHook("Stop", config, handler);
}
