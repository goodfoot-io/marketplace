/**
 * CamelCase input types for Claude Code hooks.
 *
 * These types transform the SDK's snake_case input fields to idiomatic TypeScript camelCase
 * while preserving full type safety. Each hook input type includes comprehensive JSDoc
 * documentation explaining when the hook fires and how to use it.
 * @see https://code.claude.com/docs/en/hooks
 * @module
 */
import type { PermissionUpdate } from '@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.js';
/**
 * Permission mode for controlling how tool executions are handled.
 * @see https://code.claude.com/docs/en/hooks#permission-modes
 */
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'delegate' | 'dontAsk';
/**
 * Source that triggered a session start event.
 *
 * - `'startup'` - New session started from scratch
 * - `'resume'` - Resuming a previous session
 * - `'clear'` - Session cleared and restarted
 * - `'compact'` - Session restarted after context compaction
 */
export type SessionStartSource = 'startup' | 'resume' | 'clear' | 'compact';
/**
 * Trigger type for pre-compact events.
 *
 * - `'manual'` - User explicitly requested compaction
 * - `'auto'` - Automatic compaction due to context length
 */
export type PreCompactTrigger = 'manual' | 'auto';
/**
 * Reason for session end events.
 *
 * - `'clear'` - Session cleared by user
 * - `'logout'` - User logged out
 * - `'prompt_input_exit'` - User exited at prompt input
 * - `'other'` - Other reasons
 */
export type SessionEndReason = 'clear' | 'logout' | 'prompt_input_exit' | 'other';
/**
 * Common fields present in all hook inputs.
 *
 * Every hook receives these base fields providing session context.
 * Hook-specific inputs extend this base with additional fields.
 * @example
 * ```typescript
 * // All hook inputs include these fields
 * const handleAnyHook = (input: BaseHookInput) => {
 *   console.log(`Session: ${input.sessionId}`);
 *   console.log(`Working directory: ${input.cwd}`);
 *   console.log(`Transcript: ${input.transcriptPath}`);
 * };
 * ```
 * @see https://code.claude.com/docs/en/hooks#hook-input-structure
 */
export interface BaseHookInput {
  /**
   * Unique identifier for the current Claude Code session.
   * Persists across conversation turns within the same session.
   */
  sessionId: string;
  /**
   * Absolute path to the session transcript file.
   * Contains the full conversation history in JSONL format.
   */
  transcriptPath: string;
  /**
   * Current working directory for the Claude Code session.
   * All file operations are relative to this directory.
   */
  cwd: string;
  /**
   * Current permission mode for tool execution.
   * May be undefined if using default mode.
   */
  permissionMode?: PermissionMode;
}
/**
 * Input for PreToolUse hooks.
 *
 * Fires before any tool is executed, allowing you to:
 * - Inspect and validate tool inputs
 * - Allow, deny, or modify the tool execution
 * - Add custom permission logic
 *
 * This hook uses `toolName` for matcher matching.
 * @example
 * ```typescript
 * // Block dangerous Bash commands
 * preToolUseHook({ matcher: 'Bash' }, async (input: PreToolUseInput) => {
 *   const command = input.toolInput.command as string;
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
export interface PreToolUseInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'PreToolUse';
  /**
   * Name of the tool being invoked.
   * Examples: 'Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'
   */
  toolName: string;
  /**
   * Input parameters being passed to the tool.
   * Structure varies by tool type.
   */
  toolInput: unknown;
  /**
   * Unique identifier for this specific tool invocation.
   * Use this to correlate with PostToolUse events.
   */
  toolUseId: string;
}
/**
 * Input for PostToolUse hooks.
 *
 * Fires after a tool executes successfully, allowing you to:
 * - Inspect tool results
 * - Add additional context to the conversation
 * - Modify MCP tool output
 *
 * This hook uses `toolName` for matcher matching.
 * @example
 * ```typescript
 * // Add context after file reads
 * postToolUseHook({ matcher: 'Read' }, async (input: PostToolUseInput) => {
 *   const filePath = input.toolInput.file_path as string;
 *   return postToolUseOutput({
 *     additionalContext: `File ${filePath} was read successfully`
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#posttooluse
 */
export interface PostToolUseInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'PostToolUse';
  /**
   * Name of the tool that was invoked.
   */
  toolName: string;
  /**
   * Input parameters that were passed to the tool.
   */
  toolInput: unknown;
  /**
   * Response returned by the tool.
   * Structure varies by tool type.
   */
  toolResponse: unknown;
  /**
   * Unique identifier for this tool invocation.
   * Matches the toolUseId from the corresponding PreToolUse event.
   */
  toolUseId: string;
}
/**
 * Input for PostToolUseFailure hooks.
 *
 * Fires after a tool execution fails, allowing you to:
 * - Log or report tool failures
 * - Add context about the failure
 * - Take corrective action
 *
 * This hook uses `toolName` for matcher matching.
 * @example
 * ```typescript
 * // Log tool failures
 * postToolUseFailureHook({ matcher: '.*' }, async (input: PostToolUseFailureInput) => {
 *   console.error(`Tool ${input.toolName} failed: ${input.error}`);
 *   return postToolUseFailureOutput({
 *     additionalContext: 'Please try an alternative approach'
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#posttoolusefailure
 */
export interface PostToolUseFailureInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'PostToolUseFailure';
  /**
   * Name of the tool that failed.
   */
  toolName: string;
  /**
   * Input parameters that were passed to the tool.
   */
  toolInput: unknown;
  /**
   * Unique identifier for this tool invocation.
   */
  toolUseId: string;
  /**
   * Error message describing why the tool failed.
   */
  error: string;
  /**
   * Whether this failure was caused by a user interrupt.
   */
  isInterrupt?: boolean;
}
/**
 * Input for Notification hooks.
 *
 * Fires when Claude Code sends a notification, allowing you to:
 * - Forward notifications to external systems
 * - Log important events
 * - Trigger custom alerting
 *
 * This hook uses `notificationType` for matcher matching.
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
export interface NotificationInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'Notification';
  /**
   * Main content of the notification.
   */
  message: string;
  /**
   * Optional title for the notification.
   */
  title?: string;
  /**
   * Type/category of the notification.
   */
  notificationType: string;
}
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
export interface UserPromptSubmitInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'UserPromptSubmit';
  /**
   * The prompt text submitted by the user.
   */
  prompt: string;
}
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
export interface SessionStartInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'SessionStart';
  /**
   * How the session was started.
   *
   * - `'startup'` - New session started from scratch
   * - `'resume'` - Resuming a previous session
   * - `'clear'` - Session cleared and restarted
   * - `'compact'` - Session restarted after context compaction
   */
  source: SessionStartSource;
}
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
export interface SessionEndInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'SessionEnd';
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
export interface StopInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'Stop';
  /**
   * Whether a stop hook is currently active.
   * Used to prevent recursive stop hook invocations.
   */
  stopHookActive: boolean;
}
/**
 * Input for SubagentStart hooks.
 *
 * Fires when a subagent (Task tool) starts, allowing you to:
 * - Inject context for the subagent
 * - Log subagent invocations
 * - Configure subagent behavior
 *
 * This hook uses `agentType` for matcher matching.
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
export interface SubagentStartInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'SubagentStart';
  /**
   * Unique identifier for the subagent instance.
   */
  agentId: string;
  /**
   * Type of subagent being started.
   * Examples: 'explore', 'codebase-analysis', custom agent types
   */
  agentType: string;
}
/**
 * Input for SubagentStop hooks.
 *
 * Fires when a subagent completes or stops, allowing you to:
 * - Process subagent results
 * - Clean up subagent resources
 * - Log subagent completion
 * - Block subagent from stopping
 *
 * This hook uses `agentType` for matcher matching.
 * @example
 * ```typescript
 * // Block explore subagent if task incomplete
 * subagentStopHook({ matcher: 'explore' }, async (input: SubagentStopInput) => {
 *   console.log(`Subagent ${input.agentId} (${input.agentType}) stopping`);
 *   return subagentStopOutput({
 *     decision: 'block',
 *     reason: 'Please verify all files were explored'
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#subagentstop
 */
export interface SubagentStopInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'SubagentStop';
  /**
   * Whether a stop hook is currently active.
   */
  stopHookActive: boolean;
  /**
   * Unique identifier for the subagent instance.
   */
  agentId: string;
  /**
   * Type of subagent that is stopping.
   * Examples: 'explore', 'codebase-analysis', custom agent types
   */
  agentType: string;
  /**
   * Path to the subagent's transcript file.
   */
  agentTranscriptPath: string;
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
export interface PreCompactInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'PreCompact';
  /**
   * What triggered the compaction.
   *
   * - `'manual'` - User explicitly requested compaction
   * - `'auto'` - Automatic compaction due to context length
   */
  trigger: PreCompactTrigger;
  /**
   * Custom instructions to include in the compacted context.
   * May be null if no custom instructions are set.
   */
  customInstructions: string | null;
}
/**
 * Input for PermissionRequest hooks.
 *
 * Fires when a permission prompt would be shown, allowing you to:
 * - Auto-approve or deny tool executions
 * - Implement custom permission logic
 * - Modify tool inputs before approval
 *
 * This hook uses `toolName` for matcher matching.
 * @example
 * ```typescript
 * // Auto-approve read operations in allowed directories
 * permissionRequestHook({ matcher: 'Read' }, async (input: PermissionRequestInput) => {
 *   const filePath = input.toolInput.file_path as string;
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
export interface PermissionRequestInput extends BaseHookInput {
  /** Discriminator for hook event type. */
  hookEventName: 'PermissionRequest';
  /**
   * Name of the tool requesting permission.
   */
  toolName: string;
  /**
   * Input parameters for the tool.
   */
  toolInput: unknown;
  /**
   * Unique identifier for this specific tool invocation.
   */
  toolUseId: string;
  /**
   * Suggested permission updates that would prevent future prompts.
   * Typically used for "always allow" functionality.
   */
  permissionSuggestions?: PermissionUpdate[];
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
 *   switch (input.hookEventName) {
 *     case 'PreToolUse':
 *       // TypeScript knows input is PreToolUseInput here
 *       console.log(`Tool: ${input.toolName}`);
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
 * All valid hook event names that can appear in the `hookEventName` field.
 */
export type HookEventName = HookInput['hookEventName'];
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
export declare const HOOK_EVENT_NAMES: readonly [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PermissionRequest'
];
export type { PermissionUpdate };
