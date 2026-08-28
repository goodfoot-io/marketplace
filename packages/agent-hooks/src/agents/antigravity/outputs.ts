/**
 * Antigravity output builders, one per event.
 *
 * Unlike Claude Code and Codex, Antigravity gives each event a **different**
 * stdout shape — there is no single envelope every event shares. `PreToolUse`
 * returns a permission decision, `PostToolUse` returns `{}` and nothing else,
 * the two invocation events return injected steps, and `Stop` returns a
 * continue-or-not decision. Each builder below emits only the fields its own
 * event's contract names; see `CONTRACT.md` in this directory.
 * @module
 */

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
 * The `PreToolUse` permission vocabulary, verbatim from the host reference:
 *
 * - `allow` — run the tool without prompting;
 * - `deny` — hard block the execution immediately;
 * - `ask` — prompt the user, respecting the "Always Allow" cache;
 * - `force_ask` — always prompt, ignoring cached permissions.
 *
 * There is no fifth value. An earlier draft of this surface carried
 * `deny_unless_prior_grant`; the host reference does not define it, and the
 * host would treat it as an unrecognized decision.
 */
export type AntigravityDecision = "allow" | "deny" | "ask" | "force_ask";

/**
 * The `Stop` decision. `"continue"` blocks the stop and re-enters the loop;
 * any other value lets the agent stop, so `"stop"` is spelled explicitly here
 * rather than left to an omitted field.
 */
export type StopDecision = "continue" | "stop";

/** How the host should treat loop termination after `PostInvocation`. */
export type TerminationBehavior = "force_continue" | "terminate" | "";

/**
 * A step injected by `PreInvocation` or `PostInvocation`. Exactly one of the
 * three forms per entry.
 */
export type InjectStep =
  | { toolCall: { name: string; args: Record<string, unknown> } }
  | { userMessage: string }
  | { ephemeralMessage: string };

/** `PreToolUse` stdout. */
export interface PreToolUseStdout {
  decision?: AntigravityDecision;
  reason?: string;
  permissionOverrides?: string[];
  overwrite?: Record<string, unknown>;
}

/** `PostToolUse` stdout: the contract specifies an empty object and nothing else. */
export type PostToolUseStdout = Record<string, never>;

/** `PreInvocation` stdout. */
export interface PreInvocationStdout {
  injectSteps?: InjectStep[];
}

/** `PostInvocation` stdout. */
export interface PostInvocationStdout {
  injectSteps?: InjectStep[];
  terminationBehavior?: TerminationBehavior;
}

/** `Stop` stdout. */
export interface StopStdout {
  decision?: StopDecision;
  reason?: string;
}

interface BaseSpecificOutput<TType extends string, TStdout> {
  readonly _type: TType;
  readonly stdout: TStdout;
}

export type PreToolUseOutput = BaseSpecificOutput<"PreToolUse", PreToolUseStdout>;
export type PostToolUseOutput = BaseSpecificOutput<"PostToolUse", PostToolUseStdout>;
export type PreInvocationOutput = BaseSpecificOutput<"PreInvocation", PreInvocationStdout>;
export type PostInvocationOutput = BaseSpecificOutput<"PostInvocation", PostInvocationStdout>;
export type StopOutput = BaseSpecificOutput<"Stop", StopStdout>;

export type SpecificHookOutput =
  | PreToolUseOutput
  | PostToolUseOutput
  | PreInvocationOutput
  | PostInvocationOutput
  | StopOutput;

/** The union of every event's stdout shape. */
export type AntigravityHookOutput =
  | PreToolUseStdout
  | PostToolUseStdout
  | PreInvocationStdout
  | PostInvocationStdout
  | StopStdout;

export interface HookOutput {
  stdout: AntigravityHookOutput;
}

export type PreToolUseOptions = PreToolUseStdout;
export type PreInvocationOptions = PreInvocationStdout;
export type PostInvocationOptions = PostInvocationStdout;
export type StopOptions = StopStdout;

/**
 * The Antigravity block signal, carried as a subclass of the shared core
 * {@link ../../core/transport.ts|HookBlockError} so `drive()` classifies it
 * **before** consulting `unexpectedError` policy — exactly mirroring Claude
 * Code's `HookBlockError` usage and Codex's `BlockError` re-export.
 *
 * The class matters more here than on the other two agents: because every
 * Antigravity event replies at exit 0 with the decision expressed only in the
 * JSON payload, a handler that throws mid-decision has no narrower exit-code
 * fallback to land on the way Codex's stderr+exit-2 channel does. Without
 * this class the block would be indistinguishable from a swallowed crash.
 *
 * The transport serializes it as `{ "decision": "deny", ... }`, which the
 * host acts on for `PreToolUse` only. On the other four events the reply is
 * well-formed but carries no decision the host recognizes, so it reads as an
 * empty response.
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

function buildOutput<TType extends SpecificHookOutput["_type"], TStdout extends object>(
  type: TType,
  stdout: TStdout,
): Extract<SpecificHookOutput, { _type: TType }> {
  return {
    _type: type,
    stdout: omitUndefined(stdout),
  } as unknown as Extract<SpecificHookOutput, { _type: TType }>;
}

/** Builds a `PreToolUse` reply: a permission decision, optionally with argument overwrites. */
export function preToolUseOutput(options: PreToolUseOptions = {}): PreToolUseOutput {
  return buildOutput("PreToolUse", {
    decision: options.decision,
    reason: options.reason,
    permissionOverrides: options.permissionOverrides,
    overwrite: options.overwrite,
  });
}

/**
 * Builds the `PostToolUse` reply. The contract defines the reply as an empty
 * object, so this builder takes no options: there is nothing a `PostToolUse`
 * handler can tell the host.
 */
export function postToolUseOutput(): PostToolUseOutput {
  return buildOutput("PostToolUse", {} as PostToolUseStdout);
}

/** Builds a `PreInvocation` reply carrying steps to inject before the model runs. */
export function preInvocationOutput(options: PreInvocationOptions = {}): PreInvocationOutput {
  return buildOutput("PreInvocation", { injectSteps: options.injectSteps });
}

/** Builds a `PostInvocation` reply: injected steps, a termination override, or both. */
export function postInvocationOutput(options: PostInvocationOptions = {}): PostInvocationOutput {
  return buildOutput("PostInvocation", {
    injectSteps: options.injectSteps,
    terminationBehavior: options.terminationBehavior,
  });
}

/** Builds a `Stop` reply. `decision: "continue"` blocks the stop; `reason` is injected as a system message. */
export function stopOutput(options: StopOptions = {}): StopOutput {
  return buildOutput("Stop", { decision: options.decision, reason: options.reason });
}
