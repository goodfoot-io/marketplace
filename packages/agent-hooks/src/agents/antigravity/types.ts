/**
 * Antigravity wire types, transcribed from the host's own hook reference.
 *
 * Source of record: `assets/external/skills/agy-customizations/docs/hooks.md`,
 * embedded in the `agy` binary and pinned verbatim in this directory's
 * `CONTRACT.md`. Nothing here is derived by analogy from Claude Code or
 * Codex — the three agents' payloads share no field.
 *
 * Two properties of this contract drive every shape below:
 *
 * 1. **All keys are camelCase** (protojson encoding), including `stepIdx` and
 *    `conversationId`.
 * 2. **No payload carries its own event name.** Claude Code's
 *    `hook_event_name` and Codex's equivalent have no counterpart here; a
 *    handler knows its event only from the factory it was built with.
 * @module
 */

export type HookEventName = "PreToolUse" | "PostToolUse" | "PreInvocation" | "PostInvocation" | "Stop";

/**
 * System metadata present on every payload.
 *
 * `transcriptPath` and `artifactDirectoryPath` name a product-specific
 * directory (`antigravity/`, `antigravity-cli/`, or `antigravity-ide/`
 * depending on the interface), so neither may be pattern-matched.
 */
export interface BaseHookInput {
  conversationId: string;
  workspacePaths: string[];
  transcriptPath: string;
  artifactDirectoryPath: string;
  modelName: string;
}

/**
 * A tool call as the host presents it. `name` is the step type lowercased with
 * the `CORTEX_STEP_TYPE_` prefix removed — the same string a `matcher` regex
 * is tested against.
 */
export interface AntigravityToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface PreToolUseInput extends BaseHookInput {
  toolCall: AntigravityToolCall;
  stepIdx: number;
}

/** `error` is present only when the tool failed (e.g. `"exit status 1"`). */
export interface PostToolUseInput extends BaseHookInput {
  stepIdx: number;
  error?: string;
}

export interface PreInvocationInput extends BaseHookInput {
  invocationNum: number;
  initialNumSteps: number;
}

/** Identical to {@link PreInvocationInput}; the host sends the same payload. */
export interface PostInvocationInput extends BaseHookInput {
  invocationNum: number;
  initialNumSteps: number;
}

/** `terminationReason` is an open string — `"model_stop"`, `"max_steps_exceeded"`, `"error"`, and others. */
export interface StopInput extends BaseHookInput {
  executionNum: number;
  terminationReason: string;
  error?: string;
  fullyIdle: boolean;
}

export type HookInput = PreToolUseInput | PostToolUseInput | PreInvocationInput | PostInvocationInput | StopInput;

/**
 * "error" (default) surfaces an unexpected runtime failure through the
 * transport's stderr diagnostic channel (see `transport.ts` — Antigravity has
 * no exit-code channel at all, so this never changes the process exit code).
 *
 * "continue" would swallow an unexpected failure into the event's empty
 * response. No event accepts it: {@link EXCLUDED_FROM_ADVISORY | the advisory
 * allow-list} in `events.ts` excludes every event, because the host's
 * reference names no event as safe to fail open.
 */
export type UnexpectedErrorPolicy = "error" | "continue";

/** The runtime phase in which an unexpected error occurred. */
export type HookErrorPhase = "read" | "parse" | "handler" | "serialize" | "write" | "cleanup";

/**
 * Best-effort diagnostic sink for unexpected errors under the "continue"
 * policy. Errors thrown by this handler are swallowed.
 */
export type UnexpectedErrorHandler = (error: unknown, phase: HookErrorPhase) => void;
