import type { Logger } from "./logger.js";
import type { MatcherHookConfig, NoMatcherHookConfig, PostToolUseInput, PreToolUseInput, SessionStartInput, StopInput, UserPromptSubmitInput } from "./types.js";
import type { PostToolUseOutput, PreToolUseOutput, SessionStartOutput, StopOutput, UserPromptSubmitOutput } from "./outputs.js";
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
export declare function preToolUseHook(config: MatcherHookConfig, handler: (input: PreToolUseInput, context: HookContext) => PreToolUseResult | Promise<PreToolUseResult>): HookFunction<PreToolUseInput, PreToolUseResult, "PreToolUse">;
export declare function postToolUseHook(config: MatcherHookConfig, handler: (input: PostToolUseInput, context: HookContext) => PostToolUseResult | Promise<PostToolUseResult>): HookFunction<PostToolUseInput, PostToolUseResult, "PostToolUse">;
export declare function sessionStartHook(config: MatcherHookConfig, handler: (input: SessionStartInput, context: HookContext) => SessionStartResult | Promise<SessionStartResult>): HookFunction<SessionStartInput, SessionStartResult, "SessionStart">;
export declare function userPromptSubmitHook(config: NoMatcherHookConfig, handler: (input: UserPromptSubmitInput, context: HookContext) => UserPromptSubmitResult | Promise<UserPromptSubmitResult>): HookFunction<UserPromptSubmitInput, UserPromptSubmitResult, "UserPromptSubmit">;
export declare function stopHook(config: NoMatcherHookConfig, handler: (input: StopInput, context: HookContext) => StopResult | Promise<StopResult>): HookFunction<StopInput, StopResult, "Stop">;
export {};
