/**
 * Typed factory functions for Codex hooks, built on the shared core
 * {@link ../core/define-hook.ts|defineHook}.
 *
 * Public surface mirrors the source codex-hooks package 1.3.0: same factory names,
 * config shapes (`MatcherHookConfig`/`NoMatcherHookConfig`, including
 * `statusMessage`), result unions, and `hookEventName` metadata property.
 * Two deliberate additions carry the consolidation contract:
 *
 * - every factory injects the advisory allow-list policy gate, so
 *   `unexpectedError: "continue"` fails closed at factory-call time for any
 *   event not on {@link ADVISORY_EVENTS};
 * - non-advisory events' config types narrow the policy field via
 *   {@link MatcherHookConfigFor}/{@link NoMatcherHookConfigFor}, rejecting
 *   `"continue"` at compile time as well.
 * @module
 */

import { defineHook } from "../../core/define-hook.js";
import type {
  HookConfig,
  HookContext,
  HookPolicyGate,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "../../core/types.js";
import { ADVISORY_EVENTS, type AllowedUnexpectedErrorPolicy } from "./events.js";
import type {
  PermissionRequestOutput,
  PostCompactOutput,
  PostToolUseOutput,
  PreCompactOutput,
  PreToolUseOutput,
  SessionStartOutput,
  StopOutput,
  SubagentStartOutput,
  SubagentStopOutput,
  UserPromptSubmitOutput,
} from "./outputs.js";
import type {
  HookEventName,
  PermissionRequestInput,
  PostCompactInput,
  PostToolUseInput,
  PreCompactInput,
  PreToolUseInput,
  SessionStartInput,
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  UserPromptSubmitInput,
} from "./types.js";

// ============================================================================
// Shared Configuration Vocabulary (from the committed core)
// ============================================================================

/**
 * Policy/phase/diagnostic vocabulary is shared across agents and owned by the
 * core; re-exported here so the Codex surface keeps its historical import
 * site (`hooks.js`). See the Claude Code surface's documentation of the same
 * vocabulary for the full fail-open contract.
 */
export type { HookContext, UnexpectedErrorHandler, UnexpectedErrorPolicy };

/**
 * The base config shapes from the source package. `statusMessage` is a Codex
 *-specific field: it flows into generated `hooks.json` entries by the CLI.
 */
export interface MatcherHookConfig {
  matcher?: string;
  timeout?: number;
  statusMessage?: string;
  unexpectedError?: UnexpectedErrorPolicy;
  onUnexpectedError?: UnexpectedErrorHandler;
}

export interface NoMatcherHookConfig {
  timeout?: number;
  statusMessage?: string;
  unexpectedError?: UnexpectedErrorPolicy;
  onUnexpectedError?: UnexpectedErrorHandler;
}

/**
 * Per-event matcher config with the fail-open policy narrowed by the advisory
 * allow-list: excluded events collapse `unexpectedError` to `"error"` only.
 * @template TEvent - The event the factory binds.
 */
export type MatcherHookConfigFor<TEvent extends HookEventName> = Omit<MatcherHookConfig, "unexpectedError"> & {
  unexpectedError?: AllowedUnexpectedErrorPolicy<TEvent>;
};

/** Per-event no-matcher variant of {@link MatcherHookConfigFor}. @template TEvent - The event the factory binds. */
export type NoMatcherHookConfigFor<TEvent extends HookEventName> = Omit<NoMatcherHookConfig, "unexpectedError"> & {
  unexpectedError?: AllowedUnexpectedErrorPolicy<TEvent>;
};

// ============================================================================
// Handler / Function Types
// ============================================================================

type PreToolUseResult = PreToolUseOutput | undefined;
type PostToolUseResult = PostToolUseOutput | undefined;
type PermissionRequestResult = PermissionRequestOutput | undefined;
type UserPromptSubmitResult = UserPromptSubmitOutput | string | undefined;
type SessionStartResult = SessionStartOutput | string | undefined;
type SubagentStartResult = SubagentStartOutput | string | undefined;
type StopResult = StopOutput | undefined;
type SubagentStopResult = SubagentStopOutput | undefined;
type PreCompactResult = PreCompactOutput | undefined;
type PostCompactResult = PostCompactOutput | undefined;

/**
 * The result of a hook factory — a function wrapping the handler, carrying
 * its metadata for the driver and the CLI's AST analysis. Preserves the
 * source package's `hookEventName` property name alongside the core's
 * `eventName`.
 * @template TInput - The input type for this hook
 * @template TOutput - The output type for this hook
 * @template TEvent - The literal event name this hook is bound to
 */
export interface HookFunction<TInput, TOutput, TEvent extends string> {
  /**
   * Execute the hook handler with the given input and context.
   */
  (input: TInput, context: HookContext): Promise<TOutput | null>;

  /**
   * The Codex event name this hook is for (source-package property name).
   */
  hookEventName: TEvent;

  /**
   * The core driver's event-name property; identical value.
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
   * Codex-specific status message shown while the hook runs.
   */
  statusMessage?: string;

  /**
   * The fail-open policy, if configured.
   */
  unexpectedError?: UnexpectedErrorPolicy;

  /**
   * The diagnostic callback for the "continue" policy, if configured.
   */
  onUnexpectedError?: UnexpectedErrorHandler;

  /**
   * Optional context factory (unused by the Codex surface today; part of the
   * shared core function shape).
   */
  createContext?: (input: TInput) => HookContext;
}

// ============================================================================
// Generic Factory
// ============================================================================

/**
 * The runtime policy gate injected into every Codex factory: rejects
 * `unexpectedError: "continue"` at factory-call time for any event not on
 * the advisory allow-list ({@link ADVISORY_EVENTS}). Mirrors the Claude Code
 * surface's gate exactly — one closure serves all ten events because the
 * gate receives the event name.
 */
const advisoryPolicyGate: HookPolicyGate = (eventName, policy) =>
  policy !== "continue" || (ADVISORY_EVENTS as readonly string[]).includes(eventName);

/**
 * Creates a Codex hook function for a specific event on the shared core.
 * Binds the event name, injects the advisory allow-list policy gate, and
 * carries the Codex-specific `statusMessage` through to the returned
 * metadata.
 * @internal
 */
function createHookFunction<TInput, TOutput, TEvent extends HookEventName>(
  hookEventName: TEvent,
  config: MatcherHookConfig | NoMatcherHookConfig,
  handler: (input: TInput, context: HookContext) => TOutput | Promise<TOutput>,
): HookFunction<TInput, TOutput, TEvent> {
  const coreConfig: HookConfig<TInput> = {
    matcher: "matcher" in config ? config.matcher : undefined,
    timeout: config.timeout,
    unexpectedError: config.unexpectedError,
    onUnexpectedError: config.onUnexpectedError,
  };
  const hookFn = defineHook<TInput, TOutput>(hookEventName, coreConfig, handler, advisoryPolicyGate);
  const codexFn = hookFn as unknown as HookFunction<TInput, TOutput, TEvent>;
  codexFn.hookEventName = hookEventName;
  codexFn.statusMessage = config.statusMessage;
  return codexFn;
}

// ============================================================================
// Factories (signatures copied from the source package; configs narrowed)
// ============================================================================

/** Creates a PreToolUse hook handler. Excluded from the advisory list. */
export function preToolUseHook(
  config: MatcherHookConfigFor<"PreToolUse">,
  handler: (input: PreToolUseInput, context: HookContext) => PreToolUseResult | Promise<PreToolUseResult>,
): HookFunction<PreToolUseInput, PreToolUseResult, "PreToolUse"> {
  return createHookFunction("PreToolUse", config, handler);
}

/** Creates a PostToolUse hook handler. Blocking variant excluded from the advisory list. */
export function postToolUseHook(
  config: MatcherHookConfigFor<"PostToolUse">,
  handler: (input: PostToolUseInput, context: HookContext) => PostToolUseResult | Promise<PostToolUseResult>,
): HookFunction<PostToolUseInput, PostToolUseResult, "PostToolUse"> {
  return createHookFunction("PostToolUse", config, handler);
}

/** Creates a PermissionRequest hook handler. Excluded from the advisory list. */
export function permissionRequestHook(
  config: MatcherHookConfigFor<"PermissionRequest">,
  handler: (
    input: PermissionRequestInput,
    context: HookContext,
  ) => PermissionRequestResult | Promise<PermissionRequestResult>,
): HookFunction<PermissionRequestInput, PermissionRequestResult, "PermissionRequest"> {
  return createHookFunction("PermissionRequest", config, handler);
}

/** Creates a UserPromptSubmit hook handler. Advisory enrichment hook. */
export function userPromptSubmitHook(
  config: NoMatcherHookConfigFor<"UserPromptSubmit">,
  handler: (
    input: UserPromptSubmitInput,
    context: HookContext,
  ) => UserPromptSubmitResult | Promise<UserPromptSubmitResult>,
): HookFunction<UserPromptSubmitInput, UserPromptSubmitResult, "UserPromptSubmit"> {
  return createHookFunction("UserPromptSubmit", config, handler);
}

/** Creates a SessionStart hook handler. Advisory enrichment hook. */
export function sessionStartHook(
  config: MatcherHookConfigFor<"SessionStart">,
  handler: (input: SessionStartInput, context: HookContext) => SessionStartResult | Promise<SessionStartResult>,
): HookFunction<SessionStartInput, SessionStartResult, "SessionStart"> {
  return createHookFunction("SessionStart", config, handler);
}

/** Creates a SubagentStart hook handler. Advisory enrichment hook. */
export function subagentStartHook(
  config: MatcherHookConfigFor<"SubagentStart">,
  handler: (input: SubagentStartInput, context: HookContext) => SubagentStartResult | Promise<SubagentStartResult>,
): HookFunction<SubagentStartInput, SubagentStartResult, "SubagentStart"> {
  return createHookFunction("SubagentStart", config, handler);
}

/** Creates a Stop hook handler. Blocking variant excluded from the advisory list. */
export function stopHook(
  config: NoMatcherHookConfigFor<"Stop">,
  handler: (input: StopInput, context: HookContext) => StopResult | Promise<StopResult>,
): HookFunction<StopInput, StopResult, "Stop"> {
  return createHookFunction("Stop", config, handler);
}

/** Creates a SubagentStop hook handler. Blocking variant excluded from the advisory list. */
export function subagentStopHook(
  config: MatcherHookConfigFor<"SubagentStop">,
  handler: (input: SubagentStopInput, context: HookContext) => SubagentStopResult | Promise<SubagentStopResult>,
): HookFunction<SubagentStopInput, SubagentStopResult, "SubagentStop"> {
  return createHookFunction("SubagentStop", config, handler);
}

/** Creates a PreCompact hook handler. Excluded by default pending doc clarification. */
export function preCompactHook(
  config: MatcherHookConfigFor<"PreCompact">,
  handler: (input: PreCompactInput, context: HookContext) => PreCompactResult | Promise<PreCompactResult>,
): HookFunction<PreCompactInput, PreCompactResult, "PreCompact"> {
  return createHookFunction("PreCompact", config, handler);
}

/** Creates a PostCompact hook handler. Excluded by default pending doc clarification. */
export function postCompactHook(
  config: MatcherHookConfigFor<"PostCompact">,
  handler: (input: PostCompactInput, context: HookContext) => PostCompactResult | Promise<PostCompactResult>,
): HookFunction<PostCompactInput, PostCompactResult, "PostCompact"> {
  return createHookFunction("PostCompact", config, handler);
}
