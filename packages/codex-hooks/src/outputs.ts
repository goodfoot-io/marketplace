export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  BLOCK: 2,
} as const;

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
export type SpecificHookOutput =
  | RawOutput
  | PreToolUseOutput
  | PostToolUseOutput
  | SessionStartOutput
  | UserPromptSubmitOutput
  | StopOutput;

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

export type HookSpecificOutput =
  | PreToolUseHookSpecificOutput
  | PostToolUseHookSpecificOutput
  | SessionStartHookSpecificOutput
  | UserPromptSubmitHookSpecificOutput;

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

export class BlockError extends Error {
  public readonly reason: string;

  public constructor(reason: string) {
    super(reason);
    this.name = "BlockError";
    this.reason = reason;
  }
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function buildOutput<T extends SpecificHookOutput["_type"]>(
  type: T,
  stdout: SyncHookJSONOutput,
  stderr?: string,
): Extract<SpecificHookOutput, { _type: T }> {
  return {
    _type: type,
    stdout: omitUndefined(stdout),
    ...(stderr !== undefined ? { stderr } : {}),
  } as unknown as Extract<SpecificHookOutput, { _type: T }>;
}

export function rawOutput(stdout: SyncHookJSONOutput, stderr?: string): SpecificHookOutput {
  return buildOutput("Raw", stdout, stderr);
}

export function sessionStartOutput(options: SessionStartOptions = {}): SessionStartOutput {
  const hookSpecificOutput =
    options.additionalContext !== undefined
      ? {
          hookEventName: "SessionStart" as const,
          additionalContext: options.additionalContext,
        }
      : undefined;
  return buildOutput("SessionStart", {
    continue: options.continue,
    stopReason: options.stopReason,
    systemMessage: options.systemMessage,
    hookSpecificOutput,
  });
}

export function userPromptSubmitOutput(options: UserPromptSubmitOptions = {}): UserPromptSubmitOutput {
  const hookSpecificOutput =
    options.additionalContext !== undefined
      ? {
          hookEventName: "UserPromptSubmit" as const,
          additionalContext: options.additionalContext,
        }
      : undefined;
  return buildOutput("UserPromptSubmit", {
    continue: options.continue,
    stopReason: options.stopReason,
    systemMessage: options.systemMessage,
    decision: options.decision,
    reason: options.reason,
    hookSpecificOutput,
  });
}

export function stopOutput(options: StopOptions = {}): StopOutput {
  return buildOutput("Stop", {
    continue: options.continue,
    stopReason: options.stopReason,
    systemMessage: options.systemMessage,
    decision: options.decision,
    reason: options.reason,
  });
}

export function postToolUseOutput(options: PostToolUseOptions = {}): PostToolUseOutput {
  const hookSpecificOutput =
    options.additionalContext !== undefined
      ? {
          hookEventName: "PostToolUse" as const,
          additionalContext: options.additionalContext,
        }
      : undefined;
  return buildOutput("PostToolUse", {
    continue: options.continue,
    stopReason: options.stopReason,
    systemMessage: options.systemMessage,
    decision: options.decision,
    reason: options.reason,
    hookSpecificOutput,
  });
}

export function preToolUseOutput(options: PreToolUseOptions = {}): PreToolUseOutput {
  const hookSpecificOutput =
    options.permissionDecision !== undefined || options.permissionDecisionReason !== undefined
      ? {
          hookEventName: "PreToolUse" as const,
          permissionDecision: options.permissionDecision,
          permissionDecisionReason: options.permissionDecisionReason,
        }
      : undefined;
  return buildOutput("PreToolUse", {
    systemMessage: options.systemMessage,
    hookSpecificOutput,
  });
}

export function preToolUseLegacyBlockOutput(options: PreToolUseLegacyBlockOptions): PreToolUseOutput {
  return buildOutput("PreToolUse", {
    systemMessage: options.systemMessage,
    decision: options.decision,
    reason: options.reason,
  });
}
