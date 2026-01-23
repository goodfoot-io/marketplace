#!/usr/bin/env -S node --enable-source-maps
// src/skill-reloader.ts
import { existsSync as existsSync3, readFileSync, unlinkSync, writeFileSync } from "node:fs";

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
    this.logFilePath = config.logFilePath ?? process.env.CLAUDE_CODE_HOOKS_LOG_FILE ?? null;
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
    } catch {
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
var logger = new Logger();

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
var postToolUseOutput = /* @__PURE__ */ createHookSpecificOutputBuilder("PostToolUse");
var sessionStartOutput = /* @__PURE__ */ createHookSpecificOutputBuilder("SessionStart");

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
    const cliLogFile = process.env.CLAUDE_CODE_HOOKS_CLI_LOG_FILE;
    const envLogFile = process.env.CLAUDE_CODE_HOOKS_LOG_FILE;
    if (cliLogFile !== void 0 && envLogFile !== void 0 && cliLogFile !== envLogFile) {
      process.stderr.write(`Log file configuration conflict: CLI --log="${cliLogFile}" vs CLAUDE_CODE_HOOKS_LOG_FILE="${envLogFile}". Use only one method to configure hook logging.
`);
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

// ../../../tmp/claude-code-hooks-build/36e77a609ad12380/wrapper.ts
execute(skill_reloader_default);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2dvb2Rmb290LWhvb2tzL3NyYy9za2lsbC1yZWxvYWRlci50cyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvY2xhdWRlLWNvZGUtaG9va3MvZGlzdC9lbnYuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvaG9va3MuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvbG9nZ2VyLmpzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9wYWNrYWdlcy9jbGF1ZGUtY29kZS1ob29rcy9kaXN0L291dHB1dHMuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvcnVudGltZS5qcyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvZ29vZGZvb3QtaG9va3Mvc3JjL3NraWxsLXRyYWNrZXIudHMiLCAid3JhcHBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBTa2lsbCBSZWxvYWRlciAtIFNlc3Npb25TdGFydCBob29rIHRoYXQgcmVsb2FkcyBza2lsbHMgYWZ0ZXIgY29udGV4dCBjb21wYWN0aW9uLlxuICpcbiAqIFdoZW4gYSBzZXNzaW9uIHN0YXJ0cyBkdWUgdG8gY29tcGFjdGlvbiwgdGhpcyBob29rIHJlYWRzIHRoZSB0cmFja2VkIHNraWxsc1xuICogYW5kIG91dHB1dHMgaW5zdHJ1Y3Rpb25zIHRvIHJlbG9hZCB0aGVtLCBwcmVzZXJ2aW5nIHNraWxsIGNvbnRleHQgYWNyb3NzIGNvbXBhY3Rpb24uXG4gKlxuICogSW1wbGVtZW50cyBvbmUtc2hvdCBiZWhhdmlvciBieSBkZWxldGluZyB0aGUgZW5hYmxlbWVudCBmbGFnIGFmdGVyIHJ1bm5pbmcuXG4gKlxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3Nlc3Npb25zdGFydFxuICovXG5cbmltcG9ydCB7IGV4aXN0c1N5bmMsIHJlYWRGaWxlU3luYywgdW5saW5rU3luYywgd3JpdGVGaWxlU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBzZXNzaW9uU3RhcnRIb29rLCBzZXNzaW9uU3RhcnRPdXRwdXQgfSBmcm9tIFwiQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzXCI7XG5pbXBvcnQgeyBnZXRSZWxvYWRGbGFnUGF0aCwgZ2V0U2tpbGxzRmlsZVBhdGggfSBmcm9tIFwiLi9za2lsbC10cmFja2VyLmpzXCI7XG5cbi8qKlxuICogRm9ybWF0cyBhIGxpc3Qgb2Ygc2tpbGxzIGZvciBodW1hbi1yZWFkYWJsZSBvdXRwdXQuXG4gKiAtIFNpbmdsZSBza2lsbDogJ3NraWxsMSdcbiAqIC0gVHdvIHNraWxsczogJ3NraWxsMScgYW5kICdza2lsbDInXG4gKiAtIFRocmVlIG9yIG1vcmU6ICdza2lsbDEnLCAnc2tpbGwyJywgYW5kICdza2lsbDMnXG4gKi9cbmZ1bmN0aW9uIGZvcm1hdFNraWxsTGlzdChza2lsbHM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgaWYgKHNraWxscy5sZW5ndGggPT09IDApIHJldHVybiBcIlwiO1xuICBpZiAoc2tpbGxzLmxlbmd0aCA9PT0gMSkgcmV0dXJuIGAnJHtza2lsbHNbMF19J2A7XG4gIGlmIChza2lsbHMubGVuZ3RoID09PSAyKSByZXR1cm4gYCcke3NraWxsc1swXX0nIGFuZCAnJHtza2lsbHNbMV19J2A7XG5cbiAgY29uc3QgYWxsQnV0TGFzdCA9IHNraWxscy5zbGljZSgwLCAtMSkubWFwKChzKSA9PiBgJyR7c30nYCk7XG4gIGNvbnN0IGxhc3QgPSBgJyR7c2tpbGxzW3NraWxscy5sZW5ndGggLSAxXX0nYDtcbiAgcmV0dXJuIGAke2FsbEJ1dExhc3Quam9pbihcIiwgXCIpfSwgYW5kICR7bGFzdH1gO1xufVxuXG5leHBvcnQgZGVmYXVsdCBzZXNzaW9uU3RhcnRIb29rKHsgbWF0Y2hlcjogXCJjb21wYWN0XCIgfSwgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gIGNvbnN0IGVuYWJsZW1lbnRGbGFnID0gZ2V0UmVsb2FkRmxhZ1BhdGgoaW5wdXQuc2Vzc2lvbl9pZCk7XG4gIGNvbnN0IHNraWxsc0ZpbGUgPSBnZXRTa2lsbHNGaWxlUGF0aChpbnB1dC5zZXNzaW9uX2lkKTtcblxuICAvLyBDaGVjayBpZiBlbmFibGVtZW50IGZsYWcgZXhpc3RzIChzZXQgYnkgUHJlQ29tcGFjdCBob29rIGlmIGltcGxlbWVudGVkLCBvciBtYW51YWxseSlcbiAgaWYgKCFleGlzdHNTeW5jKGVuYWJsZW1lbnRGbGFnKSkge1xuICAgIGxvZ2dlci5kZWJ1ZyhcIlNraWxsIHJlbG9hZCBub3QgZW5hYmxlZCBmb3IgdGhpcyBzZXNzaW9uXCIpO1xuICAgIHJldHVybiBzZXNzaW9uU3RhcnRPdXRwdXQoe30pO1xuICB9XG5cbiAgLy8gQ2hlY2sgaWYgc2tpbGxzIGZpbGUgZXhpc3RzIGFuZCBoYXMgY29udGVudFxuICBpZiAoIWV4aXN0c1N5bmMoc2tpbGxzRmlsZSkpIHtcbiAgICBsb2dnZXIuZGVidWcoXCJObyBza2lsbHMgZmlsZSBmb3VuZFwiKTtcbiAgICB0cnkge1xuICAgICAgdW5saW5rU3luYyhlbmFibGVtZW50RmxhZyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBJZ25vcmUgY2xlYW51cCBlcnJvcnNcbiAgICB9XG4gICAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7fSk7XG4gIH1cblxuICBsZXQgY29udGVudDogc3RyaW5nO1xuICB0cnkge1xuICAgIGNvbnRlbnQgPSByZWFkRmlsZVN5bmMoc2tpbGxzRmlsZSwgXCJ1dGYtOFwiKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dnZXIud2FybihcIkZhaWxlZCB0byByZWFkIHNraWxscyBmaWxlXCIsIHsgZXJyb3I6IFN0cmluZyhlcnJvcikgfSk7XG4gICAgdHJ5IHtcbiAgICAgIHVubGlua1N5bmMoZW5hYmxlbWVudEZsYWcpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gSWdub3JlIGNsZWFudXAgZXJyb3JzXG4gICAgfVxuICAgIHJldHVybiBzZXNzaW9uU3RhcnRPdXRwdXQoe30pO1xuICB9XG5cbiAgLy8gRGVkdXBsaWNhdGUgYW5kIGZpbHRlciBlbXB0eSBsaW5lc1xuICBjb25zdCBza2lsbHMgPSBbLi4ubmV3IFNldChjb250ZW50LnNwbGl0KFwiXFxuXCIpLmZpbHRlcigobGluZSkgPT4gbGluZS50cmltKCkpKV07XG5cbiAgaWYgKHNraWxscy5sZW5ndGggPT09IDApIHtcbiAgICBsb2dnZXIuZGVidWcoXCJObyBza2lsbHMgdG8gcmVsb2FkXCIpO1xuICAgIHRyeSB7XG4gICAgICB1bmxpbmtTeW5jKGVuYWJsZW1lbnRGbGFnKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIElnbm9yZSBjbGVhbnVwIGVycm9yc1xuICAgIH1cbiAgICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHt9KTtcbiAgfVxuXG4gIC8vIERlbGV0ZSB0aGUgZW5hYmxlbWVudCBmbGFnIChvbmUtc2hvdCBiZWhhdmlvcilcbiAgdHJ5IHtcbiAgICB1bmxpbmtTeW5jKGVuYWJsZW1lbnRGbGFnKTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gSWdub3JlIGNsZWFudXAgZXJyb3JzXG4gIH1cblxuICBjb25zdCBza2lsbExpc3QgPSBmb3JtYXRTa2lsbExpc3Qoc2tpbGxzKTtcbiAgbG9nZ2VyLmluZm8oXCJSZWxvYWRpbmcgc2tpbGxzIGFmdGVyIGNvbXBhY3Rpb25cIiwgeyBza2lsbHMsIHNraWxsTGlzdCB9KTtcblxuICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHtcbiAgICBzeXN0ZW1NZXNzYWdlOiBgU2tpbGwgcmVsb2FkZXI6IFJlc3RvcmluZyAke3NraWxsTGlzdH0gYWZ0ZXIgY29udGV4dCBjb21wYWN0aW9uYCxcbiAgICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAgICAgIGFkZGl0aW9uYWxDb250ZXh0OiBgTG9hZCBza2lsbCAke3NraWxsTGlzdH0gYmVmb3JlIGNvbnRpbnVpbmdgLFxuICAgIH0sXG4gIH0pO1xufSk7XG5cbi8qKlxuICogRW5hYmxlcyBza2lsbCByZWxvYWQgZm9yIHRoZSBuZXh0IGNvbXBhY3Rpb24uXG4gKiBDYWxsIHRoaXMgZnJvbSBhIFByZUNvbXBhY3QgaG9vayB0byBlbmFibGUgdGhlIHJlbG9hZCBtZWNoYW5pc20uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVTa2lsbFJlbG9hZChzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBlbmFibGVtZW50RmxhZyA9IGdldFJlbG9hZEZsYWdQYXRoKHNlc3Npb25JZCk7XG4gIHdyaXRlRmlsZVN5bmMoZW5hYmxlbWVudEZsYWcsIFwiMVwiLCBcInV0Zi04XCIpO1xufVxuIiwgIi8qKlxuICogRW52aXJvbm1lbnQgdmFyaWFibGUgdXRpbGl0aWVzIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyB0eXBlZCBhY2Nlc3MgdG8gQ2xhdWRlIENvZGUncyBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHV0aWxpdGllc1xuICogZm9yIHBlcnNpc3RpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzIGluIFNlc3Npb25TdGFydCBob29rcy5cbiAqXG4gKiAjIyBFbnZpcm9ubWVudCBWYXJpYWJsZXNcbiAqXG4gKiBDbGF1ZGUgQ29kZSBzZXRzIHRoZXNlIGVudmlyb25tZW50IHZhcmlhYmxlcyB3aGVuIHJ1bm5pbmcgaG9va3M6XG4gKlxuICogfCBWYXJpYWJsZSB8IERlc2NyaXB0aW9uIHwgQXZhaWxhYmxlIEluIHxcbiAqIHwtLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLS18XG4gKiB8IGBDTEFVREVfUFJPSkVDVF9ESVJgIHwgQWJzb2x1dGUgcGF0aCB0byBwcm9qZWN0IHJvb3QgfCBBbGwgaG9va3MgfFxuICogfCBgQ0xBVURFX0VOVl9GSUxFYCB8IFBhdGggdG8gZmlsZSBmb3IgcGVyc2lzdGluZyBlbnYgdmFycyB8IFNlc3Npb25TdGFydCBvbmx5IHxcbiAqIHwgYENMQVVERV9DT0RFX1JFTU9URWAgfCBgXCJ0cnVlXCJgIGlmIHJ1bm5pbmcgcmVtb3RlbHkgfCBBbGwgaG9va3MgfFxuICogQG1vZHVsZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGdldFByb2plY3REaXIsIHBlcnNpc3RFbnZWYXIsIGlzUmVtb3RlRW52aXJvbm1lbnQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEdldCBwcm9qZWN0IGRpcmVjdG9yeVxuICogY29uc3QgcHJvamVjdERpciA9IGdldFByb2plY3REaXIoKTtcbiAqXG4gKiAvLyBDaGVjayBpZiBydW5uaW5nIHJlbW90ZWx5XG4gKiBpZiAoaXNSZW1vdGVFbnZpcm9ubWVudCgpKSB7XG4gKiAgIC8vIEhhbmRsZSByZW1vdGUtc3BlY2lmaWMgbG9naWNcbiAqIH1cbiAqXG4gKiAvLyBJbiBTZXNzaW9uU3RhcnQgaG9vazogcGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAqIHBlcnNpc3RFbnZWYXIoJ05PREVfRU5WJywgJ3Byb2R1Y3Rpb24nKTtcbiAqIHBlcnNpc3RFbnZWYXIoJ0FQSV9LRVknLCAnc2VjcmV0LWtleScpO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjaG9vay1leGVjdXRpb24tZGV0YWlsc1xuICovXG5pbXBvcnQgKiBhcyBmcyBmcm9tIFwibm9kZTpmc1wiO1xuLyoqXG4gKiBDbGF1ZGUgQ29kZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBuYW1lcy5cbiAqXG4gKiBUaGVzZSBhcmUgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlcyB0aGF0IENsYXVkZSBDb2RlIHNldHMgd2hlbiBydW5uaW5nIGhvb2tzLlxuICovXG5leHBvcnQgY29uc3QgQ0xBVURFX0VOVl9WQVJTID0ge1xuICAgIC8qKlxuICAgICAqIEFic29sdXRlIHBhdGggdG8gdGhlIHByb2plY3Qgcm9vdCBkaXJlY3Rvcnkgd2hlcmUgQ2xhdWRlIENvZGUgd2FzIHN0YXJ0ZWQuXG4gICAgICogQXZhaWxhYmxlIGluIGFsbCBob29rcy5cbiAgICAgKi9cbiAgICBQUk9KRUNUX0RJUjogXCJDTEFVREVfUFJPSkVDVF9ESVJcIixcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGEgZmlsZSB3aGVyZSBTZXNzaW9uU3RhcnQgaG9va3MgY2FuIHBlcnNpc3QgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICAgICAqIFZhcmlhYmxlcyB3cml0dGVuIHRvIHRoaXMgZmlsZSB3aWxsIGJlIGF2YWlsYWJsZSBpbiBhbGwgc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzLlxuICAgICAqIE9ubHkgYXZhaWxhYmxlIGluIFNlc3Npb25TdGFydCBob29rcy5cbiAgICAgKi9cbiAgICBFTlZfRklMRTogXCJDTEFVREVfRU5WX0ZJTEVcIixcbiAgICAvKipcbiAgICAgKiBTZXQgdG8gXCJ0cnVlXCIgd2hlbiBydW5uaW5nIGluIGEgcmVtb3RlICh3ZWIpIGVudmlyb25tZW50LlxuICAgICAqIE5vdCBzZXQgb3IgZW1wdHkgd2hlbiBydW5uaW5nIGluIGxvY2FsIENMSSBlbnZpcm9ubWVudC5cbiAgICAgKi9cbiAgICBSRU1PVEU6IFwiQ0xBVURFX0NPREVfUkVNT1RFXCIsXG59O1xuLyoqXG4gKiBHZXRzIHRoZSBDbGF1ZGUgQ29kZSBwcm9qZWN0IGRpcmVjdG9yeS5cbiAqXG4gKiBUaGlzIGlzIHRoZSBhYnNvbHV0ZSBwYXRoIHRvIHRoZSBwcm9qZWN0IHJvb3Qgd2hlcmUgQ2xhdWRlIENvZGUgd2FzIHN0YXJ0ZWQuXG4gKiBUaGUgdmFsdWUgY29tZXMgZnJvbSB0aGUgYENMQVVERV9QUk9KRUNUX0RJUmAgZW52aXJvbm1lbnQgdmFyaWFibGUuXG4gKiBAcmV0dXJucyBUaGUgcHJvamVjdCBkaXJlY3RvcnkgcGF0aCwgb3IgdW5kZWZpbmVkIGlmIG5vdCBzZXRcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBwcm9qZWN0RGlyID0gZ2V0UHJvamVjdERpcigpO1xuICogaWYgKHByb2plY3REaXIpIHtcbiAqICAgY29uc3QgY29uZmlnUGF0aCA9IGAke3Byb2plY3REaXJ9Ly5jbGF1ZGUvY29uZmlnLmpzb25gO1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcm9qZWN0RGlyKCkge1xuICAgIHJldHVybiBwcm9jZXNzLmVudltDTEFVREVfRU5WX1ZBUlMuUFJPSkVDVF9ESVJdO1xufVxuLyoqXG4gKiBHZXRzIHRoZSBDbGF1ZGUgQ29kZSBlbnYgZmlsZSBwYXRoIGZvciBwZXJzaXN0aW5nIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAqXG4gKiBUaGlzIGlzIG9ubHkgYXZhaWxhYmxlIGluIFNlc3Npb25TdGFydCBob29rcy4gVGhlIHBhdGggcG9pbnRzIHRvIGEgZmlsZVxuICogd2hlcmUgeW91IGNhbiB3cml0ZSBzaGVsbCBleHBvcnQgc3RhdGVtZW50cyB0byBwZXJzaXN0IGVudmlyb25tZW50IHZhcmlhYmxlc1xuICogZm9yIGFsbCBzdWJzZXF1ZW50IGJhc2ggY29tbWFuZHMgaW4gdGhlIHNlc3Npb24uXG4gKiBAcmV0dXJucyBUaGUgZW52IGZpbGUgcGF0aCwgb3IgdW5kZWZpbmVkIGlmIG5vdCBzZXQgKG5vdCBhIFNlc3Npb25TdGFydCBob29rKVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IGVudkZpbGUgPSBnZXRFbnZGaWxlUGF0aCgpO1xuICogaWYgKGVudkZpbGUpIHtcbiAqICAgLy8gV2UncmUgaW4gYSBTZXNzaW9uU3RhcnQgaG9vayBhbmQgY2FuIHBlcnNpc3QgZW52IHZhcnNcbiAqICAgcGVyc2lzdEVudlZhcignTVlfVkFSJywgJ215LXZhbHVlJyk7XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEVudkZpbGVQYXRoKCkge1xuICAgIHJldHVybiBwcm9jZXNzLmVudltDTEFVREVfRU5WX1ZBUlMuRU5WX0ZJTEVdO1xufVxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGhvb2sgaXMgcnVubmluZyBpbiBhIHJlbW90ZSAod2ViKSBlbnZpcm9ubWVudC5cbiAqXG4gKiBSZW1vdGUgZW52aXJvbm1lbnRzIG1heSBoYXZlIGRpZmZlcmVudCBjYXBhYmlsaXRpZXMgb3IgcmVzdHJpY3Rpb25zXG4gKiBjb21wYXJlZCB0byBsb2NhbCBDTEkgZW52aXJvbm1lbnRzLlxuICogQHJldHVybnMgdHJ1ZSBpZiBydW5uaW5nIHJlbW90ZWx5LCBmYWxzZSBpZiBydW5uaW5nIGxvY2FsbHlcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpZiAoaXNSZW1vdGVFbnZpcm9ubWVudCgpKSB7XG4gKiAgIC8vIFVzZSB3ZWItY29tcGF0aWJsZSBhcHByb2FjaGVzXG4gKiB9IGVsc2Uge1xuICogICAvLyBDYW4gdXNlIGxvY2FsIENMSSBmZWF0dXJlc1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1JlbW90ZUVudmlyb25tZW50KCkge1xuICAgIHJldHVybiBwcm9jZXNzLmVudltDTEFVREVfRU5WX1ZBUlMuUkVNT1RFXSA9PT0gXCJ0cnVlXCI7XG59XG4vKipcbiAqIFBlcnNpc3RzIGFuIGVudmlyb25tZW50IHZhcmlhYmxlIGZvciB1c2UgaW4gc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gd3JpdGVzIGEgc2hlbGwgZXhwb3J0IHN0YXRlbWVudCB0byB0aGUgYENMQVVERV9FTlZfRklMRWAsXG4gKiB3aGljaCBDbGF1ZGUgQ29kZSBzb3VyY2VzIGJlZm9yZSBydW5uaW5nIGJhc2ggY29tbWFuZHMuIFRoaXMgYWxsb3dzXG4gKiBTZXNzaW9uU3RhcnQgaG9va3MgdG8gY29uZmlndXJlIHRoZSBlbnZpcm9ubWVudCBmb3IgdGhlIGVudGlyZSBzZXNzaW9uLlxuICpcbiAqICoqSW1wb3J0YW50Kio6IFRoaXMgZnVuY3Rpb24gb25seSB3b3JrcyBpbiBTZXNzaW9uU3RhcnQgaG9va3Mgd2hlcmVcbiAqIGBDTEFVREVfRU5WX0ZJTEVgIGlzIHNldC4gSW4gb3RoZXIgaG9va3MsIGl0IHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gKiBAcGFyYW0gbmFtZSAtIFRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBuYW1lXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgZW52aXJvbm1lbnQgdmFyaWFibGUgdmFsdWUgKHdpbGwgYmUgc2hlbGwtZXNjYXBlZClcbiAqIEB0aHJvd3MgRXJyb3IgaWYgQ0xBVURFX0VOVl9GSUxFIGlzIG5vdCBzZXQgKG5vdCBpbiBhIFNlc3Npb25TdGFydCBob29rKVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHNlc3Npb25TdGFydEhvb2ssIHNlc3Npb25TdGFydE91dHB1dCwgcGVyc2lzdEVudlZhciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogZXhwb3J0IGRlZmF1bHQgc2Vzc2lvblN0YXJ0SG9vayh7fSwgYXN5bmMgKGlucHV0KSA9PiB7XG4gKiAgIC8vIFBlcnNpc3QgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciB0aGUgc2Vzc2lvblxuICogICBwZXJzaXN0RW52VmFyKCdOT0RFX0VOVicsICdwcm9kdWN0aW9uJyk7XG4gKiAgIHBlcnNpc3RFbnZWYXIoJ0FQSV9LRVknLCBwcm9jZXNzLmVudi5NWV9BUElfS0VZID8/ICdkZWZhdWx0Jyk7XG4gKiAgIHBlcnNpc3RFbnZWYXIoJ1BBVEgnLCBgJHtwcm9jZXNzLmVudi5QQVRIfTouL25vZGVfbW9kdWxlcy8uYmluYCk7XG4gKlxuICogICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHt9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjcGVyc2lzdGluZy1lbnZpcm9ubWVudC12YXJpYWJsZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBlcnNpc3RFbnZWYXIobmFtZSwgdmFsdWUpIHtcbiAgICBjb25zdCBlbnZGaWxlID0gZ2V0RW52RmlsZVBhdGgoKTtcbiAgICBpZiAoZW52RmlsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInBlcnNpc3RFbnZWYXIgY2FuIG9ubHkgYmUgdXNlZCBpbiBTZXNzaW9uU3RhcnQgaG9va3MuIFwiICsgXCJDTEFVREVfRU5WX0ZJTEUgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgbm90IHNldC5cIik7XG4gICAgfVxuICAgIC8vIFNoZWxsLWVzY2FwZSB0aGUgdmFsdWUgdG8gaGFuZGxlIHNwZWNpYWwgY2hhcmFjdGVyc1xuICAgIGNvbnN0IGVzY2FwZWRWYWx1ZSA9IGVzY2FwZVNoZWxsVmFsdWUodmFsdWUpO1xuICAgIC8vIFdyaXRlIHRoZSBleHBvcnQgc3RhdGVtZW50XG4gICAgY29uc3QgZXhwb3J0U3RhdGVtZW50ID0gYGV4cG9ydCAke25hbWV9PSR7ZXNjYXBlZFZhbHVlfVxcbmA7XG4gICAgZnMuYXBwZW5kRmlsZVN5bmMoZW52RmlsZSwgZXhwb3J0U3RhdGVtZW50LCBcInV0Zi04XCIpO1xufVxuLyoqXG4gKiBQZXJzaXN0cyBtdWx0aXBsZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYXQgb25jZS5cbiAqXG4gKiBUaGlzIGlzIGEgY29udmVuaWVuY2Ugd3JhcHBlciBhcm91bmQgYHBlcnNpc3RFbnZWYXJgIGZvciBzZXR0aW5nXG4gKiBtdWx0aXBsZSB2YXJpYWJsZXMgaW4gYSBzaW5nbGUgY2FsbC5cbiAqIEBwYXJhbSB2YXJzIC0gT2JqZWN0IG1hcHBpbmcgdmFyaWFibGUgbmFtZXMgdG8gdmFsdWVzXG4gKiBAdGhyb3dzIEVycm9yIGlmIENMQVVERV9FTlZfRklMRSBpcyBub3Qgc2V0IChub3QgaW4gYSBTZXNzaW9uU3RhcnQgaG9vaylcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBwZXJzaXN0RW52VmFycyh7XG4gKiAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXG4gKiAgIEFQSV9LRVk6ICdzZWNyZXQnLFxuICogICBERUJVRzogJ2ZhbHNlJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBlcnNpc3RFbnZWYXJzKHZhcnMpIHtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModmFycykpIHtcbiAgICAgICAgcGVyc2lzdEVudlZhcihuYW1lLCB2YWx1ZSk7XG4gICAgfVxufVxuLyoqXG4gKiBFc2NhcGVzIGEgdmFsdWUgZm9yIHNhZmUgdXNlIGluIGEgc2hlbGwgZXhwb3J0IHN0YXRlbWVudC5cbiAqXG4gKiBVc2VzIHNpbmdsZSBxdW90ZXMgYW5kIGVzY2FwZXMgYW55IGVtYmVkZGVkIHNpbmdsZSBxdW90ZXMuXG4gKiBUaGlzIHByZXZlbnRzIHNoZWxsIGluamVjdGlvbiBhbmQgaGFuZGxlcyBzcGVjaWFsIGNoYXJhY3RlcnMuXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gZXNjYXBlXG4gKiBAcmV0dXJucyBUaGUgc2hlbGwtZXNjYXBlZCB2YWx1ZSAod2l0aCBxdW90ZXMpXG4gKiBAaW50ZXJuYWxcbiAqL1xuZnVuY3Rpb24gZXNjYXBlU2hlbGxWYWx1ZSh2YWx1ZSkge1xuICAgIC8vIFVzZSBzaW5nbGUgcXVvdGVzIGFuZCBlc2NhcGUgYW55IGVtYmVkZGVkIHNpbmdsZSBxdW90ZXNcbiAgICAvLyAndmFsdWUnIC0+ICd2YWwnXFwnJ3VlJyBmb3IgdmFsdWVzIGNvbnRhaW5pbmcgc2luZ2xlIHF1b3Rlc1xuICAgIGNvbnN0IGVzY2FwZWQgPSB2YWx1ZS5yZXBsYWNlKC8nL2csIFwiJ1xcXFwnJ1wiKTtcbiAgICByZXR1cm4gYCcke2VzY2FwZWR9J2A7XG59XG4iLCAiLyoqXG4gKiBIb29rIGZhY3RvcnkgZnVuY3Rpb25zIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyB0eXBlZCBmYWN0b3J5IGZ1bmN0aW9ucyBmb3IgYWxsIDEyIGhvb2sgdHlwZXMgdGhhdCBoYW5kbGU6XG4gKiAtIElucHV0IHR5cGUgbmFycm93aW5nIGJhc2VkIG9uIGhvb2sgZXZlbnQgdHlwZVxuICogLSBPdXRwdXQgdHlwZSBlbmZvcmNlbWVudCB2aWEgcmV0dXJuIHR5cGVzXG4gKiAtIEVycm9yIHdyYXBwaW5nIHdpdGggYXV0b21hdGljIGxvZ2dpbmdcbiAqIC0gTG9nZ2VyIGNvbnRleHQgaW5qZWN0aW9uXG4gKlxuICogRWFjaCBmYWN0b3J5IGFjY2VwdHMgYSBIb29rQ29uZmlnIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dCBzZXR0aW5ncyxcbiAqIGFuZCByZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB0aGUgcnVudGltZSBpbnZva2VzIHdoZW4gdGhlIGhvb2sgZmlsZSBleGVjdXRlcy5cbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBwcmVUb29sVXNlSG9vaywgcHJlVG9vbFVzZU91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogZXhwb3J0IGRlZmF1bHQgcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnQmFzaCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdQcm9jZXNzaW5nIEJhc2ggY29tbWFuZCcpO1xuICogICByZXR1cm4gcHJlVG9vbFVzZU91dHB1dCh7IGFsbG93OiB0cnVlIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICovXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBHZW5lcmljIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIGhvb2sgZmFjdG9yeSBmdW5jdGlvbiBmb3IgYSBzcGVjaWZpYyBob29rIHR5cGUuXG4gKlxuICogVGhpcyBpcyB0aGUgaW50ZXJuYWwgaW1wbGVtZW50YXRpb24gdXNlZCBieSBhbGwgdHlwZWQgZmFjdG9yaWVzLlxuICogSXQgd3JhcHMgdGhlIGhhbmRsZXIgd2l0aCBlcnJvciBjYXRjaGluZyBhbmQgbG9nZ2luZy5cbiAqIEBwYXJhbSBob29rRXZlbnROYW1lIC0gVGhlIGhvb2sgZXZlbnQgbmFtZVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvblxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byB3cmFwXG4gKiBAcmV0dXJucyBBIHdyYXBwZWQgaG9vayBmdW5jdGlvblxuICogQGludGVybmFsXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUhvb2tGdW5jdGlvbihob29rRXZlbnROYW1lLCBjb25maWcsIGhhbmRsZXIpIHtcbiAgICBjb25zdCBob29rRm4gPSBhc3luYyAoaW5wdXQsIGNvbnRleHQpID0+IHtcbiAgICAgICAgLy8gRGVsZWdhdGUgZXJyb3IgaGFuZGxpbmcgdG8gdGhlIHJ1bnRpbWUgLSBqdXN0IGV4ZWN1dGUgdGhlIGhhbmRsZXJcbiAgICAgICAgLy8gVGhlIHJ1bnRpbWUgd2lsbCBjYXRjaCBlcnJvcnMsIGxvZyB0aGVtLCBhbmQgcmV0dXJuIGFwcHJvcHJpYXRlIG91dHB1dFxuICAgICAgICByZXR1cm4gYXdhaXQgaGFuZGxlcihpbnB1dCwgY29udGV4dCk7XG4gICAgfTtcbiAgICAvLyBBdHRhY2ggbWV0YWRhdGEgZm9yIHJ1bnRpbWUgaW5zcGVjdGlvblxuICAgIGhvb2tGbi5ob29rRXZlbnROYW1lID0gaG9va0V2ZW50TmFtZTtcbiAgICBob29rRm4ubWF0Y2hlciA9IGNvbmZpZy5tYXRjaGVyO1xuICAgIGhvb2tGbi50aW1lb3V0ID0gY29uZmlnLnRpbWVvdXQ7XG4gICAgcmV0dXJuIGhvb2tGbjtcbn1cbi8qKiBAaW5oZXJpdGRvYyAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZVRvb2xVc2VIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJQcmVUb29sVXNlXCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwb3N0VG9vbFVzZUhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlBvc3RUb29sVXNlXCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwb3N0VG9vbFVzZUZhaWx1cmVIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJQb3N0VG9vbFVzZUZhaWx1cmVcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIE5vdGlmaWNhdGlvbiBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIE5vdGlmaWNhdGlvbiBob29rIGhhbmRsZXIuXG4gKlxuICogTm90aWZpY2F0aW9uIGhvb2tzIGZpcmUgd2hlbiBDbGF1ZGUgQ29kZSBzZW5kcyBhIG5vdGlmaWNhdGlvbiwgYWxsb3dpbmcgeW91IHRvOlxuICogLSBGb3J3YXJkIG5vdGlmaWNhdGlvbnMgdG8gZXh0ZXJuYWwgc3lzdGVtc1xuICogLSBMb2cgaW1wb3J0YW50IGV2ZW50c1xuICogLSBUcmlnZ2VyIGN1c3RvbSBhbGVydGluZ1xuICpcbiAqICoqTWF0Y2hlcioqOiBNYXRjaGVzIGFnYWluc3QgYG5vdGlmaWNhdGlvbl90eXBlYFxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IG5vdGlmaWNhdGlvbkhvb2ssIG5vdGlmaWNhdGlvbk91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gRm9yd2FyZCBub3RpZmljYXRpb25zIHRvIFNsYWNrXG4gKiBleHBvcnQgZGVmYXVsdCBub3RpZmljYXRpb25Ib29rKHt9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ05vdGlmaWNhdGlvbiByZWNlaXZlZCcsIHtcbiAqICAgICB0eXBlOiBpbnB1dC5ub3RpZmljYXRpb25fdHlwZSxcbiAqICAgICB0aXRsZTogaW5wdXQudGl0bGVcbiAqICAgfSk7XG4gKlxuICogICBhd2FpdCBzZW5kU2xhY2tNZXNzYWdlKGlucHV0LnRpdGxlID8/ICdOb3RpZmljYXRpb24nLCBpbnB1dC5tZXNzYWdlKTtcbiAqXG4gKiAgIHJldHVybiBub3RpZmljYXRpb25PdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNub3RpZmljYXRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vdGlmaWNhdGlvbkhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIk5vdGlmaWNhdGlvblwiLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gVXNlclByb21wdFN1Ym1pdCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFVzZXJQcm9tcHRTdWJtaXQgaG9vayBoYW5kbGVyLlxuICpcbiAqIFVzZXJQcm9tcHRTdWJtaXQgaG9va3MgZmlyZSB3aGVuIGEgdXNlciBzdWJtaXRzIGEgcHJvbXB0LCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEFkZCBhZGRpdGlvbmFsIGNvbnRleHQgb3IgaW5zdHJ1Y3Rpb25zXG4gKiAtIExvZyB1c2VyIGludGVyYWN0aW9uc1xuICogLSBWYWxpZGF0ZSBvciB0cmFuc2Zvcm0gcHJvbXB0c1xuICpcbiAqICoqTWF0Y2hlcioqOiBObyBtYXRjaGVyIHN1cHBvcnQgLSBmaXJlcyBvbiBhbGwgcHJvbXB0IHN1Ym1pc3Npb25zXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgdGltZW91dCAobWF0Y2hlciBpcyBpZ25vcmVkKVxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgdXNlclByb21wdFN1Ym1pdEhvb2ssIHVzZXJQcm9tcHRTdWJtaXRPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEFkZCBwcm9qZWN0IGNvbnRleHQgdG8gZXZlcnkgcHJvbXB0XG4gKiBleHBvcnQgZGVmYXVsdCB1c2VyUHJvbXB0U3VibWl0SG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5kZWJ1ZygnVXNlciBwcm9tcHQgc3VibWl0dGVkJywgeyBwcm9tcHRMZW5ndGg6IGlucHV0LnByb21wdC5sZW5ndGggfSk7XG4gKlxuICogICBjb25zdCBwcm9qZWN0Q29udGV4dCA9IGF3YWl0IGdldFByb2plY3RDb250ZXh0KCk7XG4gKlxuICogICByZXR1cm4gdXNlclByb21wdFN1Ym1pdE91dHB1dCh7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6IHByb2plY3RDb250ZXh0XG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyN1c2VycHJvbXB0c3VibWl0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VyUHJvbXB0U3VibWl0SG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiVXNlclByb21wdFN1Ym1pdFwiLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2Vzc2lvblN0YXJ0IEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgU2Vzc2lvblN0YXJ0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTZXNzaW9uU3RhcnQgaG9va3MgZmlyZSB3aGVuIGEgQ2xhdWRlIENvZGUgc2Vzc2lvbiBzdGFydHMgb3IgcmVzdGFydHMsXG4gKiBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEluaXRpYWxpemUgc2Vzc2lvbiBzdGF0ZVxuICogLSBJbmplY3QgY29udGV4dCBvciBpbnN0cnVjdGlvbnNcbiAqIC0gUGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIHN1YnNlcXVlbnQgYmFzaCBjb21tYW5kc1xuICogLSBTZXQgdXAgbG9nZ2luZyBvciBtb25pdG9yaW5nXG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgc291cmNlYCAoJ3N0YXJ0dXAnLCAncmVzdW1lJywgJ2NsZWFyJywgJ2NvbXBhY3QnKVxuICpcbiAqICoqQ29udGV4dCoqOiBTZXNzaW9uU3RhcnQgaG9va3MgcmVjZWl2ZSBhbiBleHRlbmRlZCBjb250ZXh0IHdpdGggYHBlcnNpc3RFbnZWYXJgXG4gKiBhbmQgYHBlcnNpc3RFbnZWYXJzYCBmdW5jdGlvbnMgZm9yIHNldHRpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHNlc3Npb25TdGFydEhvb2ssIHNlc3Npb25TdGFydE91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gUGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIHRoZSBzZXNzaW9uXG4gKiBleHBvcnQgZGVmYXVsdCBzZXNzaW9uU3RhcnRIb29rKHsgbWF0Y2hlcjogJ3N0YXJ0dXAnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIsIHBlcnNpc3RFbnZWYXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnTmV3IHNlc3Npb24gc3RhcnRlZCcsIHtcbiAqICAgICBzZXNzaW9uSWQ6IGlucHV0LnNlc3Npb25faWQsXG4gKiAgICAgY3dkOiBpbnB1dC5jd2RcbiAqICAgfSk7XG4gKlxuICogICAvLyBTZXQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciBhbGwgc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzXG4gKiAgIHBlcnNpc3RFbnZWYXIoJ05PREVfRU5WJywgJ2RldmVsb3BtZW50Jyk7XG4gKiAgIHBlcnNpc3RFbnZWYXIoJ0RFQlVHJywgJ3RydWUnKTtcbiAqXG4gKiAgIHJldHVybiBzZXNzaW9uU3RhcnRPdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBTZXQgbXVsdGlwbGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIGF0IG9uY2VcbiAqIGV4cG9ydCBkZWZhdWx0IHNlc3Npb25TdGFydEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBwZXJzaXN0RW52VmFycyB9KSA9PiB7XG4gKiAgIHBlcnNpc3RFbnZWYXJzKHtcbiAqICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICogICAgIEFQSV9LRVk6ICdzZWNyZXQnLFxuICogICAgIERFQlVHOiAnZmFsc2UnXG4gKiAgIH0pO1xuICpcbiAqICAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3Nlc3Npb25zdGFydFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2Vzc2lvblN0YXJ0SG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiU2Vzc2lvblN0YXJ0XCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTZXNzaW9uRW5kIEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgU2Vzc2lvbkVuZCBob29rIGhhbmRsZXIuXG4gKlxuICogU2Vzc2lvbkVuZCBob29rcyBmaXJlIHdoZW4gYSBDbGF1ZGUgQ29kZSBzZXNzaW9uIGVuZHMsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gQ2xlYW4gdXAgc2Vzc2lvbiByZXNvdXJjZXNcbiAqIC0gTG9nIHNlc3Npb24gbWV0cmljc1xuICogLSBQZXJzaXN0IHNlc3Npb24gc3RhdGVcbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGByZWFzb25gICh0aGUgZXhpdCByZWFzb24gc3RyaW5nKVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHNlc3Npb25FbmRIb29rLCBzZXNzaW9uRW5kT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBMb2cgc2Vzc2lvbiBlbmQgYW5kIGNsZWFuIHVwXG4gKiBleHBvcnQgZGVmYXVsdCBzZXNzaW9uRW5kSG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdTZXNzaW9uIGVuZGVkJywge1xuICogICAgIHNlc3Npb25JZDogaW5wdXQuc2Vzc2lvbl9pZCxcbiAqICAgICByZWFzb246IGlucHV0LnJlYXNvblxuICogICB9KTtcbiAqXG4gKiAgIGF3YWl0IGNsZWFudXBTZXNzaW9uUmVzb3VyY2VzKGlucHV0LnNlc3Npb25faWQpO1xuICpcbiAqICAgcmV0dXJuIHNlc3Npb25FbmRPdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNzZXNzaW9uZW5kXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXNzaW9uRW5kSG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiU2Vzc2lvbkVuZFwiLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RvcCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFN0b3AgaG9vayBoYW5kbGVyLlxuICpcbiAqIFN0b3AgaG9va3MgZmlyZSB3aGVuIENsYXVkZSBDb2RlIGlzIGFib3V0IHRvIHN0b3AsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gQmxvY2sgdGhlIHN0b3AgYW5kIHJlcXVpcmUgYWRkaXRpb25hbCBhY3Rpb25cbiAqIC0gQ29uZmlybSB0aGUgdXNlciB3YW50cyB0byBzdG9wXG4gKiAtIENsZWFuIHVwIHJlc291cmNlcyBiZWZvcmUgc3RvcHBpbmdcbiAqXG4gKiAqKk1hdGNoZXIqKjogTm8gbWF0Y2hlciBzdXBwb3J0IC0gZmlyZXMgb24gYWxsIHN0b3AgZXZlbnRzXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgdGltZW91dCAobWF0Y2hlciBpcyBpZ25vcmVkKVxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc3RvcEhvb2ssIHN0b3BPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEJsb2NrIHN0b3AgaWYgdGhlcmUgYXJlIHBlbmRpbmcgY2hhbmdlc1xuICogZXhwb3J0IGRlZmF1bHQgc3RvcEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBjb25zdCBwZW5kaW5nQ2hhbmdlcyA9IGF3YWl0IGNoZWNrUGVuZGluZ0NoYW5nZXMoKTtcbiAqXG4gKiAgIGlmIChwZW5kaW5nQ2hhbmdlcy5sZW5ndGggPiAwKSB7XG4gKiAgICAgbG9nZ2VyLndhcm4oJ0Jsb2NraW5nIHN0b3AgZHVlIHRvIHBlbmRpbmcgY2hhbmdlcycsIHtcbiAqICAgICAgIGNvdW50OiBwZW5kaW5nQ2hhbmdlcy5sZW5ndGhcbiAqICAgICB9KTtcbiAqXG4gKiAgICAgcmV0dXJuIHN0b3BPdXRwdXQoe1xuICogICAgICAgZGVjaXNpb246ICdibG9jaycsXG4gKiAgICAgICByZWFzb246IGBUaGVyZSBhcmUgJHtwZW5kaW5nQ2hhbmdlcy5sZW5ndGh9IHVuY29tbWl0dGVkIGNoYW5nZXNgLFxuICogICAgICAgc3lzdGVtTWVzc2FnZTogJ1BsZWFzZSBjb21taXQgb3IgZGlzY2FyZCBjaGFuZ2VzIGJlZm9yZSBzdG9wcGluZydcbiAqICAgICB9KTtcbiAqICAgfVxuICpcbiAqICAgbG9nZ2VyLmluZm8oJ0FwcHJvdmluZyBzdG9wJyk7XG4gKiAgIHJldHVybiBzdG9wT3V0cHV0KHsgZGVjaXNpb246ICdhcHByb3ZlJyB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc3RvcFxuICovXG5leHBvcnQgZnVuY3Rpb24gc3RvcEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlN0b3BcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN1YmFnZW50U3RhcnQgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTdWJhZ2VudFN0YXJ0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTdWJhZ2VudFN0YXJ0IGhvb2tzIGZpcmUgd2hlbiBhIHN1YmFnZW50IChUYXNrIHRvb2wpIHN0YXJ0cywgYWxsb3dpbmcgeW91IHRvOlxuICogLSBJbmplY3QgY29udGV4dCBmb3IgdGhlIHN1YmFnZW50XG4gKiAtIExvZyBzdWJhZ2VudCBpbnZvY2F0aW9uc1xuICogLSBDb25maWd1cmUgc3ViYWdlbnQgYmVoYXZpb3JcbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGBhZ2VudF90eXBlYCAoZS5nLiwgJ2V4cGxvcmUnLCAnY29kZWJhc2UtYW5hbHlzaXMnKVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHN1YmFnZW50U3RhcnRIb29rLCBzdWJhZ2VudFN0YXJ0T3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBBZGQgY29udGV4dCBmb3IgZXhwbG9yZSBzdWJhZ2VudHNcbiAqIGV4cG9ydCBkZWZhdWx0IHN1YmFnZW50U3RhcnRIb29rKHsgbWF0Y2hlcjogJ2V4cGxvcmUnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnRXhwbG9yZSBzdWJhZ2VudCBzdGFydGluZycsIHtcbiAqICAgICBhZ2VudElkOiBpbnB1dC5hZ2VudF9pZCxcbiAqICAgICBhZ2VudFR5cGU6IGlucHV0LmFnZW50X3R5cGVcbiAqICAgfSk7XG4gKlxuICogICByZXR1cm4gc3ViYWdlbnRTdGFydE91dHB1dCh7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdGb2N1cyBvbiBmaW5kaW5nIHBhdHRlcm5zIGFuZCBjb252ZW50aW9ucydcbiAqICAgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3N1YmFnZW50c3RhcnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1YmFnZW50U3RhcnRIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJTdWJhZ2VudFN0YXJ0XCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdWJhZ2VudFN0b3AgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTdWJhZ2VudFN0b3AgaG9vayBoYW5kbGVyLlxuICpcbiAqIFN1YmFnZW50U3RvcCBob29rcyBmaXJlIHdoZW4gYSBzdWJhZ2VudCBjb21wbGV0ZXMgb3Igc3RvcHMsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gQmxvY2sgdGhlIHN1YmFnZW50IGZyb20gc3RvcHBpbmdcbiAqIC0gUHJvY2VzcyBzdWJhZ2VudCByZXN1bHRzXG4gKiAtIENsZWFuIHVwIHN1YmFnZW50IHJlc291cmNlc1xuICogLSBMb2cgc3ViYWdlbnQgY29tcGxldGlvblxuICpcbiAqICoqTWF0Y2hlcioqOiBNYXRjaGVzIGFnYWluc3QgYGFnZW50X3R5cGVgIChlLmcuLCAnZXhwbG9yZScsICdjb2RlYmFzZS1hbmFseXNpcycpXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc3ViYWdlbnRTdG9wSG9vaywgc3ViYWdlbnRTdG9wT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBCbG9jayBleHBsb3JlIHN1YmFnZW50cyBpZiB0YXNrIGluY29tcGxldGVcbiAqIGV4cG9ydCBkZWZhdWx0IHN1YmFnZW50U3RvcEhvb2soeyBtYXRjaGVyOiAnZXhwbG9yZScgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdTdWJhZ2VudCBzdG9wcGluZycsIHtcbiAqICAgICBhZ2VudElkOiBpbnB1dC5hZ2VudF9pZCxcbiAqICAgICBhZ2VudFR5cGU6IGlucHV0LmFnZW50X3R5cGVcbiAqICAgfSk7XG4gKlxuICogICAvLyBCbG9jayBpZiB0cmFuc2NyaXB0IHNob3dzIGluY29tcGxldGUgd29ya1xuICogICByZXR1cm4gc3ViYWdlbnRTdG9wT3V0cHV0KHtcbiAqICAgICBkZWNpc2lvbjogJ2Jsb2NrJyxcbiAqICAgICByZWFzb246ICdQbGVhc2UgdmVyaWZ5IGV4cGxvcmF0aW9uIGlzIGNvbXBsZXRlJ1xuICogICB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc3ViYWdlbnRzdG9wXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdWJhZ2VudFN0b3BIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJTdWJhZ2VudFN0b3BcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFByZUNvbXBhY3QgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBQcmVDb21wYWN0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBQcmVDb21wYWN0IGhvb2tzIGZpcmUgYmVmb3JlIGNvbnRleHQgY29tcGFjdGlvbiBvY2N1cnMsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gUHJlc2VydmUgaW1wb3J0YW50IGluZm9ybWF0aW9uIGJlZm9yZSBjb21wYWN0aW9uXG4gKiAtIExvZyBjb21wYWN0aW9uIGV2ZW50c1xuICogLSBNb2RpZnkgY3VzdG9tIGluc3RydWN0aW9ucyBmb3IgdGhlIGNvbXBhY3RlZCBjb250ZXh0XG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgdHJpZ2dlcmAgKCdtYW51YWwnLCAnYXV0bycpXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgcHJlQ29tcGFjdEhvb2ssIHByZUNvbXBhY3RPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIExvZyBjb21wYWN0aW9uIGV2ZW50cyBhbmQgcHJlc2VydmUgY29udGV4dFxuICogZXhwb3J0IGRlZmF1bHQgcHJlQ29tcGFjdEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnQ29udGV4dCBjb21wYWN0aW9uIHRyaWdnZXJlZCcsIHtcbiAqICAgICB0cmlnZ2VyOiBpbnB1dC50cmlnZ2VyLFxuICogICAgIGhhc0N1c3RvbUluc3RydWN0aW9uczogaW5wdXQuY3VzdG9tX2luc3RydWN0aW9ucyAhPT0gbnVsbFxuICogICB9KTtcbiAqXG4gKiAgIHJldHVybiBwcmVDb21wYWN0T3V0cHV0KHtcbiAqICAgICBzeXN0ZW1NZXNzYWdlOiAnUmVtZW1iZXI6IHN0cmljdCBtb2RlIGlzIGVuYWJsZWQnXG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBPbmx5IGhhbmRsZSBtYW51YWwgY29tcGFjdGlvblxuICogZXhwb3J0IGRlZmF1bHQgcHJlQ29tcGFjdEhvb2soeyBtYXRjaGVyOiAnbWFudWFsJyB9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ01hbnVhbCBjb21wYWN0aW9uIHJlcXVlc3RlZCcpO1xuICogICByZXR1cm4gcHJlQ29tcGFjdE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3ByZWNvbXBhY3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZUNvbXBhY3RIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJQcmVDb21wYWN0XCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwZXJtaXNzaW9uUmVxdWVzdEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlBlcm1pc3Npb25SZXF1ZXN0XCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4iLCAiLyoqXG4gKiBMb2dnZXIgc3lzdGVtIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyBzdHJ1Y3R1cmVkIGxvZ2dpbmcgd2l0aCBldmVudCBzdWJzY3JpcHRpb24gYW5kIG9wdGlvbmFsIGZpbGUgb3V0cHV0LlxuICogVGhlIGxvZ2dlciBpcyAqKnNpbGVudCBieSBkZWZhdWx0KiogdG8gYXZvaWQgaW50ZXJmZXJpbmcgd2l0aCBob29rIHByb3RvY29sXG4gKiAoc3Rkb3V0IGlzIHJlc2VydmVkIGZvciBKU09OIHJlc3BvbnNlcywgc3RkZXJyIG1heSBjb25mbGljdCB3aXRoIENsYXVkZSBDb2RlKS5cbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBsb2dnZXIgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIFN1YnNjcmliZSB0byBsb2cgZXZlbnRzXG4gKiBjb25zdCB1bnN1YnNjcmliZSA9IGxvZ2dlci5vbignZXJyb3InLCAoZXZlbnQpID0+IHtcbiAqICAgY29uc29sZS5lcnJvcihgRXJyb3IgaW4gJHtldmVudC5ob29rVHlwZX06ICR7ZXZlbnQubWVzc2FnZX1gKTtcbiAqIH0pO1xuICpcbiAqIC8vIExhdGVyLCBjbGVhbiB1cFxuICogdW5zdWJzY3JpYmUoKTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzXG4gKi9cbmltcG9ydCB7IGNsb3NlU3luYywgZXhpc3RzU3luYywgbWtkaXJTeW5jLCBvcGVuU3luYywgd3JpdGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG4vKipcbiAqIEFsbCBsb2cgbGV2ZWxzIGluIG9yZGVyIG9mIHNldmVyaXR5IChsb3dlc3QgdG8gaGlnaGVzdCkuXG4gKi9cbmV4cG9ydCBjb25zdCBMT0dfTEVWRUxTID0gW1wiZGVidWdcIiwgXCJpbmZvXCIsIFwid2FyblwiLCBcImVycm9yXCJdO1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gTG9nZ2VyIENsYXNzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIExvZ2dlciBmb3IgQ2xhdWRlIENvZGUgaG9va3Mgd2l0aCBldmVudCBzdWJzY3JpcHRpb24gYW5kIGZpbGUgb3V0cHV0LlxuICpcbiAqICMjIEtleSBCZWhhdmlvcnNcbiAqXG4gKiB8IENvbmZpZ3VyYXRpb24gfCBCZWhhdmlvciB8XG4gKiB8LS0tLS0tLS0tLS0tLS18LS0tLS0tLS0tLXxcbiAqIHwgTm8gY29uZmlnIChkZWZhdWx0KSB8ICoqU2lsZW50KiogLSBubyBvdXRwdXQgYW55d2hlcmUgfFxuICogfCBgQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEVgIGVudiB2YXIgfCBBcHBlbmQgSlNPTiBsaW5lcyB0byBmaWxlIHxcbiAqIHwgYC5vbihsZXZlbCwgaGFuZGxlcilgIHJlZ2lzdGVyZWQgfCBFdmVudHMgZGVsaXZlcmVkIHRvIGhhbmRsZXJzIG9ubHkgfFxuICogfCBNdWx0aXBsZSBkZXN0aW5hdGlvbnMgfCBBbGwgZGVzdGluYXRpb25zIHJlY2VpdmUgZXZlbnRzIHxcbiAqXG4gKiAjIyBJbXBvcnRhbnQgTm90ZXNcbiAqXG4gKiAtICoqTmV2ZXIgb3V0cHV0cyB0byBzdGRvdXQqKiAocmVzZXJ2ZWQgZm9yIEpTT04gaG9vayByZXNwb25zZSlcbiAqIC0gKipOZXZlciBvdXRwdXRzIHRvIHN0ZGVycioqIChtYXkgaW50ZXJmZXJlIHdpdGggQ2xhdWRlIENvZGUgZXJyb3IgaGFuZGxpbmcpXG4gKiAtIEZpbGUgb3V0cHV0IHVzZXMgSlNPTiBMaW5lcyBmb3JtYXQgZm9yIGVhc3kgcGFyc2luZ1xuICogLSBgLm9uKGxldmVsLCBoYW5kbGVyKWAgcmV0dXJucyBhbiB1bnN1YnNjcmliZSBmdW5jdGlvblxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gU3Vic2NyaWJlIHRvIGV2ZW50cyBhdCBzcGVjaWZpYyBsZXZlbFxuICogbG9nZ2VyLm9uKCd3YXJuJywgKGV2ZW50KSA9PiB7XG4gKiAgIHNlbmRBbGVydChldmVudC5tZXNzYWdlKTtcbiAqIH0pO1xuICpcbiAqIC8vIExvZyB3aXRoaW4gYSBob29rIGhhbmRsZXJcbiAqIGV4cG9ydCBkZWZhdWx0IHByZVRvb2xVc2VIb29rKHsgbWF0Y2hlcjogJ0Jhc2gnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIud2FybignQWJvdXQgdG8gdmFsaWRhdGUgQmFzaCBjb21tYW5kJyk7XG4gKiAgIHJldHVybiBwcmVUb29sVXNlT3V0cHV0KHsgYWxsb3c6IHRydWUgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgTG9nZ2VyIHtcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcmVkIGV2ZW50IGhhbmRsZXJzIGJ5IGxvZyBsZXZlbC5cbiAgICAgKi9cbiAgICBoYW5kbGVycyA9IG5ldyBNYXAoKTtcbiAgICAvKipcbiAgICAgKiBGaWxlIGRlc2NyaXB0b3IgZm9yIGxvZyBmaWxlIG91dHB1dC5cbiAgICAgKiBMYXppbHkgaW5pdGlhbGl6ZWQgb24gZmlyc3Qgd3JpdGUuXG4gICAgICovXG4gICAgbG9nRmlsZUZkID0gbnVsbDtcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHRoZSBsb2cgZmlsZSwgaWYgY29uZmlndXJlZC5cbiAgICAgKi9cbiAgICBsb2dGaWxlUGF0aCA9IG51bGw7XG4gICAgLyoqXG4gICAgICogV2hldGhlciBmaWxlIGluaXRpYWxpemF0aW9uIGhhcyBiZWVuIGF0dGVtcHRlZC5cbiAgICAgKi9cbiAgICBmaWxlSW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgICAvKipcbiAgICAgKiBDdXJyZW50IGhvb2sgY29udGV4dCBmb3IgZW5yaWNoaW5nIGxvZyBldmVudHMuXG4gICAgICovXG4gICAgY3VycmVudEhvb2tUeXBlO1xuICAgIC8qKlxuICAgICAqIEN1cnJlbnQgaG9vayBpbnB1dCBmb3IgZW5yaWNoaW5nIGxvZyBldmVudHMuXG4gICAgICovXG4gICAgY3VycmVudElucHV0O1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgTG9nZ2VyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogVHlwaWNhbGx5IHlvdSBzaG91bGQgdXNlIHRoZSBleHBvcnRlZCBgbG9nZ2VyYCBzaW5nbGV0b24gcmF0aGVyIHRoYW5cbiAgICAgKiBjcmVhdGluZyBuZXcgaW5zdGFuY2VzLlxuICAgICAqIEBwYXJhbSBjb25maWcgLSBPcHRpb25hbCBjb25maWd1cmF0aW9uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGB0eXBlc2NyaXB0XG4gICAgICogLy8gVXNlIHNpbmdsZXRvbiAocmVjb21tZW5kZWQpXG4gICAgICogaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAgICAgKlxuICAgICAqIC8vIE9yIGNyZWF0ZSBjdXN0b20gaW5zdGFuY2VcbiAgICAgKiBjb25zdCBjdXN0b21Mb2dnZXIgPSBuZXcgTG9nZ2VyKHsgbG9nRmlsZVBhdGg6ICcvdmFyL2xvZy9ob29rcy5sb2cnIH0pO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9KSB7XG4gICAgICAgIC8vIEluaXRpYWxpemUgaGFuZGxlcnMgbWFwIGZvciBlYWNoIGxldmVsXG4gICAgICAgIGZvciAoY29uc3QgbGV2ZWwgb2YgTE9HX0xFVkVMUykge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVycy5zZXQobGV2ZWwsIG5ldyBTZXQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2V0IGxvZyBmaWxlIHBhdGggZnJvbSBjb25maWcgb3IgZW52aXJvbm1lbnRcbiAgICAgICAgdGhpcy5sb2dGaWxlUGF0aCA9IGNvbmZpZy5sb2dGaWxlUGF0aCA/PyBwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9IT09LU19MT0dfRklMRSA/PyBudWxsO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBMb2dzIGEgZGVidWcgbWVzc2FnZS5cbiAgICAgKlxuICAgICAqIFVzZSBmb3IgZGV0YWlsZWQgZGVidWdnaW5nIGluZm9ybWF0aW9uIHRoYXQgaXMgdHlwaWNhbGx5IG9ubHkgdXNlZnVsXG4gICAgICogZHVyaW5nIGRldmVsb3BtZW50IG9yIHRyb3VibGVzaG9vdGluZy5cbiAgICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBkZWJ1ZyBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiBsb2dnZXIuZGVidWcoJ1Byb2Nlc3NpbmcgdG9vbCBpbnB1dCcsIHsgdG9vbE5hbWU6ICdCYXNoJywgaW5wdXRTaXplOiAyNTYgfSk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgZGVidWcobWVzc2FnZSwgY29udGV4dCkge1xuICAgICAgICB0aGlzLmVtaXQoXCJkZWJ1Z1wiLCBtZXNzYWdlLCBjb250ZXh0KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTG9ncyBhbiBpbmZvIG1lc3NhZ2UuXG4gICAgICpcbiAgICAgKiBVc2UgZm9yIGdlbmVyYWwgb3BlcmF0aW9uYWwgZXZlbnRzIGxpa2UgaG9vayBpbnZvY2F0aW9ucywgc3VjY2Vzc2Z1bFxuICAgICAqIGNvbXBsZXRpb25zLCBvciBzdGF0ZSBjaGFuZ2VzLlxuICAgICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIGluZm8gbWVzc2FnZVxuICAgICAqIEBwYXJhbSBjb250ZXh0IC0gT3B0aW9uYWwgYWRkaXRpb25hbCBjb250ZXh0XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGB0eXBlc2NyaXB0XG4gICAgICogbG9nZ2VyLmluZm8oJ1Nlc3Npb24gc3RhcnRlZCcsIHsgc291cmNlOiAnc3RhcnR1cCcsIHNlc3Npb25JZDogJ2FiYzEyMycgfSk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgaW5mbyhtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgICAgIHRoaXMuZW1pdChcImluZm9cIiwgbWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIExvZ3MgYSB3YXJuaW5nIG1lc3NhZ2UuXG4gICAgICpcbiAgICAgKiBVc2UgZm9yIGNvbmRpdGlvbnMgdGhhdCBtYXkgaW5kaWNhdGUgaXNzdWVzIGJ1dCBkb24ndCBwcmV2ZW50XG4gICAgICogb3BlcmF0aW9uLCBzdWNoIGFzIGRlcHJlY2F0ZWQgcGF0dGVybnMgb3IgcGVyZm9ybWFuY2UgY29uY2VybnMuXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgLSBUaGUgd2FybmluZyBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiBsb2dnZXIud2FybignRGVwcmVjYXRlZCBob29rIHBhdHRlcm4gZGV0ZWN0ZWQnLCB7IHBhdHRlcm46ICdsZWdhY3lNYXRjaGVyJyB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICB3YXJuKG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgdGhpcy5lbWl0KFwid2FyblwiLCBtZXNzYWdlLCBjb250ZXh0KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTG9ncyBhbiBlcnJvciBtZXNzYWdlLlxuICAgICAqXG4gICAgICogVXNlIGZvciBlcnJvciBjb25kaXRpb25zIHRoYXQgcmVxdWlyZSBhdHRlbnRpb24gYnV0IHdlcmUgaGFuZGxlZFxuICAgICAqIGdyYWNlZnVsbHkuIEZvciBleGNlcHRpb25zLCBwcmVmZXIge0BsaW5rIGxvZ0Vycm9yfS5cbiAgICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBlcnJvciBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiBsb2dnZXIuZXJyb3IoJ0ZhaWxlZCB0byB2YWxpZGF0ZSB0b29sIGlucHV0JywgeyB0b29sTmFtZTogJ0Jhc2gnLCByZWFzb246ICdlbXB0eSBjb21tYW5kJyB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBlcnJvcihtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgICAgIHRoaXMuZW1pdChcImVycm9yXCIsIG1lc3NhZ2UsIGNvbnRleHQpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBMb2dzIGEgc3RydWN0dXJlZCBlcnJvciB3aXRoIGZ1bGwgZXJyb3IgZGV0YWlscy5cbiAgICAgKlxuICAgICAqIFVzZSB0aGlzIG1ldGhvZCB3aGVuIGxvZ2dpbmcgY2F1Z2h0IGV4Y2VwdGlvbnMgdG8gY2FwdHVyZSB0aGUgZnVsbFxuICAgICAqIGVycm9yIGNvbnRleHQgaW5jbHVkaW5nIG5hbWUsIG1lc3NhZ2UsIHN0YWNrIHRyYWNlLCBhbmQgY2F1c2UgY2hhaW4uXG4gICAgICogQHBhcmFtIGVycm9yIC0gVGhlIGVycm9yIHRvIGxvZ1xuICAgICAqIEBwYXJhbSBtZXNzYWdlIC0gSHVtYW4tcmVhZGFibGUgZGVzY3JpcHRpb24gb2Ygd2hhdCBmYWlsZWRcbiAgICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBgdHlwZXNjcmlwdFxuICAgICAqIHRyeSB7XG4gICAgICogICBhd2FpdCBkYW5nZXJvdXNPcGVyYXRpb24oKTtcbiAgICAgKiB9IGNhdGNoIChlcnIpIHtcbiAgICAgKiAgIGxvZ2dlci5sb2dFcnJvcihlcnIsICdGYWlsZWQgdG8gZXhlY3V0ZSBkYW5nZXJvdXMgb3BlcmF0aW9uJywge1xuICAgICAqICAgICBvcGVyYXRpb246ICdkZWxldGUnLFxuICAgICAqICAgICB0YXJnZXQ6ICcvaW1wb3J0YW50L2ZpbGUudHh0J1xuICAgICAqICAgfSk7XG4gICAgICogfVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGxvZ0Vycm9yKGVycm9yLCBtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgICAgIGNvbnN0IGVycm9ySW5mbyA9IHRoaXMuZXh0cmFjdEVycm9ySW5mbyhlcnJvcik7XG4gICAgICAgIGNvbnN0IGV2ZW50ID0ge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBsZXZlbDogXCJlcnJvclwiLFxuICAgICAgICAgICAgaG9va1R5cGU6IHRoaXMuY3VycmVudEhvb2tUeXBlLFxuICAgICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICAgIGlucHV0OiB0aGlzLmN1cnJlbnRJbnB1dCxcbiAgICAgICAgICAgIGVycm9yOiBlcnJvckluZm8sXG4gICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmRlbGl2ZXJFdmVudChldmVudCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFN1YnNjcmliZXMgYSBoYW5kbGVyIHRvIGxvZyBldmVudHMgYXQgdGhlIHNwZWNpZmllZCBsZXZlbC5cbiAgICAgKlxuICAgICAqIFRoZSBoYW5kbGVyIHdpbGwgYmUgY2FsbGVkIGZvciBldmVyeSBsb2cgZXZlbnQgYXQgdGhlIHNwZWNpZmllZCBsZXZlbC5cbiAgICAgKiBSZXR1cm5zIGFuIHVuc3Vic2NyaWJlIGZ1bmN0aW9uIHRoYXQgc2hvdWxkIGJlIGNhbGxlZCB3aGVuIHRoZSBoYW5kbGVyXG4gICAgICogaXMgbm8gbG9uZ2VyIG5lZWRlZC5cbiAgICAgKiBAcGFyYW0gbGV2ZWwgLSBUaGUgbG9nIGxldmVsIHRvIHN1YnNjcmliZSB0b1xuICAgICAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gY2FsbCBmb3IgZWFjaCBldmVudFxuICAgICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gdW5zdWJzY3JpYmUgdGhlIGhhbmRsZXJcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiAvLyBTdWJzY3JpYmUgdG8gZXJyb3IgZXZlbnRzXG4gICAgICogY29uc3QgdW5zdWJzY3JpYmUgPSBsb2dnZXIub24oJ2Vycm9yJywgKGV2ZW50KSA9PiB7XG4gICAgICogICBjb25zb2xlLmVycm9yKGBbJHtldmVudC5ob29rVHlwZX1dICR7ZXZlbnQubWVzc2FnZX1gKTtcbiAgICAgKiAgIGlmIChldmVudC5lcnJvcikge1xuICAgICAqICAgICBjb25zb2xlLmVycm9yKGV2ZW50LmVycm9yLnN0YWNrKTtcbiAgICAgKiAgIH1cbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIExhdGVyLCBjbGVhbiB1cFxuICAgICAqIHVuc3Vic2NyaWJlKCk7XG4gICAgICogYGBgXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGB0eXBlc2NyaXB0XG4gICAgICogLy8gRm9yd2FyZCB0byBleHRlcm5hbCBsb2dnaW5nIGxpYnJhcnlcbiAgICAgKiBpbXBvcnQgcGlubyBmcm9tICdwaW5vJztcbiAgICAgKiBjb25zdCBwaW5vTG9nZ2VyID0gcGlubygpO1xuICAgICAqXG4gICAgICogbG9nZ2VyLm9uKCdpbmZvJywgKGV2ZW50KSA9PiBwaW5vTG9nZ2VyLmluZm8oZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAgICAgKiBsb2dnZXIub24oJ3dhcm4nLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIud2FybihldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICAgICAqIGxvZ2dlci5vbignZXJyb3InLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIuZXJyb3IoZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBvbihsZXZlbCwgaGFuZGxlcikge1xuICAgICAgICBjb25zdCBsZXZlbEhhbmRsZXJzID0gdGhpcy5oYW5kbGVycy5nZXQobGV2ZWwpO1xuICAgICAgICBpZiAobGV2ZWxIYW5kbGVycykge1xuICAgICAgICAgICAgbGV2ZWxIYW5kbGVycy5hZGQoaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgIGxldmVsSGFuZGxlcnM/LmRlbGV0ZShoYW5kbGVyKTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY3VycmVudCBob29rIGNvbnRleHQgZm9yIGVucmljaGluZyBsb2cgZXZlbnRzLlxuICAgICAqXG4gICAgICogVGhpcyBpcyBjYWxsZWQgaW50ZXJuYWxseSBieSB0aGUgcnVudGltZSBiZWZvcmUgaW52b2tpbmcgaG9vayBoYW5kbGVycy5cbiAgICAgKiBZb3UgdHlwaWNhbGx5IGRvbid0IG5lZWQgdG8gY2FsbCB0aGlzIGRpcmVjdGx5LlxuICAgICAqIEBwYXJhbSBob29rVHlwZSAtIFRoZSB0eXBlIG9mIGhvb2sgYmVpbmcgZXhlY3V0ZWRcbiAgICAgKiBAcGFyYW0gaW5wdXQgLSBUaGUgaG9vayBpbnB1dCBkYXRhXG4gICAgICogQGludGVybmFsXG4gICAgICovXG4gICAgc2V0Q29udGV4dChob29rVHlwZSwgaW5wdXQpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50SG9va1R5cGUgPSBob29rVHlwZTtcbiAgICAgICAgdGhpcy5jdXJyZW50SW5wdXQgPSBpbnB1dDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2xlYXJzIHRoZSBjdXJyZW50IGhvb2sgY29udGV4dC5cbiAgICAgKlxuICAgICAqIENhbGxlZCBpbnRlcm5hbGx5IGJ5IHRoZSBydW50aW1lIGFmdGVyIGhvb2sgZXhlY3V0aW9uIGNvbXBsZXRlcy5cbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKi9cbiAgICBjbGVhckNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuY3VycmVudEhvb2tUeXBlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmN1cnJlbnRJbnB1dCA9IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyB0aGUgbG9nIGZpbGUgcGF0aCBhdCBydW50aW1lLlxuICAgICAqXG4gICAgICogQ2FsbCB0aGlzIHRvIGVuYWJsZSBvciBjaGFuZ2UgZmlsZSBsb2dnaW5nLiBTZXR0aW5nIHRvIGBudWxsYCBkaXNhYmxlc1xuICAgICAqIGZpbGUgbG9nZ2luZyAoYnV0IGRvZXNuJ3QgY2xvc2UgZXhpc3RpbmcgZmlsZSBoYW5kbGUgaW1tZWRpYXRlbHkpLlxuICAgICAqIEBwYXJhbSBmaWxlUGF0aCAtIFBhdGggdG8gdGhlIGxvZyBmaWxlLCBvciBudWxsIHRvIGRpc2FibGVcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiAvLyBFbmFibGUgZmlsZSBsb2dnaW5nIGF0IHJ1bnRpbWVcbiAgICAgKiBsb2dnZXIuc2V0TG9nRmlsZSgnL3Zhci9sb2cvY2xhdWRlLWhvb2tzLmxvZycpO1xuICAgICAqXG4gICAgICogLy8gRGlzYWJsZSBmaWxlIGxvZ2dpbmdcbiAgICAgKiBsb2dnZXIuc2V0TG9nRmlsZShudWxsKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBzZXRMb2dGaWxlKGZpbGVQYXRoKSB7XG4gICAgICAgIC8vIENsb3NlIGV4aXN0aW5nIGZpbGUgaWYgb3BlblxuICAgICAgICBpZiAodGhpcy5sb2dGaWxlRmQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY2xvc2VTeW5jKHRoaXMubG9nRmlsZUZkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIHtcbiAgICAgICAgICAgICAgICAvLyBJZ25vcmUgZXJyb3JzIG9uIGNsb3NlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmxvZ0ZpbGVGZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5sb2dGaWxlUGF0aCA9IGZpbGVQYXRoO1xuICAgICAgICB0aGlzLmZpbGVJbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgYWxsIHJlc291cmNlcyBoZWxkIGJ5IHRoZSBsb2dnZXIuXG4gICAgICpcbiAgICAgKiBDYWxsIHRoaXMgZHVyaW5nIGdyYWNlZnVsIHNodXRkb3duIHRvIGVuc3VyZSBhbGwgbG9nIGRhdGEgaXMgZmx1c2hlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiBwcm9jZXNzLm9uKCdleGl0JywgKCkgPT4ge1xuICAgICAqICAgbG9nZ2VyLmNsb3NlKCk7XG4gICAgICogfSk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgY2xvc2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmxvZ0ZpbGVGZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjbG9zZVN5bmModGhpcy5sb2dGaWxlRmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2gge1xuICAgICAgICAgICAgICAgIC8vIElnbm9yZSBlcnJvcnMgb24gY2xvc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubG9nRmlsZUZkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZpbGVJbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgdGhlcmUgYXJlIGFueSBhY3RpdmUgaGFuZGxlcnMgb3IgZGVzdGluYXRpb25zLlxuICAgICAqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIGFueSBoYW5kbGVycyBhcmUgcmVnaXN0ZXJlZCBvciBmaWxlIGxvZ2dpbmcgaXMgZW5hYmxlZC5cbiAgICAgKiBAcmV0dXJucyBXaGV0aGVyIHRoZSBsb2dnZXIgaGFzIGFueSBhY3RpdmUgb3V0cHV0IGRlc3RpbmF0aW9uc1xuICAgICAqL1xuICAgIGhhc0Rlc3RpbmF0aW9ucygpIHtcbiAgICAgICAgZm9yIChjb25zdCBoYW5kbGVycyBvZiB0aGlzLmhhbmRsZXJzLnZhbHVlcygpKSB7XG4gICAgICAgICAgICBpZiAoaGFuZGxlcnMuc2l6ZSA+IDApXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubG9nRmlsZVBhdGggIT09IG51bGw7XG4gICAgfVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBQcml2YXRlIE1ldGhvZHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLyoqXG4gICAgICogRW1pdHMgYSBsb2cgZXZlbnQuXG4gICAgICogQHBhcmFtIGxldmVsIC0gVGhlIHNldmVyaXR5IGxldmVsIG9mIHRoZSBldmVudFxuICAgICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIGxvZyBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHQgZGF0YVxuICAgICAqL1xuICAgIGVtaXQobGV2ZWwsIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGxldmVsLFxuICAgICAgICAgICAgaG9va1R5cGU6IHRoaXMuY3VycmVudEhvb2tUeXBlLFxuICAgICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICAgIGlucHV0OiB0aGlzLmN1cnJlbnRJbnB1dCxcbiAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZGVsaXZlckV2ZW50KGV2ZW50KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsaXZlcnMgYW4gZXZlbnQgdG8gYWxsIHJlZ2lzdGVyZWQgZGVzdGluYXRpb25zLlxuICAgICAqIEBwYXJhbSBldmVudCAtIFRoZSBsb2cgZXZlbnQgdG8gZGVsaXZlclxuICAgICAqL1xuICAgIGRlbGl2ZXJFdmVudChldmVudCkge1xuICAgICAgICAvLyBEZWxpdmVyIHRvIGV2ZW50IGhhbmRsZXJzXG4gICAgICAgIGNvbnN0IGxldmVsSGFuZGxlcnMgPSB0aGlzLmhhbmRsZXJzLmdldChldmVudC5sZXZlbCk7XG4gICAgICAgIGlmIChsZXZlbEhhbmRsZXJzKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGhhbmRsZXIgb2YgbGV2ZWxIYW5kbGVycykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXIoZXZlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNpbGVudGx5IGlnbm9yZSBoYW5kbGVyIGVycm9ycyB0byBub3QgZGlzcnVwdCBob29rIGV4ZWN1dGlvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBXcml0ZSB0byBmaWxlIGlmIGNvbmZpZ3VyZWRcbiAgICAgICAgdGhpcy53cml0ZVRvRmlsZShldmVudCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFdyaXRlcyBhbiBldmVudCB0byB0aGUgbG9nIGZpbGUuXG4gICAgICogQHBhcmFtIGV2ZW50IC0gVGhlIGxvZyBldmVudCB0byB3cml0ZVxuICAgICAqL1xuICAgIHdyaXRlVG9GaWxlKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5sb2dGaWxlUGF0aClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgLy8gTGF6eSBpbml0aWFsaXphdGlvbiBvZiBmaWxlIGhhbmRsZVxuICAgICAgICBpZiAoIXRoaXMuZmlsZUluaXRpYWxpemVkKSB7XG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVGaWxlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMubG9nRmlsZUZkID09PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IGAke0pTT04uc3RyaW5naWZ5KGV2ZW50KX1cXG5gO1xuICAgICAgICAgICAgd3JpdGVTeW5jKHRoaXMubG9nRmlsZUZkLCBsaW5lKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBpZ25vcmUgZmlsZSB3cml0ZSBlcnJvcnMgdG8gbm90IGRpc3J1cHQgaG9vayBleGVjdXRpb25cbiAgICAgICAgICAgIC8vIFRoaXMgZm9sbG93cyB0aGUgcmlzayBtaXRpZ2F0aW9uOiBcIkdyYWNlZnVsIGRlZ3JhZGF0aW9uIC0gbG9nIHdyaXRlXG4gICAgICAgICAgICAvLyBmYWlsdXJlcyBhcmUgc2lsZW50bHkgaWdub3JlZCB0byBub3QgZGlzcnVwdCBob29rIGV4ZWN1dGlvblwiXG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgdGhlIGxvZyBmaWxlIGZvciB3cml0aW5nLlxuICAgICAqL1xuICAgIGluaXRpYWxpemVGaWxlKCkge1xuICAgICAgICB0aGlzLmZpbGVJbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgIGlmICghdGhpcy5sb2dGaWxlUGF0aClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEVuc3VyZSBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICBjb25zdCBkaXIgPSBkaXJuYW1lKHRoaXMubG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgaWYgKCFleGlzdHNTeW5jKGRpcikpIHtcbiAgICAgICAgICAgICAgICBta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE9wZW4gZmlsZSBmb3IgYXBwZW5kaW5nXG4gICAgICAgICAgICB0aGlzLmxvZ0ZpbGVGZCA9IG9wZW5TeW5jKHRoaXMubG9nRmlsZVBhdGgsIFwiYVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBpZ25vcmUgZmlsZSBpbml0aWFsaXphdGlvbiBlcnJvcnNcbiAgICAgICAgICAgIHRoaXMubG9nRmlsZUZkID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0cyBzdHJ1Y3R1cmVkIGVycm9yIGluZm9ybWF0aW9uIGZyb20gYW4gdW5rbm93biBlcnJvci5cbiAgICAgKiBAcGFyYW0gZXJyb3IgLSBUaGUgZXJyb3IgdG8gZXh0cmFjdCBpbmZvcm1hdGlvbiBmcm9tXG4gICAgICogQHJldHVybnMgU3RydWN0dXJlZCBlcnJvciBpbmZvcm1hdGlvblxuICAgICAqL1xuICAgIGV4dHJhY3RFcnJvckluZm8oZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogZXJyb3IubmFtZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIHN0YWNrOiBlcnJvci5zdGFjayxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBFeHRyYWN0IGNhdXNlIGNoYWluIGlmIHByZXNlbnRcbiAgICAgICAgICAgIGlmIChlcnJvci5jYXVzZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaW5mby5jYXVzZSA9IHRoaXMuZXh0cmFjdEVycm9ySW5mbyhlcnJvci5jYXVzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gaW5mbztcbiAgICAgICAgfVxuICAgICAgICAvLyBIYW5kbGUgbm9uLUVycm9yIHZhbHVlc1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbmFtZTogXCJVbmtub3duRXJyb3JcIixcbiAgICAgICAgICAgIG1lc3NhZ2U6IFN0cmluZyhlcnJvciksXG4gICAgICAgIH07XG4gICAgfVxufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2luZ2xldG9uIEV4cG9ydFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBHbG9iYWwgbG9nZ2VyIGluc3RhbmNlIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBVc2UgdGhpcyBzaW5nbGV0b24gZm9yIGFsbCBsb2dnaW5nIHdpdGhpbiBob29rcy4gVGhlIGxvZ2dlciBpcyBjb25maWd1cmVkXG4gKiB2aWEgZW52aXJvbm1lbnQgdmFyaWFibGVzIGFuZCBzdXBwb3J0cyBldmVudCBzdWJzY3JpcHRpb24gZm9yIGN1c3RvbVxuICogZGVzdGluYXRpb25zLlxuICpcbiAqICMjIENvbmZpZ3VyYXRpb25cbiAqXG4gKiB8IEVudmlyb25tZW50IFZhcmlhYmxlIHwgRGVzY3JpcHRpb24gfFxuICogfC0tLS0tLS0tLS0tLS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tfFxuICogfCBgQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEVgIHwgUGF0aCB0byBsb2cgZmlsZSAoSlNPTiBMaW5lcyBmb3JtYXQpIHxcbiAqXG4gKiAjIyBVc2FnZSBpbiBIb29rc1xuICpcbiAqIFRoZSBsb2dnZXIgaXMgcGFzc2VkIHRvIGhvb2sgaGFuZGxlcnMgdmlhIGNvbnRleHQgZm9yIGNvbnZlbmllbmNlOlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGV4cG9ydCBkZWZhdWx0IHByZVRvb2xVc2VIb29rKHsgbWF0Y2hlcjogJ0Jhc2gnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIud2FybignVmFsaWRhdGluZyBCYXNoIGNvbW1hbmQnKTtcbiAqICAgcmV0dXJuIHByZVRvb2xVc2VPdXRwdXQoeyBhbGxvdzogdHJ1ZSB9KTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogIyMgRXh0ZXJuYWwgSW50ZWdyYXRpb25cbiAqXG4gKiBTdWJzY3JpYmUgdG8gZXZlbnRzIHRvIGZvcndhcmQgbG9ncyB0byBleHRlcm5hbCBzeXN0ZW1zOlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKiBpbXBvcnQgcGlubyBmcm9tICdwaW5vJztcbiAqXG4gKiBjb25zdCBwaW5vTG9nZ2VyID0gcGlubyh7IGxldmVsOiAnZGVidWcnIH0pO1xuICpcbiAqIGxvZ2dlci5vbignZGVidWcnLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIuZGVidWcoZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAqIGxvZ2dlci5vbignaW5mbycsIChldmVudCkgPT4gcGlub0xvZ2dlci5pbmZvKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gKiBsb2dnZXIub24oJ3dhcm4nLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIud2FybihldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICogbG9nZ2VyLm9uKCdlcnJvcicsIChldmVudCkgPT4gcGlub0xvZ2dlci5lcnJvcihldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICogYGBgXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gRGlyZWN0IHVzYWdlXG4gKiBpbXBvcnQgeyBsb2dnZXIgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIGxvZ2dlci5pbmZvKCdTdGFydGluZyBvcGVyYXRpb24nKTtcbiAqIGxvZ2dlci53YXJuKCdSZXNvdXJjZSBsaW1pdCBhcHByb2FjaGluZycsIHsgdXNhZ2U6IDAuOSB9KTtcbiAqXG4gKiB0cnkge1xuICogICBhd2FpdCByaXNreU9wZXJhdGlvbigpO1xuICogfSBjYXRjaCAoZXJyKSB7XG4gKiAgIGxvZ2dlci5sb2dFcnJvcihlcnIsICdSaXNreSBvcGVyYXRpb24gZmFpbGVkJyk7XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IG5ldyBMb2dnZXIoKTtcbiIsICIvKipcbiAqIE91dHB1dCB0eXBlcyBhbmQgYnVpbGRlcnMgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIFByb3ZpZGVzIHR5cGUtc2FmZSBvdXRwdXQgYnVpbGRlciBmdW5jdGlvbnMgZm9yIGFsbCAxMiBob29rIHR5cGVzLiBFYWNoIGJ1aWxkZXJcbiAqIGFjY2VwdHMgb3B0aW9ucyB0aGF0IG1hdGNoIHRoZSB3aXJlIGZvcm1hdCBleHBlY3RlZCBieSBDbGF1ZGUgQ29kZSwgd2l0aCB0eXBlc1xuICogZGVyaXZlZCBmcm9tIHRoZSBDbGF1ZGUgQWdlbnQgU0RLJ3MgYFN5bmNIb29rSlNPTk91dHB1dGAgdHlwZS5cbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICogQG1vZHVsZVxuICovXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBFeGl0IENvZGUgQ29uc3RhbnRzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIEV4aXQgY29kZXMgdXNlZCBieSBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiB8IEV4aXQgQ29kZSB8IE5hbWUgfCBXaGVuIFVzZWQgfCBDbGF1ZGUgQ29kZSBCZWhhdmlvciB8XG4gKiB8LS0tLS0tLS0tLS18LS0tLS0tfC0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbiAqIHwgMCB8IFN1Y2Nlc3MgfCBIYW5kbGVyIHJldHVybnMgbm9ybWFsbHkgfCBDb250aW51ZSwgcGFyc2Ugc3Rkb3V0IGFzIEpTT04gfFxuICogfCAxIHwgRXJyb3IgfCBJbnZhbGlkIGlucHV0LCBub24tYmxvY2tpbmcgZXJyb3IgfCBOb24tYmxvY2tpbmcsIHN0ZGVyciB0byB1c2VyIG9ubHkgfFxuICogfCAyIHwgQmxvY2sgfCBIYW5kbGVyIHRocm93cyBPUiBgc3RvcFJlYXNvbmAgc2V0IHwgQmxvY2tpbmcsIHN0ZGVyciBzaG93biB0byBDbGF1ZGUgfFxuICovXG5leHBvcnQgY29uc3QgRVhJVF9DT0RFUyA9IHtcbiAgICAvKiogSGFuZGxlciBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5LiBDbGF1ZGUgQ29kZSBwYXJzZXMgc3Rkb3V0IGFzIEpTT04uICovXG4gICAgU1VDQ0VTUzogMCxcbiAgICAvKiogTm9uLWJsb2NraW5nIGVycm9yIG9jY3VycmVkIChlLmcuLCBpbnZhbGlkIGlucHV0KS4gc3RkZXJyIHNob3duIHRvIHVzZXIgb25seS4gKi9cbiAgICBFUlJPUjogMSxcbiAgICAvKiogSGFuZGxlciB0aHJldyBleGNlcHRpb24gT1IgYmxvY2tpbmcgYWN0aW9uIHJlcXVlc3RlZC4gc3RkZXJyIHNob3duIHRvIENsYXVkZS4gKi9cbiAgICBCTE9DSzogMixcbn07XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBPdXRwdXQgQnVpbGRlciBGYWN0b3JpZXNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogRmFjdG9yeSBmb3IgaG9va3MgdGhhdCBoYXZlIGhvb2tTcGVjaWZpY091dHB1dCB3aXRoIGEgaG9va0V2ZW50TmFtZSBkaXNjcmltaW5hdG9yLlxuICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIGhvb2sgdHlwZSBuYW1lIHVzZWQgYXMgdGhlIF90eXBlIGRpc2NyaW1pbmF0b3JcbiAqIEByZXR1cm5zIEEgYnVpbGRlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIG91dHB1dCBvYmplY3RcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKGhvb2tUeXBlKSB7XG4gICAgcmV0dXJuIChvcHRpb25zID0ge30pID0+IHtcbiAgICAgICAgY29uc3QgeyBob29rU3BlY2lmaWNPdXRwdXQsIC4uLnJlc3QgfSA9IG9wdGlvbnM7XG4gICAgICAgIGNvbnN0IHN0ZG91dCA9IGhvb2tTcGVjaWZpY091dHB1dCAhPT0gdW5kZWZpbmVkXG4gICAgICAgICAgICA/IHsgLi4ucmVzdCwgaG9va1NwZWNpZmljT3V0cHV0OiB7IGhvb2tFdmVudE5hbWU6IGhvb2tUeXBlLCAuLi5ob29rU3BlY2lmaWNPdXRwdXQgfSB9XG4gICAgICAgICAgICA6IHJlc3Q7XG4gICAgICAgIHJldHVybiB7IF90eXBlOiBob29rVHlwZSwgc3Rkb3V0IH07XG4gICAgfTtcbn1cbi8qKlxuICogRmFjdG9yeSBmb3IgaG9va3MgdGhhdCBvbmx5IHVzZSBDb21tb25PcHRpb25zIChzaW1wbGUgcGFzc3Rocm91Z2gpLlxuICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIGhvb2sgdHlwZSBuYW1lIHVzZWQgYXMgdGhlIF90eXBlIGRpc2NyaW1pbmF0b3JcbiAqIEByZXR1cm5zIEEgYnVpbGRlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIG91dHB1dCBvYmplY3RcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVTaW1wbGVPdXRwdXRCdWlsZGVyKGhvb2tUeXBlKSB7XG4gICAgcmV0dXJuIChvcHRpb25zID0ge30pID0+ICh7XG4gICAgICAgIF90eXBlOiBob29rVHlwZSxcbiAgICAgICAgc3Rkb3V0OiBvcHRpb25zLFxuICAgIH0pO1xufVxuLyoqXG4gKiBGYWN0b3J5IGZvciBob29rcyB0aGF0IHVzZSBkZWNpc2lvbi1iYXNlZCBvcHRpb25zIChTdG9wLCBTdWJhZ2VudFN0b3ApLlxuICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIGhvb2sgdHlwZSBuYW1lIHVzZWQgYXMgdGhlIF90eXBlIGRpc2NyaW1pbmF0b3JcbiAqIEByZXR1cm5zIEEgYnVpbGRlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIG91dHB1dCBvYmplY3RcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVEZWNpc2lvbk91dHB1dEJ1aWxkZXIoaG9va1R5cGUpIHtcbiAgICByZXR1cm4gKG9wdGlvbnMgPSB7fSkgPT4gKHtcbiAgICAgICAgX3R5cGU6IGhvb2tUeXBlLFxuICAgICAgICBzdGRvdXQ6IG9wdGlvbnMsXG4gICAgfSk7XG59XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQcmVUb29sVXNlIGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBQcmVUb29sVXNlT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBbGxvdyB0b29sIGV4ZWN1dGlvblxuICogcHJlVG9vbFVzZU91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDogeyBwZXJtaXNzaW9uRGVjaXNpb246ICdhbGxvdycgfVxuICogfSk7XG4gKlxuICogLy8gRGVueSB3aXRoIHJlYXNvblxuICogcHJlVG9vbFVzZU91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIHBlcm1pc3Npb25EZWNpc2lvbjogJ2RlbnknLFxuICogICAgIHBlcm1pc3Npb25EZWNpc2lvblJlYXNvbjogJ0Rhbmdlcm91cyBjb21tYW5kIGRldGVjdGVkJ1xuICogICB9XG4gKiB9KTtcbiAqXG4gKiAvLyBBbGxvdyB3aXRoIG1vZGlmaWVkIGlucHV0XG4gKiBwcmVUb29sVXNlT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgcGVybWlzc2lvbkRlY2lzaW9uOiAnYWxsb3cnLFxuICogICAgIHVwZGF0ZWRJbnB1dDogeyBjb21tYW5kOiAnbHMgLWxhJyB9XG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwcmVUb29sVXNlT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoXCJQcmVUb29sVXNlXCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUG9zdFRvb2xVc2UgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFBvc3RUb29sVXNlT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBZGQgY29udGV4dCBhZnRlciBhIGZpbGUgcmVhZFxuICogcG9zdFRvb2xVc2VPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ0ZpbGUgY29udGFpbnMgc2Vuc2l0aXZlIGRhdGEnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwb3N0VG9vbFVzZU91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKFwiUG9zdFRvb2xVc2VcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQb3N0VG9vbFVzZUZhaWx1cmUgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFBvc3RUb29sVXNlRmFpbHVyZU91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogcG9zdFRvb2xVc2VGYWlsdXJlT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdUcnkgdXNpbmcgYSBkaWZmZXJlbnQgYXBwcm9hY2gnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwb3N0VG9vbFVzZUZhaWx1cmVPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcihcIlBvc3RUb29sVXNlRmFpbHVyZVwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFVzZXJQcm9tcHRTdWJtaXQgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFVzZXJQcm9tcHRTdWJtaXRPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHVzZXJQcm9tcHRTdWJtaXRPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ1RoaXMgcHJvamVjdCB1c2VzIFR5cGVTY3JpcHQgc3RyaWN0IG1vZGUnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCB1c2VyUHJvbXB0U3VibWl0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoXCJVc2VyUHJvbXB0U3VibWl0XCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgU2Vzc2lvblN0YXJ0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTZXNzaW9uU3RhcnRPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHNlc3Npb25TdGFydE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiBKU09OLnN0cmluZ2lmeSh7IHByb2plY3Q6ICdteS1wcm9qZWN0JyB9KVxuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc2Vzc2lvblN0YXJ0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoXCJTZXNzaW9uU3RhcnRcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTZXNzaW9uRW5kIGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTZXNzaW9uRW5kT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBzZXNzaW9uRW5kT3V0cHV0KHt9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc2Vzc2lvbkVuZE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVTaW1wbGVPdXRwdXRCdWlsZGVyKFwiU2Vzc2lvbkVuZFwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFN0b3AgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFN0b3BPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEFsbG93IHRoZSBzdG9wXG4gKiBzdG9wT3V0cHV0KHsgZGVjaXNpb246ICdhcHByb3ZlJyB9KTtcbiAqXG4gKiAvLyBCbG9jayB3aXRoIHJlYXNvblxuICogc3RvcE91dHB1dCh7XG4gKiAgIGRlY2lzaW9uOiAnYmxvY2snLFxuICogICByZWFzb246ICdUaGVyZSBhcmUgdW5jb21taXR0ZWQgY2hhbmdlcydcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBzdG9wT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZURlY2lzaW9uT3V0cHV0QnVpbGRlcihcIlN0b3BcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTdWJhZ2VudFN0YXJ0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTdWJhZ2VudFN0YXJ0T3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBzdWJhZ2VudFN0YXJ0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdGb2N1cyBvbiBmaW5kaW5nIHBhdHRlcm5zJ1xuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc3ViYWdlbnRTdGFydE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKFwiU3ViYWdlbnRTdGFydFwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFN1YmFnZW50U3RvcCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgU3ViYWdlbnRTdG9wT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBCbG9jayB3aXRoIHJlYXNvblxuICogc3ViYWdlbnRTdG9wT3V0cHV0KHtcbiAqICAgZGVjaXNpb246ICdibG9jaycsXG4gKiAgIHJlYXNvbjogJ1Rhc2sgbm90IGNvbXBsZXRlJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHN1YmFnZW50U3RvcE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVEZWNpc2lvbk91dHB1dEJ1aWxkZXIoXCJTdWJhZ2VudFN0b3BcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBOb3RpZmljYXRpb24gaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIE5vdGlmaWNhdGlvbk91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gQWRkIGNvbnRleHQgYWJvdXQgdGhlIG5vdGlmaWNhdGlvblxuICogbm90aWZpY2F0aW9uT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdOb3RpZmljYXRpb24gZm9yd2FyZGVkIHRvIFNsYWNrICNhbGVydHMgY2hhbm5lbCdcbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gU3VwcHJlc3MgdGhlIG5vdGlmaWNhdGlvblxuICogbm90aWZpY2F0aW9uT3V0cHV0KHsgc3VwcHJlc3NPdXRwdXQ6IHRydWUgfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvbk91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKFwiTm90aWZpY2F0aW9uXCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUHJlQ29tcGFjdCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgUHJlQ29tcGFjdE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogcHJlQ29tcGFjdE91dHB1dCh7XG4gKiAgIHN5c3RlbU1lc3NhZ2U6ICdSZW1lbWJlcjogc3RyaWN0IG1vZGUgaXMgZW5hYmxlZCdcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwcmVDb21wYWN0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZVNpbXBsZU91dHB1dEJ1aWxkZXIoXCJQcmVDb21wYWN0XCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUGVybWlzc2lvblJlcXVlc3QgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBdXRvLWFwcHJvdmVcbiAqIHBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgZGVjaXNpb246IHsgYmVoYXZpb3I6ICdhbGxvdycgfVxuICogICB9XG4gKiB9KTtcbiAqXG4gKiAvLyBBdXRvLWFwcHJvdmUgd2l0aCBtb2RpZmllZCBpbnB1dFxuICogcGVybWlzc2lvblJlcXVlc3RPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBkZWNpc2lvbjoge1xuICogICAgICAgYmVoYXZpb3I6ICdhbGxvdycsXG4gKiAgICAgICB1cGRhdGVkSW5wdXQ6IHsgZmlsZV9wYXRoOiAnL3NhZmUvcGF0aCcgfVxuICogICAgIH1cbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gQXV0by1kZW55XG4gKiBwZXJtaXNzaW9uUmVxdWVzdE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGRlY2lzaW9uOiB7XG4gKiAgICAgICBiZWhhdmlvcjogJ2RlbnknLFxuICogICAgICAgbWVzc2FnZTogJ05vdCBhbGxvd2VkJyxcbiAqICAgICAgIGludGVycnVwdDogdHJ1ZVxuICogICAgIH1cbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gRmFsbCB0aHJvdWdoIHRvIG5vcm1hbCBwcm9tcHRcbiAqIHBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0KHt9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3QgcGVybWlzc2lvblJlcXVlc3RPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcihcIlBlcm1pc3Npb25SZXF1ZXN0XCIpO1xuIiwgIi8qKlxuICogUnVudGltZSBtb2R1bGUgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIEhhbmRsZXMgc3RkaW4vc3Rkb3V0L2V4aXQgY29kZSBzZW1hbnRpY3MgZm9yIGNvbXBpbGVkIGhvb2sgZXhlY3V0aW9uLlxuICogVGhpcyBtb2R1bGUgaXMgdGhlIGNvcmUgb3JjaGVzdHJhdG9yIHRoYXQ6XG4gKiAtIFJlYWRzIEpTT04gZnJvbSBzdGRpbiAod2lyZSBmb3JtYXQgd2l0aCBzbmFrZV9jYXNlIHByb3BlcnRpZXMpXG4gKiAtIEludm9rZXMgdGhlIGhvb2sgaGFuZGxlclxuICogLSBXcml0ZXMgb3V0cHV0IHRvIHN0ZG91dFxuICogLSBNYW5hZ2VzIGV4aXQgY29kZXNcbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBJbiBhIGNvbXBpbGVkIGhvb2sgZmlsZVxuICogaW1wb3J0IHsgZXhlY3V0ZSB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcy9ydW50aW1lJztcbiAqIGltcG9ydCBteUhvb2sgZnJvbSAnLi9teS1ob29rLmpzJztcbiAqXG4gKiBleGVjdXRlKG15SG9vayk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICovXG5pbXBvcnQgeyBwZXJzaXN0RW52VmFyLCBwZXJzaXN0RW52VmFycyB9IGZyb20gXCIuL2Vudi5qc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4vbG9nZ2VyLmpzXCI7XG5pbXBvcnQgeyBFWElUX0NPREVTIH0gZnJvbSBcIi4vb3V0cHV0cy5qc1wiO1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RkaW4vU3Rkb3V0IEhhbmRsaW5nXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIFJlYWRzIGFsbCBkYXRhIGZyb20gc3RkaW4uXG4gKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byB0aGUgY29tcGxldGUgc3RkaW4gY29udGVudFxuICovXG5hc3luYyBmdW5jdGlvbiByZWFkU3RkaW4oKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgICAgIC8vIFNldCBlbmNvZGluZyBmaXJzdCB0byBlbnN1cmUgZGF0YSBldmVudHMgcmVjZWl2ZSBzdHJpbmdzXG4gICAgICAgIHByb2Nlc3Muc3RkaW4uc2V0RW5jb2RpbmcoXCJ1dGYtOFwiKTtcbiAgICAgICAgcHJvY2Vzcy5zdGRpbi5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XG4gICAgICAgICAgICBjaHVua3MucHVzaChjaHVuayk7XG4gICAgICAgIH0pO1xuICAgICAgICBwcm9jZXNzLnN0ZGluLm9uKFwiZW5kXCIsICgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoY2h1bmtzLmpvaW4oXCJcIikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcHJvY2Vzcy5zdGRpbi5vbihcImVycm9yXCIsIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG4vKipcbiAqIFBhcnNlcyBzdGRpbiBKU09OIGlucHV0LlxuICogQHBhcmFtIHN0ZGluQ29udGVudCAtIFJhdyBzdGRpbiBjb250ZW50XG4gKiBAcmV0dXJucyBQYXJzZWQgaW5wdXQgKHdpcmUgZm9ybWF0IHdpdGggc25ha2VfY2FzZSBwcm9wZXJ0aWVzKVxuICogQHRocm93cyBFcnJvciBpZiBKU09OIGlzIG1hbGZvcm1lZFxuICovXG5mdW5jdGlvbiBwYXJzZVN0ZGluSW5wdXQoc3RkaW5Db250ZW50KSB7XG4gICAgLy8gUGFyc2UgSlNPTiAtIGlucHV0IHVzZXMgd2lyZSBmb3JtYXQgKHNuYWtlX2Nhc2UpIGRpcmVjdGx5XG4gICAgY29uc3QgcmF3SW5wdXQgPSBKU09OLnBhcnNlKHN0ZGluQ29udGVudCk7XG4gICAgcmV0dXJuIHJhd0lucHV0O1xufVxuLyoqXG4gKiBXcml0ZXMgaG9vayBvdXRwdXQgdG8gc3Rkb3V0LlxuICpcbiAqIE91dHB1dCB1c2VzIGNhbWVsQ2FzZSBrZXlzIHBlciBDbGF1ZGUgQ29kZSBob29rIHNwZWNpZmljYXRpb24uXG4gKiBAcGFyYW0gb3V0cHV0IC0gVGhlIGhvb2sgb3V0cHV0IHRvIHdyaXRlXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjaG9vay1vdXRwdXQtc3RydWN0dXJlXG4gKi9cbmZ1bmN0aW9uIHdyaXRlU3Rkb3V0KG91dHB1dCkge1xuICAgIC8vIE91dHB1dCB1c2VzIGNhbWVsQ2FzZSAtIG5vIHRyYW5zZm9ybWF0aW9uIG5lZWRlZFxuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKEpTT04uc3RyaW5naWZ5KG91dHB1dCkpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRXJyb3IgSGFuZGxpbmdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhbiBlcnJvciBvdXRwdXQgZm9yIG1hbGZvcm1lZCBzdGRpbiBKU09OLlxuICogQHBhcmFtIGVycm9yIC0gVGhlIHBhcnNlIGVycm9yXG4gKiBAcmV0dXJucyBIb29rT3V0cHV0IHdpdGggZW1wdHkgc3Rkb3V0XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZU1hbGZvcm1lZElucHV0T3V0cHV0KGVycm9yKSB7XG4gICAgbG9nZ2VyLmVycm9yKGBJbnZhbGlkIEpTT04gaW5wdXQ6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWApO1xuICAgIHJldHVybiB7IHN0ZG91dDoge30gfTtcbn1cbi8qKlxuICogV3JpdGVzIGhhbmRsZXIgZXJyb3Igc3RhY2t0cmFjZSB0byBzdGRlcnIgYW5kIGV4aXRzIHdpdGggY29kZSAyLlxuICpcbiAqIFdoZW4gYSBob29rIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbjpcbiAqIC0gU3RhY2t0cmFjZSAod2l0aCBzb3VyY2VtYXBzIGlmIGF2YWlsYWJsZSkgaXMgb3V0cHV0IHRvIHN0ZGVyclxuICogLSBQcm9jZXNzIGV4aXRzIHdpdGggY29kZSAyIChCTE9DSylcbiAqIC0gTm8gSlNPTiBpcyBvdXRwdXQgdG8gc3Rkb3V0XG4gKiBAcGFyYW0gZXJyb3IgLSBUaGUgZXJyb3IgdGhyb3duIGJ5IHRoZSBoYW5kbGVyXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZUhhbmRsZXJFcnJvcihlcnJvcikge1xuICAgIC8vIFdyaXRlIHN0YWNrIHRyYWNlIHRvIHN0ZGVyciAoc291cmNlbWFwcyBhcmUgYXBwbGllZCBhdXRvbWF0aWNhbGx5IGJ5IE5vZGUuanMpXG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoYCR7ZXJyb3Iuc3RhY2sgPz8gZXJyb3IubWVzc2FnZX1cXG5gKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKGAke1N0cmluZyhlcnJvcil9XFxuYCk7XG4gICAgfVxuICAgIC8vIExvZyB0byBmaWxlIGlmIGNvbmZpZ3VyZWRcbiAgICBsb2dnZXIuZXJyb3IoYEhvb2sgaGFuZGxlciBlcnJvcjogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCk7XG4gICAgLy8gQ2xlYXIgbG9nZ2VyIGNvbnRleHQgYW5kIGNsb3NlXG4gICAgbG9nZ2VyLmNsZWFyQ29udGV4dCgpO1xuICAgIGxvZ2dlci5jbG9zZSgpO1xuICAgIC8vIEV4aXQgd2l0aCBjb2RlIDIgKEJMT0NLKSAtIG5vIEpTT04gb3V0cHV0XG4gICAgcHJvY2Vzcy5leGl0KEVYSVRfQ09ERVMuQkxPQ0spO1xufVxuLyoqXG4gKiBDb252ZXJ0cyBhIFNwZWNpZmljSG9va091dHB1dCB0byBIb29rT3V0cHV0IGZvciB3aXJlIGZvcm1hdC5cbiAqXG4gKiBTcGVjaWZpY0hvb2tPdXRwdXQgdHlwZXMgaGF2ZTogeyBfdHlwZSwgZXhpdENvZGUsIHN0ZG91dCwgc3RkZXJyPyB9XG4gKiBIb29rT3V0cHV0IGhhczogeyBleGl0Q29kZSwgc3Rkb3V0LCBzdGRlcnI/IH1cbiAqXG4gKiBTaW5jZSBvdXRwdXQgYnVpbGRlcnMgbm93IHByb2R1Y2Ugd2lyZS1mb3JtYXQgZGlyZWN0bHksIHRoaXMgZnVuY3Rpb25cbiAqIHNpbXBseSBzdHJpcHMgdGhlIGBfdHlwZWAgZGlzY3JpbWluYXRvciBmaWVsZC5cbiAqIEBwYXJhbSBzcGVjaWZpY091dHB1dCAtIFRoZSBzcGVjaWZpYyBvdXRwdXQgZnJvbSBhIGhvb2sgaGFuZGxlclxuICogQHJldHVybnMgSG9va091dHB1dCByZWFkeSBmb3Igc2VyaWFsaXphdGlvblxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI2hvb2stb3V0cHV0LXN0cnVjdHVyZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IHNwZWNpZmljT3V0cHV0ID0gcHJlVG9vbFVzZU91dHB1dCh7IGhvb2tTcGVjaWZpY091dHB1dDogeyBwZXJtaXNzaW9uRGVjaXNpb246ICdhbGxvdycgfSB9KTtcbiAqIGNvbnN0IGhvb2tPdXRwdXQgPSBjb252ZXJ0VG9Ib29rT3V0cHV0KHNwZWNpZmljT3V0cHV0KTtcbiAqIC8vIGhvb2tPdXRwdXQ6IHsgZXhpdENvZGU6IDAsIHN0ZG91dDogeyBob29rU3BlY2lmaWNPdXRwdXQ6IHsgLi4uIH0gfSB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRUb0hvb2tPdXRwdXQoc3BlY2lmaWNPdXRwdXQpIHtcbiAgICByZXR1cm4geyBzdGRvdXQ6IHNwZWNpZmljT3V0cHV0LnN0ZG91dCB9O1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRXhlY3V0ZSBGdW5jdGlvblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBFeGVjdXRlcyBhIGhvb2sgaGFuZGxlciB3aXRoIGZ1bGwgcnVudGltZSBvcmNoZXN0cmF0aW9uLlxuICpcbiAqIFRoaXMgaXMgdGhlIG1haW4gZW50cnkgcG9pbnQgdGhhdCBjb21waWxlZCBob29rcyB1c2UuIFdoZW4gYSBjb21waWxlZCBob29rXG4gKiBydW5zIGFzIGEgQ0xJOlxuICpcbiAqIDEuIFJlYWRzIGFsbCBzdGRpblxuICogMi4gUGFyc2VzIEpTT04gKHdpcmUgZm9ybWF0IHdpdGggc25ha2VfY2FzZSBwcm9wZXJ0aWVzKVxuICogMy4gU2V0cyB1cCBsb2dnZXIgY29udGV4dCAoaG9va1R5cGUsIGlucHV0KVxuICogNC4gQ2FsbHMgaGFuZGxlciB3aXRoIGlucHV0IGFuZCBjb250ZXh0IChsb2dnZXIpXG4gKiA1LiBIYW5kbGVzIGFueSBlcnJvcnMsIGxvZ3MgdGhlbVxuICogNi4gV3JpdGVzIEpTT04gdG8gc3Rkb3V0XG4gKiA3LiBDbG9zZXMgbG9nZ2VyXG4gKiA4LiBFeGl0cyB3aXRoIGFwcHJvcHJpYXRlIGNvZGVcbiAqIEBwYXJhbSBob29rRm4gLSBUaGUgaG9vayBmdW5jdGlvbiB0byBleGVjdXRlIChmcm9tIGhvb2sgZmFjdG9yeSlcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBJbiBjb21waWxlZCBob29rIGZpbGVcbiAqIGltcG9ydCB7IGV4ZWN1dGUgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MvcnVudGltZSc7XG4gKiBpbXBvcnQgeyBwcmVUb29sVXNlSG9vaywgcHJlVG9vbFVzZU91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogY29uc3QgbXlIb29rID0gcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnQmFzaCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdQcm9jZXNzaW5nIEJhc2ggY29tbWFuZCcpO1xuICogICByZXR1cm4gcHJlVG9vbFVzZU91dHB1dCh7IGFsbG93OiB0cnVlIH0pO1xuICogfSk7XG4gKlxuICogZXhlY3V0ZShteUhvb2spO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3NcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoaG9va0ZuKSB7XG4gICAgbGV0IG91dHB1dDtcbiAgICB0cnkge1xuICAgICAgICAvLyBDaGVjayBmb3IgbG9nIGZpbGUgY29uZmlndXJhdGlvbiBjb25mbGljdHNcbiAgICAgICAgLy8gQ0xBVURFX0NPREVfSE9PS1NfQ0xJX0xPR19GSUxFIGlzIGluamVjdGVkIGJ5IHRoZSBDTEkgLS1sb2cgcGFyYW1ldGVyXG4gICAgICAgIC8vIENMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFIGlzIHRoZSB1c2VyJ3MgZW52aXJvbm1lbnQgdmFyaWFibGVcbiAgICAgICAgY29uc3QgY2xpTG9nRmlsZSA9IHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0hPT0tTX0NMSV9MT0dfRklMRTtcbiAgICAgICAgY29uc3QgZW52TG9nRmlsZSA9IHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFO1xuICAgICAgICBpZiAoY2xpTG9nRmlsZSAhPT0gdW5kZWZpbmVkICYmIGVudkxvZ0ZpbGUgIT09IHVuZGVmaW5lZCAmJiBjbGlMb2dGaWxlICE9PSBlbnZMb2dGaWxlKSB7XG4gICAgICAgICAgICAvLyBXcml0ZSBlcnJvciB0byBzdGRlcnIgYW5kIGV4aXQgd2l0aCBlcnJvciBjb2RlXG4gICAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShgTG9nIGZpbGUgY29uZmlndXJhdGlvbiBjb25mbGljdDogQ0xJIC0tbG9nPVwiJHtjbGlMb2dGaWxlfVwiIHZzIENMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFPVwiJHtlbnZMb2dGaWxlfVwiLiBgICtcbiAgICAgICAgICAgICAgICBcIlVzZSBvbmx5IG9uZSBtZXRob2QgdG8gY29uZmlndXJlIGhvb2sgbG9nZ2luZy5cXG5cIik7XG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoRVhJVF9DT0RFUy5FUlJPUik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgQ0xJIGxvZyBmaWxlIGlzIHNldCwgY29uZmlndXJlIHRoZSBsb2dnZXJcbiAgICAgICAgaWYgKGNsaUxvZ0ZpbGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbG9nZ2VyLnNldExvZ0ZpbGUoY2xpTG9nRmlsZSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gUmVhZCBhbmQgcGFyc2Ugc3RkaW5cbiAgICAgICAgbGV0IHN0ZGluQ29udGVudDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHN0ZGluQ29udGVudCA9IGF3YWl0IHJlYWRTdGRpbigpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZ0Vycm9yKGVycm9yLCBcIkZhaWxlZCB0byByZWFkIHN0ZGluXCIpO1xuICAgICAgICAgICAgb3V0cHV0ID0gY3JlYXRlTWFsZm9ybWVkSW5wdXRPdXRwdXQoZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIFBhcnNlIGFuZCB0cmFuc2Zvcm0gaW5wdXRcbiAgICAgICAgbGV0IGlucHV0O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaW5wdXQgPSBwYXJzZVN0ZGluSW5wdXQoc3RkaW5Db250ZW50KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2dFcnJvcihlcnJvciwgXCJGYWlsZWQgdG8gcGFyc2Ugc3RkaW4gSlNPTlwiKTtcbiAgICAgICAgICAgIG91dHB1dCA9IGNyZWF0ZU1hbGZvcm1lZElucHV0T3V0cHV0KGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBTZXQgbG9nZ2VyIGNvbnRleHRcbiAgICAgICAgY29uc3QgaG9va0V2ZW50TmFtZSA9IGhvb2tGbi5ob29rRXZlbnROYW1lO1xuICAgICAgICBsb2dnZXIuc2V0Q29udGV4dChob29rRXZlbnROYW1lLCBpbnB1dCk7XG4gICAgICAgIC8vIEJ1aWxkIGNvbnRleHQgLSBTZXNzaW9uU3RhcnQgaG9va3MgZ2V0IGV4dGVuZGVkIGNvbnRleHQgd2l0aCBwZXJzaXN0RW52VmFyXG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSBob29rRXZlbnROYW1lID09PSBcIlNlc3Npb25TdGFydFwiID8geyBsb2dnZXIsIHBlcnNpc3RFbnZWYXIsIHBlcnNpc3RFbnZWYXJzIH0gOiB7IGxvZ2dlciB9O1xuICAgICAgICAvLyBFeGVjdXRlIGhhbmRsZXJcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNwZWNpZmljT3V0cHV0ID0gYXdhaXQgaG9va0ZuKGlucHV0LCBjb250ZXh0KTtcbiAgICAgICAgICAgIG91dHB1dCA9IGNvbnZlcnRUb0hvb2tPdXRwdXQoc3BlY2lmaWNPdXRwdXQpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgLy8gSGFuZGxlciB0aHJldyAtIG91dHB1dCBzdGFja3RyYWNlIHRvIHN0ZGVyciBhbmQgZXhpdCB3aXRoIGNvZGUgMlxuICAgICAgICAgICAgLy8gVGhpcyBjYWxsIG5ldmVyIHJldHVybnMgKHByb2Nlc3MuZXhpdClcbiAgICAgICAgICAgIGhhbmRsZUhhbmRsZXJFcnJvcihlcnJvcik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZmluYWxseSB7XG4gICAgICAgIC8vIFdyaXRlIG91dHB1dCBpZiB3ZSBoYXZlIGl0XG4gICAgICAgIGlmIChvdXRwdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgd3JpdGVTdGRvdXQob3V0cHV0LnN0ZG91dCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2xlYXIgbG9nZ2VyIGNvbnRleHRcbiAgICAgICAgbG9nZ2VyLmNsZWFyQ29udGV4dCgpO1xuICAgICAgICBsb2dnZXIuY2xvc2UoKTtcbiAgICAgICAgLy8gRXhpdCB3aXRoIHN1Y2Nlc3MgKGhhbmRsZXIgZXJyb3JzIGV4aXQgdmlhIGhhbmRsZUhhbmRsZXJFcnJvciB3aXRoIGNvZGUgMilcbiAgICAgICAgcHJvY2Vzcy5leGl0KEVYSVRfQ09ERVMuU1VDQ0VTUyk7XG4gICAgfVxufVxuIiwgIi8qKlxuICogU2tpbGwgVHJhY2tlciAtIFBvc3RUb29sVXNlIGhvb2sgdGhhdCByZWNvcmRzIFNraWxsIHRvb2wgaW52b2NhdGlvbnMuXG4gKlxuICogUmVjb3JkcyBlYWNoIGludm9rZWQgc2tpbGwgbmFtZSB0byBhIHNlc3Npb24tc2NvcGVkIGZpbGUgZm9yIGxhdGVyXG4gKiByZWxvYWQgYWZ0ZXIgY29udGV4dCBjb21wYWN0aW9uLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNwb3N0dG9vbHVzZVxuICovXG5cbmltcG9ydCB7IGFwcGVuZEZpbGVTeW5jLCBleGlzdHNTeW5jLCBta2RpclN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgZGlybmFtZSB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IHBvc3RUb29sVXNlSG9vaywgcG9zdFRvb2xVc2VPdXRwdXQgfSBmcm9tIFwiQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzXCI7XG5cbmludGVyZmFjZSBTa2lsbFRvb2xJbnB1dCB7XG4gIHNraWxsOiBzdHJpbmc7XG4gIGFyZ3M/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIGlzU2tpbGxUb29sSW5wdXQoaW5wdXQ6IHVua25vd24pOiBpbnB1dCBpcyBTa2lsbFRvb2xJbnB1dCB7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmXG4gICAgaW5wdXQgIT09IG51bGwgJiZcbiAgICBcInNraWxsXCIgaW4gaW5wdXQgJiZcbiAgICB0eXBlb2YgKGlucHV0IGFzIFNraWxsVG9vbElucHV0KS5za2lsbCA9PT0gXCJzdHJpbmdcIlxuICApO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIHBhdGggdG8gdGhlIHNraWxscyB0cmFja2luZyBmaWxlIGZvciBhIHNlc3Npb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRTa2lsbHNGaWxlUGF0aChzZXNzaW9uSWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgL3RtcC9jbGF1ZGVfc2tpbGxzXyR7c2Vzc2lvbklkfS50eHRgO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIHBhdGggdG8gdGhlIHJlbG9hZCBlbmFibGVtZW50IGZsYWcgZmlsZSBmb3IgYSBzZXNzaW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVsb2FkRmxhZ1BhdGgoc2Vzc2lvbklkOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYC90bXAvY2xhdWRlX3NraWxsc19yZWxvYWRfJHtzZXNzaW9uSWR9LmVuYWJsZWRgO1xufVxuXG5leHBvcnQgZGVmYXVsdCBwb3N0VG9vbFVzZUhvb2soeyBtYXRjaGVyOiBcIlNraWxsXCIgfSwgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gIGNvbnN0IHRvb2xJbnB1dCA9IGlucHV0LnRvb2xfaW5wdXQ7XG5cbiAgaWYgKCFpc1NraWxsVG9vbElucHV0KHRvb2xJbnB1dCkpIHtcbiAgICBsb2dnZXIuZGVidWcoXCJObyBza2lsbCBuYW1lIGZvdW5kIGluIHRvb2wgaW5wdXRcIik7XG4gICAgcmV0dXJuIHBvc3RUb29sVXNlT3V0cHV0KHt9KTtcbiAgfVxuXG4gIGNvbnN0IHNraWxsTmFtZSA9IHRvb2xJbnB1dC5za2lsbDtcbiAgY29uc3Qgc2tpbGxzRmlsZSA9IGdldFNraWxsc0ZpbGVQYXRoKGlucHV0LnNlc3Npb25faWQpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgZGlyID0gZGlybmFtZShza2lsbHNGaWxlKTtcbiAgICBpZiAoIWV4aXN0c1N5bmMoZGlyKSkge1xuICAgICAgbWtkaXJTeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIGFwcGVuZEZpbGVTeW5jKHNraWxsc0ZpbGUsIGAke3NraWxsTmFtZX1cXG5gLCBcInV0Zi04XCIpO1xuICAgIGxvZ2dlci5pbmZvKFwiVHJhY2tlZCBza2lsbCBpbnZvY2F0aW9uXCIsIHsgc2tpbGw6IHNraWxsTmFtZSwgZmlsZTogc2tpbGxzRmlsZSB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dnZXIud2FybihcIkZhaWxlZCB0byB0cmFjayBza2lsbFwiLCB7IHNraWxsOiBza2lsbE5hbWUsIGVycm9yOiBTdHJpbmcoZXJyb3IpIH0pO1xuICB9XG5cbiAgcmV0dXJuIHBvc3RUb29sVXNlT3V0cHV0KHt9KTtcbn0pO1xuIiwgIlxuaW1wb3J0IGhvb2sgZnJvbSAnL3dvcmtzcGFjZS9wYWNrYWdlcy9nb29kZm9vdC1ob29rcy9zcmMvc2tpbGwtcmVsb2FkZXIudHMnO1xuaW1wb3J0IHsgZXhlY3V0ZSB9IGZyb20gJy93b3Jrc3BhY2UvcGFja2FnZXMvY2xhdWRlLWNvZGUtaG9va3MvZGlzdC9ydW50aW1lLmpzJztcblxuZXhlY3V0ZShob29rKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFXQSxTQUFTLGNBQUFBLGFBQVksY0FBYyxZQUFZLHFCQUFxQjs7O0FDdUJwRSxZQUFZLFFBQVE7QUFNYixJQUFNLGtCQUFrQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLM0IsYUFBYTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1iLFVBQVU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS1YsUUFBUTtBQUNaO0FBa0NPLFNBQVMsaUJBQWlCO0FBQzdCLFNBQU8sUUFBUSxJQUFJLGdCQUFnQixRQUFRO0FBQy9DO0FBOENPLFNBQVMsY0FBYyxNQUFNLE9BQU87QUFDdkMsUUFBTSxVQUFVLGVBQWU7QUFDL0IsTUFBSSxZQUFZLFFBQVc7QUFDdkIsVUFBTSxJQUFJLE1BQU0sd0dBQTZHO0FBQUEsRUFDakk7QUFFQSxRQUFNLGVBQWUsaUJBQWlCLEtBQUs7QUFFM0MsUUFBTSxrQkFBa0IsVUFBVSxJQUFJLElBQUksWUFBWTtBQUFBO0FBQ3RELEVBQUcsa0JBQWUsU0FBUyxpQkFBaUIsT0FBTztBQUN2RDtBQWlCTyxTQUFTLGVBQWUsTUFBTTtBQUNqQyxhQUFXLENBQUMsTUFBTSxLQUFLLEtBQUssT0FBTyxRQUFRLElBQUksR0FBRztBQUM5QyxrQkFBYyxNQUFNLEtBQUs7QUFBQSxFQUM3QjtBQUNKO0FBVUEsU0FBUyxpQkFBaUIsT0FBTztBQUc3QixRQUFNLFVBQVUsTUFBTSxRQUFRLE1BQU0sT0FBTztBQUMzQyxTQUFPLElBQUksT0FBTztBQUN0Qjs7O0FDcEpBLFNBQVMsbUJBQW1CLGVBQWUsUUFBUSxTQUFTO0FBQ3hELFFBQU0sU0FBUyxPQUFP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QzVDLFNBQVMsT0FBTztBQUNkLElBQUFBLFFBQU8sS0FBSyw4QkFBOEIsRUFBRSxPQUFPLE9BQU8sS0FBSyxFQUFFLENBQUM7QUFDbEUsUUFBSTtBQUNGLGlCQUFXLGNBQWM7QUFBQSxJQUMzQixRQUFRO0FBQUEsSUFFUjtBQUNBLFdBQU8sbUJBQW1CLENBQUMsQ0FBQztBQUFBLEVBQzlCO0FBR0EsUUFBTSxTQUFTLENBQUMsR0FBRyxJQUFJLElBQUksUUFBUSxNQUFNLElBQUksRUFBRSxPQUFPLENBQUMsU0FBUyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFFN0UsTUFBSSxPQUFPLFdBQVcsR0FBRztBQUN2QixJQUFBQSxRQUFPLE1BQU0scUJBQXFCO0FBQ2xDLFFBQUk7QUFDRixpQkFBVyxjQUFjO0FBQUEsSUFDM0IsUUFBUTtBQUFBLElBRVI7QUFDQSxXQUFPLG1CQUFtQixDQUFDLENBQUM7QUFBQSxFQUM5QjtBQUdBLE1BQUk7QUFDRixlQUFXLGNBQWM7QUFBQSxFQUMzQixRQUFRO0FBQUEsRUFFUjtBQUVBLFFBQU0sWUFBWSxnQkFBZ0IsTUFBTTtBQUN4QyxFQUFBQSxRQUFPLEtBQUsscUNBQXFDLEVBQUUsUUFBUSxVQUFVLENBQUM7QUFFdEUsU0FBTyxtQkFBbUI7QUFBQSxJQUN4QixlQUFlLDZCQUE2QixTQUFTO0FBQUEsSUFDckQsb0JBQW9CO0FBQUEsTUFDbEIsbUJBQW1CLGNBQWMsU0FBUztBQUFBLElBQzVDO0FBQUEsRUFDRixDQUFDO0FBQ0gsQ0FBQzs7O0FPMUZELFFBQVEsc0JBQUk7IiwKICAibmFtZXMiOiBbImV4aXN0c1N5bmMiLCAiYXBwZW5kRmlsZVN5bmMiLCAiZXhpc3RzU3luYyIsICJta2RpclN5bmMiLCAiZGlybmFtZSIsICJsb2dnZXIiLCAiZGlybmFtZSIsICJleGlzdHNTeW5jIiwgIm1rZGlyU3luYyIsICJhcHBlbmRGaWxlU3luYyIsICJsb2dnZXIiLCAiZXhpc3RzU3luYyJdCn0K
