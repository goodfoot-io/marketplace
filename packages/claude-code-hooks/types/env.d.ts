/**
 * Environment variable utilities for Claude Code hooks.
 *
 * Provides typed access to Claude Code's environment variables and utilities
 * for persisting environment variables in SessionStart hooks.
 *
 * ## Environment Variables
 *
 * Claude Code sets these environment variables when running hooks:
 *
 * | Variable | Description | Available In |
 * |----------|-------------|--------------|
 * | `CLAUDE_PROJECT_DIR` | Absolute path to project root | All hooks |
 * | `CLAUDE_ENV_FILE` | Path to file for persisting env vars | SessionStart only |
 * | `CLAUDE_CODE_REMOTE` | `"true"` if running remotely | All hooks |
 * @module
 * @example
 * ```typescript
 * import { getProjectDir, persistEnvVar, isRemoteEnvironment } from '@goodfoot/claude-code-hooks';
 *
 * // Get project directory
 * const projectDir = getProjectDir();
 *
 * // Check if running remotely
 * if (isRemoteEnvironment()) {
 *   // Handle remote-specific logic
 * }
 *
 * // In SessionStart hook: persist environment variables
 * persistEnvVar('NODE_ENV', 'production');
 * persistEnvVar('API_KEY', 'secret-key');
 * ```
 * @see https://code.claude.com/docs/en/hooks#hook-execution-details
 */
/**
 * Claude Code environment variable names.
 *
 * These are the environment variables that Claude Code sets when running hooks.
 */
export declare const CLAUDE_ENV_VARS: {
  /**
   * Absolute path to the project root directory where Claude Code was started.
   * Available in all hooks.
   */
  readonly PROJECT_DIR: 'CLAUDE_PROJECT_DIR';
  /**
   * Path to a file where SessionStart hooks can persist environment variables.
   * Variables written to this file will be available in all subsequent bash commands.
   * Only available in SessionStart hooks.
   */
  readonly ENV_FILE: 'CLAUDE_ENV_FILE';
  /**
   * Set to "true" when running in a remote (web) environment.
   * Not set or empty when running in local CLI environment.
   */
  readonly REMOTE: 'CLAUDE_CODE_REMOTE';
};
/**
 * Gets the Claude Code project directory.
 *
 * This is the absolute path to the project root where Claude Code was started.
 * The value comes from the `CLAUDE_PROJECT_DIR` environment variable.
 * @returns The project directory path, or undefined if not set
 * @example
 * ```typescript
 * const projectDir = getProjectDir();
 * if (projectDir) {
 *   const configPath = `${projectDir}/.claude/config.json`;
 * }
 * ```
 */
export declare function getProjectDir(): string | undefined;
/**
 * Gets the Claude Code env file path for persisting environment variables.
 *
 * This is only available in SessionStart hooks. The path points to a file
 * where you can write shell export statements to persist environment variables
 * for all subsequent bash commands in the session.
 * @returns The env file path, or undefined if not set (not a SessionStart hook)
 * @example
 * ```typescript
 * const envFile = getEnvFilePath();
 * if (envFile) {
 *   // We're in a SessionStart hook and can persist env vars
 *   persistEnvVar('MY_VAR', 'my-value');
 * }
 * ```
 */
export declare function getEnvFilePath(): string | undefined;
/**
 * Checks if the hook is running in a remote (web) environment.
 *
 * Remote environments may have different capabilities or restrictions
 * compared to local CLI environments.
 * @returns true if running remotely, false if running locally
 * @example
 * ```typescript
 * if (isRemoteEnvironment()) {
 *   // Use web-compatible approaches
 * } else {
 *   // Can use local CLI features
 * }
 * ```
 */
export declare function isRemoteEnvironment(): boolean;
/**
 * Persists an environment variable for use in subsequent bash commands.
 *
 * This function writes a shell export statement to the `CLAUDE_ENV_FILE`,
 * which Claude Code sources before running bash commands. This allows
 * SessionStart hooks to configure the environment for the entire session.
 *
 * **Important**: This function only works in SessionStart hooks where
 * `CLAUDE_ENV_FILE` is set. In other hooks, it will throw an error.
 * @param name - The environment variable name
 * @param value - The environment variable value (will be shell-escaped)
 * @throws Error if CLAUDE_ENV_FILE is not set (not in a SessionStart hook)
 * @example
 * ```typescript
 * import { sessionStartHook, sessionStartOutput, persistEnvVar } from '@goodfoot/claude-code-hooks';
 *
 * export default sessionStartHook({}, async (input) => {
 *   // Persist environment variables for the session
 *   persistEnvVar('NODE_ENV', 'production');
 *   persistEnvVar('API_KEY', process.env.MY_API_KEY ?? 'default');
 *   persistEnvVar('PATH', `${process.env.PATH}:./node_modules/.bin`);
 *
 *   return sessionStartOutput({});
 * });
 * ```
 * @see https://code.claude.com/docs/en/hooks#persisting-environment-variables
 */
export declare function persistEnvVar(name: string, value: string): void;
/**
 * Persists multiple environment variables at once.
 *
 * This is a convenience wrapper around `persistEnvVar` for setting
 * multiple variables in a single call.
 * @param vars - Object mapping variable names to values
 * @throws Error if CLAUDE_ENV_FILE is not set (not in a SessionStart hook)
 * @example
 * ```typescript
 * persistEnvVars({
 *   NODE_ENV: 'production',
 *   API_KEY: 'secret',
 *   DEBUG: 'false'
 * });
 * ```
 */
export declare function persistEnvVars(vars: Record<string, string>): void;
//# sourceMappingURL=env.d.ts.map
