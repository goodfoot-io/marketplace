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

// Re-export all SDK tool input types (via types.ts)
// Uses `export type *` because sdk-tools.d.ts has no JavaScript runtime counterpart.
export type * from "@anthropic-ai/claude-agent-sdk/sdk-tools.js";
// Environment variable utilities
export {
  // Environment variable name constants
  CLAUDE_ENV_VARS,
  getEnvFilePath,
  // Getters
  getProjectDir,
  isRemoteEnvironment,
} from "./env.js";
// Hook factory types
export type {
  HookConfig,
  HookContext,
  HookFunction,
  HookHandler,
  SessionStartContext,
  // Typed hook config and input types for single-tool matchers
  TypedHookConfig,
  TypedPermissionRequestInput,
  TypedPostToolUseFailureHookInput,
  TypedPostToolUseHookInput,
  TypedPreToolUseHookInput,
} from "./hooks.js";
// Hook factory functions - all 26 hook types
export {
  configChangeHook,
  cwdChangedHook,
  elicitationHook,
  elicitationResultHook,
  fileChangedHook,
  instructionsLoadedHook,
  notificationHook,
  permissionDeniedHook,
  permissionRequestHook,
  postCompactHook,
  postToolUseFailureHook,
  postToolUseHook,
  preCompactHook,
  preToolUseHook,
  sessionEndHook,
  sessionStartHook,
  setupHook,
  stopFailureHook,
  stopHook,
  subagentStartHook,
  subagentStopHook,
  taskCompletedHook,
  taskCreatedHook,
  teammateIdleHook,
  userPromptExpansionHook,
  userPromptSubmitHook,
  worktreeCreateHook,
  worktreeRemoveHook,
} from "./hooks.js";

// Logger types
export type { LogEvent, LogEventError, LogEventHandler, LoggerConfig, LogLevel, Unsubscribe } from "./logger.js";

// Logger exports
export { LOG_LEVELS, Logger, logger } from "./logger.js";
// Output types and builders
export type {
  /** @deprecated Use CommonOptions instead */
  BaseOptions,
  // Options types for output builders
  CommonOptions,
  ConfigChangeOptions,
  CwdChangedHookSpecificOutput,
  CwdChangedOptions,
  ElicitationHookSpecificOutput,
  ElicitationOptions,
  ElicitationResultHookSpecificOutput,
  ElicitationResultOptions,
  ExitCode,
  ExitCodeOptions,
  FileChangedHookSpecificOutput,
  FileChangedOptions,
  // Core output types
  HookOutput,
  // Hook-specific output types
  HookSpecificOutput,
  InstructionsLoadedOptions,
  NotificationHookSpecificOutput,
  NotificationOptions,
  PermissionDeniedHookSpecificOutput,
  PermissionDeniedOptions,
  PermissionRequestAllowDecision,
  PermissionRequestDecision,
  PermissionRequestDenyDecision,
  PermissionRequestHookSpecificOutput,
  PermissionRequestOptions,
  PostCompactOptions,
  PostToolUseFailureHookSpecificOutput,
  PostToolUseFailureOptions,
  PostToolUseHookSpecificOutput,
  PostToolUseOptions,
  PreCompactOptions,
  PreToolUseHookSpecificOutput,
  PreToolUseOptions,
  SessionEndOptions,
  SessionStartHookSpecificOutput,
  SessionStartOptions,
  SetupHookSpecificOutput,
  SetupOptions,
  StopFailureOptions,
  StopOptions,
  SubagentStartHookSpecificOutput,
  SubagentStartOptions,
  SubagentStopOptions,
  SyncHookJSONOutput,
  TaskCompletedOptions,
  TaskCreatedOptions,
  TeammateIdleOptions,
  UserPromptExpansionHookSpecificOutput,
  UserPromptExpansionOptions,
  UserPromptSubmitHookSpecificOutput,
  UserPromptSubmitOptions,
  WorktreeCreateOptions,
  WorktreeRemoveOptions,
} from "./outputs.js";
// Output builder functions
export {
  configChangeOutput,
  cwdChangedOutput,
  // Exit codes
  EXIT_CODES,
  elicitationOutput,
  elicitationResultOutput,
  fileChangedOutput,
  instructionsLoadedOutput,
  notificationOutput,
  permissionDeniedOutput,
  permissionRequestOutput,
  postCompactOutput,
  postToolUseFailureOutput,
  postToolUseOutput,
  preCompactOutput,
  // All 26 output builder functions
  preToolUseOutput,
  sessionEndOutput,
  sessionStartOutput,
  setupOutput,
  stopFailureOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  taskCompletedOutput,
  taskCreatedOutput,
  teammateIdleOutput,
  userPromptExpansionOutput,
  userPromptSubmitOutput,
  worktreeCreateOutput,
  worktreeRemoveOutput,
} from "./outputs.js";

// Runtime exports - execute function
export {
  // Main execute function for compiled hooks
  execute,
} from "./runtime.js";
// Tool helper types
export type { ContentContext, PatternCheckResult, ToolUseInput } from "./tool-helpers.js";
// Tool helper functions - Type guards and utilities
export {
  // Content inspection
  checkContentForPattern,
  forEachContent,
  // File path utilities
  getFilePath,
  // Type guards - User interaction
  isAskUserQuestionTool,
  // Type guards - Commands
  isBashTool,
  // Type guards - Config
  isConfigTool,
  isEditTool,
  isExitPlanModeTool,
  isFileModifyingTool,
  // Type guards - Search
  isGlobTool,
  isGrepTool,
  isJsTsFile,
  isKillShellTool,
  // Type guards - MCP
  isListMcpResourcesTool,
  isMcpTool,
  isMultiEditTool,
  isNotebookEditTool,
  isReadMcpResourceTool,
  isReadTool,
  isTaskOutputTool,
  // Type guards - Agents
  isTaskTool,
  isTodoWriteTool,
  isTsFile,
  // Type guards - Web
  isWebFetchTool,
  isWebSearchTool,
  // Type guards - File operations
  isWriteTool,
} from "./tool-helpers.js";
// Input types - Wire format (snake_case) matching the Claude Code protocol
export type {
  // Base type
  BaseHookInput,
  ConfigChangeInput,
  ConfigInput,
  CwdChangedInput,
  ElicitationInput,
  ElicitationResultInput,
  FileChangedInput,
  FileModifyingToolInput,
  FileModifyingToolName,
  // Supporting types
  HookEventName,
  // Discriminated union
  HookInput,
  InstructionsLoadedInput,
  KnownToolInput,
  KnownToolName,
  ListMcpResourcesInput,
  McpInput,
  // Tool input types
  MultiEditEntry,
  MultiEditToolInput,
  // Hook input types (with expanded hover tooltips)
  NotificationInput,
  PermissionDeniedInput,
  PermissionMode,
  PermissionRequestInput,
  PermissionUpdate,
  PostCompactInput,
  PostToolUseFailureInput,
  PostToolUseInput,
  PreCompactInput,
  PreCompactTrigger,
  PreToolUseInput,
  ReadMcpResourceInput,
  SessionEndInput,
  SessionEndReason,
  SessionStartInput,
  SessionStartSource,
  SetupInput,
  SetupTrigger,
  StopFailureInput,
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  TaskCompletedInput,
  TaskCreatedInput,
  TeammateIdleInput,
  ToolInputMap,
  UserPromptExpansionInput,
  UserPromptSubmitInput,
  WorktreeCreateInput,
  WorktreeRemoveInput,
} from "./types.js";
// Hook event names constant
export { HOOK_EVENT_NAMES } from "./types.js";
