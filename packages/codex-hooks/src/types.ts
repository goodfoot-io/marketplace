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

export interface MatcherHookConfig {
  matcher?: string;
  timeout?: number;
  statusMessage?: string;
}

export interface NoMatcherHookConfig {
  timeout?: number;
  statusMessage?: string;
}
