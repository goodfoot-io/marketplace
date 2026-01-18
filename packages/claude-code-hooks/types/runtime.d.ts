/**
 * Runtime module for Claude Code hooks.
 *
 * Handles stdin/stdout/exit code semantics for compiled hook execution.
 * This module is the core orchestrator that:
 * - Reads JSON from stdin (wire format with snake_case properties)
 * - Invokes the hook handler
 * - Writes output to stdout
 * - Manages exit codes
 * @module
 * @example
 * ```typescript
 * // In a compiled hook file
 * import { execute } from '@goodfoot/claude-code-hooks/runtime';
 * import myHook from './my-hook.js';
 *
 * execute(myHook);
 * ```
 * @see https://code.claude.com/docs/en/hooks
 */
import type { HookFunction } from "./hooks.js";
import type { HookOutput, SpecificHookOutput } from "./outputs.js";
import type { HookInput } from "./types.js";
/**
 * Converts a SpecificHookOutput to HookOutput for wire format.
 *
 * SpecificHookOutput types have: { _type, exitCode, stdout, stderr? }
 * HookOutput has: { exitCode, stdout, stderr? }
 *
 * Since output builders now produce wire-format directly, this function
 * simply strips the `_type` discriminator field.
 * @param specificOutput - The specific output from a hook handler
 * @returns HookOutput ready for serialization
 * @see https://code.claude.com/docs/en/hooks#hook-output-structure
 * @example
 * ```typescript
 * const specificOutput = preToolUseOutput({ hookSpecificOutput: { permissionDecision: 'allow' } });
 * const hookOutput = convertToHookOutput(specificOutput);
 * // hookOutput: { exitCode: 0, stdout: { hookSpecificOutput: { ... } } }
 * ```
 */
export declare function convertToHookOutput(specificOutput: SpecificHookOutput): HookOutput;
/**
 * Executes a hook handler with full runtime orchestration.
 *
 * This is the main entry point that compiled hooks use. When a compiled hook
 * runs as a CLI:
 *
 * 1. Reads all stdin
 * 2. Parses JSON (wire format with snake_case properties)
 * 3. Sets up logger context (hookType, input)
 * 4. Calls handler with input and context (logger)
 * 5. Handles any errors, logs them
 * 6. Writes JSON to stdout
 * 7. Closes logger
 * 8. Exits with appropriate code
 * @param hookFn - The hook function to execute (from hook factory)
 * @example
 * ```typescript
 * // In compiled hook file
 * import { execute } from '@goodfoot/claude-code-hooks/runtime';
 * import { preToolUseHook, preToolUseOutput } from '@goodfoot/claude-code-hooks';
 *
 * const myHook = preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   logger.info('Processing Bash command');
 *   return preToolUseOutput({ allow: true });
 * });
 *
 * execute(myHook);
 * ```
 * @see https://code.claude.com/docs/en/hooks
 */
export declare function execute<TInput extends HookInput, TOutput extends SpecificHookOutput>(hookFn: HookFunction<TInput, TOutput>): Promise<void>;
