/** @goodfoot/agent-hooks/cursor: Cursor-native factories, outputs, and wire types. */

export type { AdvisoryEventName, AllowedUnexpectedErrorPolicy, ExcludedEventName, IsExcludedEvent } from "./events.js";
export { ADVISORY_EVENTS, EVENTS_WITH_MATCHER, EXCLUDED_FROM_ADVISORY, HOOK_EVENT_NAMES } from "./events.js";
export type {
  HookConfig,
  HookConfigFor,
  HookContext,
  HookFunction,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "./hooks.js";
export {
  beforeSubmitPromptHook,
  postToolUseHook,
  preToolUseHook,
  sessionStartHook,
  stopHook,
  subagentStopHook,
} from "./hooks.js";
export type {
  BeforeSubmitPromptOptions,
  BeforeSubmitPromptOutput,
  BeforeSubmitPromptStdout,
  CursorHookOutput,
  CursorPermission,
  ExitCode,
  HookOutput,
  OutputByEvent,
  PostToolUseOptions,
  PostToolUseOutput,
  PostToolUseStdout,
  PreToolUseOptions,
  PreToolUseOutput,
  PreToolUseStdout,
  SessionStartOptions,
  SessionStartOutput,
  SessionStartStdout,
  SpecificHookOutput,
  StopOptions,
  StopOutput,
  StopStdout,
  SubagentStopOptions,
  SubagentStopOutput,
  SubagentStopStdout,
} from "./outputs.js";
export {
  beforeSubmitPromptOutput,
  CursorBlockError,
  EXIT_CODES,
  postToolUseOutput,
  preToolUseOutput,
  sessionStartOutput,
  stopOutput,
  subagentStopOutput,
} from "./outputs.js";
export { createCursorTransport, execute } from "./transport.js";
export type {
  BaseHookInput,
  BeforeSubmitPromptInput,
  HookErrorPhase,
  HookEventName,
  HookInput,
  InputByEvent,
  PostToolUseInput,
  PreToolUseInput,
  SessionStartInput,
  StopInput,
  SubagentStopInput,
} from "./types.js";
