#!/usr/bin/env -S node --enable-source-maps
import { createRequire as __createRequire } from "node:module";
import { fileURLToPath as __fileURLToPath } from "node:url";
import { dirname as __pathDirname } from "node:path";
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);

// packages/expansion-hooks/src/user-prompt-submit.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";

// node_modules/@goodfoot/agent-hooks/dist/core/logger.js
import { closeSync, existsSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname } from "node:path";
var LOG_LEVELS = ["debug", "info", "warn", "error"];
var Logger = class {
  /**
   * Registered event handlers by log level.
   */
  handlers = /* @__PURE__ */ new Map();
  /**
   * File descriptor for log file output.
   * Lazily initialized on first write.
   */
  logFileFd = null;
  /**
   * Path to the log file, if configured.
   */
  logFilePath = null;
  /**
   * Whether file initialization has been attempted.
   */
  fileInitialized = false;
  /**
   * Current hook context for enriching log events.
   */
  currentHookType;
  /**
   * Current hook input for enriching log events.
   */
  currentInput;
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
  constructor(config = {}) {
    for (const level of LOG_LEVELS) {
      this.handlers.set(level, /* @__PURE__ */ new Set());
    }
    this.logFilePath = config.logFilePath ?? (config.logEnvVar ? process.env[config.logEnvVar] : void 0) ?? null;
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
  debug(message, context) {
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
  info(message, context) {
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
  warn(message, context) {
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
  error(message, context) {
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
  logError(error, message, context) {
    const errorInfo = this.extractErrorInfo(error);
    const event = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level: "error",
      hookType: this.currentHookType,
      message,
      input: this.currentInput,
      error: errorInfo,
      context
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
  on(level, handler) {
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
  setContext(hookType, input) {
    this.currentHookType = hookType;
    this.currentInput = input;
  }
  /**
   * Clears the current hook context.
   *
   * Called internally by the runtime after hook execution completes.
   * @internal
   */
  clearContext() {
    this.currentHookType = void 0;
    this.currentInput = void 0;
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
  setLogFile(filePath) {
    if (this.logFileFd !== null) {
      try {
        closeSync(this.logFileFd);
      } catch (closeError) {
        process.stderr.write(`[agent-hooks] Failed to close log file: ${String(closeError)}
`);
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
  close() {
    if (this.logFileFd !== null) {
      try {
        closeSync(this.logFileFd);
      } catch (closeError) {
        process.stderr.write(`[agent-hooks] Failed to close log file: ${String(closeError)}
`);
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
  hasDestinations() {
    for (const handlers of this.handlers.values()) {
      if (handlers.size > 0)
        return true;
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
  emit(level, message, context) {
    const event = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      hookType: this.currentHookType,
      message,
      input: this.currentInput,
      context
    };
    this.deliverEvent(event);
  }
  /**
   * Delivers an event to all registered destinations.
   * @param event - The log event to deliver
   */
  deliverEvent(event) {
    const levelHandlers = this.handlers.get(event.level);
    if (levelHandlers) {
      for (const handler of levelHandlers) {
        try {
          handler(event);
        } catch (handlerError) {
          process.stderr.write(`[agent-hooks] Log handler error: ${String(handlerError)}
`);
        }
      }
    }
    this.writeToFile(event);
  }
  /**
   * Writes an event to the log file.
   * @param event - The log event to write
   */
  writeToFile(event) {
    if (!this.logFilePath)
      return;
    if (!this.fileInitialized) {
      this.initializeFile();
    }
    if (this.logFileFd === null)
      return;
    try {
      const line = `${JSON.stringify(event)}
`;
      writeSync(this.logFileFd, line);
    } catch (writeError) {
      this.logFileFd = null;
      this.fileInitialized = false;
      process.stderr.write(`[agent-hooks] Log file write failed: ${String(writeError)}
`);
    }
  }
  /**
   * Initializes the log file for writing.
   */
  initializeFile() {
    this.fileInitialized = true;
    if (!this.logFilePath)
      return;
    try {
      const dir = dirname(this.logFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      this.logFileFd = openSync(this.logFilePath, "a");
    } catch {
      this.logFileFd = null;
    }
  }
  /**
   * Extracts structured error information from an unknown error.
   * @param error - The error to extract information from
   * @returns Structured error information
   */
  extractErrorInfo(error) {
    if (error instanceof Error) {
      const info = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
      if (error.cause !== void 0) {
        info.cause = this.extractErrorInfo(error.cause);
      }
      return info;
    }
    return {
      name: "UnknownError",
      message: String(error)
    };
  }
};
var logger = new Logger({
  logEnvVar: process.env.AGENT_HOOKS_LOG_ENV_VAR ?? "AGENT_HOOKS_LOG_FILE"
});

// node_modules/@goodfoot/agent-hooks/dist/core/env.js
import * as fs from "node:fs";
var CLAUDE_ENV_VARS = {
  /**
   * Absolute path to the project root directory where Claude Code was started.
   * Available in all hooks.
   */
  PROJECT_DIR: "CLAUDE_PROJECT_DIR",
  /**
   * Path to a file where SessionStart hooks can persist environment variables.
   * Variables written to this file will be available in all subsequent bash commands.
   * Only available in SessionStart hooks.
   */
  ENV_FILE: "CLAUDE_ENV_FILE",
  /**
   * Set to "true" when running in a remote (web) environment.
   * Not set or empty when running in local CLI environment.
   */
  REMOTE: "CLAUDE_CODE_REMOTE"
};
function getEnvFilePath() {
  return process.env[CLAUDE_ENV_VARS.ENV_FILE];
}
function persistEnvVar(name, value) {
  const envFile = getEnvFilePath();
  if (envFile === void 0) {
    throw new Error("persistEnvVar can only be used in SessionStart hooks. CLAUDE_ENV_FILE environment variable is not set.");
  }
  const escapedValue = escapeShellValue(value);
  const exportStatement = `export ${name}=${escapedValue}
`;
  fs.appendFileSync(envFile, exportStatement, "utf-8");
}
function persistEnvVars(vars) {
  for (const [name, value] of Object.entries(vars)) {
    persistEnvVar(name, value);
  }
}
function escapeShellValue(value) {
  const escaped = value.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

// node_modules/@goodfoot/agent-hooks/dist/agents/claude-code/events.js
var HOOK_EVENT_NAMES = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "Notification",
  "UserPromptExpansion",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
  "PermissionRequest",
  "PermissionDenied",
  "Setup",
  "TeammateIdle",
  "TaskCreated",
  "TaskCompleted",
  "Elicitation",
  "ElicitationResult",
  "ConfigChange",
  "InstructionsLoaded",
  "WorktreeCreate",
  "WorktreeRemove",
  "CwdChanged",
  "FileChanged",
  "MessageDisplay"
];
var EXCLUDED_FROM_ADVISORY = [
  "PreToolUse",
  "PermissionRequest",
  "Stop",
  "SubagentStop",
  "WorktreeCreate",
  "WorktreeRemove"
];
var ADVISORY_EVENTS = HOOK_EVENT_NAMES.filter((eventName) => !EXCLUDED_FROM_ADVISORY.includes(eventName));

// node_modules/@goodfoot/agent-hooks/dist/core/define-hook.js
function defineHook(eventName, config, handler, policyGate) {
  if (policyGate !== void 0) {
    let accepted;
    try {
      accepted = policyGate(eventName, config.unexpectedError);
    } catch (error) {
      throw new Error(`Policy gate rejected "${eventName}": ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!accepted) {
      throw new Error(`Policy gate rejected "${eventName}"`);
    }
  }
  const hookFn = async (input, context) => {
    return await handler(input, context);
  };
  hookFn.eventName = eventName;
  hookFn.matcher = config.matcher;
  hookFn.timeout = config.timeout;
  hookFn.unexpectedError = config.unexpectedError;
  hookFn.onUnexpectedError = config.onUnexpectedError;
  hookFn.createContext = config.createContext;
  return hookFn;
}

// node_modules/@goodfoot/agent-hooks/dist/agents/claude-code/hooks.js
var advisoryPolicyGate = (eventName, policy) => policy !== "continue" || ADVISORY_EVENTS.includes(eventName);
function createSessionStartContext() {
  return { logger, persistEnvVar, persistEnvVars };
}
function createHookFunction(hookEventName, config, handler) {
  const isSessionStart = hookEventName === "SessionStart";
  return defineHook(hookEventName, isSessionStart ? { ...config, createContext: createSessionStartContext } : config, handler, advisoryPolicyGate);
}
function userPromptSubmitHook(config, handler) {
  return createHookFunction("UserPromptSubmit", config, handler);
}

// node_modules/@goodfoot/agent-hooks/dist/agents/claude-code/outputs.js
var EXIT_CODES = {
  /** Handler completed successfully. Claude Code parses stdout as JSON. */
  SUCCESS: 0,
  /** Non-blocking error occurred (e.g., invalid input). stderr shown to user only. */
  ERROR: 1,
  /** Handler threw exception OR blocking action requested. stderr shown to Claude. */
  BLOCK: 2
};
function createHookSpecificOutputBuilder(hookType) {
  return (options = {}) => {
    const { hookSpecificOutput, ...rest } = options;
    const stdout = hookSpecificOutput !== void 0 ? { ...rest, hookSpecificOutput: { hookEventName: hookType, ...hookSpecificOutput } } : rest;
    return { _type: hookType, stdout };
  };
}
var userPromptSubmitOutput = /* @__PURE__ */ createHookSpecificOutputBuilder("UserPromptSubmit");

// node_modules/@goodfoot/agent-hooks/dist/core/stdin.js
async function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      chunks.push(chunk);
    });
    process.stdin.on("end", () => {
      resolve(chunks.join(""));
    });
    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}
function parseStdinJson(stdinContent) {
  return JSON.parse(stdinContent);
}

// node_modules/@goodfoot/agent-hooks/dist/core/transport.js
var HookBlockError = class extends Error {
  /**
   * Optional structured fields carried alongside the block reason (e.g.
   * extra wire fields the agent's translation may forward).
   */
  fields;
  /**
   * @param message - The block reason; becomes the error `message`.
   * @param fields - Optional additional structured fields.
   */
  constructor(message, fields) {
    super(message);
    this.name = "HookBlockError";
    this.fields = fields;
  }
};
var FALLBACK_EXIT_ERROR = 1;
var FALLBACK_EXIT_SUCCESS = 0;
function reportUnexpectedError(onUnexpectedError, error, phase) {
  try {
    onUnexpectedError?.(error, phase);
  } catch {
  }
  try {
    logger.logError(error, `Unexpected error in ${phase} phase (fail-open)`, { phase });
  } catch {
  }
}
function cleanup(policy, onUnexpectedError) {
  try {
    logger.clearContext();
    logger.close();
  } catch (error) {
    if (policy !== "continue") {
      throw error;
    }
    reportUnexpectedError(onUnexpectedError, error, "cleanup");
  }
}
function classify(error, phase, policy, onUnexpectedError) {
  if (error instanceof HookBlockError) {
    return { kind: "block", error };
  }
  if (policy === "continue") {
    reportUnexpectedError(onUnexpectedError, error, phase);
    return { kind: "response", output: void 0 };
  }
  return { kind: "handlerError", error, phase };
}
function writeUnexpectedErrorStderr(error) {
  if (error instanceof Error) {
    process.stderr.write(`${error.stack ?? error.message}
`);
  } else {
    process.stderr.write(`${String(error)}
`);
  }
}
function cleanupQuietly() {
  try {
    logger.clearContext();
    logger.close();
  } catch {
  }
}
async function drive(transport, hookFn) {
  const policy = hookFn.unexpectedError ?? "error";
  const onUnexpectedError = hookFn.onUnexpectedError;
  const outcome = await (async () => {
    let stdinContent;
    try {
      stdinContent = await readStdin();
    } catch (error) {
      logger.logError(error, "Failed to read stdin");
      return classify(error, "read", policy, onUnexpectedError);
    }
    let input;
    try {
      input = parseStdinJson(stdinContent);
    } catch (error) {
      logger.logError(error, "Failed to parse stdin JSON");
      return classify(error, "parse", policy, onUnexpectedError);
    }
    logger.setContext(hookFn.eventName, input);
    const context = hookFn.createContext?.(input) ?? { logger };
    try {
      const result = await hookFn(input, context);
      if (result === null || result === void 0) {
        return { kind: "response", output: void 0 };
      }
      const raw = transport.rawStdout?.(result);
      return raw !== void 0 ? { kind: "rawStdout", stdout: raw } : { kind: "response", output: result };
    } catch (error) {
      return classify(error, "handler", policy, onUnexpectedError);
    }
  })();
  let finalized;
  try {
    finalized = transport.finalize(outcome);
  } catch (error) {
    if (policy === "continue") {
      reportUnexpectedError(onUnexpectedError, error, "serialize");
      cleanupQuietly();
      process.exit(FALLBACK_EXIT_SUCCESS);
    }
    writeUnexpectedErrorStderr(error);
    cleanupQuietly();
    process.exit(FALLBACK_EXIT_ERROR);
  }
  try {
    cleanup(policy, onUnexpectedError);
  } catch (error) {
    writeUnexpectedErrorStderr(error);
    process.exit(FALLBACK_EXIT_ERROR);
  }
  if (finalized.stderr !== void 0) {
    process.stderr.write(finalized.stderr);
  }
  if (finalized.stdout !== void 0) {
    try {
      process.stdout.write(finalized.stdout);
    } catch (error) {
      if (policy === "continue") {
        reportUnexpectedError(onUnexpectedError, error, "write");
        cleanupQuietly();
        process.exit(FALLBACK_EXIT_SUCCESS);
      }
      writeUnexpectedErrorStderr(error);
      cleanupQuietly();
      process.exit(FALLBACK_EXIT_ERROR);
    }
  }
  process.exit(finalized.exitCode);
}

// node_modules/@goodfoot/agent-hooks/dist/agents/claude-code/transport.js
var BLOCK_SHAPE_BY_EVENT = {
  PermissionRequest: (reason) => ({
    hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: reason } }
  }),
  PreToolUse: (reason) => ({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    }
  })
};
function translateBlockToPayload(eventName, error) {
  const reason = error.message;
  const known = HOOK_EVENT_NAMES.includes(eventName) ? eventName : void 0;
  const payload = known !== void 0 ? BLOCK_SHAPE_BY_EVENT[known]?.(reason) ?? { continue: false, stopReason: reason } : { continue: false, stopReason: reason };
  if (error.fields !== void 0) {
    Object.assign(payload, error.fields);
  }
  return payload;
}
function convertToHookOutput(specificOutput) {
  const { stdout, stderr, rawStdout } = specificOutput;
  const result = { stdout };
  if (stderr !== void 0) {
    result.stderr = stderr;
  }
  if (rawStdout !== void 0) {
    result.rawStdout = rawStdout;
  }
  return result;
}
function formatErrorText(error) {
  return error instanceof Error ? `${error.stack ?? error.message}
` : `${String(error)}
`;
}
function detectRawStdout(output) {
  if (output._type === "WorktreeCreate" || output._type === "WorktreeRemove") {
    return output.rawStdout;
  }
  return void 0;
}
function createClaudeCodeTransport(eventName, policy, onUnexpectedError) {
  return {
    finalize(outcome) {
      switch (outcome.kind) {
        case "response": {
          const converted = outcome.output === null || outcome.output === void 0 ? void 0 : convertToHookOutput(outcome.output);
          if (converted?.stderr !== void 0) {
            return { stderr: converted.stderr, exitCode: EXIT_CODES.BLOCK };
          }
          let serializedText;
          try {
            serializedText = converted?.rawStdout !== void 0 ? converted.rawStdout : JSON.stringify(converted?.stdout ?? {});
          } catch (error) {
            logger.logError(error, "Failed to serialize hook output");
            if (policy !== "continue") {
              return { stderr: formatErrorText(error), exitCode: EXIT_CODES.ERROR };
            }
            onUnexpectedError?.(error, "serialize");
            serializedText = "{}";
          }
          return { stdout: serializedText, exitCode: EXIT_CODES.SUCCESS };
        }
        case "rawStdout":
          return { stdout: outcome.stdout, exitCode: EXIT_CODES.SUCCESS };
        case "block": {
          return {
            stdout: JSON.stringify(translateBlockToPayload(eventName, outcome.error)),
            exitCode: EXIT_CODES.SUCCESS
          };
        }
        case "handlerError": {
          if (outcome.phase === "read" || outcome.phase === "parse") {
            logger.error(`Invalid JSON input: ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}`);
            return { stdout: "{}", exitCode: EXIT_CODES.SUCCESS };
          }
          logger.error(`Hook handler error: ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}`);
          return { stderr: formatErrorText(outcome.error), exitCode: EXIT_CODES.BLOCK };
        }
      }
    },
    rawStdout: detectRawStdout
  };
}
async function execute(hookFn) {
  const policy = hookFn.unexpectedError ?? "error";
  const transport = createClaudeCodeTransport(hookFn.eventName, policy, hookFn.onUnexpectedError);
  await drive(transport, hookFn);
}

// packages/expansion-hooks/src/expansion-store.ts
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
function storePath() {
  return join(homedir(), ".expansion.json");
}
function readStore() {
  try {
    const content = readFileSync(storePath(), "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
function formatExpansion(key, facts) {
  const bullets = facts.map((f) => `- ${f}`).join("\n");
  return `**${key}**:
${bullets}`;
}

// packages/expansion-hooks/src/user-prompt-submit.ts
function getSeenFilePath(sessionId) {
  return `/tmp/expansion_${sessionId}.seen`;
}
function loadSeen(sessionId) {
  const filePath = getSeenFilePath(sessionId);
  if (!existsSync2(filePath)) {
    return [];
  }
  try {
    const content = readFileSync2(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}
function saveSeen(sessionId, seen) {
  writeFileSync2(getSeenFilePath(sessionId), JSON.stringify(seen));
}
function findNewTerms(prompt, store, seen) {
  return Object.keys(store).filter((key) => prompt.includes(key) && !seen.includes(key));
}
var user_prompt_submit_default = userPromptSubmitHook({}, async (input, { logger: logger2 }) => {
  const store = readStore();
  const seen = loadSeen(input.session_id);
  const newTerms = findNewTerms(input.prompt, store, seen);
  logger2.debug(`Found ${newTerms.length} new terms in prompt`);
  if (newTerms.length === 0) {
    return null;
  }
  const formattedContext = newTerms.map((key) => formatExpansion(key, store[key])).join("\n\n");
  saveSeen(input.session_id, [...seen, ...newTerms]);
  return userPromptSubmitOutput({
    systemMessage: formattedContext,
    hookSpecificOutput: { additionalContext: formattedContext }
  });
});

// packages/expansion-hooks/src/user-prompt-submit-entry.ts
execute(user_prompt_submit_default);
