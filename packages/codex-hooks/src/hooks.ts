import type { Logger } from "./logger.js";
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
  MatcherHookConfig,
  NoMatcherHookConfig,
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

function attachMetadata<TInput, TOutput, TEvent extends string>(
  hookEventName: TEvent,
  config: MatcherHookConfig | NoMatcherHookConfig,
  handler:
    | HookFunction<TInput, TOutput, TEvent>
    | ((input: TInput, context: HookContext) => TOutput | Promise<TOutput>),
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

export function permissionRequestHook(
  config: MatcherHookConfig,
  handler: (
    input: PermissionRequestInput,
    context: HookContext,
  ) => PermissionRequestResult | Promise<PermissionRequestResult>,
): HookFunction<PermissionRequestInput, PermissionRequestResult, "PermissionRequest"> {
  return attachMetadata("PermissionRequest", config, handler);
}

export function userPromptSubmitHook(
  config: NoMatcherHookConfig,
  handler: (
    input: UserPromptSubmitInput,
    context: HookContext,
  ) => UserPromptSubmitResult | Promise<UserPromptSubmitResult>,
): HookFunction<UserPromptSubmitInput, UserPromptSubmitResult, "UserPromptSubmit"> {
  return attachMetadata("UserPromptSubmit", config, handler);
}

export function sessionStartHook(
  config: MatcherHookConfig,
  handler: (input: SessionStartInput, context: HookContext) => SessionStartResult | Promise<SessionStartResult>,
): HookFunction<SessionStartInput, SessionStartResult, "SessionStart"> {
  return attachMetadata("SessionStart", config, handler);
}

export function subagentStartHook(
  config: MatcherHookConfig,
  handler: (input: SubagentStartInput, context: HookContext) => SubagentStartResult | Promise<SubagentStartResult>,
): HookFunction<SubagentStartInput, SubagentStartResult, "SubagentStart"> {
  return attachMetadata("SubagentStart", config, handler);
}

export function stopHook(
  config: NoMatcherHookConfig,
  handler: (input: StopInput, context: HookContext) => StopResult | Promise<StopResult>,
): HookFunction<StopInput, StopResult, "Stop"> {
  return attachMetadata("Stop", config, handler);
}

export function subagentStopHook(
  config: MatcherHookConfig,
  handler: (input: SubagentStopInput, context: HookContext) => SubagentStopResult | Promise<SubagentStopResult>,
): HookFunction<SubagentStopInput, SubagentStopResult, "SubagentStop"> {
  return attachMetadata("SubagentStop", config, handler);
}

export function preCompactHook(
  config: MatcherHookConfig,
  handler: (input: PreCompactInput, context: HookContext) => PreCompactResult | Promise<PreCompactResult>,
): HookFunction<PreCompactInput, PreCompactResult, "PreCompact"> {
  return attachMetadata("PreCompact", config, handler);
}

export function postCompactHook(
  config: MatcherHookConfig,
  handler: (input: PostCompactInput, context: HookContext) => PostCompactResult | Promise<PostCompactResult>,
): HookFunction<PostCompactInput, PostCompactResult, "PostCompact"> {
  return attachMetadata("PostCompact", config, handler);
}
