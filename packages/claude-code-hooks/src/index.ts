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
