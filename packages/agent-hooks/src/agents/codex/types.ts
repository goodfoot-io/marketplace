export type HookEventName =
  | "PreToolUse"
  | "PostToolUse"
  | "PermissionRequest"
  | "UserPromptSubmit"
  | "SessionStart"
  | "SubagentStart"
  | "Stop"
  | "SubagentStop"
  | "PreCompact"
  | "PostCompact";

export type PermissionMode = "default" | "acceptEdits" | "plan" | "dontAsk" | "bypassPermissions";
export type SessionStartSource = "startup" | "resume" | "clear" | "compact";
export type PreCompactTrigger = "manual" | "auto";

export interface BaseHookInput {
  cwd: string;
  hook_event_name: HookEventName;
  model: string;
  session_id: string;
  transcript_path: string | null;
}

export interface PreToolUseInput extends BaseHookInput {
  hook_event_name: "PreToolUse";
  permission_mode: PermissionMode;
  tool_input: unknown;
  tool_name: string;
  tool_use_id: string;
  turn_id: string;
  agent_id?: string;
  agent_type?: string;
}

export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: "PostToolUse";
  permission_mode: PermissionMode;
  tool_input: unknown;
  tool_name: string;
  tool_response: unknown;
  tool_use_id: string;
  turn_id: string;
  agent_id?: string;
  agent_type?: string;
}

export interface PermissionRequestInput extends BaseHookInput {
  hook_event_name: "PermissionRequest";
  permission_mode: PermissionMode;
  tool_input: unknown;
  tool_name: string;
  turn_id: string;
  agent_id?: string;
  agent_type?: string;
}

export interface UserPromptSubmitInput extends BaseHookInput {
  hook_event_name: "UserPromptSubmit";
  permission_mode: PermissionMode;
  prompt: string;
  turn_id: string;
  agent_id?: string;
  agent_type?: string;
}

export interface SessionStartInput extends BaseHookInput {
  hook_event_name: "SessionStart";
  permission_mode: PermissionMode;
  source: SessionStartSource;
}

export interface SubagentStartInput extends BaseHookInput {
  hook_event_name: "SubagentStart";
  permission_mode: PermissionMode;
  agent_id: string;
  agent_type: string;
  turn_id: string;
}

export interface StopInput extends BaseHookInput {
  hook_event_name: "Stop";
  permission_mode: PermissionMode;
  last_assistant_message: string | null;
  stop_hook_active: boolean;
  turn_id: string;
}

export interface SubagentStopInput extends BaseHookInput {
  hook_event_name: "SubagentStop";
  permission_mode: PermissionMode;
  agent_id: string;
  agent_transcript_path: string | null;
  agent_type: string;
  last_assistant_message: string | null;
  stop_hook_active: boolean;
  turn_id: string;
}

export interface PreCompactInput extends BaseHookInput {
  hook_event_name: "PreCompact";
  trigger: PreCompactTrigger;
  turn_id: string;
  agent_id?: string;
  agent_type?: string;
}

export interface PostCompactInput extends BaseHookInput {
  hook_event_name: "PostCompact";
  trigger: PreCompactTrigger;
  turn_id: string;
  agent_id?: string;
  agent_type?: string;
}

export type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | PermissionRequestInput
  | UserPromptSubmitInput
  | SessionStartInput
  | SubagentStartInput
  | StopInput
  | SubagentStopInput
  | PreCompactInput
  | PostCompactInput;

/**
 * "error" (default) preserves existing behavior: an unhandled exception
 * anywhere in the runtime (stdin read, parse, handler, serialize, write,
 * cleanup) writes a stack trace to stderr and exits non-zero.
 *
 * "continue" is an opt-in fail-open policy for advisory hooks whose only
 * purpose is to enrich context (e.g. UserPromptSubmit additionalContext).
 * Under this policy, unexpected runtime failures are swallowed, the event's
 * valid empty output (`{}`) is emitted if no response was already written,
 * and the process exits 0 so Codex does not show a failed-hook banner.
 * `BlockError` is unaffected: it always writes its reason and exits 2.
 * Do not use "continue" for hooks that enforce permission, safety, or
 * policy decisions — a swallowed failure there silently grants the
 * decision the hook was supposed to make.
 */
export type UnexpectedErrorPolicy = "error" | "continue";

/** The runtime phase in which an unexpected error occurred. */
export type HookErrorPhase = "read" | "parse" | "handler" | "serialize" | "write" | "cleanup";

/**
 * Best-effort diagnostic sink for unexpected errors under the "continue"
 * policy. Called in addition to (not instead of) the runtime's own logger.
 * Errors thrown by this handler are swallowed — a broken diagnostic sink
 * must never itself fail the invocation.
 */
export type UnexpectedErrorHandler = (error: unknown, phase: HookErrorPhase) => void;

export interface MatcherHookConfig {
  matcher?: string;
  timeout?: number;
  statusMessage?: string;
  unexpectedError?: UnexpectedErrorPolicy;
  onUnexpectedError?: UnexpectedErrorHandler;
}

export interface NoMatcherHookConfig {
  timeout?: number;
  statusMessage?: string;
  unexpectedError?: UnexpectedErrorPolicy;
  onUnexpectedError?: UnexpectedErrorHandler;
}
