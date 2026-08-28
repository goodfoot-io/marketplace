/**
 * `@goodfoot/agent-hooks/antigravity` — the Antigravity agent surface.
 *
 * Re-exports the five hook factories, their per-event output builders, the
 * `AntigravityBlockError` block signal, the wire input/output types, and the
 * runtime `execute` entry point. No default export.
 *
 * Every shape here is transcribed from `CONTRACT.md` in this directory, which
 * pins the host's own hook reference. Two consequences shape the whole
 * surface: keys are camelCase, and each event has a **different** stdout
 * shape rather than one shared envelope.
 * @module
 */

export type {
  AdvisoryEventName,
  AllowedUnexpectedErrorPolicy,
  ExcludedEventName,
  IsExcludedEvent,
} from "./events.js";
export { ADVISORY_EVENTS, EVENTS_WITH_MATCHER, EXCLUDED_FROM_ADVISORY, HOOK_EVENT_NAMES } from "./events.js";
export type {
  HookConfig,
  HookConfigFor,
  HookContext,
  HookFunction,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "./hooks.js";
export { postInvocationHook, postToolUseHook, preInvocationHook, preToolUseHook, stopHook } from "./hooks.js";

export {
  AntigravityBlockError,
  type AntigravityDecision,
  type AntigravityHookOutput,
  EXIT_CODES,
  type ExitCode,
  type HookOutput,
  type InjectStep,
  type PostInvocationOptions,
  type PostInvocationOutput,
  type PostInvocationStdout,
  type PostToolUseOutput,
  type PostToolUseStdout,
  type PreInvocationOptions,
  type PreInvocationOutput,
  type PreInvocationStdout,
  type PreToolUseOptions,
  type PreToolUseOutput,
  type PreToolUseStdout,
  postInvocationOutput,
  postToolUseOutput,
  preInvocationOutput,
  preToolUseOutput,
  type SpecificHookOutput,
  type StopDecision,
  type StopOptions,
  type StopOutput,
  type StopStdout,
  stopOutput,
  type TerminationBehavior,
} from "./outputs.js";

export { createAntigravityTransport, execute } from "./transport.js";

export type {
  AntigravityToolCall,
  BaseHookInput,
  HookErrorPhase,
  HookEventName,
  HookInput,
  PostInvocationInput,
  PostToolUseInput,
  PreInvocationInput,
  PreToolUseInput,
  StopInput,
} from "./types.js";
