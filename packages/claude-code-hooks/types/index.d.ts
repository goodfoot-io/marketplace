/**
 * Type-safe Claude Code hooks library.
 *
 * Provides camelCase types, output builders, and logging system
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
export type { HookConfig, HookContext, HookHandler, HookFunction, SessionStartContext } from './hooks.js';
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
export { execute, snakeToCamelCase, camelToSnakeCase } from './runtime.js';
export { CLAUDE_ENV_VARS, getProjectDir, getEnvFilePath, isRemoteEnvironment } from './env.js';
