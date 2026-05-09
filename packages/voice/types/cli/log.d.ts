/**
 * Optional file logger. Active when VOICE_LOG_PATH is set.
 * Appends JSONL lines to that path. Failures are swallowed so logging
 * can never crash the caller.
 */
export declare function isLogEnabled(): boolean;
export declare function logLine(record: Record<string, unknown>): void;
export declare function logEvent(source: string, event: string, data: unknown): void;
export declare function logError(source: string, context: string, err: unknown): void;
/**
 * Mirror stdout and stderr writes from this process to VOICE_LOG_PATH.
 * Originals still go to the underlying terminal/pipe — the log file is
 * an additional sink. No-op if VOICE_LOG_PATH is unset.
 */
export declare function mirrorStdio(): void;
