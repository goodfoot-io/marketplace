#!/usr/bin/env -S node --enable-source-maps
// ../claude-code-hooks/dist/outputs.js
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
function createSimpleOutputBuilder(hookType) {
  return (options = {}) => ({
    _type: hookType,
    stdout: options
  });
}
var postToolUseOutput = /* @__PURE__ */ createHookSpecificOutputBuilder("PostToolUse");
var sessionStartOutput = /* @__PURE__ */ createHookSpecificOutputBuilder("SessionStart");
var preCompactOutput = /* @__PURE__ */ createSimpleOutputBuilder("PreCompact");

// ../claude-code-hooks/dist/logger.js
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
   * import { logger } from '@goodfoot/claude-code-hooks';
   *
   * // Or create custom instance
   * const customLogger = new Logger({ logFilePath: '/var/log/hooks.log' });
   * ```
   */
  constructor(config = {}) {
    for (const level of LOG_LEVELS) {
      this.handlers.set(level, /* @__PURE__ */ new Set());
    }
    this.logFilePath = config.logFilePath ?? process.env["CLAUDE_CODE_HOOKS_LOG_FILE"] ?? null;
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
   * @param hookType - The type of hook being executed
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
   * logger.setLogFile('/var/log/claude-hooks.log');
   *
   * // Disable file logging
   * logger.setLogFile(null);
   * ```
   */
  setLogFile(filePath) {
    if (this.logFileFd !== null) {
      try {
        closeSync(this.logFileFd);
      } catch {
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
      } catch {
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
        } catch {
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
    if (!this.logFilePath) return;
    if (!this.fileInitialized) {
      this.initializeFile();
    }
    if (this.logFileFd === null) return;
    try {
      const line = JSON.stringify(event) + "\n";
      writeSync(this.logFileFd, line);
    } catch {
    }
  }
  /**
   * Initializes the log file for writing.
   */
  initializeFile() {
    this.fileInitialized = true;
    if (!this.logFilePath) return;
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
var logger = new Logger();

// ../claude-code-hooks/dist/hooks.js
function createHookFunction(hookEventName, config, handler) {
  const hookFn = async (input, context) => {
    return await handler(input, context);
  };
  hookFn.hookEventName = hookEventName;
  hookFn.matcher = config.matcher;
  hookFn.timeout = config.timeout;
  return hookFn;
}
function postToolUseHook(config, handler) {
  return createHookFunction("PostToolUse", config, handler);
}
function sessionStartHook(config, handler) {
  return createHookFunction("SessionStart", config, handler);
}
function preCompactHook(config, handler) {
  return createHookFunction("PreCompact", config, handler);
}

// ../claude-code-hooks/dist/env.js
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
    throw new Error(
      "persistEnvVar can only be used in SessionStart hooks. CLAUDE_ENV_FILE environment variable is not set."
    );
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

// ../claude-code-hooks/dist/runtime.js
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
function parseStdinInput(stdinContent) {
  const rawInput = JSON.parse(stdinContent);
  return rawInput;
}
function writeStdout(output) {
  process.stdout.write(JSON.stringify(output));
}
function createMalformedInputOutput(error) {
  logger.error(`Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`);
  return { stdout: {} };
}
function handleHandlerError(error) {
  if (error instanceof Error) {
    process.stderr.write(`${error.stack ?? error.message}
`);
  } else {
    process.stderr.write(`${String(error)}
`);
  }
  logger.error(`Hook handler error: ${error instanceof Error ? error.message : String(error)}`);
  logger.clearContext();
  logger.close();
  process.exit(EXIT_CODES.BLOCK);
}
function convertToHookOutput(specificOutput) {
  return { stdout: specificOutput.stdout };
}
async function execute(hookFn) {
  let output;
  try {
    const cliLogFile = process.env["CLAUDE_CODE_HOOKS_CLI_LOG_FILE"];
    const envLogFile = process.env["CLAUDE_CODE_HOOKS_LOG_FILE"];
    if (cliLogFile !== void 0 && envLogFile !== void 0 && cliLogFile !== envLogFile) {
      process.stderr.write(
        `Log file configuration conflict: CLI --log="${cliLogFile}" vs CLAUDE_CODE_HOOKS_LOG_FILE="${envLogFile}". Use only one method to configure hook logging.
`
      );
      process.exit(EXIT_CODES.ERROR);
    }
    if (cliLogFile !== void 0) {
      logger.setLogFile(cliLogFile);
    }
    let stdinContent;
    try {
      stdinContent = await readStdin();
    } catch (error) {
      logger.logError(error, "Failed to read stdin");
      output = createMalformedInputOutput(error);
      return;
    }
    let input;
    try {
      input = parseStdinInput(stdinContent);
    } catch (error) {
      logger.logError(error, "Failed to parse stdin JSON");
      output = createMalformedInputOutput(error);
      return;
    }
    const hookEventName = hookFn.hookEventName;
    logger.setContext(hookEventName, input);
    const context = hookEventName === "SessionStart" ? { logger, persistEnvVar, persistEnvVars } : { logger };
    try {
      const specificOutput = await hookFn(input, context);
      output = convertToHookOutput(specificOutput);
    } catch (error) {
      handleHandlerError(error);
    }
  } finally {
    if (output !== void 0) {
      writeStdout(output.stdout);
    }
    logger.clearContext();
    logger.close();
    process.exit(EXIT_CODES.SUCCESS);
  }
}

// src/skill-reloader.ts
import { existsSync as existsSync3, readFileSync, unlinkSync, writeFileSync } from "node:fs";

// src/skill-tracker.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync2, mkdirSync as mkdirSync2 } from "node:fs";
import { dirname as dirname2 } from "node:path";
function isSkillToolInput(input) {
  return typeof input === "object" && input !== null && "skill" in input && typeof input.skill === "string";
}
function getSkillsFilePath(sessionId) {
  return `/tmp/claude_skills_${sessionId}.txt`;
}
function getReloadFlagPath(sessionId) {
  return `/tmp/claude_skills_reload_${sessionId}.enabled`;
}
var skill_tracker_default = postToolUseHook({ matcher: "Skill" }, (input, { logger: logger2 }) => {
  const toolInput = input.tool_input;
  if (!isSkillToolInput(toolInput)) {
    logger2.debug("No skill name found in tool input");
    return postToolUseOutput({});
  }
  const skillName = toolInput.skill;
  const skillsFile = getSkillsFilePath(input.session_id);
  try {
    const dir = dirname2(skillsFile);
    if (!existsSync2(dir)) {
      mkdirSync2(dir, { recursive: true });
    }
    appendFileSync2(skillsFile, `${skillName}
`, "utf-8");
    logger2.info("Tracked skill invocation", { skill: skillName, file: skillsFile });
  } catch (error) {
    logger2.warn("Failed to track skill", { skill: skillName, error: String(error) });
  }
  return postToolUseOutput({});
});

// src/skill-reloader.ts
function formatSkillList(skills) {
  if (skills.length === 0) return "";
  if (skills.length === 1) return `'${skills[0]}'`;
  if (skills.length === 2) return `'${skills[0]}' and '${skills[1]}'`;
  const allButLast = skills.slice(0, -1).map((s) => `'${s}'`);
  const last = `'${skills[skills.length - 1]}'`;
  return `${allButLast.join(", ")}, and ${last}`;
}
var skill_reloader_default = sessionStartHook({ matcher: "compact" }, (input, { logger: logger2 }) => {
  const enablementFlag = getReloadFlagPath(input.session_id);
  const skillsFile = getSkillsFilePath(input.session_id);
  if (!existsSync3(enablementFlag)) {
    logger2.debug("Skill reload not enabled for this session");
    return sessionStartOutput({});
  }
  if (!existsSync3(skillsFile)) {
    logger2.debug("No skills file found");
    try {
      unlinkSync(enablementFlag);
    } catch {
    }
    return sessionStartOutput({});
  }
  let content;
  try {
    content = readFileSync(skillsFile, "utf-8");
  } catch (error) {
    logger2.warn("Failed to read skills file", { error: String(error) });
    try {
      unlinkSync(enablementFlag);
    } catch {
    }
    return sessionStartOutput({});
  }
  const skills = [...new Set(content.split("\n").filter((line) => line.trim()))];
  if (skills.length === 0) {
    logger2.debug("No skills to reload");
    try {
      unlinkSync(enablementFlag);
    } catch {
    }
    return sessionStartOutput({});
  }
  try {
    unlinkSync(enablementFlag);
  } catch {
  }
  const skillList = formatSkillList(skills);
  logger2.info("Reloading skills after compaction", { skills, skillList });
  return sessionStartOutput({
    systemMessage: `Skill reloader: Restoring ${skillList} after context compaction`,
    hookSpecificOutput: {
      additionalContext: `Load skill ${skillList} before continuing`
    }
  });
});
function enableSkillReload(sessionId) {
  const enablementFlag = getReloadFlagPath(sessionId);
  writeFileSync(enablementFlag, "1", "utf-8");
}

// src/pre-compact.ts
var pre_compact_default = preCompactHook({}, (input, { logger: logger2 }) => {
  enableSkillReload(input.session_id);
  logger2.info("Enabled skill reload for post-compaction", { sessionId: input.session_id });
  return preCompactOutput({});
});

// ../../../tmp/claude-code-hooks-build/7588c2c4c54c8829/wrapper.ts
execute(pre_compact_default);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3Qvb3V0cHV0cy5qcyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvY2xhdWRlLWNvZGUtaG9va3MvZGlzdC9sb2dnZXIuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvaG9va3MuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvZW52LmpzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9wYWNrYWdlcy9jbGF1ZGUtY29kZS1ob29rcy9kaXN0L3J1bnRpbWUuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2dvb2Rmb290LWhvb2tzL3NyYy9za2lsbC1yZWxvYWRlci50cyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvZ29vZGZvb3QtaG9va3Mvc3JjL3NraWxsLXRyYWNrZXIudHMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2dvb2Rmb290LWhvb2tzL3NyYy9wcmUtY29tcGFjdC50cyIsICJ3cmFwcGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIE91dHB1dCB0eXBlcyBhbmQgYnVpbGRlcnMgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIFByb3ZpZGVzIHR5cGUtc2FmZSBvdXRwdXQgYnVpbGRlciBmdW5jdGlvbnMgZm9yIGFsbCAxMiBob29rIHR5cGVzLiBFYWNoIGJ1aWxkZXJcbiAqIGFjY2VwdHMgb3B0aW9ucyB0aGF0IG1hdGNoIHRoZSB3aXJlIGZvcm1hdCBleHBlY3RlZCBieSBDbGF1ZGUgQ29kZSwgd2l0aCB0eXBlc1xuICogZGVyaXZlZCBmcm9tIHRoZSBDbGF1ZGUgQWdlbnQgU0RLJ3MgYFN5bmNIb29rSlNPTk91dHB1dGAgdHlwZS5cbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICogQG1vZHVsZVxuICovXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBFeGl0IENvZGUgQ29uc3RhbnRzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIEV4aXQgY29kZXMgdXNlZCBieSBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiB8IEV4aXQgQ29kZSB8IE5hbWUgfCBXaGVuIFVzZWQgfCBDbGF1ZGUgQ29kZSBCZWhhdmlvciB8XG4gKiB8LS0tLS0tLS0tLS18LS0tLS0tfC0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbiAqIHwgMCB8IFN1Y2Nlc3MgfCBIYW5kbGVyIHJldHVybnMgbm9ybWFsbHkgfCBDb250aW51ZSwgcGFyc2Ugc3Rkb3V0IGFzIEpTT04gfFxuICogfCAxIHwgRXJyb3IgfCBJbnZhbGlkIGlucHV0LCBub24tYmxvY2tpbmcgZXJyb3IgfCBOb24tYmxvY2tpbmcsIHN0ZGVyciB0byB1c2VyIG9ubHkgfFxuICogfCAyIHwgQmxvY2sgfCBIYW5kbGVyIHRocm93cyBPUiBgc3RvcFJlYXNvbmAgc2V0IHwgQmxvY2tpbmcsIHN0ZGVyciBzaG93biB0byBDbGF1ZGUgfFxuICovXG5leHBvcnQgY29uc3QgRVhJVF9DT0RFUyA9IHtcbiAgLyoqIEhhbmRsZXIgY29tcGxldGVkIHN1Y2Nlc3NmdWxseS4gQ2xhdWRlIENvZGUgcGFyc2VzIHN0ZG91dCBhcyBKU09OLiAqL1xuICBTVUNDRVNTOiAwLFxuICAvKiogTm9uLWJsb2NraW5nIGVycm9yIG9jY3VycmVkIChlLmcuLCBpbnZhbGlkIGlucHV0KS4gc3RkZXJyIHNob3duIHRvIHVzZXIgb25seS4gKi9cbiAgRVJST1I6IDEsXG4gIC8qKiBIYW5kbGVyIHRocmV3IGV4Y2VwdGlvbiBPUiBibG9ja2luZyBhY3Rpb24gcmVxdWVzdGVkLiBzdGRlcnIgc2hvd24gdG8gQ2xhdWRlLiAqL1xuICBCTE9DSzogMlxufTtcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIE91dHB1dCBCdWlsZGVyIEZhY3Rvcmllc1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBGYWN0b3J5IGZvciBob29rcyB0aGF0IGhhdmUgaG9va1NwZWNpZmljT3V0cHV0IHdpdGggYSBob29rRXZlbnROYW1lIGRpc2NyaW1pbmF0b3IuXG4gKiBAcGFyYW0gaG9va1R5cGUgLSBUaGUgaG9vayB0eXBlIG5hbWUgdXNlZCBhcyB0aGUgX3R5cGUgZGlzY3JpbWluYXRvclxuICogQHJldHVybnMgQSBidWlsZGVyIGZ1bmN0aW9uIHRoYXQgY3JlYXRlcyB0aGUgb3V0cHV0IG9iamVjdFxuICogQGludGVybmFsXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoaG9va1R5cGUpIHtcbiAgcmV0dXJuIChvcHRpb25zID0ge30pID0+IHtcbiAgICBjb25zdCB7IGhvb2tTcGVjaWZpY091dHB1dCwgLi4ucmVzdCB9ID0gb3B0aW9ucztcbiAgICBjb25zdCBzdGRvdXQgPVxuICAgICAgaG9va1NwZWNpZmljT3V0cHV0ICE9PSB1bmRlZmluZWRcbiAgICAgICAgPyB7IC4uLnJlc3QsIGhvb2tTcGVjaWZpY091dHB1dDogeyBob29rRXZlbnROYW1lOiBob29rVHlwZSwgLi4uaG9va1NwZWNpZmljT3V0cHV0IH0gfVxuICAgICAgICA6IHJlc3Q7XG4gICAgcmV0dXJuIHsgX3R5cGU6IGhvb2tUeXBlLCBzdGRvdXQgfTtcbiAgfTtcbn1cbi8qKlxuICogRmFjdG9yeSBmb3IgaG9va3MgdGhhdCBvbmx5IHVzZSBDb21tb25PcHRpb25zIChzaW1wbGUgcGFzc3Rocm91Z2gpLlxuICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIGhvb2sgdHlwZSBuYW1lIHVzZWQgYXMgdGhlIF90eXBlIGRpc2NyaW1pbmF0b3JcbiAqIEByZXR1cm5zIEEgYnVpbGRlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIG91dHB1dCBvYmplY3RcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVTaW1wbGVPdXRwdXRCdWlsZGVyKGhvb2tUeXBlKSB7XG4gIHJldHVybiAob3B0aW9ucyA9IHt9KSA9PiAoe1xuICAgIF90eXBlOiBob29rVHlwZSxcbiAgICBzdGRvdXQ6IG9wdGlvbnNcbiAgfSk7XG59XG4vKipcbiAqIEZhY3RvcnkgZm9yIGhvb2tzIHRoYXQgdXNlIGRlY2lzaW9uLWJhc2VkIG9wdGlvbnMgKFN0b3AsIFN1YmFnZW50U3RvcCkuXG4gKiBAcGFyYW0gaG9va1R5cGUgLSBUaGUgaG9vayB0eXBlIG5hbWUgdXNlZCBhcyB0aGUgX3R5cGUgZGlzY3JpbWluYXRvclxuICogQHJldHVybnMgQSBidWlsZGVyIGZ1bmN0aW9uIHRoYXQgY3JlYXRlcyB0aGUgb3V0cHV0IG9iamVjdFxuICogQGludGVybmFsXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZURlY2lzaW9uT3V0cHV0QnVpbGRlcihob29rVHlwZSkge1xuICByZXR1cm4gKG9wdGlvbnMgPSB7fSkgPT4gKHtcbiAgICBfdHlwZTogaG9va1R5cGUsXG4gICAgc3Rkb3V0OiBvcHRpb25zXG4gIH0pO1xufVxuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUHJlVG9vbFVzZSBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgUHJlVG9vbFVzZU91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gQWxsb3cgdG9vbCBleGVjdXRpb25cbiAqIHByZVRvb2xVc2VPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHsgcGVybWlzc2lvbkRlY2lzaW9uOiAnYWxsb3cnIH1cbiAqIH0pO1xuICpcbiAqIC8vIERlbnkgd2l0aCByZWFzb25cbiAqIHByZVRvb2xVc2VPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBwZXJtaXNzaW9uRGVjaXNpb246ICdkZW55JyxcbiAqICAgICBwZXJtaXNzaW9uRGVjaXNpb25SZWFzb246ICdEYW5nZXJvdXMgY29tbWFuZCBkZXRlY3RlZCdcbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gQWxsb3cgd2l0aCBtb2RpZmllZCBpbnB1dFxuICogcHJlVG9vbFVzZU91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIHBlcm1pc3Npb25EZWNpc2lvbjogJ2FsbG93JyxcbiAqICAgICB1cGRhdGVkSW5wdXQ6IHsgY29tbWFuZDogJ2xzIC1sYScgfVxuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3QgcHJlVG9vbFVzZU91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKCdQcmVUb29sVXNlJyk7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQb3N0VG9vbFVzZSBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgUG9zdFRvb2xVc2VPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEFkZCBjb250ZXh0IGFmdGVyIGEgZmlsZSByZWFkXG4gKiBwb3N0VG9vbFVzZU91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiAnRmlsZSBjb250YWlucyBzZW5zaXRpdmUgZGF0YSdcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHBvc3RUb29sVXNlT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoJ1Bvc3RUb29sVXNlJyk7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQb3N0VG9vbFVzZUZhaWx1cmUgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFBvc3RUb29sVXNlRmFpbHVyZU91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogcG9zdFRvb2xVc2VGYWlsdXJlT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdUcnkgdXNpbmcgYSBkaWZmZXJlbnQgYXBwcm9hY2gnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwb3N0VG9vbFVzZUZhaWx1cmVPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcignUG9zdFRvb2xVc2VGYWlsdXJlJyk7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBVc2VyUHJvbXB0U3VibWl0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBVc2VyUHJvbXB0U3VibWl0T3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiB1c2VyUHJvbXB0U3VibWl0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdUaGlzIHByb2plY3QgdXNlcyBUeXBlU2NyaXB0IHN0cmljdCBtb2RlJ1xuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3QgdXNlclByb21wdFN1Ym1pdE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKCdVc2VyUHJvbXB0U3VibWl0Jyk7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTZXNzaW9uU3RhcnQgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFNlc3Npb25TdGFydE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogc2Vzc2lvblN0YXJ0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6IEpTT04uc3RyaW5naWZ5KHsgcHJvamVjdDogJ215LXByb2plY3QnIH0pXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBzZXNzaW9uU3RhcnRPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcignU2Vzc2lvblN0YXJ0Jyk7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTZXNzaW9uRW5kIGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTZXNzaW9uRW5kT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBzZXNzaW9uRW5kT3V0cHV0KHt9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc2Vzc2lvbkVuZE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVTaW1wbGVPdXRwdXRCdWlsZGVyKCdTZXNzaW9uRW5kJyk7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTdG9wIGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTdG9wT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBbGxvdyB0aGUgc3RvcFxuICogc3RvcE91dHB1dCh7IGRlY2lzaW9uOiAnYXBwcm92ZScgfSk7XG4gKlxuICogLy8gQmxvY2sgd2l0aCByZWFzb25cbiAqIHN0b3BPdXRwdXQoe1xuICogICBkZWNpc2lvbjogJ2Jsb2NrJyxcbiAqICAgcmVhc29uOiAnVGhlcmUgYXJlIHVuY29tbWl0dGVkIGNoYW5nZXMnXG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc3RvcE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVEZWNpc2lvbk91dHB1dEJ1aWxkZXIoJ1N0b3AnKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFN1YmFnZW50U3RhcnQgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFN1YmFnZW50U3RhcnRPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHN1YmFnZW50U3RhcnRPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ0ZvY3VzIG9uIGZpbmRpbmcgcGF0dGVybnMnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBzdWJhZ2VudFN0YXJ0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoJ1N1YmFnZW50U3RhcnQnKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFN1YmFnZW50U3RvcCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgU3ViYWdlbnRTdG9wT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBCbG9jayB3aXRoIHJlYXNvblxuICogc3ViYWdlbnRTdG9wT3V0cHV0KHtcbiAqICAgZGVjaXNpb246ICdibG9jaycsXG4gKiAgIHJlYXNvbjogJ1Rhc2sgbm90IGNvbXBsZXRlJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHN1YmFnZW50U3RvcE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVEZWNpc2lvbk91dHB1dEJ1aWxkZXIoJ1N1YmFnZW50U3RvcCcpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgTm90aWZpY2F0aW9uIGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBOb3RpZmljYXRpb25PdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEFkZCBjb250ZXh0IGFib3V0IHRoZSBub3RpZmljYXRpb25cbiAqIG5vdGlmaWNhdGlvbk91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiAnTm90aWZpY2F0aW9uIGZvcndhcmRlZCB0byBTbGFjayAjYWxlcnRzIGNoYW5uZWwnXG4gKiAgIH1cbiAqIH0pO1xuICpcbiAqIC8vIFN1cHByZXNzIHRoZSBub3RpZmljYXRpb25cbiAqIG5vdGlmaWNhdGlvbk91dHB1dCh7IHN1cHByZXNzT3V0cHV0OiB0cnVlIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBub3RpZmljYXRpb25PdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcignTm90aWZpY2F0aW9uJyk7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQcmVDb21wYWN0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBQcmVDb21wYWN0T3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBwcmVDb21wYWN0T3V0cHV0KHtcbiAqICAgc3lzdGVtTWVzc2FnZTogJ1JlbWVtYmVyOiBzdHJpY3QgbW9kZSBpcyBlbmFibGVkJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHByZUNvbXBhY3RPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlU2ltcGxlT3V0cHV0QnVpbGRlcignUHJlQ29tcGFjdCcpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUGVybWlzc2lvblJlcXVlc3QgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBdXRvLWFwcHJvdmVcbiAqIHBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgZGVjaXNpb246IHsgYmVoYXZpb3I6ICdhbGxvdycgfVxuICogICB9XG4gKiB9KTtcbiAqXG4gKiAvLyBBdXRvLWFwcHJvdmUgd2l0aCBtb2RpZmllZCBpbnB1dFxuICogcGVybWlzc2lvblJlcXVlc3RPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBkZWNpc2lvbjoge1xuICogICAgICAgYmVoYXZpb3I6ICdhbGxvdycsXG4gKiAgICAgICB1cGRhdGVkSW5wdXQ6IHsgZmlsZV9wYXRoOiAnL3NhZmUvcGF0aCcgfVxuICogICAgIH1cbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gQXV0by1kZW55XG4gKiBwZXJtaXNzaW9uUmVxdWVzdE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGRlY2lzaW9uOiB7XG4gKiAgICAgICBiZWhhdmlvcjogJ2RlbnknLFxuICogICAgICAgbWVzc2FnZTogJ05vdCBhbGxvd2VkJyxcbiAqICAgICAgIGludGVycnVwdDogdHJ1ZVxuICogICAgIH1cbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gRmFsbCB0aHJvdWdoIHRvIG5vcm1hbCBwcm9tcHRcbiAqIHBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0KHt9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3QgcGVybWlzc2lvblJlcXVlc3RPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcignUGVybWlzc2lvblJlcXVlc3QnKTtcbiIsICIvKipcbiAqIExvZ2dlciBzeXN0ZW0gZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIFByb3ZpZGVzIHN0cnVjdHVyZWQgbG9nZ2luZyB3aXRoIGV2ZW50IHN1YnNjcmlwdGlvbiBhbmQgb3B0aW9uYWwgZmlsZSBvdXRwdXQuXG4gKiBUaGUgbG9nZ2VyIGlzICoqc2lsZW50IGJ5IGRlZmF1bHQqKiB0byBhdm9pZCBpbnRlcmZlcmluZyB3aXRoIGhvb2sgcHJvdG9jb2xcbiAqIChzdGRvdXQgaXMgcmVzZXJ2ZWQgZm9yIEpTT04gcmVzcG9uc2VzLCBzdGRlcnIgbWF5IGNvbmZsaWN0IHdpdGggQ2xhdWRlIENvZGUpLlxuICogQG1vZHVsZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gU3Vic2NyaWJlIHRvIGxvZyBldmVudHNcbiAqIGNvbnN0IHVuc3Vic2NyaWJlID0gbG9nZ2VyLm9uKCdlcnJvcicsIChldmVudCkgPT4ge1xuICogICBjb25zb2xlLmVycm9yKGBFcnJvciBpbiAke2V2ZW50Lmhvb2tUeXBlfTogJHtldmVudC5tZXNzYWdlfWApO1xuICogfSk7XG4gKlxuICogLy8gTGF0ZXIsIGNsZWFuIHVwXG4gKiB1bnN1YnNjcmliZSgpO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3NcbiAqL1xuaW1wb3J0IHsgY2xvc2VTeW5jLCBleGlzdHNTeW5jLCBta2RpclN5bmMsIG9wZW5TeW5jLCB3cml0ZVN5bmMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tICdub2RlOnBhdGgnO1xuLyoqXG4gKiBBbGwgbG9nIGxldmVscyBpbiBvcmRlciBvZiBzZXZlcml0eSAobG93ZXN0IHRvIGhpZ2hlc3QpLlxuICovXG5leHBvcnQgY29uc3QgTE9HX0xFVkVMUyA9IFsnZGVidWcnLCAnaW5mbycsICd3YXJuJywgJ2Vycm9yJ107XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBMb2dnZXIgQ2xhc3Ncbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogTG9nZ2VyIGZvciBDbGF1ZGUgQ29kZSBob29rcyB3aXRoIGV2ZW50IHN1YnNjcmlwdGlvbiBhbmQgZmlsZSBvdXRwdXQuXG4gKlxuICogIyMgS2V5IEJlaGF2aW9yc1xuICpcbiAqIHwgQ29uZmlndXJhdGlvbiB8IEJlaGF2aW9yIHxcbiAqIHwtLS0tLS0tLS0tLS0tLXwtLS0tLS0tLS0tfFxuICogfCBObyBjb25maWcgKGRlZmF1bHQpIHwgKipTaWxlbnQqKiAtIG5vIG91dHB1dCBhbnl3aGVyZSB8XG4gKiB8IGBDTEFVREVfQ09ERV9IT09LU19MT0dfRklMRWAgZW52IHZhciB8IEFwcGVuZCBKU09OIGxpbmVzIHRvIGZpbGUgfFxuICogfCBgLm9uKGxldmVsLCBoYW5kbGVyKWAgcmVnaXN0ZXJlZCB8IEV2ZW50cyBkZWxpdmVyZWQgdG8gaGFuZGxlcnMgb25seSB8XG4gKiB8IE11bHRpcGxlIGRlc3RpbmF0aW9ucyB8IEFsbCBkZXN0aW5hdGlvbnMgcmVjZWl2ZSBldmVudHMgfFxuICpcbiAqICMjIEltcG9ydGFudCBOb3Rlc1xuICpcbiAqIC0gKipOZXZlciBvdXRwdXRzIHRvIHN0ZG91dCoqIChyZXNlcnZlZCBmb3IgSlNPTiBob29rIHJlc3BvbnNlKVxuICogLSAqKk5ldmVyIG91dHB1dHMgdG8gc3RkZXJyKiogKG1heSBpbnRlcmZlcmUgd2l0aCBDbGF1ZGUgQ29kZSBlcnJvciBoYW5kbGluZylcbiAqIC0gRmlsZSBvdXRwdXQgdXNlcyBKU09OIExpbmVzIGZvcm1hdCBmb3IgZWFzeSBwYXJzaW5nXG4gKiAtIGAub24obGV2ZWwsIGhhbmRsZXIpYCByZXR1cm5zIGFuIHVuc3Vic2NyaWJlIGZ1bmN0aW9uXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBTdWJzY3JpYmUgdG8gZXZlbnRzIGF0IHNwZWNpZmljIGxldmVsXG4gKiBsb2dnZXIub24oJ3dhcm4nLCAoZXZlbnQpID0+IHtcbiAqICAgc2VuZEFsZXJ0KGV2ZW50Lm1lc3NhZ2UpO1xuICogfSk7XG4gKlxuICogLy8gTG9nIHdpdGhpbiBhIGhvb2sgaGFuZGxlclxuICogZXhwb3J0IGRlZmF1bHQgcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnQmFzaCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci53YXJuKCdBYm91dCB0byB2YWxpZGF0ZSBCYXNoIGNvbW1hbmQnKTtcbiAqICAgcmV0dXJuIHByZVRvb2xVc2VPdXRwdXQoeyBhbGxvdzogdHJ1ZSB9KTtcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2dnZXIge1xuICAvKipcbiAgICogUmVnaXN0ZXJlZCBldmVudCBoYW5kbGVycyBieSBsb2cgbGV2ZWwuXG4gICAqL1xuICBoYW5kbGVycyA9IG5ldyBNYXAoKTtcbiAgLyoqXG4gICAqIEZpbGUgZGVzY3JpcHRvciBmb3IgbG9nIGZpbGUgb3V0cHV0LlxuICAgKiBMYXppbHkgaW5pdGlhbGl6ZWQgb24gZmlyc3Qgd3JpdGUuXG4gICAqL1xuICBsb2dGaWxlRmQgPSBudWxsO1xuICAvKipcbiAgICogUGF0aCB0byB0aGUgbG9nIGZpbGUsIGlmIGNvbmZpZ3VyZWQuXG4gICAqL1xuICBsb2dGaWxlUGF0aCA9IG51bGw7XG4gIC8qKlxuICAgKiBXaGV0aGVyIGZpbGUgaW5pdGlhbGl6YXRpb24gaGFzIGJlZW4gYXR0ZW1wdGVkLlxuICAgKi9cbiAgZmlsZUluaXRpYWxpemVkID0gZmFsc2U7XG4gIC8qKlxuICAgKiBDdXJyZW50IGhvb2sgY29udGV4dCBmb3IgZW5yaWNoaW5nIGxvZyBldmVudHMuXG4gICAqL1xuICBjdXJyZW50SG9va1R5cGU7XG4gIC8qKlxuICAgKiBDdXJyZW50IGhvb2sgaW5wdXQgZm9yIGVucmljaGluZyBsb2cgZXZlbnRzLlxuICAgKi9cbiAgY3VycmVudElucHV0O1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBMb2dnZXIgaW5zdGFuY2UuXG4gICAqXG4gICAqIFR5cGljYWxseSB5b3Ugc2hvdWxkIHVzZSB0aGUgZXhwb3J0ZWQgYGxvZ2dlcmAgc2luZ2xldG9uIHJhdGhlciB0aGFuXG4gICAqIGNyZWF0aW5nIG5ldyBpbnN0YW5jZXMuXG4gICAqIEBwYXJhbSBjb25maWcgLSBPcHRpb25hbCBjb25maWd1cmF0aW9uXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogLy8gVXNlIHNpbmdsZXRvbiAocmVjb21tZW5kZWQpXG4gICAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gICAqXG4gICAqIC8vIE9yIGNyZWF0ZSBjdXN0b20gaW5zdGFuY2VcbiAgICogY29uc3QgY3VzdG9tTG9nZ2VyID0gbmV3IExvZ2dlcih7IGxvZ0ZpbGVQYXRoOiAnL3Zhci9sb2cvaG9va3MubG9nJyB9KTtcbiAgICogYGBgXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSkge1xuICAgIC8vIEluaXRpYWxpemUgaGFuZGxlcnMgbWFwIGZvciBlYWNoIGxldmVsXG4gICAgZm9yIChjb25zdCBsZXZlbCBvZiBMT0dfTEVWRUxTKSB7XG4gICAgICB0aGlzLmhhbmRsZXJzLnNldChsZXZlbCwgbmV3IFNldCgpKTtcbiAgICB9XG4gICAgLy8gU2V0IGxvZyBmaWxlIHBhdGggZnJvbSBjb25maWcgb3IgZW52aXJvbm1lbnRcbiAgICB0aGlzLmxvZ0ZpbGVQYXRoID0gY29uZmlnLmxvZ0ZpbGVQYXRoID8/IHByb2Nlc3MuZW52WydDTEFVREVfQ09ERV9IT09LU19MT0dfRklMRSddID8/IG51bGw7XG4gIH1cbiAgLyoqXG4gICAqIExvZ3MgYSBkZWJ1ZyBtZXNzYWdlLlxuICAgKlxuICAgKiBVc2UgZm9yIGRldGFpbGVkIGRlYnVnZ2luZyBpbmZvcm1hdGlvbiB0aGF0IGlzIHR5cGljYWxseSBvbmx5IHVzZWZ1bFxuICAgKiBkdXJpbmcgZGV2ZWxvcG1lbnQgb3IgdHJvdWJsZXNob290aW5nLlxuICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBkZWJ1ZyBtZXNzYWdlXG4gICAqIEBwYXJhbSBjb250ZXh0IC0gT3B0aW9uYWwgYWRkaXRpb25hbCBjb250ZXh0XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogbG9nZ2VyLmRlYnVnKCdQcm9jZXNzaW5nIHRvb2wgaW5wdXQnLCB7IHRvb2xOYW1lOiAnQmFzaCcsIGlucHV0U2l6ZTogMjU2IH0pO1xuICAgKiBgYGBcbiAgICovXG4gIGRlYnVnKG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICB0aGlzLmVtaXQoJ2RlYnVnJywgbWVzc2FnZSwgY29udGV4dCk7XG4gIH1cbiAgLyoqXG4gICAqIExvZ3MgYW4gaW5mbyBtZXNzYWdlLlxuICAgKlxuICAgKiBVc2UgZm9yIGdlbmVyYWwgb3BlcmF0aW9uYWwgZXZlbnRzIGxpa2UgaG9vayBpbnZvY2F0aW9ucywgc3VjY2Vzc2Z1bFxuICAgKiBjb21wbGV0aW9ucywgb3Igc3RhdGUgY2hhbmdlcy5cbiAgICogQHBhcmFtIG1lc3NhZ2UgLSBUaGUgaW5mbyBtZXNzYWdlXG4gICAqIEBwYXJhbSBjb250ZXh0IC0gT3B0aW9uYWwgYWRkaXRpb25hbCBjb250ZXh0XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogbG9nZ2VyLmluZm8oJ1Nlc3Npb24gc3RhcnRlZCcsIHsgc291cmNlOiAnc3RhcnR1cCcsIHNlc3Npb25JZDogJ2FiYzEyMycgfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgaW5mbyhtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgdGhpcy5lbWl0KCdpbmZvJywgbWVzc2FnZSwgY29udGV4dCk7XG4gIH1cbiAgLyoqXG4gICAqIExvZ3MgYSB3YXJuaW5nIG1lc3NhZ2UuXG4gICAqXG4gICAqIFVzZSBmb3IgY29uZGl0aW9ucyB0aGF0IG1heSBpbmRpY2F0ZSBpc3N1ZXMgYnV0IGRvbid0IHByZXZlbnRcbiAgICogb3BlcmF0aW9uLCBzdWNoIGFzIGRlcHJlY2F0ZWQgcGF0dGVybnMgb3IgcGVyZm9ybWFuY2UgY29uY2VybnMuXG4gICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIHdhcm5pbmcgbWVzc2FnZVxuICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGxvZ2dlci53YXJuKCdEZXByZWNhdGVkIGhvb2sgcGF0dGVybiBkZXRlY3RlZCcsIHsgcGF0dGVybjogJ2xlZ2FjeU1hdGNoZXInIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIHdhcm4obWVzc2FnZSwgY29udGV4dCkge1xuICAgIHRoaXMuZW1pdCgnd2FybicsIG1lc3NhZ2UsIGNvbnRleHQpO1xuICB9XG4gIC8qKlxuICAgKiBMb2dzIGFuIGVycm9yIG1lc3NhZ2UuXG4gICAqXG4gICAqIFVzZSBmb3IgZXJyb3IgY29uZGl0aW9ucyB0aGF0IHJlcXVpcmUgYXR0ZW50aW9uIGJ1dCB3ZXJlIGhhbmRsZWRcbiAgICogZ3JhY2VmdWxseS4gRm9yIGV4Y2VwdGlvbnMsIHByZWZlciB7QGxpbmsgbG9nRXJyb3J9LlxuICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBlcnJvciBtZXNzYWdlXG4gICAqIEBwYXJhbSBjb250ZXh0IC0gT3B0aW9uYWwgYWRkaXRpb25hbCBjb250ZXh0XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogbG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gdmFsaWRhdGUgdG9vbCBpbnB1dCcsIHsgdG9vbE5hbWU6ICdCYXNoJywgcmVhc29uOiAnZW1wdHkgY29tbWFuZCcgfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgZXJyb3IobWVzc2FnZSwgY29udGV4dCkge1xuICAgIHRoaXMuZW1pdCgnZXJyb3InLCBtZXNzYWdlLCBjb250ZXh0KTtcbiAgfVxuICAvKipcbiAgICogTG9ncyBhIHN0cnVjdHVyZWQgZXJyb3Igd2l0aCBmdWxsIGVycm9yIGRldGFpbHMuXG4gICAqXG4gICAqIFVzZSB0aGlzIG1ldGhvZCB3aGVuIGxvZ2dpbmcgY2F1Z2h0IGV4Y2VwdGlvbnMgdG8gY2FwdHVyZSB0aGUgZnVsbFxuICAgKiBlcnJvciBjb250ZXh0IGluY2x1ZGluZyBuYW1lLCBtZXNzYWdlLCBzdGFjayB0cmFjZSwgYW5kIGNhdXNlIGNoYWluLlxuICAgKiBAcGFyYW0gZXJyb3IgLSBUaGUgZXJyb3IgdG8gbG9nXG4gICAqIEBwYXJhbSBtZXNzYWdlIC0gSHVtYW4tcmVhZGFibGUgZGVzY3JpcHRpb24gb2Ygd2hhdCBmYWlsZWRcbiAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHRcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiB0cnkge1xuICAgKiAgIGF3YWl0IGRhbmdlcm91c09wZXJhdGlvbigpO1xuICAgKiB9IGNhdGNoIChlcnIpIHtcbiAgICogICBsb2dnZXIubG9nRXJyb3IoZXJyLCAnRmFpbGVkIHRvIGV4ZWN1dGUgZGFuZ2Vyb3VzIG9wZXJhdGlvbicsIHtcbiAgICogICAgIG9wZXJhdGlvbjogJ2RlbGV0ZScsXG4gICAqICAgICB0YXJnZXQ6ICcvaW1wb3J0YW50L2ZpbGUudHh0J1xuICAgKiAgIH0pO1xuICAgKiB9XG4gICAqIGBgYFxuICAgKi9cbiAgbG9nRXJyb3IoZXJyb3IsIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICBjb25zdCBlcnJvckluZm8gPSB0aGlzLmV4dHJhY3RFcnJvckluZm8oZXJyb3IpO1xuICAgIGNvbnN0IGV2ZW50ID0ge1xuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgIGhvb2tUeXBlOiB0aGlzLmN1cnJlbnRIb29rVHlwZSxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBpbnB1dDogdGhpcy5jdXJyZW50SW5wdXQsXG4gICAgICBlcnJvcjogZXJyb3JJbmZvLFxuICAgICAgY29udGV4dFxuICAgIH07XG4gICAgdGhpcy5kZWxpdmVyRXZlbnQoZXZlbnQpO1xuICB9XG4gIC8qKlxuICAgKiBTdWJzY3JpYmVzIGEgaGFuZGxlciB0byBsb2cgZXZlbnRzIGF0IHRoZSBzcGVjaWZpZWQgbGV2ZWwuXG4gICAqXG4gICAqIFRoZSBoYW5kbGVyIHdpbGwgYmUgY2FsbGVkIGZvciBldmVyeSBsb2cgZXZlbnQgYXQgdGhlIHNwZWNpZmllZCBsZXZlbC5cbiAgICogUmV0dXJucyBhbiB1bnN1YnNjcmliZSBmdW5jdGlvbiB0aGF0IHNob3VsZCBiZSBjYWxsZWQgd2hlbiB0aGUgaGFuZGxlclxuICAgKiBpcyBubyBsb25nZXIgbmVlZGVkLlxuICAgKiBAcGFyYW0gbGV2ZWwgLSBUaGUgbG9nIGxldmVsIHRvIHN1YnNjcmliZSB0b1xuICAgKiBAcGFyYW0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGNhbGwgZm9yIGVhY2ggZXZlbnRcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byB1bnN1YnNjcmliZSB0aGUgaGFuZGxlclxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIC8vIFN1YnNjcmliZSB0byBlcnJvciBldmVudHNcbiAgICogY29uc3QgdW5zdWJzY3JpYmUgPSBsb2dnZXIub24oJ2Vycm9yJywgKGV2ZW50KSA9PiB7XG4gICAqICAgY29uc29sZS5lcnJvcihgWyR7ZXZlbnQuaG9va1R5cGV9XSAke2V2ZW50Lm1lc3NhZ2V9YCk7XG4gICAqICAgaWYgKGV2ZW50LmVycm9yKSB7XG4gICAqICAgICBjb25zb2xlLmVycm9yKGV2ZW50LmVycm9yLnN0YWNrKTtcbiAgICogICB9XG4gICAqIH0pO1xuICAgKlxuICAgKiAvLyBMYXRlciwgY2xlYW4gdXBcbiAgICogdW5zdWJzY3JpYmUoKTtcbiAgICogYGBgXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogLy8gRm9yd2FyZCB0byBleHRlcm5hbCBsb2dnaW5nIGxpYnJhcnlcbiAgICogaW1wb3J0IHBpbm8gZnJvbSAncGlubyc7XG4gICAqIGNvbnN0IHBpbm9Mb2dnZXIgPSBwaW5vKCk7XG4gICAqXG4gICAqIGxvZ2dlci5vbignaW5mbycsIChldmVudCkgPT4gcGlub0xvZ2dlci5pbmZvKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gICAqIGxvZ2dlci5vbignd2FybicsIChldmVudCkgPT4gcGlub0xvZ2dlci53YXJuKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gICAqIGxvZ2dlci5vbignZXJyb3InLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIuZXJyb3IoZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAgICogYGBgXG4gICAqL1xuICBvbihsZXZlbCwgaGFuZGxlcikge1xuICAgIGNvbnN0IGxldmVsSGFuZGxlcnMgPSB0aGlzLmhhbmRsZXJzLmdldChsZXZlbCk7XG4gICAgaWYgKGxldmVsSGFuZGxlcnMpIHtcbiAgICAgIGxldmVsSGFuZGxlcnMuYWRkKGhhbmRsZXIpO1xuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgbGV2ZWxIYW5kbGVycz8uZGVsZXRlKGhhbmRsZXIpO1xuICAgIH07XG4gIH1cbiAgLyoqXG4gICAqIFNldHMgdGhlIGN1cnJlbnQgaG9vayBjb250ZXh0IGZvciBlbnJpY2hpbmcgbG9nIGV2ZW50cy5cbiAgICpcbiAgICogVGhpcyBpcyBjYWxsZWQgaW50ZXJuYWxseSBieSB0aGUgcnVudGltZSBiZWZvcmUgaW52b2tpbmcgaG9vayBoYW5kbGVycy5cbiAgICogWW91IHR5cGljYWxseSBkb24ndCBuZWVkIHRvIGNhbGwgdGhpcyBkaXJlY3RseS5cbiAgICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIHR5cGUgb2YgaG9vayBiZWluZyBleGVjdXRlZFxuICAgKiBAcGFyYW0gaW5wdXQgLSBUaGUgaG9vayBpbnB1dCBkYXRhXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgc2V0Q29udGV4dChob29rVHlwZSwgaW5wdXQpIHtcbiAgICB0aGlzLmN1cnJlbnRIb29rVHlwZSA9IGhvb2tUeXBlO1xuICAgIHRoaXMuY3VycmVudElucHV0ID0gaW5wdXQ7XG4gIH1cbiAgLyoqXG4gICAqIENsZWFycyB0aGUgY3VycmVudCBob29rIGNvbnRleHQuXG4gICAqXG4gICAqIENhbGxlZCBpbnRlcm5hbGx5IGJ5IHRoZSBydW50aW1lIGFmdGVyIGhvb2sgZXhlY3V0aW9uIGNvbXBsZXRlcy5cbiAgICogQGludGVybmFsXG4gICAqL1xuICBjbGVhckNvbnRleHQoKSB7XG4gICAgdGhpcy5jdXJyZW50SG9va1R5cGUgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5jdXJyZW50SW5wdXQgPSB1bmRlZmluZWQ7XG4gIH1cbiAgLyoqXG4gICAqIENvbmZpZ3VyZXMgdGhlIGxvZyBmaWxlIHBhdGggYXQgcnVudGltZS5cbiAgICpcbiAgICogQ2FsbCB0aGlzIHRvIGVuYWJsZSBvciBjaGFuZ2UgZmlsZSBsb2dnaW5nLiBTZXR0aW5nIHRvIGBudWxsYCBkaXNhYmxlc1xuICAgKiBmaWxlIGxvZ2dpbmcgKGJ1dCBkb2Vzbid0IGNsb3NlIGV4aXN0aW5nIGZpbGUgaGFuZGxlIGltbWVkaWF0ZWx5KS5cbiAgICogQHBhcmFtIGZpbGVQYXRoIC0gUGF0aCB0byB0aGUgbG9nIGZpbGUsIG9yIG51bGwgdG8gZGlzYWJsZVxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIC8vIEVuYWJsZSBmaWxlIGxvZ2dpbmcgYXQgcnVudGltZVxuICAgKiBsb2dnZXIuc2V0TG9nRmlsZSgnL3Zhci9sb2cvY2xhdWRlLWhvb2tzLmxvZycpO1xuICAgKlxuICAgKiAvLyBEaXNhYmxlIGZpbGUgbG9nZ2luZ1xuICAgKiBsb2dnZXIuc2V0TG9nRmlsZShudWxsKTtcbiAgICogYGBgXG4gICAqL1xuICBzZXRMb2dGaWxlKGZpbGVQYXRoKSB7XG4gICAgLy8gQ2xvc2UgZXhpc3RpbmcgZmlsZSBpZiBvcGVuXG4gICAgaWYgKHRoaXMubG9nRmlsZUZkICE9PSBudWxsKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjbG9zZVN5bmModGhpcy5sb2dGaWxlRmQpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIElnbm9yZSBlcnJvcnMgb24gY2xvc2VcbiAgICAgIH1cbiAgICAgIHRoaXMubG9nRmlsZUZkID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5sb2dGaWxlUGF0aCA9IGZpbGVQYXRoO1xuICAgIHRoaXMuZmlsZUluaXRpYWxpemVkID0gZmFsc2U7XG4gIH1cbiAgLyoqXG4gICAqIENsb3NlcyBhbGwgcmVzb3VyY2VzIGhlbGQgYnkgdGhlIGxvZ2dlci5cbiAgICpcbiAgICogQ2FsbCB0aGlzIGR1cmluZyBncmFjZWZ1bCBzaHV0ZG93biB0byBlbnN1cmUgYWxsIGxvZyBkYXRhIGlzIGZsdXNoZWQuXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogcHJvY2Vzcy5vbignZXhpdCcsICgpID0+IHtcbiAgICogICBsb2dnZXIuY2xvc2UoKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgY2xvc2UoKSB7XG4gICAgaWYgKHRoaXMubG9nRmlsZUZkICE9PSBudWxsKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjbG9zZVN5bmModGhpcy5sb2dGaWxlRmQpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIElnbm9yZSBlcnJvcnMgb24gY2xvc2VcbiAgICAgIH1cbiAgICAgIHRoaXMubG9nRmlsZUZkID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5maWxlSW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgfVxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZXJlIGFyZSBhbnkgYWN0aXZlIGhhbmRsZXJzIG9yIGRlc3RpbmF0aW9ucy5cbiAgICpcbiAgICogUmV0dXJucyB0cnVlIGlmIGFueSBoYW5kbGVycyBhcmUgcmVnaXN0ZXJlZCBvciBmaWxlIGxvZ2dpbmcgaXMgZW5hYmxlZC5cbiAgICogQHJldHVybnMgV2hldGhlciB0aGUgbG9nZ2VyIGhhcyBhbnkgYWN0aXZlIG91dHB1dCBkZXN0aW5hdGlvbnNcbiAgICovXG4gIGhhc0Rlc3RpbmF0aW9ucygpIHtcbiAgICBmb3IgKGNvbnN0IGhhbmRsZXJzIG9mIHRoaXMuaGFuZGxlcnMudmFsdWVzKCkpIHtcbiAgICAgIGlmIChoYW5kbGVycy5zaXplID4gMCkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmxvZ0ZpbGVQYXRoICE9PSBudWxsO1xuICB9XG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8gUHJpdmF0ZSBNZXRob2RzXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLyoqXG4gICAqIEVtaXRzIGEgbG9nIGV2ZW50LlxuICAgKiBAcGFyYW0gbGV2ZWwgLSBUaGUgc2V2ZXJpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50XG4gICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIGxvZyBtZXNzYWdlXG4gICAqIEBwYXJhbSBjb250ZXh0IC0gT3B0aW9uYWwgYWRkaXRpb25hbCBjb250ZXh0IGRhdGFcbiAgICovXG4gIGVtaXQobGV2ZWwsIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICBjb25zdCBldmVudCA9IHtcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgbGV2ZWwsXG4gICAgICBob29rVHlwZTogdGhpcy5jdXJyZW50SG9va1R5cGUsXG4gICAgICBtZXNzYWdlLFxuICAgICAgaW5wdXQ6IHRoaXMuY3VycmVudElucHV0LFxuICAgICAgY29udGV4dFxuICAgIH07XG4gICAgdGhpcy5kZWxpdmVyRXZlbnQoZXZlbnQpO1xuICB9XG4gIC8qKlxuICAgKiBEZWxpdmVycyBhbiBldmVudCB0byBhbGwgcmVnaXN0ZXJlZCBkZXN0aW5hdGlvbnMuXG4gICAqIEBwYXJhbSBldmVudCAtIFRoZSBsb2cgZXZlbnQgdG8gZGVsaXZlclxuICAgKi9cbiAgZGVsaXZlckV2ZW50KGV2ZW50KSB7XG4gICAgLy8gRGVsaXZlciB0byBldmVudCBoYW5kbGVyc1xuICAgIGNvbnN0IGxldmVsSGFuZGxlcnMgPSB0aGlzLmhhbmRsZXJzLmdldChldmVudC5sZXZlbCk7XG4gICAgaWYgKGxldmVsSGFuZGxlcnMpIHtcbiAgICAgIGZvciAoY29uc3QgaGFuZGxlciBvZiBsZXZlbEhhbmRsZXJzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaGFuZGxlcihldmVudCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8vIFNpbGVudGx5IGlnbm9yZSBoYW5kbGVyIGVycm9ycyB0byBub3QgZGlzcnVwdCBob29rIGV4ZWN1dGlvblxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFdyaXRlIHRvIGZpbGUgaWYgY29uZmlndXJlZFxuICAgIHRoaXMud3JpdGVUb0ZpbGUoZXZlbnQpO1xuICB9XG4gIC8qKlxuICAgKiBXcml0ZXMgYW4gZXZlbnQgdG8gdGhlIGxvZyBmaWxlLlxuICAgKiBAcGFyYW0gZXZlbnQgLSBUaGUgbG9nIGV2ZW50IHRvIHdyaXRlXG4gICAqL1xuICB3cml0ZVRvRmlsZShldmVudCkge1xuICAgIGlmICghdGhpcy5sb2dGaWxlUGF0aCkgcmV0dXJuO1xuICAgIC8vIExhenkgaW5pdGlhbGl6YXRpb24gb2YgZmlsZSBoYW5kbGVcbiAgICBpZiAoIXRoaXMuZmlsZUluaXRpYWxpemVkKSB7XG4gICAgICB0aGlzLmluaXRpYWxpemVGaWxlKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmxvZ0ZpbGVGZCA9PT0gbnVsbCkgcmV0dXJuO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBsaW5lID0gSlNPTi5zdHJpbmdpZnkoZXZlbnQpICsgJ1xcbic7XG4gICAgICB3cml0ZVN5bmModGhpcy5sb2dGaWxlRmQsIGxpbmUpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gU2lsZW50bHkgaWdub3JlIGZpbGUgd3JpdGUgZXJyb3JzIHRvIG5vdCBkaXNydXB0IGhvb2sgZXhlY3V0aW9uXG4gICAgICAvLyBUaGlzIGZvbGxvd3MgdGhlIHJpc2sgbWl0aWdhdGlvbjogXCJHcmFjZWZ1bCBkZWdyYWRhdGlvbiAtIGxvZyB3cml0ZVxuICAgICAgLy8gZmFpbHVyZXMgYXJlIHNpbGVudGx5IGlnbm9yZWQgdG8gbm90IGRpc3J1cHQgaG9vayBleGVjdXRpb25cIlxuICAgIH1cbiAgfVxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgdGhlIGxvZyBmaWxlIGZvciB3cml0aW5nLlxuICAgKi9cbiAgaW5pdGlhbGl6ZUZpbGUoKSB7XG4gICAgdGhpcy5maWxlSW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIGlmICghdGhpcy5sb2dGaWxlUGF0aCkgcmV0dXJuO1xuICAgIHRyeSB7XG4gICAgICAvLyBFbnN1cmUgZGlyZWN0b3J5IGV4aXN0c1xuICAgICAgY29uc3QgZGlyID0gZGlybmFtZSh0aGlzLmxvZ0ZpbGVQYXRoKTtcbiAgICAgIGlmICghZXhpc3RzU3luYyhkaXIpKSB7XG4gICAgICAgIG1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgfVxuICAgICAgLy8gT3BlbiBmaWxlIGZvciBhcHBlbmRpbmdcbiAgICAgIHRoaXMubG9nRmlsZUZkID0gb3BlblN5bmModGhpcy5sb2dGaWxlUGF0aCwgJ2EnKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIFNpbGVudGx5IGlnbm9yZSBmaWxlIGluaXRpYWxpemF0aW9uIGVycm9yc1xuICAgICAgdGhpcy5sb2dGaWxlRmQgPSBudWxsO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogRXh0cmFjdHMgc3RydWN0dXJlZCBlcnJvciBpbmZvcm1hdGlvbiBmcm9tIGFuIHVua25vd24gZXJyb3IuXG4gICAqIEBwYXJhbSBlcnJvciAtIFRoZSBlcnJvciB0byBleHRyYWN0IGluZm9ybWF0aW9uIGZyb21cbiAgICogQHJldHVybnMgU3RydWN0dXJlZCBlcnJvciBpbmZvcm1hdGlvblxuICAgKi9cbiAgZXh0cmFjdEVycm9ySW5mbyhlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBjb25zdCBpbmZvID0ge1xuICAgICAgICBuYW1lOiBlcnJvci5uYW1lLFxuICAgICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2tcbiAgICAgIH07XG4gICAgICAvLyBFeHRyYWN0IGNhdXNlIGNoYWluIGlmIHByZXNlbnRcbiAgICAgIGlmIChlcnJvci5jYXVzZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGluZm8uY2F1c2UgPSB0aGlzLmV4dHJhY3RFcnJvckluZm8oZXJyb3IuY2F1c2UpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluZm87XG4gICAgfVxuICAgIC8vIEhhbmRsZSBub24tRXJyb3IgdmFsdWVzXG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6ICdVbmtub3duRXJyb3InLFxuICAgICAgbWVzc2FnZTogU3RyaW5nKGVycm9yKVxuICAgIH07XG4gIH1cbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNpbmdsZXRvbiBFeHBvcnRcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogR2xvYmFsIGxvZ2dlciBpbnN0YW5jZSBmb3IgQ2xhdWRlIENvZGUgaG9va3MuXG4gKlxuICogVXNlIHRoaXMgc2luZ2xldG9uIGZvciBhbGwgbG9nZ2luZyB3aXRoaW4gaG9va3MuIFRoZSBsb2dnZXIgaXMgY29uZmlndXJlZFxuICogdmlhIGVudmlyb25tZW50IHZhcmlhYmxlcyBhbmQgc3VwcG9ydHMgZXZlbnQgc3Vic2NyaXB0aW9uIGZvciBjdXN0b21cbiAqIGRlc3RpbmF0aW9ucy5cbiAqXG4gKiAjIyBDb25maWd1cmF0aW9uXG4gKlxuICogfCBFbnZpcm9ubWVudCBWYXJpYWJsZSB8IERlc2NyaXB0aW9uIHxcbiAqIHwtLS0tLS0tLS0tLS0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLXxcbiAqIHwgYENMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFYCB8IFBhdGggdG8gbG9nIGZpbGUgKEpTT04gTGluZXMgZm9ybWF0KSB8XG4gKlxuICogIyMgVXNhZ2UgaW4gSG9va3NcbiAqXG4gKiBUaGUgbG9nZ2VyIGlzIHBhc3NlZCB0byBob29rIGhhbmRsZXJzIHZpYSBjb250ZXh0IGZvciBjb252ZW5pZW5jZTpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBleHBvcnQgZGVmYXVsdCBwcmVUb29sVXNlSG9vayh7IG1hdGNoZXI6ICdCYXNoJyB9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLndhcm4oJ1ZhbGlkYXRpbmcgQmFzaCBjb21tYW5kJyk7XG4gKiAgIHJldHVybiBwcmVUb29sVXNlT3V0cHV0KHsgYWxsb3c6IHRydWUgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqICMjIEV4dGVybmFsIEludGVncmF0aW9uXG4gKlxuICogU3Vic2NyaWJlIHRvIGV2ZW50cyB0byBmb3J3YXJkIGxvZ3MgdG8gZXh0ZXJuYWwgc3lzdGVtczpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBsb2dnZXIgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICogaW1wb3J0IHBpbm8gZnJvbSAncGlubyc7XG4gKlxuICogY29uc3QgcGlub0xvZ2dlciA9IHBpbm8oeyBsZXZlbDogJ2RlYnVnJyB9KTtcbiAqXG4gKiBsb2dnZXIub24oJ2RlYnVnJywgKGV2ZW50KSA9PiBwaW5vTG9nZ2VyLmRlYnVnKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gKiBsb2dnZXIub24oJ2luZm8nLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIuaW5mbyhldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICogbG9nZ2VyLm9uKCd3YXJuJywgKGV2ZW50KSA9PiBwaW5vTG9nZ2VyLndhcm4oZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAqIGxvZ2dlci5vbignZXJyb3InLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIuZXJyb3IoZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAqIGBgYFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIERpcmVjdCB1c2FnZVxuICogaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiBsb2dnZXIuaW5mbygnU3RhcnRpbmcgb3BlcmF0aW9uJyk7XG4gKiBsb2dnZXIud2FybignUmVzb3VyY2UgbGltaXQgYXBwcm9hY2hpbmcnLCB7IHVzYWdlOiAwLjkgfSk7XG4gKlxuICogdHJ5IHtcbiAqICAgYXdhaXQgcmlza3lPcGVyYXRpb24oKTtcbiAqIH0gY2F0Y2ggKGVycikge1xuICogICBsb2dnZXIubG9nRXJyb3IoZXJyLCAnUmlza3kgb3BlcmF0aW9uIGZhaWxlZCcpO1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSBuZXcgTG9nZ2VyKCk7XG4iLCAiLyoqXG4gKiBIb29rIGZhY3RvcnkgZnVuY3Rpb25zIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyB0eXBlZCBmYWN0b3J5IGZ1bmN0aW9ucyBmb3IgYWxsIDEyIGhvb2sgdHlwZXMgdGhhdCBoYW5kbGU6XG4gKiAtIElucHV0IHR5cGUgbmFycm93aW5nIGJhc2VkIG9uIGhvb2sgZXZlbnQgdHlwZVxuICogLSBPdXRwdXQgdHlwZSBlbmZvcmNlbWVudCB2aWEgcmV0dXJuIHR5cGVzXG4gKiAtIEVycm9yIHdyYXBwaW5nIHdpdGggYXV0b21hdGljIGxvZ2dpbmdcbiAqIC0gTG9nZ2VyIGNvbnRleHQgaW5qZWN0aW9uXG4gKlxuICogRWFjaCBmYWN0b3J5IGFjY2VwdHMgYSBIb29rQ29uZmlnIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dCBzZXR0aW5ncyxcbiAqIGFuZCByZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB0aGUgcnVudGltZSBpbnZva2VzIHdoZW4gdGhlIGhvb2sgZmlsZSBleGVjdXRlcy5cbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBwcmVUb29sVXNlSG9vaywgcHJlVG9vbFVzZU91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogZXhwb3J0IGRlZmF1bHQgcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnQmFzaCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdQcm9jZXNzaW5nIEJhc2ggY29tbWFuZCcpO1xuICogICByZXR1cm4gcHJlVG9vbFVzZU91dHB1dCh7IGFsbG93OiB0cnVlIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICovXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBHZW5lcmljIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIGhvb2sgZmFjdG9yeSBmdW5jdGlvbiBmb3IgYSBzcGVjaWZpYyBob29rIHR5cGUuXG4gKlxuICogVGhpcyBpcyB0aGUgaW50ZXJuYWwgaW1wbGVtZW50YXRpb24gdXNlZCBieSBhbGwgdHlwZWQgZmFjdG9yaWVzLlxuICogSXQgd3JhcHMgdGhlIGhhbmRsZXIgd2l0aCBlcnJvciBjYXRjaGluZyBhbmQgbG9nZ2luZy5cbiAqIEBwYXJhbSBob29rRXZlbnROYW1lIC0gVGhlIGhvb2sgZXZlbnQgbmFtZVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvblxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byB3cmFwXG4gKiBAcmV0dXJucyBBIHdyYXBwZWQgaG9vayBmdW5jdGlvblxuICogQGludGVybmFsXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUhvb2tGdW5jdGlvbihob29rRXZlbnROYW1lLCBjb25maWcsIGhhbmRsZXIpIHtcbiAgY29uc3QgaG9va0ZuID0gYXN5bmMgKGlucHV0LCBjb250ZXh0KSA9PiB7XG4gICAgLy8gRGVsZWdhdGUgZXJyb3IgaGFuZGxpbmcgdG8gdGhlIHJ1bnRpbWUgLSBqdXN0IGV4ZWN1dGUgdGhlIGhhbmRsZXJcbiAgICAvLyBUaGUgcnVudGltZSB3aWxsIGNhdGNoIGVycm9ycywgbG9nIHRoZW0sIGFuZCByZXR1cm4gYXBwcm9wcmlhdGUgb3V0cHV0XG4gICAgcmV0dXJuIGF3YWl0IGhhbmRsZXIoaW5wdXQsIGNvbnRleHQpO1xuICB9O1xuICAvLyBBdHRhY2ggbWV0YWRhdGEgZm9yIHJ1bnRpbWUgaW5zcGVjdGlvblxuICBob29rRm4uaG9va0V2ZW50TmFtZSA9IGhvb2tFdmVudE5hbWU7XG4gIGhvb2tGbi5tYXRjaGVyID0gY29uZmlnLm1hdGNoZXI7XG4gIGhvb2tGbi50aW1lb3V0ID0gY29uZmlnLnRpbWVvdXQ7XG4gIHJldHVybiBob29rRm47XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmVUb29sVXNlSG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbignUHJlVG9vbFVzZScsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwb3N0VG9vbFVzZUhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oJ1Bvc3RUb29sVXNlJywgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8qKiBAaW5oZXJpdGRvYyAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBvc3RUb29sVXNlRmFpbHVyZUhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oJ1Bvc3RUb29sVXNlRmFpbHVyZScsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBOb3RpZmljYXRpb24gSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBOb3RpZmljYXRpb24gaG9vayBoYW5kbGVyLlxuICpcbiAqIE5vdGlmaWNhdGlvbiBob29rcyBmaXJlIHdoZW4gQ2xhdWRlIENvZGUgc2VuZHMgYSBub3RpZmljYXRpb24sIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gRm9yd2FyZCBub3RpZmljYXRpb25zIHRvIGV4dGVybmFsIHN5c3RlbXNcbiAqIC0gTG9nIGltcG9ydGFudCBldmVudHNcbiAqIC0gVHJpZ2dlciBjdXN0b20gYWxlcnRpbmdcbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGBub3RpZmljYXRpb25fdHlwZWBcbiAqIEBwYXJhbSBjb25maWcgLSBIb29rIGNvbmZpZ3VyYXRpb24gd2l0aCBvcHRpb25hbCBtYXRjaGVyIGFuZCB0aW1lb3V0XG4gKiBAcGFyYW0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcbiAqIEByZXR1cm5zIEEgaG9vayBmdW5jdGlvbiB0aGF0IGNhbiBiZSBleHBvcnRlZCBhcyB0aGUgZGVmYXVsdCBleHBvcnRcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBub3RpZmljYXRpb25Ib29rLCBub3RpZmljYXRpb25PdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEZvcndhcmQgbm90aWZpY2F0aW9ucyB0byBTbGFja1xuICogZXhwb3J0IGRlZmF1bHQgbm90aWZpY2F0aW9uSG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdOb3RpZmljYXRpb24gcmVjZWl2ZWQnLCB7XG4gKiAgICAgdHlwZTogaW5wdXQubm90aWZpY2F0aW9uX3R5cGUsXG4gKiAgICAgdGl0bGU6IGlucHV0LnRpdGxlXG4gKiAgIH0pO1xuICpcbiAqICAgYXdhaXQgc2VuZFNsYWNrTWVzc2FnZShpbnB1dC50aXRsZSA/PyAnTm90aWZpY2F0aW9uJywgaW5wdXQubWVzc2FnZSk7XG4gKlxuICogICByZXR1cm4gbm90aWZpY2F0aW9uT3V0cHV0KHt9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjbm90aWZpY2F0aW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3RpZmljYXRpb25Ib29rKGNvbmZpZywgaGFuZGxlcikge1xuICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKCdOb3RpZmljYXRpb24nLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gVXNlclByb21wdFN1Ym1pdCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFVzZXJQcm9tcHRTdWJtaXQgaG9vayBoYW5kbGVyLlxuICpcbiAqIFVzZXJQcm9tcHRTdWJtaXQgaG9va3MgZmlyZSB3aGVuIGEgdXNlciBzdWJtaXRzIGEgcHJvbXB0LCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEFkZCBhZGRpdGlvbmFsIGNvbnRleHQgb3IgaW5zdHJ1Y3Rpb25zXG4gKiAtIExvZyB1c2VyIGludGVyYWN0aW9uc1xuICogLSBWYWxpZGF0ZSBvciB0cmFuc2Zvcm0gcHJvbXB0c1xuICpcbiAqICoqTWF0Y2hlcioqOiBObyBtYXRjaGVyIHN1cHBvcnQgLSBmaXJlcyBvbiBhbGwgcHJvbXB0IHN1Ym1pc3Npb25zXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgdGltZW91dCAobWF0Y2hlciBpcyBpZ25vcmVkKVxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgdXNlclByb21wdFN1Ym1pdEhvb2ssIHVzZXJQcm9tcHRTdWJtaXRPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEFkZCBwcm9qZWN0IGNvbnRleHQgdG8gZXZlcnkgcHJvbXB0XG4gKiBleHBvcnQgZGVmYXVsdCB1c2VyUHJvbXB0U3VibWl0SG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5kZWJ1ZygnVXNlciBwcm9tcHQgc3VibWl0dGVkJywgeyBwcm9tcHRMZW5ndGg6IGlucHV0LnByb21wdC5sZW5ndGggfSk7XG4gKlxuICogICBjb25zdCBwcm9qZWN0Q29udGV4dCA9IGF3YWl0IGdldFByb2plY3RDb250ZXh0KCk7XG4gKlxuICogICByZXR1cm4gdXNlclByb21wdFN1Ym1pdE91dHB1dCh7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6IHByb2plY3RDb250ZXh0XG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyN1c2VycHJvbXB0c3VibWl0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VyUHJvbXB0U3VibWl0SG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbignVXNlclByb21wdFN1Ym1pdCcsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTZXNzaW9uU3RhcnQgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTZXNzaW9uU3RhcnQgaG9vayBoYW5kbGVyLlxuICpcbiAqIFNlc3Npb25TdGFydCBob29rcyBmaXJlIHdoZW4gYSBDbGF1ZGUgQ29kZSBzZXNzaW9uIHN0YXJ0cyBvciByZXN0YXJ0cyxcbiAqIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gSW5pdGlhbGl6ZSBzZXNzaW9uIHN0YXRlXG4gKiAtIEluamVjdCBjb250ZXh0IG9yIGluc3RydWN0aW9uc1xuICogLSBQZXJzaXN0IGVudmlyb25tZW50IHZhcmlhYmxlcyBmb3Igc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzXG4gKiAtIFNldCB1cCBsb2dnaW5nIG9yIG1vbml0b3JpbmdcbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGBzb3VyY2VgICgnc3RhcnR1cCcsICdyZXN1bWUnLCAnY2xlYXInLCAnY29tcGFjdCcpXG4gKlxuICogKipDb250ZXh0Kio6IFNlc3Npb25TdGFydCBob29rcyByZWNlaXZlIGFuIGV4dGVuZGVkIGNvbnRleHQgd2l0aCBgcGVyc2lzdEVudlZhcmBcbiAqIGFuZCBgcGVyc2lzdEVudlZhcnNgIGZ1bmN0aW9ucyBmb3Igc2V0dGluZyBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc2Vzc2lvblN0YXJ0SG9vaywgc2Vzc2lvblN0YXJ0T3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBQZXJzaXN0IGVudmlyb25tZW50IHZhcmlhYmxlcyBmb3IgdGhlIHNlc3Npb25cbiAqIGV4cG9ydCBkZWZhdWx0IHNlc3Npb25TdGFydEhvb2soeyBtYXRjaGVyOiAnc3RhcnR1cCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciwgcGVyc2lzdEVudlZhciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdOZXcgc2Vzc2lvbiBzdGFydGVkJywge1xuICogICAgIHNlc3Npb25JZDogaW5wdXQuc2Vzc2lvbl9pZCxcbiAqICAgICBjd2Q6IGlucHV0LmN3ZFxuICogICB9KTtcbiAqXG4gKiAgIC8vIFNldCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIGFsbCBzdWJzZXF1ZW50IGJhc2ggY29tbWFuZHNcbiAqICAgcGVyc2lzdEVudlZhcignTk9ERV9FTlYnLCAnZGV2ZWxvcG1lbnQnKTtcbiAqICAgcGVyc2lzdEVudlZhcignREVCVUcnLCAndHJ1ZScpO1xuICpcbiAqICAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIFNldCBtdWx0aXBsZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYXQgb25jZVxuICogZXhwb3J0IGRlZmF1bHQgc2Vzc2lvblN0YXJ0SG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IHBlcnNpc3RFbnZWYXJzIH0pID0+IHtcbiAqICAgcGVyc2lzdEVudlZhcnMoe1xuICogICAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXG4gKiAgICAgQVBJX0tFWTogJ3NlY3JldCcsXG4gKiAgICAgREVCVUc6ICdmYWxzZSdcbiAqICAgfSk7XG4gKlxuICogICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHt9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc2Vzc2lvbnN0YXJ0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXNzaW9uU3RhcnRIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKCdTZXNzaW9uU3RhcnQnLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2Vzc2lvbkVuZCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFNlc3Npb25FbmQgaG9vayBoYW5kbGVyLlxuICpcbiAqIFNlc3Npb25FbmQgaG9va3MgZmlyZSB3aGVuIGEgQ2xhdWRlIENvZGUgc2Vzc2lvbiBlbmRzLCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIENsZWFuIHVwIHNlc3Npb24gcmVzb3VyY2VzXG4gKiAtIExvZyBzZXNzaW9uIG1ldHJpY3NcbiAqIC0gUGVyc2lzdCBzZXNzaW9uIHN0YXRlXG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgcmVhc29uYCAodGhlIGV4aXQgcmVhc29uIHN0cmluZylcbiAqIEBwYXJhbSBjb25maWcgLSBIb29rIGNvbmZpZ3VyYXRpb24gd2l0aCBvcHRpb25hbCBtYXRjaGVyIGFuZCB0aW1lb3V0XG4gKiBAcGFyYW0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcbiAqIEByZXR1cm5zIEEgaG9vayBmdW5jdGlvbiB0aGF0IGNhbiBiZSBleHBvcnRlZCBhcyB0aGUgZGVmYXVsdCBleHBvcnRcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBzZXNzaW9uRW5kSG9vaywgc2Vzc2lvbkVuZE91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gTG9nIHNlc3Npb24gZW5kIGFuZCBjbGVhbiB1cFxuICogZXhwb3J0IGRlZmF1bHQgc2Vzc2lvbkVuZEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnU2Vzc2lvbiBlbmRlZCcsIHtcbiAqICAgICBzZXNzaW9uSWQ6IGlucHV0LnNlc3Npb25faWQsXG4gKiAgICAgcmVhc29uOiBpbnB1dC5yZWFzb25cbiAqICAgfSk7XG4gKlxuICogICBhd2FpdCBjbGVhbnVwU2Vzc2lvblJlc291cmNlcyhpbnB1dC5zZXNzaW9uX2lkKTtcbiAqXG4gKiAgIHJldHVybiBzZXNzaW9uRW5kT3V0cHV0KHt9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc2Vzc2lvbmVuZFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2Vzc2lvbkVuZEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oJ1Nlc3Npb25FbmQnLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RvcCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFN0b3AgaG9vayBoYW5kbGVyLlxuICpcbiAqIFN0b3AgaG9va3MgZmlyZSB3aGVuIENsYXVkZSBDb2RlIGlzIGFib3V0IHRvIHN0b3AsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gQmxvY2sgdGhlIHN0b3AgYW5kIHJlcXVpcmUgYWRkaXRpb25hbCBhY3Rpb25cbiAqIC0gQ29uZmlybSB0aGUgdXNlciB3YW50cyB0byBzdG9wXG4gKiAtIENsZWFuIHVwIHJlc291cmNlcyBiZWZvcmUgc3RvcHBpbmdcbiAqXG4gKiAqKk1hdGNoZXIqKjogTm8gbWF0Y2hlciBzdXBwb3J0IC0gZmlyZXMgb24gYWxsIHN0b3AgZXZlbnRzXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgdGltZW91dCAobWF0Y2hlciBpcyBpZ25vcmVkKVxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc3RvcEhvb2ssIHN0b3BPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEJsb2NrIHN0b3AgaWYgdGhlcmUgYXJlIHBlbmRpbmcgY2hhbmdlc1xuICogZXhwb3J0IGRlZmF1bHQgc3RvcEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBjb25zdCBwZW5kaW5nQ2hhbmdlcyA9IGF3YWl0IGNoZWNrUGVuZGluZ0NoYW5nZXMoKTtcbiAqXG4gKiAgIGlmIChwZW5kaW5nQ2hhbmdlcy5sZW5ndGggPiAwKSB7XG4gKiAgICAgbG9nZ2VyLndhcm4oJ0Jsb2NraW5nIHN0b3AgZHVlIHRvIHBlbmRpbmcgY2hhbmdlcycsIHtcbiAqICAgICAgIGNvdW50OiBwZW5kaW5nQ2hhbmdlcy5sZW5ndGhcbiAqICAgICB9KTtcbiAqXG4gKiAgICAgcmV0dXJuIHN0b3BPdXRwdXQoe1xuICogICAgICAgZGVjaXNpb246ICdibG9jaycsXG4gKiAgICAgICByZWFzb246IGBUaGVyZSBhcmUgJHtwZW5kaW5nQ2hhbmdlcy5sZW5ndGh9IHVuY29tbWl0dGVkIGNoYW5nZXNgLFxuICogICAgICAgc3lzdGVtTWVzc2FnZTogJ1BsZWFzZSBjb21taXQgb3IgZGlzY2FyZCBjaGFuZ2VzIGJlZm9yZSBzdG9wcGluZydcbiAqICAgICB9KTtcbiAqICAgfVxuICpcbiAqICAgbG9nZ2VyLmluZm8oJ0FwcHJvdmluZyBzdG9wJyk7XG4gKiAgIHJldHVybiBzdG9wT3V0cHV0KHsgZGVjaXNpb246ICdhcHByb3ZlJyB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc3RvcFxuICovXG5leHBvcnQgZnVuY3Rpb24gc3RvcEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oJ1N0b3AnLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3ViYWdlbnRTdGFydCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFN1YmFnZW50U3RhcnQgaG9vayBoYW5kbGVyLlxuICpcbiAqIFN1YmFnZW50U3RhcnQgaG9va3MgZmlyZSB3aGVuIGEgc3ViYWdlbnQgKFRhc2sgdG9vbCkgc3RhcnRzLCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEluamVjdCBjb250ZXh0IGZvciB0aGUgc3ViYWdlbnRcbiAqIC0gTG9nIHN1YmFnZW50IGludm9jYXRpb25zXG4gKiAtIENvbmZpZ3VyZSBzdWJhZ2VudCBiZWhhdmlvclxuICpcbiAqICoqTWF0Y2hlcioqOiBNYXRjaGVzIGFnYWluc3QgYGFnZW50X3R5cGVgIChlLmcuLCAnZXhwbG9yZScsICdjb2RlYmFzZS1hbmFseXNpcycpXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc3ViYWdlbnRTdGFydEhvb2ssIHN1YmFnZW50U3RhcnRPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEFkZCBjb250ZXh0IGZvciBleHBsb3JlIHN1YmFnZW50c1xuICogZXhwb3J0IGRlZmF1bHQgc3ViYWdlbnRTdGFydEhvb2soeyBtYXRjaGVyOiAnZXhwbG9yZScgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdFeHBsb3JlIHN1YmFnZW50IHN0YXJ0aW5nJywge1xuICogICAgIGFnZW50SWQ6IGlucHV0LmFnZW50X2lkLFxuICogICAgIGFnZW50VHlwZTogaW5wdXQuYWdlbnRfdHlwZVxuICogICB9KTtcbiAqXG4gKiAgIHJldHVybiBzdWJhZ2VudFN0YXJ0T3V0cHV0KHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ0ZvY3VzIG9uIGZpbmRpbmcgcGF0dGVybnMgYW5kIGNvbnZlbnRpb25zJ1xuICogICB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc3ViYWdlbnRzdGFydFxuICovXG5leHBvcnQgZnVuY3Rpb24gc3ViYWdlbnRTdGFydEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oJ1N1YmFnZW50U3RhcnQnLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3ViYWdlbnRTdG9wIEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgU3ViYWdlbnRTdG9wIGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTdWJhZ2VudFN0b3AgaG9va3MgZmlyZSB3aGVuIGEgc3ViYWdlbnQgY29tcGxldGVzIG9yIHN0b3BzLCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEJsb2NrIHRoZSBzdWJhZ2VudCBmcm9tIHN0b3BwaW5nXG4gKiAtIFByb2Nlc3Mgc3ViYWdlbnQgcmVzdWx0c1xuICogLSBDbGVhbiB1cCBzdWJhZ2VudCByZXNvdXJjZXNcbiAqIC0gTG9nIHN1YmFnZW50IGNvbXBsZXRpb25cbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGBhZ2VudF90eXBlYCAoZS5nLiwgJ2V4cGxvcmUnLCAnY29kZWJhc2UtYW5hbHlzaXMnKVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHN1YmFnZW50U3RvcEhvb2ssIHN1YmFnZW50U3RvcE91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gQmxvY2sgZXhwbG9yZSBzdWJhZ2VudHMgaWYgdGFzayBpbmNvbXBsZXRlXG4gKiBleHBvcnQgZGVmYXVsdCBzdWJhZ2VudFN0b3BIb29rKHsgbWF0Y2hlcjogJ2V4cGxvcmUnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnU3ViYWdlbnQgc3RvcHBpbmcnLCB7XG4gKiAgICAgYWdlbnRJZDogaW5wdXQuYWdlbnRfaWQsXG4gKiAgICAgYWdlbnRUeXBlOiBpbnB1dC5hZ2VudF90eXBlXG4gKiAgIH0pO1xuICpcbiAqICAgLy8gQmxvY2sgaWYgdHJhbnNjcmlwdCBzaG93cyBpbmNvbXBsZXRlIHdvcmtcbiAqICAgcmV0dXJuIHN1YmFnZW50U3RvcE91dHB1dCh7XG4gKiAgICAgZGVjaXNpb246ICdibG9jaycsXG4gKiAgICAgcmVhc29uOiAnUGxlYXNlIHZlcmlmeSBleHBsb3JhdGlvbiBpcyBjb21wbGV0ZSdcbiAqICAgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3N1YmFnZW50c3RvcFxuICovXG5leHBvcnQgZnVuY3Rpb24gc3ViYWdlbnRTdG9wSG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbignU3ViYWdlbnRTdG9wJywgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFByZUNvbXBhY3QgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBQcmVDb21wYWN0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBQcmVDb21wYWN0IGhvb2tzIGZpcmUgYmVmb3JlIGNvbnRleHQgY29tcGFjdGlvbiBvY2N1cnMsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gUHJlc2VydmUgaW1wb3J0YW50IGluZm9ybWF0aW9uIGJlZm9yZSBjb21wYWN0aW9uXG4gKiAtIExvZyBjb21wYWN0aW9uIGV2ZW50c1xuICogLSBNb2RpZnkgY3VzdG9tIGluc3RydWN0aW9ucyBmb3IgdGhlIGNvbXBhY3RlZCBjb250ZXh0XG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgdHJpZ2dlcmAgKCdtYW51YWwnLCAnYXV0bycpXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgcHJlQ29tcGFjdEhvb2ssIHByZUNvbXBhY3RPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIExvZyBjb21wYWN0aW9uIGV2ZW50cyBhbmQgcHJlc2VydmUgY29udGV4dFxuICogZXhwb3J0IGRlZmF1bHQgcHJlQ29tcGFjdEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnQ29udGV4dCBjb21wYWN0aW9uIHRyaWdnZXJlZCcsIHtcbiAqICAgICB0cmlnZ2VyOiBpbnB1dC50cmlnZ2VyLFxuICogICAgIGhhc0N1c3RvbUluc3RydWN0aW9uczogaW5wdXQuY3VzdG9tX2luc3RydWN0aW9ucyAhPT0gbnVsbFxuICogICB9KTtcbiAqXG4gKiAgIHJldHVybiBwcmVDb21wYWN0T3V0cHV0KHtcbiAqICAgICBzeXN0ZW1NZXNzYWdlOiAnUmVtZW1iZXI6IHN0cmljdCBtb2RlIGlzIGVuYWJsZWQnXG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBPbmx5IGhhbmRsZSBtYW51YWwgY29tcGFjdGlvblxuICogZXhwb3J0IGRlZmF1bHQgcHJlQ29tcGFjdEhvb2soeyBtYXRjaGVyOiAnbWFudWFsJyB9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ01hbnVhbCBjb21wYWN0aW9uIHJlcXVlc3RlZCcpO1xuICogICByZXR1cm4gcHJlQ29tcGFjdE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3ByZWNvbXBhY3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZUNvbXBhY3RIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKCdQcmVDb21wYWN0JywgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8qKiBAaW5oZXJpdGRvYyAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBlcm1pc3Npb25SZXF1ZXN0SG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbignUGVybWlzc2lvblJlcXVlc3QnLCBjb25maWcsIGhhbmRsZXIpO1xufVxuIiwgIi8qKlxuICogRW52aXJvbm1lbnQgdmFyaWFibGUgdXRpbGl0aWVzIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyB0eXBlZCBhY2Nlc3MgdG8gQ2xhdWRlIENvZGUncyBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHV0aWxpdGllc1xuICogZm9yIHBlcnNpc3RpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzIGluIFNlc3Npb25TdGFydCBob29rcy5cbiAqXG4gKiAjIyBFbnZpcm9ubWVudCBWYXJpYWJsZXNcbiAqXG4gKiBDbGF1ZGUgQ29kZSBzZXRzIHRoZXNlIGVudmlyb25tZW50IHZhcmlhYmxlcyB3aGVuIHJ1bm5pbmcgaG9va3M6XG4gKlxuICogfCBWYXJpYWJsZSB8IERlc2NyaXB0aW9uIHwgQXZhaWxhYmxlIEluIHxcbiAqIHwtLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLS18XG4gKiB8IGBDTEFVREVfUFJPSkVDVF9ESVJgIHwgQWJzb2x1dGUgcGF0aCB0byBwcm9qZWN0IHJvb3QgfCBBbGwgaG9va3MgfFxuICogfCBgQ0xBVURFX0VOVl9GSUxFYCB8IFBhdGggdG8gZmlsZSBmb3IgcGVyc2lzdGluZyBlbnYgdmFycyB8IFNlc3Npb25TdGFydCBvbmx5IHxcbiAqIHwgYENMQVVERV9DT0RFX1JFTU9URWAgfCBgXCJ0cnVlXCJgIGlmIHJ1bm5pbmcgcmVtb3RlbHkgfCBBbGwgaG9va3MgfFxuICogQG1vZHVsZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGdldFByb2plY3REaXIsIHBlcnNpc3RFbnZWYXIsIGlzUmVtb3RlRW52aXJvbm1lbnQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEdldCBwcm9qZWN0IGRpcmVjdG9yeVxuICogY29uc3QgcHJvamVjdERpciA9IGdldFByb2plY3REaXIoKTtcbiAqXG4gKiAvLyBDaGVjayBpZiBydW5uaW5nIHJlbW90ZWx5XG4gKiBpZiAoaXNSZW1vdGVFbnZpcm9ubWVudCgpKSB7XG4gKiAgIC8vIEhhbmRsZSByZW1vdGUtc3BlY2lmaWMgbG9naWNcbiAqIH1cbiAqXG4gKiAvLyBJbiBTZXNzaW9uU3RhcnQgaG9vazogcGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAqIHBlcnNpc3RFbnZWYXIoJ05PREVfRU5WJywgJ3Byb2R1Y3Rpb24nKTtcbiAqIHBlcnNpc3RFbnZWYXIoJ0FQSV9LRVknLCAnc2VjcmV0LWtleScpO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjaG9vay1leGVjdXRpb24tZGV0YWlsc1xuICovXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdub2RlOmZzJztcbi8qKlxuICogQ2xhdWRlIENvZGUgZW52aXJvbm1lbnQgdmFyaWFibGUgbmFtZXMuXG4gKlxuICogVGhlc2UgYXJlIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdGhhdCBDbGF1ZGUgQ29kZSBzZXRzIHdoZW4gcnVubmluZyBob29rcy5cbiAqL1xuZXhwb3J0IGNvbnN0IENMQVVERV9FTlZfVkFSUyA9IHtcbiAgLyoqXG4gICAqIEFic29sdXRlIHBhdGggdG8gdGhlIHByb2plY3Qgcm9vdCBkaXJlY3Rvcnkgd2hlcmUgQ2xhdWRlIENvZGUgd2FzIHN0YXJ0ZWQuXG4gICAqIEF2YWlsYWJsZSBpbiBhbGwgaG9va3MuXG4gICAqL1xuICBQUk9KRUNUX0RJUjogJ0NMQVVERV9QUk9KRUNUX0RJUicsXG4gIC8qKlxuICAgKiBQYXRoIHRvIGEgZmlsZSB3aGVyZSBTZXNzaW9uU3RhcnQgaG9va3MgY2FuIHBlcnNpc3QgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICAgKiBWYXJpYWJsZXMgd3JpdHRlbiB0byB0aGlzIGZpbGUgd2lsbCBiZSBhdmFpbGFibGUgaW4gYWxsIHN1YnNlcXVlbnQgYmFzaCBjb21tYW5kcy5cbiAgICogT25seSBhdmFpbGFibGUgaW4gU2Vzc2lvblN0YXJ0IGhvb2tzLlxuICAgKi9cbiAgRU5WX0ZJTEU6ICdDTEFVREVfRU5WX0ZJTEUnLFxuICAvKipcbiAgICogU2V0IHRvIFwidHJ1ZVwiIHdoZW4gcnVubmluZyBpbiBhIHJlbW90ZSAod2ViKSBlbnZpcm9ubWVudC5cbiAgICogTm90IHNldCBvciBlbXB0eSB3aGVuIHJ1bm5pbmcgaW4gbG9jYWwgQ0xJIGVudmlyb25tZW50LlxuICAgKi9cbiAgUkVNT1RFOiAnQ0xBVURFX0NPREVfUkVNT1RFJ1xufTtcbi8qKlxuICogR2V0cyB0aGUgQ2xhdWRlIENvZGUgcHJvamVjdCBkaXJlY3RvcnkuXG4gKlxuICogVGhpcyBpcyB0aGUgYWJzb2x1dGUgcGF0aCB0byB0aGUgcHJvamVjdCByb290IHdoZXJlIENsYXVkZSBDb2RlIHdhcyBzdGFydGVkLlxuICogVGhlIHZhbHVlIGNvbWVzIGZyb20gdGhlIGBDTEFVREVfUFJPSkVDVF9ESVJgIGVudmlyb25tZW50IHZhcmlhYmxlLlxuICogQHJldHVybnMgVGhlIHByb2plY3QgZGlyZWN0b3J5IHBhdGgsIG9yIHVuZGVmaW5lZCBpZiBub3Qgc2V0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3QgcHJvamVjdERpciA9IGdldFByb2plY3REaXIoKTtcbiAqIGlmIChwcm9qZWN0RGlyKSB7XG4gKiAgIGNvbnN0IGNvbmZpZ1BhdGggPSBgJHtwcm9qZWN0RGlyfS8uY2xhdWRlL2NvbmZpZy5qc29uYDtcbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJvamVjdERpcigpIHtcbiAgcmV0dXJuIHByb2Nlc3MuZW52W0NMQVVERV9FTlZfVkFSUy5QUk9KRUNUX0RJUl07XG59XG4vKipcbiAqIEdldHMgdGhlIENsYXVkZSBDb2RlIGVudiBmaWxlIHBhdGggZm9yIHBlcnNpc3RpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICpcbiAqIFRoaXMgaXMgb25seSBhdmFpbGFibGUgaW4gU2Vzc2lvblN0YXJ0IGhvb2tzLiBUaGUgcGF0aCBwb2ludHMgdG8gYSBmaWxlXG4gKiB3aGVyZSB5b3UgY2FuIHdyaXRlIHNoZWxsIGV4cG9ydCBzdGF0ZW1lbnRzIHRvIHBlcnNpc3QgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gKiBmb3IgYWxsIHN1YnNlcXVlbnQgYmFzaCBjb21tYW5kcyBpbiB0aGUgc2Vzc2lvbi5cbiAqIEByZXR1cm5zIFRoZSBlbnYgZmlsZSBwYXRoLCBvciB1bmRlZmluZWQgaWYgbm90IHNldCAobm90IGEgU2Vzc2lvblN0YXJ0IGhvb2spXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3QgZW52RmlsZSA9IGdldEVudkZpbGVQYXRoKCk7XG4gKiBpZiAoZW52RmlsZSkge1xuICogICAvLyBXZSdyZSBpbiBhIFNlc3Npb25TdGFydCBob29rIGFuZCBjYW4gcGVyc2lzdCBlbnYgdmFyc1xuICogICBwZXJzaXN0RW52VmFyKCdNWV9WQVInLCAnbXktdmFsdWUnKTtcbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RW52RmlsZVBhdGgoKSB7XG4gIHJldHVybiBwcm9jZXNzLmVudltDTEFVREVfRU5WX1ZBUlMuRU5WX0ZJTEVdO1xufVxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGhvb2sgaXMgcnVubmluZyBpbiBhIHJlbW90ZSAod2ViKSBlbnZpcm9ubWVudC5cbiAqXG4gKiBSZW1vdGUgZW52aXJvbm1lbnRzIG1heSBoYXZlIGRpZmZlcmVudCBjYXBhYmlsaXRpZXMgb3IgcmVzdHJpY3Rpb25zXG4gKiBjb21wYXJlZCB0byBsb2NhbCBDTEkgZW52aXJvbm1lbnRzLlxuICogQHJldHVybnMgdHJ1ZSBpZiBydW5uaW5nIHJlbW90ZWx5LCBmYWxzZSBpZiBydW5uaW5nIGxvY2FsbHlcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpZiAoaXNSZW1vdGVFbnZpcm9ubWVudCgpKSB7XG4gKiAgIC8vIFVzZSB3ZWItY29tcGF0aWJsZSBhcHByb2FjaGVzXG4gKiB9IGVsc2Uge1xuICogICAvLyBDYW4gdXNlIGxvY2FsIENMSSBmZWF0dXJlc1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1JlbW90ZUVudmlyb25tZW50KCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnZbQ0xBVURFX0VOVl9WQVJTLlJFTU9URV0gPT09ICd0cnVlJztcbn1cbi8qKlxuICogUGVyc2lzdHMgYW4gZW52aXJvbm1lbnQgdmFyaWFibGUgZm9yIHVzZSBpbiBzdWJzZXF1ZW50IGJhc2ggY29tbWFuZHMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB3cml0ZXMgYSBzaGVsbCBleHBvcnQgc3RhdGVtZW50IHRvIHRoZSBgQ0xBVURFX0VOVl9GSUxFYCxcbiAqIHdoaWNoIENsYXVkZSBDb2RlIHNvdXJjZXMgYmVmb3JlIHJ1bm5pbmcgYmFzaCBjb21tYW5kcy4gVGhpcyBhbGxvd3NcbiAqIFNlc3Npb25TdGFydCBob29rcyB0byBjb25maWd1cmUgdGhlIGVudmlyb25tZW50IGZvciB0aGUgZW50aXJlIHNlc3Npb24uXG4gKlxuICogKipJbXBvcnRhbnQqKjogVGhpcyBmdW5jdGlvbiBvbmx5IHdvcmtzIGluIFNlc3Npb25TdGFydCBob29rcyB3aGVyZVxuICogYENMQVVERV9FTlZfRklMRWAgaXMgc2V0LiBJbiBvdGhlciBob29rcywgaXQgd2lsbCB0aHJvdyBhbiBlcnJvci5cbiAqIEBwYXJhbSBuYW1lIC0gVGhlIGVudmlyb25tZW50IHZhcmlhYmxlIG5hbWVcbiAqIEBwYXJhbSB2YWx1ZSAtIFRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSB2YWx1ZSAod2lsbCBiZSBzaGVsbC1lc2NhcGVkKVxuICogQHRocm93cyBFcnJvciBpZiBDTEFVREVfRU5WX0ZJTEUgaXMgbm90IHNldCAobm90IGluIGEgU2Vzc2lvblN0YXJ0IGhvb2spXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc2Vzc2lvblN0YXJ0SG9vaywgc2Vzc2lvblN0YXJ0T3V0cHV0LCBwZXJzaXN0RW52VmFyIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiBleHBvcnQgZGVmYXVsdCBzZXNzaW9uU3RhcnRIb29rKHt9LCBhc3luYyAoaW5wdXQpID0+IHtcbiAqICAgLy8gUGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIHRoZSBzZXNzaW9uXG4gKiAgIHBlcnNpc3RFbnZWYXIoJ05PREVfRU5WJywgJ3Byb2R1Y3Rpb24nKTtcbiAqICAgcGVyc2lzdEVudlZhcignQVBJX0tFWScsIHByb2Nlc3MuZW52Lk1ZX0FQSV9LRVkgPz8gJ2RlZmF1bHQnKTtcbiAqICAgcGVyc2lzdEVudlZhcignUEFUSCcsIGAke3Byb2Nlc3MuZW52LlBBVEh9Oi4vbm9kZV9tb2R1bGVzLy5iaW5gKTtcbiAqXG4gKiAgIHJldHVybiBzZXNzaW9uU3RhcnRPdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNwZXJzaXN0aW5nLWVudmlyb25tZW50LXZhcmlhYmxlc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcGVyc2lzdEVudlZhcihuYW1lLCB2YWx1ZSkge1xuICBjb25zdCBlbnZGaWxlID0gZ2V0RW52RmlsZVBhdGgoKTtcbiAgaWYgKGVudkZpbGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdwZXJzaXN0RW52VmFyIGNhbiBvbmx5IGJlIHVzZWQgaW4gU2Vzc2lvblN0YXJ0IGhvb2tzLiAnICsgJ0NMQVVERV9FTlZfRklMRSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBub3Qgc2V0LidcbiAgICApO1xuICB9XG4gIC8vIFNoZWxsLWVzY2FwZSB0aGUgdmFsdWUgdG8gaGFuZGxlIHNwZWNpYWwgY2hhcmFjdGVyc1xuICBjb25zdCBlc2NhcGVkVmFsdWUgPSBlc2NhcGVTaGVsbFZhbHVlKHZhbHVlKTtcbiAgLy8gV3JpdGUgdGhlIGV4cG9ydCBzdGF0ZW1lbnRcbiAgY29uc3QgZXhwb3J0U3RhdGVtZW50ID0gYGV4cG9ydCAke25hbWV9PSR7ZXNjYXBlZFZhbHVlfVxcbmA7XG4gIGZzLmFwcGVuZEZpbGVTeW5jKGVudkZpbGUsIGV4cG9ydFN0YXRlbWVudCwgJ3V0Zi04Jyk7XG59XG4vKipcbiAqIFBlcnNpc3RzIG11bHRpcGxlIGVudmlyb25tZW50IHZhcmlhYmxlcyBhdCBvbmNlLlxuICpcbiAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSB3cmFwcGVyIGFyb3VuZCBgcGVyc2lzdEVudlZhcmAgZm9yIHNldHRpbmdcbiAqIG11bHRpcGxlIHZhcmlhYmxlcyBpbiBhIHNpbmdsZSBjYWxsLlxuICogQHBhcmFtIHZhcnMgLSBPYmplY3QgbWFwcGluZyB2YXJpYWJsZSBuYW1lcyB0byB2YWx1ZXNcbiAqIEB0aHJvd3MgRXJyb3IgaWYgQ0xBVURFX0VOVl9GSUxFIGlzIG5vdCBzZXQgKG5vdCBpbiBhIFNlc3Npb25TdGFydCBob29rKVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHBlcnNpc3RFbnZWYXJzKHtcbiAqICAgTk9ERV9FTlY6ICdwcm9kdWN0aW9uJyxcbiAqICAgQVBJX0tFWTogJ3NlY3JldCcsXG4gKiAgIERFQlVHOiAnZmFsc2UnXG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGVyc2lzdEVudlZhcnModmFycykge1xuICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModmFycykpIHtcbiAgICBwZXJzaXN0RW52VmFyKG5hbWUsIHZhbHVlKTtcbiAgfVxufVxuLyoqXG4gKiBFc2NhcGVzIGEgdmFsdWUgZm9yIHNhZmUgdXNlIGluIGEgc2hlbGwgZXhwb3J0IHN0YXRlbWVudC5cbiAqXG4gKiBVc2VzIHNpbmdsZSBxdW90ZXMgYW5kIGVzY2FwZXMgYW55IGVtYmVkZGVkIHNpbmdsZSBxdW90ZXMuXG4gKiBUaGlzIHByZXZlbnRzIHNoZWxsIGluamVjdGlvbiBhbmQgaGFuZGxlcyBzcGVjaWFsIGNoYXJhY3RlcnMuXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gZXNjYXBlXG4gKiBAcmV0dXJucyBUaGUgc2hlbGwtZXNjYXBlZCB2YWx1ZSAod2l0aCBxdW90ZXMpXG4gKiBAaW50ZXJuYWxcbiAqL1xuZnVuY3Rpb24gZXNjYXBlU2hlbGxWYWx1ZSh2YWx1ZSkge1xuICAvLyBVc2Ugc2luZ2xlIHF1b3RlcyBhbmQgZXNjYXBlIGFueSBlbWJlZGRlZCBzaW5nbGUgcXVvdGVzXG4gIC8vICd2YWx1ZScgLT4gJ3ZhbCdcXCcndWUnIGZvciB2YWx1ZXMgY29udGFpbmluZyBzaW5nbGUgcXVvdGVzXG4gIGNvbnN0IGVzY2FwZWQgPSB2YWx1ZS5yZXBsYWNlKC8nL2csIFwiJ1xcXFwnJ1wiKTtcbiAgcmV0dXJuIGAnJHtlc2NhcGVkfSdgO1xufVxuIiwgIi8qKlxuICogUnVudGltZSBtb2R1bGUgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIEhhbmRsZXMgc3RkaW4vc3Rkb3V0L2V4aXQgY29kZSBzZW1hbnRpY3MgZm9yIGNvbXBpbGVkIGhvb2sgZXhlY3V0aW9uLlxuICogVGhpcyBtb2R1bGUgaXMgdGhlIGNvcmUgb3JjaGVzdHJhdG9yIHRoYXQ6XG4gKiAtIFJlYWRzIEpTT04gZnJvbSBzdGRpbiAod2lyZSBmb3JtYXQgd2l0aCBzbmFrZV9jYXNlIHByb3BlcnRpZXMpXG4gKiAtIEludm9rZXMgdGhlIGhvb2sgaGFuZGxlclxuICogLSBXcml0ZXMgb3V0cHV0IHRvIHN0ZG91dFxuICogLSBNYW5hZ2VzIGV4aXQgY29kZXNcbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBJbiBhIGNvbXBpbGVkIGhvb2sgZmlsZVxuICogaW1wb3J0IHsgZXhlY3V0ZSB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcy9ydW50aW1lJztcbiAqIGltcG9ydCBteUhvb2sgZnJvbSAnLi9teS1ob29rLmpzJztcbiAqXG4gKiBleGVjdXRlKG15SG9vayk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICovXG5pbXBvcnQgeyBwZXJzaXN0RW52VmFyLCBwZXJzaXN0RW52VmFycyB9IGZyb20gJy4vZW52LmpzJztcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4vbG9nZ2VyLmpzJztcbmltcG9ydCB7IEVYSVRfQ09ERVMgfSBmcm9tICcuL291dHB1dHMuanMnO1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RkaW4vU3Rkb3V0IEhhbmRsaW5nXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIFJlYWRzIGFsbCBkYXRhIGZyb20gc3RkaW4uXG4gKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byB0aGUgY29tcGxldGUgc3RkaW4gY29udGVudFxuICovXG5hc3luYyBmdW5jdGlvbiByZWFkU3RkaW4oKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgLy8gU2V0IGVuY29kaW5nIGZpcnN0IHRvIGVuc3VyZSBkYXRhIGV2ZW50cyByZWNlaXZlIHN0cmluZ3NcbiAgICBwcm9jZXNzLnN0ZGluLnNldEVuY29kaW5nKCd1dGYtOCcpO1xuICAgIHByb2Nlc3Muc3RkaW4ub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgIGNodW5rcy5wdXNoKGNodW5rKTtcbiAgICB9KTtcbiAgICBwcm9jZXNzLnN0ZGluLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICByZXNvbHZlKGNodW5rcy5qb2luKCcnKSk7XG4gICAgfSk7XG4gICAgcHJvY2Vzcy5zdGRpbi5vbignZXJyb3InLCAoZXJyb3IpID0+IHtcbiAgICAgIHJlamVjdChlcnJvcik7XG4gICAgfSk7XG4gIH0pO1xufVxuLyoqXG4gKiBQYXJzZXMgc3RkaW4gSlNPTiBpbnB1dC5cbiAqIEBwYXJhbSBzdGRpbkNvbnRlbnQgLSBSYXcgc3RkaW4gY29udGVudFxuICogQHJldHVybnMgUGFyc2VkIGlucHV0ICh3aXJlIGZvcm1hdCB3aXRoIHNuYWtlX2Nhc2UgcHJvcGVydGllcylcbiAqIEB0aHJvd3MgRXJyb3IgaWYgSlNPTiBpcyBtYWxmb3JtZWRcbiAqL1xuZnVuY3Rpb24gcGFyc2VTdGRpbklucHV0KHN0ZGluQ29udGVudCkge1xuICAvLyBQYXJzZSBKU09OIC0gaW5wdXQgdXNlcyB3aXJlIGZvcm1hdCAoc25ha2VfY2FzZSkgZGlyZWN0bHlcbiAgY29uc3QgcmF3SW5wdXQgPSBKU09OLnBhcnNlKHN0ZGluQ29udGVudCk7XG4gIHJldHVybiByYXdJbnB1dDtcbn1cbi8qKlxuICogV3JpdGVzIGhvb2sgb3V0cHV0IHRvIHN0ZG91dC5cbiAqXG4gKiBPdXRwdXQgdXNlcyBjYW1lbENhc2Uga2V5cyBwZXIgQ2xhdWRlIENvZGUgaG9vayBzcGVjaWZpY2F0aW9uLlxuICogQHBhcmFtIG91dHB1dCAtIFRoZSBob29rIG91dHB1dCB0byB3cml0ZVxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI2hvb2stb3V0cHV0LXN0cnVjdHVyZVxuICovXG5mdW5jdGlvbiB3cml0ZVN0ZG91dChvdXRwdXQpIHtcbiAgLy8gT3V0cHV0IHVzZXMgY2FtZWxDYXNlIC0gbm8gdHJhbnNmb3JtYXRpb24gbmVlZGVkXG4gIHByb2Nlc3Muc3Rkb3V0LndyaXRlKEpTT04uc3RyaW5naWZ5KG91dHB1dCkpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRXJyb3IgSGFuZGxpbmdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhbiBlcnJvciBvdXRwdXQgZm9yIG1hbGZvcm1lZCBzdGRpbiBKU09OLlxuICogQHBhcmFtIGVycm9yIC0gVGhlIHBhcnNlIGVycm9yXG4gKiBAcmV0dXJucyBIb29rT3V0cHV0IHdpdGggZW1wdHkgc3Rkb3V0XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZU1hbGZvcm1lZElucHV0T3V0cHV0KGVycm9yKSB7XG4gIGxvZ2dlci5lcnJvcihgSW52YWxpZCBKU09OIGlucHV0OiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gKTtcbiAgcmV0dXJuIHsgc3Rkb3V0OiB7fSB9O1xufVxuLyoqXG4gKiBXcml0ZXMgaGFuZGxlciBlcnJvciBzdGFja3RyYWNlIHRvIHN0ZGVyciBhbmQgZXhpdHMgd2l0aCBjb2RlIDIuXG4gKlxuICogV2hlbiBhIGhvb2sgaGFuZGxlciB0aHJvd3MgYW4gZXhjZXB0aW9uOlxuICogLSBTdGFja3RyYWNlICh3aXRoIHNvdXJjZW1hcHMgaWYgYXZhaWxhYmxlKSBpcyBvdXRwdXQgdG8gc3RkZXJyXG4gKiAtIFByb2Nlc3MgZXhpdHMgd2l0aCBjb2RlIDIgKEJMT0NLKVxuICogLSBObyBKU09OIGlzIG91dHB1dCB0byBzdGRvdXRcbiAqIEBwYXJhbSBlcnJvciAtIFRoZSBlcnJvciB0aHJvd24gYnkgdGhlIGhhbmRsZXJcbiAqL1xuZnVuY3Rpb24gaGFuZGxlSGFuZGxlckVycm9yKGVycm9yKSB7XG4gIC8vIFdyaXRlIHN0YWNrIHRyYWNlIHRvIHN0ZGVyciAoc291cmNlbWFwcyBhcmUgYXBwbGllZCBhdXRvbWF0aWNhbGx5IGJ5IE5vZGUuanMpXG4gIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoYCR7ZXJyb3Iuc3RhY2sgPz8gZXJyb3IubWVzc2FnZX1cXG5gKTtcbiAgfSBlbHNlIHtcbiAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShgJHtTdHJpbmcoZXJyb3IpfVxcbmApO1xuICB9XG4gIC8vIExvZyB0byBmaWxlIGlmIGNvbmZpZ3VyZWRcbiAgbG9nZ2VyLmVycm9yKGBIb29rIGhhbmRsZXIgZXJyb3I6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWApO1xuICAvLyBDbGVhciBsb2dnZXIgY29udGV4dCBhbmQgY2xvc2VcbiAgbG9nZ2VyLmNsZWFyQ29udGV4dCgpO1xuICBsb2dnZXIuY2xvc2UoKTtcbiAgLy8gRXhpdCB3aXRoIGNvZGUgMiAoQkxPQ0spIC0gbm8gSlNPTiBvdXRwdXRcbiAgcHJvY2Vzcy5leGl0KEVYSVRfQ09ERVMuQkxPQ0spO1xufVxuLyoqXG4gKiBDb252ZXJ0cyBhIFNwZWNpZmljSG9va091dHB1dCB0byBIb29rT3V0cHV0IGZvciB3aXJlIGZvcm1hdC5cbiAqXG4gKiBTcGVjaWZpY0hvb2tPdXRwdXQgdHlwZXMgaGF2ZTogeyBfdHlwZSwgZXhpdENvZGUsIHN0ZG91dCwgc3RkZXJyPyB9XG4gKiBIb29rT3V0cHV0IGhhczogeyBleGl0Q29kZSwgc3Rkb3V0LCBzdGRlcnI/IH1cbiAqXG4gKiBTaW5jZSBvdXRwdXQgYnVpbGRlcnMgbm93IHByb2R1Y2Ugd2lyZS1mb3JtYXQgZGlyZWN0bHksIHRoaXMgZnVuY3Rpb25cbiAqIHNpbXBseSBzdHJpcHMgdGhlIGBfdHlwZWAgZGlzY3JpbWluYXRvciBmaWVsZC5cbiAqIEBwYXJhbSBzcGVjaWZpY091dHB1dCAtIFRoZSBzcGVjaWZpYyBvdXRwdXQgZnJvbSBhIGhvb2sgaGFuZGxlclxuICogQHJldHVybnMgSG9va091dHB1dCByZWFkeSBmb3Igc2VyaWFsaXphdGlvblxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI2hvb2stb3V0cHV0LXN0cnVjdHVyZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IHNwZWNpZmljT3V0cHV0ID0gcHJlVG9vbFVzZU91dHB1dCh7IGhvb2tTcGVjaWZpY091dHB1dDogeyBwZXJtaXNzaW9uRGVjaXNpb246ICdhbGxvdycgfSB9KTtcbiAqIGNvbnN0IGhvb2tPdXRwdXQgPSBjb252ZXJ0VG9Ib29rT3V0cHV0KHNwZWNpZmljT3V0cHV0KTtcbiAqIC8vIGhvb2tPdXRwdXQ6IHsgZXhpdENvZGU6IDAsIHN0ZG91dDogeyBob29rU3BlY2lmaWNPdXRwdXQ6IHsgLi4uIH0gfSB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRUb0hvb2tPdXRwdXQoc3BlY2lmaWNPdXRwdXQpIHtcbiAgcmV0dXJuIHsgc3Rkb3V0OiBzcGVjaWZpY091dHB1dC5zdGRvdXQgfTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEV4ZWN1dGUgRnVuY3Rpb25cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogRXhlY3V0ZXMgYSBob29rIGhhbmRsZXIgd2l0aCBmdWxsIHJ1bnRpbWUgb3JjaGVzdHJhdGlvbi5cbiAqXG4gKiBUaGlzIGlzIHRoZSBtYWluIGVudHJ5IHBvaW50IHRoYXQgY29tcGlsZWQgaG9va3MgdXNlLiBXaGVuIGEgY29tcGlsZWQgaG9va1xuICogcnVucyBhcyBhIENMSTpcbiAqXG4gKiAxLiBSZWFkcyBhbGwgc3RkaW5cbiAqIDIuIFBhcnNlcyBKU09OICh3aXJlIGZvcm1hdCB3aXRoIHNuYWtlX2Nhc2UgcHJvcGVydGllcylcbiAqIDMuIFNldHMgdXAgbG9nZ2VyIGNvbnRleHQgKGhvb2tUeXBlLCBpbnB1dClcbiAqIDQuIENhbGxzIGhhbmRsZXIgd2l0aCBpbnB1dCBhbmQgY29udGV4dCAobG9nZ2VyKVxuICogNS4gSGFuZGxlcyBhbnkgZXJyb3JzLCBsb2dzIHRoZW1cbiAqIDYuIFdyaXRlcyBKU09OIHRvIHN0ZG91dFxuICogNy4gQ2xvc2VzIGxvZ2dlclxuICogOC4gRXhpdHMgd2l0aCBhcHByb3ByaWF0ZSBjb2RlXG4gKiBAcGFyYW0gaG9va0ZuIC0gVGhlIGhvb2sgZnVuY3Rpb24gdG8gZXhlY3V0ZSAoZnJvbSBob29rIGZhY3RvcnkpXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gSW4gY29tcGlsZWQgaG9vayBmaWxlXG4gKiBpbXBvcnQgeyBleGVjdXRlIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzL3J1bnRpbWUnO1xuICogaW1wb3J0IHsgcHJlVG9vbFVzZUhvb2ssIHByZVRvb2xVc2VPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIGNvbnN0IG15SG9vayA9IHByZVRvb2xVc2VIb29rKHsgbWF0Y2hlcjogJ0Jhc2gnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnUHJvY2Vzc2luZyBCYXNoIGNvbW1hbmQnKTtcbiAqICAgcmV0dXJuIHByZVRvb2xVc2VPdXRwdXQoeyBhbGxvdzogdHJ1ZSB9KTtcbiAqIH0pO1xuICpcbiAqIGV4ZWN1dGUobXlIb29rKTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlKGhvb2tGbikge1xuICBsZXQgb3V0cHV0O1xuICB0cnkge1xuICAgIC8vIENoZWNrIGZvciBsb2cgZmlsZSBjb25maWd1cmF0aW9uIGNvbmZsaWN0c1xuICAgIC8vIENMQVVERV9DT0RFX0hPT0tTX0NMSV9MT0dfRklMRSBpcyBpbmplY3RlZCBieSB0aGUgQ0xJIC0tbG9nIHBhcmFtZXRlclxuICAgIC8vIENMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFIGlzIHRoZSB1c2VyJ3MgZW52aXJvbm1lbnQgdmFyaWFibGVcbiAgICBjb25zdCBjbGlMb2dGaWxlID0gcHJvY2Vzcy5lbnZbJ0NMQVVERV9DT0RFX0hPT0tTX0NMSV9MT0dfRklMRSddO1xuICAgIGNvbnN0IGVudkxvZ0ZpbGUgPSBwcm9jZXNzLmVudlsnQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEUnXTtcbiAgICBpZiAoY2xpTG9nRmlsZSAhPT0gdW5kZWZpbmVkICYmIGVudkxvZ0ZpbGUgIT09IHVuZGVmaW5lZCAmJiBjbGlMb2dGaWxlICE9PSBlbnZMb2dGaWxlKSB7XG4gICAgICAvLyBXcml0ZSBlcnJvciB0byBzdGRlcnIgYW5kIGV4aXQgd2l0aCBlcnJvciBjb2RlXG4gICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgYExvZyBmaWxlIGNvbmZpZ3VyYXRpb24gY29uZmxpY3Q6IENMSSAtLWxvZz1cIiR7Y2xpTG9nRmlsZX1cIiB2cyBDTEFVREVfQ09ERV9IT09LU19MT0dfRklMRT1cIiR7ZW52TG9nRmlsZX1cIi4gYCArXG4gICAgICAgICAgJ1VzZSBvbmx5IG9uZSBtZXRob2QgdG8gY29uZmlndXJlIGhvb2sgbG9nZ2luZy5cXG4nXG4gICAgICApO1xuICAgICAgcHJvY2Vzcy5leGl0KEVYSVRfQ09ERVMuRVJST1IpO1xuICAgIH1cbiAgICAvLyBJZiBDTEkgbG9nIGZpbGUgaXMgc2V0LCBjb25maWd1cmUgdGhlIGxvZ2dlclxuICAgIGlmIChjbGlMb2dGaWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxvZ2dlci5zZXRMb2dGaWxlKGNsaUxvZ0ZpbGUpO1xuICAgIH1cbiAgICAvLyBSZWFkIGFuZCBwYXJzZSBzdGRpblxuICAgIGxldCBzdGRpbkNvbnRlbnQ7XG4gICAgdHJ5IHtcbiAgICAgIHN0ZGluQ29udGVudCA9IGF3YWl0IHJlYWRTdGRpbigpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dnZXIubG9nRXJyb3IoZXJyb3IsICdGYWlsZWQgdG8gcmVhZCBzdGRpbicpO1xuICAgICAgb3V0cHV0ID0gY3JlYXRlTWFsZm9ybWVkSW5wdXRPdXRwdXQoZXJyb3IpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBQYXJzZSBhbmQgdHJhbnNmb3JtIGlucHV0XG4gICAgbGV0IGlucHV0O1xuICAgIHRyeSB7XG4gICAgICBpbnB1dCA9IHBhcnNlU3RkaW5JbnB1dChzdGRpbkNvbnRlbnQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dnZXIubG9nRXJyb3IoZXJyb3IsICdGYWlsZWQgdG8gcGFyc2Ugc3RkaW4gSlNPTicpO1xuICAgICAgb3V0cHV0ID0gY3JlYXRlTWFsZm9ybWVkSW5wdXRPdXRwdXQoZXJyb3IpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBTZXQgbG9nZ2VyIGNvbnRleHRcbiAgICBjb25zdCBob29rRXZlbnROYW1lID0gaG9va0ZuLmhvb2tFdmVudE5hbWU7XG4gICAgbG9nZ2VyLnNldENvbnRleHQoaG9va0V2ZW50TmFtZSwgaW5wdXQpO1xuICAgIC8vIEJ1aWxkIGNvbnRleHQgLSBTZXNzaW9uU3RhcnQgaG9va3MgZ2V0IGV4dGVuZGVkIGNvbnRleHQgd2l0aCBwZXJzaXN0RW52VmFyXG4gICAgY29uc3QgY29udGV4dCA9IGhvb2tFdmVudE5hbWUgPT09ICdTZXNzaW9uU3RhcnQnID8geyBsb2dnZXIsIHBlcnNpc3RFbnZWYXIsIHBlcnNpc3RFbnZWYXJzIH0gOiB7IGxvZ2dlciB9O1xuICAgIC8vIEV4ZWN1dGUgaGFuZGxlclxuICAgIHRyeSB7XG4gICAgICBjb25zdCBzcGVjaWZpY091dHB1dCA9IGF3YWl0IGhvb2tGbihpbnB1dCwgY29udGV4dCk7XG4gICAgICBvdXRwdXQgPSBjb252ZXJ0VG9Ib29rT3V0cHV0KHNwZWNpZmljT3V0cHV0KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gSGFuZGxlciB0aHJldyAtIG91dHB1dCBzdGFja3RyYWNlIHRvIHN0ZGVyciBhbmQgZXhpdCB3aXRoIGNvZGUgMlxuICAgICAgLy8gVGhpcyBjYWxsIG5ldmVyIHJldHVybnMgKHByb2Nlc3MuZXhpdClcbiAgICAgIGhhbmRsZUhhbmRsZXJFcnJvcihlcnJvcik7XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIC8vIFdyaXRlIG91dHB1dCBpZiB3ZSBoYXZlIGl0XG4gICAgaWYgKG91dHB1dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB3cml0ZVN0ZG91dChvdXRwdXQuc3Rkb3V0KTtcbiAgICB9XG4gICAgLy8gQ2xlYXIgbG9nZ2VyIGNvbnRleHRcbiAgICBsb2dnZXIuY2xlYXJDb250ZXh0KCk7XG4gICAgbG9nZ2VyLmNsb3NlKCk7XG4gICAgLy8gRXhpdCB3aXRoIHN1Y2Nlc3MgKGhhbmRsZXIgZXJyb3JzIGV4aXQgdmlhIGhhbmRsZUhhbmRsZXJFcnJvciB3aXRoIGNvZGUgMilcbiAgICBwcm9jZXNzLmV4aXQoRVhJVF9DT0RFUy5TVUNDRVNTKTtcbiAgfVxufVxuIiwgIi8qKlxuICogU2tpbGwgUmVsb2FkZXIgLSBTZXNzaW9uU3RhcnQgaG9vayB0aGF0IHJlbG9hZHMgc2tpbGxzIGFmdGVyIGNvbnRleHQgY29tcGFjdGlvbi5cbiAqXG4gKiBXaGVuIGEgc2Vzc2lvbiBzdGFydHMgZHVlIHRvIGNvbXBhY3Rpb24sIHRoaXMgaG9vayByZWFkcyB0aGUgdHJhY2tlZCBza2lsbHNcbiAqIGFuZCBvdXRwdXRzIGluc3RydWN0aW9ucyB0byByZWxvYWQgdGhlbSwgcHJlc2VydmluZyBza2lsbCBjb250ZXh0IGFjcm9zcyBjb21wYWN0aW9uLlxuICpcbiAqIEltcGxlbWVudHMgb25lLXNob3QgYmVoYXZpb3IgYnkgZGVsZXRpbmcgdGhlIGVuYWJsZW1lbnQgZmxhZyBhZnRlciBydW5uaW5nLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNzZXNzaW9uc3RhcnRcbiAqL1xuXG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMsIHVubGlua1N5bmMsIHdyaXRlRmlsZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgc2Vzc2lvblN0YXJ0SG9vaywgc2Vzc2lvblN0YXJ0T3V0cHV0IH0gZnJvbSBcIkBnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rc1wiO1xuaW1wb3J0IHsgZ2V0UmVsb2FkRmxhZ1BhdGgsIGdldFNraWxsc0ZpbGVQYXRoIH0gZnJvbSBcIi4vc2tpbGwtdHJhY2tlci5qc1wiO1xuXG4vKipcbiAqIEZvcm1hdHMgYSBsaXN0IG9mIHNraWxscyBmb3IgaHVtYW4tcmVhZGFibGUgb3V0cHV0LlxuICogLSBTaW5nbGUgc2tpbGw6ICdza2lsbDEnXG4gKiAtIFR3byBza2lsbHM6ICdza2lsbDEnIGFuZCAnc2tpbGwyJ1xuICogLSBUaHJlZSBvciBtb3JlOiAnc2tpbGwxJywgJ3NraWxsMicsIGFuZCAnc2tpbGwzJ1xuICovXG5mdW5jdGlvbiBmb3JtYXRTa2lsbExpc3Qoc2tpbGxzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGlmIChza2lsbHMubGVuZ3RoID09PSAwKSByZXR1cm4gXCJcIjtcbiAgaWYgKHNraWxscy5sZW5ndGggPT09IDEpIHJldHVybiBgJyR7c2tpbGxzWzBdfSdgO1xuICBpZiAoc2tpbGxzLmxlbmd0aCA9PT0gMikgcmV0dXJuIGAnJHtza2lsbHNbMF19JyBhbmQgJyR7c2tpbGxzWzFdfSdgO1xuXG4gIGNvbnN0IGFsbEJ1dExhc3QgPSBza2lsbHMuc2xpY2UoMCwgLTEpLm1hcCgocykgPT4gYCcke3N9J2ApO1xuICBjb25zdCBsYXN0ID0gYCcke3NraWxsc1tza2lsbHMubGVuZ3RoIC0gMV19J2A7XG4gIHJldHVybiBgJHthbGxCdXRMYXN0LmpvaW4oXCIsIFwiKX0sIGFuZCAke2xhc3R9YDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgc2Vzc2lvblN0YXJ0SG9vayh7IG1hdGNoZXI6IFwiY29tcGFjdFwiIH0sIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICBjb25zdCBlbmFibGVtZW50RmxhZyA9IGdldFJlbG9hZEZsYWdQYXRoKGlucHV0LnNlc3Npb25faWQpO1xuICBjb25zdCBza2lsbHNGaWxlID0gZ2V0U2tpbGxzRmlsZVBhdGgoaW5wdXQuc2Vzc2lvbl9pZCk7XG5cbiAgLy8gQ2hlY2sgaWYgZW5hYmxlbWVudCBmbGFnIGV4aXN0cyAoc2V0IGJ5IFByZUNvbXBhY3QgaG9vayBpZiBpbXBsZW1lbnRlZCwgb3IgbWFudWFsbHkpXG4gIGlmICghZXhpc3RzU3luYyhlbmFibGVtZW50RmxhZykpIHtcbiAgICBsb2dnZXIuZGVidWcoXCJTa2lsbCByZWxvYWQgbm90IGVuYWJsZWQgZm9yIHRoaXMgc2Vzc2lvblwiKTtcbiAgICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHt9KTtcbiAgfVxuXG4gIC8vIENoZWNrIGlmIHNraWxscyBmaWxlIGV4aXN0cyBhbmQgaGFzIGNvbnRlbnRcbiAgaWYgKCFleGlzdHNTeW5jKHNraWxsc0ZpbGUpKSB7XG4gICAgbG9nZ2VyLmRlYnVnKFwiTm8gc2tpbGxzIGZpbGUgZm91bmRcIik7XG4gICAgdHJ5IHtcbiAgICAgIHVubGlua1N5bmMoZW5hYmxlbWVudEZsYWcpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gSWdub3JlIGNsZWFudXAgZXJyb3JzXG4gICAgfVxuICAgIHJldHVybiBzZXNzaW9uU3RhcnRPdXRwdXQoe30pO1xuICB9XG5cbiAgbGV0IGNvbnRlbnQ6IHN0cmluZztcbiAgdHJ5IHtcbiAgICBjb250ZW50ID0gcmVhZEZpbGVTeW5jKHNraWxsc0ZpbGUsIFwidXRmLThcIik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nZ2VyLndhcm4oXCJGYWlsZWQgdG8gcmVhZCBza2lsbHMgZmlsZVwiLCB7IGVycm9yOiBTdHJpbmcoZXJyb3IpIH0pO1xuICAgIHRyeSB7XG4gICAgICB1bmxpbmtTeW5jKGVuYWJsZW1lbnRGbGFnKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIElnbm9yZSBjbGVhbnVwIGVycm9yc1xuICAgIH1cbiAgICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHt9KTtcbiAgfVxuXG4gIC8vIERlZHVwbGljYXRlIGFuZCBmaWx0ZXIgZW1wdHkgbGluZXNcbiAgY29uc3Qgc2tpbGxzID0gWy4uLm5ldyBTZXQoY29udGVudC5zcGxpdChcIlxcblwiKS5maWx0ZXIoKGxpbmUpID0+IGxpbmUudHJpbSgpKSldO1xuXG4gIGlmIChza2lsbHMubGVuZ3RoID09PSAwKSB7XG4gICAgbG9nZ2VyLmRlYnVnKFwiTm8gc2tpbGxzIHRvIHJlbG9hZFwiKTtcbiAgICB0cnkge1xuICAgICAgdW5saW5rU3luYyhlbmFibGVtZW50RmxhZyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBJZ25vcmUgY2xlYW51cCBlcnJvcnNcbiAgICB9XG4gICAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7fSk7XG4gIH1cblxuICAvLyBEZWxldGUgdGhlIGVuYWJsZW1lbnQgZmxhZyAob25lLXNob3QgYmVoYXZpb3IpXG4gIHRyeSB7XG4gICAgdW5saW5rU3luYyhlbmFibGVtZW50RmxhZyk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIElnbm9yZSBjbGVhbnVwIGVycm9yc1xuICB9XG5cbiAgY29uc3Qgc2tpbGxMaXN0ID0gZm9ybWF0U2tpbGxMaXN0KHNraWxscyk7XG4gIGxvZ2dlci5pbmZvKFwiUmVsb2FkaW5nIHNraWxscyBhZnRlciBjb21wYWN0aW9uXCIsIHsgc2tpbGxzLCBza2lsbExpc3QgfSk7XG5cbiAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7XG4gICAgc3lzdGVtTWVzc2FnZTogYFNraWxsIHJlbG9hZGVyOiBSZXN0b3JpbmcgJHtza2lsbExpc3R9IGFmdGVyIGNvbnRleHQgY29tcGFjdGlvbmAsXG4gICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gICAgICBhZGRpdGlvbmFsQ29udGV4dDogYExvYWQgc2tpbGwgJHtza2lsbExpc3R9IGJlZm9yZSBjb250aW51aW5nYCxcbiAgICB9LFxuICB9KTtcbn0pO1xuXG4vKipcbiAqIEVuYWJsZXMgc2tpbGwgcmVsb2FkIGZvciB0aGUgbmV4dCBjb21wYWN0aW9uLlxuICogQ2FsbCB0aGlzIGZyb20gYSBQcmVDb21wYWN0IGhvb2sgdG8gZW5hYmxlIHRoZSByZWxvYWQgbWVjaGFuaXNtLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlU2tpbGxSZWxvYWQoc2Vzc2lvbklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgZW5hYmxlbWVudEZsYWcgPSBnZXRSZWxvYWRGbGFnUGF0aChzZXNzaW9uSWQpO1xuICB3cml0ZUZpbGVTeW5jKGVuYWJsZW1lbnRGbGFnLCBcIjFcIiwgXCJ1dGYtOFwiKTtcbn1cbiIsICIvKipcbiAqIFNraWxsIFRyYWNrZXIgLSBQb3N0VG9vbFVzZSBob29rIHRoYXQgcmVjb3JkcyBTa2lsbCB0b29sIGludm9jYXRpb25zLlxuICpcbiAqIFJlY29yZHMgZWFjaCBpbnZva2VkIHNraWxsIG5hbWUgdG8gYSBzZXNzaW9uLXNjb3BlZCBmaWxlIGZvciBsYXRlclxuICogcmVsb2FkIGFmdGVyIGNvbnRleHQgY29tcGFjdGlvbi5cbiAqXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjcG9zdHRvb2x1c2VcbiAqL1xuXG5pbXBvcnQgeyBhcHBlbmRGaWxlU3luYywgZXhpc3RzU3luYywgbWtkaXJTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBwb3N0VG9vbFVzZUhvb2ssIHBvc3RUb29sVXNlT3V0cHV0IH0gZnJvbSBcIkBnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rc1wiO1xuXG5pbnRlcmZhY2UgU2tpbGxUb29sSW5wdXQge1xuICBza2lsbDogc3RyaW5nO1xuICBhcmdzPzogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiBpc1NraWxsVG9vbElucHV0KGlucHV0OiB1bmtub3duKTogaW5wdXQgaXMgU2tpbGxUb29sSW5wdXQge1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiBpbnB1dCA9PT0gXCJvYmplY3RcIiAmJlxuICAgIGlucHV0ICE9PSBudWxsICYmXG4gICAgXCJza2lsbFwiIGluIGlucHV0ICYmXG4gICAgdHlwZW9mIChpbnB1dCBhcyBTa2lsbFRvb2xJbnB1dCkuc2tpbGwgPT09IFwic3RyaW5nXCJcbiAgKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBwYXRoIHRvIHRoZSBza2lsbHMgdHJhY2tpbmcgZmlsZSBmb3IgYSBzZXNzaW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2tpbGxzRmlsZVBhdGgoc2Vzc2lvbklkOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYC90bXAvY2xhdWRlX3NraWxsc18ke3Nlc3Npb25JZH0udHh0YDtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBwYXRoIHRvIHRoZSByZWxvYWQgZW5hYmxlbWVudCBmbGFnIGZpbGUgZm9yIGEgc2Vzc2lvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFJlbG9hZEZsYWdQYXRoKHNlc3Npb25JZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvdG1wL2NsYXVkZV9za2lsbHNfcmVsb2FkXyR7c2Vzc2lvbklkfS5lbmFibGVkYDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9zdFRvb2xVc2VIb29rKHsgbWF0Y2hlcjogXCJTa2lsbFwiIH0sIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICBjb25zdCB0b29sSW5wdXQgPSBpbnB1dC50b29sX2lucHV0O1xuXG4gIGlmICghaXNTa2lsbFRvb2xJbnB1dCh0b29sSW5wdXQpKSB7XG4gICAgbG9nZ2VyLmRlYnVnKFwiTm8gc2tpbGwgbmFtZSBmb3VuZCBpbiB0b29sIGlucHV0XCIpO1xuICAgIHJldHVybiBwb3N0VG9vbFVzZU91dHB1dCh7fSk7XG4gIH1cblxuICBjb25zdCBza2lsbE5hbWUgPSB0b29sSW5wdXQuc2tpbGw7XG4gIGNvbnN0IHNraWxsc0ZpbGUgPSBnZXRTa2lsbHNGaWxlUGF0aChpbnB1dC5zZXNzaW9uX2lkKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGRpciA9IGRpcm5hbWUoc2tpbGxzRmlsZSk7XG4gICAgaWYgKCFleGlzdHNTeW5jKGRpcikpIHtcbiAgICAgIG1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICBhcHBlbmRGaWxlU3luYyhza2lsbHNGaWxlLCBgJHtza2lsbE5hbWV9XFxuYCwgXCJ1dGYtOFwiKTtcbiAgICBsb2dnZXIuaW5mbyhcIlRyYWNrZWQgc2tpbGwgaW52b2NhdGlvblwiLCB7IHNraWxsOiBza2lsbE5hbWUsIGZpbGU6IHNraWxsc0ZpbGUgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nZ2VyLndhcm4oXCJGYWlsZWQgdG8gdHJhY2sgc2tpbGxcIiwgeyBza2lsbDogc2tpbGxOYW1lLCBlcnJvcjogU3RyaW5nKGVycm9yKSB9KTtcbiAgfVxuXG4gIHJldHVybiBwb3N0VG9vbFVzZU91dHB1dCh7fSk7XG59KTtcbiIsICIvKipcbiAqIFByZS1Db21wYWN0IGhvb2sgdGhhdCBlbmFibGVzIHNraWxsIHJlbG9hZCBhZnRlciBjb21wYWN0aW9uLlxuICpcbiAqIEJlZm9yZSBjb250ZXh0IGNvbXBhY3Rpb24sIHRoaXMgaG9vayBzZXRzIGFuIGVuYWJsZW1lbnQgZmxhZyB0aGF0IHRyaWdnZXJzXG4gKiB0aGUgc2tpbGwtcmVsb2FkZXIgaG9vayB0byByZWxvYWQgdHJhY2tlZCBza2lsbHMgYWZ0ZXIgY29tcGFjdGlvbiBjb21wbGV0ZXMuXG4gKlxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3ByZWNvbXBhY3RcbiAqL1xuXG5pbXBvcnQgeyBwcmVDb21wYWN0SG9vaywgcHJlQ29tcGFjdE91dHB1dCB9IGZyb20gXCJAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3NcIjtcbmltcG9ydCB7IGVuYWJsZVNraWxsUmVsb2FkIH0gZnJvbSBcIi4vc2tpbGwtcmVsb2FkZXIuanNcIjtcblxuZXhwb3J0IGRlZmF1bHQgcHJlQ29tcGFjdEhvb2soe30sIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICBlbmFibGVTa2lsbFJlbG9hZChpbnB1dC5zZXNzaW9uX2lkKTtcbiAgbG9nZ2VyLmluZm8oXCJFbmFibGVkIHNraWxsIHJlbG9hZCBmb3IgcG9zdC1jb21wYWN0aW9uXCIsIHsgc2Vzc2lvbklkOiBpbnB1dC5zZXNzaW9uX2lkIH0pO1xuXG4gIHJldHVybiBwcmVDb21wYWN0T3V0cHV0KHt9KTtcbn0pO1xuIiwgIlxuaW1wb3J0IGhvb2sgZnJvbSAnL3dvcmtzcGFjZS9wYWNrYWdlcy9nb29kZm9vdC1ob29rcy9zcmMvcHJlLWNvbXBhY3QudHMnO1xuaW1wb3J0IHsgZXhlY3V0ZSB9IGZyb20gJy93b3Jrc3BhY2UvcGFja2FnZXMvY2xhdWRlLWNvZGUtaG9va3MvZGlzdC9ydW50aW1lLmpzJztcblxuZXhlY3V0ZShob29rKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFxQk8sSUFBTSxhQUFhO0FBQUE7QUFBQSxFQUV4QixTQUFTO0FBQUE7QUFBQSxFQUVULE9BQU87QUFBQTtBQUFBLEVBRVAsT0FBTztBQUNUO0FBVUEsU0FBUyxnQ0FB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QUFLLEVBQUUsQ0FBQztBQUNsRSxRQUFJO0FBQ0YsaUJBQVcsY0FBYztBQUFBLElBQzNCLFFBQVE7QUFBQSxJQUVSO0FBQ0EsV0FBTyxtQkFBbUIsQ0FBQyxDQUFDO0FBQUEsRUFDOUI7QUFHQSxRQUFNLFNBQVMsQ0FBQyxHQUFHLElBQUksSUFBSSxRQUFRLE1BQU0sSUFBSSxFQUFFLE9BQU8sQ0FBQyxTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQztBQUU3RSxNQUFJLE9BQU8sV0FBVyxHQUFHO0FBQ3ZCLElBQUFBLFFBQU8sTUFBTSxxQkFBcUI7QUFDbEMsUUFBSTtBQUNGLGlCQUFXLGNBQWM7QUFBQSxJQUMzQixRQUFRO0FBQUEsSUFFUjtBQUNBLFdBQU8sbUJBQW1CLENBQUMsQ0FBQztBQUFBLEVBQzlCO0FBR0EsTUFBSTtBQUNGLGVBQVcsY0FBYztBQUFBLEVBQzNCLFFBQVE7QUFBQSxFQUVSO0FBRUEsUUFBTSxZQUFZLGdCQUFnQixNQUFNO0FBQ3hDLEVBQUFBLFFBQU8sS0FBSyxxQ0FBcUMsRUFBRSxRQUFRLFVBQVUsQ0FBQztBQUV0RSxTQUFPLG1CQUFtQjtBQUFBLElBQ3hCLGVBQWUsNkJBQTZCLFNBQVM7QUFBQSxJQUNyRCxvQkFBb0I7QUFBQSxNQUNsQixtQkFBbUIsY0FBYyxTQUFTO0FBQUEsSUFDNUM7QUFBQSxFQUNGLENBQUM7QUFDSCxDQUFDO0FBTU0sU0FBUyxrQkFBa0IsV0FBeUI7QUFDekQsUUFBTSxpQkFBaUIsa0JBQWtCLFNBQVM7QUFDbEQsZ0JBQWMsZ0JBQWdCLEtBQUssT0FBTztBQUM1Qzs7O0FFM0ZBLElBQU8sc0JBQVEsZUFBZSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsUUFBQUUsUUFBTyxNQUFNO0FBQ3ZELG9CQUFrQixNQUFNLFVBQVU7QUFDbEMsRUFBQUEsUUFBTyxLQUFLLDRDQUE0QyxFQUFFLFdBQVcsTUFBTSxXQUFXLENBQUM7QUFFdkYsU0FBTyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzVCLENBQUM7OztBQ2JELFFBQVEsbUJBQUk7IiwKICAibmFtZXMiOiBbImV4aXN0c1N5bmMiLCAiYXBwZW5kRmlsZVN5bmMiLCAiZXhpc3RzU3luYyIsICJta2RpclN5bmMiLCAiZGlybmFtZSIsICJsb2dnZXIiLCAiZGlybmFtZSIsICJleGlzdHNTeW5jIiwgIm1rZGlyU3luYyIsICJhcHBlbmRGaWxlU3luYyIsICJsb2dnZXIiLCAiZXhpc3RzU3luYyIsICJsb2dnZXIiXQp9Cg==
