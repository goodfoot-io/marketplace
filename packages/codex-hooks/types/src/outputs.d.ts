export declare const EXIT_CODES: {
    readonly SUCCESS: 0;
    readonly ERROR: 1;
    readonly BLOCK: 2;
};
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
interface BaseSpecificOutput<T extends string> {
    readonly _type: T;
    readonly stdout: SyncHookJSONOutput;
    readonly stderr?: string;
}
export type RawOutput = BaseSpecificOutput<"Raw">;
export type PreToolUseOutput = BaseSpecificOutput<"PreToolUse">;
export type PostToolUseOutput = BaseSpecificOutput<"PostToolUse">;
export type SessionStartOutput = BaseSpecificOutput<"SessionStart">;
export type UserPromptSubmitOutput = BaseSpecificOutput<"UserPromptSubmit">;
export type StopOutput = BaseSpecificOutput<"Stop">;
export type SpecificHookOutput = RawOutput | PreToolUseOutput | PostToolUseOutput | SessionStartOutput | UserPromptSubmitOutput | StopOutput;
export interface HookOutput {
    stdout: SyncHookJSONOutput;
    stderr?: string;
}
export interface SyncHookJSONOutput {
    continue?: boolean;
    decision?: "block";
    hookSpecificOutput?: HookSpecificOutput;
    reason?: string;
    stopReason?: string;
    suppressOutput?: boolean;
    systemMessage?: string;
}
export type HookSpecificOutput = PreToolUseHookSpecificOutput | PostToolUseHookSpecificOutput | SessionStartHookSpecificOutput | UserPromptSubmitHookSpecificOutput;
export interface SessionStartHookSpecificOutput {
    hookEventName: "SessionStart";
    additionalContext?: string;
}
export interface UserPromptSubmitHookSpecificOutput {
    hookEventName: "UserPromptSubmit";
    additionalContext?: string;
}
export interface PreToolUseHookSpecificOutput {
    hookEventName: "PreToolUse";
    permissionDecision?: "deny";
    permissionDecisionReason?: string;
}
export interface PostToolUseHookSpecificOutput {
    hookEventName: "PostToolUse";
    additionalContext?: string;
}
export interface SessionStartOptions {
    continue?: boolean;
    stopReason?: string;
    systemMessage?: string;
    additionalContext?: string;
}
export interface UserPromptSubmitOptions {
    continue?: boolean;
    stopReason?: string;
    systemMessage?: string;
    additionalContext?: string;
    decision?: "block";
    reason?: string;
}
export interface StopOptions {
    continue?: boolean;
    stopReason?: string;
    systemMessage?: string;
    decision?: "block";
    reason?: string;
}
export interface PostToolUseOptions {
    continue?: boolean;
    stopReason?: string;
    systemMessage?: string;
    additionalContext?: string;
    decision?: "block";
    reason?: string;
}
export interface PreToolUseOptions {
    systemMessage?: string;
    permissionDecision?: "deny";
    permissionDecisionReason?: string;
}
export interface PreToolUseLegacyBlockOptions {
    systemMessage?: string;
    decision: "block";
    reason: string;
}
export declare class BlockError extends Error {
    readonly reason: string;
    constructor(reason: string);
}
export declare function rawOutput(stdout: SyncHookJSONOutput, stderr?: string): SpecificHookOutput;
export declare function sessionStartOutput(options?: SessionStartOptions): SessionStartOutput;
export declare function userPromptSubmitOutput(options?: UserPromptSubmitOptions): UserPromptSubmitOutput;
export declare function stopOutput(options?: StopOptions): StopOutput;
export declare function postToolUseOutput(options?: PostToolUseOptions): PostToolUseOutput;
export declare function preToolUseOutput(options?: PreToolUseOptions): PreToolUseOutput;
export declare function preToolUseLegacyBlockOutput(options: PreToolUseLegacyBlockOptions): PreToolUseOutput;
export {};
