/** Cursor wire policy only; stdin, error classification and flushing belong to core. */
import { drive, type Transport } from "../../core/transport.js";
import type { HookFunction } from "./hooks.js";
import { beforeSubmitPromptOutput, EXIT_CODES, preToolUseOutput, type SpecificHookOutput } from "./outputs.js";
import type { HookEventName } from "./types.js";

/** Empty permission responses must still satisfy Cursor's required decision fields. */
export function createCursorTransport(event: HookEventName): Transport<SpecificHookOutput | null | undefined> {
  const empty =
    event === "preToolUse"
      ? preToolUseOutput().stdout
      : event === "beforeSubmitPrompt"
        ? beforeSubmitPromptOutput().stdout
        : {};
  return {
    finalize(outcome) {
      if (outcome.kind === "handlerError") {
        const text =
          outcome.error instanceof Error ? (outcome.error.stack ?? outcome.error.message) : String(outcome.error);
        return { stderr: `${text}\n`, exitCode: EXIT_CODES.ERROR };
      }
      if (outcome.kind === "block") {
        if (event === "preToolUse" || event === "beforeSubmitPrompt") {
          const stdout =
            event === "preToolUse"
              ? preToolUseOutput({
                  permission: "deny",
                  userMessage: outcome.error.message,
                  agentMessage: outcome.error.message,
                }).stdout
              : beforeSubmitPromptOutput({ continue: false, userMessage: outcome.error.message }).stdout;
          return { stdout: JSON.stringify(stdout), exitCode: EXIT_CODES.SUCCESS };
        }
        return { stderr: `${outcome.error.message}\n`, exitCode: EXIT_CODES.BLOCK };
      }
      if (outcome.kind !== "response") throw new Error("Cursor does not accept raw stdout");
      if (outcome.output != null && outcome.output._type !== event) {
        throw new Error(`Cursor ${event} received an output for ${outcome.output._type}`);
      }
      return { stdout: JSON.stringify(outcome.output?.stdout ?? empty), exitCode: EXIT_CODES.SUCCESS };
    },
  };
}

/** Run one Cursor hook with the shared driver and its native event transport. */
export async function execute<E extends HookEventName>(hook: HookFunction<E>): Promise<void> {
  await drive(createCursorTransport(hook.hookEventName), hook as unknown as Parameters<typeof drive>[1]);
}
