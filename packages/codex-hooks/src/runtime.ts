import { EVENTS_WITH_TEXT_OUTPUT } from "./constants.js";
import type { HookContext, HookFunction } from "./hooks.js";
import { logger } from "./logger.js";
import {
  BlockError,
  EXIT_CODES,
  type HookOutput,
  type SpecificHookOutput,
  sessionStartOutput,
  subagentStartOutput,
  userPromptSubmitOutput,
} from "./outputs.js";
import type {
  HookErrorPhase,
  HookEventName,
  HookInput,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "./types.js";

/** The empty response is a valid, no-op success payload for every hook event's output schema. */
const EMPTY_OUTPUT: HookOutput = { stdout: {} };

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);
  });
}

function parseStdinInput(stdinContent: string): HookInput {
  return JSON.parse(stdinContent) as HookInput;
}

function serializeStdout(output: HookOutput): string {
  return JSON.stringify(output.stdout);
}

function normalizeStringOutput(hookEventName: HookEventName, result: string): SpecificHookOutput {
  if (!EVENTS_WITH_TEXT_OUTPUT.has(hookEventName)) {
    throw new Error(`${hookEventName} hooks cannot return plain text`);
  }
  if (hookEventName === "SessionStart") {
    return sessionStartOutput({ additionalContext: result });
  }
  if (hookEventName === "SubagentStart") {
    return subagentStartOutput({ additionalContext: result });
  }
  return userPromptSubmitOutput({ additionalContext: result });
}

export function convertToHookOutput(output: SpecificHookOutput): HookOutput {
  return output.stderr !== undefined ? { stdout: output.stdout, stderr: output.stderr } : { stdout: output.stdout };
}

function writeStderr(error: unknown): void {
  if (error instanceof Error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
  } else {
    process.stderr.write(`${String(error)}\n`);
  }
}

/**
 * Reports an unexpected error through the caller's diagnostic sink and the
 * runtime logger. Both are best-effort: this function never throws, so a
 * broken sink or logger cannot itself fail the "continue" policy it backs.
 */
function reportUnexpectedError(
  onUnexpectedError: UnexpectedErrorHandler | undefined,
  error: unknown,
  phase: HookErrorPhase,
): void {
  try {
    onUnexpectedError?.(error, phase);
  } catch {
    // Diagnostic sinks must not recursively fail the invocation.
  }
  try {
    logger.logError(error, `Unexpected error in ${phase} phase (fail-open)`, { phase });
  } catch {
    // The logger itself may be the thing that failed (e.g. log file write).
  }
}

/** Clears logger context and closes any open log file. Never throws under the "continue" policy. */
function cleanup(policy: UnexpectedErrorPolicy, onUnexpectedError: UnexpectedErrorHandler | undefined): void {
  try {
    logger.clearContext();
    logger.close();
  } catch (error) {
    if (policy !== "continue") {
      throw error;
    }
    reportUnexpectedError(onUnexpectedError, error, "cleanup");
  }
}

export async function execute<TInput extends HookInput, TOutput>(
  hookFn: HookFunction<TInput, TOutput, HookEventName>,
): Promise<void> {
  const policy = hookFn.unexpectedError ?? "error";
  const onUnexpectedError = hookFn.onUnexpectedError;
  let phase: HookErrorPhase = "read";
  // Buffered until serialization succeeds so a failure can never produce
  // output concatenated onto an already-written partial response.
  let output: HookOutput | undefined;

  try {
    const stdinContent = await readStdin();
    phase = "parse";
    const input = parseStdinInput(stdinContent) as TInput;
    logger.setContext(hookFn.hookEventName, input);
    const context: HookContext = { logger };

    phase = "handler";
    const result = await hookFn(input, context);

    phase = "serialize";
    if (typeof result === "string") {
      output = convertToHookOutput(normalizeStringOutput(hookFn.hookEventName, result));
    } else if (result !== undefined) {
      output = convertToHookOutput(result as SpecificHookOutput);
    } else {
      output = EMPTY_OUTPUT;
    }
    serializeStdout(output);
  } catch (error) {
    if (error instanceof BlockError) {
      cleanup(policy, onUnexpectedError);
      process.stderr.write(`${error.reason}\n`);
      process.exit(EXIT_CODES.BLOCK);
    }
    if (policy !== "continue") {
      cleanup(policy, onUnexpectedError);
      writeStderr(error);
      process.exit(EXIT_CODES.ERROR);
    }
    reportUnexpectedError(onUnexpectedError, error, phase);
    output = EMPTY_OUTPUT;
  }

  phase = "write";
  try {
    process.stdout.write(serializeStdout(output));
  } catch (error) {
    if (policy !== "continue") {
      cleanup(policy, onUnexpectedError);
      writeStderr(error);
      process.exit(EXIT_CODES.ERROR);
    }
    reportUnexpectedError(onUnexpectedError, error, "write");
  }

  cleanup(policy, onUnexpectedError);
  process.exit(EXIT_CODES.SUCCESS);
}
