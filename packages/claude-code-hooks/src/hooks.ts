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

import type { Logger } from "./logger.js";
import type {
  ConfigChangeOutput,
  CwdChangedOutput,
  ElicitationOutput,
  ElicitationResultOutput,
  FileChangedOutput,
  InstructionsLoadedOutput,
  NotificationOutput,
  PermissionDeniedOutput,
  PermissionRequestOutput,
  PostCompactOutput,
  PostToolUseFailureOutput,
  PostToolUseOutput,
  PreCompactOutput,
  PreToolUseOutput,
  SessionEndOutput,
  SessionStartOutput,
  SetupOutput,
  SpecificHookOutput,
  StopFailureOutput,
  StopOutput,
  SubagentStartOutput,
  SubagentStopOutput,
  TaskCompletedOutput,
  TaskCreatedOutput,
  TeammateIdleOutput,
  UserPromptSubmitOutput,
  WorktreeCreateOutput,
  WorktreeRemoveOutput,
} from "./outputs.js";
import type {
  ConfigChangeInput,
  CwdChangedInput,
  ElicitationInput,
  ElicitationResultInput,
  FileChangedInput,
  HookEventName,
  InstructionsLoadedInput,
  KnownToolName,
  NotificationInput,
  PermissionDeniedInput,
  PermissionRequestInput,
  PostCompactInput,
  PostToolUseFailureInput,
  PostToolUseInput,
  PreCompactInput,
  PreToolUseInput,
  SessionEndInput,
  SessionStartInput,
  SetupInput,
  StopFailureInput,
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  TaskCompletedInput,
  TaskCreatedInput,
  TeammateIdleInput,
  ToolInputMap,
  UserPromptSubmitInput,
  WorktreeCreateInput,
  WorktreeRemoveInput,
} from "./types.js";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for hook factories.
 *
 * Controls how the hook matches events and handler timeout behavior.
 *
 * ## Matcher Semantics by Hook Type
 *
 * | Hook Type | Matcher Matches Against | Example Values |
 * |-----------|------------------------|----------------|
 * | PreToolUse | `tool_name` | `'Bash'`, `'Bash\|Read'`, `'.*'` |
 * | PostToolUse | `tool_name` | `'Bash'`, `'Skill'`, `'Write\|Edit'` |
 * | PostToolUseFailure | `tool_name` | `'Bash'` |
 * | PermissionRequest | `tool_name` | `'Bash'`, `'Read'` |
 * | SessionStart | `source` | `'startup'`, `'resume'`, `'clear'`, `'compact'` |
 * | SessionEnd | `reason` | Exit reason string |
 * | Stop | N/A (no matcher) | Fires on all stop events |
 * | SubagentStart | `agent_type` | Subagent type |
 * | SubagentStop | `agent_type` | Subagent type |
 * | Notification | `notification_type` | Notification type |
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
   * - Tool hooks (PreToolUse, PostToolUse, etc.): matches `tool_name`
   * - SessionStart: matches `source`
   * - SessionEnd: matches `reason`
   * - SubagentStart/Stop: matches `agent_type`
   * - Notification: matches `notification_type`
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

// ============================================================================
// Typed Configuration Types (for single-tool matchers)
// ============================================================================

/**
 * Configuration for hooks with a known single-tool matcher.
 *
 * When the matcher is a single known tool name, the handler receives
 * automatically typed toolInput based on the tool type.
 * @template T - The known tool name
 * @example
 * ```typescript
 * // tool_input is automatically typed as FileWriteInput
 * preToolUseHook({ matcher: 'Write' }, (input) => {
 *   console.log(input.tool_input.file_path); // Typed!
 *   console.log(input.tool_input.content);   // Typed!
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
 * PreToolUseHookInput with typed tool_input for a specific tool.
 * @template T - The known tool name
 */
type _TypedPreToolUseHookInputBase<T extends KnownToolName> = Omit<PreToolUseInput, "tool_name" | "tool_input"> & {
  tool_name: T;
  tool_input: ToolInputMap[T];
};
// Inlined mapped type forces TypeScript to expand properties in hover tooltips
export type TypedPreToolUseHookInput<T extends KnownToolName> = {
  [K in keyof _TypedPreToolUseHookInputBase<T>]: _TypedPreToolUseHookInputBase<T>[K];
} & {};

/**
 * PostToolUseHookInput with typed tool_input for a specific tool.
 * @template T - The known tool name
 */
type _TypedPostToolUseHookInputBase<T extends KnownToolName> = Omit<PostToolUseInput, "tool_name" | "tool_input"> & {
  tool_name: T;
  tool_input: ToolInputMap[T];
};
// Inlined mapped type forces TypeScript to expand properties in hover tooltips
export type TypedPostToolUseHookInput<T extends KnownToolName> = {
  [K in keyof _TypedPostToolUseHookInputBase<T>]: _TypedPostToolUseHookInputBase<T>[K];
} & {};

/**
 * PostToolUseFailureHookInput with typed tool_input for a specific tool.
 * @template T - The known tool name
 */
type _TypedPostToolUseFailureHookInputBase<T extends KnownToolName> = Omit<
  PostToolUseFailureInput,
  "tool_name" | "tool_input"
> & {
  tool_name: T;
  tool_input: ToolInputMap[T];
};
// Inlined mapped type forces TypeScript to expand properties in hover tooltips
export type TypedPostToolUseFailureHookInput<T extends KnownToolName> = {
  [K in keyof _TypedPostToolUseFailureHookInputBase<T>]: _TypedPostToolUseFailureHookInputBase<T>[K];
} & {};

/**
 * PermissionRequestInput with typed tool_input for a specific tool.
 * @template T - The known tool name
 */
type _TypedPermissionRequestInputBase<T extends KnownToolName> = Omit<
  PermissionRequestInput,
  "tool_name" | "tool_input"
> & {
  tool_name: T;
  tool_input: ToolInputMap[T];
};
// Inlined mapped type forces TypeScript to expand properties in hover tooltips
export type TypedPermissionRequestInput<T extends KnownToolName> = {
  [K in keyof _TypedPermissionRequestInputBase<T>]: _TypedPermissionRequestInputBase<T>[K];
} & {};

/**
 * Context provided to hook handlers.
 *
 * Contains utilities and state available during hook execution.
 * The context is injected by the runtime and should not be created manually.
 * @example
 * ```typescript
 * export default preToolUseHook({}, async (input, { logger }) => {
 *   logger.info('Processing tool', { toolName: input.tool_name });
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

// ============================================================================
// Handler Types
// ============================================================================

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
  context: TContext,
) => TOutput | null | Promise<TOutput | null>;

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
   * @returns The hook output, or null to exit 0 with no stdout
   */
  (input: TInput, context: TContext): Promise<TOutput | null>;

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

// ============================================================================
// Generic Factory
// ============================================================================

/**
 * Creates a hook factory function for a specific hook type.
 *
 * This is the internal implementation used by all typed factories.
 * It wraps the handler with error catching and logging.
 * @param hookEventName - The hook event name
 * @param config - Hook configuration
 * @param handler - The handler function to wrap
 * @returns A wrapped hook function
 * @internal
 */
function createHookFunction<TInput, TOutput extends SpecificHookOutput, TContext extends HookContext = HookContext>(
  hookEventName: HookEventName,
  config: HookConfig,
  handler: HookHandler<TInput, TOutput, TContext>,
): HookFunction<TInput, TOutput, TContext> {
  const hookFn = async (input: TInput, context: TContext): Promise<TOutput | null> => {
    // Delegate error handling to the runtime - just execute the handler
    // The runtime will catch errors, log them, and return appropriate output
    return await handler(input, context);
  };

  // Attach metadata for runtime inspection
  hookFn.hookEventName = hookEventName;
  hookFn.matcher = config.matcher;
  hookFn.timeout = config.timeout;

  return hookFn;
}

// ============================================================================
// PreToolUse Hook Factory
// ============================================================================

/**
 * Creates a PreToolUse hook handler.
 *
 * PreToolUse hooks fire before any tool is executed, allowing you to:
 * - Inspect and validate tool inputs
 * - Allow, deny, or modify the tool execution
 * - Add custom permission logic
 *
 * **Matcher**: Matches against `tool_name` (e.g., 'Bash', 'Read', 'Write')
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
 * // Typed overload: tool_input is automatically typed as BashInput
 * export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   // input.tool_input.command is typed as string - no cast needed!
 *   if (input.tool_input.command.includes('rm -rf')) {
 *     logger.warn('Blocking destructive command', { command: input.tool_input.command });
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
 * // Typed overload: tool_input is automatically typed as FileWriteInput
 * export default preToolUseHook({ matcher: 'Write' }, (input) => {
 *   const { file_path, content } = input.tool_input; // Full autocomplete!
 *   // ...
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#pretooluse
 */
export function preToolUseHook<T extends KnownToolName>(
  config: TypedHookConfig<T>,
  handler: HookHandler<TypedPreToolUseHookInput<T>, PreToolUseOutput>,
): HookFunction<TypedPreToolUseHookInput<T>, PreToolUseOutput>;
export function preToolUseHook(
  config: HookConfig,
  handler: HookHandler<PreToolUseInput, PreToolUseOutput>,
): HookFunction<PreToolUseInput, PreToolUseOutput>;
/** @inheritdoc */
export function preToolUseHook(
  config: HookConfig,
  handler: HookHandler<PreToolUseInput, PreToolUseOutput>,
): HookFunction<PreToolUseInput, PreToolUseOutput> {
  return createHookFunction("PreToolUse", config, handler);
}

// ============================================================================
// PostToolUse Hook Factory
// ============================================================================

/**
 * Creates a PostToolUse hook handler.
 *
 * PostToolUse hooks fire after a tool executes successfully, allowing you to:
 * - Inspect tool results
 * - Add additional context to the conversation
 * - Modify MCP tool output
 *
 * **Matcher**: Matches against `tool_name`
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
 * // Typed overload: tool_input is automatically typed as FileReadInput
 * export default postToolUseHook({ matcher: 'Read' }, async (input, { logger }) => {
 *   // input.tool_input.file_path is typed as string - no cast needed!
 *   logger.info('File read completed', { filePath: input.tool_input.file_path });
 *
 *   return postToolUseOutput({
 *     hookSpecificOutput: {
 *       additionalContext: `File ${input.tool_input.file_path} was read successfully`
 *     }
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#posttooluse
 */
export function postToolUseHook<T extends KnownToolName>(
  config: TypedHookConfig<T>,
  handler: HookHandler<TypedPostToolUseHookInput<T>, PostToolUseOutput>,
): HookFunction<TypedPostToolUseHookInput<T>, PostToolUseOutput>;
export function postToolUseHook(
  config: HookConfig,
  handler: HookHandler<PostToolUseInput, PostToolUseOutput>,
): HookFunction<PostToolUseInput, PostToolUseOutput>;
/** @inheritdoc */
export function postToolUseHook(
  config: HookConfig,
  handler: HookHandler<PostToolUseInput, PostToolUseOutput>,
): HookFunction<PostToolUseInput, PostToolUseOutput> {
  return createHookFunction("PostToolUse", config, handler);
}

// ============================================================================
// PostToolUseFailure Hook Factory
// ============================================================================

/**
 * Creates a PostToolUseFailure hook handler.
 *
 * PostToolUseFailure hooks fire after a tool execution fails, allowing you to:
 * - Log or report tool failures
 * - Add context about the failure
 * - Take corrective action
 *
 * **Matcher**: Matches against `tool_name`
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
 *   // input.tool_input.command is typed as string
 *   logger.error('Bash command failed', {
 *     command: input.tool_input.command,
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
export function postToolUseFailureHook<T extends KnownToolName>(
  config: TypedHookConfig<T>,
  handler: HookHandler<TypedPostToolUseFailureHookInput<T>, PostToolUseFailureOutput>,
): HookFunction<TypedPostToolUseFailureHookInput<T>, PostToolUseFailureOutput>;
export function postToolUseFailureHook(
  config: HookConfig,
  handler: HookHandler<PostToolUseFailureInput, PostToolUseFailureOutput>,
): HookFunction<PostToolUseFailureInput, PostToolUseFailureOutput>;
/** @inheritdoc */
export function postToolUseFailureHook(
  config: HookConfig,
  handler: HookHandler<PostToolUseFailureInput, PostToolUseFailureOutput>,
): HookFunction<PostToolUseFailureInput, PostToolUseFailureOutput> {
  return createHookFunction("PostToolUseFailure", config, handler);
}

// ============================================================================
// Notification Hook Factory
// ============================================================================

/**
 * Creates a Notification hook handler.
 *
 * Notification hooks fire when Claude Code sends a notification, allowing you to:
 * - Forward notifications to external systems
 * - Log important events
 * - Trigger custom alerting
 *
 * **Matcher**: Matches against `notification_type`
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
 *     type: input.notification_type,
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
export function notificationHook(
  config: HookConfig,
  handler: HookHandler<NotificationInput, NotificationOutput>,
): HookFunction<NotificationInput, NotificationOutput> {
  return createHookFunction("Notification", config, handler);
}

// ============================================================================
// UserPromptSubmit Hook Factory
// ============================================================================

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
export function userPromptSubmitHook(
  config: HookConfig,
  handler: HookHandler<UserPromptSubmitInput, UserPromptSubmitOutput>,
): HookFunction<UserPromptSubmitInput, UserPromptSubmitOutput> {
  return createHookFunction("UserPromptSubmit", config, handler);
}

// ============================================================================
// SessionStart Hook Factory
// ============================================================================

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
 *     sessionId: input.session_id,
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
export function sessionStartHook(
  config: HookConfig,
  handler: HookHandler<SessionStartInput, SessionStartOutput, SessionStartContext>,
): HookFunction<SessionStartInput, SessionStartOutput, SessionStartContext> {
  return createHookFunction("SessionStart", config, handler);
}

// ============================================================================
// SessionEnd Hook Factory
// ============================================================================

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
 *     sessionId: input.session_id,
 *     reason: input.reason
 *   });
 *
 *   await cleanupSessionResources(input.session_id);
 *
 *   return sessionEndOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#sessionend
 */
export function sessionEndHook(
  config: HookConfig,
  handler: HookHandler<SessionEndInput, SessionEndOutput>,
): HookFunction<SessionEndInput, SessionEndOutput> {
  return createHookFunction("SessionEnd", config, handler);
}

// ============================================================================
// Stop Hook Factory
// ============================================================================

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
export function stopHook(
  config: HookConfig,
  handler: HookHandler<StopInput, StopOutput>,
): HookFunction<StopInput, StopOutput> {
  return createHookFunction("Stop", config, handler);
}

// ============================================================================
// StopFailure Hook Factory
// ============================================================================

/**
 * Creates a StopFailure hook handler.
 *
 * StopFailure hooks fire when Claude Code encounters an error while stopping
 * (e.g., API errors, authentication failures, rate limits), allowing you to:
 * - Log stop failure events and error details
 * - Alert on unexpected session termination errors
 * - Observe what error caused the failure
 *
 * **Matcher**: No matcher support - fires on all stop failure events
 * @param config - Hook configuration with optional timeout (matcher is ignored)
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { stopFailureHook, stopFailureOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default stopFailureHook({}, async (input, { logger }) => {
 *   logger.error('Session stopped due to error', {
 *     error: input.error,
 *     details: input.error_details
 *   });
 *   return stopFailureOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#stopfailure
 */
export function stopFailureHook(
  config: HookConfig,
  handler: HookHandler<StopFailureInput, StopFailureOutput>,
): HookFunction<StopFailureInput, StopFailureOutput> {
  return createHookFunction("StopFailure", config, handler);
}

// ============================================================================
// SubagentStart Hook Factory
// ============================================================================

/**
 * Creates a SubagentStart hook handler.
 *
 * SubagentStart hooks fire when a subagent (Agent tool) starts, allowing you to:
 * - Inject context for the subagent
 * - Log subagent invocations
 * - Configure subagent behavior
 *
 * **Matcher**: Matches against `agent_type` (e.g., 'explore', 'codebase-analysis')
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
 *     agentId: input.agent_id,
 *     agentType: input.agent_type
 *   });
 *
 *   return subagentStartOutput({
 *     additionalContext: 'Focus on finding patterns and conventions'
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#subagentstart
 */
export function subagentStartHook(
  config: HookConfig,
  handler: HookHandler<SubagentStartInput, SubagentStartOutput>,
): HookFunction<SubagentStartInput, SubagentStartOutput> {
  return createHookFunction("SubagentStart", config, handler);
}

// ============================================================================
// SubagentStop Hook Factory
// ============================================================================

/**
 * Creates a SubagentStop hook handler.
 *
 * SubagentStop hooks fire when a subagent completes or stops, allowing you to:
 * - Block the subagent from stopping
 * - Process subagent results
 * - Clean up subagent resources
 * - Log subagent completion
 *
 * **Matcher**: Matches against `agent_type` (e.g., 'explore', 'codebase-analysis')
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
 *     agentId: input.agent_id,
 *     agentType: input.agent_type
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
export function subagentStopHook(
  config: HookConfig,
  handler: HookHandler<SubagentStopInput, SubagentStopOutput>,
): HookFunction<SubagentStopInput, SubagentStopOutput> {
  return createHookFunction("SubagentStop", config, handler);
}

// ============================================================================
// PreCompact Hook Factory
// ============================================================================

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
 *     hasCustomInstructions: input.custom_instructions !== null
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
export function preCompactHook(
  config: HookConfig,
  handler: HookHandler<PreCompactInput, PreCompactOutput>,
): HookFunction<PreCompactInput, PreCompactOutput> {
  return createHookFunction("PreCompact", config, handler);
}

// ============================================================================
// PostCompact Hook Factory
// ============================================================================

/**
 * Creates a PostCompact hook handler.
 *
 * PostCompact hooks fire after context compaction completes, allowing you to:
 * - Observe the compaction summary and details
 * - Log compaction events
 * - React to the new compacted state
 *
 * **Matcher**: Matches against `trigger` ('manual', 'auto')
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { postCompactHook, postCompactOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default postCompactHook({}, async (input, { logger }) => {
 *   logger.info('Context compaction completed', {
 *     trigger: input.trigger,
 *     summary: input.compact_summary
 *   });
 *   return postCompactOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#postcompact
 */
export function postCompactHook(
  config: HookConfig,
  handler: HookHandler<PostCompactInput, PostCompactOutput>,
): HookFunction<PostCompactInput, PostCompactOutput> {
  return createHookFunction("PostCompact", config, handler);
}

// ============================================================================
// PermissionRequest Hook Factory
// ============================================================================

/**
 * Creates a PermissionRequest hook handler.
 *
 * PermissionRequest hooks fire when a permission prompt would be shown,
 * allowing you to:
 * - Auto-approve or deny tool executions
 * - Implement custom permission logic
 * - Modify tool inputs before approval
 *
 * **Matcher**: Matches against `tool_name`
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
 * // Typed overload: tool_input is automatically typed as FileReadInput
 * export default permissionRequestHook({ matcher: 'Read' }, async (input, { logger }) => {
 *   // input.tool_input.file_path is typed as string - no cast needed!
 *   if (input.tool_input.file_path.startsWith('/allowed/')) {
 *     logger.info('Auto-approving read in allowed directory', { filePath: input.tool_input.file_path });
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
 * // Typed overload: tool_input is automatically typed as BashInput
 * export default permissionRequestHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   // input.tool_input.command is typed as string - no cast needed!
 *   if (input.tool_input.command.includes('sudo')) {
 *     logger.warn('Denying sudo command', { command: input.tool_input.command });
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
export function permissionRequestHook<T extends KnownToolName>(
  config: TypedHookConfig<T>,
  handler: HookHandler<TypedPermissionRequestInput<T>, PermissionRequestOutput>,
): HookFunction<TypedPermissionRequestInput<T>, PermissionRequestOutput>;
export function permissionRequestHook(
  config: HookConfig,
  handler: HookHandler<PermissionRequestInput, PermissionRequestOutput>,
): HookFunction<PermissionRequestInput, PermissionRequestOutput>;
/** @inheritdoc */
export function permissionRequestHook(
  config: HookConfig,
  handler: HookHandler<PermissionRequestInput, PermissionRequestOutput>,
): HookFunction<PermissionRequestInput, PermissionRequestOutput> {
  return createHookFunction("PermissionRequest", config, handler);
}

// ============================================================================
// PermissionDenied Hook Factory
// ============================================================================

/**
 * Creates a PermissionDenied hook handler.
 *
 * PermissionDenied hooks fire when a permission request is denied (either by the
 * user or by a PermissionRequest hook), allowing you to:
 * - Log permission denials for auditing
 * - React to denied tool executions
 * - Optionally request a retry via the output
 *
 * **Matcher**: Matches against `tool_name`
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { permissionDeniedHook, permissionDeniedOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Log all permission denials
 * export default permissionDeniedHook({}, async (input, { logger }) => {
 *   logger.warn('Permission denied', {
 *     toolName: input.tool_name,
 *     reason: input.reason
 *   });
 *   return permissionDeniedOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#permissiondenied
 */
export function permissionDeniedHook(
  config: HookConfig,
  handler: HookHandler<PermissionDeniedInput, PermissionDeniedOutput>,
): HookFunction<PermissionDeniedInput, PermissionDeniedOutput> {
  return createHookFunction("PermissionDenied", config, handler);
}

// ============================================================================
// Setup Hook Factory
// ============================================================================

/**
 * Creates a Setup hook handler.
 *
 * Setup hooks fire during initialization or maintenance, allowing you to:
 * - Configure initial session state
 * - Perform setup tasks before the session starts
 * - Add context for maintenance operations
 *
 * **Matcher**: Matches against `trigger` ('init' or 'maintenance')
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { setupHook, setupOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Handle all setup events
 * export default setupHook({}, async (input, { logger }) => {
 *   logger.info('Setup triggered', { trigger: input.trigger });
 *   return setupOutput({});
 * });
 *
 * // Only handle initialization
 * export default setupHook({ matcher: 'init' }, async (input, { logger }) => {
 *   logger.info('Initializing session');
 *   return setupOutput({
 *     hookSpecificOutput: {
 *       additionalContext: 'Session initialized with custom configuration'
 *     }
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#setup
 */
export function setupHook(
  config: HookConfig,
  handler: HookHandler<SetupInput, SetupOutput>,
): HookFunction<SetupInput, SetupOutput> {
  return createHookFunction("Setup", config, handler);
}

// ============================================================================
// TeammateIdle Hook Factory
// ============================================================================

/**
 * Creates a TeammateIdle hook handler.
 *
 * TeammateIdle hooks fire when a teammate in a team is about to go idle,
 * allowing you to:
 * - Assign work to idle teammates
 * - Log team activity
 * - Coordinate multi-agent workflows
 *
 * **Matcher**: No matcher support - fires on all teammate idle events
 * @param config - Hook configuration with optional timeout (matcher is ignored)
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { teammateIdleHook, teammateIdleOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Log when teammates go idle
 * export default teammateIdleHook({}, async (input, { logger }) => {
 *   logger.info('Teammate going idle', {
 *     teammateName: input.teammate_name,
 *     teamName: input.team_name
 *   });
 *
 *   return teammateIdleOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#teammateidle
 */
export function teammateIdleHook(
  config: HookConfig,
  handler: HookHandler<TeammateIdleInput, TeammateIdleOutput>,
): HookFunction<TeammateIdleInput, TeammateIdleOutput> {
  return createHookFunction("TeammateIdle", config, handler);
}

// ============================================================================
// TaskCreated Hook Factory
// ============================================================================

/**
 * Creates a TaskCreated hook handler.
 *
 * TaskCreated hooks fire when a new task is created and assigned to a teammate,
 * allowing you to:
 * - Observe task creation events
 * - Log task assignments for auditing
 * - React to new work being assigned
 *
 * **Matcher**: No matcher support - fires on all task creation events
 * @param config - Hook configuration with optional timeout (matcher is ignored)
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { taskCreatedHook, taskCreatedOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Log task creation
 * export default taskCreatedHook({}, async (input, { logger }) => {
 *   logger.info('Task created', {
 *     taskId: input.task_id,
 *     taskSubject: input.task_subject
 *   });
 *
 *   return taskCreatedOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#taskcreated
 */
export function taskCreatedHook(
  config: HookConfig,
  handler: HookHandler<TaskCreatedInput, TaskCreatedOutput>,
): HookFunction<TaskCreatedInput, TaskCreatedOutput> {
  return createHookFunction("TaskCreated", config, handler);
}

// ============================================================================
// TaskCompleted Hook Factory
// ============================================================================

/**
 * Creates a TaskCompleted hook handler.
 *
 * TaskCompleted hooks fire when a task is being marked as completed,
 * allowing you to:
 * - Verify task completion
 * - Log task metrics
 * - Trigger follow-up actions
 *
 * **Matcher**: No matcher support - fires on all task completion events
 * @param config - Hook configuration with optional timeout (matcher is ignored)
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { taskCompletedHook, taskCompletedOutput } from '@goodfoot/claude-code-hooks';
 *
 * // Log task completion
 * export default taskCompletedHook({}, async (input, { logger }) => {
 *   logger.info('Task completed', {
 *     taskId: input.task_id,
 *     taskSubject: input.task_subject
 *   });
 *
 *   return taskCompletedOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#taskcompleted
 */
export function taskCompletedHook(
  config: HookConfig,
  handler: HookHandler<TaskCompletedInput, TaskCompletedOutput>,
): HookFunction<TaskCompletedInput, TaskCompletedOutput> {
  return createHookFunction("TaskCompleted", config, handler);
}

// ============================================================================
// Elicitation Hook Factory
// ============================================================================

/**
 * Creates an Elicitation hook handler.
 *
 * Elicitation hooks fire when an MCP server requests user input, allowing you to:
 * - Accept, decline, or cancel elicitation requests programmatically
 * - Provide structured form input or URL-based auth responses
 * - Log or audit elicitation requests
 *
 * **Matcher**: No matcher support - fires on all elicitation events
 * @param config - Hook configuration with optional timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { elicitationHook, elicitationOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default elicitationHook({}, async (input, { logger }) => {
 *   logger.info('Elicitation request', { server: input.mcp_server_name });
 *   return elicitationOutput({
 *     hookSpecificOutput: { action: 'accept', content: { approved: true } }
 *   });
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#elicitation
 */
export function elicitationHook(
  config: HookConfig,
  handler: HookHandler<ElicitationInput, ElicitationOutput>,
): HookFunction<ElicitationInput, ElicitationOutput> {
  return createHookFunction("Elicitation", config, handler);
}

// ============================================================================
// ElicitationResult Hook Factory
// ============================================================================

/**
 * Creates an ElicitationResult hook handler.
 *
 * ElicitationResult hooks fire with the result of an MCP elicitation request,
 * allowing you to:
 * - Observe elicitation outcomes
 * - Modify the result before it is returned to the MCP server
 * - Log elicitation completions
 *
 * **Matcher**: No matcher support - fires on all elicitation result events
 * @param config - Hook configuration with optional timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { elicitationResultHook, elicitationResultOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default elicitationResultHook({}, async (input, { logger }) => {
 *   logger.info('Elicitation result', { action: input.action });
 *   return elicitationResultOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#elicitationresult
 */
export function elicitationResultHook(
  config: HookConfig,
  handler: HookHandler<ElicitationResultInput, ElicitationResultOutput>,
): HookFunction<ElicitationResultInput, ElicitationResultOutput> {
  return createHookFunction("ElicitationResult", config, handler);
}

// ============================================================================
// ConfigChange Hook Factory
// ============================================================================

/**
 * Creates a ConfigChange hook handler.
 *
 * ConfigChange hooks fire when Claude Code configuration changes, allowing you to:
 * - React to settings file changes
 * - Log or audit configuration changes
 * - Apply custom logic when settings are updated
 *
 * **Matcher**: Matches against `source` ('user_settings', 'project_settings', etc.)
 * @param config - Hook configuration with optional matcher and timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { configChangeHook, configChangeOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default configChangeHook({}, async (input, { logger }) => {
 *   logger.info('Config changed', { source: input.source, file: input.file_path });
 *   return configChangeOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#configchange
 */
export function configChangeHook(
  config: HookConfig,
  handler: HookHandler<ConfigChangeInput, ConfigChangeOutput>,
): HookFunction<ConfigChangeInput, ConfigChangeOutput> {
  return createHookFunction("ConfigChange", config, handler);
}

// ============================================================================
// InstructionsLoaded Hook Factory
// ============================================================================

/**
 * Creates an InstructionsLoaded hook handler.
 *
 * InstructionsLoaded hooks fire when a CLAUDE.md or similar instructions file
 * is loaded, allowing you to:
 * - React to instructions being applied
 * - Log which instruction files are active
 * - Observe the instruction loading hierarchy
 *
 * **Matcher**: No matcher support - fires on all instruction load events
 * @param config - Hook configuration with optional timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { instructionsLoadedHook, instructionsLoadedOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default instructionsLoadedHook({}, async (input, { logger }) => {
 *   logger.info('Instructions loaded', { file: input.file_path, type: input.memory_type });
 *   return instructionsLoadedOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#instructionsloaded
 */
export function instructionsLoadedHook(
  config: HookConfig,
  handler: HookHandler<InstructionsLoadedInput, InstructionsLoadedOutput>,
): HookFunction<InstructionsLoadedInput, InstructionsLoadedOutput> {
  return createHookFunction("InstructionsLoaded", config, handler);
}

// ============================================================================
// WorktreeCreate Hook Factory
// ============================================================================

/**
 * Creates a WorktreeCreate hook handler.
 *
 * WorktreeCreate hooks fire when a git worktree is created, allowing you to:
 * - Set up worktree-specific configuration
 * - Log worktree creation events
 * - Initialize worktree resources
 *
 * **Matcher**: No matcher support - fires on all worktree creation events
 * @param config - Hook configuration with optional timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { worktreeCreateHook, worktreeCreateOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default worktreeCreateHook({}, async (input, { logger }) => {
 *   logger.info('Worktree created', { name: input.name });
 *   return worktreeCreateOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#worktreecreate
 */
export function worktreeCreateHook(
  config: HookConfig,
  handler: HookHandler<WorktreeCreateInput, WorktreeCreateOutput>,
): HookFunction<WorktreeCreateInput, WorktreeCreateOutput> {
  return createHookFunction("WorktreeCreate", config, handler);
}

// ============================================================================
// WorktreeRemove Hook Factory
// ============================================================================

/**
 * Creates a WorktreeRemove hook handler.
 *
 * WorktreeRemove hooks fire when a git worktree is removed, allowing you to:
 * - Clean up worktree-specific resources
 * - Log worktree removal events
 *
 * **Matcher**: No matcher support - fires on all worktree removal events
 * @param config - Hook configuration with optional timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { worktreeRemoveHook, worktreeRemoveOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default worktreeRemoveHook({}, async (input, { logger }) => {
 *   logger.info('Worktree removed', { path: input.worktree_path });
 *   return worktreeRemoveOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#worktreeremove
 */
export function worktreeRemoveHook(
  config: HookConfig,
  handler: HookHandler<WorktreeRemoveInput, WorktreeRemoveOutput>,
): HookFunction<WorktreeRemoveInput, WorktreeRemoveOutput> {
  return createHookFunction("WorktreeRemove", config, handler);
}

// ============================================================================
// CwdChanged Hook Factory
// ============================================================================

/**
 * Creates a CwdChanged hook handler.
 *
 * CwdChanged hooks fire when Claude Code's current working directory changes,
 * allowing you to:
 * - React to directory changes within a session
 * - Update file watchers or environment state
 * - Return `watchPaths` via `hookSpecificOutput` to register paths for FileChanged events
 *
 * **Matcher**: No matcher support - fires on all cwd change events
 * @param config - Hook configuration with optional timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { cwdChangedHook, cwdChangedOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default cwdChangedHook({}, async (input, { logger }) => {
 *   logger.info('Working directory changed', { from: input.old_cwd, to: input.new_cwd });
 *   return cwdChangedOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#cwdchanged
 */
export function cwdChangedHook(
  config: HookConfig,
  handler: HookHandler<CwdChangedInput, CwdChangedOutput>,
): HookFunction<CwdChangedInput, CwdChangedOutput> {
  return createHookFunction("CwdChanged", config, handler);
}

// ============================================================================
// FileChanged Hook Factory
// ============================================================================

/**
 * Creates a FileChanged hook handler.
 *
 * FileChanged hooks fire when a watched file changes on disk, allowing you to:
 * - React to file system changes during a session
 * - Invalidate caches or reload configuration
 * - Return `watchPaths` via `hookSpecificOutput` to update the set of watched paths
 *
 * The input `event` field indicates the type of change:
 * - `'change'` - File contents changed
 * - `'add'` - File was created
 * - `'unlink'` - File was deleted
 *
 * **Matcher**: No matcher support - fires on all file change events
 * @param config - Hook configuration with optional timeout
 * @param handler - The handler function to execute
 * @returns A hook function that can be exported as the default export
 * @example
 * ```typescript
 * import { fileChangedHook, fileChangedOutput } from '@goodfoot/claude-code-hooks';
 *
 * export default fileChangedHook({}, async (input, { logger }) => {
 *   logger.info('File changed', { path: input.file_path, event: input.event });
 *   return fileChangedOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#filechanged
 */
export function fileChangedHook(
  config: HookConfig,
  handler: HookHandler<FileChangedInput, FileChangedOutput>,
): HookFunction<FileChangedInput, FileChangedOutput> {
  return createHookFunction("FileChanged", config, handler);
}
