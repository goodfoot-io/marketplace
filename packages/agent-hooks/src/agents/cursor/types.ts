/** Cursor's native hook payloads. See CONTRACT.md for the pinned public reference. */
export interface BaseHookInput {
  conversation_id: string;
  generation_id: string;
  model: string;
  model_id?: string;
  model_params?: { id: string; value: string }[];
  hook_event_name: HookEventName;
  cursor_version: string;
  workspace_roots: string[];
  user_email: string | null;
  transcript_path: string | null;
}

export interface SessionStartInput extends BaseHookInput {
  hook_event_name: "sessionStart";
  session_id: string;
  is_background_agent: boolean;
  composer_mode?: string;
}

export interface PreToolUseInput extends BaseHookInput {
  hook_event_name: "preToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  cwd: string;
  agent_message?: string;
}

export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: "postToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  /** JSON-stringified tool result, not raw terminal output. */
  tool_output: string;
  tool_use_id: string;
  cwd: string;
  /** Tool execution time in milliseconds. */
  duration: number;
}

export interface BeforeSubmitPromptInput extends BaseHookInput {
  hook_event_name: "beforeSubmitPrompt";
  prompt: string;
  attachments: { type: "file" | "rule"; file_path: string }[];
}

export interface StopInput extends BaseHookInput {
  hook_event_name: "stop";
  status: "completed" | "aborted" | "error";
  loop_count: number;
}

export interface SubagentStopInput extends Omit<StopInput, "hook_event_name"> {
  hook_event_name: "subagentStop";
  subagent_type: string;
  task: string;
  description: string;
  summary: string;
  duration_ms: number;
  message_count: number;
  tool_call_count: number;
  modified_files: string[];
  agent_transcript_path: string | null;
}

/** Event-indexed inputs keep each factory's callback precisely typed. */
export interface InputByEvent {
  sessionStart: SessionStartInput;
  preToolUse: PreToolUseInput;
  postToolUse: PostToolUseInput;
  beforeSubmitPrompt: BeforeSubmitPromptInput;
  stop: StopInput;
  subagentStop: SubagentStopInput;
}

export type HookEventName = keyof InputByEvent;
export type HookInput = InputByEvent[HookEventName];
export type { HookErrorPhase, UnexpectedErrorHandler, UnexpectedErrorPolicy } from "../../core/types.js";
