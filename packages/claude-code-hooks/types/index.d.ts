/**
 * Type-safe Claude Code hooks library.
 *
 * Provides typed input/output handling, output builders, and logging system
 * for building Claude Code hooks with full type safety.
 * @module
 */
export type * from "@anthropic-ai/claude-agent-sdk/sdk-tools.js";
export { CLAUDE_ENV_VARS, getEnvFilePath, getProjectDir, isRemoteEnvironment, } from "./env.js";
export type { HookConfig, HookContext, HookFunction, HookHandler, SessionStartContext, TypedHookConfig, TypedPermissionRequestInput, TypedPostToolUseFailureInput, TypedPostToolUseInput, TypedPreToolUseInput, } from "./hooks.js";
export { notificationHook, permissionRequestHook, postToolUseFailureHook, postToolUseHook, preCompactHook, preToolUseHook, sessionEndHook, sessionStartHook, stopHook, subagentStartHook, subagentStopHook, userPromptSubmitHook, } from "./hooks.js";
export type { LogEvent, LogEventError, LogEventHandler, LoggerConfig, LogLevel, Unsubscribe } from "./logger.js";
export { LOG_LEVELS, Logger, logger } from "./logger.js";
export type { 
/** @deprecated Use CommonOptions instead */
BaseOptions, CommonOptions, ExitCode, HookOutput, HookSpecificOutput, NotificationOptions, PermissionRequestAllowDecision, PermissionRequestDecision, PermissionRequestDenyDecision, PermissionRequestHookSpecificOutput, PermissionRequestOptions, PostToolUseFailureHookSpecificOutput, PostToolUseFailureOptions, PostToolUseHookSpecificOutput, PostToolUseOptions, PreCompactOptions, PreToolUseHookSpecificOutput, PreToolUseOptions, SessionEndOptions, SessionStartHookSpecificOutput, SessionStartOptions, StopOptions, SubagentStartHookSpecificOutput, SubagentStartOptions, SubagentStopOptions, SyncHookJSONOutput, UserPromptSubmitHookSpecificOutput, UserPromptSubmitOptions, } from "./outputs.js";
export { EXIT_CODES, notificationOutput, permissionRequestOutput, postToolUseFailureOutput, postToolUseOutput, preCompactOutput, preToolUseOutput, sessionEndOutput, sessionStartOutput, stopOutput, subagentStartOutput, subagentStopOutput, userPromptSubmitOutput, } from "./outputs.js";
export { execute, } from "./runtime.js";
export type { ContentContext, PatternCheckResult, ToolUseInput } from "./tool-helpers.js";
export { checkContentForPattern, forEachContent, getFilePath, isAskUserQuestionTool, isBashTool, isEditTool, isExitPlanModeTool, isFileModifyingTool, isGlobTool, isGrepTool, isJsTsFile, isKillShellTool, isMultiEditTool, isNotebookEditTool, isReadTool, isTaskOutputTool, isTaskTool, isTodoWriteTool, isTsFile, isWebFetchTool, isWebSearchTool, isWriteTool, } from "./tool-helpers.js";
export type { BaseHookInput, FileModifyingToolInput, FileModifyingToolName, HookEventName, HookInput, KnownToolInput, KnownToolName, MultiEditEntry, MultiEditToolInput, NotificationInput, PermissionMode, PermissionRequestInput, PermissionUpdate, PostToolUseFailureInput, PostToolUseInput, PreCompactInput, PreCompactTrigger, PreToolUseInput, SessionEndInput, SessionEndReason, SessionStartInput, SessionStartSource, StopInput, SubagentStartInput, SubagentStopInput, ToolInputMap, UserPromptSubmitInput, } from "./types.js";
export { HOOK_EVENT_NAMES } from "./types.js";
