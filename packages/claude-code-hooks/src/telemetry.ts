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

// ============================================================================
// OpenTelemetry API Imports
// ============================================================================

import type { Logger as OTelLogger } from '@opentelemetry/api-logs';
import {
  type Meter,
  type Counter,
  type Histogram,
  metrics,
  DiagConsoleLogger,
  DiagLogLevel,
  diag
} from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { LoggerProvider, SimpleLogRecordProcessor, ConsoleLogRecordExporter } from '@opentelemetry/sdk-logs';
import { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

// SDK imports - loaded at module init but only used when telemetry is enabled

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Constants
// ============================================================================

/**
 * Default OTLP endpoint.
 */
const DEFAULT_OTLP_ENDPOINT = 'http://localhost:4318';

/**
 * Default service name.
 */
const DEFAULT_SERVICE_NAME = 'claude-code-hooks';

/**
 * Default service version.
 */
const DEFAULT_SERVICE_VERSION = '0.0.1';

/**
 * Metric names used by the telemetry system.
 */
export const METRIC_NAMES = {
  /** Counter for hook invocations by type */
  INVOCATIONS: 'claude_code_hooks.invocations',
  /** Histogram for handler execution time in milliseconds */
  DURATION_MS: 'claude_code_hooks.duration_ms',
  /** Counter for handler errors by type */
  ERRORS: 'claude_code_hooks.errors',
  /** Counter for exit codes by hook type */
  EXIT_CODES: 'claude_code_hooks.exit_codes'
} as const;

// ============================================================================
// Module State
// ============================================================================

/**
 * Whether the SDK has been initialized.
 */
let initialized = false;

/**
 * Whether initialization is in progress.
 */
let initializing = false;

/**
 * Current telemetry configuration.
 */
let currentConfig: TelemetryConfig | null = null;

/**
 * OpenTelemetry meter instance.
 */
let meter: Meter | null = null;

/**
 * OpenTelemetry logger instance for log events.
 */
let otelLogger: OTelLogger | null = null;

/**
 * Node SDK instance (for shutdown).
 */
let sdkInstance: { shutdown: () => Promise<void> } | null = null;

// ============================================================================
// Metrics
// ============================================================================

/**
 * Counter for hook invocations.
 */
let invocationsCounter: Counter | null = null;

/**
 * Histogram for handler execution duration.
 */
let durationHistogram: Histogram | null = null;

/**
 * Counter for handler errors.
 */
let errorsCounter: Counter | null = null;

/**
 * Counter for exit codes.
 */
let exitCodesCounter: Counter | null = null;

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Checks if telemetry is enabled via environment variable or config.
 * @param config - Optional explicit configuration
 * @returns Whether telemetry is enabled
 */
function isTelemetryEnabled(config?: TelemetryConfig): boolean {
  if (config?.enabled !== undefined) {
    return config.enabled;
  }
  return process.env['CLAUDE_CODE_HOOKS_ENABLE_TELEMETRY'] === '1';
}

/**
 * Gets the metrics exporter type from config or environment.
 * @param config - Optional explicit configuration
 * @returns Metrics exporter type
 */
function getMetricsExporter(config?: TelemetryConfig): 'otlp' | 'prometheus' | 'console' | 'none' {
  if (config?.metricsExporter !== undefined) {
    return config.metricsExporter;
  }
  const envValue = process.env['OTEL_METRICS_EXPORTER']?.toLowerCase();
  if (envValue === 'otlp' || envValue === 'prometheus' || envValue === 'console') {
    return envValue;
  }
  return 'none';
}

/**
 * Gets the logs exporter type from config or environment.
 * @param config - Optional explicit configuration
 * @returns Logs exporter type
 */
function getLogsExporter(config?: TelemetryConfig): 'otlp' | 'console' | 'none' {
  if (config?.logsExporter !== undefined) {
    return config.logsExporter;
  }
  const envValue = process.env['OTEL_LOGS_EXPORTER']?.toLowerCase();
  if (envValue === 'otlp' || envValue === 'console') {
    return envValue;
  }
  return 'none';
}

/**
 * Gets the OTLP endpoint from config or environment.
 * @param config - Optional explicit configuration
 * @returns OTLP endpoint URL
 */
function getOtlpEndpoint(config?: TelemetryConfig): string {
  return config?.otlpEndpoint ?? process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? DEFAULT_OTLP_ENDPOINT;
}

/**
 * Gets the service name from config or environment.
 * @param config - Optional explicit configuration
 * @returns Service name
 */
function getServiceName(config?: TelemetryConfig): string {
  return config?.serviceName ?? process.env['OTEL_SERVICE_NAME'] ?? DEFAULT_SERVICE_NAME;
}

/**
 * Gets the service version from config.
 * @param config - Optional explicit configuration
 * @returns Service version
 */
function getServiceVersion(config?: TelemetryConfig): string {
  return config?.serviceVersion ?? DEFAULT_SERVICE_VERSION;
}

// ============================================================================
// SDK Initialization
// ============================================================================

/**
 * Creates the OpenTelemetry resource with service attributes.
 * @param config - Telemetry configuration
 * @returns Resource instance
 */
function createResource(config?: TelemetryConfig): Resource {
  return new Resource({
    [ATTR_SERVICE_NAME]: getServiceName(config),
    [ATTR_SERVICE_VERSION]: getServiceVersion(config)
  });
}

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
export function initializeTelemetry(config?: TelemetryConfig): void {
  // Skip if not enabled
  if (!isTelemetryEnabled(config)) {
    return;
  }

  // Skip if already initialized or initializing
  if (initialized || initializing) {
    return;
  }

  initializing = true;

  try {
    currentConfig = config ?? {};

    // Enable diagnostic logging for debugging (only in development)
    if (process.env['OTEL_LOG_LEVEL'] === 'debug') {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    // Initialize metrics and logs providers
    initializeMetricsProvider(config);
    initializeLogsProvider(config);

    // Create meters and loggers
    meter = metrics.getMeter(getServiceName(config), getServiceVersion(config));
    otelLogger = logs.getLogger(getServiceName(config), getServiceVersion(config));

    // Create metric instruments
    createMetricInstruments();

    // Register shutdown handler
    registerShutdownHandler();

    initialized = true;
  } finally {
    initializing = false;
  }
}

/**
 * Initializes the metrics provider based on configuration.
 * @param config - Telemetry configuration
 */
function initializeMetricsProvider(config?: TelemetryConfig): void {
  const exporterType = getMetricsExporter(config);

  if (exporterType === 'none') {
    return;
  }

  const resource = createResource(config);

  let metricReader;

  if (exporterType === 'otlp') {
    const exporter = new OTLPMetricExporter({
      url: `${getOtlpEndpoint(config)}/v1/metrics`
    });
    metricReader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 60000 // Export every 60 seconds
    });
  } else if (exporterType === 'prometheus') {
    metricReader = new PrometheusExporter({
      port: 9464 // Default Prometheus port
    });
  } else if (exporterType === 'console') {
    metricReader = new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 10000 // Export every 10 seconds for console
    });
  }

  if (metricReader) {
    const meterProvider = new MeterProvider({
      resource,
      readers: [metricReader]
    });

    metrics.setGlobalMeterProvider(meterProvider);

    // Store SDK for shutdown
    sdkInstance = {
      shutdown: async () => {
        await meterProvider.shutdown();
      }
    };
  }
}

/**
 * Initializes the logs provider based on configuration.
 * @param config - Telemetry configuration
 */
function initializeLogsProvider(config?: TelemetryConfig): void {
  const exporterType = getLogsExporter(config);

  if (exporterType === 'none') {
    return;
  }

  const resource = createResource(config);

  let logRecordProcessor;

  if (exporterType === 'otlp') {
    const exporter = new OTLPLogExporter({
      url: `${getOtlpEndpoint(config)}/v1/logs`
    });
    logRecordProcessor = new SimpleLogRecordProcessor(exporter);
  } else if (exporterType === 'console') {
    logRecordProcessor = new SimpleLogRecordProcessor(new ConsoleLogRecordExporter());
  }

  if (logRecordProcessor) {
    const loggerProvider = new LoggerProvider({
      resource
    });

    loggerProvider.addLogRecordProcessor(logRecordProcessor);
    logs.setGlobalLoggerProvider(loggerProvider);

    // Update SDK shutdown to include logs
    const existingShutdown = sdkInstance?.shutdown;
    sdkInstance = {
      shutdown: async () => {
        await existingShutdown?.();
        await loggerProvider.shutdown();
      }
    };
  }
}

/**
 * Creates the metric instruments.
 */
function createMetricInstruments(): void {
  if (!meter) {
    return;
  }

  invocationsCounter = meter.createCounter(METRIC_NAMES.INVOCATIONS, {
    description: 'Number of hook invocations by type',
    unit: '1'
  });

  durationHistogram = meter.createHistogram(METRIC_NAMES.DURATION_MS, {
    description: 'Handler execution time in milliseconds',
    unit: 'ms'
  });

  errorsCounter = meter.createCounter(METRIC_NAMES.ERRORS, {
    description: 'Number of handler errors by type',
    unit: '1'
  });

  exitCodesCounter = meter.createCounter(METRIC_NAMES.EXIT_CODES, {
    description: 'Number of exit codes by hook type',
    unit: '1'
  });
}

/**
 * Registers the process shutdown handler.
 */
function registerShutdownHandler(): void {
  const shutdown = async () => {
    await shutdownTelemetry();
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
  process.on('beforeExit', () => void shutdown());
}

// ============================================================================
// Public API - Metrics
// ============================================================================

/**
 * Ensures telemetry is initialized before recording.
 * Uses lazy initialization to avoid startup latency.
 */
function ensureInitialized(): void {
  if (!initialized && !initializing && isTelemetryEnabled(currentConfig ?? undefined)) {
    initializeTelemetry(currentConfig ?? undefined);
  }
}

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
export function recordInvocation(
  hookType: HookEventName,
  attributes?: Record<string, string | number | boolean>
): void {
  ensureInitialized();

  if (!invocationsCounter) {
    return;
  }

  invocationsCounter.add(1, {
    hook_type: hookType,
    ...attributes
  });
}

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
export function recordDuration(
  hookType: HookEventName,
  durationMs: number,
  attributes?: Record<string, string | number | boolean>
): void {
  ensureInitialized();

  if (!durationHistogram) {
    return;
  }

  durationHistogram.record(durationMs, {
    hook_type: hookType,
    ...attributes
  });
}

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
export function recordError(
  hookType: HookEventName,
  errorType: string,
  attributes?: Record<string, string | number | boolean>
): void {
  ensureInitialized();

  if (!errorsCounter) {
    return;
  }

  errorsCounter.add(1, {
    hook_type: hookType,
    error_type: errorType,
    ...attributes
  });
}

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
export function recordExitCode(
  hookType: HookEventName,
  exitCode: ExitCode,
  attributes?: Record<string, string | number | boolean>
): void {
  ensureInitialized();

  if (!exitCodesCounter) {
    return;
  }

  exitCodesCounter.add(1, {
    hook_type: hookType,
    exit_code: exitCode,
    ...attributes
  });
}

// ============================================================================
// Public API - Log Events
// ============================================================================

/**
 * Maps LogEvent level to OpenTelemetry SeverityNumber.
 * @param level - Log level from LogEvent
 * @returns OpenTelemetry severity number
 */
function mapSeverity(level: LogEvent['level']): SeverityNumber {
  switch (level) {
    case 'debug':
      return SeverityNumber.DEBUG;
    case 'info':
      return SeverityNumber.INFO;
    case 'warn':
      return SeverityNumber.WARN;
    case 'error':
      return SeverityNumber.ERROR;
    default:
      return SeverityNumber.UNSPECIFIED;
  }
}

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
export function emitLogEvent(event: LogEvent): void {
  ensureInitialized();

  if (!otelLogger) {
    return;
  }

  otelLogger.emit({
    severityNumber: mapSeverity(event.level),
    severityText: event.level.toUpperCase(),
    body: event.message,
    attributes: {
      'hook.type': event.hookType ?? 'unknown',
      'log.timestamp': event.timestamp,
      ...(event.context ? { 'log.context': JSON.stringify(event.context) } : {}),
      ...(event.error
        ? {
            'error.name': event.error.name,
            'error.message': event.error.message,
            'error.stack': event.error.stack ?? ''
          }
        : {})
    }
  });
}

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
export function emitHookStart(hookType: HookEventName, input?: Record<string, unknown>): void {
  ensureInitialized();

  if (!otelLogger) {
    return;
  }

  otelLogger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    body: `Hook ${hookType} started`,
    attributes: {
      'hook.type': hookType,
      'hook.phase': 'start',
      ...(input ? { 'hook.input': JSON.stringify(input) } : {})
    }
  });
}

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
export function emitHookEnd(hookType: HookEventName, exitCode: ExitCode, durationMs: number): void {
  ensureInitialized();

  if (!otelLogger) {
    return;
  }

  otelLogger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    body: `Hook ${hookType} completed`,
    attributes: {
      'hook.type': hookType,
      'hook.phase': 'end',
      'hook.exit_code': exitCode,
      'hook.duration_ms': durationMs
    }
  });
}

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
export function emitHandlerError(hookType: HookEventName, error: unknown, context?: Record<string, unknown>): void {
  ensureInitialized();

  if (!otelLogger) {
    return;
  }

  const errorInfo =
    error instanceof Error
      ? {
          'error.name': error.name,
          'error.message': error.message,
          'error.stack': error.stack ?? ''
        }
      : {
          'error.name': 'UnknownError',
          'error.message': String(error)
        };

  otelLogger.emit({
    severityNumber: SeverityNumber.ERROR,
    severityText: 'ERROR',
    body: `Handler error in ${hookType}: ${error instanceof Error ? error.message : String(error)}`,
    attributes: {
      'hook.type': hookType,
      ...errorInfo,
      ...(context ? { 'error.context': JSON.stringify(context) } : {})
    }
  });
}

// ============================================================================
// Shutdown
// ============================================================================

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
export async function shutdownTelemetry(): Promise<void> {
  if (!initialized || !sdkInstance) {
    return;
  }

  try {
    await sdkInstance.shutdown();
  } catch {
    // Silently ignore shutdown errors to not disrupt hook execution
  } finally {
    initialized = false;
    initializing = false;
    meter = null;
    otelLogger = null;
    sdkInstance = null;
    invocationsCounter = null;
    durationHistogram = null;
    errorsCounter = null;
    exitCodesCounter = null;
  }
}

// ============================================================================
// Logger Integration
// ============================================================================

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
export function createTelemetryEmitter(): ((event: LogEvent) => void) | null {
  if (!isTelemetryEnabled(currentConfig ?? undefined)) {
    return null;
  }

  return emitLogEvent;
}

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
export function wireLoggerTelemetry(loggerInstance: { telemetryEmitter: ((event: LogEvent) => void) | null }): void {
  const emitter = createTelemetryEmitter();
  if (emitter) {
    loggerInstance.telemetryEmitter = emitter;
  }
}

// ============================================================================
// Status Check
// ============================================================================

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
export function isTelemetryInitialized(): boolean {
  return initialized;
}

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
export function isTelemetryEnabledCheck(): boolean {
  return isTelemetryEnabled(currentConfig ?? undefined);
}
