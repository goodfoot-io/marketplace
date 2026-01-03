/**
 * Output types and builders for Claude Code hooks.
 *
 * Provides type-safe output builder functions for all 12 hook types. Each builder
 * accepts options that match the wire format expected by Claude Code, with types
 * derived from the Claude Agent SDK's `SyncHookJSONOutput` type.
 * @see https://code.claude.com/docs/en/hooks
 * @module
 */
import type {
  PermissionUpdate,
  SyncHookJSONOutput as SDKSyncHookJSONOutput
} from '@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.js';
/**
 * Exit codes used by Claude Code hooks.
 *
 * | Exit Code | Name | When Used | Claude Code Behavior |
 * |-----------|------|-----------|---------------------|
 * | 0 | Success | Handler returns normally | Continue, parse stdout as JSON |
 * | 1 | Error | Invalid input, non-blocking error | Non-blocking, stderr to user only |
 * | 2 | Block | Handler throws OR `stopReason` set | Blocking, stderr shown to Claude |
 */
export declare const EXIT_CODES: {
  /** Handler completed successfully. Claude Code parses stdout as JSON. */
  readonly SUCCESS: 0;
  /** Non-blocking error occurred (e.g., invalid input). stderr shown to user only. */
  readonly ERROR: 1;
  /** Handler threw exception OR blocking action requested. stderr shown to Claude. */
  readonly BLOCK: 2;
};
/**
 * Exit code type.
 */
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
/**
 * Re-export the SDK's SyncHookJSONOutput type for reference.
 * Our types are derived from this to ensure wire format compatibility.
 */
export type { SDKSyncHookJSONOutput };
/**
 * PreToolUse hook-specific output fields.
 * Omits `hookEventName` which is added automatically.
 */
export interface PreToolUseHookSpecificOutput {
  /** Permission decision: 'allow', 'deny', or 'ask' */
  permissionDecision?: 'allow' | 'deny' | 'ask';
  /** Reason for the permission decision. */
  permissionDecisionReason?: string;
  /** Modified tool input to use instead of original. */
  updatedInput?: Record<string, unknown>;
}
/**
 * PostToolUse hook-specific output fields.
 */
export interface PostToolUseHookSpecificOutput {
  /** Additional context to add to the transcript. */
  additionalContext?: string;
  /** Updated MCP tool output to replace the original. */
  updatedMCPToolOutput?: unknown;
}
/**
 * PostToolUseFailure hook-specific output fields.
 */
export interface PostToolUseFailureHookSpecificOutput {
  /** Additional context to add after the failure. */
  additionalContext?: string;
}
/**
 * UserPromptSubmit hook-specific output fields.
 */
export interface UserPromptSubmitHookSpecificOutput {
  /** Additional context to inject into the conversation. */
  additionalContext?: string;
}
/**
 * SessionStart hook-specific output fields.
 */
export interface SessionStartHookSpecificOutput {
  /** Additional context to inject at session start. */
  additionalContext?: string;
}
/**
 * SubagentStart hook-specific output fields.
 */
export interface SubagentStartHookSpecificOutput {
  /** Additional context to inject for the subagent. */
  additionalContext?: string;
}
/**
 * Notification hook-specific output fields.
 */
export interface NotificationHookSpecificOutput {
  /** Additional context to add about the notification. */
  additionalContext?: string;
}
/**
 * Allow decision for permission requests.
 */
export interface PermissionRequestAllowDecision {
  behavior: 'allow';
  /** Updated tool input to use. */
  updatedInput?: Record<string, unknown>;
  /** Permission updates to apply. */
  updatedPermissions?: PermissionUpdate[];
}
/**
 * Deny decision for permission requests.
 */
export interface PermissionRequestDenyDecision {
  behavior: 'deny';
  /** Message explaining the denial. */
  message?: string;
  /** Whether to interrupt the current operation. */
  interrupt?: boolean;
}
/**
 * Permission request decision - either allow or deny.
 */
export type PermissionRequestDecision = PermissionRequestAllowDecision | PermissionRequestDenyDecision;
/**
 * PermissionRequest hook-specific output fields.
 */
export interface PermissionRequestHookSpecificOutput {
  /** Permission decision details. */
  decision: PermissionRequestDecision;
}
/**
 * Full hook-specific output with hookEventName discriminator.
 */
export type HookSpecificOutput =
  | ({
      hookEventName: 'PreToolUse';
    } & PreToolUseHookSpecificOutput)
  | ({
      hookEventName: 'PostToolUse';
    } & PostToolUseHookSpecificOutput)
  | ({
      hookEventName: 'PostToolUseFailure';
    } & PostToolUseFailureHookSpecificOutput)
  | ({
      hookEventName: 'UserPromptSubmit';
    } & UserPromptSubmitHookSpecificOutput)
  | ({
      hookEventName: 'SessionStart';
    } & SessionStartHookSpecificOutput)
  | ({
      hookEventName: 'SubagentStart';
    } & SubagentStartHookSpecificOutput)
  | ({
      hookEventName: 'Notification';
    } & NotificationHookSpecificOutput)
  | ({
      hookEventName: 'PermissionRequest';
    } & PermissionRequestHookSpecificOutput);
/**
 * The JSON output format expected by Claude Code (sync hooks only).
 * Matches the SDK's SyncHookJSONOutput type.
 */
export interface SyncHookJSONOutput {
  /** If true, continue processing even after errors. */
  continue?: boolean;
  /** If true, suppress the hook's output from being displayed. */
  suppressOutput?: boolean;
  /** Reason for stopping the session (when blocking). */
  stopReason?: string;
  /** Decision for Stop/SubagentStop hooks: 'approve' allows stop, 'block' prevents it. */
  decision?: 'approve' | 'block';
  /** System message to inject into Claude's context. */
  systemMessage?: string;
  /** Reason shown to Claude when blocking. */
  reason?: string;
  /** Hook-specific output based on the hook type. */
  hookSpecificOutput?: HookSpecificOutput;
}
/**
 * The result of a hook handler, ready for the runtime to process.
 * Exit code is always SUCCESS (0) - blocking behavior is communicated via stdout fields.
 */
export interface HookOutput {
  /** JSON-serializable output to write to stdout. */
  stdout: SyncHookJSONOutput;
}
/**
 * Common options available to all output builders.
 * These map directly to the wire format fields.
 */
export interface CommonOptions {
  /** If true, continue processing even after errors. */
  continue?: boolean;
  /** If true, suppress the hook's output from being displayed. */
  suppressOutput?: boolean;
  /** System message to inject into Claude's context. */
  systemMessage?: string;
  /** Reason for stopping/blocking (sets exit code to BLOCK). */
  stopReason?: string;
}
/**
 * Base structure for all specific outputs.
 */
interface BaseSpecificOutput<T extends string> {
  readonly _type: T;
  stdout: SyncHookJSONOutput;
}
/**
 *
 */
export type PreToolUseOutput = BaseSpecificOutput<'PreToolUse'>;
/**
 *
 */
export type PostToolUseOutput = BaseSpecificOutput<'PostToolUse'>;
/**
 *
 */
export type PostToolUseFailureOutput = BaseSpecificOutput<'PostToolUseFailure'>;
/**
 *
 */
export type NotificationOutput = BaseSpecificOutput<'Notification'>;
/**
 *
 */
export type UserPromptSubmitOutput = BaseSpecificOutput<'UserPromptSubmit'>;
/**
 *
 */
export type SessionStartOutput = BaseSpecificOutput<'SessionStart'>;
/**
 *
 */
export type SessionEndOutput = BaseSpecificOutput<'SessionEnd'>;
/**
 *
 */
export type StopOutput = BaseSpecificOutput<'Stop'>;
/**
 *
 */
export type SubagentStartOutput = BaseSpecificOutput<'SubagentStart'>;
/**
 *
 */
export type SubagentStopOutput = BaseSpecificOutput<'SubagentStop'>;
/**
 *
 */
export type PreCompactOutput = BaseSpecificOutput<'PreCompact'>;
/**
 *
 */
export type PermissionRequestOutput = BaseSpecificOutput<'PermissionRequest'>;
/**
 * Union of all specific output types.
 */
export type SpecificHookOutput =
  | PreToolUseOutput
  | PostToolUseOutput
  | PostToolUseFailureOutput
  | NotificationOutput
  | UserPromptSubmitOutput
  | SessionStartOutput
  | SessionEndOutput
  | StopOutput
  | SubagentStartOutput
  | SubagentStopOutput
  | PreCompactOutput
  | PermissionRequestOutput;
/**
 * Options for decision-based hooks (Stop, SubagentStop).
 */
interface DecisionOptions extends CommonOptions {
  /** Decision: 'approve' allows the action, 'block' prevents it. */
  decision?: 'approve' | 'block';
  /** Reason for the decision (shown to Claude when blocking). */
  reason?: string;
}
/**
 * Options for the PreToolUse output builder.
 * Uses wire format: hookSpecificOutput with permissionDecision.
 */
export type PreToolUseOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: PreToolUseHookSpecificOutput;
};
/**
 * Creates an output for PreToolUse hooks.
 * @param options - Configuration options for the hook output
 * @returns A PreToolUseOutput object ready for the runtime
 * @example
 * ```typescript
 * // Allow tool execution
 * preToolUseOutput({
 *   hookSpecificOutput: { permissionDecision: 'allow' }
 * });
 *
 * // Deny with reason
 * preToolUseOutput({
 *   hookSpecificOutput: {
 *     permissionDecision: 'deny',
 *     permissionDecisionReason: 'Dangerous command detected'
 *   }
 * });
 *
 * // Allow with modified input
 * preToolUseOutput({
 *   hookSpecificOutput: {
 *     permissionDecision: 'allow',
 *     updatedInput: { command: 'ls -la' }
 *   }
 * });
 * ```
 */
export declare const preToolUseOutput: (
  options?: CommonOptions & {
    hookSpecificOutput?: PreToolUseHookSpecificOutput | undefined;
  }
) => {
  readonly _type: 'PreToolUse';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the PostToolUse output builder.
 */
export type PostToolUseOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: PostToolUseHookSpecificOutput;
};
/**
 * Creates an output for PostToolUse hooks.
 * @param options - Configuration options for the hook output
 * @returns A PostToolUseOutput object ready for the runtime
 * @example
 * ```typescript
 * // Add context after a file read
 * postToolUseOutput({
 *   hookSpecificOutput: {
 *     additionalContext: 'File contains sensitive data'
 *   }
 * });
 * ```
 */
export declare const postToolUseOutput: (
  options?: CommonOptions & {
    hookSpecificOutput?: PostToolUseHookSpecificOutput | undefined;
  }
) => {
  readonly _type: 'PostToolUse';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the PostToolUseFailure output builder.
 */
export type PostToolUseFailureOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: PostToolUseFailureHookSpecificOutput;
};
/**
 * Creates an output for PostToolUseFailure hooks.
 * @param options - Configuration options for the hook output
 * @returns A PostToolUseFailureOutput object ready for the runtime
 * @example
 * ```typescript
 * postToolUseFailureOutput({
 *   hookSpecificOutput: {
 *     additionalContext: 'Try using a different approach'
 *   }
 * });
 * ```
 */
export declare const postToolUseFailureOutput: (
  options?: CommonOptions & {
    hookSpecificOutput?: PostToolUseFailureHookSpecificOutput | undefined;
  }
) => {
  readonly _type: 'PostToolUseFailure';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the UserPromptSubmit output builder.
 */
export type UserPromptSubmitOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: UserPromptSubmitHookSpecificOutput;
};
/**
 * Creates an output for UserPromptSubmit hooks.
 * @param options - Configuration options for the hook output
 * @returns A UserPromptSubmitOutput object ready for the runtime
 * @example
 * ```typescript
 * userPromptSubmitOutput({
 *   hookSpecificOutput: {
 *     additionalContext: 'This project uses TypeScript strict mode'
 *   }
 * });
 * ```
 */
export declare const userPromptSubmitOutput: (
  options?: CommonOptions & {
    hookSpecificOutput?: UserPromptSubmitHookSpecificOutput | undefined;
  }
) => {
  readonly _type: 'UserPromptSubmit';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the SessionStart output builder.
 */
export type SessionStartOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: SessionStartHookSpecificOutput;
};
/**
 * Creates an output for SessionStart hooks.
 * @param options - Configuration options for the hook output
 * @returns A SessionStartOutput object ready for the runtime
 * @example
 * ```typescript
 * sessionStartOutput({
 *   hookSpecificOutput: {
 *     additionalContext: JSON.stringify({ project: 'my-project' })
 *   }
 * });
 * ```
 */
export declare const sessionStartOutput: (
  options?: CommonOptions & {
    hookSpecificOutput?: SessionStartHookSpecificOutput | undefined;
  }
) => {
  readonly _type: 'SessionStart';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the SessionEnd output builder.
 * SessionEnd hooks only support common options.
 */
export type SessionEndOptions = CommonOptions;
/**
 * Creates an output for SessionEnd hooks.
 * @param options - Configuration options for the hook output
 * @returns A SessionEndOutput object ready for the runtime
 * @example
 * ```typescript
 * sessionEndOutput({});
 * ```
 */
export declare const sessionEndOutput: (options?: CommonOptions) => {
  readonly _type: 'SessionEnd';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the Stop output builder.
 */
export interface StopOptions extends CommonOptions {
  /** Decision: 'approve' allows stop, 'block' prevents it. */
  decision?: 'approve' | 'block';
  /** Reason for the decision (shown to Claude when blocking). */
  reason?: string;
}
/**
 * Creates an output for Stop hooks.
 * @param options - Configuration options for the hook output
 * @returns A StopOutput object ready for the runtime
 * @example
 * ```typescript
 * // Allow the stop
 * stopOutput({ decision: 'approve' });
 *
 * // Block with reason
 * stopOutput({
 *   decision: 'block',
 *   reason: 'There are uncommitted changes'
 * });
 * ```
 */
export declare const stopOutput: (options?: DecisionOptions) => {
  readonly _type: 'Stop';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the SubagentStart output builder.
 */
export type SubagentStartOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: SubagentStartHookSpecificOutput;
};
/**
 * Creates an output for SubagentStart hooks.
 * @param options - Configuration options for the hook output
 * @returns A SubagentStartOutput object ready for the runtime
 * @example
 * ```typescript
 * subagentStartOutput({
 *   hookSpecificOutput: {
 *     additionalContext: 'Focus on finding patterns'
 *   }
 * });
 * ```
 */
export declare const subagentStartOutput: (
  options?: CommonOptions & {
    hookSpecificOutput?: SubagentStartHookSpecificOutput | undefined;
  }
) => {
  readonly _type: 'SubagentStart';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the SubagentStop output builder.
 */
export interface SubagentStopOptions extends CommonOptions {
  /** Decision: 'approve' allows stop, 'block' prevents it. */
  decision?: 'approve' | 'block';
  /** Reason for the decision (shown to subagent when blocking). */
  reason?: string;
}
/**
 * Creates an output for SubagentStop hooks.
 * @param options - Configuration options for the hook output
 * @returns A SubagentStopOutput object ready for the runtime
 * @example
 * ```typescript
 * // Block with reason
 * subagentStopOutput({
 *   decision: 'block',
 *   reason: 'Task not complete'
 * });
 * ```
 */
export declare const subagentStopOutput: (options?: DecisionOptions) => {
  readonly _type: 'SubagentStop';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the Notification output builder.
 */
export type NotificationOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: NotificationHookSpecificOutput;
};
/**
 * Creates an output for Notification hooks.
 * @param options - Configuration options for the hook output
 * @returns A NotificationOutput object ready for the runtime
 * @example
 * ```typescript
 * // Add context about the notification
 * notificationOutput({
 *   hookSpecificOutput: {
 *     additionalContext: 'Notification forwarded to Slack #alerts channel'
 *   }
 * });
 *
 * // Suppress the notification
 * notificationOutput({ suppressOutput: true });
 * ```
 */
export declare const notificationOutput: (
  options?: CommonOptions & {
    hookSpecificOutput?: NotificationHookSpecificOutput | undefined;
  }
) => {
  readonly _type: 'Notification';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the PreCompact output builder.
 * PreCompact hooks only support common options.
 */
export type PreCompactOptions = CommonOptions;
/**
 * Creates an output for PreCompact hooks.
 * @param options - Configuration options for the hook output
 * @returns A PreCompactOutput object ready for the runtime
 * @example
 * ```typescript
 * preCompactOutput({
 *   systemMessage: 'Remember: strict mode is enabled'
 * });
 * ```
 */
export declare const preCompactOutput: (options?: CommonOptions) => {
  readonly _type: 'PreCompact';
  stdout: SyncHookJSONOutput;
};
/**
 * Options for the PermissionRequest output builder.
 */
export type PermissionRequestOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: PermissionRequestHookSpecificOutput;
};
/**
 * Creates an output for PermissionRequest hooks.
 * @param options - Configuration options for the hook output
 * @returns A PermissionRequestOutput object ready for the runtime
 * @example
 * ```typescript
 * // Auto-approve
 * permissionRequestOutput({
 *   hookSpecificOutput: {
 *     decision: { behavior: 'allow' }
 *   }
 * });
 *
 * // Auto-approve with modified input
 * permissionRequestOutput({
 *   hookSpecificOutput: {
 *     decision: {
 *       behavior: 'allow',
 *       updatedInput: { file_path: '/safe/path' }
 *     }
 *   }
 * });
 *
 * // Auto-deny
 * permissionRequestOutput({
 *   hookSpecificOutput: {
 *     decision: {
 *       behavior: 'deny',
 *       message: 'Not allowed',
 *       interrupt: true
 *     }
 *   }
 * });
 *
 * // Fall through to normal prompt
 * permissionRequestOutput({});
 * ```
 */
export declare const permissionRequestOutput: (
  options?: CommonOptions & {
    hookSpecificOutput?: PermissionRequestHookSpecificOutput | undefined;
  }
) => {
  readonly _type: 'PermissionRequest';
  stdout: SyncHookJSONOutput;
};
/**
 * @deprecated Use CommonOptions instead
 */
export type BaseOptions = CommonOptions;
