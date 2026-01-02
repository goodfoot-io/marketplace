/**
 * OpenTelemetry integration for Claude Code hooks.
 *
 * Provides metrics and log event export for observability. The SDK initializes
 * lazily on first metric/log event to avoid startup latency when telemetry is
 * disabled. Configure via environment variables or explicit initialization.
 *
 * ## Environment Variables
 *
 * | Variable | Description | Default |
 * |----------|-------------|---------|
 * | `CLAUDE_CODE_HOOKS_ENABLE_TELEMETRY` | Enable telemetry (1 or 0) | 0 |
 * | `OTEL_METRICS_EXPORTER` | Exporter: otlp, prometheus, console, none | none |
 * | `OTEL_LOGS_EXPORTER` | Exporter: otlp, console, none | none |
 * | `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint | http://localhost:4318 |
 * | `OTEL_EXPORTER_OTLP_PROTOCOL` | Protocol: grpc, http/protobuf | http/protobuf |
 * | `OTEL_SERVICE_NAME` | Service name for resource | claude-code-hooks |
 *
 * ## Metrics
 *
 * - `claude_code_hooks.invocations` (counter) - hook invocations by type
 * - `claude_code_hooks.duration_ms` (histogram) - handler execution time
 * - `claude_code_hooks.errors` (counter) - handler errors by type
 * - `claude_code_hooks.exit_codes` (counter) - exit codes by hook type
 * @module
 * @example
 * ```typescript
 * import { initializeTelemetry, recordInvocation, recordDuration } from '@goodfoot/claude-code-hooks/telemetry';
 *
 * // Initialize manually (optional - auto-initializes on first use)
 * await initializeTelemetry();
 *
 * // Record a hook invocation
 * recordInvocation('PreToolUse');
 *
 * // Record handler duration
 * recordDuration('PreToolUse', 150);
 *
 * // Shutdown gracefully
 * await shutdownTelemetry();
 * ```
 * @see https://code.claude.com/docs/en/monitoring
 */
import type { LogEvent } from './logger.js';
import type { ExitCode } from './outputs.js';
import type { HookEventName } from './types/inputs.js';
/**
 * Telemetry configuration options.
 */
export interface TelemetryConfig {
  /**
   * Enable telemetry. Default: false (unless `CLAUDE_CODE_HOOKS_ENABLE_TELEMETRY=1`)
   */
  enabled?: boolean;
  /**
   * Metrics exporter type.
   * @default 'none'
   */
  metricsExporter?: 'otlp' | 'prometheus' | 'console' | 'none';
  /**
   * Logs exporter type.
   * @default 'none'
   */
  logsExporter?: 'otlp' | 'console' | 'none';
  /**
   * OTLP collector endpoint.
   * @default 'http://localhost:4318'
   */
  otlpEndpoint?: string;
  /**
   * OTLP protocol.
   * @default 'http/protobuf'
   */
  otlpProtocol?: 'grpc' | 'http/protobuf';
  /**
   * Service name for resource attributes.
   * @default 'claude-code-hooks'
   */
  serviceName?: string;
  /**
   * Service version for resource attributes.
   * @default package version
   */
  serviceVersion?: string;
}
/**
 * Attributes for metric recording.
 */
export interface MetricAttributes {
  /**
   * Hook type name.
   */
  hookType: HookEventName;
  /**
   * Additional attributes.
   */
  [key: string]: string | number | boolean;
}
/**
 * Metric names used by the telemetry system.
 */
export declare const METRIC_NAMES: {
  /** Counter for hook invocations by type */
  readonly INVOCATIONS: 'claude_code_hooks.invocations';
  /** Histogram for handler execution time in milliseconds */
  readonly DURATION_MS: 'claude_code_hooks.duration_ms';
  /** Counter for handler errors by type */
  readonly ERRORS: 'claude_code_hooks.errors';
  /** Counter for exit codes by hook type */
  readonly EXIT_CODES: 'claude_code_hooks.exit_codes';
};
/**
 * Initializes the OpenTelemetry SDK.
 *
 * This function is called lazily on first metric/log event. It sets up:
 * - Metrics exporter (OTLP, Prometheus, or console)
 * - Logs exporter (OTLP or console)
 * - Resource attributes (service.name, service.version)
 * - Graceful shutdown handler
 *
 * Calling this function multiple times is safe - subsequent calls are no-ops.
 * @param config - Optional explicit configuration (overrides environment variables)
 * @example
 * ```typescript
 * // Initialize with default config from environment
 * initializeTelemetry();
 *
 * // Initialize with explicit config
 * initializeTelemetry({
 *   enabled: true,
 *   metricsExporter: 'otlp',
 *   logsExporter: 'console',
 *   serviceName: 'my-hooks'
 * });
 * ```
 * @see https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
 */
export declare function initializeTelemetry(config?: TelemetryConfig): void;
/**
 * Records a hook invocation.
 *
 * Call this when a hook handler is invoked to track invocation counts by type.
 * @param hookType - The type of hook being invoked
 * @param attributes - Optional additional attributes
 * @example
 * ```typescript
 * recordInvocation('PreToolUse');
 * recordInvocation('SessionStart', { source: 'startup' });
 * ```
 */
export declare function recordInvocation(
  hookType: HookEventName,
  attributes?: Record<string, string | number | boolean>
): void;
/**
 * Records handler execution duration.
 *
 * Call this after a hook handler completes to track execution time.
 * @param hookType - The type of hook that executed
 * @param durationMs - Execution duration in milliseconds
 * @param attributes - Optional additional attributes
 * @example
 * ```typescript
 * const startTime = performance.now();
 * // ... handler execution ...
 * const duration = performance.now() - startTime;
 * recordDuration('PreToolUse', duration);
 * ```
 */
export declare function recordDuration(
  hookType: HookEventName,
  durationMs: number,
  attributes?: Record<string, string | number | boolean>
): void;
/**
 * Records a handler error.
 *
 * Call this when a hook handler throws an exception or encounters an error.
 * @param hookType - The type of hook that errored
 * @param errorType - The type/name of the error (e.g., 'TypeError', 'ValidationError')
 * @param attributes - Optional additional attributes
 * @example
 * ```typescript
 * try {
 *   // ... handler code ...
 * } catch (err) {
 *   recordError('PreToolUse', err instanceof Error ? err.name : 'UnknownError');
 *   throw err;
 * }
 * ```
 */
export declare function recordError(
  hookType: HookEventName,
  errorType: string,
  attributes?: Record<string, string | number | boolean>
): void;
/**
 * Records an exit code.
 *
 * Call this when a hook handler completes to track exit code distribution.
 * @param hookType - The type of hook that completed
 * @param exitCode - The exit code (0=success, 1=error, 2=block)
 * @param attributes - Optional additional attributes
 * @example
 * ```typescript
 * const output = preToolUseOutput({ allow: true });
 * recordExitCode('PreToolUse', output.exitCode);
 * ```
 */
export declare function recordExitCode(
  hookType: HookEventName,
  exitCode: ExitCode,
  attributes?: Record<string, string | number | boolean>
): void;
/**
 * Emits a log event to OpenTelemetry.
 *
 * This function is set as the telemetryEmitter on the logger singleton
 * when telemetry is enabled.
 * @param event - The log event to emit
 * @example
 * ```typescript
 * // Usually called internally by the logger
 * emitLogEvent({
 *   timestamp: new Date().toISOString(),
 *   level: 'info',
 *   hookType: 'PreToolUse',
 *   message: 'Processing tool input'
 * });
 * ```
 */
export declare function emitLogEvent(event: LogEvent): void;
/**
 * Emits a hook invocation start event.
 *
 * Call this when a hook handler begins execution.
 * @param hookType - The type of hook being invoked
 * @param input - Partial input data for context
 * @example
 * ```typescript
 * emitHookStart('PreToolUse', { toolName: 'Bash' });
 * ```
 */
export declare function emitHookStart(hookType: HookEventName, input?: Record<string, unknown>): void;
/**
 * Emits a hook invocation end event.
 *
 * Call this when a hook handler completes execution.
 * @param hookType - The type of hook that completed
 * @param exitCode - The exit code of the handler
 * @param durationMs - Execution duration in milliseconds
 * @example
 * ```typescript
 * emitHookEnd('PreToolUse', 0, 150);
 * ```
 */
export declare function emitHookEnd(hookType: HookEventName, exitCode: ExitCode, durationMs: number): void;
/**
 * Emits a handler error event.
 *
 * Call this when a hook handler throws an exception.
 * @param hookType - The type of hook that errored
 * @param error - The error that was thrown
 * @param context - Optional additional context
 * @example
 * ```typescript
 * try {
 *   // ... handler code ...
 * } catch (err) {
 *   emitHandlerError('PreToolUse', err);
 *   throw err;
 * }
 * ```
 */
export declare function emitHandlerError(
  hookType: HookEventName,
  error: unknown,
  context?: Record<string, unknown>
): void;
/**
 * Shuts down the telemetry SDK gracefully.
 *
 * Call this before process exit to ensure all pending metrics and logs
 * are exported. This is registered automatically on SIGTERM/SIGINT,
 * but can be called manually for testing or explicit cleanup.
 * @example
 * ```typescript
 * // Graceful shutdown
 * await shutdownTelemetry();
 * process.exit(0);
 * ```
 */
export declare function shutdownTelemetry(): Promise<void>;
/**
 * Creates a telemetry emitter function for the logger.
 *
 * This function returns an emitter that can be set on the logger's
 * `telemetryEmitter` property to forward log events to OpenTelemetry.
 * @returns Telemetry emitter function, or null if telemetry is disabled
 * @example
 * ```typescript
 * import { logger } from '@goodfoot/claude-code-hooks';
 * import { createTelemetryEmitter } from '@goodfoot/claude-code-hooks/telemetry';
 *
 * const emitter = createTelemetryEmitter();
 * if (emitter) {
 *   logger.telemetryEmitter = emitter;
 * }
 * ```
 */
export declare function createTelemetryEmitter(): ((event: LogEvent) => void) | null;
/**
 * Wires up the logger to emit events to OpenTelemetry.
 *
 * Call this after initializing telemetry to automatically forward
 * all logger events to OpenTelemetry logs exporter.
 * @param loggerInstance - The logger instance to wire up (must have telemetryEmitter property)
 * @param loggerInstance.telemetryEmitter - The telemetry emitter property to set
 * @example
 * ```typescript
 * import { logger } from '@goodfoot/claude-code-hooks';
 * import { initializeTelemetry, wireLoggerTelemetry } from '@goodfoot/claude-code-hooks/telemetry';
 *
 * initializeTelemetry();
 * wireLoggerTelemetry(logger);
 * ```
 */
export declare function wireLoggerTelemetry(loggerInstance: {
  telemetryEmitter: ((event: LogEvent) => void) | null;
}): void;
/**
 * Checks whether telemetry is currently initialized.
 * @returns True if telemetry has been initialized
 * @example
 * ```typescript
 * if (isTelemetryInitialized()) {
 *   console.log('Telemetry is ready');
 * }
 * ```
 */
export declare function isTelemetryInitialized(): boolean;
/**
 * Checks whether telemetry is enabled.
 * @returns True if telemetry is enabled via config or environment
 * @example
 * ```typescript
 * if (isTelemetryEnabledCheck()) {
 *   console.log('Telemetry will be collected');
 * }
 * ```
 */
export declare function isTelemetryEnabledCheck(): boolean;
//# sourceMappingURL=telemetry.d.ts.map
