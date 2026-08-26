/**
 * Antigravity wire types (plan step 5, item-6 descope: typed factories +
 * output builders + conformance matrix only — no `CONTRACT.md` pin, no
 * published protocol doc exists for this release). Shapes below are the
 * minimal surface the plan names for the five shipped events
 * (`PreToolUse`/`PostToolUse`/`PreInvocation`/`PostInvocation`/`Stop`),
 * derived structurally from Claude Code's and Codex's `types.ts` rather than
 * from any Antigravity-specific reference — there is none to cite yet.
 * @module
 */

export type HookEventName = "PreToolUse" | "PostToolUse" | "PreInvocation" | "PostInvocation" | "Stop";

export interface BaseHookInput {
  cwd: string;
  hook_event_name: HookEventName;
  session_id: string;
}

export interface PreToolUseInput extends BaseHookInput {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: unknown;
}

export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
}

export interface PreInvocationInput extends BaseHookInput {
  hook_event_name: "PreInvocation";
  prompt: string;
}

export interface PostInvocationInput extends BaseHookInput {
  hook_event_name: "PostInvocation";
  response: string | null;
}

export interface StopInput extends BaseHookInput {
  hook_event_name: "Stop";
  last_assistant_message: string | null;
}

export type HookInput = PreToolUseInput | PostToolUseInput | PreInvocationInput | PostInvocationInput | StopInput;

/**
 * "error" (default) surfaces an unexpected runtime failure through the
 * transport's stderr diagnostic channel (see `transport.ts` — Antigravity has
 * no exit-code channel at all, so this never changes the process exit code).
 *
 * "continue" would swallow an unexpected failure into the event's empty
 * response. No event currently accepts it: {@link EXCLUDED_FROM_ADVISORY | the
 * advisory allow-list} in `events.ts` defaults to every event until a future
 * `CONTRACT.md` names an enrichment hook safe to opt in.
 */
export type UnexpectedErrorPolicy = "error" | "continue";

/** The runtime phase in which an unexpected error occurred. */
export type HookErrorPhase = "read" | "parse" | "handler" | "serialize" | "write" | "cleanup";

/**
 * Best-effort diagnostic sink for unexpected errors under the "continue"
 * policy. Errors thrown by this handler are swallowed.
 */
export type UnexpectedErrorHandler = (error: unknown, phase: HookErrorPhase) => void;
