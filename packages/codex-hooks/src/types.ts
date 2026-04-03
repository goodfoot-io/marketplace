export type HookEventName = "PreToolUse" | "PostToolUse" | "SessionStart" | "UserPromptSubmit" | "Stop";

export type PermissionMode = "default" | "acceptEdits" | "plan" | "dontAsk" | "bypassPermissions";
export type SessionStartSource = "startup" | "resume" | "clear";
export type ToolName = "Bash";

export interface BaseHookInput {
  cwd: string;
  hook_event_name: HookEventName;
  model: string;
  permission_mode: PermissionMode;
  session_id: string;
  transcript_path: string | null;
}

export interface SessionStartInput extends BaseHookInput {
  hook_event_name: "SessionStart";
  source: SessionStartSource;
}

export interface PreToolUseInput extends BaseHookInput {
  hook_event_name: "PreToolUse";
  tool_input: {
    command: string;
  };
  tool_name: "Bash";
  tool_use_id: string;
  turn_id: string;
}

export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: "PostToolUse";
  tool_input: {
    command: string;
  };
  tool_name: "Bash";
  tool_response: unknown;
  tool_use_id: string;
  turn_id: string;
}

export interface UserPromptSubmitInput extends BaseHookInput {
  hook_event_name: "UserPromptSubmit";
  prompt: string;
  turn_id: string;
}

export interface StopInput extends BaseHookInput {
  hook_event_name: "Stop";
  last_assistant_message: string | null;
  stop_hook_active: boolean;
  turn_id: string;
}

export type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | SessionStartInput
  | UserPromptSubmitInput
  | StopInput;

export interface MatcherHookConfig {
  matcher?: string;
  timeout?: number;
  statusMessage?: string;
}

export interface NoMatcherHookConfig {
  timeout?: number;
  statusMessage?: string;
}
