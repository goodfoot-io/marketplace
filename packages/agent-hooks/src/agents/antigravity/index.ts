/**
 * `@goodfoot/agent-hooks/antigravity` — the Antigravity agent surface.
 *
 * **Not yet published as a package subpath.** Step 5 ships under its item-6
 * descope (Step 0 concluded "not runnable / unknown" for the real
 * `antigravity` CLI in this release's environment): typed factories, output
 * builders, and a conformance matrix only. `packages/agent-hooks/package.json`
 * deliberately does not add a `./antigravity` `exports` entry this release —
 * see `tests/export-surface.test.ts`, which asserts the exports map stays
 * closed at `.`/`./claude-code`/`./codex`. This module exists for in-repo
 * testing (the conformance matrix imports it directly by relative path) and
 * for the follow-up card that resolves the CLI-availability question to
 * build on without re-deriving the surface from scratch.
 *
 * Re-exports the 5 hook factories, their output builders (reserved fields
 * emitted only when passed), the `AntigravityBlockError` block signal,
 * input/output types, and the runtime `execute` entry point. No default
 * export.
 * @module
 */

export type {
  AdvisoryEventName,
  AllowedUnexpectedErrorPolicy,
  ExcludedEventName,
  IsExcludedEvent,
} from "./events.js";
// Advisory allow-list events
export { ADVISORY_EVENTS, EVENTS_WITH_MATCHER, EXCLUDED_FROM_ADVISORY, HOOK_EVENT_NAMES } from "./events.js";
// Hook factory types (includes the policy vocabulary re-exported from core)
export type {
  HookConfig,
  HookConfigFor,
  HookContext,
  HookFunction,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "./hooks.js";
// Hook factory functions - all 5 event types
export { postInvocationHook, postToolUseHook, preInvocationHook, preToolUseHook, stopHook } from "./hooks.js";

// Output types and builders (AntigravityBlockError subclasses core HookBlockError)
export {
  AntigravityBlockError,
  type AntigravityDecision,
  type AntigravityHookOutput,
  type AntigravityPostDecision,
  EXIT_CODES,
  type ExitCode,
  type HookOutput,
  type PostInvocationOptions,
  type PostInvocationOutput,
  type PostToolUseOptions,
  type PostToolUseOutput,
  type PreInvocationOptions,
  type PreInvocationOutput,
  type PreToolUseOptions,
  type PreToolUseOutput,
  postInvocationOutput,
  postToolUseOutput,
  preInvocationOutput,
  preToolUseOutput,
  type SpecificHookOutput,
  type StopOptions,
  type StopOutput,
  stopOutput,
} from "./outputs.js";

// Runtime exports - execute function and transport factory
export { createAntigravityTransport, execute } from "./transport.js";

// Input types - wire format
export type {
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
