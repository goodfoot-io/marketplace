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
import type { ExitCode, HookOutput, SyncHookJSONOutput } from './outputs.js';
import type { HookInput } from './types/inputs.js';
import { logger } from './logger.js';
import { EXIT_CODES } from './outputs.js';
import {
  initializeTelemetry,
  shutdownTelemetry,
  wireLoggerTelemetry,
  recordInvocation,
  recordDuration,
  recordError,
  recordExitCode,
  emitHookStart,
  emitHookEnd,
  emitHandlerError
} from './telemetry.js';

// ============================================================================
// Key Transformation Utilities
// ============================================================================

/**
 * Checks if a string is in snake_case format.
 * @param str - The string to check
 * @returns True if the string contains underscores (snake_case indicator)
 */
function isSnakeCase(str: string): boolean {
  return str.includes('_');
}

/**
 * Converts a snake_case string to camelCase.
 * @param str - The snake_case string to convert
 * @returns The camelCase equivalent
 * @example
 * ```typescript
 * snakeToCamelCaseString('hello_world'); // 'helloWorld'
 * snakeToCamelCaseString('tool_use_id'); // 'toolUseId'
 * ```
 */
function snakeToCamelCaseString(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Converts a camelCase string to snake_case.
 * @param str - The camelCase string to convert
 * @returns The snake_case equivalent
 * @example
 * ```typescript
 * camelToSnakeCaseString('helloWorld'); // 'hello_world'
 * camelToSnakeCaseString('toolUseId'); // 'tool_use_id'
 * ```
 */
function camelToSnakeCaseString(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

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
export function snakeToCamelCase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const mapped: unknown[] = obj.map((item: unknown) => snakeToCamelCase(item));
    return mapped as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = isSnakeCase(key) ? snakeToCamelCaseString(key) : key;
      result[newKey] = snakeToCamelCase(value);
    }
    return result as T;
  }

  return obj;
}

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
export function camelToSnakeCase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const mapped: unknown[] = obj.map((item: unknown) => camelToSnakeCase(item));
    return mapped as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = camelToSnakeCaseString(key);
      result[newKey] = camelToSnakeCase(value);
    }
    return result as T;
  }

  return obj;
}

// ============================================================================
// Stdin/Stdout Handling
// ============================================================================

/**
 * Reads all data from stdin.
 * @returns Promise resolving to the complete stdin content
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];

    // Set encoding first to ensure data events receive strings
    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', (chunk: string) => {
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      resolve(chunks.join(''));
    });

    process.stdin.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Parses stdin JSON and transforms keys to camelCase.
 * @param stdinContent - Raw stdin content
 * @returns Parsed and transformed input
 * @throws Error if JSON is malformed
 */
function parseStdinInput(stdinContent: string): HookInput {
  // Parse JSON
  const rawInput: unknown = JSON.parse(stdinContent);

  // Transform snake_case to camelCase
  return snakeToCamelCase(rawInput) as HookInput;
}

/**
 * Writes hook output to stdout.
 *
 * Transforms camelCase keys to snake_case before serializing to JSON.
 * @param output - The hook output to write
 */
function writeStdout(output: SyncHookJSONOutput): void {
  // Transform camelCase to snake_case for Claude Code compatibility
  const snakeCaseOutput = camelToSnakeCase(output);
  process.stdout.write(JSON.stringify(snakeCaseOutput));
}

/**
 * Writes error message to stderr.
 * @param message - The error message to write
 */
function writeStderr(message: string): void {
  process.stderr.write(message);
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Creates an error output for malformed stdin JSON.
 * @param error - The parse error
 * @returns HookOutput with exit code 1
 */
function createMalformedInputOutput(error: unknown): HookOutput {
  const message = error instanceof Error ? error.message : String(error);
  return {
    exitCode: EXIT_CODES.ERROR,
    stdout: {},
    stderr: `Invalid JSON input: ${message}`
  };
}

/**
 * Creates an error output for handler exceptions.
 * @param error - The error thrown by the handler
 * @returns HookOutput with exit code 1
 */
function createHandlerErrorOutput(error: unknown): HookOutput {
  const message = error instanceof Error ? error.message : String(error);
  return {
    exitCode: EXIT_CODES.ERROR,
    stdout: {},
    stderr: `Hook handler error: ${message}`
  };
}

// ============================================================================
// Execute Function
// ============================================================================

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
export async function execute<TInput extends HookInput>(hookFn: HookFunction<TInput>): Promise<void> {
  const startTime = performance.now();
  let exitCode: ExitCode = EXIT_CODES.SUCCESS;
  let output: HookOutput | undefined;
  let input: TInput | undefined;

  try {
    // Initialize telemetry (lazy - only initializes if enabled)
    initializeTelemetry();

    // Wire logger to telemetry if enabled
    wireLoggerTelemetry(logger);

    // Read and parse stdin
    let stdinContent: string;
    try {
      stdinContent = await readStdin();
    } catch (error) {
      logger.logError(error, 'Failed to read stdin');
      output = createMalformedInputOutput(error);
      exitCode = output.exitCode;
      return;
    }

    // Parse and transform input
    try {
      input = parseStdinInput(stdinContent) as TInput;
    } catch (error) {
      logger.logError(error, 'Failed to parse stdin JSON');
      output = createMalformedInputOutput(error);
      exitCode = output.exitCode;
      return;
    }

    // Set logger context
    const hookEventName = hookFn.hookEventName;
    logger.setContext(hookEventName, input);

    // Record telemetry start
    recordInvocation(hookEventName);
    emitHookStart(hookEventName, input as unknown as Record<string, unknown>);

    // Execute handler
    try {
      output = await hookFn(input, { logger });
      exitCode = output.exitCode;
    } catch (error) {
      // Log the error
      logger.logError(error, 'Hook handler threw an exception');

      // Record error telemetry
      const errorType = error instanceof Error ? error.name : 'UnknownError';
      recordError(hookEventName, errorType);
      emitHandlerError(hookEventName, error, { input: input as unknown as Record<string, unknown> });

      // Create error output
      output = createHandlerErrorOutput(error);
      exitCode = output.exitCode;
    }
  } finally {
    // Calculate duration
    const durationMs = performance.now() - startTime;

    // Record telemetry end metrics
    if (input !== undefined) {
      const hookEventName = hookFn.hookEventName;
      recordDuration(hookEventName, durationMs);
      recordExitCode(hookEventName, exitCode);
      emitHookEnd(hookEventName, exitCode, durationMs);
    }

    // Write output if we have it
    if (output !== undefined) {
      writeStdout(output.stdout);
      if (output.stderr !== undefined) {
        writeStderr(output.stderr);
      }
    }

    // Clear logger context
    logger.clearContext();

    // Flush telemetry and close logger
    await shutdownTelemetry();
    logger.close();

    // Exit with appropriate code
    process.exit(exitCode);
  }
}
