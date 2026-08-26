/**
 * `@goodfoot/agent-hooks/codex` — the Codex agent surface.
 *
 * Re-exports all 10 hook factories, their output builders (reserved fields
 * emitted only when passed), the `BlockError` block signal, input/output
 * types, constants, the advisory allow-list events module, Logger, and the
 * runtime `execute` entry point. No default export.
 * @module
 */

// Logger types
export type { LogEvent, LogEventHandler, LoggerConfig, LogLevel, Unsubscribe } from "../../core/logger.js";
// Logger exports
export { LOG_LEVELS, Logger, logger } from "../../core/logger.js";
// Constants
export {
  DEFAULT_ESBUILD_LOADERS,
  DEFAULT_TIMEOUT_MS,
  EVENTS_WITH_MATCHER,
  EVENTS_WITH_TEXT_OUTPUT,
  HOOK_FACTORY_TO_EVENT,
  PACKAGE_NAME,
} from "./constants.js";
export type {
  AdvisoryEventName,
  AllowedUnexpectedErrorPolicy,
  ExcludedEventName,
  IsExcludedEvent,
} from "./events.js";
// Advisory allow-list events
export { ADVISORY_EVENTS, EXCLUDED_FROM_ADVISORY, HOOK_EVENT_NAMES } from "./events.js";
// Hook factory types (includes the policy vocabulary re-exported from core)
export type {
  HookContext,
  HookFunction,
  MatcherHookConfig,
  MatcherHookConfigFor,
  NoMatcherHookConfig,
  NoMatcherHookConfigFor,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "./hooks.js";
// Hook factory functions - all 10 event types
export {
  permissionRequestHook,
  postCompactHook,
  postToolUseHook,
  preCompactHook,
  preToolUseHook,
  sessionStartHook,
  stopHook,
  subagentStartHook,
  subagentStopHook,
  userPromptSubmitHook,
} from "./hooks.js";

// Output types and builders (BlockError subclasses core HookBlockError)
export {
  BlockError,
  EXIT_CODES,
  type ExitCode,
  type HookOutput,
  type HookSpecificOutput,
  type PermissionRequestBehavior,
  type PermissionRequestDecision,
  type PermissionRequestHookSpecificOutput,
  type PermissionRequestOptions,
  type PermissionRequestOutput,
  type PostCompactOptions,
  type PostCompactOutput,
  type PostToolUseHookSpecificOutput,
  type PostToolUseOptions,
  type PostToolUseOutput,
  type PreCompactOptions,
  type PreCompactOutput,
  type PreToolUseHookSpecificOutput,
  type PreToolUseLegacyBlockOptions,
  type PreToolUseOptions,
  type PreToolUseOutput,
  type PreToolUsePermissionDecision,
  permissionRequestOutput,
  postCompactOutput,
  postToolUseOutput,
  preCompactOutput,
  preToolUseLegacyBlockOutput,
  preToolUseOutput,
  type RawOutput,
  rawOutput,
  type SessionStartHookSpecificOutput,
  type SessionStartOptions,
  type SessionStartOutput,
  type SpecificHookOutput,
  type StopOptions,
  type StopOutput,
  type SubagentStartHookSpecificOutput,
  type SubagentStartOptions,
  type SubagentStartOutput,
  type SubagentStopOptions,
  type SubagentStopOutput,
  type SyncHookJSONOutput,
  sessionStartOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  type UserPromptSubmitHookSpecificOutput,
  type UserPromptSubmitOptions,
  type UserPromptSubmitOutput,
  userPromptSubmitOutput,
} from "./outputs.js";

// Runtime exports - execute function and wire conversion
export { convertToHookOutput, createCodexTransport, execute } from "./transport.js";

// Input types - wire format matching the Codex protocol
export type {
  BaseHookInput,
  HookErrorPhase,
  HookEventName,
  HookInput,
  PermissionMode,
  PermissionRequestInput,
  PostCompactInput,
  PostToolUseInput,
  PreCompactInput,
  PreCompactTrigger,
  PreToolUseInput,
  SessionStartInput,
  SessionStartSource,
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  UserPromptSubmitInput,
} from "./types.js";
