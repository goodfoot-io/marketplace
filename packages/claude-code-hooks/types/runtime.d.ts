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
 * @param obj - The object to transform
 * @returns A new object with snake_case keys
 * @example
 * ```typescript
 * const output = {
 *   hookSpecificOutput: {
 *     hookEventName: 'PreToolUse',
 *     permissionDecision: 'allow'
 *   }
 * };
 *
 * const result = camelToSnakeCase(output);
 * // {
 * //   hook_specific_output: {
 * //     hook_event_name: 'PreToolUse',
 * //     permission_decision: 'allow'
 * //   }
 * // }
 * ```
 * @see https://code.claude.com/docs/en/hooks#hook-output-structure
 */
export declare function camelToSnakeCase<T>(obj: T): T;
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
export declare function execute<TInput extends HookInput>(hookFn: HookFunction<TInput>): Promise<void>;
//# sourceMappingURL=runtime.d.ts.map
