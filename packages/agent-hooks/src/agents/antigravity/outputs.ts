import { HookBlockError } from "../../core/transport.js";

/**
 * Antigravity has no exit-code signaling channel: every event replies at
 * exit 0 and every decision — allow, deny, or ask — is expressed inside the
 * JSON payload. `EXIT_CODES.SUCCESS` is the only member for that reason; see
 * `transport.ts`'s module docs for the consequence this has for
 * {@link AntigravityBlockError}.
 */
export const EXIT_CODES = {
  SUCCESS: 0,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/**
 * The full permission-decision vocabulary a `PreToolUse` handler may return,
 * derived structurally from Codex's narrower `PreToolUsePermissionDecision`
 * (`"allow" | "deny" | "ask"`) plus the two additional values the plan names
 * verbatim (`force_ask`, `deny_unless_prior_grant`) with no further doc to
 * cite this release:
 *
 * - `force_ask` — like `ask`, but the handler is asserting the host may not
 *   auto-resolve this prompt from a prior grant even if one would otherwise
 *   apply;
 * - `deny_unless_prior_grant` — deny unless the host already holds a prior
 *   grant covering this exact call.
 */
export type AntigravityDecision = "allow" | "deny" | "ask" | "force_ask" | "deny_unless_prior_grant";

/** The narrower decision vocabulary available after a tool has already run. */
export type AntigravityPostDecision = Extract<AntigravityDecision, "allow" | "deny">;

interface BaseSpecificOutput<T extends string> {
  readonly _type: T;
  readonly stdout: AntigravityHookOutput;
}

export type PreToolUseOutput = BaseSpecificOutput<"PreToolUse">;
export type PostToolUseOutput = BaseSpecificOutput<"PostToolUse">;
export type PreInvocationOutput = BaseSpecificOutput<"PreInvocation">;
export type PostInvocationOutput = BaseSpecificOutput<"PostInvocation">;
export type StopOutput = BaseSpecificOutput<"Stop">;

export type SpecificHookOutput =
  | PreToolUseOutput
  | PostToolUseOutput
  | PreInvocationOutput
  | PostInvocationOutput
  | StopOutput;

/**
 * The wire shape every event's stdout carries. Termination is expressed the
 * same payload-only way a decision is: `stop: true` asks the host to end the
 * session, there being no separate exit-code channel to carry that signal.
 */
export interface AntigravityHookOutput {
  decision?: AntigravityDecision;
  reason?: string;
  additionalContext?: string;
  updatedInput?: unknown;
  stop?: boolean;
  systemMessage?: string;
}

export interface HookOutput {
  stdout: AntigravityHookOutput;
}

export interface PreToolUseOptions {
  decision?: AntigravityDecision;
  reason?: string;
  additionalContext?: string;
  updatedInput?: unknown;
  systemMessage?: string;
}

export interface PostToolUseOptions {
  decision?: AntigravityPostDecision;
  reason?: string;
  additionalContext?: string;
  systemMessage?: string;
}

export interface PreInvocationOptions {
  decision?: Extract<AntigravityDecision, "allow" | "deny" | "ask">;
  reason?: string;
  additionalContext?: string;
  systemMessage?: string;
}

export interface PostInvocationOptions {
  additionalContext?: string;
  systemMessage?: string;
}

export interface StopOptions {
  stop?: boolean;
  reason?: string;
  systemMessage?: string;
}

/**
 * The Antigravity block signal, carried as a subclass of the shared core
 * {@link ../../core/transport.ts|HookBlockError} so `drive()` classifies it
 * **before** consulting `unexpectedError` policy — exactly mirroring Claude
 * Code's `HookBlockError` usage and Codex's `BlockError` re-export.
 *
 * This mechanism is a stated *prerequisite*, not a follow-up, for
 * Antigravity specifically: because every Antigravity event replies at exit
 * 0 with the decision expressed only in the JSON payload (Research, plan
 * Step 5), a handler that throws mid-decision has no narrower exit-code
 * fallback to land on the way Codex's stderr+exit-2 channel does — the block
 * decision would otherwise be indistinguishable from a swallowed crash. This
 * class landing is what makes it safe to ever widen `events.ts`'s advisory
 * allow-list past empty.
 */
export class AntigravityBlockError extends HookBlockError {
  public readonly reason: string;

  public constructor(reason: string) {
    super(reason);
    this.name = "AntigravityBlockError";
    this.reason = reason;
  }
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function buildOutput<T extends SpecificHookOutput["_type"]>(
  type: T,
  stdout: AntigravityHookOutput,
): Extract<SpecificHookOutput, { _type: T }> {
  return {
    _type: type,
    stdout: omitUndefined(stdout),
  } as unknown as Extract<SpecificHookOutput, { _type: T }>;
}

export function preToolUseOutput(options: PreToolUseOptions = {}): PreToolUseOutput {
  return buildOutput("PreToolUse", {
    decision: options.decision,
    reason: options.reason,
    additionalContext: options.additionalContext,
    updatedInput: options.updatedInput,
    systemMessage: options.systemMessage,
  });
}

export function postToolUseOutput(options: PostToolUseOptions = {}): PostToolUseOutput {
  return buildOutput("PostToolUse", {
    decision: options.decision,
    reason: options.reason,
    additionalContext: options.additionalContext,
    systemMessage: options.systemMessage,
  });
}

export function preInvocationOutput(options: PreInvocationOptions = {}): PreInvocationOutput {
  return buildOutput("PreInvocation", {
    decision: options.decision,
    reason: options.reason,
    additionalContext: options.additionalContext,
    systemMessage: options.systemMessage,
  });
}

export function postInvocationOutput(options: PostInvocationOptions = {}): PostInvocationOutput {
  return buildOutput("PostInvocation", {
    additionalContext: options.additionalContext,
    systemMessage: options.systemMessage,
  });
}

export function stopOutput(options: StopOptions = {}): StopOutput {
  return buildOutput("Stop", {
    stop: options.stop,
    reason: options.reason,
    systemMessage: options.systemMessage,
  });
}
