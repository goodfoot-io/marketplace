import type { Logger } from "./logger.js";
import type {
  MatcherHookConfig,
  NoMatcherHookConfig,
  PostToolUseInput,
  PreToolUseInput,
  SessionStartInput,
  StopInput,
  UserPromptSubmitInput,
} from "./types.js";
import type {
  PostToolUseOutput,
  PreToolUseOutput,
  SessionStartOutput,
  StopOutput,
  UserPromptSubmitOutput,
} from "./outputs.js";

export interface HookContext {
  logger: Logger;
}

interface HookMetadata<TEvent extends string> {
  hookEventName: TEvent;
  matcher?: string;
  timeout?: number;
  statusMessage?: string;
}

export interface HookFunction<TInput, TOutput, TEvent extends string> extends HookMetadata<TEvent> {
  (input: TInput, context: HookContext): TOutput | Promise<TOutput>;
}

type SessionStartResult = SessionStartOutput | string | void;
type UserPromptSubmitResult = UserPromptSubmitOutput | string | void;
type StopResult = StopOutput | void;
type PreToolUseResult = PreToolUseOutput | void;
type PostToolUseResult = PostToolUseOutput | void;

function attachMetadata<TInput, TOutput, TEvent extends string>(
  hookEventName: TEvent,
  config: MatcherHookConfig | NoMatcherHookConfig,
  handler: HookFunction<TInput, TOutput, TEvent> | ((input: TInput, context: HookContext) => TOutput | Promise<TOutput>),
): HookFunction<TInput, TOutput, TEvent> {
  const hook = handler as HookFunction<TInput, TOutput, TEvent>;
  hook.hookEventName = hookEventName;
  hook.timeout = config.timeout;
  hook.statusMessage = config.statusMessage;
  if ("matcher" in config && typeof config.matcher === "string") {
    hook.matcher = config.matcher;
  }
  return hook;
}

export function preToolUseHook(
  config: MatcherHookConfig,
  handler: (input: PreToolUseInput, context: HookContext) => PreToolUseResult | Promise<PreToolUseResult>,
): HookFunction<PreToolUseInput, PreToolUseResult, "PreToolUse"> {
  return attachMetadata("PreToolUse", config, handler);
}

export function postToolUseHook(
  config: MatcherHookConfig,
  handler: (input: PostToolUseInput, context: HookContext) => PostToolUseResult | Promise<PostToolUseResult>,
): HookFunction<PostToolUseInput, PostToolUseResult, "PostToolUse"> {
  return attachMetadata("PostToolUse", config, handler);
}

export function sessionStartHook(
  config: MatcherHookConfig,
  handler: (input: SessionStartInput, context: HookContext) => SessionStartResult | Promise<SessionStartResult>,
): HookFunction<SessionStartInput, SessionStartResult, "SessionStart"> {
  return attachMetadata("SessionStart", config, handler);
}

export function userPromptSubmitHook(
  config: NoMatcherHookConfig,
  handler: (input: UserPromptSubmitInput, context: HookContext) => UserPromptSubmitResult | Promise<UserPromptSubmitResult>,
): HookFunction<UserPromptSubmitInput, UserPromptSubmitResult, "UserPromptSubmit"> {
  return attachMetadata("UserPromptSubmit", config, handler);
}

export function stopHook(
  config: NoMatcherHookConfig,
  handler: (input: StopInput, context: HookContext) => StopResult | Promise<StopResult>,
): HookFunction<StopInput, StopResult, "Stop"> {
  return attachMetadata("Stop", config, handler);
}
