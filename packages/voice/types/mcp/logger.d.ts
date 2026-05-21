/**
 * JSONL diagnostic logger for the voice MCP server.
 *
 * When `VOICE_SERVER_LOG_PATH` is set, controller events and errors are
 * appended as JSONL records. `transcript.delta` events are excluded (they are
 * high-frequency partial-transcript noise). When unset, the logger is a no-op.
 *
 * IMPORTANT: this never writes to stdout — stdout carries the MCP JSON-RPC
 * stream. Records go to the configured file; internal failures go to stderr.
 */
export interface DiagnosticLogger {
    /** Append a controller-event record (skips `transcript.delta`). */
    logEvent(record: {
        seq: number;
        event: string;
        timestamp: string;
        data: unknown;
    }): void;
    /** Append an error record. */
    logError(message: string, meta?: Record<string, unknown>): void;
}
/**
 * Creates a diagnostic logger that appends JSONL to `logPath`.
 *
 * @param logPath - Absolute log file path, or undefined to disable logging.
 * @returns A logger; a no-op logger when `logPath` is undefined.
 */
export declare function createDiagnosticLogger(logPath: string | undefined): DiagnosticLogger;
