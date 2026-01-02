/**
 * Type-safe Claude Code hooks library.
 *
 * Provides camelCase types, output builders, logging system, and OpenTelemetry support
 * for building Claude Code hooks with full type safety.
 * @module
 */

// Re-exports will be added as modules are implemented:
// - Hook factories (preToolUseHook, sessionStartHook, etc.)
// - Output builders (preToolUseOutput, sessionStartOutput, etc.)
// - Logger and types

// Input types - CamelCase transformed from SDK snake_case
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
  PreCompactTrigger,
  PermissionUpdate
} from './types/inputs.js';

// Hook event names constant
export { HOOK_EVENT_NAMES } from './types/inputs.js';

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

// Telemetry types
export type { TelemetryConfig, MetricAttributes } from './telemetry.js';

// Telemetry exports
export {
  // Initialization and shutdown
  initializeTelemetry,
  shutdownTelemetry,
  // Metric recording
  recordInvocation,
  recordDuration,
  recordError,
  recordExitCode,
  // Log event emission
  emitLogEvent,
  emitHookStart,
  emitHookEnd,
  emitHandlerError,
  // Logger integration
  createTelemetryEmitter,
  wireLoggerTelemetry,
  // Status checks
  isTelemetryInitialized,
  isTelemetryEnabledCheck,
  // Constants
  METRIC_NAMES
} from './telemetry.js';
