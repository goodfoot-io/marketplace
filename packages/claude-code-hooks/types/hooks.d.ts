/**
 * Hook factory functions for Claude Code hooks.
 *
 * Provides typed factory functions for all 12 hook types that handle:
 * - Input type narrowing based on hook event type
 * - Output type enforcement via return types
 * - Error wrapping with automatic logging
 * - Logger context injection
 *
 * Each factory accepts a HookConfig with optional matcher and timeout settings,
 * and returns a function that the runtime invokes when the hook file executes.
 * @module
 * @example
 * ```typescript
 * import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   logger.info('Processing Bash command');
 *   return preToolUseOutput({ allow: true });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks
 */
import type {
  PreToolUseInput,
  PostToolUseInput,
  PostToolUseFailureInput,
  NotificationInput,
  UserPromptSubmitInput,
  SessionStartInput,
  SessionEndInput,
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  PreCompactInput,
  PermissionRequestInput,
  HookEventName
} from './inputs.js';
import type { Logger } from './logger.js';
import type {
  SpecificHookOutput,
  PreToolUseOutput,
  PostToolUseOutput,
  PostToolUseFailureOutput,
  NotificationOutput,
  UserPromptSubmitOutput,
  SessionStartOutput,
  SessionEndOutput,
  StopOutput,
  SubagentStartOutput,
  SubagentStopOutput,
  PreCompactOutput,
  PermissionRequestOutput
} from './outputs.js';
import type { ToolInputMap, KnownToolName } from './tool-inputs.js';
/**
 * Configuration options for hook factories.
 *
 * Controls how the hook matches events and handler timeout behavior.
 *
 * ## Matcher Semantics by Hook Type
 *
 * | Hook Type | Matcher Matches Against | Example Values |
 * |-----------|------------------------|----------------|
 * | PreToolUse | `toolName` | `'Bash'`, `'Bash\|Read'`, `'.*'` |
 * | PostToolUse | `toolName` | `'Bash'`, `'Skill'`, `'Write\|Edit'` |
 * | PostToolUseFailure | `toolName` | `'Bash'` |
 * | PermissionRequest | `toolName` | `'Bash'`, `'Read'` |
 * | SessionStart | `source` | `'startup'`, `'resume'`, `'clear'`, `'compact'` |
 * | SessionEnd | `reason` | Exit reason string |
 * | Stop | N/A (no matcher) | Fires on all stop events |
 * | SubagentStart | `agentType` | Subagent type |
 * | SubagentStop | `agentType` | Subagent type |
 * | Notification | `notificationType` | Notification type |
 * | UserPromptSubmit | N/A (no matcher) | Fires on all prompt submissions |
 * | PreCompact | `trigger` | `'manual'`, `'auto'` |
 * @example
 * ```typescript
 * // Match only Bash tool usage
 * preToolUseHook({ matcher: 'Bash' }, handler);
 *
 * // Match multiple tools
 * preToolUseHook({ matcher: 'Bash|Read|Write' }, handler);
 *
 * // Match all tools with regex
 * preToolUseHook({ matcher: '.*' }, handler);
 *
 * // Set handler timeout
 * preToolUseHook({ timeout: 5000 }, handler);
 * ```
 */
export interface HookConfig {
  /**
   * Regular expression pattern for matching hook events.
   *
   * What the pattern matches against depends on the hook type:
   * - Tool hooks (PreToolUse, PostToolUse, etc.): matches `toolName`
   * - SessionStart: matches `source`
   * - SessionEnd: matches `reason`
   * - SubagentStart/Stop: matches `agentType`
   * - Notification: matches `notificationType`
   * - PreCompact: matches `trigger`
   * - Stop, UserPromptSubmit: no matcher (fires on all events)
   *
   * If not provided, the hook fires for all events of its type.
   * @example
   * ```typescript
   * // Match Bash tool
   * { matcher: 'Bash' }
   *
   * // Match multiple tools with alternation
   * { matcher: 'Bash|Read|Write' }
   *
   * // Match all with regex
   * { matcher: '.*' }
   *
   * // Match startup sessions
   * { matcher: 'startup' }
   * ```
   */
  matcher?: string;
  /**
   * Handler execution timeout in milliseconds.
   *
   * If the handler does not complete within this time, it will be
   * terminated and an error will be logged. This prevents hooks from
   * blocking Claude Code indefinitely.
   *
   * If not provided, uses the default timeout from the runtime.
   * @example
   * ```typescript
   * // 5 second timeout
   * { timeout: 5000 }
   *
   * // 30 second timeout for long operations
   * { timeout: 30000 }
   * ```
   */
  timeout?: number;
}
/**
 * Configuration for hooks with a known single-tool matcher.
 *
 * When the matcher is a single known tool name, the handler receives
 * automatically typed toolInput based on the tool type.
 * @template T - The known tool name
 * @example
 * ```typescript
 * // toolInput is automatically typed as WriteToolInput
 * preToolUseHook({ matcher: 'Write' }, (input) => {
 *   console.log(input.toolInput.file_path); // Typed!
 *   console.log(input.toolInput.content);   // Typed!
 * });
 * ```
 */
export interface TypedHookConfig<T extends KnownToolName> {
  /**
   * The single tool name to match.
   * When this is a known tool name, toolInput will be automatically typed.
   */
  matcher: T;
  /**
   * Handler execution timeout in milliseconds.
   */
  timeout?: number;
}
/**
 * PreToolUseInput with typed toolInput for a specific tool.
 * @template T - The known tool name
 */
export type TypedPreToolUseInput<T extends KnownToolName> = Omit<PreToolUseInput, 'toolName' | 'toolInput'> & {
  toolName: T;
  toolInput: ToolInputMap[T];
};
/**
 * PostToolUseInput with typed toolInput for a specific tool.
 * @template T - The known tool name
 */
export type TypedPostToolUseInput<T extends KnownToolName> = Omit<PostToolUseInput, 'toolName' | 'toolInput'> & {
  toolName: T;
  toolInput: ToolInputMap[T];
};
/**
 * PostToolUseFailureInput with typed toolInput for a specific tool.
 * @template T - The known tool name
 */
export type TypedPostToolUseFailureInput<T extends KnownToolName> = Omit<
  PostToolUseFailureInput,
  'toolName' | 'toolInput'
> & {
  toolName: T;
  toolInput: ToolInputMap[T];
};
/**
 * PermissionRequestInput with typed toolInput for a specific tool.
 * @template T - The known tool name
 */
export type TypedPermissionRequestInput<T extends KnownToolName> = Omit<
  PermissionRequestInput,
  'toolName' | 'toolInput'
> & {
  toolName: T;
  toolInput: ToolInputMap[T];
};
/**
 * Context provided to hook handlers.
 *
 * Contains utilities and state available during hook execution.
 * The context is injected by the runtime and should not be created manually.
 * @example
 * ```typescript
 * export default preToolUseHook({}, async (input, { logger }) => {
 *   logger.info('Processing tool', { toolName: input.toolName });
 *   return preToolUseOutput({ allow: true });
 * });
 * ```
 */
export interface HookContext {
  /**
   * Logger instance for structured logging.
   *
   * The logger is pre-configured with the hook context (hookType, input)
   * so log events are automatically enriched. Use this instead of
   * console.log/error to ensure logs go to file, not stdout/stderr
   * which would interfere with the hook protocol.
   * @example
   * ```typescript
   * // Simple message
   * logger.info('Processing request');
   *
   * // With context
   * logger.warn('Rate limit approaching', { current: 95, max: 100 });
   *
   * // Error logging
   * try {
   *   await riskyOperation();
   * } catch (err) {
   *   logger.logError(err, 'Operation failed');
   * }
   * ```
   */
  logger: Logger;
}
/**
 * Extended context for SessionStart hooks.
 *
 * SessionStart hooks have additional capabilities for persisting environment
 * variables that will be available in all subsequent bash commands.
 * @example
 * ```typescript
 * export default sessionStartHook({}, async (input, { logger, persistEnvVar }) => {
 *   // Set environment variables for the session
 *   persistEnvVar('NODE_ENV', 'development');
 *   persistEnvVar('DEBUG', 'true');
 *
 *   return sessionStartOutput({});
 * });
 * ```
 */
export interface SessionStartContext extends HookContext {
  /**
   * Persists an environment variable for use in subsequent bash commands.
   *
   * This function writes a shell export statement to the `CLAUDE_ENV_FILE`,
   * which Claude Code sources before running bash commands. This allows
   * SessionStart hooks to configure the environment for the entire session.
   * @param name - The environment variable name
   * @param value - The environment variable value (will be shell-escaped)
   * @example
   * ```typescript
   * persistEnvVar('NODE_ENV', 'production');
   * persistEnvVar('API_KEY', 'secret-key');
   * ```
   */
  persistEnvVar: (name: string, value: string) => void;
  /**
   * Persists multiple environment variables at once.
   *
   * This is a convenience wrapper around `persistEnvVar` for setting
   * multiple variables in a single call.
   * @param vars - Object mapping variable names to values
   * @example
   * ```typescript
   * persistEnvVars({
   *   NODE_ENV: 'production',
   *   API_KEY: 'secret',
   *   DEBUG: 'false'
   * });
   * ```
   */
  persistEnvVars: (vars: Record<string, string>) => void;
}
/**
 * Handler function for a specific hook type.
 *
 * Receives the typed input and context, returns a specific output type.
 * Can be async for operations that require awaiting.
 * @template TInput - The input type for this hook
 * @template TOutput - The specific output type for this hook
 * @template TContext - The context type (defaults to HookContext)
 */
export type HookHandler<TInput, TOutput extends SpecificHookOutput, TContext extends HookContext = HookContext> = (
  input: TInput,
  context: TContext
) => TOutput | Promise<TOutput>;
/**
 * The result of a hook factory - a function that wraps the handler.
 *
 * This is what gets exported from hook files and invoked by the runtime.
 * The wrapper handles error catching and logging.
 * @template TInput - The input type for this hook
 * @template TOutput - The specific output type for this hook
 * @template TContext - The context type (defaults to HookContext)
 */
export interface HookFunction<TInput, TOutput extends SpecificHookOutput, TContext extends HookContext = HookContext> {
  /**
   * Execute the hook handler with the given input and context.
   * @param input - The hook input data
   * @param context - The hook execution context
   * @returns The hook output (specific type, converted to HookOutput by runtime)
   */
  (input: TInput, context: TContext): Promise<TOutput>;
  /**
   * The hook event name this handler is for.
   */
  hookEventName: HookEventName;
  /**
   * The matcher pattern, if configured.
   */
  matcher?: string;
  /**
   * The timeout in milliseconds, if configured.
   */
  timeout?: number;
}
/**
 * Creates a PreToolUse hook handler.
 *
 * PreToolUse hooks fire before any tool is executed, allowing you to:
 * - Inspect and validate tool inputs
 * - Allow, deny, or modify the tool execution
 * - Add custom permission logic
 *
 * **Matcher**: Matches against `toolName` (e.g., 'Bash', 'Read', 'Write')
 *
 * **Typed Overload**: When the matcher is a single known tool name (Write, Edit,
 * MultiEdit, Read, Bash, Glob, Grep), the handler receives automatically typed
 * `toolInput` based on the tool type.
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Typed overload: toolInput is automatically typed as BashToolInput
 * export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   // input.toolInput.command is typed as string - no cast needed!
 *   if (input.toolInput.command.includes('rm -rf')) {
 *     logger.warn('Blocking destructive command', { command: input.toolInput.command });
 *     return preToolUseOutput({
 *       hookSpecificOutput: {
 *         permissionDecision: 'deny',
 *         permissionDecisionReason: 'Destructive commands are not allowed'
 *       }
 *     });
 *   }
 *
 *   return preToolUseOutput({
 *     hookSpecificOutput: { permissionDecision: 'allow' }
 *   });
 * });
 * ```
 * @example
 * ```typescript
 * // Typed overload: toolInput is automatically typed as WriteToolInput
 * export default preToolUseHook({ matcher: 'Write' }, (input) => {
 *   const { file_path, content } = input.toolInput; // Full autocomplete!
 *   // ...
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#pretooluse
 */
export declare function preToolUseHook<T extends KnownToolName>(
  config: TypedHookConfig<T>,
  handler: HookHandler<TypedPreToolUseInput<T>, PreToolUseOutput>
): HookFunction<TypedPreToolUseInput<T>, PreToolUseOutput>;
export declare function preToolUseHook(
  config: HookConfig,
  handler: HookHandler<PreToolUseInput, PreToolUseOutput>
): HookFunction<PreToolUseInput, PreToolUseOutput>;
/**
 * Creates a PostToolUse hook handler.
 *
 * PostToolUse hooks fire after a tool executes successfully, allowing you to:
 * - Inspect tool results
 * - Add additional context to the conversation
 * - Modify MCP tool output
 *
 * **Matcher**: Matches against `toolName`
 *
 * **Typed Overload**: When the matcher is a single known tool name, the handler
 * receives automatically typed `toolInput` based on the tool type.
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { postToolUseHook, postToolUseOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Typed overload: toolInput is automatically typed as ReadToolInput
 * export default postToolUseHook({ matcher: 'Read' }, async (input, { logger }) => {
 *   // input.toolInput.file_path is typed as string - no cast needed!
 *   logger.info('File read completed', { filePath: input.toolInput.file_path });
 *
 *   return postToolUseOutput({
 *     hookSpecificOutput: {
 *       additionalContext: `File ${input.toolInput.file_path} was read successfully`
 *     }
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#posttooluse
 */
export declare function postToolUseHook<T extends KnownToolName>(
  config: TypedHookConfig<T>,
  handler: HookHandler<TypedPostToolUseInput<T>, PostToolUseOutput>
): HookFunction<TypedPostToolUseInput<T>, PostToolUseOutput>;
export declare function postToolUseHook(
  config: HookConfig,
  handler: HookHandler<PostToolUseInput, PostToolUseOutput>
): HookFunction<PostToolUseInput, PostToolUseOutput>;
/**
 * Creates a PostToolUseFailure hook handler.
 *
 * PostToolUseFailure hooks fire after a tool execution fails, allowing you to:
 * - Log or report tool failures
 * - Add context about the failure
 * - Take corrective action
 *
 * **Matcher**: Matches against `toolName`
 *
 * **Typed Overload**: When the matcher is a single known tool name, the handler
 * receives automatically typed `toolInput` based on the tool type.
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { postToolUseFailureHook, postToolUseFailureOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Log tool failures and suggest alternatives
 * export default postToolUseFailureHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   // input.toolInput.command is typed as string
 *   logger.error('Bash command failed', {
 *     command: input.toolInput.command,
 *     error: input.error
 *   });
 *
 *   return postToolUseFailureOutput({
 *     hookSpecificOutput: {
 *       additionalContext: 'Please try an alternative approach'
 *     }
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#posttoolusefailure
 */
export declare function postToolUseFailureHook<T extends KnownToolName>(
  config: TypedHookConfig<T>,
  handler: HookHandler<TypedPostToolUseFailureInput<T>, PostToolUseFailureOutput>
): HookFunction<TypedPostToolUseFailureInput<T>, PostToolUseFailureOutput>;
export declare function postToolUseFailureHook(
  config: HookConfig,
  handler: HookHandler<PostToolUseFailureInput, PostToolUseFailureOutput>
): HookFunction<PostToolUseFailureInput, PostToolUseFailureOutput>;
/**
 * Creates a Notification hook handler.
 *
 * Notification hooks fire when Claude Code sends a notification, allowing you to:
 * - Forward notifications to external systems
 * - Log important events
 * - Trigger custom alerting
 *
 * **Matcher**: Matches against `notificationType`
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { notificationHook, notificationOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Forward notifications to Slack
 * export default notificationHook({}, async (input, { logger }) => {
 *   logger.info('Notification received', {
 *     type: input.notificationType,
 *     title: input.title
 *   });
 *
 *   await sendSlackMessage(input.title ?? 'Notification', input.message);
 *
 *   return notificationOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#notification
 */
export declare function notificationHook(
  config: HookConfig,
  handler: HookHandler<NotificationInput, NotificationOutput>
): HookFunction<NotificationInput, NotificationOutput>;
/**
 * Creates a UserPromptSubmit hook handler.
 *
 * UserPromptSubmit hooks fire when a user submits a prompt, allowing you to:
 * - Add additional context or instructions
 * - Log user interactions
 * - Validate or transform prompts
 *
 * **Matcher**: No matcher support - fires on all prompt submissions
 * @param config - Hook configuration with optional timeout (matcher is ignored)
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { userPromptSubmitHook, userPromptSubmitOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Add project context to every prompt
 * export default userPromptSubmitHook({}, async (input, { logger }) => {
 *   logger.debug('User prompt submitted', { promptLength: input.prompt.length });
 *
 *   const projectContext = await getProjectContext();
 *
 *   return userPromptSubmitOutput({
 *     additionalContext: projectContext
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#userpromptsubmit
 */
export declare function userPromptSubmitHook(
  config: HookConfig,
  handler: HookHandler<UserPromptSubmitInput, UserPromptSubmitOutput>
): HookFunction<UserPromptSubmitInput, UserPromptSubmitOutput>;
/**
 * Creates a SessionStart hook handler.
 *
 * SessionStart hooks fire when a Claude Code session starts or restarts,
 * allowing you to:
 * - Initialize session state
 * - Inject context or instructions
 * - Persist environment variables for subsequent bash commands
 * - Set up logging or monitoring
 *
 * **Matcher**: Matches against `source` ('startup', 'resume', 'clear', 'compact')
 *
 * **Context**: SessionStart hooks receive an extended context with `persistEnvVar`
 * and `persistEnvVars` functions for setting environment variables.
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { sessionStartHook, sessionStartOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Persist environment variables for the session
 * export default sessionStartHook({ matcher: 'startup' }, async (input, { logger, persistEnvVar }) => {
 *   logger.info('New session started', {
 *     sessionId: input.sessionId,
 *     cwd: input.cwd
 *   });
 *
 *   // Set environment variables for all subsequent bash commands
 *   persistEnvVar('NODE_ENV', 'development');
 *   persistEnvVar('DEBUG', 'true');
 *
 *   return sessionStartOutput({});
 * });
 * ```
 * @example
 * ```typescript
 * // Set multiple environment variables at once
 * export default sessionStartHook({}, async (input, { persistEnvVars }) => {
 *   persistEnvVars({
 *     NODE_ENV: 'production',
 *     API_KEY: 'secret',
 *     DEBUG: 'false'
 *   });
 *
 *   return sessionStartOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#sessionstart
 */
export declare function sessionStartHook(
  config: HookConfig,
  handler: HookHandler<SessionStartInput, SessionStartOutput, SessionStartContext>
): HookFunction<SessionStartInput, SessionStartOutput, SessionStartContext>;
/**
 * Creates a SessionEnd hook handler.
 *
 * SessionEnd hooks fire when a Claude Code session ends, allowing you to:
 * - Clean up session resources
 * - Log session metrics
 * - Persist session state
 *
 * **Matcher**: Matches against `reason` (the exit reason string)
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { sessionEndHook, sessionEndOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Log session end and clean up
 * export default sessionEndHook({}, async (input, { logger }) => {
 *   logger.info('Session ended', {
 *     sessionId: input.sessionId,
 *     reason: input.reason
 *   });
 *
 *   await cleanupSessionResources(input.sessionId);
 *
 *   return sessionEndOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#sessionend
 */
export declare function sessionEndHook(
  config: HookConfig,
  handler: HookHandler<SessionEndInput, SessionEndOutput>
): HookFunction<SessionEndInput, SessionEndOutput>;
/**
 * Creates a Stop hook handler.
 *
 * Stop hooks fire when Claude Code is about to stop, allowing you to:
 * - Block the stop and require additional action
 * - Confirm the user wants to stop
 * - Clean up resources before stopping
 *
 * **Matcher**: No matcher support - fires on all stop events
 * @param config - Hook configuration with optional timeout (matcher is ignored)
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { stopHook, stopOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Block stop if there are pending changes
 * export default stopHook({}, async (input, { logger }) => {
 *   const pendingChanges = await checkPendingChanges();
 *
 *   if (pendingChanges.length > 0) {
 *     logger.warn('Blocking stop due to pending changes', {
 *       count: pendingChanges.length
 *     });
 *
 *     return stopOutput({
 *       decision: 'block',
 *       reason: `There are ${pendingChanges.length} uncommitted changes`,
 *       systemMessage: 'Please commit or discard changes before stopping'
 *     });
 *   }
 *
 *   logger.info('Approving stop');
 *   return stopOutput({ decision: 'approve' });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#stop
 */
export declare function stopHook(
  config: HookConfig,
  handler: HookHandler<StopInput, StopOutput>
): HookFunction<StopInput, StopOutput>;
/**
 * Creates a SubagentStart hook handler.
 *
 * SubagentStart hooks fire when a subagent (Task tool) starts, allowing you to:
 * - Inject context for the subagent
 * - Log subagent invocations
 * - Configure subagent behavior
 *
 * **Matcher**: Matches against `agentType` (e.g., 'explore', 'codebase-analysis')
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { subagentStartHook, subagentStartOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Add context for explore subagents
 * export default subagentStartHook({ matcher: 'explore' }, async (input, { logger }) => {
 *   logger.info('Explore subagent starting', {
 *     agentId: input.agentId,
 *     agentType: input.agentType
 *   });
 *
 *   return subagentStartOutput({
 *     additionalContext: 'Focus on finding patterns and conventions'
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#subagentstart
 */
export declare function subagentStartHook(
  config: HookConfig,
  handler: HookHandler<SubagentStartInput, SubagentStartOutput>
): HookFunction<SubagentStartInput, SubagentStartOutput>;
/**
 * Creates a SubagentStop hook handler.
 *
 * SubagentStop hooks fire when a subagent completes or stops, allowing you to:
 * - Block the subagent from stopping
 * - Process subagent results
 * - Clean up subagent resources
 * - Log subagent completion
 *
 * **Matcher**: Matches against `agentType` (e.g., 'explore', 'codebase-analysis')
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { subagentStopHook, subagentStopOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Block explore subagents if task incomplete
 * export default subagentStopHook({ matcher: 'explore' }, async (input, { logger }) => {
 *   logger.info('Subagent stopping', {
 *     agentId: input.agentId,
 *     agentType: input.agentType
 *   });
 *
 *   // Block if transcript shows incomplete work
 *   return subagentStopOutput({
 *     decision: 'block',
 *     reason: 'Please verify exploration is complete'
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#subagentstop
 */
export declare function subagentStopHook(
  config: HookConfig,
  handler: HookHandler<SubagentStopInput, SubagentStopOutput>
): HookFunction<SubagentStopInput, SubagentStopOutput>;
/**
 * Creates a PreCompact hook handler.
 *
 * PreCompact hooks fire before context compaction occurs, allowing you to:
 * - Preserve important information before compaction
 * - Log compaction events
 * - Modify custom instructions for the compacted context
 *
 * **Matcher**: Matches against `trigger` ('manual', 'auto')
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { preCompactHook, preCompactOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Log compaction events and preserve context
 * export default preCompactHook({}, async (input, { logger }) => {
 *   logger.info('Context compaction triggered', {
 *     trigger: input.trigger,
 *     hasCustomInstructions: input.customInstructions !== null
 *   });
 *
 *   return preCompactOutput({
 *     systemMessage: 'Remember: strict mode is enabled'
 *   });
 * });
 * ```
 * @example
 * ```typescript
 * // Only handle manual compaction
 * export default preCompactHook({ matcher: 'manual' }, async (input, { logger }) => {
 *   logger.info('Manual compaction requested');
 *   return preCompactOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#precompact
 */
export declare function preCompactHook(
  config: HookConfig,
  handler: HookHandler<PreCompactInput, PreCompactOutput>
): HookFunction<PreCompactInput, PreCompactOutput>;
/**
 * Creates a PermissionRequest hook handler.
 *
 * PermissionRequest hooks fire when a permission prompt would be shown,
 * allowing you to:
 * - Auto-approve or deny tool executions
 * - Implement custom permission logic
 * - Modify tool inputs before approval
 *
 * **Matcher**: Matches against `toolName`
 *
 * **Typed Overload**: When the matcher is a single known tool name, the handler
 * receives automatically typed `toolInput` based on the tool type.
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { permissionRequestHook, permissionRequestOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Typed overload: toolInput is automatically typed as ReadToolInput
 * export default permissionRequestHook({ matcher: 'Read' }, async (input, { logger }) => {
 *   // input.toolInput.file_path is typed as string - no cast needed!
 *   if (input.toolInput.file_path.startsWith('/allowed/')) {
 *     logger.info('Auto-approving read in allowed directory', { filePath: input.toolInput.file_path });
 *     return permissionRequestOutput({
 *       hookSpecificOutput: { decision: { behavior: 'allow' } }
 *     });
 *   }
 *
 *   // Fall through to normal permission prompt
 *   return permissionRequestOutput({});
 * });
 * ```
 * @example
 * ```typescript
 * // Typed overload: toolInput is automatically typed as BashToolInput
 * export default permissionRequestHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   // input.toolInput.command is typed as string - no cast needed!
 *   if (input.toolInput.command.includes('sudo')) {
 *     logger.warn('Denying sudo command', { command: input.toolInput.command });
 *     return permissionRequestOutput({
 *       hookSpecificOutput: {
 *         decision: {
 *           behavior: 'deny',
 *           message: 'sudo commands are not allowed',
 *           interrupt: true
 *         }
 *       }
 *     });
 *   }
 *
 *   return permissionRequestOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#permissionrequest
 */
export declare function permissionRequestHook<T extends KnownToolName>(
  config: TypedHookConfig<T>,
  handler: HookHandler<TypedPermissionRequestInput<T>, PermissionRequestOutput>
): HookFunction<TypedPermissionRequestInput<T>, PermissionRequestOutput>;
export declare function permissionRequestHook(
  config: HookConfig,
  handler: HookHandler<PermissionRequestInput, PermissionRequestOutput>
): HookFunction<PermissionRequestInput, PermissionRequestOutput>;
