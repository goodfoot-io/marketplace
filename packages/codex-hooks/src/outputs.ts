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
export type PermissionRequestOutput = BaseSpecificOutput<"PermissionRequest">;
export type UserPromptSubmitOutput = BaseSpecificOutput<"UserPromptSubmit">;
export type SessionStartOutput = BaseSpecificOutput<"SessionStart">;
export type SubagentStartOutput = BaseSpecificOutput<"SubagentStart">;
export type StopOutput = BaseSpecificOutput<"Stop">;
export type SubagentStopOutput = BaseSpecificOutput<"SubagentStop">;
export type PreCompactOutput = BaseSpecificOutput<"PreCompact">;
export type PostCompactOutput = BaseSpecificOutput<"PostCompact">;

export type SpecificHookOutput =
  | RawOutput
  | PreToolUseOutput
  | PostToolUseOutput
  | PermissionRequestOutput
  | UserPromptSubmitOutput
  | SessionStartOutput
  | SubagentStartOutput
  | StopOutput
  | SubagentStopOutput
  | PreCompactOutput
  | PostCompactOutput;

export interface HookOutput {
  stdout: SyncHookJSONOutput;
  stderr?: string;
}

export interface SyncHookJSONOutput {
  continue?: boolean;
  decision?: "approve" | "block";
  hookSpecificOutput?: HookSpecificOutput;
  reason?: string;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}

export type HookSpecificOutput =
  | PreToolUseHookSpecificOutput
  | PostToolUseHookSpecificOutput
  | PermissionRequestHookSpecificOutput
  | UserPromptSubmitHookSpecificOutput
  | SessionStartHookSpecificOutput
  | SubagentStartHookSpecificOutput;

export type PreToolUsePermissionDecision = "allow" | "deny" | "ask";

export interface PreToolUseHookSpecificOutput {
  hookEventName: "PreToolUse";
  additionalContext?: string;
  permissionDecision?: PreToolUsePermissionDecision;
  permissionDecisionReason?: string;
  updatedInput?: unknown;
}

export interface PostToolUseHookSpecificOutput {
  hookEventName: "PostToolUse";
  additionalContext?: string;
  updatedMCPToolOutput?: unknown;
}

export type PermissionRequestBehavior = "allow" | "deny";

export interface PermissionRequestDecision {
  behavior: PermissionRequestBehavior;
  message?: string;
  interrupt?: boolean;
  updatedInput?: unknown;
  updatedPermissions?: unknown;
}

export interface PermissionRequestHookSpecificOutput {
  hookEventName: "PermissionRequest";
  decision?: PermissionRequestDecision;
}

export interface UserPromptSubmitHookSpecificOutput {
  hookEventName: "UserPromptSubmit";
  additionalContext?: string;
}

export interface SessionStartHookSpecificOutput {
  hookEventName: "SessionStart";
  additionalContext?: string;
}

export interface SubagentStartHookSpecificOutput {
  hookEventName: "SubagentStart";
  additionalContext?: string;
}

export interface PreToolUseOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: "approve" | "block";
  reason?: string;
  additionalContext?: string;
  permissionDecision?: PreToolUsePermissionDecision;
  permissionDecisionReason?: string;
  updatedInput?: unknown;
}

export interface PreToolUseLegacyBlockOptions {
  systemMessage?: string;
  decision: "block";
  reason: string;
}

export interface PostToolUseOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: "block";
  reason?: string;
  additionalContext?: string;
  updatedMCPToolOutput?: unknown;
}

export interface PermissionRequestOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  behavior: PermissionRequestBehavior;
  message?: string;
  interrupt?: boolean;
  updatedInput?: unknown;
  updatedPermissions?: unknown;
}

export interface UserPromptSubmitOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: "block";
  reason?: string;
  additionalContext?: string;
}

export interface SessionStartOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  additionalContext?: string;
}

export interface SubagentStartOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  additionalContext?: string;
}

export interface StopOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: "block";
  reason?: string;
}

export interface SubagentStopOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: "block";
  reason?: string;
}

export interface PreCompactOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}

export interface PostCompactOptions {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
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

export function preToolUseOutput(options: PreToolUseOptions = {}): PreToolUseOutput {
  const hasSpecific =
    options.additionalContext !== undefined ||
    options.permissionDecision !== undefined ||
    options.permissionDecisionReason !== undefined ||
    options.updatedInput !== undefined;
  const hookSpecificOutput: PreToolUseHookSpecificOutput | undefined = hasSpecific
    ? omitUndefined({
        hookEventName: "PreToolUse" as const,
        additionalContext: options.additionalContext,
        permissionDecision: options.permissionDecision,
        permissionDecisionReason: options.permissionDecisionReason,
        updatedInput: options.updatedInput,
      })
    : undefined;
  return buildOutput("PreToolUse", {
    continue: options.continue,
    stopReason: options.stopReason,
    suppressOutput: options.suppressOutput,
    systemMessage: options.systemMessage,
    decision: options.decision,
    reason: options.reason,
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

export function postToolUseOutput(options: PostToolUseOptions = {}): PostToolUseOutput {
  const hasSpecific = options.additionalContext !== undefined || options.updatedMCPToolOutput !== undefined;
  const hookSpecificOutput: PostToolUseHookSpecificOutput | undefined = hasSpecific
    ? omitUndefined({
        hookEventName: "PostToolUse" as const,
        additionalContext: options.additionalContext,
        updatedMCPToolOutput: options.updatedMCPToolOutput,
      })
    : undefined;
  return buildOutput("PostToolUse", {
    continue: options.continue,
    stopReason: options.stopReason,
    suppressOutput: options.suppressOutput,
    systemMessage: options.systemMessage,
    decision: options.decision,
    reason: options.reason,
    hookSpecificOutput,
  });
}

export function permissionRequestOutput(options: PermissionRequestOptions): PermissionRequestOutput {
  const decision: PermissionRequestDecision = omitUndefined({
    behavior: options.behavior,
    message: options.message,
    interrupt: options.interrupt,
    updatedInput: options.updatedInput,
    updatedPermissions: options.updatedPermissions,
  });
  const hookSpecificOutput: PermissionRequestHookSpecificOutput = {
    hookEventName: "PermissionRequest",
    decision,
  };
  return buildOutput("PermissionRequest", {
    continue: options.continue,
    stopReason: options.stopReason,
    suppressOutput: options.suppressOutput,
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
    suppressOutput: options.suppressOutput,
    systemMessage: options.systemMessage,
    decision: options.decision,
    reason: options.reason,
    hookSpecificOutput,
  });
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
    suppressOutput: options.suppressOutput,
    systemMessage: options.systemMessage,
    hookSpecificOutput,
  });
}

export function subagentStartOutput(options: SubagentStartOptions = {}): SubagentStartOutput {
  const hookSpecificOutput =
    options.additionalContext !== undefined
      ? {
          hookEventName: "SubagentStart" as const,
          additionalContext: options.additionalContext,
        }
      : undefined;
  return buildOutput("SubagentStart", {
    continue: options.continue,
    stopReason: options.stopReason,
    suppressOutput: options.suppressOutput,
    systemMessage: options.systemMessage,
    hookSpecificOutput,
  });
}

export function stopOutput(options: StopOptions = {}): StopOutput {
  return buildOutput("Stop", {
    continue: options.continue,
    stopReason: options.stopReason,
    suppressOutput: options.suppressOutput,
    systemMessage: options.systemMessage,
    decision: options.decision,
    reason: options.reason,
  });
}

export function subagentStopOutput(options: SubagentStopOptions = {}): SubagentStopOutput {
  return buildOutput("SubagentStop", {
    continue: options.continue,
    stopReason: options.stopReason,
    suppressOutput: options.suppressOutput,
    systemMessage: options.systemMessage,
    decision: options.decision,
    reason: options.reason,
  });
}

export function preCompactOutput(options: PreCompactOptions = {}): PreCompactOutput {
  return buildOutput("PreCompact", {
    continue: options.continue,
    stopReason: options.stopReason,
    suppressOutput: options.suppressOutput,
    systemMessage: options.systemMessage,
  });
}

export function postCompactOutput(options: PostCompactOptions = {}): PostCompactOutput {
  return buildOutput("PostCompact", {
    continue: options.continue,
    stopReason: options.stopReason,
    suppressOutput: options.suppressOutput,
    systemMessage: options.systemMessage,
  });
}
