import type { HookFunction, HookContext } from "./hooks.js";
import { logger } from "./logger.js";
import { BlockError, EXIT_CODES, sessionStartOutput, userPromptSubmitOutput, type HookOutput, type SpecificHookOutput } from "./outputs.js";
import type { HookEventName, HookInput } from "./types.js";
import { EVENTS_WITH_TEXT_OUTPUT } from "./constants.js";

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

function writeStdout(output: HookOutput): void {
  process.stdout.write(JSON.stringify(output.stdout));
}

function normalizeStringOutput(hookEventName: HookEventName, result: string): SpecificHookOutput {
  if (!EVENTS_WITH_TEXT_OUTPUT.has(hookEventName)) {
    throw new Error(`${hookEventName} hooks cannot return plain text`);
  }
  if (hookEventName === "SessionStart") {
    return sessionStartOutput({ additionalContext: result });
  }
  return userPromptSubmitOutput({ additionalContext: result });
}

export function convertToHookOutput(output: SpecificHookOutput): HookOutput {
  return output.stderr !== undefined ? { stdout: output.stdout, stderr: output.stderr } : { stdout: output.stdout };
}

export async function execute<TInput extends HookInput, TOutput>(
  hookFn: HookFunction<TInput, TOutput, HookEventName>,
): Promise<void> {
  try {
    const stdinContent = await readStdin();
    const input = parseStdinInput(stdinContent) as TInput;
    logger.setContext(hookFn.hookEventName, input);
    const context: HookContext = { logger };
    const result = await hookFn(input, context);

    let output: HookOutput = { stdout: {} };
    if (typeof result === "string") {
      output = convertToHookOutput(normalizeStringOutput(hookFn.hookEventName, result));
    } else if (result !== undefined) {
      output = convertToHookOutput(result as SpecificHookOutput);
    }

    writeStdout(output);
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    if (error instanceof BlockError) {
      process.stderr.write(`${error.reason}\n`);
      process.exit(EXIT_CODES.BLOCK);
    }
    if (error instanceof Error) {
      process.stderr.write(`${error.stack ?? error.message}\n`);
    } else {
      process.stderr.write(`${String(error)}\n`);
    }
    process.exit(EXIT_CODES.ERROR);
  } finally {
    logger.clearContext();
    logger.close();
  }
}
