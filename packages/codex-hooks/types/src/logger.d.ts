import type { HookEventName, HookInput } from "./types.js";
export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogEvent {
    timestamp: string;
    level: LogLevel;
    hookType?: HookEventName;
    message: string;
    input?: Partial<HookInput>;
    context?: Record<string, unknown>;
}
export type LogEventHandler = (event: LogEvent) => void;
export type Unsubscribe = () => void;
export interface LoggerConfig {
    logFilePath?: string;
    logEnvVar?: string;
}
export declare class Logger {
    private handlers;
    private fileInitialized;
    private logFileFd;
    private logFilePath;
    private currentHookType;
    private currentInput;
    constructor(config?: LoggerConfig);
    setContext(hookType: HookEventName, input: Partial<HookInput>): void;
    clearContext(): void;
    on(level: LogLevel, handler: LogEventHandler): Unsubscribe;
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
    logError(error: unknown, message: string, context?: Record<string, unknown>): void;
    close(): void;
    private emit;
    private writeToFile;
}
export declare const logger: Logger;
