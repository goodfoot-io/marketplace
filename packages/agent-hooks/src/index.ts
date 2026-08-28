/**
 * `@goodfoot/agent-hooks` root export.
 *
 * Exposes the agent-neutral core only: the {@link defineHook} factory
 * primitive, the transport/driver pair ({@link Transport}, {@link drive}),
 * {@link HookBlockError}, the Logger, env utilities, and stdin helpers.
 *
 * Per-agent entry points (`@goodfoot/agent-hooks/claude-code`, `/codex`,
 * `/opencode`, `/antigravity`) expose each host's native protocol without
 * leaking host-specific types through this root module.
 * @module
 */

export { defineHook } from "./core/define-hook.js";
export {
  CLAUDE_ENV_VARS,
  getEnvFilePath,
  getProjectDir,
  isRemoteEnvironment,
  persistEnvVar,
  persistEnvVars,
} from "./core/env.js";
export {
  LOG_LEVELS,
  type LogEvent,
  type LogEventError,
  type LogEventHandler,
  Logger,
  type LoggerConfig,
  type LogLevel,
  logger,
  type Unsubscribe,
} from "./core/logger.js";
export { parseStdinJson, readStdin } from "./core/stdin.js";
export {
  type FinalizedResult,
  HookBlockError,
  type HookOutcome,
  type Transport,
} from "./core/transport.js";
export type {
  HookConfig,
  HookContext,
  HookErrorPhase,
  HookFunction,
  HookHandler,
  HookPolicyGate,
  UnexpectedErrorHandler,
  UnexpectedErrorPolicy,
} from "./core/types.js";
