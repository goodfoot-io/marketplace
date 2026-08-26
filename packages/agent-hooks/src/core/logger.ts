/**
 * Logger system for agent hooks.
 *
 * Provides structured logging with event subscription and optional file output.
 * The logger is **silent by default** to avoid interfering with hook protocol
 * (stdout is reserved for JSON responses, stderr may conflict with the host
 * CLI).
 * @module
 * @example
 * ```typescript
 * import { logger } from '@goodfoot/agent-hooks';
 *
 * // Subscribe to log events
 * const unsubscribe = logger.on('error', (event) => {
 *   console.error(`Error in ${event.hookType}: ${event.message}`);
 * });
 *
 * // Later, clean up
 * unsubscribe();
 * ```
 */

import { closeSync, existsSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname } from "node:path";

// ============================================================================
// Log Level Types
// ============================================================================

/**
 * Available log levels.
 *
 * | Level | Severity | Use Case |
 * |-------|----------|----------|
 * | `debug` | Lowest | Detailed debugging information |
 * | `info` | Low | General operational events |
 * | `warn` | Medium | Warning conditions that may indicate issues |
 * | `error` | High | Error conditions requiring attention |
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * All log levels in order of severity (lowest to highest).
 */
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const satisfies readonly LogLevel[];

// ============================================================================
// Log Event Type
// ============================================================================

/**
 * A structured log event emitted by the logger.
 *
 * Log events contain contextual information about what happened during hook
 * execution, making them suitable for debugging, monitoring, and analytics.
 * @example
 * ```typescript
 * // Example log event
 * const event: LogEvent = {
 *   timestamp: '2024-01-15T10:30:00.000Z',
 *   level: 'warn',
 *   hookType: 'PreToolUse',
 *   message: 'Blocking dangerous command',
 *   input: { tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }
 * };
 * ```
 */
export interface LogEvent {
  /**
   * ISO 8601 timestamp of when the event occurred.
   * @example '2024-01-15T10:30:00.000Z'
   */
  timestamp: string;

  /**
   * Severity level of the log event.
   */
  level: LogLevel;

  /**
   * Agent event name of the hook that generated this event.
   * May be undefined for events outside hook context.
   */
  hookType?: string;

  /**
   * Human-readable description of what happened.
   */
  message: string;

  /**
   * Hook input data at the time of logging.
   * Useful for debugging and reproducing issues.
   */
  input?: Record<string, unknown>;

  /**
   * Error information if this event represents an error.
   * Contains structured error details for analysis.
   */
  error?: LogEventError;

  /**
   * Additional context data provided by the caller.
   * Can contain arbitrary metadata relevant to the event.
   */
  context?: Record<string, unknown>;
}

/**
 * Structured error information within a log event.
 */
export interface LogEventError {
  /**
   * Error name (e.g., 'TypeError', 'ValidationError').
   */
  name: string;

  /**
   * Error message describing what went wrong.
   */
  message: string;

  /**
   * Stack trace if available.
   */
  stack?: string;

  /**
   * Error cause chain if the error was wrapped.
   */
  cause?: LogEventError;
}

// ============================================================================
// Event Handler Type
// ============================================================================

/**
 * Handler function invoked when a log event is emitted.
 *
 * Handlers receive log events and can process them in any way - forwarding
 * to external services, writing to custom formats, or aggregating metrics.
 * @param event - The log event to handle
 * @example
 * ```typescript
 * // Forward to external logging service
 * const handler: LogEventHandler = (event) => {
 *   externalLogger.log({
 *     level: event.level,
 *     message: event.message,
 *     metadata: { hookType: event.hookType }
 *   });
 * };
 * ```
 */
export type LogEventHandler = (event: LogEvent) => void;

/**
 * Function to unsubscribe a log event handler.
 *
 * Call this function to stop receiving log events. Always call unsubscribe
 * when the handler is no longer needed to prevent memory leaks.
 * @example
 * ```typescript
 * const unsubscribe = logger.on('error', handleError);
 * // ... later
 * unsubscribe(); // Stop receiving events
 * ```
 */
export type Unsubscribe = () => void;

// ============================================================================
// Logger Configuration
// ============================================================================

/**
 * Configuration options for the Logger.
 */
export interface LoggerConfig {
  /**
   * Path to the log file for file output.
   * If not set, file logging is disabled.
   */
  logFilePath?: string;
  /**
   * Name of the environment variable to read for the log file path.
   * When set, the Logger reads `process.env[logEnvVar]` at construction time.
   * Ignored if `logFilePath` is also provided.
   * Defaults to `'AGENT_HOOKS_LOG_FILE'` for the exported singleton.
   */
  logEnvVar?: string;
}

// ============================================================================
// Logger Class
// ============================================================================

/**
 * Logger for agent hooks with event subscription and file output.
 *
 * ## Key Behaviors
 *
 * | Configuration | Behavior |
 * |--------------|----------|
 * | No config (default) | **Silent** - no output anywhere |
 * | `AGENT_HOOKS_LOG_FILE` env var | Append JSON lines to file |
 * | `.on(level, handler)` registered | Events delivered to handlers only |
 * | Multiple destinations | All destinations receive events |
 *
 * ## Important Notes
 *
 * - **Never outputs to stdout** (reserved for JSON hook response)
 * - **Never outputs to stderr** (may interfere with host CLI error handling)
 * - File output uses JSON Lines format for easy parsing
 * - `.on(level, handler)` returns an unsubscribe function
 * @example
 * ```typescript
 * import { logger } from '@goodfoot/agent-hooks';
 *
 * // Subscribe to events at specific level
 * logger.on('warn', (event) => {
 *   sendAlert(event.message);
 * });
 *
 * // Log within a hook handler
 * export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   logger.warn('About to validate Bash command');
 *   return preToolUseOutput({ allow: true });
 * });
 * ```
 */
export class Logger {
  /**
   * Registered event handlers by log level.
   */
  private handlers: Map<LogLevel, Set<LogEventHandler>> = new Map();

  /**
   * File descriptor for log file output.
   * Lazily initialized on first write.
   */
  private logFileFd: number | null = null;

  /**
   * Path to the log file, if configured.
   */
  private logFilePath: string | null = null;

  /**
   * Whether file initialization has been attempted.
   */
  private fileInitialized = false;

  /**
   * Current hook context for enriching log events.
   */
  private currentHookType: string | undefined;

  /**
   * Current hook input for enriching log events.
   */
  private currentInput: Record<string, unknown> | undefined;

  /**
   * Creates a new Logger instance.
   *
   * Typically you should use the exported `logger` singleton rather than
   * creating new instances.
   * @param config - Optional configuration
   * @example
   * ```typescript
   * // Use singleton (recommended)
   * import { logger } from '@goodfoot/agent-hooks';
   *
   * // Or create custom instance
   * const customLogger = new Logger({ logFilePath: '/var/log/hooks.log' });
   * ```
   */
  constructor(config: LoggerConfig = {}) {
    // Initialize handlers map for each level
    for (const level of LOG_LEVELS) {
      this.handlers.set(level, new Set());
    }

    // Set log file path from explicit config, or by reading the configured env var
    this.logFilePath = config.logFilePath ?? (config.logEnvVar ? process.env[config.logEnvVar] : undefined) ?? null;
  }

  /**
   * Logs a debug message.
   *
   * Use for detailed debugging information that is typically only useful
   * during development or troubleshooting.
   * @param message - The debug message
   * @param context - Optional additional context
   * @example
   * ```typescript
   * logger.debug('Processing tool input', { toolName: 'Bash', inputSize: 256 });
   * ```
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.emit("debug", message, context);
  }

  /**
   * Logs an info message.
   *
   * Use for general operational events like hook invocations, successful
   * completions, or state changes.
   * @param message - The info message
   * @param context - Optional additional context
   * @example
   * ```typescript
   * logger.info('Session started', { source: 'startup', sessionId: 'abc123' });
   * ```
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.emit("info", message, context);
  }

  /**
   * Logs a warning message.
   *
   * Use for conditions that may indicate issues but don't prevent
   * operation, such as deprecated patterns or performance concerns.
   * @param message - The warning message
   * @param context - Optional additional context
   * @example
   * ```typescript
   * logger.warn('Deprecated hook pattern detected', { pattern: 'legacyMatcher' });
   * ```
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.emit("warn", message, context);
  }

  /**
   * Logs an error message.
   *
   * Use for error conditions that require attention but were handled
   * gracefully. For exceptions, prefer {@link logError}.
   * @param message - The error message
   * @param context - Optional additional context
   * @example
   * ```typescript
   * logger.error('Failed to validate tool input', { toolName: 'Bash', reason: 'empty command' });
   * ```
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.emit("error", message, context);
  }

  /**
   * Logs a structured error with full error details.
   *
   * Use this method when logging caught exceptions to capture the full
   * error context including name, message, stack trace, and cause chain.
   * @param error - The error to log
   * @param message - Human-readable description of what failed
   * @param context - Optional additional context
   * @example
   * ```typescript
   * try {
   *   await dangerousOperation();
   * } catch (err) {
   *   logger.logError(err, 'Failed to execute dangerous operation', {
   *     operation: 'delete',
   *     target: '/important/file.txt'
   *   });
   * }
   * ```
   */
  logError(error: unknown, message: string, context?: Record<string, unknown>): void {
    const errorInfo = this.extractErrorInfo(error);

    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level: "error",
      hookType: this.currentHookType,
      message,
      input: this.currentInput,
      error: errorInfo,
      context,
    };

    this.deliverEvent(event);
  }

  /**
   * Subscribes a handler to log events at the specified level.
   *
   * The handler will be called for every log event at the specified level.
   * Returns an unsubscribe function that should be called when the handler
   * is no longer needed.
   * @param level - The log level to subscribe to
   * @param handler - The handler function to call for each event
   * @returns A function to unsubscribe the handler
   * @example
   * ```typescript
   * // Subscribe to error events
   * const unsubscribe = logger.on('error', (event) => {
   *   console.error(`[${event.hookType}] ${event.message}`);
   *   if (event.error) {
   *     console.error(event.error.stack);
   *   }
   * });
   *
   * // Later, clean up
   * unsubscribe();
   * ```
   * @example
   * ```typescript
   * // Forward to external logging library
   * import pino from 'pino';
   * const pinoLogger = pino();
   *
   * logger.on('info', (event) => pinoLogger.info(event, event.message));
   * logger.on('warn', (event) => pinoLogger.warn(event, event.message));
   * logger.on('error', (event) => pinoLogger.error(event, event.message));
   * ```
   */
  on(level: LogLevel, handler: LogEventHandler): Unsubscribe {
    const levelHandlers = this.handlers.get(level);
    if (levelHandlers) {
      levelHandlers.add(handler);
    }

    return () => {
      levelHandlers?.delete(handler);
    };
  }

  /**
   * Sets the current hook context for enriching log events.
   *
   * This is called internally by the runtime before invoking hook handlers.
   * You typically don't need to call this directly.
   * @param hookType - The agent event name being executed
   * @param input - The hook input data
   * @internal
   */
  setContext(hookType: string | undefined, input: Record<string, unknown> | undefined): void {
    this.currentHookType = hookType;
    this.currentInput = input;
  }

  /**
   * Clears the current hook context.
   *
   * Called internally by the runtime after hook execution completes.
   * @internal
   */
  clearContext(): void {
    this.currentHookType = undefined;
    this.currentInput = undefined;
  }

  /**
   * Configures the log file path at runtime.
   *
   * Call this to enable or change file logging. Setting to `null` disables
   * file logging (but doesn't close existing file handle immediately).
   * @param filePath - Path to the log file, or null to disable
   * @example
   * ```typescript
   * // Enable file logging at runtime
   * logger.setLogFile('/var/log/agent-hooks.log');
   *
   * // Disable file logging
   * logger.setLogFile(null);
   * ```
   */
  setLogFile(filePath: string | null): void {
    // Close existing file if open
    if (this.logFileFd !== null) {
      try {
        closeSync(this.logFileFd);
      } catch (closeError) {
        process.stderr.write(`[agent-hooks] Failed to close log file: ${String(closeError)}\n`);
      }
      this.logFileFd = null;
    }

    this.logFilePath = filePath;
    this.fileInitialized = false;
  }

  /**
   * Closes all resources held by the logger.
   *
   * Call this during graceful shutdown to ensure all log data is flushed.
   * @example
   * ```typescript
   * process.on('exit', () => {
   *   logger.close();
   * });
   * ```
   */
  close(): void {
    if (this.logFileFd !== null) {
      try {
        closeSync(this.logFileFd);
      } catch (closeError) {
        process.stderr.write(`[agent-hooks] Failed to close log file: ${String(closeError)}\n`);
      }
      this.logFileFd = null;
    }
    this.fileInitialized = false;
  }

  /**
   * Checks if there are any active handlers or destinations.
   *
   * Returns true if any handlers are registered or file logging is enabled.
   * @returns Whether the logger has any active output destinations
   */
  hasDestinations(): boolean {
    for (const handlers of this.handlers.values()) {
      if (handlers.size > 0) return true;
    }
    return this.logFilePath !== null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Emits a log event.
   * @param level - The severity level of the event
   * @param message - The log message
   * @param context - Optional additional context data
   */
  private emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      hookType: this.currentHookType,
      message,
      input: this.currentInput,
      context,
    };

    this.deliverEvent(event);
  }

  /**
   * Delivers an event to all registered destinations.
   * @param event - The log event to deliver
   */
  private deliverEvent(event: LogEvent): void {
    // Deliver to event handlers
    const levelHandlers = this.handlers.get(event.level);
    if (levelHandlers) {
      for (const handler of levelHandlers) {
        try {
          handler(event);
        } catch (handlerError) {
          process.stderr.write(`[agent-hooks] Log handler error: ${String(handlerError)}\n`);
        }
      }
    }

    // Write to file if configured
    this.writeToFile(event);
  }

  /**
   * Writes an event to the log file.
   * @param event - The log event to write
   */
  private writeToFile(event: LogEvent): void {
    if (!this.logFilePath) return;

    // Lazy initialization of file handle
    if (!this.fileInitialized) {
      this.initializeFile();
    }

    if (this.logFileFd === null) return;

    try {
      const line = `${JSON.stringify(event)}\n`;
      writeSync(this.logFileFd, line);
    } catch (writeError) {
      // Disable file logging after a write failure to avoid repeated errors
      this.logFileFd = null;
      this.fileInitialized = false;
      process.stderr.write(`[agent-hooks] Log file write failed: ${String(writeError)}\n`);
    }
  }

  /**
   * Initializes the log file for writing.
   */
  private initializeFile(): void {
    this.fileInitialized = true;

    if (!this.logFilePath) return;

    try {
      // Ensure directory exists
      const dir = dirname(this.logFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Open file for appending
      this.logFileFd = openSync(this.logFilePath, "a");
    } catch {
      // Silently ignore file initialization errors
      this.logFileFd = null;
    }
  }

  /**
   * Extracts structured error information from an unknown error.
   * @param error - The error to extract information from
   * @returns Structured error information
   */
  private extractErrorInfo(error: unknown): LogEventError {
    if (error instanceof Error) {
      const info: LogEventError = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };

      // Extract cause chain if present
      if (error.cause !== undefined) {
        info.cause = this.extractErrorInfo(error.cause);
      }

      return info;
    }

    // Handle non-Error values
    return {
      name: "UnknownError",
      message: String(error),
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global logger instance for agent hooks.
 *
 * Use this singleton for all logging within hooks. The logger is configured
 * via environment variables and supports event subscription for custom
 * destinations.
 *
 * ## Configuration
 *
 * | Environment Variable | Description |
 * |---------------------|-------------|
 * | `AGENT_HOOKS_LOG_FILE` | Path to log file (JSON Lines format) |
 *
 * ## Usage in Hooks
 *
 * The logger is passed to hook handlers via context for convenience:
 *
 * ```typescript
 * export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
 *   logger.warn('Validating Bash command');
 *   return preToolUseOutput({ allow: true });
 * });
 * ```
 *
 * ## External Integration
 *
 * Subscribe to events to forward logs to external systems:
 *
 * ```typescript
 * import { logger } from '@goodfoot/agent-hooks';
 * import pino from 'pino';
 *
 * const pinoLogger = pino({ level: 'debug' });
 *
 * logger.on('debug', (event) => pinoLogger.debug(event, event.message));
 * logger.on('info', (event) => pinoLogger.info(event, event.message));
 * logger.on('warn', (event) => pinoLogger.warn(event, event.message));
 * logger.on('error', (event) => pinoLogger.error(event, event.message));
 * ```
 * @example
 * ```typescript
 * // Direct usage
 * import { logger } from '@goodfoot/agent-hooks';
 *
 * logger.info('Starting operation');
 * logger.warn('Resource limit approaching', { usage: 0.9 });
 *
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   logger.logError(err, 'Risky operation failed');
 * }
 * ```
 */
// AGENT_HOOKS_LOG_ENV_VAR is set unconditionally by the --log-env-var banner
// before this module initialises. If absent, fall back to the default env var name.
export const logger = new Logger({
  logEnvVar: process.env.AGENT_HOOKS_LOG_ENV_VAR ?? "AGENT_HOOKS_LOG_FILE",
});
