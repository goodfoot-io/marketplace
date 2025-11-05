/**
 * Optional logging system for MCP wrapper server
 * Controlled by MCP_WRAPPER_SERVER_LOGGING environment variable
 */

const isLoggingEnabled = process.env.MCP_WRAPPER_SERVER_LOGGING === 'true';

/**
 * Log debug message to stderr (when logging enabled)
 */
export function debug(message: string, ...args: unknown[]): void {
  if (isLoggingEnabled) {
    console.error('[DEBUG]', message, ...args);
  }
}

/**
 * Log info message to stderr (when logging enabled)
 */
export function info(message: string, ...args: unknown[]): void {
  if (isLoggingEnabled) {
    console.error('[INFO]', message, ...args);
  }
}

/**
 * Log warning message to stderr (when logging enabled)
 */
export function warn(message: string, ...args: unknown[]): void {
  if (isLoggingEnabled) {
    console.error('[WARN]', message, ...args);
  }
}

/**
 * Log error message to stderr (when logging enabled)
 */
export function error(message: string, ...args: unknown[]): void {
  if (isLoggingEnabled) {
    console.error('[ERROR]', message, ...args);
  }
}
