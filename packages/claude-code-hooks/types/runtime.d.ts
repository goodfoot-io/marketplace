/**
 * Runtime module for Claude Code hooks.
 *
 * Handles stdin/stdout/exit code semantics for compiled hook execution.
 * This module is the core orchestrator that:
 * - Reads JSON from stdin
 * - Transforms snake_case to camelCase
 * - Invokes the hook handler
 * - Transforms output back and writes to stdout
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
import type { HookFunction } from './hooks.js';
import type { HookOutput, SpecificHookOutput } from './outputs.js';
import type { HookInput } from './types/inputs.js';
/**
 * Deeply transforms object keys from snake_case to camelCase.
 *
 * This function recursively processes objects and arrays, converting all
 * snake_case keys to camelCase while preserving values. Primitive values
 * are returned unchanged.
 * @param obj - The object to transform
 * @returns A new object with camelCase keys
 * @example
 * ```typescript
 * const input = {
 *   session_id: '123',
 *   tool_name: 'Bash',
 *   tool_input: { file_path: '/test' }
 * };
 *
 * const output = snakeToCamelCase(input);
 * // {
 * //   sessionId: '123',
 * //   toolName: 'Bash',
 * //   toolInput: { filePath: '/test' }
 * // }
 * ```
 * @see https://code.claude.com/docs/en/hooks#hook-input-structure
 */
export declare function snakeToCamelCase<T>(obj: T): T;
/**
 * Deeply transforms object keys from camelCase to snake_case.
 *
 * This function recursively processes objects and arrays, converting all
 * camelCase keys to snake_case while preserving values. Primitive values
 * are returned unchanged.
 *
 * **Note:** Hook output uses camelCase and should NOT be converted to snake_case.
 * This utility is for other use cases requiring case transformation.
 * @param obj - The object to transform
 * @returns A new object with snake_case keys
 * @example
 * ```typescript
 * const input = { firstName: 'John', lastName: 'Doe' };
 * const result = camelToSnakeCase(input);
 * // { first_name: 'John', last_name: 'Doe' }
 * ```
 */
export declare function camelToSnakeCase<T>(obj: T): T;
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
 * 2. Parses JSON
 * 3. Transforms snake_case input to camelCase
 * 4. Sets up logger context (hookType, input)
 * 5. Records telemetry start metrics
 * 6. Calls handler with input and context (logger)
 * 7. Handles any errors, logs them
 * 8. Records telemetry end metrics
 * 9. Transforms output to snake_case for Claude Code
 * 10. Writes JSON to stdout
 * 11. Flushes telemetry, closes logger
 * 12. Exits with appropriate code
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
//# sourceMappingURL=runtime.d.ts.map