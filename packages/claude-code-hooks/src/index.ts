/**
 * Type-safe Claude Code hooks library.
 *
 * Provides typed input/output handling, output builders, and logging system
 * for building Claude Code hooks with full type safety.
 * @module
 */

// Re-exports will be added as modules are implemented:
// - Hook factories (preToolUseHook, sessionStartHook, etc.)
// - Output builders (preToolUseOutput, sessionStartOutput, etc.)
// - Logger and types

// Input types - Wire format (snake_case) matching the Claude Code protocol
export type {
  // Base type
  BaseHookInput,
  // Individual hook input types
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
  // Discriminated union
  HookInput,
  // Supporting types
  HookEventName,
  PermissionMode,
  SessionStartSource,
  SessionEndReason,
  PreCompactTrigger,
  PermissionUpdate
} from './inputs.js';

// Hook event names constant
export { HOOK_EVENT_NAMES } from './inputs.js';

// Output types and builders
export type {
  // Core output types
  HookOutput,
  SyncHookJSONOutput,
  ExitCode,
  // Hook-specific output types
  HookSpecificOutput,
  PreToolUseHookSpecificOutput,
  PostToolUseHookSpecificOutput,
  PostToolUseFailureHookSpecificOutput,
  UserPromptSubmitHookSpecificOutput,
  SessionStartHookSpecificOutput,
  SubagentStartHookSpecificOutput,
  PermissionRequestHookSpecificOutput,
  PermissionRequestDecision,
  PermissionRequestAllowDecision,
  PermissionRequestDenyDecision,
  // Options types for output builders
  CommonOptions,
  /** @deprecated Use CommonOptions instead */
  BaseOptions,
  PreToolUseOptions,
  PostToolUseOptions,
  PostToolUseFailureOptions,
  UserPromptSubmitOptions,
  SessionStartOptions,
  SessionEndOptions,
  StopOptions,
  SubagentStartOptions,
  SubagentStopOptions,
  NotificationOptions,
  PreCompactOptions,
  PermissionRequestOptions
} from './outputs.js';

// Output builder functions
export {
  // Exit codes
  EXIT_CODES,
  // All 12 output builder functions
  preToolUseOutput,
  postToolUseOutput,
  postToolUseFailureOutput,
  userPromptSubmitOutput,
  sessionStartOutput,
  sessionEndOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  notificationOutput,
  preCompactOutput,
  permissionRequestOutput
} from './outputs.js';

// Logger types
export type { LogLevel, LogEvent, LogEventError, LogEventHandler, Unsubscribe, LoggerConfig } from './logger.js';

// Logger exports
export { LOG_LEVELS, Logger, logger } from './logger.js';

// Hook factory types
export type {
  HookConfig,
  HookContext,
  HookHandler,
  HookFunction,
  SessionStartContext,
  // Typed hook config and input types for single-tool matchers
  TypedHookConfig,
  TypedPreToolUseInput,
  TypedPostToolUseInput,
  TypedPostToolUseFailureInput,
  TypedPermissionRequestInput
} from './hooks.js';

// Hook factory functions - all 12 hook types
export {
  preToolUseHook,
  postToolUseHook,
  postToolUseFailureHook,
  notificationHook,
  userPromptSubmitHook,
  sessionStartHook,
  sessionEndHook,
  stopHook,
  subagentStartHook,
  subagentStopHook,
  preCompactHook,
  permissionRequestHook
} from './hooks.js';

// Runtime exports - execute function
export {
  // Main execute function for compiled hooks
  execute
} from './runtime.js';

// Environment variable utilities
export {
  // Environment variable name constants
  CLAUDE_ENV_VARS,
  // Getters
  getProjectDir,
  getEnvFilePath,
  isRemoteEnvironment
} from './env.js';

// Tool input types - Well-known tool input structures
export type {
  // File operation tools
  WriteToolInput,
  EditToolInput,
  MultiEditEntry,
  MultiEditToolInput,
  ReadToolInput,
  // Command tools
  BashToolInput,
  // Search tools
  GlobToolInput,
  GrepToolInput,
  // Union types
  FileModifyingToolInput,
  FileModifyingToolName,
  KnownToolInput,
  KnownToolName,
  ToolInputMap
} from './tool-inputs.js';

// Tool helper types
export type { ToolUseInput, PatternCheckResult, ContentContext } from './tool-helpers.js';

// Tool helper functions - Type guards and utilities
export {
  // Type guards
  isWriteTool,
  isEditTool,
  isMultiEditTool,
  isFileModifyingTool,
  isReadTool,
  isBashTool,
  isGlobTool,
  isGrepTool,
  // File path utilities
  getFilePath,
  isJsTsFile,
  isTsFile,
  // Content inspection
  checkContentForPattern,
  forEachContent
} from './tool-helpers.js';
