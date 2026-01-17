/**
 * Type-safe Claude Code hooks library.
 *
 * Provides typed input/output handling, output builders, and logging system
 * for building Claude Code hooks with full type safety.
 * @module
 */
export type {
  BaseHookInput,
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
  HookInput,
  HookEventName,
  PermissionMode,
  SessionStartSource,
  SessionEndReason,
  PreCompactTrigger,
  PermissionUpdate
} from './inputs.js';
export { HOOK_EVENT_NAMES } from './inputs.js';
export type {
  HookOutput,
  SyncHookJSONOutput,
  ExitCode,
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
export {
  EXIT_CODES,
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
export type { LogLevel, LogEvent, LogEventError, LogEventHandler, Unsubscribe, LoggerConfig } from './logger.js';
export { LOG_LEVELS, Logger, logger } from './logger.js';
export type {
  HookConfig,
  HookContext,
  HookHandler,
  HookFunction,
  SessionStartContext,
  TypedHookConfig,
  TypedPreToolUseInput,
  TypedPostToolUseInput,
  TypedPostToolUseFailureInput,
  TypedPermissionRequestInput
} from './hooks.js';
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
export { execute } from './runtime.js';
export { CLAUDE_ENV_VARS, getProjectDir, getEnvFilePath, isRemoteEnvironment } from './env.js';
export type {
  WriteToolInput,
  EditToolInput,
  MultiEditEntry,
  MultiEditToolInput,
  ReadToolInput,
  BashToolInput,
  GlobToolInput,
  GrepToolInput,
  FileModifyingToolInput,
  FileModifyingToolName,
  KnownToolInput,
  KnownToolName,
  ToolInputMap
} from './tool-inputs.js';
export type { ToolUseInput, PatternCheckResult, ContentContext } from './tool-helpers.js';
export {
  isWriteTool,
  isEditTool,
  isMultiEditTool,
  isFileModifyingTool,
  isReadTool,
  isBashTool,
  isGlobTool,
  isGrepTool,
  getFilePath,
  isJsTsFile,
  isTsFile,
  checkContentForPattern,
  forEachContent
} from './tool-helpers.js';
