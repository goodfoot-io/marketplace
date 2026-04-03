import { closeSync, existsSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname } from "node:path";
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

const DEFAULT_LOG_ENV_VAR = "CODEX_HOOKS_LOG_FILE";

export class Logger {
  private handlers = new Map<LogLevel, Set<LogEventHandler>>();
  private fileInitialized = false;
  private logFileFd: number | null = null;
  private logFilePath: string | null = null;
  private currentHookType: HookEventName | undefined;
  private currentInput: Partial<HookInput> | undefined;

  public constructor(config: LoggerConfig = {}) {
    this.logFilePath = config.logFilePath ?? process.env[config.logEnvVar ?? DEFAULT_LOG_ENV_VAR] ?? null;
  }

  public setContext(hookType: HookEventName, input: Partial<HookInput>): void {
    this.currentHookType = hookType;
    this.currentInput = input;
  }

  public clearContext(): void {
    this.currentHookType = undefined;
    this.currentInput = undefined;
  }

  public on(level: LogLevel, handler: LogEventHandler): Unsubscribe {
    const existing = this.handlers.get(level) ?? new Set<LogEventHandler>();
    existing.add(handler);
    this.handlers.set(level, existing);
    return () => {
      existing.delete(handler);
      if (existing.size === 0) {
        this.handlers.delete(level);
      }
    };
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.emit("debug", message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.emit("info", message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.emit("warn", message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.emit("error", message, context);
  }

  public logError(error: unknown, message: string, context?: Record<string, unknown>): void {
    this.emit("error", `${message}: ${error instanceof Error ? error.message : String(error)}`, context);
  }

  public close(): void {
    if (this.logFileFd !== null) {
      closeSync(this.logFileFd);
      this.logFileFd = null;
    }
  }

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      hookType: this.currentHookType,
      message,
      ...(this.currentInput !== undefined ? { input: this.currentInput } : {}),
      ...(context !== undefined ? { context } : {}),
    };
    this.writeToFile(event);
    this.handlers.get(level)?.forEach((handler) => handler(event));
  }

  private writeToFile(event: LogEvent): void {
    if (this.logFilePath === null) {
      return;
    }
    if (!this.fileInitialized) {
      this.fileInitialized = true;
      const logDir = dirname(this.logFilePath);
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      this.logFileFd = openSync(this.logFilePath, "a");
    }
    if (this.logFileFd !== null) {
      writeSync(this.logFileFd, `${JSON.stringify(event)}\n`);
    }
  }
}

export const logger = new Logger();
