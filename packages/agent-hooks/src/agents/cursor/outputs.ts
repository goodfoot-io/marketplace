/** Cursor builders convert ergonomic options to event-specific native JSON. */
import { HookBlockError } from "../../core/transport.js";

export const EXIT_CODES = { SUCCESS: 0, ERROR: 1, BLOCK: 2 } as const;
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
/** Cursor accepts "ask" syntactically but does not enforce it for preToolUse. */
export type CursorPermission = "allow" | "deny";

export interface SessionStartStdout {
  env?: Record<string, string>;
  additional_context?: string;
}
export interface PostToolUseStdout {
  updated_mcp_tool_output?: Record<string, unknown>;
  additional_context?: string;
}
export interface PreToolUseStdout {
  permission: CursorPermission;
  user_message?: string;
  agent_message?: string;
  updated_input?: Record<string, unknown>;
}
export interface BeforeSubmitPromptStdout {
  continue: boolean;
  user_message?: string;
}
export interface StopStdout {
  followup_message?: string;
}
export type SubagentStopStdout = StopStdout;

export interface SessionStartOptions {
  env?: Record<string, string>;
  additionalContext?: string;
}
export interface PostToolUseOptions {
  updatedMcpToolOutput?: Record<string, unknown>;
  additionalContext?: string;
}
export interface PreToolUseOptions {
  permission?: CursorPermission;
  userMessage?: string;
  agentMessage?: string;
  updatedInput?: Record<string, unknown>;
}
export interface BeforeSubmitPromptOptions {
  continue?: boolean;
  userMessage?: string;
}
export interface StopOptions {
  followupMessage?: string;
}
export type SubagentStopOptions = StopOptions;

type Result<E extends string, S> = { readonly _type: E; readonly stdout: S };
export interface OutputByEvent {
  sessionStart: Result<"sessionStart", SessionStartStdout>;
  preToolUse: Result<"preToolUse", PreToolUseStdout>;
  postToolUse: Result<"postToolUse", PostToolUseStdout>;
  beforeSubmitPrompt: Result<"beforeSubmitPrompt", BeforeSubmitPromptStdout>;
  stop: Result<"stop", StopStdout>;
  subagentStop: Result<"subagentStop", SubagentStopStdout>;
}
export type SessionStartOutput = OutputByEvent["sessionStart"];
export type PreToolUseOutput = OutputByEvent["preToolUse"];
export type PostToolUseOutput = OutputByEvent["postToolUse"];
export type BeforeSubmitPromptOutput = OutputByEvent["beforeSubmitPrompt"];
export type StopOutput = OutputByEvent["stop"];
export type SubagentStopOutput = OutputByEvent["subagentStop"];
export type SpecificHookOutput = OutputByEvent[keyof OutputByEvent];
export type CursorHookOutput = SpecificHookOutput["stdout"];
export interface HookOutput {
  stdout: CursorHookOutput;
}

/** An intentional block remains a block under every unexpected-error policy. */
export class CursorBlockError extends HookBlockError {
  constructor(reason: string) {
    super(reason);
    this.name = "CursorBlockError";
  }
}

function result<E extends keyof OutputByEvent>(event: E, fields: OutputByEvent[E]["stdout"]): OutputByEvent[E] {
  const stdout = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  return { _type: event, stdout } as OutputByEvent[E];
}

/** Add initial context and/or environment variables; never a blocking reply. */
export function sessionStartOutput(options: SessionStartOptions = {}): SessionStartOutput {
  return result("sessionStart", { env: options.env, additional_context: options.additionalContext });
}
/** Replace MCP output and/or add conversation context. */
export function postToolUseOutput(options: PostToolUseOptions = {}): PostToolUseOutput {
  return result("postToolUse", {
    updated_mcp_tool_output: options.updatedMcpToolOutput,
    additional_context: options.additionalContext,
  });
}
/** Omitted permission explicitly allows; "ask" is rejected rather than falsely promising enforcement. */
export function preToolUseOutput(options: PreToolUseOptions = {}): PreToolUseOutput {
  const permission = options.permission ?? "allow";
  if (permission !== "allow" && permission !== "deny") throw new Error("Cursor preToolUse requires allow or deny");
  return result("preToolUse", {
    permission,
    user_message: options.userMessage,
    agent_message: options.agentMessage,
    updated_input: options.updatedInput,
  });
}
/** Prompt submission has no additional_context channel. */
export function beforeSubmitPromptOutput(options: BeforeSubmitPromptOptions = {}): BeforeSubmitPromptOutput {
  return result("beforeSubmitPrompt", { continue: options.continue ?? true, user_message: options.userMessage });
}
/** A follow-up is distinct from blocking a stop. */
export function stopOutput(options: StopOptions = {}): StopOutput {
  return result("stop", { followup_message: options.followupMessage });
}
/** Only completed subagents consume the follow-up. */
export function subagentStopOutput(options: SubagentStopOptions = {}): SubagentStopOutput {
  return result("subagentStop", { followup_message: options.followupMessage });
}
