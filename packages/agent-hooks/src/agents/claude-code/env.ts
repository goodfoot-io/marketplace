/**
 * Environment variable utilities for Claude Code hooks.
 *
 * The implementation lives in the committed core (`../../core/env.ts`), which
 * is a byte-for-byte port of `claude-code-hooks/src/env.ts`; this module is
 * the per-agent import site so the Claude Code surface keeps its historical
 * `env.js` path on the barrel.
 * @module
 * @example
 * ```typescript
 * import { getProjectDir, persistEnvVar, isRemoteEnvironment } from '@goodfoot/agent-hooks/claude-code';
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

export {
  CLAUDE_ENV_VARS,
  getEnvFilePath,
  getProjectDir,
  isRemoteEnvironment,
  persistEnvVar,
  persistEnvVars,
} from "../../core/env.js";
