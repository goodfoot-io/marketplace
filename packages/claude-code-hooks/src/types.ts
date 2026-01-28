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
  HookEvent as SDKHookEvent,
  HookInput as SDKHookInput,
  NotificationHookInput as SDKNotificationHookInput,
  PermissionMode as SDKPermissionMode,
  PermissionRequestHookInput as SDKPermissionRequestHookInput,
  PermissionUpdate as SDKPermissionUpdate,
  PostToolUseFailureHookInput as SDKPostToolUseFailureHookInput,
  PostToolUseHookInput as SDKPostToolUseHookInput,
  PreCompactHookInput as SDKPreCompactHookInput,
  PreToolUseHookInput as SDKPreToolUseHookInput,
  SessionEndHookInput as SDKSessionEndHookInput,
  SessionStartHookInput as SDKSessionStartHookInput,
  StopHookInput as SDKStopHookInput,
  SubagentStartHookInput as SDKSubagentStartHookInput,
  SubagentStopHookInput as SDKSubagentStopHookInput,
  UserPromptSubmitHookInput as SDKUserPromptSubmitHookInput,
} from "@anthropic-ai/claude-agent-sdk";

import type {
  BaseHookInput as SDKBaseHookInput,
  NotificationHookInput as SDKNotificationHookInput,
  PermissionMode as SDKPermissionMode,
  PermissionRequestHookInput as SDKPermissionRequestHookInput,
  PermissionUpdate as SDKPermissionUpdate,
  PostToolUseFailureHookInput as SDKPostToolUseFailureHookInput,
  PostToolUseHookInput as SDKPostToolUseHookInput,
  PreCompactHookInput as SDKPreCompactHookInput,
  PreToolUseHookInput as SDKPreToolUseHookInput,
  SessionEndHookInput as SDKSessionEndHookInput,
  SessionStartHookInput as SDKSessionStartHookInput,
  StopHookInput as SDKStopHookInput,
  SubagentStartHookInput as SDKSubagentStartHookInput,
  SubagentStopHookInput as SDKSubagentStopHookInput,
  UserPromptSubmitHookInput as SDKUserPromptSubmitHookInput,
} from "@anthropic-ai/claude-agent-sdk";

// Import tool input types from SDK's sdk-tools declaration file.
// Note: This is a types-only file with no JS runtime, so we use `import type`.
import type {
  AgentInput,
  AskUserQuestionInput,
  BashInput,
  ExitPlanModeInput,
  FileEditInput,
  FileReadInput,
  FileWriteInput,
  GlobInput,
  GrepInput,
  TaskStopInput as KillShellInput,
  NotebookEditInput,
  TaskOutputInput,
  TodoWriteInput,
  WebFetchInput,
  WebSearchInput,
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
 * - `'logout'` - User logged out
 * - `'prompt_input_exit'` - User exited at prompt input
 * - `'other'` - Other reasons
 *
 * Note: SDK's ExitReason resolves to string. This type provides concrete literals for better DX.
 */
export type SessionEndReason = "clear" | "logout" | "prompt_input_exit" | "other";

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

/**
 * Input for PreToolUse hooks.
 *
 * Fires before any tool is executed, allowing you to:
 * - Inspect and validate tool inputs
 * - Allow, deny, or modify the tool execution
 * - Add custom permission logic
 *
 * This hook uses `tool_name` for matcher matching.
 * @example
 * ```typescript
 * // Block dangerous Bash commands
 * preToolUseHook({ matcher: 'Bash' }, async (input: PreToolUseInput) => {
 *   const command = input.tool_input.command as string;
 *   if (command.includes('rm -rf')) {
 *     return preToolUseOutput({
 *       deny: 'Destructive commands are not allowed'
 *     });
 *   }
 *   return preToolUseOutput({ allow: true });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#pretooluse
 */
export type PreToolUseInput = SDKPreToolUseHookInput;

/**
 * Input for PostToolUse hooks.
 *
 * Fires after a tool executes successfully, allowing you to:
 * - Inspect tool results
 * - Add additional context to the conversation
 * - Modify MCP tool output
 *
 * This hook uses `tool_name` for matcher matching.
 * @example
 * ```typescript
 * // Add context after file reads
 * postToolUseHook({ matcher: 'Read' }, async (input: PostToolUseInput) => {
 *   const filePath = input.tool_input.file_path as string;
 *   return postToolUseOutput({
 *     additionalContext: `File ${filePath} was read successfully`
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#posttooluse
 */
export type PostToolUseInput = SDKPostToolUseHookInput;

/**
 * Input for PostToolUseFailure hooks.
 *
 * Fires after a tool execution fails, allowing you to:
 * - Log or report tool failures
 * - Add context about the failure
 * - Take corrective action
 *
 * This hook uses `tool_name` for matcher matching.
 * @example
 * ```typescript
 * // Log tool failures
 * postToolUseFailureHook({ matcher: '.*' }, async (input: PostToolUseFailureInput) => {
 *   console.error(`Tool ${input.tool_name} failed: ${input.error}`);
 *   return postToolUseFailureOutput({
 *     additionalContext: 'Please try an alternative approach'
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#posttoolusefailure
 */
export type PostToolUseFailureInput = SDKPostToolUseFailureHookInput;

/**
 * Input for Notification hooks.
 *
 * Fires when Claude Code sends a notification, allowing you to:
 * - Forward notifications to external systems
 * - Log important events
 * - Trigger custom alerting
 *
 * This hook uses `notification_type` for matcher matching.
 * @example
 * ```typescript
 * // Forward notifications to Slack
 * notificationHook({}, async (input: NotificationInput) => {
 *   await sendSlackMessage(input.title, input.message);
 *   return notificationOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#notification
 */
export type NotificationInput = SDKNotificationHookInput;

/**
 * Input for UserPromptSubmit hooks.
 *
 * Fires when a user submits a prompt, allowing you to:
 * - Add additional context or instructions
 * - Log user interactions
 * - Validate or transform prompts
 *
 * This hook does not support matchers; it fires on all prompt submissions.
 * @example
 * ```typescript
 * // Add project context to every prompt
 * userPromptSubmitHook({}, async (input: UserPromptSubmitInput) => {
 *   return userPromptSubmitOutput({
 *     additionalContext: await getProjectContext()
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#userpromptsubmit
 */
export type UserPromptSubmitInput = SDKUserPromptSubmitHookInput;

/**
 * Input for SessionStart hooks.
 *
 * Fires when a Claude Code session starts or restarts, allowing you to:
 * - Initialize session state
 * - Inject context or instructions
 * - Set up logging or monitoring
 *
 * This hook uses `source` for matcher matching.
 * @example
 * ```typescript
 * // Initialize context for new sessions
 * sessionStartHook({ matcher: 'startup' }, async (input: SessionStartInput) => {
 *   return sessionStartOutput({
 *     additionalContext: JSON.stringify({
 *       project: 'my-project',
 *       initialized: true
 *     })
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#sessionstart
 */
export type SessionStartInput = SDKSessionStartHookInput;

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
export interface SessionEndInput extends Omit<SDKSessionEndHookInput, "reason"> {
  /**
   * The reason the session ended.
   *
   * - `'clear'` - Session cleared by user
   * - `'logout'` - User logged out
   * - `'prompt_input_exit'` - User exited at prompt input
   * - `'other'` - Other reasons
   */
  reason: SessionEndReason;
}

/**
 * Input for Stop hooks.
 *
 * Fires when Claude Code is about to stop, allowing you to:
 * - Block the stop and require additional action
 * - Confirm the user wants to stop
 * - Clean up resources before stopping
 *
 * This hook does not support matchers; it fires on all stop events.
 * @example
 * ```typescript
 * // Require confirmation before stopping with pending changes
 * stopHook({}, async (input: StopInput) => {
 *   const pendingChanges = await checkPendingChanges();
 *   if (pendingChanges.length > 0) {
 *     return stopOutput({
 *       decision: 'block',
 *       reason: 'There are uncommitted changes'
 *     });
 *   }
 *   return stopOutput({ decision: 'approve' });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#stop
 */
export type StopInput = SDKStopHookInput;

/**
 * Input for SubagentStart hooks.
 *
 * Fires when a subagent (Task tool) starts, allowing you to:
 * - Inject context for the subagent
 * - Log subagent invocations
 * - Configure subagent behavior
 *
 * This hook uses `agent_type` for matcher matching.
 * @example
 * ```typescript
 * // Add context for explore subagents
 * subagentStartHook({ matcher: 'explore' }, async (input: SubagentStartInput) => {
 *   return subagentStartOutput({
 *     additionalContext: 'Focus on finding patterns and conventions'
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#subagentstart
 */
export type SubagentStartInput = SDKSubagentStartHookInput;

/**
 * Input for SubagentStop hooks.
 *
 * Fires when a subagent completes or stops, allowing you to:
 * - Process subagent results
 * - Clean up subagent resources
 * - Log subagent completion
 * - Block subagent from stopping
 *
 * This hook uses `agent_type` for matcher matching.
 * @example
 * ```typescript
 * // Block explore subagent if task incomplete
 * subagentStopHook({ matcher: 'explore' }, async (input: SubagentStopInput) => {
 *   console.log(`Subagent ${input.agent_id} (${input.agent_type}) stopping`);
 *   return subagentStopOutput({
 *     decision: 'block',
 *     reason: 'Please verify all files were explored'
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#subagentstop
 */
export interface SubagentStopInput extends SDKSubagentStopHookInput {
  /**
   * Type of subagent that is stopping.
   * Examples: 'explore', 'codebase-analysis', custom agent types
   */
  agent_type: string;
}

/**
 * Input for PreCompact hooks.
 *
 * Fires before context compaction occurs, allowing you to:
 * - Preserve important information before compaction
 * - Log compaction events
 * - Modify custom instructions for the compacted context
 *
 * This hook uses `trigger` for matcher matching.
 * @example
 * ```typescript
 * // Log compaction events
 * preCompactHook({}, async (input: PreCompactInput) => {
 *   console.log(`Compacting (${input.trigger})`);
 *   return preCompactOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#precompact
 */
export type PreCompactInput = SDKPreCompactHookInput;

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
export interface PermissionRequestInput extends SDKPermissionRequestHookInput {
  /**
   * Unique identifier for this specific tool invocation.
   */
  tool_use_id: string;
}

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
  | NotificationInput
  | UserPromptSubmitInput
  | SessionStartInput
  | SessionEndInput
  | StopInput
  | SubagentStartInput
  | SubagentStopInput
  | PreCompactInput
  | PermissionRequestInput;

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
  "Notification",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PermissionRequest",
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
  | AskUserQuestionInput;

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
  | "Task"
  | "TaskOutput"
  | "ExitPlanMode"
  | "KillShell"
  | "NotebookEdit"
  | "TodoWrite"
  | "WebFetch"
  | "WebSearch"
  | "AskUserQuestion";

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
  Task: AgentInput;
  TaskOutput: TaskOutputInput;
  ExitPlanMode: ExitPlanModeInput;
  KillShell: KillShellInput;
  NotebookEdit: NotebookEditInput;
  TodoWrite: TodoWriteInput;
  WebFetch: WebFetchInput;
  WebSearch: WebSearchInput;
  AskUserQuestion: AskUserQuestionInput;
}
