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

import type { HookContext, HookFunction, SessionStartContext } from './hooks.js';
import type { HookInput } from './inputs.js';
import type { HookOutput, SpecificHookOutput, SyncHookJSONOutput } from './outputs.js';
import { persistEnvVar, persistEnvVars } from './env.js';
import { logger } from './logger.js';
import { EXIT_CODES } from './outputs.js';

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
 * Output uses camelCase keys per Claude Code hook specification.
 * @param output - The hook output to write
 * @see https://code.claude.com/docs/en/hooks#hook-output-structure
 */
function writeStdout(output: SyncHookJSONOutput): void {
  // Output uses camelCase - no transformation needed
  process.stdout.write(JSON.stringify(output));
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Creates an error output for malformed stdin JSON.
 * @param error - The parse error
 * @returns HookOutput with empty stdout
 */
function createMalformedInputOutput(error: unknown): HookOutput {
  logger.error(`Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`);
  return { stdout: {} };
}

/**
 * Writes handler error stacktrace to stderr and exits with code 2.
 *
 * When a hook handler throws an exception:
 * - Stacktrace (with sourcemaps if available) is output to stderr
 * - Process exits with code 2 (BLOCK)
 * - No JSON is output to stdout
 * @param error - The error thrown by the handler
 */
function handleHandlerError(error: unknown): never {
  // Write stack trace to stderr (sourcemaps are applied automatically by Node.js)
  if (error instanceof Error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
  } else {
    process.stderr.write(`${String(error)}\n`);
  }

  // Log to file if configured
  logger.error(`Hook handler error: ${error instanceof Error ? error.message : String(error)}`);

  // Clear logger context and close
  logger.clearContext();
  logger.close();

  // Exit with code 2 (BLOCK) - no JSON output
  process.exit(EXIT_CODES.BLOCK);
}

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
export function convertToHookOutput(specificOutput: SpecificHookOutput): HookOutput {
  return { stdout: specificOutput.stdout };
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
 * 5. Calls handler with input and context (logger)
 * 6. Handles any errors, logs them
 * 7. Writes JSON to stdout
 * 8. Closes logger
 * 9. Exits with appropriate code
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
export async function execute<TInput extends HookInput, TOutput extends SpecificHookOutput>(
  hookFn: HookFunction<TInput, TOutput>
): Promise<void> {
  let output: HookOutput | undefined;

  try {
    // Check for log file configuration conflicts
    // CLAUDE_CODE_HOOKS_CLI_LOG_FILE is injected by the CLI --log parameter
    // CLAUDE_CODE_HOOKS_LOG_FILE is the user's environment variable
    const cliLogFile = process.env['CLAUDE_CODE_HOOKS_CLI_LOG_FILE'];
    const envLogFile = process.env['CLAUDE_CODE_HOOKS_LOG_FILE'];

    if (cliLogFile !== undefined && envLogFile !== undefined && cliLogFile !== envLogFile) {
      // Write error to stderr and exit with error code
      process.stderr.write(
        `Log file configuration conflict: CLI --log="${cliLogFile}" vs CLAUDE_CODE_HOOKS_LOG_FILE="${envLogFile}". ` +
          'Use only one method to configure hook logging.\n'
      );
      process.exit(EXIT_CODES.ERROR);
    }

    // If CLI log file is set, configure the logger
    if (cliLogFile !== undefined) {
      logger.setLogFile(cliLogFile);
    }

    // Read and parse stdin
    let stdinContent: string;
    try {
      stdinContent = await readStdin();
    } catch (error) {
      logger.logError(error, 'Failed to read stdin');
      output = createMalformedInputOutput(error);
      return;
    }

    // Parse and transform input
    let input: TInput;
    try {
      input = parseStdinInput(stdinContent) as TInput;
    } catch (error) {
      logger.logError(error, 'Failed to parse stdin JSON');
      output = createMalformedInputOutput(error);
      return;
    }

    // Set logger context
    const hookEventName = hookFn.hookEventName;
    logger.setContext(hookEventName, input);

    // Build context - SessionStart hooks get extended context with persistEnvVar
    const context: HookContext | SessionStartContext =
      hookEventName === 'SessionStart' ? { logger, persistEnvVar, persistEnvVars } : { logger };

    // Execute handler
    try {
      const specificOutput = await hookFn(input, context as Parameters<typeof hookFn>[1]);
      output = convertToHookOutput(specificOutput);
    } catch (error) {
      // Handler threw - output stacktrace to stderr and exit with code 2
      // This call never returns (process.exit)
      handleHandlerError(error);
    }
  } finally {
    // Write output if we have it
    if (output !== undefined) {
      writeStdout(output.stdout);
    }

    // Clear logger context
    logger.clearContext();
    logger.close();

    // Exit with success (handler errors exit via handleHandlerError with code 2)
    process.exit(EXIT_CODES.SUCCESS);
  }
}
