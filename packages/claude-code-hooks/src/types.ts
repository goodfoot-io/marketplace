/**
 * Type definitions for Claude Code hooks.
 *
 * This module provides:
 * - Hook input types (wire format with snake_case)
 * - Tool input types for type guards
 * - SDK type re-exports for extension and reference
 * @see https://code.claude.com/docs/en/hooks
 * @module
 */

// ============================================================================
// SDK Type Re-exports
// ============================================================================

/**
 * Re-exports types from @anthropic-ai/claude-agent-sdk with "SDK" prefix.
 * These are used as base types for extension, ensuring synchronization with the SDK.
 */
export type {
  BaseHookInput as SDKBaseHookInput,
  ConfigChangeHookInput as SDKConfigChangeHookInput,
  CwdChangedHookInput as SDKCwdChangedHookInput,
  ElicitationHookInput as SDKElicitationHookInput,
  ElicitationResultHookInput as SDKElicitationResultHookInput,
  FileChangedHookInput as SDKFileChangedHookInput,
  HookEvent as SDKHookEvent,
  HookInput as SDKHookInput,
  InstructionsLoadedHookInput as SDKInstructionsLoadedHookInput,
  NotificationHookInput as SDKNotificationHookInput,
  PermissionDeniedHookInput as SDKPermissionDeniedHookInput,
  PermissionMode as SDKPermissionMode,
  PermissionRequestHookInput as SDKPermissionRequestHookInput,
  PermissionUpdate as SDKPermissionUpdate,
  PostCompactHookInput as SDKPostCompactHookInput,
  PostToolBatchHookInput as SDKPostToolBatchHookInput,
  PostToolUseFailureHookInput as SDKPostToolUseFailureHookInput,
  PostToolUseHookInput as SDKPostToolUseHookInput,
  PreCompactHookInput as SDKPreCompactHookInput,
  PreToolUseHookInput as SDKPreToolUseHookInput,
  SessionEndHookInput as SDKSessionEndHookInput,
  SessionStartHookInput as SDKSessionStartHookInput,
  SetupHookInput as SDKSetupHookInput,
  StopFailureHookInput as SDKStopFailureHookInput,
  StopHookInput as SDKStopHookInput,
  SubagentStartHookInput as SDKSubagentStartHookInput,
  SubagentStopHookInput as SDKSubagentStopHookInput,
  TaskCompletedHookInput as SDKTaskCompletedHookInput,
  TaskCreatedHookInput as SDKTaskCreatedHookInput,
  TeammateIdleHookInput as SDKTeammateIdleHookInput,
  UserPromptExpansionHookInput as SDKUserPromptExpansionHookInput,
  UserPromptSubmitHookInput as SDKUserPromptSubmitHookInput,
  WorktreeCreateHookInput as SDKWorktreeCreateHookInput,
  WorktreeRemoveHookInput as SDKWorktreeRemoveHookInput,
} from "@anthropic-ai/claude-agent-sdk";

import type {
  BaseHookInput as SDKBaseHookInput,
  ConfigChangeHookInput as SDKConfigChangeHookInput,
  CwdChangedHookInput as SDKCwdChangedHookInput,
  ElicitationHookInput as SDKElicitationHookInput,
  ElicitationResultHookInput as SDKElicitationResultHookInput,
  FileChangedHookInput as SDKFileChangedHookInput,
  InstructionsLoadedHookInput as SDKInstructionsLoadedHookInput,
  NotificationHookInput as SDKNotificationHookInput,
  PermissionDeniedHookInput as SDKPermissionDeniedHookInput,
  PermissionMode as SDKPermissionMode,
  PermissionRequestHookInput as SDKPermissionRequestHookInput,
  PermissionUpdate as SDKPermissionUpdate,
  PostCompactHookInput as SDKPostCompactHookInput,
  PostToolBatchHookInput as SDKPostToolBatchHookInput,
  PostToolUseFailureHookInput as SDKPostToolUseFailureHookInput,
  PostToolUseHookInput as SDKPostToolUseHookInput,
  PreCompactHookInput as SDKPreCompactHookInput,
  PreToolUseHookInput as SDKPreToolUseHookInput,
  SessionEndHookInput as SDKSessionEndHookInput,
  SessionStartHookInput as SDKSessionStartHookInput,
  SetupHookInput as SDKSetupHookInput,
  StopFailureHookInput as SDKStopFailureHookInput,
  StopHookInput as SDKStopHookInput,
  SubagentStartHookInput as SDKSubagentStartHookInput,
  SubagentStopHookInput as SDKSubagentStopHookInput,
  TaskCompletedHookInput as SDKTaskCompletedHookInput,
  TaskCreatedHookInput as SDKTaskCreatedHookInput,
  TeammateIdleHookInput as SDKTeammateIdleHookInput,
  UserPromptExpansionHookInput as SDKUserPromptExpansionHookInput,
  UserPromptSubmitHookInput as SDKUserPromptSubmitHookInput,
  WorktreeCreateHookInput as SDKWorktreeCreateHookInput,
  WorktreeRemoveHookInput as SDKWorktreeRemoveHookInput,
} from "@anthropic-ai/claude-agent-sdk";

// Import tool input types from SDK's sdk-tools declaration file.
// Note: This is a types-only file with no JS runtime, so we use `import type`.
import type {
  AgentInput,
  AskUserQuestionInput,
  BashInput,
  CronCreateInput,
  CronDeleteInput,
  CronListInput,
  EnterPlanModeInput,
  EnterWorktreeInput,
  ExitPlanModeInput,
  ExitWorktreeInput,
  FileEditInput,
  FileReadInput,
  FileWriteInput,
  GlobInput,
  GrepInput,
  TaskStopInput as KillShellInput,
  ListMcpResourcesInput,
  McpInput,
  MonitorInput,
  NotebookEditInput,
  PushNotificationInput,
  REPLInput,
  ReadMcpResourceInput,
  RemoteTriggerInput,
  ScheduleWakeupInput,
  TaskCreateInput,
  TaskGetInput,
  TaskListInput,
  TaskOutputInput,
  TaskUpdateInput,
  TodoWriteInput,
  WebFetchInput,
  WebSearchInput,
  WorkflowInput,
} from "@anthropic-ai/claude-agent-sdk/sdk-tools.js";

// ============================================================================
// Hook Input Types
// ============================================================================

/**
 * Permission mode for controlling how tool executions are handled.
 * @see https://code.claude.com/docs/en/hooks#permission-modes
 */
export type PermissionMode = SDKPermissionMode;

/**
 * Source that triggered a session start event.
 *
 * - `'startup'` - New session started from scratch
 * - `'resume'` - Resuming a previous session
 * - `'clear'` - Session cleared and restarted
 * - `'compact'` - Session restarted after context compaction
 * @deprecated Matches SDK inline literal. Kept for backward compatibility.
 */
export type SessionStartSource = "startup" | "resume" | "clear" | "compact";

/**
 * Trigger type for pre-compact events.
 *
 * - `'manual'` - User explicitly requested compaction
 * - `'auto'` - Automatic compaction due to context length
 * @deprecated Matches SDK inline literal. Kept for backward compatibility.
 */
export type PreCompactTrigger = "manual" | "auto";

/**
 * Reason for session end events.
 *
 * - `'clear'` - Session cleared by user
 * - `'resume'` - Session resumed from a previous session
 * - `'logout'` - User logged out
 * - `'prompt_input_exit'` - User exited at prompt input
 * - `'other'` - Other reasons
 * - `'bypass_permissions_disabled'` - Session ended because bypass permissions was disabled
 *
 * Note: SDK's ExitReason resolves to string. This type provides concrete literals for better DX.
 */
export type SessionEndReason =
  | "clear"
  | "resume"
  | "logout"
  | "prompt_input_exit"
  | "other"
  | "bypass_permissions_disabled";

/**
 * Common fields present in all hook inputs.
 *
 * Every hook receives these base fields providing session context.
 * Hook-specific inputs extend this base with additional fields.
 * @example
 * ```typescript
 * // All hook inputs include these fields
 * const handleAnyHook = (input: BaseHookInput) => {
 *   console.log(`Session: ${input.session_id}`);
 *   console.log(`Working directory: ${input.cwd}`);
 *   console.log(`Transcript: ${input.transcript_path}`);
 * };
 * ```
 * @see https://code.claude.com/docs/en/hooks#hook-input-structure
 */
export interface BaseHookInput extends SDKBaseHookInput {
  /**
   * Current permission mode for tool execution.
   * Overrides SDK's string type with stricter literal union.
   * May be undefined if using default mode.
   */
  permission_mode?: PermissionMode;
}

// ============================================================================
// Hook Input Types with Expanded Hover Tooltips
// ============================================================================
// These types use inlined mapped types to force TypeScript to expand
// properties in hover tooltips, improving developer experience.

/**
 * Input for PreToolUse hooks.
 * @see https://code.claude.com/docs/en/hooks#pretooluse
 */
export type PreToolUseInput = { [K in keyof SDKPreToolUseHookInput]: SDKPreToolUseHookInput[K] } & {};

/**
 * Input for PostToolUse hooks.
 * @see https://code.claude.com/docs/en/hooks#posttooluse
 */
export type PostToolUseInput = { [K in keyof SDKPostToolUseHookInput]: SDKPostToolUseHookInput[K] } & {};

/**
 * Input for PostToolUseFailure hooks.
 * @see https://code.claude.com/docs/en/hooks#posttoolusefailure
 */
export type PostToolUseFailureInput = {
  [K in keyof SDKPostToolUseFailureHookInput]: SDKPostToolUseFailureHookInput[K];
} & {};

/**
 * Input for PostToolBatch hooks.
 *
 * Fired once after every tool call in a batch has resolved, before the next model
 * request. PostToolUse fires per-tool and may run concurrently for parallel tool
 * calls; PostToolBatch fires exactly once with the full batch in `tool_calls`.
 * @see https://code.claude.com/docs/en/hooks#posttoolbatch
 */
export type PostToolBatchInput = { [K in keyof SDKPostToolBatchHookInput]: SDKPostToolBatchHookInput[K] } & {};

/**
 * Input for Notification hooks.
 * @see https://code.claude.com/docs/en/hooks#notification
 */
export type NotificationInput = { [K in keyof SDKNotificationHookInput]: SDKNotificationHookInput[K] } & {};

/**
 * Input for UserPromptExpansion hooks.
 *
 * Fires when a user prompt is expanded from a slash command or MCP prompt,
 * allowing you to:
 * - Add context based on the command being invoked
 * - Log slash command and MCP prompt usage
 * - Observe prompt expansion events
 * @see https://code.claude.com/docs/en/hooks#userpromptexpansion
 */
export type UserPromptExpansionInput = {
  [K in keyof SDKUserPromptExpansionHookInput]: SDKUserPromptExpansionHookInput[K];
} & {};

/**
 * Input for UserPromptSubmit hooks.
 * @see https://code.claude.com/docs/en/hooks#userpromptsubmit
 */
export type UserPromptSubmitInput = {
  [K in keyof SDKUserPromptSubmitHookInput]: SDKUserPromptSubmitHookInput[K];
} & {};

/**
 * Input for SessionStart hooks.
 * @see https://code.claude.com/docs/en/hooks#sessionstart
 */
export type SessionStartInput = { [K in keyof SDKSessionStartHookInput]: SDKSessionStartHookInput[K] } & {};

/**
 * Input for Stop hooks.
 * @see https://code.claude.com/docs/en/hooks#stop
 */
export type StopInput = { [K in keyof SDKStopHookInput]: SDKStopHookInput[K] } & {};

/**
 * Input for StopFailure hooks.
 *
 * Fires when Claude Code encounters an error while stopping (e.g., API errors,
 * rate limits, authentication failures), allowing you to:
 * - Log stop failure events and error details
 * - Alert on unexpected session termination errors
 * @see https://code.claude.com/docs/en/hooks#stopfailure
 */
export type StopFailureInput = { [K in keyof SDKStopFailureHookInput]: SDKStopFailureHookInput[K] } & {};

/**
 * Input for SubagentStart hooks.
 * @see https://code.claude.com/docs/en/hooks#subagentstart
 */
export type SubagentStartInput = { [K in keyof SDKSubagentStartHookInput]: SDKSubagentStartHookInput[K] } & {};

/**
 * Input for SubagentStop hooks.
 * @see https://code.claude.com/docs/en/hooks#subagentstop
 */
export type SubagentStopInput = { [K in keyof SDKSubagentStopHookInput]: SDKSubagentStopHookInput[K] } & {};

/**
 * Input for PreCompact hooks.
 * @see https://code.claude.com/docs/en/hooks#precompact
 */
export type PreCompactInput = { [K in keyof SDKPreCompactHookInput]: SDKPreCompactHookInput[K] } & {};

/**
 * Input for PostCompact hooks.
 *
 * Fires after context compaction completes, allowing you to:
 * - Observe the compaction summary
 * - Log compaction events with context details
 * - React to the new compacted state
 * @see https://code.claude.com/docs/en/hooks#postcompact
 */
export type PostCompactInput = { [K in keyof SDKPostCompactHookInput]: SDKPostCompactHookInput[K] } & {};

/**
 * Input for Setup hooks.
 * @see https://code.claude.com/docs/en/hooks#setup
 */
export type SetupInput = { [K in keyof SDKSetupHookInput]: SDKSetupHookInput[K] } & {};

/**
 * Input for TeammateIdle hooks.
 * @see https://code.claude.com/docs/en/hooks#teammateidle
 */
export type TeammateIdleInput = { [K in keyof SDKTeammateIdleHookInput]: SDKTeammateIdleHookInput[K] } & {};

/**
 * Input for TaskCreated hooks.
 *
 * Fires when a new task is created and assigned to a teammate, allowing you to:
 * - Observe task creation events
 * - Log task assignments for auditing
 * - React to new work being assigned
 * @see https://code.claude.com/docs/en/hooks#taskcreated
 */
export type TaskCreatedInput = { [K in keyof SDKTaskCreatedHookInput]: SDKTaskCreatedHookInput[K] } & {};

/**
 * Input for TaskCompleted hooks.
 * @see https://code.claude.com/docs/en/hooks#taskcompleted
 */
export type TaskCompletedInput = { [K in keyof SDKTaskCompletedHookInput]: SDKTaskCompletedHookInput[K] } & {};

/**
 * Input for Elicitation hooks.
 *
 * Fires when an MCP server requests user input (elicitation), allowing you to:
 * - Intercept and handle MCP server prompts programmatically
 * - Accept, decline, or cancel elicitation requests
 * - Provide structured form input or URL-based auth responses
 * @see https://code.claude.com/docs/en/hooks#elicitation
 */
export type ElicitationInput = { [K in keyof SDKElicitationHookInput]: SDKElicitationHookInput[K] } & {};

/**
 * Input for ElicitationResult hooks.
 *
 * Fires with the result of an elicitation request, allowing you to:
 * - Observe and log elicitation outcomes
 * - Modify the result before it is returned to the MCP server
 * @see https://code.claude.com/docs/en/hooks#elicitationresult
 */
export type ElicitationResultInput = {
  [K in keyof SDKElicitationResultHookInput]: SDKElicitationResultHookInput[K];
} & {};

/**
 * Input for ConfigChange hooks.
 *
 * Fires when Claude Code configuration changes (settings files, skills), allowing you to:
 * - React to configuration changes
 * - Log or audit configuration changes
 * - Apply custom logic when settings are updated
 * @see https://code.claude.com/docs/en/hooks#configchange
 */
export type ConfigChangeInput = { [K in keyof SDKConfigChangeHookInput]: SDKConfigChangeHookInput[K] } & {};

/**
 * Input for InstructionsLoaded hooks.
 *
 * Fires when a CLAUDE.md (or similar instructions file) is loaded, allowing you to:
 * - React to instructions being loaded
 * - Log which instruction files are active for the session
 * @see https://code.claude.com/docs/en/hooks#instructionsloaded
 */
export type InstructionsLoadedInput = {
  [K in keyof SDKInstructionsLoadedHookInput]: SDKInstructionsLoadedHookInput[K];
} & {};

/**
 * Input for WorktreeCreate hooks.
 *
 * Fires when a git worktree is created, allowing you to:
 * - React to new worktree creation
 * - Set up worktree-specific configuration
 * @see https://code.claude.com/docs/en/hooks#worktreecreate
 */
export type WorktreeCreateInput = { [K in keyof SDKWorktreeCreateHookInput]: SDKWorktreeCreateHookInput[K] } & {};

/**
 * Input for WorktreeRemove hooks.
 *
 * Fires when a git worktree is removed, allowing you to:
 * - React to worktree removal
 * - Clean up worktree-specific resources
 * @see https://code.claude.com/docs/en/hooks#worktreeremove
 */
export type WorktreeRemoveInput = { [K in keyof SDKWorktreeRemoveHookInput]: SDKWorktreeRemoveHookInput[K] } & {};

/**
 * Input for CwdChanged hooks.
 *
 * Fires when Claude Code's current working directory changes, allowing you to:
 * - React to directory changes within a session
 * - Update file watchers or environment state
 * - Return `watchPaths` to register paths for FileChanged events
 * @see https://code.claude.com/docs/en/hooks#cwdchanged
 */
export type CwdChangedInput = { [K in keyof SDKCwdChangedHookInput]: SDKCwdChangedHookInput[K] } & {};

/**
 * Input for FileChanged hooks.
 *
 * Fires when a watched file changes on disk, allowing you to:
 * - React to file system changes during a session
 * - Invalidate caches or reload configuration
 * - Return `watchPaths` to update the set of watched paths
 *
 * The `event` field indicates the type of change:
 * - `'change'` - File contents changed
 * - `'add'` - File was created
 * - `'unlink'` - File was deleted
 * @see https://code.claude.com/docs/en/hooks#filechanged
 */
export type FileChangedInput = { [K in keyof SDKFileChangedHookInput]: SDKFileChangedHookInput[K] } & {};

/**
 * Input for SessionEnd hooks.
 *
 * Fires when a Claude Code session ends, allowing you to:
 * - Clean up session resources
 * - Log session metrics
 * - Persist session state
 *
 * This hook uses `reason` for matcher matching.
 * @example
 * ```typescript
 * // Log session end
 * sessionEndHook({}, async (input: SessionEndInput) => {
 *   console.log(`Session ended: ${input.reason}`);
 *   return sessionEndOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#sessionend
 */
type _SessionEndInputBase = Omit<SDKSessionEndHookInput, "reason"> & {
  /**
   * The reason the session ended.
   *
   * - `'clear'` - Session cleared by user
   * - `'logout'` - User logged out
   * - `'prompt_input_exit'` - User exited at prompt input
   * - `'other'` - Other reasons
   */
  reason: SessionEndReason;
};
// Inlined mapped type forces TypeScript to expand properties in hover tooltips
export type SessionEndInput = { [K in keyof _SessionEndInputBase]: _SessionEndInputBase[K] } & {};

/**
 * Input for PermissionRequest hooks.
 *
 * Fires when a permission prompt would be shown, allowing you to:
 * - Auto-approve or deny tool executions
 * - Implement custom permission logic
 * - Modify tool inputs before approval
 *
 * This hook uses `tool_name` for matcher matching.
 * @example
 * ```typescript
 * // Auto-approve read operations in allowed directories
 * permissionRequestHook({ matcher: 'Read' }, async (input: PermissionRequestInput) => {
 *   const filePath = input.tool_input.file_path as string;
 *   if (filePath.startsWith('/allowed/')) {
 *     return permissionRequestOutput({
 *       allow: true
 *     });
 *   }
 *   return permissionRequestOutput({});  // Fall through to normal permission prompt
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#permissionrequest
 */
type _PermissionRequestInputBase = SDKPermissionRequestHookInput & {
  /**
   * Unique identifier for this specific tool invocation.
   */
  tool_use_id: string;
};
// Inlined mapped type forces TypeScript to expand properties in hover tooltips
export type PermissionRequestInput = {
  [K in keyof _PermissionRequestInputBase]: _PermissionRequestInputBase[K];
} & {};

/**
 * Input for PermissionDenied hooks.
 *
 * Fires when a permission request is denied (either by the user or by a hook),
 * allowing you to:
 * - Log permission denials for auditing
 * - React to denied tool executions
 * - Optionally request a retry
 *
 * This hook uses `tool_name` for matcher matching.
 * @see https://code.claude.com/docs/en/hooks#permissiondenied
 */
export type PermissionDeniedInput = {
  [K in keyof SDKPermissionDeniedHookInput]: SDKPermissionDeniedHookInput[K];
} & {};

/**
 * Trigger type for Setup hooks.
 */
export type SetupTrigger = "init" | "maintenance";

/**
 * Discriminated union of all hook input types.
 *
 * Use this type when handling multiple hook types in a single handler
 * or when the hook type is not known statically.
 * @example
 * ```typescript
 * // Handle any hook type with type narrowing
 * function handleHook(input: HookInput) {
 *   switch (input.hook_event_name) {
 *     case 'PreToolUse':
 *       // TypeScript knows input is PreToolUseInput here
 *       console.log(`Tool: ${input.tool_name}`);
 *       break;
 *     case 'SessionStart':
 *       // TypeScript knows input is SessionStartInput here
 *       console.log(`Source: ${input.source}`);
 *       break;
 *     // ... handle other hook types
 *   }
 * }
 * ```
 * @see https://code.claude.com/docs/en/hooks
 */
export type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | PostToolUseFailureInput
  | PostToolBatchInput
  | NotificationInput
  | UserPromptExpansionInput
  | UserPromptSubmitInput
  | SessionStartInput
  | SessionEndInput
  | StopInput
  | StopFailureInput
  | SubagentStartInput
  | SubagentStopInput
  | PreCompactInput
  | PostCompactInput
  | PermissionRequestInput
  | PermissionDeniedInput
  | SetupInput
  | TeammateIdleInput
  | TaskCreatedInput
  | TaskCompletedInput
  | ElicitationInput
  | ElicitationResultInput
  | ConfigChangeInput
  | InstructionsLoadedInput
  | WorktreeCreateInput
  | WorktreeRemoveInput
  | CwdChangedInput
  | FileChangedInput;

/**
 * Hook event name literal union.
 *
 * All valid hook event names that can appear in the `hook_event_name` field.
 */
export type HookEventName = HookInput["hook_event_name"];

/**
 * All hook event names as a readonly array.
 *
 * Useful for iteration and validation.
 * @example
 * ```typescript
 * for (const eventName of HOOK_EVENT_NAMES) {
 *   console.log(`Supported hook: ${eventName}`);
 * }
 * ```
 */
export const HOOK_EVENT_NAMES = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "Notification",
  "UserPromptExpansion",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
  "PermissionRequest",
  "PermissionDenied",
  "Setup",
  "TeammateIdle",
  "TaskCreated",
  "TaskCompleted",
  "Elicitation",
  "ElicitationResult",
  "ConfigChange",
  "InstructionsLoaded",
  "WorktreeCreate",
  "WorktreeRemove",
  "CwdChanged",
  "FileChanged",
] as const satisfies readonly HookEventName[];

// Re-export PermissionUpdate from SDK for convenience
export type { SDKPermissionUpdate as PermissionUpdate };

// ============================================================================
// Tool Input Types
// ============================================================================

/**
 * Re-export all tool input types from the official Claude Agent SDK.
 * Uses `export type *` because sdk-tools.d.ts has no JavaScript runtime counterpart.
 * @see {@link https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk | @anthropic-ai/claude-agent-sdk}
 */
export type * from "@anthropic-ai/claude-agent-sdk/sdk-tools.js";

/**
 * Backward compatibility alias for TaskStopInput (renamed in SDK 0.2.x).
 * @deprecated Use TaskStopInput instead
 */
export type { KillShellInput };

/**
 * Input structure for the Config tool.
 *
 * The Config tool reads or updates Claude Code configuration settings. This type was
 * removed from `@anthropic-ai/claude-agent-sdk` in 0.3.x, so it is defined locally to
 * preserve type-safe support for the {@link isConfigTool} guard.
 */
export interface ConfigInput {
  /** The setting key (e.g., "theme", "model", "permissions.defaultMode"). */
  setting: string;
  /** The new value. Omit to read the current value. */
  value?: string | boolean | number;
}

/**
 * A single edit entry within a MultiEdit operation.
 */
export interface MultiEditEntry {
  /** The text to search for. */
  old_string: string;
  /** The text to replace old_string with. */
  new_string: string;
}

/**
 * Input structure for the MultiEdit tool.
 *
 * The MultiEdit tool performs multiple search-and-replace operations on a single file.
 * All edits are applied atomically.
 * @example
 * ```typescript
 * // Example tool input
 * {
 *   file_path: '/workspace/src/index.ts',
 *   edits: [
 *     { old_string: 'const x = 1;', new_string: 'const x = 2;' },
 *     { old_string: 'const y = 1;', new_string: 'const y = 2;' }
 *   ]
 * }
 * ```
 */
export interface MultiEditToolInput {
  /** Absolute path to the file to edit. */
  file_path: string;
  /** Array of edit operations to apply. */
  edits: MultiEditEntry[];
}

/**
 * Union of all file-modifying tool inputs.
 *
 * Use this type when you need to handle Write, Edit, or MultiEdit generically.
 */
export type FileModifyingToolInput = FileWriteInput | FileEditInput | MultiEditToolInput;

/**
 * Tool names for file-modifying tools.
 *
 * Use this type when you need to reference the tool name in type guards.
 */
export type FileModifyingToolName = "Write" | "Edit" | "MultiEdit";

/**
 * Union of all known tool inputs.
 *
 * This includes all tool inputs that have well-defined type structures.
 */
export type KnownToolInput =
  | FileWriteInput
  | FileEditInput
  | MultiEditToolInput
  | FileReadInput
  | BashInput
  | GlobInput
  | GrepInput
  | AgentInput
  | TaskOutputInput
  | ExitPlanModeInput
  | KillShellInput
  | NotebookEditInput
  | TodoWriteInput
  | WebFetchInput
  | WebSearchInput
  | AskUserQuestionInput
  | ListMcpResourcesInput
  | McpInput
  | ReadMcpResourceInput
  | ConfigInput
  | TaskCreateInput
  | TaskGetInput
  | TaskListInput
  | TaskUpdateInput
  | CronCreateInput
  | CronDeleteInput
  | CronListInput
  | ScheduleWakeupInput
  | MonitorInput
  | RemoteTriggerInput
  | PushNotificationInput
  | EnterPlanModeInput
  | EnterWorktreeInput
  | ExitWorktreeInput
  | REPLInput
  | WorkflowInput;

/**
 * Tool names for all known tools with typed inputs.
 */
export type KnownToolName =
  | "Write"
  | "Edit"
  | "MultiEdit"
  | "Read"
  | "Bash"
  | "Glob"
  | "Grep"
  | "Agent"
  | "TaskOutput"
  | "ExitPlanMode"
  | "KillShell"
  | "NotebookEdit"
  | "TodoWrite"
  | "WebFetch"
  | "WebSearch"
  | "AskUserQuestion"
  | "ListMcpResources"
  | "Mcp"
  | "ReadMcpResource"
  | "Config"
  | "TaskCreate"
  | "TaskGet"
  | "TaskList"
  | "TaskUpdate"
  | "CronCreate"
  | "CronDelete"
  | "CronList"
  | "ScheduleWakeup"
  | "Monitor"
  | "RemoteTrigger"
  | "PushNotification"
  | "EnterPlanMode"
  | "EnterWorktree"
  | "ExitWorktree"
  | "REPL"
  | "Workflow";

/**
 * Type mapping from tool name to tool input type.
 *
 * Used by typed factory overloads to provide automatic typing.
 * @example
 * ```typescript
 * type WriteInput = ToolInputMap['Write']; // FileWriteInput
 * ```
 */
export interface ToolInputMap {
  Write: FileWriteInput;
  Edit: FileEditInput;
  MultiEdit: MultiEditToolInput;
  Read: FileReadInput;
  Bash: BashInput;
  Glob: GlobInput;
  Grep: GrepInput;
  Agent: AgentInput;
  TaskOutput: TaskOutputInput;
  ExitPlanMode: ExitPlanModeInput;
  KillShell: KillShellInput;
  NotebookEdit: NotebookEditInput;
  TodoWrite: TodoWriteInput;
  WebFetch: WebFetchInput;
  WebSearch: WebSearchInput;
  AskUserQuestion: AskUserQuestionInput;
  ListMcpResources: ListMcpResourcesInput;
  Mcp: McpInput;
  ReadMcpResource: ReadMcpResourceInput;
  Config: ConfigInput;
  TaskCreate: TaskCreateInput;
  TaskGet: TaskGetInput;
  TaskList: TaskListInput;
  TaskUpdate: TaskUpdateInput;
  CronCreate: CronCreateInput;
  CronDelete: CronDeleteInput;
  CronList: CronListInput;
  ScheduleWakeup: ScheduleWakeupInput;
  Monitor: MonitorInput;
  RemoteTrigger: RemoteTriggerInput;
  PushNotification: PushNotificationInput;
  EnterPlanMode: EnterPlanModeInput;
  EnterWorktree: EnterWorktreeInput;
  ExitWorktree: ExitWorktreeInput;
  REPL: REPLInput;
  Workflow: WorkflowInput;
}
