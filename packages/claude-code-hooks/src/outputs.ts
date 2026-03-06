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
  ElicitationHookSpecificOutput as SDKElicitationHookSpecificOutput,
  ElicitationResultHookSpecificOutput as SDKElicitationResultHookSpecificOutput,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  NotificationHookSpecificOutput as SDKNotificationHookSpecificOutput,
  PermissionRequestHookSpecificOutput as SDKPermissionRequestHookSpecificOutput,
  PostToolUseFailureHookSpecificOutput as SDKPostToolUseFailureHookSpecificOutput,
  PostToolUseHookSpecificOutput as SDKPostToolUseHookSpecificOutput,
  PreToolUseHookSpecificOutput as SDKPreToolUseHookSpecificOutput,
  SessionStartHookSpecificOutput as SDKSessionStartHookSpecificOutput,
  SetupHookSpecificOutput as SDKSetupHookSpecificOutput,
  SubagentStartHookSpecificOutput as SDKSubagentStartHookSpecificOutput,
  SyncHookJSONOutput as SDKSyncHookJSONOutput,
  UserPromptSubmitHookSpecificOutput as SDKUserPromptSubmitHookSpecificOutput,
} from "@anthropic-ai/claude-agent-sdk/sdk.js";

// ============================================================================
// Exit Code Constants
// ============================================================================

/**
 * Exit codes used by Claude Code hooks.
 *
 * | Exit Code | Name | When Used | Claude Code Behavior |
 * |-----------|------|-----------|---------------------|
 * | 0 | Success | Handler returns normally | Continue, parse stdout as JSON |
 * | 1 | Error | Invalid input, non-blocking error | Non-blocking, stderr to user only |
 * | 2 | Block | Handler throws OR `stopReason` set | Blocking, stderr shown to Claude |
 */
export const EXIT_CODES = {
  /** Handler completed successfully. Claude Code parses stdout as JSON. */
  SUCCESS: 0,
  /** Non-blocking error occurred (e.g., invalid input). stderr shown to user only. */
  ERROR: 1,
  /** Handler threw exception OR blocking action requested. stderr shown to Claude. */
  BLOCK: 2,
} as const;

/**
 * Exit code type.
 */
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

// ============================================================================
// Re-export SDK types
// ============================================================================

/**
 * Re-export the SDK's SyncHookJSONOutput type.
 */
export type { SDKSyncHookJSONOutput };

/**
 * Re-export SDK hook-specific output types (includes hookEventName discriminator).
 */
export type {
  SDKElicitationHookSpecificOutput,
  SDKElicitationResultHookSpecificOutput,
  SDKNotificationHookSpecificOutput,
  SDKPreToolUseHookSpecificOutput,
  SDKPostToolUseHookSpecificOutput,
  SDKPostToolUseFailureHookSpecificOutput,
  SDKUserPromptSubmitHookSpecificOutput,
  SDKSessionStartHookSpecificOutput,
  SDKSetupHookSpecificOutput,
  SDKSubagentStartHookSpecificOutput,
  SDKPermissionRequestHookSpecificOutput,
};

// ============================================================================
// Hook-Specific Output Field Types (for builder options)
// These omit hookEventName which is added automatically by builders.
// ============================================================================

/**
 * PreToolUse hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type PreToolUseHookSpecificOutput = Omit<SDKPreToolUseHookSpecificOutput, "hookEventName">;

/**
 * PostToolUse hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type PostToolUseHookSpecificOutput = Omit<SDKPostToolUseHookSpecificOutput, "hookEventName">;

/**
 * PostToolUseFailure hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type PostToolUseFailureHookSpecificOutput = Omit<SDKPostToolUseFailureHookSpecificOutput, "hookEventName">;

/**
 * UserPromptSubmit hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type UserPromptSubmitHookSpecificOutput = Omit<SDKUserPromptSubmitHookSpecificOutput, "hookEventName">;

/**
 * SessionStart hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type SessionStartHookSpecificOutput = Omit<SDKSessionStartHookSpecificOutput, "hookEventName">;

/**
 * SubagentStart hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type SubagentStartHookSpecificOutput = Omit<SDKSubagentStartHookSpecificOutput, "hookEventName">;

/**
 * PermissionRequest hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type PermissionRequestHookSpecificOutput = Omit<SDKPermissionRequestHookSpecificOutput, "hookEventName">;

/**
 * Setup hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type SetupHookSpecificOutput = Omit<SDKSetupHookSpecificOutput, "hookEventName">;

/**
 * Elicitation hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type ElicitationHookSpecificOutput = Omit<SDKElicitationHookSpecificOutput, "hookEventName">;

/**
 * ElicitationResult hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type ElicitationResultHookSpecificOutput = Omit<SDKElicitationResultHookSpecificOutput, "hookEventName">;

/**
 * Allow decision for permission requests.
 * Derived from SDK's PermissionRequestHookSpecificOutput.
 */
export type PermissionRequestAllowDecision = Extract<
  SDKPermissionRequestHookSpecificOutput["decision"],
  { behavior: "allow" }
>;

/**
 * Deny decision for permission requests.
 * Derived from SDK's PermissionRequestHookSpecificOutput.
 */
export type PermissionRequestDenyDecision = Extract<
  SDKPermissionRequestHookSpecificOutput["decision"],
  { behavior: "deny" }
>;

/**
 * Permission request decision - either allow or deny.
 * Derived from SDK's PermissionRequestHookSpecificOutput.
 */
export type PermissionRequestDecision = SDKPermissionRequestHookSpecificOutput["decision"];

/**
 * Notification hook-specific output fields.
 * Omits `hookEventName` which is added automatically by the builder.
 */
export type NotificationHookSpecificOutput = Omit<SDKNotificationHookSpecificOutput, "hookEventName">;

// ============================================================================
// Wire Format Output Types
// ============================================================================

/**
 * Full hook-specific output with hookEventName discriminator.
 */
export type HookSpecificOutput =
  | SDKPreToolUseHookSpecificOutput
  | SDKPostToolUseHookSpecificOutput
  | SDKPostToolUseFailureHookSpecificOutput
  | SDKUserPromptSubmitHookSpecificOutput
  | SDKSessionStartHookSpecificOutput
  | SDKSetupHookSpecificOutput
  | SDKSubagentStartHookSpecificOutput
  | SDKPermissionRequestHookSpecificOutput
  | SDKNotificationHookSpecificOutput
  | SDKElicitationHookSpecificOutput
  | SDKElicitationResultHookSpecificOutput;

/**
 * The JSON output format expected by Claude Code (sync hooks only).
 * Extends SDK's SyncHookJSONOutput to include Notification hook support.
 */
export interface SyncHookJSONOutput {
  /** If true, continue processing even after errors. */
  continue?: boolean;
  /** If true, suppress the hook's output from being displayed. */
  suppressOutput?: boolean;
  /** Reason for stopping the session (when blocking). */
  stopReason?: string;
  /** Decision for Stop/SubagentStop hooks: 'approve' allows stop, 'block' prevents it. */
  decision?: "approve" | "block";
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
  /** Optional message to write to stderr. When present, the runtime exits with code 2 (BLOCK). */
  stderr?: string;
}

// ============================================================================
// Common Options
// ============================================================================

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
 * Options for exit-code-based hooks (TeammateIdle, TaskCompleted).
 *
 * These hooks use exit codes only, not JSON decision control.
 * When `stderr` is provided, the runtime writes it to stderr and exits with code 2 (BLOCK).
 * When absent, the hook exits with code 0 (SUCCESS).
 */
export interface ExitCodeOptions {
  /** Message to write to stderr. When present, exits with code 2 (BLOCK). */
  stderr?: string;
}

// ============================================================================
// Specific Output Types (returned by output builders)
// ============================================================================

/**
 * Base structure for all specific outputs.
 */
interface BaseSpecificOutput<T extends string> {
  readonly _type: T;
  stdout: SyncHookJSONOutput;
  stderr?: string;
}

/**
 *
 */
export type PreToolUseOutput = BaseSpecificOutput<"PreToolUse">;
/**
 *
 */
export type PostToolUseOutput = BaseSpecificOutput<"PostToolUse">;
/**
 *
 */
export type PostToolUseFailureOutput = BaseSpecificOutput<"PostToolUseFailure">;
/**
 *
 */
export type NotificationOutput = BaseSpecificOutput<"Notification">;
/**
 *
 */
export type UserPromptSubmitOutput = BaseSpecificOutput<"UserPromptSubmit">;
/**
 *
 */
export type SessionStartOutput = BaseSpecificOutput<"SessionStart">;
/**
 *
 */
export type SessionEndOutput = BaseSpecificOutput<"SessionEnd">;
/**
 *
 */
export type StopOutput = BaseSpecificOutput<"Stop">;
/**
 *
 */
export type SubagentStartOutput = BaseSpecificOutput<"SubagentStart">;
/**
 *
 */
export type SubagentStopOutput = BaseSpecificOutput<"SubagentStop">;
/**
 *
 */
export type PreCompactOutput = BaseSpecificOutput<"PreCompact">;
/**
 *
 */
export type PermissionRequestOutput = BaseSpecificOutput<"PermissionRequest">;
/**
 *
 */
export type SetupOutput = BaseSpecificOutput<"Setup">;
/**
 *
 */
export type TeammateIdleOutput = BaseSpecificOutput<"TeammateIdle">;
/**
 *
 */
export type TaskCompletedOutput = BaseSpecificOutput<"TaskCompleted">;
/**
 *
 */
export type ElicitationOutput = BaseSpecificOutput<"Elicitation">;
/**
 *
 */
export type ElicitationResultOutput = BaseSpecificOutput<"ElicitationResult">;
/**
 *
 */
export type ConfigChangeOutput = BaseSpecificOutput<"ConfigChange">;
/**
 *
 */
export type InstructionsLoadedOutput = BaseSpecificOutput<"InstructionsLoaded">;
/**
 *
 */
export type WorktreeCreateOutput = BaseSpecificOutput<"WorktreeCreate">;
/**
 *
 */
export type WorktreeRemoveOutput = BaseSpecificOutput<"WorktreeRemove">;

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
  | PermissionRequestOutput
  | SetupOutput
  | TeammateIdleOutput
  | TaskCompletedOutput
  | ElicitationOutput
  | ElicitationResultOutput
  | ConfigChangeOutput
  | InstructionsLoadedOutput
  | WorktreeCreateOutput
  | WorktreeRemoveOutput;

// ============================================================================
// Output Builder Factories
// ============================================================================

/**
 * Factory for hooks that have hookSpecificOutput with a hookEventName discriminator.
 * @param hookType - The hook type name used as the _type discriminator
 * @returns A builder function that creates the output object
 * @internal
 */
function createHookSpecificOutputBuilder<T extends string, THookSpecific>(hookType: T) {
  return (
    options: CommonOptions & { hookSpecificOutput?: THookSpecific } = {},
  ): { readonly _type: T; stdout: SyncHookJSONOutput } => {
    const { hookSpecificOutput, ...rest } = options;
    const stdout: SyncHookJSONOutput =
      hookSpecificOutput !== undefined
        ? { ...rest, hookSpecificOutput: { hookEventName: hookType, ...hookSpecificOutput } as HookSpecificOutput }
        : rest;
    return { _type: hookType, stdout };
  };
}

/**
 * Factory for hooks that only use CommonOptions (simple passthrough).
 * @param hookType - The hook type name used as the _type discriminator
 * @returns A builder function that creates the output object
 * @internal
 */
function createSimpleOutputBuilder<T extends string>(hookType: T) {
  return (options: CommonOptions = {}): { readonly _type: T; stdout: SyncHookJSONOutput } => ({
    _type: hookType,
    stdout: options,
  });
}

/**
 * Options for decision-based hooks (Stop, SubagentStop).
 */
interface DecisionOptions extends CommonOptions {
  /** Decision: 'approve' allows the action, 'block' prevents it. */
  decision?: "approve" | "block";
  /** Reason for the decision (shown to Claude when blocking). */
  reason?: string;
}

/**
 * Factory for hooks that use decision-based options (Stop, SubagentStop).
 * @param hookType - The hook type name used as the _type discriminator
 * @returns A builder function that creates the output object
 * @internal
 */
function createDecisionOutputBuilder<T extends string>(hookType: T) {
  return (options: DecisionOptions = {}): { readonly _type: T; stdout: SyncHookJSONOutput } => ({
    _type: hookType,
    stdout: options,
  });
}

/**
 * Factory for exit-code-based hooks (TeammateIdle, TaskCompleted).
 *
 * These hooks don't use JSON decision control (no CommonOptions).
 * The only option is `stderr` — when present, it triggers exit code 2 (BLOCK).
 * Stdout always receives `{}` (empty JSON object).
 * @param hookType - The hook type name used as the _type discriminator
 * @returns A builder function that creates the output object
 * @internal
 */
function createExitCodeOutputBuilder<T extends string>(hookType: T) {
  return ({ stderr }: ExitCodeOptions = {}): { readonly _type: T; stdout: SyncHookJSONOutput; stderr?: string } => ({
    _type: hookType,
    stdout: {},
    ...(stderr !== undefined ? { stderr } : {}),
  });
}

// ============================================================================
// PreToolUse Output Builder
// ============================================================================

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
export const preToolUseOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "PreToolUse",
  PreToolUseHookSpecificOutput
>("PreToolUse");

// ============================================================================
// PostToolUse Output Builder
// ============================================================================

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
export const postToolUseOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "PostToolUse",
  PostToolUseHookSpecificOutput
>("PostToolUse");

// ============================================================================
// PostToolUseFailure Output Builder
// ============================================================================

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
export const postToolUseFailureOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "PostToolUseFailure",
  PostToolUseFailureHookSpecificOutput
>("PostToolUseFailure");

// ============================================================================
// UserPromptSubmit Output Builder
// ============================================================================

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
export const userPromptSubmitOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "UserPromptSubmit",
  UserPromptSubmitHookSpecificOutput
>("UserPromptSubmit");

// ============================================================================
// SessionStart Output Builder
// ============================================================================

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
export const sessionStartOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "SessionStart",
  SessionStartHookSpecificOutput
>("SessionStart");

// ============================================================================
// SessionEnd Output Builder
// ============================================================================

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
export const sessionEndOutput = /* @__PURE__ */ createSimpleOutputBuilder<"SessionEnd">("SessionEnd");

// ============================================================================
// Stop Output Builder
// ============================================================================

/**
 * Options for the Stop output builder.
 */
export interface StopOptions extends CommonOptions {
  /** Decision: 'approve' allows stop, 'block' prevents it. */
  decision?: "approve" | "block";
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
export const stopOutput = /* @__PURE__ */ createDecisionOutputBuilder<"Stop">("Stop");

// ============================================================================
// SubagentStart Output Builder
// ============================================================================

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
export const subagentStartOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "SubagentStart",
  SubagentStartHookSpecificOutput
>("SubagentStart");

// ============================================================================
// SubagentStop Output Builder
// ============================================================================

/**
 * Options for the SubagentStop output builder.
 */
export interface SubagentStopOptions extends CommonOptions {
  /** Decision: 'approve' allows stop, 'block' prevents it. */
  decision?: "approve" | "block";
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
export const subagentStopOutput = /* @__PURE__ */ createDecisionOutputBuilder<"SubagentStop">("SubagentStop");

// ============================================================================
// Notification Output Builder
// ============================================================================

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
export const notificationOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "Notification",
  NotificationHookSpecificOutput
>("Notification");

// ============================================================================
// PreCompact Output Builder
// ============================================================================

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
export const preCompactOutput = /* @__PURE__ */ createSimpleOutputBuilder<"PreCompact">("PreCompact");

// ============================================================================
// PermissionRequest Output Builder
// ============================================================================

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
export const permissionRequestOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "PermissionRequest",
  PermissionRequestHookSpecificOutput
>("PermissionRequest");

// ============================================================================
// Setup Output Builder
// ============================================================================

/**
 * Options for the Setup output builder.
 */
export type SetupOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: SetupHookSpecificOutput;
};

/**
 * Creates an output for Setup hooks.
 * @param options - Configuration options for the hook output
 * @returns A SetupOutput object ready for the runtime
 * @example
 * ```typescript
 * // Add context during setup
 * setupOutput({
 *   hookSpecificOutput: {
 *     additionalContext: 'Project initialized with custom settings'
 *   }
 * });
 *
 * // Simple passthrough
 * setupOutput({});
 * ```
 */
export const setupOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<"Setup", SetupHookSpecificOutput>("Setup");

// ============================================================================
// TeammateIdle Output Builder
// ============================================================================

/**
 * Options for the TeammateIdle output builder.
 * TeammateIdle hooks use exit codes only, not JSON decision control.
 */
export type TeammateIdleOptions = ExitCodeOptions;

/**
 * Creates an output for TeammateIdle hooks.
 * @param options - Configuration options for the hook output
 * @returns A TeammateIdleOutput object ready for the runtime
 * @example
 * ```typescript
 * // Allow teammate to go idle
 * teammateIdleOutput({});
 *
 * // Block with feedback
 * teammateIdleOutput({ stderr: 'Continue working: unfinished tasks remain.' });
 * ```
 */
export const teammateIdleOutput = /* @__PURE__ */ createExitCodeOutputBuilder<"TeammateIdle">("TeammateIdle");

// ============================================================================
// TaskCompleted Output Builder
// ============================================================================

/**
 * Options for the TaskCompleted output builder.
 * TaskCompleted hooks use exit codes only, not JSON decision control.
 */
export type TaskCompletedOptions = ExitCodeOptions;

/**
 * Creates an output for TaskCompleted hooks.
 * @param options - Configuration options for the hook output
 * @returns A TaskCompletedOutput object ready for the runtime
 * @example
 * ```typescript
 * // Allow task completion
 * taskCompletedOutput({});
 *
 * // Block with feedback
 * taskCompletedOutput({ stderr: 'Cannot complete: tests are failing.' });
 * ```
 */
export const taskCompletedOutput = /* @__PURE__ */ createExitCodeOutputBuilder<"TaskCompleted">("TaskCompleted");

// ============================================================================
// Elicitation Output Builder
// ============================================================================

/**
 * Options for the Elicitation output builder.
 */
export type ElicitationOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: ElicitationHookSpecificOutput;
};

/**
 * Creates an output for Elicitation hooks.
 * @param options - Configuration options for the hook output
 * @returns An ElicitationOutput object ready for the runtime
 * @example
 * ```typescript
 * // Accept the elicitation
 * elicitationOutput({
 *   hookSpecificOutput: { action: 'accept', content: { username: 'alice' } }
 * });
 *
 * // Decline the elicitation
 * elicitationOutput({
 *   hookSpecificOutput: { action: 'decline' }
 * });
 * ```
 */
export const elicitationOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "Elicitation",
  ElicitationHookSpecificOutput
>("Elicitation");

// ============================================================================
// ElicitationResult Output Builder
// ============================================================================

/**
 * Options for the ElicitationResult output builder.
 */
export type ElicitationResultOptions = CommonOptions & {
  /** Hook-specific output matching the wire format. */
  hookSpecificOutput?: ElicitationResultHookSpecificOutput;
};

/**
 * Creates an output for ElicitationResult hooks.
 * @param options - Configuration options for the hook output
 * @returns An ElicitationResultOutput object ready for the runtime
 * @example
 * ```typescript
 * elicitationResultOutput({});
 * ```
 */
export const elicitationResultOutput = /* @__PURE__ */ createHookSpecificOutputBuilder<
  "ElicitationResult",
  ElicitationResultHookSpecificOutput
>("ElicitationResult");

// ============================================================================
// ConfigChange Output Builder
// ============================================================================

/**
 * Options for the ConfigChange output builder.
 * ConfigChange hooks only support common options.
 */
export type ConfigChangeOptions = CommonOptions;

/**
 * Creates an output for ConfigChange hooks.
 * @param options - Configuration options for the hook output
 * @returns A ConfigChangeOutput object ready for the runtime
 * @example
 * ```typescript
 * configChangeOutput({});
 * ```
 */
export const configChangeOutput = /* @__PURE__ */ createSimpleOutputBuilder<"ConfigChange">("ConfigChange");

// ============================================================================
// InstructionsLoaded Output Builder
// ============================================================================

/**
 * Options for the InstructionsLoaded output builder.
 * InstructionsLoaded hooks only support common options.
 */
export type InstructionsLoadedOptions = CommonOptions;

/**
 * Creates an output for InstructionsLoaded hooks.
 * @param options - Configuration options for the hook output
 * @returns An InstructionsLoadedOutput object ready for the runtime
 * @example
 * ```typescript
 * instructionsLoadedOutput({});
 * ```
 */
export const instructionsLoadedOutput =
  /* @__PURE__ */ createSimpleOutputBuilder<"InstructionsLoaded">("InstructionsLoaded");

// ============================================================================
// WorktreeCreate Output Builder
// ============================================================================

/**
 * Options for the WorktreeCreate output builder.
 * WorktreeCreate hooks only support common options.
 */
export type WorktreeCreateOptions = CommonOptions;

/**
 * Creates an output for WorktreeCreate hooks.
 * @param options - Configuration options for the hook output
 * @returns A WorktreeCreateOutput object ready for the runtime
 * @example
 * ```typescript
 * worktreeCreateOutput({});
 * ```
 */
export const worktreeCreateOutput = /* @__PURE__ */ createSimpleOutputBuilder<"WorktreeCreate">("WorktreeCreate");

// ============================================================================
// WorktreeRemove Output Builder
// ============================================================================

/**
 * Options for the WorktreeRemove output builder.
 * WorktreeRemove hooks only support common options.
 */
export type WorktreeRemoveOptions = CommonOptions;

/**
 * Creates an output for WorktreeRemove hooks.
 * @param options - Configuration options for the hook output
 * @returns A WorktreeRemoveOutput object ready for the runtime
 * @example
 * ```typescript
 * worktreeRemoveOutput({});
 * ```
 */
export const worktreeRemoveOutput = /* @__PURE__ */ createSimpleOutputBuilder<"WorktreeRemove">("WorktreeRemove");

// ============================================================================
// Legacy type aliases for backwards compatibility
// ============================================================================

/**
 * @deprecated Use CommonOptions instead
 */
export type BaseOptions = CommonOptions;
