/**
 * Output types and builders for Claude Code hooks.
 *
 * Provides type-safe output builder functions for all 12 hook types. Each builder
 * handles exit code semantics, JSON serialization, and validation automatically.
 * The runtime uses these outputs to communicate with Claude Code via stdout/stderr.
 * @see https://code.claude.com/docs/en/hooks
 * @module
 */

import type { PermissionUpdate } from '@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.js';

// ============================================================================
// Exit Code Constants
// ============================================================================

/**
 * Exit codes used by Claude Code hooks.
 *
 * | Exit Code | Name | When Used | Claude Code Behavior |
 * |-----------|------|-----------|---------------------|
 * | 0 | Success | Handler returns normally | Continue, parse stdout as JSON |
 * | 1 | Error | Handler throws, invalid input, non-blocking error | Non-blocking, stderr to user only |
 * | 2 | Block | `{ block: "reason" }` or `stopOutput({ decision: 'block' })` | Blocking, stderr shown to Claude |
 */
export const EXIT_CODES = {
  /** Handler completed successfully. Claude Code parses stdout as JSON. */
  SUCCESS: 0,
  /** Non-blocking error occurred. stderr shown to user only. */
  ERROR: 1,
  /** Blocking action requested. stderr shown to Claude. */
  BLOCK: 2
} as const;

/**
 * Exit code type.
 */
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

// ============================================================================
// Core Output Types
// ============================================================================

/**
 * The result of a hook handler, ready for the runtime to process.
 *
 * This interface represents the complete output that the runtime will use
 * to communicate with Claude Code. The runtime handles JSON serialization
 * of `stdout` and proper formatting of `stderr`.
 * @example
 * ```typescript
 * // A simple success output
 * const output: HookOutput = {
 *   exitCode: EXIT_CODES.SUCCESS,
 *   stdout: { continue: true },
 *   stderr: undefined
 * };
 *
 * // A blocking output
 * const blockOutput: HookOutput = {
 *   exitCode: EXIT_CODES.BLOCK,
 *   stdout: { decision: 'block', reason: 'Operation not allowed' },
 *   stderr: 'Operation blocked by hook'
 * };
 * ```
 */
export interface HookOutput {
  /**
   * Exit code for the hook process.
   * - `0` (SUCCESS): Normal completion, stdout parsed as JSON
   * - `1` (ERROR): Non-blocking error, stderr to user only
   * - `2` (BLOCK): Blocking action, stderr shown to Claude
   */
  exitCode: ExitCode;

  /**
   * JSON-serializable output to write to stdout.
   * Will be serialized by the runtime.
   */
  stdout: SyncHookJSONOutput;

  /**
   * Optional message to write to stderr.
   * Used for error messages and blocking reasons.
   */
  stderr?: string;
}

/**
 * The JSON output format expected by Claude Code (sync hooks only).
 *
 * This matches the `SyncHookJSONOutput` type from the Claude Agent SDK.
 * Async hooks are not supported in this version.
 */
export interface SyncHookJSONOutput {
  /** If true, continue processing even after errors. */
  continue?: boolean;

  /** If true, suppress the hook's output from being displayed. */
  suppressOutput?: boolean;

  /** Reason for stopping the session (when blocking). */
  stopReason?: string;

  /** Decision for Stop hooks: 'approve' allows stop, 'block' prevents it. */
  decision?: 'approve' | 'block';

  /** System message to inject into Claude's context. */
  systemMessage?: string;

  /** Reason shown to Claude when blocking. */
  reason?: string;

  /** Hook-specific output based on the hook type. */
  hookSpecificOutput?: HookSpecificOutput;
}

/**
 * Union type of all hook-specific outputs.
 */
export type HookSpecificOutput =
  | PreToolUseHookSpecificOutput
  | UserPromptSubmitHookSpecificOutput
  | SessionStartHookSpecificOutput
  | SubagentStartHookSpecificOutput
  | PostToolUseHookSpecificOutput
  | PostToolUseFailureHookSpecificOutput
  | PermissionRequestHookSpecificOutput;

// ============================================================================
// Hook-Specific Output Types
// ============================================================================

/**
 * PreToolUse hook-specific output.
 */
export interface PreToolUseHookSpecificOutput {
  hookEventName: 'PreToolUse';
  /** Permission decision: 'allow', 'deny', or 'ask' */
  permissionDecision?: 'allow' | 'deny' | 'ask';
  /** Reason for the permission decision. */
  permissionDecisionReason?: string;
  /** Modified tool input to use instead of original. */
  updatedInput?: Record<string, unknown>;
}

/**
 * UserPromptSubmit hook-specific output.
 */
export interface UserPromptSubmitHookSpecificOutput {
  hookEventName: 'UserPromptSubmit';
  /** Additional context to inject into the conversation. */
  additionalContext?: string;
}

/**
 * SessionStart hook-specific output.
 */
export interface SessionStartHookSpecificOutput {
  hookEventName: 'SessionStart';
  /** Additional context to inject at session start. */
  additionalContext?: string;
}

/**
 * SubagentStart hook-specific output.
 */
export interface SubagentStartHookSpecificOutput {
  hookEventName: 'SubagentStart';
  /** Additional context to inject for the subagent. */
  additionalContext?: string;
}

/**
 * PostToolUse hook-specific output.
 */
export interface PostToolUseHookSpecificOutput {
  hookEventName: 'PostToolUse';
  /** Additional context to add to the transcript. */
  additionalContext?: string;
  /** Updated MCP tool output to replace the original. */
  updatedMCPToolOutput?: unknown;
}

/**
 * PostToolUseFailure hook-specific output.
 */
export interface PostToolUseFailureHookSpecificOutput {
  hookEventName: 'PostToolUseFailure';
  /** Additional context to add after the failure. */
  additionalContext?: string;
}

/**
 * PermissionRequest hook-specific output.
 */
export interface PermissionRequestHookSpecificOutput {
  hookEventName: 'PermissionRequest';
  /** Permission decision details. */
  decision: PermissionRequestDecision;
}

/**
 * Permission request decision - either allow or deny.
 */
export type PermissionRequestDecision = PermissionRequestAllowDecision | PermissionRequestDenyDecision;

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

// ============================================================================
// Base Options
// ============================================================================

/**
 * Common options available to all output builders.
 *
 * These options control general hook behavior and are available on every builder.
 * @example
 * ```typescript
 * // Using base options to block execution
 * preToolUseOutput({
 *   block: 'This operation is not permitted',
 *   systemMessage: 'Contact administrator for access'
 * });
 *
 * // Using base options to continue despite errors
 * sessionStartOutput({
 *   continue: true,
 *   suppressOutput: true
 * });
 * ```
 */
export interface BaseOptions {
  /**
   * Block the current operation with a reason.
   * Sets exit code to 2 (BLOCK) and includes the reason in the output.
   * The reason is shown to Claude.
   */
  block?: string;

  /**
   * Report an error without blocking.
   * Sets exit code to 1 (ERROR) and includes the error message in stderr.
   * The error is shown to the user only, not Claude.
   */
  error?: string;

  /**
   * If true, continue processing even after errors.
   * Default behavior depends on the hook type.
   */
  continue?: boolean;

  /**
   * If true, suppress the hook's output from being displayed.
   * Useful for silent operations that shouldn't clutter the output.
   */
  suppressOutput?: boolean;

  /**
   * System message to inject into Claude's context.
   * Use this to provide additional instructions or context to Claude.
   */
  systemMessage?: string;
}

// ============================================================================
// PreToolUse Output Builder
// ============================================================================

/**
 * Options for the PreToolUse output builder.
 *
 * Supports three mutually exclusive decisions:
 * - `allow`: Permit the tool execution
 * - `deny`: Block the tool execution with a reason
 * - `ask`: Request user confirmation
 *
 * If none are provided, Claude uses default permission behavior.
 */
export type PreToolUseOptions = BaseOptions &
  (
    | {
        /** Allow the tool execution. */
        allow: true;
        deny?: never;
        ask?: never;
        /** Updated tool input to use instead of original. */
        updatedInput?: Record<string, unknown>;
      }
    | {
        /** Deny the tool execution with a reason. */
        deny: string;
        allow?: never;
        ask?: never;
        updatedInput?: never;
      }
    | {
        /** Request user confirmation before execution. */
        ask: string;
        allow?: never;
        deny?: never;
        updatedInput?: never;
      }
    | {
        /** No decision - Claude uses default permission behavior. */
        allow?: never;
        deny?: never;
        ask?: never;
        /** Updated tool input (only valid without deny/ask). */
        updatedInput?: Record<string, unknown>;
      }
  );

/**
 * Creates an output for PreToolUse hooks.
 *
 * PreToolUse hooks fire before any tool executes, allowing you to:
 * - Allow the tool execution (optionally with modified input)
 * - Deny the tool execution with a reason
 * - Ask the user for confirmation
 * - Let Claude use default permission behavior (empty options)
 *
 * Only one of `allow`, `deny`, or `ask` can be specified.
 * @param options - Configuration for the PreToolUse output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Allow tool execution
 * preToolUseOutput({ allow: true });
 *
 * // Deny with reason
 * preToolUseOutput({ deny: 'Dangerous command detected' });
 *
 * // Ask for confirmation
 * preToolUseOutput({ ask: 'This will delete files. Continue?' });
 *
 * // Allow with modified input
 * preToolUseOutput({
 *   allow: true,
 *   updatedInput: { command: 'ls -la' }
 * });
 *
 * // No decision (default behavior)
 * preToolUseOutput({});
 * ```
 * @see https://code.claude.com/docs/en/hooks#pretooluse
 */
export function preToolUseOutput(options: PreToolUseOptions): HookOutput {
  // Handle block/error from base options first
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  // Determine permission decision
  if ('allow' in options && options.allow === true) {
    stdout.hookSpecificOutput = {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: options.updatedInput
    };
  } else if ('deny' in options && options.deny !== undefined) {
    stdout.hookSpecificOutput = {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: options.deny
    };
  } else if ('ask' in options && options.ask !== undefined) {
    stdout.hookSpecificOutput = {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: options.ask
    };
  } else if (options.updatedInput !== undefined) {
    // Allow input modification without explicit allow
    stdout.hookSpecificOutput = {
      hookEventName: 'PreToolUse',
      updatedInput: options.updatedInput
    };
  }

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// PostToolUse Output Builder
// ============================================================================

/**
 * Options for the PostToolUse output builder.
 */
export interface PostToolUseOptions extends BaseOptions {
  /**
   * Additional context to add to the transcript.
   * This will be visible to Claude in future turns.
   */
  additionalContext?: string;

  /**
   * Updated MCP tool output to replace the original.
   * Use this to modify or enhance tool results.
   */
  updatedMCPToolOutput?: unknown;
}

/**
 * Creates an output for PostToolUse hooks.
 *
 * PostToolUse hooks fire after a tool executes successfully, allowing you to:
 * - Add additional context to the conversation transcript
 * - Modify MCP tool output before it's shown to Claude
 * - Inject system messages
 * @param options - Configuration for the PostToolUse output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Add context after a file read
 * postToolUseOutput({
 *   additionalContext: 'File contains sensitive data'
 * });
 *
 * // Modify MCP tool output
 * postToolUseOutput({
 *   updatedMCPToolOutput: { sanitized: true, data: '...' }
 * });
 *
 * // No modifications needed
 * postToolUseOutput({});
 * ```
 * @see https://code.claude.com/docs/en/hooks#posttooluse
 */
export function postToolUseOutput(options: PostToolUseOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  if (options.additionalContext !== undefined || options.updatedMCPToolOutput !== undefined) {
    stdout.hookSpecificOutput = {
      hookEventName: 'PostToolUse',
      additionalContext: options.additionalContext,
      updatedMCPToolOutput: options.updatedMCPToolOutput
    };
  }

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// PostToolUseFailure Output Builder
// ============================================================================

/**
 * Options for the PostToolUseFailure output builder.
 */
export interface PostToolUseFailureOptions extends BaseOptions {
  /**
   * Additional context to add after the failure.
   * Use this to provide guidance on how to handle or recover from the failure.
   */
  additionalContext?: string;
}

/**
 * Creates an output for PostToolUseFailure hooks.
 *
 * PostToolUseFailure hooks fire after a tool execution fails, allowing you to:
 * - Add additional context about the failure
 * - Provide recovery suggestions
 * - Log or report the failure
 * @param options - Configuration for the PostToolUseFailure output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Add context about the failure
 * postToolUseFailureOutput({
 *   additionalContext: 'Try using a different approach'
 * });
 *
 * // Just acknowledge the failure
 * postToolUseFailureOutput({});
 * ```
 * @see https://code.claude.com/docs/en/hooks#posttoolusefailure
 */
export function postToolUseFailureOutput(options: PostToolUseFailureOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  if (options.additionalContext !== undefined) {
    stdout.hookSpecificOutput = {
      hookEventName: 'PostToolUseFailure',
      additionalContext: options.additionalContext
    };
  }

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// UserPromptSubmit Output Builder
// ============================================================================

/**
 * Options for the UserPromptSubmit output builder.
 */
export interface UserPromptSubmitOptions extends BaseOptions {
  /**
   * Additional context to inject into the conversation.
   * This context will be available to Claude when processing the user's prompt.
   */
  additionalContext?: string;
}

/**
 * Creates an output for UserPromptSubmit hooks.
 *
 * UserPromptSubmit hooks fire when a user submits a prompt, allowing you to:
 * - Inject additional context or instructions
 * - Add project-specific information
 * - Provide relevant documentation
 * @param options - Configuration for the UserPromptSubmit output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Add project context to every prompt
 * userPromptSubmitOutput({
 *   additionalContext: 'This project uses TypeScript strict mode'
 * });
 *
 * // No additional context
 * userPromptSubmitOutput({});
 * ```
 * @see https://code.claude.com/docs/en/hooks#userpromptsubmit
 */
export function userPromptSubmitOutput(options: UserPromptSubmitOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  if (options.additionalContext !== undefined) {
    stdout.hookSpecificOutput = {
      hookEventName: 'UserPromptSubmit',
      additionalContext: options.additionalContext
    };
  }

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// SessionStart Output Builder
// ============================================================================

/**
 * Options for the SessionStart output builder.
 */
export interface SessionStartOptions extends BaseOptions {
  /**
   * Additional context to inject at session start.
   * Use this to initialize session state or provide startup instructions.
   */
  additionalContext?: string;
}

/**
 * Creates an output for SessionStart hooks.
 *
 * SessionStart hooks fire when a Claude Code session starts or restarts,
 * allowing you to:
 * - Initialize session context
 * - Inject startup instructions
 * - Configure session behavior
 * @param options - Configuration for the SessionStart output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Inject initial context
 * sessionStartOutput({
 *   additionalContext: JSON.stringify({
 *     project: 'my-project',
 *     version: '1.0.0'
 *   })
 * });
 *
 * // No initial context
 * sessionStartOutput({});
 * ```
 * @see https://code.claude.com/docs/en/hooks#sessionstart
 */
export function sessionStartOutput(options: SessionStartOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  if (options.additionalContext !== undefined) {
    stdout.hookSpecificOutput = {
      hookEventName: 'SessionStart',
      additionalContext: options.additionalContext
    };
  }

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// SessionEnd Output Builder
// ============================================================================

/**
 * Options for the SessionEnd output builder.
 *
 * SessionEnd hooks only support base options as there is no hook-specific
 * output for session cleanup.
 */
export type SessionEndOptions = BaseOptions;

/**
 * Creates an output for SessionEnd hooks.
 *
 * SessionEnd hooks fire when a Claude Code session ends, allowing you to:
 * - Perform cleanup operations
 * - Log session metrics
 * - Persist session state
 *
 * This hook does not have hook-specific output options.
 * @param options - Configuration for the SessionEnd output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Simple acknowledgment
 * sessionEndOutput({});
 *
 * // With system message
 * sessionEndOutput({
 *   systemMessage: 'Session cleanup complete'
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#sessionend
 */
export function sessionEndOutput(options: SessionEndOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// Stop Output Builder
// ============================================================================

/**
 * Options for the Stop output builder.
 */
export interface StopOptions extends BaseOptions {
  /**
   * Decision on whether to allow the stop.
   * - `'approve'`: Allow Claude Code to stop
   * - `'block'`: Prevent Claude Code from stopping
   */
  decision?: 'approve' | 'block';

  /**
   * Reason for the decision (especially useful when blocking).
   * This reason is shown to Claude.
   */
  reason?: string;
}

/**
 * Creates an output for Stop hooks.
 *
 * Stop hooks fire when Claude Code is about to stop, allowing you to:
 * - Allow the stop to proceed
 * - Block the stop with a reason
 * - Perform cleanup before stopping
 *
 * If no decision is provided, Claude proceeds with the stop (no block).
 * @param options - Configuration for the Stop output
 * @returns HookOutput ready for the runtime to process
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
 *
 * // No decision (default: allow stop)
 * stopOutput({});
 * ```
 * @see https://code.claude.com/docs/en/hooks#stop
 */
export function stopOutput(options: StopOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  // Stop hooks use top-level decision and reason fields
  if (options.decision !== undefined) {
    stdout.decision = options.decision;
  }
  if (options.reason !== undefined) {
    stdout.reason = options.reason;
  }

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// SubagentStart Output Builder
// ============================================================================

/**
 * Options for the SubagentStart output builder.
 */
export interface SubagentStartOptions extends BaseOptions {
  /**
   * Additional context to inject for the subagent.
   * Use this to provide specific instructions or context for subagent execution.
   */
  additionalContext?: string;
}

/**
 * Creates an output for SubagentStart hooks.
 *
 * SubagentStart hooks fire when a subagent (Task tool) starts, allowing you to:
 * - Inject context for the subagent
 * - Provide task-specific instructions
 * - Configure subagent behavior
 * @param options - Configuration for the SubagentStart output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Add context for explore subagents
 * subagentStartOutput({
 *   additionalContext: 'Focus on finding patterns and conventions'
 * });
 *
 * // No additional context
 * subagentStartOutput({});
 * ```
 * @see https://code.claude.com/docs/en/hooks#subagentstart
 */
export function subagentStartOutput(options: SubagentStartOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  if (options.additionalContext !== undefined) {
    stdout.hookSpecificOutput = {
      hookEventName: 'SubagentStart',
      additionalContext: options.additionalContext
    };
  }

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// SubagentStop Output Builder
// ============================================================================

/**
 * Options for the SubagentStop output builder.
 *
 * SubagentStop hooks only support base options as there is no hook-specific
 * output for subagent cleanup.
 */
export type SubagentStopOptions = BaseOptions;

/**
 * Creates an output for SubagentStop hooks.
 *
 * SubagentStop hooks fire when a subagent completes or stops, allowing you to:
 * - Perform cleanup operations
 * - Log subagent results
 * - Process subagent output
 *
 * This hook does not have hook-specific output options.
 * @param options - Configuration for the SubagentStop output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Simple acknowledgment
 * subagentStopOutput({});
 *
 * // With system message
 * subagentStopOutput({
 *   systemMessage: 'Subagent completed successfully'
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#subagentstop
 */
export function subagentStopOutput(options: SubagentStopOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// Notification Output Builder
// ============================================================================

/**
 * Options for the Notification output builder.
 *
 * Notification hooks only support base options as there is no hook-specific
 * output for notification acknowledgment.
 */
export type NotificationOptions = BaseOptions;

/**
 * Creates an output for Notification hooks.
 *
 * Notification hooks fire when Claude Code sends a notification, allowing you to:
 * - Forward notifications to external systems
 * - Log notification events
 * - Trigger custom alerting
 *
 * This hook does not have hook-specific output options.
 * @param options - Configuration for the Notification output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Simple acknowledgment
 * notificationOutput({});
 *
 * // With system message
 * notificationOutput({
 *   systemMessage: 'Notification forwarded to Slack'
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#notification
 */
export function notificationOutput(options: NotificationOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// PreCompact Output Builder
// ============================================================================

/**
 * Options for the PreCompact output builder.
 *
 * PreCompact hooks only support base options as there is no hook-specific
 * output for pre-compaction.
 */
export type PreCompactOptions = BaseOptions;

/**
 * Creates an output for PreCompact hooks.
 *
 * PreCompact hooks fire before context compaction occurs, allowing you to:
 * - Preserve important information before compaction
 * - Log compaction events
 * - Inject context to be included in the compacted result
 *
 * This hook does not have hook-specific output options.
 * @param options - Configuration for the PreCompact output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Simple acknowledgment
 * preCompactOutput({});
 *
 * // With system message to preserve context
 * preCompactOutput({
 *   systemMessage: 'Remember: strict mode is enabled'
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#precompact
 */
export function preCompactOutput(options: PreCompactOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// PermissionRequest Output Builder
// ============================================================================

/**
 * Options for the PermissionRequest output builder.
 *
 * Supports two mutually exclusive decisions:
 * - `allow`: Permit the operation (with optional input modification)
 * - `deny`: Block the operation (with optional message and interrupt)
 *
 * If neither is provided, falls through to normal permission prompt.
 */
export type PermissionRequestOptions = BaseOptions &
  (
    | {
        /** Allow the operation. */
        allow: true;
        /** Updated tool input to use. */
        updatedInput?: Record<string, unknown>;
        /** Permission updates to apply for future operations. */
        updatedPermissions?: PermissionUpdate[];
        deny?: never;
        interrupt?: never;
      }
    | {
        /** Deny the operation with an optional message. */
        deny: true;
        /** Message explaining the denial. */
        message?: string;
        /** Whether to interrupt the current operation. */
        interrupt?: boolean;
        allow?: never;
        updatedInput?: never;
        updatedPermissions?: never;
      }
    | {
        /** No decision - fall through to normal permission prompt. */
        allow?: never;
        deny?: never;
        updatedInput?: never;
        updatedPermissions?: never;
        message?: never;
        interrupt?: never;
      }
  );

/**
 * Creates an output for PermissionRequest hooks.
 *
 * PermissionRequest hooks fire when a permission prompt would be shown,
 * allowing you to:
 * - Auto-approve operations with optional input modification
 * - Auto-deny operations with a message
 * - Fall through to normal permission prompt behavior
 * @param options - Configuration for the PermissionRequest output
 * @returns HookOutput ready for the runtime to process
 * @example
 * ```typescript
 * // Auto-approve with input modification
 * permissionRequestOutput({
 *   allow: true,
 *   updatedInput: { file_path: '/safe/path/file.txt' }
 * });
 *
 * // Auto-deny with message
 * permissionRequestOutput({
 *   deny: true,
 *   message: 'This operation is not allowed',
 *   interrupt: true
 * });
 *
 * // Fall through to normal prompt
 * permissionRequestOutput({});
 * ```
 * @see https://code.claude.com/docs/en/hooks#permissionrequest
 */
export function permissionRequestOutput(options: PermissionRequestOptions): HookOutput {
  if (options.block !== undefined) {
    return createBlockOutput(options.block, options.systemMessage);
  }
  if (options.error !== undefined) {
    return createErrorOutput(options.error);
  }

  const stdout: SyncHookJSONOutput = {};
  applyBaseOptions(stdout, options);

  // Determine permission decision
  if ('allow' in options && options.allow === true) {
    stdout.hookSpecificOutput = {
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'allow',
        updatedInput: options.updatedInput,
        updatedPermissions: options.updatedPermissions
      }
    };
  } else if ('deny' in options && options.deny === true) {
    stdout.hookSpecificOutput = {
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'deny',
        message: options.message,
        interrupt: options.interrupt
      }
    };
  }

  return {
    exitCode: EXIT_CODES.SUCCESS,
    stdout,
    stderr: undefined
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Applies base options to the stdout object.
 * @param stdout - The stdout object to modify
 * @param options - Base options to apply
 */
function applyBaseOptions(stdout: SyncHookJSONOutput, options: BaseOptions): void {
  if (options.continue !== undefined) {
    stdout.continue = options.continue;
  }
  if (options.suppressOutput !== undefined) {
    stdout.suppressOutput = options.suppressOutput;
  }
  if (options.systemMessage !== undefined) {
    stdout.systemMessage = options.systemMessage;
  }
}

/**
 * Creates a blocking output.
 * @param reason - The reason for blocking
 * @param systemMessage - Optional system message
 * @returns HookOutput with exit code 2
 */
function createBlockOutput(reason: string, systemMessage?: string): HookOutput {
  const stdout: SyncHookJSONOutput = {
    stopReason: reason
  };
  if (systemMessage !== undefined) {
    stdout.systemMessage = systemMessage;
  }
  return {
    exitCode: EXIT_CODES.BLOCK,
    stdout,
    stderr: reason
  };
}

/**
 * Creates an error output.
 * @param message - The error message
 * @returns HookOutput with exit code 1
 */
function createErrorOutput(message: string): HookOutput {
  return {
    exitCode: EXIT_CODES.ERROR,
    stdout: {},
    stderr: message
  };
}
