#!/usr/bin/env -S node --enable-source-maps
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
function sessionStartHook(config, handler) {
  return createHookFunction("SessionStart", config, handler);
}
function preCompactHook(config, handler) {
  return createHookFunction("PreCompact", config, handler);
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
function createSimpleOutputBuilder(hookType) {
  return (options = {}) => ({
    _type: hookType,
    stdout: options
  });
}
var sessionStartOutput = /* @__PURE__ */ createHookSpecificOutputBuilder("SessionStart");
var preCompactOutput = /* @__PURE__ */ createSimpleOutputBuilder("PreCompact");

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

// ../../node_modules/@isaacs/balanced-match/dist/esm/index.js
var balanced = (a, b, str) => {
  const ma = a instanceof RegExp ? maybeMatch(a, str) : a;
  const mb = b instanceof RegExp ? maybeMatch(b, str) : b;
  const r = ma !== null && mb != null && range(ma, mb, str);
  return r && {
    start: r[0],
    end: r[1],
    pre: str.slice(0, r[0]),
    body: str.slice(r[0] + ma.length, r[1]),
    post: str.slice(r[1] + mb.length)
  };
};
var maybeMatch = (reg, str) => {
  const m = str.match(reg);
  return m ? m[0] : null;
};
var range = (a, b, str) => {
  let begs, beg, left, right = void 0, result;
  let ai = str.indexOf(a);
  let bi = str.indexOf(b, ai + 1);
  let i = ai;
  if (ai >= 0 && bi > 0) {
    if (a === b) {
      return [ai, bi];
    }
    begs = [];
    left = str.length;
    while (i >= 0 && !result) {
      if (i === ai) {
        begs.push(i);
        ai = str.indexOf(a, i + 1);
      } else if (begs.length === 1) {
        const r = begs.pop();
        if (r !== void 0)
          result = [r, bi];
      } else {
        beg = begs.pop();
        if (beg !== void 0 && beg < left) {
          left = beg;
          right = bi;
        }
        bi = str.indexOf(b, i + 1);
      }
      i = ai < bi && ai >= 0 ? ai : bi;
    }
    if (begs.length && right !== void 0) {
      result = [left, right];
    }
  }
  return result;
};

// ../../node_modules/@isaacs/brace-expansion/dist/esm/index.js
var escSlash = "\0SLASH" + Math.random() + "\0";
var escOpen = "\0OPEN" + Math.random() + "\0";
var escClose = "\0CLOSE" + Math.random() + "\0";
var escComma = "\0COMMA" + Math.random() + "\0";
var escPeriod = "\0PERIOD" + Math.random() + "\0";
var escSlashPattern = new RegExp(escSlash, "g");
var escOpenPattern = new RegExp(escOpen, "g");
var escClosePattern = new RegExp(escClose, "g");
var escCommaPattern = new RegExp(escComma, "g");
var escPeriodPattern = new RegExp(escPeriod, "g");
var slashPattern = /\\\\/g;
var openPattern = /\\{/g;
var closePattern = /\\}/g;
var commaPattern = /\\,/g;
var periodPattern = /\\./g;
function numeric(str) {
  return !isNaN(str) ? parseInt(str, 10) : str.charCodeAt(0);
}
function escapeBraces(str) {
  return str.replace(slashPattern, escSlash).replace(openPattern, escOpen).replace(closePattern, escClose).replace(commaPattern, escComma).replace(periodPattern, escPeriod);
}
function unescapeBraces(str) {
  return str.replace(escSlashPattern, "\\").replace(escOpenPattern, "{").replace(escClosePattern, "}").replace(escCommaPattern, ",").replace(escPeriodPattern, ".");
}
function parseCommaParts(str) {
  if (!str) {
    return [""];
  }
  const parts = [];
  const m = balanced("{", "}", str);
  if (!m) {
    return str.split(",");
  }
  const { pre, body, post } = m;
  const p = pre.split(",");
  p[p.length - 1] += "{" + body + "}";
  const postParts = parseCommaParts(post);
  if (post.length) {
    ;
    p[p.length - 1] += postParts.shift();
    p.push.apply(p, postParts);
  }
  parts.push.apply(parts, p);
  return parts;
}
function expand(str) {
  if (!str) {
    return [];
  }
  if (str.slice(0, 2) === "{}") {
    str = "\\{\\}" + str.slice(2);
  }
  return expand_(escapeBraces(str), true).map(unescapeBraces);
}
function embrace(str) {
  return "{" + str + "}";
}
function isPadded(el) {
  return /^-?0\d/.test(el);
}
function lte(i, y) {
  return i <= y;
}
function gte(i, y) {
  return i >= y;
}
function expand_(str, isTop) {
  const expansions = [];
  const m = balanced("{", "}", str);
  if (!m)
    return [str];
  const pre = m.pre;
  const post = m.post.length ? expand_(m.post, false) : [""];
  if (/\$$/.test(m.pre)) {
    for (let k = 0; k < post.length; k++) {
      const expansion = pre + "{" + m.body + "}" + post[k];
      expansions.push(expansion);
    }
  } else {
    const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
    const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
    const isSequence = isNumericSequence || isAlphaSequence;
    const isOptions = m.body.indexOf(",") >= 0;
    if (!isSequence && !isOptions) {
      if (m.post.match(/,(?!,).*\}/)) {
        str = m.pre + "{" + m.body + escClose + m.post;
        return expand_(str);
      }
      return [str];
    }
    let n;
    if (isSequence) {
      n = m.body.split(/\.\./);
    } else {
      n = parseCommaParts(m.body);
      if (n.length === 1 && n[0] !== void 0) {
        n = expand_(n[0], false).map(embrace);
        if (n.length === 1) {
          return post.map((p) => m.pre + n[0] + p);
        }
      }
    }
    let N;
    if (isSequence && n[0] !== void 0 && n[1] !== void 0) {
      const x = numeric(n[0]);
      const y = numeric(n[1]);
      const width = Math.max(n[0].length, n[1].length);
      let incr = n.length === 3 && n[2] !== void 0 ? Math.abs(numeric(n[2])) : 1;
      let test = lte;
      const reverse = y < x;
      if (reverse) {
        incr *= -1;
        test = gte;
      }
      const pad = n.some(isPadded);
      N = [];
      for (let i = x; test(i, y); i += incr) {
        let c;
        if (isAlphaSequence) {
          c = String.fromCharCode(i);
          if (c === "\\") {
            c = "";
          }
        } else {
          c = String(i);
          if (pad) {
            const need = width - c.length;
            if (need > 0) {
              const z = new Array(need + 1).join("0");
              if (i < 0) {
                c = "-" + z + c.slice(1);
              } else {
                c = z + c;
              }
            }
          }
        }
        N.push(c);
      }
    } else {
      N = [];
      for (let j = 0; j < n.length; j++) {
        N.push.apply(N, expand_(n[j], false));
      }
    }
    for (let j = 0; j < N.length; j++) {
      for (let k = 0; k < post.length; k++) {
        const expansion = pre + N[j] + post[k];
        if (!isTop || isSequence || expansion) {
          expansions.push(expansion);
        }
      }
    }
  }
  return expansions;
}

// ../../node_modules/glob/node_modules/minimatch/dist/esm/assert-valid-pattern.js
var MAX_PATTERN_LENGTH = 1024 * 64;
var assertValidPattern = (pattern) => {
  if (typeof pattern !== "string") {
    throw new TypeError("invalid pattern");
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new TypeError("pattern is too long");
  }
};

// ../../node_modules/glob/node_modules/minimatch/dist/esm/brace-expressions.js
var posixClasses = {
  "[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true],
  "[:alpha:]": ["\\p{L}\\p{Nl}", true],
  "[:ascii:]": ["\\x00-\\x7f", false],
  "[:blank:]": ["\\p{Zs}\\t", true],
  "[:cntrl:]": ["\\p{Cc}", true],
  "[:digit:]": ["\\p{Nd}", true],
  "[:graph:]": ["\\p{Z}\\p{C}", true, true],
  "[:lower:]": ["\\p{Ll}", true],
  "[:print:]": ["\\p{C}", true],
  "[:punct:]": ["\\p{P}", true],
  "[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true],
  "[:upper:]": ["\\p{Lu}", true],
  "[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true],
  "[:xdigit:]": ["A-Fa-f0-9", false]
};
var braceEscape = (s) => s.replace(/[[\]\\-]/g, "\\$&");
var regexpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var rangesToString = (ranges) => ranges.join("");
var parseClass = (glob2, position) => {
  const pos = position;
  if (glob2.charAt(pos) !== "[") {
    throw new Error("not in a brace expression");
  }
  const ranges = [];
  const negs = [];
  let i = pos + 1;
  let sawStart = false;
  let uflag = false;
  let escaping = false;
  let negate = false;
  let endPos = pos;
  let rangeStart = "";
  WHILE: while (i < glob2.length) {
    const c = glob2.charAt(i);
    if ((c === "!" || c === "^") && i === pos + 1) {
      negate = true;
      i++;
      continue;
    }
    if (c === "]" && sawStart && !escaping) {
      endPos = i + 1;
      break;
    }
    sawStart = true;
    if (c === "\\") {
      if (!escaping) {
        escaping = true;
        i++;
        continue;
      }
    }
    if (c === "[" && !escaping) {
      for (const [cls, [unip, u, neg]] of Object.entries(posixClasses)) {
        if (glob2.startsWith(cls, i)) {
          if (rangeStart) {
            return ["$.", false, glob2.length - pos, true];
          }
          i += cls.length;
          if (neg)
            negs.push(unip);
          else
            ranges.push(unip);
          uflag = uflag || u;
          continue WHILE;
        }
      }
    }
    escaping = false;
    if (rangeStart) {
      if (c > rangeStart) {
        ranges.push(braceEscape(rangeStart) + "-" + braceEscape(c));
      } else if (c === rangeStart) {
        ranges.push(braceEscape(c));
      }
      rangeStart = "";
      i++;
      continue;
    }
    if (glob2.startsWith("-]", i + 1)) {
      ranges.push(braceEscape(c + "-"));
      i += 2;
      continue;
    }
    if (glob2.startsWith("-", i + 1)) {
      rangeStart = c;
      i += 2;
      continue;
    }
    ranges.push(braceEscape(c));
    i++;
  }
  if (endPos < i) {
    return ["", false, 0, false];
  }
  if (!ranges.length && !negs.length) {
    return ["$.", false, glob2.length - pos, true];
  }
  if (negs.length === 0 && ranges.length === 1 && /^\\?.$/.test(ranges[0]) && !negate) {
    const r = ranges[0].length === 2 ? ranges[0].slice(-1) : ranges[0];
    return [regexpEscape(r), false, endPos - pos, false];
  }
  const sranges = "[" + (negate ? "^" : "") + rangesToString(ranges) + "]";
  const snegs = "[" + (negate ? "" : "^") + rangesToString(negs) + "]";
  const comb = ranges.length && negs.length ? "(" + sranges + "|" + snegs + ")" : ranges.length ? sranges : snegs;
  return [comb, uflag, endPos - pos, true];
};

// ../../node_modules/glob/node_modules/minimatch/dist/esm/unescape.js
var unescape = (s, { windowsPathsNoEscape = false, magicalBraces = true } = {}) => {
  if (magicalBraces) {
    return windowsPathsNoEscape ? s.replace(/\[([^\/\\])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\])\]/g, "$1$2").replace(/\\([^\/])/g, "$1");
  }
  return windowsPathsNoEscape ? s.replace(/\[([^\/\\{}])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\{}])\]/g, "$1$2").replace(/\\([^\/{}])/g, "$1");
};

// ../../node_modules/glob/node_modules/minimatch/dist/esm/ast.js
var types = /* @__PURE__ */ new Set(["!", "?", "+", "*", "@"]);
var isExtglobType = (c) => types.has(c);
var startNoTraversal = "(?!(?:^|/)\\.\\.?(?:$|/))";
var startNoDot = "(?!\\.)";
var addPatternStart = /* @__PURE__ */ new Set(["[", "."]);
var justDots = /* @__PURE__ */ new Set(["..", "."]);
var reSpecials = new Set("().*{}+?[]^$\\!");
var regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var qmark = "[^/]";
var star = qmark + "*?";
var starNoEmpty = qmark + "+?";
var AST = class _AST {
  type;
  #root;
  #hasMagic;
  #uflag = false;
  #parts = [];
  #parent;
  #parentIndex;
  #negs;
  #filledNegs = false;
  #options;
  #toString;
  // set to true if it's an extglob with no children
  // (which really means one child of '')
  #emptyExt = false;
  constructor(type, parent, options = {}) {
    this.type = type;
    if (type)
      this.#hasMagic = true;
    this.#parent = parent;
    this.#root = this.#parent ? this.#parent.#root : this;
    this.#options = this.#root === this ? options : this.#root.#options;
    this.#negs = this.#root === this ? [] : this.#root.#negs;
    if (type === "!" && !this.#root.#filledNegs)
      this.#negs.push(this);
    this.#parentIndex = this.#parent ? this.#parent.#parts.length : 0;
  }
  get hasMagic() {
    if (this.#hasMagic !== void 0)
      return this.#hasMagic;
    for (const p of this.#parts) {
      if (typeof p === "string")
        continue;
      if (p.type || p.hasMagic)
        return this.#hasMagic = true;
    }
    return this.#hasMagic;
  }
  // reconstructs the pattern
  toString() {
    if (this.#toString !== void 0)
      return this.#toString;
    if (!this.type) {
      return this.#toString = this.#parts.map((p) => String(p)).join("");
    } else {
      return this.#toString = this.type + "(" + this.#parts.map((p) => String(p)).join("|") + ")";
    }
  }
  #fillNegs() {
    if (this !== this.#root)
      throw new Error("should only call on root");
    if (this.#filledNegs)
      return this;
    this.toString();
    this.#filledNegs = true;
    let n;
    while (n = this.#negs.pop()) {
      if (n.type !== "!")
        continue;
      let p = n;
      let pp = p.#parent;
      while (pp) {
        for (let i = p.#parentIndex + 1; !pp.type && i < pp.#parts.length; i++) {
          for (const part of n.#parts) {
            if (typeof part === "string") {
              throw new Error("string part in extglob AST??");
            }
            part.copyIn(pp.#parts[i]);
          }
        }
        p = pp;
        pp = p.#parent;
      }
    }
    return this;
  }
  push(...parts) {
    for (const p of parts) {
      if (p === "")
        continue;
      if (typeof p !== "string" && !(p instanceof _AST && p.#parent === this)) {
        throw new Error("invalid part: " + p);
      }
      this.#parts.push(p);
    }
  }
  toJSON() {
    const ret = this.type === null ? this.#parts.slice().map((p) => typeof p === "string" ? p : p.toJSON()) : [this.type, ...this.#parts.map((p) => p.toJSON())];
    if (this.isStart() && !this.type)
      ret.unshift([]);
    if (this.isEnd() && (this === this.#root || this.#root.#filledNegs && this.#parent?.type === "!")) {
      ret.push({});
    }
    return ret;
  }
  isStart() {
    if (this.#root === this)
      return true;
    if (!this.#parent?.isStart())
      return false;
    if (this.#parentIndex === 0)
      return true;
    const p = this.#parent;
    for (let i = 0; i < this.#parentIndex; i++) {
      const pp = p.#parts[i];
      if (!(pp instanceof _AST && pp.type === "!")) {
        return false;
      }
    }
    return true;
  }
  isEnd() {
    if (this.#root === this)
      return true;
    if (this.#parent?.type === "!")
      return true;
    if (!this.#parent?.isEnd())
      return false;
    if (!this.type)
      return this.#parent?.isEnd();
    const pl = this.#parent ? this.#parent.#parts.length : 0;
    return this.#parentIndex === pl - 1;
  }
  copyIn(part) {
    if (typeof part === "string")
      this.push(part);
    else
      this.push(part.clone(this));
  }
  clone(parent) {
    const c = new _AST(this.type, parent);
    for (const p of this.#parts) {
      c.copyIn(p);
    }
    return c;
  }
  static #parseAST(str, ast, pos, opt) {
    let escaping = false;
    let inBrace = false;
    let braceStart = -1;
    let braceNeg = false;
    if (ast.type === null) {
      let i2 = pos;
      let acc2 = "";
      while (i2 < str.length) {
        const c = str.charAt(i2++);
        if (escaping || c === "\\") {
          escaping = !escaping;
          acc2 += c;
          continue;
        }
        if (inBrace) {
          if (i2 === braceStart + 1) {
            if (c === "^" || c === "!") {
              braceNeg = true;
            }
          } else if (c === "]" && !(i2 === braceStart + 2 && braceNeg)) {
            inBrace = false;
          }
          acc2 += c;
          continue;
        } else if (c === "[") {
          inBrace = true;
          braceStart = i2;
          braceNeg = false;
          acc2 += c;
          continue;
        }
        if (!opt.noext && isExtglobType(c) && str.charAt(i2) === "(") {
          ast.push(acc2);
          acc2 = "";
          const ext2 = new _AST(c, ast);
          i2 = _AST.#parseAST(str, ext2, i2, opt);
          ast.push(ext2);
          continue;
        }
        acc2 += c;
      }
      ast.push(acc2);
      return i2;
    }
    let i = pos + 1;
    let part = new _AST(null, ast);
    const parts = [];
    let acc = "";
    while (i < str.length) {
      const c = str.charAt(i++);
      if (escaping || c === "\\") {
        escaping = !escaping;
        acc += c;
        continue;
      }
      if (inBrace) {
        if (i === braceStart + 1) {
          if (c === "^" || c === "!") {
            braceNeg = true;
          }
        } else if (c === "]" && !(i === braceStart + 2 && braceNeg)) {
          inBrace = false;
        }
        acc += c;
        continue;
      } else if (c === "[") {
        inBrace = true;
        braceStart = i;
        braceNeg = false;
        acc += c;
        continue;
      }
      if (isExtglobType(c) && str.charAt(i) === "(") {
        part.push(acc);
        acc = "";
        const ext2 = new _AST(c, part);
        part.push(ext2);
        i = _AST.#parseAST(str, ext2, i, opt);
        continue;
      }
      if (c === "|") {
        part.push(acc);
        acc = "";
        parts.push(part);
        part = new _AST(null, ast);
        continue;
      }
      if (c === ")") {
        if (acc === "" && ast.#parts.length === 0) {
          ast.#emptyExt = true;
        }
        part.push(acc);
        acc = "";
        ast.push(...parts, part);
        return i;
      }
      acc += c;
    }
    ast.type = null;
    ast.#hasMagic = void 0;
    ast.#parts = [str.substring(pos - 1)];
    return i;
  }
  static fromGlob(pattern, options = {}) {
    const ast = new _AST(null, void 0, options);
    _AST.#parseAST(pattern, ast, 0, options);
    return ast;
  }
  // returns the regular expression if there's magic, or the unescaped
  // string if not.
  toMMPattern() {
    if (this !== this.#root)
      return this.#root.toMMPattern();
    const glob2 = this.toString();
    const [re, body, hasMagic2, uflag] = this.toRegExpSource();
    const anyMagic = hasMagic2 || this.#hasMagic || this.#options.nocase && !this.#options.nocaseMagicOnly && glob2.toUpperCase() !== glob2.toLowerCase();
    if (!anyMagic) {
      return body;
    }
    const flags = (this.#options.nocase ? "i" : "") + (uflag ? "u" : "");
    return Object.assign(new RegExp(`^${re}$`, flags), {
      _src: re,
      _glob: glob2
    });
  }
  get options() {
    return this.#options;
  }
  // returns the string match, the regexp source, whether there's magic
  // in the regexp (so a regular expression is required) and whether or
  // not the uflag is needed for the regular expression (for posix classes)
  // TODO: instead of injecting the start/end at this point, just return
  // the BODY of the regexp, along with the start/end portions suitable
  // for binding the start/end in either a joined full-path makeRe context
  // (where we bind to (^|/), or a standalone matchPart context (where
  // we bind to ^, and not /).  Otherwise slashes get duped!
  //
  // In part-matching mode, the start is:
  // - if not isStart: nothing
  // - if traversal possible, but not allowed: ^(?!\.\.?$)
  // - if dots allowed or not possible: ^
  // - if dots possible and not allowed: ^(?!\.)
  // end is:
  // - if not isEnd(): nothing
  // - else: $
  //
  // In full-path matching mode, we put the slash at the START of the
  // pattern, so start is:
  // - if first pattern: same as part-matching mode
  // - if not isStart(): nothing
  // - if traversal possible, but not allowed: /(?!\.\.?(?:$|/))
  // - if dots allowed or not possible: /
  // - if dots possible and not allowed: /(?!\.)
  // end is:
  // - if last pattern, same as part-matching mode
  // - else nothing
  //
  // Always put the (?:$|/) on negated tails, though, because that has to be
  // there to bind the end of the negated pattern portion, and it's easier to
  // just stick it in now rather than try to inject it later in the middle of
  // the pattern.
  //
  // We can just always return the same end, and leave it up to the caller
  // to know whether it's going to be used joined or in parts.
  // And, if the start is adjusted slightly, can do the same there:
  // - if not isStart: nothing
  // - if traversal possible, but not allowed: (?:/|^)(?!\.\.?$)
  // - if dots allowed or not possible: (?:/|^)
  // - if dots possible and not allowed: (?:/|^)(?!\.)
  //
  // But it's better to have a simpler binding without a conditional, for
  // performance, so probably better to return both start options.
  //
  // Then the caller just ignores the end if it's not the first pattern,
  // and the start always gets applied.
  //
  // But that's always going to be $ if it's the ending pattern, or nothing,
  // so the caller can just attach $ at the end of the pattern when building.
  //
  // So the todo is:
  // - better detect what kind of start is needed
  // - return both flavors of starting pattern
  // - attach $ at the end of the pattern when creating the actual RegExp
  //
  // Ah, but wait, no, that all only applies to the root when the first pattern
  // is not an extglob. If the first pattern IS an extglob, then we need all
  // that dot prevention biz to live in the extglob portions, because eg
  // +(*|.x*) can match .xy but not .yx.
  //
  // So, return the two flavors if it's #root and the first child is not an
  // AST, otherwise leave it to the child AST to handle it, and there,
  // use the (?:^|/) style of start binding.
  //
  // Even simplified further:
  // - Since the start for a join is eg /(?!\.) and the start for a part
  // is ^(?!\.), we can just prepend (?!\.) to the pattern (either root
  // or start or whatever) and prepend ^ or / at the Regexp construction.
  toRegExpSource(allowDot) {
    const dot = allowDot ?? !!this.#options.dot;
    if (this.#root === this)
      this.#fillNegs();
    if (!this.type) {
      const noEmpty = this.isStart() && this.isEnd() && !this.#parts.some((s) => typeof s !== "string");
      const src = this.#parts.map((p) => {
        const [re, _, hasMagic2, uflag] = typeof p === "string" ? _AST.#parseGlob(p, this.#hasMagic, noEmpty) : p.toRegExpSource(allowDot);
        this.#hasMagic = this.#hasMagic || hasMagic2;
        this.#uflag = this.#uflag || uflag;
        return re;
      }).join("");
      let start2 = "";
      if (this.isStart()) {
        if (typeof this.#parts[0] === "string") {
          const dotTravAllowed = this.#parts.length === 1 && justDots.has(this.#parts[0]);
          if (!dotTravAllowed) {
            const aps = addPatternStart;
            const needNoTrav = (
              // dots are allowed, and the pattern starts with [ or .
              dot && aps.has(src.charAt(0)) || // the pattern starts with \., and then [ or .
              src.startsWith("\\.") && aps.has(src.charAt(2)) || // the pattern starts with \.\., and then [ or .
              src.startsWith("\\.\\.") && aps.has(src.charAt(4))
            );
            const needNoDot = !dot && !allowDot && aps.has(src.charAt(0));
            start2 = needNoTrav ? startNoTraversal : needNoDot ? startNoDot : "";
          }
        }
      }
      let end = "";
      if (this.isEnd() && this.#root.#filledNegs && this.#parent?.type === "!") {
        end = "(?:$|\\/)";
      }
      const final2 = start2 + src + end;
      return [
        final2,
        unescape(src),
        this.#hasMagic = !!this.#hasMagic,
        this.#uflag
      ];
    }
    const repeated = this.type === "*" || this.type === "+";
    const start = this.type === "!" ? "(?:(?!(?:" : "(?:";
    let body = this.#partsToRegExp(dot);
    if (this.isStart() && this.isEnd() && !body && this.type !== "!") {
      const s = this.toString();
      this.#parts = [s];
      this.type = null;
      this.#hasMagic = void 0;
      return [s, unescape(this.toString()), false, false];
    }
    let bodyDotAllowed = !repeated || allowDot || dot || !startNoDot ? "" : this.#partsToRegExp(true);
    if (bodyDotAllowed === body) {
      bodyDotAllowed = "";
    }
    if (bodyDotAllowed) {
      body = `(?:${body})(?:${bodyDotAllowed})*?`;
    }
    let final = "";
    if (this.type === "!" && this.#emptyExt) {
      final = (this.isStart() && !dot ? startNoDot : "") + starNoEmpty;
    } else {
      const close = this.type === "!" ? (
        // !() must match something,but !(x) can match ''
        "))" + (this.isStart() && !dot && !allowDot ? startNoDot : "") + star + ")"
      ) : this.type === "@" ? ")" : this.type === "?" ? ")?" : this.type === "+" && bodyDotAllowed ? ")" : this.type === "*" && bodyDotAllowed ? `)?` : `)${this.type}`;
      final = start + body + close;
    }
    return [
      final,
      unescape(body),
      this.#hasMagic = !!this.#hasMagic,
      this.#uflag
    ];
  }
  #partsToRegExp(dot) {
    return this.#parts.map((p) => {
      if (typeof p === "string") {
        throw new Error("string type in extglob ast??");
      }
      const [re, _, _hasMagic, uflag] = p.toRegExpSource(dot);
      this.#uflag = this.#uflag || uflag;
      return re;
    }).filter((p) => !(this.isStart() && this.isEnd()) || !!p).join("|");
  }
  static #parseGlob(glob2, hasMagic2, noEmpty = false) {
    let escaping = false;
    let re = "";
    let uflag = false;
    for (let i = 0; i < glob2.length; i++) {
      const c = glob2.charAt(i);
      if (escaping) {
        escaping = false;
        re += (reSpecials.has(c) ? "\\" : "") + c;
        continue;
      }
      if (c === "\\") {
        if (i === glob2.length - 1) {
          re += "\\\\";
        } else {
          escaping = true;
        }
        continue;
      }
      if (c === "[") {
        const [src, needUflag, consumed, magic] = parseClass(glob2, i);
        if (consumed) {
          re += src;
          uflag = uflag || needUflag;
          i += consumed - 1;
          hasMagic2 = hasMagic2 || magic;
          continue;
        }
      }
      if (c === "*") {
        re += noEmpty && glob2 === "*" ? starNoEmpty : star;
        hasMagic2 = true;
        continue;
      }
      if (c === "?") {
        re += qmark;
        hasMagic2 = true;
        continue;
      }
      re += regExpEscape(c);
    }
    return [re, unescape(glob2), !!hasMagic2, uflag];
  }
};

// ../../node_modules/glob/node_modules/minimatch/dist/esm/escape.js
var escape = (s, { windowsPathsNoEscape = false, magicalBraces = false } = {}) => {
  if (magicalBraces) {
    return windowsPathsNoEscape ? s.replace(/[?*()[\]{}]/g, "[$&]") : s.replace(/[?*()[\]\\{}]/g, "\\$&");
  }
  return windowsPathsNoEscape ? s.replace(/[?*()[\]]/g, "[$&]") : s.replace(/[?*()[\]\\]/g, "\\$&");
};

// ../../node_modules/glob/node_modules/minimatch/dist/esm/index.js
var minimatch = (p, pattern, options = {}) => {
  assertValidPattern(pattern);
  if (!options.nocomment && pattern.charAt(0) === "#") {
    return false;
  }
  return new Minimatch(pattern, options).match(p);
};
var starDotExtRE = /^\*+([^+@!?\*\[\(]*)$/;
var starDotExtTest = (ext2) => (f) => !f.startsWith(".") && f.endsWith(ext2);
var starDotExtTestDot = (ext2) => (f) => f.endsWith(ext2);
var starDotExtTestNocase = (ext2) => {
  ext2 = ext2.toLowerCase();
  return (f) => !f.startsWith(".") && f.toLowerCase().endsWith(ext2);
};
var starDotExtTestNocaseDot = (ext2) => {
  ext2 = ext2.toLowerCase();
  return (f) => f.toLowerCase().endsWith(ext2);
};
var starDotStarRE = /^\*+\.\*+$/;
var starDotStarTest = (f) => !f.startsWith(".") && f.includes(".");
var starDotStarTestDot = (f) => f !== "." && f !== ".." && f.includes(".");
var dotStarRE = /^\.\*+$/;
var dotStarTest = (f) => f !== "." && f !== ".." && f.startsWith(".");
var starRE = /^\*+$/;
var starTest = (f) => f.length !== 0 && !f.startsWith(".");
var starTestDot = (f) => f.length !== 0 && f !== "." && f !== "..";
var qmarksRE = /^\?+([^+@!?\*\[\(]*)?$/;
var qmarksTestNocase = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  if (!ext2)
    return noext;
  ext2 = ext2.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext2);
};
var qmarksTestNocaseDot = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  if (!ext2)
    return noext;
  ext2 = ext2.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext2);
};
var qmarksTestDot = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  return !ext2 ? noext : (f) => noext(f) && f.endsWith(ext2);
};
var qmarksTest = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  return !ext2 ? noext : (f) => noext(f) && f.endsWith(ext2);
};
var qmarksTestNoExt = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && !f.startsWith(".");
};
var qmarksTestNoExtDot = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && f !== "." && f !== "..";
};
var defaultPlatform = typeof process === "object" && process ? typeof process.env === "object" && process.env && process.env.__MINIMATCH_TESTING_PLATFORM__ || process.platform : "posix";
var path = {
  win32: { sep: "\\" },
  posix: { sep: "/" }
};
var sep = defaultPlatform === "win32" ? path.win32.sep : path.posix.sep;
minimatch.sep = sep;
var GLOBSTAR = Symbol("globstar **");
minimatch.GLOBSTAR = GLOBSTAR;
var qmark2 = "[^/]";
var star2 = qmark2 + "*?";
var twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";
var twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";
var filter = (pattern, options = {}) => (p) => minimatch(p, pattern, options);
minimatch.filter = filter;
var ext = (a, b = {}) => Object.assign({}, a, b);
var defaults = (def) => {
  if (!def || typeof def !== "object" || !Object.keys(def).length) {
    return minimatch;
  }
  const orig = minimatch;
  const m = (p, pattern, options = {}) => orig(p, pattern, ext(def, options));
  return Object.assign(m, {
    Minimatch: class Minimatch extends orig.Minimatch {
      constructor(pattern, options = {}) {
        super(pattern, ext(def, options));
      }
      static defaults(options) {
        return orig.defaults(ext(def, options)).Minimatch;
      }
    },
    AST: class AST extends orig.AST {
      /* c8 ignore start */
      constructor(type, parent, options = {}) {
        super(type, parent, ext(def, options));
      }
      /* c8 ignore stop */
      static fromGlob(pattern, options = {}) {
        return orig.AST.fromGlob(pattern, ext(def, options));
      }
    },
    unescape: (s, options = {}) => orig.unescape(s, ext(def, options)),
    escape: (s, options = {}) => orig.escape(s, ext(def, options)),
    filter: (pattern, options = {}) => orig.filter(pattern, ext(def, options)),
    defaults: (options) => orig.defaults(ext(def, options)),
    makeRe: (pattern, options = {}) => orig.makeRe(pattern, ext(def, options)),
    braceExpand: (pattern, options = {}) => orig.braceExpand(pattern, ext(def, options)),
    match: (list, pattern, options = {}) => orig.match(list, pattern, ext(def, options)),
    sep: orig.sep,
    GLOBSTAR
  });
};
minimatch.defaults = defaults;
var braceExpand = (pattern, options = {}) => {
  assertValidPattern(pattern);
  if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
    return [pattern];
  }
  return expand(pattern);
};
minimatch.braceExpand = braceExpand;
var makeRe = (pattern, options = {}) => new Minimatch(pattern, options).makeRe();
minimatch.makeRe = makeRe;
var match = (list, pattern, options = {}) => {
  const mm = new Minimatch(pattern, options);
  list = list.filter((f) => mm.match(f));
  if (mm.options.nonull && !list.length) {
    list.push(pattern);
  }
  return list;
};
minimatch.match = match;
var globMagic = /[?*]|[+@!]\(.*?\)|\[|\]/;
var regExpEscape2 = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var Minimatch = class {
  options;
  set;
  pattern;
  windowsPathsNoEscape;
  nonegate;
  negate;
  comment;
  empty;
  preserveMultipleSlashes;
  partial;
  globSet;
  globParts;
  nocase;
  isWindows;
  platform;
  windowsNoMagicRoot;
  regexp;
  constructor(pattern, options = {}) {
    assertValidPattern(pattern);
    options = options || {};
    this.options = options;
    this.pattern = pattern;
    this.platform = options.platform || defaultPlatform;
    this.isWindows = this.platform === "win32";
    this.windowsPathsNoEscape = !!options.windowsPathsNoEscape || options.allowWindowsEscape === false;
    if (this.windowsPathsNoEscape) {
      this.pattern = this.pattern.replace(/\\/g, "/");
    }
    this.preserveMultipleSlashes = !!options.preserveMultipleSlashes;
    this.regexp = null;
    this.negate = false;
    this.nonegate = !!options.nonegate;
    this.comment = false;
    this.empty = false;
    this.partial = !!options.partial;
    this.nocase = !!this.options.nocase;
    this.windowsNoMagicRoot = options.windowsNoMagicRoot !== void 0 ? options.windowsNoMagicRoot : !!(this.isWindows && this.nocase);
    this.globSet = [];
    this.globParts = [];
    this.set = [];
    this.make();
  }
  hasMagic() {
    if (this.options.magicalBraces && this.set.length > 1) {
      return true;
    }
    for (const pattern of this.set) {
      for (const part of pattern) {
        if (typeof part !== "string")
          return true;
      }
    }
    return false;
  }
  debug(..._) {
  }
  make() {
    const pattern = this.pattern;
    const options = this.options;
    if (!options.nocomment && pattern.charAt(0) === "#") {
      this.comment = true;
      return;
    }
    if (!pattern) {
      this.empty = true;
      return;
    }
    this.parseNegate();
    this.globSet = [...new Set(this.braceExpand())];
    if (options.debug) {
      this.debug = (...args) => console.error(...args);
    }
    this.debug(this.pattern, this.globSet);
    const rawGlobParts = this.globSet.map((s) => this.slashSplit(s));
    this.globParts = this.preprocess(rawGlobParts);
    this.debug(this.pattern, this.globParts);
    let set = this.globParts.map((s, _, __) => {
      if (this.isWindows && this.windowsNoMagicRoot) {
        const isUNC = s[0] === "" && s[1] === "" && (s[2] === "?" || !globMagic.test(s[2])) && !globMagic.test(s[3]);
        const isDrive = /^[a-z]:/i.test(s[0]);
        if (isUNC) {
          return [...s.slice(0, 4), ...s.slice(4).map((ss) => this.parse(ss))];
        } else if (isDrive) {
          return [s[0], ...s.slice(1).map((ss) => this.parse(ss))];
        }
      }
      return s.map((ss) => this.parse(ss));
    });
    this.debug(this.pattern, set);
    this.set = set.filter((s) => s.indexOf(false) === -1);
    if (this.isWindows) {
      for (let i = 0; i < this.set.length; i++) {
        const p = this.set[i];
        if (p[0] === "" && p[1] === "" && this.globParts[i][2] === "?" && typeof p[3] === "string" && /^[a-z]:$/i.test(p[3])) {
          p[2] = "?";
        }
      }
    }
    this.debug(this.pattern, this.set);
  }
  // various transforms to equivalent pattern sets that are
  // faster to process in a filesystem walk.  The goal is to
  // eliminate what we can, and push all ** patterns as far
  // to the right as possible, even if it increases the number
  // of patterns that we have to process.
  preprocess(globParts) {
    if (this.options.noglobstar) {
      for (let i = 0; i < globParts.length; i++) {
        for (let j = 0; j < globParts[i].length; j++) {
          if (globParts[i][j] === "**") {
            globParts[i][j] = "*";
          }
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      globParts = this.firstPhasePreProcess(globParts);
      globParts = this.secondPhasePreProcess(globParts);
    } else if (optimizationLevel >= 1) {
      globParts = this.levelOneOptimize(globParts);
    } else {
      globParts = this.adjascentGlobstarOptimize(globParts);
    }
    return globParts;
  }
  // just get rid of adjascent ** portions
  adjascentGlobstarOptimize(globParts) {
    return globParts.map((parts) => {
      let gs = -1;
      while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
        let i = gs;
        while (parts[i + 1] === "**") {
          i++;
        }
        if (i !== gs) {
          parts.splice(gs, i - gs);
        }
      }
      return parts;
    });
  }
  // get rid of adjascent ** and resolve .. portions
  levelOneOptimize(globParts) {
    return globParts.map((parts) => {
      parts = parts.reduce((set, part) => {
        const prev = set[set.length - 1];
        if (part === "**" && prev === "**") {
          return set;
        }
        if (part === "..") {
          if (prev && prev !== ".." && prev !== "." && prev !== "**") {
            set.pop();
            return set;
          }
        }
        set.push(part);
        return set;
      }, []);
      return parts.length === 0 ? [""] : parts;
    });
  }
  levelTwoFileOptimize(parts) {
    if (!Array.isArray(parts)) {
      parts = this.slashSplit(parts);
    }
    let didSomething = false;
    do {
      didSomething = false;
      if (!this.preserveMultipleSlashes) {
        for (let i = 1; i < parts.length - 1; i++) {
          const p = parts[i];
          if (i === 1 && p === "" && parts[0] === "")
            continue;
          if (p === "." || p === "") {
            didSomething = true;
            parts.splice(i, 1);
            i--;
          }
        }
        if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
          didSomething = true;
          parts.pop();
        }
      }
      let dd = 0;
      while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
        const p = parts[dd - 1];
        if (p && p !== "." && p !== ".." && p !== "**") {
          didSomething = true;
          parts.splice(dd - 1, 2);
          dd -= 2;
        }
      }
    } while (didSomething);
    return parts.length === 0 ? [""] : parts;
  }
  // First phase: single-pattern processing
  // <pre> is 1 or more portions
  // <rest> is 1 or more portions
  // <p> is any portion other than ., .., '', or **
  // <e> is . or ''
  //
  // **/.. is *brutal* for filesystem walking performance, because
  // it effectively resets the recursive walk each time it occurs,
  // and ** cannot be reduced out by a .. pattern part like a regexp
  // or most strings (other than .., ., and '') can be.
  //
  // <pre>/**/../<p>/<p>/<rest> -> {<pre>/../<p>/<p>/<rest>,<pre>/**/<p>/<p>/<rest>}
  // <pre>/<e>/<rest> -> <pre>/<rest>
  // <pre>/<p>/../<rest> -> <pre>/<rest>
  // **/**/<rest> -> **/<rest>
  //
  // **/*/<rest> -> */**/<rest> <== not valid because ** doesn't follow
  // this WOULD be allowed if ** did follow symlinks, or * didn't
  firstPhasePreProcess(globParts) {
    let didSomething = false;
    do {
      didSomething = false;
      for (let parts of globParts) {
        let gs = -1;
        while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
          let gss = gs;
          while (parts[gss + 1] === "**") {
            gss++;
          }
          if (gss > gs) {
            parts.splice(gs + 1, gss - gs);
          }
          let next = parts[gs + 1];
          const p = parts[gs + 2];
          const p2 = parts[gs + 3];
          if (next !== "..")
            continue;
          if (!p || p === "." || p === ".." || !p2 || p2 === "." || p2 === "..") {
            continue;
          }
          didSomething = true;
          parts.splice(gs, 1);
          const other = parts.slice(0);
          other[gs] = "**";
          globParts.push(other);
          gs--;
        }
        if (!this.preserveMultipleSlashes) {
          for (let i = 1; i < parts.length - 1; i++) {
            const p = parts[i];
            if (i === 1 && p === "" && parts[0] === "")
              continue;
            if (p === "." || p === "") {
              didSomething = true;
              parts.splice(i, 1);
              i--;
            }
          }
          if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
            didSomething = true;
            parts.pop();
          }
        }
        let dd = 0;
        while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
          const p = parts[dd - 1];
          if (p && p !== "." && p !== ".." && p !== "**") {
            didSomething = true;
            const needDot = dd === 1 && parts[dd + 1] === "**";
            const splin = needDot ? ["."] : [];
            parts.splice(dd - 1, 2, ...splin);
            if (parts.length === 0)
              parts.push("");
            dd -= 2;
          }
        }
      }
    } while (didSomething);
    return globParts;
  }
  // second phase: multi-pattern dedupes
  // {<pre>/*/<rest>,<pre>/<p>/<rest>} -> <pre>/*/<rest>
  // {<pre>/<rest>,<pre>/<rest>} -> <pre>/<rest>
  // {<pre>/**/<rest>,<pre>/<rest>} -> <pre>/**/<rest>
  //
  // {<pre>/**/<rest>,<pre>/**/<p>/<rest>} -> <pre>/**/<rest>
  // ^-- not valid because ** doens't follow symlinks
  secondPhasePreProcess(globParts) {
    for (let i = 0; i < globParts.length - 1; i++) {
      for (let j = i + 1; j < globParts.length; j++) {
        const matched = this.partsMatch(globParts[i], globParts[j], !this.preserveMultipleSlashes);
        if (matched) {
          globParts[i] = [];
          globParts[j] = matched;
          break;
        }
      }
    }
    return globParts.filter((gs) => gs.length);
  }
  partsMatch(a, b, emptyGSMatch = false) {
    let ai = 0;
    let bi = 0;
    let result = [];
    let which = "";
    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        result.push(which === "b" ? b[bi] : a[ai]);
        ai++;
        bi++;
      } else if (emptyGSMatch && a[ai] === "**" && b[bi] === a[ai + 1]) {
        result.push(a[ai]);
        ai++;
      } else if (emptyGSMatch && b[bi] === "**" && a[ai] === b[bi + 1]) {
        result.push(b[bi]);
        bi++;
      } else if (a[ai] === "*" && b[bi] && (this.options.dot || !b[bi].startsWith(".")) && b[bi] !== "**") {
        if (which === "b")
          return false;
        which = "a";
        result.push(a[ai]);
        ai++;
        bi++;
      } else if (b[bi] === "*" && a[ai] && (this.options.dot || !a[ai].startsWith(".")) && a[ai] !== "**") {
        if (which === "a")
          return false;
        which = "b";
        result.push(b[bi]);
        ai++;
        bi++;
      } else {
        return false;
      }
    }
    return a.length === b.length && result;
  }
  parseNegate() {
    if (this.nonegate)
      return;
    const pattern = this.pattern;
    let negate = false;
    let negateOffset = 0;
    for (let i = 0; i < pattern.length && pattern.charAt(i) === "!"; i++) {
      negate = !negate;
      negateOffset++;
    }
    if (negateOffset)
      this.pattern = pattern.slice(negateOffset);
    this.negate = negate;
  }
  // set partial to true to test if, for example,
  // "/a/b" matches the start of "/*/b/*/d"
  // Partial means, if you run out of file before you run
  // out of pattern, then that's fine, as long as all
  // the parts match.
  matchOne(file, pattern, partial = false) {
    const options = this.options;
    if (this.isWindows) {
      const fileDrive = typeof file[0] === "string" && /^[a-z]:$/i.test(file[0]);
      const fileUNC = !fileDrive && file[0] === "" && file[1] === "" && file[2] === "?" && /^[a-z]:$/i.test(file[3]);
      const patternDrive = typeof pattern[0] === "string" && /^[a-z]:$/i.test(pattern[0]);
      const patternUNC = !patternDrive && pattern[0] === "" && pattern[1] === "" && pattern[2] === "?" && typeof pattern[3] === "string" && /^[a-z]:$/i.test(pattern[3]);
      const fdi = fileUNC ? 3 : fileDrive ? 0 : void 0;
      const pdi = patternUNC ? 3 : patternDrive ? 0 : void 0;
      if (typeof fdi === "number" && typeof pdi === "number") {
        const [fd, pd] = [file[fdi], pattern[pdi]];
        if (fd.toLowerCase() === pd.toLowerCase()) {
          pattern[pdi] = fd;
          if (pdi > fdi) {
            pattern = pattern.slice(pdi);
          } else if (fdi > pdi) {
            file = file.slice(fdi);
          }
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      file = this.levelTwoFileOptimize(file);
    }
    this.debug("matchOne", this, { file, pattern });
    this.debug("matchOne", file.length, pattern.length);
    for (var fi = 0, pi = 0, fl = file.length, pl = pattern.length; fi < fl && pi < pl; fi++, pi++) {
      this.debug("matchOne loop");
      var p = pattern[pi];
      var f = file[fi];
      this.debug(pattern, p, f);
      if (p === false) {
        return false;
      }
      if (p === GLOBSTAR) {
        this.debug("GLOBSTAR", [pattern, p, f]);
        var fr = fi;
        var pr = pi + 1;
        if (pr === pl) {
          this.debug("** at the end");
          for (; fi < fl; fi++) {
            if (file[fi] === "." || file[fi] === ".." || !options.dot && file[fi].charAt(0) === ".")
              return false;
          }
          return true;
        }
        while (fr < fl) {
          var swallowee = file[fr];
          this.debug("\nglobstar while", file, fr, pattern, pr, swallowee);
          if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
            this.debug("globstar found match!", fr, fl, swallowee);
            return true;
          } else {
            if (swallowee === "." || swallowee === ".." || !options.dot && swallowee.charAt(0) === ".") {
              this.debug("dot detected!", file, fr, pattern, pr);
              break;
            }
            this.debug("globstar swallow a segment, and continue");
            fr++;
          }
        }
        if (partial) {
          this.debug("\n>>> no match, partial?", file, fr, pattern, pr);
          if (fr === fl) {
            return true;
          }
        }
        return false;
      }
      let hit;
      if (typeof p === "string") {
        hit = f === p;
        this.debug("string match", p, f, hit);
      } else {
        hit = p.test(f);
        this.debug("pattern match", p, f, hit);
      }
      if (!hit)
        return false;
    }
    if (fi === fl && pi === pl) {
      return true;
    } else if (fi === fl) {
      return partial;
    } else if (pi === pl) {
      return fi === fl - 1 && file[fi] === "";
    } else {
      throw new Error("wtf?");
    }
  }
  braceExpand() {
    return braceExpand(this.pattern, this.options);
  }
  parse(pattern) {
    assertValidPattern(pattern);
    const options = this.options;
    if (pattern === "**")
      return GLOBSTAR;
    if (pattern === "")
      return "";
    let m;
    let fastTest = null;
    if (m = pattern.match(starRE)) {
      fastTest = options.dot ? starTestDot : starTest;
    } else if (m = pattern.match(starDotExtRE)) {
      fastTest = (options.nocase ? options.dot ? starDotExtTestNocaseDot : starDotExtTestNocase : options.dot ? starDotExtTestDot : starDotExtTest)(m[1]);
    } else if (m = pattern.match(qmarksRE)) {
      fastTest = (options.nocase ? options.dot ? qmarksTestNocaseDot : qmarksTestNocase : options.dot ? qmarksTestDot : qmarksTest)(m);
    } else if (m = pattern.match(starDotStarRE)) {
      fastTest = options.dot ? starDotStarTestDot : starDotStarTest;
    } else if (m = pattern.match(dotStarRE)) {
      fastTest = dotStarTest;
    }
    const re = AST.fromGlob(pattern, this.options).toMMPattern();
    if (fastTest && typeof re === "object") {
      Reflect.defineProperty(re, "test", { value: fastTest });
    }
    return re;
  }
  makeRe() {
    if (this.regexp || this.regexp === false)
      return this.regexp;
    const set = this.set;
    if (!set.length) {
      this.regexp = false;
      return this.regexp;
    }
    const options = this.options;
    const twoStar = options.noglobstar ? star2 : options.dot ? twoStarDot : twoStarNoDot;
    const flags = new Set(options.nocase ? ["i"] : []);
    let re = set.map((pattern) => {
      const pp = pattern.map((p) => {
        if (p instanceof RegExp) {
          for (const f of p.flags.split(""))
            flags.add(f);
        }
        return typeof p === "string" ? regExpEscape2(p) : p === GLOBSTAR ? GLOBSTAR : p._src;
      });
      pp.forEach((p, i) => {
        const next = pp[i + 1];
        const prev = pp[i - 1];
        if (p !== GLOBSTAR || prev === GLOBSTAR) {
          return;
        }
        if (prev === void 0) {
          if (next !== void 0 && next !== GLOBSTAR) {
            pp[i + 1] = "(?:\\/|" + twoStar + "\\/)?" + next;
          } else {
            pp[i] = twoStar;
          }
        } else if (next === void 0) {
          pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + ")?";
        } else if (next !== GLOBSTAR) {
          pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + "\\/)" + next;
          pp[i + 1] = GLOBSTAR;
        }
      });
      const filtered = pp.filter((p) => p !== GLOBSTAR);
      if (this.partial && filtered.length >= 1) {
        const prefixes = [];
        for (let i = 1; i <= filtered.length; i++) {
          prefixes.push(filtered.slice(0, i).join("/"));
        }
        return "(?:" + prefixes.join("|") + ")";
      }
      return filtered.join("/");
    }).join("|");
    const [open, close] = set.length > 1 ? ["(?:", ")"] : ["", ""];
    re = "^" + open + re + close + "$";
    if (this.partial) {
      re = "^(?:\\/|" + open + re.slice(1, -1) + close + ")$";
    }
    if (this.negate)
      re = "^(?!" + re + ").+$";
    try {
      this.regexp = new RegExp(re, [...flags].join(""));
    } catch (ex) {
      this.regexp = false;
    }
    return this.regexp;
  }
  slashSplit(p) {
    if (this.preserveMultipleSlashes) {
      return p.split("/");
    } else if (this.isWindows && /^\/\/[^\/]+/.test(p)) {
      return ["", ...p.split(/\/+/)];
    } else {
      return p.split(/\/+/);
    }
  }
  match(f, partial = this.partial) {
    this.debug("match", f, this.pattern);
    if (this.comment) {
      return false;
    }
    if (this.empty) {
      return f === "";
    }
    if (f === "/" && partial) {
      return true;
    }
    const options = this.options;
    if (this.isWindows) {
      f = f.split("\\").join("/");
    }
    const ff = this.slashSplit(f);
    this.debug(this.pattern, "split", ff);
    const set = this.set;
    this.debug(this.pattern, "set", set);
    let filename = ff[ff.length - 1];
    if (!filename) {
      for (let i = ff.length - 2; !filename && i >= 0; i--) {
        filename = ff[i];
      }
    }
    for (let i = 0; i < set.length; i++) {
      const pattern = set[i];
      let file = ff;
      if (options.matchBase && pattern.length === 1) {
        file = [filename];
      }
      const hit = this.matchOne(file, pattern, partial);
      if (hit) {
        if (options.flipNegate) {
          return true;
        }
        return !this.negate;
      }
    }
    if (options.flipNegate) {
      return false;
    }
    return this.negate;
  }
  static defaults(def) {
    return minimatch.defaults(def).Minimatch;
  }
};
minimatch.AST = AST;
minimatch.Minimatch = Minimatch;
minimatch.escape = escape;
minimatch.unescape = unescape;

// ../../node_modules/glob/dist/esm/glob.js
import { fileURLToPath as fileURLToPath2 } from "node:url";

// ../../node_modules/glob/node_modules/lru-cache/dist/esm/index.js
var defaultPerf = typeof performance === "object" && performance && typeof performance.now === "function" ? performance : Date;
var warned = /* @__PURE__ */ new Set();
var PROCESS = typeof process === "object" && !!process ? process : {};
var emitWarning = (msg, type, code, fn) => {
  typeof PROCESS.emitWarning === "function" ? PROCESS.emitWarning(msg, type, code, fn) : console.error(`[${code}] ${type}: ${msg}`);
};
var AC = globalThis.AbortController;
var AS = globalThis.AbortSignal;
if (typeof AC === "undefined") {
  AS = class AbortSignal {
    onabort;
    _onabort = [];
    reason;
    aborted = false;
    addEventListener(_, fn) {
      this._onabort.push(fn);
    }
  };
  AC = class AbortController {
    constructor() {
      warnACPolyfill();
    }
    signal = new AS();
    abort(reason) {
      if (this.signal.aborted)
        return;
      this.signal.reason = reason;
      this.signal.aborted = true;
      for (const fn of this.signal._onabort) {
        fn(reason);
      }
      this.signal.onabort?.(reason);
    }
  };
  let printACPolyfillWarning = PROCESS.env?.LRU_CACHE_IGNORE_AC_WARNING !== "1";
  const warnACPolyfill = () => {
    if (!printACPolyfillWarning)
      return;
    printACPolyfillWarning = false;
    emitWarning("AbortController is not defined. If using lru-cache in node 14, load an AbortController polyfill from the `node-abort-controller` package. A minimal polyfill is provided for use by LRUCache.fetch(), but it should not be relied upon in other contexts (eg, passing it to other APIs that use AbortController/AbortSignal might have undesirable effects). You may disable this with LRU_CACHE_IGNORE_AC_WARNING=1 in the env.", "NO_ABORT_CONTROLLER", "ENOTSUP", warnACPolyfill);
  };
}
var shouldWarn = (code) => !warned.has(code);
var TYPE = Symbol("type");
var isPosInt = (n) => n && n === Math.floor(n) && n > 0 && isFinite(n);
var getUintArray = (max) => !isPosInt(max) ? null : max <= Math.pow(2, 8) ? Uint8Array : max <= Math.pow(2, 16) ? Uint16Array : max <= Math.pow(2, 32) ? Uint32Array : max <= Number.MAX_SAFE_INTEGER ? ZeroArray : null;
var ZeroArray = class extends Array {
  constructor(size) {
    super(size);
    this.fill(0);
  }
};
var Stack = class _Stack {
  heap;
  length;
  // private constructor
  static #constructing = false;
  static create(max) {
    const HeapCls = getUintArray(max);
    if (!HeapCls)
      return [];
    _Stack.#constructing = true;
    const s = new _Stack(max, HeapCls);
    _Stack.#constructing = false;
    return s;
  }
  constructor(max, HeapCls) {
    if (!_Stack.#constructing) {
      throw new TypeError("instantiate Stack using Stack.create(n)");
    }
    this.heap = new HeapCls(max);
    this.length = 0;
  }
  push(n) {
    this.heap[this.length++] = n;
  }
  pop() {
    return this.heap[--this.length];
  }
};
var LRUCache = class _LRUCache {
  // options that cannot be changed without disaster
  #max;
  #maxSize;
  #dispose;
  #onInsert;
  #disposeAfter;
  #fetchMethod;
  #memoMethod;
  #perf;
  /**
   * {@link LRUCache.OptionsBase.perf}
   */
  get perf() {
    return this.#perf;
  }
  /**
   * {@link LRUCache.OptionsBase.ttl}
   */
  ttl;
  /**
   * {@link LRUCache.OptionsBase.ttlResolution}
   */
  ttlResolution;
  /**
   * {@link LRUCache.OptionsBase.ttlAutopurge}
   */
  ttlAutopurge;
  /**
   * {@link LRUCache.OptionsBase.updateAgeOnGet}
   */
  updateAgeOnGet;
  /**
   * {@link LRUCache.OptionsBase.updateAgeOnHas}
   */
  updateAgeOnHas;
  /**
   * {@link LRUCache.OptionsBase.allowStale}
   */
  allowStale;
  /**
   * {@link LRUCache.OptionsBase.noDisposeOnSet}
   */
  noDisposeOnSet;
  /**
   * {@link LRUCache.OptionsBase.noUpdateTTL}
   */
  noUpdateTTL;
  /**
   * {@link LRUCache.OptionsBase.maxEntrySize}
   */
  maxEntrySize;
  /**
   * {@link LRUCache.OptionsBase.sizeCalculation}
   */
  sizeCalculation;
  /**
   * {@link LRUCache.OptionsBase.noDeleteOnFetchRejection}
   */
  noDeleteOnFetchRejection;
  /**
   * {@link LRUCache.OptionsBase.noDeleteOnStaleGet}
   */
  noDeleteOnStaleGet;
  /**
   * {@link LRUCache.OptionsBase.allowStaleOnFetchAbort}
   */
  allowStaleOnFetchAbort;
  /**
   * {@link LRUCache.OptionsBase.allowStaleOnFetchRejection}
   */
  allowStaleOnFetchRejection;
  /**
   * {@link LRUCache.OptionsBase.ignoreFetchAbort}
   */
  ignoreFetchAbort;
  // computed properties
  #size;
  #calculatedSize;
  #keyMap;
  #keyList;
  #valList;
  #next;
  #prev;
  #head;
  #tail;
  #free;
  #disposed;
  #sizes;
  #starts;
  #ttls;
  #hasDispose;
  #hasFetchMethod;
  #hasDisposeAfter;
  #hasOnInsert;
  /**
   * Do not call this method unless you need to inspect the
   * inner workings of the cache.  If anything returned by this
   * object is modified in any way, strange breakage may occur.
   *
   * These fields are private for a reason!
   *
   * @internal
   */
  static unsafeExposeInternals(c) {
    return {
      // properties
      starts: c.#starts,
      ttls: c.#ttls,
      sizes: c.#sizes,
      keyMap: c.#keyMap,
      keyList: c.#keyList,
      valList: c.#valList,
      next: c.#next,
      prev: c.#prev,
      get head() {
        return c.#head;
      },
      get tail() {
        return c.#tail;
      },
      free: c.#free,
      // methods
      isBackgroundFetch: (p) => c.#isBackgroundFetch(p),
      backgroundFetch: (k, index, options, context) => c.#backgroundFetch(k, index, options, context),
      moveToTail: (index) => c.#moveToTail(index),
      indexes: (options) => c.#indexes(options),
      rindexes: (options) => c.#rindexes(options),
      isStale: (index) => c.#isStale(index)
    };
  }
  // Protected read-only members
  /**
   * {@link LRUCache.OptionsBase.max} (read-only)
   */
  get max() {
    return this.#max;
  }
  /**
   * {@link LRUCache.OptionsBase.maxSize} (read-only)
   */
  get maxSize() {
    return this.#maxSize;
  }
  /**
   * The total computed size of items in the cache (read-only)
   */
  get calculatedSize() {
    return this.#calculatedSize;
  }
  /**
   * The number of items stored in the cache (read-only)
   */
  get size() {
    return this.#size;
  }
  /**
   * {@link LRUCache.OptionsBase.fetchMethod} (read-only)
   */
  get fetchMethod() {
    return this.#fetchMethod;
  }
  get memoMethod() {
    return this.#memoMethod;
  }
  /**
   * {@link LRUCache.OptionsBase.dispose} (read-only)
   */
  get dispose() {
    return this.#dispose;
  }
  /**
   * {@link LRUCache.OptionsBase.onInsert} (read-only)
   */
  get onInsert() {
    return this.#onInsert;
  }
  /**
   * {@link LRUCache.OptionsBase.disposeAfter} (read-only)
   */
  get disposeAfter() {
    return this.#disposeAfter;
  }
  constructor(options) {
    const { max = 0, ttl, ttlResolution = 1, ttlAutopurge, updateAgeOnGet, updateAgeOnHas, allowStale, dispose, onInsert, disposeAfter, noDisposeOnSet, noUpdateTTL, maxSize = 0, maxEntrySize = 0, sizeCalculation, fetchMethod, memoMethod, noDeleteOnFetchRejection, noDeleteOnStaleGet, allowStaleOnFetchRejection, allowStaleOnFetchAbort, ignoreFetchAbort, perf } = options;
    if (perf !== void 0) {
      if (typeof perf?.now !== "function") {
        throw new TypeError("perf option must have a now() method if specified");
      }
    }
    this.#perf = perf ?? defaultPerf;
    if (max !== 0 && !isPosInt(max)) {
      throw new TypeError("max option must be a nonnegative integer");
    }
    const UintArray = max ? getUintArray(max) : Array;
    if (!UintArray) {
      throw new Error("invalid max value: " + max);
    }
    this.#max = max;
    this.#maxSize = maxSize;
    this.maxEntrySize = maxEntrySize || this.#maxSize;
    this.sizeCalculation = sizeCalculation;
    if (this.sizeCalculation) {
      if (!this.#maxSize && !this.maxEntrySize) {
        throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
      }
      if (typeof this.sizeCalculation !== "function") {
        throw new TypeError("sizeCalculation set to non-function");
      }
    }
    if (memoMethod !== void 0 && typeof memoMethod !== "function") {
      throw new TypeError("memoMethod must be a function if defined");
    }
    this.#memoMethod = memoMethod;
    if (fetchMethod !== void 0 && typeof fetchMethod !== "function") {
      throw new TypeError("fetchMethod must be a function if specified");
    }
    this.#fetchMethod = fetchMethod;
    this.#hasFetchMethod = !!fetchMethod;
    this.#keyMap = /* @__PURE__ */ new Map();
    this.#keyList = new Array(max).fill(void 0);
    this.#valList = new Array(max).fill(void 0);
    this.#next = new UintArray(max);
    this.#prev = new UintArray(max);
    this.#head = 0;
    this.#tail = 0;
    this.#free = Stack.create(max);
    this.#size = 0;
    this.#calculatedSize = 0;
    if (typeof dispose === "function") {
      this.#dispose = dispose;
    }
    if (typeof onInsert === "function") {
      this.#onInsert = onInsert;
    }
    if (typeof disposeAfter === "function") {
      this.#disposeAfter = disposeAfter;
      this.#disposed = [];
    } else {
      this.#disposeAfter = void 0;
      this.#disposed = void 0;
    }
    this.#hasDispose = !!this.#dispose;
    this.#hasOnInsert = !!this.#onInsert;
    this.#hasDisposeAfter = !!this.#disposeAfter;
    this.noDisposeOnSet = !!noDisposeOnSet;
    this.noUpdateTTL = !!noUpdateTTL;
    this.noDeleteOnFetchRejection = !!noDeleteOnFetchRejection;
    this.allowStaleOnFetchRejection = !!allowStaleOnFetchRejection;
    this.allowStaleOnFetchAbort = !!allowStaleOnFetchAbort;
    this.ignoreFetchAbort = !!ignoreFetchAbort;
    if (this.maxEntrySize !== 0) {
      if (this.#maxSize !== 0) {
        if (!isPosInt(this.#maxSize)) {
          throw new TypeError("maxSize must be a positive integer if specified");
        }
      }
      if (!isPosInt(this.maxEntrySize)) {
        throw new TypeError("maxEntrySize must be a positive integer if specified");
      }
      this.#initializeSizeTracking();
    }
    this.allowStale = !!allowStale;
    this.noDeleteOnStaleGet = !!noDeleteOnStaleGet;
    this.updateAgeOnGet = !!updateAgeOnGet;
    this.updateAgeOnHas = !!updateAgeOnHas;
    this.ttlResolution = isPosInt(ttlResolution) || ttlResolution === 0 ? ttlResolution : 1;
    this.ttlAutopurge = !!ttlAutopurge;
    this.ttl = ttl || 0;
    if (this.ttl) {
      if (!isPosInt(this.ttl)) {
        throw new TypeError("ttl must be a positive integer if specified");
      }
      this.#initializeTTLTracking();
    }
    if (this.#max === 0 && this.ttl === 0 && this.#maxSize === 0) {
      throw new TypeError("At least one of max, maxSize, or ttl is required");
    }
    if (!this.ttlAutopurge && !this.#max && !this.#maxSize) {
      const code = "LRU_CACHE_UNBOUNDED";
      if (shouldWarn(code)) {
        warned.add(code);
        const msg = "TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.";
        emitWarning(msg, "UnboundedCacheWarning", code, _LRUCache);
      }
    }
  }
  /**
   * Return the number of ms left in the item's TTL. If item is not in cache,
   * returns `0`. Returns `Infinity` if item is in cache without a defined TTL.
   */
  getRemainingTTL(key) {
    return this.#keyMap.has(key) ? Infinity : 0;
  }
  #initializeTTLTracking() {
    const ttls = new ZeroArray(this.#max);
    const starts = new ZeroArray(this.#max);
    this.#ttls = ttls;
    this.#starts = starts;
    this.#setItemTTL = (index, ttl, start = this.#perf.now()) => {
      starts[index] = ttl !== 0 ? start : 0;
      ttls[index] = ttl;
      if (ttl !== 0 && this.ttlAutopurge) {
        const t = setTimeout(() => {
          if (this.#isStale(index)) {
            this.#delete(this.#keyList[index], "expire");
          }
        }, ttl + 1);
        if (t.unref) {
          t.unref();
        }
      }
    };
    this.#updateItemAge = (index) => {
      starts[index] = ttls[index] !== 0 ? this.#perf.now() : 0;
    };
    this.#statusTTL = (status, index) => {
      if (ttls[index]) {
        const ttl = ttls[index];
        const start = starts[index];
        if (!ttl || !start)
          return;
        status.ttl = ttl;
        status.start = start;
        status.now = cachedNow || getNow();
        const age = status.now - start;
        status.remainingTTL = ttl - age;
      }
    };
    let cachedNow = 0;
    const getNow = () => {
      const n = this.#perf.now();
      if (this.ttlResolution > 0) {
        cachedNow = n;
        const t = setTimeout(() => cachedNow = 0, this.ttlResolution);
        if (t.unref) {
          t.unref();
        }
      }
      return n;
    };
    this.getRemainingTTL = (key) => {
      const index = this.#keyMap.get(key);
      if (index === void 0) {
        return 0;
      }
      const ttl = ttls[index];
      const start = starts[index];
      if (!ttl || !start) {
        return Infinity;
      }
      const age = (cachedNow || getNow()) - start;
      return ttl - age;
    };
    this.#isStale = (index) => {
      const s = starts[index];
      const t = ttls[index];
      return !!t && !!s && (cachedNow || getNow()) - s > t;
    };
  }
  // conditionally set private methods related to TTL
  #updateItemAge = () => {
  };
  #statusTTL = () => {
  };
  #setItemTTL = () => {
  };
  /* c8 ignore stop */
  #isStale = () => false;
  #initializeSizeTracking() {
    const sizes = new ZeroArray(this.#max);
    this.#calculatedSize = 0;
    this.#sizes = sizes;
    this.#removeItemSize = (index) => {
      this.#calculatedSize -= sizes[index];
      sizes[index] = 0;
    };
    this.#requireSize = (k, v, size, sizeCalculation) => {
      if (this.#isBackgroundFetch(v)) {
        return 0;
      }
      if (!isPosInt(size)) {
        if (sizeCalculation) {
          if (typeof sizeCalculation !== "function") {
            throw new TypeError("sizeCalculation must be a function");
          }
          size = sizeCalculation(v, k);
          if (!isPosInt(size)) {
            throw new TypeError("sizeCalculation return invalid (expect positive integer)");
          }
        } else {
          throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
        }
      }
      return size;
    };
    this.#addItemSize = (index, size, status) => {
      sizes[index] = size;
      if (this.#maxSize) {
        const maxSize = this.#maxSize - sizes[index];
        while (this.#calculatedSize > maxSize) {
          this.#evict(true);
        }
      }
      this.#calculatedSize += sizes[index];
      if (status) {
        status.entrySize = size;
        status.totalCalculatedSize = this.#calculatedSize;
      }
    };
  }
  #removeItemSize = (_i) => {
  };
  #addItemSize = (_i, _s, _st) => {
  };
  #requireSize = (_k, _v, size, sizeCalculation) => {
    if (size || sizeCalculation) {
      throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
    }
    return 0;
  };
  *#indexes({ allowStale = this.allowStale } = {}) {
    if (this.#size) {
      for (let i = this.#tail; true; ) {
        if (!this.#isValidIndex(i)) {
          break;
        }
        if (allowStale || !this.#isStale(i)) {
          yield i;
        }
        if (i === this.#head) {
          break;
        } else {
          i = this.#prev[i];
        }
      }
    }
  }
  *#rindexes({ allowStale = this.allowStale } = {}) {
    if (this.#size) {
      for (let i = this.#head; true; ) {
        if (!this.#isValidIndex(i)) {
          break;
        }
        if (allowStale || !this.#isStale(i)) {
          yield i;
        }
        if (i === this.#tail) {
          break;
        } else {
          i = this.#next[i];
        }
      }
    }
  }
  #isValidIndex(index) {
    return index !== void 0 && this.#keyMap.get(this.#keyList[index]) === index;
  }
  /**
   * Return a generator yielding `[key, value]` pairs,
   * in order from most recently used to least recently used.
   */
  *entries() {
    for (const i of this.#indexes()) {
      if (this.#valList[i] !== void 0 && this.#keyList[i] !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
        yield [this.#keyList[i], this.#valList[i]];
      }
    }
  }
  /**
   * Inverse order version of {@link LRUCache.entries}
   *
   * Return a generator yielding `[key, value]` pairs,
   * in order from least recently used to most recently used.
   */
  *rentries() {
    for (const i of this.#rindexes()) {
      if (this.#valList[i] !== void 0 && this.#keyList[i] !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
        yield [this.#keyList[i], this.#valList[i]];
      }
    }
  }
  /**
   * Return a generator yielding the keys in the cache,
   * in order from most recently used to least recently used.
   */
  *keys() {
    for (const i of this.#indexes()) {
      const k = this.#keyList[i];
      if (k !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
        yield k;
      }
    }
  }
  /**
   * Inverse order version of {@link LRUCache.keys}
   *
   * Return a generator yielding the keys in the cache,
   * in order from least recently used to most recently used.
   */
  *rkeys() {
    for (const i of this.#rindexes()) {
      const k = this.#keyList[i];
      if (k !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
        yield k;
      }
    }
  }
  /**
   * Return a generator yielding the values in the cache,
   * in order from most recently used to least recently used.
   */
  *values() {
    for (const i of this.#indexes()) {
      const v = this.#valList[i];
      if (v !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
        yield this.#valList[i];
      }
    }
  }
  /**
   * Inverse order version of {@link LRUCache.values}
   *
   * Return a generator yielding the values in the cache,
   * in order from least recently used to most recently used.
   */
  *rvalues() {
    for (const i of this.#rindexes()) {
      const v = this.#valList[i];
      if (v !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
        yield this.#valList[i];
      }
    }
  }
  /**
   * Iterating over the cache itself yields the same results as
   * {@link LRUCache.entries}
   */
  [Symbol.iterator]() {
    return this.entries();
  }
  /**
   * A String value that is used in the creation of the default string
   * description of an object. Called by the built-in method
   * `Object.prototype.toString`.
   */
  [Symbol.toStringTag] = "LRUCache";
  /**
   * Find a value for which the supplied fn method returns a truthy value,
   * similar to `Array.find()`. fn is called as `fn(value, key, cache)`.
   */
  find(fn, getOptions = {}) {
    for (const i of this.#indexes()) {
      const v = this.#valList[i];
      const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
      if (value === void 0)
        continue;
      if (fn(value, this.#keyList[i], this)) {
        return this.get(this.#keyList[i], getOptions);
      }
    }
  }
  /**
   * Call the supplied function on each item in the cache, in order from most
   * recently used to least recently used.
   *
   * `fn` is called as `fn(value, key, cache)`.
   *
   * If `thisp` is provided, function will be called in the `this`-context of
   * the provided object, or the cache if no `thisp` object is provided.
   *
   * Does not update age or recenty of use, or iterate over stale values.
   */
  forEach(fn, thisp = this) {
    for (const i of this.#indexes()) {
      const v = this.#valList[i];
      const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
      if (value === void 0)
        continue;
      fn.call(thisp, value, this.#keyList[i], this);
    }
  }
  /**
   * The same as {@link LRUCache.forEach} but items are iterated over in
   * reverse order.  (ie, less recently used items are iterated over first.)
   */
  rforEach(fn, thisp = this) {
    for (const i of this.#rindexes()) {
      const v = this.#valList[i];
      const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
      if (value === void 0)
        continue;
      fn.call(thisp, value, this.#keyList[i], this);
    }
  }
  /**
   * Delete any stale entries. Returns true if anything was removed,
   * false otherwise.
   */
  purgeStale() {
    let deleted = false;
    for (const i of this.#rindexes({ allowStale: true })) {
      if (this.#isStale(i)) {
        this.#delete(this.#keyList[i], "expire");
        deleted = true;
      }
    }
    return deleted;
  }
  /**
   * Get the extended info about a given entry, to get its value, size, and
   * TTL info simultaneously. Returns `undefined` if the key is not present.
   *
   * Unlike {@link LRUCache#dump}, which is designed to be portable and survive
   * serialization, the `start` value is always the current timestamp, and the
   * `ttl` is a calculated remaining time to live (negative if expired).
   *
   * Always returns stale values, if their info is found in the cache, so be
   * sure to check for expirations (ie, a negative {@link LRUCache.Entry#ttl})
   * if relevant.
   */
  info(key) {
    const i = this.#keyMap.get(key);
    if (i === void 0)
      return void 0;
    const v = this.#valList[i];
    const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
    if (value === void 0)
      return void 0;
    const entry = { value };
    if (this.#ttls && this.#starts) {
      const ttl = this.#ttls[i];
      const start = this.#starts[i];
      if (ttl && start) {
        const remain = ttl - (this.#perf.now() - start);
        entry.ttl = remain;
        entry.start = Date.now();
      }
    }
    if (this.#sizes) {
      entry.size = this.#sizes[i];
    }
    return entry;
  }
  /**
   * Return an array of [key, {@link LRUCache.Entry}] tuples which can be
   * passed to {@link LRUCache#load}.
   *
   * The `start` fields are calculated relative to a portable `Date.now()`
   * timestamp, even if `performance.now()` is available.
   *
   * Stale entries are always included in the `dump`, even if
   * {@link LRUCache.OptionsBase.allowStale} is false.
   *
   * Note: this returns an actual array, not a generator, so it can be more
   * easily passed around.
   */
  dump() {
    const arr = [];
    for (const i of this.#indexes({ allowStale: true })) {
      const key = this.#keyList[i];
      const v = this.#valList[i];
      const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
      if (value === void 0 || key === void 0)
        continue;
      const entry = { value };
      if (this.#ttls && this.#starts) {
        entry.ttl = this.#ttls[i];
        const age = this.#perf.now() - this.#starts[i];
        entry.start = Math.floor(Date.now() - age);
      }
      if (this.#sizes) {
        entry.size = this.#sizes[i];
      }
      arr.unshift([key, entry]);
    }
    return arr;
  }
  /**
   * Reset the cache and load in the items in entries in the order listed.
   *
   * The shape of the resulting cache may be different if the same options are
   * not used in both caches.
   *
   * The `start` fields are assumed to be calculated relative to a portable
   * `Date.now()` timestamp, even if `performance.now()` is available.
   */
  load(arr) {
    this.clear();
    for (const [key, entry] of arr) {
      if (entry.start) {
        const age = Date.now() - entry.start;
        entry.start = this.#perf.now() - age;
      }
      this.set(key, entry.value, entry);
    }
  }
  /**
   * Add a value to the cache.
   *
   * Note: if `undefined` is specified as a value, this is an alias for
   * {@link LRUCache#delete}
   *
   * Fields on the {@link LRUCache.SetOptions} options param will override
   * their corresponding values in the constructor options for the scope
   * of this single `set()` operation.
   *
   * If `start` is provided, then that will set the effective start
   * time for the TTL calculation. Note that this must be a previous
   * value of `performance.now()` if supported, or a previous value of
   * `Date.now()` if not.
   *
   * Options object may also include `size`, which will prevent
   * calling the `sizeCalculation` function and just use the specified
   * number if it is a positive integer, and `noDisposeOnSet` which
   * will prevent calling a `dispose` function in the case of
   * overwrites.
   *
   * If the `size` (or return value of `sizeCalculation`) for a given
   * entry is greater than `maxEntrySize`, then the item will not be
   * added to the cache.
   *
   * Will update the recency of the entry.
   *
   * If the value is `undefined`, then this is an alias for
   * `cache.delete(key)`. `undefined` is never stored in the cache.
   */
  set(k, v, setOptions = {}) {
    if (v === void 0) {
      this.delete(k);
      return this;
    }
    const { ttl = this.ttl, start, noDisposeOnSet = this.noDisposeOnSet, sizeCalculation = this.sizeCalculation, status } = setOptions;
    let { noUpdateTTL = this.noUpdateTTL } = setOptions;
    const size = this.#requireSize(k, v, setOptions.size || 0, sizeCalculation);
    if (this.maxEntrySize && size > this.maxEntrySize) {
      if (status) {
        status.set = "miss";
        status.maxEntrySizeExceeded = true;
      }
      this.#delete(k, "set");
      return this;
    }
    let index = this.#size === 0 ? void 0 : this.#keyMap.get(k);
    if (index === void 0) {
      index = this.#size === 0 ? this.#tail : this.#free.length !== 0 ? this.#free.pop() : this.#size === this.#max ? this.#evict(false) : this.#size;
      this.#keyList[index] = k;
      this.#valList[index] = v;
      this.#keyMap.set(k, index);
      this.#next[this.#tail] = index;
      this.#prev[index] = this.#tail;
      this.#tail = index;
      this.#size++;
      this.#addItemSize(index, size, status);
      if (status)
        status.set = "add";
      noUpdateTTL = false;
      if (this.#hasOnInsert) {
        this.#onInsert?.(v, k, "add");
      }
    } else {
      this.#moveToTail(index);
      const oldVal = this.#valList[index];
      if (v !== oldVal) {
        if (this.#hasFetchMethod && this.#isBackgroundFetch(oldVal)) {
          oldVal.__abortController.abort(new Error("replaced"));
          const { __staleWhileFetching: s } = oldVal;
          if (s !== void 0 && !noDisposeOnSet) {
            if (this.#hasDispose) {
              this.#dispose?.(s, k, "set");
            }
            if (this.#hasDisposeAfter) {
              this.#disposed?.push([s, k, "set"]);
            }
          }
        } else if (!noDisposeOnSet) {
          if (this.#hasDispose) {
            this.#dispose?.(oldVal, k, "set");
          }
          if (this.#hasDisposeAfter) {
            this.#disposed?.push([oldVal, k, "set"]);
          }
        }
        this.#removeItemSize(index);
        this.#addItemSize(index, size, status);
        this.#valList[index] = v;
        if (status) {
          status.set = "replace";
          const oldValue = oldVal && this.#isBackgroundFetch(oldVal) ? oldVal.__staleWhileFetching : oldVal;
          if (oldValue !== void 0)
            status.oldValue = oldValue;
        }
      } else if (status) {
        status.set = "update";
      }
      if (this.#hasOnInsert) {
        this.onInsert?.(v, k, v === oldVal ? "update" : "replace");
      }
    }
    if (ttl !== 0 && !this.#ttls) {
      this.#initializeTTLTracking();
    }
    if (this.#ttls) {
      if (!noUpdateTTL) {
        this.#setItemTTL(index, ttl, start);
      }
      if (status)
        this.#statusTTL(status, index);
    }
    if (!noDisposeOnSet && this.#hasDisposeAfter && this.#disposed) {
      const dt = this.#disposed;
      let task;
      while (task = dt?.shift()) {
        this.#disposeAfter?.(...task);
      }
    }
    return this;
  }
  /**
   * Evict the least recently used item, returning its value or
   * `undefined` if cache is empty.
   */
  pop() {
    try {
      while (this.#size) {
        const val = this.#valList[this.#head];
        this.#evict(true);
        if (this.#isBackgroundFetch(val)) {
          if (val.__staleWhileFetching) {
            return val.__staleWhileFetching;
          }
        } else if (val !== void 0) {
          return val;
        }
      }
    } finally {
      if (this.#hasDisposeAfter && this.#disposed) {
        const dt = this.#disposed;
        let task;
        while (task = dt?.shift()) {
          this.#disposeAfter?.(...task);
        }
      }
    }
  }
  #evict(free) {
    const head = this.#head;
    const k = this.#keyList[head];
    const v = this.#valList[head];
    if (this.#hasFetchMethod && this.#isBackgroundFetch(v)) {
      v.__abortController.abort(new Error("evicted"));
    } else if (this.#hasDispose || this.#hasDisposeAfter) {
      if (this.#hasDispose) {
        this.#dispose?.(v, k, "evict");
      }
      if (this.#hasDisposeAfter) {
        this.#disposed?.push([v, k, "evict"]);
      }
    }
    this.#removeItemSize(head);
    if (free) {
      this.#keyList[head] = void 0;
      this.#valList[head] = void 0;
      this.#free.push(head);
    }
    if (this.#size === 1) {
      this.#head = this.#tail = 0;
      this.#free.length = 0;
    } else {
      this.#head = this.#next[head];
    }
    this.#keyMap.delete(k);
    this.#size--;
    return head;
  }
  /**
   * Check if a key is in the cache, without updating the recency of use.
   * Will return false if the item is stale, even though it is technically
   * in the cache.
   *
   * Check if a key is in the cache, without updating the recency of
   * use. Age is updated if {@link LRUCache.OptionsBase.updateAgeOnHas} is set
   * to `true` in either the options or the constructor.
   *
   * Will return `false` if the item is stale, even though it is technically in
   * the cache. The difference can be determined (if it matters) by using a
   * `status` argument, and inspecting the `has` field.
   *
   * Will not update item age unless
   * {@link LRUCache.OptionsBase.updateAgeOnHas} is set.
   */
  has(k, hasOptions = {}) {
    const { updateAgeOnHas = this.updateAgeOnHas, status } = hasOptions;
    const index = this.#keyMap.get(k);
    if (index !== void 0) {
      const v = this.#valList[index];
      if (this.#isBackgroundFetch(v) && v.__staleWhileFetching === void 0) {
        return false;
      }
      if (!this.#isStale(index)) {
        if (updateAgeOnHas) {
          this.#updateItemAge(index);
        }
        if (status) {
          status.has = "hit";
          this.#statusTTL(status, index);
        }
        return true;
      } else if (status) {
        status.has = "stale";
        this.#statusTTL(status, index);
      }
    } else if (status) {
      status.has = "miss";
    }
    return false;
  }
  /**
   * Like {@link LRUCache#get} but doesn't update recency or delete stale
   * items.
   *
   * Returns `undefined` if the item is stale, unless
   * {@link LRUCache.OptionsBase.allowStale} is set.
   */
  peek(k, peekOptions = {}) {
    const { allowStale = this.allowStale } = peekOptions;
    const index = this.#keyMap.get(k);
    if (index === void 0 || !allowStale && this.#isStale(index)) {
      return;
    }
    const v = this.#valList[index];
    return this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
  }
  #backgroundFetch(k, index, options, context) {
    const v = index === void 0 ? void 0 : this.#valList[index];
    if (this.#isBackgroundFetch(v)) {
      return v;
    }
    const ac = new AC();
    const { signal } = options;
    signal?.addEventListener("abort", () => ac.abort(signal.reason), {
      signal: ac.signal
    });
    const fetchOpts = {
      signal: ac.signal,
      options,
      context
    };
    const cb = (v2, updateCache = false) => {
      const { aborted } = ac.signal;
      const ignoreAbort = options.ignoreFetchAbort && v2 !== void 0;
      if (options.status) {
        if (aborted && !updateCache) {
          options.status.fetchAborted = true;
          options.status.fetchError = ac.signal.reason;
          if (ignoreAbort)
            options.status.fetchAbortIgnored = true;
        } else {
          options.status.fetchResolved = true;
        }
      }
      if (aborted && !ignoreAbort && !updateCache) {
        return fetchFail(ac.signal.reason);
      }
      const bf2 = p;
      const vl = this.#valList[index];
      if (vl === p || ignoreAbort && updateCache && vl === void 0) {
        if (v2 === void 0) {
          if (bf2.__staleWhileFetching !== void 0) {
            this.#valList[index] = bf2.__staleWhileFetching;
          } else {
            this.#delete(k, "fetch");
          }
        } else {
          if (options.status)
            options.status.fetchUpdated = true;
          this.set(k, v2, fetchOpts.options);
        }
      }
      return v2;
    };
    const eb = (er) => {
      if (options.status) {
        options.status.fetchRejected = true;
        options.status.fetchError = er;
      }
      return fetchFail(er);
    };
    const fetchFail = (er) => {
      const { aborted } = ac.signal;
      const allowStaleAborted = aborted && options.allowStaleOnFetchAbort;
      const allowStale = allowStaleAborted || options.allowStaleOnFetchRejection;
      const noDelete = allowStale || options.noDeleteOnFetchRejection;
      const bf2 = p;
      if (this.#valList[index] === p) {
        const del = !noDelete || bf2.__staleWhileFetching === void 0;
        if (del) {
          this.#delete(k, "fetch");
        } else if (!allowStaleAborted) {
          this.#valList[index] = bf2.__staleWhileFetching;
        }
      }
      if (allowStale) {
        if (options.status && bf2.__staleWhileFetching !== void 0) {
          options.status.returnedStale = true;
        }
        return bf2.__staleWhileFetching;
      } else if (bf2.__returned === bf2) {
        throw er;
      }
    };
    const pcall = (res, rej) => {
      const fmp = this.#fetchMethod?.(k, v, fetchOpts);
      if (fmp && fmp instanceof Promise) {
        fmp.then((v2) => res(v2 === void 0 ? void 0 : v2), rej);
      }
      ac.signal.addEventListener("abort", () => {
        if (!options.ignoreFetchAbort || options.allowStaleOnFetchAbort) {
          res(void 0);
          if (options.allowStaleOnFetchAbort) {
            res = (v2) => cb(v2, true);
          }
        }
      });
    };
    if (options.status)
      options.status.fetchDispatched = true;
    const p = new Promise(pcall).then(cb, eb);
    const bf = Object.assign(p, {
      __abortController: ac,
      __staleWhileFetching: v,
      __returned: void 0
    });
    if (index === void 0) {
      this.set(k, bf, { ...fetchOpts.options, status: void 0 });
      index = this.#keyMap.get(k);
    } else {
      this.#valList[index] = bf;
    }
    return bf;
  }
  #isBackgroundFetch(p) {
    if (!this.#hasFetchMethod)
      return false;
    const b = p;
    return !!b && b instanceof Promise && b.hasOwnProperty("__staleWhileFetching") && b.__abortController instanceof AC;
  }
  async fetch(k, fetchOptions = {}) {
    const {
      // get options
      allowStale = this.allowStale,
      updateAgeOnGet = this.updateAgeOnGet,
      noDeleteOnStaleGet = this.noDeleteOnStaleGet,
      // set options
      ttl = this.ttl,
      noDisposeOnSet = this.noDisposeOnSet,
      size = 0,
      sizeCalculation = this.sizeCalculation,
      noUpdateTTL = this.noUpdateTTL,
      // fetch exclusive options
      noDeleteOnFetchRejection = this.noDeleteOnFetchRejection,
      allowStaleOnFetchRejection = this.allowStaleOnFetchRejection,
      ignoreFetchAbort = this.ignoreFetchAbort,
      allowStaleOnFetchAbort = this.allowStaleOnFetchAbort,
      context,
      forceRefresh = false,
      status,
      signal
    } = fetchOptions;
    if (!this.#hasFetchMethod) {
      if (status)
        status.fetch = "get";
      return this.get(k, {
        allowStale,
        updateAgeOnGet,
        noDeleteOnStaleGet,
        status
      });
    }
    const options = {
      allowStale,
      updateAgeOnGet,
      noDeleteOnStaleGet,
      ttl,
      noDisposeOnSet,
      size,
      sizeCalculation,
      noUpdateTTL,
      noDeleteOnFetchRejection,
      allowStaleOnFetchRejection,
      allowStaleOnFetchAbort,
      ignoreFetchAbort,
      status,
      signal
    };
    let index = this.#keyMap.get(k);
    if (index === void 0) {
      if (status)
        status.fetch = "miss";
      const p = this.#backgroundFetch(k, index, options, context);
      return p.__returned = p;
    } else {
      const v = this.#valList[index];
      if (this.#isBackgroundFetch(v)) {
        const stale = allowStale && v.__staleWhileFetching !== void 0;
        if (status) {
          status.fetch = "inflight";
          if (stale)
            status.returnedStale = true;
        }
        return stale ? v.__staleWhileFetching : v.__returned = v;
      }
      const isStale = this.#isStale(index);
      if (!forceRefresh && !isStale) {
        if (status)
          status.fetch = "hit";
        this.#moveToTail(index);
        if (updateAgeOnGet) {
          this.#updateItemAge(index);
        }
        if (status)
          this.#statusTTL(status, index);
        return v;
      }
      const p = this.#backgroundFetch(k, index, options, context);
      const hasStale = p.__staleWhileFetching !== void 0;
      const staleVal = hasStale && allowStale;
      if (status) {
        status.fetch = isStale ? "stale" : "refresh";
        if (staleVal && isStale)
          status.returnedStale = true;
      }
      return staleVal ? p.__staleWhileFetching : p.__returned = p;
    }
  }
  async forceFetch(k, fetchOptions = {}) {
    const v = await this.fetch(k, fetchOptions);
    if (v === void 0)
      throw new Error("fetch() returned undefined");
    return v;
  }
  memo(k, memoOptions = {}) {
    const memoMethod = this.#memoMethod;
    if (!memoMethod) {
      throw new Error("no memoMethod provided to constructor");
    }
    const { context, forceRefresh, ...options } = memoOptions;
    const v = this.get(k, options);
    if (!forceRefresh && v !== void 0)
      return v;
    const vv = memoMethod(k, v, {
      options,
      context
    });
    this.set(k, vv, options);
    return vv;
  }
  /**
   * Return a value from the cache. Will update the recency of the cache
   * entry found.
   *
   * If the key is not found, get() will return `undefined`.
   */
  get(k, getOptions = {}) {
    const { allowStale = this.allowStale, updateAgeOnGet = this.updateAgeOnGet, noDeleteOnStaleGet = this.noDeleteOnStaleGet, status } = getOptions;
    const index = this.#keyMap.get(k);
    if (index !== void 0) {
      const value = this.#valList[index];
      const fetching = this.#isBackgroundFetch(value);
      if (status)
        this.#statusTTL(status, index);
      if (this.#isStale(index)) {
        if (status)
          status.get = "stale";
        if (!fetching) {
          if (!noDeleteOnStaleGet) {
            this.#delete(k, "expire");
          }
          if (status && allowStale)
            status.returnedStale = true;
          return allowStale ? value : void 0;
        } else {
          if (status && allowStale && value.__staleWhileFetching !== void 0) {
            status.returnedStale = true;
          }
          return allowStale ? value.__staleWhileFetching : void 0;
        }
      } else {
        if (status)
          status.get = "hit";
        if (fetching) {
          return value.__staleWhileFetching;
        }
        this.#moveToTail(index);
        if (updateAgeOnGet) {
          this.#updateItemAge(index);
        }
        return value;
      }
    } else if (status) {
      status.get = "miss";
    }
  }
  #connect(p, n) {
    this.#prev[n] = p;
    this.#next[p] = n;
  }
  #moveToTail(index) {
    if (index !== this.#tail) {
      if (index === this.#head) {
        this.#head = this.#next[index];
      } else {
        this.#connect(this.#prev[index], this.#next[index]);
      }
      this.#connect(this.#tail, index);
      this.#tail = index;
    }
  }
  /**
   * Deletes a key out of the cache.
   *
   * Returns true if the key was deleted, false otherwise.
   */
  delete(k) {
    return this.#delete(k, "delete");
  }
  #delete(k, reason) {
    let deleted = false;
    if (this.#size !== 0) {
      const index = this.#keyMap.get(k);
      if (index !== void 0) {
        deleted = true;
        if (this.#size === 1) {
          this.#clear(reason);
        } else {
          this.#removeItemSize(index);
          const v = this.#valList[index];
          if (this.#isBackgroundFetch(v)) {
            v.__abortController.abort(new Error("deleted"));
          } else if (this.#hasDispose || this.#hasDisposeAfter) {
            if (this.#hasDispose) {
              this.#dispose?.(v, k, reason);
            }
            if (this.#hasDisposeAfter) {
              this.#disposed?.push([v, k, reason]);
            }
          }
          this.#keyMap.delete(k);
          this.#keyList[index] = void 0;
          this.#valList[index] = void 0;
          if (index === this.#tail) {
            this.#tail = this.#prev[index];
          } else if (index === this.#head) {
            this.#head = this.#next[index];
          } else {
            const pi = this.#prev[index];
            this.#next[pi] = this.#next[index];
            const ni = this.#next[index];
            this.#prev[ni] = this.#prev[index];
          }
          this.#size--;
          this.#free.push(index);
        }
      }
    }
    if (this.#hasDisposeAfter && this.#disposed?.length) {
      const dt = this.#disposed;
      let task;
      while (task = dt?.shift()) {
        this.#disposeAfter?.(...task);
      }
    }
    return deleted;
  }
  /**
   * Clear the cache entirely, throwing away all values.
   */
  clear() {
    return this.#clear("delete");
  }
  #clear(reason) {
    for (const index of this.#rindexes({ allowStale: true })) {
      const v = this.#valList[index];
      if (this.#isBackgroundFetch(v)) {
        v.__abortController.abort(new Error("deleted"));
      } else {
        const k = this.#keyList[index];
        if (this.#hasDispose) {
          this.#dispose?.(v, k, reason);
        }
        if (this.#hasDisposeAfter) {
          this.#disposed?.push([v, k, reason]);
        }
      }
    }
    this.#keyMap.clear();
    this.#valList.fill(void 0);
    this.#keyList.fill(void 0);
    if (this.#ttls && this.#starts) {
      this.#ttls.fill(0);
      this.#starts.fill(0);
    }
    if (this.#sizes) {
      this.#sizes.fill(0);
    }
    this.#head = 0;
    this.#tail = 0;
    this.#free.length = 0;
    this.#calculatedSize = 0;
    this.#size = 0;
    if (this.#hasDisposeAfter && this.#disposed) {
      const dt = this.#disposed;
      let task;
      while (task = dt?.shift()) {
        this.#disposeAfter?.(...task);
      }
    }
  }
};

// ../../node_modules/glob/node_modules/path-scurry/dist/esm/index.js
import { posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { lstatSync, readdir as readdirCB, readdirSync, readlinkSync, realpathSync as rps } from "fs";
import * as actualFS from "node:fs";
import { lstat, readdir, readlink, realpath } from "node:fs/promises";

// ../../node_modules/minipass/dist/esm/index.js
import { EventEmitter } from "node:events";
import Stream from "node:stream";
import { StringDecoder } from "node:string_decoder";
var proc = typeof process === "object" && process ? process : {
  stdout: null,
  stderr: null
};
var isStream = (s) => !!s && typeof s === "object" && (s instanceof Minipass || s instanceof Stream || isReadable(s) || isWritable(s));
var isReadable = (s) => !!s && typeof s === "object" && s instanceof EventEmitter && typeof s.pipe === "function" && // node core Writable streams have a pipe() method, but it throws
s.pipe !== Stream.Writable.prototype.pipe;
var isWritable = (s) => !!s && typeof s === "object" && s instanceof EventEmitter && typeof s.write === "function" && typeof s.end === "function";
var EOF = Symbol("EOF");
var MAYBE_EMIT_END = Symbol("maybeEmitEnd");
var EMITTED_END = Symbol("emittedEnd");
var EMITTING_END = Symbol("emittingEnd");
var EMITTED_ERROR = Symbol("emittedError");
var CLOSED = Symbol("closed");
var READ = Symbol("read");
var FLUSH = Symbol("flush");
var FLUSHCHUNK = Symbol("flushChunk");
var ENCODING = Symbol("encoding");
var DECODER = Symbol("decoder");
var FLOWING = Symbol("flowing");
var PAUSED = Symbol("paused");
var RESUME = Symbol("resume");
var BUFFER = Symbol("buffer");
var PIPES = Symbol("pipes");
var BUFFERLENGTH = Symbol("bufferLength");
var BUFFERPUSH = Symbol("bufferPush");
var BUFFERSHIFT = Symbol("bufferShift");
var OBJECTMODE = Symbol("objectMode");
var DESTROYED = Symbol("destroyed");
var ERROR = Symbol("error");
var EMITDATA = Symbol("emitData");
var EMITEND = Symbol("emitEnd");
var EMITEND2 = Symbol("emitEnd2");
var ASYNC = Symbol("async");
var ABORT = Symbol("abort");
var ABORTED = Symbol("aborted");
var SIGNAL = Symbol("signal");
var DATALISTENERS = Symbol("dataListeners");
var DISCARDED = Symbol("discarded");
var defer = (fn) => Promise.resolve().then(fn);
var nodefer = (fn) => fn();
var isEndish = (ev) => ev === "end" || ev === "finish" || ev === "prefinish";
var isArrayBufferLike = (b) => b instanceof ArrayBuffer || !!b && typeof b === "object" && b.constructor && b.constructor.name === "ArrayBuffer" && b.byteLength >= 0;
var isArrayBufferView = (b) => !Buffer.isBuffer(b) && ArrayBuffer.isView(b);
var Pipe = class {
  src;
  dest;
  opts;
  ondrain;
  constructor(src, dest, opts) {
    this.src = src;
    this.dest = dest;
    this.opts = opts;
    this.ondrain = () => src[RESUME]();
    this.dest.on("drain", this.ondrain);
  }
  unpipe() {
    this.dest.removeListener("drain", this.ondrain);
  }
  // only here for the prototype
  /* c8 ignore start */
  proxyErrors(_er) {
  }
  /* c8 ignore stop */
  end() {
    this.unpipe();
    if (this.opts.end)
      this.dest.end();
  }
};
var PipeProxyErrors = class extends Pipe {
  unpipe() {
    this.src.removeListener("error", this.proxyErrors);
    super.unpipe();
  }
  constructor(src, dest, opts) {
    super(src, dest, opts);
    this.proxyErrors = (er) => dest.emit("error", er);
    src.on("error", this.proxyErrors);
  }
};
var isObjectModeOptions = (o) => !!o.objectMode;
var isEncodingOptions = (o) => !o.objectMode && !!o.encoding && o.encoding !== "buffer";
var Minipass = class extends EventEmitter {
  [FLOWING] = false;
  [PAUSED] = false;
  [PIPES] = [];
  [BUFFER] = [];
  [OBJECTMODE];
  [ENCODING];
  [ASYNC];
  [DECODER];
  [EOF] = false;
  [EMITTED_END] = false;
  [EMITTING_END] = false;
  [CLOSED] = false;
  [EMITTED_ERROR] = null;
  [BUFFERLENGTH] = 0;
  [DESTROYED] = false;
  [SIGNAL];
  [ABORTED] = false;
  [DATALISTENERS] = 0;
  [DISCARDED] = false;
  /**
   * true if the stream can be written
   */
  writable = true;
  /**
   * true if the stream can be read
   */
  readable = true;
  /**
   * If `RType` is Buffer, then options do not need to be provided.
   * Otherwise, an options object must be provided to specify either
   * {@link Minipass.SharedOptions.objectMode} or
   * {@link Minipass.SharedOptions.encoding}, as appropriate.
   */
  constructor(...args) {
    const options = args[0] || {};
    super();
    if (options.objectMode && typeof options.encoding === "string") {
      throw new TypeError("Encoding and objectMode may not be used together");
    }
    if (isObjectModeOptions(options)) {
      this[OBJECTMODE] = true;
      this[ENCODING] = null;
    } else if (isEncodingOptions(options)) {
      this[ENCODING] = options.encoding;
      this[OBJECTMODE] = false;
    } else {
      this[OBJECTMODE] = false;
      this[ENCODING] = null;
    }
    this[ASYNC] = !!options.async;
    this[DECODER] = this[ENCODING] ? new StringDecoder(this[ENCODING]) : null;
    if (options && options.debugExposeBuffer === true) {
      Object.defineProperty(this, "buffer", { get: () => this[BUFFER] });
    }
    if (options && options.debugExposePipes === true) {
      Object.defineProperty(this, "pipes", { get: () => this[PIPES] });
    }
    const { signal } = options;
    if (signal) {
      this[SIGNAL] = signal;
      if (signal.aborted) {
        this[ABORT]();
      } else {
        signal.addEventListener("abort", () => this[ABORT]());
      }
    }
  }
  /**
   * The amount of data stored in the buffer waiting to be read.
   *
   * For Buffer strings, this will be the total byte length.
   * For string encoding streams, this will be the string character length,
   * according to JavaScript's `string.length` logic.
   * For objectMode streams, this is a count of the items waiting to be
   * emitted.
   */
  get bufferLength() {
    return this[BUFFERLENGTH];
  }
  /**
   * The `BufferEncoding` currently in use, or `null`
   */
  get encoding() {
    return this[ENCODING];
  }
  /**
   * @deprecated - This is a read only property
   */
  set encoding(_enc) {
    throw new Error("Encoding must be set at instantiation time");
  }
  /**
   * @deprecated - Encoding may only be set at instantiation time
   */
  setEncoding(_enc) {
    throw new Error("Encoding must be set at instantiation time");
  }
  /**
   * True if this is an objectMode stream
   */
  get objectMode() {
    return this[OBJECTMODE];
  }
  /**
   * @deprecated - This is a read-only property
   */
  set objectMode(_om) {
    throw new Error("objectMode must be set at instantiation time");
  }
  /**
   * true if this is an async stream
   */
  get ["async"]() {
    return this[ASYNC];
  }
  /**
   * Set to true to make this stream async.
   *
   * Once set, it cannot be unset, as this would potentially cause incorrect
   * behavior.  Ie, a sync stream can be made async, but an async stream
   * cannot be safely made sync.
   */
  set ["async"](a) {
    this[ASYNC] = this[ASYNC] || !!a;
  }
  // drop everything and get out of the flow completely
  [ABORT]() {
    this[ABORTED] = true;
    this.emit("abort", this[SIGNAL]?.reason);
    this.destroy(this[SIGNAL]?.reason);
  }
  /**
   * True if the stream has been aborted.
   */
  get aborted() {
    return this[ABORTED];
  }
  /**
   * No-op setter. Stream aborted status is set via the AbortSignal provided
   * in the constructor options.
   */
  set aborted(_) {
  }
  write(chunk, encoding, cb) {
    if (this[ABORTED])
      return false;
    if (this[EOF])
      throw new Error("write after end");
    if (this[DESTROYED]) {
      this.emit("error", Object.assign(new Error("Cannot call write after a stream was destroyed"), { code: "ERR_STREAM_DESTROYED" }));
      return true;
    }
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = "utf8";
    }
    if (!encoding)
      encoding = "utf8";
    const fn = this[ASYNC] ? defer : nodefer;
    if (!this[OBJECTMODE] && !Buffer.isBuffer(chunk)) {
      if (isArrayBufferView(chunk)) {
        chunk = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      } else if (isArrayBufferLike(chunk)) {
        chunk = Buffer.from(chunk);
      } else if (typeof chunk !== "string") {
        throw new Error("Non-contiguous data written to non-objectMode stream");
      }
    }
    if (this[OBJECTMODE]) {
      if (this[FLOWING] && this[BUFFERLENGTH] !== 0)
        this[FLUSH](true);
      if (this[FLOWING])
        this.emit("data", chunk);
      else
        this[BUFFERPUSH](chunk);
      if (this[BUFFERLENGTH] !== 0)
        this.emit("readable");
      if (cb)
        fn(cb);
      return this[FLOWING];
    }
    if (!chunk.length) {
      if (this[BUFFERLENGTH] !== 0)
        this.emit("readable");
      if (cb)
        fn(cb);
      return this[FLOWING];
    }
    if (typeof chunk === "string" && // unless it is a string already ready for us to use
    !(encoding === this[ENCODING] && !this[DECODER]?.lastNeed)) {
      chunk = Buffer.from(chunk, encoding);
    }
    if (Buffer.isBuffer(chunk) && this[ENCODING]) {
      chunk = this[DECODER].write(chunk);
    }
    if (this[FLOWING] && this[BUFFERLENGTH] !== 0)
      this[FLUSH](true);
    if (this[FLOWING])
      this.emit("data", chunk);
    else
      this[BUFFERPUSH](chunk);
    if (this[BUFFERLENGTH] !== 0)
      this.emit("readable");
    if (cb)
      fn(cb);
    return this[FLOWING];
  }
  /**
   * Low-level explicit read method.
   *
   * In objectMode, the argument is ignored, and one item is returned if
   * available.
   *
   * `n` is the number of bytes (or in the case of encoding streams,
   * characters) to consume. If `n` is not provided, then the entire buffer
   * is returned, or `null` is returned if no data is available.
   *
   * If `n` is greater that the amount of data in the internal buffer,
   * then `null` is returned.
   */
  read(n) {
    if (this[DESTROYED])
      return null;
    this[DISCARDED] = false;
    if (this[BUFFERLENGTH] === 0 || n === 0 || n && n > this[BUFFERLENGTH]) {
      this[MAYBE_EMIT_END]();
      return null;
    }
    if (this[OBJECTMODE])
      n = null;
    if (this[BUFFER].length > 1 && !this[OBJECTMODE]) {
      this[BUFFER] = [
        this[ENCODING] ? this[BUFFER].join("") : Buffer.concat(this[BUFFER], this[BUFFERLENGTH])
      ];
    }
    const ret = this[READ](n || null, this[BUFFER][0]);
    this[MAYBE_EMIT_END]();
    return ret;
  }
  [READ](n, chunk) {
    if (this[OBJECTMODE])
      this[BUFFERSHIFT]();
    else {
      const c = chunk;
      if (n === c.length || n === null)
        this[BUFFERSHIFT]();
      else if (typeof c === "string") {
        this[BUFFER][0] = c.slice(n);
        chunk = c.slice(0, n);
        this[BUFFERLENGTH] -= n;
      } else {
        this[BUFFER][0] = c.subarray(n);
        chunk = c.subarray(0, n);
        this[BUFFERLENGTH] -= n;
      }
    }
    this.emit("data", chunk);
    if (!this[BUFFER].length && !this[EOF])
      this.emit("drain");
    return chunk;
  }
  end(chunk, encoding, cb) {
    if (typeof chunk === "function") {
      cb = chunk;
      chunk = void 0;
    }
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = "utf8";
    }
    if (chunk !== void 0)
      this.write(chunk, encoding);
    if (cb)
      this.once("end", cb);
    this[EOF] = true;
    this.writable = false;
    if (this[FLOWING] || !this[PAUSED])
      this[MAYBE_EMIT_END]();
    return this;
  }
  // don't let the internal resume be overwritten
  [RESUME]() {
    if (this[DESTROYED])
      return;
    if (!this[DATALISTENERS] && !this[PIPES].length) {
      this[DISCARDED] = true;
    }
    this[PAUSED] = false;
    this[FLOWING] = true;
    this.emit("resume");
    if (this[BUFFER].length)
      this[FLUSH]();
    else if (this[EOF])
      this[MAYBE_EMIT_END]();
    else
      this.emit("drain");
  }
  /**
   * Resume the stream if it is currently in a paused state
   *
   * If called when there are no pipe destinations or `data` event listeners,
   * this will place the stream in a "discarded" state, where all data will
   * be thrown away. The discarded state is removed if a pipe destination or
   * data handler is added, if pause() is called, or if any synchronous or
   * asynchronous iteration is started.
   */
  resume() {
    return this[RESUME]();
  }
  /**
   * Pause the stream
   */
  pause() {
    this[FLOWING] = false;
    this[PAUSED] = true;
    this[DISCARDED] = false;
  }
  /**
   * true if the stream has been forcibly destroyed
   */
  get destroyed() {
    return this[DESTROYED];
  }
  /**
   * true if the stream is currently in a flowing state, meaning that
   * any writes will be immediately emitted.
   */
  get flowing() {
    return this[FLOWING];
  }
  /**
   * true if the stream is currently in a paused state
   */
  get paused() {
    return this[PAUSED];
  }
  [BUFFERPUSH](chunk) {
    if (this[OBJECTMODE])
      this[BUFFERLENGTH] += 1;
    else
      this[BUFFERLENGTH] += chunk.length;
    this[BUFFER].push(chunk);
  }
  [BUFFERSHIFT]() {
    if (this[OBJECTMODE])
      this[BUFFERLENGTH] -= 1;
    else
      this[BUFFERLENGTH] -= this[BUFFER][0].length;
    return this[BUFFER].shift();
  }
  [FLUSH](noDrain = false) {
    do {
    } while (this[FLUSHCHUNK](this[BUFFERSHIFT]()) && this[BUFFER].length);
    if (!noDrain && !this[BUFFER].length && !this[EOF])
      this.emit("drain");
  }
  [FLUSHCHUNK](chunk) {
    this.emit("data", chunk);
    return this[FLOWING];
  }
  /**
   * Pipe all data emitted by this stream into the destination provided.
   *
   * Triggers the flow of data.
   */
  pipe(dest, opts) {
    if (this[DESTROYED])
      return dest;
    this[DISCARDED] = false;
    const ended = this[EMITTED_END];
    opts = opts || {};
    if (dest === proc.stdout || dest === proc.stderr)
      opts.end = false;
    else
      opts.end = opts.end !== false;
    opts.proxyErrors = !!opts.proxyErrors;
    if (ended) {
      if (opts.end)
        dest.end();
    } else {
      this[PIPES].push(!opts.proxyErrors ? new Pipe(this, dest, opts) : new PipeProxyErrors(this, dest, opts));
      if (this[ASYNC])
        defer(() => this[RESUME]());
      else
        this[RESUME]();
    }
    return dest;
  }
  /**
   * Fully unhook a piped destination stream.
   *
   * If the destination stream was the only consumer of this stream (ie,
   * there are no other piped destinations or `'data'` event listeners)
   * then the flow of data will stop until there is another consumer or
   * {@link Minipass#resume} is explicitly called.
   */
  unpipe(dest) {
    const p = this[PIPES].find((p2) => p2.dest === dest);
    if (p) {
      if (this[PIPES].length === 1) {
        if (this[FLOWING] && this[DATALISTENERS] === 0) {
          this[FLOWING] = false;
        }
        this[PIPES] = [];
      } else
        this[PIPES].splice(this[PIPES].indexOf(p), 1);
      p.unpipe();
    }
  }
  /**
   * Alias for {@link Minipass#on}
   */
  addListener(ev, handler) {
    return this.on(ev, handler);
  }
  /**
   * Mostly identical to `EventEmitter.on`, with the following
   * behavior differences to prevent data loss and unnecessary hangs:
   *
   * - Adding a 'data' event handler will trigger the flow of data
   *
   * - Adding a 'readable' event handler when there is data waiting to be read
   *   will cause 'readable' to be emitted immediately.
   *
   * - Adding an 'endish' event handler ('end', 'finish', etc.) which has
   *   already passed will cause the event to be emitted immediately and all
   *   handlers removed.
   *
   * - Adding an 'error' event handler after an error has been emitted will
   *   cause the event to be re-emitted immediately with the error previously
   *   raised.
   */
  on(ev, handler) {
    const ret = super.on(ev, handler);
    if (ev === "data") {
      this[DISCARDED] = false;
      this[DATALISTENERS]++;
      if (!this[PIPES].length && !this[FLOWING]) {
        this[RESUME]();
      }
    } else if (ev === "readable" && this[BUFFERLENGTH] !== 0) {
      super.emit("readable");
    } else if (isEndish(ev) && this[EMITTED_END]) {
      super.emit(ev);
      this.removeAllListeners(ev);
    } else if (ev === "error" && this[EMITTED_ERROR]) {
      const h = handler;
      if (this[ASYNC])
        defer(() => h.call(this, this[EMITTED_ERROR]));
      else
        h.call(this, this[EMITTED_ERROR]);
    }
    return ret;
  }
  /**
   * Alias for {@link Minipass#off}
   */
  removeListener(ev, handler) {
    return this.off(ev, handler);
  }
  /**
   * Mostly identical to `EventEmitter.off`
   *
   * If a 'data' event handler is removed, and it was the last consumer
   * (ie, there are no pipe destinations or other 'data' event listeners),
   * then the flow of data will stop until there is another consumer or
   * {@link Minipass#resume} is explicitly called.
   */
  off(ev, handler) {
    const ret = super.off(ev, handler);
    if (ev === "data") {
      this[DATALISTENERS] = this.listeners("data").length;
      if (this[DATALISTENERS] === 0 && !this[DISCARDED] && !this[PIPES].length) {
        this[FLOWING] = false;
      }
    }
    return ret;
  }
  /**
   * Mostly identical to `EventEmitter.removeAllListeners`
   *
   * If all 'data' event handlers are removed, and they were the last consumer
   * (ie, there are no pipe destinations), then the flow of data will stop
   * until there is another consumer or {@link Minipass#resume} is explicitly
   * called.
   */
  removeAllListeners(ev) {
    const ret = super.removeAllListeners(ev);
    if (ev === "data" || ev === void 0) {
      this[DATALISTENERS] = 0;
      if (!this[DISCARDED] && !this[PIPES].length) {
        this[FLOWING] = false;
      }
    }
    return ret;
  }
  /**
   * true if the 'end' event has been emitted
   */
  get emittedEnd() {
    return this[EMITTED_END];
  }
  [MAYBE_EMIT_END]() {
    if (!this[EMITTING_END] && !this[EMITTED_END] && !this[DESTROYED] && this[BUFFER].length === 0 && this[EOF]) {
      this[EMITTING_END] = true;
      this.emit("end");
      this.emit("prefinish");
      this.emit("finish");
      if (this[CLOSED])
        this.emit("close");
      this[EMITTING_END] = false;
    }
  }
  /**
   * Mostly identical to `EventEmitter.emit`, with the following
   * behavior differences to prevent data loss and unnecessary hangs:
   *
   * If the stream has been destroyed, and the event is something other
   * than 'close' or 'error', then `false` is returned and no handlers
   * are called.
   *
   * If the event is 'end', and has already been emitted, then the event
   * is ignored. If the stream is in a paused or non-flowing state, then
   * the event will be deferred until data flow resumes. If the stream is
   * async, then handlers will be called on the next tick rather than
   * immediately.
   *
   * If the event is 'close', and 'end' has not yet been emitted, then
   * the event will be deferred until after 'end' is emitted.
   *
   * If the event is 'error', and an AbortSignal was provided for the stream,
   * and there are no listeners, then the event is ignored, matching the
   * behavior of node core streams in the presense of an AbortSignal.
   *
   * If the event is 'finish' or 'prefinish', then all listeners will be
   * removed after emitting the event, to prevent double-firing.
   */
  emit(ev, ...args) {
    const data = args[0];
    if (ev !== "error" && ev !== "close" && ev !== DESTROYED && this[DESTROYED]) {
      return false;
    } else if (ev === "data") {
      return !this[OBJECTMODE] && !data ? false : this[ASYNC] ? (defer(() => this[EMITDATA](data)), true) : this[EMITDATA](data);
    } else if (ev === "end") {
      return this[EMITEND]();
    } else if (ev === "close") {
      this[CLOSED] = true;
      if (!this[EMITTED_END] && !this[DESTROYED])
        return false;
      const ret2 = super.emit("close");
      this.removeAllListeners("close");
      return ret2;
    } else if (ev === "error") {
      this[EMITTED_ERROR] = data;
      super.emit(ERROR, data);
      const ret2 = !this[SIGNAL] || this.listeners("error").length ? super.emit("error", data) : false;
      this[MAYBE_EMIT_END]();
      return ret2;
    } else if (ev === "resume") {
      const ret2 = super.emit("resume");
      this[MAYBE_EMIT_END]();
      return ret2;
    } else if (ev === "finish" || ev === "prefinish") {
      const ret2 = super.emit(ev);
      this.removeAllListeners(ev);
      return ret2;
    }
    const ret = super.emit(ev, ...args);
    this[MAYBE_EMIT_END]();
    return ret;
  }
  [EMITDATA](data) {
    for (const p of this[PIPES]) {
      if (p.dest.write(data) === false)
        this.pause();
    }
    const ret = this[DISCARDED] ? false : super.emit("data", data);
    this[MAYBE_EMIT_END]();
    return ret;
  }
  [EMITEND]() {
    if (this[EMITTED_END])
      return false;
    this[EMITTED_END] = true;
    this.readable = false;
    return this[ASYNC] ? (defer(() => this[EMITEND2]()), true) : this[EMITEND2]();
  }
  [EMITEND2]() {
    if (this[DECODER]) {
      const data = this[DECODER].end();
      if (data) {
        for (const p of this[PIPES]) {
          p.dest.write(data);
        }
        if (!this[DISCARDED])
          super.emit("data", data);
      }
    }
    for (const p of this[PIPES]) {
      p.end();
    }
    const ret = super.emit("end");
    this.removeAllListeners("end");
    return ret;
  }
  /**
   * Return a Promise that resolves to an array of all emitted data once
   * the stream ends.
   */
  async collect() {
    const buf = Object.assign([], {
      dataLength: 0
    });
    if (!this[OBJECTMODE])
      buf.dataLength = 0;
    const p = this.promise();
    this.on("data", (c) => {
      buf.push(c);
      if (!this[OBJECTMODE])
        buf.dataLength += c.length;
    });
    await p;
    return buf;
  }
  /**
   * Return a Promise that resolves to the concatenation of all emitted data
   * once the stream ends.
   *
   * Not allowed on objectMode streams.
   */
  async concat() {
    if (this[OBJECTMODE]) {
      throw new Error("cannot concat in objectMode");
    }
    const buf = await this.collect();
    return this[ENCODING] ? buf.join("") : Buffer.concat(buf, buf.dataLength);
  }
  /**
   * Return a void Promise that resolves once the stream ends.
   */
  async promise() {
    return new Promise((resolve, reject) => {
      this.on(DESTROYED, () => reject(new Error("stream destroyed")));
      this.on("error", (er) => reject(er));
      this.on("end", () => resolve());
    });
  }
  /**
   * Asynchronous `for await of` iteration.
   *
   * This will continue emitting all chunks until the stream terminates.
   */
  [Symbol.asyncIterator]() {
    this[DISCARDED] = false;
    let stopped = false;
    const stop = async () => {
      this.pause();
      stopped = true;
      return { value: void 0, done: true };
    };
    const next = () => {
      if (stopped)
        return stop();
      const res = this.read();
      if (res !== null)
        return Promise.resolve({ done: false, value: res });
      if (this[EOF])
        return stop();
      let resolve;
      let reject;
      const onerr = (er) => {
        this.off("data", ondata);
        this.off("end", onend);
        this.off(DESTROYED, ondestroy);
        stop();
        reject(er);
      };
      const ondata = (value) => {
        this.off("error", onerr);
        this.off("end", onend);
        this.off(DESTROYED, ondestroy);
        this.pause();
        resolve({ value, done: !!this[EOF] });
      };
      const onend = () => {
        this.off("error", onerr);
        this.off("data", ondata);
        this.off(DESTROYED, ondestroy);
        stop();
        resolve({ done: true, value: void 0 });
      };
      const ondestroy = () => onerr(new Error("stream destroyed"));
      return new Promise((res2, rej) => {
        reject = rej;
        resolve = res2;
        this.once(DESTROYED, ondestroy);
        this.once("error", onerr);
        this.once("end", onend);
        this.once("data", ondata);
      });
    };
    return {
      next,
      throw: stop,
      return: stop,
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
  /**
   * Synchronous `for of` iteration.
   *
   * The iteration will terminate when the internal buffer runs out, even
   * if the stream has not yet terminated.
   */
  [Symbol.iterator]() {
    this[DISCARDED] = false;
    let stopped = false;
    const stop = () => {
      this.pause();
      this.off(ERROR, stop);
      this.off(DESTROYED, stop);
      this.off("end", stop);
      stopped = true;
      return { done: true, value: void 0 };
    };
    const next = () => {
      if (stopped)
        return stop();
      const value = this.read();
      return value === null ? stop() : { done: false, value };
    };
    this.once("end", stop);
    this.once(ERROR, stop);
    this.once(DESTROYED, stop);
    return {
      next,
      throw: stop,
      return: stop,
      [Symbol.iterator]() {
        return this;
      }
    };
  }
  /**
   * Destroy a stream, preventing it from being used for any further purpose.
   *
   * If the stream has a `close()` method, then it will be called on
   * destruction.
   *
   * After destruction, any attempt to write data, read data, or emit most
   * events will be ignored.
   *
   * If an error argument is provided, then it will be emitted in an
   * 'error' event.
   */
  destroy(er) {
    if (this[DESTROYED]) {
      if (er)
        this.emit("error", er);
      else
        this.emit(DESTROYED);
      return this;
    }
    this[DESTROYED] = true;
    this[DISCARDED] = true;
    this[BUFFER].length = 0;
    this[BUFFERLENGTH] = 0;
    const wc = this;
    if (typeof wc.close === "function" && !this[CLOSED])
      wc.close();
    if (er)
      this.emit("error", er);
    else
      this.emit(DESTROYED);
    return this;
  }
  /**
   * Alias for {@link isStream}
   *
   * Former export location, maintained for backwards compatibility.
   *
   * @deprecated
   */
  static get isStream() {
    return isStream;
  }
};

// ../../node_modules/glob/node_modules/path-scurry/dist/esm/index.js
var realpathSync = rps.native;
var defaultFS = {
  lstatSync,
  readdir: readdirCB,
  readdirSync,
  readlinkSync,
  realpathSync,
  promises: {
    lstat,
    readdir,
    readlink,
    realpath
  }
};
var fsFromOption = (fsOption) => !fsOption || fsOption === defaultFS || fsOption === actualFS ? defaultFS : {
  ...defaultFS,
  ...fsOption,
  promises: {
    ...defaultFS.promises,
    ...fsOption.promises || {}
  }
};
var uncDriveRegexp = /^\\\\\?\\([a-z]:)\\?$/i;
var uncToDrive = (rootPath) => rootPath.replace(/\//g, "\\").replace(uncDriveRegexp, "$1\\");
var eitherSep = /[\\\/]/;
var UNKNOWN = 0;
var IFIFO = 1;
var IFCHR = 2;
var IFDIR = 4;
var IFBLK = 6;
var IFREG = 8;
var IFLNK = 10;
var IFSOCK = 12;
var IFMT = 15;
var IFMT_UNKNOWN = ~IFMT;
var READDIR_CALLED = 16;
var LSTAT_CALLED = 32;
var ENOTDIR = 64;
var ENOENT = 128;
var ENOREADLINK = 256;
var ENOREALPATH = 512;
var ENOCHILD = ENOTDIR | ENOENT | ENOREALPATH;
var TYPEMASK = 1023;
var entToType = (s) => s.isFile() ? IFREG : s.isDirectory() ? IFDIR : s.isSymbolicLink() ? IFLNK : s.isCharacterDevice() ? IFCHR : s.isBlockDevice() ? IFBLK : s.isSocket() ? IFSOCK : s.isFIFO() ? IFIFO : UNKNOWN;
var normalizeCache = /* @__PURE__ */ new Map();
var normalize = (s) => {
  const c = normalizeCache.get(s);
  if (c)
    return c;
  const n = s.normalize("NFKD");
  normalizeCache.set(s, n);
  return n;
};
var normalizeNocaseCache = /* @__PURE__ */ new Map();
var normalizeNocase = (s) => {
  const c = normalizeNocaseCache.get(s);
  if (c)
    return c;
  const n = normalize(s.toLowerCase());
  normalizeNocaseCache.set(s, n);
  return n;
};
var ResolveCache = class extends LRUCache {
  constructor() {
    super({ max: 256 });
  }
};
var ChildrenCache = class extends LRUCache {
  constructor(maxSize = 16 * 1024) {
    super({
      maxSize,
      // parent + children
      sizeCalculation: (a) => a.length + 1
    });
  }
};
var setAsCwd = Symbol("PathScurry setAsCwd");
var PathBase = class {
  /**
   * the basename of this path
   *
   * **Important**: *always* test the path name against any test string
   * usingthe {@link isNamed} method, and not by directly comparing this
   * string. Otherwise, unicode path strings that the system sees as identical
   * will not be properly treated as the same path, leading to incorrect
   * behavior and possible security issues.
   */
  name;
  /**
   * the Path entry corresponding to the path root.
   *
   * @internal
   */
  root;
  /**
   * All roots found within the current PathScurry family
   *
   * @internal
   */
  roots;
  /**
   * a reference to the parent path, or undefined in the case of root entries
   *
   * @internal
   */
  parent;
  /**
   * boolean indicating whether paths are compared case-insensitively
   * @internal
   */
  nocase;
  /**
   * boolean indicating that this path is the current working directory
   * of the PathScurry collection that contains it.
   */
  isCWD = false;
  // potential default fs override
  #fs;
  // Stats fields
  #dev;
  get dev() {
    return this.#dev;
  }
  #mode;
  get mode() {
    return this.#mode;
  }
  #nlink;
  get nlink() {
    return this.#nlink;
  }
  #uid;
  get uid() {
    return this.#uid;
  }
  #gid;
  get gid() {
    return this.#gid;
  }
  #rdev;
  get rdev() {
    return this.#rdev;
  }
  #blksize;
  get blksize() {
    return this.#blksize;
  }
  #ino;
  get ino() {
    return this.#ino;
  }
  #size;
  get size() {
    return this.#size;
  }
  #blocks;
  get blocks() {
    return this.#blocks;
  }
  #atimeMs;
  get atimeMs() {
    return this.#atimeMs;
  }
  #mtimeMs;
  get mtimeMs() {
    return this.#mtimeMs;
  }
  #ctimeMs;
  get ctimeMs() {
    return this.#ctimeMs;
  }
  #birthtimeMs;
  get birthtimeMs() {
    return this.#birthtimeMs;
  }
  #atime;
  get atime() {
    return this.#atime;
  }
  #mtime;
  get mtime() {
    return this.#mtime;
  }
  #ctime;
  get ctime() {
    return this.#ctime;
  }
  #birthtime;
  get birthtime() {
    return this.#birthtime;
  }
  #matchName;
  #depth;
  #fullpath;
  #fullpathPosix;
  #relative;
  #relativePosix;
  #type;
  #children;
  #linkTarget;
  #realpath;
  /**
   * This property is for compatibility with the Dirent class as of
   * Node v20, where Dirent['parentPath'] refers to the path of the
   * directory that was passed to readdir. For root entries, it's the path
   * to the entry itself.
   */
  get parentPath() {
    return (this.parent || this).fullpath();
  }
  /**
   * Deprecated alias for Dirent['parentPath'] Somewhat counterintuitively,
   * this property refers to the *parent* path, not the path object itself.
   *
   * @deprecated
   */
  get path() {
    return this.parentPath;
  }
  /**
   * Do not create new Path objects directly.  They should always be accessed
   * via the PathScurry class or other methods on the Path class.
   *
   * @internal
   */
  constructor(name, type = UNKNOWN, root, roots, nocase, children, opts) {
    this.name = name;
    this.#matchName = nocase ? normalizeNocase(name) : normalize(name);
    this.#type = type & TYPEMASK;
    this.nocase = nocase;
    this.roots = roots;
    this.root = root || this;
    this.#children = children;
    this.#fullpath = opts.fullpath;
    this.#relative = opts.relative;
    this.#relativePosix = opts.relativePosix;
    this.parent = opts.parent;
    if (this.parent) {
      this.#fs = this.parent.#fs;
    } else {
      this.#fs = fsFromOption(opts.fs);
    }
  }
  /**
   * Returns the depth of the Path object from its root.
   *
   * For example, a path at `/foo/bar` would have a depth of 2.
   */
  depth() {
    if (this.#depth !== void 0)
      return this.#depth;
    if (!this.parent)
      return this.#depth = 0;
    return this.#depth = this.parent.depth() + 1;
  }
  /**
   * @internal
   */
  childrenCache() {
    return this.#children;
  }
  /**
   * Get the Path object referenced by the string path, resolved from this Path
   */
  resolve(path2) {
    if (!path2) {
      return this;
    }
    const rootPath = this.getRootString(path2);
    const dir = path2.substring(rootPath.length);
    const dirParts = dir.split(this.splitSep);
    const result = rootPath ? this.getRoot(rootPath).#resolveParts(dirParts) : this.#resolveParts(dirParts);
    return result;
  }
  #resolveParts(dirParts) {
    let p = this;
    for (const part of dirParts) {
      p = p.child(part);
    }
    return p;
  }
  /**
   * Returns the cached children Path objects, if still available.  If they
   * have fallen out of the cache, then returns an empty array, and resets the
   * READDIR_CALLED bit, so that future calls to readdir() will require an fs
   * lookup.
   *
   * @internal
   */
  children() {
    const cached = this.#children.get(this);
    if (cached) {
      return cached;
    }
    const children = Object.assign([], { provisional: 0 });
    this.#children.set(this, children);
    this.#type &= ~READDIR_CALLED;
    return children;
  }
  /**
   * Resolves a path portion and returns or creates the child Path.
   *
   * Returns `this` if pathPart is `''` or `'.'`, or `parent` if pathPart is
   * `'..'`.
   *
   * This should not be called directly.  If `pathPart` contains any path
   * separators, it will lead to unsafe undefined behavior.
   *
   * Use `Path.resolve()` instead.
   *
   * @internal
   */
  child(pathPart, opts) {
    if (pathPart === "" || pathPart === ".") {
      return this;
    }
    if (pathPart === "..") {
      return this.parent || this;
    }
    const children = this.children();
    const name = this.nocase ? normalizeNocase(pathPart) : normalize(pathPart);
    for (const p of children) {
      if (p.#matchName === name) {
        return p;
      }
    }
    const s = this.parent ? this.sep : "";
    const fullpath = this.#fullpath ? this.#fullpath + s + pathPart : void 0;
    const pchild = this.newChild(pathPart, UNKNOWN, {
      ...opts,
      parent: this,
      fullpath
    });
    if (!this.canReaddir()) {
      pchild.#type |= ENOENT;
    }
    children.push(pchild);
    return pchild;
  }
  /**
   * The relative path from the cwd. If it does not share an ancestor with
   * the cwd, then this ends up being equivalent to the fullpath()
   */
  relative() {
    if (this.isCWD)
      return "";
    if (this.#relative !== void 0) {
      return this.#relative;
    }
    const name = this.name;
    const p = this.parent;
    if (!p) {
      return this.#relative = this.name;
    }
    const pv = p.relative();
    return pv + (!pv || !p.parent ? "" : this.sep) + name;
  }
  /**
   * The relative path from the cwd, using / as the path separator.
   * If it does not share an ancestor with
   * the cwd, then this ends up being equivalent to the fullpathPosix()
   * On posix systems, this is identical to relative().
   */
  relativePosix() {
    if (this.sep === "/")
      return this.relative();
    if (this.isCWD)
      return "";
    if (this.#relativePosix !== void 0)
      return this.#relativePosix;
    const name = this.name;
    const p = this.parent;
    if (!p) {
      return this.#relativePosix = this.fullpathPosix();
    }
    const pv = p.relativePosix();
    return pv + (!pv || !p.parent ? "" : "/") + name;
  }
  /**
   * The fully resolved path string for this Path entry
   */
  fullpath() {
    if (this.#fullpath !== void 0) {
      return this.#fullpath;
    }
    const name = this.name;
    const p = this.parent;
    if (!p) {
      return this.#fullpath = this.name;
    }
    const pv = p.fullpath();
    const fp = pv + (!p.parent ? "" : this.sep) + name;
    return this.#fullpath = fp;
  }
  /**
   * On platforms other than windows, this is identical to fullpath.
   *
   * On windows, this is overridden to return the forward-slash form of the
   * full UNC path.
   */
  fullpathPosix() {
    if (this.#fullpathPosix !== void 0)
      return this.#fullpathPosix;
    if (this.sep === "/")
      return this.#fullpathPosix = this.fullpath();
    if (!this.parent) {
      const p2 = this.fullpath().replace(/\\/g, "/");
      if (/^[a-z]:\//i.test(p2)) {
        return this.#fullpathPosix = `//?/${p2}`;
      } else {
        return this.#fullpathPosix = p2;
      }
    }
    const p = this.parent;
    const pfpp = p.fullpathPosix();
    const fpp = pfpp + (!pfpp || !p.parent ? "" : "/") + this.name;
    return this.#fullpathPosix = fpp;
  }
  /**
   * Is the Path of an unknown type?
   *
   * Note that we might know *something* about it if there has been a previous
   * filesystem operation, for example that it does not exist, or is not a
   * link, or whether it has child entries.
   */
  isUnknown() {
    return (this.#type & IFMT) === UNKNOWN;
  }
  isType(type) {
    return this[`is${type}`]();
  }
  getType() {
    return this.isUnknown() ? "Unknown" : this.isDirectory() ? "Directory" : this.isFile() ? "File" : this.isSymbolicLink() ? "SymbolicLink" : this.isFIFO() ? "FIFO" : this.isCharacterDevice() ? "CharacterDevice" : this.isBlockDevice() ? "BlockDevice" : (
      /* c8 ignore start */
      this.isSocket() ? "Socket" : "Unknown"
    );
  }
  /**
   * Is the Path a regular file?
   */
  isFile() {
    return (this.#type & IFMT) === IFREG;
  }
  /**
   * Is the Path a directory?
   */
  isDirectory() {
    return (this.#type & IFMT) === IFDIR;
  }
  /**
   * Is the path a character device?
   */
  isCharacterDevice() {
    return (this.#type & IFMT) === IFCHR;
  }
  /**
   * Is the path a block device?
   */
  isBlockDevice() {
    return (this.#type & IFMT) === IFBLK;
  }
  /**
   * Is the path a FIFO pipe?
   */
  isFIFO() {
    return (this.#type & IFMT) === IFIFO;
  }
  /**
   * Is the path a socket?
   */
  isSocket() {
    return (this.#type & IFMT) === IFSOCK;
  }
  /**
   * Is the path a symbolic link?
   */
  isSymbolicLink() {
    return (this.#type & IFLNK) === IFLNK;
  }
  /**
   * Return the entry if it has been subject of a successful lstat, or
   * undefined otherwise.
   *
   * Does not read the filesystem, so an undefined result *could* simply
   * mean that we haven't called lstat on it.
   */
  lstatCached() {
    return this.#type & LSTAT_CALLED ? this : void 0;
  }
  /**
   * Return the cached link target if the entry has been the subject of a
   * successful readlink, or undefined otherwise.
   *
   * Does not read the filesystem, so an undefined result *could* just mean we
   * don't have any cached data. Only use it if you are very sure that a
   * readlink() has been called at some point.
   */
  readlinkCached() {
    return this.#linkTarget;
  }
  /**
   * Returns the cached realpath target if the entry has been the subject
   * of a successful realpath, or undefined otherwise.
   *
   * Does not read the filesystem, so an undefined result *could* just mean we
   * don't have any cached data. Only use it if you are very sure that a
   * realpath() has been called at some point.
   */
  realpathCached() {
    return this.#realpath;
  }
  /**
   * Returns the cached child Path entries array if the entry has been the
   * subject of a successful readdir(), or [] otherwise.
   *
   * Does not read the filesystem, so an empty array *could* just mean we
   * don't have any cached data. Only use it if you are very sure that a
   * readdir() has been called recently enough to still be valid.
   */
  readdirCached() {
    const children = this.children();
    return children.slice(0, children.provisional);
  }
  /**
   * Return true if it's worth trying to readlink.  Ie, we don't (yet) have
   * any indication that readlink will definitely fail.
   *
   * Returns false if the path is known to not be a symlink, if a previous
   * readlink failed, or if the entry does not exist.
   */
  canReadlink() {
    if (this.#linkTarget)
      return true;
    if (!this.parent)
      return false;
    const ifmt = this.#type & IFMT;
    return !(ifmt !== UNKNOWN && ifmt !== IFLNK || this.#type & ENOREADLINK || this.#type & ENOENT);
  }
  /**
   * Return true if readdir has previously been successfully called on this
   * path, indicating that cachedReaddir() is likely valid.
   */
  calledReaddir() {
    return !!(this.#type & READDIR_CALLED);
  }
  /**
   * Returns true if the path is known to not exist. That is, a previous lstat
   * or readdir failed to verify its existence when that would have been
   * expected, or a parent entry was marked either enoent or enotdir.
   */
  isENOENT() {
    return !!(this.#type & ENOENT);
  }
  /**
   * Return true if the path is a match for the given path name.  This handles
   * case sensitivity and unicode normalization.
   *
   * Note: even on case-sensitive systems, it is **not** safe to test the
   * equality of the `.name` property to determine whether a given pathname
   * matches, due to unicode normalization mismatches.
   *
   * Always use this method instead of testing the `path.name` property
   * directly.
   */
  isNamed(n) {
    return !this.nocase ? this.#matchName === normalize(n) : this.#matchName === normalizeNocase(n);
  }
  /**
   * Return the Path object corresponding to the target of a symbolic link.
   *
   * If the Path is not a symbolic link, or if the readlink call fails for any
   * reason, `undefined` is returned.
   *
   * Result is cached, and thus may be outdated if the filesystem is mutated.
   */
  async readlink() {
    const target = this.#linkTarget;
    if (target) {
      return target;
    }
    if (!this.canReadlink()) {
      return void 0;
    }
    if (!this.parent) {
      return void 0;
    }
    try {
      const read = await this.#fs.promises.readlink(this.fullpath());
      const linkTarget = (await this.parent.realpath())?.resolve(read);
      if (linkTarget) {
        return this.#linkTarget = linkTarget;
      }
    } catch (er) {
      this.#readlinkFail(er.code);
      return void 0;
    }
  }
  /**
   * Synchronous {@link PathBase.readlink}
   */
  readlinkSync() {
    const target = this.#linkTarget;
    if (target) {
      return target;
    }
    if (!this.canReadlink()) {
      return void 0;
    }
    if (!this.parent) {
      return void 0;
    }
    try {
      const read = this.#fs.readlinkSync(this.fullpath());
      const linkTarget = this.parent.realpathSync()?.resolve(read);
      if (linkTarget) {
        return this.#linkTarget = linkTarget;
      }
    } catch (er) {
      this.#readlinkFail(er.code);
      return void 0;
    }
  }
  #readdirSuccess(children) {
    this.#type |= READDIR_CALLED;
    for (let p = children.provisional; p < children.length; p++) {
      const c = children[p];
      if (c)
        c.#markENOENT();
    }
  }
  #markENOENT() {
    if (this.#type & ENOENT)
      return;
    this.#type = (this.#type | ENOENT) & IFMT_UNKNOWN;
    this.#markChildrenENOENT();
  }
  #markChildrenENOENT() {
    const children = this.children();
    children.provisional = 0;
    for (const p of children) {
      p.#markENOENT();
    }
  }
  #markENOREALPATH() {
    this.#type |= ENOREALPATH;
    this.#markENOTDIR();
  }
  // save the information when we know the entry is not a dir
  #markENOTDIR() {
    if (this.#type & ENOTDIR)
      return;
    let t = this.#type;
    if ((t & IFMT) === IFDIR)
      t &= IFMT_UNKNOWN;
    this.#type = t | ENOTDIR;
    this.#markChildrenENOENT();
  }
  #readdirFail(code = "") {
    if (code === "ENOTDIR" || code === "EPERM") {
      this.#markENOTDIR();
    } else if (code === "ENOENT") {
      this.#markENOENT();
    } else {
      this.children().provisional = 0;
    }
  }
  #lstatFail(code = "") {
    if (code === "ENOTDIR") {
      const p = this.parent;
      p.#markENOTDIR();
    } else if (code === "ENOENT") {
      this.#markENOENT();
    }
  }
  #readlinkFail(code = "") {
    let ter = this.#type;
    ter |= ENOREADLINK;
    if (code === "ENOENT")
      ter |= ENOENT;
    if (code === "EINVAL" || code === "UNKNOWN") {
      ter &= IFMT_UNKNOWN;
    }
    this.#type = ter;
    if (code === "ENOTDIR" && this.parent) {
      this.parent.#markENOTDIR();
    }
  }
  #readdirAddChild(e, c) {
    return this.#readdirMaybePromoteChild(e, c) || this.#readdirAddNewChild(e, c);
  }
  #readdirAddNewChild(e, c) {
    const type = entToType(e);
    const child = this.newChild(e.name, type, { parent: this });
    const ifmt = child.#type & IFMT;
    if (ifmt !== IFDIR && ifmt !== IFLNK && ifmt !== UNKNOWN) {
      child.#type |= ENOTDIR;
    }
    c.unshift(child);
    c.provisional++;
    return child;
  }
  #readdirMaybePromoteChild(e, c) {
    for (let p = c.provisional; p < c.length; p++) {
      const pchild = c[p];
      const name = this.nocase ? normalizeNocase(e.name) : normalize(e.name);
      if (name !== pchild.#matchName) {
        continue;
      }
      return this.#readdirPromoteChild(e, pchild, p, c);
    }
  }
  #readdirPromoteChild(e, p, index, c) {
    const v = p.name;
    p.#type = p.#type & IFMT_UNKNOWN | entToType(e);
    if (v !== e.name)
      p.name = e.name;
    if (index !== c.provisional) {
      if (index === c.length - 1)
        c.pop();
      else
        c.splice(index, 1);
      c.unshift(p);
    }
    c.provisional++;
    return p;
  }
  /**
   * Call lstat() on this Path, and update all known information that can be
   * determined.
   *
   * Note that unlike `fs.lstat()`, the returned value does not contain some
   * information, such as `mode`, `dev`, `nlink`, and `ino`.  If that
   * information is required, you will need to call `fs.lstat` yourself.
   *
   * If the Path refers to a nonexistent file, or if the lstat call fails for
   * any reason, `undefined` is returned.  Otherwise the updated Path object is
   * returned.
   *
   * Results are cached, and thus may be out of date if the filesystem is
   * mutated.
   */
  async lstat() {
    if ((this.#type & ENOENT) === 0) {
      try {
        this.#applyStat(await this.#fs.promises.lstat(this.fullpath()));
        return this;
      } catch (er) {
        this.#lstatFail(er.code);
      }
    }
  }
  /**
   * synchronous {@link PathBase.lstat}
   */
  lstatSync() {
    if ((this.#type & ENOENT) === 0) {
      try {
        this.#applyStat(this.#fs.lstatSync(this.fullpath()));
        return this;
      } catch (er) {
        this.#lstatFail(er.code);
      }
    }
  }
  #applyStat(st) {
    const { atime, atimeMs, birthtime, birthtimeMs, blksize, blocks, ctime, ctimeMs, dev, gid, ino, mode, mtime, mtimeMs, nlink, rdev, size, uid } = st;
    this.#atime = atime;
    this.#atimeMs = atimeMs;
    this.#birthtime = birthtime;
    this.#birthtimeMs = birthtimeMs;
    this.#blksize = blksize;
    this.#blocks = blocks;
    this.#ctime = ctime;
    this.#ctimeMs = ctimeMs;
    this.#dev = dev;
    this.#gid = gid;
    this.#ino = ino;
    this.#mode = mode;
    this.#mtime = mtime;
    this.#mtimeMs = mtimeMs;
    this.#nlink = nlink;
    this.#rdev = rdev;
    this.#size = size;
    this.#uid = uid;
    const ifmt = entToType(st);
    this.#type = this.#type & IFMT_UNKNOWN | ifmt | LSTAT_CALLED;
    if (ifmt !== UNKNOWN && ifmt !== IFDIR && ifmt !== IFLNK) {
      this.#type |= ENOTDIR;
    }
  }
  #onReaddirCB = [];
  #readdirCBInFlight = false;
  #callOnReaddirCB(children) {
    this.#readdirCBInFlight = false;
    const cbs = this.#onReaddirCB.slice();
    this.#onReaddirCB.length = 0;
    cbs.forEach((cb) => cb(null, children));
  }
  /**
   * Standard node-style callback interface to get list of directory entries.
   *
   * If the Path cannot or does not contain any children, then an empty array
   * is returned.
   *
   * Results are cached, and thus may be out of date if the filesystem is
   * mutated.
   *
   * @param cb The callback called with (er, entries).  Note that the `er`
   * param is somewhat extraneous, as all readdir() errors are handled and
   * simply result in an empty set of entries being returned.
   * @param allowZalgo Boolean indicating that immediately known results should
   * *not* be deferred with `queueMicrotask`. Defaults to `false`. Release
   * zalgo at your peril, the dark pony lord is devious and unforgiving.
   */
  readdirCB(cb, allowZalgo = false) {
    if (!this.canReaddir()) {
      if (allowZalgo)
        cb(null, []);
      else
        queueMicrotask(() => cb(null, []));
      return;
    }
    const children = this.children();
    if (this.calledReaddir()) {
      const c = children.slice(0, children.provisional);
      if (allowZalgo)
        cb(null, c);
      else
        queueMicrotask(() => cb(null, c));
      return;
    }
    this.#onReaddirCB.push(cb);
    if (this.#readdirCBInFlight) {
      return;
    }
    this.#readdirCBInFlight = true;
    const fullpath = this.fullpath();
    this.#fs.readdir(fullpath, { withFileTypes: true }, (er, entries) => {
      if (er) {
        this.#readdirFail(er.code);
        children.provisional = 0;
      } else {
        for (const e of entries) {
          this.#readdirAddChild(e, children);
        }
        this.#readdirSuccess(children);
      }
      this.#callOnReaddirCB(children.slice(0, children.provisional));
      return;
    });
  }
  #asyncReaddirInFlight;
  /**
   * Return an array of known child entries.
   *
   * If the Path cannot or does not contain any children, then an empty array
   * is returned.
   *
   * Results are cached, and thus may be out of date if the filesystem is
   * mutated.
   */
  async readdir() {
    if (!this.canReaddir()) {
      return [];
    }
    const children = this.children();
    if (this.calledReaddir()) {
      return children.slice(0, children.provisional);
    }
    const fullpath = this.fullpath();
    if (this.#asyncReaddirInFlight) {
      await this.#asyncReaddirInFlight;
    } else {
      let resolve = () => {
      };
      this.#asyncReaddirInFlight = new Promise((res) => resolve = res);
      try {
        for (const e of await this.#fs.promises.readdir(fullpath, {
          withFileTypes: true
        })) {
          this.#readdirAddChild(e, children);
        }
        this.#readdirSuccess(children);
      } catch (er) {
        this.#readdirFail(er.code);
        children.provisional = 0;
      }
      this.#asyncReaddirInFlight = void 0;
      resolve();
    }
    return children.slice(0, children.provisional);
  }
  /**
   * synchronous {@link PathBase.readdir}
   */
  readdirSync() {
    if (!this.canReaddir()) {
      return [];
    }
    const children = this.children();
    if (this.calledReaddir()) {
      return children.slice(0, children.provisional);
    }
    const fullpath = this.fullpath();
    try {
      for (const e of this.#fs.readdirSync(fullpath, {
        withFileTypes: true
      })) {
        this.#readdirAddChild(e, children);
      }
      this.#readdirSuccess(children);
    } catch (er) {
      this.#readdirFail(er.code);
      children.provisional = 0;
    }
    return children.slice(0, children.provisional);
  }
  canReaddir() {
    if (this.#type & ENOCHILD)
      return false;
    const ifmt = IFMT & this.#type;
    if (!(ifmt === UNKNOWN || ifmt === IFDIR || ifmt === IFLNK)) {
      return false;
    }
    return true;
  }
  shouldWalk(dirs, walkFilter) {
    return (this.#type & IFDIR) === IFDIR && !(this.#type & ENOCHILD) && !dirs.has(this) && (!walkFilter || walkFilter(this));
  }
  /**
   * Return the Path object corresponding to path as resolved
   * by realpath(3).
   *
   * If the realpath call fails for any reason, `undefined` is returned.
   *
   * Result is cached, and thus may be outdated if the filesystem is mutated.
   * On success, returns a Path object.
   */
  async realpath() {
    if (this.#realpath)
      return this.#realpath;
    if ((ENOREALPATH | ENOREADLINK | ENOENT) & this.#type)
      return void 0;
    try {
      const rp = await this.#fs.promises.realpath(this.fullpath());
      return this.#realpath = this.resolve(rp);
    } catch (_) {
      this.#markENOREALPATH();
    }
  }
  /**
   * Synchronous {@link realpath}
   */
  realpathSync() {
    if (this.#realpath)
      return this.#realpath;
    if ((ENOREALPATH | ENOREADLINK | ENOENT) & this.#type)
      return void 0;
    try {
      const rp = this.#fs.realpathSync(this.fullpath());
      return this.#realpath = this.resolve(rp);
    } catch (_) {
      this.#markENOREALPATH();
    }
  }
  /**
   * Internal method to mark this Path object as the scurry cwd,
   * called by {@link PathScurry#chdir}
   *
   * @internal
   */
  [setAsCwd](oldCwd) {
    if (oldCwd === this)
      return;
    oldCwd.isCWD = false;
    this.isCWD = true;
    const changed = /* @__PURE__ */ new Set([]);
    let rp = [];
    let p = this;
    while (p && p.parent) {
      changed.add(p);
      p.#relative = rp.join(this.sep);
      p.#relativePosix = rp.join("/");
      p = p.parent;
      rp.push("..");
    }
    p = oldCwd;
    while (p && p.parent && !changed.has(p)) {
      p.#relative = void 0;
      p.#relativePosix = void 0;
      p = p.parent;
    }
  }
};
var PathWin32 = class _PathWin32 extends PathBase {
  /**
   * Separator for generating path strings.
   */
  sep = "\\";
  /**
   * Separator for parsing path strings.
   */
  splitSep = eitherSep;
  /**
   * Do not create new Path objects directly.  They should always be accessed
   * via the PathScurry class or other methods on the Path class.
   *
   * @internal
   */
  constructor(name, type = UNKNOWN, root, roots, nocase, children, opts) {
    super(name, type, root, roots, nocase, children, opts);
  }
  /**
   * @internal
   */
  newChild(name, type = UNKNOWN, opts = {}) {
    return new _PathWin32(name, type, this.root, this.roots, this.nocase, this.childrenCache(), opts);
  }
  /**
   * @internal
   */
  getRootString(path2) {
    return win32.parse(path2).root;
  }
  /**
   * @internal
   */
  getRoot(rootPath) {
    rootPath = uncToDrive(rootPath.toUpperCase());
    if (rootPath === this.root.name) {
      return this.root;
    }
    for (const [compare, root] of Object.entries(this.roots)) {
      if (this.sameRoot(rootPath, compare)) {
        return this.roots[rootPath] = root;
      }
    }
    return this.roots[rootPath] = new PathScurryWin32(rootPath, this).root;
  }
  /**
   * @internal
   */
  sameRoot(rootPath, compare = this.root.name) {
    rootPath = rootPath.toUpperCase().replace(/\//g, "\\").replace(uncDriveRegexp, "$1\\");
    return rootPath === compare;
  }
};
var PathPosix = class _PathPosix extends PathBase {
  /**
   * separator for parsing path strings
   */
  splitSep = "/";
  /**
   * separator for generating path strings
   */
  sep = "/";
  /**
   * Do not create new Path objects directly.  They should always be accessed
   * via the PathScurry class or other methods on the Path class.
   *
   * @internal
   */
  constructor(name, type = UNKNOWN, root, roots, nocase, children, opts) {
    super(name, type, root, roots, nocase, children, opts);
  }
  /**
   * @internal
   */
  getRootString(path2) {
    return path2.startsWith("/") ? "/" : "";
  }
  /**
   * @internal
   */
  getRoot(_rootPath) {
    return this.root;
  }
  /**
   * @internal
   */
  newChild(name, type = UNKNOWN, opts = {}) {
    return new _PathPosix(name, type, this.root, this.roots, this.nocase, this.childrenCache(), opts);
  }
};
var PathScurryBase = class {
  /**
   * The root Path entry for the current working directory of this Scurry
   */
  root;
  /**
   * The string path for the root of this Scurry's current working directory
   */
  rootPath;
  /**
   * A collection of all roots encountered, referenced by rootPath
   */
  roots;
  /**
   * The Path entry corresponding to this PathScurry's current working directory.
   */
  cwd;
  #resolveCache;
  #resolvePosixCache;
  #children;
  /**
   * Perform path comparisons case-insensitively.
   *
   * Defaults true on Darwin and Windows systems, false elsewhere.
   */
  nocase;
  #fs;
  /**
   * This class should not be instantiated directly.
   *
   * Use PathScurryWin32, PathScurryDarwin, PathScurryPosix, or PathScurry
   *
   * @internal
   */
  constructor(cwd = process.cwd(), pathImpl, sep2, { nocase, childrenCacheSize = 16 * 1024, fs: fs2 = defaultFS } = {}) {
    this.#fs = fsFromOption(fs2);
    if (cwd instanceof URL || cwd.startsWith("file://")) {
      cwd = fileURLToPath(cwd);
    }
    const cwdPath = pathImpl.resolve(cwd);
    this.roots = /* @__PURE__ */ Object.create(null);
    this.rootPath = this.parseRootPath(cwdPath);
    this.#resolveCache = new ResolveCache();
    this.#resolvePosixCache = new ResolveCache();
    this.#children = new ChildrenCache(childrenCacheSize);
    const split = cwdPath.substring(this.rootPath.length).split(sep2);
    if (split.length === 1 && !split[0]) {
      split.pop();
    }
    if (nocase === void 0) {
      throw new TypeError("must provide nocase setting to PathScurryBase ctor");
    }
    this.nocase = nocase;
    this.root = this.newRoot(this.#fs);
    this.roots[this.rootPath] = this.root;
    let prev = this.root;
    let len = split.length - 1;
    const joinSep = pathImpl.sep;
    let abs = this.rootPath;
    let sawFirst = false;
    for (const part of split) {
      const l = len--;
      prev = prev.child(part, {
        relative: new Array(l).fill("..").join(joinSep),
        relativePosix: new Array(l).fill("..").join("/"),
        fullpath: abs += (sawFirst ? "" : joinSep) + part
      });
      sawFirst = true;
    }
    this.cwd = prev;
  }
  /**
   * Get the depth of a provided path, string, or the cwd
   */
  depth(path2 = this.cwd) {
    if (typeof path2 === "string") {
      path2 = this.cwd.resolve(path2);
    }
    return path2.depth();
  }
  /**
   * Return the cache of child entries.  Exposed so subclasses can create
   * child Path objects in a platform-specific way.
   *
   * @internal
   */
  childrenCache() {
    return this.#children;
  }
  /**
   * Resolve one or more path strings to a resolved string
   *
   * Same interface as require('path').resolve.
   *
   * Much faster than path.resolve() when called multiple times for the same
   * path, because the resolved Path objects are cached.  Much slower
   * otherwise.
   */
  resolve(...paths) {
    let r = "";
    for (let i = paths.length - 1; i >= 0; i--) {
      const p = paths[i];
      if (!p || p === ".")
        continue;
      r = r ? `${p}/${r}` : p;
      if (this.isAbsolute(p)) {
        break;
      }
    }
    const cached = this.#resolveCache.get(r);
    if (cached !== void 0) {
      return cached;
    }
    const result = this.cwd.resolve(r).fullpath();
    this.#resolveCache.set(r, result);
    return result;
  }
  /**
   * Resolve one or more path strings to a resolved string, returning
   * the posix path.  Identical to .resolve() on posix systems, but on
   * windows will return a forward-slash separated UNC path.
   *
   * Same interface as require('path').resolve.
   *
   * Much faster than path.resolve() when called multiple times for the same
   * path, because the resolved Path objects are cached.  Much slower
   * otherwise.
   */
  resolvePosix(...paths) {
    let r = "";
    for (let i = paths.length - 1; i >= 0; i--) {
      const p = paths[i];
      if (!p || p === ".")
        continue;
      r = r ? `${p}/${r}` : p;
      if (this.isAbsolute(p)) {
        break;
      }
    }
    const cached = this.#resolvePosixCache.get(r);
    if (cached !== void 0) {
      return cached;
    }
    const result = this.cwd.resolve(r).fullpathPosix();
    this.#resolvePosixCache.set(r, result);
    return result;
  }
  /**
   * find the relative path from the cwd to the supplied path string or entry
   */
  relative(entry = this.cwd) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    }
    return entry.relative();
  }
  /**
   * find the relative path from the cwd to the supplied path string or
   * entry, using / as the path delimiter, even on Windows.
   */
  relativePosix(entry = this.cwd) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    }
    return entry.relativePosix();
  }
  /**
   * Return the basename for the provided string or Path object
   */
  basename(entry = this.cwd) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    }
    return entry.name;
  }
  /**
   * Return the dirname for the provided string or Path object
   */
  dirname(entry = this.cwd) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    }
    return (entry.parent || entry).fullpath();
  }
  async readdir(entry = this.cwd, opts = {
    withFileTypes: true
  }) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      opts = entry;
      entry = this.cwd;
    }
    const { withFileTypes } = opts;
    if (!entry.canReaddir()) {
      return [];
    } else {
      const p = await entry.readdir();
      return withFileTypes ? p : p.map((e) => e.name);
    }
  }
  readdirSync(entry = this.cwd, opts = {
    withFileTypes: true
  }) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      opts = entry;
      entry = this.cwd;
    }
    const { withFileTypes = true } = opts;
    if (!entry.canReaddir()) {
      return [];
    } else if (withFileTypes) {
      return entry.readdirSync();
    } else {
      return entry.readdirSync().map((e) => e.name);
    }
  }
  /**
   * Call lstat() on the string or Path object, and update all known
   * information that can be determined.
   *
   * Note that unlike `fs.lstat()`, the returned value does not contain some
   * information, such as `mode`, `dev`, `nlink`, and `ino`.  If that
   * information is required, you will need to call `fs.lstat` yourself.
   *
   * If the Path refers to a nonexistent file, or if the lstat call fails for
   * any reason, `undefined` is returned.  Otherwise the updated Path object is
   * returned.
   *
   * Results are cached, and thus may be out of date if the filesystem is
   * mutated.
   */
  async lstat(entry = this.cwd) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    }
    return entry.lstat();
  }
  /**
   * synchronous {@link PathScurryBase.lstat}
   */
  lstatSync(entry = this.cwd) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    }
    return entry.lstatSync();
  }
  async readlink(entry = this.cwd, { withFileTypes } = {
    withFileTypes: false
  }) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      withFileTypes = entry.withFileTypes;
      entry = this.cwd;
    }
    const e = await entry.readlink();
    return withFileTypes ? e : e?.fullpath();
  }
  readlinkSync(entry = this.cwd, { withFileTypes } = {
    withFileTypes: false
  }) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      withFileTypes = entry.withFileTypes;
      entry = this.cwd;
    }
    const e = entry.readlinkSync();
    return withFileTypes ? e : e?.fullpath();
  }
  async realpath(entry = this.cwd, { withFileTypes } = {
    withFileTypes: false
  }) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      withFileTypes = entry.withFileTypes;
      entry = this.cwd;
    }
    const e = await entry.realpath();
    return withFileTypes ? e : e?.fullpath();
  }
  realpathSync(entry = this.cwd, { withFileTypes } = {
    withFileTypes: false
  }) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      withFileTypes = entry.withFileTypes;
      entry = this.cwd;
    }
    const e = entry.realpathSync();
    return withFileTypes ? e : e?.fullpath();
  }
  async walk(entry = this.cwd, opts = {}) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      opts = entry;
      entry = this.cwd;
    }
    const { withFileTypes = true, follow = false, filter: filter2, walkFilter } = opts;
    const results = [];
    if (!filter2 || filter2(entry)) {
      results.push(withFileTypes ? entry : entry.fullpath());
    }
    const dirs = /* @__PURE__ */ new Set();
    const walk = (dir, cb) => {
      dirs.add(dir);
      dir.readdirCB((er, entries) => {
        if (er) {
          return cb(er);
        }
        let len = entries.length;
        if (!len)
          return cb();
        const next = () => {
          if (--len === 0) {
            cb();
          }
        };
        for (const e of entries) {
          if (!filter2 || filter2(e)) {
            results.push(withFileTypes ? e : e.fullpath());
          }
          if (follow && e.isSymbolicLink()) {
            e.realpath().then((r) => r?.isUnknown() ? r.lstat() : r).then((r) => r?.shouldWalk(dirs, walkFilter) ? walk(r, next) : next());
          } else {
            if (e.shouldWalk(dirs, walkFilter)) {
              walk(e, next);
            } else {
              next();
            }
          }
        }
      }, true);
    };
    const start = entry;
    return new Promise((res, rej) => {
      walk(start, (er) => {
        if (er)
          return rej(er);
        res(results);
      });
    });
  }
  walkSync(entry = this.cwd, opts = {}) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      opts = entry;
      entry = this.cwd;
    }
    const { withFileTypes = true, follow = false, filter: filter2, walkFilter } = opts;
    const results = [];
    if (!filter2 || filter2(entry)) {
      results.push(withFileTypes ? entry : entry.fullpath());
    }
    const dirs = /* @__PURE__ */ new Set([entry]);
    for (const dir of dirs) {
      const entries = dir.readdirSync();
      for (const e of entries) {
        if (!filter2 || filter2(e)) {
          results.push(withFileTypes ? e : e.fullpath());
        }
        let r = e;
        if (e.isSymbolicLink()) {
          if (!(follow && (r = e.realpathSync())))
            continue;
          if (r.isUnknown())
            r.lstatSync();
        }
        if (r.shouldWalk(dirs, walkFilter)) {
          dirs.add(r);
        }
      }
    }
    return results;
  }
  /**
   * Support for `for await`
   *
   * Alias for {@link PathScurryBase.iterate}
   *
   * Note: As of Node 19, this is very slow, compared to other methods of
   * walking.  Consider using {@link PathScurryBase.stream} if memory overhead
   * and backpressure are concerns, or {@link PathScurryBase.walk} if not.
   */
  [Symbol.asyncIterator]() {
    return this.iterate();
  }
  iterate(entry = this.cwd, options = {}) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      options = entry;
      entry = this.cwd;
    }
    return this.stream(entry, options)[Symbol.asyncIterator]();
  }
  /**
   * Iterating over a PathScurry performs a synchronous walk.
   *
   * Alias for {@link PathScurryBase.iterateSync}
   */
  [Symbol.iterator]() {
    return this.iterateSync();
  }
  *iterateSync(entry = this.cwd, opts = {}) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      opts = entry;
      entry = this.cwd;
    }
    const { withFileTypes = true, follow = false, filter: filter2, walkFilter } = opts;
    if (!filter2 || filter2(entry)) {
      yield withFileTypes ? entry : entry.fullpath();
    }
    const dirs = /* @__PURE__ */ new Set([entry]);
    for (const dir of dirs) {
      const entries = dir.readdirSync();
      for (const e of entries) {
        if (!filter2 || filter2(e)) {
          yield withFileTypes ? e : e.fullpath();
        }
        let r = e;
        if (e.isSymbolicLink()) {
          if (!(follow && (r = e.realpathSync())))
            continue;
          if (r.isUnknown())
            r.lstatSync();
        }
        if (r.shouldWalk(dirs, walkFilter)) {
          dirs.add(r);
        }
      }
    }
  }
  stream(entry = this.cwd, opts = {}) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      opts = entry;
      entry = this.cwd;
    }
    const { withFileTypes = true, follow = false, filter: filter2, walkFilter } = opts;
    const results = new Minipass({ objectMode: true });
    if (!filter2 || filter2(entry)) {
      results.write(withFileTypes ? entry : entry.fullpath());
    }
    const dirs = /* @__PURE__ */ new Set();
    const queue = [entry];
    let processing = 0;
    const process2 = () => {
      let paused = false;
      while (!paused) {
        const dir = queue.shift();
        if (!dir) {
          if (processing === 0)
            results.end();
          return;
        }
        processing++;
        dirs.add(dir);
        const onReaddir = (er, entries, didRealpaths = false) => {
          if (er)
            return results.emit("error", er);
          if (follow && !didRealpaths) {
            const promises = [];
            for (const e of entries) {
              if (e.isSymbolicLink()) {
                promises.push(e.realpath().then((r) => r?.isUnknown() ? r.lstat() : r));
              }
            }
            if (promises.length) {
              Promise.all(promises).then(() => onReaddir(null, entries, true));
              return;
            }
          }
          for (const e of entries) {
            if (e && (!filter2 || filter2(e))) {
              if (!results.write(withFileTypes ? e : e.fullpath())) {
                paused = true;
              }
            }
          }
          processing--;
          for (const e of entries) {
            const r = e.realpathCached() || e;
            if (r.shouldWalk(dirs, walkFilter)) {
              queue.push(r);
            }
          }
          if (paused && !results.flowing) {
            results.once("drain", process2);
          } else if (!sync2) {
            process2();
          }
        };
        let sync2 = true;
        dir.readdirCB(onReaddir, true);
        sync2 = false;
      }
    };
    process2();
    return results;
  }
  streamSync(entry = this.cwd, opts = {}) {
    if (typeof entry === "string") {
      entry = this.cwd.resolve(entry);
    } else if (!(entry instanceof PathBase)) {
      opts = entry;
      entry = this.cwd;
    }
    const { withFileTypes = true, follow = false, filter: filter2, walkFilter } = opts;
    const results = new Minipass({ objectMode: true });
    const dirs = /* @__PURE__ */ new Set();
    if (!filter2 || filter2(entry)) {
      results.write(withFileTypes ? entry : entry.fullpath());
    }
    const queue = [entry];
    let processing = 0;
    const process2 = () => {
      let paused = false;
      while (!paused) {
        const dir = queue.shift();
        if (!dir) {
          if (processing === 0)
            results.end();
          return;
        }
        processing++;
        dirs.add(dir);
        const entries = dir.readdirSync();
        for (const e of entries) {
          if (!filter2 || filter2(e)) {
            if (!results.write(withFileTypes ? e : e.fullpath())) {
              paused = true;
            }
          }
        }
        processing--;
        for (const e of entries) {
          let r = e;
          if (e.isSymbolicLink()) {
            if (!(follow && (r = e.realpathSync())))
              continue;
            if (r.isUnknown())
              r.lstatSync();
          }
          if (r.shouldWalk(dirs, walkFilter)) {
            queue.push(r);
          }
        }
      }
      if (paused && !results.flowing)
        results.once("drain", process2);
    };
    process2();
    return results;
  }
  chdir(path2 = this.cwd) {
    const oldCwd = this.cwd;
    this.cwd = typeof path2 === "string" ? this.cwd.resolve(path2) : path2;
    this.cwd[setAsCwd](oldCwd);
  }
};
var PathScurryWin32 = class extends PathScurryBase {
  /**
   * separator for generating path strings
   */
  sep = "\\";
  constructor(cwd = process.cwd(), opts = {}) {
    const { nocase = true } = opts;
    super(cwd, win32, "\\", { ...opts, nocase });
    this.nocase = nocase;
    for (let p = this.cwd; p; p = p.parent) {
      p.nocase = this.nocase;
    }
  }
  /**
   * @internal
   */
  parseRootPath(dir) {
    return win32.parse(dir).root.toUpperCase();
  }
  /**
   * @internal
   */
  newRoot(fs2) {
    return new PathWin32(this.rootPath, IFDIR, void 0, this.roots, this.nocase, this.childrenCache(), { fs: fs2 });
  }
  /**
   * Return true if the provided path string is an absolute path
   */
  isAbsolute(p) {
    return p.startsWith("/") || p.startsWith("\\") || /^[a-z]:(\/|\\)/i.test(p);
  }
};
var PathScurryPosix = class extends PathScurryBase {
  /**
   * separator for generating path strings
   */
  sep = "/";
  constructor(cwd = process.cwd(), opts = {}) {
    const { nocase = false } = opts;
    super(cwd, posix, "/", { ...opts, nocase });
    this.nocase = nocase;
  }
  /**
   * @internal
   */
  parseRootPath(_dir) {
    return "/";
  }
  /**
   * @internal
   */
  newRoot(fs2) {
    return new PathPosix(this.rootPath, IFDIR, void 0, this.roots, this.nocase, this.childrenCache(), { fs: fs2 });
  }
  /**
   * Return true if the provided path string is an absolute path
   */
  isAbsolute(p) {
    return p.startsWith("/");
  }
};
var PathScurryDarwin = class extends PathScurryPosix {
  constructor(cwd = process.cwd(), opts = {}) {
    const { nocase = true } = opts;
    super(cwd, { ...opts, nocase });
  }
};
var Path = process.platform === "win32" ? PathWin32 : PathPosix;
var PathScurry = process.platform === "win32" ? PathScurryWin32 : process.platform === "darwin" ? PathScurryDarwin : PathScurryPosix;

// ../../node_modules/glob/dist/esm/pattern.js
var isPatternList = (pl) => pl.length >= 1;
var isGlobList = (gl) => gl.length >= 1;
var Pattern = class _Pattern {
  #patternList;
  #globList;
  #index;
  length;
  #platform;
  #rest;
  #globString;
  #isDrive;
  #isUNC;
  #isAbsolute;
  #followGlobstar = true;
  constructor(patternList, globList, index, platform) {
    if (!isPatternList(patternList)) {
      throw new TypeError("empty pattern list");
    }
    if (!isGlobList(globList)) {
      throw new TypeError("empty glob list");
    }
    if (globList.length !== patternList.length) {
      throw new TypeError("mismatched pattern list and glob list lengths");
    }
    this.length = patternList.length;
    if (index < 0 || index >= this.length) {
      throw new TypeError("index out of range");
    }
    this.#patternList = patternList;
    this.#globList = globList;
    this.#index = index;
    this.#platform = platform;
    if (this.#index === 0) {
      if (this.isUNC()) {
        const [p0, p1, p2, p3, ...prest] = this.#patternList;
        const [g0, g1, g2, g3, ...grest] = this.#globList;
        if (prest[0] === "") {
          prest.shift();
          grest.shift();
        }
        const p = [p0, p1, p2, p3, ""].join("/");
        const g = [g0, g1, g2, g3, ""].join("/");
        this.#patternList = [p, ...prest];
        this.#globList = [g, ...grest];
        this.length = this.#patternList.length;
      } else if (this.isDrive() || this.isAbsolute()) {
        const [p1, ...prest] = this.#patternList;
        const [g1, ...grest] = this.#globList;
        if (prest[0] === "") {
          prest.shift();
          grest.shift();
        }
        const p = p1 + "/";
        const g = g1 + "/";
        this.#patternList = [p, ...prest];
        this.#globList = [g, ...grest];
        this.length = this.#patternList.length;
      }
    }
  }
  /**
   * The first entry in the parsed list of patterns
   */
  pattern() {
    return this.#patternList[this.#index];
  }
  /**
   * true of if pattern() returns a string
   */
  isString() {
    return typeof this.#patternList[this.#index] === "string";
  }
  /**
   * true of if pattern() returns GLOBSTAR
   */
  isGlobstar() {
    return this.#patternList[this.#index] === GLOBSTAR;
  }
  /**
   * true if pattern() returns a regexp
   */
  isRegExp() {
    return this.#patternList[this.#index] instanceof RegExp;
  }
  /**
   * The /-joined set of glob parts that make up this pattern
   */
  globString() {
    return this.#globString = this.#globString || (this.#index === 0 ? this.isAbsolute() ? this.#globList[0] + this.#globList.slice(1).join("/") : this.#globList.join("/") : this.#globList.slice(this.#index).join("/"));
  }
  /**
   * true if there are more pattern parts after this one
   */
  hasMore() {
    return this.length > this.#index + 1;
  }
  /**
   * The rest of the pattern after this part, or null if this is the end
   */
  rest() {
    if (this.#rest !== void 0)
      return this.#rest;
    if (!this.hasMore())
      return this.#rest = null;
    this.#rest = new _Pattern(this.#patternList, this.#globList, this.#index + 1, this.#platform);
    this.#rest.#isAbsolute = this.#isAbsolute;
    this.#rest.#isUNC = this.#isUNC;
    this.#rest.#isDrive = this.#isDrive;
    return this.#rest;
  }
  /**
   * true if the pattern represents a //unc/path/ on windows
   */
  isUNC() {
    const pl = this.#patternList;
    return this.#isUNC !== void 0 ? this.#isUNC : this.#isUNC = this.#platform === "win32" && this.#index === 0 && pl[0] === "" && pl[1] === "" && typeof pl[2] === "string" && !!pl[2] && typeof pl[3] === "string" && !!pl[3];
  }
  // pattern like C:/...
  // split = ['C:', ...]
  // XXX: would be nice to handle patterns like `c:*` to test the cwd
  // in c: for *, but I don't know of a way to even figure out what that
  // cwd is without actually chdir'ing into it?
  /**
   * True if the pattern starts with a drive letter on Windows
   */
  isDrive() {
    const pl = this.#patternList;
    return this.#isDrive !== void 0 ? this.#isDrive : this.#isDrive = this.#platform === "win32" && this.#index === 0 && this.length > 1 && typeof pl[0] === "string" && /^[a-z]:$/i.test(pl[0]);
  }
  // pattern = '/' or '/...' or '/x/...'
  // split = ['', ''] or ['', ...] or ['', 'x', ...]
  // Drive and UNC both considered absolute on windows
  /**
   * True if the pattern is rooted on an absolute path
   */
  isAbsolute() {
    const pl = this.#patternList;
    return this.#isAbsolute !== void 0 ? this.#isAbsolute : this.#isAbsolute = pl[0] === "" && pl.length > 1 || this.isDrive() || this.isUNC();
  }
  /**
   * consume the root of the pattern, and return it
   */
  root() {
    const p = this.#patternList[0];
    return typeof p === "string" && this.isAbsolute() && this.#index === 0 ? p : "";
  }
  /**
   * Check to see if the current globstar pattern is allowed to follow
   * a symbolic link.
   */
  checkFollowGlobstar() {
    return !(this.#index === 0 || !this.isGlobstar() || !this.#followGlobstar);
  }
  /**
   * Mark that the current globstar pattern is following a symbolic link
   */
  markFollowGlobstar() {
    if (this.#index === 0 || !this.isGlobstar() || !this.#followGlobstar)
      return false;
    this.#followGlobstar = false;
    return true;
  }
};

// ../../node_modules/glob/dist/esm/ignore.js
var defaultPlatform2 = typeof process === "object" && process && typeof process.platform === "string" ? process.platform : "linux";
var Ignore = class {
  relative;
  relativeChildren;
  absolute;
  absoluteChildren;
  platform;
  mmopts;
  constructor(ignored, { nobrace, nocase, noext, noglobstar, platform = defaultPlatform2 }) {
    this.relative = [];
    this.absolute = [];
    this.relativeChildren = [];
    this.absoluteChildren = [];
    this.platform = platform;
    this.mmopts = {
      dot: true,
      nobrace,
      nocase,
      noext,
      noglobstar,
      optimizationLevel: 2,
      platform,
      nocomment: true,
      nonegate: true
    };
    for (const ign of ignored)
      this.add(ign);
  }
  add(ign) {
    const mm = new Minimatch(ign, this.mmopts);
    for (let i = 0; i < mm.set.length; i++) {
      const parsed = mm.set[i];
      const globParts = mm.globParts[i];
      if (!parsed || !globParts) {
        throw new Error("invalid pattern object");
      }
      while (parsed[0] === "." && globParts[0] === ".") {
        parsed.shift();
        globParts.shift();
      }
      const p = new Pattern(parsed, globParts, 0, this.platform);
      const m = new Minimatch(p.globString(), this.mmopts);
      const children = globParts[globParts.length - 1] === "**";
      const absolute = p.isAbsolute();
      if (absolute)
        this.absolute.push(m);
      else
        this.relative.push(m);
      if (children) {
        if (absolute)
          this.absoluteChildren.push(m);
        else
          this.relativeChildren.push(m);
      }
    }
  }
  ignored(p) {
    const fullpath = p.fullpath();
    const fullpaths = `${fullpath}/`;
    const relative = p.relative() || ".";
    const relatives = `${relative}/`;
    for (const m of this.relative) {
      if (m.match(relative) || m.match(relatives))
        return true;
    }
    for (const m of this.absolute) {
      if (m.match(fullpath) || m.match(fullpaths))
        return true;
    }
    return false;
  }
  childrenIgnored(p) {
    const fullpath = p.fullpath() + "/";
    const relative = (p.relative() || ".") + "/";
    for (const m of this.relativeChildren) {
      if (m.match(relative))
        return true;
    }
    for (const m of this.absoluteChildren) {
      if (m.match(fullpath))
        return true;
    }
    return false;
  }
};

// ../../node_modules/glob/dist/esm/processor.js
var HasWalkedCache = class _HasWalkedCache {
  store;
  constructor(store = /* @__PURE__ */ new Map()) {
    this.store = store;
  }
  copy() {
    return new _HasWalkedCache(new Map(this.store));
  }
  hasWalked(target, pattern) {
    return this.store.get(target.fullpath())?.has(pattern.globString());
  }
  storeWalked(target, pattern) {
    const fullpath = target.fullpath();
    const cached = this.store.get(fullpath);
    if (cached)
      cached.add(pattern.globString());
    else
      this.store.set(fullpath, /* @__PURE__ */ new Set([pattern.globString()]));
  }
};
var MatchRecord = class {
  store = /* @__PURE__ */ new Map();
  add(target, absolute, ifDir) {
    const n = (absolute ? 2 : 0) | (ifDir ? 1 : 0);
    const current = this.store.get(target);
    this.store.set(target, current === void 0 ? n : n & current);
  }
  // match, absolute, ifdir
  entries() {
    return [...this.store.entries()].map(([path2, n]) => [
      path2,
      !!(n & 2),
      !!(n & 1)
    ]);
  }
};
var SubWalks = class {
  store = /* @__PURE__ */ new Map();
  add(target, pattern) {
    if (!target.canReaddir()) {
      return;
    }
    const subs = this.store.get(target);
    if (subs) {
      if (!subs.find((p) => p.globString() === pattern.globString())) {
        subs.push(pattern);
      }
    } else
      this.store.set(target, [pattern]);
  }
  get(target) {
    const subs = this.store.get(target);
    if (!subs) {
      throw new Error("attempting to walk unknown path");
    }
    return subs;
  }
  entries() {
    return this.keys().map((k) => [k, this.store.get(k)]);
  }
  keys() {
    return [...this.store.keys()].filter((t) => t.canReaddir());
  }
};
var Processor = class _Processor {
  hasWalkedCache;
  matches = new MatchRecord();
  subwalks = new SubWalks();
  patterns;
  follow;
  dot;
  opts;
  constructor(opts, hasWalkedCache) {
    this.opts = opts;
    this.follow = !!opts.follow;
    this.dot = !!opts.dot;
    this.hasWalkedCache = hasWalkedCache ? hasWalkedCache.copy() : new HasWalkedCache();
  }
  processPatterns(target, patterns) {
    this.patterns = patterns;
    const processingSet = patterns.map((p) => [target, p]);
    for (let [t, pattern] of processingSet) {
      this.hasWalkedCache.storeWalked(t, pattern);
      const root = pattern.root();
      const absolute = pattern.isAbsolute() && this.opts.absolute !== false;
      if (root) {
        t = t.resolve(root === "/" && this.opts.root !== void 0 ? this.opts.root : root);
        const rest2 = pattern.rest();
        if (!rest2) {
          this.matches.add(t, true, false);
          continue;
        } else {
          pattern = rest2;
        }
      }
      if (t.isENOENT())
        continue;
      let p;
      let rest;
      let changed = false;
      while (typeof (p = pattern.pattern()) === "string" && (rest = pattern.rest())) {
        const c = t.resolve(p);
        t = c;
        pattern = rest;
        changed = true;
      }
      p = pattern.pattern();
      rest = pattern.rest();
      if (changed) {
        if (this.hasWalkedCache.hasWalked(t, pattern))
          continue;
        this.hasWalkedCache.storeWalked(t, pattern);
      }
      if (typeof p === "string") {
        const ifDir = p === ".." || p === "" || p === ".";
        this.matches.add(t.resolve(p), absolute, ifDir);
        continue;
      } else if (p === GLOBSTAR) {
        if (!t.isSymbolicLink() || this.follow || pattern.checkFollowGlobstar()) {
          this.subwalks.add(t, pattern);
        }
        const rp = rest?.pattern();
        const rrest = rest?.rest();
        if (!rest || (rp === "" || rp === ".") && !rrest) {
          this.matches.add(t, absolute, rp === "" || rp === ".");
        } else {
          if (rp === "..") {
            const tp = t.parent || t;
            if (!rrest)
              this.matches.add(tp, absolute, true);
            else if (!this.hasWalkedCache.hasWalked(tp, rrest)) {
              this.subwalks.add(tp, rrest);
            }
          }
        }
      } else if (p instanceof RegExp) {
        this.subwalks.add(t, pattern);
      }
    }
    return this;
  }
  subwalkTargets() {
    return this.subwalks.keys();
  }
  child() {
    return new _Processor(this.opts, this.hasWalkedCache);
  }
  // return a new Processor containing the subwalks for each
  // child entry, and a set of matches, and
  // a hasWalkedCache that's a copy of this one
  // then we're going to call
  filterEntries(parent, entries) {
    const patterns = this.subwalks.get(parent);
    const results = this.child();
    for (const e of entries) {
      for (const pattern of patterns) {
        const absolute = pattern.isAbsolute();
        const p = pattern.pattern();
        const rest = pattern.rest();
        if (p === GLOBSTAR) {
          results.testGlobstar(e, pattern, rest, absolute);
        } else if (p instanceof RegExp) {
          results.testRegExp(e, p, rest, absolute);
        } else {
          results.testString(e, p, rest, absolute);
        }
      }
    }
    return results;
  }
  testGlobstar(e, pattern, rest, absolute) {
    if (this.dot || !e.name.startsWith(".")) {
      if (!pattern.hasMore()) {
        this.matches.add(e, absolute, false);
      }
      if (e.canReaddir()) {
        if (this.follow || !e.isSymbolicLink()) {
          this.subwalks.add(e, pattern);
        } else if (e.isSymbolicLink()) {
          if (rest && pattern.checkFollowGlobstar()) {
            this.subwalks.add(e, rest);
          } else if (pattern.markFollowGlobstar()) {
            this.subwalks.add(e, pattern);
          }
        }
      }
    }
    if (rest) {
      const rp = rest.pattern();
      if (typeof rp === "string" && // dots and empty were handled already
      rp !== ".." && rp !== "" && rp !== ".") {
        this.testString(e, rp, rest.rest(), absolute);
      } else if (rp === "..") {
        const ep = e.parent || e;
        this.subwalks.add(ep, rest);
      } else if (rp instanceof RegExp) {
        this.testRegExp(e, rp, rest.rest(), absolute);
      }
    }
  }
  testRegExp(e, p, rest, absolute) {
    if (!p.test(e.name))
      return;
    if (!rest) {
      this.matches.add(e, absolute, false);
    } else {
      this.subwalks.add(e, rest);
    }
  }
  testString(e, p, rest, absolute) {
    if (!e.isNamed(p))
      return;
    if (!rest) {
      this.matches.add(e, absolute, false);
    } else {
      this.subwalks.add(e, rest);
    }
  }
};

// ../../node_modules/glob/dist/esm/walker.js
var makeIgnore = (ignore, opts) => typeof ignore === "string" ? new Ignore([ignore], opts) : Array.isArray(ignore) ? new Ignore(ignore, opts) : ignore;
var GlobUtil = class {
  path;
  patterns;
  opts;
  seen = /* @__PURE__ */ new Set();
  paused = false;
  aborted = false;
  #onResume = [];
  #ignore;
  #sep;
  signal;
  maxDepth;
  includeChildMatches;
  constructor(patterns, path2, opts) {
    this.patterns = patterns;
    this.path = path2;
    this.opts = opts;
    this.#sep = !opts.posix && opts.platform === "win32" ? "\\" : "/";
    this.includeChildMatches = opts.includeChildMatches !== false;
    if (opts.ignore || !this.includeChildMatches) {
      this.#ignore = makeIgnore(opts.ignore ?? [], opts);
      if (!this.includeChildMatches && typeof this.#ignore.add !== "function") {
        const m = "cannot ignore child matches, ignore lacks add() method.";
        throw new Error(m);
      }
    }
    this.maxDepth = opts.maxDepth || Infinity;
    if (opts.signal) {
      this.signal = opts.signal;
      this.signal.addEventListener("abort", () => {
        this.#onResume.length = 0;
      });
    }
  }
  #ignored(path2) {
    return this.seen.has(path2) || !!this.#ignore?.ignored?.(path2);
  }
  #childrenIgnored(path2) {
    return !!this.#ignore?.childrenIgnored?.(path2);
  }
  // backpressure mechanism
  pause() {
    this.paused = true;
  }
  resume() {
    if (this.signal?.aborted)
      return;
    this.paused = false;
    let fn = void 0;
    while (!this.paused && (fn = this.#onResume.shift())) {
      fn();
    }
  }
  onResume(fn) {
    if (this.signal?.aborted)
      return;
    if (!this.paused) {
      fn();
    } else {
      this.#onResume.push(fn);
    }
  }
  // do the requisite realpath/stat checking, and return the path
  // to add or undefined to filter it out.
  async matchCheck(e, ifDir) {
    if (ifDir && this.opts.nodir)
      return void 0;
    let rpc;
    if (this.opts.realpath) {
      rpc = e.realpathCached() || await e.realpath();
      if (!rpc)
        return void 0;
      e = rpc;
    }
    const needStat = e.isUnknown() || this.opts.stat;
    const s = needStat ? await e.lstat() : e;
    if (this.opts.follow && this.opts.nodir && s?.isSymbolicLink()) {
      const target = await s.realpath();
      if (target && (target.isUnknown() || this.opts.stat)) {
        await target.lstat();
      }
    }
    return this.matchCheckTest(s, ifDir);
  }
  matchCheckTest(e, ifDir) {
    return e && (this.maxDepth === Infinity || e.depth() <= this.maxDepth) && (!ifDir || e.canReaddir()) && (!this.opts.nodir || !e.isDirectory()) && (!this.opts.nodir || !this.opts.follow || !e.isSymbolicLink() || !e.realpathCached()?.isDirectory()) && !this.#ignored(e) ? e : void 0;
  }
  matchCheckSync(e, ifDir) {
    if (ifDir && this.opts.nodir)
      return void 0;
    let rpc;
    if (this.opts.realpath) {
      rpc = e.realpathCached() || e.realpathSync();
      if (!rpc)
        return void 0;
      e = rpc;
    }
    const needStat = e.isUnknown() || this.opts.stat;
    const s = needStat ? e.lstatSync() : e;
    if (this.opts.follow && this.opts.nodir && s?.isSymbolicLink()) {
      const target = s.realpathSync();
      if (target && (target?.isUnknown() || this.opts.stat)) {
        target.lstatSync();
      }
    }
    return this.matchCheckTest(s, ifDir);
  }
  matchFinish(e, absolute) {
    if (this.#ignored(e))
      return;
    if (!this.includeChildMatches && this.#ignore?.add) {
      const ign = `${e.relativePosix()}/**`;
      this.#ignore.add(ign);
    }
    const abs = this.opts.absolute === void 0 ? absolute : this.opts.absolute;
    this.seen.add(e);
    const mark = this.opts.mark && e.isDirectory() ? this.#sep : "";
    if (this.opts.withFileTypes) {
      this.matchEmit(e);
    } else if (abs) {
      const abs2 = this.opts.posix ? e.fullpathPosix() : e.fullpath();
      this.matchEmit(abs2 + mark);
    } else {
      const rel = this.opts.posix ? e.relativePosix() : e.relative();
      const pre = this.opts.dotRelative && !rel.startsWith(".." + this.#sep) ? "." + this.#sep : "";
      this.matchEmit(!rel ? "." + mark : pre + rel + mark);
    }
  }
  async match(e, absolute, ifDir) {
    const p = await this.matchCheck(e, ifDir);
    if (p)
      this.matchFinish(p, absolute);
  }
  matchSync(e, absolute, ifDir) {
    const p = this.matchCheckSync(e, ifDir);
    if (p)
      this.matchFinish(p, absolute);
  }
  walkCB(target, patterns, cb) {
    if (this.signal?.aborted)
      cb();
    this.walkCB2(target, patterns, new Processor(this.opts), cb);
  }
  walkCB2(target, patterns, processor, cb) {
    if (this.#childrenIgnored(target))
      return cb();
    if (this.signal?.aborted)
      cb();
    if (this.paused) {
      this.onResume(() => this.walkCB2(target, patterns, processor, cb));
      return;
    }
    processor.processPatterns(target, patterns);
    let tasks = 1;
    const next = () => {
      if (--tasks === 0)
        cb();
    };
    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.#ignored(m))
        continue;
      tasks++;
      this.match(m, absolute, ifDir).then(() => next());
    }
    for (const t of processor.subwalkTargets()) {
      if (this.maxDepth !== Infinity && t.depth() >= this.maxDepth) {
        continue;
      }
      tasks++;
      const childrenCached = t.readdirCached();
      if (t.calledReaddir())
        this.walkCB3(t, childrenCached, processor, next);
      else {
        t.readdirCB((_, entries) => this.walkCB3(t, entries, processor, next), true);
      }
    }
    next();
  }
  walkCB3(target, entries, processor, cb) {
    processor = processor.filterEntries(target, entries);
    let tasks = 1;
    const next = () => {
      if (--tasks === 0)
        cb();
    };
    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.#ignored(m))
        continue;
      tasks++;
      this.match(m, absolute, ifDir).then(() => next());
    }
    for (const [target2, patterns] of processor.subwalks.entries()) {
      tasks++;
      this.walkCB2(target2, patterns, processor.child(), next);
    }
    next();
  }
  walkCBSync(target, patterns, cb) {
    if (this.signal?.aborted)
      cb();
    this.walkCB2Sync(target, patterns, new Processor(this.opts), cb);
  }
  walkCB2Sync(target, patterns, processor, cb) {
    if (this.#childrenIgnored(target))
      return cb();
    if (this.signal?.aborted)
      cb();
    if (this.paused) {
      this.onResume(() => this.walkCB2Sync(target, patterns, processor, cb));
      return;
    }
    processor.processPatterns(target, patterns);
    let tasks = 1;
    const next = () => {
      if (--tasks === 0)
        cb();
    };
    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.#ignored(m))
        continue;
      this.matchSync(m, absolute, ifDir);
    }
    for (const t of processor.subwalkTargets()) {
      if (this.maxDepth !== Infinity && t.depth() >= this.maxDepth) {
        continue;
      }
      tasks++;
      const children = t.readdirSync();
      this.walkCB3Sync(t, children, processor, next);
    }
    next();
  }
  walkCB3Sync(target, entries, processor, cb) {
    processor = processor.filterEntries(target, entries);
    let tasks = 1;
    const next = () => {
      if (--tasks === 0)
        cb();
    };
    for (const [m, absolute, ifDir] of processor.matches.entries()) {
      if (this.#ignored(m))
        continue;
      this.matchSync(m, absolute, ifDir);
    }
    for (const [target2, patterns] of processor.subwalks.entries()) {
      tasks++;
      this.walkCB2Sync(target2, patterns, processor.child(), next);
    }
    next();
  }
};
var GlobWalker = class extends GlobUtil {
  matches = /* @__PURE__ */ new Set();
  constructor(patterns, path2, opts) {
    super(patterns, path2, opts);
  }
  matchEmit(e) {
    this.matches.add(e);
  }
  async walk() {
    if (this.signal?.aborted)
      throw this.signal.reason;
    if (this.path.isUnknown()) {
      await this.path.lstat();
    }
    await new Promise((res, rej) => {
      this.walkCB(this.path, this.patterns, () => {
        if (this.signal?.aborted) {
          rej(this.signal.reason);
        } else {
          res(this.matches);
        }
      });
    });
    return this.matches;
  }
  walkSync() {
    if (this.signal?.aborted)
      throw this.signal.reason;
    if (this.path.isUnknown()) {
      this.path.lstatSync();
    }
    this.walkCBSync(this.path, this.patterns, () => {
      if (this.signal?.aborted)
        throw this.signal.reason;
    });
    return this.matches;
  }
};
var GlobStream = class extends GlobUtil {
  results;
  constructor(patterns, path2, opts) {
    super(patterns, path2, opts);
    this.results = new Minipass({
      signal: this.signal,
      objectMode: true
    });
    this.results.on("drain", () => this.resume());
    this.results.on("resume", () => this.resume());
  }
  matchEmit(e) {
    this.results.write(e);
    if (!this.results.flowing)
      this.pause();
  }
  stream() {
    const target = this.path;
    if (target.isUnknown()) {
      target.lstat().then(() => {
        this.walkCB(target, this.patterns, () => this.results.end());
      });
    } else {
      this.walkCB(target, this.patterns, () => this.results.end());
    }
    return this.results;
  }
  streamSync() {
    if (this.path.isUnknown()) {
      this.path.lstatSync();
    }
    this.walkCBSync(this.path, this.patterns, () => this.results.end());
    return this.results;
  }
};

// ../../node_modules/glob/dist/esm/glob.js
var defaultPlatform3 = typeof process === "object" && process && typeof process.platform === "string" ? process.platform : "linux";
var Glob = class {
  absolute;
  cwd;
  root;
  dot;
  dotRelative;
  follow;
  ignore;
  magicalBraces;
  mark;
  matchBase;
  maxDepth;
  nobrace;
  nocase;
  nodir;
  noext;
  noglobstar;
  pattern;
  platform;
  realpath;
  scurry;
  stat;
  signal;
  windowsPathsNoEscape;
  withFileTypes;
  includeChildMatches;
  /**
   * The options provided to the constructor.
   */
  opts;
  /**
   * An array of parsed immutable {@link Pattern} objects.
   */
  patterns;
  /**
   * All options are stored as properties on the `Glob` object.
   *
   * See {@link GlobOptions} for full options descriptions.
   *
   * Note that a previous `Glob` object can be passed as the
   * `GlobOptions` to another `Glob` instantiation to re-use settings
   * and caches with a new pattern.
   *
   * Traversal functions can be called multiple times to run the walk
   * again.
   */
  constructor(pattern, opts) {
    if (!opts)
      throw new TypeError("glob options required");
    this.withFileTypes = !!opts.withFileTypes;
    this.signal = opts.signal;
    this.follow = !!opts.follow;
    this.dot = !!opts.dot;
    this.dotRelative = !!opts.dotRelative;
    this.nodir = !!opts.nodir;
    this.mark = !!opts.mark;
    if (!opts.cwd) {
      this.cwd = "";
    } else if (opts.cwd instanceof URL || opts.cwd.startsWith("file://")) {
      opts.cwd = fileURLToPath2(opts.cwd);
    }
    this.cwd = opts.cwd || "";
    this.root = opts.root;
    this.magicalBraces = !!opts.magicalBraces;
    this.nobrace = !!opts.nobrace;
    this.noext = !!opts.noext;
    this.realpath = !!opts.realpath;
    this.absolute = opts.absolute;
    this.includeChildMatches = opts.includeChildMatches !== false;
    this.noglobstar = !!opts.noglobstar;
    this.matchBase = !!opts.matchBase;
    this.maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : Infinity;
    this.stat = !!opts.stat;
    this.ignore = opts.ignore;
    if (this.withFileTypes && this.absolute !== void 0) {
      throw new Error("cannot set absolute and withFileTypes:true");
    }
    if (typeof pattern === "string") {
      pattern = [pattern];
    }
    this.windowsPathsNoEscape = !!opts.windowsPathsNoEscape || opts.allowWindowsEscape === false;
    if (this.windowsPathsNoEscape) {
      pattern = pattern.map((p) => p.replace(/\\/g, "/"));
    }
    if (this.matchBase) {
      if (opts.noglobstar) {
        throw new TypeError("base matching requires globstar");
      }
      pattern = pattern.map((p) => p.includes("/") ? p : `./**/${p}`);
    }
    this.pattern = pattern;
    this.platform = opts.platform || defaultPlatform3;
    this.opts = { ...opts, platform: this.platform };
    if (opts.scurry) {
      this.scurry = opts.scurry;
      if (opts.nocase !== void 0 && opts.nocase !== opts.scurry.nocase) {
        throw new Error("nocase option contradicts provided scurry option");
      }
    } else {
      const Scurry = opts.platform === "win32" ? PathScurryWin32 : opts.platform === "darwin" ? PathScurryDarwin : opts.platform ? PathScurryPosix : PathScurry;
      this.scurry = new Scurry(this.cwd, {
        nocase: opts.nocase,
        fs: opts.fs
      });
    }
    this.nocase = this.scurry.nocase;
    const nocaseMagicOnly = this.platform === "darwin" || this.platform === "win32";
    const mmo = {
      // default nocase based on platform
      ...opts,
      dot: this.dot,
      matchBase: this.matchBase,
      nobrace: this.nobrace,
      nocase: this.nocase,
      nocaseMagicOnly,
      nocomment: true,
      noext: this.noext,
      nonegate: true,
      optimizationLevel: 2,
      platform: this.platform,
      windowsPathsNoEscape: this.windowsPathsNoEscape,
      debug: !!this.opts.debug
    };
    const mms = this.pattern.map((p) => new Minimatch(p, mmo));
    const [matchSet, globParts] = mms.reduce((set, m) => {
      set[0].push(...m.set);
      set[1].push(...m.globParts);
      return set;
    }, [[], []]);
    this.patterns = matchSet.map((set, i) => {
      const g = globParts[i];
      if (!g)
        throw new Error("invalid pattern object");
      return new Pattern(set, g, 0, this.platform);
    });
  }
  async walk() {
    return [
      ...await new GlobWalker(this.patterns, this.scurry.cwd, {
        ...this.opts,
        maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
        platform: this.platform,
        nocase: this.nocase,
        includeChildMatches: this.includeChildMatches
      }).walk()
    ];
  }
  walkSync() {
    return [
      ...new GlobWalker(this.patterns, this.scurry.cwd, {
        ...this.opts,
        maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
        platform: this.platform,
        nocase: this.nocase,
        includeChildMatches: this.includeChildMatches
      }).walkSync()
    ];
  }
  stream() {
    return new GlobStream(this.patterns, this.scurry.cwd, {
      ...this.opts,
      maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
      platform: this.platform,
      nocase: this.nocase,
      includeChildMatches: this.includeChildMatches
    }).stream();
  }
  streamSync() {
    return new GlobStream(this.patterns, this.scurry.cwd, {
      ...this.opts,
      maxDepth: this.maxDepth !== Infinity ? this.maxDepth + this.scurry.cwd.depth() : Infinity,
      platform: this.platform,
      nocase: this.nocase,
      includeChildMatches: this.includeChildMatches
    }).streamSync();
  }
  /**
   * Default sync iteration function. Returns a Generator that
   * iterates over the results.
   */
  iterateSync() {
    return this.streamSync()[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.iterateSync();
  }
  /**
   * Default async iteration function. Returns an AsyncGenerator that
   * iterates over the results.
   */
  iterate() {
    return this.stream()[Symbol.asyncIterator]();
  }
  [Symbol.asyncIterator]() {
    return this.iterate();
  }
};

// ../../node_modules/glob/dist/esm/has-magic.js
var hasMagic = (pattern, options = {}) => {
  if (!Array.isArray(pattern)) {
    pattern = [pattern];
  }
  for (const p of pattern) {
    if (new Minimatch(p, options).hasMagic())
      return true;
  }
  return false;
};

// ../../node_modules/glob/dist/esm/index.js
function globStreamSync(pattern, options = {}) {
  return new Glob(pattern, options).streamSync();
}
function globStream(pattern, options = {}) {
  return new Glob(pattern, options).stream();
}
function globSync(pattern, options = {}) {
  return new Glob(pattern, options).walkSync();
}
async function glob_(pattern, options = {}) {
  return new Glob(pattern, options).walk();
}
function globIterateSync(pattern, options = {}) {
  return new Glob(pattern, options).iterateSync();
}
function globIterate(pattern, options = {}) {
  return new Glob(pattern, options).iterate();
}
var streamSync = globStreamSync;
var stream = Object.assign(globStream, { sync: globStreamSync });
var iterateSync = globIterateSync;
var iterate = Object.assign(globIterate, {
  sync: globIterateSync
});
var sync = Object.assign(globSync, {
  stream: globStreamSync,
  iterate: globIterateSync
});
var glob = Object.assign(glob_, {
  glob: glob_,
  globSync,
  sync,
  globStream,
  stream,
  globStreamSync,
  streamSync,
  globIterate,
  iterate,
  globIterateSync,
  iterateSync,
  Glob,
  hasMagic,
  escape,
  unescape
});
glob.glob = glob;

// src/implement-plan-reloader.ts
import { existsSync as existsSync2, unlinkSync, writeFileSync } from "node:fs";

// src/implement-plan-instructions.ts
var IMPLEMENT_PLAN_INSTRUCTIONS = `
Implement-plan instructions restored after context compaction. Continue from your current step.

<operational-guidelines>
Follow these guidelines throughout execution:

1. **Avoid over-engineering** - Only make changes that are directly requested or clearly necessary. Don't add features, refactor code, or make "improvements" beyond what was asked.

2. **Always dispatch tasks** - Dispatch every implementation task to a subagent. Do not implement tasks directly using Edit/Write tools. This applies regardless of task simplicity.

3. **Dynamic model selection** - Choose the model based on task complexity:
   - **opus**: Ambiguous requirements, multiple possible approaches, or tasks where you're unsure how to start
   - **sonnet**: Clear goal with multiple steps, building features, or fixing bugs in unfamiliar code
   - **haiku**: Single-step tasks, following established patterns, or making changes you already understand

4. **Use general-purpose subagent** - Implementation and validation subagents should use \`subagent_type="general-purpose"\`. The refactoring step uses \`code-simplifier:code-simplifier\`.

5. **Self-contained task prompts** - Agents have no conversation context. Include full paths, code snippets, patterns, and requirements in every task prompt.
</operational-guidelines>

## Step 2: Locate and Read Plan

Locate the plan file:

**If [PLAN_PATH] provided:**
\`\`\`bash
cat "[PLAN_PATH]"
\`\`\`

**If [PLAN_PATH] not provided:**
\`\`\`bash
# Check for active plans first (resume work)
ls -la projects/active/*/plan.md 2>/dev/null

# Then check for new plans
ls -la projects/new/*/plan.md 2>/dev/null
\`\`\`

If multiple plans found, ask the user which to implement.

Read the plan and extract:
- [PROJECT_NAME] = From plan title or directory name
- [PROJECT_DIR] = Directory containing plan.md
- [TASKS] = All tasks with dependencies and file assignments
- [PLAN_FILES] = All files the plan intends to modify (from task file assignments)
- [VALIDATION_COMMANDS] = Commands from Validation Commands section
- [EXPLORATION_SUMMARY] = Context from Exploration Summary section (if present)

Create baseline checkpoint now that [PROJECT_NAME] is known:

\`\`\`bash
git tag -f implement/[PROJECT_NAME]/baseline HEAD
\`\`\`

## Step 4: Assess Coherence

Analyze tasks along three dimensions before dispatching:

| Dimension | Question |
|-----------|----------|
| **Dependency** | Do files import/reference each other? |
| **Uniformity** | Same operation across files, or varied operations? |
| **Size** | Substantial tasks with clear completion gates? |

**Route based on assessment:**

| Pattern | Route | Description |
|---------|-------|-------------|
| Independent files OR uniform tasks | **Parallel** | Launch concurrent agents |
| Dependent + varied + small | **Coherent** | Single agent handles all |
| Dependent + varied + substantial with clear gates | **Sequential** | Ordered agents, validate between |

**Clear gates** include: type-check passes, tests pass, API functional, UI renders.

When uncertain between Coherent and Sequential, choose **Sequential**. Checkpoints have low cost; missed validation opportunities have high cost.

## Step 5: Select Model and Dispatch Tasks

Create pre-implementation checkpoint:

\`\`\`bash
git add -A
git commit --allow-empty -m "checkpoint: before implementation

Project: [PROJECT_NAME]
Tasks: [N] tasks to implement"
git tag -f implement/[PROJECT_NAME]/pre-implementation HEAD
\`\`\`

Dispatch tasks to subagents using the Task tool. Do not implement tasks directly\u2014always dispatch, even for simple single-file changes.

### Model Selection

For each task or task group, select the appropriate model:

| Model | When to Use |
|-------|-------------|
| **opus** | Ambiguous requirements, multiple approaches possible, unfamiliar territory |
| **sonnet** | Clear goal with multiple steps, building features, fixing bugs in unfamiliar code |
| **haiku** | Single-step tasks, established patterns, changes you already understand |

### Task Prompt Requirements

Each task prompt should be self-contained with:
- Full file paths (absolute)
- Current file content (read files first)
- Testing requirements from plan
- Patterns from Exploration Summary
- Constraints from plan

### Dispatch by Coherence Route

**Parallel Route** - Launch all independent tasks in a single message:

\`\`\`xml
<invoke name="Task">
<parameter name="description">[task-group-a]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL based on complexity]</parameter>
<parameter name="prompt">You are implementing a portion of a plan. Other subagents are also working on this plan.

# Task
[Description with testing requirements from plan]

## Plan
@[PROJECT_DIR]/plan.md

## Context
[Why this task exists - from plan rationale]
[Relevant context from Exploration Summary]

## File Ownership
This task owns: [absolute paths from plan]
Do not modify files outside this list.

## Current File Content
[Read and include current content of files to be modified]

## Constraints
[From plan: patterns, interfaces, dependencies to respect]

## Requirements
[List all requirements]
1. [Requirement 1]
2. [Requirement 2]

## Patterns to Follow
[Code snippets showing conventions - from exploration or file reads]

## Guidelines
- Only make requested changes
- Don't add unrequested features or abstractions
- Keep implementation minimal and focused

## Success Criteria
- [ ] Implementation complete
- [ ] Tests pass (if applicable)
- [ ] Types correct
- [ ] Follows existing patterns</parameter>
</invoke>
<invoke name="Task">
<parameter name="description">[task-group-b]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL based on complexity]</parameter>
<parameter name="prompt">[Same structure as above]</parameter>
</invoke>
\`\`\`

**Sequential Route** - Each phase must pass validation before the next begins:

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  For each phase:                                    \u2502
\u2502                                                     \u2502
\u2502    Dispatch phase tasks                             \u2502
\u2502            \u2193                                        \u2502
\u2502    Wait for completion                              \u2502
\u2502            \u2193                                        \u2502
\u2502    Run validation (typecheck, test, lint)           \u2502
\u2502            \u2193                                        \u2502
\u2502    \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                                \u2502
\u2502    \u2502               \u2502                                \u2502
\u2502  Pass            Fail \u2192 Fix errors, re-validate     \u2502
\u2502    \u2502                                                \u2502
\u2502    \u2193                                                \u2502
\u2502  Next phase (or Step 6 if final phase)              \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
\`\`\`

Do not dispatch the next phase until the current phase passes validation.

**Coherent Route** - Single agent handles all related tasks:

\`\`\`xml
<invoke name="Task">
<parameter name="description">[all-related-tasks]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL - typically opus for coherent work]</parameter>
<parameter name="prompt">You are implementing a complete feature. Complete all tasks in sequence.

# Tasks
[List all tasks to complete in order]

## Plan
@[PROJECT_DIR]/plan.md

## Context
[Full context for the coherent work]

## File Ownership
This task owns: [all files for this coherent group]

## Current File Content
[Read and include current content of ALL files]

## Requirements
[Combined requirements from all tasks]

## Guidelines
- Complete tasks in dependency order
- Only make requested changes
- Don't add unrequested features or abstractions

## Success Criteria
- [ ] All tasks complete
- [ ] Tests pass
- [ ] Types correct
- [ ] Follows existing patterns</parameter>
</invoke>
\`\`\`

## Step 6: Validation Gate

Create post-implementation checkpoint:

\`\`\`bash
git add -A
git commit --allow-empty -m "checkpoint: after implementation, before validation

Project: [PROJECT_NAME]"
git tag -f implement/[PROJECT_NAME]/post-implementation HEAD
\`\`\`

### Check for Unexpected Modifications

Verify that only plan-owned files were modified:

\`\`\`bash
# Files modified since baseline
MODIFIED=$(git diff implement/[PROJECT_NAME]/baseline --name-only)

# Check for files outside [PLAN_FILES]
# (Compare MODIFIED against the list of plan-owned files)
UNEXPECTED=$(comm -23 <(echo "$MODIFIED" | sort) <(echo "[PLAN_FILES]" | sort))
\`\`\`

**If unexpected modifications exist:** Report them to user and ask how to proceed:
- "Keep" \u2192 Continue with modifications in place
- "Stash" \u2192 \`git stash push -m "unexpected-changes" -- $UNEXPECTED\`
- "Discard" \u2192 \`git checkout implement/[PROJECT_NAME]/baseline -- $UNEXPECTED\`

Do not discard without explicit user consent.

**Requirement:** ALL validation commands must pass before proceeding.

Run validation commands from the plan's "## Validation Commands" section. If no validation commands are specified, use these defaults:

\`\`\`bash
cd packages/[package] && yarn typecheck 2>&1
cd packages/[package] && yarn test 2>&1
cd packages/[package] && yarn lint 2>&1
\`\`\`

### On Failure

1. **Error in code you can modify** \u2192 Dispatch fix task to subagent, re-run validation
2. **Error outside your scope** \u2192 Block immediately and report to user

### Validation Loop

Continue the fix-and-validate cycle until:
- **All validations pass** \u2192 Proceed to Step 7
- **Error is outside scope** \u2192 Report blocker to user, keep project in \`projects/active/\`, **STOP**
- **Fix attempts exceed 3 for the same error** \u2192 Report blocker to user, keep project in \`projects/active/\`, **STOP**

### Fix Task Dispatch

When dispatching fix tasks, include the exact error output:

\`\`\`xml
<invoke name="Task">
<parameter name="description">Fix [error-type]</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL - haiku for simple fixes, sonnet for complex]</parameter>
<parameter name="prompt"># Task: Fix Validation Error

## Error Output
\`\`\`
[Exact error output with file:line references]
\`\`\`

## Plan
@[PROJECT_DIR]/plan.md

## File Ownership
This task owns: [files mentioned in error]

## Current File Content
[Content of files with errors]

## Guidelines
- Fix only the specific error shown
- Do not refactor or improve surrounding code
- Maintain existing patterns

## Success Criteria
- [ ] Error resolved
- [ ] No new errors introduced</parameter>
</invoke>
\`\`\`

## Step 7: Refactor

Create pre-refactor checkpoint:

\`\`\`bash
git add -A
git commit --allow-empty -m "checkpoint: before refactoring

Project: [PROJECT_NAME]
Status: Validation passed"
git tag -f implement/[PROJECT_NAME]/pre-refactor HEAD
\`\`\`

Delegate refactoring to improve code quality while preserving behavior.

### Dispatch Refactoring

\`\`\`xml
<invoke name="Task">
<parameter name="description">Refactor implementation</parameter>
<parameter name="subagent_type">code-simplifier:code-simplifier</parameter>
<parameter name="prompt">
# Task: Refactor Recent Implementation

## Plan
@[PROJECT_DIR]/plan.md

## Focus Areas
1. Eliminate dead code
2. Simplify logic (guard clauses, smaller functions)
3. Remove over-engineering (YAGNI)
4. Improve naming (align with plan intent)
5. Harmonize patterns (match codebase conventions)
6. Refine tests (remove redundant, focus on behavior)

## Constraints
- Preserve observable behavior
- Maintain test coverage
- Stay within plan scope
- Validate after each change

## Guidelines
- Only refactor files modified by the implementation
- Do not add new features or capabilities
- Keep changes minimal and focused on clarity
</parameter>
</invoke>
\`\`\`

### Process Result

Based on agent status:
- **COMPLETED**: Proceed to Step 8
- **HAS_RECOMMENDATIONS**: Log recommendations, proceed to Step 8
- **BLOCKED**: Document reasons, proceed to Step 8

## Step 8: Post-Refactor Validation

Re-run the validation commands (typecheck, test, lint) to ensure refactoring didn't introduce regressions.

**If validation passes:** Commit refactoring changes and proceed to Step 9:
\`\`\`bash
git add -A
git commit -m "refactor: simplify implementation

Project: [PROJECT_NAME]"
\`\`\`

**If validation fails:** Revert only plan-owned files to pre-refactor state, then proceed to Step 9:
\`\`\`bash
# Identify files changed by refactoring that are in [PLAN_FILES]
REFACTOR_CHANGES=$(git diff implement/[PROJECT_NAME]/pre-refactor --name-only)
PLAN_CHANGES=$(comm -12 <(echo "$REFACTOR_CHANGES" | sort) <(echo "[PLAN_FILES]" | sort))

# Revert only those files
git checkout implement/[PROJECT_NAME]/pre-refactor -- $PLAN_CHANGES
\`\`\`

## Step 9: Evaluate Quality

Dispatch a subagent to evaluate the implementation for production readiness:

\`\`\`xml
<invoke name="Task">
<parameter name="description">Evaluate implementation quality</parameter>
<parameter name="subagent_type">general-purpose</parameter>
<parameter name="model">[MODEL - typically sonnet]</parameter>
<parameter name="prompt"># Task: Evaluate Implementation Quality

## Plan
@[PROJECT_DIR]/plan.md

## Status Definitions
- **PRODUCTION_READY**: Implementation meets all success criteria, code quality is acceptable
- **CONTINUE**: Core works but has quality issues that should be addressed (not validation failures)
- **BLOCKED**: Fundamental design issues or missing requirements that can't be fixed without re-planning

## Evaluation Criteria

1. **Requirements Coverage**: Does the implementation satisfy all success criteria in the plan?
2. **Code Quality**: Is the code maintainable, readable, and following project conventions?
3. **Edge Cases**: Are error conditions and edge cases handled appropriately?
4. **Test Coverage**: Are the changes adequately tested?
5. **Integration**: Does the implementation integrate cleanly with existing code?

## Steps

1. Read the plan's Success Criteria section
2. Review the implementation against each criterion
3. Assess code quality and completeness
4. Determine status

## Return Format
\`\`\`
STATUS: [STATUS]
CRITERIA_MET: [N]/[N]
QUALITY_NOTES: [observations about code quality]
ISSUES: [List any concerns, or "None"]
RECOMMENDATIONS: [If CONTINUE, list specific improvements needed]
\`\`\`</parameter>
</invoke>
\`\`\`

### Handle Evaluation Result

Based on evaluation status:

**PRODUCTION_READY:**
- Proceed to Step 10

**CONTINUE:**
1. Review recommendations
2. Dispatch fix/improvement tasks to subagents
3. Re-run validation (typecheck, test, lint)
4. Commit changes:
   \`\`\`bash
   git add -A
   git commit -m "fix: address evaluation feedback

   Project: [PROJECT_NAME]
   Cycle: [N]"
   \`\`\`
5. Re-run Step 9 (Evaluate Quality)
6. If evaluation cycles exceed 2, proceed to Step 10 with current state

Note: Subsequent cycles skip Steps 7-8 (Refactor and Post-Refactor Validation) since refactoring already occurred.

**BLOCKED:**
1. Report fundamental issues to user
2. Keep the project in \`projects/active/\`
3. **STOP**

## Step 10: Report Results

Report implementation status to user:

\`\`\`
## Implementation Complete

Plan: \`[PROJECT_DIR]/plan.md\`
Status: [STATUS]

### Quality Assessment
- Type Check: [PASS/FAIL]
- Tests: [PASS/FAIL]
- Lint: [PASS/FAIL]

### Tasks Completed
[N]/[N] tasks

[If issues: list with file:line references]
\`\`\`

## Step 11: Final Commit and Move Project

Commit any remaining uncommitted changes:

\`\`\`bash
git add -A
git diff --cached --quiet || git commit -m "feat: implement [PROJECT_NAME]

[BRIEF_SUMMARY_OF_IMPLEMENTATION]"
\`\`\`

**Only if status is PRODUCTION_READY**, move the project:

\`\`\`bash
mv projects/active/[PROJECT_NAME] projects/ready-for-review/
\`\`\`

Report:

\`\`\`
## Project Ready for Review

Plan: \`projects/ready-for-review/[PROJECT_NAME]/plan.md\`

All tasks completed and validated successfully.
\`\`\`

**If status is not PRODUCTION_READY** (e.g., evaluation cycles exceeded), keep project in \`projects/active/\` and inform user that manual review is needed.

### Checkpoint Cleanup (Optional)

After successful completion, checkpoints can be cleaned up:

\`\`\`bash
git tag -d implement/[PROJECT_NAME]/baseline \\
         implement/[PROJECT_NAME]/pre-implementation \\
         implement/[PROJECT_NAME]/post-implementation \\
         implement/[PROJECT_NAME]/pre-refactor 2>/dev/null
\`\`\`

### Available Checkpoints

The following checkpoints are created during execution for rollback:

| Tag | Created At | Purpose |
|-----|------------|---------|
| \`implement/[PROJECT_NAME]/baseline\` | Step 2 | Original state before any changes |
| \`implement/[PROJECT_NAME]/pre-implementation\` | Step 5 | Before task dispatch |
| \`implement/[PROJECT_NAME]/post-implementation\` | Step 6 | After implementation, before validation |
| \`implement/[PROJECT_NAME]/pre-refactor\` | Step 7 | After validation passes, before refactoring |

**Note:** Reverts are scoped to [PLAN_FILES] only\u2014files outside the plan's scope are never modified or discarded without explicit user consent.
`;

// src/implement-plan-reloader.ts
function getImplementPlanReloadFlagPath(sessionId) {
  return `/tmp/claude_implement_plan_reload_${sessionId}.enabled`;
}
var implement_plan_reloader_default = sessionStartHook({ matcher: "compact" }, (input, { logger: logger2 }) => {
  const enablementFlag = getImplementPlanReloadFlagPath(input.session_id);
  if (!existsSync2(enablementFlag)) {
    logger2.debug("Implement-plan reload not enabled for this session");
    return sessionStartOutput({});
  }
  try {
    unlinkSync(enablementFlag);
  } catch {
  }
  logger2.info("Reloading implement-plan instructions after compaction");
  return sessionStartOutput({
    systemMessage: "Implement-plan reloader: Instructions restored after context compaction",
    hookSpecificOutput: {
      additionalContext: IMPLEMENT_PLAN_INSTRUCTIONS
    }
  });
});
function enableImplementPlanReload(sessionId) {
  const enablementFlag = getImplementPlanReloadFlagPath(sessionId);
  writeFileSync(enablementFlag, "1", "utf-8");
}

// src/implement-plan-pre-compact.ts
var implement_plan_pre_compact_default = preCompactHook({}, (input, { logger: logger2 }) => {
  const activeProjects = sync("projects/active/*/plan.md", { cwd: input.cwd });
  if (activeProjects.length === 0) {
    logger2.debug("No active project found, skipping implement-plan reload enablement");
    return preCompactOutput({});
  }
  enableImplementPlanReload(input.session_id);
  logger2.info("Enabled implement-plan reload for post-compaction", {
    sessionId: input.session_id,
    activeProjects
  });
  return preCompactOutput({});
});

// ../../../tmp/claude-code-hooks-build/c60b45ecda6ebd11/wrapper.ts
execute(implement_plan_pre_compact_default);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvZW52LmpzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9wYWNrYWdlcy9jbGF1ZGUtY29kZS1ob29rcy9kaXN0L2hvb2tzLmpzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9wYWNrYWdlcy9jbGF1ZGUtY29kZS1ob29rcy9kaXN0L2xvZ2dlci5qcyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvY2xhdWRlLWNvZGUtaG9va3MvZGlzdC9vdXRwdXRzLmpzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9wYWNrYWdlcy9jbGF1ZGUtY29kZS1ob29rcy9kaXN0L3J1bnRpbWUuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL25vZGVfbW9kdWxlcy9AaXNhYWNzL2JhbGFuY2VkLW1hdGNoL3NyYy9pbmRleC50cyIsICIuLi8uLi8uLi93b3Jrc3BhY2Uvbm9kZV9tb2R1bGVzL0Bpc2FhY3MvYnJhY2UtZXhwYW5zaW9uL3NyYy9pbmRleC50cyIsICIuLi8uLi8uLi93b3Jrc3BhY2Uvbm9kZV9tb2R1bGVzL2dsb2Ivbm9kZV9tb2R1bGVzL21pbmltYXRjaC9zcmMvYXNzZXJ0LXZhbGlkLXBhdHRlcm4udHMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL25vZGVfbW9kdWxlcy9nbG9iL25vZGVfbW9kdWxlcy9taW5pbWF0Y2gvc3JjL2JyYWNlLWV4cHJlc3Npb25zLnRzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ2xvYi9ub2RlX21vZHVsZXMvbWluaW1hdGNoL3NyYy91bmVzY2FwZS50cyIsICIuLi8uLi8uLi93b3Jrc3BhY2Uvbm9kZV9tb2R1bGVzL2dsb2Ivbm9kZV9tb2R1bGVzL21pbmltYXRjaC9zcmMvYXN0LnRzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ2xvYi9ub2RlX21vZHVsZXMvbWluaW1hdGNoL3NyYy9lc2NhcGUudHMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL25vZGVfbW9kdWxlcy9nbG9iL25vZGVfbW9kdWxlcy9taW5pbWF0Y2gvc3JjL2luZGV4LnRzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ2xvYi9zcmMvZ2xvYi50cyIsICIuLi8uLi8uLi93b3Jrc3BhY2Uvbm9kZV9tb2R1bGVzL2dsb2Ivbm9kZV9tb2R1bGVzL2xydS1jYWNoZS9zcmMvaW5kZXgudHMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL25vZGVfbW9kdWxlcy9nbG9iL25vZGVfbW9kdWxlcy9wYXRoLXNjdXJyeS9zcmMvaW5kZXgudHMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL25vZGVfbW9kdWxlcy9taW5pcGFzcy9zcmMvaW5kZXgudHMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL25vZGVfbW9kdWxlcy9nbG9iL3NyYy9wYXR0ZXJuLnRzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ2xvYi9zcmMvaWdub3JlLnRzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ2xvYi9zcmMvcHJvY2Vzc29yLnRzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ2xvYi9zcmMvd2Fsa2VyLnRzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ2xvYi9zcmMvaGFzLW1hZ2ljLnRzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ2xvYi9zcmMvaW5kZXgudHMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2dvb2Rmb290LWhvb2tzL3NyYy9pbXBsZW1lbnQtcGxhbi1yZWxvYWRlci50cyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvZ29vZGZvb3QtaG9va3Mvc3JjL2ltcGxlbWVudC1wbGFuLWluc3RydWN0aW9ucy50cyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvZ29vZGZvb3QtaG9va3Mvc3JjL2ltcGxlbWVudC1wbGFuLXByZS1jb21wYWN0LnRzIiwgIndyYXBwZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogRW52aXJvbm1lbnQgdmFyaWFibGUgdXRpbGl0aWVzIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyB0eXBlZCBhY2Nlc3MgdG8gQ2xhdWRlIENvZGUncyBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHV0aWxpdGllc1xuICogZm9yIHBlcnNpc3RpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzIGluIFNlc3Npb25TdGFydCBob29rcy5cbiAqXG4gKiAjIyBFbnZpcm9ubWVudCBWYXJpYWJsZXNcbiAqXG4gKiBDbGF1ZGUgQ29kZSBzZXRzIHRoZXNlIGVudmlyb25tZW50IHZhcmlhYmxlcyB3aGVuIHJ1bm5pbmcgaG9va3M6XG4gKlxuICogfCBWYXJpYWJsZSB8IERlc2NyaXB0aW9uIHwgQXZhaWxhYmxlIEluIHxcbiAqIHwtLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLS18XG4gKiB8IGBDTEFVREVfUFJPSkVDVF9ESVJgIHwgQWJzb2x1dGUgcGF0aCB0byBwcm9qZWN0IHJvb3QgfCBBbGwgaG9va3MgfFxuICogfCBgQ0xBVURFX0VOVl9GSUxFYCB8IFBhdGggdG8gZmlsZSBmb3IgcGVyc2lzdGluZyBlbnYgdmFycyB8IFNlc3Npb25TdGFydCBvbmx5IHxcbiAqIHwgYENMQVVERV9DT0RFX1JFTU9URWAgfCBgXCJ0cnVlXCJgIGlmIHJ1bm5pbmcgcmVtb3RlbHkgfCBBbGwgaG9va3MgfFxuICogQG1vZHVsZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGdldFByb2plY3REaXIsIHBlcnNpc3RFbnZWYXIsIGlzUmVtb3RlRW52aXJvbm1lbnQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEdldCBwcm9qZWN0IGRpcmVjdG9yeVxuICogY29uc3QgcHJvamVjdERpciA9IGdldFByb2plY3REaXIoKTtcbiAqXG4gKiAvLyBDaGVjayBpZiBydW5uaW5nIHJlbW90ZWx5XG4gKiBpZiAoaXNSZW1vdGVFbnZpcm9ubWVudCgpKSB7XG4gKiAgIC8vIEhhbmRsZSByZW1vdGUtc3BlY2lmaWMgbG9naWNcbiAqIH1cbiAqXG4gKiAvLyBJbiBTZXNzaW9uU3RhcnQgaG9vazogcGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAqIHBlcnNpc3RFbnZWYXIoJ05PREVfRU5WJywgJ3Byb2R1Y3Rpb24nKTtcbiAqIHBlcnNpc3RFbnZWYXIoJ0FQSV9LRVknLCAnc2VjcmV0LWtleScpO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjaG9vay1leGVjdXRpb24tZGV0YWlsc1xuICovXG5pbXBvcnQgKiBhcyBmcyBmcm9tIFwibm9kZTpmc1wiO1xuLyoqXG4gKiBDbGF1ZGUgQ29kZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBuYW1lcy5cbiAqXG4gKiBUaGVzZSBhcmUgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlcyB0aGF0IENsYXVkZSBDb2RlIHNldHMgd2hlbiBydW5uaW5nIGhvb2tzLlxuICovXG5leHBvcnQgY29uc3QgQ0xBVURFX0VOVl9WQVJTID0ge1xuICAgIC8qKlxuICAgICAqIEFic29sdXRlIHBhdGggdG8gdGhlIHByb2plY3Qgcm9vdCBkaXJlY3Rvcnkgd2hlcmUgQ2xhdWRlIENvZGUgd2FzIHN0YXJ0ZWQuXG4gICAgICogQXZhaWxhYmxlIGluIGFsbCBob29rcy5cbiAgICAgKi9cbiAgICBQUk9KRUNUX0RJUjogXCJDTEFVREVfUFJPSkVDVF9ESVJcIixcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGEgZmlsZSB3aGVyZSBTZXNzaW9uU3RhcnQgaG9va3MgY2FuIHBlcnNpc3QgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICAgICAqIFZhcmlhYmxlcyB3cml0dGVuIHRvIHRoaXMgZmlsZSB3aWxsIGJlIGF2YWlsYWJsZSBpbiBhbGwgc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzLlxuICAgICAqIE9ubHkgYXZhaWxhYmxlIGluIFNlc3Npb25TdGFydCBob29rcy5cbiAgICAgKi9cbiAgICBFTlZfRklMRTogXCJDTEFVREVfRU5WX0ZJTEVcIixcbiAgICAvKipcbiAgICAgKiBTZXQgdG8gXCJ0cnVlXCIgd2hlbiBydW5uaW5nIGluIGEgcmVtb3RlICh3ZWIpIGVudmlyb25tZW50LlxuICAgICAqIE5vdCBzZXQgb3IgZW1wdHkgd2hlbiBydW5uaW5nIGluIGxvY2FsIENMSSBlbnZpcm9ubWVudC5cbiAgICAgKi9cbiAgICBSRU1PVEU6IFwiQ0xBVURFX0NPREVfUkVNT1RFXCIsXG59O1xuLyoqXG4gKiBHZXRzIHRoZSBDbGF1ZGUgQ29kZSBwcm9qZWN0IGRpcmVjdG9yeS5cbiAqXG4gKiBUaGlzIGlzIHRoZSBhYnNvbHV0ZSBwYXRoIHRvIHRoZSBwcm9qZWN0IHJvb3Qgd2hlcmUgQ2xhdWRlIENvZGUgd2FzIHN0YXJ0ZWQuXG4gKiBUaGUgdmFsdWUgY29tZXMgZnJvbSB0aGUgYENMQVVERV9QUk9KRUNUX0RJUmAgZW52aXJvbm1lbnQgdmFyaWFibGUuXG4gKiBAcmV0dXJucyBUaGUgcHJvamVjdCBkaXJlY3RvcnkgcGF0aCwgb3IgdW5kZWZpbmVkIGlmIG5vdCBzZXRcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBwcm9qZWN0RGlyID0gZ2V0UHJvamVjdERpcigpO1xuICogaWYgKHByb2plY3REaXIpIHtcbiAqICAgY29uc3QgY29uZmlnUGF0aCA9IGAke3Byb2plY3REaXJ9Ly5jbGF1ZGUvY29uZmlnLmpzb25gO1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcm9qZWN0RGlyKCkge1xuICAgIHJldHVybiBwcm9jZXNzLmVudltDTEFVREVfRU5WX1ZBUlMuUFJPSkVDVF9ESVJdO1xufVxuLyoqXG4gKiBHZXRzIHRoZSBDbGF1ZGUgQ29kZSBlbnYgZmlsZSBwYXRoIGZvciBwZXJzaXN0aW5nIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAqXG4gKiBUaGlzIGlzIG9ubHkgYXZhaWxhYmxlIGluIFNlc3Npb25TdGFydCBob29rcy4gVGhlIHBhdGggcG9pbnRzIHRvIGEgZmlsZVxuICogd2hlcmUgeW91IGNhbiB3cml0ZSBzaGVsbCBleHBvcnQgc3RhdGVtZW50cyB0byBwZXJzaXN0IGVudmlyb25tZW50IHZhcmlhYmxlc1xuICogZm9yIGFsbCBzdWJzZXF1ZW50IGJhc2ggY29tbWFuZHMgaW4gdGhlIHNlc3Npb24uXG4gKiBAcmV0dXJucyBUaGUgZW52IGZpbGUgcGF0aCwgb3IgdW5kZWZpbmVkIGlmIG5vdCBzZXQgKG5vdCBhIFNlc3Npb25TdGFydCBob29rKVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IGVudkZpbGUgPSBnZXRFbnZGaWxlUGF0aCgpO1xuICogaWYgKGVudkZpbGUpIHtcbiAqICAgLy8gV2UncmUgaW4gYSBTZXNzaW9uU3RhcnQgaG9vayBhbmQgY2FuIHBlcnNpc3QgZW52IHZhcnNcbiAqICAgcGVyc2lzdEVudlZhcignTVlfVkFSJywgJ215LXZhbHVlJyk7XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEVudkZpbGVQYXRoKCkge1xuICAgIHJldHVybiBwcm9jZXNzLmVudltDTEFVREVfRU5WX1ZBUlMuRU5WX0ZJTEVdO1xufVxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGhvb2sgaXMgcnVubmluZyBpbiBhIHJlbW90ZSAod2ViKSBlbnZpcm9ubWVudC5cbiAqXG4gKiBSZW1vdGUgZW52aXJvbm1lbnRzIG1heSBoYXZlIGRpZmZlcmVudCBjYXBhYmlsaXRpZXMgb3IgcmVzdHJpY3Rpb25zXG4gKiBjb21wYXJlZCB0byBsb2NhbCBDTEkgZW52aXJvbm1lbnRzLlxuICogQHJldHVybnMgdHJ1ZSBpZiBydW5uaW5nIHJlbW90ZWx5LCBmYWxzZSBpZiBydW5uaW5nIGxvY2FsbHlcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpZiAoaXNSZW1vdGVFbnZpcm9ubWVudCgpKSB7XG4gKiAgIC8vIFVzZSB3ZWItY29tcGF0aWJsZSBhcHByb2FjaGVzXG4gKiB9IGVsc2Uge1xuICogICAvLyBDYW4gdXNlIGxvY2FsIENMSSBmZWF0dXJlc1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1JlbW90ZUVudmlyb25tZW50KCkge1xuICAgIHJldHVybiBwcm9jZXNzLmVudltDTEFVREVfRU5WX1ZBUlMuUkVNT1RFXSA9PT0gXCJ0cnVlXCI7XG59XG4vKipcbiAqIFBlcnNpc3RzIGFuIGVudmlyb25tZW50IHZhcmlhYmxlIGZvciB1c2UgaW4gc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gd3JpdGVzIGEgc2hlbGwgZXhwb3J0IHN0YXRlbWVudCB0byB0aGUgYENMQVVERV9FTlZfRklMRWAsXG4gKiB3aGljaCBDbGF1ZGUgQ29kZSBzb3VyY2VzIGJlZm9yZSBydW5uaW5nIGJhc2ggY29tbWFuZHMuIFRoaXMgYWxsb3dzXG4gKiBTZXNzaW9uU3RhcnQgaG9va3MgdG8gY29uZmlndXJlIHRoZSBlbnZpcm9ubWVudCBmb3IgdGhlIGVudGlyZSBzZXNzaW9uLlxuICpcbiAqICoqSW1wb3J0YW50Kio6IFRoaXMgZnVuY3Rpb24gb25seSB3b3JrcyBpbiBTZXNzaW9uU3RhcnQgaG9va3Mgd2hlcmVcbiAqIGBDTEFVREVfRU5WX0ZJTEVgIGlzIHNldC4gSW4gb3RoZXIgaG9va3MsIGl0IHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gKiBAcGFyYW0gbmFtZSAtIFRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBuYW1lXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgZW52aXJvbm1lbnQgdmFyaWFibGUgdmFsdWUgKHdpbGwgYmUgc2hlbGwtZXNjYXBlZClcbiAqIEB0aHJvd3MgRXJyb3IgaWYgQ0xBVURFX0VOVl9GSUxFIGlzIG5vdCBzZXQgKG5vdCBpbiBhIFNlc3Npb25TdGFydCBob29rKVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHNlc3Npb25TdGFydEhvb2ssIHNlc3Npb25TdGFydE91dHB1dCwgcGVyc2lzdEVudlZhciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogZXhwb3J0IGRlZmF1bHQgc2Vzc2lvblN0YXJ0SG9vayh7fSwgYXN5bmMgKGlucHV0KSA9PiB7XG4gKiAgIC8vIFBlcnNpc3QgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciB0aGUgc2Vzc2lvblxuICogICBwZXJzaXN0RW52VmFyKCdOT0RFX0VOVicsICdwcm9kdWN0aW9uJyk7XG4gKiAgIHBlcnNpc3RFbnZWYXIoJ0FQSV9LRVknLCBwcm9jZXNzLmVudi5NWV9BUElfS0VZID8/ICdkZWZhdWx0Jyk7XG4gKiAgIHBlcnNpc3RFbnZWYXIoJ1BBVEgnLCBgJHtwcm9jZXNzLmVudi5QQVRIfTouL25vZGVfbW9kdWxlcy8uYmluYCk7XG4gKlxuICogICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHt9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjcGVyc2lzdGluZy1lbnZpcm9ubWVudC12YXJpYWJsZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBlcnNpc3RFbnZWYXIobmFtZSwgdmFsdWUpIHtcbiAgICBjb25zdCBlbnZGaWxlID0gZ2V0RW52RmlsZVBhdGgoKTtcbiAgICBpZiAoZW52RmlsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInBlcnNpc3RFbnZWYXIgY2FuIG9ubHkgYmUgdXNlZCBpbiBTZXNzaW9uU3RhcnQgaG9va3MuIFwiICsgXCJDTEFVREVfRU5WX0ZJTEUgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgbm90IHNldC5cIik7XG4gICAgfVxuICAgIC8vIFNoZWxsLWVzY2FwZSB0aGUgdmFsdWUgdG8gaGFuZGxlIHNwZWNpYWwgY2hhcmFjdGVyc1xuICAgIGNvbnN0IGVzY2FwZWRWYWx1ZSA9IGVzY2FwZVNoZWxsVmFsdWUodmFsdWUpO1xuICAgIC8vIFdyaXRlIHRoZSBleHBvcnQgc3RhdGVtZW50XG4gICAgY29uc3QgZXhwb3J0U3RhdGVtZW50ID0gYGV4cG9ydCAke25hbWV9PSR7ZXNjYXBlZFZhbHVlfVxcbmA7XG4gICAgZnMuYXBwZW5kRmlsZVN5bmMoZW52RmlsZSwgZXhwb3J0U3RhdGVtZW50LCBcInV0Zi04XCIpO1xufVxuLyoqXG4gKiBQZXJzaXN0cyBtdWx0aXBsZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYXQgb25jZS5cbiAqXG4gKiBUaGlzIGlzIGEgY29udmVuaWVuY2Ugd3JhcHBlciBhcm91bmQgYHBlcnNpc3RFbnZWYXJgIGZvciBzZXR0aW5nXG4gKiBtdWx0aXBsZSB2YXJpYWJsZXMgaW4gYSBzaW5nbGUgY2FsbC5cbiAqIEBwYXJhbSB2YXJzIC0gT2JqZWN0IG1hcHBpbmcgdmFyaWFibGUgbmFtZXMgdG8gdmFsdWVzXG4gKiBAdGhyb3dzIEVycm9yIGlmIENMQVVERV9FTlZfRklMRSBpcyBub3Qgc2V0IChub3QgaW4gYSBTZXNzaW9uU3RhcnQgaG9vaylcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBwZXJzaXN0RW52VmFycyh7XG4gKiAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXG4gKiAgIEFQSV9LRVk6ICdzZWNyZXQnLFxuICogICBERUJVRzogJ2ZhbHNlJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBlcnNpc3RFbnZWYXJzKHZhcnMpIHtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModmFycykpIHtcbiAgICAgICAgcGVyc2lzdEVudlZhcihuYW1lLCB2YWx1ZSk7XG4gICAgfVxufVxuLyoqXG4gKiBFc2NhcGVzIGEgdmFsdWUgZm9yIHNhZmUgdXNlIGluIGEgc2hlbGwgZXhwb3J0IHN0YXRlbWVudC5cbiAqXG4gKiBVc2VzIHNpbmdsZSBxdW90ZXMgYW5kIGVzY2FwZXMgYW55IGVtYmVkZGVkIHNpbmdsZSBxdW90ZXMuXG4gKiBUaGlzIHByZXZlbnRzIHNoZWxsIGluamVjdGlvbiBhbmQgaGFuZGxlcyBzcGVjaWFsIGNoYXJhY3RlcnMuXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gZXNjYXBlXG4gKiBAcmV0dXJucyBUaGUgc2hlbGwtZXNjYXBlZCB2YWx1ZSAod2l0aCBxdW90ZXMpXG4gKiBAaW50ZXJuYWxcbiAqL1xuZnVuY3Rpb24gZXNjYXBlU2hlbGxWYWx1ZSh2YWx1ZSkge1xuICAgIC8vIFVzZSBzaW5nbGUgcXVvdGVzIGFuZCBlc2NhcGUgYW55IGVtYmVkZGVkIHNpbmdsZSBxdW90ZXNcbiAgICAvLyAndmFsdWUnIC0+ICd2YWwnXFwnJ3VlJyBmb3IgdmFsdWVzIGNvbnRhaW5pbmcgc2luZ2xlIHF1b3Rlc1xuICAgIGNvbnN0IGVzY2FwZWQgPSB2YWx1ZS5yZXBsYWNlKC8nL2csIFwiJ1xcXFwnJ1wiKTtcbiAgICByZXR1cm4gYCcke2VzY2FwZWR9J2A7XG59XG4iLCAiLyoqXG4gKiBIb29rIGZhY3RvcnkgZnVuY3Rpb25zIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyB0eXBlZCBmYWN0b3J5IGZ1bmN0aW9ucyBmb3IgYWxsIDEyIGhvb2sgdHlwZXMgdGhhdCBoYW5kbGU6XG4gKiAtIElucHV0IHR5cGUgbmFycm93aW5nIGJhc2VkIG9uIGhvb2sgZXZlbnQgdHlwZVxuICogLSBPdXRwdXQgdHlwZSBlbmZvcmNlbWVudCB2aWEgcmV0dXJuIHR5cGVzXG4gKiAtIEVycm9yIHdyYXBwaW5nIHdpdGggYXV0b21hdGljIGxvZ2dpbmdcbiAqIC0gTG9nZ2VyIGNvbnRleHQgaW5qZWN0aW9uXG4gKlxuICogRWFjaCBmYWN0b3J5IGFjY2VwdHMgYSBIb29rQ29uZmlnIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dCBzZXR0aW5ncyxcbiAqIGFuZCByZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB0aGUgcnVudGltZSBpbnZva2VzIHdoZW4gdGhlIGhvb2sgZmlsZSBleGVjdXRlcy5cbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBwcmVUb29sVXNlSG9vaywgcHJlVG9vbFVzZU91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogZXhwb3J0IGRlZmF1bHQgcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnQmFzaCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdQcm9jZXNzaW5nIEJhc2ggY29tbWFuZCcpO1xuICogICByZXR1cm4gcHJlVG9vbFVzZU91dHB1dCh7IGFsbG93OiB0cnVlIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICovXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBHZW5lcmljIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIGhvb2sgZmFjdG9yeSBmdW5jdGlvbiBmb3IgYSBzcGVjaWZpYyBob29rIHR5cGUuXG4gKlxuICogVGhpcyBpcyB0aGUgaW50ZXJuYWwgaW1wbGVtZW50YXRpb24gdXNlZCBieSBhbGwgdHlwZWQgZmFjdG9yaWVzLlxuICogSXQgd3JhcHMgdGhlIGhhbmRsZXIgd2l0aCBlcnJvciBjYXRjaGluZyBhbmQgbG9nZ2luZy5cbiAqIEBwYXJhbSBob29rRXZlbnROYW1lIC0gVGhlIGhvb2sgZXZlbnQgbmFtZVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvblxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byB3cmFwXG4gKiBAcmV0dXJucyBBIHdyYXBwZWQgaG9vayBmdW5jdGlvblxuICogQGludGVybmFsXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUhvb2tGdW5jdGlvbihob29rRXZlbnROYW1lLCBjb25maWcsIGhhbmRsZXIpIHtcbiAgICBjb25zdCBob29rRm4gPSBhc3luYyAoaW5wdXQsIGNvbnRleHQpID0+IHtcbiAgICAgICAgLy8gRGVsZWdhdGUgZXJyb3IgaGFuZGxpbmcgdG8gdGhlIHJ1bnRpbWUgLSBqdXN0IGV4ZWN1dGUgdGhlIGhhbmRsZXJcbiAgICAgICAgLy8gVGhlIHJ1bnRpbWUgd2lsbCBjYXRjaCBlcnJvcnMsIGxvZyB0aGVtLCBhbmQgcmV0dXJuIGFwcHJvcHJpYXRlIG91dHB1dFxuICAgICAgICByZXR1cm4gYXdhaXQgaGFuZGxlcihpbnB1dCwgY29udGV4dCk7XG4gICAgfTtcbiAgICAvLyBBdHRhY2ggbWV0YWRhdGEgZm9yIHJ1bnRpbWUgaW5zcGVjdGlvblxuICAgIGhvb2tGbi5ob29rRXZlbnROYW1lID0gaG9va0V2ZW50TmFtZTtcbiAgICBob29rRm4ubWF0Y2hlciA9IGNvbmZpZy5tYXRjaGVyO1xuICAgIGhvb2tGbi50aW1lb3V0ID0gY29uZmlnLnRpbWVvdXQ7XG4gICAgcmV0dXJuIGhvb2tGbjtcbn1cbi8qKiBAaW5oZXJpdGRvYyAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZVRvb2xVc2VIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJQcmVUb29sVXNlXCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwb3N0VG9vbFVzZUhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlBvc3RUb29sVXNlXCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwb3N0VG9vbFVzZUZhaWx1cmVIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJQb3N0VG9vbFVzZUZhaWx1cmVcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIE5vdGlmaWNhdGlvbiBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIE5vdGlmaWNhdGlvbiBob29rIGhhbmRsZXIuXG4gKlxuICogTm90aWZpY2F0aW9uIGhvb2tzIGZpcmUgd2hlbiBDbGF1ZGUgQ29kZSBzZW5kcyBhIG5vdGlmaWNhdGlvbiwgYWxsb3dpbmcgeW91IHRvOlxuICogLSBGb3J3YXJkIG5vdGlmaWNhdGlvbnMgdG8gZXh0ZXJuYWwgc3lzdGVtc1xuICogLSBMb2cgaW1wb3J0YW50IGV2ZW50c1xuICogLSBUcmlnZ2VyIGN1c3RvbSBhbGVydGluZ1xuICpcbiAqICoqTWF0Y2hlcioqOiBNYXRjaGVzIGFnYWluc3QgYG5vdGlmaWNhdGlvbl90eXBlYFxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IG5vdGlmaWNhdGlvbkhvb2ssIG5vdGlmaWNhdGlvbk91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gRm9yd2FyZCBub3RpZmljYXRpb25zIHRvIFNsYWNrXG4gKiBleHBvcnQgZGVmYXVsdCBub3RpZmljYXRpb25Ib29rKHt9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ05vdGlmaWNhdGlvbiByZWNlaXZlZCcsIHtcbiAqICAgICB0eXBlOiBpbnB1dC5ub3RpZmljYXRpb25fdHlwZSxcbiAqICAgICB0aXRsZTogaW5wdXQudGl0bGVcbiAqICAgfSk7XG4gKlxuICogICBhd2FpdCBzZW5kU2xhY2tNZXNzYWdlKGlucHV0LnRpdGxlID8/ICdOb3RpZmljYXRpb24nLCBpbnB1dC5tZXNzYWdlKTtcbiAqXG4gKiAgIHJldHVybiBub3RpZmljYXRpb25PdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNub3RpZmljYXRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vdGlmaWNhdGlvbkhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIk5vdGlmaWNhdGlvblwiLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gVXNlclByb21wdFN1Ym1pdCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFVzZXJQcm9tcHRTdWJtaXQgaG9vayBoYW5kbGVyLlxuICpcbiAqIFVzZXJQcm9tcHRTdWJtaXQgaG9va3MgZmlyZSB3aGVuIGEgdXNlciBzdWJtaXRzIGEgcHJvbXB0LCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEFkZCBhZGRpdGlvbmFsIGNvbnRleHQgb3IgaW5zdHJ1Y3Rpb25zXG4gKiAtIExvZyB1c2VyIGludGVyYWN0aW9uc1xuICogLSBWYWxpZGF0ZSBvciB0cmFuc2Zvcm0gcHJvbXB0c1xuICpcbiAqICoqTWF0Y2hlcioqOiBObyBtYXRjaGVyIHN1cHBvcnQgLSBmaXJlcyBvbiBhbGwgcHJvbXB0IHN1Ym1pc3Npb25zXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgdGltZW91dCAobWF0Y2hlciBpcyBpZ25vcmVkKVxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgdXNlclByb21wdFN1Ym1pdEhvb2ssIHVzZXJQcm9tcHRTdWJtaXRPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEFkZCBwcm9qZWN0IGNvbnRleHQgdG8gZXZlcnkgcHJvbXB0XG4gKiBleHBvcnQgZGVmYXVsdCB1c2VyUHJvbXB0U3VibWl0SG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5kZWJ1ZygnVXNlciBwcm9tcHQgc3VibWl0dGVkJywgeyBwcm9tcHRMZW5ndGg6IGlucHV0LnByb21wdC5sZW5ndGggfSk7XG4gKlxuICogICBjb25zdCBwcm9qZWN0Q29udGV4dCA9IGF3YWl0IGdldFByb2plY3RDb250ZXh0KCk7XG4gKlxuICogICByZXR1cm4gdXNlclByb21wdFN1Ym1pdE91dHB1dCh7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6IHByb2plY3RDb250ZXh0XG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyN1c2VycHJvbXB0c3VibWl0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VyUHJvbXB0U3VibWl0SG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiVXNlclByb21wdFN1Ym1pdFwiLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2Vzc2lvblN0YXJ0IEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgU2Vzc2lvblN0YXJ0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTZXNzaW9uU3RhcnQgaG9va3MgZmlyZSB3aGVuIGEgQ2xhdWRlIENvZGUgc2Vzc2lvbiBzdGFydHMgb3IgcmVzdGFydHMsXG4gKiBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEluaXRpYWxpemUgc2Vzc2lvbiBzdGF0ZVxuICogLSBJbmplY3QgY29udGV4dCBvciBpbnN0cnVjdGlvbnNcbiAqIC0gUGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIHN1YnNlcXVlbnQgYmFzaCBjb21tYW5kc1xuICogLSBTZXQgdXAgbG9nZ2luZyBvciBtb25pdG9yaW5nXG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgc291cmNlYCAoJ3N0YXJ0dXAnLCAncmVzdW1lJywgJ2NsZWFyJywgJ2NvbXBhY3QnKVxuICpcbiAqICoqQ29udGV4dCoqOiBTZXNzaW9uU3RhcnQgaG9va3MgcmVjZWl2ZSBhbiBleHRlbmRlZCBjb250ZXh0IHdpdGggYHBlcnNpc3RFbnZWYXJgXG4gKiBhbmQgYHBlcnNpc3RFbnZWYXJzYCBmdW5jdGlvbnMgZm9yIHNldHRpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHNlc3Npb25TdGFydEhvb2ssIHNlc3Npb25TdGFydE91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gUGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIHRoZSBzZXNzaW9uXG4gKiBleHBvcnQgZGVmYXVsdCBzZXNzaW9uU3RhcnRIb29rKHsgbWF0Y2hlcjogJ3N0YXJ0dXAnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIsIHBlcnNpc3RFbnZWYXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnTmV3IHNlc3Npb24gc3RhcnRlZCcsIHtcbiAqICAgICBzZXNzaW9uSWQ6IGlucHV0LnNlc3Npb25faWQsXG4gKiAgICAgY3dkOiBpbnB1dC5jd2RcbiAqICAgfSk7XG4gKlxuICogICAvLyBTZXQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciBhbGwgc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzXG4gKiAgIHBlcnNpc3RFbnZWYXIoJ05PREVfRU5WJywgJ2RldmVsb3BtZW50Jyk7XG4gKiAgIHBlcnNpc3RFbnZWYXIoJ0RFQlVHJywgJ3RydWUnKTtcbiAqXG4gKiAgIHJldHVybiBzZXNzaW9uU3RhcnRPdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBTZXQgbXVsdGlwbGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIGF0IG9uY2VcbiAqIGV4cG9ydCBkZWZhdWx0IHNlc3Npb25TdGFydEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBwZXJzaXN0RW52VmFycyB9KSA9PiB7XG4gKiAgIHBlcnNpc3RFbnZWYXJzKHtcbiAqICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICogICAgIEFQSV9LRVk6ICdzZWNyZXQnLFxuICogICAgIERFQlVHOiAnZmFsc2UnXG4gKiAgIH0pO1xuICpcbiAqICAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3Nlc3Npb25zdGFydFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2Vzc2lvblN0YXJ0SG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiU2Vzc2lvblN0YXJ0XCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTZXNzaW9uRW5kIEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgU2Vzc2lvbkVuZCBob29rIGhhbmRsZXIuXG4gKlxuICogU2Vzc2lvbkVuZCBob29rcyBmaXJlIHdoZW4gYSBDbGF1ZGUgQ29kZSBzZXNzaW9uIGVuZHMsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gQ2xlYW4gdXAgc2Vzc2lvbiByZXNvdXJjZXNcbiAqIC0gTG9nIHNlc3Npb24gbWV0cmljc1xuICogLSBQZXJzaXN0IHNlc3Npb24gc3RhdGVcbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGByZWFzb25gICh0aGUgZXhpdCByZWFzb24gc3RyaW5nKVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHNlc3Npb25FbmRIb29rLCBzZXNzaW9uRW5kT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBMb2cgc2Vzc2lvbiBlbmQgYW5kIGNsZWFuIHVwXG4gKiBleHBvcnQgZGVmYXVsdCBzZXNzaW9uRW5kSG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdTZXNzaW9uIGVuZGVkJywge1xuICogICAgIHNlc3Npb25JZDogaW5wdXQuc2Vzc2lvbl9pZCxcbiAqICAgICByZWFzb246IGlucHV0LnJlYXNvblxuICogICB9KTtcbiAqXG4gKiAgIGF3YWl0IGNsZWFudXBTZXNzaW9uUmVzb3VyY2VzKGlucHV0LnNlc3Npb25faWQpO1xuICpcbiAqICAgcmV0dXJuIHNlc3Npb25FbmRPdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNzZXNzaW9uZW5kXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXNzaW9uRW5kSG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiU2Vzc2lvbkVuZFwiLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RvcCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFN0b3AgaG9vayBoYW5kbGVyLlxuICpcbiAqIFN0b3AgaG9va3MgZmlyZSB3aGVuIENsYXVkZSBDb2RlIGlzIGFib3V0IHRvIHN0b3AsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gQmxvY2sgdGhlIHN0b3AgYW5kIHJlcXVpcmUgYWRkaXRpb25hbCBhY3Rpb25cbiAqIC0gQ29uZmlybSB0aGUgdXNlciB3YW50cyB0byBzdG9wXG4gKiAtIENsZWFuIHVwIHJlc291cmNlcyBiZWZvcmUgc3RvcHBpbmdcbiAqXG4gKiAqKk1hdGNoZXIqKjogTm8gbWF0Y2hlciBzdXBwb3J0IC0gZmlyZXMgb24gYWxsIHN0b3AgZXZlbnRzXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgdGltZW91dCAobWF0Y2hlciBpcyBpZ25vcmVkKVxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc3RvcEhvb2ssIHN0b3BPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEJsb2NrIHN0b3AgaWYgdGhlcmUgYXJlIHBlbmRpbmcgY2hhbmdlc1xuICogZXhwb3J0IGRlZmF1bHQgc3RvcEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBjb25zdCBwZW5kaW5nQ2hhbmdlcyA9IGF3YWl0IGNoZWNrUGVuZGluZ0NoYW5nZXMoKTtcbiAqXG4gKiAgIGlmIChwZW5kaW5nQ2hhbmdlcy5sZW5ndGggPiAwKSB7XG4gKiAgICAgbG9nZ2VyLndhcm4oJ0Jsb2NraW5nIHN0b3AgZHVlIHRvIHBlbmRpbmcgY2hhbmdlcycsIHtcbiAqICAgICAgIGNvdW50OiBwZW5kaW5nQ2hhbmdlcy5sZW5ndGhcbiAqICAgICB9KTtcbiAqXG4gKiAgICAgcmV0dXJuIHN0b3BPdXRwdXQoe1xuICogICAgICAgZGVjaXNpb246ICdibG9jaycsXG4gKiAgICAgICByZWFzb246IGBUaGVyZSBhcmUgJHtwZW5kaW5nQ2hhbmdlcy5sZW5ndGh9IHVuY29tbWl0dGVkIGNoYW5nZXNgLFxuICogICAgICAgc3lzdGVtTWVzc2FnZTogJ1BsZWFzZSBjb21taXQgb3IgZGlzY2FyZCBjaGFuZ2VzIGJlZm9yZSBzdG9wcGluZydcbiAqICAgICB9KTtcbiAqICAgfVxuICpcbiAqICAgbG9nZ2VyLmluZm8oJ0FwcHJvdmluZyBzdG9wJyk7XG4gKiAgIHJldHVybiBzdG9wT3V0cHV0KHsgZGVjaXNpb246ICdhcHByb3ZlJyB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc3RvcFxuICovXG5leHBvcnQgZnVuY3Rpb24gc3RvcEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlN0b3BcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN1YmFnZW50U3RhcnQgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTdWJhZ2VudFN0YXJ0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTdWJhZ2VudFN0YXJ0IGhvb2tzIGZpcmUgd2hlbiBhIHN1YmFnZW50IChUYXNrIHRvb2wpIHN0YXJ0cywgYWxsb3dpbmcgeW91IHRvOlxuICogLSBJbmplY3QgY29udGV4dCBmb3IgdGhlIHN1YmFnZW50XG4gKiAtIExvZyBzdWJhZ2VudCBpbnZvY2F0aW9uc1xuICogLSBDb25maWd1cmUgc3ViYWdlbnQgYmVoYXZpb3JcbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGBhZ2VudF90eXBlYCAoZS5nLiwgJ2V4cGxvcmUnLCAnY29kZWJhc2UtYW5hbHlzaXMnKVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHN1YmFnZW50U3RhcnRIb29rLCBzdWJhZ2VudFN0YXJ0T3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBBZGQgY29udGV4dCBmb3IgZXhwbG9yZSBzdWJhZ2VudHNcbiAqIGV4cG9ydCBkZWZhdWx0IHN1YmFnZW50U3RhcnRIb29rKHsgbWF0Y2hlcjogJ2V4cGxvcmUnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnRXhwbG9yZSBzdWJhZ2VudCBzdGFydGluZycsIHtcbiAqICAgICBhZ2VudElkOiBpbnB1dC5hZ2VudF9pZCxcbiAqICAgICBhZ2VudFR5cGU6IGlucHV0LmFnZW50X3R5cGVcbiAqICAgfSk7XG4gKlxuICogICByZXR1cm4gc3ViYWdlbnRTdGFydE91dHB1dCh7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdGb2N1cyBvbiBmaW5kaW5nIHBhdHRlcm5zIGFuZCBjb252ZW50aW9ucydcbiAqICAgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3N1YmFnZW50c3RhcnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1YmFnZW50U3RhcnRIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJTdWJhZ2VudFN0YXJ0XCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdWJhZ2VudFN0b3AgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTdWJhZ2VudFN0b3AgaG9vayBoYW5kbGVyLlxuICpcbiAqIFN1YmFnZW50U3RvcCBob29rcyBmaXJlIHdoZW4gYSBzdWJhZ2VudCBjb21wbGV0ZXMgb3Igc3RvcHMsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gQmxvY2sgdGhlIHN1YmFnZW50IGZyb20gc3RvcHBpbmdcbiAqIC0gUHJvY2VzcyBzdWJhZ2VudCByZXN1bHRzXG4gKiAtIENsZWFuIHVwIHN1YmFnZW50IHJlc291cmNlc1xuICogLSBMb2cgc3ViYWdlbnQgY29tcGxldGlvblxuICpcbiAqICoqTWF0Y2hlcioqOiBNYXRjaGVzIGFnYWluc3QgYGFnZW50X3R5cGVgIChlLmcuLCAnZXhwbG9yZScsICdjb2RlYmFzZS1hbmFseXNpcycpXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc3ViYWdlbnRTdG9wSG9vaywgc3ViYWdlbnRTdG9wT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBCbG9jayBleHBsb3JlIHN1YmFnZW50cyBpZiB0YXNrIGluY29tcGxldGVcbiAqIGV4cG9ydCBkZWZhdWx0IHN1YmFnZW50U3RvcEhvb2soeyBtYXRjaGVyOiAnZXhwbG9yZScgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdTdWJhZ2VudCBzdG9wcGluZycsIHtcbiAqICAgICBhZ2VudElkOiBpbnB1dC5hZ2VudF9pZCxcbiAqICAgICBhZ2VudFR5cGU6IGlucHV0LmFnZW50X3R5cGVcbiAqICAgfSk7XG4gKlxuICogICAvLyBCbG9jayBpZiB0cmFuc2NyaXB0IHNob3dzIGluY29tcGxldGUgd29ya1xuICogICByZXR1cm4gc3ViYWdlbnRTdG9wT3V0cHV0KHtcbiAqICAgICBkZWNpc2lvbjogJ2Jsb2NrJyxcbiAqICAgICByZWFzb246ICdQbGVhc2UgdmVyaWZ5IGV4cGxvcmF0aW9uIGlzIGNvbXBsZXRlJ1xuICogICB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc3ViYWdlbnRzdG9wXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdWJhZ2VudFN0b3BIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJTdWJhZ2VudFN0b3BcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFByZUNvbXBhY3QgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBQcmVDb21wYWN0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBQcmVDb21wYWN0IGhvb2tzIGZpcmUgYmVmb3JlIGNvbnRleHQgY29tcGFjdGlvbiBvY2N1cnMsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gUHJlc2VydmUgaW1wb3J0YW50IGluZm9ybWF0aW9uIGJlZm9yZSBjb21wYWN0aW9uXG4gKiAtIExvZyBjb21wYWN0aW9uIGV2ZW50c1xuICogLSBNb2RpZnkgY3VzdG9tIGluc3RydWN0aW9ucyBmb3IgdGhlIGNvbXBhY3RlZCBjb250ZXh0XG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgdHJpZ2dlcmAgKCdtYW51YWwnLCAnYXV0bycpXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgcHJlQ29tcGFjdEhvb2ssIHByZUNvbXBhY3RPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIExvZyBjb21wYWN0aW9uIGV2ZW50cyBhbmQgcHJlc2VydmUgY29udGV4dFxuICogZXhwb3J0IGRlZmF1bHQgcHJlQ29tcGFjdEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnQ29udGV4dCBjb21wYWN0aW9uIHRyaWdnZXJlZCcsIHtcbiAqICAgICB0cmlnZ2VyOiBpbnB1dC50cmlnZ2VyLFxuICogICAgIGhhc0N1c3RvbUluc3RydWN0aW9uczogaW5wdXQuY3VzdG9tX2luc3RydWN0aW9ucyAhPT0gbnVsbFxuICogICB9KTtcbiAqXG4gKiAgIHJldHVybiBwcmVDb21wYWN0T3V0cHV0KHtcbiAqICAgICBzeXN0ZW1NZXNzYWdlOiAnUmVtZW1iZXI6IHN0cmljdCBtb2RlIGlzIGVuYWJsZWQnXG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBPbmx5IGhhbmRsZSBtYW51YWwgY29tcGFjdGlvblxuICogZXhwb3J0IGRlZmF1bHQgcHJlQ29tcGFjdEhvb2soeyBtYXRjaGVyOiAnbWFudWFsJyB9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ01hbnVhbCBjb21wYWN0aW9uIHJlcXVlc3RlZCcpO1xuICogICByZXR1cm4gcHJlQ29tcGFjdE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3ByZWNvbXBhY3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZUNvbXBhY3RIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJQcmVDb21wYWN0XCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwZXJtaXNzaW9uUmVxdWVzdEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlBlcm1pc3Npb25SZXF1ZXN0XCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4iLCAiLyoqXG4gKiBMb2dnZXIgc3lzdGVtIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyBzdHJ1Y3R1cmVkIGxvZ2dpbmcgd2l0aCBldmVudCBzdWJzY3JpcHRpb24gYW5kIG9wdGlvbmFsIGZpbGUgb3V0cHV0LlxuICogVGhlIGxvZ2dlciBpcyAqKnNpbGVudCBieSBkZWZhdWx0KiogdG8gYXZvaWQgaW50ZXJmZXJpbmcgd2l0aCBob29rIHByb3RvY29sXG4gKiAoc3Rkb3V0IGlzIHJlc2VydmVkIGZvciBKU09OIHJlc3BvbnNlcywgc3RkZXJyIG1heSBjb25mbGljdCB3aXRoIENsYXVkZSBDb2RlKS5cbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBsb2dnZXIgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIFN1YnNjcmliZSB0byBsb2cgZXZlbnRzXG4gKiBjb25zdCB1bnN1YnNjcmliZSA9IGxvZ2dlci5vbignZXJyb3InLCAoZXZlbnQpID0+IHtcbiAqICAgY29uc29sZS5lcnJvcihgRXJyb3IgaW4gJHtldmVudC5ob29rVHlwZX06ICR7ZXZlbnQubWVzc2FnZX1gKTtcbiAqIH0pO1xuICpcbiAqIC8vIExhdGVyLCBjbGVhbiB1cFxuICogdW5zdWJzY3JpYmUoKTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzXG4gKi9cbmltcG9ydCB7IGNsb3NlU3luYywgZXhpc3RzU3luYywgbWtkaXJTeW5jLCBvcGVuU3luYywgd3JpdGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG4vKipcbiAqIEFsbCBsb2cgbGV2ZWxzIGluIG9yZGVyIG9mIHNldmVyaXR5IChsb3dlc3QgdG8gaGlnaGVzdCkuXG4gKi9cbmV4cG9ydCBjb25zdCBMT0dfTEVWRUxTID0gW1wiZGVidWdcIiwgXCJpbmZvXCIsIFwid2FyblwiLCBcImVycm9yXCJdO1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gTG9nZ2VyIENsYXNzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIExvZ2dlciBmb3IgQ2xhdWRlIENvZGUgaG9va3Mgd2l0aCBldmVudCBzdWJzY3JpcHRpb24gYW5kIGZpbGUgb3V0cHV0LlxuICpcbiAqICMjIEtleSBCZWhhdmlvcnNcbiAqXG4gKiB8IENvbmZpZ3VyYXRpb24gfCBCZWhhdmlvciB8XG4gKiB8LS0tLS0tLS0tLS0tLS18LS0tLS0tLS0tLXxcbiAqIHwgTm8gY29uZmlnIChkZWZhdWx0KSB8ICoqU2lsZW50KiogLSBubyBvdXRwdXQgYW55d2hlcmUgfFxuICogfCBgQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEVgIGVudiB2YXIgfCBBcHBlbmQgSlNPTiBsaW5lcyB0byBmaWxlIHxcbiAqIHwgYC5vbihsZXZlbCwgaGFuZGxlcilgIHJlZ2lzdGVyZWQgfCBFdmVudHMgZGVsaXZlcmVkIHRvIGhhbmRsZXJzIG9ubHkgfFxuICogfCBNdWx0aXBsZSBkZXN0aW5hdGlvbnMgfCBBbGwgZGVzdGluYXRpb25zIHJlY2VpdmUgZXZlbnRzIHxcbiAqXG4gKiAjIyBJbXBvcnRhbnQgTm90ZXNcbiAqXG4gKiAtICoqTmV2ZXIgb3V0cHV0cyB0byBzdGRvdXQqKiAocmVzZXJ2ZWQgZm9yIEpTT04gaG9vayByZXNwb25zZSlcbiAqIC0gKipOZXZlciBvdXRwdXRzIHRvIHN0ZGVycioqIChtYXkgaW50ZXJmZXJlIHdpdGggQ2xhdWRlIENvZGUgZXJyb3IgaGFuZGxpbmcpXG4gKiAtIEZpbGUgb3V0cHV0IHVzZXMgSlNPTiBMaW5lcyBmb3JtYXQgZm9yIGVhc3kgcGFyc2luZ1xuICogLSBgLm9uKGxldmVsLCBoYW5kbGVyKWAgcmV0dXJucyBhbiB1bnN1YnNjcmliZSBmdW5jdGlvblxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gU3Vic2NyaWJlIHRvIGV2ZW50cyBhdCBzcGVjaWZpYyBsZXZlbFxuICogbG9nZ2VyLm9uKCd3YXJuJywgKGV2ZW50KSA9PiB7XG4gKiAgIHNlbmRBbGVydChldmVudC5tZXNzYWdlKTtcbiAqIH0pO1xuICpcbiAqIC8vIExvZyB3aXRoaW4gYSBob29rIGhhbmRsZXJcbiAqIGV4cG9ydCBkZWZhdWx0IHByZVRvb2xVc2VIb29rKHsgbWF0Y2hlcjogJ0Jhc2gnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIud2FybignQWJvdXQgdG8gdmFsaWRhdGUgQmFzaCBjb21tYW5kJyk7XG4gKiAgIHJldHVybiBwcmVUb29sVXNlT3V0cHV0KHsgYWxsb3c6IHRydWUgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgTG9nZ2VyIHtcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcmVkIGV2ZW50IGhhbmRsZXJzIGJ5IGxvZyBsZXZlbC5cbiAgICAgKi9cbiAgICBoYW5kbGVycyA9IG5ldyBNYXAoKTtcbiAgICAvKipcbiAgICAgKiBGaWxlIGRlc2NyaXB0b3IgZm9yIGxvZyBmaWxlIG91dHB1dC5cbiAgICAgKiBMYXppbHkgaW5pdGlhbGl6ZWQgb24gZmlyc3Qgd3JpdGUuXG4gICAgICovXG4gICAgbG9nRmlsZUZkID0gbnVsbDtcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHRoZSBsb2cgZmlsZSwgaWYgY29uZmlndXJlZC5cbiAgICAgKi9cbiAgICBsb2dGaWxlUGF0aCA9IG51bGw7XG4gICAgLyoqXG4gICAgICogV2hldGhlciBmaWxlIGluaXRpYWxpemF0aW9uIGhhcyBiZWVuIGF0dGVtcHRlZC5cbiAgICAgKi9cbiAgICBmaWxlSW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgICAvKipcbiAgICAgKiBDdXJyZW50IGhvb2sgY29udGV4dCBmb3IgZW5yaWNoaW5nIGxvZyBldmVudHMuXG4gICAgICovXG4gICAgY3VycmVudEhvb2tUeXBlO1xuICAgIC8qKlxuICAgICAqIEN1cnJlbnQgaG9vayBpbnB1dCBmb3IgZW5yaWNoaW5nIGxvZyBldmVudHMuXG4gICAgICovXG4gICAgY3VycmVudElucHV0O1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgTG9nZ2VyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogVHlwaWNhbGx5IHlvdSBzaG91bGQgdXNlIHRoZSBleHBvcnRlZCBgbG9nZ2VyYCBzaW5nbGV0b24gcmF0aGVyIHRoYW5cbiAgICAgKiBjcmVhdGluZyBuZXcgaW5zdGFuY2VzLlxuICAgICAqIEBwYXJhbSBjb25maWcgLSBPcHRpb25hbCBjb25maWd1cmF0aW9uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGB0eXBlc2NyaXB0XG4gICAgICogLy8gVXNlIHNpbmdsZXRvbiAocmVjb21tZW5kZWQpXG4gICAgICogaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAgICAgKlxuICAgICAqIC8vIE9yIGNyZWF0ZSBjdXN0b20gaW5zdGFuY2VcbiAgICAgKiBjb25zdCBjdXN0b21Mb2dnZXIgPSBuZXcgTG9nZ2VyKHsgbG9nRmlsZVBhdGg6ICcvdmFyL2xvZy9ob29rcy5sb2cnIH0pO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9KSB7XG4gICAgICAgIC8vIEluaXRpYWxpemUgaGFuZGxlcnMgbWFwIGZvciBlYWNoIGxldmVsXG4gICAgICAgIGZvciAoY29uc3QgbGV2ZWwgb2YgTE9HX0xFVkVMUykge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVycy5zZXQobGV2ZWwsIG5ldyBTZXQoKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2V0IGxvZyBmaWxlIHBhdGggZnJvbSBjb25maWcgb3IgZW52aXJvbm1lbnRcbiAgICAgICAgdGhpcy5sb2dGaWxlUGF0aCA9IGNvbmZpZy5sb2dGaWxlUGF0aCA/PyBwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9IT09LU19MT0dfRklMRSA/PyBudWxsO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBMb2dzIGEgZGVidWcgbWVzc2FnZS5cbiAgICAgKlxuICAgICAqIFVzZSBmb3IgZGV0YWlsZWQgZGVidWdnaW5nIGluZm9ybWF0aW9uIHRoYXQgaXMgdHlwaWNhbGx5IG9ubHkgdXNlZnVsXG4gICAgICogZHVyaW5nIGRldmVsb3BtZW50IG9yIHRyb3VibGVzaG9vdGluZy5cbiAgICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBkZWJ1ZyBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiBsb2dnZXIuZGVidWcoJ1Byb2Nlc3NpbmcgdG9vbCBpbnB1dCcsIHsgdG9vbE5hbWU6ICdCYXNoJywgaW5wdXRTaXplOiAyNTYgfSk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgZGVidWcobWVzc2FnZSwgY29udGV4dCkge1xuICAgICAgICB0aGlzLmVtaXQoXCJkZWJ1Z1wiLCBtZXNzYWdlLCBjb250ZXh0KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTG9ncyBhbiBpbmZvIG1lc3NhZ2UuXG4gICAgICpcbiAgICAgKiBVc2UgZm9yIGdlbmVyYWwgb3BlcmF0aW9uYWwgZXZlbnRzIGxpa2UgaG9vayBpbnZvY2F0aW9ucywgc3VjY2Vzc2Z1bFxuICAgICAqIGNvbXBsZXRpb25zLCBvciBzdGF0ZSBjaGFuZ2VzLlxuICAgICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIGluZm8gbWVzc2FnZVxuICAgICAqIEBwYXJhbSBjb250ZXh0IC0gT3B0aW9uYWwgYWRkaXRpb25hbCBjb250ZXh0XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGB0eXBlc2NyaXB0XG4gICAgICogbG9nZ2VyLmluZm8oJ1Nlc3Npb24gc3RhcnRlZCcsIHsgc291cmNlOiAnc3RhcnR1cCcsIHNlc3Npb25JZDogJ2FiYzEyMycgfSk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgaW5mbyhtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgICAgIHRoaXMuZW1pdChcImluZm9cIiwgbWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIExvZ3MgYSB3YXJuaW5nIG1lc3NhZ2UuXG4gICAgICpcbiAgICAgKiBVc2UgZm9yIGNvbmRpdGlvbnMgdGhhdCBtYXkgaW5kaWNhdGUgaXNzdWVzIGJ1dCBkb24ndCBwcmV2ZW50XG4gICAgICogb3BlcmF0aW9uLCBzdWNoIGFzIGRlcHJlY2F0ZWQgcGF0dGVybnMgb3IgcGVyZm9ybWFuY2UgY29uY2VybnMuXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgLSBUaGUgd2FybmluZyBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiBsb2dnZXIud2FybignRGVwcmVjYXRlZCBob29rIHBhdHRlcm4gZGV0ZWN0ZWQnLCB7IHBhdHRlcm46ICdsZWdhY3lNYXRjaGVyJyB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICB3YXJuKG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgdGhpcy5lbWl0KFwid2FyblwiLCBtZXNzYWdlLCBjb250ZXh0KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTG9ncyBhbiBlcnJvciBtZXNzYWdlLlxuICAgICAqXG4gICAgICogVXNlIGZvciBlcnJvciBjb25kaXRpb25zIHRoYXQgcmVxdWlyZSBhdHRlbnRpb24gYnV0IHdlcmUgaGFuZGxlZFxuICAgICAqIGdyYWNlZnVsbHkuIEZvciBleGNlcHRpb25zLCBwcmVmZXIge0BsaW5rIGxvZ0Vycm9yfS5cbiAgICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBlcnJvciBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiBsb2dnZXIuZXJyb3IoJ0ZhaWxlZCB0byB2YWxpZGF0ZSB0b29sIGlucHV0JywgeyB0b29sTmFtZTogJ0Jhc2gnLCByZWFzb246ICdlbXB0eSBjb21tYW5kJyB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBlcnJvcihtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgICAgIHRoaXMuZW1pdChcImVycm9yXCIsIG1lc3NhZ2UsIGNvbnRleHQpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBMb2dzIGEgc3RydWN0dXJlZCBlcnJvciB3aXRoIGZ1bGwgZXJyb3IgZGV0YWlscy5cbiAgICAgKlxuICAgICAqIFVzZSB0aGlzIG1ldGhvZCB3aGVuIGxvZ2dpbmcgY2F1Z2h0IGV4Y2VwdGlvbnMgdG8gY2FwdHVyZSB0aGUgZnVsbFxuICAgICAqIGVycm9yIGNvbnRleHQgaW5jbHVkaW5nIG5hbWUsIG1lc3NhZ2UsIHN0YWNrIHRyYWNlLCBhbmQgY2F1c2UgY2hhaW4uXG4gICAgICogQHBhcmFtIGVycm9yIC0gVGhlIGVycm9yIHRvIGxvZ1xuICAgICAqIEBwYXJhbSBtZXNzYWdlIC0gSHVtYW4tcmVhZGFibGUgZGVzY3JpcHRpb24gb2Ygd2hhdCBmYWlsZWRcbiAgICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBgdHlwZXNjcmlwdFxuICAgICAqIHRyeSB7XG4gICAgICogICBhd2FpdCBkYW5nZXJvdXNPcGVyYXRpb24oKTtcbiAgICAgKiB9IGNhdGNoIChlcnIpIHtcbiAgICAgKiAgIGxvZ2dlci5sb2dFcnJvcihlcnIsICdGYWlsZWQgdG8gZXhlY3V0ZSBkYW5nZXJvdXMgb3BlcmF0aW9uJywge1xuICAgICAqICAgICBvcGVyYXRpb246ICdkZWxldGUnLFxuICAgICAqICAgICB0YXJnZXQ6ICcvaW1wb3J0YW50L2ZpbGUudHh0J1xuICAgICAqICAgfSk7XG4gICAgICogfVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGxvZ0Vycm9yKGVycm9yLCBtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgICAgIGNvbnN0IGVycm9ySW5mbyA9IHRoaXMuZXh0cmFjdEVycm9ySW5mbyhlcnJvcik7XG4gICAgICAgIGNvbnN0IGV2ZW50ID0ge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBsZXZlbDogXCJlcnJvclwiLFxuICAgICAgICAgICAgaG9va1R5cGU6IHRoaXMuY3VycmVudEhvb2tUeXBlLFxuICAgICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICAgIGlucHV0OiB0aGlzLmN1cnJlbnRJbnB1dCxcbiAgICAgICAgICAgIGVycm9yOiBlcnJvckluZm8sXG4gICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmRlbGl2ZXJFdmVudChldmVudCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFN1YnNjcmliZXMgYSBoYW5kbGVyIHRvIGxvZyBldmVudHMgYXQgdGhlIHNwZWNpZmllZCBsZXZlbC5cbiAgICAgKlxuICAgICAqIFRoZSBoYW5kbGVyIHdpbGwgYmUgY2FsbGVkIGZvciBldmVyeSBsb2cgZXZlbnQgYXQgdGhlIHNwZWNpZmllZCBsZXZlbC5cbiAgICAgKiBSZXR1cm5zIGFuIHVuc3Vic2NyaWJlIGZ1bmN0aW9uIHRoYXQgc2hvdWxkIGJlIGNhbGxlZCB3aGVuIHRoZSBoYW5kbGVyXG4gICAgICogaXMgbm8gbG9uZ2VyIG5lZWRlZC5cbiAgICAgKiBAcGFyYW0gbGV2ZWwgLSBUaGUgbG9nIGxldmVsIHRvIHN1YnNjcmliZSB0b1xuICAgICAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gY2FsbCBmb3IgZWFjaCBldmVudFxuICAgICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gdW5zdWJzY3JpYmUgdGhlIGhhbmRsZXJcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiAvLyBTdWJzY3JpYmUgdG8gZXJyb3IgZXZlbnRzXG4gICAgICogY29uc3QgdW5zdWJzY3JpYmUgPSBsb2dnZXIub24oJ2Vycm9yJywgKGV2ZW50KSA9PiB7XG4gICAgICogICBjb25zb2xlLmVycm9yKGBbJHtldmVudC5ob29rVHlwZX1dICR7ZXZlbnQubWVzc2FnZX1gKTtcbiAgICAgKiAgIGlmIChldmVudC5lcnJvcikge1xuICAgICAqICAgICBjb25zb2xlLmVycm9yKGV2ZW50LmVycm9yLnN0YWNrKTtcbiAgICAgKiAgIH1cbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIExhdGVyLCBjbGVhbiB1cFxuICAgICAqIHVuc3Vic2NyaWJlKCk7XG4gICAgICogYGBgXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGB0eXBlc2NyaXB0XG4gICAgICogLy8gRm9yd2FyZCB0byBleHRlcm5hbCBsb2dnaW5nIGxpYnJhcnlcbiAgICAgKiBpbXBvcnQgcGlubyBmcm9tICdwaW5vJztcbiAgICAgKiBjb25zdCBwaW5vTG9nZ2VyID0gcGlubygpO1xuICAgICAqXG4gICAgICogbG9nZ2VyLm9uKCdpbmZvJywgKGV2ZW50KSA9PiBwaW5vTG9nZ2VyLmluZm8oZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAgICAgKiBsb2dnZXIub24oJ3dhcm4nLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIud2FybihldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICAgICAqIGxvZ2dlci5vbignZXJyb3InLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIuZXJyb3IoZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBvbihsZXZlbCwgaGFuZGxlcikge1xuICAgICAgICBjb25zdCBsZXZlbEhhbmRsZXJzID0gdGhpcy5oYW5kbGVycy5nZXQobGV2ZWwpO1xuICAgICAgICBpZiAobGV2ZWxIYW5kbGVycykge1xuICAgICAgICAgICAgbGV2ZWxIYW5kbGVycy5hZGQoaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgIGxldmVsSGFuZGxlcnM/LmRlbGV0ZShoYW5kbGVyKTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY3VycmVudCBob29rIGNvbnRleHQgZm9yIGVucmljaGluZyBsb2cgZXZlbnRzLlxuICAgICAqXG4gICAgICogVGhpcyBpcyBjYWxsZWQgaW50ZXJuYWxseSBieSB0aGUgcnVudGltZSBiZWZvcmUgaW52b2tpbmcgaG9vayBoYW5kbGVycy5cbiAgICAgKiBZb3UgdHlwaWNhbGx5IGRvbid0IG5lZWQgdG8gY2FsbCB0aGlzIGRpcmVjdGx5LlxuICAgICAqIEBwYXJhbSBob29rVHlwZSAtIFRoZSB0eXBlIG9mIGhvb2sgYmVpbmcgZXhlY3V0ZWRcbiAgICAgKiBAcGFyYW0gaW5wdXQgLSBUaGUgaG9vayBpbnB1dCBkYXRhXG4gICAgICogQGludGVybmFsXG4gICAgICovXG4gICAgc2V0Q29udGV4dChob29rVHlwZSwgaW5wdXQpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50SG9va1R5cGUgPSBob29rVHlwZTtcbiAgICAgICAgdGhpcy5jdXJyZW50SW5wdXQgPSBpbnB1dDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2xlYXJzIHRoZSBjdXJyZW50IGhvb2sgY29udGV4dC5cbiAgICAgKlxuICAgICAqIENhbGxlZCBpbnRlcm5hbGx5IGJ5IHRoZSBydW50aW1lIGFmdGVyIGhvb2sgZXhlY3V0aW9uIGNvbXBsZXRlcy5cbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKi9cbiAgICBjbGVhckNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuY3VycmVudEhvb2tUeXBlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmN1cnJlbnRJbnB1dCA9IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyB0aGUgbG9nIGZpbGUgcGF0aCBhdCBydW50aW1lLlxuICAgICAqXG4gICAgICogQ2FsbCB0aGlzIHRvIGVuYWJsZSBvciBjaGFuZ2UgZmlsZSBsb2dnaW5nLiBTZXR0aW5nIHRvIGBudWxsYCBkaXNhYmxlc1xuICAgICAqIGZpbGUgbG9nZ2luZyAoYnV0IGRvZXNuJ3QgY2xvc2UgZXhpc3RpbmcgZmlsZSBoYW5kbGUgaW1tZWRpYXRlbHkpLlxuICAgICAqIEBwYXJhbSBmaWxlUGF0aCAtIFBhdGggdG8gdGhlIGxvZyBmaWxlLCBvciBudWxsIHRvIGRpc2FibGVcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiAvLyBFbmFibGUgZmlsZSBsb2dnaW5nIGF0IHJ1bnRpbWVcbiAgICAgKiBsb2dnZXIuc2V0TG9nRmlsZSgnL3Zhci9sb2cvY2xhdWRlLWhvb2tzLmxvZycpO1xuICAgICAqXG4gICAgICogLy8gRGlzYWJsZSBmaWxlIGxvZ2dpbmdcbiAgICAgKiBsb2dnZXIuc2V0TG9nRmlsZShudWxsKTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBzZXRMb2dGaWxlKGZpbGVQYXRoKSB7XG4gICAgICAgIC8vIENsb3NlIGV4aXN0aW5nIGZpbGUgaWYgb3BlblxuICAgICAgICBpZiAodGhpcy5sb2dGaWxlRmQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY2xvc2VTeW5jKHRoaXMubG9nRmlsZUZkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIHtcbiAgICAgICAgICAgICAgICAvLyBJZ25vcmUgZXJyb3JzIG9uIGNsb3NlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmxvZ0ZpbGVGZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5sb2dGaWxlUGF0aCA9IGZpbGVQYXRoO1xuICAgICAgICB0aGlzLmZpbGVJbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgYWxsIHJlc291cmNlcyBoZWxkIGJ5IHRoZSBsb2dnZXIuXG4gICAgICpcbiAgICAgKiBDYWxsIHRoaXMgZHVyaW5nIGdyYWNlZnVsIHNodXRkb3duIHRvIGVuc3VyZSBhbGwgbG9nIGRhdGEgaXMgZmx1c2hlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiBwcm9jZXNzLm9uKCdleGl0JywgKCkgPT4ge1xuICAgICAqICAgbG9nZ2VyLmNsb3NlKCk7XG4gICAgICogfSk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgY2xvc2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmxvZ0ZpbGVGZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjbG9zZVN5bmModGhpcy5sb2dGaWxlRmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2gge1xuICAgICAgICAgICAgICAgIC8vIElnbm9yZSBlcnJvcnMgb24gY2xvc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubG9nRmlsZUZkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZpbGVJbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgdGhlcmUgYXJlIGFueSBhY3RpdmUgaGFuZGxlcnMgb3IgZGVzdGluYXRpb25zLlxuICAgICAqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIGFueSBoYW5kbGVycyBhcmUgcmVnaXN0ZXJlZCBvciBmaWxlIGxvZ2dpbmcgaXMgZW5hYmxlZC5cbiAgICAgKiBAcmV0dXJucyBXaGV0aGVyIHRoZSBsb2dnZXIgaGFzIGFueSBhY3RpdmUgb3V0cHV0IGRlc3RpbmF0aW9uc1xuICAgICAqL1xuICAgIGhhc0Rlc3RpbmF0aW9ucygpIHtcbiAgICAgICAgZm9yIChjb25zdCBoYW5kbGVycyBvZiB0aGlzLmhhbmRsZXJzLnZhbHVlcygpKSB7XG4gICAgICAgICAgICBpZiAoaGFuZGxlcnMuc2l6ZSA+IDApXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubG9nRmlsZVBhdGggIT09IG51bGw7XG4gICAgfVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBQcml2YXRlIE1ldGhvZHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLyoqXG4gICAgICogRW1pdHMgYSBsb2cgZXZlbnQuXG4gICAgICogQHBhcmFtIGxldmVsIC0gVGhlIHNldmVyaXR5IGxldmVsIG9mIHRoZSBldmVudFxuICAgICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIGxvZyBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHQgZGF0YVxuICAgICAqL1xuICAgIGVtaXQobGV2ZWwsIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGxldmVsLFxuICAgICAgICAgICAgaG9va1R5cGU6IHRoaXMuY3VycmVudEhvb2tUeXBlLFxuICAgICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICAgIGlucHV0OiB0aGlzLmN1cnJlbnRJbnB1dCxcbiAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZGVsaXZlckV2ZW50KGV2ZW50KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVsaXZlcnMgYW4gZXZlbnQgdG8gYWxsIHJlZ2lzdGVyZWQgZGVzdGluYXRpb25zLlxuICAgICAqIEBwYXJhbSBldmVudCAtIFRoZSBsb2cgZXZlbnQgdG8gZGVsaXZlclxuICAgICAqL1xuICAgIGRlbGl2ZXJFdmVudChldmVudCkge1xuICAgICAgICAvLyBEZWxpdmVyIHRvIGV2ZW50IGhhbmRsZXJzXG4gICAgICAgIGNvbnN0IGxldmVsSGFuZGxlcnMgPSB0aGlzLmhhbmRsZXJzLmdldChldmVudC5sZXZlbCk7XG4gICAgICAgIGlmIChsZXZlbEhhbmRsZXJzKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGhhbmRsZXIgb2YgbGV2ZWxIYW5kbGVycykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXIoZXZlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNpbGVudGx5IGlnbm9yZSBoYW5kbGVyIGVycm9ycyB0byBub3QgZGlzcnVwdCBob29rIGV4ZWN1dGlvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBXcml0ZSB0byBmaWxlIGlmIGNvbmZpZ3VyZWRcbiAgICAgICAgdGhpcy53cml0ZVRvRmlsZShldmVudCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFdyaXRlcyBhbiBldmVudCB0byB0aGUgbG9nIGZpbGUuXG4gICAgICogQHBhcmFtIGV2ZW50IC0gVGhlIGxvZyBldmVudCB0byB3cml0ZVxuICAgICAqL1xuICAgIHdyaXRlVG9GaWxlKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5sb2dGaWxlUGF0aClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgLy8gTGF6eSBpbml0aWFsaXphdGlvbiBvZiBmaWxlIGhhbmRsZVxuICAgICAgICBpZiAoIXRoaXMuZmlsZUluaXRpYWxpemVkKSB7XG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVGaWxlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMubG9nRmlsZUZkID09PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IGAke0pTT04uc3RyaW5naWZ5KGV2ZW50KX1cXG5gO1xuICAgICAgICAgICAgd3JpdGVTeW5jKHRoaXMubG9nRmlsZUZkLCBsaW5lKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBpZ25vcmUgZmlsZSB3cml0ZSBlcnJvcnMgdG8gbm90IGRpc3J1cHQgaG9vayBleGVjdXRpb25cbiAgICAgICAgICAgIC8vIFRoaXMgZm9sbG93cyB0aGUgcmlzayBtaXRpZ2F0aW9uOiBcIkdyYWNlZnVsIGRlZ3JhZGF0aW9uIC0gbG9nIHdyaXRlXG4gICAgICAgICAgICAvLyBmYWlsdXJlcyBhcmUgc2lsZW50bHkgaWdub3JlZCB0byBub3QgZGlzcnVwdCBob29rIGV4ZWN1dGlvblwiXG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgdGhlIGxvZyBmaWxlIGZvciB3cml0aW5nLlxuICAgICAqL1xuICAgIGluaXRpYWxpemVGaWxlKCkge1xuICAgICAgICB0aGlzLmZpbGVJbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgIGlmICghdGhpcy5sb2dGaWxlUGF0aClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEVuc3VyZSBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICBjb25zdCBkaXIgPSBkaXJuYW1lKHRoaXMubG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgaWYgKCFleGlzdHNTeW5jKGRpcikpIHtcbiAgICAgICAgICAgICAgICBta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE9wZW4gZmlsZSBmb3IgYXBwZW5kaW5nXG4gICAgICAgICAgICB0aGlzLmxvZ0ZpbGVGZCA9IG9wZW5TeW5jKHRoaXMubG9nRmlsZVBhdGgsIFwiYVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCB7XG4gICAgICAgICAgICAvLyBTaWxlbnRseSBpZ25vcmUgZmlsZSBpbml0aWFsaXphdGlvbiBlcnJvcnNcbiAgICAgICAgICAgIHRoaXMubG9nRmlsZUZkID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0cyBzdHJ1Y3R1cmVkIGVycm9yIGluZm9ybWF0aW9uIGZyb20gYW4gdW5rbm93biBlcnJvci5cbiAgICAgKiBAcGFyYW0gZXJyb3IgLSBUaGUgZXJyb3IgdG8gZXh0cmFjdCBpbmZvcm1hdGlvbiBmcm9tXG4gICAgICogQHJldHVybnMgU3RydWN0dXJlZCBlcnJvciBpbmZvcm1hdGlvblxuICAgICAqL1xuICAgIGV4dHJhY3RFcnJvckluZm8oZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogZXJyb3IubmFtZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIHN0YWNrOiBlcnJvci5zdGFjayxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBFeHRyYWN0IGNhdXNlIGNoYWluIGlmIHByZXNlbnRcbiAgICAgICAgICAgIGlmIChlcnJvci5jYXVzZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaW5mby5jYXVzZSA9IHRoaXMuZXh0cmFjdEVycm9ySW5mbyhlcnJvci5jYXVzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gaW5mbztcbiAgICAgICAgfVxuICAgICAgICAvLyBIYW5kbGUgbm9uLUVycm9yIHZhbHVlc1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbmFtZTogXCJVbmtub3duRXJyb3JcIixcbiAgICAgICAgICAgIG1lc3NhZ2U6IFN0cmluZyhlcnJvciksXG4gICAgICAgIH07XG4gICAgfVxufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2luZ2xldG9uIEV4cG9ydFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBHbG9iYWwgbG9nZ2VyIGluc3RhbmNlIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBVc2UgdGhpcyBzaW5nbGV0b24gZm9yIGFsbCBsb2dnaW5nIHdpdGhpbiBob29rcy4gVGhlIGxvZ2dlciBpcyBjb25maWd1cmVkXG4gKiB2aWEgZW52aXJvbm1lbnQgdmFyaWFibGVzIGFuZCBzdXBwb3J0cyBldmVudCBzdWJzY3JpcHRpb24gZm9yIGN1c3RvbVxuICogZGVzdGluYXRpb25zLlxuICpcbiAqICMjIENvbmZpZ3VyYXRpb25cbiAqXG4gKiB8IEVudmlyb25tZW50IFZhcmlhYmxlIHwgRGVzY3JpcHRpb24gfFxuICogfC0tLS0tLS0tLS0tLS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tfFxuICogfCBgQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEVgIHwgUGF0aCB0byBsb2cgZmlsZSAoSlNPTiBMaW5lcyBmb3JtYXQpIHxcbiAqXG4gKiAjIyBVc2FnZSBpbiBIb29rc1xuICpcbiAqIFRoZSBsb2dnZXIgaXMgcGFzc2VkIHRvIGhvb2sgaGFuZGxlcnMgdmlhIGNvbnRleHQgZm9yIGNvbnZlbmllbmNlOlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGV4cG9ydCBkZWZhdWx0IHByZVRvb2xVc2VIb29rKHsgbWF0Y2hlcjogJ0Jhc2gnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIud2FybignVmFsaWRhdGluZyBCYXNoIGNvbW1hbmQnKTtcbiAqICAgcmV0dXJuIHByZVRvb2xVc2VPdXRwdXQoeyBhbGxvdzogdHJ1ZSB9KTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogIyMgRXh0ZXJuYWwgSW50ZWdyYXRpb25cbiAqXG4gKiBTdWJzY3JpYmUgdG8gZXZlbnRzIHRvIGZvcndhcmQgbG9ncyB0byBleHRlcm5hbCBzeXN0ZW1zOlxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKiBpbXBvcnQgcGlubyBmcm9tICdwaW5vJztcbiAqXG4gKiBjb25zdCBwaW5vTG9nZ2VyID0gcGlubyh7IGxldmVsOiAnZGVidWcnIH0pO1xuICpcbiAqIGxvZ2dlci5vbignZGVidWcnLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIuZGVidWcoZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAqIGxvZ2dlci5vbignaW5mbycsIChldmVudCkgPT4gcGlub0xvZ2dlci5pbmZvKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gKiBsb2dnZXIub24oJ3dhcm4nLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIud2FybihldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICogbG9nZ2VyLm9uKCdlcnJvcicsIChldmVudCkgPT4gcGlub0xvZ2dlci5lcnJvcihldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICogYGBgXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gRGlyZWN0IHVzYWdlXG4gKiBpbXBvcnQgeyBsb2dnZXIgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIGxvZ2dlci5pbmZvKCdTdGFydGluZyBvcGVyYXRpb24nKTtcbiAqIGxvZ2dlci53YXJuKCdSZXNvdXJjZSBsaW1pdCBhcHByb2FjaGluZycsIHsgdXNhZ2U6IDAuOSB9KTtcbiAqXG4gKiB0cnkge1xuICogICBhd2FpdCByaXNreU9wZXJhdGlvbigpO1xuICogfSBjYXRjaCAoZXJyKSB7XG4gKiAgIGxvZ2dlci5sb2dFcnJvcihlcnIsICdSaXNreSBvcGVyYXRpb24gZmFpbGVkJyk7XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IG5ldyBMb2dnZXIoKTtcbiIsICIvKipcbiAqIE91dHB1dCB0eXBlcyBhbmQgYnVpbGRlcnMgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIFByb3ZpZGVzIHR5cGUtc2FmZSBvdXRwdXQgYnVpbGRlciBmdW5jdGlvbnMgZm9yIGFsbCAxMiBob29rIHR5cGVzLiBFYWNoIGJ1aWxkZXJcbiAqIGFjY2VwdHMgb3B0aW9ucyB0aGF0IG1hdGNoIHRoZSB3aXJlIGZvcm1hdCBleHBlY3RlZCBieSBDbGF1ZGUgQ29kZSwgd2l0aCB0eXBlc1xuICogZGVyaXZlZCBmcm9tIHRoZSBDbGF1ZGUgQWdlbnQgU0RLJ3MgYFN5bmNIb29rSlNPTk91dHB1dGAgdHlwZS5cbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICogQG1vZHVsZVxuICovXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBFeGl0IENvZGUgQ29uc3RhbnRzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIEV4aXQgY29kZXMgdXNlZCBieSBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiB8IEV4aXQgQ29kZSB8IE5hbWUgfCBXaGVuIFVzZWQgfCBDbGF1ZGUgQ29kZSBCZWhhdmlvciB8XG4gKiB8LS0tLS0tLS0tLS18LS0tLS0tfC0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbiAqIHwgMCB8IFN1Y2Nlc3MgfCBIYW5kbGVyIHJldHVybnMgbm9ybWFsbHkgfCBDb250aW51ZSwgcGFyc2Ugc3Rkb3V0IGFzIEpTT04gfFxuICogfCAxIHwgRXJyb3IgfCBJbnZhbGlkIGlucHV0LCBub24tYmxvY2tpbmcgZXJyb3IgfCBOb24tYmxvY2tpbmcsIHN0ZGVyciB0byB1c2VyIG9ubHkgfFxuICogfCAyIHwgQmxvY2sgfCBIYW5kbGVyIHRocm93cyBPUiBgc3RvcFJlYXNvbmAgc2V0IHwgQmxvY2tpbmcsIHN0ZGVyciBzaG93biB0byBDbGF1ZGUgfFxuICovXG5leHBvcnQgY29uc3QgRVhJVF9DT0RFUyA9IHtcbiAgICAvKiogSGFuZGxlciBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5LiBDbGF1ZGUgQ29kZSBwYXJzZXMgc3Rkb3V0IGFzIEpTT04uICovXG4gICAgU1VDQ0VTUzogMCxcbiAgICAvKiogTm9uLWJsb2NraW5nIGVycm9yIG9jY3VycmVkIChlLmcuLCBpbnZhbGlkIGlucHV0KS4gc3RkZXJyIHNob3duIHRvIHVzZXIgb25seS4gKi9cbiAgICBFUlJPUjogMSxcbiAgICAvKiogSGFuZGxlciB0aHJldyBleGNlcHRpb24gT1IgYmxvY2tpbmcgYWN0aW9uIHJlcXVlc3RlZC4gc3RkZXJyIHNob3duIHRvIENsYXVkZS4gKi9cbiAgICBCTE9DSzogMixcbn07XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBPdXRwdXQgQnVpbGRlciBGYWN0b3JpZXNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogRmFjdG9yeSBmb3IgaG9va3MgdGhhdCBoYXZlIGhvb2tTcGVjaWZpY091dHB1dCB3aXRoIGEgaG9va0V2ZW50TmFtZSBkaXNjcmltaW5hdG9yLlxuICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIGhvb2sgdHlwZSBuYW1lIHVzZWQgYXMgdGhlIF90eXBlIGRpc2NyaW1pbmF0b3JcbiAqIEByZXR1cm5zIEEgYnVpbGRlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIG91dHB1dCBvYmplY3RcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKGhvb2tUeXBlKSB7XG4gICAgcmV0dXJuIChvcHRpb25zID0ge30pID0+IHtcbiAgICAgICAgY29uc3QgeyBob29rU3BlY2lmaWNPdXRwdXQsIC4uLnJlc3QgfSA9IG9wdGlvbnM7XG4gICAgICAgIGNvbnN0IHN0ZG91dCA9IGhvb2tTcGVjaWZpY091dHB1dCAhPT0gdW5kZWZpbmVkXG4gICAgICAgICAgICA/IHsgLi4ucmVzdCwgaG9va1NwZWNpZmljT3V0cHV0OiB7IGhvb2tFdmVudE5hbWU6IGhvb2tUeXBlLCAuLi5ob29rU3BlY2lmaWNPdXRwdXQgfSB9XG4gICAgICAgICAgICA6IHJlc3Q7XG4gICAgICAgIHJldHVybiB7IF90eXBlOiBob29rVHlwZSwgc3Rkb3V0IH07XG4gICAgfTtcbn1cbi8qKlxuICogRmFjdG9yeSBmb3IgaG9va3MgdGhhdCBvbmx5IHVzZSBDb21tb25PcHRpb25zIChzaW1wbGUgcGFzc3Rocm91Z2gpLlxuICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIGhvb2sgdHlwZSBuYW1lIHVzZWQgYXMgdGhlIF90eXBlIGRpc2NyaW1pbmF0b3JcbiAqIEByZXR1cm5zIEEgYnVpbGRlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIG91dHB1dCBvYmplY3RcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVTaW1wbGVPdXRwdXRCdWlsZGVyKGhvb2tUeXBlKSB7XG4gICAgcmV0dXJuIChvcHRpb25zID0ge30pID0+ICh7XG4gICAgICAgIF90eXBlOiBob29rVHlwZSxcbiAgICAgICAgc3Rkb3V0OiBvcHRpb25zLFxuICAgIH0pO1xufVxuLyoqXG4gKiBGYWN0b3J5IGZvciBob29rcyB0aGF0IHVzZSBkZWNpc2lvbi1iYXNlZCBvcHRpb25zIChTdG9wLCBTdWJhZ2VudFN0b3ApLlxuICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIGhvb2sgdHlwZSBuYW1lIHVzZWQgYXMgdGhlIF90eXBlIGRpc2NyaW1pbmF0b3JcbiAqIEByZXR1cm5zIEEgYnVpbGRlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIG91dHB1dCBvYmplY3RcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVEZWNpc2lvbk91dHB1dEJ1aWxkZXIoaG9va1R5cGUpIHtcbiAgICByZXR1cm4gKG9wdGlvbnMgPSB7fSkgPT4gKHtcbiAgICAgICAgX3R5cGU6IGhvb2tUeXBlLFxuICAgICAgICBzdGRvdXQ6IG9wdGlvbnMsXG4gICAgfSk7XG59XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQcmVUb29sVXNlIGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBQcmVUb29sVXNlT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBbGxvdyB0b29sIGV4ZWN1dGlvblxuICogcHJlVG9vbFVzZU91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDogeyBwZXJtaXNzaW9uRGVjaXNpb246ICdhbGxvdycgfVxuICogfSk7XG4gKlxuICogLy8gRGVueSB3aXRoIHJlYXNvblxuICogcHJlVG9vbFVzZU91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIHBlcm1pc3Npb25EZWNpc2lvbjogJ2RlbnknLFxuICogICAgIHBlcm1pc3Npb25EZWNpc2lvblJlYXNvbjogJ0Rhbmdlcm91cyBjb21tYW5kIGRldGVjdGVkJ1xuICogICB9XG4gKiB9KTtcbiAqXG4gKiAvLyBBbGxvdyB3aXRoIG1vZGlmaWVkIGlucHV0XG4gKiBwcmVUb29sVXNlT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgcGVybWlzc2lvbkRlY2lzaW9uOiAnYWxsb3cnLFxuICogICAgIHVwZGF0ZWRJbnB1dDogeyBjb21tYW5kOiAnbHMgLWxhJyB9XG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwcmVUb29sVXNlT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoXCJQcmVUb29sVXNlXCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUG9zdFRvb2xVc2UgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFBvc3RUb29sVXNlT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBZGQgY29udGV4dCBhZnRlciBhIGZpbGUgcmVhZFxuICogcG9zdFRvb2xVc2VPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ0ZpbGUgY29udGFpbnMgc2Vuc2l0aXZlIGRhdGEnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwb3N0VG9vbFVzZU91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKFwiUG9zdFRvb2xVc2VcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQb3N0VG9vbFVzZUZhaWx1cmUgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFBvc3RUb29sVXNlRmFpbHVyZU91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogcG9zdFRvb2xVc2VGYWlsdXJlT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdUcnkgdXNpbmcgYSBkaWZmZXJlbnQgYXBwcm9hY2gnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwb3N0VG9vbFVzZUZhaWx1cmVPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcihcIlBvc3RUb29sVXNlRmFpbHVyZVwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFVzZXJQcm9tcHRTdWJtaXQgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFVzZXJQcm9tcHRTdWJtaXRPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHVzZXJQcm9tcHRTdWJtaXRPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ1RoaXMgcHJvamVjdCB1c2VzIFR5cGVTY3JpcHQgc3RyaWN0IG1vZGUnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCB1c2VyUHJvbXB0U3VibWl0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoXCJVc2VyUHJvbXB0U3VibWl0XCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgU2Vzc2lvblN0YXJ0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTZXNzaW9uU3RhcnRPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHNlc3Npb25TdGFydE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiBKU09OLnN0cmluZ2lmeSh7IHByb2plY3Q6ICdteS1wcm9qZWN0JyB9KVxuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc2Vzc2lvblN0YXJ0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoXCJTZXNzaW9uU3RhcnRcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTZXNzaW9uRW5kIGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTZXNzaW9uRW5kT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBzZXNzaW9uRW5kT3V0cHV0KHt9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc2Vzc2lvbkVuZE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVTaW1wbGVPdXRwdXRCdWlsZGVyKFwiU2Vzc2lvbkVuZFwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFN0b3AgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFN0b3BPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEFsbG93IHRoZSBzdG9wXG4gKiBzdG9wT3V0cHV0KHsgZGVjaXNpb246ICdhcHByb3ZlJyB9KTtcbiAqXG4gKiAvLyBCbG9jayB3aXRoIHJlYXNvblxuICogc3RvcE91dHB1dCh7XG4gKiAgIGRlY2lzaW9uOiAnYmxvY2snLFxuICogICByZWFzb246ICdUaGVyZSBhcmUgdW5jb21taXR0ZWQgY2hhbmdlcydcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBzdG9wT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZURlY2lzaW9uT3V0cHV0QnVpbGRlcihcIlN0b3BcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTdWJhZ2VudFN0YXJ0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTdWJhZ2VudFN0YXJ0T3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBzdWJhZ2VudFN0YXJ0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdGb2N1cyBvbiBmaW5kaW5nIHBhdHRlcm5zJ1xuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc3ViYWdlbnRTdGFydE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKFwiU3ViYWdlbnRTdGFydFwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFN1YmFnZW50U3RvcCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgU3ViYWdlbnRTdG9wT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBCbG9jayB3aXRoIHJlYXNvblxuICogc3ViYWdlbnRTdG9wT3V0cHV0KHtcbiAqICAgZGVjaXNpb246ICdibG9jaycsXG4gKiAgIHJlYXNvbjogJ1Rhc2sgbm90IGNvbXBsZXRlJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHN1YmFnZW50U3RvcE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVEZWNpc2lvbk91dHB1dEJ1aWxkZXIoXCJTdWJhZ2VudFN0b3BcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBOb3RpZmljYXRpb24gaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIE5vdGlmaWNhdGlvbk91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gQWRkIGNvbnRleHQgYWJvdXQgdGhlIG5vdGlmaWNhdGlvblxuICogbm90aWZpY2F0aW9uT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdOb3RpZmljYXRpb24gZm9yd2FyZGVkIHRvIFNsYWNrICNhbGVydHMgY2hhbm5lbCdcbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gU3VwcHJlc3MgdGhlIG5vdGlmaWNhdGlvblxuICogbm90aWZpY2F0aW9uT3V0cHV0KHsgc3VwcHJlc3NPdXRwdXQ6IHRydWUgfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IG5vdGlmaWNhdGlvbk91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKFwiTm90aWZpY2F0aW9uXCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUHJlQ29tcGFjdCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgUHJlQ29tcGFjdE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogcHJlQ29tcGFjdE91dHB1dCh7XG4gKiAgIHN5c3RlbU1lc3NhZ2U6ICdSZW1lbWJlcjogc3RyaWN0IG1vZGUgaXMgZW5hYmxlZCdcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwcmVDb21wYWN0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZVNpbXBsZU91dHB1dEJ1aWxkZXIoXCJQcmVDb21wYWN0XCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUGVybWlzc2lvblJlcXVlc3QgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBdXRvLWFwcHJvdmVcbiAqIHBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgZGVjaXNpb246IHsgYmVoYXZpb3I6ICdhbGxvdycgfVxuICogICB9XG4gKiB9KTtcbiAqXG4gKiAvLyBBdXRvLWFwcHJvdmUgd2l0aCBtb2RpZmllZCBpbnB1dFxuICogcGVybWlzc2lvblJlcXVlc3RPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBkZWNpc2lvbjoge1xuICogICAgICAgYmVoYXZpb3I6ICdhbGxvdycsXG4gKiAgICAgICB1cGRhdGVkSW5wdXQ6IHsgZmlsZV9wYXRoOiAnL3NhZmUvcGF0aCcgfVxuICogICAgIH1cbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gQXV0by1kZW55XG4gKiBwZXJtaXNzaW9uUmVxdWVzdE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGRlY2lzaW9uOiB7XG4gKiAgICAgICBiZWhhdmlvcjogJ2RlbnknLFxuICogICAgICAgbWVzc2FnZTogJ05vdCBhbGxvd2VkJyxcbiAqICAgICAgIGludGVycnVwdDogdHJ1ZVxuICogICAgIH1cbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gRmFsbCB0aHJvdWdoIHRvIG5vcm1hbCBwcm9tcHRcbiAqIHBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0KHt9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3QgcGVybWlzc2lvblJlcXVlc3RPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcihcIlBlcm1pc3Npb25SZXF1ZXN0XCIpO1xuIiwgIi8qKlxuICogUnVudGltZSBtb2R1bGUgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIEhhbmRsZXMgc3RkaW4vc3Rkb3V0L2V4aXQgY29kZSBzZW1hbnRpY3MgZm9yIGNvbXBpbGVkIGhvb2sgZXhlY3V0aW9uLlxuICogVGhpcyBtb2R1bGUgaXMgdGhlIGNvcmUgb3JjaGVzdHJhdG9yIHRoYXQ6XG4gKiAtIFJlYWRzIEpTT04gZnJvbSBzdGRpbiAod2lyZSBmb3JtYXQgd2l0aCBzbmFrZV9jYXNlIHByb3BlcnRpZXMpXG4gKiAtIEludm9rZXMgdGhlIGhvb2sgaGFuZGxlclxuICogLSBXcml0ZXMgb3V0cHV0IHRvIHN0ZG91dFxuICogLSBNYW5hZ2VzIGV4aXQgY29kZXNcbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBJbiBhIGNvbXBpbGVkIGhvb2sgZmlsZVxuICogaW1wb3J0IHsgZXhlY3V0ZSB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcy9ydW50aW1lJztcbiAqIGltcG9ydCBteUhvb2sgZnJvbSAnLi9teS1ob29rLmpzJztcbiAqXG4gKiBleGVjdXRlKG15SG9vayk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICovXG5pbXBvcnQgeyBwZXJzaXN0RW52VmFyLCBwZXJzaXN0RW52VmFycyB9IGZyb20gXCIuL2Vudi5qc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4vbG9nZ2VyLmpzXCI7XG5pbXBvcnQgeyBFWElUX0NPREVTIH0gZnJvbSBcIi4vb3V0cHV0cy5qc1wiO1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RkaW4vU3Rkb3V0IEhhbmRsaW5nXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIFJlYWRzIGFsbCBkYXRhIGZyb20gc3RkaW4uXG4gKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byB0aGUgY29tcGxldGUgc3RkaW4gY29udGVudFxuICovXG5hc3luYyBmdW5jdGlvbiByZWFkU3RkaW4oKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgICAgIC8vIFNldCBlbmNvZGluZyBmaXJzdCB0byBlbnN1cmUgZGF0YSBldmVudHMgcmVjZWl2ZSBzdHJpbmdzXG4gICAgICAgIHByb2Nlc3Muc3RkaW4uc2V0RW5jb2RpbmcoXCJ1dGYtOFwiKTtcbiAgICAgICAgcHJvY2Vzcy5zdGRpbi5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XG4gICAgICAgICAgICBjaHVua3MucHVzaChjaHVuayk7XG4gICAgICAgIH0pO1xuICAgICAgICBwcm9jZXNzLnN0ZGluLm9uKFwiZW5kXCIsICgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoY2h1bmtzLmpvaW4oXCJcIikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcHJvY2Vzcy5zdGRpbi5vbihcImVycm9yXCIsIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG4vKipcbiAqIFBhcnNlcyBzdGRpbiBKU09OIGlucHV0LlxuICogQHBhcmFtIHN0ZGluQ29udGVudCAtIFJhdyBzdGRpbiBjb250ZW50XG4gKiBAcmV0dXJucyBQYXJzZWQgaW5wdXQgKHdpcmUgZm9ybWF0IHdpdGggc25ha2VfY2FzZSBwcm9wZXJ0aWVzKVxuICogQHRocm93cyBFcnJvciBpZiBKU09OIGlzIG1hbGZvcm1lZFxuICovXG5mdW5jdGlvbiBwYXJzZVN0ZGluSW5wdXQoc3RkaW5Db250ZW50KSB7XG4gICAgLy8gUGFyc2UgSlNPTiAtIGlucHV0IHVzZXMgd2lyZSBmb3JtYXQgKHNuYWtlX2Nhc2UpIGRpcmVjdGx5XG4gICAgY29uc3QgcmF3SW5wdXQgPSBKU09OLnBhcnNlKHN0ZGluQ29udGVudCk7XG4gICAgcmV0dXJuIHJhd0lucHV0O1xufVxuLyoqXG4gKiBXcml0ZXMgaG9vayBvdXRwdXQgdG8gc3Rkb3V0LlxuICpcbiAqIE91dHB1dCB1c2VzIGNhbWVsQ2FzZSBrZXlzIHBlciBDbGF1ZGUgQ29kZSBob29rIHNwZWNpZmljYXRpb24uXG4gKiBAcGFyYW0gb3V0cHV0IC0gVGhlIGhvb2sgb3V0cHV0IHRvIHdyaXRlXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjaG9vay1vdXRwdXQtc3RydWN0dXJlXG4gKi9cbmZ1bmN0aW9uIHdyaXRlU3Rkb3V0KG91dHB1dCkge1xuICAgIC8vIE91dHB1dCB1c2VzIGNhbWVsQ2FzZSAtIG5vIHRyYW5zZm9ybWF0aW9uIG5lZWRlZFxuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKEpTT04uc3RyaW5naWZ5KG91dHB1dCkpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRXJyb3IgSGFuZGxpbmdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhbiBlcnJvciBvdXRwdXQgZm9yIG1hbGZvcm1lZCBzdGRpbiBKU09OLlxuICogQHBhcmFtIGVycm9yIC0gVGhlIHBhcnNlIGVycm9yXG4gKiBAcmV0dXJucyBIb29rT3V0cHV0IHdpdGggZW1wdHkgc3Rkb3V0XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZU1hbGZvcm1lZElucHV0T3V0cHV0KGVycm9yKSB7XG4gICAgbG9nZ2VyLmVycm9yKGBJbnZhbGlkIEpTT04gaW5wdXQ6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWApO1xuICAgIHJldHVybiB7IHN0ZG91dDoge30gfTtcbn1cbi8qKlxuICogV3JpdGVzIGhhbmRsZXIgZXJyb3Igc3RhY2t0cmFjZSB0byBzdGRlcnIgYW5kIGV4aXRzIHdpdGggY29kZSAyLlxuICpcbiAqIFdoZW4gYSBob29rIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbjpcbiAqIC0gU3RhY2t0cmFjZSAod2l0aCBzb3VyY2VtYXBzIGlmIGF2YWlsYWJsZSkgaXMgb3V0cHV0IHRvIHN0ZGVyclxuICogLSBQcm9jZXNzIGV4aXRzIHdpdGggY29kZSAyIChCTE9DSylcbiAqIC0gTm8gSlNPTiBpcyBvdXRwdXQgdG8gc3Rkb3V0XG4gKiBAcGFyYW0gZXJyb3IgLSBUaGUgZXJyb3IgdGhyb3duIGJ5IHRoZSBoYW5kbGVyXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZUhhbmRsZXJFcnJvcihlcnJvcikge1xuICAgIC8vIFdyaXRlIHN0YWNrIHRyYWNlIHRvIHN0ZGVyciAoc291cmNlbWFwcyBhcmUgYXBwbGllZCBhdXRvbWF0aWNhbGx5IGJ5IE5vZGUuanMpXG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoYCR7ZXJyb3Iuc3RhY2sgPz8gZXJyb3IubWVzc2FnZX1cXG5gKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKGAke1N0cmluZyhlcnJvcil9XFxuYCk7XG4gICAgfVxuICAgIC8vIExvZyB0byBmaWxlIGlmIGNvbmZpZ3VyZWRcbiAgICBsb2dnZXIuZXJyb3IoYEhvb2sgaGFuZGxlciBlcnJvcjogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCk7XG4gICAgLy8gQ2xlYXIgbG9nZ2VyIGNvbnRleHQgYW5kIGNsb3NlXG4gICAgbG9nZ2VyLmNsZWFyQ29udGV4dCgpO1xuICAgIGxvZ2dlci5jbG9zZSgpO1xuICAgIC8vIEV4aXQgd2l0aCBjb2RlIDIgKEJMT0NLKSAtIG5vIEpTT04gb3V0cHV0XG4gICAgcHJvY2Vzcy5leGl0KEVYSVRfQ09ERVMuQkxPQ0spO1xufVxuLyoqXG4gKiBDb252ZXJ0cyBhIFNwZWNpZmljSG9va091dHB1dCB0byBIb29rT3V0cHV0IGZvciB3aXJlIGZvcm1hdC5cbiAqXG4gKiBTcGVjaWZpY0hvb2tPdXRwdXQgdHlwZXMgaGF2ZTogeyBfdHlwZSwgZXhpdENvZGUsIHN0ZG91dCwgc3RkZXJyPyB9XG4gKiBIb29rT3V0cHV0IGhhczogeyBleGl0Q29kZSwgc3Rkb3V0LCBzdGRlcnI/IH1cbiAqXG4gKiBTaW5jZSBvdXRwdXQgYnVpbGRlcnMgbm93IHByb2R1Y2Ugd2lyZS1mb3JtYXQgZGlyZWN0bHksIHRoaXMgZnVuY3Rpb25cbiAqIHNpbXBseSBzdHJpcHMgdGhlIGBfdHlwZWAgZGlzY3JpbWluYXRvciBmaWVsZC5cbiAqIEBwYXJhbSBzcGVjaWZpY091dHB1dCAtIFRoZSBzcGVjaWZpYyBvdXRwdXQgZnJvbSBhIGhvb2sgaGFuZGxlclxuICogQHJldHVybnMgSG9va091dHB1dCByZWFkeSBmb3Igc2VyaWFsaXphdGlvblxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI2hvb2stb3V0cHV0LXN0cnVjdHVyZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IHNwZWNpZmljT3V0cHV0ID0gcHJlVG9vbFVzZU91dHB1dCh7IGhvb2tTcGVjaWZpY091dHB1dDogeyBwZXJtaXNzaW9uRGVjaXNpb246ICdhbGxvdycgfSB9KTtcbiAqIGNvbnN0IGhvb2tPdXRwdXQgPSBjb252ZXJ0VG9Ib29rT3V0cHV0KHNwZWNpZmljT3V0cHV0KTtcbiAqIC8vIGhvb2tPdXRwdXQ6IHsgZXhpdENvZGU6IDAsIHN0ZG91dDogeyBob29rU3BlY2lmaWNPdXRwdXQ6IHsgLi4uIH0gfSB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRUb0hvb2tPdXRwdXQoc3BlY2lmaWNPdXRwdXQpIHtcbiAgICByZXR1cm4geyBzdGRvdXQ6IHNwZWNpZmljT3V0cHV0LnN0ZG91dCB9O1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRXhlY3V0ZSBGdW5jdGlvblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBFeGVjdXRlcyBhIGhvb2sgaGFuZGxlciB3aXRoIGZ1bGwgcnVudGltZSBvcmNoZXN0cmF0aW9uLlxuICpcbiAqIFRoaXMgaXMgdGhlIG1haW4gZW50cnkgcG9pbnQgdGhhdCBjb21waWxlZCBob29rcyB1c2UuIFdoZW4gYSBjb21waWxlZCBob29rXG4gKiBydW5zIGFzIGEgQ0xJOlxuICpcbiAqIDEuIFJlYWRzIGFsbCBzdGRpblxuICogMi4gUGFyc2VzIEpTT04gKHdpcmUgZm9ybWF0IHdpdGggc25ha2VfY2FzZSBwcm9wZXJ0aWVzKVxuICogMy4gU2V0cyB1cCBsb2dnZXIgY29udGV4dCAoaG9va1R5cGUsIGlucHV0KVxuICogNC4gQ2FsbHMgaGFuZGxlciB3aXRoIGlucHV0IGFuZCBjb250ZXh0IChsb2dnZXIpXG4gKiA1LiBIYW5kbGVzIGFueSBlcnJvcnMsIGxvZ3MgdGhlbVxuICogNi4gV3JpdGVzIEpTT04gdG8gc3Rkb3V0XG4gKiA3LiBDbG9zZXMgbG9nZ2VyXG4gKiA4LiBFeGl0cyB3aXRoIGFwcHJvcHJpYXRlIGNvZGVcbiAqIEBwYXJhbSBob29rRm4gLSBUaGUgaG9vayBmdW5jdGlvbiB0byBleGVjdXRlIChmcm9tIGhvb2sgZmFjdG9yeSlcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBJbiBjb21waWxlZCBob29rIGZpbGVcbiAqIGltcG9ydCB7IGV4ZWN1dGUgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MvcnVudGltZSc7XG4gKiBpbXBvcnQgeyBwcmVUb29sVXNlSG9vaywgcHJlVG9vbFVzZU91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogY29uc3QgbXlIb29rID0gcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnQmFzaCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdQcm9jZXNzaW5nIEJhc2ggY29tbWFuZCcpO1xuICogICByZXR1cm4gcHJlVG9vbFVzZU91dHB1dCh7IGFsbG93OiB0cnVlIH0pO1xuICogfSk7XG4gKlxuICogZXhlY3V0ZShteUhvb2spO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3NcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoaG9va0ZuKSB7XG4gICAgbGV0IG91dHB1dDtcbiAgICB0cnkge1xuICAgICAgICAvLyBDaGVjayBmb3IgbG9nIGZpbGUgY29uZmlndXJhdGlvbiBjb25mbGljdHNcbiAgICAgICAgLy8gQ0xBVURFX0NPREVfSE9PS1NfQ0xJX0xPR19GSUxFIGlzIGluamVjdGVkIGJ5IHRoZSBDTEkgLS1sb2cgcGFyYW1ldGVyXG4gICAgICAgIC8vIENMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFIGlzIHRoZSB1c2VyJ3MgZW52aXJvbm1lbnQgdmFyaWFibGVcbiAgICAgICAgY29uc3QgY2xpTG9nRmlsZSA9IHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0hPT0tTX0NMSV9MT0dfRklMRTtcbiAgICAgICAgY29uc3QgZW52TG9nRmlsZSA9IHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFO1xuICAgICAgICBpZiAoY2xpTG9nRmlsZSAhPT0gdW5kZWZpbmVkICYmIGVudkxvZ0ZpbGUgIT09IHVuZGVmaW5lZCAmJiBjbGlMb2dGaWxlICE9PSBlbnZMb2dGaWxlKSB7XG4gICAgICAgICAgICAvLyBXcml0ZSBlcnJvciB0byBzdGRlcnIgYW5kIGV4aXQgd2l0aCBlcnJvciBjb2RlXG4gICAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShgTG9nIGZpbGUgY29uZmlndXJhdGlvbiBjb25mbGljdDogQ0xJIC0tbG9nPVwiJHtjbGlMb2dGaWxlfVwiIHZzIENMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFPVwiJHtlbnZMb2dGaWxlfVwiLiBgICtcbiAgICAgICAgICAgICAgICBcIlVzZSBvbmx5IG9uZSBtZXRob2QgdG8gY29uZmlndXJlIGhvb2sgbG9nZ2luZy5cXG5cIik7XG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoRVhJVF9DT0RFUy5FUlJPUik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgQ0xJIGxvZyBmaWxlIGlzIHNldCwgY29uZmlndXJlIHRoZSBsb2dnZXJcbiAgICAgICAgaWYgKGNsaUxvZ0ZpbGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbG9nZ2VyLnNldExvZ0ZpbGUoY2xpTG9nRmlsZSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gUmVhZCBhbmQgcGFyc2Ugc3RkaW5cbiAgICAgICAgbGV0IHN0ZGluQ29udGVudDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHN0ZGluQ29udGVudCA9IGF3YWl0IHJlYWRTdGRpbigpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZ0Vycm9yKGVycm9yLCBcIkZhaWxlZCB0byByZWFkIHN0ZGluXCIpO1xuICAgICAgICAgICAgb3V0cHV0ID0gY3JlYXRlTWFsZm9ybWVkSW5wdXRPdXRwdXQoZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIFBhcnNlIGFuZCB0cmFuc2Zvcm0gaW5wdXRcbiAgICAgICAgbGV0IGlucHV0O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaW5wdXQgPSBwYXJzZVN0ZGluSW5wdXQoc3RkaW5Db250ZW50KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2dFcnJvcihlcnJvciwgXCJGYWlsZWQgdG8gcGFyc2Ugc3RkaW4gSlNPTlwiKTtcbiAgICAgICAgICAgIG91dHB1dCA9IGNyZWF0ZU1hbGZvcm1lZElucHV0T3V0cHV0KGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBTZXQgbG9nZ2VyIGNvbnRleHRcbiAgICAgICAgY29uc3QgaG9va0V2ZW50TmFtZSA9IGhvb2tGbi5ob29rRXZlbnROYW1lO1xuICAgICAgICBsb2dnZXIuc2V0Q29udGV4dChob29rRXZlbnROYW1lLCBpbnB1dCk7XG4gICAgICAgIC8vIEJ1aWxkIGNvbnRleHQgLSBTZXNzaW9uU3RhcnQgaG9va3MgZ2V0IGV4dGVuZGVkIGNvbnRleHQgd2l0aCBwZXJzaXN0RW52VmFyXG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSBob29rRXZlbnROYW1lID09PSBcIlNlc3Npb25TdGFydFwiID8geyBsb2dnZXIsIHBlcnNpc3RFbnZWYXIsIHBlcnNpc3RFbnZWYXJzIH0gOiB7IGxvZ2dlciB9O1xuICAgICAgICAvLyBFeGVjdXRlIGhhbmRsZXJcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNwZWNpZmljT3V0cHV0ID0gYXdhaXQgaG9va0ZuKGlucHV0LCBjb250ZXh0KTtcbiAgICAgICAgICAgIG91dHB1dCA9IGNvbnZlcnRUb0hvb2tPdXRwdXQoc3BlY2lmaWNPdXRwdXQpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgLy8gSGFuZGxlciB0aHJldyAtIG91dHB1dCBzdGFja3RyYWNlIHRvIHN0ZGVyciBhbmQgZXhpdCB3aXRoIGNvZGUgMlxuICAgICAgICAgICAgLy8gVGhpcyBjYWxsIG5ldmVyIHJldHVybnMgKHByb2Nlc3MuZXhpdClcbiAgICAgICAgICAgIGhhbmRsZUhhbmRsZXJFcnJvcihlcnJvcik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZmluYWxseSB7XG4gICAgICAgIC8vIFdyaXRlIG91dHB1dCBpZiB3ZSBoYXZlIGl0XG4gICAgICAgIGlmIChvdXRwdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgd3JpdGVTdGRvdXQob3V0cHV0LnN0ZG91dCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2xlYXIgbG9nZ2VyIGNvbnRleHRcbiAgICAgICAgbG9nZ2VyLmNsZWFyQ29udGV4dCgpO1xuICAgICAgICBsb2dnZXIuY2xvc2UoKTtcbiAgICAgICAgLy8gRXhpdCB3aXRoIHN1Y2Nlc3MgKGhhbmRsZXIgZXJyb3JzIGV4aXQgdmlhIGhhbmRsZUhhbmRsZXJFcnJvciB3aXRoIGNvZGUgMilcbiAgICAgICAgcHJvY2Vzcy5leGl0KEVYSVRfQ09ERVMuU1VDQ0VTUyk7XG4gICAgfVxufVxuIiwgImV4cG9ydCBjb25zdCBiYWxhbmNlZCA9IChcbiAgYTogc3RyaW5nIHwgUmVnRXhwLFxuICBiOiBzdHJpbmcgfCBSZWdFeHAsXG4gIHN0cjogc3RyaW5nLFxuKSA9PiB7XG4gIGNvbnN0IG1hID0gYSBpbnN0YW5jZW9mIFJlZ0V4cCA/IG1heWJlTWF0Y2goYSwgc3RyKSA6IGFcbiAgY29uc3QgbWIgPSBiIGluc3RhbmNlb2YgUmVnRXhwID8gbWF5YmVNYXRjaChiLCBzdHIpIDogYlxuXG4gIGNvbnN0IHIgPSBtYSAhPT0gbnVsbCAmJiBtYiAhPSBudWxsICYmIHJhbmdlKG1hLCBtYiwgc3RyKVxuXG4gIHJldHVybiAoXG4gICAgciAmJiB7XG4gICAgICBzdGFydDogclswXSxcbiAgICAgIGVuZDogclsxXSxcbiAgICAgIHByZTogc3RyLnNsaWNlKDAsIHJbMF0pLFxuICAgICAgYm9keTogc3RyLnNsaWNlKHJbMF0gKyBtYS5sZW5ndGgsIHJbMV0pLFxuICAgICAgcG9zdDogc3RyLnNsaWNlKHJbMV0gKyBtYi5sZW5ndGgpLFxuICAgIH1cbiAgKVxufVxuXG5jb25zdCBtYXliZU1hdGNoID0gKHJlZzogUmVnRXhwLCBzdHI6IHN0cmluZykgPT4ge1xuICBjb25zdCBtID0gc3RyLm1hdGNoKHJlZylcbiAgcmV0dXJuIG0gPyBtWzBdIDogbnVsbFxufVxuXG5leHBvcnQgY29uc3QgcmFuZ2UgPSAoXG4gIGE6IHN0cmluZyxcbiAgYjogc3RyaW5nLFxuICBzdHI6IHN0cmluZyxcbik6IHVuZGVmaW5lZCB8IFtudW1iZXIsIG51bWJlcl0gPT4ge1xuICBsZXQgYmVnczogbnVtYmVyW10sXG4gICAgYmVnOiBudW1iZXIgfCB1bmRlZmluZWQsXG4gICAgbGVmdDogbnVtYmVyLFxuICAgIHJpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4gICAgcmVzdWx0OiB1bmRlZmluZWQgfCBbbnVtYmVyLCBudW1iZXJdXG4gIGxldCBhaSA9IHN0ci5pbmRleE9mKGEpXG4gIGxldCBiaSA9IHN0ci5pbmRleE9mKGIsIGFpICsgMSlcbiAgbGV0IGkgPSBhaVxuXG4gIGlmIChhaSA+PSAwICYmIGJpID4gMCkge1xuICAgIGlmIChhID09PSBiKSB7XG4gICAgICByZXR1cm4gW2FpLCBiaV1cbiAgICB9XG4gICAgYmVncyA9IFtdXG4gICAgbGVmdCA9IHN0ci5sZW5ndGhcblxuICAgIHdoaWxlIChpID49IDAgJiYgIXJlc3VsdCkge1xuICAgICAgaWYgKGkgPT09IGFpKSB7XG4gICAgICAgIGJlZ3MucHVzaChpKVxuICAgICAgICBhaSA9IHN0ci5pbmRleE9mKGEsIGkgKyAxKVxuICAgICAgfSBlbHNlIGlmIChiZWdzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBjb25zdCByID0gYmVncy5wb3AoKVxuICAgICAgICBpZiAociAhPT0gdW5kZWZpbmVkKSByZXN1bHQgPSBbciwgYmldXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBiZWcgPSBiZWdzLnBvcCgpXG4gICAgICAgIGlmIChiZWcgIT09IHVuZGVmaW5lZCAmJiBiZWcgPCBsZWZ0KSB7XG4gICAgICAgICAgbGVmdCA9IGJlZ1xuICAgICAgICAgIHJpZ2h0ID0gYmlcbiAgICAgICAgfVxuXG4gICAgICAgIGJpID0gc3RyLmluZGV4T2YoYiwgaSArIDEpXG4gICAgICB9XG5cbiAgICAgIGkgPSBhaSA8IGJpICYmIGFpID49IDAgPyBhaSA6IGJpXG4gICAgfVxuXG4gICAgaWYgKGJlZ3MubGVuZ3RoICYmIHJpZ2h0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlc3VsdCA9IFtsZWZ0LCByaWdodF1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG4iLCAiaW1wb3J0IHsgYmFsYW5jZWQgfSBmcm9tICdAaXNhYWNzL2JhbGFuY2VkLW1hdGNoJ1xuXG5jb25zdCBlc2NTbGFzaCA9ICdcXDBTTEFTSCcgKyBNYXRoLnJhbmRvbSgpICsgJ1xcMCdcbmNvbnN0IGVzY09wZW4gPSAnXFwwT1BFTicgKyBNYXRoLnJhbmRvbSgpICsgJ1xcMCdcbmNvbnN0IGVzY0Nsb3NlID0gJ1xcMENMT1NFJyArIE1hdGgucmFuZG9tKCkgKyAnXFwwJ1xuY29uc3QgZXNjQ29tbWEgPSAnXFwwQ09NTUEnICsgTWF0aC5yYW5kb20oKSArICdcXDAnXG5jb25zdCBlc2NQZXJpb2QgPSAnXFwwUEVSSU9EJyArIE1hdGgucmFuZG9tKCkgKyAnXFwwJ1xuY29uc3QgZXNjU2xhc2hQYXR0ZXJuID0gbmV3IFJlZ0V4cChlc2NTbGFzaCwgJ2cnKVxuY29uc3QgZXNjT3BlblBhdHRlcm4gPSBuZXcgUmVnRXhwKGVzY09wZW4sICdnJylcbmNvbnN0IGVzY0Nsb3NlUGF0dGVybiA9IG5ldyBSZWdFeHAoZXNjQ2xvc2UsICdnJylcbmNvbnN0IGVzY0NvbW1hUGF0dGVybiA9IG5ldyBSZWdFeHAoZXNjQ29tbWEsICdnJylcbmNvbnN0IGVzY1BlcmlvZFBhdHRlcm4gPSBuZXcgUmVnRXhwKGVzY1BlcmlvZCwgJ2cnKVxuY29uc3Qgc2xhc2hQYXR0ZXJuID0gL1xcXFxcXFxcL2dcbmNvbnN0IG9wZW5QYXR0ZXJuID0gL1xcXFx7L2dcbmNvbnN0IGNsb3NlUGF0dGVybiA9IC9cXFxcfS9nXG5jb25zdCBjb21tYVBhdHRlcm4gPSAvXFxcXCwvZ1xuY29uc3QgcGVyaW9kUGF0dGVybiA9IC9cXFxcLi9nXG5cbmZ1bmN0aW9uIG51bWVyaWMoc3RyOiBzdHJpbmcpIHtcbiAgcmV0dXJuICFpc05hTihzdHIgYXMgYW55KSA/IHBhcnNlSW50KHN0ciwgMTApIDogc3RyLmNoYXJDb2RlQXQoMClcbn1cblxuZnVuY3Rpb24gZXNjYXBlQnJhY2VzKHN0cjogc3RyaW5nKSB7XG4gIHJldHVybiBzdHJcbiAgICAucmVwbGFjZShzbGFzaFBhdHRlcm4sIGVzY1NsYXNoKVxuICAgIC5yZXBsYWNlKG9wZW5QYXR0ZXJuLCBlc2NPcGVuKVxuICAgIC5yZXBsYWNlKGNsb3NlUGF0dGVybiwgZXNjQ2xvc2UpXG4gICAgLnJlcGxhY2UoY29tbWFQYXR0ZXJuLCBlc2NDb21tYSlcbiAgICAucmVwbGFjZShwZXJpb2RQYXR0ZXJuLCBlc2NQZXJpb2QpXG59XG5cbmZ1bmN0aW9uIHVuZXNjYXBlQnJhY2VzKHN0cjogc3RyaW5nKSB7XG4gIHJldHVybiBzdHJcbiAgICAucmVwbGFjZShlc2NTbGFzaFBhdHRlcm4sICdcXFxcJylcbiAgICAucmVwbGFjZShlc2NPcGVuUGF0dGVybiwgJ3snKVxuICAgIC5yZXBsYWNlKGVzY0Nsb3NlUGF0dGVybiwgJ30nKVxuICAgIC5yZXBsYWNlKGVzY0NvbW1hUGF0dGVybiwgJywnKVxuICAgIC5yZXBsYWNlKGVzY1BlcmlvZFBhdHRlcm4sICcuJylcbn1cblxuLyoqXG4gKiBCYXNpY2FsbHkganVzdCBzdHIuc3BsaXQoXCIsXCIpLCBidXQgaGFuZGxpbmcgY2FzZXNcbiAqIHdoZXJlIHdlIGhhdmUgbmVzdGVkIGJyYWNlZCBzZWN0aW9ucywgd2hpY2ggc2hvdWxkIGJlXG4gKiB0cmVhdGVkIGFzIGluZGl2aWR1YWwgbWVtYmVycywgbGlrZSB7YSx7YixjfSxkfVxuICovXG5mdW5jdGlvbiBwYXJzZUNvbW1hUGFydHMoc3RyOiBzdHJpbmcpIHtcbiAgaWYgKCFzdHIpIHtcbiAgICByZXR1cm4gWycnXVxuICB9XG5cbiAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW11cbiAgY29uc3QgbSA9IGJhbGFuY2VkKCd7JywgJ30nLCBzdHIpXG5cbiAgaWYgKCFtKSB7XG4gICAgcmV0dXJuIHN0ci5zcGxpdCgnLCcpXG4gIH1cblxuICBjb25zdCB7IHByZSwgYm9keSwgcG9zdCB9ID0gbVxuICBjb25zdCBwID0gcHJlLnNwbGl0KCcsJylcblxuICBwW3AubGVuZ3RoIC0gMV0gKz0gJ3snICsgYm9keSArICd9J1xuICBjb25zdCBwb3N0UGFydHMgPSBwYXJzZUNvbW1hUGFydHMocG9zdClcbiAgaWYgKHBvc3QubGVuZ3RoKSB7XG4gICAgOyhwW3AubGVuZ3RoIC0gMV0gYXMgc3RyaW5nKSArPSBwb3N0UGFydHMuc2hpZnQoKVxuICAgIHAucHVzaC5hcHBseShwLCBwb3N0UGFydHMpXG4gIH1cblxuICBwYXJ0cy5wdXNoLmFwcGx5KHBhcnRzLCBwKVxuXG4gIHJldHVybiBwYXJ0c1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXhwYW5kKHN0cjogc3RyaW5nKSB7XG4gIGlmICghc3RyKSB7XG4gICAgcmV0dXJuIFtdXG4gIH1cblxuICAvLyBJIGRvbid0IGtub3cgd2h5IEJhc2ggNC4zIGRvZXMgdGhpcywgYnV0IGl0IGRvZXMuXG4gIC8vIEFueXRoaW5nIHN0YXJ0aW5nIHdpdGgge30gd2lsbCBoYXZlIHRoZSBmaXJzdCB0d28gYnl0ZXMgcHJlc2VydmVkXG4gIC8vIGJ1dCAqb25seSogYXQgdGhlIHRvcCBsZXZlbCwgc28ge30sYX1iIHdpbGwgbm90IGV4cGFuZCB0byBhbnl0aGluZyxcbiAgLy8gYnV0IGF7fSxifWMgd2lsbCBiZSBleHBhbmRlZCB0byBbYX1jLGFiY10uXG4gIC8vIE9uZSBjb3VsZCBhcmd1ZSB0aGF0IHRoaXMgaXMgYSBidWcgaW4gQmFzaCwgYnV0IHNpbmNlIHRoZSBnb2FsIG9mXG4gIC8vIHRoaXMgbW9kdWxlIGlzIHRvIG1hdGNoIEJhc2gncyBydWxlcywgd2UgZXNjYXBlIGEgbGVhZGluZyB7fVxuICBpZiAoc3RyLnNsaWNlKDAsIDIpID09PSAne30nKSB7XG4gICAgc3RyID0gJ1xcXFx7XFxcXH0nICsgc3RyLnNsaWNlKDIpXG4gIH1cblxuICByZXR1cm4gZXhwYW5kXyhlc2NhcGVCcmFjZXMoc3RyKSwgdHJ1ZSkubWFwKHVuZXNjYXBlQnJhY2VzKVxufVxuXG5mdW5jdGlvbiBlbWJyYWNlKHN0cjogc3RyaW5nKSB7XG4gIHJldHVybiAneycgKyBzdHIgKyAnfSdcbn1cblxuZnVuY3Rpb24gaXNQYWRkZWQoZWw6IHN0cmluZykge1xuICByZXR1cm4gL14tPzBcXGQvLnRlc3QoZWwpXG59XG5cbmZ1bmN0aW9uIGx0ZShpOiBudW1iZXIsIHk6IG51bWJlcikge1xuICByZXR1cm4gaSA8PSB5XG59XG5cbmZ1bmN0aW9uIGd0ZShpOiBudW1iZXIsIHk6IG51bWJlcikge1xuICByZXR1cm4gaSA+PSB5XG59XG5cbmZ1bmN0aW9uIGV4cGFuZF8oc3RyOiBzdHJpbmcsIGlzVG9wPzogYm9vbGVhbik6IHN0cmluZ1tdIHtcbiAgLyoqIEB0eXBlIHtzdHJpbmdbXX0gKi9cbiAgY29uc3QgZXhwYW5zaW9uczogc3RyaW5nW10gPSBbXVxuXG4gIGNvbnN0IG0gPSBiYWxhbmNlZCgneycsICd9Jywgc3RyKVxuICBpZiAoIW0pIHJldHVybiBbc3RyXVxuXG4gIC8vIG5vIG5lZWQgdG8gZXhwYW5kIHByZSwgc2luY2UgaXQgaXMgZ3VhcmFudGVlZCB0byBiZSBmcmVlIG9mIGJyYWNlLXNldHNcbiAgY29uc3QgcHJlID0gbS5wcmVcbiAgY29uc3QgcG9zdDogc3RyaW5nW10gPSBtLnBvc3QubGVuZ3RoID8gZXhwYW5kXyhtLnBvc3QsIGZhbHNlKSA6IFsnJ11cblxuICBpZiAoL1xcJCQvLnRlc3QobS5wcmUpKSB7XG4gICAgZm9yIChsZXQgayA9IDA7IGsgPCBwb3N0Lmxlbmd0aDsgaysrKSB7XG4gICAgICBjb25zdCBleHBhbnNpb24gPSBwcmUgKyAneycgKyBtLmJvZHkgKyAnfScgKyBwb3N0W2tdXG4gICAgICBleHBhbnNpb25zLnB1c2goZXhwYW5zaW9uKVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zdCBpc051bWVyaWNTZXF1ZW5jZSA9IC9eLT9cXGQrXFwuXFwuLT9cXGQrKD86XFwuXFwuLT9cXGQrKT8kLy50ZXN0KG0uYm9keSlcbiAgICBjb25zdCBpc0FscGhhU2VxdWVuY2UgPSAvXlthLXpBLVpdXFwuXFwuW2EtekEtWl0oPzpcXC5cXC4tP1xcZCspPyQvLnRlc3QobS5ib2R5KVxuICAgIGNvbnN0IGlzU2VxdWVuY2UgPSBpc051bWVyaWNTZXF1ZW5jZSB8fCBpc0FscGhhU2VxdWVuY2VcbiAgICBjb25zdCBpc09wdGlvbnMgPSBtLmJvZHkuaW5kZXhPZignLCcpID49IDBcbiAgICBpZiAoIWlzU2VxdWVuY2UgJiYgIWlzT3B0aW9ucykge1xuICAgICAgLy8ge2F9LGJ9XG4gICAgICBpZiAobS5wb3N0Lm1hdGNoKC8sKD8hLCkuKlxcfS8pKSB7XG4gICAgICAgIHN0ciA9IG0ucHJlICsgJ3snICsgbS5ib2R5ICsgZXNjQ2xvc2UgKyBtLnBvc3RcbiAgICAgICAgcmV0dXJuIGV4cGFuZF8oc3RyKVxuICAgICAgfVxuICAgICAgcmV0dXJuIFtzdHJdXG4gICAgfVxuXG4gICAgbGV0IG46IHN0cmluZ1tdXG4gICAgaWYgKGlzU2VxdWVuY2UpIHtcbiAgICAgIG4gPSBtLmJvZHkuc3BsaXQoL1xcLlxcLi8pXG4gICAgfSBlbHNlIHtcbiAgICAgIG4gPSBwYXJzZUNvbW1hUGFydHMobS5ib2R5KVxuICAgICAgaWYgKG4ubGVuZ3RoID09PSAxICYmIG5bMF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyB4e3thLGJ9fXkgPT0+IHh7YX15IHh7Yn15XG4gICAgICAgIG4gPSBleHBhbmRfKG5bMF0sIGZhbHNlKS5tYXAoZW1icmFjZSlcbiAgICAgICAgLy9YWFggaXMgdGhpcyBuZWNlc3Nhcnk/IENhbid0IHNlZW0gdG8gaGl0IGl0IGluIHRlc3RzLlxuICAgICAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICAgICAgaWYgKG4ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuIHBvc3QubWFwKHAgPT4gbS5wcmUgKyBuWzBdICsgcClcbiAgICAgICAgfVxuICAgICAgICAvKiBjOCBpZ25vcmUgc3RvcCAqL1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGF0IHRoaXMgcG9pbnQsIG4gaXMgdGhlIHBhcnRzLCBhbmQgd2Uga25vdyBpdCdzIG5vdCBhIGNvbW1hIHNldFxuICAgIC8vIHdpdGggYSBzaW5nbGUgZW50cnkuXG4gICAgbGV0IE46IHN0cmluZ1tdXG5cbiAgICBpZiAoaXNTZXF1ZW5jZSAmJiBuWzBdICE9PSB1bmRlZmluZWQgJiYgblsxXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCB4ID0gbnVtZXJpYyhuWzBdKVxuICAgICAgY29uc3QgeSA9IG51bWVyaWMoblsxXSlcbiAgICAgIGNvbnN0IHdpZHRoID0gTWF0aC5tYXgoblswXS5sZW5ndGgsIG5bMV0ubGVuZ3RoKVxuICAgICAgbGV0IGluY3IgPVxuICAgICAgICBuLmxlbmd0aCA9PT0gMyAmJiBuWzJdICE9PSB1bmRlZmluZWQgPyBNYXRoLmFicyhudW1lcmljKG5bMl0pKSA6IDFcbiAgICAgIGxldCB0ZXN0ID0gbHRlXG4gICAgICBjb25zdCByZXZlcnNlID0geSA8IHhcbiAgICAgIGlmIChyZXZlcnNlKSB7XG4gICAgICAgIGluY3IgKj0gLTFcbiAgICAgICAgdGVzdCA9IGd0ZVxuICAgICAgfVxuICAgICAgY29uc3QgcGFkID0gbi5zb21lKGlzUGFkZGVkKVxuXG4gICAgICBOID0gW11cblxuICAgICAgZm9yIChsZXQgaSA9IHg7IHRlc3QoaSwgeSk7IGkgKz0gaW5jcikge1xuICAgICAgICBsZXQgY1xuICAgICAgICBpZiAoaXNBbHBoYVNlcXVlbmNlKSB7XG4gICAgICAgICAgYyA9IFN0cmluZy5mcm9tQ2hhckNvZGUoaSlcbiAgICAgICAgICBpZiAoYyA9PT0gJ1xcXFwnKSB7XG4gICAgICAgICAgICBjID0gJydcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYyA9IFN0cmluZyhpKVxuICAgICAgICAgIGlmIChwYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5lZWQgPSB3aWR0aCAtIGMubGVuZ3RoXG4gICAgICAgICAgICBpZiAobmVlZCA+IDApIHtcbiAgICAgICAgICAgICAgY29uc3QgeiA9IG5ldyBBcnJheShuZWVkICsgMSkuam9pbignMCcpXG4gICAgICAgICAgICAgIGlmIChpIDwgMCkge1xuICAgICAgICAgICAgICAgIGMgPSAnLScgKyB6ICsgYy5zbGljZSgxKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGMgPSB6ICsgY1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIE4ucHVzaChjKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBOID0gW11cblxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBuLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIE4ucHVzaC5hcHBseShOLCBleHBhbmRfKG5bal0gYXMgc3RyaW5nLCBmYWxzZSkpXG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBOLmxlbmd0aDsgaisrKSB7XG4gICAgICBmb3IgKGxldCBrID0gMDsgayA8IHBvc3QubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgY29uc3QgZXhwYW5zaW9uID0gcHJlICsgTltqXSArIHBvc3Rba11cbiAgICAgICAgaWYgKCFpc1RvcCB8fCBpc1NlcXVlbmNlIHx8IGV4cGFuc2lvbikge1xuICAgICAgICAgIGV4cGFuc2lvbnMucHVzaChleHBhbnNpb24pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZXhwYW5zaW9uc1xufVxuIiwgImNvbnN0IE1BWF9QQVRURVJOX0xFTkdUSCA9IDEwMjQgKiA2NFxuZXhwb3J0IGNvbnN0IGFzc2VydFZhbGlkUGF0dGVybjogKHBhdHRlcm46IGFueSkgPT4gdm9pZCA9IChcbiAgcGF0dGVybjogYW55LFxuKTogYXNzZXJ0cyBwYXR0ZXJuIGlzIHN0cmluZyA9PiB7XG4gIGlmICh0eXBlb2YgcGF0dGVybiAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdpbnZhbGlkIHBhdHRlcm4nKVxuICB9XG5cbiAgaWYgKHBhdHRlcm4ubGVuZ3RoID4gTUFYX1BBVFRFUk5fTEVOR1RIKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncGF0dGVybiBpcyB0b28gbG9uZycpXG4gIH1cbn1cbiIsICIvLyB0cmFuc2xhdGUgdGhlIHZhcmlvdXMgcG9zaXggY2hhcmFjdGVyIGNsYXNzZXMgaW50byB1bmljb2RlIHByb3BlcnRpZXNcbi8vIHRoaXMgd29ya3MgYWNyb3NzIGFsbCB1bmljb2RlIGxvY2FsZXNcblxuLy8geyA8cG9zaXggY2xhc3M+OiBbPHRyYW5zbGF0aW9uPiwgL3UgZmxhZyByZXF1aXJlZCwgbmVnYXRlZF1cbmNvbnN0IHBvc2l4Q2xhc3NlczogeyBbazogc3RyaW5nXTogW2U6IHN0cmluZywgdTogYm9vbGVhbiwgbj86IGJvb2xlYW5dIH0gPSB7XG4gICdbOmFsbnVtOl0nOiBbJ1xcXFxwe0x9XFxcXHB7Tmx9XFxcXHB7TmR9JywgdHJ1ZV0sXG4gICdbOmFscGhhOl0nOiBbJ1xcXFxwe0x9XFxcXHB7Tmx9JywgdHJ1ZV0sXG4gICdbOmFzY2lpOl0nOiBbJ1xcXFx4JyArICcwMC1cXFxceCcgKyAnN2YnLCBmYWxzZV0sXG4gICdbOmJsYW5rOl0nOiBbJ1xcXFxwe1pzfVxcXFx0JywgdHJ1ZV0sXG4gICdbOmNudHJsOl0nOiBbJ1xcXFxwe0NjfScsIHRydWVdLFxuICAnWzpkaWdpdDpdJzogWydcXFxccHtOZH0nLCB0cnVlXSxcbiAgJ1s6Z3JhcGg6XSc6IFsnXFxcXHB7Wn1cXFxccHtDfScsIHRydWUsIHRydWVdLFxuICAnWzpsb3dlcjpdJzogWydcXFxccHtMbH0nLCB0cnVlXSxcbiAgJ1s6cHJpbnQ6XSc6IFsnXFxcXHB7Q30nLCB0cnVlXSxcbiAgJ1s6cHVuY3Q6XSc6IFsnXFxcXHB7UH0nLCB0cnVlXSxcbiAgJ1s6c3BhY2U6XSc6IFsnXFxcXHB7Wn1cXFxcdFxcXFxyXFxcXG5cXFxcdlxcXFxmJywgdHJ1ZV0sXG4gICdbOnVwcGVyOl0nOiBbJ1xcXFxwe0x1fScsIHRydWVdLFxuICAnWzp3b3JkOl0nOiBbJ1xcXFxwe0x9XFxcXHB7Tmx9XFxcXHB7TmR9XFxcXHB7UGN9JywgdHJ1ZV0sXG4gICdbOnhkaWdpdDpdJzogWydBLUZhLWYwLTknLCBmYWxzZV0sXG59XG5cbi8vIG9ubHkgbmVlZCB0byBlc2NhcGUgYSBmZXcgdGhpbmdzIGluc2lkZSBvZiBicmFjZSBleHByZXNzaW9uc1xuLy8gZXNjYXBlczogWyBcXCBdIC1cbmNvbnN0IGJyYWNlRXNjYXBlID0gKHM6IHN0cmluZykgPT4gcy5yZXBsYWNlKC9bW1xcXVxcXFwtXS9nLCAnXFxcXCQmJylcbi8vIGVzY2FwZSBhbGwgcmVnZXhwIG1hZ2ljIGNoYXJhY3RlcnNcbmNvbnN0IHJlZ2V4cEVzY2FwZSA9IChzOiBzdHJpbmcpID0+XG4gIHMucmVwbGFjZSgvWy1bXFxde30oKSorPy4sXFxcXF4kfCNcXHNdL2csICdcXFxcJCYnKVxuXG4vLyBldmVyeXRoaW5nIGhhcyBhbHJlYWR5IGJlZW4gZXNjYXBlZCwgd2UganVzdCBoYXZlIHRvIGpvaW5cbmNvbnN0IHJhbmdlc1RvU3RyaW5nID0gKHJhbmdlczogc3RyaW5nW10pOiBzdHJpbmcgPT4gcmFuZ2VzLmpvaW4oJycpXG5cbmV4cG9ydCB0eXBlIFBhcnNlQ2xhc3NSZXN1bHQgPSBbXG4gIHNyYzogc3RyaW5nLFxuICB1RmxhZzogYm9vbGVhbixcbiAgY29uc3VtZWQ6IG51bWJlcixcbiAgaGFzTWFnaWM6IGJvb2xlYW4sXG5dXG5cbi8vIHRha2VzIGEgZ2xvYiBzdHJpbmcgYXQgYSBwb3NpeCBicmFjZSBleHByZXNzaW9uLCBhbmQgcmV0dXJuc1xuLy8gYW4gZXF1aXZhbGVudCByZWd1bGFyIGV4cHJlc3Npb24gc291cmNlLCBhbmQgYm9vbGVhbiBpbmRpY2F0aW5nXG4vLyB3aGV0aGVyIHRoZSAvdSBmbGFnIG5lZWRzIHRvIGJlIGFwcGxpZWQsIGFuZCB0aGUgbnVtYmVyIG9mIGNoYXJzXG4vLyBjb25zdW1lZCB0byBwYXJzZSB0aGUgY2hhcmFjdGVyIGNsYXNzLlxuLy8gVGhpcyBhbHNvIHJlbW92ZXMgb3V0IG9mIG9yZGVyIHJhbmdlcywgYW5kIHJldHVybnMgKCQuKSBpZiB0aGVcbi8vIGVudGlyZSBjbGFzcyBqdXN0IG5vIGdvb2QuXG5leHBvcnQgY29uc3QgcGFyc2VDbGFzcyA9IChcbiAgZ2xvYjogc3RyaW5nLFxuICBwb3NpdGlvbjogbnVtYmVyLFxuKTogUGFyc2VDbGFzc1Jlc3VsdCA9PiB7XG4gIGNvbnN0IHBvcyA9IHBvc2l0aW9uXG4gIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICBpZiAoZ2xvYi5jaGFyQXQocG9zKSAhPT0gJ1snKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdub3QgaW4gYSBicmFjZSBleHByZXNzaW9uJylcbiAgfVxuICAvKiBjOCBpZ25vcmUgc3RvcCAqL1xuICBjb25zdCByYW5nZXM6IHN0cmluZ1tdID0gW11cbiAgY29uc3QgbmVnczogc3RyaW5nW10gPSBbXVxuXG4gIGxldCBpID0gcG9zICsgMVxuICBsZXQgc2F3U3RhcnQgPSBmYWxzZVxuICBsZXQgdWZsYWcgPSBmYWxzZVxuICBsZXQgZXNjYXBpbmcgPSBmYWxzZVxuICBsZXQgbmVnYXRlID0gZmFsc2VcbiAgbGV0IGVuZFBvcyA9IHBvc1xuICBsZXQgcmFuZ2VTdGFydCA9ICcnXG4gIFdISUxFOiB3aGlsZSAoaSA8IGdsb2IubGVuZ3RoKSB7XG4gICAgY29uc3QgYyA9IGdsb2IuY2hhckF0KGkpXG4gICAgaWYgKChjID09PSAnIScgfHwgYyA9PT0gJ14nKSAmJiBpID09PSBwb3MgKyAxKSB7XG4gICAgICBuZWdhdGUgPSB0cnVlXG4gICAgICBpKytcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGMgPT09ICddJyAmJiBzYXdTdGFydCAmJiAhZXNjYXBpbmcpIHtcbiAgICAgIGVuZFBvcyA9IGkgKyAxXG4gICAgICBicmVha1xuICAgIH1cblxuICAgIHNhd1N0YXJ0ID0gdHJ1ZVxuICAgIGlmIChjID09PSAnXFxcXCcpIHtcbiAgICAgIGlmICghZXNjYXBpbmcpIHtcbiAgICAgICAgZXNjYXBpbmcgPSB0cnVlXG4gICAgICAgIGkrK1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgLy8gZXNjYXBlZCBcXCBjaGFyLCBmYWxsIHRocm91Z2ggYW5kIHRyZWF0IGxpa2Ugbm9ybWFsIGNoYXJcbiAgICB9XG4gICAgaWYgKGMgPT09ICdbJyAmJiAhZXNjYXBpbmcpIHtcbiAgICAgIC8vIGVpdGhlciBhIHBvc2l4IGNsYXNzLCBhIGNvbGxhdGlvbiBlcXVpdmFsZW50LCBvciBqdXN0IGEgW1xuICAgICAgZm9yIChjb25zdCBbY2xzLCBbdW5pcCwgdSwgbmVnXV0gb2YgT2JqZWN0LmVudHJpZXMocG9zaXhDbGFzc2VzKSkge1xuICAgICAgICBpZiAoZ2xvYi5zdGFydHNXaXRoKGNscywgaSkpIHtcbiAgICAgICAgICAvLyBpbnZhbGlkLCBbYS1bXSBpcyBmaW5lLCBidXQgbm90IFthLVs6YWxwaGFdXVxuICAgICAgICAgIGlmIChyYW5nZVN0YXJ0KSB7XG4gICAgICAgICAgICByZXR1cm4gWyckLicsIGZhbHNlLCBnbG9iLmxlbmd0aCAtIHBvcywgdHJ1ZV1cbiAgICAgICAgICB9XG4gICAgICAgICAgaSArPSBjbHMubGVuZ3RoXG4gICAgICAgICAgaWYgKG5lZykgbmVncy5wdXNoKHVuaXApXG4gICAgICAgICAgZWxzZSByYW5nZXMucHVzaCh1bmlwKVxuICAgICAgICAgIHVmbGFnID0gdWZsYWcgfHwgdVxuICAgICAgICAgIGNvbnRpbnVlIFdISUxFXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBub3cgaXQncyBqdXN0IGEgbm9ybWFsIGNoYXJhY3RlciwgZWZmZWN0aXZlbHlcbiAgICBlc2NhcGluZyA9IGZhbHNlXG4gICAgaWYgKHJhbmdlU3RhcnQpIHtcbiAgICAgIC8vIHRocm93IHRoaXMgcmFuZ2UgYXdheSBpZiBpdCdzIG5vdCB2YWxpZCwgYnV0IG90aGVyc1xuICAgICAgLy8gY2FuIHN0aWxsIG1hdGNoLlxuICAgICAgaWYgKGMgPiByYW5nZVN0YXJ0KSB7XG4gICAgICAgIHJhbmdlcy5wdXNoKGJyYWNlRXNjYXBlKHJhbmdlU3RhcnQpICsgJy0nICsgYnJhY2VFc2NhcGUoYykpXG4gICAgICB9IGVsc2UgaWYgKGMgPT09IHJhbmdlU3RhcnQpIHtcbiAgICAgICAgcmFuZ2VzLnB1c2goYnJhY2VFc2NhcGUoYykpXG4gICAgICB9XG4gICAgICByYW5nZVN0YXJ0ID0gJydcbiAgICAgIGkrK1xuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICAvLyBub3cgbWlnaHQgYmUgdGhlIHN0YXJ0IG9mIGEgcmFuZ2UuXG4gICAgLy8gY2FuIGJlIGVpdGhlciBjLWQgb3IgYy1dIG9yIGM8bW9yZS4uLj5dIG9yIGNdIGF0IHRoaXMgcG9pbnRcbiAgICBpZiAoZ2xvYi5zdGFydHNXaXRoKCctXScsIGkgKyAxKSkge1xuICAgICAgcmFuZ2VzLnB1c2goYnJhY2VFc2NhcGUoYyArICctJykpXG4gICAgICBpICs9IDJcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuICAgIGlmIChnbG9iLnN0YXJ0c1dpdGgoJy0nLCBpICsgMSkpIHtcbiAgICAgIHJhbmdlU3RhcnQgPSBjXG4gICAgICBpICs9IDJcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgLy8gbm90IHRoZSBzdGFydCBvZiBhIHJhbmdlLCBqdXN0IGEgc2luZ2xlIGNoYXJhY3RlclxuICAgIHJhbmdlcy5wdXNoKGJyYWNlRXNjYXBlKGMpKVxuICAgIGkrK1xuICB9XG5cbiAgaWYgKGVuZFBvcyA8IGkpIHtcbiAgICAvLyBkaWRuJ3Qgc2VlIHRoZSBlbmQgb2YgdGhlIGNsYXNzLCBub3QgYSB2YWxpZCBjbGFzcyxcbiAgICAvLyBidXQgbWlnaHQgc3RpbGwgYmUgdmFsaWQgYXMgYSBsaXRlcmFsIG1hdGNoLlxuICAgIHJldHVybiBbJycsIGZhbHNlLCAwLCBmYWxzZV1cbiAgfVxuXG4gIC8vIGlmIHdlIGdvdCBubyByYW5nZXMgYW5kIG5vIG5lZ2F0ZXMsIHRoZW4gd2UgaGF2ZSBhIHJhbmdlIHRoYXRcbiAgLy8gY2Fubm90IHBvc3NpYmx5IG1hdGNoIGFueXRoaW5nLCBhbmQgdGhhdCBwb2lzb25zIHRoZSB3aG9sZSBnbG9iXG4gIGlmICghcmFuZ2VzLmxlbmd0aCAmJiAhbmVncy5sZW5ndGgpIHtcbiAgICByZXR1cm4gWyckLicsIGZhbHNlLCBnbG9iLmxlbmd0aCAtIHBvcywgdHJ1ZV1cbiAgfVxuXG4gIC8vIGlmIHdlIGdvdCBvbmUgcG9zaXRpdmUgcmFuZ2UsIGFuZCBpdCdzIGEgc2luZ2xlIGNoYXJhY3RlciwgdGhlbiB0aGF0J3NcbiAgLy8gbm90IGFjdHVhbGx5IGEgbWFnaWMgcGF0dGVybiwgaXQncyBqdXN0IHRoYXQgb25lIGxpdGVyYWwgY2hhcmFjdGVyLlxuICAvLyB3ZSBzaG91bGQgbm90IHRyZWF0IHRoYXQgYXMgXCJtYWdpY1wiLCB3ZSBzaG91bGQganVzdCByZXR1cm4gdGhlIGxpdGVyYWxcbiAgLy8gY2hhcmFjdGVyLiBbX10gaXMgYSBwZXJmZWN0bHkgdmFsaWQgd2F5IHRvIGVzY2FwZSBnbG9iIG1hZ2ljIGNoYXJzLlxuICBpZiAoXG4gICAgbmVncy5sZW5ndGggPT09IDAgJiZcbiAgICByYW5nZXMubGVuZ3RoID09PSAxICYmXG4gICAgL15cXFxcPy4kLy50ZXN0KHJhbmdlc1swXSkgJiZcbiAgICAhbmVnYXRlXG4gICkge1xuICAgIGNvbnN0IHIgPSByYW5nZXNbMF0ubGVuZ3RoID09PSAyID8gcmFuZ2VzWzBdLnNsaWNlKC0xKSA6IHJhbmdlc1swXVxuICAgIHJldHVybiBbcmVnZXhwRXNjYXBlKHIpLCBmYWxzZSwgZW5kUG9zIC0gcG9zLCBmYWxzZV1cbiAgfVxuXG4gIGNvbnN0IHNyYW5nZXMgPSAnWycgKyAobmVnYXRlID8gJ14nIDogJycpICsgcmFuZ2VzVG9TdHJpbmcocmFuZ2VzKSArICddJ1xuICBjb25zdCBzbmVncyA9ICdbJyArIChuZWdhdGUgPyAnJyA6ICdeJykgKyByYW5nZXNUb1N0cmluZyhuZWdzKSArICddJ1xuICBjb25zdCBjb21iID1cbiAgICByYW5nZXMubGVuZ3RoICYmIG5lZ3MubGVuZ3RoXG4gICAgICA/ICcoJyArIHNyYW5nZXMgKyAnfCcgKyBzbmVncyArICcpJ1xuICAgICAgOiByYW5nZXMubGVuZ3RoXG4gICAgICAgID8gc3Jhbmdlc1xuICAgICAgICA6IHNuZWdzXG5cbiAgcmV0dXJuIFtjb21iLCB1ZmxhZywgZW5kUG9zIC0gcG9zLCB0cnVlXVxufVxuIiwgImltcG9ydCB7IE1pbmltYXRjaE9wdGlvbnMgfSBmcm9tICcuL2luZGV4LmpzJ1xuXG4vKipcbiAqIFVuLWVzY2FwZSBhIHN0cmluZyB0aGF0IGhhcyBiZWVuIGVzY2FwZWQgd2l0aCB7QGxpbmsgZXNjYXBlfS5cbiAqXG4gKiBJZiB0aGUge0BsaW5rIE1pbmltYXRjaE9wdGlvbnMud2luZG93c1BhdGhzTm9Fc2NhcGV9IG9wdGlvbiBpcyB1c2VkLCB0aGVuXG4gKiBzcXVhcmUtYnJhY2tldCBlc2NhcGVzIGFyZSByZW1vdmVkLCBidXQgbm90IGJhY2tzbGFzaCBlc2NhcGVzLlxuICpcbiAqIEZvciBleGFtcGxlLCBpdCB3aWxsIHR1cm4gdGhlIHN0cmluZyBgJ1sqXSdgIGludG8gYCpgLCBidXQgaXQgd2lsbCBub3RcbiAqIHR1cm4gYCdcXFxcKidgIGludG8gYCcqJ2AsIGJlY2F1c2UgYFxcYCBpcyBhIHBhdGggc2VwYXJhdG9yIGluXG4gKiBgd2luZG93c1BhdGhzTm9Fc2NhcGVgIG1vZGUuXG4gKlxuICogV2hlbiBgd2luZG93c1BhdGhzTm9Fc2NhcGVgIGlzIG5vdCBzZXQsIHRoZW4gYm90aCBzcXVhcmUtYnJhY2tldCBlc2NhcGVzIGFuZFxuICogYmFja3NsYXNoIGVzY2FwZXMgYXJlIHJlbW92ZWQuXG4gKlxuICogU2xhc2hlcyAoYW5kIGJhY2tzbGFzaGVzIGluIGB3aW5kb3dzUGF0aHNOb0VzY2FwZWAgbW9kZSkgY2Fubm90IGJlIGVzY2FwZWRcbiAqIG9yIHVuZXNjYXBlZC5cbiAqXG4gKiBXaGVuIGBtYWdpY2FsQnJhY2VzYCBpcyBub3Qgc2V0LCBlc2NhcGVzIG9mIGJyYWNlcyAoYHtgIGFuZCBgfWApIHdpbGwgbm90IGJlXG4gKiB1bmVzY2FwZWQuXG4gKi9cblxuZXhwb3J0IGNvbnN0IHVuZXNjYXBlID0gKFxuICBzOiBzdHJpbmcsXG4gIHtcbiAgICB3aW5kb3dzUGF0aHNOb0VzY2FwZSA9IGZhbHNlLFxuICAgIG1hZ2ljYWxCcmFjZXMgPSB0cnVlLFxuICB9OiBQaWNrPE1pbmltYXRjaE9wdGlvbnMsICd3aW5kb3dzUGF0aHNOb0VzY2FwZScgfCAnbWFnaWNhbEJyYWNlcyc+ID0ge30sXG4pID0+IHtcbiAgaWYgKG1hZ2ljYWxCcmFjZXMpIHtcbiAgICByZXR1cm4gd2luZG93c1BhdGhzTm9Fc2NhcGVcbiAgICAgID8gcy5yZXBsYWNlKC9cXFsoW15cXC9cXFxcXSlcXF0vZywgJyQxJylcbiAgICAgIDogc1xuICAgICAgICAgIC5yZXBsYWNlKC8oKD8hXFxcXCkufF4pXFxbKFteXFwvXFxcXF0pXFxdL2csICckMSQyJylcbiAgICAgICAgICAucmVwbGFjZSgvXFxcXChbXlxcL10pL2csICckMScpXG4gIH1cbiAgcmV0dXJuIHdpbmRvd3NQYXRoc05vRXNjYXBlXG4gICAgPyBzLnJlcGxhY2UoL1xcWyhbXlxcL1xcXFx7fV0pXFxdL2csICckMScpXG4gICAgOiBzXG4gICAgICAgIC5yZXBsYWNlKC8oKD8hXFxcXCkufF4pXFxbKFteXFwvXFxcXHt9XSlcXF0vZywgJyQxJDInKVxuICAgICAgICAucmVwbGFjZSgvXFxcXChbXlxcL3t9XSkvZywgJyQxJylcbn1cbiIsICIvLyBwYXJzZSBhIHNpbmdsZSBwYXRoIHBvcnRpb25cblxuaW1wb3J0IHsgcGFyc2VDbGFzcyB9IGZyb20gJy4vYnJhY2UtZXhwcmVzc2lvbnMuanMnXG5pbXBvcnQgeyBNaW5pbWF0Y2hPcHRpb25zLCBNTVJlZ0V4cCB9IGZyb20gJy4vaW5kZXguanMnXG5pbXBvcnQgeyB1bmVzY2FwZSB9IGZyb20gJy4vdW5lc2NhcGUuanMnXG5cbi8vIGNsYXNzZXMgW10gYXJlIGhhbmRsZWQgYnkgdGhlIHBhcnNlQ2xhc3MgbWV0aG9kXG4vLyBmb3IgcG9zaXRpdmUgZXh0Z2xvYnMsIHdlIHN1Yi1wYXJzZSB0aGUgY29udGVudHMsIGFuZCBjb21iaW5lLFxuLy8gd2l0aCB0aGUgYXBwcm9wcmlhdGUgcmVnZXhwIGNsb3NlLlxuLy8gZm9yIG5lZ2F0aXZlIGV4dGdsb2JzLCB3ZSBzdWItcGFyc2UgdGhlIGNvbnRlbnRzLCBidXQgdGhlblxuLy8gaGF2ZSB0byBpbmNsdWRlIHRoZSByZXN0IG9mIHRoZSBwYXR0ZXJuLCB0aGVuIHRoZSBwYXJlbnQsIGV0Yy4sXG4vLyBhcyB0aGUgdGhpbmcgdGhhdCBjYW5ub3QgYmUgYmVjYXVzZSBSZWdFeHAgbmVnYXRpdmUgbG9va2FoZWFkc1xuLy8gYXJlIGRpZmZlcmVudCBmcm9tIGdsb2JzLlxuLy9cbi8vIFNvIGZvciBleGFtcGxlOlxuLy8gYUAoaXx3ISh4fHkpenxqKWIgPT4gXmEoaXx3KCghPyh4fHkpemIpLiopenxqKWIkXG4vLyAgIDEgICAyIDMgICA0IDUgNiAgICAgIDEgICAyICAgIDMgICA0NiAgICAgIDUgNlxuLy9cbi8vIEFzc2VtYmxpbmcgdGhlIGV4dGdsb2IgcmVxdWlyZXMgbm90IGp1c3QgdGhlIG5lZ2F0ZWQgcGF0dGVybnMgdGhlbXNlbHZlcyxcbi8vIGJ1dCBhbHNvIGFueXRoaW5nIGZvbGxvd2luZyB0aGUgbmVnYXRpdmUgcGF0dGVybnMgdXAgdG8gdGhlIGJvdW5kYXJ5XG4vLyBvZiB0aGUgY3VycmVudCBwYXR0ZXJuLCBwbHVzIGFueXRoaW5nIGZvbGxvd2luZyBpbiB0aGUgcGFyZW50IHBhdHRlcm4uXG4vL1xuLy9cbi8vIFNvLCBmaXJzdCwgd2UgcGFyc2UgdGhlIHN0cmluZyBpbnRvIGFuIEFTVCBvZiBleHRnbG9icywgd2l0aG91dCB0dXJuaW5nXG4vLyBhbnl0aGluZyBpbnRvIHJlZ2V4cHMgeWV0LlxuLy9cbi8vIFsnYScsIHtAIFtbJ2knXSwgWyd3JywgeyFbJ3gnLCAneSddfSwgJ3onXSwgWydqJ11dfSwgJ2InXVxuLy9cbi8vIFRoZW4sIGZvciBhbGwgdGhlIG5lZ2F0aXZlIGV4dGdsb2JzLCB3ZSBhcHBlbmQgd2hhdGV2ZXIgY29tZXMgYWZ0ZXIgaW5cbi8vIGVhY2ggcGFyZW50IGFzIHRoZWlyIHRhaWxcbi8vXG4vLyBbJ2EnLCB7QCBbWydpJ10sIFsndycsIHshWyd4JywgJ3knXSwgJ3onLCAnYid9LCAneiddLCBbJ2onXV19LCAnYiddXG4vL1xuLy8gTGFzdGx5LCB3ZSB0dXJuIGVhY2ggb2YgdGhlc2UgcGllY2VzIGludG8gYSByZWdleHAsIGFuZCBqb2luXG4vL1xuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2LS0tLS0gLiogYmVjYXVzZSB0aGVyZSdzIG1vcmUgZm9sbG93aW5nLFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ICAgIHYgIG90aGVyd2lzZSwgLisgYmVjYXVzZSBpdCBtdXN0IGJlXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHYgICAgdiAgKnNvbWV0aGluZyogdGhlcmUuXG4vLyBbJ15hJywge0AgWydpJywgJ3coPzooIT8oPzp4fHkpLip6YiQpLiopeicsICdqJyBdfSwgJ2IkJ11cbi8vICAgY29weSB3aGF0IGZvbGxvd3MgaW50byBoZXJlLS1eXl5eXlxuLy8gWydeYScsICcoPzppfHcoPzooPyEoPzp4fHkpLip6YiQpLiopenxqKScsICdiJCddXG4vLyBbJ15hKD86aXx3KD86KD8hKD86eHx5KS4qemIkKS4qKXp8ailiJCddXG5cbmV4cG9ydCB0eXBlIEV4dGdsb2JUeXBlID0gJyEnIHwgJz8nIHwgJysnIHwgJyonIHwgJ0AnXG5jb25zdCB0eXBlcyA9IG5ldyBTZXQ8RXh0Z2xvYlR5cGU+KFsnIScsICc/JywgJysnLCAnKicsICdAJ10pXG5jb25zdCBpc0V4dGdsb2JUeXBlID0gKGM6IHN0cmluZyk6IGMgaXMgRXh0Z2xvYlR5cGUgPT5cbiAgdHlwZXMuaGFzKGMgYXMgRXh0Z2xvYlR5cGUpXG5cbi8vIFBhdHRlcm5zIHRoYXQgZ2V0IHByZXBlbmRlZCB0byBiaW5kIHRvIHRoZSBzdGFydCBvZiBlaXRoZXIgdGhlXG4vLyBlbnRpcmUgc3RyaW5nLCBvciBqdXN0IGEgc2luZ2xlIHBhdGggcG9ydGlvbiwgdG8gcHJldmVudCBkb3RzXG4vLyBhbmQvb3IgdHJhdmVyc2FsIHBhdHRlcm5zLCB3aGVuIG5lZWRlZC5cbi8vIEV4dHMgZG9uJ3QgbmVlZCB0aGUgXiBvciAvIGJpdCwgYmVjYXVzZSB0aGUgcm9vdCBiaW5kcyB0aGF0IGFscmVhZHkuXG5jb25zdCBzdGFydE5vVHJhdmVyc2FsID0gJyg/ISg/Ol58LylcXFxcLlxcXFwuPyg/OiR8LykpJ1xuY29uc3Qgc3RhcnROb0RvdCA9ICcoPyFcXFxcLiknXG5cbi8vIGNoYXJhY3RlcnMgdGhhdCBpbmRpY2F0ZSBhIHN0YXJ0IG9mIHBhdHRlcm4gbmVlZHMgdGhlIFwibm8gZG90c1wiIGJpdCxcbi8vIGJlY2F1c2UgYSBkb3QgKm1pZ2h0KiBiZSBtYXRjaGVkLiAoIGlzIG5vdCBpbiB0aGUgbGlzdCwgYmVjYXVzZSBpblxuLy8gdGhlIGNhc2Ugb2YgYSBjaGlsZCBleHRnbG9iLCBpdCB3aWxsIGhhbmRsZSB0aGUgcHJldmVudGlvbiBpdHNlbGYuXG5jb25zdCBhZGRQYXR0ZXJuU3RhcnQgPSBuZXcgU2V0KFsnWycsICcuJ10pXG4vLyBjYXNlcyB3aGVyZSB0cmF2ZXJzYWwgaXMgQS1PSywgbm8gZG90IHByZXZlbnRpb24gbmVlZGVkXG5jb25zdCBqdXN0RG90cyA9IG5ldyBTZXQoWycuLicsICcuJ10pXG5jb25zdCByZVNwZWNpYWxzID0gbmV3IFNldCgnKCkuKnt9Kz9bXV4kXFxcXCEnKVxuY29uc3QgcmVnRXhwRXNjYXBlID0gKHM6IHN0cmluZykgPT5cbiAgcy5yZXBsYWNlKC9bLVtcXF17fSgpKis/LixcXFxcXiR8I1xcc10vZywgJ1xcXFwkJicpXG5cbi8vIGFueSBzaW5nbGUgdGhpbmcgb3RoZXIgdGhhbiAvXG5jb25zdCBxbWFyayA9ICdbXi9dJ1xuXG4vLyAqID0+IGFueSBudW1iZXIgb2YgY2hhcmFjdGVyc1xuY29uc3Qgc3RhciA9IHFtYXJrICsgJyo/J1xuLy8gdXNlICsgd2hlbiB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0ICpzb21ldGhpbmcqIG1hdGNoZXMsIGJlY2F1c2UgdGhlICogaXNcbi8vIHRoZSBvbmx5IHRoaW5nIGluIHRoZSBwYXRoIHBvcnRpb24uXG5jb25zdCBzdGFyTm9FbXB0eSA9IHFtYXJrICsgJys/J1xuXG4vLyByZW1vdmUgdGhlIFxcIGNoYXJzIHRoYXQgd2UgYWRkZWQgaWYgd2UgZW5kIHVwIGRvaW5nIGEgbm9ubWFnaWMgY29tcGFyZVxuLy8gY29uc3QgZGVzbGFzaCA9IChzOiBzdHJpbmcpID0+IHMucmVwbGFjZSgvXFxcXCguKS9nLCAnJDEnKVxuXG5leHBvcnQgY2xhc3MgQVNUIHtcbiAgdHlwZTogRXh0Z2xvYlR5cGUgfCBudWxsXG4gIHJlYWRvbmx5ICNyb290OiBBU1RcblxuICAjaGFzTWFnaWM/OiBib29sZWFuXG4gICN1ZmxhZzogYm9vbGVhbiA9IGZhbHNlXG4gICNwYXJ0czogKHN0cmluZyB8IEFTVClbXSA9IFtdXG4gIHJlYWRvbmx5ICNwYXJlbnQ/OiBBU1RcbiAgcmVhZG9ubHkgI3BhcmVudEluZGV4OiBudW1iZXJcbiAgI25lZ3M6IEFTVFtdXG4gICNmaWxsZWROZWdzOiBib29sZWFuID0gZmFsc2VcbiAgI29wdGlvbnM6IE1pbmltYXRjaE9wdGlvbnNcbiAgI3RvU3RyaW5nPzogc3RyaW5nXG4gIC8vIHNldCB0byB0cnVlIGlmIGl0J3MgYW4gZXh0Z2xvYiB3aXRoIG5vIGNoaWxkcmVuXG4gIC8vICh3aGljaCByZWFsbHkgbWVhbnMgb25lIGNoaWxkIG9mICcnKVxuICAjZW1wdHlFeHQ6IGJvb2xlYW4gPSBmYWxzZVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHR5cGU6IEV4dGdsb2JUeXBlIHwgbnVsbCxcbiAgICBwYXJlbnQ/OiBBU1QsXG4gICAgb3B0aW9uczogTWluaW1hdGNoT3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlXG4gICAgLy8gZXh0Z2xvYnMgYXJlIGluaGVyZW50bHkgbWFnaWNhbFxuICAgIGlmICh0eXBlKSB0aGlzLiNoYXNNYWdpYyA9IHRydWVcbiAgICB0aGlzLiNwYXJlbnQgPSBwYXJlbnRcbiAgICB0aGlzLiNyb290ID0gdGhpcy4jcGFyZW50ID8gdGhpcy4jcGFyZW50LiNyb290IDogdGhpc1xuICAgIHRoaXMuI29wdGlvbnMgPSB0aGlzLiNyb290ID09PSB0aGlzID8gb3B0aW9ucyA6IHRoaXMuI3Jvb3QuI29wdGlvbnNcbiAgICB0aGlzLiNuZWdzID0gdGhpcy4jcm9vdCA9PT0gdGhpcyA/IFtdIDogdGhpcy4jcm9vdC4jbmVnc1xuICAgIGlmICh0eXBlID09PSAnIScgJiYgIXRoaXMuI3Jvb3QuI2ZpbGxlZE5lZ3MpIHRoaXMuI25lZ3MucHVzaCh0aGlzKVxuICAgIHRoaXMuI3BhcmVudEluZGV4ID0gdGhpcy4jcGFyZW50ID8gdGhpcy4jcGFyZW50LiNwYXJ0cy5sZW5ndGggOiAwXG4gIH1cblxuICBnZXQgaGFzTWFnaWMoKTogYm9vbGVhbiB8IHVuZGVmaW5lZCB7XG4gICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgaWYgKHRoaXMuI2hhc01hZ2ljICE9PSB1bmRlZmluZWQpIHJldHVybiB0aGlzLiNoYXNNYWdpY1xuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgZm9yIChjb25zdCBwIG9mIHRoaXMuI3BhcnRzKSB7XG4gICAgICBpZiAodHlwZW9mIHAgPT09ICdzdHJpbmcnKSBjb250aW51ZVxuICAgICAgaWYgKHAudHlwZSB8fCBwLmhhc01hZ2ljKSByZXR1cm4gKHRoaXMuI2hhc01hZ2ljID0gdHJ1ZSlcbiAgICB9XG4gICAgLy8gbm90ZTogd2lsbCBiZSB1bmRlZmluZWQgdW50aWwgd2UgZ2VuZXJhdGUgdGhlIHJlZ2V4cCBzcmMgYW5kIGZpbmQgb3V0XG4gICAgcmV0dXJuIHRoaXMuI2hhc01hZ2ljXG4gIH1cblxuICAvLyByZWNvbnN0cnVjdHMgdGhlIHBhdHRlcm5cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy4jdG9TdHJpbmcgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHRoaXMuI3RvU3RyaW5nXG4gICAgaWYgKCF0aGlzLnR5cGUpIHtcbiAgICAgIHJldHVybiAodGhpcy4jdG9TdHJpbmcgPSB0aGlzLiNwYXJ0cy5tYXAocCA9PiBTdHJpbmcocCkpLmpvaW4oJycpKVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gKHRoaXMuI3RvU3RyaW5nID1cbiAgICAgICAgdGhpcy50eXBlICsgJygnICsgdGhpcy4jcGFydHMubWFwKHAgPT4gU3RyaW5nKHApKS5qb2luKCd8JykgKyAnKScpXG4gICAgfVxuICB9XG5cbiAgI2ZpbGxOZWdzKCkge1xuICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgIGlmICh0aGlzICE9PSB0aGlzLiNyb290KSB0aHJvdyBuZXcgRXJyb3IoJ3Nob3VsZCBvbmx5IGNhbGwgb24gcm9vdCcpXG4gICAgaWYgKHRoaXMuI2ZpbGxlZE5lZ3MpIHJldHVybiB0aGlzXG4gICAgLyogYzggaWdub3JlIHN0b3AgKi9cblxuICAgIC8vIGNhbGwgdG9TdHJpbmcoKSBvbmNlIHRvIGZpbGwgdGhpcyBvdXRcbiAgICB0aGlzLnRvU3RyaW5nKClcbiAgICB0aGlzLiNmaWxsZWROZWdzID0gdHJ1ZVxuICAgIGxldCBuOiBBU1QgfCB1bmRlZmluZWRcbiAgICB3aGlsZSAoKG4gPSB0aGlzLiNuZWdzLnBvcCgpKSkge1xuICAgICAgaWYgKG4udHlwZSAhPT0gJyEnKSBjb250aW51ZVxuICAgICAgLy8gd2FsayB1cCB0aGUgdHJlZSwgYXBwZW5kaW5nIGV2ZXJ0aGluZyB0aGF0IGNvbWVzIEFGVEVSIHBhcmVudEluZGV4XG4gICAgICBsZXQgcDogQVNUIHwgdW5kZWZpbmVkID0gblxuICAgICAgbGV0IHBwID0gcC4jcGFyZW50XG4gICAgICB3aGlsZSAocHApIHtcbiAgICAgICAgZm9yIChcbiAgICAgICAgICBsZXQgaSA9IHAuI3BhcmVudEluZGV4ICsgMTtcbiAgICAgICAgICAhcHAudHlwZSAmJiBpIDwgcHAuI3BhcnRzLmxlbmd0aDtcbiAgICAgICAgICBpKytcbiAgICAgICAgKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBwYXJ0IG9mIG4uI3BhcnRzKSB7XG4gICAgICAgICAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICAgICAgICAgIGlmICh0eXBlb2YgcGFydCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdzdHJpbmcgcGFydCBpbiBleHRnbG9iIEFTVD8/JylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgICAgICAgICBwYXJ0LmNvcHlJbihwcC4jcGFydHNbaV0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHAgPSBwcFxuICAgICAgICBwcCA9IHAuI3BhcmVudFxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgcHVzaCguLi5wYXJ0czogKHN0cmluZyB8IEFTVClbXSkge1xuICAgIGZvciAoY29uc3QgcCBvZiBwYXJ0cykge1xuICAgICAgaWYgKHAgPT09ICcnKSBjb250aW51ZVxuICAgICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgICBpZiAodHlwZW9mIHAgIT09ICdzdHJpbmcnICYmICEocCBpbnN0YW5jZW9mIEFTVCAmJiBwLiNwYXJlbnQgPT09IHRoaXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBwYXJ0OiAnICsgcClcbiAgICAgIH1cbiAgICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgICB0aGlzLiNwYXJ0cy5wdXNoKHApXG4gICAgfVxuICB9XG5cbiAgdG9KU09OKCkge1xuICAgIGNvbnN0IHJldDogYW55W10gPVxuICAgICAgdGhpcy50eXBlID09PSBudWxsXG4gICAgICAgID8gdGhpcy4jcGFydHMuc2xpY2UoKS5tYXAocCA9PiAodHlwZW9mIHAgPT09ICdzdHJpbmcnID8gcCA6IHAudG9KU09OKCkpKVxuICAgICAgICA6IFt0aGlzLnR5cGUsIC4uLnRoaXMuI3BhcnRzLm1hcChwID0+IChwIGFzIEFTVCkudG9KU09OKCkpXVxuICAgIGlmICh0aGlzLmlzU3RhcnQoKSAmJiAhdGhpcy50eXBlKSByZXQudW5zaGlmdChbXSlcbiAgICBpZiAoXG4gICAgICB0aGlzLmlzRW5kKCkgJiZcbiAgICAgICh0aGlzID09PSB0aGlzLiNyb290IHx8XG4gICAgICAgICh0aGlzLiNyb290LiNmaWxsZWROZWdzICYmIHRoaXMuI3BhcmVudD8udHlwZSA9PT0gJyEnKSlcbiAgICApIHtcbiAgICAgIHJldC5wdXNoKHt9KVxuICAgIH1cbiAgICByZXR1cm4gcmV0XG4gIH1cblxuICBpc1N0YXJ0KCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLiNyb290ID09PSB0aGlzKSByZXR1cm4gdHJ1ZVxuICAgIC8vIGlmICh0aGlzLnR5cGUpIHJldHVybiAhIXRoaXMuI3BhcmVudD8uaXNTdGFydCgpXG4gICAgaWYgKCF0aGlzLiNwYXJlbnQ/LmlzU3RhcnQoKSkgcmV0dXJuIGZhbHNlXG4gICAgaWYgKHRoaXMuI3BhcmVudEluZGV4ID09PSAwKSByZXR1cm4gdHJ1ZVxuICAgIC8vIGlmIGV2ZXJ5dGhpbmcgQUhFQUQgb2YgdGhpcyBpcyBhIG5lZ2F0aW9uLCB0aGVuIGl0J3Mgc3RpbGwgdGhlIFwic3RhcnRcIlxuICAgIGNvbnN0IHAgPSB0aGlzLiNwYXJlbnRcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuI3BhcmVudEluZGV4OyBpKyspIHtcbiAgICAgIGNvbnN0IHBwID0gcC4jcGFydHNbaV1cbiAgICAgIGlmICghKHBwIGluc3RhbmNlb2YgQVNUICYmIHBwLnR5cGUgPT09ICchJykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBpc0VuZCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy4jcm9vdCA9PT0gdGhpcykgcmV0dXJuIHRydWVcbiAgICBpZiAodGhpcy4jcGFyZW50Py50eXBlID09PSAnIScpIHJldHVybiB0cnVlXG4gICAgaWYgKCF0aGlzLiNwYXJlbnQ/LmlzRW5kKCkpIHJldHVybiBmYWxzZVxuICAgIGlmICghdGhpcy50eXBlKSByZXR1cm4gdGhpcy4jcGFyZW50Py5pc0VuZCgpXG4gICAgLy8gaWYgbm90IHJvb3QsIGl0J2xsIGFsd2F5cyBoYXZlIGEgcGFyZW50XG4gICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgY29uc3QgcGwgPSB0aGlzLiNwYXJlbnQgPyB0aGlzLiNwYXJlbnQuI3BhcnRzLmxlbmd0aCA6IDBcbiAgICAvKiBjOCBpZ25vcmUgc3RvcCAqL1xuICAgIHJldHVybiB0aGlzLiNwYXJlbnRJbmRleCA9PT0gcGwgLSAxXG4gIH1cblxuICBjb3B5SW4ocGFydDogQVNUIHwgc3RyaW5nKSB7XG4gICAgaWYgKHR5cGVvZiBwYXJ0ID09PSAnc3RyaW5nJykgdGhpcy5wdXNoKHBhcnQpXG4gICAgZWxzZSB0aGlzLnB1c2gocGFydC5jbG9uZSh0aGlzKSlcbiAgfVxuXG4gIGNsb25lKHBhcmVudDogQVNUKSB7XG4gICAgY29uc3QgYyA9IG5ldyBBU1QodGhpcy50eXBlLCBwYXJlbnQpXG4gICAgZm9yIChjb25zdCBwIG9mIHRoaXMuI3BhcnRzKSB7XG4gICAgICBjLmNvcHlJbihwKVxuICAgIH1cbiAgICByZXR1cm4gY1xuICB9XG5cbiAgc3RhdGljICNwYXJzZUFTVChcbiAgICBzdHI6IHN0cmluZyxcbiAgICBhc3Q6IEFTVCxcbiAgICBwb3M6IG51bWJlcixcbiAgICBvcHQ6IE1pbmltYXRjaE9wdGlvbnMsXG4gICk6IG51bWJlciB7XG4gICAgbGV0IGVzY2FwaW5nID0gZmFsc2VcbiAgICBsZXQgaW5CcmFjZSA9IGZhbHNlXG4gICAgbGV0IGJyYWNlU3RhcnQgPSAtMVxuICAgIGxldCBicmFjZU5lZyA9IGZhbHNlXG4gICAgaWYgKGFzdC50eXBlID09PSBudWxsKSB7XG4gICAgICAvLyBvdXRzaWRlIG9mIGEgZXh0Z2xvYiwgYXBwZW5kIHVudGlsIHdlIGZpbmQgYSBzdGFydFxuICAgICAgbGV0IGkgPSBwb3NcbiAgICAgIGxldCBhY2MgPSAnJ1xuICAgICAgd2hpbGUgKGkgPCBzdHIubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGMgPSBzdHIuY2hhckF0KGkrKylcbiAgICAgICAgLy8gc3RpbGwgYWNjdW11bGF0ZSBlc2NhcGVzIGF0IHRoaXMgcG9pbnQsIGJ1dCB3ZSBkbyBpZ25vcmVcbiAgICAgICAgLy8gc3RhcnRzIHRoYXQgYXJlIGVzY2FwZWRcbiAgICAgICAgaWYgKGVzY2FwaW5nIHx8IGMgPT09ICdcXFxcJykge1xuICAgICAgICAgIGVzY2FwaW5nID0gIWVzY2FwaW5nXG4gICAgICAgICAgYWNjICs9IGNcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluQnJhY2UpIHtcbiAgICAgICAgICBpZiAoaSA9PT0gYnJhY2VTdGFydCArIDEpIHtcbiAgICAgICAgICAgIGlmIChjID09PSAnXicgfHwgYyA9PT0gJyEnKSB7XG4gICAgICAgICAgICAgIGJyYWNlTmVnID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gJ10nICYmICEoaSA9PT0gYnJhY2VTdGFydCArIDIgJiYgYnJhY2VOZWcpKSB7XG4gICAgICAgICAgICBpbkJyYWNlID0gZmFsc2VcbiAgICAgICAgICB9XG4gICAgICAgICAgYWNjICs9IGNcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGMgPT09ICdbJykge1xuICAgICAgICAgIGluQnJhY2UgPSB0cnVlXG4gICAgICAgICAgYnJhY2VTdGFydCA9IGlcbiAgICAgICAgICBicmFjZU5lZyA9IGZhbHNlXG4gICAgICAgICAgYWNjICs9IGNcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHQubm9leHQgJiYgaXNFeHRnbG9iVHlwZShjKSAmJiBzdHIuY2hhckF0KGkpID09PSAnKCcpIHtcbiAgICAgICAgICBhc3QucHVzaChhY2MpXG4gICAgICAgICAgYWNjID0gJydcbiAgICAgICAgICBjb25zdCBleHQgPSBuZXcgQVNUKGMsIGFzdClcbiAgICAgICAgICBpID0gQVNULiNwYXJzZUFTVChzdHIsIGV4dCwgaSwgb3B0KVxuICAgICAgICAgIGFzdC5wdXNoKGV4dClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIGFjYyArPSBjXG4gICAgICB9XG4gICAgICBhc3QucHVzaChhY2MpXG4gICAgICByZXR1cm4gaVxuICAgIH1cblxuICAgIC8vIHNvbWUga2luZCBvZiBleHRnbG9iLCBwb3MgaXMgYXQgdGhlIChcbiAgICAvLyBmaW5kIHRoZSBuZXh0IHwgb3IgKVxuICAgIGxldCBpID0gcG9zICsgMVxuICAgIGxldCBwYXJ0ID0gbmV3IEFTVChudWxsLCBhc3QpXG4gICAgY29uc3QgcGFydHM6IEFTVFtdID0gW11cbiAgICBsZXQgYWNjID0gJydcbiAgICB3aGlsZSAoaSA8IHN0ci5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGMgPSBzdHIuY2hhckF0KGkrKylcbiAgICAgIC8vIHN0aWxsIGFjY3VtdWxhdGUgZXNjYXBlcyBhdCB0aGlzIHBvaW50LCBidXQgd2UgZG8gaWdub3JlXG4gICAgICAvLyBzdGFydHMgdGhhdCBhcmUgZXNjYXBlZFxuICAgICAgaWYgKGVzY2FwaW5nIHx8IGMgPT09ICdcXFxcJykge1xuICAgICAgICBlc2NhcGluZyA9ICFlc2NhcGluZ1xuICAgICAgICBhY2MgKz0gY1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICBpZiAoaW5CcmFjZSkge1xuICAgICAgICBpZiAoaSA9PT0gYnJhY2VTdGFydCArIDEpIHtcbiAgICAgICAgICBpZiAoYyA9PT0gJ14nIHx8IGMgPT09ICchJykge1xuICAgICAgICAgICAgYnJhY2VOZWcgPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGMgPT09ICddJyAmJiAhKGkgPT09IGJyYWNlU3RhcnQgKyAyICYmIGJyYWNlTmVnKSkge1xuICAgICAgICAgIGluQnJhY2UgPSBmYWxzZVxuICAgICAgICB9XG4gICAgICAgIGFjYyArPSBjXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9IGVsc2UgaWYgKGMgPT09ICdbJykge1xuICAgICAgICBpbkJyYWNlID0gdHJ1ZVxuICAgICAgICBicmFjZVN0YXJ0ID0gaVxuICAgICAgICBicmFjZU5lZyA9IGZhbHNlXG4gICAgICAgIGFjYyArPSBjXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmIChpc0V4dGdsb2JUeXBlKGMpICYmIHN0ci5jaGFyQXQoaSkgPT09ICcoJykge1xuICAgICAgICBwYXJ0LnB1c2goYWNjKVxuICAgICAgICBhY2MgPSAnJ1xuICAgICAgICBjb25zdCBleHQgPSBuZXcgQVNUKGMsIHBhcnQpXG4gICAgICAgIHBhcnQucHVzaChleHQpXG4gICAgICAgIGkgPSBBU1QuI3BhcnNlQVNUKHN0ciwgZXh0LCBpLCBvcHQpXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBpZiAoYyA9PT0gJ3wnKSB7XG4gICAgICAgIHBhcnQucHVzaChhY2MpXG4gICAgICAgIGFjYyA9ICcnXG4gICAgICAgIHBhcnRzLnB1c2gocGFydClcbiAgICAgICAgcGFydCA9IG5ldyBBU1QobnVsbCwgYXN0KVxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgaWYgKGMgPT09ICcpJykge1xuICAgICAgICBpZiAoYWNjID09PSAnJyAmJiBhc3QuI3BhcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGFzdC4jZW1wdHlFeHQgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgcGFydC5wdXNoKGFjYylcbiAgICAgICAgYWNjID0gJydcbiAgICAgICAgYXN0LnB1c2goLi4ucGFydHMsIHBhcnQpXG4gICAgICAgIHJldHVybiBpXG4gICAgICB9XG4gICAgICBhY2MgKz0gY1xuICAgIH1cblxuICAgIC8vIHVuZmluaXNoZWQgZXh0Z2xvYlxuICAgIC8vIGlmIHdlIGdvdCBoZXJlLCBpdCB3YXMgYSBtYWxmb3JtZWQgZXh0Z2xvYiEgbm90IGFuIGV4dGdsb2IsIGJ1dFxuICAgIC8vIG1heWJlIHNvbWV0aGluZyBlbHNlIGluIHRoZXJlLlxuICAgIGFzdC50eXBlID0gbnVsbFxuICAgIGFzdC4jaGFzTWFnaWMgPSB1bmRlZmluZWRcbiAgICBhc3QuI3BhcnRzID0gW3N0ci5zdWJzdHJpbmcocG9zIC0gMSldXG4gICAgcmV0dXJuIGlcbiAgfVxuXG4gIHN0YXRpYyBmcm9tR2xvYihwYXR0ZXJuOiBzdHJpbmcsIG9wdGlvbnM6IE1pbmltYXRjaE9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IGFzdCA9IG5ldyBBU1QobnVsbCwgdW5kZWZpbmVkLCBvcHRpb25zKVxuICAgIEFTVC4jcGFyc2VBU1QocGF0dGVybiwgYXN0LCAwLCBvcHRpb25zKVxuICAgIHJldHVybiBhc3RcbiAgfVxuXG4gIC8vIHJldHVybnMgdGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBpZiB0aGVyZSdzIG1hZ2ljLCBvciB0aGUgdW5lc2NhcGVkXG4gIC8vIHN0cmluZyBpZiBub3QuXG4gIHRvTU1QYXR0ZXJuKCk6IE1NUmVnRXhwIHwgc3RyaW5nIHtcbiAgICAvLyBzaG91bGQgb25seSBiZSBjYWxsZWQgb24gcm9vdFxuICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgIGlmICh0aGlzICE9PSB0aGlzLiNyb290KSByZXR1cm4gdGhpcy4jcm9vdC50b01NUGF0dGVybigpXG4gICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICBjb25zdCBnbG9iID0gdGhpcy50b1N0cmluZygpXG4gICAgY29uc3QgW3JlLCBib2R5LCBoYXNNYWdpYywgdWZsYWddID0gdGhpcy50b1JlZ0V4cFNvdXJjZSgpXG4gICAgLy8gaWYgd2UncmUgaW4gbm9jYXNlIG1vZGUsIGFuZCBub3Qgbm9jYXNlTWFnaWNPbmx5LCB0aGVuIHdlIGRvXG4gICAgLy8gc3RpbGwgbmVlZCBhIHJlZ3VsYXIgZXhwcmVzc2lvbiBpZiB3ZSBoYXZlIHRvIGNhc2UtaW5zZW5zaXRpdmVseVxuICAgIC8vIG1hdGNoIGNhcGl0YWwvbG93ZXJjYXNlIGNoYXJhY3RlcnMuXG4gICAgY29uc3QgYW55TWFnaWMgPVxuICAgICAgaGFzTWFnaWMgfHxcbiAgICAgIHRoaXMuI2hhc01hZ2ljIHx8XG4gICAgICAodGhpcy4jb3B0aW9ucy5ub2Nhc2UgJiZcbiAgICAgICAgIXRoaXMuI29wdGlvbnMubm9jYXNlTWFnaWNPbmx5ICYmXG4gICAgICAgIGdsb2IudG9VcHBlckNhc2UoKSAhPT0gZ2xvYi50b0xvd2VyQ2FzZSgpKVxuICAgIGlmICghYW55TWFnaWMpIHtcbiAgICAgIHJldHVybiBib2R5XG4gICAgfVxuXG4gICAgY29uc3QgZmxhZ3MgPSAodGhpcy4jb3B0aW9ucy5ub2Nhc2UgPyAnaScgOiAnJykgKyAodWZsYWcgPyAndScgOiAnJylcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihuZXcgUmVnRXhwKGBeJHtyZX0kYCwgZmxhZ3MpLCB7XG4gICAgICBfc3JjOiByZSxcbiAgICAgIF9nbG9iOiBnbG9iLFxuICAgIH0pXG4gIH1cblxuICBnZXQgb3B0aW9ucygpIHtcbiAgICByZXR1cm4gdGhpcy4jb3B0aW9uc1xuICB9XG5cbiAgLy8gcmV0dXJucyB0aGUgc3RyaW5nIG1hdGNoLCB0aGUgcmVnZXhwIHNvdXJjZSwgd2hldGhlciB0aGVyZSdzIG1hZ2ljXG4gIC8vIGluIHRoZSByZWdleHAgKHNvIGEgcmVndWxhciBleHByZXNzaW9uIGlzIHJlcXVpcmVkKSBhbmQgd2hldGhlciBvclxuICAvLyBub3QgdGhlIHVmbGFnIGlzIG5lZWRlZCBmb3IgdGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiAoZm9yIHBvc2l4IGNsYXNzZXMpXG4gIC8vIFRPRE86IGluc3RlYWQgb2YgaW5qZWN0aW5nIHRoZSBzdGFydC9lbmQgYXQgdGhpcyBwb2ludCwganVzdCByZXR1cm5cbiAgLy8gdGhlIEJPRFkgb2YgdGhlIHJlZ2V4cCwgYWxvbmcgd2l0aCB0aGUgc3RhcnQvZW5kIHBvcnRpb25zIHN1aXRhYmxlXG4gIC8vIGZvciBiaW5kaW5nIHRoZSBzdGFydC9lbmQgaW4gZWl0aGVyIGEgam9pbmVkIGZ1bGwtcGF0aCBtYWtlUmUgY29udGV4dFxuICAvLyAod2hlcmUgd2UgYmluZCB0byAoXnwvKSwgb3IgYSBzdGFuZGFsb25lIG1hdGNoUGFydCBjb250ZXh0ICh3aGVyZVxuICAvLyB3ZSBiaW5kIHRvIF4sIGFuZCBub3QgLykuICBPdGhlcndpc2Ugc2xhc2hlcyBnZXQgZHVwZWQhXG4gIC8vXG4gIC8vIEluIHBhcnQtbWF0Y2hpbmcgbW9kZSwgdGhlIHN0YXJ0IGlzOlxuICAvLyAtIGlmIG5vdCBpc1N0YXJ0OiBub3RoaW5nXG4gIC8vIC0gaWYgdHJhdmVyc2FsIHBvc3NpYmxlLCBidXQgbm90IGFsbG93ZWQ6IF4oPyFcXC5cXC4/JClcbiAgLy8gLSBpZiBkb3RzIGFsbG93ZWQgb3Igbm90IHBvc3NpYmxlOiBeXG4gIC8vIC0gaWYgZG90cyBwb3NzaWJsZSBhbmQgbm90IGFsbG93ZWQ6IF4oPyFcXC4pXG4gIC8vIGVuZCBpczpcbiAgLy8gLSBpZiBub3QgaXNFbmQoKTogbm90aGluZ1xuICAvLyAtIGVsc2U6ICRcbiAgLy9cbiAgLy8gSW4gZnVsbC1wYXRoIG1hdGNoaW5nIG1vZGUsIHdlIHB1dCB0aGUgc2xhc2ggYXQgdGhlIFNUQVJUIG9mIHRoZVxuICAvLyBwYXR0ZXJuLCBzbyBzdGFydCBpczpcbiAgLy8gLSBpZiBmaXJzdCBwYXR0ZXJuOiBzYW1lIGFzIHBhcnQtbWF0Y2hpbmcgbW9kZVxuICAvLyAtIGlmIG5vdCBpc1N0YXJ0KCk6IG5vdGhpbmdcbiAgLy8gLSBpZiB0cmF2ZXJzYWwgcG9zc2libGUsIGJ1dCBub3QgYWxsb3dlZDogLyg/IVxcLlxcLj8oPzokfC8pKVxuICAvLyAtIGlmIGRvdHMgYWxsb3dlZCBvciBub3QgcG9zc2libGU6IC9cbiAgLy8gLSBpZiBkb3RzIHBvc3NpYmxlIGFuZCBub3QgYWxsb3dlZDogLyg/IVxcLilcbiAgLy8gZW5kIGlzOlxuICAvLyAtIGlmIGxhc3QgcGF0dGVybiwgc2FtZSBhcyBwYXJ0LW1hdGNoaW5nIG1vZGVcbiAgLy8gLSBlbHNlIG5vdGhpbmdcbiAgLy9cbiAgLy8gQWx3YXlzIHB1dCB0aGUgKD86JHwvKSBvbiBuZWdhdGVkIHRhaWxzLCB0aG91Z2gsIGJlY2F1c2UgdGhhdCBoYXMgdG8gYmVcbiAgLy8gdGhlcmUgdG8gYmluZCB0aGUgZW5kIG9mIHRoZSBuZWdhdGVkIHBhdHRlcm4gcG9ydGlvbiwgYW5kIGl0J3MgZWFzaWVyIHRvXG4gIC8vIGp1c3Qgc3RpY2sgaXQgaW4gbm93IHJhdGhlciB0aGFuIHRyeSB0byBpbmplY3QgaXQgbGF0ZXIgaW4gdGhlIG1pZGRsZSBvZlxuICAvLyB0aGUgcGF0dGVybi5cbiAgLy9cbiAgLy8gV2UgY2FuIGp1c3QgYWx3YXlzIHJldHVybiB0aGUgc2FtZSBlbmQsIGFuZCBsZWF2ZSBpdCB1cCB0byB0aGUgY2FsbGVyXG4gIC8vIHRvIGtub3cgd2hldGhlciBpdCdzIGdvaW5nIHRvIGJlIHVzZWQgam9pbmVkIG9yIGluIHBhcnRzLlxuICAvLyBBbmQsIGlmIHRoZSBzdGFydCBpcyBhZGp1c3RlZCBzbGlnaHRseSwgY2FuIGRvIHRoZSBzYW1lIHRoZXJlOlxuICAvLyAtIGlmIG5vdCBpc1N0YXJ0OiBub3RoaW5nXG4gIC8vIC0gaWYgdHJhdmVyc2FsIHBvc3NpYmxlLCBidXQgbm90IGFsbG93ZWQ6ICg/Oi98XikoPyFcXC5cXC4/JClcbiAgLy8gLSBpZiBkb3RzIGFsbG93ZWQgb3Igbm90IHBvc3NpYmxlOiAoPzovfF4pXG4gIC8vIC0gaWYgZG90cyBwb3NzaWJsZSBhbmQgbm90IGFsbG93ZWQ6ICg/Oi98XikoPyFcXC4pXG4gIC8vXG4gIC8vIEJ1dCBpdCdzIGJldHRlciB0byBoYXZlIGEgc2ltcGxlciBiaW5kaW5nIHdpdGhvdXQgYSBjb25kaXRpb25hbCwgZm9yXG4gIC8vIHBlcmZvcm1hbmNlLCBzbyBwcm9iYWJseSBiZXR0ZXIgdG8gcmV0dXJuIGJvdGggc3RhcnQgb3B0aW9ucy5cbiAgLy9cbiAgLy8gVGhlbiB0aGUgY2FsbGVyIGp1c3QgaWdub3JlcyB0aGUgZW5kIGlmIGl0J3Mgbm90IHRoZSBmaXJzdCBwYXR0ZXJuLFxuICAvLyBhbmQgdGhlIHN0YXJ0IGFsd2F5cyBnZXRzIGFwcGxpZWQuXG4gIC8vXG4gIC8vIEJ1dCB0aGF0J3MgYWx3YXlzIGdvaW5nIHRvIGJlICQgaWYgaXQncyB0aGUgZW5kaW5nIHBhdHRlcm4sIG9yIG5vdGhpbmcsXG4gIC8vIHNvIHRoZSBjYWxsZXIgY2FuIGp1c3QgYXR0YWNoICQgYXQgdGhlIGVuZCBvZiB0aGUgcGF0dGVybiB3aGVuIGJ1aWxkaW5nLlxuICAvL1xuICAvLyBTbyB0aGUgdG9kbyBpczpcbiAgLy8gLSBiZXR0ZXIgZGV0ZWN0IHdoYXQga2luZCBvZiBzdGFydCBpcyBuZWVkZWRcbiAgLy8gLSByZXR1cm4gYm90aCBmbGF2b3JzIG9mIHN0YXJ0aW5nIHBhdHRlcm5cbiAgLy8gLSBhdHRhY2ggJCBhdCB0aGUgZW5kIG9mIHRoZSBwYXR0ZXJuIHdoZW4gY3JlYXRpbmcgdGhlIGFjdHVhbCBSZWdFeHBcbiAgLy9cbiAgLy8gQWgsIGJ1dCB3YWl0LCBubywgdGhhdCBhbGwgb25seSBhcHBsaWVzIHRvIHRoZSByb290IHdoZW4gdGhlIGZpcnN0IHBhdHRlcm5cbiAgLy8gaXMgbm90IGFuIGV4dGdsb2IuIElmIHRoZSBmaXJzdCBwYXR0ZXJuIElTIGFuIGV4dGdsb2IsIHRoZW4gd2UgbmVlZCBhbGxcbiAgLy8gdGhhdCBkb3QgcHJldmVudGlvbiBiaXogdG8gbGl2ZSBpbiB0aGUgZXh0Z2xvYiBwb3J0aW9ucywgYmVjYXVzZSBlZ1xuICAvLyArKCp8LngqKSBjYW4gbWF0Y2ggLnh5IGJ1dCBub3QgLnl4LlxuICAvL1xuICAvLyBTbywgcmV0dXJuIHRoZSB0d28gZmxhdm9ycyBpZiBpdCdzICNyb290IGFuZCB0aGUgZmlyc3QgY2hpbGQgaXMgbm90IGFuXG4gIC8vIEFTVCwgb3RoZXJ3aXNlIGxlYXZlIGl0IHRvIHRoZSBjaGlsZCBBU1QgdG8gaGFuZGxlIGl0LCBhbmQgdGhlcmUsXG4gIC8vIHVzZSB0aGUgKD86XnwvKSBzdHlsZSBvZiBzdGFydCBiaW5kaW5nLlxuICAvL1xuICAvLyBFdmVuIHNpbXBsaWZpZWQgZnVydGhlcjpcbiAgLy8gLSBTaW5jZSB0aGUgc3RhcnQgZm9yIGEgam9pbiBpcyBlZyAvKD8hXFwuKSBhbmQgdGhlIHN0YXJ0IGZvciBhIHBhcnRcbiAgLy8gaXMgXig/IVxcLiksIHdlIGNhbiBqdXN0IHByZXBlbmQgKD8hXFwuKSB0byB0aGUgcGF0dGVybiAoZWl0aGVyIHJvb3RcbiAgLy8gb3Igc3RhcnQgb3Igd2hhdGV2ZXIpIGFuZCBwcmVwZW5kIF4gb3IgLyBhdCB0aGUgUmVnZXhwIGNvbnN0cnVjdGlvbi5cbiAgdG9SZWdFeHBTb3VyY2UoXG4gICAgYWxsb3dEb3Q/OiBib29sZWFuLFxuICApOiBbcmU6IHN0cmluZywgYm9keTogc3RyaW5nLCBoYXNNYWdpYzogYm9vbGVhbiwgdWZsYWc6IGJvb2xlYW5dIHtcbiAgICBjb25zdCBkb3QgPSBhbGxvd0RvdCA/PyAhIXRoaXMuI29wdGlvbnMuZG90XG4gICAgaWYgKHRoaXMuI3Jvb3QgPT09IHRoaXMpIHRoaXMuI2ZpbGxOZWdzKClcbiAgICBpZiAoIXRoaXMudHlwZSkge1xuICAgICAgY29uc3Qgbm9FbXB0eSA9XG4gICAgICAgIHRoaXMuaXNTdGFydCgpICYmXG4gICAgICAgIHRoaXMuaXNFbmQoKSAmJlxuICAgICAgICAhdGhpcy4jcGFydHMuc29tZShzID0+IHR5cGVvZiBzICE9PSAnc3RyaW5nJylcbiAgICAgIGNvbnN0IHNyYyA9IHRoaXMuI3BhcnRzXG4gICAgICAgIC5tYXAocCA9PiB7XG4gICAgICAgICAgY29uc3QgW3JlLCBfLCBoYXNNYWdpYywgdWZsYWddID1cbiAgICAgICAgICAgIHR5cGVvZiBwID09PSAnc3RyaW5nJ1xuICAgICAgICAgICAgICA/IEFTVC4jcGFyc2VHbG9iKHAsIHRoaXMuI2hhc01hZ2ljLCBub0VtcHR5KVxuICAgICAgICAgICAgICA6IHAudG9SZWdFeHBTb3VyY2UoYWxsb3dEb3QpXG4gICAgICAgICAgdGhpcy4jaGFzTWFnaWMgPSB0aGlzLiNoYXNNYWdpYyB8fCBoYXNNYWdpY1xuICAgICAgICAgIHRoaXMuI3VmbGFnID0gdGhpcy4jdWZsYWcgfHwgdWZsYWdcbiAgICAgICAgICByZXR1cm4gcmVcbiAgICAgICAgfSlcbiAgICAgICAgLmpvaW4oJycpXG5cbiAgICAgIGxldCBzdGFydCA9ICcnXG4gICAgICBpZiAodGhpcy5pc1N0YXJ0KCkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLiNwYXJ0c1swXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAvLyB0aGlzIGlzIHRoZSBzdHJpbmcgdGhhdCB3aWxsIG1hdGNoIHRoZSBzdGFydCBvZiB0aGUgcGF0dGVybixcbiAgICAgICAgICAvLyBzbyB3ZSBuZWVkIHRvIHByb3RlY3QgYWdhaW5zdCBkb3RzIGFuZCBzdWNoLlxuXG4gICAgICAgICAgLy8gJy4nIGFuZCAnLi4nIGNhbm5vdCBtYXRjaCB1bmxlc3MgdGhlIHBhdHRlcm4gaXMgdGhhdCBleGFjdGx5LFxuICAgICAgICAgIC8vIGV2ZW4gaWYgaXQgc3RhcnRzIHdpdGggLiBvciBkb3Q6dHJ1ZSBpcyBzZXQuXG4gICAgICAgICAgY29uc3QgZG90VHJhdkFsbG93ZWQgPVxuICAgICAgICAgICAgdGhpcy4jcGFydHMubGVuZ3RoID09PSAxICYmIGp1c3REb3RzLmhhcyh0aGlzLiNwYXJ0c1swXSlcbiAgICAgICAgICBpZiAoIWRvdFRyYXZBbGxvd2VkKSB7XG4gICAgICAgICAgICBjb25zdCBhcHMgPSBhZGRQYXR0ZXJuU3RhcnRcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgYSBwb3NzaWJpbGl0eSBvZiBtYXRjaGluZyAuIG9yIC4uLFxuICAgICAgICAgICAgLy8gYW5kIHByZXZlbnQgdGhhdC5cbiAgICAgICAgICAgIGNvbnN0IG5lZWROb1RyYXYgPVxuICAgICAgICAgICAgICAvLyBkb3RzIGFyZSBhbGxvd2VkLCBhbmQgdGhlIHBhdHRlcm4gc3RhcnRzIHdpdGggWyBvciAuXG4gICAgICAgICAgICAgIChkb3QgJiYgYXBzLmhhcyhzcmMuY2hhckF0KDApKSkgfHxcbiAgICAgICAgICAgICAgLy8gdGhlIHBhdHRlcm4gc3RhcnRzIHdpdGggXFwuLCBhbmQgdGhlbiBbIG9yIC5cbiAgICAgICAgICAgICAgKHNyYy5zdGFydHNXaXRoKCdcXFxcLicpICYmIGFwcy5oYXMoc3JjLmNoYXJBdCgyKSkpIHx8XG4gICAgICAgICAgICAgIC8vIHRoZSBwYXR0ZXJuIHN0YXJ0cyB3aXRoIFxcLlxcLiwgYW5kIHRoZW4gWyBvciAuXG4gICAgICAgICAgICAgIChzcmMuc3RhcnRzV2l0aCgnXFxcXC5cXFxcLicpICYmIGFwcy5oYXMoc3JjLmNoYXJBdCg0KSkpXG4gICAgICAgICAgICAvLyBubyBuZWVkIHRvIHByZXZlbnQgZG90cyBpZiBpdCBjYW4ndCBtYXRjaCBhIGRvdCwgb3IgaWYgYVxuICAgICAgICAgICAgLy8gc3ViLXBhdHRlcm4gd2lsbCBiZSBwcmV2ZW50aW5nIGl0IGFueXdheS5cbiAgICAgICAgICAgIGNvbnN0IG5lZWROb0RvdCA9ICFkb3QgJiYgIWFsbG93RG90ICYmIGFwcy5oYXMoc3JjLmNoYXJBdCgwKSlcblxuICAgICAgICAgICAgc3RhcnQgPSBuZWVkTm9UcmF2ID8gc3RhcnROb1RyYXZlcnNhbCA6IG5lZWROb0RvdCA/IHN0YXJ0Tm9Eb3QgOiAnJ1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBhcHBlbmQgdGhlIFwiZW5kIG9mIHBhdGggcG9ydGlvblwiIHBhdHRlcm4gdG8gbmVnYXRpb24gdGFpbHNcbiAgICAgIGxldCBlbmQgPSAnJ1xuICAgICAgaWYgKFxuICAgICAgICB0aGlzLmlzRW5kKCkgJiZcbiAgICAgICAgdGhpcy4jcm9vdC4jZmlsbGVkTmVncyAmJlxuICAgICAgICB0aGlzLiNwYXJlbnQ/LnR5cGUgPT09ICchJ1xuICAgICAgKSB7XG4gICAgICAgIGVuZCA9ICcoPzokfFxcXFwvKSdcbiAgICAgIH1cbiAgICAgIGNvbnN0IGZpbmFsID0gc3RhcnQgKyBzcmMgKyBlbmRcbiAgICAgIHJldHVybiBbXG4gICAgICAgIGZpbmFsLFxuICAgICAgICB1bmVzY2FwZShzcmMpLFxuICAgICAgICAodGhpcy4jaGFzTWFnaWMgPSAhIXRoaXMuI2hhc01hZ2ljKSxcbiAgICAgICAgdGhpcy4jdWZsYWcsXG4gICAgICBdXG4gICAgfVxuXG4gICAgLy8gV2UgbmVlZCB0byBjYWxjdWxhdGUgdGhlIGJvZHkgKnR3aWNlKiBpZiBpdCdzIGEgcmVwZWF0IHBhdHRlcm5cbiAgICAvLyBhdCB0aGUgc3RhcnQsIG9uY2UgaW4gbm9kb3QgbW9kZSwgdGhlbiBhZ2FpbiBpbiBkb3QgbW9kZSwgc28gYVxuICAgIC8vIHBhdHRlcm4gbGlrZSAqKD8pIGNhbiBtYXRjaCAneC55J1xuXG4gICAgY29uc3QgcmVwZWF0ZWQgPSB0aGlzLnR5cGUgPT09ICcqJyB8fCB0aGlzLnR5cGUgPT09ICcrJ1xuICAgIC8vIHNvbWUga2luZCBvZiBleHRnbG9iXG4gICAgY29uc3Qgc3RhcnQgPSB0aGlzLnR5cGUgPT09ICchJyA/ICcoPzooPyEoPzonIDogJyg/OidcbiAgICBsZXQgYm9keSA9IHRoaXMuI3BhcnRzVG9SZWdFeHAoZG90KVxuXG4gICAgaWYgKHRoaXMuaXNTdGFydCgpICYmIHRoaXMuaXNFbmQoKSAmJiAhYm9keSAmJiB0aGlzLnR5cGUgIT09ICchJykge1xuICAgICAgLy8gaW52YWxpZCBleHRnbG9iLCBoYXMgdG8gYXQgbGVhc3QgYmUgKnNvbWV0aGluZyogcHJlc2VudCwgaWYgaXQnc1xuICAgICAgLy8gdGhlIGVudGlyZSBwYXRoIHBvcnRpb24uXG4gICAgICBjb25zdCBzID0gdGhpcy50b1N0cmluZygpXG4gICAgICB0aGlzLiNwYXJ0cyA9IFtzXVxuICAgICAgdGhpcy50eXBlID0gbnVsbFxuICAgICAgdGhpcy4jaGFzTWFnaWMgPSB1bmRlZmluZWRcbiAgICAgIHJldHVybiBbcywgdW5lc2NhcGUodGhpcy50b1N0cmluZygpKSwgZmFsc2UsIGZhbHNlXVxuICAgIH1cblxuICAgIC8vIFhYWCBhYnN0cmFjdCBvdXQgdGhpcyBtYXAgbWV0aG9kXG4gICAgbGV0IGJvZHlEb3RBbGxvd2VkID1cbiAgICAgICFyZXBlYXRlZCB8fCBhbGxvd0RvdCB8fCBkb3QgfHwgIXN0YXJ0Tm9Eb3RcbiAgICAgICAgPyAnJ1xuICAgICAgICA6IHRoaXMuI3BhcnRzVG9SZWdFeHAodHJ1ZSlcbiAgICBpZiAoYm9keURvdEFsbG93ZWQgPT09IGJvZHkpIHtcbiAgICAgIGJvZHlEb3RBbGxvd2VkID0gJydcbiAgICB9XG4gICAgaWYgKGJvZHlEb3RBbGxvd2VkKSB7XG4gICAgICBib2R5ID0gYCg/OiR7Ym9keX0pKD86JHtib2R5RG90QWxsb3dlZH0pKj9gXG4gICAgfVxuXG4gICAgLy8gYW4gZW1wdHkgISgpIGlzIGV4YWN0bHkgZXF1aXZhbGVudCB0byBhIHN0YXJOb0VtcHR5XG4gICAgbGV0IGZpbmFsID0gJydcbiAgICBpZiAodGhpcy50eXBlID09PSAnIScgJiYgdGhpcy4jZW1wdHlFeHQpIHtcbiAgICAgIGZpbmFsID0gKHRoaXMuaXNTdGFydCgpICYmICFkb3QgPyBzdGFydE5vRG90IDogJycpICsgc3Rhck5vRW1wdHlcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY2xvc2UgPVxuICAgICAgICB0aGlzLnR5cGUgPT09ICchJ1xuICAgICAgICAgID8gLy8gISgpIG11c3QgbWF0Y2ggc29tZXRoaW5nLGJ1dCAhKHgpIGNhbiBtYXRjaCAnJ1xuICAgICAgICAgICAgJykpJyArXG4gICAgICAgICAgICAodGhpcy5pc1N0YXJ0KCkgJiYgIWRvdCAmJiAhYWxsb3dEb3QgPyBzdGFydE5vRG90IDogJycpICtcbiAgICAgICAgICAgIHN0YXIgK1xuICAgICAgICAgICAgJyknXG4gICAgICAgICAgOiB0aGlzLnR5cGUgPT09ICdAJ1xuICAgICAgICAgICAgPyAnKSdcbiAgICAgICAgICAgIDogdGhpcy50eXBlID09PSAnPydcbiAgICAgICAgICAgICAgPyAnKT8nXG4gICAgICAgICAgICAgIDogdGhpcy50eXBlID09PSAnKycgJiYgYm9keURvdEFsbG93ZWRcbiAgICAgICAgICAgICAgICA/ICcpJ1xuICAgICAgICAgICAgICAgIDogdGhpcy50eXBlID09PSAnKicgJiYgYm9keURvdEFsbG93ZWRcbiAgICAgICAgICAgICAgICAgID8gYCk/YFxuICAgICAgICAgICAgICAgICAgOiBgKSR7dGhpcy50eXBlfWBcbiAgICAgIGZpbmFsID0gc3RhcnQgKyBib2R5ICsgY2xvc2VcbiAgICB9XG4gICAgcmV0dXJuIFtcbiAgICAgIGZpbmFsLFxuICAgICAgdW5lc2NhcGUoYm9keSksXG4gICAgICAodGhpcy4jaGFzTWFnaWMgPSAhIXRoaXMuI2hhc01hZ2ljKSxcbiAgICAgIHRoaXMuI3VmbGFnLFxuICAgIF1cbiAgfVxuXG4gICNwYXJ0c1RvUmVnRXhwKGRvdDogYm9vbGVhbikge1xuICAgIHJldHVybiB0aGlzLiNwYXJ0c1xuICAgICAgLm1hcChwID0+IHtcbiAgICAgICAgLy8gZXh0Z2xvYiBBU1RzIHNob3VsZCBvbmx5IGNvbnRhaW4gcGFyZW50IEFTVHNcbiAgICAgICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgICAgIGlmICh0eXBlb2YgcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3N0cmluZyB0eXBlIGluIGV4dGdsb2IgYXN0Pz8nKVxuICAgICAgICB9XG4gICAgICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgICAgIC8vIGNhbiBpZ25vcmUgaGFzTWFnaWMsIGJlY2F1c2UgZXh0Z2xvYnMgYXJlIGFscmVhZHkgYWx3YXlzIG1hZ2ljXG4gICAgICAgIGNvbnN0IFtyZSwgXywgX2hhc01hZ2ljLCB1ZmxhZ10gPSBwLnRvUmVnRXhwU291cmNlKGRvdClcbiAgICAgICAgdGhpcy4jdWZsYWcgPSB0aGlzLiN1ZmxhZyB8fCB1ZmxhZ1xuICAgICAgICByZXR1cm4gcmVcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKHAgPT4gISh0aGlzLmlzU3RhcnQoKSAmJiB0aGlzLmlzRW5kKCkpIHx8ICEhcClcbiAgICAgIC5qb2luKCd8JylcbiAgfVxuXG4gIHN0YXRpYyAjcGFyc2VHbG9iKFxuICAgIGdsb2I6IHN0cmluZyxcbiAgICBoYXNNYWdpYzogYm9vbGVhbiB8IHVuZGVmaW5lZCxcbiAgICBub0VtcHR5OiBib29sZWFuID0gZmFsc2UsXG4gICk6IFtyZTogc3RyaW5nLCBib2R5OiBzdHJpbmcsIGhhc01hZ2ljOiBib29sZWFuLCB1ZmxhZzogYm9vbGVhbl0ge1xuICAgIGxldCBlc2NhcGluZyA9IGZhbHNlXG4gICAgbGV0IHJlID0gJydcbiAgICBsZXQgdWZsYWcgPSBmYWxzZVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2xvYi5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgYyA9IGdsb2IuY2hhckF0KGkpXG4gICAgICBpZiAoZXNjYXBpbmcpIHtcbiAgICAgICAgZXNjYXBpbmcgPSBmYWxzZVxuICAgICAgICByZSArPSAocmVTcGVjaWFscy5oYXMoYykgPyAnXFxcXCcgOiAnJykgKyBjXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBpZiAoYyA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGlmIChpID09PSBnbG9iLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICByZSArPSAnXFxcXFxcXFwnXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZXNjYXBpbmcgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cbiAgICAgIGlmIChjID09PSAnWycpIHtcbiAgICAgICAgY29uc3QgW3NyYywgbmVlZFVmbGFnLCBjb25zdW1lZCwgbWFnaWNdID0gcGFyc2VDbGFzcyhnbG9iLCBpKVxuICAgICAgICBpZiAoY29uc3VtZWQpIHtcbiAgICAgICAgICByZSArPSBzcmNcbiAgICAgICAgICB1ZmxhZyA9IHVmbGFnIHx8IG5lZWRVZmxhZ1xuICAgICAgICAgIGkgKz0gY29uc3VtZWQgLSAxXG4gICAgICAgICAgaGFzTWFnaWMgPSBoYXNNYWdpYyB8fCBtYWdpY1xuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChjID09PSAnKicpIHtcbiAgICAgICAgcmUgKz0gbm9FbXB0eSAmJiBnbG9iID09PSAnKicgPyBzdGFyTm9FbXB0eSA6IHN0YXJcbiAgICAgICAgaGFzTWFnaWMgPSB0cnVlXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBpZiAoYyA9PT0gJz8nKSB7XG4gICAgICAgIHJlICs9IHFtYXJrXG4gICAgICAgIGhhc01hZ2ljID0gdHJ1ZVxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgcmUgKz0gcmVnRXhwRXNjYXBlKGMpXG4gICAgfVxuICAgIHJldHVybiBbcmUsIHVuZXNjYXBlKGdsb2IpLCAhIWhhc01hZ2ljLCB1ZmxhZ11cbiAgfVxufVxuIiwgImltcG9ydCB7IE1pbmltYXRjaE9wdGlvbnMgfSBmcm9tICcuL2luZGV4LmpzJ1xuXG4vKipcbiAqIEVzY2FwZSBhbGwgbWFnaWMgY2hhcmFjdGVycyBpbiBhIGdsb2IgcGF0dGVybi5cbiAqXG4gKiBJZiB0aGUge0BsaW5rIE1pbmltYXRjaE9wdGlvbnMud2luZG93c1BhdGhzTm9Fc2NhcGV9XG4gKiBvcHRpb24gaXMgdXNlZCwgdGhlbiBjaGFyYWN0ZXJzIGFyZSBlc2NhcGVkIGJ5IHdyYXBwaW5nIGluIGBbXWAsIGJlY2F1c2VcbiAqIGEgbWFnaWMgY2hhcmFjdGVyIHdyYXBwZWQgaW4gYSBjaGFyYWN0ZXIgY2xhc3MgY2FuIG9ubHkgYmUgc2F0aXNmaWVkIGJ5XG4gKiB0aGF0IGV4YWN0IGNoYXJhY3Rlci4gIEluIHRoaXMgbW9kZSwgYFxcYCBpcyBfbm90XyBlc2NhcGVkLCBiZWNhdXNlIGl0IGlzXG4gKiBub3QgaW50ZXJwcmV0ZWQgYXMgYSBtYWdpYyBjaGFyYWN0ZXIsIGJ1dCBpbnN0ZWFkIGFzIGEgcGF0aCBzZXBhcmF0b3IuXG4gKlxuICogSWYgdGhlIHtAbGluayBNaW5pbWF0Y2hPcHRpb25zLm1hZ2ljYWxCcmFjZXN9IG9wdGlvbiBpcyB1c2VkLFxuICogdGhlbiBicmFjZXMgKGB7YCBhbmQgYH1gKSB3aWxsIGJlIGVzY2FwZWQuXG4gKi9cbmV4cG9ydCBjb25zdCBlc2NhcGUgPSAoXG4gIHM6IHN0cmluZyxcbiAge1xuICAgIHdpbmRvd3NQYXRoc05vRXNjYXBlID0gZmFsc2UsXG4gICAgbWFnaWNhbEJyYWNlcyA9IGZhbHNlLFxuICB9OiBQaWNrPE1pbmltYXRjaE9wdGlvbnMsICd3aW5kb3dzUGF0aHNOb0VzY2FwZScgfCAnbWFnaWNhbEJyYWNlcyc+ID0ge30sXG4pID0+IHtcbiAgLy8gZG9uJ3QgbmVlZCB0byBlc2NhcGUgK0AhIGJlY2F1c2Ugd2UgZXNjYXBlIHRoZSBwYXJlbnNcbiAgLy8gdGhhdCBtYWtlIHRob3NlIG1hZ2ljLCBhbmQgZXNjYXBpbmcgISBhcyBbIV0gaXNuJ3QgdmFsaWQsXG4gIC8vIGJlY2F1c2UgWyFdXSBpcyBhIHZhbGlkIGdsb2IgY2xhc3MgbWVhbmluZyBub3QgJ10nLlxuICBpZiAobWFnaWNhbEJyYWNlcykge1xuICAgIHJldHVybiB3aW5kb3dzUGF0aHNOb0VzY2FwZVxuICAgICAgPyBzLnJlcGxhY2UoL1s/KigpW1xcXXt9XS9nLCAnWyQmXScpXG4gICAgICA6IHMucmVwbGFjZSgvWz8qKClbXFxdXFxcXHt9XS9nLCAnXFxcXCQmJylcbiAgfVxuICByZXR1cm4gd2luZG93c1BhdGhzTm9Fc2NhcGVcbiAgICA/IHMucmVwbGFjZSgvWz8qKClbXFxdXS9nLCAnWyQmXScpXG4gICAgOiBzLnJlcGxhY2UoL1s/KigpW1xcXVxcXFxdL2csICdcXFxcJCYnKVxufVxuIiwgImltcG9ydCB7IGV4cGFuZCB9IGZyb20gJ0Bpc2FhY3MvYnJhY2UtZXhwYW5zaW9uJ1xuaW1wb3J0IHsgYXNzZXJ0VmFsaWRQYXR0ZXJuIH0gZnJvbSAnLi9hc3NlcnQtdmFsaWQtcGF0dGVybi5qcydcbmltcG9ydCB7IEFTVCwgRXh0Z2xvYlR5cGUgfSBmcm9tICcuL2FzdC5qcydcbmltcG9ydCB7IGVzY2FwZSB9IGZyb20gJy4vZXNjYXBlLmpzJ1xuaW1wb3J0IHsgdW5lc2NhcGUgfSBmcm9tICcuL3VuZXNjYXBlLmpzJ1xuXG5leHBvcnQgdHlwZSBQbGF0Zm9ybSA9XG4gIHwgJ2FpeCdcbiAgfCAnYW5kcm9pZCdcbiAgfCAnZGFyd2luJ1xuICB8ICdmcmVlYnNkJ1xuICB8ICdoYWlrdSdcbiAgfCAnbGludXgnXG4gIHwgJ29wZW5ic2QnXG4gIHwgJ3N1bm9zJ1xuICB8ICd3aW4zMidcbiAgfCAnY3lnd2luJ1xuICB8ICduZXRic2QnXG5cbmV4cG9ydCBpbnRlcmZhY2UgTWluaW1hdGNoT3B0aW9ucyB7XG4gIG5vYnJhY2U/OiBib29sZWFuXG4gIG5vY29tbWVudD86IGJvb2xlYW5cbiAgbm9uZWdhdGU/OiBib29sZWFuXG4gIGRlYnVnPzogYm9vbGVhblxuICBub2dsb2JzdGFyPzogYm9vbGVhblxuICBub2V4dD86IGJvb2xlYW5cbiAgbm9udWxsPzogYm9vbGVhblxuICB3aW5kb3dzUGF0aHNOb0VzY2FwZT86IGJvb2xlYW5cbiAgYWxsb3dXaW5kb3dzRXNjYXBlPzogYm9vbGVhblxuICBwYXJ0aWFsPzogYm9vbGVhblxuICBkb3Q/OiBib29sZWFuXG4gIG5vY2FzZT86IGJvb2xlYW5cbiAgbm9jYXNlTWFnaWNPbmx5PzogYm9vbGVhblxuICBtYWdpY2FsQnJhY2VzPzogYm9vbGVhblxuICBtYXRjaEJhc2U/OiBib29sZWFuXG4gIGZsaXBOZWdhdGU/OiBib29sZWFuXG4gIHByZXNlcnZlTXVsdGlwbGVTbGFzaGVzPzogYm9vbGVhblxuICBvcHRpbWl6YXRpb25MZXZlbD86IG51bWJlclxuICBwbGF0Zm9ybT86IFBsYXRmb3JtXG4gIHdpbmRvd3NOb01hZ2ljUm9vdD86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGNvbnN0IG1pbmltYXRjaCA9IChcbiAgcDogc3RyaW5nLFxuICBwYXR0ZXJuOiBzdHJpbmcsXG4gIG9wdGlvbnM6IE1pbmltYXRjaE9wdGlvbnMgPSB7fSxcbikgPT4ge1xuICBhc3NlcnRWYWxpZFBhdHRlcm4ocGF0dGVybilcblxuICAvLyBzaG9ydGN1dDogY29tbWVudHMgbWF0Y2ggbm90aGluZy5cbiAgaWYgKCFvcHRpb25zLm5vY29tbWVudCAmJiBwYXR0ZXJuLmNoYXJBdCgwKSA9PT0gJyMnKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICByZXR1cm4gbmV3IE1pbmltYXRjaChwYXR0ZXJuLCBvcHRpb25zKS5tYXRjaChwKVxufVxuXG4vLyBPcHRpbWl6ZWQgY2hlY2tpbmcgZm9yIHRoZSBtb3N0IGNvbW1vbiBnbG9iIHBhdHRlcm5zLlxuY29uc3Qgc3RhckRvdEV4dFJFID0gL15cXCorKFteK0AhP1xcKlxcW1xcKF0qKSQvXG5jb25zdCBzdGFyRG90RXh0VGVzdCA9IChleHQ6IHN0cmluZykgPT4gKGY6IHN0cmluZykgPT5cbiAgIWYuc3RhcnRzV2l0aCgnLicpICYmIGYuZW5kc1dpdGgoZXh0KVxuY29uc3Qgc3RhckRvdEV4dFRlc3REb3QgPSAoZXh0OiBzdHJpbmcpID0+IChmOiBzdHJpbmcpID0+IGYuZW5kc1dpdGgoZXh0KVxuY29uc3Qgc3RhckRvdEV4dFRlc3ROb2Nhc2UgPSAoZXh0OiBzdHJpbmcpID0+IHtcbiAgZXh0ID0gZXh0LnRvTG93ZXJDYXNlKClcbiAgcmV0dXJuIChmOiBzdHJpbmcpID0+ICFmLnN0YXJ0c1dpdGgoJy4nKSAmJiBmLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoZXh0KVxufVxuY29uc3Qgc3RhckRvdEV4dFRlc3ROb2Nhc2VEb3QgPSAoZXh0OiBzdHJpbmcpID0+IHtcbiAgZXh0ID0gZXh0LnRvTG93ZXJDYXNlKClcbiAgcmV0dXJuIChmOiBzdHJpbmcpID0+IGYudG9Mb3dlckNhc2UoKS5lbmRzV2l0aChleHQpXG59XG5jb25zdCBzdGFyRG90U3RhclJFID0gL15cXCorXFwuXFwqKyQvXG5jb25zdCBzdGFyRG90U3RhclRlc3QgPSAoZjogc3RyaW5nKSA9PiAhZi5zdGFydHNXaXRoKCcuJykgJiYgZi5pbmNsdWRlcygnLicpXG5jb25zdCBzdGFyRG90U3RhclRlc3REb3QgPSAoZjogc3RyaW5nKSA9PlxuICBmICE9PSAnLicgJiYgZiAhPT0gJy4uJyAmJiBmLmluY2x1ZGVzKCcuJylcbmNvbnN0IGRvdFN0YXJSRSA9IC9eXFwuXFwqKyQvXG5jb25zdCBkb3RTdGFyVGVzdCA9IChmOiBzdHJpbmcpID0+IGYgIT09ICcuJyAmJiBmICE9PSAnLi4nICYmIGYuc3RhcnRzV2l0aCgnLicpXG5jb25zdCBzdGFyUkUgPSAvXlxcKiskL1xuY29uc3Qgc3RhclRlc3QgPSAoZjogc3RyaW5nKSA9PiBmLmxlbmd0aCAhPT0gMCAmJiAhZi5zdGFydHNXaXRoKCcuJylcbmNvbnN0IHN0YXJUZXN0RG90ID0gKGY6IHN0cmluZykgPT4gZi5sZW5ndGggIT09IDAgJiYgZiAhPT0gJy4nICYmIGYgIT09ICcuLidcbmNvbnN0IHFtYXJrc1JFID0gL15cXD8rKFteK0AhP1xcKlxcW1xcKF0qKT8kL1xuY29uc3QgcW1hcmtzVGVzdE5vY2FzZSA9IChbJDAsIGV4dCA9ICcnXTogUmVnRXhwTWF0Y2hBcnJheSkgPT4ge1xuICBjb25zdCBub2V4dCA9IHFtYXJrc1Rlc3ROb0V4dChbJDBdKVxuICBpZiAoIWV4dCkgcmV0dXJuIG5vZXh0XG4gIGV4dCA9IGV4dC50b0xvd2VyQ2FzZSgpXG4gIHJldHVybiAoZjogc3RyaW5nKSA9PiBub2V4dChmKSAmJiBmLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoZXh0KVxufVxuY29uc3QgcW1hcmtzVGVzdE5vY2FzZURvdCA9IChbJDAsIGV4dCA9ICcnXTogUmVnRXhwTWF0Y2hBcnJheSkgPT4ge1xuICBjb25zdCBub2V4dCA9IHFtYXJrc1Rlc3ROb0V4dERvdChbJDBdKVxuICBpZiAoIWV4dCkgcmV0dXJuIG5vZXh0XG4gIGV4dCA9IGV4dC50b0xvd2VyQ2FzZSgpXG4gIHJldHVybiAoZjogc3RyaW5nKSA9PiBub2V4dChmKSAmJiBmLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoZXh0KVxufVxuY29uc3QgcW1hcmtzVGVzdERvdCA9IChbJDAsIGV4dCA9ICcnXTogUmVnRXhwTWF0Y2hBcnJheSkgPT4ge1xuICBjb25zdCBub2V4dCA9IHFtYXJrc1Rlc3ROb0V4dERvdChbJDBdKVxuICByZXR1cm4gIWV4dCA/IG5vZXh0IDogKGY6IHN0cmluZykgPT4gbm9leHQoZikgJiYgZi5lbmRzV2l0aChleHQpXG59XG5jb25zdCBxbWFya3NUZXN0ID0gKFskMCwgZXh0ID0gJyddOiBSZWdFeHBNYXRjaEFycmF5KSA9PiB7XG4gIGNvbnN0IG5vZXh0ID0gcW1hcmtzVGVzdE5vRXh0KFskMF0pXG4gIHJldHVybiAhZXh0ID8gbm9leHQgOiAoZjogc3RyaW5nKSA9PiBub2V4dChmKSAmJiBmLmVuZHNXaXRoKGV4dClcbn1cbmNvbnN0IHFtYXJrc1Rlc3ROb0V4dCA9IChbJDBdOiBSZWdFeHBNYXRjaEFycmF5KSA9PiB7XG4gIGNvbnN0IGxlbiA9ICQwLmxlbmd0aFxuICByZXR1cm4gKGY6IHN0cmluZykgPT4gZi5sZW5ndGggPT09IGxlbiAmJiAhZi5zdGFydHNXaXRoKCcuJylcbn1cbmNvbnN0IHFtYXJrc1Rlc3ROb0V4dERvdCA9IChbJDBdOiBSZWdFeHBNYXRjaEFycmF5KSA9PiB7XG4gIGNvbnN0IGxlbiA9ICQwLmxlbmd0aFxuICByZXR1cm4gKGY6IHN0cmluZykgPT4gZi5sZW5ndGggPT09IGxlbiAmJiBmICE9PSAnLicgJiYgZiAhPT0gJy4uJ1xufVxuXG4vKiBjOCBpZ25vcmUgc3RhcnQgKi9cbmNvbnN0IGRlZmF1bHRQbGF0Zm9ybTogUGxhdGZvcm0gPSAoXG4gIHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJiBwcm9jZXNzXG4gICAgPyAodHlwZW9mIHByb2Nlc3MuZW52ID09PSAnb2JqZWN0JyAmJlxuICAgICAgICBwcm9jZXNzLmVudiAmJlxuICAgICAgICBwcm9jZXNzLmVudi5fX01JTklNQVRDSF9URVNUSU5HX1BMQVRGT1JNX18pIHx8XG4gICAgICBwcm9jZXNzLnBsYXRmb3JtXG4gICAgOiAncG9zaXgnXG4pIGFzIFBsYXRmb3JtXG5cbmV4cG9ydCB0eXBlIFNlcCA9ICdcXFxcJyB8ICcvJ1xuXG5jb25zdCBwYXRoOiB7IFtrOiBzdHJpbmddOiB7IHNlcDogU2VwIH0gfSA9IHtcbiAgd2luMzI6IHsgc2VwOiAnXFxcXCcgfSxcbiAgcG9zaXg6IHsgc2VwOiAnLycgfSxcbn1cbi8qIGM4IGlnbm9yZSBzdG9wICovXG5cbmV4cG9ydCBjb25zdCBzZXAgPSBkZWZhdWx0UGxhdGZvcm0gPT09ICd3aW4zMicgPyBwYXRoLndpbjMyLnNlcCA6IHBhdGgucG9zaXguc2VwXG5taW5pbWF0Y2guc2VwID0gc2VwXG5cbmV4cG9ydCBjb25zdCBHTE9CU1RBUiA9IFN5bWJvbCgnZ2xvYnN0YXIgKionKVxubWluaW1hdGNoLkdMT0JTVEFSID0gR0xPQlNUQVJcblxuLy8gYW55IHNpbmdsZSB0aGluZyBvdGhlciB0aGFuIC9cbi8vIGRvbid0IG5lZWQgdG8gZXNjYXBlIC8gd2hlbiB1c2luZyBuZXcgUmVnRXhwKClcbmNvbnN0IHFtYXJrID0gJ1teL10nXG5cbi8vICogPT4gYW55IG51bWJlciBvZiBjaGFyYWN0ZXJzXG5jb25zdCBzdGFyID0gcW1hcmsgKyAnKj8nXG5cbi8vICoqIHdoZW4gZG90cyBhcmUgYWxsb3dlZC4gIEFueXRoaW5nIGdvZXMsIGV4Y2VwdCAuLiBhbmQgLlxuLy8gbm90ICheIG9yIC8gZm9sbG93ZWQgYnkgb25lIG9yIHR3byBkb3RzIGZvbGxvd2VkIGJ5ICQgb3IgLyksXG4vLyBmb2xsb3dlZCBieSBhbnl0aGluZywgYW55IG51bWJlciBvZiB0aW1lcy5cbmNvbnN0IHR3b1N0YXJEb3QgPSAnKD86KD8hKD86XFxcXC98XikoPzpcXFxcLnsxLDJ9KSgkfFxcXFwvKSkuKSo/J1xuXG4vLyBub3QgYSBeIG9yIC8gZm9sbG93ZWQgYnkgYSBkb3QsXG4vLyBmb2xsb3dlZCBieSBhbnl0aGluZywgYW55IG51bWJlciBvZiB0aW1lcy5cbmNvbnN0IHR3b1N0YXJOb0RvdCA9ICcoPzooPyEoPzpcXFxcL3xeKVxcXFwuKS4pKj8nXG5cbmV4cG9ydCBjb25zdCBmaWx0ZXIgPVxuICAocGF0dGVybjogc3RyaW5nLCBvcHRpb25zOiBNaW5pbWF0Y2hPcHRpb25zID0ge30pID0+XG4gIChwOiBzdHJpbmcpID0+XG4gICAgbWluaW1hdGNoKHAsIHBhdHRlcm4sIG9wdGlvbnMpXG5taW5pbWF0Y2guZmlsdGVyID0gZmlsdGVyXG5cbmNvbnN0IGV4dCA9IChhOiBNaW5pbWF0Y2hPcHRpb25zLCBiOiBNaW5pbWF0Y2hPcHRpb25zID0ge30pID0+XG4gIE9iamVjdC5hc3NpZ24oe30sIGEsIGIpXG5cbmV4cG9ydCBjb25zdCBkZWZhdWx0cyA9IChkZWY6IE1pbmltYXRjaE9wdGlvbnMpOiB0eXBlb2YgbWluaW1hdGNoID0+IHtcbiAgaWYgKCFkZWYgfHwgdHlwZW9mIGRlZiAhPT0gJ29iamVjdCcgfHwgIU9iamVjdC5rZXlzKGRlZikubGVuZ3RoKSB7XG4gICAgcmV0dXJuIG1pbmltYXRjaFxuICB9XG5cbiAgY29uc3Qgb3JpZyA9IG1pbmltYXRjaFxuXG4gIGNvbnN0IG0gPSAocDogc3RyaW5nLCBwYXR0ZXJuOiBzdHJpbmcsIG9wdGlvbnM6IE1pbmltYXRjaE9wdGlvbnMgPSB7fSkgPT5cbiAgICBvcmlnKHAsIHBhdHRlcm4sIGV4dChkZWYsIG9wdGlvbnMpKVxuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKG0sIHtcbiAgICBNaW5pbWF0Y2g6IGNsYXNzIE1pbmltYXRjaCBleHRlbmRzIG9yaWcuTWluaW1hdGNoIHtcbiAgICAgIGNvbnN0cnVjdG9yKHBhdHRlcm46IHN0cmluZywgb3B0aW9uczogTWluaW1hdGNoT3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIHN1cGVyKHBhdHRlcm4sIGV4dChkZWYsIG9wdGlvbnMpKVxuICAgICAgfVxuICAgICAgc3RhdGljIGRlZmF1bHRzKG9wdGlvbnM6IE1pbmltYXRjaE9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG9yaWcuZGVmYXVsdHMoZXh0KGRlZiwgb3B0aW9ucykpLk1pbmltYXRjaFxuICAgICAgfVxuICAgIH0sXG5cbiAgICBBU1Q6IGNsYXNzIEFTVCBleHRlbmRzIG9yaWcuQVNUIHtcbiAgICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgICAgY29uc3RydWN0b3IoXG4gICAgICAgIHR5cGU6IEV4dGdsb2JUeXBlIHwgbnVsbCxcbiAgICAgICAgcGFyZW50PzogQVNULFxuICAgICAgICBvcHRpb25zOiBNaW5pbWF0Y2hPcHRpb25zID0ge30sXG4gICAgICApIHtcbiAgICAgICAgc3VwZXIodHlwZSwgcGFyZW50LCBleHQoZGVmLCBvcHRpb25zKSlcbiAgICAgIH1cbiAgICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG5cbiAgICAgIHN0YXRpYyBmcm9tR2xvYihwYXR0ZXJuOiBzdHJpbmcsIG9wdGlvbnM6IE1pbmltYXRjaE9wdGlvbnMgPSB7fSkge1xuICAgICAgICByZXR1cm4gb3JpZy5BU1QuZnJvbUdsb2IocGF0dGVybiwgZXh0KGRlZiwgb3B0aW9ucykpXG4gICAgICB9XG4gICAgfSxcblxuICAgIHVuZXNjYXBlOiAoXG4gICAgICBzOiBzdHJpbmcsXG4gICAgICBvcHRpb25zOiBQaWNrPFxuICAgICAgICBNaW5pbWF0Y2hPcHRpb25zLFxuICAgICAgICAnd2luZG93c1BhdGhzTm9Fc2NhcGUnIHwgJ21hZ2ljYWxCcmFjZXMnXG4gICAgICA+ID0ge30sXG4gICAgKSA9PiBvcmlnLnVuZXNjYXBlKHMsIGV4dChkZWYsIG9wdGlvbnMpKSxcblxuICAgIGVzY2FwZTogKFxuICAgICAgczogc3RyaW5nLFxuICAgICAgb3B0aW9uczogUGljazxcbiAgICAgICAgTWluaW1hdGNoT3B0aW9ucyxcbiAgICAgICAgJ3dpbmRvd3NQYXRoc05vRXNjYXBlJyB8ICdtYWdpY2FsQnJhY2VzJ1xuICAgICAgPiA9IHt9LFxuICAgICkgPT4gb3JpZy5lc2NhcGUocywgZXh0KGRlZiwgb3B0aW9ucykpLFxuXG4gICAgZmlsdGVyOiAocGF0dGVybjogc3RyaW5nLCBvcHRpb25zOiBNaW5pbWF0Y2hPcHRpb25zID0ge30pID0+XG4gICAgICBvcmlnLmZpbHRlcihwYXR0ZXJuLCBleHQoZGVmLCBvcHRpb25zKSksXG5cbiAgICBkZWZhdWx0czogKG9wdGlvbnM6IE1pbmltYXRjaE9wdGlvbnMpID0+IG9yaWcuZGVmYXVsdHMoZXh0KGRlZiwgb3B0aW9ucykpLFxuXG4gICAgbWFrZVJlOiAocGF0dGVybjogc3RyaW5nLCBvcHRpb25zOiBNaW5pbWF0Y2hPcHRpb25zID0ge30pID0+XG4gICAgICBvcmlnLm1ha2VSZShwYXR0ZXJuLCBleHQoZGVmLCBvcHRpb25zKSksXG5cbiAgICBicmFjZUV4cGFuZDogKHBhdHRlcm46IHN0cmluZywgb3B0aW9uczogTWluaW1hdGNoT3B0aW9ucyA9IHt9KSA9PlxuICAgICAgb3JpZy5icmFjZUV4cGFuZChwYXR0ZXJuLCBleHQoZGVmLCBvcHRpb25zKSksXG5cbiAgICBtYXRjaDogKGxpc3Q6IHN0cmluZ1tdLCBwYXR0ZXJuOiBzdHJpbmcsIG9wdGlvbnM6IE1pbmltYXRjaE9wdGlvbnMgPSB7fSkgPT5cbiAgICAgIG9yaWcubWF0Y2gobGlzdCwgcGF0dGVybiwgZXh0KGRlZiwgb3B0aW9ucykpLFxuXG4gICAgc2VwOiBvcmlnLnNlcCxcbiAgICBHTE9CU1RBUjogR0xPQlNUQVIgYXMgdHlwZW9mIEdMT0JTVEFSLFxuICB9KVxufVxubWluaW1hdGNoLmRlZmF1bHRzID0gZGVmYXVsdHNcblxuLy8gQnJhY2UgZXhwYW5zaW9uOlxuLy8gYXtiLGN9ZCAtPiBhYmQgYWNkXG4vLyBhe2IsfWMgLT4gYWJjIGFjXG4vLyBhezAuLjN9ZCAtPiBhMGQgYTFkIGEyZCBhM2Rcbi8vIGF7Yixje2QsZX1mfWcgLT4gYWJnIGFjZGZnIGFjZWZnXG4vLyBhe2IsY31ke2UsZn1nIC0+IGFiZGVnIGFjZGVnIGFiZGVnIGFiZGZnXG4vL1xuLy8gSW52YWxpZCBzZXRzIGFyZSBub3QgZXhwYW5kZWQuXG4vLyBhezIuLn1iIC0+IGF7Mi4ufWJcbi8vIGF7Yn1jIC0+IGF7Yn1jXG5leHBvcnQgY29uc3QgYnJhY2VFeHBhbmQgPSAoXG4gIHBhdHRlcm46IHN0cmluZyxcbiAgb3B0aW9uczogTWluaW1hdGNoT3B0aW9ucyA9IHt9LFxuKSA9PiB7XG4gIGFzc2VydFZhbGlkUGF0dGVybihwYXR0ZXJuKVxuXG4gIC8vIFRoYW5rcyB0byBZZXRpbmcgTGkgPGh0dHBzOi8vZ2l0aHViLmNvbS95ZXRpbmdsaT4gZm9yXG4gIC8vIGltcHJvdmluZyB0aGlzIHJlZ2V4cCB0byBhdm9pZCBhIFJlRE9TIHZ1bG5lcmFiaWxpdHkuXG4gIGlmIChvcHRpb25zLm5vYnJhY2UgfHwgIS9cXHsoPzooPyFcXHspLikqXFx9Ly50ZXN0KHBhdHRlcm4pKSB7XG4gICAgLy8gc2hvcnRjdXQuIG5vIG5lZWQgdG8gZXhwYW5kLlxuICAgIHJldHVybiBbcGF0dGVybl1cbiAgfVxuXG4gIHJldHVybiBleHBhbmQocGF0dGVybilcbn1cbm1pbmltYXRjaC5icmFjZUV4cGFuZCA9IGJyYWNlRXhwYW5kXG5cbi8vIHBhcnNlIGEgY29tcG9uZW50IG9mIHRoZSBleHBhbmRlZCBzZXQuXG4vLyBBdCB0aGlzIHBvaW50LCBubyBwYXR0ZXJuIG1heSBjb250YWluIFwiL1wiIGluIGl0XG4vLyBzbyB3ZSdyZSBnb2luZyB0byByZXR1cm4gYSAyZCBhcnJheSwgd2hlcmUgZWFjaCBlbnRyeSBpcyB0aGUgZnVsbFxuLy8gcGF0dGVybiwgc3BsaXQgb24gJy8nLCBhbmQgdGhlbiB0dXJuZWQgaW50byBhIHJlZ3VsYXIgZXhwcmVzc2lvbi5cbi8vIEEgcmVnZXhwIGlzIG1hZGUgYXQgdGhlIGVuZCB3aGljaCBqb2lucyBlYWNoIGFycmF5IHdpdGggYW5cbi8vIGVzY2FwZWQgLywgYW5kIGFub3RoZXIgZnVsbCBvbmUgd2hpY2ggam9pbnMgZWFjaCByZWdleHAgd2l0aCB8LlxuLy9cbi8vIEZvbGxvd2luZyB0aGUgbGVhZCBvZiBCYXNoIDQuMSwgbm90ZSB0aGF0IFwiKipcIiBvbmx5IGhhcyBzcGVjaWFsIG1lYW5pbmdcbi8vIHdoZW4gaXQgaXMgdGhlICpvbmx5KiB0aGluZyBpbiBhIHBhdGggcG9ydGlvbi4gIE90aGVyd2lzZSwgYW55IHNlcmllc1xuLy8gb2YgKiBpcyBlcXVpdmFsZW50IHRvIGEgc2luZ2xlICouICBHbG9ic3RhciBiZWhhdmlvciBpcyBlbmFibGVkIGJ5XG4vLyBkZWZhdWx0LCBhbmQgY2FuIGJlIGRpc2FibGVkIGJ5IHNldHRpbmcgb3B0aW9ucy5ub2dsb2JzdGFyLlxuXG5leHBvcnQgY29uc3QgbWFrZVJlID0gKHBhdHRlcm46IHN0cmluZywgb3B0aW9uczogTWluaW1hdGNoT3B0aW9ucyA9IHt9KSA9PlxuICBuZXcgTWluaW1hdGNoKHBhdHRlcm4sIG9wdGlvbnMpLm1ha2VSZSgpXG5taW5pbWF0Y2gubWFrZVJlID0gbWFrZVJlXG5cbmV4cG9ydCBjb25zdCBtYXRjaCA9IChcbiAgbGlzdDogc3RyaW5nW10sXG4gIHBhdHRlcm46IHN0cmluZyxcbiAgb3B0aW9uczogTWluaW1hdGNoT3B0aW9ucyA9IHt9LFxuKSA9PiB7XG4gIGNvbnN0IG1tID0gbmV3IE1pbmltYXRjaChwYXR0ZXJuLCBvcHRpb25zKVxuICBsaXN0ID0gbGlzdC5maWx0ZXIoZiA9PiBtbS5tYXRjaChmKSlcbiAgaWYgKG1tLm9wdGlvbnMubm9udWxsICYmICFsaXN0Lmxlbmd0aCkge1xuICAgIGxpc3QucHVzaChwYXR0ZXJuKVxuICB9XG4gIHJldHVybiBsaXN0XG59XG5taW5pbWF0Y2gubWF0Y2ggPSBtYXRjaFxuXG4vLyByZXBsYWNlIHN0dWZmIGxpa2UgXFwqIHdpdGggKlxuY29uc3QgZ2xvYk1hZ2ljID0gL1s/Kl18WytAIV1cXCguKj9cXCl8XFxbfFxcXS9cbmNvbnN0IHJlZ0V4cEVzY2FwZSA9IChzOiBzdHJpbmcpID0+XG4gIHMucmVwbGFjZSgvWy1bXFxde30oKSorPy4sXFxcXF4kfCNcXHNdL2csICdcXFxcJCYnKVxuXG5leHBvcnQgdHlwZSBNTVJlZ0V4cCA9IFJlZ0V4cCAmIHtcbiAgX3NyYz86IHN0cmluZ1xuICBfZ2xvYj86IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBQYXJzZVJldHVybkZpbHRlcmVkID0gc3RyaW5nIHwgTU1SZWdFeHAgfCB0eXBlb2YgR0xPQlNUQVJcbmV4cG9ydCB0eXBlIFBhcnNlUmV0dXJuID0gUGFyc2VSZXR1cm5GaWx0ZXJlZCB8IGZhbHNlXG5cbmV4cG9ydCBjbGFzcyBNaW5pbWF0Y2gge1xuICBvcHRpb25zOiBNaW5pbWF0Y2hPcHRpb25zXG4gIHNldDogUGFyc2VSZXR1cm5GaWx0ZXJlZFtdW11cbiAgcGF0dGVybjogc3RyaW5nXG5cbiAgd2luZG93c1BhdGhzTm9Fc2NhcGU6IGJvb2xlYW5cbiAgbm9uZWdhdGU6IGJvb2xlYW5cbiAgbmVnYXRlOiBib29sZWFuXG4gIGNvbW1lbnQ6IGJvb2xlYW5cbiAgZW1wdHk6IGJvb2xlYW5cbiAgcHJlc2VydmVNdWx0aXBsZVNsYXNoZXM6IGJvb2xlYW5cbiAgcGFydGlhbDogYm9vbGVhblxuICBnbG9iU2V0OiBzdHJpbmdbXVxuICBnbG9iUGFydHM6IHN0cmluZ1tdW11cbiAgbm9jYXNlOiBib29sZWFuXG5cbiAgaXNXaW5kb3dzOiBib29sZWFuXG4gIHBsYXRmb3JtOiBQbGF0Zm9ybVxuICB3aW5kb3dzTm9NYWdpY1Jvb3Q6IGJvb2xlYW5cblxuICByZWdleHA6IGZhbHNlIHwgbnVsbCB8IE1NUmVnRXhwXG4gIGNvbnN0cnVjdG9yKHBhdHRlcm46IHN0cmluZywgb3B0aW9uczogTWluaW1hdGNoT3B0aW9ucyA9IHt9KSB7XG4gICAgYXNzZXJ0VmFsaWRQYXR0ZXJuKHBhdHRlcm4pXG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnNcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuXG4gICAgdGhpcy5wbGF0Zm9ybSA9IG9wdGlvbnMucGxhdGZvcm0gfHwgZGVmYXVsdFBsYXRmb3JtXG4gICAgdGhpcy5pc1dpbmRvd3MgPSB0aGlzLnBsYXRmb3JtID09PSAnd2luMzInXG4gICAgdGhpcy53aW5kb3dzUGF0aHNOb0VzY2FwZSA9XG4gICAgICAhIW9wdGlvbnMud2luZG93c1BhdGhzTm9Fc2NhcGUgfHwgb3B0aW9ucy5hbGxvd1dpbmRvd3NFc2NhcGUgPT09IGZhbHNlXG4gICAgaWYgKHRoaXMud2luZG93c1BhdGhzTm9Fc2NhcGUpIHtcbiAgICAgIHRoaXMucGF0dGVybiA9IHRoaXMucGF0dGVybi5yZXBsYWNlKC9cXFxcL2csICcvJylcbiAgICB9XG4gICAgdGhpcy5wcmVzZXJ2ZU11bHRpcGxlU2xhc2hlcyA9ICEhb3B0aW9ucy5wcmVzZXJ2ZU11bHRpcGxlU2xhc2hlc1xuICAgIHRoaXMucmVnZXhwID0gbnVsbFxuICAgIHRoaXMubmVnYXRlID0gZmFsc2VcbiAgICB0aGlzLm5vbmVnYXRlID0gISFvcHRpb25zLm5vbmVnYXRlXG4gICAgdGhpcy5jb21tZW50ID0gZmFsc2VcbiAgICB0aGlzLmVtcHR5ID0gZmFsc2VcbiAgICB0aGlzLnBhcnRpYWwgPSAhIW9wdGlvbnMucGFydGlhbFxuICAgIHRoaXMubm9jYXNlID0gISF0aGlzLm9wdGlvbnMubm9jYXNlXG4gICAgdGhpcy53aW5kb3dzTm9NYWdpY1Jvb3QgPVxuICAgICAgb3B0aW9ucy53aW5kb3dzTm9NYWdpY1Jvb3QgIT09IHVuZGVmaW5lZFxuICAgICAgICA/IG9wdGlvbnMud2luZG93c05vTWFnaWNSb290XG4gICAgICAgIDogISEodGhpcy5pc1dpbmRvd3MgJiYgdGhpcy5ub2Nhc2UpXG5cbiAgICB0aGlzLmdsb2JTZXQgPSBbXVxuICAgIHRoaXMuZ2xvYlBhcnRzID0gW11cbiAgICB0aGlzLnNldCA9IFtdXG5cbiAgICAvLyBtYWtlIHRoZSBzZXQgb2YgcmVnZXhwcyBldGMuXG4gICAgdGhpcy5tYWtlKClcbiAgfVxuXG4gIGhhc01hZ2ljKCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm9wdGlvbnMubWFnaWNhbEJyYWNlcyAmJiB0aGlzLnNldC5sZW5ndGggPiAxKSB7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgdGhpcy5zZXQpIHtcbiAgICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXR0ZXJuKSB7XG4gICAgICAgIGlmICh0eXBlb2YgcGFydCAhPT0gJ3N0cmluZycpIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgZGVidWcoLi4uXzogYW55W10pIHt9XG5cbiAgbWFrZSgpIHtcbiAgICBjb25zdCBwYXR0ZXJuID0gdGhpcy5wYXR0ZXJuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMub3B0aW9uc1xuXG4gICAgLy8gZW1wdHkgcGF0dGVybnMgYW5kIGNvbW1lbnRzIG1hdGNoIG5vdGhpbmcuXG4gICAgaWYgKCFvcHRpb25zLm5vY29tbWVudCAmJiBwYXR0ZXJuLmNoYXJBdCgwKSA9PT0gJyMnKSB7XG4gICAgICB0aGlzLmNvbW1lbnQgPSB0cnVlXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoIXBhdHRlcm4pIHtcbiAgICAgIHRoaXMuZW1wdHkgPSB0cnVlXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBzdGVwIDE6IGZpZ3VyZSBvdXQgbmVnYXRpb24sIGV0Yy5cbiAgICB0aGlzLnBhcnNlTmVnYXRlKClcblxuICAgIC8vIHN0ZXAgMjogZXhwYW5kIGJyYWNlc1xuICAgIHRoaXMuZ2xvYlNldCA9IFsuLi5uZXcgU2V0KHRoaXMuYnJhY2VFeHBhbmQoKSldXG5cbiAgICBpZiAob3B0aW9ucy5kZWJ1Zykge1xuICAgICAgdGhpcy5kZWJ1ZyA9ICguLi5hcmdzOiBhbnlbXSkgPT4gY29uc29sZS5lcnJvciguLi5hcmdzKVxuICAgIH1cblxuICAgIHRoaXMuZGVidWcodGhpcy5wYXR0ZXJuLCB0aGlzLmdsb2JTZXQpXG5cbiAgICAvLyBzdGVwIDM6IG5vdyB3ZSBoYXZlIGEgc2V0LCBzbyB0dXJuIGVhY2ggb25lIGludG8gYSBzZXJpZXMgb2ZcbiAgICAvLyBwYXRoLXBvcnRpb24gbWF0Y2hpbmcgcGF0dGVybnMuXG4gICAgLy8gVGhlc2Ugd2lsbCBiZSByZWdleHBzLCBleGNlcHQgaW4gdGhlIGNhc2Ugb2YgXCIqKlwiLCB3aGljaCBpc1xuICAgIC8vIHNldCB0byB0aGUgR0xPQlNUQVIgb2JqZWN0IGZvciBnbG9ic3RhciBiZWhhdmlvcixcbiAgICAvLyBhbmQgd2lsbCBub3QgY29udGFpbiBhbnkgLyBjaGFyYWN0ZXJzXG4gICAgLy9cbiAgICAvLyBGaXJzdCwgd2UgcHJlcHJvY2VzcyB0byBtYWtlIHRoZSBnbG9iIHBhdHRlcm4gc2V0cyBhIGJpdCBzaW1wbGVyXG4gICAgLy8gYW5kIGRlZHVwZWQuICBUaGVyZSBhcmUgc29tZSBwZXJmLWtpbGxpbmcgcGF0dGVybnMgdGhhdCBjYW4gY2F1c2VcbiAgICAvLyBwcm9ibGVtcyB3aXRoIGEgZ2xvYiB3YWxrLCBidXQgd2UgY2FuIHNpbXBsaWZ5IHRoZW0gZG93biBhIGJpdC5cbiAgICBjb25zdCByYXdHbG9iUGFydHMgPSB0aGlzLmdsb2JTZXQubWFwKHMgPT4gdGhpcy5zbGFzaFNwbGl0KHMpKVxuICAgIHRoaXMuZ2xvYlBhcnRzID0gdGhpcy5wcmVwcm9jZXNzKHJhd0dsb2JQYXJ0cylcbiAgICB0aGlzLmRlYnVnKHRoaXMucGF0dGVybiwgdGhpcy5nbG9iUGFydHMpXG5cbiAgICAvLyBnbG9iIC0tPiByZWdleHBzXG4gICAgbGV0IHNldCA9IHRoaXMuZ2xvYlBhcnRzLm1hcCgocywgXywgX18pID0+IHtcbiAgICAgIGlmICh0aGlzLmlzV2luZG93cyAmJiB0aGlzLndpbmRvd3NOb01hZ2ljUm9vdCkge1xuICAgICAgICAvLyBjaGVjayBpZiBpdCdzIGEgZHJpdmUgb3IgdW5jIHBhdGguXG4gICAgICAgIGNvbnN0IGlzVU5DID1cbiAgICAgICAgICBzWzBdID09PSAnJyAmJlxuICAgICAgICAgIHNbMV0gPT09ICcnICYmXG4gICAgICAgICAgKHNbMl0gPT09ICc/JyB8fCAhZ2xvYk1hZ2ljLnRlc3Qoc1syXSkpICYmXG4gICAgICAgICAgIWdsb2JNYWdpYy50ZXN0KHNbM10pXG4gICAgICAgIGNvbnN0IGlzRHJpdmUgPSAvXlthLXpdOi9pLnRlc3Qoc1swXSlcbiAgICAgICAgaWYgKGlzVU5DKSB7XG4gICAgICAgICAgcmV0dXJuIFsuLi5zLnNsaWNlKDAsIDQpLCAuLi5zLnNsaWNlKDQpLm1hcChzcyA9PiB0aGlzLnBhcnNlKHNzKSldXG4gICAgICAgIH0gZWxzZSBpZiAoaXNEcml2ZSkge1xuICAgICAgICAgIHJldHVybiBbc1swXSwgLi4ucy5zbGljZSgxKS5tYXAoc3MgPT4gdGhpcy5wYXJzZShzcykpXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcy5tYXAoc3MgPT4gdGhpcy5wYXJzZShzcykpXG4gICAgfSlcblxuICAgIHRoaXMuZGVidWcodGhpcy5wYXR0ZXJuLCBzZXQpXG5cbiAgICAvLyBmaWx0ZXIgb3V0IGV2ZXJ5dGhpbmcgdGhhdCBkaWRuJ3QgY29tcGlsZSBwcm9wZXJseS5cbiAgICB0aGlzLnNldCA9IHNldC5maWx0ZXIoXG4gICAgICBzID0+IHMuaW5kZXhPZihmYWxzZSkgPT09IC0xLFxuICAgICkgYXMgUGFyc2VSZXR1cm5GaWx0ZXJlZFtdW11cblxuICAgIC8vIGRvIG5vdCB0cmVhdCB0aGUgPyBpbiBVTkMgcGF0aHMgYXMgbWFnaWNcbiAgICBpZiAodGhpcy5pc1dpbmRvd3MpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zZXQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgcCA9IHRoaXMuc2V0W2ldXG4gICAgICAgIGlmIChcbiAgICAgICAgICBwWzBdID09PSAnJyAmJlxuICAgICAgICAgIHBbMV0gPT09ICcnICYmXG4gICAgICAgICAgdGhpcy5nbG9iUGFydHNbaV1bMl0gPT09ICc/JyAmJlxuICAgICAgICAgIHR5cGVvZiBwWzNdID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgIC9eW2Etel06JC9pLnRlc3QocFszXSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgcFsyXSA9ICc/J1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5kZWJ1Zyh0aGlzLnBhdHRlcm4sIHRoaXMuc2V0KVxuICB9XG5cbiAgLy8gdmFyaW91cyB0cmFuc2Zvcm1zIHRvIGVxdWl2YWxlbnQgcGF0dGVybiBzZXRzIHRoYXQgYXJlXG4gIC8vIGZhc3RlciB0byBwcm9jZXNzIGluIGEgZmlsZXN5c3RlbSB3YWxrLiAgVGhlIGdvYWwgaXMgdG9cbiAgLy8gZWxpbWluYXRlIHdoYXQgd2UgY2FuLCBhbmQgcHVzaCBhbGwgKiogcGF0dGVybnMgYXMgZmFyXG4gIC8vIHRvIHRoZSByaWdodCBhcyBwb3NzaWJsZSwgZXZlbiBpZiBpdCBpbmNyZWFzZXMgdGhlIG51bWJlclxuICAvLyBvZiBwYXR0ZXJucyB0aGF0IHdlIGhhdmUgdG8gcHJvY2Vzcy5cbiAgcHJlcHJvY2VzcyhnbG9iUGFydHM6IHN0cmluZ1tdW10pIHtcbiAgICAvLyBpZiB3ZSdyZSBub3QgaW4gZ2xvYnN0YXIgbW9kZSwgdGhlbiB0dXJuIGFsbCAqKiBpbnRvICpcbiAgICBpZiAodGhpcy5vcHRpb25zLm5vZ2xvYnN0YXIpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2xvYlBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZ2xvYlBhcnRzW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgaWYgKGdsb2JQYXJ0c1tpXVtqXSA9PT0gJyoqJykge1xuICAgICAgICAgICAgZ2xvYlBhcnRzW2ldW2pdID0gJyonXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgeyBvcHRpbWl6YXRpb25MZXZlbCA9IDEgfSA9IHRoaXMub3B0aW9uc1xuXG4gICAgaWYgKG9wdGltaXphdGlvbkxldmVsID49IDIpIHtcbiAgICAgIC8vIGFnZ3Jlc3NpdmUgb3B0aW1pemF0aW9uIGZvciB0aGUgcHVycG9zZSBvZiBmcyB3YWxraW5nXG4gICAgICBnbG9iUGFydHMgPSB0aGlzLmZpcnN0UGhhc2VQcmVQcm9jZXNzKGdsb2JQYXJ0cylcbiAgICAgIGdsb2JQYXJ0cyA9IHRoaXMuc2Vjb25kUGhhc2VQcmVQcm9jZXNzKGdsb2JQYXJ0cylcbiAgICB9IGVsc2UgaWYgKG9wdGltaXphdGlvbkxldmVsID49IDEpIHtcbiAgICAgIC8vIGp1c3QgYmFzaWMgb3B0aW1pemF0aW9ucyB0byByZW1vdmUgc29tZSAuLiBwYXJ0c1xuICAgICAgZ2xvYlBhcnRzID0gdGhpcy5sZXZlbE9uZU9wdGltaXplKGdsb2JQYXJ0cylcbiAgICB9IGVsc2Uge1xuICAgICAgLy8ganVzdCBjb2xsYXBzZSBtdWx0aXBsZSAqKiBwb3J0aW9ucyBpbnRvIG9uZVxuICAgICAgZ2xvYlBhcnRzID0gdGhpcy5hZGphc2NlbnRHbG9ic3Rhck9wdGltaXplKGdsb2JQYXJ0cylcbiAgICB9XG5cbiAgICByZXR1cm4gZ2xvYlBhcnRzXG4gIH1cblxuICAvLyBqdXN0IGdldCByaWQgb2YgYWRqYXNjZW50ICoqIHBvcnRpb25zXG4gIGFkamFzY2VudEdsb2JzdGFyT3B0aW1pemUoZ2xvYlBhcnRzOiBzdHJpbmdbXVtdKSB7XG4gICAgcmV0dXJuIGdsb2JQYXJ0cy5tYXAocGFydHMgPT4ge1xuICAgICAgbGV0IGdzOiBudW1iZXIgPSAtMVxuICAgICAgd2hpbGUgKC0xICE9PSAoZ3MgPSBwYXJ0cy5pbmRleE9mKCcqKicsIGdzICsgMSkpKSB7XG4gICAgICAgIGxldCBpID0gZ3NcbiAgICAgICAgd2hpbGUgKHBhcnRzW2kgKyAxXSA9PT0gJyoqJykge1xuICAgICAgICAgIGkrK1xuICAgICAgICB9XG4gICAgICAgIGlmIChpICE9PSBncykge1xuICAgICAgICAgIHBhcnRzLnNwbGljZShncywgaSAtIGdzKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFydHNcbiAgICB9KVxuICB9XG5cbiAgLy8gZ2V0IHJpZCBvZiBhZGphc2NlbnQgKiogYW5kIHJlc29sdmUgLi4gcG9ydGlvbnNcbiAgbGV2ZWxPbmVPcHRpbWl6ZShnbG9iUGFydHM6IHN0cmluZ1tdW10pIHtcbiAgICByZXR1cm4gZ2xvYlBhcnRzLm1hcChwYXJ0cyA9PiB7XG4gICAgICBwYXJ0cyA9IHBhcnRzLnJlZHVjZSgoc2V0OiBzdHJpbmdbXSwgcGFydCkgPT4ge1xuICAgICAgICBjb25zdCBwcmV2ID0gc2V0W3NldC5sZW5ndGggLSAxXVxuICAgICAgICBpZiAocGFydCA9PT0gJyoqJyAmJiBwcmV2ID09PSAnKionKSB7XG4gICAgICAgICAgcmV0dXJuIHNldFxuICAgICAgICB9XG4gICAgICAgIGlmIChwYXJ0ID09PSAnLi4nKSB7XG4gICAgICAgICAgaWYgKHByZXYgJiYgcHJldiAhPT0gJy4uJyAmJiBwcmV2ICE9PSAnLicgJiYgcHJldiAhPT0gJyoqJykge1xuICAgICAgICAgICAgc2V0LnBvcCgpXG4gICAgICAgICAgICByZXR1cm4gc2V0XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNldC5wdXNoKHBhcnQpXG4gICAgICAgIHJldHVybiBzZXRcbiAgICAgIH0sIFtdKVxuICAgICAgcmV0dXJuIHBhcnRzLmxlbmd0aCA9PT0gMCA/IFsnJ10gOiBwYXJ0c1xuICAgIH0pXG4gIH1cblxuICBsZXZlbFR3b0ZpbGVPcHRpbWl6ZShwYXJ0czogc3RyaW5nIHwgc3RyaW5nW10pIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkocGFydHMpKSB7XG4gICAgICBwYXJ0cyA9IHRoaXMuc2xhc2hTcGxpdChwYXJ0cylcbiAgICB9XG4gICAgbGV0IGRpZFNvbWV0aGluZzogYm9vbGVhbiA9IGZhbHNlXG4gICAgZG8ge1xuICAgICAgZGlkU29tZXRoaW5nID0gZmFsc2VcbiAgICAgIC8vIDxwcmU+LzxlPi88cmVzdD4gLT4gPHByZT4vPHJlc3Q+XG4gICAgICBpZiAoIXRoaXMucHJlc2VydmVNdWx0aXBsZVNsYXNoZXMpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBwYXJ0cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBwID0gcGFydHNbaV1cbiAgICAgICAgICAvLyBkb24ndCBzcXVlZXplIG91dCBVTkMgcGF0dGVybnNcbiAgICAgICAgICBpZiAoaSA9PT0gMSAmJiBwID09PSAnJyAmJiBwYXJ0c1swXSA9PT0gJycpIGNvbnRpbnVlXG4gICAgICAgICAgaWYgKHAgPT09ICcuJyB8fCBwID09PSAnJykge1xuICAgICAgICAgICAgZGlkU29tZXRoaW5nID0gdHJ1ZVxuICAgICAgICAgICAgcGFydHMuc3BsaWNlKGksIDEpXG4gICAgICAgICAgICBpLS1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgIHBhcnRzWzBdID09PSAnLicgJiZcbiAgICAgICAgICBwYXJ0cy5sZW5ndGggPT09IDIgJiZcbiAgICAgICAgICAocGFydHNbMV0gPT09ICcuJyB8fCBwYXJ0c1sxXSA9PT0gJycpXG4gICAgICAgICkge1xuICAgICAgICAgIGRpZFNvbWV0aGluZyA9IHRydWVcbiAgICAgICAgICBwYXJ0cy5wb3AoKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIDxwcmU+LzxwPi8uLi88cmVzdD4gLT4gPHByZT4vPHJlc3Q+XG4gICAgICBsZXQgZGQ6IG51bWJlciA9IDBcbiAgICAgIHdoaWxlICgtMSAhPT0gKGRkID0gcGFydHMuaW5kZXhPZignLi4nLCBkZCArIDEpKSkge1xuICAgICAgICBjb25zdCBwID0gcGFydHNbZGQgLSAxXVxuICAgICAgICBpZiAocCAmJiBwICE9PSAnLicgJiYgcCAhPT0gJy4uJyAmJiBwICE9PSAnKionKSB7XG4gICAgICAgICAgZGlkU29tZXRoaW5nID0gdHJ1ZVxuICAgICAgICAgIHBhcnRzLnNwbGljZShkZCAtIDEsIDIpXG4gICAgICAgICAgZGQgLT0gMlxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSB3aGlsZSAoZGlkU29tZXRoaW5nKVxuICAgIHJldHVybiBwYXJ0cy5sZW5ndGggPT09IDAgPyBbJyddIDogcGFydHNcbiAgfVxuXG4gIC8vIEZpcnN0IHBoYXNlOiBzaW5nbGUtcGF0dGVybiBwcm9jZXNzaW5nXG4gIC8vIDxwcmU+IGlzIDEgb3IgbW9yZSBwb3J0aW9uc1xuICAvLyA8cmVzdD4gaXMgMSBvciBtb3JlIHBvcnRpb25zXG4gIC8vIDxwPiBpcyBhbnkgcG9ydGlvbiBvdGhlciB0aGFuIC4sIC4uLCAnJywgb3IgKipcbiAgLy8gPGU+IGlzIC4gb3IgJydcbiAgLy9cbiAgLy8gKiovLi4gaXMgKmJydXRhbCogZm9yIGZpbGVzeXN0ZW0gd2Fsa2luZyBwZXJmb3JtYW5jZSwgYmVjYXVzZVxuICAvLyBpdCBlZmZlY3RpdmVseSByZXNldHMgdGhlIHJlY3Vyc2l2ZSB3YWxrIGVhY2ggdGltZSBpdCBvY2N1cnMsXG4gIC8vIGFuZCAqKiBjYW5ub3QgYmUgcmVkdWNlZCBvdXQgYnkgYSAuLiBwYXR0ZXJuIHBhcnQgbGlrZSBhIHJlZ2V4cFxuICAvLyBvciBtb3N0IHN0cmluZ3MgKG90aGVyIHRoYW4gLi4sIC4sIGFuZCAnJykgY2FuIGJlLlxuICAvL1xuICAvLyA8cHJlPi8qKi8uLi88cD4vPHA+LzxyZXN0PiAtPiB7PHByZT4vLi4vPHA+LzxwPi88cmVzdD4sPHByZT4vKiovPHA+LzxwPi88cmVzdD59XG4gIC8vIDxwcmU+LzxlPi88cmVzdD4gLT4gPHByZT4vPHJlc3Q+XG4gIC8vIDxwcmU+LzxwPi8uLi88cmVzdD4gLT4gPHByZT4vPHJlc3Q+XG4gIC8vICoqLyoqLzxyZXN0PiAtPiAqKi88cmVzdD5cbiAgLy9cbiAgLy8gKiovKi88cmVzdD4gLT4gKi8qKi88cmVzdD4gPD09IG5vdCB2YWxpZCBiZWNhdXNlICoqIGRvZXNuJ3QgZm9sbG93XG4gIC8vIHRoaXMgV09VTEQgYmUgYWxsb3dlZCBpZiAqKiBkaWQgZm9sbG93IHN5bWxpbmtzLCBvciAqIGRpZG4ndFxuICBmaXJzdFBoYXNlUHJlUHJvY2VzcyhnbG9iUGFydHM6IHN0cmluZ1tdW10pIHtcbiAgICBsZXQgZGlkU29tZXRoaW5nID0gZmFsc2VcbiAgICBkbyB7XG4gICAgICBkaWRTb21ldGhpbmcgPSBmYWxzZVxuICAgICAgLy8gPHByZT4vKiovLi4vPHA+LzxwPi88cmVzdD4gLT4gezxwcmU+Ly4uLzxwPi88cD4vPHJlc3Q+LDxwcmU+LyoqLzxwPi88cD4vPHJlc3Q+fVxuICAgICAgZm9yIChsZXQgcGFydHMgb2YgZ2xvYlBhcnRzKSB7XG4gICAgICAgIGxldCBnczogbnVtYmVyID0gLTFcbiAgICAgICAgd2hpbGUgKC0xICE9PSAoZ3MgPSBwYXJ0cy5pbmRleE9mKCcqKicsIGdzICsgMSkpKSB7XG4gICAgICAgICAgbGV0IGdzczogbnVtYmVyID0gZ3NcbiAgICAgICAgICB3aGlsZSAocGFydHNbZ3NzICsgMV0gPT09ICcqKicpIHtcbiAgICAgICAgICAgIC8vIDxwcmU+LyoqLyoqLzxyZXN0PiAtPiA8cHJlPi8qKi88cmVzdD5cbiAgICAgICAgICAgIGdzcysrXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGVnLCBpZiBncyBpcyAyIGFuZCBnc3MgaXMgNCwgdGhhdCBtZWFucyB3ZSBoYXZlIDMgKipcbiAgICAgICAgICAvLyBwYXJ0cywgYW5kIGNhbiByZW1vdmUgMiBvZiB0aGVtLlxuICAgICAgICAgIGlmIChnc3MgPiBncykge1xuICAgICAgICAgICAgcGFydHMuc3BsaWNlKGdzICsgMSwgZ3NzIC0gZ3MpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IG5leHQgPSBwYXJ0c1tncyArIDFdXG4gICAgICAgICAgY29uc3QgcCA9IHBhcnRzW2dzICsgMl1cbiAgICAgICAgICBjb25zdCBwMiA9IHBhcnRzW2dzICsgM11cbiAgICAgICAgICBpZiAobmV4dCAhPT0gJy4uJykgY29udGludWVcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAhcCB8fFxuICAgICAgICAgICAgcCA9PT0gJy4nIHx8XG4gICAgICAgICAgICBwID09PSAnLi4nIHx8XG4gICAgICAgICAgICAhcDIgfHxcbiAgICAgICAgICAgIHAyID09PSAnLicgfHxcbiAgICAgICAgICAgIHAyID09PSAnLi4nXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBkaWRTb21ldGhpbmcgPSB0cnVlXG4gICAgICAgICAgLy8gZWRpdCBwYXJ0cyBpbiBwbGFjZSwgYW5kIHB1c2ggdGhlIG5ldyBvbmVcbiAgICAgICAgICBwYXJ0cy5zcGxpY2UoZ3MsIDEpXG4gICAgICAgICAgY29uc3Qgb3RoZXIgPSBwYXJ0cy5zbGljZSgwKVxuICAgICAgICAgIG90aGVyW2dzXSA9ICcqKidcbiAgICAgICAgICBnbG9iUGFydHMucHVzaChvdGhlcilcbiAgICAgICAgICBncy0tXG4gICAgICAgIH1cblxuICAgICAgICAvLyA8cHJlPi88ZT4vPHJlc3Q+IC0+IDxwcmU+LzxyZXN0PlxuICAgICAgICBpZiAoIXRoaXMucHJlc2VydmVNdWx0aXBsZVNsYXNoZXMpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHBhcnRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcCA9IHBhcnRzW2ldXG4gICAgICAgICAgICAvLyBkb24ndCBzcXVlZXplIG91dCBVTkMgcGF0dGVybnNcbiAgICAgICAgICAgIGlmIChpID09PSAxICYmIHAgPT09ICcnICYmIHBhcnRzWzBdID09PSAnJykgY29udGludWVcbiAgICAgICAgICAgIGlmIChwID09PSAnLicgfHwgcCA9PT0gJycpIHtcbiAgICAgICAgICAgICAgZGlkU29tZXRoaW5nID0gdHJ1ZVxuICAgICAgICAgICAgICBwYXJ0cy5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgICAgaS0tXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHBhcnRzWzBdID09PSAnLicgJiZcbiAgICAgICAgICAgIHBhcnRzLmxlbmd0aCA9PT0gMiAmJlxuICAgICAgICAgICAgKHBhcnRzWzFdID09PSAnLicgfHwgcGFydHNbMV0gPT09ICcnKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgZGlkU29tZXRoaW5nID0gdHJ1ZVxuICAgICAgICAgICAgcGFydHMucG9wKClcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyA8cHJlPi88cD4vLi4vPHJlc3Q+IC0+IDxwcmU+LzxyZXN0PlxuICAgICAgICBsZXQgZGQ6IG51bWJlciA9IDBcbiAgICAgICAgd2hpbGUgKC0xICE9PSAoZGQgPSBwYXJ0cy5pbmRleE9mKCcuLicsIGRkICsgMSkpKSB7XG4gICAgICAgICAgY29uc3QgcCA9IHBhcnRzW2RkIC0gMV1cbiAgICAgICAgICBpZiAocCAmJiBwICE9PSAnLicgJiYgcCAhPT0gJy4uJyAmJiBwICE9PSAnKionKSB7XG4gICAgICAgICAgICBkaWRTb21ldGhpbmcgPSB0cnVlXG4gICAgICAgICAgICBjb25zdCBuZWVkRG90ID0gZGQgPT09IDEgJiYgcGFydHNbZGQgKyAxXSA9PT0gJyoqJ1xuICAgICAgICAgICAgY29uc3Qgc3BsaW4gPSBuZWVkRG90ID8gWycuJ10gOiBbXVxuICAgICAgICAgICAgcGFydHMuc3BsaWNlKGRkIC0gMSwgMiwgLi4uc3BsaW4pXG4gICAgICAgICAgICBpZiAocGFydHMubGVuZ3RoID09PSAwKSBwYXJ0cy5wdXNoKCcnKVxuICAgICAgICAgICAgZGQgLT0gMlxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gd2hpbGUgKGRpZFNvbWV0aGluZylcblxuICAgIHJldHVybiBnbG9iUGFydHNcbiAgfVxuXG4gIC8vIHNlY29uZCBwaGFzZTogbXVsdGktcGF0dGVybiBkZWR1cGVzXG4gIC8vIHs8cHJlPi8qLzxyZXN0Piw8cHJlPi88cD4vPHJlc3Q+fSAtPiA8cHJlPi8qLzxyZXN0PlxuICAvLyB7PHByZT4vPHJlc3Q+LDxwcmU+LzxyZXN0Pn0gLT4gPHByZT4vPHJlc3Q+XG4gIC8vIHs8cHJlPi8qKi88cmVzdD4sPHByZT4vPHJlc3Q+fSAtPiA8cHJlPi8qKi88cmVzdD5cbiAgLy9cbiAgLy8gezxwcmU+LyoqLzxyZXN0Piw8cHJlPi8qKi88cD4vPHJlc3Q+fSAtPiA8cHJlPi8qKi88cmVzdD5cbiAgLy8gXi0tIG5vdCB2YWxpZCBiZWNhdXNlICoqIGRvZW5zJ3QgZm9sbG93IHN5bWxpbmtzXG4gIHNlY29uZFBoYXNlUHJlUHJvY2VzcyhnbG9iUGFydHM6IHN0cmluZ1tdW10pOiBzdHJpbmdbXVtdIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsb2JQYXJ0cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IGdsb2JQYXJ0cy5sZW5ndGg7IGorKykge1xuICAgICAgICBjb25zdCBtYXRjaGVkID0gdGhpcy5wYXJ0c01hdGNoKFxuICAgICAgICAgIGdsb2JQYXJ0c1tpXSxcbiAgICAgICAgICBnbG9iUGFydHNbal0sXG4gICAgICAgICAgIXRoaXMucHJlc2VydmVNdWx0aXBsZVNsYXNoZXMsXG4gICAgICAgIClcbiAgICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgICBnbG9iUGFydHNbaV0gPSBbXVxuICAgICAgICAgIGdsb2JQYXJ0c1tqXSA9IG1hdGNoZWRcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBnbG9iUGFydHMuZmlsdGVyKGdzID0+IGdzLmxlbmd0aClcbiAgfVxuXG4gIHBhcnRzTWF0Y2goXG4gICAgYTogc3RyaW5nW10sXG4gICAgYjogc3RyaW5nW10sXG4gICAgZW1wdHlHU01hdGNoOiBib29sZWFuID0gZmFsc2UsXG4gICk6IGZhbHNlIHwgc3RyaW5nW10ge1xuICAgIGxldCBhaSA9IDBcbiAgICBsZXQgYmkgPSAwXG4gICAgbGV0IHJlc3VsdDogc3RyaW5nW10gPSBbXVxuICAgIGxldCB3aGljaDogc3RyaW5nID0gJydcbiAgICB3aGlsZSAoYWkgPCBhLmxlbmd0aCAmJiBiaSA8IGIubGVuZ3RoKSB7XG4gICAgICBpZiAoYVthaV0gPT09IGJbYmldKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHdoaWNoID09PSAnYicgPyBiW2JpXSA6IGFbYWldKVxuICAgICAgICBhaSsrXG4gICAgICAgIGJpKytcbiAgICAgIH0gZWxzZSBpZiAoZW1wdHlHU01hdGNoICYmIGFbYWldID09PSAnKionICYmIGJbYmldID09PSBhW2FpICsgMV0pIHtcbiAgICAgICAgcmVzdWx0LnB1c2goYVthaV0pXG4gICAgICAgIGFpKytcbiAgICAgIH0gZWxzZSBpZiAoZW1wdHlHU01hdGNoICYmIGJbYmldID09PSAnKionICYmIGFbYWldID09PSBiW2JpICsgMV0pIHtcbiAgICAgICAgcmVzdWx0LnB1c2goYltiaV0pXG4gICAgICAgIGJpKytcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGFbYWldID09PSAnKicgJiZcbiAgICAgICAgYltiaV0gJiZcbiAgICAgICAgKHRoaXMub3B0aW9ucy5kb3QgfHwgIWJbYmldLnN0YXJ0c1dpdGgoJy4nKSkgJiZcbiAgICAgICAgYltiaV0gIT09ICcqKidcbiAgICAgICkge1xuICAgICAgICBpZiAod2hpY2ggPT09ICdiJykgcmV0dXJuIGZhbHNlXG4gICAgICAgIHdoaWNoID0gJ2EnXG4gICAgICAgIHJlc3VsdC5wdXNoKGFbYWldKVxuICAgICAgICBhaSsrXG4gICAgICAgIGJpKytcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGJbYmldID09PSAnKicgJiZcbiAgICAgICAgYVthaV0gJiZcbiAgICAgICAgKHRoaXMub3B0aW9ucy5kb3QgfHwgIWFbYWldLnN0YXJ0c1dpdGgoJy4nKSkgJiZcbiAgICAgICAgYVthaV0gIT09ICcqKidcbiAgICAgICkge1xuICAgICAgICBpZiAod2hpY2ggPT09ICdhJykgcmV0dXJuIGZhbHNlXG4gICAgICAgIHdoaWNoID0gJ2InXG4gICAgICAgIHJlc3VsdC5wdXNoKGJbYmldKVxuICAgICAgICBhaSsrXG4gICAgICAgIGJpKytcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiB3ZSBmYWxsIG91dCBvZiB0aGUgbG9vcCwgaXQgbWVhbnMgdGhleSB0d28gYXJlIGlkZW50aWNhbFxuICAgIC8vIGFzIGxvbmcgYXMgdGhlaXIgbGVuZ3RocyBtYXRjaFxuICAgIHJldHVybiBhLmxlbmd0aCA9PT0gYi5sZW5ndGggJiYgcmVzdWx0XG4gIH1cblxuICBwYXJzZU5lZ2F0ZSgpIHtcbiAgICBpZiAodGhpcy5ub25lZ2F0ZSkgcmV0dXJuXG5cbiAgICBjb25zdCBwYXR0ZXJuID0gdGhpcy5wYXR0ZXJuXG4gICAgbGV0IG5lZ2F0ZSA9IGZhbHNlXG4gICAgbGV0IG5lZ2F0ZU9mZnNldCA9IDBcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5sZW5ndGggJiYgcGF0dGVybi5jaGFyQXQoaSkgPT09ICchJzsgaSsrKSB7XG4gICAgICBuZWdhdGUgPSAhbmVnYXRlXG4gICAgICBuZWdhdGVPZmZzZXQrK1xuICAgIH1cblxuICAgIGlmIChuZWdhdGVPZmZzZXQpIHRoaXMucGF0dGVybiA9IHBhdHRlcm4uc2xpY2UobmVnYXRlT2Zmc2V0KVxuICAgIHRoaXMubmVnYXRlID0gbmVnYXRlXG4gIH1cblxuICAvLyBzZXQgcGFydGlhbCB0byB0cnVlIHRvIHRlc3QgaWYsIGZvciBleGFtcGxlLFxuICAvLyBcIi9hL2JcIiBtYXRjaGVzIHRoZSBzdGFydCBvZiBcIi8qL2IvKi9kXCJcbiAgLy8gUGFydGlhbCBtZWFucywgaWYgeW91IHJ1biBvdXQgb2YgZmlsZSBiZWZvcmUgeW91IHJ1blxuICAvLyBvdXQgb2YgcGF0dGVybiwgdGhlbiB0aGF0J3MgZmluZSwgYXMgbG9uZyBhcyBhbGxcbiAgLy8gdGhlIHBhcnRzIG1hdGNoLlxuICBtYXRjaE9uZShmaWxlOiBzdHJpbmdbXSwgcGF0dGVybjogUGFyc2VSZXR1cm5bXSwgcGFydGlhbDogYm9vbGVhbiA9IGZhbHNlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMub3B0aW9uc1xuXG4gICAgLy8gVU5DIHBhdGhzIGxpa2UgLy8/L1g6Ly4uLiBjYW4gbWF0Y2ggWDovLi4uIGFuZCB2aWNlIHZlcnNhXG4gICAgLy8gRHJpdmUgbGV0dGVycyBpbiBhYnNvbHV0ZSBkcml2ZSBvciB1bmMgcGF0aHMgYXJlIGFsd2F5cyBjb21wYXJlZFxuICAgIC8vIGNhc2UtaW5zZW5zaXRpdmVseS5cbiAgICBpZiAodGhpcy5pc1dpbmRvd3MpIHtcbiAgICAgIGNvbnN0IGZpbGVEcml2ZSA9IHR5cGVvZiBmaWxlWzBdID09PSAnc3RyaW5nJyAmJiAvXlthLXpdOiQvaS50ZXN0KGZpbGVbMF0pXG4gICAgICBjb25zdCBmaWxlVU5DID1cbiAgICAgICAgIWZpbGVEcml2ZSAmJlxuICAgICAgICBmaWxlWzBdID09PSAnJyAmJlxuICAgICAgICBmaWxlWzFdID09PSAnJyAmJlxuICAgICAgICBmaWxlWzJdID09PSAnPycgJiZcbiAgICAgICAgL15bYS16XTokL2kudGVzdChmaWxlWzNdKVxuXG4gICAgICBjb25zdCBwYXR0ZXJuRHJpdmUgPVxuICAgICAgICB0eXBlb2YgcGF0dGVyblswXSA9PT0gJ3N0cmluZycgJiYgL15bYS16XTokL2kudGVzdChwYXR0ZXJuWzBdKVxuICAgICAgY29uc3QgcGF0dGVyblVOQyA9XG4gICAgICAgICFwYXR0ZXJuRHJpdmUgJiZcbiAgICAgICAgcGF0dGVyblswXSA9PT0gJycgJiZcbiAgICAgICAgcGF0dGVyblsxXSA9PT0gJycgJiZcbiAgICAgICAgcGF0dGVyblsyXSA9PT0gJz8nICYmXG4gICAgICAgIHR5cGVvZiBwYXR0ZXJuWzNdID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAvXlthLXpdOiQvaS50ZXN0KHBhdHRlcm5bM10pXG5cbiAgICAgIGNvbnN0IGZkaSA9IGZpbGVVTkMgPyAzIDogZmlsZURyaXZlID8gMCA6IHVuZGVmaW5lZFxuICAgICAgY29uc3QgcGRpID0gcGF0dGVyblVOQyA/IDMgOiBwYXR0ZXJuRHJpdmUgPyAwIDogdW5kZWZpbmVkXG4gICAgICBpZiAodHlwZW9mIGZkaSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIHBkaSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgY29uc3QgW2ZkLCBwZF06IFtzdHJpbmcsIHN0cmluZ10gPSBbZmlsZVtmZGldLCBwYXR0ZXJuW3BkaV0gYXMgc3RyaW5nXVxuICAgICAgICBpZiAoZmQudG9Mb3dlckNhc2UoKSA9PT0gcGQudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgIHBhdHRlcm5bcGRpXSA9IGZkXG4gICAgICAgICAgaWYgKHBkaSA+IGZkaSkge1xuICAgICAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4uc2xpY2UocGRpKVxuICAgICAgICAgIH0gZWxzZSBpZiAoZmRpID4gcGRpKSB7XG4gICAgICAgICAgICBmaWxlID0gZmlsZS5zbGljZShmZGkpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVzb2x2ZSBhbmQgcmVkdWNlIC4gYW5kIC4uIHBvcnRpb25zIGluIHRoZSBmaWxlIGFzIHdlbGwuXG4gICAgLy8gZG9uJ3QgbmVlZCB0byBkbyB0aGUgc2Vjb25kIHBoYXNlLCBiZWNhdXNlIGl0J3Mgb25seSBvbmUgc3RyaW5nW11cbiAgICBjb25zdCB7IG9wdGltaXphdGlvbkxldmVsID0gMSB9ID0gdGhpcy5vcHRpb25zXG4gICAgaWYgKG9wdGltaXphdGlvbkxldmVsID49IDIpIHtcbiAgICAgIGZpbGUgPSB0aGlzLmxldmVsVHdvRmlsZU9wdGltaXplKGZpbGUpXG4gICAgfVxuXG4gICAgdGhpcy5kZWJ1ZygnbWF0Y2hPbmUnLCB0aGlzLCB7IGZpbGUsIHBhdHRlcm4gfSlcbiAgICB0aGlzLmRlYnVnKCdtYXRjaE9uZScsIGZpbGUubGVuZ3RoLCBwYXR0ZXJuLmxlbmd0aClcblxuICAgIGZvciAoXG4gICAgICB2YXIgZmkgPSAwLCBwaSA9IDAsIGZsID0gZmlsZS5sZW5ndGgsIHBsID0gcGF0dGVybi5sZW5ndGg7XG4gICAgICBmaSA8IGZsICYmIHBpIDwgcGw7XG4gICAgICBmaSsrLCBwaSsrXG4gICAgKSB7XG4gICAgICB0aGlzLmRlYnVnKCdtYXRjaE9uZSBsb29wJylcbiAgICAgIHZhciBwID0gcGF0dGVybltwaV1cbiAgICAgIHZhciBmID0gZmlsZVtmaV1cblxuICAgICAgdGhpcy5kZWJ1ZyhwYXR0ZXJuLCBwLCBmKVxuXG4gICAgICAvLyBzaG91bGQgYmUgaW1wb3NzaWJsZS5cbiAgICAgIC8vIHNvbWUgaW52YWxpZCByZWdleHAgc3R1ZmYgaW4gdGhlIHNldC5cbiAgICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgICAgaWYgKHAgPT09IGZhbHNlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgICAgLyogYzggaWdub3JlIHN0b3AgKi9cblxuICAgICAgaWYgKHAgPT09IEdMT0JTVEFSKSB7XG4gICAgICAgIHRoaXMuZGVidWcoJ0dMT0JTVEFSJywgW3BhdHRlcm4sIHAsIGZdKVxuXG4gICAgICAgIC8vIFwiKipcIlxuICAgICAgICAvLyBhLyoqL2IvKiovYyB3b3VsZCBtYXRjaCB0aGUgZm9sbG93aW5nOlxuICAgICAgICAvLyBhL2IveC95L3ovY1xuICAgICAgICAvLyBhL3gveS96L2IvY1xuICAgICAgICAvLyBhL2IveC9iL3gvY1xuICAgICAgICAvLyBhL2IvY1xuICAgICAgICAvLyBUbyBkbyB0aGlzLCB0YWtlIHRoZSByZXN0IG9mIHRoZSBwYXR0ZXJuIGFmdGVyXG4gICAgICAgIC8vIHRoZSAqKiwgYW5kIHNlZSBpZiBpdCB3b3VsZCBtYXRjaCB0aGUgZmlsZSByZW1haW5kZXIuXG4gICAgICAgIC8vIElmIHNvLCByZXR1cm4gc3VjY2Vzcy5cbiAgICAgICAgLy8gSWYgbm90LCB0aGUgKiogXCJzd2FsbG93c1wiIGEgc2VnbWVudCwgYW5kIHRyeSBhZ2Fpbi5cbiAgICAgICAgLy8gVGhpcyBpcyByZWN1cnNpdmVseSBhd2Z1bC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gYS8qKi9iLyoqL2MgbWF0Y2hpbmcgYS9iL3gveS96L2NcbiAgICAgICAgLy8gLSBhIG1hdGNoZXMgYVxuICAgICAgICAvLyAtIGRvdWJsZXN0YXJcbiAgICAgICAgLy8gICAtIG1hdGNoT25lKGIveC95L3ovYywgYi8qKi9jKVxuICAgICAgICAvLyAgICAgLSBiIG1hdGNoZXMgYlxuICAgICAgICAvLyAgICAgLSBkb3VibGVzdGFyXG4gICAgICAgIC8vICAgICAgIC0gbWF0Y2hPbmUoeC95L3ovYywgYykgLT4gbm9cbiAgICAgICAgLy8gICAgICAgLSBtYXRjaE9uZSh5L3ovYywgYykgLT4gbm9cbiAgICAgICAgLy8gICAgICAgLSBtYXRjaE9uZSh6L2MsIGMpIC0+IG5vXG4gICAgICAgIC8vICAgICAgIC0gbWF0Y2hPbmUoYywgYykgeWVzLCBoaXRcbiAgICAgICAgdmFyIGZyID0gZmlcbiAgICAgICAgdmFyIHByID0gcGkgKyAxXG4gICAgICAgIGlmIChwciA9PT0gcGwpIHtcbiAgICAgICAgICB0aGlzLmRlYnVnKCcqKiBhdCB0aGUgZW5kJylcbiAgICAgICAgICAvLyBhICoqIGF0IHRoZSBlbmQgd2lsbCBqdXN0IHN3YWxsb3cgdGhlIHJlc3QuXG4gICAgICAgICAgLy8gV2UgaGF2ZSBmb3VuZCBhIG1hdGNoLlxuICAgICAgICAgIC8vIGhvd2V2ZXIsIGl0IHdpbGwgbm90IHN3YWxsb3cgLy54LCB1bmxlc3NcbiAgICAgICAgICAvLyBvcHRpb25zLmRvdCBpcyBzZXQuXG4gICAgICAgICAgLy8gLiBhbmQgLi4gYXJlICpuZXZlciogbWF0Y2hlZCBieSAqKiwgZm9yIGV4cGxvc2l2ZWx5XG4gICAgICAgICAgLy8gZXhwb25lbnRpYWwgcmVhc29ucy5cbiAgICAgICAgICBmb3IgKDsgZmkgPCBmbDsgZmkrKykge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBmaWxlW2ZpXSA9PT0gJy4nIHx8XG4gICAgICAgICAgICAgIGZpbGVbZmldID09PSAnLi4nIHx8XG4gICAgICAgICAgICAgICghb3B0aW9ucy5kb3QgJiYgZmlsZVtmaV0uY2hhckF0KDApID09PSAnLicpXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gb2ssIGxldCdzIHNlZSBpZiB3ZSBjYW4gc3dhbGxvdyB3aGF0ZXZlciB3ZSBjYW4uXG4gICAgICAgIHdoaWxlIChmciA8IGZsKSB7XG4gICAgICAgICAgdmFyIHN3YWxsb3dlZSA9IGZpbGVbZnJdXG5cbiAgICAgICAgICB0aGlzLmRlYnVnKCdcXG5nbG9ic3RhciB3aGlsZScsIGZpbGUsIGZyLCBwYXR0ZXJuLCBwciwgc3dhbGxvd2VlKVxuXG4gICAgICAgICAgLy8gWFhYIHJlbW92ZSB0aGlzIHNsaWNlLiAgSnVzdCBwYXNzIHRoZSBzdGFydCBpbmRleC5cbiAgICAgICAgICBpZiAodGhpcy5tYXRjaE9uZShmaWxlLnNsaWNlKGZyKSwgcGF0dGVybi5zbGljZShwciksIHBhcnRpYWwpKSB7XG4gICAgICAgICAgICB0aGlzLmRlYnVnKCdnbG9ic3RhciBmb3VuZCBtYXRjaCEnLCBmciwgZmwsIHN3YWxsb3dlZSlcbiAgICAgICAgICAgIC8vIGZvdW5kIGEgbWF0Y2guXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjYW4ndCBzd2FsbG93IFwiLlwiIG9yIFwiLi5cIiBldmVyLlxuICAgICAgICAgICAgLy8gY2FuIG9ubHkgc3dhbGxvdyBcIi5mb29cIiB3aGVuIGV4cGxpY2l0bHkgYXNrZWQuXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIHN3YWxsb3dlZSA9PT0gJy4nIHx8XG4gICAgICAgICAgICAgIHN3YWxsb3dlZSA9PT0gJy4uJyB8fFxuICAgICAgICAgICAgICAoIW9wdGlvbnMuZG90ICYmIHN3YWxsb3dlZS5jaGFyQXQoMCkgPT09ICcuJylcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICB0aGlzLmRlYnVnKCdkb3QgZGV0ZWN0ZWQhJywgZmlsZSwgZnIsIHBhdHRlcm4sIHByKVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyAqKiBzd2FsbG93cyBhIHNlZ21lbnQsIGFuZCBjb250aW51ZS5cbiAgICAgICAgICAgIHRoaXMuZGVidWcoJ2dsb2JzdGFyIHN3YWxsb3cgYSBzZWdtZW50LCBhbmQgY29udGludWUnKVxuICAgICAgICAgICAgZnIrK1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vIG1hdGNoIHdhcyBmb3VuZC5cbiAgICAgICAgLy8gSG93ZXZlciwgaW4gcGFydGlhbCBtb2RlLCB3ZSBjYW4ndCBzYXkgdGhpcyBpcyBuZWNlc3NhcmlseSBvdmVyLlxuICAgICAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICAgICAgaWYgKHBhcnRpYWwpIHtcbiAgICAgICAgICAvLyByYW4gb3V0IG9mIGZpbGVcbiAgICAgICAgICB0aGlzLmRlYnVnKCdcXG4+Pj4gbm8gbWF0Y2gsIHBhcnRpYWw/JywgZmlsZSwgZnIsIHBhdHRlcm4sIHByKVxuICAgICAgICAgIGlmIChmciA9PT0gZmwpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuXG4gICAgICAvLyBzb21ldGhpbmcgb3RoZXIgdGhhbiAqKlxuICAgICAgLy8gbm9uLW1hZ2ljIHBhdHRlcm5zIGp1c3QgaGF2ZSB0byBtYXRjaCBleGFjdGx5XG4gICAgICAvLyBwYXR0ZXJucyB3aXRoIG1hZ2ljIGhhdmUgYmVlbiB0dXJuZWQgaW50byByZWdleHBzLlxuICAgICAgbGV0IGhpdDogYm9vbGVhblxuICAgICAgaWYgKHR5cGVvZiBwID09PSAnc3RyaW5nJykge1xuICAgICAgICBoaXQgPSBmID09PSBwXG4gICAgICAgIHRoaXMuZGVidWcoJ3N0cmluZyBtYXRjaCcsIHAsIGYsIGhpdClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhpdCA9IHAudGVzdChmKVxuICAgICAgICB0aGlzLmRlYnVnKCdwYXR0ZXJuIG1hdGNoJywgcCwgZiwgaGl0KVxuICAgICAgfVxuXG4gICAgICBpZiAoIWhpdCkgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgLy8gTm90ZTogZW5kaW5nIGluIC8gbWVhbnMgdGhhdCB3ZSdsbCBnZXQgYSBmaW5hbCBcIlwiXG4gICAgLy8gYXQgdGhlIGVuZCBvZiB0aGUgcGF0dGVybi4gIFRoaXMgY2FuIG9ubHkgbWF0Y2ggYVxuICAgIC8vIGNvcnJlc3BvbmRpbmcgXCJcIiBhdCB0aGUgZW5kIG9mIHRoZSBmaWxlLlxuICAgIC8vIElmIHRoZSBmaWxlIGVuZHMgaW4gLywgdGhlbiBpdCBjYW4gb25seSBtYXRjaCBhXG4gICAgLy8gYSBwYXR0ZXJuIHRoYXQgZW5kcyBpbiAvLCB1bmxlc3MgdGhlIHBhdHRlcm4ganVzdFxuICAgIC8vIGRvZXNuJ3QgaGF2ZSBhbnkgbW9yZSBmb3IgaXQuIEJ1dCwgYS9iLyBzaG91bGQgKm5vdCpcbiAgICAvLyBtYXRjaCBcImEvYi8qXCIsIGV2ZW4gdGhvdWdoIFwiXCIgbWF0Y2hlcyBhZ2FpbnN0IHRoZVxuICAgIC8vIFteL10qPyBwYXR0ZXJuLCBleGNlcHQgaW4gcGFydGlhbCBtb2RlLCB3aGVyZSBpdCBtaWdodFxuICAgIC8vIHNpbXBseSBub3QgYmUgcmVhY2hlZCB5ZXQuXG4gICAgLy8gSG93ZXZlciwgYS9iLyBzaG91bGQgc3RpbGwgc2F0aXNmeSBhLypcblxuICAgIC8vIG5vdyBlaXRoZXIgd2UgZmVsbCBvZmYgdGhlIGVuZCBvZiB0aGUgcGF0dGVybiwgb3Igd2UncmUgZG9uZS5cbiAgICBpZiAoZmkgPT09IGZsICYmIHBpID09PSBwbCkge1xuICAgICAgLy8gcmFuIG91dCBvZiBwYXR0ZXJuIGFuZCBmaWxlbmFtZSBhdCB0aGUgc2FtZSB0aW1lLlxuICAgICAgLy8gYW4gZXhhY3QgaGl0IVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9IGVsc2UgaWYgKGZpID09PSBmbCkge1xuICAgICAgLy8gcmFuIG91dCBvZiBmaWxlLCBidXQgc3RpbGwgaGFkIHBhdHRlcm4gbGVmdC5cbiAgICAgIC8vIHRoaXMgaXMgb2sgaWYgd2UncmUgZG9pbmcgdGhlIG1hdGNoIGFzIHBhcnQgb2ZcbiAgICAgIC8vIGEgZ2xvYiBmcyB0cmF2ZXJzYWwuXG4gICAgICByZXR1cm4gcGFydGlhbFxuICAgIH0gZWxzZSBpZiAocGkgPT09IHBsKSB7XG4gICAgICAvLyByYW4gb3V0IG9mIHBhdHRlcm4sIHN0aWxsIGhhdmUgZmlsZSBsZWZ0LlxuICAgICAgLy8gdGhpcyBpcyBvbmx5IGFjY2VwdGFibGUgaWYgd2UncmUgb24gdGhlIHZlcnkgbGFzdFxuICAgICAgLy8gZW1wdHkgc2VnbWVudCBvZiBhIGZpbGUgd2l0aCBhIHRyYWlsaW5nIHNsYXNoLlxuICAgICAgLy8gYS8qIHNob3VsZCBtYXRjaCBhL2IvXG4gICAgICByZXR1cm4gZmkgPT09IGZsIC0gMSAmJiBmaWxlW2ZpXSA9PT0gJydcblxuICAgICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHNob3VsZCBiZSB1bnJlYWNoYWJsZS5cbiAgICAgIHRocm93IG5ldyBFcnJvcignd3RmPycpXG4gICAgfVxuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gIH1cblxuICBicmFjZUV4cGFuZCgpIHtcbiAgICByZXR1cm4gYnJhY2VFeHBhbmQodGhpcy5wYXR0ZXJuLCB0aGlzLm9wdGlvbnMpXG4gIH1cblxuICBwYXJzZShwYXR0ZXJuOiBzdHJpbmcpOiBQYXJzZVJldHVybiB7XG4gICAgYXNzZXJ0VmFsaWRQYXR0ZXJuKHBhdHRlcm4pXG5cbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zXG5cbiAgICAvLyBzaG9ydGN1dHNcbiAgICBpZiAocGF0dGVybiA9PT0gJyoqJykgcmV0dXJuIEdMT0JTVEFSXG4gICAgaWYgKHBhdHRlcm4gPT09ICcnKSByZXR1cm4gJydcblxuICAgIC8vIGZhciBhbmQgYXdheSwgdGhlIG1vc3QgY29tbW9uIGdsb2IgcGF0dGVybiBwYXJ0cyBhcmVcbiAgICAvLyAqLCAqLiosIGFuZCAqLjxleHQ+ICBBZGQgYSBmYXN0IGNoZWNrIG1ldGhvZCBmb3IgdGhvc2UuXG4gICAgbGV0IG06IFJlZ0V4cE1hdGNoQXJyYXkgfCBudWxsXG4gICAgbGV0IGZhc3RUZXN0OiBudWxsIHwgKChmOiBzdHJpbmcpID0+IGJvb2xlYW4pID0gbnVsbFxuICAgIGlmICgobSA9IHBhdHRlcm4ubWF0Y2goc3RhclJFKSkpIHtcbiAgICAgIGZhc3RUZXN0ID0gb3B0aW9ucy5kb3QgPyBzdGFyVGVzdERvdCA6IHN0YXJUZXN0XG4gICAgfSBlbHNlIGlmICgobSA9IHBhdHRlcm4ubWF0Y2goc3RhckRvdEV4dFJFKSkpIHtcbiAgICAgIGZhc3RUZXN0ID0gKFxuICAgICAgICBvcHRpb25zLm5vY2FzZVxuICAgICAgICAgID8gb3B0aW9ucy5kb3RcbiAgICAgICAgICAgID8gc3RhckRvdEV4dFRlc3ROb2Nhc2VEb3RcbiAgICAgICAgICAgIDogc3RhckRvdEV4dFRlc3ROb2Nhc2VcbiAgICAgICAgICA6IG9wdGlvbnMuZG90XG4gICAgICAgICAgICA/IHN0YXJEb3RFeHRUZXN0RG90XG4gICAgICAgICAgICA6IHN0YXJEb3RFeHRUZXN0XG4gICAgICApKG1bMV0pXG4gICAgfSBlbHNlIGlmICgobSA9IHBhdHRlcm4ubWF0Y2gocW1hcmtzUkUpKSkge1xuICAgICAgZmFzdFRlc3QgPSAoXG4gICAgICAgIG9wdGlvbnMubm9jYXNlXG4gICAgICAgICAgPyBvcHRpb25zLmRvdFxuICAgICAgICAgICAgPyBxbWFya3NUZXN0Tm9jYXNlRG90XG4gICAgICAgICAgICA6IHFtYXJrc1Rlc3ROb2Nhc2VcbiAgICAgICAgICA6IG9wdGlvbnMuZG90XG4gICAgICAgICAgICA/IHFtYXJrc1Rlc3REb3RcbiAgICAgICAgICAgIDogcW1hcmtzVGVzdFxuICAgICAgKShtKVxuICAgIH0gZWxzZSBpZiAoKG0gPSBwYXR0ZXJuLm1hdGNoKHN0YXJEb3RTdGFyUkUpKSkge1xuICAgICAgZmFzdFRlc3QgPSBvcHRpb25zLmRvdCA/IHN0YXJEb3RTdGFyVGVzdERvdCA6IHN0YXJEb3RTdGFyVGVzdFxuICAgIH0gZWxzZSBpZiAoKG0gPSBwYXR0ZXJuLm1hdGNoKGRvdFN0YXJSRSkpKSB7XG4gICAgICBmYXN0VGVzdCA9IGRvdFN0YXJUZXN0XG4gICAgfVxuXG4gICAgY29uc3QgcmUgPSBBU1QuZnJvbUdsb2IocGF0dGVybiwgdGhpcy5vcHRpb25zKS50b01NUGF0dGVybigpXG4gICAgaWYgKGZhc3RUZXN0ICYmIHR5cGVvZiByZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIC8vIEF2b2lkcyBvdmVycmlkaW5nIGluIGZyb3plbiBlbnZpcm9ubWVudHNcbiAgICAgIFJlZmxlY3QuZGVmaW5lUHJvcGVydHkocmUsICd0ZXN0JywgeyB2YWx1ZTogZmFzdFRlc3QgfSlcbiAgICB9XG4gICAgcmV0dXJuIHJlXG4gIH1cblxuICBtYWtlUmUoKSB7XG4gICAgaWYgKHRoaXMucmVnZXhwIHx8IHRoaXMucmVnZXhwID09PSBmYWxzZSkgcmV0dXJuIHRoaXMucmVnZXhwXG5cbiAgICAvLyBhdCB0aGlzIHBvaW50LCB0aGlzLnNldCBpcyBhIDJkIGFycmF5IG9mIHBhcnRpYWxcbiAgICAvLyBwYXR0ZXJuIHN0cmluZ3MsIG9yIFwiKipcIi5cbiAgICAvL1xuICAgIC8vIEl0J3MgYmV0dGVyIHRvIHVzZSAubWF0Y2goKS4gIFRoaXMgZnVuY3Rpb24gc2hvdWxkbid0XG4gICAgLy8gYmUgdXNlZCwgcmVhbGx5LCBidXQgaXQncyBwcmV0dHkgY29udmVuaWVudCBzb21ldGltZXMsXG4gICAgLy8gd2hlbiB5b3UganVzdCB3YW50IHRvIHdvcmsgd2l0aCBhIHJlZ2V4LlxuICAgIGNvbnN0IHNldCA9IHRoaXMuc2V0XG5cbiAgICBpZiAoIXNldC5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVnZXhwID0gZmFsc2VcbiAgICAgIHJldHVybiB0aGlzLnJlZ2V4cFxuICAgIH1cbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zXG5cbiAgICBjb25zdCB0d29TdGFyID0gb3B0aW9ucy5ub2dsb2JzdGFyXG4gICAgICA/IHN0YXJcbiAgICAgIDogb3B0aW9ucy5kb3RcbiAgICAgICAgPyB0d29TdGFyRG90XG4gICAgICAgIDogdHdvU3Rhck5vRG90XG4gICAgY29uc3QgZmxhZ3MgPSBuZXcgU2V0KG9wdGlvbnMubm9jYXNlID8gWydpJ10gOiBbXSlcblxuICAgIC8vIHJlZ2V4cGlmeSBub24tZ2xvYnN0YXIgcGF0dGVybnNcbiAgICAvLyBpZiAqKiBpcyBvbmx5IGl0ZW0sIHRoZW4gd2UganVzdCBkbyBvbmUgdHdvU3RhclxuICAgIC8vIGlmICoqIGlzIGZpcnN0LCBhbmQgdGhlcmUgYXJlIG1vcmUsIHByZXBlbmQgKFxcL3x0d29TdGFyXFwvKT8gdG8gbmV4dFxuICAgIC8vIGlmICoqIGlzIGxhc3QsIGFwcGVuZCAoXFwvdHdvU3RhcnwpIHRvIHByZXZpb3VzXG4gICAgLy8gaWYgKiogaXMgaW4gdGhlIG1pZGRsZSwgYXBwZW5kIChcXC98XFwvdHdvU3RhclxcLykgdG8gcHJldmlvdXNcbiAgICAvLyB0aGVuIGZpbHRlciBvdXQgR0xPQlNUQVIgc3ltYm9sc1xuICAgIGxldCByZSA9IHNldFxuICAgICAgLm1hcChwYXR0ZXJuID0+IHtcbiAgICAgICAgY29uc3QgcHA6IChzdHJpbmcgfCB0eXBlb2YgR0xPQlNUQVIpW10gPSBwYXR0ZXJuLm1hcChwID0+IHtcbiAgICAgICAgICBpZiAocCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBmIG9mIHAuZmxhZ3Muc3BsaXQoJycpKSBmbGFncy5hZGQoZilcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHR5cGVvZiBwID09PSAnc3RyaW5nJ1xuICAgICAgICAgICAgPyByZWdFeHBFc2NhcGUocClcbiAgICAgICAgICAgIDogcCA9PT0gR0xPQlNUQVJcbiAgICAgICAgICAgICAgPyBHTE9CU1RBUlxuICAgICAgICAgICAgICA6IHAuX3NyY1xuICAgICAgICB9KSBhcyAoc3RyaW5nIHwgdHlwZW9mIEdMT0JTVEFSKVtdXG4gICAgICAgIHBwLmZvckVhY2goKHAsIGkpID0+IHtcbiAgICAgICAgICBjb25zdCBuZXh0ID0gcHBbaSArIDFdXG4gICAgICAgICAgY29uc3QgcHJldiA9IHBwW2kgLSAxXVxuICAgICAgICAgIGlmIChwICE9PSBHTE9CU1RBUiB8fCBwcmV2ID09PSBHTE9CU1RBUikge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwcmV2ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChuZXh0ICE9PSB1bmRlZmluZWQgJiYgbmV4dCAhPT0gR0xPQlNUQVIpIHtcbiAgICAgICAgICAgICAgcHBbaSArIDFdID0gJyg/OlxcXFwvfCcgKyB0d29TdGFyICsgJ1xcXFwvKT8nICsgbmV4dFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcHBbaV0gPSB0d29TdGFyXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChuZXh0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHBwW2kgLSAxXSA9IHByZXYgKyAnKD86XFxcXC98XFxcXC8nICsgdHdvU3RhciArICcpPydcbiAgICAgICAgICB9IGVsc2UgaWYgKG5leHQgIT09IEdMT0JTVEFSKSB7XG4gICAgICAgICAgICBwcFtpIC0gMV0gPSBwcmV2ICsgJyg/OlxcXFwvfFxcXFwvJyArIHR3b1N0YXIgKyAnXFxcXC8pJyArIG5leHRcbiAgICAgICAgICAgIHBwW2kgKyAxXSA9IEdMT0JTVEFSXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBjb25zdCBmaWx0ZXJlZCA9IHBwLmZpbHRlcihwID0+IHAgIT09IEdMT0JTVEFSKVxuXG4gICAgICAgIC8vIEZvciBwYXJ0aWFsIG1hdGNoZXMsIHdlIG5lZWQgdG8gbWFrZSB0aGUgcGF0dGVybiBtYXRjaFxuICAgICAgICAvLyBhbnkgcHJlZml4IG9mIHRoZSBmdWxsIHBhdGguIFdlIGRvIHRoaXMgYnkgZ2VuZXJhdGluZ1xuICAgICAgICAvLyBhbHRlcm5hdGl2ZSBwYXR0ZXJucyB0aGF0IG1hdGNoIHByb2dyZXNzaXZlbHkgbG9uZ2VyIHByZWZpeGVzLlxuICAgICAgICBpZiAodGhpcy5wYXJ0aWFsICYmIGZpbHRlcmVkLmxlbmd0aCA+PSAxKSB7XG4gICAgICAgICAgY29uc3QgcHJlZml4ZXM6IHN0cmluZ1tdID0gW11cbiAgICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8PSBmaWx0ZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgcHJlZml4ZXMucHVzaChmaWx0ZXJlZC5zbGljZSgwLCBpKS5qb2luKCcvJykpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiAnKD86JyArIHByZWZpeGVzLmpvaW4oJ3wnKSArICcpJ1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZpbHRlcmVkLmpvaW4oJy8nKVxuICAgICAgfSlcbiAgICAgIC5qb2luKCd8JylcblxuICAgIC8vIG5lZWQgdG8gd3JhcCBpbiBwYXJlbnMgaWYgd2UgaGFkIG1vcmUgdGhhbiBvbmUgdGhpbmcgd2l0aCB8LFxuICAgIC8vIG90aGVyd2lzZSBvbmx5IHRoZSBmaXJzdCB3aWxsIGJlIGFuY2hvcmVkIHRvIF4gYW5kIHRoZSBsYXN0IHRvICRcbiAgICBjb25zdCBbb3BlbiwgY2xvc2VdID0gc2V0Lmxlbmd0aCA+IDEgPyBbJyg/OicsICcpJ10gOiBbJycsICcnXVxuICAgIC8vIG11c3QgbWF0Y2ggZW50aXJlIHBhdHRlcm5cbiAgICAvLyBlbmRpbmcgaW4gYSAqIG9yICoqIHdpbGwgbWFrZSBpdCBsZXNzIHN0cmljdC5cbiAgICByZSA9ICdeJyArIG9wZW4gKyByZSArIGNsb3NlICsgJyQnXG5cbiAgICAvLyBJbiBwYXJ0aWFsIG1vZGUsICcvJyBzaG91bGQgYWx3YXlzIG1hdGNoIGFzIGl0J3MgYSB2YWxpZCBwcmVmaXggZm9yIGFueSBwYXR0ZXJuXG4gICAgaWYgKHRoaXMucGFydGlhbCkge1xuICAgICAgcmUgPSAnXig/OlxcXFwvfCcgKyBvcGVuICsgcmUuc2xpY2UoMSwgLTEpICsgY2xvc2UgKyAnKSQnXG4gICAgfVxuXG4gICAgLy8gY2FuIG1hdGNoIGFueXRoaW5nLCBhcyBsb25nIGFzIGl0J3Mgbm90IHRoaXMuXG4gICAgaWYgKHRoaXMubmVnYXRlKSByZSA9ICdeKD8hJyArIHJlICsgJykuKyQnXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5yZWdleHAgPSBuZXcgUmVnRXhwKHJlLCBbLi4uZmxhZ3NdLmpvaW4oJycpKVxuICAgICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIC8vIHNob3VsZCBiZSBpbXBvc3NpYmxlXG4gICAgICB0aGlzLnJlZ2V4cCA9IGZhbHNlXG4gICAgfVxuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgcmV0dXJuIHRoaXMucmVnZXhwXG4gIH1cblxuICBzbGFzaFNwbGl0KHA6IHN0cmluZykge1xuICAgIC8vIGlmIHAgc3RhcnRzIHdpdGggLy8gb24gd2luZG93cywgd2UgcHJlc2VydmUgdGhhdFxuICAgIC8vIHNvIHRoYXQgVU5DIHBhdGhzIGFyZW4ndCBicm9rZW4uICBPdGhlcndpc2UsIGFueSBudW1iZXIgb2ZcbiAgICAvLyAvIGNoYXJhY3RlcnMgYXJlIGNvYWxlc2NlZCBpbnRvIG9uZSwgdW5sZXNzXG4gICAgLy8gcHJlc2VydmVNdWx0aXBsZVNsYXNoZXMgaXMgc2V0IHRvIHRydWUuXG4gICAgaWYgKHRoaXMucHJlc2VydmVNdWx0aXBsZVNsYXNoZXMpIHtcbiAgICAgIHJldHVybiBwLnNwbGl0KCcvJylcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXNXaW5kb3dzICYmIC9eXFwvXFwvW15cXC9dKy8udGVzdChwKSkge1xuICAgICAgLy8gYWRkIGFuIGV4dHJhICcnIGZvciB0aGUgb25lIHdlIGxvc2VcbiAgICAgIHJldHVybiBbJycsIC4uLnAuc3BsaXQoL1xcLysvKV1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHAuc3BsaXQoL1xcLysvKVxuICAgIH1cbiAgfVxuXG4gIG1hdGNoKGY6IHN0cmluZywgcGFydGlhbCA9IHRoaXMucGFydGlhbCkge1xuICAgIHRoaXMuZGVidWcoJ21hdGNoJywgZiwgdGhpcy5wYXR0ZXJuKVxuICAgIC8vIHNob3J0LWNpcmN1aXQgaW4gdGhlIGNhc2Ugb2YgYnVzdGVkIHRoaW5ncy5cbiAgICAvLyBjb21tZW50cywgZXRjLlxuICAgIGlmICh0aGlzLmNvbW1lbnQpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBpZiAodGhpcy5lbXB0eSkge1xuICAgICAgcmV0dXJuIGYgPT09ICcnXG4gICAgfVxuXG4gICAgaWYgKGYgPT09ICcvJyAmJiBwYXJ0aWFsKSB7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnNcblxuICAgIC8vIHdpbmRvd3M6IG5lZWQgdG8gdXNlIC8sIG5vdCBcXFxuICAgIGlmICh0aGlzLmlzV2luZG93cykge1xuICAgICAgZiA9IGYuc3BsaXQoJ1xcXFwnKS5qb2luKCcvJylcbiAgICB9XG5cbiAgICAvLyB0cmVhdCB0aGUgdGVzdCBwYXRoIGFzIGEgc2V0IG9mIHBhdGhwYXJ0cy5cbiAgICBjb25zdCBmZiA9IHRoaXMuc2xhc2hTcGxpdChmKVxuICAgIHRoaXMuZGVidWcodGhpcy5wYXR0ZXJuLCAnc3BsaXQnLCBmZilcblxuICAgIC8vIGp1c3QgT05FIG9mIHRoZSBwYXR0ZXJuIHNldHMgaW4gdGhpcy5zZXQgbmVlZHMgdG8gbWF0Y2hcbiAgICAvLyBpbiBvcmRlciBmb3IgaXQgdG8gYmUgdmFsaWQuICBJZiBuZWdhdGluZywgdGhlbiBqdXN0IG9uZVxuICAgIC8vIG1hdGNoIG1lYW5zIHRoYXQgd2UgaGF2ZSBmYWlsZWQuXG4gICAgLy8gRWl0aGVyIHdheSwgcmV0dXJuIG9uIHRoZSBmaXJzdCBoaXQuXG5cbiAgICBjb25zdCBzZXQgPSB0aGlzLnNldFxuICAgIHRoaXMuZGVidWcodGhpcy5wYXR0ZXJuLCAnc2V0Jywgc2V0KVxuXG4gICAgLy8gRmluZCB0aGUgYmFzZW5hbWUgb2YgdGhlIHBhdGggYnkgbG9va2luZyBmb3IgdGhlIGxhc3Qgbm9uLWVtcHR5IHNlZ21lbnRcbiAgICBsZXQgZmlsZW5hbWU6IHN0cmluZyA9IGZmW2ZmLmxlbmd0aCAtIDFdXG4gICAgaWYgKCFmaWxlbmFtZSkge1xuICAgICAgZm9yIChsZXQgaSA9IGZmLmxlbmd0aCAtIDI7ICFmaWxlbmFtZSAmJiBpID49IDA7IGktLSkge1xuICAgICAgICBmaWxlbmFtZSA9IGZmW2ldXG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZXQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHBhdHRlcm4gPSBzZXRbaV1cbiAgICAgIGxldCBmaWxlID0gZmZcbiAgICAgIGlmIChvcHRpb25zLm1hdGNoQmFzZSAmJiBwYXR0ZXJuLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBmaWxlID0gW2ZpbGVuYW1lXVxuICAgICAgfVxuICAgICAgY29uc3QgaGl0ID0gdGhpcy5tYXRjaE9uZShmaWxlLCBwYXR0ZXJuLCBwYXJ0aWFsKVxuICAgICAgaWYgKGhpdCkge1xuICAgICAgICBpZiAob3B0aW9ucy5mbGlwTmVnYXRlKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gIXRoaXMubmVnYXRlXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZGlkbid0IGdldCBhbnkgaGl0cy4gIHRoaXMgaXMgc3VjY2VzcyBpZiBpdCdzIGEgbmVnYXRpdmVcbiAgICAvLyBwYXR0ZXJuLCBmYWlsdXJlIG90aGVyd2lzZS5cbiAgICBpZiAob3B0aW9ucy5mbGlwTmVnYXRlKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubmVnYXRlXG4gIH1cblxuICBzdGF0aWMgZGVmYXVsdHMoZGVmOiBNaW5pbWF0Y2hPcHRpb25zKSB7XG4gICAgcmV0dXJuIG1pbmltYXRjaC5kZWZhdWx0cyhkZWYpLk1pbmltYXRjaFxuICB9XG59XG4vKiBjOCBpZ25vcmUgc3RhcnQgKi9cbmV4cG9ydCB7IEFTVCB9IGZyb20gJy4vYXN0LmpzJ1xuZXhwb3J0IHsgZXNjYXBlIH0gZnJvbSAnLi9lc2NhcGUuanMnXG5leHBvcnQgeyB1bmVzY2FwZSB9IGZyb20gJy4vdW5lc2NhcGUuanMnXG4vKiBjOCBpZ25vcmUgc3RvcCAqL1xubWluaW1hdGNoLkFTVCA9IEFTVFxubWluaW1hdGNoLk1pbmltYXRjaCA9IE1pbmltYXRjaFxubWluaW1hdGNoLmVzY2FwZSA9IGVzY2FwZVxubWluaW1hdGNoLnVuZXNjYXBlID0gdW5lc2NhcGVcbiIsICJpbXBvcnQgeyBNaW5pbWF0Y2gsIE1pbmltYXRjaE9wdGlvbnMgfSBmcm9tICdtaW5pbWF0Y2gnXG5pbXBvcnQgeyBNaW5pcGFzcyB9IGZyb20gJ21pbmlwYXNzJ1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJ1xuaW1wb3J0IHtcbiAgRlNPcHRpb24sXG4gIFBhdGgsXG4gIFBhdGhTY3VycnksXG4gIFBhdGhTY3VycnlEYXJ3aW4sXG4gIFBhdGhTY3VycnlQb3NpeCxcbiAgUGF0aFNjdXJyeVdpbjMyLFxufSBmcm9tICdwYXRoLXNjdXJyeSdcbmltcG9ydCB7IElnbm9yZUxpa2UgfSBmcm9tICcuL2lnbm9yZS5qcydcbmltcG9ydCB7IFBhdHRlcm4gfSBmcm9tICcuL3BhdHRlcm4uanMnXG5pbXBvcnQgeyBHbG9iU3RyZWFtLCBHbG9iV2Fsa2VyIH0gZnJvbSAnLi93YWxrZXIuanMnXG5cbmV4cG9ydCB0eXBlIE1hdGNoU2V0ID0gTWluaW1hdGNoWydzZXQnXVxuZXhwb3J0IHR5cGUgR2xvYlBhcnRzID0gRXhjbHVkZTxNaW5pbWF0Y2hbJ2dsb2JQYXJ0cyddLCB1bmRlZmluZWQ+XG5cbi8vIGlmIG5vIHByb2Nlc3MgZ2xvYmFsLCBqdXN0IGNhbGwgaXQgbGludXguXG4vLyBzbyB3ZSBkZWZhdWx0IHRvIGNhc2Utc2Vuc2l0aXZlLCAvIHNlcGFyYXRvcnNcbmNvbnN0IGRlZmF1bHRQbGF0Zm9ybTogTm9kZUpTLlBsYXRmb3JtID1cbiAgKFxuICAgIHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJlxuICAgIHByb2Nlc3MgJiZcbiAgICB0eXBlb2YgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3N0cmluZydcbiAgKSA/XG4gICAgcHJvY2Vzcy5wbGF0Zm9ybVxuICA6ICdsaW51eCdcblxuLyoqXG4gKiBBIGBHbG9iT3B0aW9uc2Agb2JqZWN0IG1heSBiZSBwcm92aWRlZCB0byBhbnkgb2YgdGhlIGV4cG9ydGVkIG1ldGhvZHMsIGFuZFxuICogbXVzdCBiZSBwcm92aWRlZCB0byB0aGUgYEdsb2JgIGNvbnN0cnVjdG9yLlxuICpcbiAqIEFsbCBvcHRpb25zIGFyZSBvcHRpb25hbCwgYm9vbGVhbiwgYW5kIGZhbHNlIGJ5IGRlZmF1bHQsIHVubGVzcyBvdGhlcndpc2VcbiAqIG5vdGVkLlxuICpcbiAqIEFsbCByZXNvbHZlZCBvcHRpb25zIGFyZSBhZGRlZCB0byB0aGUgR2xvYiBvYmplY3QgYXMgcHJvcGVydGllcy5cbiAqXG4gKiBJZiB5b3UgYXJlIHJ1bm5pbmcgbWFueSBgZ2xvYmAgb3BlcmF0aW9ucywgeW91IGNhbiBwYXNzIGEgR2xvYiBvYmplY3QgYXMgdGhlXG4gKiBgb3B0aW9uc2AgYXJndW1lbnQgdG8gYSBzdWJzZXF1ZW50IG9wZXJhdGlvbiB0byBzaGFyZSB0aGUgcHJldmlvdXNseSBsb2FkZWRcbiAqIGNhY2hlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdsb2JPcHRpb25zIHtcbiAgLyoqXG4gICAqIFNldCB0byBgdHJ1ZWAgdG8gYWx3YXlzIHJlY2VpdmUgYWJzb2x1dGUgcGF0aHMgZm9yXG4gICAqIG1hdGNoZWQgZmlsZXMuIFNldCB0byBgZmFsc2VgIHRvIGFsd2F5cyByZXR1cm4gcmVsYXRpdmUgcGF0aHMuXG4gICAqXG4gICAqIFdoZW4gdGhpcyBvcHRpb24gaXMgbm90IHNldCwgYWJzb2x1dGUgcGF0aHMgYXJlIHJldHVybmVkIGZvciBwYXR0ZXJuc1xuICAgKiB0aGF0IGFyZSBhYnNvbHV0ZSwgYW5kIG90aGVyd2lzZSBwYXRocyBhcmUgcmV0dXJuZWQgdGhhdCBhcmUgcmVsYXRpdmVcbiAgICogdG8gdGhlIGBjd2RgIHNldHRpbmcuXG4gICAqXG4gICAqIFRoaXMgZG9lcyBfbm90XyBtYWtlIGFuIGV4dHJhIHN5c3RlbSBjYWxsIHRvIGdldFxuICAgKiB0aGUgcmVhbHBhdGgsIGl0IG9ubHkgZG9lcyBzdHJpbmcgcGF0aCByZXNvbHV0aW9uLlxuICAgKlxuICAgKiBDb25mbGljdHMgd2l0aCB7QGxpbmsgd2l0aEZpbGVUeXBlc31cbiAgICovXG4gIGFic29sdXRlPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBTZXQgdG8gZmFsc2UgdG8gZW5hYmxlIHtAbGluayB3aW5kb3dzUGF0aHNOb0VzY2FwZX1cbiAgICpcbiAgICogQGRlcHJlY2F0ZWRcbiAgICovXG4gIGFsbG93V2luZG93c0VzY2FwZT86IGJvb2xlYW5cblxuICAvKipcbiAgICogVGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkgaW4gd2hpY2ggdG8gc2VhcmNoLiBEZWZhdWx0cyB0b1xuICAgKiBgcHJvY2Vzcy5jd2QoKWAuXG4gICAqXG4gICAqIE1heSBiZSBlaWhlciBhIHN0cmluZyBwYXRoIG9yIGEgYGZpbGU6Ly9gIFVSTCBvYmplY3Qgb3Igc3RyaW5nLlxuICAgKi9cbiAgY3dkPzogc3RyaW5nIHwgVVJMXG5cbiAgLyoqXG4gICAqIEluY2x1ZGUgYC5kb3RgIGZpbGVzIGluIG5vcm1hbCBtYXRjaGVzIGFuZCBgZ2xvYnN0YXJgXG4gICAqIG1hdGNoZXMuIE5vdGUgdGhhdCBhbiBleHBsaWNpdCBkb3QgaW4gYSBwb3J0aW9uIG9mIHRoZSBwYXR0ZXJuXG4gICAqIHdpbGwgYWx3YXlzIG1hdGNoIGRvdCBmaWxlcy5cbiAgICovXG4gIGRvdD86IGJvb2xlYW5cblxuICAvKipcbiAgICogUHJlcGVuZCBhbGwgcmVsYXRpdmUgcGF0aCBzdHJpbmdzIHdpdGggYC4vYCAob3IgYC5cXGAgb24gV2luZG93cykuXG4gICAqXG4gICAqIFdpdGhvdXQgdGhpcyBvcHRpb24sIHJldHVybmVkIHJlbGF0aXZlIHBhdGhzIGFyZSBcImJhcmVcIiwgc28gaW5zdGVhZCBvZlxuICAgKiByZXR1cm5pbmcgYCcuL2Zvby9iYXInYCwgdGhleSBhcmUgcmV0dXJuZWQgYXMgYCdmb28vYmFyJ2AuXG4gICAqXG4gICAqIFJlbGF0aXZlIHBhdHRlcm5zIHN0YXJ0aW5nIHdpdGggYCcuLi8nYCBhcmUgbm90IHByZXBlbmRlZCB3aXRoIGAuL2AsIGV2ZW5cbiAgICogaWYgdGhpcyBvcHRpb24gaXMgc2V0LlxuICAgKi9cbiAgZG90UmVsYXRpdmU/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIEZvbGxvdyBzeW1saW5rZWQgZGlyZWN0b3JpZXMgd2hlbiBleHBhbmRpbmcgYCoqYFxuICAgKiBwYXR0ZXJucy4gVGhpcyBjYW4gcmVzdWx0IGluIGEgbG90IG9mIGR1cGxpY2F0ZSByZWZlcmVuY2VzIGluXG4gICAqIHRoZSBwcmVzZW5jZSBvZiBjeWNsaWMgbGlua3MsIGFuZCBtYWtlIHBlcmZvcm1hbmNlIHF1aXRlIGJhZC5cbiAgICpcbiAgICogQnkgZGVmYXVsdCwgYSBgKipgIGluIGEgcGF0dGVybiB3aWxsIGZvbGxvdyAxIHN5bWJvbGljIGxpbmsgaWZcbiAgICogaXQgaXMgbm90IHRoZSBmaXJzdCBpdGVtIGluIHRoZSBwYXR0ZXJuLCBvciBub25lIGlmIGl0IGlzIHRoZVxuICAgKiBmaXJzdCBpdGVtIGluIHRoZSBwYXR0ZXJuLCBmb2xsb3dpbmcgdGhlIHNhbWUgYmVoYXZpb3IgYXMgQmFzaC5cbiAgICovXG4gIGZvbGxvdz86IGJvb2xlYW5cblxuICAvKipcbiAgICogc3RyaW5nIG9yIHN0cmluZ1tdLCBvciBhbiBvYmplY3Qgd2l0aCBgaWdub3JlZGAgYW5kIGBjaGlsZHJlbklnbm9yZWRgXG4gICAqIG1ldGhvZHMuXG4gICAqXG4gICAqIElmIGEgc3RyaW5nIG9yIHN0cmluZ1tdIGlzIHByb3ZpZGVkLCB0aGVuIHRoaXMgaXMgdHJlYXRlZCBhcyBhIGdsb2JcbiAgICogcGF0dGVybiBvciBhcnJheSBvZiBnbG9iIHBhdHRlcm5zIHRvIGV4Y2x1ZGUgZnJvbSBtYXRjaGVzLiBUbyBpZ25vcmUgYWxsXG4gICAqIGNoaWxkcmVuIHdpdGhpbiBhIGRpcmVjdG9yeSwgYXMgd2VsbCBhcyB0aGUgZW50cnkgaXRzZWxmLCBhcHBlbmQgYCcvKionYFxuICAgKiB0byB0aGUgaWdub3JlIHBhdHRlcm4uXG4gICAqXG4gICAqICoqTm90ZSoqIGBpZ25vcmVgIHBhdHRlcm5zIGFyZSBfYWx3YXlzXyBpbiBgZG90OnRydWVgIG1vZGUsIHJlZ2FyZGxlc3Mgb2ZcbiAgICogYW55IG90aGVyIHNldHRpbmdzLlxuICAgKlxuICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgdGhhdCBoYXMgYGlnbm9yZWQocGF0aClgIGFuZC9vclxuICAgKiBgY2hpbGRyZW5JZ25vcmVkKHBhdGgpYCBtZXRob2RzLCB0aGVuIHRoZXNlIG1ldGhvZHMgd2lsbCBiZSBjYWxsZWQgdG9cbiAgICogZGV0ZXJtaW5lIHdoZXRoZXIgYW55IFBhdGggaXMgYSBtYXRjaCBvciBpZiBpdHMgY2hpbGRyZW4gc2hvdWxkIGJlXG4gICAqIHRyYXZlcnNlZCwgcmVzcGVjdGl2ZWx5LlxuICAgKi9cbiAgaWdub3JlPzogc3RyaW5nIHwgc3RyaW5nW10gfCBJZ25vcmVMaWtlXG5cbiAgLyoqXG4gICAqIFRyZWF0IGJyYWNlIGV4cGFuc2lvbiBsaWtlIGB7YSxifWAgYXMgYSBcIm1hZ2ljXCIgcGF0dGVybi4gSGFzIG5vXG4gICAqIGVmZmVjdCBpZiB7QGxpbmsgbm9icmFjZX0gaXMgc2V0LlxuICAgKlxuICAgKiBPbmx5IGhhcyBlZmZlY3Qgb24gdGhlIHtAbGluayBoYXNNYWdpY30gZnVuY3Rpb24uXG4gICAqL1xuICBtYWdpY2FsQnJhY2VzPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBBZGQgYSBgL2AgY2hhcmFjdGVyIHRvIGRpcmVjdG9yeSBtYXRjaGVzLiBOb3RlIHRoYXQgdGhpcyByZXF1aXJlc1xuICAgKiBhZGRpdGlvbmFsIHN0YXQgY2FsbHMgaW4gc29tZSBjYXNlcy5cbiAgICovXG4gIG1hcms/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gYSBiYXNlbmFtZS1vbmx5IG1hdGNoIGlmIHRoZSBwYXR0ZXJuIGRvZXMgbm90IGNvbnRhaW4gYW55IHNsYXNoXG4gICAqIGNoYXJhY3RlcnMuIFRoYXQgaXMsIGAqLmpzYCB3b3VsZCBiZSB0cmVhdGVkIGFzIGVxdWl2YWxlbnQgdG9cbiAgICogYCoqXFwvKi5qc2AsIG1hdGNoaW5nIGFsbCBqcyBmaWxlcyBpbiBhbGwgZGlyZWN0b3JpZXMuXG4gICAqL1xuICBtYXRjaEJhc2U/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIExpbWl0IHRoZSBkaXJlY3RvcnkgdHJhdmVyc2FsIHRvIGEgZ2l2ZW4gZGVwdGggYmVsb3cgdGhlIGN3ZC5cbiAgICogTm90ZSB0aGF0IHRoaXMgZG9lcyBOT1QgcHJldmVudCB0cmF2ZXJzYWwgdG8gc2libGluZyBmb2xkZXJzLFxuICAgKiByb290IHBhdHRlcm5zLCBhbmQgc28gb24uIEl0IG9ubHkgbGltaXRzIHRoZSBtYXhpbXVtIGZvbGRlciBkZXB0aFxuICAgKiB0aGF0IHRoZSB3YWxrIHdpbGwgZGVzY2VuZCwgcmVsYXRpdmUgdG8gdGhlIGN3ZC5cbiAgICovXG4gIG1heERlcHRoPzogbnVtYmVyXG5cbiAgLyoqXG4gICAqIERvIG5vdCBleHBhbmQgYHthLGJ9YCBhbmQgYHsxLi4zfWAgYnJhY2Ugc2V0cy5cbiAgICovXG4gIG5vYnJhY2U/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gYSBjYXNlLWluc2Vuc2l0aXZlIG1hdGNoLiBUaGlzIGRlZmF1bHRzIHRvIGB0cnVlYCBvbiBtYWNPUyBhbmRcbiAgICogV2luZG93cyBzeXN0ZW1zLCBhbmQgYGZhbHNlYCBvbiBhbGwgb3RoZXJzLlxuICAgKlxuICAgKiAqKk5vdGUqKiBgbm9jYXNlYCBzaG91bGQgb25seSBiZSBleHBsaWNpdGx5IHNldCB3aGVuIGl0IGlzXG4gICAqIGtub3duIHRoYXQgdGhlIGZpbGVzeXN0ZW0ncyBjYXNlIHNlbnNpdGl2aXR5IGRpZmZlcnMgZnJvbSB0aGVcbiAgICogcGxhdGZvcm0gZGVmYXVsdC4gSWYgc2V0IGB0cnVlYCBvbiBjYXNlLXNlbnNpdGl2ZSBmaWxlXG4gICAqIHN5c3RlbXMsIG9yIGBmYWxzZWAgb24gY2FzZS1pbnNlbnNpdGl2ZSBmaWxlIHN5c3RlbXMsIHRoZW4gdGhlXG4gICAqIHdhbGsgbWF5IHJldHVybiBtb3JlIG9yIGxlc3MgcmVzdWx0cyB0aGFuIGV4cGVjdGVkLlxuICAgKi9cbiAgbm9jYXNlPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBEbyBub3QgbWF0Y2ggZGlyZWN0b3JpZXMsIG9ubHkgZmlsZXMuIChOb3RlOiB0byBtYXRjaFxuICAgKiBfb25seV8gZGlyZWN0b3JpZXMsIHB1dCBhIGAvYCBhdCB0aGUgZW5kIG9mIHRoZSBwYXR0ZXJuLilcbiAgICovXG4gIG5vZGlyPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBEbyBub3QgbWF0Y2ggXCJleHRnbG9iXCIgcGF0dGVybnMgc3VjaCBhcyBgKyhhfGIpYC5cbiAgICovXG4gIG5vZXh0PzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBEbyBub3QgbWF0Y2ggYCoqYCBhZ2FpbnN0IG11bHRpcGxlIGZpbGVuYW1lcy4gKEllLCB0cmVhdCBpdCBhcyBhIG5vcm1hbFxuICAgKiBgKmAgaW5zdGVhZC4pXG4gICAqXG4gICAqIENvbmZsaWN0cyB3aXRoIHtAbGluayBtYXRjaEJhc2V9XG4gICAqL1xuICBub2dsb2JzdGFyPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBEZWZhdWx0cyB0byB2YWx1ZSBvZiBgcHJvY2Vzcy5wbGF0Zm9ybWAgaWYgYXZhaWxhYmxlLCBvciBgJ2xpbnV4J2AgaWZcbiAgICogbm90LiBTZXR0aW5nIGBwbGF0Zm9ybTond2luMzInYCBvbiBub24tV2luZG93cyBzeXN0ZW1zIG1heSBjYXVzZSBzdHJhbmdlXG4gICAqIGJlaGF2aW9yLlxuICAgKi9cbiAgcGxhdGZvcm0/OiBOb2RlSlMuUGxhdGZvcm1cblxuICAvKipcbiAgICogU2V0IHRvIHRydWUgdG8gY2FsbCBgZnMucmVhbHBhdGhgIG9uIGFsbCBvZiB0aGVcbiAgICogcmVzdWx0cy4gSW4gdGhlIGNhc2Ugb2YgYW4gZW50cnkgdGhhdCBjYW5ub3QgYmUgcmVzb2x2ZWQsIHRoZVxuICAgKiBlbnRyeSBpcyBvbWl0dGVkLiBUaGlzIGluY3VycyBhIHNsaWdodCBwZXJmb3JtYW5jZSBwZW5hbHR5LCBvZlxuICAgKiBjb3Vyc2UsIGJlY2F1c2Ugb2YgdGhlIGFkZGVkIHN5c3RlbSBjYWxscy5cbiAgICovXG4gIHJlYWxwYXRoPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKlxuICAgKiBBIHN0cmluZyBwYXRoIHJlc29sdmVkIGFnYWluc3QgdGhlIGBjd2RgIG9wdGlvbiwgd2hpY2hcbiAgICogaXMgdXNlZCBhcyB0aGUgc3RhcnRpbmcgcG9pbnQgZm9yIGFic29sdXRlIHBhdHRlcm5zIHRoYXQgc3RhcnRcbiAgICogd2l0aCBgL2AsIChidXQgbm90IGRyaXZlIGxldHRlcnMgb3IgVU5DIHBhdGhzIG9uIFdpbmRvd3MpLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBfZG9lc24ndF8gbmVjZXNzYXJpbHkgbGltaXQgdGhlIHdhbGsgdG8gdGhlXG4gICAqIGByb290YCBkaXJlY3RvcnksIGFuZCBkb2Vzbid0IGFmZmVjdCB0aGUgY3dkIHN0YXJ0aW5nIHBvaW50IGZvclxuICAgKiBub24tYWJzb2x1dGUgcGF0dGVybnMuIEEgcGF0dGVybiBjb250YWluaW5nIGAuLmAgd2lsbCBzdGlsbCBiZVxuICAgKiBhYmxlIHRvIHRyYXZlcnNlIG91dCBvZiB0aGUgcm9vdCBkaXJlY3RvcnksIGlmIGl0IGlzIG5vdCBhblxuICAgKiBhY3R1YWwgcm9vdCBkaXJlY3Rvcnkgb24gdGhlIGZpbGVzeXN0ZW0sIGFuZCBhbnkgbm9uLWFic29sdXRlXG4gICAqIHBhdHRlcm5zIHdpbGwgYmUgbWF0Y2hlZCBpbiB0aGUgYGN3ZGAuIEZvciBleGFtcGxlLCB0aGVcbiAgICogcGF0dGVybiBgLy4uLypgIHdpdGggYHtyb290Oicvc29tZS9wYXRoJ31gIHdpbGwgcmV0dXJuIGFsbFxuICAgKiBmaWxlcyBpbiBgL3NvbWVgLCBub3QgYWxsIGZpbGVzIGluIGAvc29tZS9wYXRoYC4gVGhlIHBhdHRlcm5cbiAgICogYCpgIHdpdGggYHtyb290Oicvc29tZS9wYXRoJ31gIHdpbGwgcmV0dXJuIGFsbCB0aGUgZW50cmllcyBpblxuICAgKiB0aGUgY3dkLCBub3QgdGhlIGVudHJpZXMgaW4gYC9zb21lL3BhdGhgLlxuICAgKlxuICAgKiBUbyBzdGFydCBhYnNvbHV0ZSBhbmQgbm9uLWFic29sdXRlIHBhdHRlcm5zIGluIHRoZSBzYW1lXG4gICAqIHBhdGgsIHlvdSBjYW4gdXNlIGB7cm9vdDonJ31gLiBIb3dldmVyLCBiZSBhd2FyZSB0aGF0IG9uXG4gICAqIFdpbmRvd3Mgc3lzdGVtcywgYSBwYXR0ZXJuIGxpa2UgYHg6LypgIG9yIGAvL2hvc3Qvc2hhcmUvKmAgd2lsbFxuICAgKiBfYWx3YXlzXyBzdGFydCBpbiB0aGUgYHg6L2Agb3IgYC8vaG9zdC9zaGFyZWAgZGlyZWN0b3J5LFxuICAgKiByZWdhcmRsZXNzIG9mIHRoZSBgcm9vdGAgc2V0dGluZy5cbiAgICovXG4gIHJvb3Q/OiBzdHJpbmdcblxuICAvKipcbiAgICogQSBbUGF0aFNjdXJyeV0oaHR0cDovL25wbS5pbS9wYXRoLXNjdXJyeSkgb2JqZWN0IHVzZWRcbiAgICogdG8gdHJhdmVyc2UgdGhlIGZpbGUgc3lzdGVtLiBJZiB0aGUgYG5vY2FzZWAgb3B0aW9uIGlzIHNldFxuICAgKiBleHBsaWNpdGx5LCB0aGVuIGFueSBwcm92aWRlZCBgc2N1cnJ5YCBvYmplY3QgbXVzdCBtYXRjaCB0aGlzXG4gICAqIHNldHRpbmcuXG4gICAqL1xuICBzY3Vycnk/OiBQYXRoU2N1cnJ5XG5cbiAgLyoqXG4gICAqIENhbGwgYGxzdGF0KClgIG9uIGFsbCBlbnRyaWVzLCB3aGV0aGVyIHJlcXVpcmVkIG9yIG5vdCB0byBkZXRlcm1pbmVcbiAgICogaWYgaXQncyBhIHZhbGlkIG1hdGNoLiBXaGVuIHVzZWQgd2l0aCB7QGxpbmsgd2l0aEZpbGVUeXBlc30sIHRoaXMgbWVhbnNcbiAgICogdGhhdCBtYXRjaGVzIHdpbGwgaW5jbHVkZSBkYXRhIHN1Y2ggYXMgbW9kaWZpZWQgdGltZSwgcGVybWlzc2lvbnMsIGFuZFxuICAgKiBzbyBvbi4gIE5vdGUgdGhhdCB0aGlzIHdpbGwgaW5jdXIgYSBwZXJmb3JtYW5jZSBjb3N0IGR1ZSB0byB0aGUgYWRkZWRcbiAgICogc3lzdGVtIGNhbGxzLlxuICAgKi9cbiAgc3RhdD86IGJvb2xlYW5cblxuICAvKipcbiAgICogQW4gQWJvcnRTaWduYWwgd2hpY2ggd2lsbCBjYW5jZWwgdGhlIEdsb2Igd2FsayB3aGVuXG4gICAqIHRyaWdnZXJlZC5cbiAgICovXG4gIHNpZ25hbD86IEFib3J0U2lnbmFsXG5cbiAgLyoqXG4gICAqIFVzZSBgXFxcXGAgYXMgYSBwYXRoIHNlcGFyYXRvciBfb25seV8sIGFuZFxuICAgKiAgX25ldmVyXyBhcyBhbiBlc2NhcGUgY2hhcmFjdGVyLiBJZiBzZXQsIGFsbCBgXFxcXGAgY2hhcmFjdGVycyBhcmVcbiAgICogIHJlcGxhY2VkIHdpdGggYC9gIGluIHRoZSBwYXR0ZXJuLlxuICAgKlxuICAgKiAgTm90ZSB0aGF0IHRoaXMgbWFrZXMgaXQgKippbXBvc3NpYmxlKiogdG8gbWF0Y2ggYWdhaW5zdCBwYXRoc1xuICAgKiAgY29udGFpbmluZyBsaXRlcmFsIGdsb2IgcGF0dGVybiBjaGFyYWN0ZXJzLCBidXQgYWxsb3dzIG1hdGNoaW5nXG4gICAqICB3aXRoIHBhdHRlcm5zIGNvbnN0cnVjdGVkIHVzaW5nIGBwYXRoLmpvaW4oKWAgYW5kXG4gICAqICBgcGF0aC5yZXNvbHZlKClgIG9uIFdpbmRvd3MgcGxhdGZvcm1zLCBtaW1pY2tpbmcgdGhlIChidWdneSEpXG4gICAqICBiZWhhdmlvciBvZiBHbG9iIHY3IGFuZCBiZWZvcmUgb24gV2luZG93cy4gUGxlYXNlIHVzZSB3aXRoXG4gICAqICBjYXV0aW9uLCBhbmQgYmUgbWluZGZ1bCBvZiBbdGhlIGNhdmVhdCBiZWxvdyBhYm91dCBXaW5kb3dzXG4gICAqICBwYXRoc10oI3dpbmRvd3MpLiAoRm9yIGxlZ2FjeSByZWFzb25zLCB0aGlzIGlzIGFsc28gc2V0IGlmXG4gICAqICBgYWxsb3dXaW5kb3dzRXNjYXBlYCBpcyBzZXQgdG8gdGhlIGV4YWN0IHZhbHVlIGBmYWxzZWAuKVxuICAgKi9cbiAgd2luZG93c1BhdGhzTm9Fc2NhcGU/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIFJldHVybiBbUGF0aFNjdXJyeV0oaHR0cDovL25wbS5pbS9wYXRoLXNjdXJyeSlcbiAgICogYFBhdGhgIG9iamVjdHMgaW5zdGVhZCBvZiBzdHJpbmdzLiBUaGVzZSBhcmUgc2ltaWxhciB0byBhXG4gICAqIE5vZGVKUyBgRGlyZW50YCBvYmplY3QsIGJ1dCB3aXRoIGFkZGl0aW9uYWwgbWV0aG9kcyBhbmRcbiAgICogcHJvcGVydGllcy5cbiAgICpcbiAgICogQ29uZmxpY3RzIHdpdGgge0BsaW5rIGFic29sdXRlfVxuICAgKi9cbiAgd2l0aEZpbGVUeXBlcz86IGJvb2xlYW5cblxuICAvKipcbiAgICogQW4gZnMgaW1wbGVtZW50YXRpb24gdG8gb3ZlcnJpZGUgc29tZSBvciBhbGwgb2YgdGhlIGRlZmF1bHRzLiAgU2VlXG4gICAqIGh0dHA6Ly9ucG0uaW0vcGF0aC1zY3VycnkgZm9yIGRldGFpbHMgYWJvdXQgd2hhdCBjYW4gYmUgb3ZlcnJpZGRlbi5cbiAgICovXG4gIGZzPzogRlNPcHRpb25cblxuICAvKipcbiAgICogSnVzdCBwYXNzZWQgYWxvbmcgdG8gTWluaW1hdGNoLiAgTm90ZSB0aGF0IHRoaXMgbWFrZXMgYWxsIHBhdHRlcm5cbiAgICogbWF0Y2hpbmcgb3BlcmF0aW9ucyBzbG93ZXIgYW5kICpleHRyZW1lbHkqIG5vaXN5LlxuICAgKi9cbiAgZGVidWc/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIFJldHVybiBgL2AgZGVsaW1pdGVkIHBhdGhzLCBldmVuIG9uIFdpbmRvd3MuXG4gICAqXG4gICAqIE9uIHBvc2l4IHN5c3RlbXMsIHRoaXMgaGFzIG5vIGVmZmVjdC4gIEJ1dCwgb24gV2luZG93cywgaXQgbWVhbnMgdGhhdFxuICAgKiBwYXRocyB3aWxsIGJlIGAvYCBkZWxpbWl0ZWQsIGFuZCBhYnNvbHV0ZSBwYXRocyB3aWxsIGJlIHRoZWlyIGZ1bGxcbiAgICogcmVzb2x2ZWQgVU5DIGZvcm1zLCBlZyBpbnN0ZWFkIG9mIGAnQzpcXFxcZm9vXFxcXGJhcidgLCBpdCB3b3VsZCByZXR1cm5cbiAgICogYCcvLz8vQzovZm9vL2JhcidgXG4gICAqL1xuICBwb3NpeD86IGJvb2xlYW5cblxuICAvKipcbiAgICogRG8gbm90IG1hdGNoIGFueSBjaGlsZHJlbiBvZiBhbnkgbWF0Y2hlcy4gRm9yIGV4YW1wbGUsIHRoZSBwYXR0ZXJuXG4gICAqIGAqKlxcL2Zvb2Agd291bGQgbWF0Y2ggYGEvZm9vYCwgYnV0IG5vdCBgYS9mb28vYi9mb29gIGluIHRoaXMgbW9kZS5cbiAgICpcbiAgICogVGhpcyBpcyBlc3BlY2lhbGx5IHVzZWZ1bCBmb3IgY2FzZXMgbGlrZSBcImZpbmQgYWxsIGBub2RlX21vZHVsZXNgXG4gICAqIGZvbGRlcnMsIGJ1dCBub3QgdGhlIG9uZXMgaW4gYG5vZGVfbW9kdWxlc2BcIi5cbiAgICpcbiAgICogSW4gb3JkZXIgdG8gc3VwcG9ydCB0aGlzLCB0aGUgYElnbm9yZWAgaW1wbGVtZW50YXRpb24gbXVzdCBzdXBwb3J0IGFuXG4gICAqIGBhZGQocGF0dGVybjogc3RyaW5nKWAgbWV0aG9kLiBJZiB1c2luZyB0aGUgZGVmYXVsdCBgSWdub3JlYCBjbGFzcywgdGhlblxuICAgKiB0aGlzIGlzIGZpbmUsIGJ1dCBpZiB0aGlzIGlzIHNldCB0byBgZmFsc2VgLCBhbmQgYSBjdXN0b20gYElnbm9yZWAgaXNcbiAgICogcHJvdmlkZWQgdGhhdCBkb2VzIG5vdCBoYXZlIGFuIGBhZGQoKWAgbWV0aG9kLCB0aGVuIGl0IHdpbGwgdGhyb3cgYW5cbiAgICogZXJyb3IuXG4gICAqXG4gICAqICoqQ2F2ZWF0KiogSXQgKm9ubHkqIGlnbm9yZXMgbWF0Y2hlcyB0aGF0IHdvdWxkIGJlIGEgZGVzY2VuZGFudCBvZiBhXG4gICAqIHByZXZpb3VzIG1hdGNoLCBhbmQgb25seSBpZiB0aGF0IGRlc2NlbmRhbnQgaXMgbWF0Y2hlZCAqYWZ0ZXIqIHRoZVxuICAgKiBhbmNlc3RvciBpcyBlbmNvdW50ZXJlZC4gU2luY2UgdGhlIGZpbGUgc3lzdGVtIHdhbGsgaGFwcGVucyBpblxuICAgKiBpbmRldGVybWluYXRlIG9yZGVyLCBpdCdzIHBvc3NpYmxlIHRoYXQgYSBtYXRjaCB3aWxsIGFscmVhZHkgYmUgYWRkZWRcbiAgICogYmVmb3JlIGl0cyBhbmNlc3RvciwgaWYgbXVsdGlwbGUgb3IgYnJhY2VkIHBhdHRlcm5zIGFyZSB1c2VkLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZTpcbiAgICpcbiAgICogYGBgdHNcbiAgICogY29uc3QgcmVzdWx0cyA9IGF3YWl0IGdsb2IoW1xuICAgKiAgIC8vIGxpa2VseSB0byBtYXRjaCBmaXJzdCwgc2luY2UgaXQncyBqdXN0IGEgc3RhdFxuICAgKiAgICdhL2IvYy9kL2UvZicsXG4gICAqXG4gICAqICAgLy8gdGhpcyBwYXR0ZXJuIGlzIG1vcmUgY29tcGxpY2F0ZWQhIEl0IG11c3QgdG8gdmFyaW91cyByZWFkZGlyKClcbiAgICogICAvLyBjYWxscyBhbmQgdGVzdCB0aGUgcmVzdWx0cyBhZ2FpbnN0IGEgcmVndWxhciBleHByZXNzaW9uLCBhbmQgdGhhdFxuICAgKiAgIC8vIGlzIGNlcnRhaW5seSBnb2luZyB0byB0YWtlIGEgbGl0dGxlIGJpdCBsb25nZXIuXG4gICAqICAgLy9cbiAgICogICAvLyBTbywgbGF0ZXIgb24sIGl0IGVuY291bnRlcnMgYSBtYXRjaCBhdCAnYS9iL2MvZC9lJywgYnV0IGl0J3MgdG9vXG4gICAqICAgLy8gbGF0ZSB0byBpZ25vcmUgYS9iL2MvZC9lL2YsIGJlY2F1c2UgaXQncyBhbHJlYWR5IGJlZW4gZW1pdHRlZC5cbiAgICogICAnYS9bYmRmXS8/L1thLXpdLyonLFxuICAgKiBdLCB7IGluY2x1ZGVDaGlsZE1hdGNoZXM6IGZhbHNlIH0pXG4gICAqIGBgYFxuICAgKlxuICAgKiBJdCdzIGJlc3QgdG8gb25seSBzZXQgdGhpcyB0byBgZmFsc2VgIGlmIHlvdSBjYW4gYmUgcmVhc29uYWJseSBzdXJlIHRoYXRcbiAgICogbm8gY29tcG9uZW50cyBvZiB0aGUgcGF0dGVybiB3aWxsIHBvdGVudGlhbGx5IG1hdGNoIG9uZSBhbm90aGVyJ3MgZmlsZVxuICAgKiBzeXN0ZW0gZGVzY2VuZGFudHMsIG9yIGlmIHRoZSBvY2Nhc2lvbmFsIGluY2x1ZGVkIGNoaWxkIGVudHJ5IHdpbGwgbm90XG4gICAqIGNhdXNlIHByb2JsZW1zLlxuICAgKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICBpbmNsdWRlQ2hpbGRNYXRjaGVzPzogYm9vbGVhblxufVxuXG5leHBvcnQgdHlwZSBHbG9iT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlID0gR2xvYk9wdGlvbnMgJiB7XG4gIHdpdGhGaWxlVHlwZXM6IHRydWVcbiAgLy8gc3RyaW5nIG9wdGlvbnMgbm90IHJlbGV2YW50IGlmIHJldHVybmluZyBQYXRoIG9iamVjdHMuXG4gIGFic29sdXRlPzogdW5kZWZpbmVkXG4gIG1hcms/OiB1bmRlZmluZWRcbiAgcG9zaXg/OiB1bmRlZmluZWRcbn1cblxuZXhwb3J0IHR5cGUgR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzRmFsc2UgPSBHbG9iT3B0aW9ucyAmIHtcbiAgd2l0aEZpbGVUeXBlcz86IGZhbHNlXG59XG5cbmV4cG9ydCB0eXBlIEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc1Vuc2V0ID0gR2xvYk9wdGlvbnMgJiB7XG4gIHdpdGhGaWxlVHlwZXM/OiB1bmRlZmluZWRcbn1cblxuZXhwb3J0IHR5cGUgUmVzdWx0PE9wdHM+ID1cbiAgT3B0cyBleHRlbmRzIEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUgPyBQYXRoXG4gIDogT3B0cyBleHRlbmRzIEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlID8gc3RyaW5nXG4gIDogT3B0cyBleHRlbmRzIEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc1Vuc2V0ID8gc3RyaW5nXG4gIDogc3RyaW5nIHwgUGF0aFxuZXhwb3J0IHR5cGUgUmVzdWx0czxPcHRzPiA9IFJlc3VsdDxPcHRzPltdXG5cbmV4cG9ydCB0eXBlIEZpbGVUeXBlczxPcHRzPiA9XG4gIE9wdHMgZXh0ZW5kcyBHbG9iT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlID8gdHJ1ZVxuICA6IE9wdHMgZXh0ZW5kcyBHbG9iT3B0aW9uc1dpdGhGaWxlVHlwZXNGYWxzZSA/IGZhbHNlXG4gIDogT3B0cyBleHRlbmRzIEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc1Vuc2V0ID8gZmFsc2VcbiAgOiBib29sZWFuXG5cbi8qKlxuICogQW4gb2JqZWN0IHRoYXQgY2FuIHBlcmZvcm0gZ2xvYiBwYXR0ZXJuIHRyYXZlcnNhbHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBHbG9iPE9wdHMgZXh0ZW5kcyBHbG9iT3B0aW9ucz4gaW1wbGVtZW50cyBHbG9iT3B0aW9ucyB7XG4gIGFic29sdXRlPzogYm9vbGVhblxuICBjd2Q6IHN0cmluZ1xuICByb290Pzogc3RyaW5nXG4gIGRvdDogYm9vbGVhblxuICBkb3RSZWxhdGl2ZTogYm9vbGVhblxuICBmb2xsb3c6IGJvb2xlYW5cbiAgaWdub3JlPzogc3RyaW5nIHwgc3RyaW5nW10gfCBJZ25vcmVMaWtlXG4gIG1hZ2ljYWxCcmFjZXM6IGJvb2xlYW5cbiAgbWFyaz86IGJvb2xlYW5cbiAgbWF0Y2hCYXNlOiBib29sZWFuXG4gIG1heERlcHRoOiBudW1iZXJcbiAgbm9icmFjZTogYm9vbGVhblxuICBub2Nhc2U6IGJvb2xlYW5cbiAgbm9kaXI6IGJvb2xlYW5cbiAgbm9leHQ6IGJvb2xlYW5cbiAgbm9nbG9ic3RhcjogYm9vbGVhblxuICBwYXR0ZXJuOiBzdHJpbmdbXVxuICBwbGF0Zm9ybTogTm9kZUpTLlBsYXRmb3JtXG4gIHJlYWxwYXRoOiBib29sZWFuXG4gIHNjdXJyeTogUGF0aFNjdXJyeVxuICBzdGF0OiBib29sZWFuXG4gIHNpZ25hbD86IEFib3J0U2lnbmFsXG4gIHdpbmRvd3NQYXRoc05vRXNjYXBlOiBib29sZWFuXG4gIHdpdGhGaWxlVHlwZXM6IEZpbGVUeXBlczxPcHRzPlxuICBpbmNsdWRlQ2hpbGRNYXRjaGVzOiBib29sZWFuXG5cbiAgLyoqXG4gICAqIFRoZSBvcHRpb25zIHByb3ZpZGVkIHRvIHRoZSBjb25zdHJ1Y3Rvci5cbiAgICovXG4gIG9wdHM6IE9wdHNcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgcGFyc2VkIGltbXV0YWJsZSB7QGxpbmsgUGF0dGVybn0gb2JqZWN0cy5cbiAgICovXG4gIHBhdHRlcm5zOiBQYXR0ZXJuW11cblxuICAvKipcbiAgICogQWxsIG9wdGlvbnMgYXJlIHN0b3JlZCBhcyBwcm9wZXJ0aWVzIG9uIHRoZSBgR2xvYmAgb2JqZWN0LlxuICAgKlxuICAgKiBTZWUge0BsaW5rIEdsb2JPcHRpb25zfSBmb3IgZnVsbCBvcHRpb25zIGRlc2NyaXB0aW9ucy5cbiAgICpcbiAgICogTm90ZSB0aGF0IGEgcHJldmlvdXMgYEdsb2JgIG9iamVjdCBjYW4gYmUgcGFzc2VkIGFzIHRoZVxuICAgKiBgR2xvYk9wdGlvbnNgIHRvIGFub3RoZXIgYEdsb2JgIGluc3RhbnRpYXRpb24gdG8gcmUtdXNlIHNldHRpbmdzXG4gICAqIGFuZCBjYWNoZXMgd2l0aCBhIG5ldyBwYXR0ZXJuLlxuICAgKlxuICAgKiBUcmF2ZXJzYWwgZnVuY3Rpb25zIGNhbiBiZSBjYWxsZWQgbXVsdGlwbGUgdGltZXMgdG8gcnVuIHRoZSB3YWxrXG4gICAqIGFnYWluLlxuICAgKi9cbiAgY29uc3RydWN0b3IocGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sIG9wdHM6IE9wdHMpIHtcbiAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICBpZiAoIW9wdHMpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2dsb2Igb3B0aW9ucyByZXF1aXJlZCcpXG4gICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICB0aGlzLndpdGhGaWxlVHlwZXMgPSAhIW9wdHMud2l0aEZpbGVUeXBlcyBhcyBGaWxlVHlwZXM8T3B0cz5cbiAgICB0aGlzLnNpZ25hbCA9IG9wdHMuc2lnbmFsXG4gICAgdGhpcy5mb2xsb3cgPSAhIW9wdHMuZm9sbG93XG4gICAgdGhpcy5kb3QgPSAhIW9wdHMuZG90XG4gICAgdGhpcy5kb3RSZWxhdGl2ZSA9ICEhb3B0cy5kb3RSZWxhdGl2ZVxuICAgIHRoaXMubm9kaXIgPSAhIW9wdHMubm9kaXJcbiAgICB0aGlzLm1hcmsgPSAhIW9wdHMubWFya1xuICAgIGlmICghb3B0cy5jd2QpIHtcbiAgICAgIHRoaXMuY3dkID0gJydcbiAgICB9IGVsc2UgaWYgKG9wdHMuY3dkIGluc3RhbmNlb2YgVVJMIHx8IG9wdHMuY3dkLnN0YXJ0c1dpdGgoJ2ZpbGU6Ly8nKSkge1xuICAgICAgb3B0cy5jd2QgPSBmaWxlVVJMVG9QYXRoKG9wdHMuY3dkKVxuICAgIH1cbiAgICB0aGlzLmN3ZCA9IG9wdHMuY3dkIHx8ICcnXG4gICAgdGhpcy5yb290ID0gb3B0cy5yb290XG4gICAgdGhpcy5tYWdpY2FsQnJhY2VzID0gISFvcHRzLm1hZ2ljYWxCcmFjZXNcbiAgICB0aGlzLm5vYnJhY2UgPSAhIW9wdHMubm9icmFjZVxuICAgIHRoaXMubm9leHQgPSAhIW9wdHMubm9leHRcbiAgICB0aGlzLnJlYWxwYXRoID0gISFvcHRzLnJlYWxwYXRoXG4gICAgdGhpcy5hYnNvbHV0ZSA9IG9wdHMuYWJzb2x1dGVcbiAgICB0aGlzLmluY2x1ZGVDaGlsZE1hdGNoZXMgPSBvcHRzLmluY2x1ZGVDaGlsZE1hdGNoZXMgIT09IGZhbHNlXG5cbiAgICB0aGlzLm5vZ2xvYnN0YXIgPSAhIW9wdHMubm9nbG9ic3RhclxuICAgIHRoaXMubWF0Y2hCYXNlID0gISFvcHRzLm1hdGNoQmFzZVxuICAgIHRoaXMubWF4RGVwdGggPVxuICAgICAgdHlwZW9mIG9wdHMubWF4RGVwdGggPT09ICdudW1iZXInID8gb3B0cy5tYXhEZXB0aCA6IEluZmluaXR5XG4gICAgdGhpcy5zdGF0ID0gISFvcHRzLnN0YXRcbiAgICB0aGlzLmlnbm9yZSA9IG9wdHMuaWdub3JlXG5cbiAgICBpZiAodGhpcy53aXRoRmlsZVR5cGVzICYmIHRoaXMuYWJzb2x1dGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYW5ub3Qgc2V0IGFic29sdXRlIGFuZCB3aXRoRmlsZVR5cGVzOnRydWUnKVxuICAgIH1cblxuICAgIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHBhdHRlcm4gPSBbcGF0dGVybl1cbiAgICB9XG5cbiAgICB0aGlzLndpbmRvd3NQYXRoc05vRXNjYXBlID1cbiAgICAgICEhb3B0cy53aW5kb3dzUGF0aHNOb0VzY2FwZSB8fFxuICAgICAgKG9wdHMgYXMgeyBhbGxvd1dpbmRvd3NFc2NhcGU/OiBib29sZWFuIH0pLmFsbG93V2luZG93c0VzY2FwZSA9PT1cbiAgICAgICAgZmFsc2VcblxuICAgIGlmICh0aGlzLndpbmRvd3NQYXRoc05vRXNjYXBlKSB7XG4gICAgICBwYXR0ZXJuID0gcGF0dGVybi5tYXAocCA9PiBwLnJlcGxhY2UoL1xcXFwvZywgJy8nKSlcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tYXRjaEJhc2UpIHtcbiAgICAgIGlmIChvcHRzLm5vZ2xvYnN0YXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignYmFzZSBtYXRjaGluZyByZXF1aXJlcyBnbG9ic3RhcicpXG4gICAgICB9XG4gICAgICBwYXR0ZXJuID0gcGF0dGVybi5tYXAocCA9PiAocC5pbmNsdWRlcygnLycpID8gcCA6IGAuLyoqLyR7cH1gKSlcbiAgICB9XG5cbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuXG5cbiAgICB0aGlzLnBsYXRmb3JtID0gb3B0cy5wbGF0Zm9ybSB8fCBkZWZhdWx0UGxhdGZvcm1cbiAgICB0aGlzLm9wdHMgPSB7IC4uLm9wdHMsIHBsYXRmb3JtOiB0aGlzLnBsYXRmb3JtIH1cbiAgICBpZiAob3B0cy5zY3VycnkpIHtcbiAgICAgIHRoaXMuc2N1cnJ5ID0gb3B0cy5zY3VycnlcbiAgICAgIGlmIChcbiAgICAgICAgb3B0cy5ub2Nhc2UgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICBvcHRzLm5vY2FzZSAhPT0gb3B0cy5zY3Vycnkubm9jYXNlXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdub2Nhc2Ugb3B0aW9uIGNvbnRyYWRpY3RzIHByb3ZpZGVkIHNjdXJyeSBvcHRpb24nKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBTY3VycnkgPVxuICAgICAgICBvcHRzLnBsYXRmb3JtID09PSAnd2luMzInID8gUGF0aFNjdXJyeVdpbjMyXG4gICAgICAgIDogb3B0cy5wbGF0Zm9ybSA9PT0gJ2RhcndpbicgPyBQYXRoU2N1cnJ5RGFyd2luXG4gICAgICAgIDogb3B0cy5wbGF0Zm9ybSA/IFBhdGhTY3VycnlQb3NpeFxuICAgICAgICA6IFBhdGhTY3VycnlcbiAgICAgIHRoaXMuc2N1cnJ5ID0gbmV3IFNjdXJyeSh0aGlzLmN3ZCwge1xuICAgICAgICBub2Nhc2U6IG9wdHMubm9jYXNlLFxuICAgICAgICBmczogb3B0cy5mcyxcbiAgICAgIH0pXG4gICAgfVxuICAgIHRoaXMubm9jYXNlID0gdGhpcy5zY3Vycnkubm9jYXNlXG5cbiAgICAvLyBJZiB5b3UgZG8gbm9jYXNlOnRydWUgb24gYSBjYXNlLXNlbnNpdGl2ZSBmaWxlIHN5c3RlbSwgdGhlblxuICAgIC8vIHdlIG5lZWQgdG8gdXNlIHJlZ2V4cHMgaW5zdGVhZCBvZiBzdHJpbmdzIGZvciBub24tbWFnaWNcbiAgICAvLyBwYXRoIHBvcnRpb25zLCBiZWNhdXNlIHN0YXR0aW5nIGBhQmNgIHdvbid0IHJldHVybiByZXN1bHRzXG4gICAgLy8gZm9yIHRoZSBmaWxlIGBBYkNgIGZvciBleGFtcGxlLlxuICAgIGNvbnN0IG5vY2FzZU1hZ2ljT25seSA9XG4gICAgICB0aGlzLnBsYXRmb3JtID09PSAnZGFyd2luJyB8fCB0aGlzLnBsYXRmb3JtID09PSAnd2luMzInXG5cbiAgICBjb25zdCBtbW86IE1pbmltYXRjaE9wdGlvbnMgPSB7XG4gICAgICAvLyBkZWZhdWx0IG5vY2FzZSBiYXNlZCBvbiBwbGF0Zm9ybVxuICAgICAgLi4ub3B0cyxcbiAgICAgIGRvdDogdGhpcy5kb3QsXG4gICAgICBtYXRjaEJhc2U6IHRoaXMubWF0Y2hCYXNlLFxuICAgICAgbm9icmFjZTogdGhpcy5ub2JyYWNlLFxuICAgICAgbm9jYXNlOiB0aGlzLm5vY2FzZSxcbiAgICAgIG5vY2FzZU1hZ2ljT25seSxcbiAgICAgIG5vY29tbWVudDogdHJ1ZSxcbiAgICAgIG5vZXh0OiB0aGlzLm5vZXh0LFxuICAgICAgbm9uZWdhdGU6IHRydWUsXG4gICAgICBvcHRpbWl6YXRpb25MZXZlbDogMixcbiAgICAgIHBsYXRmb3JtOiB0aGlzLnBsYXRmb3JtLFxuICAgICAgd2luZG93c1BhdGhzTm9Fc2NhcGU6IHRoaXMud2luZG93c1BhdGhzTm9Fc2NhcGUsXG4gICAgICBkZWJ1ZzogISF0aGlzLm9wdHMuZGVidWcsXG4gICAgfVxuXG4gICAgY29uc3QgbW1zID0gdGhpcy5wYXR0ZXJuLm1hcChwID0+IG5ldyBNaW5pbWF0Y2gocCwgbW1vKSlcbiAgICBjb25zdCBbbWF0Y2hTZXQsIGdsb2JQYXJ0c10gPSBtbXMucmVkdWNlKFxuICAgICAgKHNldDogW01hdGNoU2V0LCBHbG9iUGFydHNdLCBtKSA9PiB7XG4gICAgICAgIHNldFswXS5wdXNoKC4uLm0uc2V0KVxuICAgICAgICBzZXRbMV0ucHVzaCguLi5tLmdsb2JQYXJ0cylcbiAgICAgICAgcmV0dXJuIHNldFxuICAgICAgfSxcbiAgICAgIFtbXSwgW11dLFxuICAgIClcbiAgICB0aGlzLnBhdHRlcm5zID0gbWF0Y2hTZXQubWFwKChzZXQsIGkpID0+IHtcbiAgICAgIGNvbnN0IGcgPSBnbG9iUGFydHNbaV1cbiAgICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgICAgaWYgKCFnKSB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgcGF0dGVybiBvYmplY3QnKVxuICAgICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICAgIHJldHVybiBuZXcgUGF0dGVybihzZXQsIGcsIDAsIHRoaXMucGxhdGZvcm0pXG4gICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRoZSByZXN1bHRzIGFycmF5LlxuICAgKi9cbiAgYXN5bmMgd2FsaygpOiBQcm9taXNlPFJlc3VsdHM8T3B0cz4+XG4gIGFzeW5jIHdhbGsoKTogUHJvbWlzZTwoc3RyaW5nIHwgUGF0aClbXT4ge1xuICAgIC8vIFdhbGtlcnMgYWx3YXlzIHJldHVybiBhcnJheSBvZiBQYXRoIG9iamVjdHMsIHNvIHdlIGp1c3QgaGF2ZSB0b1xuICAgIC8vIGNvZXJjZSB0aGVtIGludG8gdGhlIHJpZ2h0IHNoYXBlLiAgSXQgd2lsbCBoYXZlIGFscmVhZHkgY2FsbGVkXG4gICAgLy8gcmVhbHBhdGgoKSBpZiB0aGUgb3B0aW9uIHdhcyBzZXQgdG8gZG8gc28sIHNvIHdlIGtub3cgdGhhdCdzIGNhY2hlZC5cbiAgICAvLyBzdGFydCBvdXQga25vd2luZyB0aGUgY3dkLCBhdCBsZWFzdFxuICAgIHJldHVybiBbXG4gICAgICAuLi4oYXdhaXQgbmV3IEdsb2JXYWxrZXIodGhpcy5wYXR0ZXJucywgdGhpcy5zY3VycnkuY3dkLCB7XG4gICAgICAgIC4uLnRoaXMub3B0cyxcbiAgICAgICAgbWF4RGVwdGg6XG4gICAgICAgICAgdGhpcy5tYXhEZXB0aCAhPT0gSW5maW5pdHkgP1xuICAgICAgICAgICAgdGhpcy5tYXhEZXB0aCArIHRoaXMuc2N1cnJ5LmN3ZC5kZXB0aCgpXG4gICAgICAgICAgOiBJbmZpbml0eSxcbiAgICAgICAgcGxhdGZvcm06IHRoaXMucGxhdGZvcm0sXG4gICAgICAgIG5vY2FzZTogdGhpcy5ub2Nhc2UsXG4gICAgICAgIGluY2x1ZGVDaGlsZE1hdGNoZXM6IHRoaXMuaW5jbHVkZUNoaWxkTWF0Y2hlcyxcbiAgICAgIH0pLndhbGsoKSksXG4gICAgXVxuICB9XG5cbiAgLyoqXG4gICAqIHN5bmNocm9ub3VzIHtAbGluayBHbG9iLndhbGt9XG4gICAqL1xuICB3YWxrU3luYygpOiBSZXN1bHRzPE9wdHM+XG4gIHdhbGtTeW5jKCk6IChzdHJpbmcgfCBQYXRoKVtdIHtcbiAgICByZXR1cm4gW1xuICAgICAgLi4ubmV3IEdsb2JXYWxrZXIodGhpcy5wYXR0ZXJucywgdGhpcy5zY3VycnkuY3dkLCB7XG4gICAgICAgIC4uLnRoaXMub3B0cyxcbiAgICAgICAgbWF4RGVwdGg6XG4gICAgICAgICAgdGhpcy5tYXhEZXB0aCAhPT0gSW5maW5pdHkgP1xuICAgICAgICAgICAgdGhpcy5tYXhEZXB0aCArIHRoaXMuc2N1cnJ5LmN3ZC5kZXB0aCgpXG4gICAgICAgICAgOiBJbmZpbml0eSxcbiAgICAgICAgcGxhdGZvcm06IHRoaXMucGxhdGZvcm0sXG4gICAgICAgIG5vY2FzZTogdGhpcy5ub2Nhc2UsXG4gICAgICAgIGluY2x1ZGVDaGlsZE1hdGNoZXM6IHRoaXMuaW5jbHVkZUNoaWxkTWF0Y2hlcyxcbiAgICAgIH0pLndhbGtTeW5jKCksXG4gICAgXVxuICB9XG5cbiAgLyoqXG4gICAqIFN0cmVhbSByZXN1bHRzIGFzeW5jaHJvbm91c2x5LlxuICAgKi9cbiAgc3RyZWFtKCk6IE1pbmlwYXNzPFJlc3VsdDxPcHRzPiwgUmVzdWx0PE9wdHM+PlxuICBzdHJlYW0oKTogTWluaXBhc3M8c3RyaW5nIHwgUGF0aCwgc3RyaW5nIHwgUGF0aD4ge1xuICAgIHJldHVybiBuZXcgR2xvYlN0cmVhbSh0aGlzLnBhdHRlcm5zLCB0aGlzLnNjdXJyeS5jd2QsIHtcbiAgICAgIC4uLnRoaXMub3B0cyxcbiAgICAgIG1heERlcHRoOlxuICAgICAgICB0aGlzLm1heERlcHRoICE9PSBJbmZpbml0eSA/XG4gICAgICAgICAgdGhpcy5tYXhEZXB0aCArIHRoaXMuc2N1cnJ5LmN3ZC5kZXB0aCgpXG4gICAgICAgIDogSW5maW5pdHksXG4gICAgICBwbGF0Zm9ybTogdGhpcy5wbGF0Zm9ybSxcbiAgICAgIG5vY2FzZTogdGhpcy5ub2Nhc2UsXG4gICAgICBpbmNsdWRlQ2hpbGRNYXRjaGVzOiB0aGlzLmluY2x1ZGVDaGlsZE1hdGNoZXMsXG4gICAgfSkuc3RyZWFtKClcbiAgfVxuXG4gIC8qKlxuICAgKiBTdHJlYW0gcmVzdWx0cyBzeW5jaHJvbm91c2x5LlxuICAgKi9cbiAgc3RyZWFtU3luYygpOiBNaW5pcGFzczxSZXN1bHQ8T3B0cz4sIFJlc3VsdDxPcHRzPj5cbiAgc3RyZWFtU3luYygpOiBNaW5pcGFzczxzdHJpbmcgfCBQYXRoLCBzdHJpbmcgfCBQYXRoPiB7XG4gICAgcmV0dXJuIG5ldyBHbG9iU3RyZWFtKHRoaXMucGF0dGVybnMsIHRoaXMuc2N1cnJ5LmN3ZCwge1xuICAgICAgLi4udGhpcy5vcHRzLFxuICAgICAgbWF4RGVwdGg6XG4gICAgICAgIHRoaXMubWF4RGVwdGggIT09IEluZmluaXR5ID9cbiAgICAgICAgICB0aGlzLm1heERlcHRoICsgdGhpcy5zY3VycnkuY3dkLmRlcHRoKClcbiAgICAgICAgOiBJbmZpbml0eSxcbiAgICAgIHBsYXRmb3JtOiB0aGlzLnBsYXRmb3JtLFxuICAgICAgbm9jYXNlOiB0aGlzLm5vY2FzZSxcbiAgICAgIGluY2x1ZGVDaGlsZE1hdGNoZXM6IHRoaXMuaW5jbHVkZUNoaWxkTWF0Y2hlcyxcbiAgICB9KS5zdHJlYW1TeW5jKClcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWZhdWx0IHN5bmMgaXRlcmF0aW9uIGZ1bmN0aW9uLiBSZXR1cm5zIGEgR2VuZXJhdG9yIHRoYXRcbiAgICogaXRlcmF0ZXMgb3ZlciB0aGUgcmVzdWx0cy5cbiAgICovXG4gIGl0ZXJhdGVTeW5jKCk6IEdlbmVyYXRvcjxSZXN1bHQ8T3B0cz4sIHZvaWQsIHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5zdHJlYW1TeW5jKClbU3ltYm9sLml0ZXJhdG9yXSgpXG4gIH1cbiAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuaXRlcmF0ZVN5bmMoKVxuICB9XG5cbiAgLyoqXG4gICAqIERlZmF1bHQgYXN5bmMgaXRlcmF0aW9uIGZ1bmN0aW9uLiBSZXR1cm5zIGFuIEFzeW5jR2VuZXJhdG9yIHRoYXRcbiAgICogaXRlcmF0ZXMgb3ZlciB0aGUgcmVzdWx0cy5cbiAgICovXG4gIGl0ZXJhdGUoKTogQXN5bmNHZW5lcmF0b3I8UmVzdWx0PE9wdHM+LCB2b2lkLCB2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuc3RyZWFtKClbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKClcbiAgfVxuICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgIHJldHVybiB0aGlzLml0ZXJhdGUoKVxuICB9XG59XG4iLCAiLyoqXG4gKiBAbW9kdWxlIExSVUNhY2hlXG4gKi9cblxuLy8gbW9kdWxlLXByaXZhdGUgbmFtZXMgYW5kIHR5cGVzXG4vLyB0aGlzIHByb3ZpZGVzIHRoZSBkZWZhdWx0IFBlcmYgb2JqZWN0IHNvdXJjZS5cbi8vIGl0IGNhbiBiZSBwYXNzZWQgaW4gdmlhIGNvbmZpZ3VyYXRpb24gdG8gb3ZlcnJpZGUgaXRcbi8vIGZvciBhIHNpbmdsZSBMUlUgb2JqZWN0LlxuZXhwb3J0IHR5cGUgUGVyZiA9IHsgbm93OiAoKSA9PiBudW1iZXIgfVxuY29uc3QgZGVmYXVsdFBlcmY6IFBlcmYgPVxuICAoXG4gICAgdHlwZW9mIHBlcmZvcm1hbmNlID09PSAnb2JqZWN0JyAmJlxuICAgIHBlcmZvcm1hbmNlICYmXG4gICAgdHlwZW9mIHBlcmZvcm1hbmNlLm5vdyA9PT0gJ2Z1bmN0aW9uJ1xuICApID9cbiAgICBwZXJmb3JtYW5jZVxuICA6IERhdGVcblxuY29uc3Qgd2FybmVkID0gbmV3IFNldDxzdHJpbmc+KClcblxuLy8gZWl0aGVyIGEgZnVuY3Rpb24gb3IgYSBjbGFzc1xudHlwZSBGb3JDID0gKCguLi5hOiBhbnlbXSkgPT4gYW55KSB8IHsgbmV3ICguLi5hOiBhbnlbXSk6IGFueSB9XG5cbi8qIGM4IGlnbm9yZSBzdGFydCAqL1xuY29uc3QgUFJPQ0VTUyA9IChcbiAgdHlwZW9mIHByb2Nlc3MgPT09ICdvYmplY3QnICYmICEhcHJvY2VzcyA/XG4gICAgcHJvY2Vzc1xuICA6IHt9KSBhcyB7IFtrOiBzdHJpbmddOiBhbnkgfVxuLyogYzggaWdub3JlIHN0YXJ0ICovXG5cbmNvbnN0IGVtaXRXYXJuaW5nID0gKFxuICBtc2c6IHN0cmluZyxcbiAgdHlwZTogc3RyaW5nLFxuICBjb2RlOiBzdHJpbmcsXG4gIGZuOiBGb3JDLFxuKSA9PiB7XG4gIHR5cGVvZiBQUk9DRVNTLmVtaXRXYXJuaW5nID09PSAnZnVuY3Rpb24nID9cbiAgICBQUk9DRVNTLmVtaXRXYXJuaW5nKG1zZywgdHlwZSwgY29kZSwgZm4pXG4gIDogY29uc29sZS5lcnJvcihgWyR7Y29kZX1dICR7dHlwZX06ICR7bXNnfWApXG59XG5cbmxldCBBQyA9IGdsb2JhbFRoaXMuQWJvcnRDb250cm9sbGVyXG5sZXQgQVMgPSBnbG9iYWxUaGlzLkFib3J0U2lnbmFsXG5cbi8qIGM4IGlnbm9yZSBzdGFydCAqL1xuaWYgKHR5cGVvZiBBQyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgLy9AdHMtaWdub3JlXG4gIEFTID0gY2xhc3MgQWJvcnRTaWduYWwge1xuICAgIG9uYWJvcnQ/OiAoLi4uYTogYW55W10pID0+IGFueVxuICAgIF9vbmFib3J0OiAoKC4uLmE6IGFueVtdKSA9PiBhbnkpW10gPSBbXVxuICAgIHJlYXNvbj86IGFueVxuICAgIGFib3J0ZWQ6IGJvb2xlYW4gPSBmYWxzZVxuICAgIGFkZEV2ZW50TGlzdGVuZXIoXzogc3RyaW5nLCBmbjogKC4uLmE6IGFueVtdKSA9PiBhbnkpIHtcbiAgICAgIHRoaXMuX29uYWJvcnQucHVzaChmbilcbiAgICB9XG4gIH1cbiAgLy9AdHMtaWdub3JlXG4gIEFDID0gY2xhc3MgQWJvcnRDb250cm9sbGVyIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgIHdhcm5BQ1BvbHlmaWxsKClcbiAgICB9XG4gICAgc2lnbmFsID0gbmV3IEFTKClcbiAgICBhYm9ydChyZWFzb246IGFueSkge1xuICAgICAgaWYgKHRoaXMuc2lnbmFsLmFib3J0ZWQpIHJldHVyblxuICAgICAgLy9AdHMtaWdub3JlXG4gICAgICB0aGlzLnNpZ25hbC5yZWFzb24gPSByZWFzb25cbiAgICAgIC8vQHRzLWlnbm9yZVxuICAgICAgdGhpcy5zaWduYWwuYWJvcnRlZCA9IHRydWVcbiAgICAgIC8vQHRzLWlnbm9yZVxuICAgICAgZm9yIChjb25zdCBmbiBvZiB0aGlzLnNpZ25hbC5fb25hYm9ydCkge1xuICAgICAgICBmbihyZWFzb24pXG4gICAgICB9XG4gICAgICB0aGlzLnNpZ25hbC5vbmFib3J0Py4ocmVhc29uKVxuICAgIH1cbiAgfVxuICBsZXQgcHJpbnRBQ1BvbHlmaWxsV2FybmluZyA9XG4gICAgUFJPQ0VTUy5lbnY/LkxSVV9DQUNIRV9JR05PUkVfQUNfV0FSTklORyAhPT0gJzEnXG4gIGNvbnN0IHdhcm5BQ1BvbHlmaWxsID0gKCkgPT4ge1xuICAgIGlmICghcHJpbnRBQ1BvbHlmaWxsV2FybmluZykgcmV0dXJuXG4gICAgcHJpbnRBQ1BvbHlmaWxsV2FybmluZyA9IGZhbHNlXG4gICAgZW1pdFdhcm5pbmcoXG4gICAgICAnQWJvcnRDb250cm9sbGVyIGlzIG5vdCBkZWZpbmVkLiBJZiB1c2luZyBscnUtY2FjaGUgaW4gJyArXG4gICAgICAgICdub2RlIDE0LCBsb2FkIGFuIEFib3J0Q29udHJvbGxlciBwb2x5ZmlsbCBmcm9tIHRoZSAnICtcbiAgICAgICAgJ2Bub2RlLWFib3J0LWNvbnRyb2xsZXJgIHBhY2thZ2UuIEEgbWluaW1hbCBwb2x5ZmlsbCBpcyAnICtcbiAgICAgICAgJ3Byb3ZpZGVkIGZvciB1c2UgYnkgTFJVQ2FjaGUuZmV0Y2goKSwgYnV0IGl0IHNob3VsZCBub3QgYmUgJyArXG4gICAgICAgICdyZWxpZWQgdXBvbiBpbiBvdGhlciBjb250ZXh0cyAoZWcsIHBhc3NpbmcgaXQgdG8gb3RoZXIgQVBJcyB0aGF0ICcgK1xuICAgICAgICAndXNlIEFib3J0Q29udHJvbGxlci9BYm9ydFNpZ25hbCBtaWdodCBoYXZlIHVuZGVzaXJhYmxlIGVmZmVjdHMpLiAnICtcbiAgICAgICAgJ1lvdSBtYXkgZGlzYWJsZSB0aGlzIHdpdGggTFJVX0NBQ0hFX0lHTk9SRV9BQ19XQVJOSU5HPTEgaW4gdGhlIGVudi4nLFxuICAgICAgJ05PX0FCT1JUX0NPTlRST0xMRVInLFxuICAgICAgJ0VOT1RTVVAnLFxuICAgICAgd2FybkFDUG9seWZpbGwsXG4gICAgKVxuICB9XG59XG4vKiBjOCBpZ25vcmUgc3RvcCAqL1xuXG5jb25zdCBzaG91bGRXYXJuID0gKGNvZGU6IHN0cmluZykgPT4gIXdhcm5lZC5oYXMoY29kZSlcblxuY29uc3QgVFlQRSA9IFN5bWJvbCgndHlwZScpXG5leHBvcnQgdHlwZSBQb3NJbnQgPSBudW1iZXIgJiB7IFtUWVBFXTogJ1Bvc2l0aXZlIEludGVnZXInIH1cbmV4cG9ydCB0eXBlIEluZGV4ID0gbnVtYmVyICYgeyBbVFlQRV06ICdMUlVDYWNoZSBJbmRleCcgfVxuXG5jb25zdCBpc1Bvc0ludCA9IChuOiBhbnkpOiBuIGlzIFBvc0ludCA9PlxuICBuICYmIG4gPT09IE1hdGguZmxvb3IobikgJiYgbiA+IDAgJiYgaXNGaW5pdGUobilcblxuZXhwb3J0IHR5cGUgVWludEFycmF5ID0gVWludDhBcnJheSB8IFVpbnQxNkFycmF5IHwgVWludDMyQXJyYXlcbmV4cG9ydCB0eXBlIE51bWJlckFycmF5ID0gVWludEFycmF5IHwgbnVtYmVyW11cblxuLyogYzggaWdub3JlIHN0YXJ0ICovXG4vLyBUaGlzIGlzIGEgbGl0dGxlIGJpdCByaWRpY3Vsb3VzLCB0YmguXG4vLyBUaGUgbWF4aW11bSBhcnJheSBsZW5ndGggaXMgMl4zMi0xIG9yIHRoZXJlYWJvdXRzIG9uIG1vc3QgSlMgaW1wbHMuXG4vLyBBbmQgd2VsbCBiZWZvcmUgdGhhdCBwb2ludCwgeW91J3JlIGNhY2hpbmcgdGhlIGVudGlyZSB3b3JsZCwgSSBtZWFuLFxuLy8gdGhhdCdzIH4zMkdCIG9mIGp1c3QgaW50ZWdlcnMgZm9yIHRoZSBuZXh0L3ByZXYgbGlua3MsIHBsdXMgd2hhdGV2ZXJcbi8vIGVsc2UgdG8gaG9sZCB0aGF0IG1hbnkga2V5cyBhbmQgdmFsdWVzLiAgSnVzdCBmaWxsaW5nIHRoZSBtZW1vcnkgd2l0aFxuLy8gemVyb2VzIGF0IGluaXQgdGltZSBpcyBicnV0YWwgd2hlbiB5b3UgZ2V0IHRoYXQgYmlnLlxuLy8gQnV0IHdoeSBub3QgYmUgY29tcGxldGU/XG4vLyBNYXliZSBpbiB0aGUgZnV0dXJlLCB0aGVzZSBsaW1pdHMgd2lsbCBoYXZlIGV4cGFuZGVkLlxuY29uc3QgZ2V0VWludEFycmF5ID0gKG1heDogbnVtYmVyKSA9PlxuICAhaXNQb3NJbnQobWF4KSA/IG51bGxcbiAgOiBtYXggPD0gTWF0aC5wb3coMiwgOCkgPyBVaW50OEFycmF5XG4gIDogbWF4IDw9IE1hdGgucG93KDIsIDE2KSA/IFVpbnQxNkFycmF5XG4gIDogbWF4IDw9IE1hdGgucG93KDIsIDMyKSA/IFVpbnQzMkFycmF5XG4gIDogbWF4IDw9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSID8gWmVyb0FycmF5XG4gIDogbnVsbFxuLyogYzggaWdub3JlIHN0b3AgKi9cblxuY2xhc3MgWmVyb0FycmF5IGV4dGVuZHMgQXJyYXk8bnVtYmVyPiB7XG4gIGNvbnN0cnVjdG9yKHNpemU6IG51bWJlcikge1xuICAgIHN1cGVyKHNpemUpXG4gICAgdGhpcy5maWxsKDApXG4gIH1cbn1cbmV4cG9ydCB0eXBlIHsgWmVyb0FycmF5IH1cbmV4cG9ydCB0eXBlIHsgU3RhY2sgfVxuXG5leHBvcnQgdHlwZSBTdGFja0xpa2UgPSBTdGFjayB8IEluZGV4W11cbmNsYXNzIFN0YWNrIHtcbiAgaGVhcDogTnVtYmVyQXJyYXlcbiAgbGVuZ3RoOiBudW1iZXJcbiAgLy8gcHJpdmF0ZSBjb25zdHJ1Y3RvclxuICBzdGF0aWMgI2NvbnN0cnVjdGluZzogYm9vbGVhbiA9IGZhbHNlXG4gIHN0YXRpYyBjcmVhdGUobWF4OiBudW1iZXIpOiBTdGFja0xpa2Uge1xuICAgIGNvbnN0IEhlYXBDbHMgPSBnZXRVaW50QXJyYXkobWF4KVxuICAgIGlmICghSGVhcENscykgcmV0dXJuIFtdXG4gICAgU3RhY2suI2NvbnN0cnVjdGluZyA9IHRydWVcbiAgICBjb25zdCBzID0gbmV3IFN0YWNrKG1heCwgSGVhcENscylcbiAgICBTdGFjay4jY29uc3RydWN0aW5nID0gZmFsc2VcbiAgICByZXR1cm4gc1xuICB9XG4gIGNvbnN0cnVjdG9yKFxuICAgIG1heDogbnVtYmVyLFxuICAgIEhlYXBDbHM6IHsgbmV3IChuOiBudW1iZXIpOiBOdW1iZXJBcnJheSB9LFxuICApIHtcbiAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICBpZiAoIVN0YWNrLiNjb25zdHJ1Y3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2luc3RhbnRpYXRlIFN0YWNrIHVzaW5nIFN0YWNrLmNyZWF0ZShuKScpXG4gICAgfVxuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgdGhpcy5oZWFwID0gbmV3IEhlYXBDbHMobWF4KVxuICAgIHRoaXMubGVuZ3RoID0gMFxuICB9XG4gIHB1c2gobjogSW5kZXgpIHtcbiAgICB0aGlzLmhlYXBbdGhpcy5sZW5ndGgrK10gPSBuXG4gIH1cbiAgcG9wKCk6IEluZGV4IHtcbiAgICByZXR1cm4gdGhpcy5oZWFwWy0tdGhpcy5sZW5ndGhdIGFzIEluZGV4XG4gIH1cbn1cblxuLyoqXG4gKiBQcm9taXNlIHJlcHJlc2VudGluZyBhbiBpbi1wcm9ncmVzcyB7QGxpbmsgTFJVQ2FjaGUjZmV0Y2h9IGNhbGxcbiAqL1xuZXhwb3J0IHR5cGUgQmFja2dyb3VuZEZldGNoPFY+ID0gUHJvbWlzZTxWIHwgdW5kZWZpbmVkPiAmIHtcbiAgX19yZXR1cm5lZDogQmFja2dyb3VuZEZldGNoPFY+IHwgdW5kZWZpbmVkXG4gIF9fYWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXJcbiAgX19zdGFsZVdoaWxlRmV0Y2hpbmc6IFYgfCB1bmRlZmluZWRcbn1cblxuZXhwb3J0IHR5cGUgRGlzcG9zZVRhc2s8SywgVj4gPSBbXG4gIHZhbHVlOiBWLFxuICBrZXk6IEssXG4gIHJlYXNvbjogTFJVQ2FjaGUuRGlzcG9zZVJlYXNvbixcbl1cblxuZXhwb3J0IG5hbWVzcGFjZSBMUlVDYWNoZSB7XG4gIC8qKlxuICAgKiBBbiBpbnRlZ2VyIGdyZWF0ZXIgdGhhbiAwLCByZWZsZWN0aW5nIHRoZSBjYWxjdWxhdGVkIHNpemUgb2YgaXRlbXNcbiAgICovXG4gIGV4cG9ydCB0eXBlIFNpemUgPSBudW1iZXJcblxuICAvKipcbiAgICogSW50ZWdlciBncmVhdGVyIHRoYW4gMCwgcmVwcmVzZW50aW5nIHNvbWUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcywgb3IgdGhlXG4gICAqIHRpbWUgYXQgd2hpY2ggYSBUVEwgc3RhcnRlZCBjb3VudGluZyBmcm9tLlxuICAgKi9cbiAgZXhwb3J0IHR5cGUgTWlsbGlzZWNvbmRzID0gbnVtYmVyXG5cbiAgLyoqXG4gICAqIEFuIGludGVnZXIgZ3JlYXRlciB0aGFuIDAsIHJlZmxlY3RpbmcgYSBudW1iZXIgb2YgaXRlbXNcbiAgICovXG4gIGV4cG9ydCB0eXBlIENvdW50ID0gbnVtYmVyXG5cbiAgLyoqXG4gICAqIFRoZSByZWFzb24gd2h5IGFuIGl0ZW0gd2FzIHJlbW92ZWQgZnJvbSB0aGUgY2FjaGUsIHBhc3NlZFxuICAgKiB0byB0aGUge0BsaW5rIERpc3Bvc2VyfSBtZXRob2RzLlxuICAgKlxuICAgKiAtIGBldmljdGA6IFRoZSBpdGVtIHdhcyBldmljdGVkIGJlY2F1c2UgaXQgaXMgdGhlIGxlYXN0IHJlY2VudGx5IHVzZWQsXG4gICAqICAgYW5kIHRoZSBjYWNoZSBpcyBmdWxsLlxuICAgKiAtIGBzZXRgOiBBIG5ldyB2YWx1ZSB3YXMgc2V0LCBvdmVyd3JpdGluZyB0aGUgb2xkIHZhbHVlIGJlaW5nIGRpc3Bvc2VkLlxuICAgKiAtIGBkZWxldGVgOiBUaGUgaXRlbSB3YXMgZXhwbGljaXRseSBkZWxldGVkLCBlaXRoZXIgYnkgY2FsbGluZ1xuICAgKiAgIHtAbGluayBMUlVDYWNoZSNkZWxldGV9LCB7QGxpbmsgTFJVQ2FjaGUjY2xlYXJ9LCBvclxuICAgKiAgIHtAbGluayBMUlVDYWNoZSNzZXR9IHdpdGggYW4gdW5kZWZpbmVkIHZhbHVlLlxuICAgKiAtIGBleHBpcmVgOiBUaGUgaXRlbSB3YXMgcmVtb3ZlZCBkdWUgdG8gZXhjZWVkaW5nIGl0cyBUVEwuXG4gICAqIC0gYGZldGNoYDogQSB7QGxpbmsgT3B0aW9uc0Jhc2UjZmV0Y2hNZXRob2R9IG9wZXJhdGlvbiByZXR1cm5lZFxuICAgKiAgIGB1bmRlZmluZWRgIG9yIHdhcyBhYm9ydGVkLCBjYXVzaW5nIHRoZSBpdGVtIHRvIGJlIGRlbGV0ZWQuXG4gICAqL1xuICBleHBvcnQgdHlwZSBEaXNwb3NlUmVhc29uID1cbiAgICB8ICdldmljdCdcbiAgICB8ICdzZXQnXG4gICAgfCAnZGVsZXRlJ1xuICAgIHwgJ2V4cGlyZSdcbiAgICB8ICdmZXRjaCdcbiAgLyoqXG4gICAqIEEgbWV0aG9kIGNhbGxlZCB1cG9uIGl0ZW0gcmVtb3ZhbCwgcGFzc2VkIGFzIHRoZVxuICAgKiB7QGxpbmsgT3B0aW9uc0Jhc2UuZGlzcG9zZX0gYW5kL29yXG4gICAqIHtAbGluayBPcHRpb25zQmFzZS5kaXNwb3NlQWZ0ZXJ9IG9wdGlvbnMuXG4gICAqL1xuICBleHBvcnQgdHlwZSBEaXNwb3NlcjxLLCBWPiA9IChcbiAgICB2YWx1ZTogVixcbiAgICBrZXk6IEssXG4gICAgcmVhc29uOiBEaXNwb3NlUmVhc29uLFxuICApID0+IHZvaWRcblxuICAvKipcbiAgICogVGhlIHJlYXNvbiB3aHkgYW4gaXRlbSB3YXMgYWRkZWQgdG8gdGhlIGNhY2hlLCBwYXNzZWRcbiAgICogdG8gdGhlIHtAbGluayBJbnNlcnRlcn0gbWV0aG9kcy5cbiAgICpcbiAgICogLSBgYWRkYDogdGhlIGl0ZW0gd2FzIG5vdCBmb3VuZCBpbiB0aGUgY2FjaGUsIGFuZCB3YXMgYWRkZWRcbiAgICogLSBgdXBkYXRlYDogdGhlIGl0ZW0gd2FzIGluIHRoZSBjYWNoZSwgd2l0aCB0aGUgc2FtZSB2YWx1ZSBwcm92aWRlZFxuICAgKiAtIGByZXBsYWNlYDogdGhlIGl0ZW0gd2FzIGluIHRoZSBjYWNoZSwgYW5kIHJlcGxhY2VkXG4gICAqL1xuICBleHBvcnQgdHlwZSBJbnNlcnRSZWFzb24gPSAnYWRkJyB8ICd1cGRhdGUnIHwgJ3JlcGxhY2UnXG5cbiAgLyoqXG4gICAqIEEgbWV0aG9kIGNhbGxlZCB1cG9uIGl0ZW0gaW5zZXJ0aW9uLCBwYXNzZWQgYXMgdGhlXG4gICAqIHtAbGluayBPcHRpb25zQmFzZS5pbnNlcnR9XG4gICAqL1xuICBleHBvcnQgdHlwZSBJbnNlcnRlcjxLLCBWPiA9IChcbiAgICB2YWx1ZTogVixcbiAgICBrZXk6IEssXG4gICAgcmVhc29uOiBJbnNlcnRSZWFzb24sXG4gICkgPT4gdm9pZFxuXG4gIC8qKlxuICAgKiBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgZWZmZWN0aXZlIGNhbGN1bGF0ZWQgc2l6ZVxuICAgKiBvZiBhbiBlbnRyeSBpbiB0aGUgY2FjaGUuXG4gICAqL1xuICBleHBvcnQgdHlwZSBTaXplQ2FsY3VsYXRvcjxLLCBWPiA9ICh2YWx1ZTogViwga2V5OiBLKSA9PiBTaXplXG5cbiAgLyoqXG4gICAqIE9wdGlvbnMgcHJvdmlkZWQgdG8gdGhlXG4gICAqIHtAbGluayBPcHRpb25zQmFzZS5mZXRjaE1ldGhvZH0gZnVuY3Rpb24uXG4gICAqL1xuICBleHBvcnQgaW50ZXJmYWNlIEZldGNoZXJPcHRpb25zPEssIFYsIEZDID0gdW5rbm93bj4ge1xuICAgIHNpZ25hbDogQWJvcnRTaWduYWxcbiAgICBvcHRpb25zOiBGZXRjaGVyRmV0Y2hPcHRpb25zPEssIFYsIEZDPlxuICAgIC8qKlxuICAgICAqIE9iamVjdCBwcm92aWRlZCBpbiB0aGUge0BsaW5rIEZldGNoT3B0aW9ucy5jb250ZXh0fSBvcHRpb24gdG9cbiAgICAgKiB7QGxpbmsgTFJVQ2FjaGUjZmV0Y2h9XG4gICAgICovXG4gICAgY29udGV4dDogRkNcbiAgfVxuXG4gIC8qKlxuICAgKiBPY2Nhc2lvbmFsbHksIGl0IG1heSBiZSB1c2VmdWwgdG8gdHJhY2sgdGhlIGludGVybmFsIGJlaGF2aW9yIG9mIHRoZVxuICAgKiBjYWNoZSwgcGFydGljdWxhcmx5IGZvciBsb2dnaW5nLCBkZWJ1Z2dpbmcsIG9yIGZvciBiZWhhdmlvciB3aXRoaW4gdGhlXG4gICAqIGBmZXRjaE1ldGhvZGAuIFRvIGRvIHRoaXMsIHlvdSBjYW4gcGFzcyBhIGBzdGF0dXNgIG9iamVjdCB0byB0aGVcbiAgICoge0BsaW5rIExSVUNhY2hlI2ZldGNofSwge0BsaW5rIExSVUNhY2hlI2dldH0sIHtAbGluayBMUlVDYWNoZSNzZXR9LFxuICAgKiB7QGxpbmsgTFJVQ2FjaGUjbWVtb30sIGFuZCB7QGxpbmsgTFJVQ2FjaGUjaGFzfSBtZXRob2RzLlxuICAgKlxuICAgKiBUaGUgYHN0YXR1c2Agb3B0aW9uIHNob3VsZCBiZSBhIHBsYWluIEphdmFTY3JpcHQgb2JqZWN0LiBUaGUgZm9sbG93aW5nXG4gICAqIGZpZWxkcyB3aWxsIGJlIHNldCBvbiBpdCBhcHByb3ByaWF0ZWx5LCBkZXBlbmRpbmcgb24gdGhlIHNpdHVhdGlvbi5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgU3RhdHVzPFY+IHtcbiAgICAvKipcbiAgICAgKiBUaGUgc3RhdHVzIG9mIGEgc2V0KCkgb3BlcmF0aW9uLlxuICAgICAqXG4gICAgICogLSBhZGQ6IHRoZSBpdGVtIHdhcyBub3QgZm91bmQgaW4gdGhlIGNhY2hlLCBhbmQgd2FzIGFkZGVkXG4gICAgICogLSB1cGRhdGU6IHRoZSBpdGVtIHdhcyBpbiB0aGUgY2FjaGUsIHdpdGggdGhlIHNhbWUgdmFsdWUgcHJvdmlkZWRcbiAgICAgKiAtIHJlcGxhY2U6IHRoZSBpdGVtIHdhcyBpbiB0aGUgY2FjaGUsIGFuZCByZXBsYWNlZFxuICAgICAqIC0gbWlzczogdGhlIGl0ZW0gd2FzIG5vdCBhZGRlZCB0byB0aGUgY2FjaGUgZm9yIHNvbWUgcmVhc29uXG4gICAgICovXG4gICAgc2V0PzogJ2FkZCcgfCAndXBkYXRlJyB8ICdyZXBsYWNlJyB8ICdtaXNzJ1xuXG4gICAgLyoqXG4gICAgICogdGhlIHR0bCBzdG9yZWQgZm9yIHRoZSBpdGVtLCBvciB1bmRlZmluZWQgaWYgdHRscyBhcmUgbm90IHVzZWQuXG4gICAgICovXG4gICAgdHRsPzogTWlsbGlzZWNvbmRzXG5cbiAgICAvKipcbiAgICAgKiB0aGUgc3RhcnQgdGltZSBmb3IgdGhlIGl0ZW0sIG9yIHVuZGVmaW5lZCBpZiB0dGxzIGFyZSBub3QgdXNlZC5cbiAgICAgKi9cbiAgICBzdGFydD86IE1pbGxpc2Vjb25kc1xuXG4gICAgLyoqXG4gICAgICogVGhlIHRpbWVzdGFtcCB1c2VkIGZvciBUVEwgY2FsY3VsYXRpb25cbiAgICAgKi9cbiAgICBub3c/OiBNaWxsaXNlY29uZHNcblxuICAgIC8qKlxuICAgICAqIHRoZSByZW1haW5pbmcgdHRsIGZvciB0aGUgaXRlbSwgb3IgdW5kZWZpbmVkIGlmIHR0bHMgYXJlIG5vdCB1c2VkLlxuICAgICAqL1xuICAgIHJlbWFpbmluZ1RUTD86IE1pbGxpc2Vjb25kc1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNhbGN1bGF0ZWQgc2l6ZSBmb3IgdGhlIGl0ZW0sIGlmIHNpemVzIGFyZSB1c2VkLlxuICAgICAqL1xuICAgIGVudHJ5U2l6ZT86IFNpemVcblxuICAgIC8qKlxuICAgICAqIFRoZSB0b3RhbCBjYWxjdWxhdGVkIHNpemUgb2YgdGhlIGNhY2hlLCBpZiBzaXplcyBhcmUgdXNlZC5cbiAgICAgKi9cbiAgICB0b3RhbENhbGN1bGF0ZWRTaXplPzogU2l6ZVxuXG4gICAgLyoqXG4gICAgICogQSBmbGFnIGluZGljYXRpbmcgdGhhdCB0aGUgaXRlbSB3YXMgbm90IHN0b3JlZCwgZHVlIHRvIGV4Y2VlZGluZyB0aGVcbiAgICAgKiB7QGxpbmsgT3B0aW9uc0Jhc2UubWF4RW50cnlTaXplfVxuICAgICAqL1xuICAgIG1heEVudHJ5U2l6ZUV4Y2VlZGVkPzogdHJ1ZVxuXG4gICAgLyoqXG4gICAgICogVGhlIG9sZCB2YWx1ZSwgc3BlY2lmaWVkIGluIHRoZSBjYXNlIG9mIGBzZXQ6J3VwZGF0ZSdgIG9yXG4gICAgICogYHNldDoncmVwbGFjZSdgXG4gICAgICovXG4gICAgb2xkVmFsdWU/OiBWXG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVzdWx0cyBvZiBhIHtAbGluayBMUlVDYWNoZSNoYXN9IG9wZXJhdGlvblxuICAgICAqXG4gICAgICogLSBoaXQ6IHRoZSBpdGVtIHdhcyBmb3VuZCBpbiB0aGUgY2FjaGVcbiAgICAgKiAtIHN0YWxlOiB0aGUgaXRlbSB3YXMgZm91bmQgaW4gdGhlIGNhY2hlLCBidXQgaXMgc3RhbGVcbiAgICAgKiAtIG1pc3M6IHRoZSBpdGVtIHdhcyBub3QgZm91bmQgaW4gdGhlIGNhY2hlXG4gICAgICovXG4gICAgaGFzPzogJ2hpdCcgfCAnc3RhbGUnIHwgJ21pc3MnXG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhdHVzIG9mIGEge0BsaW5rIExSVUNhY2hlI2ZldGNofSBvcGVyYXRpb24uXG4gICAgICogTm90ZSB0aGF0IHRoaXMgY2FuIGNoYW5nZSBhcyB0aGUgdW5kZXJseWluZyBmZXRjaCgpIG1vdmVzIHRocm91Z2hcbiAgICAgKiB2YXJpb3VzIHN0YXRlcy5cbiAgICAgKlxuICAgICAqIC0gaW5mbGlnaHQ6IHRoZXJlIGlzIGFub3RoZXIgZmV0Y2goKSBmb3IgdGhpcyBrZXkgd2hpY2ggaXMgaW4gcHJvY2Vzc1xuICAgICAqIC0gZ2V0OiB0aGVyZSBpcyBubyB7QGxpbmsgT3B0aW9uc0Jhc2UuZmV0Y2hNZXRob2R9LCBzb1xuICAgICAqICAge0BsaW5rIExSVUNhY2hlI2dldH0gd2FzIGNhbGxlZC5cbiAgICAgKiAtIG1pc3M6IHRoZSBpdGVtIGlzIG5vdCBpbiBjYWNoZSwgYW5kIHdpbGwgYmUgZmV0Y2hlZC5cbiAgICAgKiAtIGhpdDogdGhlIGl0ZW0gaXMgaW4gdGhlIGNhY2hlLCBhbmQgd2FzIHJlc29sdmVkIGltbWVkaWF0ZWx5LlxuICAgICAqIC0gc3RhbGU6IHRoZSBpdGVtIGlzIGluIHRoZSBjYWNoZSwgYnV0IHN0YWxlLlxuICAgICAqIC0gcmVmcmVzaDogdGhlIGl0ZW0gaXMgaW4gdGhlIGNhY2hlLCBhbmQgbm90IHN0YWxlLCBidXRcbiAgICAgKiAgIHtAbGluayBGZXRjaE9wdGlvbnMuZm9yY2VSZWZyZXNofSB3YXMgc3BlY2lmaWVkLlxuICAgICAqL1xuICAgIGZldGNoPzogJ2dldCcgfCAnaW5mbGlnaHQnIHwgJ21pc3MnIHwgJ2hpdCcgfCAnc3RhbGUnIHwgJ3JlZnJlc2gnXG5cbiAgICAvKipcbiAgICAgKiBUaGUge0BsaW5rIE9wdGlvbnNCYXNlLmZldGNoTWV0aG9kfSB3YXMgY2FsbGVkXG4gICAgICovXG4gICAgZmV0Y2hEaXNwYXRjaGVkPzogdHJ1ZVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNhY2hlZCB2YWx1ZSB3YXMgdXBkYXRlZCBhZnRlciBhIHN1Y2Nlc3NmdWwgY2FsbCB0b1xuICAgICAqIHtAbGluayBPcHRpb25zQmFzZS5mZXRjaE1ldGhvZH1cbiAgICAgKi9cbiAgICBmZXRjaFVwZGF0ZWQ/OiB0cnVlXG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVhc29uIGZvciBhIGZldGNoKCkgcmVqZWN0aW9uLiAgRWl0aGVyIHRoZSBlcnJvciByYWlzZWQgYnkgdGhlXG4gICAgICoge0BsaW5rIE9wdGlvbnNCYXNlLmZldGNoTWV0aG9kfSwgb3IgdGhlIHJlYXNvbiBmb3IgYW5cbiAgICAgKiBBYm9ydFNpZ25hbC5cbiAgICAgKi9cbiAgICBmZXRjaEVycm9yPzogRXJyb3JcblxuICAgIC8qKlxuICAgICAqIFRoZSBmZXRjaCByZWNlaXZlZCBhbiBhYm9ydCBzaWduYWxcbiAgICAgKi9cbiAgICBmZXRjaEFib3J0ZWQ/OiB0cnVlXG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWJvcnQgc2lnbmFsIHJlY2VpdmVkIHdhcyBpZ25vcmVkLCBhbmQgdGhlIGZldGNoIHdhcyBhbGxvd2VkIHRvXG4gICAgICogY29udGludWUuXG4gICAgICovXG4gICAgZmV0Y2hBYm9ydElnbm9yZWQ/OiB0cnVlXG5cbiAgICAvKipcbiAgICAgKiBUaGUgZmV0Y2hNZXRob2QgcHJvbWlzZSByZXNvbHZlZCBzdWNjZXNzZnVsbHlcbiAgICAgKi9cbiAgICBmZXRjaFJlc29sdmVkPzogdHJ1ZVxuXG4gICAgLyoqXG4gICAgICogVGhlIGZldGNoTWV0aG9kIHByb21pc2Ugd2FzIHJlamVjdGVkXG4gICAgICovXG4gICAgZmV0Y2hSZWplY3RlZD86IHRydWVcblxuICAgIC8qKlxuICAgICAqIFRoZSBzdGF0dXMgb2YgYSB7QGxpbmsgTFJVQ2FjaGUjZ2V0fSBvcGVyYXRpb24uXG4gICAgICpcbiAgICAgKiAtIGZldGNoaW5nOiBUaGUgaXRlbSBpcyBjdXJyZW50bHkgYmVpbmcgZmV0Y2hlZC4gIElmIGEgcHJldmlvdXMgdmFsdWVcbiAgICAgKiAgIGlzIHByZXNlbnQgYW5kIGFsbG93ZWQsIHRoYXQgd2lsbCBiZSByZXR1cm5lZC5cbiAgICAgKiAtIHN0YWxlOiBUaGUgaXRlbSBpcyBpbiB0aGUgY2FjaGUsIGFuZCBpcyBzdGFsZS5cbiAgICAgKiAtIGhpdDogdGhlIGl0ZW0gaXMgaW4gdGhlIGNhY2hlXG4gICAgICogLSBtaXNzOiB0aGUgaXRlbSBpcyBub3QgaW4gdGhlIGNhY2hlXG4gICAgICovXG4gICAgZ2V0PzogJ3N0YWxlJyB8ICdoaXQnIHwgJ21pc3MnXG5cbiAgICAvKipcbiAgICAgKiBBIGZldGNoIG9yIGdldCBvcGVyYXRpb24gcmV0dXJuZWQgYSBzdGFsZSB2YWx1ZS5cbiAgICAgKi9cbiAgICByZXR1cm5lZFN0YWxlPzogdHJ1ZVxuICB9XG5cbiAgLyoqXG4gICAqIG9wdGlvbnMgd2hpY2ggb3ZlcnJpZGUgdGhlIG9wdGlvbnMgc2V0IGluIHRoZSBMUlVDYWNoZSBjb25zdHJ1Y3RvclxuICAgKiB3aGVuIGNhbGxpbmcge0BsaW5rIExSVUNhY2hlI2ZldGNofS5cbiAgICpcbiAgICogVGhpcyBpcyB0aGUgdW5pb24gb2Yge0BsaW5rIEdldE9wdGlvbnN9IGFuZCB7QGxpbmsgU2V0T3B0aW9uc30sIHBsdXNcbiAgICoge0BsaW5rIE9wdGlvbnNCYXNlLm5vRGVsZXRlT25GZXRjaFJlamVjdGlvbn0sXG4gICAqIHtAbGluayBPcHRpb25zQmFzZS5hbGxvd1N0YWxlT25GZXRjaFJlamVjdGlvbn0sXG4gICAqIHtAbGluayBGZXRjaE9wdGlvbnMuZm9yY2VSZWZyZXNofSwgYW5kXG4gICAqIHtAbGluayBGZXRjaGVyT3B0aW9ucy5jb250ZXh0fVxuICAgKlxuICAgKiBBbnkgb2YgdGhlc2UgbWF5IGJlIG1vZGlmaWVkIGluIHRoZSB7QGxpbmsgT3B0aW9uc0Jhc2UuZmV0Y2hNZXRob2R9XG4gICAqIGZ1bmN0aW9uLCBidXQgdGhlIHtAbGluayBHZXRPcHRpb25zfSBmaWVsZHMgd2lsbCBvZiBjb3Vyc2UgaGF2ZSBub1xuICAgKiBlZmZlY3QsIGFzIHRoZSB7QGxpbmsgTFJVQ2FjaGUjZ2V0fSBjYWxsIGFscmVhZHkgaGFwcGVuZWQgYnkgdGhlIHRpbWVcbiAgICogdGhlIGZldGNoTWV0aG9kIGlzIGNhbGxlZC5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgRmV0Y2hlckZldGNoT3B0aW9uczxLLCBWLCBGQyA9IHVua25vd24+XG4gICAgZXh0ZW5kcyBQaWNrPFxuICAgICAgT3B0aW9uc0Jhc2U8SywgViwgRkM+LFxuICAgICAgfCAnYWxsb3dTdGFsZSdcbiAgICAgIHwgJ3VwZGF0ZUFnZU9uR2V0J1xuICAgICAgfCAnbm9EZWxldGVPblN0YWxlR2V0J1xuICAgICAgfCAnc2l6ZUNhbGN1bGF0aW9uJ1xuICAgICAgfCAndHRsJ1xuICAgICAgfCAnbm9EaXNwb3NlT25TZXQnXG4gICAgICB8ICdub1VwZGF0ZVRUTCdcbiAgICAgIHwgJ25vRGVsZXRlT25GZXRjaFJlamVjdGlvbidcbiAgICAgIHwgJ2FsbG93U3RhbGVPbkZldGNoUmVqZWN0aW9uJ1xuICAgICAgfCAnaWdub3JlRmV0Y2hBYm9ydCdcbiAgICAgIHwgJ2FsbG93U3RhbGVPbkZldGNoQWJvcnQnXG4gICAgPiB7XG4gICAgc3RhdHVzPzogU3RhdHVzPFY+XG4gICAgc2l6ZT86IFNpemVcbiAgfVxuXG4gIC8qKlxuICAgKiBPcHRpb25zIHRoYXQgbWF5IGJlIHBhc3NlZCB0byB0aGUge0BsaW5rIExSVUNhY2hlI2ZldGNofSBtZXRob2QuXG4gICAqL1xuICBleHBvcnQgaW50ZXJmYWNlIEZldGNoT3B0aW9uczxLLCBWLCBGQz5cbiAgICBleHRlbmRzIEZldGNoZXJGZXRjaE9wdGlvbnM8SywgViwgRkM+IHtcbiAgICAvKipcbiAgICAgKiBTZXQgdG8gdHJ1ZSB0byBmb3JjZSBhIHJlLWxvYWQgb2YgdGhlIGV4aXN0aW5nIGRhdGEsIGV2ZW4gaWYgaXRcbiAgICAgKiBpcyBub3QgeWV0IHN0YWxlLlxuICAgICAqL1xuICAgIGZvcmNlUmVmcmVzaD86IGJvb2xlYW5cbiAgICAvKipcbiAgICAgKiBDb250ZXh0IHByb3ZpZGVkIHRvIHRoZSB7QGxpbmsgT3B0aW9uc0Jhc2UuZmV0Y2hNZXRob2R9IGFzXG4gICAgICogdGhlIHtAbGluayBGZXRjaGVyT3B0aW9ucy5jb250ZXh0fSBwYXJhbS5cbiAgICAgKlxuICAgICAqIElmIHRoZSBGQyB0eXBlIGlzIHNwZWNpZmllZCBhcyB1bmtub3duICh0aGUgZGVmYXVsdCksXG4gICAgICogdW5kZWZpbmVkIG9yIHZvaWQsIHRoZW4gdGhpcyBpcyBvcHRpb25hbC4gIE90aGVyd2lzZSwgaXQgd2lsbFxuICAgICAqIGJlIHJlcXVpcmVkLlxuICAgICAqL1xuICAgIGNvbnRleHQ/OiBGQ1xuICAgIHNpZ25hbD86IEFib3J0U2lnbmFsXG4gICAgc3RhdHVzPzogU3RhdHVzPFY+XG4gIH1cbiAgLyoqXG4gICAqIE9wdGlvbnMgcHJvdmlkZWQgdG8ge0BsaW5rIExSVUNhY2hlI2ZldGNofSB3aGVuIHRoZSBGQyB0eXBlIGlzIHNvbWV0aGluZ1xuICAgKiBvdGhlciB0aGFuIGB1bmtub3duYCwgYHVuZGVmaW5lZGAsIG9yIGB2b2lkYFxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBGZXRjaE9wdGlvbnNXaXRoQ29udGV4dDxLLCBWLCBGQz5cbiAgICBleHRlbmRzIEZldGNoT3B0aW9uczxLLCBWLCBGQz4ge1xuICAgIGNvbnRleHQ6IEZDXG4gIH1cbiAgLyoqXG4gICAqIE9wdGlvbnMgcHJvdmlkZWQgdG8ge0BsaW5rIExSVUNhY2hlI2ZldGNofSB3aGVuIHRoZSBGQyB0eXBlIGlzXG4gICAqIGB1bmRlZmluZWRgIG9yIGB2b2lkYFxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBGZXRjaE9wdGlvbnNOb0NvbnRleHQ8SywgVj5cbiAgICBleHRlbmRzIEZldGNoT3B0aW9uczxLLCBWLCB1bmRlZmluZWQ+IHtcbiAgICBjb250ZXh0PzogdW5kZWZpbmVkXG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIE1lbW9PcHRpb25zPEssIFYsIEZDID0gdW5rbm93bj5cbiAgICBleHRlbmRzIFBpY2s8XG4gICAgICBPcHRpb25zQmFzZTxLLCBWLCBGQz4sXG4gICAgICB8ICdhbGxvd1N0YWxlJ1xuICAgICAgfCAndXBkYXRlQWdlT25HZXQnXG4gICAgICB8ICdub0RlbGV0ZU9uU3RhbGVHZXQnXG4gICAgICB8ICdzaXplQ2FsY3VsYXRpb24nXG4gICAgICB8ICd0dGwnXG4gICAgICB8ICdub0Rpc3Bvc2VPblNldCdcbiAgICAgIHwgJ25vVXBkYXRlVFRMJ1xuICAgICAgfCAnbm9EZWxldGVPbkZldGNoUmVqZWN0aW9uJ1xuICAgICAgfCAnYWxsb3dTdGFsZU9uRmV0Y2hSZWplY3Rpb24nXG4gICAgICB8ICdpZ25vcmVGZXRjaEFib3J0J1xuICAgICAgfCAnYWxsb3dTdGFsZU9uRmV0Y2hBYm9ydCdcbiAgICA+IHtcbiAgICAvKipcbiAgICAgKiBTZXQgdG8gdHJ1ZSB0byBmb3JjZSBhIHJlLWxvYWQgb2YgdGhlIGV4aXN0aW5nIGRhdGEsIGV2ZW4gaWYgaXRcbiAgICAgKiBpcyBub3QgeWV0IHN0YWxlLlxuICAgICAqL1xuICAgIGZvcmNlUmVmcmVzaD86IGJvb2xlYW5cbiAgICAvKipcbiAgICAgKiBDb250ZXh0IHByb3ZpZGVkIHRvIHRoZSB7QGxpbmsgT3B0aW9uc0Jhc2UubWVtb01ldGhvZH0gYXNcbiAgICAgKiB0aGUge0BsaW5rIE1lbW9pemVyT3B0aW9ucy5jb250ZXh0fSBwYXJhbS5cbiAgICAgKlxuICAgICAqIElmIHRoZSBGQyB0eXBlIGlzIHNwZWNpZmllZCBhcyB1bmtub3duICh0aGUgZGVmYXVsdCksXG4gICAgICogdW5kZWZpbmVkIG9yIHZvaWQsIHRoZW4gdGhpcyBpcyBvcHRpb25hbC4gIE90aGVyd2lzZSwgaXQgd2lsbFxuICAgICAqIGJlIHJlcXVpcmVkLlxuICAgICAqL1xuICAgIGNvbnRleHQ/OiBGQ1xuICAgIHN0YXR1cz86IFN0YXR1czxWPlxuICB9XG4gIC8qKlxuICAgKiBPcHRpb25zIHByb3ZpZGVkIHRvIHtAbGluayBMUlVDYWNoZSNtZW1vfSB3aGVuIHRoZSBGQyB0eXBlIGlzIHNvbWV0aGluZ1xuICAgKiBvdGhlciB0aGFuIGB1bmtub3duYCwgYHVuZGVmaW5lZGAsIG9yIGB2b2lkYFxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBNZW1vT3B0aW9uc1dpdGhDb250ZXh0PEssIFYsIEZDPlxuICAgIGV4dGVuZHMgTWVtb09wdGlvbnM8SywgViwgRkM+IHtcbiAgICBjb250ZXh0OiBGQ1xuICB9XG4gIC8qKlxuICAgKiBPcHRpb25zIHByb3ZpZGVkIHRvIHtAbGluayBMUlVDYWNoZSNtZW1vfSB3aGVuIHRoZSBGQyB0eXBlIGlzXG4gICAqIGB1bmRlZmluZWRgIG9yIGB2b2lkYFxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBNZW1vT3B0aW9uc05vQ29udGV4dDxLLCBWPlxuICAgIGV4dGVuZHMgTWVtb09wdGlvbnM8SywgViwgdW5kZWZpbmVkPiB7XG4gICAgY29udGV4dD86IHVuZGVmaW5lZFxuICB9XG5cbiAgLyoqXG4gICAqIE9wdGlvbnMgcHJvdmlkZWQgdG8gdGhlXG4gICAqIHtAbGluayBPcHRpb25zQmFzZS5tZW1vTWV0aG9kfSBmdW5jdGlvbi5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgTWVtb2l6ZXJPcHRpb25zPEssIFYsIEZDID0gdW5rbm93bj4ge1xuICAgIG9wdGlvbnM6IE1lbW9pemVyTWVtb09wdGlvbnM8SywgViwgRkM+XG4gICAgLyoqXG4gICAgICogT2JqZWN0IHByb3ZpZGVkIGluIHRoZSB7QGxpbmsgTWVtb09wdGlvbnMuY29udGV4dH0gb3B0aW9uIHRvXG4gICAgICoge0BsaW5rIExSVUNhY2hlI21lbW99XG4gICAgICovXG4gICAgY29udGV4dDogRkNcbiAgfVxuXG4gIC8qKlxuICAgKiBvcHRpb25zIHdoaWNoIG92ZXJyaWRlIHRoZSBvcHRpb25zIHNldCBpbiB0aGUgTFJVQ2FjaGUgY29uc3RydWN0b3JcbiAgICogd2hlbiBjYWxsaW5nIHtAbGluayBMUlVDYWNoZSNtZW1vfS5cbiAgICpcbiAgICogVGhpcyBpcyB0aGUgdW5pb24gb2Yge0BsaW5rIEdldE9wdGlvbnN9IGFuZCB7QGxpbmsgU2V0T3B0aW9uc30sIHBsdXNcbiAgICoge0BsaW5rIE1lbW9PcHRpb25zLmZvcmNlUmVmcmVzaH0sIGFuZFxuICAgKiB7QGxpbmsgTWVtb09wdGlvbnMuY29udGV4dH1cbiAgICpcbiAgICogQW55IG9mIHRoZXNlIG1heSBiZSBtb2RpZmllZCBpbiB0aGUge0BsaW5rIE9wdGlvbnNCYXNlLm1lbW9NZXRob2R9XG4gICAqIGZ1bmN0aW9uLCBidXQgdGhlIHtAbGluayBHZXRPcHRpb25zfSBmaWVsZHMgd2lsbCBvZiBjb3Vyc2UgaGF2ZSBub1xuICAgKiBlZmZlY3QsIGFzIHRoZSB7QGxpbmsgTFJVQ2FjaGUjZ2V0fSBjYWxsIGFscmVhZHkgaGFwcGVuZWQgYnkgdGhlIHRpbWVcbiAgICogdGhlIG1lbW9NZXRob2QgaXMgY2FsbGVkLlxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBNZW1vaXplck1lbW9PcHRpb25zPEssIFYsIEZDID0gdW5rbm93bj5cbiAgICBleHRlbmRzIFBpY2s8XG4gICAgICBPcHRpb25zQmFzZTxLLCBWLCBGQz4sXG4gICAgICB8ICdhbGxvd1N0YWxlJ1xuICAgICAgfCAndXBkYXRlQWdlT25HZXQnXG4gICAgICB8ICdub0RlbGV0ZU9uU3RhbGVHZXQnXG4gICAgICB8ICdzaXplQ2FsY3VsYXRpb24nXG4gICAgICB8ICd0dGwnXG4gICAgICB8ICdub0Rpc3Bvc2VPblNldCdcbiAgICAgIHwgJ25vVXBkYXRlVFRMJ1xuICAgID4ge1xuICAgIHN0YXR1cz86IFN0YXR1czxWPlxuICAgIHNpemU/OiBTaXplXG4gICAgc3RhcnQ/OiBNaWxsaXNlY29uZHNcbiAgfVxuXG4gIC8qKlxuICAgKiBPcHRpb25zIHRoYXQgbWF5IGJlIHBhc3NlZCB0byB0aGUge0BsaW5rIExSVUNhY2hlI2hhc30gbWV0aG9kLlxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBIYXNPcHRpb25zPEssIFYsIEZDPlxuICAgIGV4dGVuZHMgUGljazxPcHRpb25zQmFzZTxLLCBWLCBGQz4sICd1cGRhdGVBZ2VPbkhhcyc+IHtcbiAgICBzdGF0dXM/OiBTdGF0dXM8Vj5cbiAgfVxuXG4gIC8qKlxuICAgKiBPcHRpb25zIHRoYXQgbWF5IGJlIHBhc3NlZCB0byB0aGUge0BsaW5rIExSVUNhY2hlI2dldH0gbWV0aG9kLlxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBHZXRPcHRpb25zPEssIFYsIEZDPlxuICAgIGV4dGVuZHMgUGljazxcbiAgICAgIE9wdGlvbnNCYXNlPEssIFYsIEZDPixcbiAgICAgICdhbGxvd1N0YWxlJyB8ICd1cGRhdGVBZ2VPbkdldCcgfCAnbm9EZWxldGVPblN0YWxlR2V0J1xuICAgID4ge1xuICAgIHN0YXR1cz86IFN0YXR1czxWPlxuICB9XG5cbiAgLyoqXG4gICAqIE9wdGlvbnMgdGhhdCBtYXkgYmUgcGFzc2VkIHRvIHRoZSB7QGxpbmsgTFJVQ2FjaGUjcGVla30gbWV0aG9kLlxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBQZWVrT3B0aW9uczxLLCBWLCBGQz5cbiAgICBleHRlbmRzIFBpY2s8T3B0aW9uc0Jhc2U8SywgViwgRkM+LCAnYWxsb3dTdGFsZSc+IHt9XG5cbiAgLyoqXG4gICAqIE9wdGlvbnMgdGhhdCBtYXkgYmUgcGFzc2VkIHRvIHRoZSB7QGxpbmsgTFJVQ2FjaGUjc2V0fSBtZXRob2QuXG4gICAqL1xuICBleHBvcnQgaW50ZXJmYWNlIFNldE9wdGlvbnM8SywgViwgRkM+XG4gICAgZXh0ZW5kcyBQaWNrPFxuICAgICAgT3B0aW9uc0Jhc2U8SywgViwgRkM+LFxuICAgICAgJ3NpemVDYWxjdWxhdGlvbicgfCAndHRsJyB8ICdub0Rpc3Bvc2VPblNldCcgfCAnbm9VcGRhdGVUVEwnXG4gICAgPiB7XG4gICAgLyoqXG4gICAgICogSWYgc2l6ZSB0cmFja2luZyBpcyBlbmFibGVkLCB0aGVuIHNldHRpbmcgYW4gZXhwbGljaXQgc2l6ZVxuICAgICAqIGluIHRoZSB7QGxpbmsgTFJVQ2FjaGUjc2V0fSBjYWxsIHdpbGwgcHJldmVudCBjYWxsaW5nIHRoZVxuICAgICAqIHtAbGluayBPcHRpb25zQmFzZS5zaXplQ2FsY3VsYXRpb259IGZ1bmN0aW9uLlxuICAgICAqL1xuICAgIHNpemU/OiBTaXplXG4gICAgLyoqXG4gICAgICogSWYgVFRMIHRyYWNraW5nIGlzIGVuYWJsZWQsIHRoZW4gc2V0dGluZyBhbiBleHBsaWNpdCBzdGFydFxuICAgICAqIHRpbWUgaW4gdGhlIHtAbGluayBMUlVDYWNoZSNzZXR9IGNhbGwgd2lsbCBvdmVycmlkZSB0aGVcbiAgICAgKiBkZWZhdWx0IHRpbWUgZnJvbSBgcGVyZm9ybWFuY2Uubm93KClgIG9yIGBEYXRlLm5vdygpYC5cbiAgICAgKlxuICAgICAqIE5vdGUgdGhhdCBpdCBtdXN0IGJlIGEgdmFsaWQgdmFsdWUgZm9yIHdoaWNoZXZlciB0aW1lLXRyYWNraW5nXG4gICAgICogbWV0aG9kIGlzIGluIHVzZS5cbiAgICAgKi9cbiAgICBzdGFydD86IE1pbGxpc2Vjb25kc1xuICAgIHN0YXR1cz86IFN0YXR1czxWPlxuICB9XG5cbiAgLyoqXG4gICAqIFRoZSB0eXBlIHNpZ25hdHVyZSBmb3IgdGhlIHtAbGluayBPcHRpb25zQmFzZS5mZXRjaE1ldGhvZH0gb3B0aW9uLlxuICAgKi9cbiAgZXhwb3J0IHR5cGUgRmV0Y2hlcjxLLCBWLCBGQyA9IHVua25vd24+ID0gKFxuICAgIGtleTogSyxcbiAgICBzdGFsZVZhbHVlOiBWIHwgdW5kZWZpbmVkLFxuICAgIG9wdGlvbnM6IEZldGNoZXJPcHRpb25zPEssIFYsIEZDPixcbiAgKSA9PiBQcm9taXNlPFYgfCB1bmRlZmluZWQgfCB2b2lkPiB8IFYgfCB1bmRlZmluZWQgfCB2b2lkXG5cbiAgLyoqXG4gICAqIHRoZSB0eXBlIHNpZ25hdHVyZSBmb3IgdGhlIHtAbGluayBPcHRpb25zQmFzZS5tZW1vTWV0aG9kfSBvcHRpb24uXG4gICAqL1xuICBleHBvcnQgdHlwZSBNZW1vaXplcjxLLCBWLCBGQyA9IHVua25vd24+ID0gKFxuICAgIGtleTogSyxcbiAgICBzdGFsZVZhbHVlOiBWIHwgdW5kZWZpbmVkLFxuICAgIG9wdGlvbnM6IE1lbW9pemVyT3B0aW9uczxLLCBWLCBGQz4sXG4gICkgPT4gVlxuXG4gIC8qKlxuICAgKiBPcHRpb25zIHdoaWNoIG1heSBiZSBwYXNzZWQgdG8gdGhlIHtAbGluayBMUlVDYWNoZX0gY29uc3RydWN0b3IuXG4gICAqXG4gICAqIE1vc3Qgb2YgdGhlc2UgbWF5IGJlIG92ZXJyaWRkZW4gaW4gdGhlIHZhcmlvdXMgb3B0aW9ucyB0aGF0IHVzZVxuICAgKiB0aGVtLlxuICAgKlxuICAgKiBEZXNwaXRlIGFsbCBiZWluZyB0ZWNobmljYWxseSBvcHRpb25hbCwgdGhlIGNvbnN0cnVjdG9yIHJlcXVpcmVzIHRoYXRcbiAgICogYSBjYWNoZSBpcyBhdCBtaW5pbXVtIGxpbWl0ZWQgYnkgb25lIG9yIG1vcmUgb2Yge0BsaW5rIE9wdGlvbnNCYXNlLm1heH0sXG4gICAqIHtAbGluayBPcHRpb25zQmFzZS50dGx9LCBvciB7QGxpbmsgT3B0aW9uc0Jhc2UubWF4U2l6ZX0uXG4gICAqXG4gICAqIElmIHtAbGluayBPcHRpb25zQmFzZS50dGx9IGlzIHVzZWQgYWxvbmUsIHRoZW4gaXQgaXMgc3Ryb25nbHkgYWR2aXNlZFxuICAgKiAoYW5kIGluIGZhY3QgcmVxdWlyZWQgYnkgdGhlIHR5cGUgZGVmaW5pdGlvbnMgaGVyZSkgdGhhdCB0aGUgY2FjaGVcbiAgICogYWxzbyBzZXQge0BsaW5rIE9wdGlvbnNCYXNlLnR0bEF1dG9wdXJnZX0sIHRvIHByZXZlbnQgcG90ZW50aWFsbHlcbiAgICogdW5ib3VuZGVkIHN0b3JhZ2UuXG4gICAqXG4gICAqIEFsbCBvcHRpb25zIGFyZSBhbHNvIGF2YWlsYWJsZSBvbiB0aGUge0BsaW5rIExSVUNhY2hlfSBpbnN0YW5jZSwgbWFraW5nXG4gICAqIGl0IHNhZmUgdG8gcGFzcyBhbiBMUlVDYWNoZSBpbnN0YW5jZSBhcyB0aGUgb3B0aW9ucyBhcmd1bWVtbnQgdG9cbiAgICogbWFrZSBhbm90aGVyIGVtcHR5IGNhY2hlIG9mIHRoZSBzYW1lIHR5cGUuXG4gICAqXG4gICAqIFNvbWUgb3B0aW9ucyBhcmUgbWFya2VkIGFzIHJlYWQtb25seSwgYmVjYXVzZSBjaGFuZ2luZyB0aGVtIGFmdGVyXG4gICAqIGluc3RhbnRpYXRpb24gaXMgbm90IHNhZmUuIENoYW5naW5nIGFueSBvZiB0aGUgb3RoZXIgb3B0aW9ucyB3aWxsIG9mXG4gICAqIGNvdXJzZSBvbmx5IGhhdmUgYW4gZWZmZWN0IG9uIHN1YnNlcXVlbnQgbWV0aG9kIGNhbGxzLlxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBPcHRpb25zQmFzZTxLLCBWLCBGQz4ge1xuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBpdGVtcyB0byBzdG9yZSBpbiB0aGUgY2FjaGUgYmVmb3JlIGV2aWN0aW5nXG4gICAgICogb2xkIGVudHJpZXMuIFRoaXMgaXMgcmVhZC1vbmx5IG9uIHRoZSB7QGxpbmsgTFJVQ2FjaGV9IGluc3RhbmNlLFxuICAgICAqIGFuZCBtYXkgbm90IGJlIG92ZXJyaWRkZW4uXG4gICAgICpcbiAgICAgKiBJZiBzZXQsIHRoZW4gc3RvcmFnZSBzcGFjZSB3aWxsIGJlIHByZS1hbGxvY2F0ZWQgYXQgY29uc3RydWN0aW9uXG4gICAgICogdGltZSwgYW5kIHRoZSBjYWNoZSB3aWxsIHBlcmZvcm0gc2lnbmlmaWNhbnRseSBmYXN0ZXIuXG4gICAgICpcbiAgICAgKiBOb3RlIHRoYXQgc2lnbmlmaWNhbnRseSBmZXdlciBpdGVtcyBtYXkgYmUgc3RvcmVkLCBpZlxuICAgICAqIHtAbGluayBPcHRpb25zQmFzZS5tYXhTaXplfSBhbmQvb3Ige0BsaW5rIE9wdGlvbnNCYXNlLnR0bH0gYXJlIGFsc29cbiAgICAgKiBzZXQuXG4gICAgICpcbiAgICAgKiAqKkl0IGlzIHN0cm9uZ2x5IHJlY29tbWVuZGVkIHRvIHNldCBhIGBtYXhgIHRvIHByZXZlbnQgdW5ib3VuZGVkIGdyb3d0aFxuICAgICAqIG9mIHRoZSBjYWNoZS4qKlxuICAgICAqL1xuICAgIG1heD86IENvdW50XG5cbiAgICAvKipcbiAgICAgKiBNYXggdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIGl0ZW1zIHRvIGxpdmUgaW4gY2FjaGUgYmVmb3JlIHRoZXkgYXJlXG4gICAgICogY29uc2lkZXJlZCBzdGFsZS4gIE5vdGUgdGhhdCBzdGFsZSBpdGVtcyBhcmUgTk9UIHByZWVtcHRpdmVseSByZW1vdmVkIGJ5XG4gICAgICogZGVmYXVsdCwgYW5kIE1BWSBsaXZlIGluIHRoZSBjYWNoZSwgY29udHJpYnV0aW5nIHRvIGl0cyBMUlUgbWF4LCBsb25nXG4gICAgICogYWZ0ZXIgdGhleSBoYXZlIGV4cGlyZWQsIHVubGVzcyB7QGxpbmsgT3B0aW9uc0Jhc2UudHRsQXV0b3B1cmdlfSBpc1xuICAgICAqIHNldC5cbiAgICAgKlxuICAgICAqIElmIHNldCB0byBgMGAgKHRoZSBkZWZhdWx0IHZhbHVlKSwgdGhlbiB0aGF0IG1lYW5zIFwiZG8gbm90IHRyYWNrXG4gICAgICogVFRMXCIsIG5vdCBcImV4cGlyZSBpbW1lZGlhdGVseVwiLlxuICAgICAqXG4gICAgICogQWxzbywgYXMgdGhpcyBjYWNoZSBpcyBvcHRpbWl6ZWQgZm9yIExSVS9NUlUgb3BlcmF0aW9ucywgc29tZSBvZlxuICAgICAqIHRoZSBzdGFsZW5lc3MvVFRMIGNoZWNrcyB3aWxsIHJlZHVjZSBwZXJmb3JtYW5jZSwgYXMgdGhleSB3aWxsIGluY3VyXG4gICAgICogb3ZlcmhlYWQgYnkgZGVsZXRpbmcgaXRlbXMuXG4gICAgICpcbiAgICAgKiBUaGlzIGlzIG5vdCBwcmltYXJpbHkgYSBUVEwgY2FjaGUsIGFuZCBkb2VzIG5vdCBtYWtlIHN0cm9uZyBUVExcbiAgICAgKiBndWFyYW50ZWVzLiBUaGVyZSBpcyBubyBwcmUtZW1wdGl2ZSBwcnVuaW5nIG9mIGV4cGlyZWQgaXRlbXMsIGJ1dCB5b3VcbiAgICAgKiBfbWF5XyBzZXQgYSBUVEwgb24gdGhlIGNhY2hlLCBhbmQgaXQgd2lsbCB0cmVhdCBleHBpcmVkIGl0ZW1zIGFzIG1pc3NpbmdcbiAgICAgKiB3aGVuIHRoZXkgYXJlIGZldGNoZWQsIGFuZCBkZWxldGUgdGhlbS5cbiAgICAgKlxuICAgICAqIE9wdGlvbmFsLCBidXQgbXVzdCBiZSBhIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyIGluIG1zIGlmIHNwZWNpZmllZC5cbiAgICAgKlxuICAgICAqIFRoaXMgbWF5IGJlIG92ZXJyaWRkZW4gYnkgcGFzc2luZyBhbiBvcHRpb25zIG9iamVjdCB0byBgY2FjaGUuc2V0KClgLlxuICAgICAqXG4gICAgICogQXQgbGVhc3Qgb25lIG9mIGBtYXhgLCBgbWF4U2l6ZWAsIG9yIGBUVExgIGlzIHJlcXVpcmVkLiBUaGlzIG11c3QgYmUgYVxuICAgICAqIHBvc2l0aXZlIGludGVnZXIgaWYgc2V0LlxuICAgICAqXG4gICAgICogRXZlbiBpZiB0dGwgdHJhY2tpbmcgaXMgZW5hYmxlZCwgKippdCBpcyBzdHJvbmdseSByZWNvbW1lbmRlZCB0byBzZXQgYVxuICAgICAqIGBtYXhgIHRvIHByZXZlbnQgdW5ib3VuZGVkIGdyb3d0aCBvZiB0aGUgY2FjaGUuKipcbiAgICAgKlxuICAgICAqIElmIHR0bCB0cmFja2luZyBpcyBlbmFibGVkLCBhbmQgYG1heGAgYW5kIGBtYXhTaXplYCBhcmUgbm90IHNldCxcbiAgICAgKiBhbmQgYHR0bEF1dG9wdXJnZWAgaXMgbm90IHNldCwgdGhlbiBhIHdhcm5pbmcgd2lsbCBiZSBlbWl0dGVkXG4gICAgICogY2F1dGlvbmluZyBhYm91dCB0aGUgcG90ZW50aWFsIGZvciB1bmJvdW5kZWQgbWVtb3J5IGNvbnN1bXB0aW9uLlxuICAgICAqIChUaGUgVHlwZVNjcmlwdCBkZWZpbml0aW9ucyB3aWxsIGFsc28gZGlzY291cmFnZSB0aGlzLilcbiAgICAgKi9cbiAgICB0dGw/OiBNaWxsaXNlY29uZHNcblxuICAgIC8qKlxuICAgICAqIE1pbmltdW0gYW1vdW50IG9mIHRpbWUgaW4gbXMgaW4gd2hpY2ggdG8gY2hlY2sgZm9yIHN0YWxlbmVzcy5cbiAgICAgKiBEZWZhdWx0cyB0byAxLCB3aGljaCBtZWFucyB0aGF0IHRoZSBjdXJyZW50IHRpbWUgaXMgY2hlY2tlZFxuICAgICAqIGF0IG1vc3Qgb25jZSBwZXIgbWlsbGlzZWNvbmQuXG4gICAgICpcbiAgICAgKiBTZXQgdG8gMCB0byBjaGVjayB0aGUgY3VycmVudCB0aW1lIGV2ZXJ5IHRpbWUgc3RhbGVuZXNzIGlzIHRlc3RlZC5cbiAgICAgKiAoVGhpcyByZWR1Y2VzIHBlcmZvcm1hbmNlLCBhbmQgaXMgdGhlb3JldGljYWxseSB1bm5lY2Vzc2FyeS4pXG4gICAgICpcbiAgICAgKiBTZXR0aW5nIHRoaXMgdG8gYSBoaWdoZXIgdmFsdWUgd2lsbCBpbXByb3ZlIHBlcmZvcm1hbmNlIHNvbWV3aGF0XG4gICAgICogd2hpbGUgdXNpbmcgdHRsIHRyYWNraW5nLCBhbGJlaXQgYXQgdGhlIGV4cGVuc2Ugb2Yga2VlcGluZyBzdGFsZVxuICAgICAqIGl0ZW1zIGFyb3VuZCBhIGJpdCBsb25nZXIgdGhhbiB0aGVpciBUVExzIHdvdWxkIGluZGljYXRlLlxuICAgICAqXG4gICAgICogQGRlZmF1bHQgMVxuICAgICAqL1xuICAgIHR0bFJlc29sdXRpb24/OiBNaWxsaXNlY29uZHNcblxuICAgIC8qKlxuICAgICAqIFByZWVtcHRpdmVseSByZW1vdmUgc3RhbGUgaXRlbXMgZnJvbSB0aGUgY2FjaGUuXG4gICAgICpcbiAgICAgKiBOb3RlIHRoYXQgdGhpcyBtYXkgKnNpZ25pZmljYW50bHkqIGRlZ3JhZGUgcGVyZm9ybWFuY2UsIGVzcGVjaWFsbHkgaWZcbiAgICAgKiB0aGUgY2FjaGUgaXMgc3RvcmluZyBhIGxhcmdlIG51bWJlciBvZiBpdGVtcy4gSXQgaXMgYWxtb3N0IGFsd2F5cyBiZXN0XG4gICAgICogdG8ganVzdCBsZWF2ZSB0aGUgc3RhbGUgaXRlbXMgaW4gdGhlIGNhY2hlLCBhbmQgbGV0IHRoZW0gZmFsbCBvdXQgYXMgbmV3XG4gICAgICogaXRlbXMgYXJlIGFkZGVkLlxuICAgICAqXG4gICAgICogTm90ZSB0aGF0IHRoaXMgbWVhbnMgdGhhdCB7QGxpbmsgT3B0aW9uc0Jhc2UuYWxsb3dTdGFsZX0gaXMgYSBiaXRcbiAgICAgKiBwb2ludGxlc3MsIGFzIHN0YWxlIGl0ZW1zIHdpbGwgYmUgZGVsZXRlZCBhbG1vc3QgYXMgc29vbiBhcyB0aGV5XG4gICAgICogZXhwaXJlLlxuICAgICAqXG4gICAgICogVXNlIHdpdGggY2F1dGlvbiFcbiAgICAgKi9cbiAgICB0dGxBdXRvcHVyZ2U/OiBib29sZWFuXG5cbiAgICAvKipcbiAgICAgKiBXaGVuIHVzaW5nIHRpbWUtZXhwaXJpbmcgZW50cmllcyB3aXRoIGB0dGxgLCBzZXR0aW5nIHRoaXMgdG8gYHRydWVgIHdpbGxcbiAgICAgKiBtYWtlIGVhY2ggaXRlbSdzIGFnZSByZXNldCB0byAwIHdoZW5ldmVyIGl0IGlzIHJldHJpZXZlZCBmcm9tIGNhY2hlIHdpdGhcbiAgICAgKiB7QGxpbmsgTFJVQ2FjaGUjZ2V0fSwgY2F1c2luZyBpdCB0byBub3QgZXhwaXJlLiAoSXQgY2FuIHN0aWxsIGZhbGwgb3V0XG4gICAgICogb2YgY2FjaGUgYmFzZWQgb24gcmVjZW5jeSBvZiB1c2UsIG9mIGNvdXJzZS4pXG4gICAgICpcbiAgICAgKiBIYXMgbm8gZWZmZWN0IGlmIHtAbGluayBPcHRpb25zQmFzZS50dGx9IGlzIG5vdCBzZXQuXG4gICAgICpcbiAgICAgKiBUaGlzIG1heSBiZSBvdmVycmlkZGVuIGJ5IHBhc3NpbmcgYW4gb3B0aW9ucyBvYmplY3QgdG8gYGNhY2hlLmdldCgpYC5cbiAgICAgKi9cbiAgICB1cGRhdGVBZ2VPbkdldD86IGJvb2xlYW5cblxuICAgIC8qKlxuICAgICAqIFdoZW4gdXNpbmcgdGltZS1leHBpcmluZyBlbnRyaWVzIHdpdGggYHR0bGAsIHNldHRpbmcgdGhpcyB0byBgdHJ1ZWAgd2lsbFxuICAgICAqIG1ha2UgZWFjaCBpdGVtJ3MgYWdlIHJlc2V0IHRvIDAgd2hlbmV2ZXIgaXRzIHByZXNlbmNlIGluIHRoZSBjYWNoZSBpc1xuICAgICAqIGNoZWNrZWQgd2l0aCB7QGxpbmsgTFJVQ2FjaGUjaGFzfSwgY2F1c2luZyBpdCB0byBub3QgZXhwaXJlLiAoSXQgY2FuXG4gICAgICogc3RpbGwgZmFsbCBvdXQgb2YgY2FjaGUgYmFzZWQgb24gcmVjZW5jeSBvZiB1c2UsIG9mIGNvdXJzZS4pXG4gICAgICpcbiAgICAgKiBIYXMgbm8gZWZmZWN0IGlmIHtAbGluayBPcHRpb25zQmFzZS50dGx9IGlzIG5vdCBzZXQuXG4gICAgICovXG4gICAgdXBkYXRlQWdlT25IYXM/OiBib29sZWFuXG5cbiAgICAvKipcbiAgICAgKiBBbGxvdyB7QGxpbmsgTFJVQ2FjaGUjZ2V0fSBhbmQge0BsaW5rIExSVUNhY2hlI2ZldGNofSBjYWxscyB0byByZXR1cm5cbiAgICAgKiBzdGFsZSBkYXRhLCBpZiBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBCeSBkZWZhdWx0LCBpZiB5b3Ugc2V0IGB0dGxgLCBzdGFsZSBpdGVtcyB3aWxsIG9ubHkgYmUgZGVsZXRlZCBmcm9tIHRoZVxuICAgICAqIGNhY2hlIHdoZW4geW91IGBnZXQoa2V5KWAuIFRoYXQgaXMsIGl0J3Mgbm90IHByZWVtcHRpdmVseSBwcnVuaW5nIGl0ZW1zLFxuICAgICAqIHVubGVzcyB7QGxpbmsgT3B0aW9uc0Jhc2UudHRsQXV0b3B1cmdlfSBpcyBzZXQuXG4gICAgICpcbiAgICAgKiBJZiB5b3Ugc2V0IGBhbGxvd1N0YWxlOnRydWVgLCBpdCdsbCByZXR1cm4gdGhlIHN0YWxlIHZhbHVlICphcyB3ZWxsIGFzKlxuICAgICAqIGRlbGV0aW5nIGl0LiBJZiB5b3UgZG9uJ3Qgc2V0IHRoaXMsIHRoZW4gaXQnbGwgcmV0dXJuIGB1bmRlZmluZWRgIHdoZW5cbiAgICAgKiB5b3UgdHJ5IHRvIGdldCBhIHN0YWxlIGVudHJ5LlxuICAgICAqXG4gICAgICogTm90ZSB0aGF0IHdoZW4gYSBzdGFsZSBlbnRyeSBpcyBmZXRjaGVkLCBfZXZlbiBpZiBpdCBpcyByZXR1cm5lZCBkdWUgdG9cbiAgICAgKiBgYWxsb3dTdGFsZWAgYmVpbmcgc2V0XywgaXQgaXMgcmVtb3ZlZCBmcm9tIHRoZSBjYWNoZSBpbW1lZGlhdGVseS4gWW91XG4gICAgICogY2FuIHN1cHByZXNzIHRoaXMgYmVoYXZpb3IgYnkgc2V0dGluZ1xuICAgICAqIHtAbGluayBPcHRpb25zQmFzZS5ub0RlbGV0ZU9uU3RhbGVHZXR9LCBlaXRoZXIgaW4gdGhlIGNvbnN0cnVjdG9yLCBvciBpblxuICAgICAqIHRoZSBvcHRpb25zIHByb3ZpZGVkIHRvIHtAbGluayBMUlVDYWNoZSNnZXR9LlxuICAgICAqXG4gICAgICogVGhpcyBtYXkgYmUgb3ZlcnJpZGRlbiBieSBwYXNzaW5nIGFuIG9wdGlvbnMgb2JqZWN0IHRvIGBjYWNoZS5nZXQoKWAuXG4gICAgICogVGhlIGBjYWNoZS5oYXMoKWAgbWV0aG9kIHdpbGwgYWx3YXlzIHJldHVybiBgZmFsc2VgIGZvciBzdGFsZSBpdGVtcy5cbiAgICAgKlxuICAgICAqIE9ubHkgcmVsZXZhbnQgaWYgYSB0dGwgaXMgc2V0LlxuICAgICAqL1xuICAgIGFsbG93U3RhbGU/OiBib29sZWFuXG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBvbiBpdGVtcyB3aGVuIHRoZXkgYXJlIGRyb3BwZWQgZnJvbSB0aGVcbiAgICAgKiBjYWNoZSwgYXMgYGRpc3Bvc2UodmFsdWUsIGtleSwgcmVhc29uKWAuXG4gICAgICpcbiAgICAgKiBUaGlzIGNhbiBiZSBoYW5keSBpZiB5b3Ugd2FudCB0byBjbG9zZSBmaWxlIGRlc2NyaXB0b3JzIG9yIGRvXG4gICAgICogb3RoZXIgY2xlYW51cCB0YXNrcyB3aGVuIGl0ZW1zIGFyZSBubyBsb25nZXIgc3RvcmVkIGluIHRoZSBjYWNoZS5cbiAgICAgKlxuICAgICAqICoqTk9URSoqOiBJdCBpcyBjYWxsZWQgX2JlZm9yZV8gdGhlIGl0ZW0gaGFzIGJlZW4gZnVsbHkgcmVtb3ZlZFxuICAgICAqIGZyb20gdGhlIGNhY2hlLCBzbyBpZiB5b3Ugd2FudCB0byBwdXQgaXQgcmlnaHQgYmFjayBpbiwgeW91IG5lZWRcbiAgICAgKiB0byB3YWl0IHVudGlsIHRoZSBuZXh0IHRpY2suIElmIHlvdSB0cnkgdG8gYWRkIGl0IGJhY2sgaW4gZHVyaW5nXG4gICAgICogdGhlIGBkaXNwb3NlKClgIGZ1bmN0aW9uIGNhbGwsIGl0IHdpbGwgYnJlYWsgdGhpbmdzIGluIHN1YnRsZSBhbmRcbiAgICAgKiB3ZWlyZCB3YXlzLlxuICAgICAqXG4gICAgICogVW5saWtlIHNldmVyYWwgb3RoZXIgb3B0aW9ucywgdGhpcyBtYXkgX25vdF8gYmUgb3ZlcnJpZGRlbiBieVxuICAgICAqIHBhc3NpbmcgYW4gb3B0aW9uIHRvIGBzZXQoKWAsIGZvciBwZXJmb3JtYW5jZSByZWFzb25zLlxuICAgICAqXG4gICAgICogVGhlIGByZWFzb25gIHdpbGwgYmUgb25lIG9mIHRoZSBmb2xsb3dpbmcgc3RyaW5ncywgY29ycmVzcG9uZGluZ1xuICAgICAqIHRvIHRoZSByZWFzb24gZm9yIHRoZSBpdGVtJ3MgZGVsZXRpb246XG4gICAgICpcbiAgICAgKiAtIGBldmljdGAgSXRlbSB3YXMgZXZpY3RlZCB0byBtYWtlIHNwYWNlIGZvciBhIG5ldyBhZGRpdGlvblxuICAgICAqIC0gYHNldGAgSXRlbSB3YXMgb3ZlcndyaXR0ZW4gYnkgYSBuZXcgdmFsdWVcbiAgICAgKiAtIGBleHBpcmVgIEl0ZW0gZXhwaXJlZCBpdHMgVFRMXG4gICAgICogLSBgZmV0Y2hgIEl0ZW0gd2FzIGRlbGV0ZWQgZHVlIHRvIGEgZmFpbGVkIG9yIGFib3J0ZWQgZmV0Y2gsIG9yIGFcbiAgICAgKiAgIGZldGNoTWV0aG9kIHJldHVybmluZyBgdW5kZWZpbmVkLlxuICAgICAqIC0gYGRlbGV0ZWAgSXRlbSB3YXMgcmVtb3ZlZCBieSBleHBsaWNpdCBgY2FjaGUuZGVsZXRlKGtleSlgLFxuICAgICAqICAgYGNhY2hlLmNsZWFyKClgLCBvciBgY2FjaGUuc2V0KGtleSwgdW5kZWZpbmVkKWAuXG4gICAgICovXG4gICAgZGlzcG9zZT86IERpc3Bvc2VyPEssIFY+XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB3aGVuIG5ldyBpdGVtcyBhcmUgaW5zZXJ0ZWQgaW50byB0aGUgY2FjaGUsXG4gICAgICogYXMgYG9uSW5zZXJ0KHZhbHVlLCBrZXksIHJlYXNvbilgLlxuICAgICAqXG4gICAgICogVGhpcyBjYW4gYmUgdXNlZnVsIGlmIHlvdSBuZWVkIHRvIHBlcmZvcm0gYWN0aW9ucyB3aGVuIGFuIGl0ZW0gaXNcbiAgICAgKiBhZGRlZCwgc3VjaCBhcyBsb2dnaW5nIG9yIHRyYWNraW5nIGluc2VydGlvbnMuXG4gICAgICpcbiAgICAgKiBVbmxpa2Ugc29tZSBvdGhlciBvcHRpb25zLCB0aGlzIG1heSBfbm90XyBiZSBvdmVycmlkZGVuIGJ5IHBhc3NpbmdcbiAgICAgKiBhbiBvcHRpb24gdG8gYHNldCgpYCwgZm9yIHBlcmZvcm1hbmNlIGFuZCBjb25zaXN0ZW5jeSByZWFzb25zLlxuICAgICAqL1xuICAgIG9uSW5zZXJ0PzogSW5zZXJ0ZXI8SywgVj5cblxuICAgIC8qKlxuICAgICAqIFRoZSBzYW1lIGFzIHtAbGluayBPcHRpb25zQmFzZS5kaXNwb3NlfSwgYnV0IGNhbGxlZCAqYWZ0ZXIqIHRoZSBlbnRyeVxuICAgICAqIGlzIGNvbXBsZXRlbHkgcmVtb3ZlZCBhbmQgdGhlIGNhY2hlIGlzIG9uY2UgYWdhaW4gaW4gYSBjbGVhbiBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEl0IGlzIHNhZmUgdG8gYWRkIGFuIGl0ZW0gcmlnaHQgYmFjayBpbnRvIHRoZSBjYWNoZSBhdCB0aGlzIHBvaW50LlxuICAgICAqIEhvd2V2ZXIsIG5vdGUgdGhhdCBpdCBpcyAqdmVyeSogZWFzeSB0byBpbmFkdmVydGVudGx5IGNyZWF0ZSBpbmZpbml0ZVxuICAgICAqIHJlY3Vyc2lvbiB0aGlzIHdheS5cbiAgICAgKi9cbiAgICBkaXNwb3NlQWZ0ZXI/OiBEaXNwb3NlcjxLLCBWPlxuXG4gICAgLyoqXG4gICAgICogU2V0IHRvIHRydWUgdG8gc3VwcHJlc3MgY2FsbGluZyB0aGVcbiAgICAgKiB7QGxpbmsgT3B0aW9uc0Jhc2UuZGlzcG9zZX0gZnVuY3Rpb24gaWYgdGhlIGVudHJ5IGtleSBpc1xuICAgICAqIHN0aWxsIGFjY2Vzc2libGUgd2l0aGluIHRoZSBjYWNoZS5cbiAgICAgKlxuICAgICAqIFRoaXMgbWF5IGJlIG92ZXJyaWRkZW4gYnkgcGFzc2luZyBhbiBvcHRpb25zIG9iamVjdCB0b1xuICAgICAqIHtAbGluayBMUlVDYWNoZSNzZXR9LlxuICAgICAqXG4gICAgICogT25seSByZWxldmFudCBpZiBgZGlzcG9zZWAgb3IgYGRpc3Bvc2VBZnRlcmAgYXJlIHNldC5cbiAgICAgKi9cbiAgICBub0Rpc3Bvc2VPblNldD86IGJvb2xlYW5cblxuICAgIC8qKlxuICAgICAqIEJvb2xlYW4gZmxhZyB0byB0ZWxsIHRoZSBjYWNoZSB0byBub3QgdXBkYXRlIHRoZSBUVEwgd2hlbiBzZXR0aW5nIGEgbmV3XG4gICAgICogdmFsdWUgZm9yIGFuIGV4aXN0aW5nIGtleSAoaWUsIHdoZW4gdXBkYXRpbmcgYSB2YWx1ZSByYXRoZXIgdGhhblxuICAgICAqIGluc2VydGluZyBhIG5ldyB2YWx1ZSkuICBOb3RlIHRoYXQgdGhlIFRUTCB2YWx1ZSBpcyBfYWx3YXlzXyBzZXQgKGlmXG4gICAgICogcHJvdmlkZWQpIHdoZW4gYWRkaW5nIGEgbmV3IGVudHJ5IGludG8gdGhlIGNhY2hlLlxuICAgICAqXG4gICAgICogSGFzIG5vIGVmZmVjdCBpZiBhIHtAbGluayBPcHRpb25zQmFzZS50dGx9IGlzIG5vdCBzZXQuXG4gICAgICpcbiAgICAgKiBNYXkgYmUgcGFzc2VkIGFzIGFuIG9wdGlvbiB0byB7QGxpbmsgTFJVQ2FjaGUjc2V0fS5cbiAgICAgKi9cbiAgICBub1VwZGF0ZVRUTD86IGJvb2xlYW5cblxuICAgIC8qKlxuICAgICAqIFNldCB0byBhIHBvc2l0aXZlIGludGVnZXIgdG8gdHJhY2sgdGhlIHNpemVzIG9mIGl0ZW1zIGFkZGVkIHRvIHRoZVxuICAgICAqIGNhY2hlLCBhbmQgYXV0b21hdGljYWxseSBldmljdCBpdGVtcyBpbiBvcmRlciB0byBzdGF5IGJlbG93IHRoaXMgc2l6ZS5cbiAgICAgKiBOb3RlIHRoYXQgdGhpcyBtYXkgcmVzdWx0IGluIGZld2VyIHRoYW4gYG1heGAgaXRlbXMgYmVpbmcgc3RvcmVkLlxuICAgICAqXG4gICAgICogQXR0ZW1wdGluZyB0byBhZGQgYW4gaXRlbSB0byB0aGUgY2FjaGUgd2hvc2UgY2FsY3VsYXRlZCBzaXplIGlzIGdyZWF0ZXJcbiAgICAgKiB0aGF0IHRoaXMgYW1vdW50IHdpbGwgYmUgYSBuby1vcC4gVGhlIGl0ZW0gd2lsbCBub3QgYmUgY2FjaGVkLCBhbmQgbm9cbiAgICAgKiBvdGhlciBpdGVtcyB3aWxsIGJlIGV2aWN0ZWQuXG4gICAgICpcbiAgICAgKiBPcHRpb25hbCwgbXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXIgaWYgcHJvdmlkZWQuXG4gICAgICpcbiAgICAgKiBTZXRzIGBtYXhFbnRyeVNpemVgIHRvIHRoZSBzYW1lIHZhbHVlLCB1bmxlc3MgYSBkaWZmZXJlbnQgdmFsdWUgaXNcbiAgICAgKiBwcm92aWRlZCBmb3IgYG1heEVudHJ5U2l6ZWAuXG4gICAgICpcbiAgICAgKiBBdCBsZWFzdCBvbmUgb2YgYG1heGAsIGBtYXhTaXplYCwgb3IgYFRUTGAgaXMgcmVxdWlyZWQuIFRoaXMgbXVzdCBiZSBhXG4gICAgICogcG9zaXRpdmUgaW50ZWdlciBpZiBzZXQuXG4gICAgICpcbiAgICAgKiBFdmVuIGlmIHNpemUgdHJhY2tpbmcgaXMgZW5hYmxlZCwgKippdCBpcyBzdHJvbmdseSByZWNvbW1lbmRlZCB0byBzZXQgYVxuICAgICAqIGBtYXhgIHRvIHByZXZlbnQgdW5ib3VuZGVkIGdyb3d0aCBvZiB0aGUgY2FjaGUuKipcbiAgICAgKlxuICAgICAqIE5vdGUgYWxzbyB0aGF0IHNpemUgdHJhY2tpbmcgY2FuIG5lZ2F0aXZlbHkgaW1wYWN0IHBlcmZvcm1hbmNlLFxuICAgICAqIHRob3VnaCBmb3IgbW9zdCBjYXNlcywgb25seSBtaW5pbWFsbHkuXG4gICAgICovXG4gICAgbWF4U2l6ZT86IFNpemVcblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIGFsbG93ZWQgc2l6ZSBmb3IgYW55IHNpbmdsZSBpdGVtIGluIHRoZSBjYWNoZS5cbiAgICAgKlxuICAgICAqIElmIGEgbGFyZ2VyIGl0ZW0gaXMgcGFzc2VkIHRvIHtAbGluayBMUlVDYWNoZSNzZXR9IG9yIHJldHVybmVkIGJ5IGFcbiAgICAgKiB7QGxpbmsgT3B0aW9uc0Jhc2UuZmV0Y2hNZXRob2R9IG9yIHtAbGluayBPcHRpb25zQmFzZS5tZW1vTWV0aG9kfSwgdGhlblxuICAgICAqIGl0IHdpbGwgbm90IGJlIHN0b3JlZCBpbiB0aGUgY2FjaGUuXG4gICAgICpcbiAgICAgKiBBdHRlbXB0aW5nIHRvIGFkZCBhbiBpdGVtIHdob3NlIGNhbGN1bGF0ZWQgc2l6ZSBpcyBncmVhdGVyIHRoYW5cbiAgICAgKiB0aGlzIGFtb3VudCB3aWxsIG5vdCBjYWNoZSB0aGUgaXRlbSBvciBldmljdCBhbnkgb2xkIGl0ZW1zLCBidXRcbiAgICAgKiBXSUxMIGRlbGV0ZSBhbiBleGlzdGluZyB2YWx1ZSBpZiBvbmUgaXMgYWxyZWFkeSBwcmVzZW50LlxuICAgICAqXG4gICAgICogT3B0aW9uYWwsIG11c3QgYmUgYSBwb3NpdGl2ZSBpbnRlZ2VyIGlmIHByb3ZpZGVkLiBEZWZhdWx0cyB0b1xuICAgICAqIHRoZSB2YWx1ZSBvZiBgbWF4U2l6ZWAgaWYgcHJvdmlkZWQuXG4gICAgICovXG4gICAgbWF4RW50cnlTaXplPzogU2l6ZVxuXG4gICAgLyoqXG4gICAgICogQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBudW1iZXIgaW5kaWNhdGluZyB0aGUgaXRlbSdzIHNpemUuXG4gICAgICpcbiAgICAgKiBSZXF1aXJlcyB7QGxpbmsgT3B0aW9uc0Jhc2UubWF4U2l6ZX0gdG8gYmUgc2V0LlxuICAgICAqXG4gICAgICogSWYgbm90IHByb3ZpZGVkLCBhbmQge0BsaW5rIE9wdGlvbnNCYXNlLm1heFNpemV9IG9yXG4gICAgICoge0BsaW5rIE9wdGlvbnNCYXNlLm1heEVudHJ5U2l6ZX0gYXJlIHNldCwgdGhlbiBhbGxcbiAgICAgKiB7QGxpbmsgTFJVQ2FjaGUjc2V0fSBjYWxscyAqKm11c3QqKiBwcm92aWRlIGFuIGV4cGxpY2l0XG4gICAgICoge0BsaW5rIFNldE9wdGlvbnMuc2l6ZX0gb3Igc2l6ZUNhbGN1bGF0aW9uIHBhcmFtLlxuICAgICAqL1xuICAgIHNpemVDYWxjdWxhdGlvbj86IFNpemVDYWxjdWxhdG9yPEssIFY+XG5cbiAgICAvKipcbiAgICAgKiBNZXRob2QgdGhhdCBwcm92aWRlcyB0aGUgaW1wbGVtZW50YXRpb24gZm9yIHtAbGluayBMUlVDYWNoZSNmZXRjaH1cbiAgICAgKlxuICAgICAqIGBgYHRzXG4gICAgICogZmV0Y2hNZXRob2Qoa2V5LCBzdGFsZVZhbHVlLCB7IHNpZ25hbCwgb3B0aW9ucywgY29udGV4dCB9KVxuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogSWYgYGZldGNoTWV0aG9kYCBpcyBub3QgcHJvdmlkZWQsIHRoZW4gYGNhY2hlLmZldGNoKGtleSlgIGlzIGVxdWl2YWxlbnRcbiAgICAgKiB0byBgUHJvbWlzZS5yZXNvbHZlKGNhY2hlLmdldChrZXkpKWAuXG4gICAgICpcbiAgICAgKiBJZiBhdCBhbnkgdGltZSwgYHNpZ25hbC5hYm9ydGVkYCBpcyBzZXQgdG8gYHRydWVgLCBvciBpZiB0aGVcbiAgICAgKiBgc2lnbmFsLm9uYWJvcnRgIG1ldGhvZCBpcyBjYWxsZWQsIG9yIGlmIGl0IGVtaXRzIGFuIGAnYWJvcnQnYCBldmVudFxuICAgICAqIHdoaWNoIHlvdSBjYW4gbGlzdGVuIHRvIHdpdGggYGFkZEV2ZW50TGlzdGVuZXJgLCB0aGVuIHRoYXQgbWVhbnMgdGhhdFxuICAgICAqIHRoZSBmZXRjaCBzaG91bGQgYmUgYWJhbmRvbmVkLiBUaGlzIG1heSBiZSBwYXNzZWQgYWxvbmcgdG8gYXN5bmNcbiAgICAgKiBmdW5jdGlvbnMgYXdhcmUgb2YgQWJvcnRDb250cm9sbGVyL0Fib3J0U2lnbmFsIGJlaGF2aW9yLlxuICAgICAqXG4gICAgICogVGhlIGBmZXRjaE1ldGhvZGAgc2hvdWxkICoqb25seSoqIHJldHVybiBgdW5kZWZpbmVkYCBvciBhIFByb21pc2VcbiAgICAgKiByZXNvbHZpbmcgdG8gYHVuZGVmaW5lZGAgaWYgdGhlIEFib3J0Q29udHJvbGxlciBzaWduYWxlZCBhbiBgYWJvcnRgXG4gICAgICogZXZlbnQuIEluIGFsbCBvdGhlciBjYXNlcywgaXQgc2hvdWxkIHJldHVybiBvciByZXNvbHZlIHRvIGEgdmFsdWVcbiAgICAgKiBzdWl0YWJsZSBmb3IgYWRkaW5nIHRvIHRoZSBjYWNoZS5cbiAgICAgKlxuICAgICAqIFRoZSBgb3B0aW9uc2Agb2JqZWN0IGlzIGEgdW5pb24gb2YgdGhlIG9wdGlvbnMgdGhhdCBtYXkgYmUgcHJvdmlkZWQgdG9cbiAgICAgKiBgc2V0KClgIGFuZCBgZ2V0KClgLiBJZiB0aGV5IGFyZSBtb2RpZmllZCwgdGhlbiB0aGF0IHdpbGwgcmVzdWx0IGluXG4gICAgICogbW9kaWZ5aW5nIHRoZSBzZXR0aW5ncyB0byBgY2FjaGUuc2V0KClgIHdoZW4gdGhlIHZhbHVlIGlzIHJlc29sdmVkLCBhbmRcbiAgICAgKiBpbiB0aGUgY2FzZSBvZlxuICAgICAqIHtAbGluayBPcHRpb25zQmFzZS5ub0RlbGV0ZU9uRmV0Y2hSZWplY3Rpb259IGFuZFxuICAgICAqIHtAbGluayBPcHRpb25zQmFzZS5hbGxvd1N0YWxlT25GZXRjaFJlamVjdGlvbn0sIHRoZSBoYW5kbGluZyBvZlxuICAgICAqIGBmZXRjaE1ldGhvZGAgZmFpbHVyZXMuXG4gICAgICpcbiAgICAgKiBGb3IgZXhhbXBsZSwgYSBETlMgY2FjaGUgbWF5IHVwZGF0ZSB0aGUgVFRMIGJhc2VkIG9uIHRoZSB2YWx1ZSByZXR1cm5lZFxuICAgICAqIGZyb20gYSByZW1vdGUgRE5TIHNlcnZlciBieSBjaGFuZ2luZyBgb3B0aW9ucy50dGxgIGluIHRoZSBgZmV0Y2hNZXRob2RgLlxuICAgICAqL1xuICAgIGZldGNoTWV0aG9kPzogRmV0Y2hlcjxLLCBWLCBGQz5cblxuICAgIC8qKlxuICAgICAqIE1ldGhvZCB0aGF0IHByb3ZpZGVzIHRoZSBpbXBsZW1lbnRhdGlvbiBmb3Ige0BsaW5rIExSVUNhY2hlI21lbW99XG4gICAgICovXG4gICAgbWVtb01ldGhvZD86IE1lbW9pemVyPEssIFYsIEZDPlxuXG4gICAgLyoqXG4gICAgICogU2V0IHRvIHRydWUgdG8gc3VwcHJlc3MgdGhlIGRlbGV0aW9uIG9mIHN0YWxlIGRhdGEgd2hlbiBhXG4gICAgICoge0BsaW5rIE9wdGlvbnNCYXNlLmZldGNoTWV0aG9kfSByZXR1cm5zIGEgcmVqZWN0ZWQgcHJvbWlzZS5cbiAgICAgKi9cbiAgICBub0RlbGV0ZU9uRmV0Y2hSZWplY3Rpb24/OiBib29sZWFuXG5cbiAgICAvKipcbiAgICAgKiBEbyBub3QgZGVsZXRlIHN0YWxlIGl0ZW1zIHdoZW4gdGhleSBhcmUgcmV0cmlldmVkIHdpdGhcbiAgICAgKiB7QGxpbmsgTFJVQ2FjaGUjZ2V0fS5cbiAgICAgKlxuICAgICAqIE5vdGUgdGhhdCB0aGUgYGdldGAgcmV0dXJuIHZhbHVlIHdpbGwgc3RpbGwgYmUgYHVuZGVmaW5lZGBcbiAgICAgKiB1bmxlc3Mge0BsaW5rIE9wdGlvbnNCYXNlLmFsbG93U3RhbGV9IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBXaGVuIHVzaW5nIHRpbWUtZXhwaXJpbmcgZW50cmllcyB3aXRoIGB0dGxgLCBieSBkZWZhdWx0IHN0YWxlXG4gICAgICogaXRlbXMgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGNhY2hlIHdoZW4gdGhlIGtleSBpcyBhY2Nlc3NlZFxuICAgICAqIHdpdGggYGNhY2hlLmdldCgpYC5cbiAgICAgKlxuICAgICAqIFNldHRpbmcgdGhpcyBvcHRpb24gd2lsbCBjYXVzZSBzdGFsZSBpdGVtcyB0byByZW1haW4gaW4gdGhlIGNhY2hlLCB1bnRpbFxuICAgICAqIHRoZXkgYXJlIGV4cGxpY2l0bHkgZGVsZXRlZCB3aXRoIGBjYWNoZS5kZWxldGUoa2V5KWAsIG9yIHJldHJpZXZlZCB3aXRoXG4gICAgICogYG5vRGVsZXRlT25TdGFsZUdldGAgc2V0IHRvIGBmYWxzZWAuXG4gICAgICpcbiAgICAgKiBUaGlzIG1heSBiZSBvdmVycmlkZGVuIGJ5IHBhc3NpbmcgYW4gb3B0aW9ucyBvYmplY3QgdG8gYGNhY2hlLmdldCgpYC5cbiAgICAgKlxuICAgICAqIE9ubHkgcmVsZXZhbnQgaWYgYSB0dGwgaXMgdXNlZC5cbiAgICAgKi9cbiAgICBub0RlbGV0ZU9uU3RhbGVHZXQ/OiBib29sZWFuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgdG8gdHJ1ZSB0byBhbGxvdyByZXR1cm5pbmcgc3RhbGUgZGF0YSB3aGVuIGFcbiAgICAgKiB7QGxpbmsgT3B0aW9uc0Jhc2UuZmV0Y2hNZXRob2R9IHRocm93cyBhbiBlcnJvciBvciByZXR1cm5zIGEgcmVqZWN0ZWRcbiAgICAgKiBwcm9taXNlLlxuICAgICAqXG4gICAgICogVGhpcyBkaWZmZXJzIGZyb20gdXNpbmcge0BsaW5rIE9wdGlvbnNCYXNlLmFsbG93U3RhbGV9IGluIHRoYXQgc3RhbGVcbiAgICAgKiBkYXRhIHdpbGwgT05MWSBiZSByZXR1cm5lZCBpbiB0aGUgY2FzZSB0aGF0IHRoZSB7QGxpbmsgTFJVQ2FjaGUjZmV0Y2h9XG4gICAgICogZmFpbHMsIG5vdCBhbnkgb3RoZXIgdGltZXMuXG4gICAgICpcbiAgICAgKiBJZiBhIGBmZXRjaE1ldGhvZGAgZmFpbHMsIGFuZCB0aGVyZSBpcyBubyBzdGFsZSB2YWx1ZSBhdmFpbGFibGUsIHRoZVxuICAgICAqIGBmZXRjaCgpYCB3aWxsIHJlc29sdmUgdG8gYHVuZGVmaW5lZGAuIEllLCBhbGwgYGZldGNoTWV0aG9kYCBlcnJvcnMgYXJlXG4gICAgICogc3VwcHJlc3NlZC5cbiAgICAgKlxuICAgICAqIEltcGxpZXMgYG5vRGVsZXRlT25GZXRjaFJlamVjdGlvbmAuXG4gICAgICpcbiAgICAgKiBUaGlzIG1heSBiZSBzZXQgaW4gY2FsbHMgdG8gYGZldGNoKClgLCBvciBkZWZhdWx0ZWQgb24gdGhlIGNvbnN0cnVjdG9yLFxuICAgICAqIG9yIG92ZXJyaWRkZW4gYnkgbW9kaWZ5aW5nIHRoZSBvcHRpb25zIG9iamVjdCBpbiB0aGUgYGZldGNoTWV0aG9kYC5cbiAgICAgKi9cbiAgICBhbGxvd1N0YWxlT25GZXRjaFJlamVjdGlvbj86IGJvb2xlYW5cblxuICAgIC8qKlxuICAgICAqIFNldCB0byB0cnVlIHRvIHJldHVybiBhIHN0YWxlIHZhbHVlIGZyb20gdGhlIGNhY2hlIHdoZW4gdGhlXG4gICAgICogYEFib3J0U2lnbmFsYCBwYXNzZWQgdG8gdGhlIHtAbGluayBPcHRpb25zQmFzZS5mZXRjaE1ldGhvZH0gZGlzcGF0Y2hlc1xuICAgICAqIGFuIGAnYWJvcnQnYCBldmVudCwgd2hldGhlciB1c2VyLXRyaWdnZXJlZCwgb3IgZHVlIHRvIGludGVybmFsIGNhY2hlXG4gICAgICogYmVoYXZpb3IuXG4gICAgICpcbiAgICAgKiBVbmxlc3Mge0BsaW5rIE9wdGlvbnNCYXNlLmlnbm9yZUZldGNoQWJvcnR9IGlzIGFsc28gc2V0LCB0aGUgdW5kZXJseWluZ1xuICAgICAqIHtAbGluayBPcHRpb25zQmFzZS5mZXRjaE1ldGhvZH0gd2lsbCBzdGlsbCBiZSBjb25zaWRlcmVkIGNhbmNlbGVkLCBhbmRcbiAgICAgKiBhbnkgdmFsdWUgaXQgcmV0dXJucyB3aWxsIGJlIGlnbm9yZWQgYW5kIG5vdCBjYWNoZWQuXG4gICAgICpcbiAgICAgKiBDYXZlYXQ6IHNpbmNlIGZldGNoZXMgYXJlIGFib3J0ZWQgd2hlbiBhIG5ldyB2YWx1ZSBpcyBleHBsaWNpdGx5XG4gICAgICogc2V0IGluIHRoZSBjYWNoZSwgdGhpcyBjYW4gbGVhZCB0byBmZXRjaCByZXR1cm5pbmcgYSBzdGFsZSB2YWx1ZSxcbiAgICAgKiBzaW5jZSB0aGF0IHdhcyB0aGUgZmFsbGJhY2sgdmFsdWUgX2F0IHRoZSBtb21lbnQgdGhlIGBmZXRjaCgpYCB3YXNcbiAgICAgKiBpbml0aWF0ZWRfLCBldmVuIHRob3VnaCB0aGUgbmV3IHVwZGF0ZWQgdmFsdWUgaXMgbm93IHByZXNlbnQgaW5cbiAgICAgKiB0aGUgY2FjaGUuXG4gICAgICpcbiAgICAgKiBGb3IgZXhhbXBsZTpcbiAgICAgKlxuICAgICAqIGBgYHRzXG4gICAgICogY29uc3QgY2FjaGUgPSBuZXcgTFJVQ2FjaGU8c3RyaW5nLCBhbnk+KHtcbiAgICAgKiAgIHR0bDogMTAwLFxuICAgICAqICAgZmV0Y2hNZXRob2Q6IGFzeW5jICh1cmwsIG9sZFZhbHVlLCB7IHNpZ25hbCB9KSA9PiAge1xuICAgICAqICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHsgc2lnbmFsIH0pXG4gICAgICogICAgIHJldHVybiBhd2FpdCByZXMuanNvbigpXG4gICAgICogICB9XG4gICAgICogfSlcbiAgICAgKiBjYWNoZS5zZXQoJ2h0dHBzOi8vZXhhbXBsZS5jb20vJywgeyBzb21lOiAnZGF0YScgfSlcbiAgICAgKiAvLyAxMDBtcyBnbyBieS4uLlxuICAgICAqIGNvbnN0IHJlc3VsdCA9IGNhY2hlLmZldGNoKCdodHRwczovL2V4YW1wbGUuY29tLycpXG4gICAgICogY2FjaGUuc2V0KCdodHRwczovL2V4YW1wbGUuY29tLycsIHsgb3RoZXI6ICd0aGluZycgfSlcbiAgICAgKiBjb25zb2xlLmxvZyhhd2FpdCByZXN1bHQpIC8vIHsgc29tZTogJ2RhdGEnIH1cbiAgICAgKiBjb25zb2xlLmxvZyhjYWNoZS5nZXQoJ2h0dHBzOi8vZXhhbXBsZS5jb20vJykpIC8vIHsgb3RoZXI6ICd0aGluZycgfVxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGFsbG93U3RhbGVPbkZldGNoQWJvcnQ/OiBib29sZWFuXG5cbiAgICAvKipcbiAgICAgKiBTZXQgdG8gdHJ1ZSB0byBpZ25vcmUgdGhlIGBhYm9ydGAgZXZlbnQgZW1pdHRlZCBieSB0aGUgYEFib3J0U2lnbmFsYFxuICAgICAqIG9iamVjdCBwYXNzZWQgdG8ge0BsaW5rIE9wdGlvbnNCYXNlLmZldGNoTWV0aG9kfSwgYW5kIHN0aWxsIGNhY2hlIHRoZVxuICAgICAqIHJlc3VsdGluZyByZXNvbHV0aW9uIHZhbHVlLCBhcyBsb25nIGFzIGl0IGlzIG5vdCBgdW5kZWZpbmVkYC5cbiAgICAgKlxuICAgICAqIFdoZW4gdXNlZCBvbiBpdHMgb3duLCB0aGlzIG1lYW5zIGFib3J0ZWQge0BsaW5rIExSVUNhY2hlI2ZldGNofSBjYWxsc1xuICAgICAqIGFyZSBub3QgaW1tZWRpYXRlbHkgcmVzb2x2ZWQgb3IgcmVqZWN0ZWQgd2hlbiB0aGV5IGFyZSBhYm9ydGVkLCBhbmRcbiAgICAgKiBpbnN0ZWFkIHRha2UgdGhlIGZ1bGwgdGltZSB0byBhd2FpdC5cbiAgICAgKlxuICAgICAqIFdoZW4gdXNlZCB3aXRoIHtAbGluayBPcHRpb25zQmFzZS5hbGxvd1N0YWxlT25GZXRjaEFib3J0fSwgYWJvcnRlZFxuICAgICAqIHtAbGluayBMUlVDYWNoZSNmZXRjaH0gY2FsbHMgd2lsbCByZXNvbHZlIGltbWVkaWF0ZWx5IHRvIHRoZWlyIHN0YWxlXG4gICAgICogY2FjaGVkIHZhbHVlIG9yIGB1bmRlZmluZWRgLCBhbmQgd2lsbCBjb250aW51ZSB0byBwcm9jZXNzIGFuZCBldmVudHVhbGx5XG4gICAgICogdXBkYXRlIHRoZSBjYWNoZSB3aGVuIHRoZXkgcmVzb2x2ZSwgYXMgbG9uZyBhcyB0aGUgcmVzdWx0aW5nIHZhbHVlIGlzXG4gICAgICogbm90IGB1bmRlZmluZWRgLCB0aHVzIHN1cHBvcnRpbmcgYSBcInJldHVybiBzdGFsZSBvbiB0aW1lb3V0IHdoaWxlXG4gICAgICogcmVmcmVzaGluZ1wiIG1lY2hhbmlzbSBieSBwYXNzaW5nIGBBYm9ydFNpZ25hbC50aW1lb3V0KG4pYCBhcyB0aGUgc2lnbmFsLlxuICAgICAqXG4gICAgICogRm9yIGV4YW1wbGU6XG4gICAgICpcbiAgICAgKiBgYGB0c1xuICAgICAqIGNvbnN0IGMgPSBuZXcgTFJVQ2FjaGUoe1xuICAgICAqICAgdHRsOiAxMDAsXG4gICAgICogICBpZ25vcmVGZXRjaEFib3J0OiB0cnVlLFxuICAgICAqICAgYWxsb3dTdGFsZU9uRmV0Y2hBYm9ydDogdHJ1ZSxcbiAgICAgKiAgIGZldGNoTWV0aG9kOiBhc3luYyAoa2V5LCBvbGRWYWx1ZSwgeyBzaWduYWwgfSkgPT4ge1xuICAgICAqICAgICAvLyBub3RlOiBkbyBOT1QgcGFzcyB0aGUgc2lnbmFsIHRvIGZldGNoKCkhXG4gICAgICogICAgIC8vIGxldCdzIHNheSB0aGlzIGZldGNoIGNhbiB0YWtlIGEgbG9uZyB0aW1lLlxuICAgICAqICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cHM6Ly9zbG93LWJhY2tlbmQtc2VydmVyLyR7a2V5fWApXG4gICAgICogICAgIHJldHVybiBhd2FpdCByZXMuanNvbigpXG4gICAgICogICB9LFxuICAgICAqIH0pXG4gICAgICpcbiAgICAgKiAvLyB0aGlzIHdpbGwgcmV0dXJuIHRoZSBzdGFsZSB2YWx1ZSBhZnRlciAxMDBtcywgd2hpbGUgc3RpbGxcbiAgICAgKiAvLyB1cGRhdGluZyBpbiB0aGUgYmFja2dyb3VuZCBmb3IgbmV4dCB0aW1lLlxuICAgICAqIGNvbnN0IHZhbCA9IGF3YWl0IGMuZmV0Y2goJ2tleScsIHsgc2lnbmFsOiBBYm9ydFNpZ25hbC50aW1lb3V0KDEwMCkgfSlcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqICoqTm90ZSoqOiByZWdhcmRsZXNzIG9mIHRoaXMgc2V0dGluZywgYW4gYGFib3J0YCBldmVudCBfaXMgc3RpbGxcbiAgICAgKiBlbWl0dGVkIG9uIHRoZSBgQWJvcnRTaWduYWxgIG9iamVjdF8sIHNvIG1heSByZXN1bHQgaW4gaW52YWxpZCByZXN1bHRzXG4gICAgICogd2hlbiBwYXNzZWQgdG8gb3RoZXIgdW5kZXJseWluZyBBUElzIHRoYXQgdXNlIEFib3J0U2lnbmFscy5cbiAgICAgKlxuICAgICAqIFRoaXMgbWF5IGJlIG92ZXJyaWRkZW4gaW4gdGhlIHtAbGluayBPcHRpb25zQmFzZS5mZXRjaE1ldGhvZH0gb3IgdGhlXG4gICAgICogY2FsbCB0byB7QGxpbmsgTFJVQ2FjaGUjZmV0Y2h9LlxuICAgICAqL1xuICAgIGlnbm9yZUZldGNoQWJvcnQ/OiBib29sZWFuXG5cbiAgICAvKipcbiAgICAgKiBJbiBzb21lIGNhc2VzLCB5b3UgbWF5IHdhbnQgdG8gc3dhcCBvdXQgdGhlIHBlcmZvcm1hbmNlL0RhdGUgb2JqZWN0XG4gICAgICogdXNlZCBmb3IgVFRMIHRyYWNraW5nLiBUaGlzIHNob3VsZCBhbG1vc3QgY2VydGFpbmx5IE5PVCBiZSBkb25lIGluXG4gICAgICogcHJvZHVjdGlvbiBlbnZpcm9ubWVudHMhXG4gICAgICpcbiAgICAgKiBUaGlzIHZhbHVlIGRlZmF1bHRzIHRvIGBnbG9iYWwucGVyZm9ybWFuY2VgIGlmIGl0IGhhcyBhIGBub3coKWAgbWV0aG9kLFxuICAgICAqIG9yIHRoZSBgZ2xvYmFsLkRhdGVgIG9iamVjdCBvdGhlcndpc2UuXG4gICAgICovXG4gICAgcGVyZj86IFBlcmZcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgT3B0aW9uc01heExpbWl0PEssIFYsIEZDPlxuICAgIGV4dGVuZHMgT3B0aW9uc0Jhc2U8SywgViwgRkM+IHtcbiAgICBtYXg6IENvdW50XG4gIH1cbiAgZXhwb3J0IGludGVyZmFjZSBPcHRpb25zVFRMTGltaXQ8SywgViwgRkM+XG4gICAgZXh0ZW5kcyBPcHRpb25zQmFzZTxLLCBWLCBGQz4ge1xuICAgIHR0bDogTWlsbGlzZWNvbmRzXG4gICAgdHRsQXV0b3B1cmdlOiBib29sZWFuXG4gIH1cbiAgZXhwb3J0IGludGVyZmFjZSBPcHRpb25zU2l6ZUxpbWl0PEssIFYsIEZDPlxuICAgIGV4dGVuZHMgT3B0aW9uc0Jhc2U8SywgViwgRkM+IHtcbiAgICBtYXhTaXplOiBTaXplXG4gIH1cblxuICAvKipcbiAgICogVGhlIHZhbGlkIHNhZmUgb3B0aW9ucyBmb3IgdGhlIHtAbGluayBMUlVDYWNoZX0gY29uc3RydWN0b3JcbiAgICovXG4gIGV4cG9ydCB0eXBlIE9wdGlvbnM8SywgViwgRkM+ID1cbiAgICB8IE9wdGlvbnNNYXhMaW1pdDxLLCBWLCBGQz5cbiAgICB8IE9wdGlvbnNTaXplTGltaXQ8SywgViwgRkM+XG4gICAgfCBPcHRpb25zVFRMTGltaXQ8SywgViwgRkM+XG5cbiAgLyoqXG4gICAqIEVudHJ5IG9iamVjdHMgdXNlZCBieSB7QGxpbmsgTFJVQ2FjaGUjbG9hZH0gYW5kIHtAbGluayBMUlVDYWNoZSNkdW1wfSxcbiAgICogYW5kIHJldHVybmVkIGJ5IHtAbGluayBMUlVDYWNoZSNpbmZvfS5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgRW50cnk8Vj4ge1xuICAgIHZhbHVlOiBWXG4gICAgdHRsPzogTWlsbGlzZWNvbmRzXG4gICAgc2l6ZT86IFNpemVcbiAgICBzdGFydD86IE1pbGxpc2Vjb25kc1xuICB9XG59XG5cbi8qKlxuICogRGVmYXVsdCBleHBvcnQsIHRoZSB0aGluZyB5b3UncmUgdXNpbmcgdGhpcyBtb2R1bGUgdG8gZ2V0LlxuICpcbiAqIFRoZSBgS2AgYW5kIGBWYCB0eXBlcyBkZWZpbmUgdGhlIGtleSBhbmQgdmFsdWUgdHlwZXMsIHJlc3BlY3RpdmVseS4gVGhlXG4gKiBvcHRpb25hbCBgRkNgIHR5cGUgZGVmaW5lcyB0aGUgdHlwZSBvZiB0aGUgYGNvbnRleHRgIG9iamVjdCBwYXNzZWQgdG9cbiAqIGBjYWNoZS5mZXRjaCgpYCBhbmQgYGNhY2hlLm1lbW8oKWAuXG4gKlxuICogS2V5cyBhbmQgdmFsdWVzICoqbXVzdCBub3QqKiBiZSBgbnVsbGAgb3IgYHVuZGVmaW5lZGAuXG4gKlxuICogQWxsIHByb3BlcnRpZXMgZnJvbSB0aGUgb3B0aW9ucyBvYmplY3QgKHdpdGggdGhlIGV4Y2VwdGlvbiBvZiBgbWF4YCxcbiAqIGBtYXhTaXplYCwgYGZldGNoTWV0aG9kYCwgYG1lbW9NZXRob2RgLCBgZGlzcG9zZWAgYW5kIGBkaXNwb3NlQWZ0ZXJgKSBhcmVcbiAqIGFkZGVkIGFzIG5vcm1hbCBwdWJsaWMgbWVtYmVycy4gKFRoZSBsaXN0ZWQgb3B0aW9ucyBhcmUgcmVhZC1vbmx5IGdldHRlcnMuKVxuICpcbiAqIENoYW5naW5nIGFueSBvZiB0aGVzZSB3aWxsIGFsdGVyIHRoZSBkZWZhdWx0cyBmb3Igc3Vic2VxdWVudCBtZXRob2QgY2FsbHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBMUlVDYWNoZTxLIGV4dGVuZHMge30sIFYgZXh0ZW5kcyB7fSwgRkMgPSB1bmtub3duPiB7XG4gIC8vIG9wdGlvbnMgdGhhdCBjYW5ub3QgYmUgY2hhbmdlZCB3aXRob3V0IGRpc2FzdGVyXG4gIHJlYWRvbmx5ICNtYXg6IExSVUNhY2hlLkNvdW50XG4gIHJlYWRvbmx5ICNtYXhTaXplOiBMUlVDYWNoZS5TaXplXG4gIHJlYWRvbmx5ICNkaXNwb3NlPzogTFJVQ2FjaGUuRGlzcG9zZXI8SywgVj5cbiAgcmVhZG9ubHkgI29uSW5zZXJ0PzogTFJVQ2FjaGUuSW5zZXJ0ZXI8SywgVj5cbiAgcmVhZG9ubHkgI2Rpc3Bvc2VBZnRlcj86IExSVUNhY2hlLkRpc3Bvc2VyPEssIFY+XG4gIHJlYWRvbmx5ICNmZXRjaE1ldGhvZD86IExSVUNhY2hlLkZldGNoZXI8SywgViwgRkM+XG4gIHJlYWRvbmx5ICNtZW1vTWV0aG9kPzogTFJVQ2FjaGUuTWVtb2l6ZXI8SywgViwgRkM+XG4gIHJlYWRvbmx5ICNwZXJmOiBQZXJmXG5cbiAgLyoqXG4gICAqIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS5wZXJmfVxuICAgKi9cbiAgZ2V0IHBlcmYoKSB7XG4gICAgcmV0dXJuIHRoaXMuI3BlcmZcbiAgfVxuXG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2UudHRsfVxuICAgKi9cbiAgdHRsOiBMUlVDYWNoZS5NaWxsaXNlY29uZHNcblxuICAvKipcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLnR0bFJlc29sdXRpb259XG4gICAqL1xuICB0dGxSZXNvbHV0aW9uOiBMUlVDYWNoZS5NaWxsaXNlY29uZHNcbiAgLyoqXG4gICAqIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS50dGxBdXRvcHVyZ2V9XG4gICAqL1xuICB0dGxBdXRvcHVyZ2U6IGJvb2xlYW5cbiAgLyoqXG4gICAqIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS51cGRhdGVBZ2VPbkdldH1cbiAgICovXG4gIHVwZGF0ZUFnZU9uR2V0OiBib29sZWFuXG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2UudXBkYXRlQWdlT25IYXN9XG4gICAqL1xuICB1cGRhdGVBZ2VPbkhhczogYm9vbGVhblxuICAvKipcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLmFsbG93U3RhbGV9XG4gICAqL1xuICBhbGxvd1N0YWxlOiBib29sZWFuXG5cbiAgLyoqXG4gICAqIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS5ub0Rpc3Bvc2VPblNldH1cbiAgICovXG4gIG5vRGlzcG9zZU9uU2V0OiBib29sZWFuXG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2Uubm9VcGRhdGVUVEx9XG4gICAqL1xuICBub1VwZGF0ZVRUTDogYm9vbGVhblxuICAvKipcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLm1heEVudHJ5U2l6ZX1cbiAgICovXG4gIG1heEVudHJ5U2l6ZTogTFJVQ2FjaGUuU2l6ZVxuICAvKipcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLnNpemVDYWxjdWxhdGlvbn1cbiAgICovXG4gIHNpemVDYWxjdWxhdGlvbj86IExSVUNhY2hlLlNpemVDYWxjdWxhdG9yPEssIFY+XG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2Uubm9EZWxldGVPbkZldGNoUmVqZWN0aW9ufVxuICAgKi9cbiAgbm9EZWxldGVPbkZldGNoUmVqZWN0aW9uOiBib29sZWFuXG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2Uubm9EZWxldGVPblN0YWxlR2V0fVxuICAgKi9cbiAgbm9EZWxldGVPblN0YWxlR2V0OiBib29sZWFuXG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2UuYWxsb3dTdGFsZU9uRmV0Y2hBYm9ydH1cbiAgICovXG4gIGFsbG93U3RhbGVPbkZldGNoQWJvcnQ6IGJvb2xlYW5cbiAgLyoqXG4gICAqIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS5hbGxvd1N0YWxlT25GZXRjaFJlamVjdGlvbn1cbiAgICovXG4gIGFsbG93U3RhbGVPbkZldGNoUmVqZWN0aW9uOiBib29sZWFuXG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2UuaWdub3JlRmV0Y2hBYm9ydH1cbiAgICovXG4gIGlnbm9yZUZldGNoQWJvcnQ6IGJvb2xlYW5cblxuICAvLyBjb21wdXRlZCBwcm9wZXJ0aWVzXG4gICNzaXplOiBMUlVDYWNoZS5Db3VudFxuICAjY2FsY3VsYXRlZFNpemU6IExSVUNhY2hlLlNpemVcbiAgI2tleU1hcDogTWFwPEssIEluZGV4PlxuICAja2V5TGlzdDogKEsgfCB1bmRlZmluZWQpW11cbiAgI3ZhbExpc3Q6IChWIHwgQmFja2dyb3VuZEZldGNoPFY+IHwgdW5kZWZpbmVkKVtdXG4gICNuZXh0OiBOdW1iZXJBcnJheVxuICAjcHJldjogTnVtYmVyQXJyYXlcbiAgI2hlYWQ6IEluZGV4XG4gICN0YWlsOiBJbmRleFxuICAjZnJlZTogU3RhY2tMaWtlXG4gICNkaXNwb3NlZD86IERpc3Bvc2VUYXNrPEssIFY+W11cbiAgI3NpemVzPzogWmVyb0FycmF5XG4gICNzdGFydHM/OiBaZXJvQXJyYXlcbiAgI3R0bHM/OiBaZXJvQXJyYXlcblxuICAjaGFzRGlzcG9zZTogYm9vbGVhblxuICAjaGFzRmV0Y2hNZXRob2Q6IGJvb2xlYW5cbiAgI2hhc0Rpc3Bvc2VBZnRlcjogYm9vbGVhblxuICAjaGFzT25JbnNlcnQ6IGJvb2xlYW5cblxuICAvKipcbiAgICogRG8gbm90IGNhbGwgdGhpcyBtZXRob2QgdW5sZXNzIHlvdSBuZWVkIHRvIGluc3BlY3QgdGhlXG4gICAqIGlubmVyIHdvcmtpbmdzIG9mIHRoZSBjYWNoZS4gIElmIGFueXRoaW5nIHJldHVybmVkIGJ5IHRoaXNcbiAgICogb2JqZWN0IGlzIG1vZGlmaWVkIGluIGFueSB3YXksIHN0cmFuZ2UgYnJlYWthZ2UgbWF5IG9jY3VyLlxuICAgKlxuICAgKiBUaGVzZSBmaWVsZHMgYXJlIHByaXZhdGUgZm9yIGEgcmVhc29uIVxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHN0YXRpYyB1bnNhZmVFeHBvc2VJbnRlcm5hbHM8XG4gICAgSyBleHRlbmRzIHt9LFxuICAgIFYgZXh0ZW5kcyB7fSxcbiAgICBGQyBleHRlbmRzIHVua25vd24gPSB1bmtub3duLFxuICA+KGM6IExSVUNhY2hlPEssIFYsIEZDPikge1xuICAgIHJldHVybiB7XG4gICAgICAvLyBwcm9wZXJ0aWVzXG4gICAgICBzdGFydHM6IGMuI3N0YXJ0cyxcbiAgICAgIHR0bHM6IGMuI3R0bHMsXG4gICAgICBzaXplczogYy4jc2l6ZXMsXG4gICAgICBrZXlNYXA6IGMuI2tleU1hcCBhcyBNYXA8SywgbnVtYmVyPixcbiAgICAgIGtleUxpc3Q6IGMuI2tleUxpc3QsXG4gICAgICB2YWxMaXN0OiBjLiN2YWxMaXN0LFxuICAgICAgbmV4dDogYy4jbmV4dCxcbiAgICAgIHByZXY6IGMuI3ByZXYsXG4gICAgICBnZXQgaGVhZCgpIHtcbiAgICAgICAgcmV0dXJuIGMuI2hlYWRcbiAgICAgIH0sXG4gICAgICBnZXQgdGFpbCgpIHtcbiAgICAgICAgcmV0dXJuIGMuI3RhaWxcbiAgICAgIH0sXG4gICAgICBmcmVlOiBjLiNmcmVlLFxuICAgICAgLy8gbWV0aG9kc1xuICAgICAgaXNCYWNrZ3JvdW5kRmV0Y2g6IChwOiBhbnkpID0+IGMuI2lzQmFja2dyb3VuZEZldGNoKHApLFxuICAgICAgYmFja2dyb3VuZEZldGNoOiAoXG4gICAgICAgIGs6IEssXG4gICAgICAgIGluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQsXG4gICAgICAgIG9wdGlvbnM6IExSVUNhY2hlLkZldGNoT3B0aW9uczxLLCBWLCBGQz4sXG4gICAgICAgIGNvbnRleHQ6IGFueSxcbiAgICAgICk6IEJhY2tncm91bmRGZXRjaDxWPiA9PlxuICAgICAgICBjLiNiYWNrZ3JvdW5kRmV0Y2goXG4gICAgICAgICAgayxcbiAgICAgICAgICBpbmRleCBhcyBJbmRleCB8IHVuZGVmaW5lZCxcbiAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICksXG4gICAgICBtb3ZlVG9UYWlsOiAoaW5kZXg6IG51bWJlcik6IHZvaWQgPT5cbiAgICAgICAgYy4jbW92ZVRvVGFpbChpbmRleCBhcyBJbmRleCksXG4gICAgICBpbmRleGVzOiAob3B0aW9ucz86IHsgYWxsb3dTdGFsZTogYm9vbGVhbiB9KSA9PlxuICAgICAgICBjLiNpbmRleGVzKG9wdGlvbnMpLFxuICAgICAgcmluZGV4ZXM6IChvcHRpb25zPzogeyBhbGxvd1N0YWxlOiBib29sZWFuIH0pID0+XG4gICAgICAgIGMuI3JpbmRleGVzKG9wdGlvbnMpLFxuICAgICAgaXNTdGFsZTogKGluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQpID0+XG4gICAgICAgIGMuI2lzU3RhbGUoaW5kZXggYXMgSW5kZXgpLFxuICAgIH1cbiAgfVxuXG4gIC8vIFByb3RlY3RlZCByZWFkLW9ubHkgbWVtYmVyc1xuXG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2UubWF4fSAocmVhZC1vbmx5KVxuICAgKi9cbiAgZ2V0IG1heCgpOiBMUlVDYWNoZS5Db3VudCB7XG4gICAgcmV0dXJuIHRoaXMuI21heFxuICB9XG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2UubWF4U2l6ZX0gKHJlYWQtb25seSlcbiAgICovXG4gIGdldCBtYXhTaXplKCk6IExSVUNhY2hlLkNvdW50IHtcbiAgICByZXR1cm4gdGhpcy4jbWF4U2l6ZVxuICB9XG4gIC8qKlxuICAgKiBUaGUgdG90YWwgY29tcHV0ZWQgc2l6ZSBvZiBpdGVtcyBpbiB0aGUgY2FjaGUgKHJlYWQtb25seSlcbiAgICovXG4gIGdldCBjYWxjdWxhdGVkU2l6ZSgpOiBMUlVDYWNoZS5TaXplIHtcbiAgICByZXR1cm4gdGhpcy4jY2FsY3VsYXRlZFNpemVcbiAgfVxuICAvKipcbiAgICogVGhlIG51bWJlciBvZiBpdGVtcyBzdG9yZWQgaW4gdGhlIGNhY2hlIChyZWFkLW9ubHkpXG4gICAqL1xuICBnZXQgc2l6ZSgpOiBMUlVDYWNoZS5Db3VudCB7XG4gICAgcmV0dXJuIHRoaXMuI3NpemVcbiAgfVxuICAvKipcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLmZldGNoTWV0aG9kfSAocmVhZC1vbmx5KVxuICAgKi9cbiAgZ2V0IGZldGNoTWV0aG9kKCk6IExSVUNhY2hlLkZldGNoZXI8SywgViwgRkM+IHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy4jZmV0Y2hNZXRob2RcbiAgfVxuICBnZXQgbWVtb01ldGhvZCgpOiBMUlVDYWNoZS5NZW1vaXplcjxLLCBWLCBGQz4gfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLiNtZW1vTWV0aG9kXG4gIH1cbiAgLyoqXG4gICAqIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS5kaXNwb3NlfSAocmVhZC1vbmx5KVxuICAgKi9cbiAgZ2V0IGRpc3Bvc2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2Rpc3Bvc2VcbiAgfVxuICAvKipcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLm9uSW5zZXJ0fSAocmVhZC1vbmx5KVxuICAgKi9cbiAgZ2V0IG9uSW5zZXJ0KCkge1xuICAgIHJldHVybiB0aGlzLiNvbkluc2VydFxuICB9XG4gIC8qKlxuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2UuZGlzcG9zZUFmdGVyfSAocmVhZC1vbmx5KVxuICAgKi9cbiAgZ2V0IGRpc3Bvc2VBZnRlcigpIHtcbiAgICByZXR1cm4gdGhpcy4jZGlzcG9zZUFmdGVyXG4gIH1cblxuICBjb25zdHJ1Y3RvcihcbiAgICBvcHRpb25zOiBMUlVDYWNoZS5PcHRpb25zPEssIFYsIEZDPiB8IExSVUNhY2hlPEssIFYsIEZDPixcbiAgKSB7XG4gICAgY29uc3Qge1xuICAgICAgbWF4ID0gMCxcbiAgICAgIHR0bCxcbiAgICAgIHR0bFJlc29sdXRpb24gPSAxLFxuICAgICAgdHRsQXV0b3B1cmdlLFxuICAgICAgdXBkYXRlQWdlT25HZXQsXG4gICAgICB1cGRhdGVBZ2VPbkhhcyxcbiAgICAgIGFsbG93U3RhbGUsXG4gICAgICBkaXNwb3NlLFxuICAgICAgb25JbnNlcnQsXG4gICAgICBkaXNwb3NlQWZ0ZXIsXG4gICAgICBub0Rpc3Bvc2VPblNldCxcbiAgICAgIG5vVXBkYXRlVFRMLFxuICAgICAgbWF4U2l6ZSA9IDAsXG4gICAgICBtYXhFbnRyeVNpemUgPSAwLFxuICAgICAgc2l6ZUNhbGN1bGF0aW9uLFxuICAgICAgZmV0Y2hNZXRob2QsXG4gICAgICBtZW1vTWV0aG9kLFxuICAgICAgbm9EZWxldGVPbkZldGNoUmVqZWN0aW9uLFxuICAgICAgbm9EZWxldGVPblN0YWxlR2V0LFxuICAgICAgYWxsb3dTdGFsZU9uRmV0Y2hSZWplY3Rpb24sXG4gICAgICBhbGxvd1N0YWxlT25GZXRjaEFib3J0LFxuICAgICAgaWdub3JlRmV0Y2hBYm9ydCxcbiAgICAgIHBlcmYsXG4gICAgfSA9IG9wdGlvbnNcblxuICAgIGlmIChwZXJmICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICh0eXBlb2YgcGVyZj8ubm93ICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgJ3BlcmYgb3B0aW9uIG11c3QgaGF2ZSBhIG5vdygpIG1ldGhvZCBpZiBzcGVjaWZpZWQnLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy4jcGVyZiA9IHBlcmYgPz8gZGVmYXVsdFBlcmZcblxuICAgIGlmIChtYXggIT09IDAgJiYgIWlzUG9zSW50KG1heCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ21heCBvcHRpb24gbXVzdCBiZSBhIG5vbm5lZ2F0aXZlIGludGVnZXInKVxuICAgIH1cblxuICAgIGNvbnN0IFVpbnRBcnJheSA9IG1heCA/IGdldFVpbnRBcnJheShtYXgpIDogQXJyYXlcbiAgICBpZiAoIVVpbnRBcnJheSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIG1heCB2YWx1ZTogJyArIG1heClcbiAgICB9XG5cbiAgICB0aGlzLiNtYXggPSBtYXhcbiAgICB0aGlzLiNtYXhTaXplID0gbWF4U2l6ZVxuICAgIHRoaXMubWF4RW50cnlTaXplID0gbWF4RW50cnlTaXplIHx8IHRoaXMuI21heFNpemVcbiAgICB0aGlzLnNpemVDYWxjdWxhdGlvbiA9IHNpemVDYWxjdWxhdGlvblxuICAgIGlmICh0aGlzLnNpemVDYWxjdWxhdGlvbikge1xuICAgICAgaWYgKCF0aGlzLiNtYXhTaXplICYmICF0aGlzLm1heEVudHJ5U2l6ZSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICdjYW5ub3Qgc2V0IHNpemVDYWxjdWxhdGlvbiB3aXRob3V0IHNldHRpbmcgbWF4U2l6ZSBvciBtYXhFbnRyeVNpemUnLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIHRoaXMuc2l6ZUNhbGN1bGF0aW9uICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NpemVDYWxjdWxhdGlvbiBzZXQgdG8gbm9uLWZ1bmN0aW9uJylcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICBtZW1vTWV0aG9kICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIHR5cGVvZiBtZW1vTWV0aG9kICE9PSAnZnVuY3Rpb24nXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtZW1vTWV0aG9kIG11c3QgYmUgYSBmdW5jdGlvbiBpZiBkZWZpbmVkJylcbiAgICB9XG4gICAgdGhpcy4jbWVtb01ldGhvZCA9IG1lbW9NZXRob2RcblxuICAgIGlmIChcbiAgICAgIGZldGNoTWV0aG9kICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIHR5cGVvZiBmZXRjaE1ldGhvZCAhPT0gJ2Z1bmN0aW9uJ1xuICAgICkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgJ2ZldGNoTWV0aG9kIG11c3QgYmUgYSBmdW5jdGlvbiBpZiBzcGVjaWZpZWQnLFxuICAgICAgKVxuICAgIH1cbiAgICB0aGlzLiNmZXRjaE1ldGhvZCA9IGZldGNoTWV0aG9kXG4gICAgdGhpcy4jaGFzRmV0Y2hNZXRob2QgPSAhIWZldGNoTWV0aG9kXG5cbiAgICB0aGlzLiNrZXlNYXAgPSBuZXcgTWFwKClcbiAgICB0aGlzLiNrZXlMaXN0ID0gbmV3IEFycmF5KG1heCkuZmlsbCh1bmRlZmluZWQpXG4gICAgdGhpcy4jdmFsTGlzdCA9IG5ldyBBcnJheShtYXgpLmZpbGwodW5kZWZpbmVkKVxuICAgIHRoaXMuI25leHQgPSBuZXcgVWludEFycmF5KG1heClcbiAgICB0aGlzLiNwcmV2ID0gbmV3IFVpbnRBcnJheShtYXgpXG4gICAgdGhpcy4jaGVhZCA9IDAgYXMgSW5kZXhcbiAgICB0aGlzLiN0YWlsID0gMCBhcyBJbmRleFxuICAgIHRoaXMuI2ZyZWUgPSBTdGFjay5jcmVhdGUobWF4KVxuICAgIHRoaXMuI3NpemUgPSAwXG4gICAgdGhpcy4jY2FsY3VsYXRlZFNpemUgPSAwXG5cbiAgICBpZiAodHlwZW9mIGRpc3Bvc2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuI2Rpc3Bvc2UgPSBkaXNwb3NlXG4gICAgfVxuICAgIGlmICh0eXBlb2Ygb25JbnNlcnQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuI29uSW5zZXJ0ID0gb25JbnNlcnRcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBkaXNwb3NlQWZ0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuI2Rpc3Bvc2VBZnRlciA9IGRpc3Bvc2VBZnRlclxuICAgICAgdGhpcy4jZGlzcG9zZWQgPSBbXVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiNkaXNwb3NlQWZ0ZXIgPSB1bmRlZmluZWRcbiAgICAgIHRoaXMuI2Rpc3Bvc2VkID0gdW5kZWZpbmVkXG4gICAgfVxuICAgIHRoaXMuI2hhc0Rpc3Bvc2UgPSAhIXRoaXMuI2Rpc3Bvc2VcbiAgICB0aGlzLiNoYXNPbkluc2VydCA9ICEhdGhpcy4jb25JbnNlcnRcbiAgICB0aGlzLiNoYXNEaXNwb3NlQWZ0ZXIgPSAhIXRoaXMuI2Rpc3Bvc2VBZnRlclxuXG4gICAgdGhpcy5ub0Rpc3Bvc2VPblNldCA9ICEhbm9EaXNwb3NlT25TZXRcbiAgICB0aGlzLm5vVXBkYXRlVFRMID0gISFub1VwZGF0ZVRUTFxuICAgIHRoaXMubm9EZWxldGVPbkZldGNoUmVqZWN0aW9uID0gISFub0RlbGV0ZU9uRmV0Y2hSZWplY3Rpb25cbiAgICB0aGlzLmFsbG93U3RhbGVPbkZldGNoUmVqZWN0aW9uID0gISFhbGxvd1N0YWxlT25GZXRjaFJlamVjdGlvblxuICAgIHRoaXMuYWxsb3dTdGFsZU9uRmV0Y2hBYm9ydCA9ICEhYWxsb3dTdGFsZU9uRmV0Y2hBYm9ydFxuICAgIHRoaXMuaWdub3JlRmV0Y2hBYm9ydCA9ICEhaWdub3JlRmV0Y2hBYm9ydFxuXG4gICAgLy8gTkI6IG1heEVudHJ5U2l6ZSBpcyBzZXQgdG8gbWF4U2l6ZSBpZiBpdCdzIHNldFxuICAgIGlmICh0aGlzLm1heEVudHJ5U2l6ZSAhPT0gMCkge1xuICAgICAgaWYgKHRoaXMuI21heFNpemUgIT09IDApIHtcbiAgICAgICAgaWYgKCFpc1Bvc0ludCh0aGlzLiNtYXhTaXplKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICAnbWF4U2l6ZSBtdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlciBpZiBzcGVjaWZpZWQnLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFpc1Bvc0ludCh0aGlzLm1heEVudHJ5U2l6ZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAnbWF4RW50cnlTaXplIG11c3QgYmUgYSBwb3NpdGl2ZSBpbnRlZ2VyIGlmIHNwZWNpZmllZCcsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIHRoaXMuI2luaXRpYWxpemVTaXplVHJhY2tpbmcoKVxuICAgIH1cblxuICAgIHRoaXMuYWxsb3dTdGFsZSA9ICEhYWxsb3dTdGFsZVxuICAgIHRoaXMubm9EZWxldGVPblN0YWxlR2V0ID0gISFub0RlbGV0ZU9uU3RhbGVHZXRcbiAgICB0aGlzLnVwZGF0ZUFnZU9uR2V0ID0gISF1cGRhdGVBZ2VPbkdldFxuICAgIHRoaXMudXBkYXRlQWdlT25IYXMgPSAhIXVwZGF0ZUFnZU9uSGFzXG4gICAgdGhpcy50dGxSZXNvbHV0aW9uID1cbiAgICAgIGlzUG9zSW50KHR0bFJlc29sdXRpb24pIHx8IHR0bFJlc29sdXRpb24gPT09IDAgP1xuICAgICAgICB0dGxSZXNvbHV0aW9uXG4gICAgICA6IDFcbiAgICB0aGlzLnR0bEF1dG9wdXJnZSA9ICEhdHRsQXV0b3B1cmdlXG4gICAgdGhpcy50dGwgPSB0dGwgfHwgMFxuICAgIGlmICh0aGlzLnR0bCkge1xuICAgICAgaWYgKCFpc1Bvc0ludCh0aGlzLnR0bCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAndHRsIG11c3QgYmUgYSBwb3NpdGl2ZSBpbnRlZ2VyIGlmIHNwZWNpZmllZCcsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIHRoaXMuI2luaXRpYWxpemVUVExUcmFja2luZygpXG4gICAgfVxuXG4gICAgLy8gZG8gbm90IGFsbG93IGNvbXBsZXRlbHkgdW5ib3VuZGVkIGNhY2hlc1xuICAgIGlmICh0aGlzLiNtYXggPT09IDAgJiYgdGhpcy50dGwgPT09IDAgJiYgdGhpcy4jbWF4U2l6ZSA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgJ0F0IGxlYXN0IG9uZSBvZiBtYXgsIG1heFNpemUsIG9yIHR0bCBpcyByZXF1aXJlZCcsXG4gICAgICApXG4gICAgfVxuICAgIGlmICghdGhpcy50dGxBdXRvcHVyZ2UgJiYgIXRoaXMuI21heCAmJiAhdGhpcy4jbWF4U2l6ZSkge1xuICAgICAgY29uc3QgY29kZSA9ICdMUlVfQ0FDSEVfVU5CT1VOREVEJ1xuICAgICAgaWYgKHNob3VsZFdhcm4oY29kZSkpIHtcbiAgICAgICAgd2FybmVkLmFkZChjb2RlKVxuICAgICAgICBjb25zdCBtc2cgPVxuICAgICAgICAgICdUVEwgY2FjaGluZyB3aXRob3V0IHR0bEF1dG9wdXJnZSwgbWF4LCBvciBtYXhTaXplIGNhbiAnICtcbiAgICAgICAgICAncmVzdWx0IGluIHVuYm91bmRlZCBtZW1vcnkgY29uc3VtcHRpb24uJ1xuICAgICAgICBlbWl0V2FybmluZyhtc2csICdVbmJvdW5kZWRDYWNoZVdhcm5pbmcnLCBjb2RlLCBMUlVDYWNoZSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBudW1iZXIgb2YgbXMgbGVmdCBpbiB0aGUgaXRlbSdzIFRUTC4gSWYgaXRlbSBpcyBub3QgaW4gY2FjaGUsXG4gICAqIHJldHVybnMgYDBgLiBSZXR1cm5zIGBJbmZpbml0eWAgaWYgaXRlbSBpcyBpbiBjYWNoZSB3aXRob3V0IGEgZGVmaW5lZCBUVEwuXG4gICAqL1xuICBnZXRSZW1haW5pbmdUVEwoa2V5OiBLKSB7XG4gICAgcmV0dXJuIHRoaXMuI2tleU1hcC5oYXMoa2V5KSA/IEluZmluaXR5IDogMFxuICB9XG5cbiAgI2luaXRpYWxpemVUVExUcmFja2luZygpIHtcbiAgICBjb25zdCB0dGxzID0gbmV3IFplcm9BcnJheSh0aGlzLiNtYXgpXG4gICAgY29uc3Qgc3RhcnRzID0gbmV3IFplcm9BcnJheSh0aGlzLiNtYXgpXG4gICAgdGhpcy4jdHRscyA9IHR0bHNcbiAgICB0aGlzLiNzdGFydHMgPSBzdGFydHNcblxuICAgIHRoaXMuI3NldEl0ZW1UVEwgPSAoaW5kZXgsIHR0bCwgc3RhcnQgPSB0aGlzLiNwZXJmLm5vdygpKSA9PiB7XG4gICAgICBzdGFydHNbaW5kZXhdID0gdHRsICE9PSAwID8gc3RhcnQgOiAwXG4gICAgICB0dGxzW2luZGV4XSA9IHR0bFxuICAgICAgaWYgKHR0bCAhPT0gMCAmJiB0aGlzLnR0bEF1dG9wdXJnZSkge1xuICAgICAgICBjb25zdCB0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgaWYgKHRoaXMuI2lzU3RhbGUoaW5kZXgpKSB7XG4gICAgICAgICAgICB0aGlzLiNkZWxldGUodGhpcy4ja2V5TGlzdFtpbmRleF0gYXMgSywgJ2V4cGlyZScpXG4gICAgICAgICAgfVxuICAgICAgICB9LCB0dGwgKyAxKVxuICAgICAgICAvLyB1bnJlZigpIG5vdCBzdXBwb3J0ZWQgb24gYWxsIHBsYXRmb3Jtc1xuICAgICAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICAgICAgaWYgKHQudW5yZWYpIHtcbiAgICAgICAgICB0LnVucmVmKClcbiAgICAgICAgfVxuICAgICAgICAvKiBjOCBpZ25vcmUgc3RvcCAqL1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuI3VwZGF0ZUl0ZW1BZ2UgPSBpbmRleCA9PiB7XG4gICAgICBzdGFydHNbaW5kZXhdID0gdHRsc1tpbmRleF0gIT09IDAgPyB0aGlzLiNwZXJmLm5vdygpIDogMFxuICAgIH1cblxuICAgIHRoaXMuI3N0YXR1c1RUTCA9IChzdGF0dXMsIGluZGV4KSA9PiB7XG4gICAgICBpZiAodHRsc1tpbmRleF0pIHtcbiAgICAgICAgY29uc3QgdHRsID0gdHRsc1tpbmRleF1cbiAgICAgICAgY29uc3Qgc3RhcnQgPSBzdGFydHNbaW5kZXhdXG4gICAgICAgIC8qIGM4IGlnbm9yZSBuZXh0ICovXG4gICAgICAgIGlmICghdHRsIHx8ICFzdGFydCkgcmV0dXJuXG4gICAgICAgIHN0YXR1cy50dGwgPSB0dGxcbiAgICAgICAgc3RhdHVzLnN0YXJ0ID0gc3RhcnRcbiAgICAgICAgc3RhdHVzLm5vdyA9IGNhY2hlZE5vdyB8fCBnZXROb3coKVxuICAgICAgICBjb25zdCBhZ2UgPSBzdGF0dXMubm93IC0gc3RhcnRcbiAgICAgICAgc3RhdHVzLnJlbWFpbmluZ1RUTCA9IHR0bCAtIGFnZVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGRlYm91bmNlIGNhbGxzIHRvIHBlcmYubm93KCkgdG8gMXMgc28gd2UncmUgbm90IGhpdHRpbmdcbiAgICAvLyB0aGF0IGNvc3RseSBjYWxsIHJlcGVhdGVkbHkuXG4gICAgbGV0IGNhY2hlZE5vdyA9IDBcbiAgICBjb25zdCBnZXROb3cgPSAoKSA9PiB7XG4gICAgICBjb25zdCBuID0gdGhpcy4jcGVyZi5ub3coKVxuICAgICAgaWYgKHRoaXMudHRsUmVzb2x1dGlvbiA+IDApIHtcbiAgICAgICAgY2FjaGVkTm93ID0gblxuICAgICAgICBjb25zdCB0ID0gc2V0VGltZW91dChcbiAgICAgICAgICAoKSA9PiAoY2FjaGVkTm93ID0gMCksXG4gICAgICAgICAgdGhpcy50dGxSZXNvbHV0aW9uLFxuICAgICAgICApXG4gICAgICAgIC8vIG5vdCBhdmFpbGFibGUgb24gYWxsIHBsYXRmb3Jtc1xuICAgICAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICAgICAgaWYgKHQudW5yZWYpIHtcbiAgICAgICAgICB0LnVucmVmKClcbiAgICAgICAgfVxuICAgICAgICAvKiBjOCBpZ25vcmUgc3RvcCAqL1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5cbiAgICB9XG5cbiAgICB0aGlzLmdldFJlbWFpbmluZ1RUTCA9IGtleSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuI2tleU1hcC5nZXQoa2V5KVxuICAgICAgaWYgKGluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIDBcbiAgICAgIH1cbiAgICAgIGNvbnN0IHR0bCA9IHR0bHNbaW5kZXhdXG4gICAgICBjb25zdCBzdGFydCA9IHN0YXJ0c1tpbmRleF1cbiAgICAgIGlmICghdHRsIHx8ICFzdGFydCkge1xuICAgICAgICByZXR1cm4gSW5maW5pdHlcbiAgICAgIH1cbiAgICAgIGNvbnN0IGFnZSA9IChjYWNoZWROb3cgfHwgZ2V0Tm93KCkpIC0gc3RhcnRcbiAgICAgIHJldHVybiB0dGwgLSBhZ2VcbiAgICB9XG5cbiAgICB0aGlzLiNpc1N0YWxlID0gaW5kZXggPT4ge1xuICAgICAgY29uc3QgcyA9IHN0YXJ0c1tpbmRleF1cbiAgICAgIGNvbnN0IHQgPSB0dGxzW2luZGV4XVxuICAgICAgcmV0dXJuICEhdCAmJiAhIXMgJiYgKGNhY2hlZE5vdyB8fCBnZXROb3coKSkgLSBzID4gdFxuICAgIH1cbiAgfVxuXG4gIC8vIGNvbmRpdGlvbmFsbHkgc2V0IHByaXZhdGUgbWV0aG9kcyByZWxhdGVkIHRvIFRUTFxuICAjdXBkYXRlSXRlbUFnZTogKGluZGV4OiBJbmRleCkgPT4gdm9pZCA9ICgpID0+IHt9XG4gICNzdGF0dXNUVEw6IChzdGF0dXM6IExSVUNhY2hlLlN0YXR1czxWPiwgaW5kZXg6IEluZGV4KSA9PiB2b2lkID1cbiAgICAoKSA9PiB7fVxuICAjc2V0SXRlbVRUTDogKFxuICAgIGluZGV4OiBJbmRleCxcbiAgICB0dGw6IExSVUNhY2hlLk1pbGxpc2Vjb25kcyxcbiAgICBzdGFydD86IExSVUNhY2hlLk1pbGxpc2Vjb25kcyxcbiAgICAvLyBpZ25vcmUgYmVjYXVzZSB3ZSBuZXZlciBjYWxsIHRoaXMgaWYgd2UncmUgbm90IGFscmVhZHkgaW4gVFRMIG1vZGVcbiAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgKSA9PiB2b2lkID0gKCkgPT4ge31cbiAgLyogYzggaWdub3JlIHN0b3AgKi9cblxuICAjaXNTdGFsZTogKGluZGV4OiBJbmRleCkgPT4gYm9vbGVhbiA9ICgpID0+IGZhbHNlXG5cbiAgI2luaXRpYWxpemVTaXplVHJhY2tpbmcoKSB7XG4gICAgY29uc3Qgc2l6ZXMgPSBuZXcgWmVyb0FycmF5KHRoaXMuI21heClcbiAgICB0aGlzLiNjYWxjdWxhdGVkU2l6ZSA9IDBcbiAgICB0aGlzLiNzaXplcyA9IHNpemVzXG4gICAgdGhpcy4jcmVtb3ZlSXRlbVNpemUgPSBpbmRleCA9PiB7XG4gICAgICB0aGlzLiNjYWxjdWxhdGVkU2l6ZSAtPSBzaXplc1tpbmRleF0gYXMgbnVtYmVyXG4gICAgICBzaXplc1tpbmRleF0gPSAwXG4gICAgfVxuICAgIHRoaXMuI3JlcXVpcmVTaXplID0gKGssIHYsIHNpemUsIHNpemVDYWxjdWxhdGlvbikgPT4ge1xuICAgICAgLy8gcHJvdmlzaW9uYWxseSBhY2NlcHQgYmFja2dyb3VuZCBmZXRjaGVzLlxuICAgICAgLy8gYWN0dWFsIHZhbHVlIHNpemUgd2lsbCBiZSBjaGVja2VkIHdoZW4gdGhleSByZXR1cm4uXG4gICAgICBpZiAodGhpcy4jaXNCYWNrZ3JvdW5kRmV0Y2godikpIHtcbiAgICAgICAgcmV0dXJuIDBcbiAgICAgIH1cbiAgICAgIGlmICghaXNQb3NJbnQoc2l6ZSkpIHtcbiAgICAgICAgaWYgKHNpemVDYWxjdWxhdGlvbikge1xuICAgICAgICAgIGlmICh0eXBlb2Ygc2l6ZUNhbGN1bGF0aW9uICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzaXplQ2FsY3VsYXRpb24gbXVzdCBiZSBhIGZ1bmN0aW9uJylcbiAgICAgICAgICB9XG4gICAgICAgICAgc2l6ZSA9IHNpemVDYWxjdWxhdGlvbih2LCBrKVxuICAgICAgICAgIGlmICghaXNQb3NJbnQoc2l6ZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICAgICdzaXplQ2FsY3VsYXRpb24gcmV0dXJuIGludmFsaWQgKGV4cGVjdCBwb3NpdGl2ZSBpbnRlZ2VyKScsXG4gICAgICAgICAgICApXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICAnaW52YWxpZCBzaXplIHZhbHVlIChtdXN0IGJlIHBvc2l0aXZlIGludGVnZXIpLiAnICtcbiAgICAgICAgICAgICAgJ1doZW4gbWF4U2l6ZSBvciBtYXhFbnRyeVNpemUgaXMgdXNlZCwgc2l6ZUNhbGN1bGF0aW9uICcgK1xuICAgICAgICAgICAgICAnb3Igc2l6ZSBtdXN0IGJlIHNldC4nLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHNpemVcbiAgICB9XG4gICAgdGhpcy4jYWRkSXRlbVNpemUgPSAoXG4gICAgICBpbmRleDogSW5kZXgsXG4gICAgICBzaXplOiBMUlVDYWNoZS5TaXplLFxuICAgICAgc3RhdHVzPzogTFJVQ2FjaGUuU3RhdHVzPFY+LFxuICAgICkgPT4ge1xuICAgICAgc2l6ZXNbaW5kZXhdID0gc2l6ZVxuICAgICAgaWYgKHRoaXMuI21heFNpemUpIHtcbiAgICAgICAgY29uc3QgbWF4U2l6ZSA9IHRoaXMuI21heFNpemUgLSAoc2l6ZXNbaW5kZXhdIGFzIG51bWJlcilcbiAgICAgICAgd2hpbGUgKHRoaXMuI2NhbGN1bGF0ZWRTaXplID4gbWF4U2l6ZSkge1xuICAgICAgICAgIHRoaXMuI2V2aWN0KHRydWUpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuI2NhbGN1bGF0ZWRTaXplICs9IHNpemVzW2luZGV4XSBhcyBudW1iZXJcbiAgICAgIGlmIChzdGF0dXMpIHtcbiAgICAgICAgc3RhdHVzLmVudHJ5U2l6ZSA9IHNpemVcbiAgICAgICAgc3RhdHVzLnRvdGFsQ2FsY3VsYXRlZFNpemUgPSB0aGlzLiNjYWxjdWxhdGVkU2l6ZVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gICNyZW1vdmVJdGVtU2l6ZTogKGluZGV4OiBJbmRleCkgPT4gdm9pZCA9IF9pID0+IHt9XG4gICNhZGRJdGVtU2l6ZTogKFxuICAgIGluZGV4OiBJbmRleCxcbiAgICBzaXplOiBMUlVDYWNoZS5TaXplLFxuICAgIHN0YXR1cz86IExSVUNhY2hlLlN0YXR1czxWPixcbiAgKSA9PiB2b2lkID0gKF9pLCBfcywgX3N0KSA9PiB7fVxuICAjcmVxdWlyZVNpemU6IChcbiAgICBrOiBLLFxuICAgIHY6IFYgfCBCYWNrZ3JvdW5kRmV0Y2g8Vj4sXG4gICAgc2l6ZT86IExSVUNhY2hlLlNpemUsXG4gICAgc2l6ZUNhbGN1bGF0aW9uPzogTFJVQ2FjaGUuU2l6ZUNhbGN1bGF0b3I8SywgVj4sXG4gICkgPT4gTFJVQ2FjaGUuU2l6ZSA9IChcbiAgICBfazogSyxcbiAgICBfdjogViB8IEJhY2tncm91bmRGZXRjaDxWPixcbiAgICBzaXplPzogTFJVQ2FjaGUuU2l6ZSxcbiAgICBzaXplQ2FsY3VsYXRpb24/OiBMUlVDYWNoZS5TaXplQ2FsY3VsYXRvcjxLLCBWPixcbiAgKSA9PiB7XG4gICAgaWYgKHNpemUgfHwgc2l6ZUNhbGN1bGF0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAnY2Fubm90IHNldCBzaXplIHdpdGhvdXQgc2V0dGluZyBtYXhTaXplIG9yIG1heEVudHJ5U2l6ZSBvbiBjYWNoZScsXG4gICAgICApXG4gICAgfVxuICAgIHJldHVybiAwXG4gIH07XG5cbiAgKiNpbmRleGVzKHsgYWxsb3dTdGFsZSA9IHRoaXMuYWxsb3dTdGFsZSB9ID0ge30pIHtcbiAgICBpZiAodGhpcy4jc2l6ZSkge1xuICAgICAgZm9yIChsZXQgaSA9IHRoaXMuI3RhaWw7IHRydWU7ICkge1xuICAgICAgICBpZiAoIXRoaXMuI2lzVmFsaWRJbmRleChpKSkge1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFsbG93U3RhbGUgfHwgIXRoaXMuI2lzU3RhbGUoaSkpIHtcbiAgICAgICAgICB5aWVsZCBpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGkgPT09IHRoaXMuI2hlYWQpIHtcbiAgICAgICAgICBicmVha1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGkgPSB0aGlzLiNwcmV2W2ldIGFzIEluZGV4XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAqI3JpbmRleGVzKHsgYWxsb3dTdGFsZSA9IHRoaXMuYWxsb3dTdGFsZSB9ID0ge30pIHtcbiAgICBpZiAodGhpcy4jc2l6ZSkge1xuICAgICAgZm9yIChsZXQgaSA9IHRoaXMuI2hlYWQ7IHRydWU7ICkge1xuICAgICAgICBpZiAoIXRoaXMuI2lzVmFsaWRJbmRleChpKSkge1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFsbG93U3RhbGUgfHwgIXRoaXMuI2lzU3RhbGUoaSkpIHtcbiAgICAgICAgICB5aWVsZCBpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGkgPT09IHRoaXMuI3RhaWwpIHtcbiAgICAgICAgICBicmVha1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGkgPSB0aGlzLiNuZXh0W2ldIGFzIEluZGV4XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAjaXNWYWxpZEluZGV4KGluZGV4OiBJbmRleCkge1xuICAgIHJldHVybiAoXG4gICAgICBpbmRleCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICB0aGlzLiNrZXlNYXAuZ2V0KHRoaXMuI2tleUxpc3RbaW5kZXhdIGFzIEspID09PSBpbmRleFxuICAgIClcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBnZW5lcmF0b3IgeWllbGRpbmcgYFtrZXksIHZhbHVlXWAgcGFpcnMsXG4gICAqIGluIG9yZGVyIGZyb20gbW9zdCByZWNlbnRseSB1c2VkIHRvIGxlYXN0IHJlY2VudGx5IHVzZWQuXG4gICAqL1xuICAqZW50cmllcygpIHtcbiAgICBmb3IgKGNvbnN0IGkgb2YgdGhpcy4jaW5kZXhlcygpKSB7XG4gICAgICBpZiAoXG4gICAgICAgIHRoaXMuI3ZhbExpc3RbaV0gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICB0aGlzLiNrZXlMaXN0W2ldICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgIXRoaXMuI2lzQmFja2dyb3VuZEZldGNoKHRoaXMuI3ZhbExpc3RbaV0pXG4gICAgICApIHtcbiAgICAgICAgeWllbGQgW3RoaXMuI2tleUxpc3RbaV0sIHRoaXMuI3ZhbExpc3RbaV1dIGFzIFtLLCBWXVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZlcnNlIG9yZGVyIHZlcnNpb24gb2Yge0BsaW5rIExSVUNhY2hlLmVudHJpZXN9XG4gICAqXG4gICAqIFJldHVybiBhIGdlbmVyYXRvciB5aWVsZGluZyBgW2tleSwgdmFsdWVdYCBwYWlycyxcbiAgICogaW4gb3JkZXIgZnJvbSBsZWFzdCByZWNlbnRseSB1c2VkIHRvIG1vc3QgcmVjZW50bHkgdXNlZC5cbiAgICovXG4gICpyZW50cmllcygpIHtcbiAgICBmb3IgKGNvbnN0IGkgb2YgdGhpcy4jcmluZGV4ZXMoKSkge1xuICAgICAgaWYgKFxuICAgICAgICB0aGlzLiN2YWxMaXN0W2ldICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgdGhpcy4ja2V5TGlzdFtpXSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICF0aGlzLiNpc0JhY2tncm91bmRGZXRjaCh0aGlzLiN2YWxMaXN0W2ldKVxuICAgICAgKSB7XG4gICAgICAgIHlpZWxkIFt0aGlzLiNrZXlMaXN0W2ldLCB0aGlzLiN2YWxMaXN0W2ldXVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBnZW5lcmF0b3IgeWllbGRpbmcgdGhlIGtleXMgaW4gdGhlIGNhY2hlLFxuICAgKiBpbiBvcmRlciBmcm9tIG1vc3QgcmVjZW50bHkgdXNlZCB0byBsZWFzdCByZWNlbnRseSB1c2VkLlxuICAgKi9cbiAgKmtleXMoKSB7XG4gICAgZm9yIChjb25zdCBpIG9mIHRoaXMuI2luZGV4ZXMoKSkge1xuICAgICAgY29uc3QgayA9IHRoaXMuI2tleUxpc3RbaV1cbiAgICAgIGlmIChcbiAgICAgICAgayAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICF0aGlzLiNpc0JhY2tncm91bmRGZXRjaCh0aGlzLiN2YWxMaXN0W2ldKVxuICAgICAgKSB7XG4gICAgICAgIHlpZWxkIGtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52ZXJzZSBvcmRlciB2ZXJzaW9uIG9mIHtAbGluayBMUlVDYWNoZS5rZXlzfVxuICAgKlxuICAgKiBSZXR1cm4gYSBnZW5lcmF0b3IgeWllbGRpbmcgdGhlIGtleXMgaW4gdGhlIGNhY2hlLFxuICAgKiBpbiBvcmRlciBmcm9tIGxlYXN0IHJlY2VudGx5IHVzZWQgdG8gbW9zdCByZWNlbnRseSB1c2VkLlxuICAgKi9cbiAgKnJrZXlzKCkge1xuICAgIGZvciAoY29uc3QgaSBvZiB0aGlzLiNyaW5kZXhlcygpKSB7XG4gICAgICBjb25zdCBrID0gdGhpcy4ja2V5TGlzdFtpXVxuICAgICAgaWYgKFxuICAgICAgICBrICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgIXRoaXMuI2lzQmFja2dyb3VuZEZldGNoKHRoaXMuI3ZhbExpc3RbaV0pXG4gICAgICApIHtcbiAgICAgICAgeWllbGQga1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBnZW5lcmF0b3IgeWllbGRpbmcgdGhlIHZhbHVlcyBpbiB0aGUgY2FjaGUsXG4gICAqIGluIG9yZGVyIGZyb20gbW9zdCByZWNlbnRseSB1c2VkIHRvIGxlYXN0IHJlY2VudGx5IHVzZWQuXG4gICAqL1xuICAqdmFsdWVzKCkge1xuICAgIGZvciAoY29uc3QgaSBvZiB0aGlzLiNpbmRleGVzKCkpIHtcbiAgICAgIGNvbnN0IHYgPSB0aGlzLiN2YWxMaXN0W2ldXG4gICAgICBpZiAoXG4gICAgICAgIHYgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAhdGhpcy4jaXNCYWNrZ3JvdW5kRmV0Y2godGhpcy4jdmFsTGlzdFtpXSlcbiAgICAgICkge1xuICAgICAgICB5aWVsZCB0aGlzLiN2YWxMaXN0W2ldIGFzIFZcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52ZXJzZSBvcmRlciB2ZXJzaW9uIG9mIHtAbGluayBMUlVDYWNoZS52YWx1ZXN9XG4gICAqXG4gICAqIFJldHVybiBhIGdlbmVyYXRvciB5aWVsZGluZyB0aGUgdmFsdWVzIGluIHRoZSBjYWNoZSxcbiAgICogaW4gb3JkZXIgZnJvbSBsZWFzdCByZWNlbnRseSB1c2VkIHRvIG1vc3QgcmVjZW50bHkgdXNlZC5cbiAgICovXG4gICpydmFsdWVzKCkge1xuICAgIGZvciAoY29uc3QgaSBvZiB0aGlzLiNyaW5kZXhlcygpKSB7XG4gICAgICBjb25zdCB2ID0gdGhpcy4jdmFsTGlzdFtpXVxuICAgICAgaWYgKFxuICAgICAgICB2ICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgIXRoaXMuI2lzQmFja2dyb3VuZEZldGNoKHRoaXMuI3ZhbExpc3RbaV0pXG4gICAgICApIHtcbiAgICAgICAgeWllbGQgdGhpcy4jdmFsTGlzdFtpXVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRpbmcgb3ZlciB0aGUgY2FjaGUgaXRzZWxmIHlpZWxkcyB0aGUgc2FtZSByZXN1bHRzIGFzXG4gICAqIHtAbGluayBMUlVDYWNoZS5lbnRyaWVzfVxuICAgKi9cbiAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcygpXG4gIH1cblxuICAvKipcbiAgICogQSBTdHJpbmcgdmFsdWUgdGhhdCBpcyB1c2VkIGluIHRoZSBjcmVhdGlvbiBvZiB0aGUgZGVmYXVsdCBzdHJpbmdcbiAgICogZGVzY3JpcHRpb24gb2YgYW4gb2JqZWN0LiBDYWxsZWQgYnkgdGhlIGJ1aWx0LWluIG1ldGhvZFxuICAgKiBgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ2AuXG4gICAqL1xuICBbU3ltYm9sLnRvU3RyaW5nVGFnXSA9ICdMUlVDYWNoZSdcblxuICAvKipcbiAgICogRmluZCBhIHZhbHVlIGZvciB3aGljaCB0aGUgc3VwcGxpZWQgZm4gbWV0aG9kIHJldHVybnMgYSB0cnV0aHkgdmFsdWUsXG4gICAqIHNpbWlsYXIgdG8gYEFycmF5LmZpbmQoKWAuIGZuIGlzIGNhbGxlZCBhcyBgZm4odmFsdWUsIGtleSwgY2FjaGUpYC5cbiAgICovXG4gIGZpbmQoXG4gICAgZm46ICh2OiBWLCBrOiBLLCBzZWxmOiBMUlVDYWNoZTxLLCBWLCBGQz4pID0+IGJvb2xlYW4sXG4gICAgZ2V0T3B0aW9uczogTFJVQ2FjaGUuR2V0T3B0aW9uczxLLCBWLCBGQz4gPSB7fSxcbiAgKSB7XG4gICAgZm9yIChjb25zdCBpIG9mIHRoaXMuI2luZGV4ZXMoKSkge1xuICAgICAgY29uc3QgdiA9IHRoaXMuI3ZhbExpc3RbaV1cbiAgICAgIGNvbnN0IHZhbHVlID1cbiAgICAgICAgdGhpcy4jaXNCYWNrZ3JvdW5kRmV0Y2godikgPyB2Ll9fc3RhbGVXaGlsZUZldGNoaW5nIDogdlxuICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIGNvbnRpbnVlXG4gICAgICBpZiAoZm4odmFsdWUsIHRoaXMuI2tleUxpc3RbaV0gYXMgSywgdGhpcykpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KHRoaXMuI2tleUxpc3RbaV0gYXMgSywgZ2V0T3B0aW9ucylcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbCB0aGUgc3VwcGxpZWQgZnVuY3Rpb24gb24gZWFjaCBpdGVtIGluIHRoZSBjYWNoZSwgaW4gb3JkZXIgZnJvbSBtb3N0XG4gICAqIHJlY2VudGx5IHVzZWQgdG8gbGVhc3QgcmVjZW50bHkgdXNlZC5cbiAgICpcbiAgICogYGZuYCBpcyBjYWxsZWQgYXMgYGZuKHZhbHVlLCBrZXksIGNhY2hlKWAuXG4gICAqXG4gICAqIElmIGB0aGlzcGAgaXMgcHJvdmlkZWQsIGZ1bmN0aW9uIHdpbGwgYmUgY2FsbGVkIGluIHRoZSBgdGhpc2AtY29udGV4dCBvZlxuICAgKiB0aGUgcHJvdmlkZWQgb2JqZWN0LCBvciB0aGUgY2FjaGUgaWYgbm8gYHRoaXNwYCBvYmplY3QgaXMgcHJvdmlkZWQuXG4gICAqXG4gICAqIERvZXMgbm90IHVwZGF0ZSBhZ2Ugb3IgcmVjZW50eSBvZiB1c2UsIG9yIGl0ZXJhdGUgb3ZlciBzdGFsZSB2YWx1ZXMuXG4gICAqL1xuICBmb3JFYWNoKFxuICAgIGZuOiAodjogViwgazogSywgc2VsZjogTFJVQ2FjaGU8SywgViwgRkM+KSA9PiBhbnksXG4gICAgdGhpc3A6IGFueSA9IHRoaXMsXG4gICkge1xuICAgIGZvciAoY29uc3QgaSBvZiB0aGlzLiNpbmRleGVzKCkpIHtcbiAgICAgIGNvbnN0IHYgPSB0aGlzLiN2YWxMaXN0W2ldXG4gICAgICBjb25zdCB2YWx1ZSA9XG4gICAgICAgIHRoaXMuI2lzQmFja2dyb3VuZEZldGNoKHYpID8gdi5fX3N0YWxlV2hpbGVGZXRjaGluZyA6IHZcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSBjb250aW51ZVxuICAgICAgZm4uY2FsbCh0aGlzcCwgdmFsdWUsIHRoaXMuI2tleUxpc3RbaV0gYXMgSywgdGhpcylcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGhlIHNhbWUgYXMge0BsaW5rIExSVUNhY2hlLmZvckVhY2h9IGJ1dCBpdGVtcyBhcmUgaXRlcmF0ZWQgb3ZlciBpblxuICAgKiByZXZlcnNlIG9yZGVyLiAgKGllLCBsZXNzIHJlY2VudGx5IHVzZWQgaXRlbXMgYXJlIGl0ZXJhdGVkIG92ZXIgZmlyc3QuKVxuICAgKi9cbiAgcmZvckVhY2goXG4gICAgZm46ICh2OiBWLCBrOiBLLCBzZWxmOiBMUlVDYWNoZTxLLCBWLCBGQz4pID0+IGFueSxcbiAgICB0aGlzcDogYW55ID0gdGhpcyxcbiAgKSB7XG4gICAgZm9yIChjb25zdCBpIG9mIHRoaXMuI3JpbmRleGVzKCkpIHtcbiAgICAgIGNvbnN0IHYgPSB0aGlzLiN2YWxMaXN0W2ldXG4gICAgICBjb25zdCB2YWx1ZSA9XG4gICAgICAgIHRoaXMuI2lzQmFja2dyb3VuZEZldGNoKHYpID8gdi5fX3N0YWxlV2hpbGVGZXRjaGluZyA6IHZcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSBjb250aW51ZVxuICAgICAgZm4uY2FsbCh0aGlzcCwgdmFsdWUsIHRoaXMuI2tleUxpc3RbaV0gYXMgSywgdGhpcylcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGFueSBzdGFsZSBlbnRyaWVzLiBSZXR1cm5zIHRydWUgaWYgYW55dGhpbmcgd2FzIHJlbW92ZWQsXG4gICAqIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIHB1cmdlU3RhbGUoKSB7XG4gICAgbGV0IGRlbGV0ZWQgPSBmYWxzZVxuICAgIGZvciAoY29uc3QgaSBvZiB0aGlzLiNyaW5kZXhlcyh7IGFsbG93U3RhbGU6IHRydWUgfSkpIHtcbiAgICAgIGlmICh0aGlzLiNpc1N0YWxlKGkpKSB7XG4gICAgICAgIHRoaXMuI2RlbGV0ZSh0aGlzLiNrZXlMaXN0W2ldIGFzIEssICdleHBpcmUnKVxuICAgICAgICBkZWxldGVkID0gdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVsZXRlZFxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgZXh0ZW5kZWQgaW5mbyBhYm91dCBhIGdpdmVuIGVudHJ5LCB0byBnZXQgaXRzIHZhbHVlLCBzaXplLCBhbmRcbiAgICogVFRMIGluZm8gc2ltdWx0YW5lb3VzbHkuIFJldHVybnMgYHVuZGVmaW5lZGAgaWYgdGhlIGtleSBpcyBub3QgcHJlc2VudC5cbiAgICpcbiAgICogVW5saWtlIHtAbGluayBMUlVDYWNoZSNkdW1wfSwgd2hpY2ggaXMgZGVzaWduZWQgdG8gYmUgcG9ydGFibGUgYW5kIHN1cnZpdmVcbiAgICogc2VyaWFsaXphdGlvbiwgdGhlIGBzdGFydGAgdmFsdWUgaXMgYWx3YXlzIHRoZSBjdXJyZW50IHRpbWVzdGFtcCwgYW5kIHRoZVxuICAgKiBgdHRsYCBpcyBhIGNhbGN1bGF0ZWQgcmVtYWluaW5nIHRpbWUgdG8gbGl2ZSAobmVnYXRpdmUgaWYgZXhwaXJlZCkuXG4gICAqXG4gICAqIEFsd2F5cyByZXR1cm5zIHN0YWxlIHZhbHVlcywgaWYgdGhlaXIgaW5mbyBpcyBmb3VuZCBpbiB0aGUgY2FjaGUsIHNvIGJlXG4gICAqIHN1cmUgdG8gY2hlY2sgZm9yIGV4cGlyYXRpb25zIChpZSwgYSBuZWdhdGl2ZSB7QGxpbmsgTFJVQ2FjaGUuRW50cnkjdHRsfSlcbiAgICogaWYgcmVsZXZhbnQuXG4gICAqL1xuICBpbmZvKGtleTogSyk6IExSVUNhY2hlLkVudHJ5PFY+IHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBpID0gdGhpcy4ja2V5TWFwLmdldChrZXkpXG4gICAgaWYgKGkgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIGNvbnN0IHYgPSB0aGlzLiN2YWxMaXN0W2ldXG4gICAgLyogYzggaWdub3JlIHN0YXJ0IC0gdGhpcyBpc24ndCB0ZXN0ZWQgZm9yIHRoZSBpbmZvIGZ1bmN0aW9uLFxuICAgICAqIGJ1dCBpdCdzIHRoZSBzYW1lIGxvZ2ljIGFzIGZvdW5kIGluIG90aGVyIHBsYWNlcy4gKi9cbiAgICBjb25zdCB2YWx1ZTogViB8IHVuZGVmaW5lZCA9XG4gICAgICB0aGlzLiNpc0JhY2tncm91bmRGZXRjaCh2KSA/IHYuX19zdGFsZVdoaWxlRmV0Y2hpbmcgOiB2XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiB1bmRlZmluZWRcbiAgICAvKiBjOCBpZ25vcmUgZW5kICovXG4gICAgY29uc3QgZW50cnk6IExSVUNhY2hlLkVudHJ5PFY+ID0geyB2YWx1ZSB9XG4gICAgaWYgKHRoaXMuI3R0bHMgJiYgdGhpcy4jc3RhcnRzKSB7XG4gICAgICBjb25zdCB0dGwgPSB0aGlzLiN0dGxzW2ldXG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMuI3N0YXJ0c1tpXVxuICAgICAgaWYgKHR0bCAmJiBzdGFydCkge1xuICAgICAgICBjb25zdCByZW1haW4gPSB0dGwgLSAodGhpcy4jcGVyZi5ub3coKSAtIHN0YXJ0KVxuICAgICAgICBlbnRyeS50dGwgPSByZW1haW5cbiAgICAgICAgZW50cnkuc3RhcnQgPSBEYXRlLm5vdygpXG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLiNzaXplcykge1xuICAgICAgZW50cnkuc2l6ZSA9IHRoaXMuI3NpemVzW2ldXG4gICAgfVxuICAgIHJldHVybiBlbnRyeVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhbiBhcnJheSBvZiBba2V5LCB7QGxpbmsgTFJVQ2FjaGUuRW50cnl9XSB0dXBsZXMgd2hpY2ggY2FuIGJlXG4gICAqIHBhc3NlZCB0byB7QGxpbmsgTFJVQ2FjaGUjbG9hZH0uXG4gICAqXG4gICAqIFRoZSBgc3RhcnRgIGZpZWxkcyBhcmUgY2FsY3VsYXRlZCByZWxhdGl2ZSB0byBhIHBvcnRhYmxlIGBEYXRlLm5vdygpYFxuICAgKiB0aW1lc3RhbXAsIGV2ZW4gaWYgYHBlcmZvcm1hbmNlLm5vdygpYCBpcyBhdmFpbGFibGUuXG4gICAqXG4gICAqIFN0YWxlIGVudHJpZXMgYXJlIGFsd2F5cyBpbmNsdWRlZCBpbiB0aGUgYGR1bXBgLCBldmVuIGlmXG4gICAqIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS5hbGxvd1N0YWxlfSBpcyBmYWxzZS5cbiAgICpcbiAgICogTm90ZTogdGhpcyByZXR1cm5zIGFuIGFjdHVhbCBhcnJheSwgbm90IGEgZ2VuZXJhdG9yLCBzbyBpdCBjYW4gYmUgbW9yZVxuICAgKiBlYXNpbHkgcGFzc2VkIGFyb3VuZC5cbiAgICovXG4gIGR1bXAoKSB7XG4gICAgY29uc3QgYXJyOiBbSywgTFJVQ2FjaGUuRW50cnk8Vj5dW10gPSBbXVxuICAgIGZvciAoY29uc3QgaSBvZiB0aGlzLiNpbmRleGVzKHsgYWxsb3dTdGFsZTogdHJ1ZSB9KSkge1xuICAgICAgY29uc3Qga2V5ID0gdGhpcy4ja2V5TGlzdFtpXVxuICAgICAgY29uc3QgdiA9IHRoaXMuI3ZhbExpc3RbaV1cbiAgICAgIGNvbnN0IHZhbHVlOiBWIHwgdW5kZWZpbmVkID1cbiAgICAgICAgdGhpcy4jaXNCYWNrZ3JvdW5kRmV0Y2godikgPyB2Ll9fc3RhbGVXaGlsZUZldGNoaW5nIDogdlxuICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwga2V5ID09PSB1bmRlZmluZWQpIGNvbnRpbnVlXG4gICAgICBjb25zdCBlbnRyeTogTFJVQ2FjaGUuRW50cnk8Vj4gPSB7IHZhbHVlIH1cbiAgICAgIGlmICh0aGlzLiN0dGxzICYmIHRoaXMuI3N0YXJ0cykge1xuICAgICAgICBlbnRyeS50dGwgPSB0aGlzLiN0dGxzW2ldXG4gICAgICAgIC8vIGFsd2F5cyBkdW1wIHRoZSBzdGFydCByZWxhdGl2ZSB0byBhIHBvcnRhYmxlIHRpbWVzdGFtcFxuICAgICAgICAvLyBpdCdzIG9rIGZvciB0aGlzIHRvIGJlIGEgYml0IHNsb3csIGl0J3MgYSByYXJlIG9wZXJhdGlvbi5cbiAgICAgICAgY29uc3QgYWdlID0gdGhpcy4jcGVyZi5ub3coKSAtICh0aGlzLiNzdGFydHNbaV0gYXMgbnVtYmVyKVxuICAgICAgICBlbnRyeS5zdGFydCA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAtIGFnZSlcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLiNzaXplcykge1xuICAgICAgICBlbnRyeS5zaXplID0gdGhpcy4jc2l6ZXNbaV1cbiAgICAgIH1cbiAgICAgIGFyci51bnNoaWZ0KFtrZXksIGVudHJ5XSlcbiAgICB9XG4gICAgcmV0dXJuIGFyclxuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHRoZSBjYWNoZSBhbmQgbG9hZCBpbiB0aGUgaXRlbXMgaW4gZW50cmllcyBpbiB0aGUgb3JkZXIgbGlzdGVkLlxuICAgKlxuICAgKiBUaGUgc2hhcGUgb2YgdGhlIHJlc3VsdGluZyBjYWNoZSBtYXkgYmUgZGlmZmVyZW50IGlmIHRoZSBzYW1lIG9wdGlvbnMgYXJlXG4gICAqIG5vdCB1c2VkIGluIGJvdGggY2FjaGVzLlxuICAgKlxuICAgKiBUaGUgYHN0YXJ0YCBmaWVsZHMgYXJlIGFzc3VtZWQgdG8gYmUgY2FsY3VsYXRlZCByZWxhdGl2ZSB0byBhIHBvcnRhYmxlXG4gICAqIGBEYXRlLm5vdygpYCB0aW1lc3RhbXAsIGV2ZW4gaWYgYHBlcmZvcm1hbmNlLm5vdygpYCBpcyBhdmFpbGFibGUuXG4gICAqL1xuICBsb2FkKGFycjogW0ssIExSVUNhY2hlLkVudHJ5PFY+XVtdKSB7XG4gICAgdGhpcy5jbGVhcigpXG4gICAgZm9yIChjb25zdCBba2V5LCBlbnRyeV0gb2YgYXJyKSB7XG4gICAgICBpZiAoZW50cnkuc3RhcnQpIHtcbiAgICAgICAgLy8gZW50cnkuc3RhcnQgaXMgYSBwb3J0YWJsZSB0aW1lc3RhbXAsIGJ1dCB3ZSBtYXkgYmUgdXNpbmdcbiAgICAgICAgLy8gbm9kZSdzIHBlcmZvcm1hbmNlLm5vdygpLCBzbyBjYWxjdWxhdGUgdGhlIG9mZnNldCwgc28gdGhhdFxuICAgICAgICAvLyB3ZSBnZXQgdGhlIGludGVuZGVkIHJlbWFpbmluZyBUVEwsIG5vIG1hdHRlciBob3cgbG9uZyBpdCdzXG4gICAgICAgIC8vIGJlZW4gb24gaWNlLlxuICAgICAgICAvL1xuICAgICAgICAvLyBpdCdzIG9rIGZvciB0aGlzIHRvIGJlIGEgYml0IHNsb3csIGl0J3MgYSByYXJlIG9wZXJhdGlvbi5cbiAgICAgICAgY29uc3QgYWdlID0gRGF0ZS5ub3coKSAtIGVudHJ5LnN0YXJ0XG4gICAgICAgIGVudHJ5LnN0YXJ0ID0gdGhpcy4jcGVyZi5ub3coKSAtIGFnZVxuICAgICAgfVxuICAgICAgdGhpcy5zZXQoa2V5LCBlbnRyeS52YWx1ZSwgZW50cnkpXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHZhbHVlIHRvIHRoZSBjYWNoZS5cbiAgICpcbiAgICogTm90ZTogaWYgYHVuZGVmaW5lZGAgaXMgc3BlY2lmaWVkIGFzIGEgdmFsdWUsIHRoaXMgaXMgYW4gYWxpYXMgZm9yXG4gICAqIHtAbGluayBMUlVDYWNoZSNkZWxldGV9XG4gICAqXG4gICAqIEZpZWxkcyBvbiB0aGUge0BsaW5rIExSVUNhY2hlLlNldE9wdGlvbnN9IG9wdGlvbnMgcGFyYW0gd2lsbCBvdmVycmlkZVxuICAgKiB0aGVpciBjb3JyZXNwb25kaW5nIHZhbHVlcyBpbiB0aGUgY29uc3RydWN0b3Igb3B0aW9ucyBmb3IgdGhlIHNjb3BlXG4gICAqIG9mIHRoaXMgc2luZ2xlIGBzZXQoKWAgb3BlcmF0aW9uLlxuICAgKlxuICAgKiBJZiBgc3RhcnRgIGlzIHByb3ZpZGVkLCB0aGVuIHRoYXQgd2lsbCBzZXQgdGhlIGVmZmVjdGl2ZSBzdGFydFxuICAgKiB0aW1lIGZvciB0aGUgVFRMIGNhbGN1bGF0aW9uLiBOb3RlIHRoYXQgdGhpcyBtdXN0IGJlIGEgcHJldmlvdXNcbiAgICogdmFsdWUgb2YgYHBlcmZvcm1hbmNlLm5vdygpYCBpZiBzdXBwb3J0ZWQsIG9yIGEgcHJldmlvdXMgdmFsdWUgb2ZcbiAgICogYERhdGUubm93KClgIGlmIG5vdC5cbiAgICpcbiAgICogT3B0aW9ucyBvYmplY3QgbWF5IGFsc28gaW5jbHVkZSBgc2l6ZWAsIHdoaWNoIHdpbGwgcHJldmVudFxuICAgKiBjYWxsaW5nIHRoZSBgc2l6ZUNhbGN1bGF0aW9uYCBmdW5jdGlvbiBhbmQganVzdCB1c2UgdGhlIHNwZWNpZmllZFxuICAgKiBudW1iZXIgaWYgaXQgaXMgYSBwb3NpdGl2ZSBpbnRlZ2VyLCBhbmQgYG5vRGlzcG9zZU9uU2V0YCB3aGljaFxuICAgKiB3aWxsIHByZXZlbnQgY2FsbGluZyBhIGBkaXNwb3NlYCBmdW5jdGlvbiBpbiB0aGUgY2FzZSBvZlxuICAgKiBvdmVyd3JpdGVzLlxuICAgKlxuICAgKiBJZiB0aGUgYHNpemVgIChvciByZXR1cm4gdmFsdWUgb2YgYHNpemVDYWxjdWxhdGlvbmApIGZvciBhIGdpdmVuXG4gICAqIGVudHJ5IGlzIGdyZWF0ZXIgdGhhbiBgbWF4RW50cnlTaXplYCwgdGhlbiB0aGUgaXRlbSB3aWxsIG5vdCBiZVxuICAgKiBhZGRlZCB0byB0aGUgY2FjaGUuXG4gICAqXG4gICAqIFdpbGwgdXBkYXRlIHRoZSByZWNlbmN5IG9mIHRoZSBlbnRyeS5cbiAgICpcbiAgICogSWYgdGhlIHZhbHVlIGlzIGB1bmRlZmluZWRgLCB0aGVuIHRoaXMgaXMgYW4gYWxpYXMgZm9yXG4gICAqIGBjYWNoZS5kZWxldGUoa2V5KWAuIGB1bmRlZmluZWRgIGlzIG5ldmVyIHN0b3JlZCBpbiB0aGUgY2FjaGUuXG4gICAqL1xuICBzZXQoXG4gICAgazogSyxcbiAgICB2OiBWIHwgQmFja2dyb3VuZEZldGNoPFY+IHwgdW5kZWZpbmVkLFxuICAgIHNldE9wdGlvbnM6IExSVUNhY2hlLlNldE9wdGlvbnM8SywgViwgRkM+ID0ge30sXG4gICkge1xuICAgIGlmICh2ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuZGVsZXRlKGspXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cbiAgICBjb25zdCB7XG4gICAgICB0dGwgPSB0aGlzLnR0bCxcbiAgICAgIHN0YXJ0LFxuICAgICAgbm9EaXNwb3NlT25TZXQgPSB0aGlzLm5vRGlzcG9zZU9uU2V0LFxuICAgICAgc2l6ZUNhbGN1bGF0aW9uID0gdGhpcy5zaXplQ2FsY3VsYXRpb24sXG4gICAgICBzdGF0dXMsXG4gICAgfSA9IHNldE9wdGlvbnNcbiAgICBsZXQgeyBub1VwZGF0ZVRUTCA9IHRoaXMubm9VcGRhdGVUVEwgfSA9IHNldE9wdGlvbnNcblxuICAgIGNvbnN0IHNpemUgPSB0aGlzLiNyZXF1aXJlU2l6ZShcbiAgICAgIGssXG4gICAgICB2LFxuICAgICAgc2V0T3B0aW9ucy5zaXplIHx8IDAsXG4gICAgICBzaXplQ2FsY3VsYXRpb24sXG4gICAgKVxuICAgIC8vIGlmIHRoZSBpdGVtIGRvZXNuJ3QgZml0LCBkb24ndCBkbyBhbnl0aGluZ1xuICAgIC8vIE5COiBtYXhFbnRyeVNpemUgc2V0IHRvIG1heFNpemUgYnkgZGVmYXVsdFxuICAgIGlmICh0aGlzLm1heEVudHJ5U2l6ZSAmJiBzaXplID4gdGhpcy5tYXhFbnRyeVNpemUpIHtcbiAgICAgIGlmIChzdGF0dXMpIHtcbiAgICAgICAgc3RhdHVzLnNldCA9ICdtaXNzJ1xuICAgICAgICBzdGF0dXMubWF4RW50cnlTaXplRXhjZWVkZWQgPSB0cnVlXG4gICAgICB9XG4gICAgICAvLyBoYXZlIHRvIGRlbGV0ZSwgaW4gY2FzZSBzb21ldGhpbmcgaXMgdGhlcmUgYWxyZWFkeS5cbiAgICAgIHRoaXMuI2RlbGV0ZShrLCAnc2V0JylcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuICAgIGxldCBpbmRleCA9IHRoaXMuI3NpemUgPT09IDAgPyB1bmRlZmluZWQgOiB0aGlzLiNrZXlNYXAuZ2V0KGspXG4gICAgaWYgKGluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGFkZGl0aW9uXG4gICAgICBpbmRleCA9IChcbiAgICAgICAgdGhpcy4jc2l6ZSA9PT0gMCA/IHRoaXMuI3RhaWxcbiAgICAgICAgOiB0aGlzLiNmcmVlLmxlbmd0aCAhPT0gMCA/IHRoaXMuI2ZyZWUucG9wKClcbiAgICAgICAgOiB0aGlzLiNzaXplID09PSB0aGlzLiNtYXggPyB0aGlzLiNldmljdChmYWxzZSlcbiAgICAgICAgOiB0aGlzLiNzaXplKSBhcyBJbmRleFxuICAgICAgdGhpcy4ja2V5TGlzdFtpbmRleF0gPSBrXG4gICAgICB0aGlzLiN2YWxMaXN0W2luZGV4XSA9IHZcbiAgICAgIHRoaXMuI2tleU1hcC5zZXQoaywgaW5kZXgpXG4gICAgICB0aGlzLiNuZXh0W3RoaXMuI3RhaWxdID0gaW5kZXhcbiAgICAgIHRoaXMuI3ByZXZbaW5kZXhdID0gdGhpcy4jdGFpbFxuICAgICAgdGhpcy4jdGFpbCA9IGluZGV4XG4gICAgICB0aGlzLiNzaXplKytcbiAgICAgIHRoaXMuI2FkZEl0ZW1TaXplKGluZGV4LCBzaXplLCBzdGF0dXMpXG4gICAgICBpZiAoc3RhdHVzKSBzdGF0dXMuc2V0ID0gJ2FkZCdcbiAgICAgIG5vVXBkYXRlVFRMID0gZmFsc2VcbiAgICAgIGlmICh0aGlzLiNoYXNPbkluc2VydCkge1xuICAgICAgICB0aGlzLiNvbkluc2VydD8uKHYgYXMgViwgaywgJ2FkZCcpXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHVwZGF0ZVxuICAgICAgdGhpcy4jbW92ZVRvVGFpbChpbmRleClcbiAgICAgIGNvbnN0IG9sZFZhbCA9IHRoaXMuI3ZhbExpc3RbaW5kZXhdIGFzIFYgfCBCYWNrZ3JvdW5kRmV0Y2g8Vj5cbiAgICAgIGlmICh2ICE9PSBvbGRWYWwpIHtcbiAgICAgICAgaWYgKHRoaXMuI2hhc0ZldGNoTWV0aG9kICYmIHRoaXMuI2lzQmFja2dyb3VuZEZldGNoKG9sZFZhbCkpIHtcbiAgICAgICAgICBvbGRWYWwuX19hYm9ydENvbnRyb2xsZXIuYWJvcnQobmV3IEVycm9yKCdyZXBsYWNlZCcpKVxuICAgICAgICAgIGNvbnN0IHsgX19zdGFsZVdoaWxlRmV0Y2hpbmc6IHMgfSA9IG9sZFZhbFxuICAgICAgICAgIGlmIChzICE9PSB1bmRlZmluZWQgJiYgIW5vRGlzcG9zZU9uU2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy4jaGFzRGlzcG9zZSkge1xuICAgICAgICAgICAgICB0aGlzLiNkaXNwb3NlPy4ocyBhcyBWLCBrLCAnc2V0JylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLiNoYXNEaXNwb3NlQWZ0ZXIpIHtcbiAgICAgICAgICAgICAgdGhpcy4jZGlzcG9zZWQ/LnB1c2goW3MgYXMgViwgaywgJ3NldCddKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghbm9EaXNwb3NlT25TZXQpIHtcbiAgICAgICAgICBpZiAodGhpcy4jaGFzRGlzcG9zZSkge1xuICAgICAgICAgICAgdGhpcy4jZGlzcG9zZT8uKG9sZFZhbCBhcyBWLCBrLCAnc2V0JylcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHRoaXMuI2hhc0Rpc3Bvc2VBZnRlcikge1xuICAgICAgICAgICAgdGhpcy4jZGlzcG9zZWQ/LnB1c2goW29sZFZhbCBhcyBWLCBrLCAnc2V0J10pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuI3JlbW92ZUl0ZW1TaXplKGluZGV4KVxuICAgICAgICB0aGlzLiNhZGRJdGVtU2l6ZShpbmRleCwgc2l6ZSwgc3RhdHVzKVxuICAgICAgICB0aGlzLiN2YWxMaXN0W2luZGV4XSA9IHZcbiAgICAgICAgaWYgKHN0YXR1cykge1xuICAgICAgICAgIHN0YXR1cy5zZXQgPSAncmVwbGFjZSdcbiAgICAgICAgICBjb25zdCBvbGRWYWx1ZSA9XG4gICAgICAgICAgICBvbGRWYWwgJiYgdGhpcy4jaXNCYWNrZ3JvdW5kRmV0Y2gob2xkVmFsKSA/XG4gICAgICAgICAgICAgIG9sZFZhbC5fX3N0YWxlV2hpbGVGZXRjaGluZ1xuICAgICAgICAgICAgOiBvbGRWYWxcbiAgICAgICAgICBpZiAob2xkVmFsdWUgIT09IHVuZGVmaW5lZCkgc3RhdHVzLm9sZFZhbHVlID0gb2xkVmFsdWVcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzdGF0dXMpIHtcbiAgICAgICAgc3RhdHVzLnNldCA9ICd1cGRhdGUnXG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLiNoYXNPbkluc2VydCkge1xuICAgICAgICB0aGlzLm9uSW5zZXJ0Py4oXG4gICAgICAgICAgdiBhcyBWLFxuICAgICAgICAgIGssXG4gICAgICAgICAgdiA9PT0gb2xkVmFsID8gJ3VwZGF0ZScgOiAncmVwbGFjZScsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHR0bCAhPT0gMCAmJiAhdGhpcy4jdHRscykge1xuICAgICAgdGhpcy4jaW5pdGlhbGl6ZVRUTFRyYWNraW5nKClcbiAgICB9XG4gICAgaWYgKHRoaXMuI3R0bHMpIHtcbiAgICAgIGlmICghbm9VcGRhdGVUVEwpIHtcbiAgICAgICAgdGhpcy4jc2V0SXRlbVRUTChpbmRleCwgdHRsLCBzdGFydClcbiAgICAgIH1cbiAgICAgIGlmIChzdGF0dXMpIHRoaXMuI3N0YXR1c1RUTChzdGF0dXMsIGluZGV4KVxuICAgIH1cbiAgICBpZiAoIW5vRGlzcG9zZU9uU2V0ICYmIHRoaXMuI2hhc0Rpc3Bvc2VBZnRlciAmJiB0aGlzLiNkaXNwb3NlZCkge1xuICAgICAgY29uc3QgZHQgPSB0aGlzLiNkaXNwb3NlZFxuICAgICAgbGV0IHRhc2s6IERpc3Bvc2VUYXNrPEssIFY+IHwgdW5kZWZpbmVkXG4gICAgICB3aGlsZSAoKHRhc2sgPSBkdD8uc2hpZnQoKSkpIHtcbiAgICAgICAgdGhpcy4jZGlzcG9zZUFmdGVyPy4oLi4udGFzaylcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmljdCB0aGUgbGVhc3QgcmVjZW50bHkgdXNlZCBpdGVtLCByZXR1cm5pbmcgaXRzIHZhbHVlIG9yXG4gICAqIGB1bmRlZmluZWRgIGlmIGNhY2hlIGlzIGVtcHR5LlxuICAgKi9cbiAgcG9wKCk6IFYgfCB1bmRlZmluZWQge1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAodGhpcy4jc2l6ZSkge1xuICAgICAgICBjb25zdCB2YWwgPSB0aGlzLiN2YWxMaXN0W3RoaXMuI2hlYWRdXG4gICAgICAgIHRoaXMuI2V2aWN0KHRydWUpXG4gICAgICAgIGlmICh0aGlzLiNpc0JhY2tncm91bmRGZXRjaCh2YWwpKSB7XG4gICAgICAgICAgaWYgKHZhbC5fX3N0YWxlV2hpbGVGZXRjaGluZykge1xuICAgICAgICAgICAgcmV0dXJuIHZhbC5fX3N0YWxlV2hpbGVGZXRjaGluZ1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiB2YWxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICBpZiAodGhpcy4jaGFzRGlzcG9zZUFmdGVyICYmIHRoaXMuI2Rpc3Bvc2VkKSB7XG4gICAgICAgIGNvbnN0IGR0ID0gdGhpcy4jZGlzcG9zZWRcbiAgICAgICAgbGV0IHRhc2s6IERpc3Bvc2VUYXNrPEssIFY+IHwgdW5kZWZpbmVkXG4gICAgICAgIHdoaWxlICgodGFzayA9IGR0Py5zaGlmdCgpKSkge1xuICAgICAgICAgIHRoaXMuI2Rpc3Bvc2VBZnRlcj8uKC4uLnRhc2spXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAjZXZpY3QoZnJlZTogYm9vbGVhbikge1xuICAgIGNvbnN0IGhlYWQgPSB0aGlzLiNoZWFkXG4gICAgY29uc3QgayA9IHRoaXMuI2tleUxpc3RbaGVhZF0gYXMgS1xuICAgIGNvbnN0IHYgPSB0aGlzLiN2YWxMaXN0W2hlYWRdIGFzIFZcbiAgICBpZiAodGhpcy4jaGFzRmV0Y2hNZXRob2QgJiYgdGhpcy4jaXNCYWNrZ3JvdW5kRmV0Y2godikpIHtcbiAgICAgIHYuX19hYm9ydENvbnRyb2xsZXIuYWJvcnQobmV3IEVycm9yKCdldmljdGVkJykpXG4gICAgfSBlbHNlIGlmICh0aGlzLiNoYXNEaXNwb3NlIHx8IHRoaXMuI2hhc0Rpc3Bvc2VBZnRlcikge1xuICAgICAgaWYgKHRoaXMuI2hhc0Rpc3Bvc2UpIHtcbiAgICAgICAgdGhpcy4jZGlzcG9zZT8uKHYsIGssICdldmljdCcpXG4gICAgICB9XG4gICAgICBpZiAodGhpcy4jaGFzRGlzcG9zZUFmdGVyKSB7XG4gICAgICAgIHRoaXMuI2Rpc3Bvc2VkPy5wdXNoKFt2LCBrLCAnZXZpY3QnXSlcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy4jcmVtb3ZlSXRlbVNpemUoaGVhZClcbiAgICAvLyBpZiB3ZSBhcmVuJ3QgYWJvdXQgdG8gdXNlIHRoZSBpbmRleCwgdGhlbiBudWxsIHRoZXNlIG91dFxuICAgIGlmIChmcmVlKSB7XG4gICAgICB0aGlzLiNrZXlMaXN0W2hlYWRdID0gdW5kZWZpbmVkXG4gICAgICB0aGlzLiN2YWxMaXN0W2hlYWRdID0gdW5kZWZpbmVkXG4gICAgICB0aGlzLiNmcmVlLnB1c2goaGVhZClcbiAgICB9XG4gICAgaWYgKHRoaXMuI3NpemUgPT09IDEpIHtcbiAgICAgIHRoaXMuI2hlYWQgPSB0aGlzLiN0YWlsID0gMCBhcyBJbmRleFxuICAgICAgdGhpcy4jZnJlZS5sZW5ndGggPSAwXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuI2hlYWQgPSB0aGlzLiNuZXh0W2hlYWRdIGFzIEluZGV4XG4gICAgfVxuICAgIHRoaXMuI2tleU1hcC5kZWxldGUoaylcbiAgICB0aGlzLiNzaXplLS1cbiAgICByZXR1cm4gaGVhZFxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIGEga2V5IGlzIGluIHRoZSBjYWNoZSwgd2l0aG91dCB1cGRhdGluZyB0aGUgcmVjZW5jeSBvZiB1c2UuXG4gICAqIFdpbGwgcmV0dXJuIGZhbHNlIGlmIHRoZSBpdGVtIGlzIHN0YWxlLCBldmVuIHRob3VnaCBpdCBpcyB0ZWNobmljYWxseVxuICAgKiBpbiB0aGUgY2FjaGUuXG4gICAqXG4gICAqIENoZWNrIGlmIGEga2V5IGlzIGluIHRoZSBjYWNoZSwgd2l0aG91dCB1cGRhdGluZyB0aGUgcmVjZW5jeSBvZlxuICAgKiB1c2UuIEFnZSBpcyB1cGRhdGVkIGlmIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS51cGRhdGVBZ2VPbkhhc30gaXMgc2V0XG4gICAqIHRvIGB0cnVlYCBpbiBlaXRoZXIgdGhlIG9wdGlvbnMgb3IgdGhlIGNvbnN0cnVjdG9yLlxuICAgKlxuICAgKiBXaWxsIHJldHVybiBgZmFsc2VgIGlmIHRoZSBpdGVtIGlzIHN0YWxlLCBldmVuIHRob3VnaCBpdCBpcyB0ZWNobmljYWxseSBpblxuICAgKiB0aGUgY2FjaGUuIFRoZSBkaWZmZXJlbmNlIGNhbiBiZSBkZXRlcm1pbmVkIChpZiBpdCBtYXR0ZXJzKSBieSB1c2luZyBhXG4gICAqIGBzdGF0dXNgIGFyZ3VtZW50LCBhbmQgaW5zcGVjdGluZyB0aGUgYGhhc2AgZmllbGQuXG4gICAqXG4gICAqIFdpbGwgbm90IHVwZGF0ZSBpdGVtIGFnZSB1bmxlc3NcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLnVwZGF0ZUFnZU9uSGFzfSBpcyBzZXQuXG4gICAqL1xuICBoYXMoazogSywgaGFzT3B0aW9uczogTFJVQ2FjaGUuSGFzT3B0aW9uczxLLCBWLCBGQz4gPSB7fSkge1xuICAgIGNvbnN0IHsgdXBkYXRlQWdlT25IYXMgPSB0aGlzLnVwZGF0ZUFnZU9uSGFzLCBzdGF0dXMgfSA9XG4gICAgICBoYXNPcHRpb25zXG4gICAgY29uc3QgaW5kZXggPSB0aGlzLiNrZXlNYXAuZ2V0KGspXG4gICAgaWYgKGluZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IHYgPSB0aGlzLiN2YWxMaXN0W2luZGV4XVxuICAgICAgaWYgKFxuICAgICAgICB0aGlzLiNpc0JhY2tncm91bmRGZXRjaCh2KSAmJlxuICAgICAgICB2Ll9fc3RhbGVXaGlsZUZldGNoaW5nID09PSB1bmRlZmluZWRcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy4jaXNTdGFsZShpbmRleCkpIHtcbiAgICAgICAgaWYgKHVwZGF0ZUFnZU9uSGFzKSB7XG4gICAgICAgICAgdGhpcy4jdXBkYXRlSXRlbUFnZShpbmRleClcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzKSB7XG4gICAgICAgICAgc3RhdHVzLmhhcyA9ICdoaXQnXG4gICAgICAgICAgdGhpcy4jc3RhdHVzVFRMKHN0YXR1cywgaW5kZXgpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH0gZWxzZSBpZiAoc3RhdHVzKSB7XG4gICAgICAgIHN0YXR1cy5oYXMgPSAnc3RhbGUnXG4gICAgICAgIHRoaXMuI3N0YXR1c1RUTChzdGF0dXMsIGluZGV4KVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhdHVzKSB7XG4gICAgICBzdGF0dXMuaGFzID0gJ21pc3MnXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgLyoqXG4gICAqIExpa2Uge0BsaW5rIExSVUNhY2hlI2dldH0gYnV0IGRvZXNuJ3QgdXBkYXRlIHJlY2VuY3kgb3IgZGVsZXRlIHN0YWxlXG4gICAqIGl0ZW1zLlxuICAgKlxuICAgKiBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIHRoZSBpdGVtIGlzIHN0YWxlLCB1bmxlc3NcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLmFsbG93U3RhbGV9IGlzIHNldC5cbiAgICovXG4gIHBlZWsoazogSywgcGVla09wdGlvbnM6IExSVUNhY2hlLlBlZWtPcHRpb25zPEssIFYsIEZDPiA9IHt9KSB7XG4gICAgY29uc3QgeyBhbGxvd1N0YWxlID0gdGhpcy5hbGxvd1N0YWxlIH0gPSBwZWVrT3B0aW9uc1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy4ja2V5TWFwLmdldChrKVxuICAgIGlmIChcbiAgICAgIGluZGV4ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICghYWxsb3dTdGFsZSAmJiB0aGlzLiNpc1N0YWxlKGluZGV4KSlcbiAgICApIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBjb25zdCB2ID0gdGhpcy4jdmFsTGlzdFtpbmRleF1cbiAgICAvLyBlaXRoZXIgc3RhbGUgYW5kIGFsbG93ZWQsIG9yIGZvcmNpbmcgYSByZWZyZXNoIG9mIG5vbi1zdGFsZSB2YWx1ZVxuICAgIHJldHVybiB0aGlzLiNpc0JhY2tncm91bmRGZXRjaCh2KSA/IHYuX19zdGFsZVdoaWxlRmV0Y2hpbmcgOiB2XG4gIH1cblxuICAjYmFja2dyb3VuZEZldGNoKFxuICAgIGs6IEssXG4gICAgaW5kZXg6IEluZGV4IHwgdW5kZWZpbmVkLFxuICAgIG9wdGlvbnM6IExSVUNhY2hlLkZldGNoT3B0aW9uczxLLCBWLCBGQz4sXG4gICAgY29udGV4dDogYW55LFxuICApOiBCYWNrZ3JvdW5kRmV0Y2g8Vj4ge1xuICAgIGNvbnN0IHYgPSBpbmRleCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogdGhpcy4jdmFsTGlzdFtpbmRleF1cbiAgICBpZiAodGhpcy4jaXNCYWNrZ3JvdW5kRmV0Y2godikpIHtcbiAgICAgIHJldHVybiB2XG4gICAgfVxuXG4gICAgY29uc3QgYWMgPSBuZXcgQUMoKVxuICAgIGNvbnN0IHsgc2lnbmFsIH0gPSBvcHRpb25zXG4gICAgLy8gd2hlbi9pZiBvdXIgQUMgc2lnbmFscywgdGhlbiBzdG9wIGxpc3RlbmluZyB0byB0aGVpcnMuXG4gICAgc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IGFjLmFib3J0KHNpZ25hbC5yZWFzb24pLCB7XG4gICAgICBzaWduYWw6IGFjLnNpZ25hbCxcbiAgICB9KVxuXG4gICAgY29uc3QgZmV0Y2hPcHRzID0ge1xuICAgICAgc2lnbmFsOiBhYy5zaWduYWwsXG4gICAgICBvcHRpb25zLFxuICAgICAgY29udGV4dCxcbiAgICB9XG5cbiAgICBjb25zdCBjYiA9IChcbiAgICAgIHY6IFYgfCB1bmRlZmluZWQsXG4gICAgICB1cGRhdGVDYWNoZSA9IGZhbHNlLFxuICAgICk6IFYgfCB1bmRlZmluZWQgPT4ge1xuICAgICAgY29uc3QgeyBhYm9ydGVkIH0gPSBhYy5zaWduYWxcbiAgICAgIGNvbnN0IGlnbm9yZUFib3J0ID0gb3B0aW9ucy5pZ25vcmVGZXRjaEFib3J0ICYmIHYgIT09IHVuZGVmaW5lZFxuICAgICAgaWYgKG9wdGlvbnMuc3RhdHVzKSB7XG4gICAgICAgIGlmIChhYm9ydGVkICYmICF1cGRhdGVDYWNoZSkge1xuICAgICAgICAgIG9wdGlvbnMuc3RhdHVzLmZldGNoQWJvcnRlZCA9IHRydWVcbiAgICAgICAgICBvcHRpb25zLnN0YXR1cy5mZXRjaEVycm9yID0gYWMuc2lnbmFsLnJlYXNvblxuICAgICAgICAgIGlmIChpZ25vcmVBYm9ydCkgb3B0aW9ucy5zdGF0dXMuZmV0Y2hBYm9ydElnbm9yZWQgPSB0cnVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3B0aW9ucy5zdGF0dXMuZmV0Y2hSZXNvbHZlZCA9IHRydWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGFib3J0ZWQgJiYgIWlnbm9yZUFib3J0ICYmICF1cGRhdGVDYWNoZSkge1xuICAgICAgICByZXR1cm4gZmV0Y2hGYWlsKGFjLnNpZ25hbC5yZWFzb24pXG4gICAgICB9XG4gICAgICAvLyBlaXRoZXIgd2UgZGlkbid0IGFib3J0LCBhbmQgYXJlIHN0aWxsIGhlcmUsIG9yIHdlIGRpZCwgYW5kIGlnbm9yZWRcbiAgICAgIGNvbnN0IGJmID0gcCBhcyBCYWNrZ3JvdW5kRmV0Y2g8Vj5cbiAgICAgIC8vIGlmIG5vdGhpbmcgZWxzZSBoYXMgYmVlbiB3cml0dGVuIHRoZXJlIGJ1dCB3ZSdyZSBzZXQgdG8gdXBkYXRlIHRoZVxuICAgICAgLy8gY2FjaGUgYW5kIGlnbm9yZSB0aGUgYWJvcnQsIG9yIGlmIGl0J3Mgc3RpbGwgcGVuZGluZyBvbiB0aGlzIHNwZWNpZmljXG4gICAgICAvLyBiYWNrZ3JvdW5kIHJlcXVlc3QsIHRoZW4gd3JpdGUgaXQgdG8gdGhlIGNhY2hlLlxuICAgICAgY29uc3QgdmwgPSB0aGlzLiN2YWxMaXN0W2luZGV4IGFzIEluZGV4XVxuICAgICAgaWYgKHZsID09PSBwIHx8IGlnbm9yZUFib3J0ICYmIHVwZGF0ZUNhY2hlICYmIHZsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHYgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGlmIChiZi5fX3N0YWxlV2hpbGVGZXRjaGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLiN2YWxMaXN0W2luZGV4IGFzIEluZGV4XSA9IGJmLl9fc3RhbGVXaGlsZUZldGNoaW5nXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuI2RlbGV0ZShrLCAnZmV0Y2gnKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAob3B0aW9ucy5zdGF0dXMpIG9wdGlvbnMuc3RhdHVzLmZldGNoVXBkYXRlZCA9IHRydWVcbiAgICAgICAgICB0aGlzLnNldChrLCB2LCBmZXRjaE9wdHMub3B0aW9ucylcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHZcbiAgICB9XG5cbiAgICBjb25zdCBlYiA9IChlcjogYW55KSA9PiB7XG4gICAgICBpZiAob3B0aW9ucy5zdGF0dXMpIHtcbiAgICAgICAgb3B0aW9ucy5zdGF0dXMuZmV0Y2hSZWplY3RlZCA9IHRydWVcbiAgICAgICAgb3B0aW9ucy5zdGF0dXMuZmV0Y2hFcnJvciA9IGVyXG4gICAgICB9XG4gICAgICByZXR1cm4gZmV0Y2hGYWlsKGVyKVxuICAgIH1cblxuICAgIGNvbnN0IGZldGNoRmFpbCA9IChlcjogYW55KTogViB8IHVuZGVmaW5lZCA9PiB7XG4gICAgICBjb25zdCB7IGFib3J0ZWQgfSA9IGFjLnNpZ25hbFxuICAgICAgY29uc3QgYWxsb3dTdGFsZUFib3J0ZWQgPVxuICAgICAgICBhYm9ydGVkICYmIG9wdGlvbnMuYWxsb3dTdGFsZU9uRmV0Y2hBYm9ydFxuICAgICAgY29uc3QgYWxsb3dTdGFsZSA9XG4gICAgICAgIGFsbG93U3RhbGVBYm9ydGVkIHx8IG9wdGlvbnMuYWxsb3dTdGFsZU9uRmV0Y2hSZWplY3Rpb25cbiAgICAgIGNvbnN0IG5vRGVsZXRlID0gYWxsb3dTdGFsZSB8fCBvcHRpb25zLm5vRGVsZXRlT25GZXRjaFJlamVjdGlvblxuICAgICAgY29uc3QgYmYgPSBwIGFzIEJhY2tncm91bmRGZXRjaDxWPlxuICAgICAgaWYgKHRoaXMuI3ZhbExpc3RbaW5kZXggYXMgSW5kZXhdID09PSBwKSB7XG4gICAgICAgIC8vIGlmIHdlIGFsbG93IHN0YWxlIG9uIGZldGNoIHJlamVjdGlvbnMsIHRoZW4gd2UgbmVlZCB0byBlbnN1cmUgdGhhdFxuICAgICAgICAvLyB0aGUgc3RhbGUgdmFsdWUgaXMgbm90IHJlbW92ZWQgZnJvbSB0aGUgY2FjaGUgd2hlbiB0aGUgZmV0Y2ggZmFpbHMuXG4gICAgICAgIGNvbnN0IGRlbCA9ICFub0RlbGV0ZSB8fCBiZi5fX3N0YWxlV2hpbGVGZXRjaGluZyA9PT0gdW5kZWZpbmVkXG4gICAgICAgIGlmIChkZWwpIHtcbiAgICAgICAgICB0aGlzLiNkZWxldGUoaywgJ2ZldGNoJylcbiAgICAgICAgfSBlbHNlIGlmICghYWxsb3dTdGFsZUFib3J0ZWQpIHtcbiAgICAgICAgICAvLyBzdGlsbCByZXBsYWNlIHRoZSAqcHJvbWlzZSogd2l0aCB0aGUgc3RhbGUgdmFsdWUsXG4gICAgICAgICAgLy8gc2luY2Ugd2UgYXJlIGRvbmUgd2l0aCB0aGUgcHJvbWlzZSBhdCB0aGlzIHBvaW50LlxuICAgICAgICAgIC8vIGxlYXZlIGl0IHVudG91Y2hlZCBpZiB3ZSdyZSBzdGlsbCB3YWl0aW5nIGZvciBhblxuICAgICAgICAgIC8vIGFib3J0ZWQgYmFja2dyb3VuZCBmZXRjaCB0aGF0IGhhc24ndCB5ZXQgcmV0dXJuZWQuXG4gICAgICAgICAgdGhpcy4jdmFsTGlzdFtpbmRleCBhcyBJbmRleF0gPSBiZi5fX3N0YWxlV2hpbGVGZXRjaGluZ1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoYWxsb3dTdGFsZSkge1xuICAgICAgICBpZiAob3B0aW9ucy5zdGF0dXMgJiYgYmYuX19zdGFsZVdoaWxlRmV0Y2hpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIG9wdGlvbnMuc3RhdHVzLnJldHVybmVkU3RhbGUgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJmLl9fc3RhbGVXaGlsZUZldGNoaW5nXG4gICAgICB9IGVsc2UgaWYgKGJmLl9fcmV0dXJuZWQgPT09IGJmKSB7XG4gICAgICAgIHRocm93IGVyXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcGNhbGwgPSAoXG4gICAgICByZXM6ICh2OiBWIHwgdW5kZWZpbmVkKSA9PiB2b2lkLFxuICAgICAgcmVqOiAoZTogYW55KSA9PiB2b2lkLFxuICAgICkgPT4ge1xuICAgICAgY29uc3QgZm1wID0gdGhpcy4jZmV0Y2hNZXRob2Q/LihrLCB2LCBmZXRjaE9wdHMpXG4gICAgICBpZiAoZm1wICYmIGZtcCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgZm1wLnRoZW4odiA9PiByZXModiA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogdiksIHJlailcbiAgICAgIH1cbiAgICAgIC8vIGlnbm9yZWQsIHdlIGdvIHVudGlsIHdlIGZpbmlzaCwgcmVnYXJkbGVzcy5cbiAgICAgIC8vIGRlZmVyIGNoZWNrIHVudGlsIHdlIGFyZSBhY3R1YWxseSBhYm9ydGluZyxcbiAgICAgIC8vIHNvIGZldGNoTWV0aG9kIGNhbiBvdmVycmlkZS5cbiAgICAgIGFjLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICFvcHRpb25zLmlnbm9yZUZldGNoQWJvcnQgfHxcbiAgICAgICAgICBvcHRpb25zLmFsbG93U3RhbGVPbkZldGNoQWJvcnRcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmVzKHVuZGVmaW5lZClcbiAgICAgICAgICAvLyB3aGVuIGl0IGV2ZW50dWFsbHkgcmVzb2x2ZXMsIHVwZGF0ZSB0aGUgY2FjaGUuXG4gICAgICAgICAgaWYgKG9wdGlvbnMuYWxsb3dTdGFsZU9uRmV0Y2hBYm9ydCkge1xuICAgICAgICAgICAgcmVzID0gdiA9PiBjYih2LCB0cnVlKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5zdGF0dXMpIG9wdGlvbnMuc3RhdHVzLmZldGNoRGlzcGF0Y2hlZCA9IHRydWVcbiAgICBjb25zdCBwID0gbmV3IFByb21pc2UocGNhbGwpLnRoZW4oY2IsIGViKVxuICAgIGNvbnN0IGJmOiBCYWNrZ3JvdW5kRmV0Y2g8Vj4gPSBPYmplY3QuYXNzaWduKHAsIHtcbiAgICAgIF9fYWJvcnRDb250cm9sbGVyOiBhYyxcbiAgICAgIF9fc3RhbGVXaGlsZUZldGNoaW5nOiB2LFxuICAgICAgX19yZXR1cm5lZDogdW5kZWZpbmVkLFxuICAgIH0pXG5cbiAgICBpZiAoaW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gaW50ZXJuYWwsIGRvbid0IGV4cG9zZSBzdGF0dXMuXG4gICAgICB0aGlzLnNldChrLCBiZiwgeyAuLi5mZXRjaE9wdHMub3B0aW9ucywgc3RhdHVzOiB1bmRlZmluZWQgfSlcbiAgICAgIGluZGV4ID0gdGhpcy4ja2V5TWFwLmdldChrKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiN2YWxMaXN0W2luZGV4XSA9IGJmXG4gICAgfVxuICAgIHJldHVybiBiZlxuICB9XG5cbiAgI2lzQmFja2dyb3VuZEZldGNoKHA6IGFueSk6IHAgaXMgQmFja2dyb3VuZEZldGNoPFY+IHtcbiAgICBpZiAoIXRoaXMuI2hhc0ZldGNoTWV0aG9kKSByZXR1cm4gZmFsc2VcbiAgICBjb25zdCBiID0gcCBhcyBCYWNrZ3JvdW5kRmV0Y2g8Vj5cbiAgICByZXR1cm4gKFxuICAgICAgISFiICYmXG4gICAgICBiIGluc3RhbmNlb2YgUHJvbWlzZSAmJlxuICAgICAgYi5oYXNPd25Qcm9wZXJ0eSgnX19zdGFsZVdoaWxlRmV0Y2hpbmcnKSAmJlxuICAgICAgYi5fX2Fib3J0Q29udHJvbGxlciBpbnN0YW5jZW9mIEFDXG4gICAgKVxuICB9XG5cbiAgLyoqXG4gICAqIE1ha2UgYW4gYXN5bmNocm9ub3VzIGNhY2hlZCBmZXRjaCB1c2luZyB0aGVcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLmZldGNoTWV0aG9kfSBmdW5jdGlvbi5cbiAgICpcbiAgICogSWYgdGhlIHZhbHVlIGlzIGluIHRoZSBjYWNoZSBhbmQgbm90IHN0YWxlLCB0aGVuIHRoZSByZXR1cm5lZFxuICAgKiBQcm9taXNlIHJlc29sdmVzIHRvIHRoZSB2YWx1ZS5cbiAgICpcbiAgICogSWYgbm90IGluIHRoZSBjYWNoZSwgb3IgYmV5b25kIGl0cyBUVEwgc3RhbGVuZXNzLCB0aGVuXG4gICAqIGBmZXRjaE1ldGhvZChrZXksIHN0YWxlVmFsdWUsIHsgb3B0aW9ucywgc2lnbmFsLCBjb250ZXh0IH0pYCBpc1xuICAgKiBjYWxsZWQsIGFuZCB0aGUgdmFsdWUgcmV0dXJuZWQgd2lsbCBiZSBhZGRlZCB0byB0aGUgY2FjaGUgb25jZVxuICAgKiByZXNvbHZlZC5cbiAgICpcbiAgICogSWYgY2FsbGVkIHdpdGggYGFsbG93U3RhbGVgLCBhbmQgYW4gYXN5bmNocm9ub3VzIGZldGNoIGlzXG4gICAqIGN1cnJlbnRseSBpbiBwcm9ncmVzcyB0byByZWxvYWQgYSBzdGFsZSB2YWx1ZSwgdGhlbiB0aGUgZm9ybWVyXG4gICAqIHN0YWxlIHZhbHVlIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAqXG4gICAqIElmIGNhbGxlZCB3aXRoIGBmb3JjZVJlZnJlc2hgLCB0aGVuIHRoZSBjYWNoZWQgaXRlbSB3aWxsIGJlXG4gICAqIHJlLWZldGNoZWQsIGV2ZW4gaWYgaXQgaXMgbm90IHN0YWxlLiBIb3dldmVyLCBpZiBgYWxsb3dTdGFsZWAgaXMgYWxzb1xuICAgKiBzZXQsIHRoZW4gdGhlIG9sZCB2YWx1ZSB3aWxsIHN0aWxsIGJlIHJldHVybmVkLiBUaGlzIGlzIHVzZWZ1bFxuICAgKiBpbiBjYXNlcyB3aGVyZSB5b3Ugd2FudCB0byBmb3JjZSBhIHJlbG9hZCBvZiBhIGNhY2hlZCB2YWx1ZS4gSWZcbiAgICogYSBiYWNrZ3JvdW5kIGZldGNoIGlzIGFscmVhZHkgaW4gcHJvZ3Jlc3MsIHRoZW4gYGZvcmNlUmVmcmVzaGBcbiAgICogaGFzIG5vIGVmZmVjdC5cbiAgICpcbiAgICogSWYgbXVsdGlwbGUgZmV0Y2hlcyBmb3IgdGhlIHNhbWUga2V5IGFyZSBpc3N1ZWQsIHRoZW4gdGhleSB3aWxsIGFsbCBiZVxuICAgKiBjb2FsZXNjZWQgaW50byBhIHNpbmdsZSBjYWxsIHRvIGZldGNoTWV0aG9kLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBtZWFucyB0aGF0IGhhbmRsaW5nIG9wdGlvbnMgc3VjaCBhc1xuICAgKiB7QGxpbmsgTFJVQ2FjaGUuT3B0aW9uc0Jhc2UuYWxsb3dTdGFsZU9uRmV0Y2hBYm9ydH0sXG4gICAqIHtAbGluayBMUlVDYWNoZS5GZXRjaE9wdGlvbnMuc2lnbmFsfSxcbiAgICogYW5kIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS5hbGxvd1N0YWxlT25GZXRjaFJlamVjdGlvbn0gd2lsbCBiZVxuICAgKiBkZXRlcm1pbmVkIGJ5IHRoZSBGSVJTVCBmZXRjaCgpIGNhbGwgZm9yIGEgZ2l2ZW4ga2V5LlxuICAgKlxuICAgKiBUaGlzIGlzIGEga25vd24gKGZpeGFibGUpIHNob3J0Y29taW5nIHdoaWNoIHdpbGwgYmUgYWRkcmVzZWQgb24gd2hlblxuICAgKiBzb21lb25lIGNvbXBsYWlucyBhYm91dCBpdCwgYXMgdGhlIGZpeCB3b3VsZCBpbnZvbHZlIGFkZGVkIGNvbXBsZXhpdHkgYW5kXG4gICAqIG1heSBub3QgYmUgd29ydGggdGhlIGNvc3RzIGZvciB0aGlzIGVkZ2UgY2FzZS5cbiAgICpcbiAgICogSWYge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLmZldGNoTWV0aG9kfSBpcyBub3Qgc3BlY2lmaWVkLCB0aGVuIHRoaXMgaXNcbiAgICogZWZmZWN0aXZlbHkgYW4gYWxpYXMgZm9yIGBQcm9taXNlLnJlc29sdmUoY2FjaGUuZ2V0KGtleSkpYC5cbiAgICpcbiAgICogV2hlbiB0aGUgZmV0Y2ggbWV0aG9kIHJlc29sdmVzIHRvIGEgdmFsdWUsIGlmIHRoZSBmZXRjaCBoYXMgbm90XG4gICAqIGJlZW4gYWJvcnRlZCBkdWUgdG8gZGVsZXRpb24sIGV2aWN0aW9uLCBvciBiZWluZyBvdmVyd3JpdHRlbixcbiAgICogdGhlbiBpdCBpcyBhZGRlZCB0byB0aGUgY2FjaGUgdXNpbmcgdGhlIG9wdGlvbnMgcHJvdmlkZWQuXG4gICAqXG4gICAqIElmIHRoZSBrZXkgaXMgZXZpY3RlZCBvciBkZWxldGVkIGJlZm9yZSB0aGUgYGZldGNoTWV0aG9kYFxuICAgKiByZXNvbHZlcywgdGhlbiB0aGUgQWJvcnRTaWduYWwgcGFzc2VkIHRvIHRoZSBgZmV0Y2hNZXRob2RgIHdpbGxcbiAgICogcmVjZWl2ZSBhbiBgYWJvcnRgIGV2ZW50LCBhbmQgdGhlIHByb21pc2UgcmV0dXJuZWQgYnkgYGZldGNoKClgXG4gICAqIHdpbGwgcmVqZWN0IHdpdGggdGhlIHJlYXNvbiBmb3IgdGhlIGFib3J0LlxuICAgKlxuICAgKiBJZiBhIGBzaWduYWxgIGlzIHBhc3NlZCB0byB0aGUgYGZldGNoKClgIGNhbGwsIHRoZW4gYWJvcnRpbmcgdGhlXG4gICAqIHNpZ25hbCB3aWxsIGFib3J0IHRoZSBmZXRjaCBhbmQgY2F1c2UgdGhlIGBmZXRjaCgpYCBwcm9taXNlIHRvXG4gICAqIHJlamVjdCB3aXRoIHRoZSByZWFzb24gcHJvdmlkZWQuXG4gICAqXG4gICAqICoqU2V0dGluZyBgY29udGV4dGAqKlxuICAgKlxuICAgKiBJZiBhbiBgRkNgIHR5cGUgaXMgc2V0IHRvIGEgdHlwZSBvdGhlciB0aGFuIGB1bmtub3duYCwgYHZvaWRgLCBvclxuICAgKiBgdW5kZWZpbmVkYCBpbiB0aGUge0BsaW5rIExSVUNhY2hlfSBjb25zdHJ1Y3RvciwgdGhlbiBhbGxcbiAgICogY2FsbHMgdG8gYGNhY2hlLmZldGNoKClgIF9tdXN0XyBwcm92aWRlIGEgYGNvbnRleHRgIG9wdGlvbi4gSWZcbiAgICogc2V0IHRvIGB1bmRlZmluZWRgIG9yIGB2b2lkYCwgdGhlbiBjYWxscyB0byBmZXRjaCBfbXVzdCBub3RfXG4gICAqIHByb3ZpZGUgYSBgY29udGV4dGAgb3B0aW9uLlxuICAgKlxuICAgKiBUaGUgYGNvbnRleHRgIHBhcmFtIGFsbG93cyB5b3UgdG8gcHJvdmlkZSBhcmJpdHJhcnkgZGF0YSB0aGF0XG4gICAqIG1pZ2h0IGJlIHJlbGV2YW50IGluIHRoZSBjb3Vyc2Ugb2YgZmV0Y2hpbmcgdGhlIGRhdGEuIEl0IGlzIG9ubHlcbiAgICogcmVsZXZhbnQgZm9yIHRoZSBjb3Vyc2Ugb2YgYSBzaW5nbGUgYGZldGNoKClgIG9wZXJhdGlvbiwgYW5kXG4gICAqIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxuICAgKlxuICAgKiAqKk5vdGU6IGBmZXRjaCgpYCBjYWxscyBhcmUgaW5mbGlnaHQtdW5pcXVlKipcbiAgICpcbiAgICogSWYgeW91IGNhbGwgYGZldGNoKClgIG11bHRpcGxlIHRpbWVzIHdpdGggdGhlIHNhbWUga2V5IHZhbHVlLFxuICAgKiB0aGVuIGV2ZXJ5IGNhbGwgYWZ0ZXIgdGhlIGZpcnN0IHdpbGwgcmVzb2x2ZSBvbiB0aGUgc2FtZVxuICAgKiBwcm9taXNlPHN1cD4xPC9zdXA+LFxuICAgKiBfZXZlbiBpZiB0aGV5IGhhdmUgZGlmZmVyZW50IHNldHRpbmdzIHRoYXQgd291bGQgb3RoZXJ3aXNlIGNoYW5nZVxuICAgKiB0aGUgYmVoYXZpb3Igb2YgdGhlIGZldGNoXywgc3VjaCBhcyBgbm9EZWxldGVPbkZldGNoUmVqZWN0aW9uYFxuICAgKiBvciBgaWdub3JlRmV0Y2hBYm9ydGAuXG4gICAqXG4gICAqIEluIG1vc3QgY2FzZXMsIHRoaXMgaXMgbm90IGEgcHJvYmxlbSAoaW4gZmFjdCwgb25seSBmZXRjaGluZ1xuICAgKiBzb21ldGhpbmcgb25jZSBpcyB3aGF0IHlvdSBwcm9iYWJseSB3YW50LCBpZiB5b3UncmUgY2FjaGluZyBpblxuICAgKiB0aGUgZmlyc3QgcGxhY2UpLiBJZiB5b3UgYXJlIGNoYW5naW5nIHRoZSBmZXRjaCgpIG9wdGlvbnNcbiAgICogZHJhbWF0aWNhbGx5IGJldHdlZW4gcnVucywgdGhlcmUncyBhIGdvb2QgY2hhbmNlIHRoYXQgeW91IG1pZ2h0XG4gICAqIGJlIHRyeWluZyB0byBmaXQgZGl2ZXJnZW50IHNlbWFudGljcyBpbnRvIGEgc2luZ2xlIG9iamVjdCwgYW5kXG4gICAqIHdvdWxkIGJlIGJldHRlciBvZmYgd2l0aCBtdWx0aXBsZSBjYWNoZSBpbnN0YW5jZXMuXG4gICAqXG4gICAqICoqMSoqOiBJZSwgdGhleSdyZSBub3QgdGhlIFwic2FtZSBQcm9taXNlXCIsIGJ1dCB0aGV5IHJlc29sdmUgYXRcbiAgICogdGhlIHNhbWUgdGltZSwgYmVjYXVzZSB0aGV5J3JlIGJvdGggd2FpdGluZyBvbiB0aGUgc2FtZVxuICAgKiB1bmRlcmx5aW5nIGZldGNoTWV0aG9kIHJlc3BvbnNlLlxuICAgKi9cblxuICBmZXRjaChcbiAgICBrOiBLLFxuICAgIGZldGNoT3B0aW9uczogdW5rbm93biBleHRlbmRzIEZDID8gTFJVQ2FjaGUuRmV0Y2hPcHRpb25zPEssIFYsIEZDPlxuICAgIDogRkMgZXh0ZW5kcyB1bmRlZmluZWQgfCB2b2lkID9cbiAgICAgIExSVUNhY2hlLkZldGNoT3B0aW9uc05vQ29udGV4dDxLLCBWPlxuICAgIDogTFJVQ2FjaGUuRmV0Y2hPcHRpb25zV2l0aENvbnRleHQ8SywgViwgRkM+LFxuICApOiBQcm9taXNlPHVuZGVmaW5lZCB8IFY+XG5cbiAgLy8gdGhpcyBvdmVybG9hZCBub3QgYWxsb3dlZCBpZiBjb250ZXh0IGlzIHJlcXVpcmVkXG4gIGZldGNoKFxuICAgIGs6IHVua25vd24gZXh0ZW5kcyBGQyA/IEtcbiAgICA6IEZDIGV4dGVuZHMgdW5kZWZpbmVkIHwgdm9pZCA/IEtcbiAgICA6IG5ldmVyLFxuICAgIGZldGNoT3B0aW9ucz86IHVua25vd24gZXh0ZW5kcyBGQyA/XG4gICAgICBMUlVDYWNoZS5GZXRjaE9wdGlvbnM8SywgViwgRkM+XG4gICAgOiBGQyBleHRlbmRzIHVuZGVmaW5lZCB8IHZvaWQgP1xuICAgICAgTFJVQ2FjaGUuRmV0Y2hPcHRpb25zTm9Db250ZXh0PEssIFY+XG4gICAgOiBuZXZlcixcbiAgKTogUHJvbWlzZTx1bmRlZmluZWQgfCBWPlxuXG4gIGFzeW5jIGZldGNoKFxuICAgIGs6IEssXG4gICAgZmV0Y2hPcHRpb25zOiBMUlVDYWNoZS5GZXRjaE9wdGlvbnM8SywgViwgRkM+ID0ge30sXG4gICk6IFByb21pc2U8dW5kZWZpbmVkIHwgVj4ge1xuICAgIGNvbnN0IHtcbiAgICAgIC8vIGdldCBvcHRpb25zXG4gICAgICBhbGxvd1N0YWxlID0gdGhpcy5hbGxvd1N0YWxlLFxuICAgICAgdXBkYXRlQWdlT25HZXQgPSB0aGlzLnVwZGF0ZUFnZU9uR2V0LFxuICAgICAgbm9EZWxldGVPblN0YWxlR2V0ID0gdGhpcy5ub0RlbGV0ZU9uU3RhbGVHZXQsXG4gICAgICAvLyBzZXQgb3B0aW9uc1xuICAgICAgdHRsID0gdGhpcy50dGwsXG4gICAgICBub0Rpc3Bvc2VPblNldCA9IHRoaXMubm9EaXNwb3NlT25TZXQsXG4gICAgICBzaXplID0gMCxcbiAgICAgIHNpemVDYWxjdWxhdGlvbiA9IHRoaXMuc2l6ZUNhbGN1bGF0aW9uLFxuICAgICAgbm9VcGRhdGVUVEwgPSB0aGlzLm5vVXBkYXRlVFRMLFxuICAgICAgLy8gZmV0Y2ggZXhjbHVzaXZlIG9wdGlvbnNcbiAgICAgIG5vRGVsZXRlT25GZXRjaFJlamVjdGlvbiA9IHRoaXMubm9EZWxldGVPbkZldGNoUmVqZWN0aW9uLFxuICAgICAgYWxsb3dTdGFsZU9uRmV0Y2hSZWplY3Rpb24gPSB0aGlzLmFsbG93U3RhbGVPbkZldGNoUmVqZWN0aW9uLFxuICAgICAgaWdub3JlRmV0Y2hBYm9ydCA9IHRoaXMuaWdub3JlRmV0Y2hBYm9ydCxcbiAgICAgIGFsbG93U3RhbGVPbkZldGNoQWJvcnQgPSB0aGlzLmFsbG93U3RhbGVPbkZldGNoQWJvcnQsXG4gICAgICBjb250ZXh0LFxuICAgICAgZm9yY2VSZWZyZXNoID0gZmFsc2UsXG4gICAgICBzdGF0dXMsXG4gICAgICBzaWduYWwsXG4gICAgfSA9IGZldGNoT3B0aW9uc1xuXG4gICAgaWYgKCF0aGlzLiNoYXNGZXRjaE1ldGhvZCkge1xuICAgICAgaWYgKHN0YXR1cykgc3RhdHVzLmZldGNoID0gJ2dldCdcbiAgICAgIHJldHVybiB0aGlzLmdldChrLCB7XG4gICAgICAgIGFsbG93U3RhbGUsXG4gICAgICAgIHVwZGF0ZUFnZU9uR2V0LFxuICAgICAgICBub0RlbGV0ZU9uU3RhbGVHZXQsXG4gICAgICAgIHN0YXR1cyxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIGFsbG93U3RhbGUsXG4gICAgICB1cGRhdGVBZ2VPbkdldCxcbiAgICAgIG5vRGVsZXRlT25TdGFsZUdldCxcbiAgICAgIHR0bCxcbiAgICAgIG5vRGlzcG9zZU9uU2V0LFxuICAgICAgc2l6ZSxcbiAgICAgIHNpemVDYWxjdWxhdGlvbixcbiAgICAgIG5vVXBkYXRlVFRMLFxuICAgICAgbm9EZWxldGVPbkZldGNoUmVqZWN0aW9uLFxuICAgICAgYWxsb3dTdGFsZU9uRmV0Y2hSZWplY3Rpb24sXG4gICAgICBhbGxvd1N0YWxlT25GZXRjaEFib3J0LFxuICAgICAgaWdub3JlRmV0Y2hBYm9ydCxcbiAgICAgIHN0YXR1cyxcbiAgICAgIHNpZ25hbCxcbiAgICB9XG5cbiAgICBsZXQgaW5kZXggPSB0aGlzLiNrZXlNYXAuZ2V0KGspXG4gICAgaWYgKGluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChzdGF0dXMpIHN0YXR1cy5mZXRjaCA9ICdtaXNzJ1xuICAgICAgY29uc3QgcCA9IHRoaXMuI2JhY2tncm91bmRGZXRjaChrLCBpbmRleCwgb3B0aW9ucywgY29udGV4dClcbiAgICAgIHJldHVybiAocC5fX3JldHVybmVkID0gcClcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW4gY2FjaGUsIG1heWJlIGFscmVhZHkgZmV0Y2hpbmdcbiAgICAgIGNvbnN0IHYgPSB0aGlzLiN2YWxMaXN0W2luZGV4XVxuICAgICAgaWYgKHRoaXMuI2lzQmFja2dyb3VuZEZldGNoKHYpKSB7XG4gICAgICAgIGNvbnN0IHN0YWxlID1cbiAgICAgICAgICBhbGxvd1N0YWxlICYmIHYuX19zdGFsZVdoaWxlRmV0Y2hpbmcgIT09IHVuZGVmaW5lZFxuICAgICAgICBpZiAoc3RhdHVzKSB7XG4gICAgICAgICAgc3RhdHVzLmZldGNoID0gJ2luZmxpZ2h0J1xuICAgICAgICAgIGlmIChzdGFsZSkgc3RhdHVzLnJldHVybmVkU3RhbGUgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN0YWxlID8gdi5fX3N0YWxlV2hpbGVGZXRjaGluZyA6ICh2Ll9fcmV0dXJuZWQgPSB2KVxuICAgICAgfVxuXG4gICAgICAvLyBpZiB3ZSBmb3JjZSBhIHJlZnJlc2gsIHRoYXQgbWVhbnMgZG8gTk9UIHNlcnZlIHRoZSBjYWNoZWQgdmFsdWUsXG4gICAgICAvLyB1bmxlc3Mgd2UgYXJlIGFscmVhZHkgaW4gdGhlIHByb2Nlc3Mgb2YgcmVmcmVzaGluZyB0aGUgY2FjaGUuXG4gICAgICBjb25zdCBpc1N0YWxlID0gdGhpcy4jaXNTdGFsZShpbmRleClcbiAgICAgIGlmICghZm9yY2VSZWZyZXNoICYmICFpc1N0YWxlKSB7XG4gICAgICAgIGlmIChzdGF0dXMpIHN0YXR1cy5mZXRjaCA9ICdoaXQnXG4gICAgICAgIHRoaXMuI21vdmVUb1RhaWwoaW5kZXgpXG4gICAgICAgIGlmICh1cGRhdGVBZ2VPbkdldCkge1xuICAgICAgICAgIHRoaXMuI3VwZGF0ZUl0ZW1BZ2UoaW5kZXgpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXR1cykgdGhpcy4jc3RhdHVzVFRMKHN0YXR1cywgaW5kZXgpXG4gICAgICAgIHJldHVybiB2XG4gICAgICB9XG5cbiAgICAgIC8vIG9rLCBpdCBpcyBzdGFsZSBvciBhIGZvcmNlZCByZWZyZXNoLCBhbmQgbm90IGFscmVhZHkgZmV0Y2hpbmcuXG4gICAgICAvLyByZWZyZXNoIHRoZSBjYWNoZS5cbiAgICAgIGNvbnN0IHAgPSB0aGlzLiNiYWNrZ3JvdW5kRmV0Y2goaywgaW5kZXgsIG9wdGlvbnMsIGNvbnRleHQpXG4gICAgICBjb25zdCBoYXNTdGFsZSA9IHAuX19zdGFsZVdoaWxlRmV0Y2hpbmcgIT09IHVuZGVmaW5lZFxuICAgICAgY29uc3Qgc3RhbGVWYWwgPSBoYXNTdGFsZSAmJiBhbGxvd1N0YWxlXG4gICAgICBpZiAoc3RhdHVzKSB7XG4gICAgICAgIHN0YXR1cy5mZXRjaCA9IGlzU3RhbGUgPyAnc3RhbGUnIDogJ3JlZnJlc2gnXG4gICAgICAgIGlmIChzdGFsZVZhbCAmJiBpc1N0YWxlKSBzdGF0dXMucmV0dXJuZWRTdGFsZSA9IHRydWVcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdGFsZVZhbCA/IHAuX19zdGFsZVdoaWxlRmV0Y2hpbmcgOiAocC5fX3JldHVybmVkID0gcClcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW4gc29tZSBjYXNlcywgYGNhY2hlLmZldGNoKClgIG1heSByZXNvbHZlIHRvIGB1bmRlZmluZWRgLCBlaXRoZXIgYmVjYXVzZVxuICAgKiBhIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZSNmZXRjaE1ldGhvZH0gd2FzIG5vdCBwcm92aWRlZCAodHVybmluZ1xuICAgKiBgY2FjaGUuZmV0Y2goaylgIGludG8ganVzdCBhbiBhc3luYyB3cmFwcGVyIGFyb3VuZCBgY2FjaGUuZ2V0KGspYCkgb3JcbiAgICogYmVjYXVzZSBgaWdub3JlRmV0Y2hBYm9ydGAgd2FzIHNwZWNpZmllZCAoZWl0aGVyIHRvIHRoZSBjb25zdHJ1Y3RvciBvclxuICAgKiBpbiB0aGUge0BsaW5rIExSVUNhY2hlLkZldGNoT3B0aW9uc30pLiBBbHNvLCB0aGVcbiAgICoge0BsaW5rIExSVUNhY2hlLk9wdGlvbnNCYXNlLmZldGNoTWV0aG9kfSBtYXkgcmV0dXJuIGB1bmRlZmluZWRgIG9yIGB2b2lkYCwgbWFraW5nXG4gICAqIHRoZSB0ZXN0IGV2ZW4gbW9yZSBjb21wbGljYXRlZC5cbiAgICpcbiAgICogQmVjYXVzZSBpbmZlcnJpbmcgdGhlIGNhc2VzIHdoZXJlIGB1bmRlZmluZWRgIG1pZ2h0IGJlIHJldHVybmVkIGFyZSBzb1xuICAgKiBjdW1iZXJzb21lLCBidXQgdGVzdGluZyBmb3IgYHVuZGVmaW5lZGAgY2FuIGFsc28gYmUgYW5ub3lpbmcsIHRoaXMgbWV0aG9kXG4gICAqIGNhbiBiZSB1c2VkLCB3aGljaCB3aWxsIHJlamVjdCBpZiBgdGhpcy5mZXRjaCgpYCByZXNvbHZlcyB0byB1bmRlZmluZWQuXG4gICAqL1xuICBmb3JjZUZldGNoKFxuICAgIGs6IEssXG4gICAgZmV0Y2hPcHRpb25zOiB1bmtub3duIGV4dGVuZHMgRkMgPyBMUlVDYWNoZS5GZXRjaE9wdGlvbnM8SywgViwgRkM+XG4gICAgOiBGQyBleHRlbmRzIHVuZGVmaW5lZCB8IHZvaWQgP1xuICAgICAgTFJVQ2FjaGUuRmV0Y2hPcHRpb25zTm9Db250ZXh0PEssIFY+XG4gICAgOiBMUlVDYWNoZS5GZXRjaE9wdGlvbnNXaXRoQ29udGV4dDxLLCBWLCBGQz4sXG4gICk6IFByb21pc2U8Vj5cbiAgLy8gdGhpcyBvdmVybG9hZCBub3QgYWxsb3dlZCBpZiBjb250ZXh0IGlzIHJlcXVpcmVkXG4gIGZvcmNlRmV0Y2goXG4gICAgazogdW5rbm93biBleHRlbmRzIEZDID8gS1xuICAgIDogRkMgZXh0ZW5kcyB1bmRlZmluZWQgfCB2b2lkID8gS1xuICAgIDogbmV2ZXIsXG4gICAgZmV0Y2hPcHRpb25zPzogdW5rbm93biBleHRlbmRzIEZDID9cbiAgICAgIExSVUNhY2hlLkZldGNoT3B0aW9uczxLLCBWLCBGQz5cbiAgICA6IEZDIGV4dGVuZHMgdW5kZWZpbmVkIHwgdm9pZCA/XG4gICAgICBMUlVDYWNoZS5GZXRjaE9wdGlvbnNOb0NvbnRleHQ8SywgVj5cbiAgICA6IG5ldmVyLFxuICApOiBQcm9taXNlPFY+XG4gIGFzeW5jIGZvcmNlRmV0Y2goXG4gICAgazogSyxcbiAgICBmZXRjaE9wdGlvbnM6IExSVUNhY2hlLkZldGNoT3B0aW9uczxLLCBWLCBGQz4gPSB7fSxcbiAgKTogUHJvbWlzZTxWPiB7XG4gICAgY29uc3QgdiA9IGF3YWl0IHRoaXMuZmV0Y2goXG4gICAgICBrLFxuICAgICAgZmV0Y2hPcHRpb25zIGFzIHVua25vd24gZXh0ZW5kcyBGQyA/XG4gICAgICAgIExSVUNhY2hlLkZldGNoT3B0aW9uczxLLCBWLCBGQz5cbiAgICAgIDogRkMgZXh0ZW5kcyB1bmRlZmluZWQgfCB2b2lkID9cbiAgICAgICAgTFJVQ2FjaGUuRmV0Y2hPcHRpb25zTm9Db250ZXh0PEssIFY+XG4gICAgICA6IExSVUNhY2hlLkZldGNoT3B0aW9uc1dpdGhDb250ZXh0PEssIFYsIEZDPixcbiAgICApXG4gICAgaWYgKHYgPT09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEVycm9yKCdmZXRjaCgpIHJldHVybmVkIHVuZGVmaW5lZCcpXG4gICAgcmV0dXJuIHZcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUga2V5IGlzIGZvdW5kIGluIHRoZSBjYWNoZSwgdGhlbiB0aGlzIGlzIGVxdWl2YWxlbnQgdG9cbiAgICoge0BsaW5rIExSVUNhY2hlI2dldH0uIElmIG5vdCwgaW4gdGhlIGNhY2hlLCB0aGVuIGNhbGN1bGF0ZSB0aGUgdmFsdWUgdXNpbmdcbiAgICogdGhlIHtAbGluayBMUlVDYWNoZS5PcHRpb25zQmFzZS5tZW1vTWV0aG9kfSwgYW5kIGFkZCBpdCB0byB0aGUgY2FjaGUuXG4gICAqXG4gICAqIElmIGFuIGBGQ2AgdHlwZSBpcyBzZXQgdG8gYSB0eXBlIG90aGVyIHRoYW4gYHVua25vd25gLCBgdm9pZGAsIG9yXG4gICAqIGB1bmRlZmluZWRgIGluIHRoZSBMUlVDYWNoZSBjb25zdHJ1Y3RvciwgdGhlbiBhbGwgY2FsbHMgdG8gYGNhY2hlLm1lbW8oKWBcbiAgICogX211c3RfIHByb3ZpZGUgYSBgY29udGV4dGAgb3B0aW9uLiBJZiBzZXQgdG8gYHVuZGVmaW5lZGAgb3IgYHZvaWRgLCB0aGVuXG4gICAqIGNhbGxzIHRvIG1lbW8gX211c3Qgbm90XyBwcm92aWRlIGEgYGNvbnRleHRgIG9wdGlvbi5cbiAgICpcbiAgICogVGhlIGBjb250ZXh0YCBwYXJhbSBhbGxvd3MgeW91IHRvIHByb3ZpZGUgYXJiaXRyYXJ5IGRhdGEgdGhhdCBtaWdodCBiZVxuICAgKiByZWxldmFudCBpbiB0aGUgY291cnNlIG9mIGZldGNoaW5nIHRoZSBkYXRhLiBJdCBpcyBvbmx5IHJlbGV2YW50IGZvciB0aGVcbiAgICogY291cnNlIG9mIGEgc2luZ2xlIGBtZW1vKClgIG9wZXJhdGlvbiwgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxuICAgKi9cbiAgbWVtbyhcbiAgICBrOiBLLFxuICAgIG1lbW9PcHRpb25zOiB1bmtub3duIGV4dGVuZHMgRkMgPyBMUlVDYWNoZS5NZW1vT3B0aW9uczxLLCBWLCBGQz5cbiAgICA6IEZDIGV4dGVuZHMgdW5kZWZpbmVkIHwgdm9pZCA/XG4gICAgICBMUlVDYWNoZS5NZW1vT3B0aW9uc05vQ29udGV4dDxLLCBWPlxuICAgIDogTFJVQ2FjaGUuTWVtb09wdGlvbnNXaXRoQ29udGV4dDxLLCBWLCBGQz4sXG4gICk6IFZcbiAgLy8gdGhpcyBvdmVybG9hZCBub3QgYWxsb3dlZCBpZiBjb250ZXh0IGlzIHJlcXVpcmVkXG4gIG1lbW8oXG4gICAgazogdW5rbm93biBleHRlbmRzIEZDID8gS1xuICAgIDogRkMgZXh0ZW5kcyB1bmRlZmluZWQgfCB2b2lkID8gS1xuICAgIDogbmV2ZXIsXG4gICAgbWVtb09wdGlvbnM/OiB1bmtub3duIGV4dGVuZHMgRkMgPyBMUlVDYWNoZS5NZW1vT3B0aW9uczxLLCBWLCBGQz5cbiAgICA6IEZDIGV4dGVuZHMgdW5kZWZpbmVkIHwgdm9pZCA/XG4gICAgICBMUlVDYWNoZS5NZW1vT3B0aW9uc05vQ29udGV4dDxLLCBWPlxuICAgIDogbmV2ZXIsXG4gICk6IFZcbiAgbWVtbyhrOiBLLCBtZW1vT3B0aW9uczogTFJVQ2FjaGUuTWVtb09wdGlvbnM8SywgViwgRkM+ID0ge30pIHtcbiAgICBjb25zdCBtZW1vTWV0aG9kID0gdGhpcy4jbWVtb01ldGhvZFxuICAgIGlmICghbWVtb01ldGhvZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdubyBtZW1vTWV0aG9kIHByb3ZpZGVkIHRvIGNvbnN0cnVjdG9yJylcbiAgICB9XG4gICAgY29uc3QgeyBjb250ZXh0LCBmb3JjZVJlZnJlc2gsIC4uLm9wdGlvbnMgfSA9IG1lbW9PcHRpb25zXG4gICAgY29uc3QgdiA9IHRoaXMuZ2V0KGssIG9wdGlvbnMpXG4gICAgaWYgKCFmb3JjZVJlZnJlc2ggJiYgdiAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdlxuICAgIGNvbnN0IHZ2ID0gbWVtb01ldGhvZChrLCB2LCB7XG4gICAgICBvcHRpb25zLFxuICAgICAgY29udGV4dCxcbiAgICB9IGFzIExSVUNhY2hlLk1lbW9pemVyT3B0aW9uczxLLCBWLCBGQz4pXG4gICAgdGhpcy5zZXQoaywgdnYsIG9wdGlvbnMpXG4gICAgcmV0dXJuIHZ2XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGEgdmFsdWUgZnJvbSB0aGUgY2FjaGUuIFdpbGwgdXBkYXRlIHRoZSByZWNlbmN5IG9mIHRoZSBjYWNoZVxuICAgKiBlbnRyeSBmb3VuZC5cbiAgICpcbiAgICogSWYgdGhlIGtleSBpcyBub3QgZm91bmQsIGdldCgpIHdpbGwgcmV0dXJuIGB1bmRlZmluZWRgLlxuICAgKi9cbiAgZ2V0KGs6IEssIGdldE9wdGlvbnM6IExSVUNhY2hlLkdldE9wdGlvbnM8SywgViwgRkM+ID0ge30pIHtcbiAgICBjb25zdCB7XG4gICAgICBhbGxvd1N0YWxlID0gdGhpcy5hbGxvd1N0YWxlLFxuICAgICAgdXBkYXRlQWdlT25HZXQgPSB0aGlzLnVwZGF0ZUFnZU9uR2V0LFxuICAgICAgbm9EZWxldGVPblN0YWxlR2V0ID0gdGhpcy5ub0RlbGV0ZU9uU3RhbGVHZXQsXG4gICAgICBzdGF0dXMsXG4gICAgfSA9IGdldE9wdGlvbnNcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuI2tleU1hcC5nZXQoaylcbiAgICBpZiAoaW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLiN2YWxMaXN0W2luZGV4XVxuICAgICAgY29uc3QgZmV0Y2hpbmcgPSB0aGlzLiNpc0JhY2tncm91bmRGZXRjaCh2YWx1ZSlcbiAgICAgIGlmIChzdGF0dXMpIHRoaXMuI3N0YXR1c1RUTChzdGF0dXMsIGluZGV4KVxuICAgICAgaWYgKHRoaXMuI2lzU3RhbGUoaW5kZXgpKSB7XG4gICAgICAgIGlmIChzdGF0dXMpIHN0YXR1cy5nZXQgPSAnc3RhbGUnXG4gICAgICAgIC8vIGRlbGV0ZSBvbmx5IGlmIG5vdCBhbiBpbi1mbGlnaHQgYmFja2dyb3VuZCBmZXRjaFxuICAgICAgICBpZiAoIWZldGNoaW5nKSB7XG4gICAgICAgICAgaWYgKCFub0RlbGV0ZU9uU3RhbGVHZXQpIHtcbiAgICAgICAgICAgIHRoaXMuI2RlbGV0ZShrLCAnZXhwaXJlJylcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0YXR1cyAmJiBhbGxvd1N0YWxlKSBzdGF0dXMucmV0dXJuZWRTdGFsZSA9IHRydWVcbiAgICAgICAgICByZXR1cm4gYWxsb3dTdGFsZSA/IHZhbHVlIDogdW5kZWZpbmVkXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgc3RhdHVzICYmXG4gICAgICAgICAgICBhbGxvd1N0YWxlICYmXG4gICAgICAgICAgICB2YWx1ZS5fX3N0YWxlV2hpbGVGZXRjaGluZyAhPT0gdW5kZWZpbmVkXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBzdGF0dXMucmV0dXJuZWRTdGFsZSA9IHRydWVcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGFsbG93U3RhbGUgPyB2YWx1ZS5fX3N0YWxlV2hpbGVGZXRjaGluZyA6IHVuZGVmaW5lZFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoc3RhdHVzKSBzdGF0dXMuZ2V0ID0gJ2hpdCdcbiAgICAgICAgLy8gaWYgd2UncmUgY3VycmVudGx5IGZldGNoaW5nIGl0LCB3ZSBkb24ndCBhY3R1YWxseSBoYXZlIGl0IHlldFxuICAgICAgICAvLyBpdCdzIG5vdCBzdGFsZSwgd2hpY2ggbWVhbnMgdGhpcyBpc24ndCBhIHN0YWxlV2hpbGVSZWZldGNoaW5nLlxuICAgICAgICAvLyBJZiBpdCdzIG5vdCBzdGFsZSwgYW5kIGZldGNoaW5nLCBBTkQgaGFzIGEgX19zdGFsZVdoaWxlRmV0Y2hpbmdcbiAgICAgICAgLy8gdmFsdWUsIHRoZW4gdGhhdCBtZWFucyB0aGUgdXNlciBmZXRjaGVkIHdpdGgge2ZvcmNlUmVmcmVzaDp0cnVlfSxcbiAgICAgICAgLy8gc28gaXQncyBzYWZlIHRvIHJldHVybiB0aGF0IHZhbHVlLlxuICAgICAgICBpZiAoZmV0Y2hpbmcpIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWUuX19zdGFsZVdoaWxlRmV0Y2hpbmdcbiAgICAgICAgfVxuICAgICAgICB0aGlzLiNtb3ZlVG9UYWlsKGluZGV4KVxuICAgICAgICBpZiAodXBkYXRlQWdlT25HZXQpIHtcbiAgICAgICAgICB0aGlzLiN1cGRhdGVJdGVtQWdlKGluZGV4KVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhdHVzKSB7XG4gICAgICBzdGF0dXMuZ2V0ID0gJ21pc3MnXG4gICAgfVxuICB9XG5cbiAgI2Nvbm5lY3QocDogSW5kZXgsIG46IEluZGV4KSB7XG4gICAgdGhpcy4jcHJldltuXSA9IHBcbiAgICB0aGlzLiNuZXh0W3BdID0gblxuICB9XG5cbiAgI21vdmVUb1RhaWwoaW5kZXg6IEluZGV4KTogdm9pZCB7XG4gICAgLy8gaWYgdGFpbCBhbHJlYWR5LCBub3RoaW5nIHRvIGRvXG4gICAgLy8gaWYgaGVhZCwgbW92ZSBoZWFkIHRvIG5leHRbaW5kZXhdXG4gICAgLy8gZWxzZVxuICAgIC8vICAgbW92ZSBuZXh0W3ByZXZbaW5kZXhdXSB0byBuZXh0W2luZGV4XSAoaGVhZCBoYXMgbm8gcHJldilcbiAgICAvLyAgIG1vdmUgcHJldltuZXh0W2luZGV4XV0gdG8gcHJldltpbmRleF1cbiAgICAvLyBwcmV2W2luZGV4XSA9IHRhaWxcbiAgICAvLyBuZXh0W3RhaWxdID0gaW5kZXhcbiAgICAvLyB0YWlsID0gaW5kZXhcbiAgICBpZiAoaW5kZXggIT09IHRoaXMuI3RhaWwpIHtcbiAgICAgIGlmIChpbmRleCA9PT0gdGhpcy4jaGVhZCkge1xuICAgICAgICB0aGlzLiNoZWFkID0gdGhpcy4jbmV4dFtpbmRleF0gYXMgSW5kZXhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuI2Nvbm5lY3QoXG4gICAgICAgICAgdGhpcy4jcHJldltpbmRleF0gYXMgSW5kZXgsXG4gICAgICAgICAgdGhpcy4jbmV4dFtpbmRleF0gYXMgSW5kZXgsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIHRoaXMuI2Nvbm5lY3QodGhpcy4jdGFpbCwgaW5kZXgpXG4gICAgICB0aGlzLiN0YWlsID0gaW5kZXhcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlcyBhIGtleSBvdXQgb2YgdGhlIGNhY2hlLlxuICAgKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGtleSB3YXMgZGVsZXRlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgKi9cbiAgZGVsZXRlKGs6IEspIHtcbiAgICByZXR1cm4gdGhpcy4jZGVsZXRlKGssICdkZWxldGUnKVxuICB9XG5cbiAgI2RlbGV0ZShrOiBLLCByZWFzb246IExSVUNhY2hlLkRpc3Bvc2VSZWFzb24pIHtcbiAgICBsZXQgZGVsZXRlZCA9IGZhbHNlXG4gICAgaWYgKHRoaXMuI3NpemUgIT09IDApIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy4ja2V5TWFwLmdldChrKVxuICAgICAgaWYgKGluZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZGVsZXRlZCA9IHRydWVcbiAgICAgICAgaWYgKHRoaXMuI3NpemUgPT09IDEpIHtcbiAgICAgICAgICB0aGlzLiNjbGVhcihyZWFzb24pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy4jcmVtb3ZlSXRlbVNpemUoaW5kZXgpXG4gICAgICAgICAgY29uc3QgdiA9IHRoaXMuI3ZhbExpc3RbaW5kZXhdXG4gICAgICAgICAgaWYgKHRoaXMuI2lzQmFja2dyb3VuZEZldGNoKHYpKSB7XG4gICAgICAgICAgICB2Ll9fYWJvcnRDb250cm9sbGVyLmFib3J0KG5ldyBFcnJvcignZGVsZXRlZCcpKVxuICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy4jaGFzRGlzcG9zZSB8fCB0aGlzLiNoYXNEaXNwb3NlQWZ0ZXIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLiNoYXNEaXNwb3NlKSB7XG4gICAgICAgICAgICAgIHRoaXMuI2Rpc3Bvc2U/Lih2IGFzIFYsIGssIHJlYXNvbilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLiNoYXNEaXNwb3NlQWZ0ZXIpIHtcbiAgICAgICAgICAgICAgdGhpcy4jZGlzcG9zZWQ/LnB1c2goW3YgYXMgViwgaywgcmVhc29uXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy4ja2V5TWFwLmRlbGV0ZShrKVxuICAgICAgICAgIHRoaXMuI2tleUxpc3RbaW5kZXhdID0gdW5kZWZpbmVkXG4gICAgICAgICAgdGhpcy4jdmFsTGlzdFtpbmRleF0gPSB1bmRlZmluZWRcbiAgICAgICAgICBpZiAoaW5kZXggPT09IHRoaXMuI3RhaWwpIHtcbiAgICAgICAgICAgIHRoaXMuI3RhaWwgPSB0aGlzLiNwcmV2W2luZGV4XSBhcyBJbmRleFxuICAgICAgICAgIH0gZWxzZSBpZiAoaW5kZXggPT09IHRoaXMuI2hlYWQpIHtcbiAgICAgICAgICAgIHRoaXMuI2hlYWQgPSB0aGlzLiNuZXh0W2luZGV4XSBhcyBJbmRleFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwaSA9IHRoaXMuI3ByZXZbaW5kZXhdIGFzIG51bWJlclxuICAgICAgICAgICAgdGhpcy4jbmV4dFtwaV0gPSB0aGlzLiNuZXh0W2luZGV4XSBhcyBudW1iZXJcbiAgICAgICAgICAgIGNvbnN0IG5pID0gdGhpcy4jbmV4dFtpbmRleF0gYXMgbnVtYmVyXG4gICAgICAgICAgICB0aGlzLiNwcmV2W25pXSA9IHRoaXMuI3ByZXZbaW5kZXhdIGFzIG51bWJlclxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLiNzaXplLS1cbiAgICAgICAgICB0aGlzLiNmcmVlLnB1c2goaW5kZXgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuI2hhc0Rpc3Bvc2VBZnRlciAmJiB0aGlzLiNkaXNwb3NlZD8ubGVuZ3RoKSB7XG4gICAgICBjb25zdCBkdCA9IHRoaXMuI2Rpc3Bvc2VkXG4gICAgICBsZXQgdGFzazogRGlzcG9zZVRhc2s8SywgVj4gfCB1bmRlZmluZWRcbiAgICAgIHdoaWxlICgodGFzayA9IGR0Py5zaGlmdCgpKSkge1xuICAgICAgICB0aGlzLiNkaXNwb3NlQWZ0ZXI/LiguLi50YXNrKVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVsZXRlZFxuICB9XG5cbiAgLyoqXG4gICAqIENsZWFyIHRoZSBjYWNoZSBlbnRpcmVseSwgdGhyb3dpbmcgYXdheSBhbGwgdmFsdWVzLlxuICAgKi9cbiAgY2xlYXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2NsZWFyKCdkZWxldGUnKVxuICB9XG4gICNjbGVhcihyZWFzb246IExSVUNhY2hlLkRpc3Bvc2VSZWFzb24pIHtcbiAgICBmb3IgKGNvbnN0IGluZGV4IG9mIHRoaXMuI3JpbmRleGVzKHsgYWxsb3dTdGFsZTogdHJ1ZSB9KSkge1xuICAgICAgY29uc3QgdiA9IHRoaXMuI3ZhbExpc3RbaW5kZXhdXG4gICAgICBpZiAodGhpcy4jaXNCYWNrZ3JvdW5kRmV0Y2godikpIHtcbiAgICAgICAgdi5fX2Fib3J0Q29udHJvbGxlci5hYm9ydChuZXcgRXJyb3IoJ2RlbGV0ZWQnKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGsgPSB0aGlzLiNrZXlMaXN0W2luZGV4XVxuICAgICAgICBpZiAodGhpcy4jaGFzRGlzcG9zZSkge1xuICAgICAgICAgIHRoaXMuI2Rpc3Bvc2U/Lih2IGFzIFYsIGsgYXMgSywgcmVhc29uKVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLiNoYXNEaXNwb3NlQWZ0ZXIpIHtcbiAgICAgICAgICB0aGlzLiNkaXNwb3NlZD8ucHVzaChbdiBhcyBWLCBrIGFzIEssIHJlYXNvbl0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLiNrZXlNYXAuY2xlYXIoKVxuICAgIHRoaXMuI3ZhbExpc3QuZmlsbCh1bmRlZmluZWQpXG4gICAgdGhpcy4ja2V5TGlzdC5maWxsKHVuZGVmaW5lZClcbiAgICBpZiAodGhpcy4jdHRscyAmJiB0aGlzLiNzdGFydHMpIHtcbiAgICAgIHRoaXMuI3R0bHMuZmlsbCgwKVxuICAgICAgdGhpcy4jc3RhcnRzLmZpbGwoMClcbiAgICB9XG4gICAgaWYgKHRoaXMuI3NpemVzKSB7XG4gICAgICB0aGlzLiNzaXplcy5maWxsKDApXG4gICAgfVxuICAgIHRoaXMuI2hlYWQgPSAwIGFzIEluZGV4XG4gICAgdGhpcy4jdGFpbCA9IDAgYXMgSW5kZXhcbiAgICB0aGlzLiNmcmVlLmxlbmd0aCA9IDBcbiAgICB0aGlzLiNjYWxjdWxhdGVkU2l6ZSA9IDBcbiAgICB0aGlzLiNzaXplID0gMFxuICAgIGlmICh0aGlzLiNoYXNEaXNwb3NlQWZ0ZXIgJiYgdGhpcy4jZGlzcG9zZWQpIHtcbiAgICAgIGNvbnN0IGR0ID0gdGhpcy4jZGlzcG9zZWRcbiAgICAgIGxldCB0YXNrOiBEaXNwb3NlVGFzazxLLCBWPiB8IHVuZGVmaW5lZFxuICAgICAgd2hpbGUgKCh0YXNrID0gZHQ/LnNoaWZ0KCkpKSB7XG4gICAgICAgIHRoaXMuI2Rpc3Bvc2VBZnRlcj8uKC4uLnRhc2spXG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgTFJVQ2FjaGUgfSBmcm9tICdscnUtY2FjaGUnXG5pbXBvcnQgeyBwb3NpeCwgd2luMzIgfSBmcm9tICdub2RlOnBhdGgnXG5cbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCdcblxuaW1wb3J0IHtcbiAgbHN0YXRTeW5jLFxuICByZWFkZGlyIGFzIHJlYWRkaXJDQixcbiAgcmVhZGRpclN5bmMsXG4gIHJlYWRsaW5rU3luYyxcbiAgcmVhbHBhdGhTeW5jIGFzIHJwcyxcbn0gZnJvbSAnZnMnXG5pbXBvcnQgKiBhcyBhY3R1YWxGUyBmcm9tICdub2RlOmZzJ1xuXG5jb25zdCByZWFscGF0aFN5bmMgPSBycHMubmF0aXZlXG4vLyBUT0RPOiB0ZXN0IHBlcmYgb2YgZnMvcHJvbWlzZXMgcmVhbHBhdGggdnMgcmVhbHBhdGhDQixcbi8vIHNpbmNlIHRoZSBwcm9taXNlcyBvbmUgdXNlcyByZWFscGF0aC5uYXRpdmVcblxuaW1wb3J0IHsgbHN0YXQsIHJlYWRkaXIsIHJlYWRsaW5rLCByZWFscGF0aCB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnXG5cbmltcG9ydCB7IE1pbmlwYXNzIH0gZnJvbSAnbWluaXBhc3MnXG5pbXBvcnQgdHlwZSB7IERpcmVudCwgU3RhdHMgfSBmcm9tICdub2RlOmZzJ1xuXG4vKipcbiAqIEFuIG9iamVjdCB0aGF0IHdpbGwgYmUgdXNlZCB0byBvdmVycmlkZSB0aGUgZGVmYXVsdCBgZnNgXG4gKiBtZXRob2RzLiAgQW55IG1ldGhvZHMgdGhhdCBhcmUgbm90IG92ZXJyaWRkZW4gd2lsbCB1c2UgTm9kZSdzXG4gKiBidWlsdC1pbiBpbXBsZW1lbnRhdGlvbnMuXG4gKlxuICogLSBsc3RhdFN5bmNcbiAqIC0gcmVhZGRpciAoY2FsbGJhY2sgYHdpdGhGaWxlVHlwZXNgIERpcmVudCB2YXJpYW50LCB1c2VkIGZvclxuICogICByZWFkZGlyQ0IgYW5kIG1vc3Qgd2Fsa3MpXG4gKiAtIHJlYWRkaXJTeW5jXG4gKiAtIHJlYWRsaW5rU3luY1xuICogLSByZWFscGF0aFN5bmNcbiAqIC0gcHJvbWlzZXM6IE9iamVjdCBjb250YWluaW5nIHRoZSBmb2xsb3dpbmcgYXN5bmMgbWV0aG9kczpcbiAqICAgLSBsc3RhdFxuICogICAtIHJlYWRkaXIgKERpcmVudCB2YXJpYW50IG9ubHkpXG4gKiAgIC0gcmVhZGxpbmtcbiAqICAgLSByZWFscGF0aFxuICovXG5leHBvcnQgaW50ZXJmYWNlIEZTT3B0aW9uIHtcbiAgbHN0YXRTeW5jPzogKHBhdGg6IHN0cmluZykgPT4gU3RhdHNcbiAgcmVhZGRpcj86IChcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgb3B0aW9uczogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0sXG4gICAgY2I6IChlcjogTm9kZUpTLkVycm5vRXhjZXB0aW9uIHwgbnVsbCwgZW50cmllcz86IERpcmVudFtdKSA9PiBhbnksXG4gICkgPT4gdm9pZFxuICByZWFkZGlyU3luYz86IChcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgb3B0aW9uczogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0sXG4gICkgPT4gRGlyZW50W11cbiAgcmVhZGxpbmtTeW5jPzogKHBhdGg6IHN0cmluZykgPT4gc3RyaW5nXG4gIHJlYWxwYXRoU3luYz86IChwYXRoOiBzdHJpbmcpID0+IHN0cmluZ1xuICBwcm9taXNlcz86IHtcbiAgICBsc3RhdD86IChwYXRoOiBzdHJpbmcpID0+IFByb21pc2U8U3RhdHM+XG4gICAgcmVhZGRpcj86IChcbiAgICAgIHBhdGg6IHN0cmluZyxcbiAgICAgIG9wdGlvbnM6IHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9LFxuICAgICkgPT4gUHJvbWlzZTxEaXJlbnRbXT5cbiAgICByZWFkbGluaz86IChwYXRoOiBzdHJpbmcpID0+IFByb21pc2U8c3RyaW5nPlxuICAgIHJlYWxwYXRoPzogKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+XG4gICAgW2s6IHN0cmluZ106IGFueVxuICB9XG4gIFtrOiBzdHJpbmddOiBhbnlcbn1cblxuaW50ZXJmYWNlIEZTVmFsdWUge1xuICBsc3RhdFN5bmM6IChwYXRoOiBzdHJpbmcpID0+IFN0YXRzXG4gIHJlYWRkaXI6IChcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgb3B0aW9uczogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0sXG4gICAgY2I6IChlcjogTm9kZUpTLkVycm5vRXhjZXB0aW9uIHwgbnVsbCwgZW50cmllcz86IERpcmVudFtdKSA9PiBhbnksXG4gICkgPT4gdm9pZFxuICByZWFkZGlyU3luYzogKHBhdGg6IHN0cmluZywgb3B0aW9uczogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pID0+IERpcmVudFtdXG4gIHJlYWRsaW5rU3luYzogKHBhdGg6IHN0cmluZykgPT4gc3RyaW5nXG4gIHJlYWxwYXRoU3luYzogKHBhdGg6IHN0cmluZykgPT4gc3RyaW5nXG4gIHByb21pc2VzOiB7XG4gICAgbHN0YXQ6IChwYXRoOiBzdHJpbmcpID0+IFByb21pc2U8U3RhdHM+XG4gICAgcmVhZGRpcjogKFxuICAgICAgcGF0aDogc3RyaW5nLFxuICAgICAgb3B0aW9uczogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0sXG4gICAgKSA9PiBQcm9taXNlPERpcmVudFtdPlxuICAgIHJlYWRsaW5rOiAocGF0aDogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZz5cbiAgICByZWFscGF0aDogKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+XG4gICAgW2s6IHN0cmluZ106IGFueVxuICB9XG4gIFtrOiBzdHJpbmddOiBhbnlcbn1cblxuY29uc3QgZGVmYXVsdEZTOiBGU1ZhbHVlID0ge1xuICBsc3RhdFN5bmMsXG4gIHJlYWRkaXI6IHJlYWRkaXJDQixcbiAgcmVhZGRpclN5bmMsXG4gIHJlYWRsaW5rU3luYyxcbiAgcmVhbHBhdGhTeW5jLFxuICBwcm9taXNlczoge1xuICAgIGxzdGF0LFxuICAgIHJlYWRkaXIsXG4gICAgcmVhZGxpbmssXG4gICAgcmVhbHBhdGgsXG4gIH0sXG59XG5cbi8vIGlmIHRoZXkganVzdCBnYXZlIHVzIHJlcXVpcmUoJ2ZzJykgdGhlbiB1c2Ugb3VyIGRlZmF1bHRcbmNvbnN0IGZzRnJvbU9wdGlvbiA9IChmc09wdGlvbj86IEZTT3B0aW9uKTogRlNWYWx1ZSA9PlxuICAhZnNPcHRpb24gfHwgZnNPcHRpb24gPT09IGRlZmF1bHRGUyB8fCBmc09wdGlvbiA9PT0gYWN0dWFsRlMgP1xuICAgIGRlZmF1bHRGU1xuICA6IHtcbiAgICAgIC4uLmRlZmF1bHRGUyxcbiAgICAgIC4uLmZzT3B0aW9uLFxuICAgICAgcHJvbWlzZXM6IHtcbiAgICAgICAgLi4uZGVmYXVsdEZTLnByb21pc2VzLFxuICAgICAgICAuLi4oZnNPcHRpb24ucHJvbWlzZXMgfHwge30pLFxuICAgICAgfSxcbiAgICB9XG5cbi8vIHR1cm4gc29tZXRoaW5nIGxpa2UgLy8/L2M6LyBpbnRvIGM6XFxcbmNvbnN0IHVuY0RyaXZlUmVnZXhwID0gL15cXFxcXFxcXFxcP1xcXFwoW2Etel06KVxcXFw/JC9pXG5jb25zdCB1bmNUb0RyaXZlID0gKHJvb3RQYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cbiAgcm9vdFBhdGgucmVwbGFjZSgvXFwvL2csICdcXFxcJykucmVwbGFjZSh1bmNEcml2ZVJlZ2V4cCwgJyQxXFxcXCcpXG5cbi8vIHdpbmRvd3MgcGF0aHMgYXJlIHNlcGFyYXRlZCBieSBlaXRoZXIgLyBvciBcXFxuY29uc3QgZWl0aGVyU2VwID0gL1tcXFxcXFwvXS9cblxuY29uc3QgVU5LTk9XTiA9IDAgLy8gbWF5IG5vdCBldmVuIGV4aXN0LCBmb3IgYWxsIHdlIGtub3dcbmNvbnN0IElGSUZPID0gMGIwMDAxXG5jb25zdCBJRkNIUiA9IDBiMDAxMFxuY29uc3QgSUZESVIgPSAwYjAxMDBcbmNvbnN0IElGQkxLID0gMGIwMTEwXG5jb25zdCBJRlJFRyA9IDBiMTAwMFxuY29uc3QgSUZMTksgPSAwYjEwMTBcbmNvbnN0IElGU09DSyA9IDBiMTEwMFxuY29uc3QgSUZNVCA9IDBiMTExMVxuXG5leHBvcnQgdHlwZSBUeXBlID1cbiAgfCAnVW5rbm93bidcbiAgfCAnRklGTydcbiAgfCAnQ2hhcmFjdGVyRGV2aWNlJ1xuICB8ICdEaXJlY3RvcnknXG4gIHwgJ0Jsb2NrRGV2aWNlJ1xuICB8ICdGaWxlJ1xuICB8ICdTeW1ib2xpY0xpbmsnXG4gIHwgJ1NvY2tldCdcblxuLy8gbWFzayB0byB1bnNldCBsb3cgNCBiaXRzXG5jb25zdCBJRk1UX1VOS05PV04gPSB+SUZNVFxuXG4vLyBzZXQgYWZ0ZXIgc3VjY2Vzc2Z1bGx5IGNhbGxpbmcgcmVhZGRpcigpIGFuZCBnZXR0aW5nIGVudHJpZXMuXG5jb25zdCBSRUFERElSX0NBTExFRCA9IDBiMDAwMF8wMDAxXzAwMDBcbi8vIHNldCBhZnRlciBhIHN1Y2Nlc3NmdWwgbHN0YXQoKVxuY29uc3QgTFNUQVRfQ0FMTEVEID0gMGIwMDAwXzAwMTBfMDAwMFxuLy8gc2V0IGlmIGFuIGVudHJ5IChvciBvbmUgb2YgaXRzIHBhcmVudHMpIGlzIGRlZmluaXRlbHkgbm90IGEgZGlyXG5jb25zdCBFTk9URElSID0gMGIwMDAwXzAxMDBfMDAwMFxuLy8gc2V0IGlmIGFuIGVudHJ5IChvciBvbmUgb2YgaXRzIHBhcmVudHMpIGRvZXMgbm90IGV4aXN0XG4vLyAoY2FuIGFsc28gYmUgc2V0IG9uIGxzdGF0IGVycm9ycyBsaWtlIEVBQ0NFUyBvciBFTkFNRVRPT0xPTkcpXG5jb25zdCBFTk9FTlQgPSAwYjAwMDBfMTAwMF8wMDAwXG4vLyBjYW5ub3QgaGF2ZSBjaGlsZCBlbnRyaWVzIC0tIGFsc28gdmVyaWZ5ICZJRk1UIGlzIGVpdGhlciBJRkRJUiBvciBJRkxOS1xuLy8gc2V0IGlmIHdlIGZhaWwgdG8gcmVhZGxpbmtcbmNvbnN0IEVOT1JFQURMSU5LID0gMGIwMDAxXzAwMDBfMDAwMFxuLy8gc2V0IGlmIHdlIGtub3cgcmVhbHBhdGgoKSB3aWxsIGZhaWxcbmNvbnN0IEVOT1JFQUxQQVRIID0gMGIwMDEwXzAwMDBfMDAwMFxuXG5jb25zdCBFTk9DSElMRCA9IEVOT1RESVIgfCBFTk9FTlQgfCBFTk9SRUFMUEFUSFxuY29uc3QgVFlQRU1BU0sgPSAwYjAwMTFfMTExMV8xMTExXG5cbmNvbnN0IGVudFRvVHlwZSA9IChzOiBEaXJlbnQgfCBTdGF0cykgPT5cbiAgcy5pc0ZpbGUoKSA/IElGUkVHXG4gIDogcy5pc0RpcmVjdG9yeSgpID8gSUZESVJcbiAgOiBzLmlzU3ltYm9saWNMaW5rKCkgPyBJRkxOS1xuICA6IHMuaXNDaGFyYWN0ZXJEZXZpY2UoKSA/IElGQ0hSXG4gIDogcy5pc0Jsb2NrRGV2aWNlKCkgPyBJRkJMS1xuICA6IHMuaXNTb2NrZXQoKSA/IElGU09DS1xuICA6IHMuaXNGSUZPKCkgPyBJRklGT1xuICA6IFVOS05PV05cblxuLy8gbm9ybWFsaXplIHVuaWNvZGUgcGF0aCBuYW1lc1xuY29uc3Qgbm9ybWFsaXplQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpXG5jb25zdCBub3JtYWxpemUgPSAoczogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGMgPSBub3JtYWxpemVDYWNoZS5nZXQocylcbiAgaWYgKGMpIHJldHVybiBjXG4gIGNvbnN0IG4gPSBzLm5vcm1hbGl6ZSgnTkZLRCcpXG4gIG5vcm1hbGl6ZUNhY2hlLnNldChzLCBuKVxuICByZXR1cm4gblxufVxuXG5jb25zdCBub3JtYWxpemVOb2Nhc2VDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KClcbmNvbnN0IG5vcm1hbGl6ZU5vY2FzZSA9IChzOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgYyA9IG5vcm1hbGl6ZU5vY2FzZUNhY2hlLmdldChzKVxuICBpZiAoYykgcmV0dXJuIGNcbiAgY29uc3QgbiA9IG5vcm1hbGl6ZShzLnRvTG93ZXJDYXNlKCkpXG4gIG5vcm1hbGl6ZU5vY2FzZUNhY2hlLnNldChzLCBuKVxuICByZXR1cm4gblxufVxuXG4vKipcbiAqIE9wdGlvbnMgdGhhdCBtYXkgYmUgcHJvdmlkZWQgdG8gdGhlIFBhdGggY29uc3RydWN0b3JcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXRoT3B0cyB7XG4gIGZ1bGxwYXRoPzogc3RyaW5nXG4gIHJlbGF0aXZlPzogc3RyaW5nXG4gIHJlbGF0aXZlUG9zaXg/OiBzdHJpbmdcbiAgcGFyZW50PzogUGF0aEJhc2VcbiAgLyoqXG4gICAqIFNlZSB7QGxpbmsgRlNPcHRpb259XG4gICAqL1xuICBmcz86IEZTT3B0aW9uXG59XG5cbi8qKlxuICogQW4gTFJVQ2FjaGUgZm9yIHN0b3JpbmcgcmVzb2x2ZWQgcGF0aCBzdHJpbmdzIG9yIFBhdGggb2JqZWN0cy5cbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgY2xhc3MgUmVzb2x2ZUNhY2hlIGV4dGVuZHMgTFJVQ2FjaGU8c3RyaW5nLCBzdHJpbmc+IHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoeyBtYXg6IDI1NiB9KVxuICB9XG59XG5cbi8vIEluIG9yZGVyIHRvIHByZXZlbnQgYmxvd2luZyBvdXQgdGhlIGpzIGhlYXAgYnkgYWxsb2NhdGluZyBodW5kcmVkcyBvZlxuLy8gdGhvdXNhbmRzIG9mIFBhdGggZW50cmllcyB3aGVuIHdhbGtpbmcgZXh0cmVtZWx5IGxhcmdlIHRyZWVzLCB0aGUgXCJjaGlsZHJlblwiXG4vLyBpbiB0aGlzIHRyZWUgYXJlIHJlcHJlc2VudGVkIGJ5IHN0b3JpbmcgYW4gYXJyYXkgb2YgUGF0aCBlbnRyaWVzIGluIGFuXG4vLyBMUlVDYWNoZSwgaW5kZXhlZCBieSB0aGUgcGFyZW50LiAgQXQgYW55IHRpbWUsIFBhdGguY2hpbGRyZW4oKSBtYXkgcmV0dXJuIGFuXG4vLyBlbXB0eSBhcnJheSwgaW5kaWNhdGluZyB0aGF0IGl0IGRvZXNuJ3Qga25vdyBhYm91dCBhbnkgb2YgaXRzIGNoaWxkcmVuLCBhbmRcbi8vIHRodXMgaGFzIHRvIHJlYnVpbGQgdGhhdCBjYWNoZS4gIFRoaXMgaXMgZmluZSwgaXQganVzdCBtZWFucyB0aGF0IHdlIGRvbid0XG4vLyBiZW5lZml0IGFzIG11Y2ggZnJvbSBoYXZpbmcgdGhlIGNhY2hlZCBlbnRyaWVzLCBidXQgaHVnZSBkaXJlY3Rvcnkgd2Fsa3Ncbi8vIGRvbid0IGJsb3cgb3V0IHRoZSBzdGFjaywgYW5kIHNtYWxsZXIgb25lcyBhcmUgc3RpbGwgYXMgZmFzdCBhcyBwb3NzaWJsZS5cbi8vXG4vL0l0IGRvZXMgaW1wb3NlIHNvbWUgY29tcGxleGl0eSB3aGVuIGJ1aWxkaW5nIHVwIHRoZSByZWFkZGlyIGRhdGEsIGJlY2F1c2Ugd2Vcbi8vbmVlZCB0byBwYXNzIGEgcmVmZXJlbmNlIHRvIHRoZSBjaGlsZHJlbiBhcnJheSB0aGF0IHdlIHN0YXJ0ZWQgd2l0aC5cblxuLyoqXG4gKiBhbiBMUlVDYWNoZSBmb3Igc3RvcmluZyBjaGlsZCBlbnRyaWVzLlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCBjbGFzcyBDaGlsZHJlbkNhY2hlIGV4dGVuZHMgTFJVQ2FjaGU8UGF0aEJhc2UsIENoaWxkcmVuPiB7XG4gIGNvbnN0cnVjdG9yKG1heFNpemU6IG51bWJlciA9IDE2ICogMTAyNCkge1xuICAgIHN1cGVyKHtcbiAgICAgIG1heFNpemUsXG4gICAgICAvLyBwYXJlbnQgKyBjaGlsZHJlblxuICAgICAgc2l6ZUNhbGN1bGF0aW9uOiBhID0+IGEubGVuZ3RoICsgMSxcbiAgICB9KVxuICB9XG59XG5cbi8qKlxuICogQXJyYXkgb2YgUGF0aCBvYmplY3RzLCBwbHVzIGEgbWFya2VyIGluZGljYXRpbmcgdGhlIGZpcnN0IHByb3Zpc2lvbmFsIGVudHJ5XG4gKlxuICogQGludGVybmFsXG4gKi9cbmV4cG9ydCB0eXBlIENoaWxkcmVuID0gUGF0aEJhc2VbXSAmIHsgcHJvdmlzaW9uYWw6IG51bWJlciB9XG5cbmNvbnN0IHNldEFzQ3dkID0gU3ltYm9sKCdQYXRoU2N1cnJ5IHNldEFzQ3dkJylcblxuLyoqXG4gKiBQYXRoIG9iamVjdHMgYXJlIHNvcnQgb2YgbGlrZSBhIHN1cGVyLXBvd2VyZWRcbiAqIHtAbGluayBodHRwczovL25vZGVqcy5vcmcvZG9jcy9sYXRlc3QvYXBpL2ZzLmh0bWwjY2xhc3MtZnNkaXJlbnQgZnMuRGlyZW50fVxuICpcbiAqIEVhY2ggb25lIHJlcHJlc2VudHMgYSBzaW5nbGUgZmlsZXN5c3RlbSBlbnRyeSBvbiBkaXNrLCB3aGljaCBtYXkgb3IgbWF5IG5vdFxuICogZXhpc3QuIEl0IGluY2x1ZGVzIG1ldGhvZHMgZm9yIHJlYWRpbmcgdmFyaW91cyB0eXBlcyBvZiBpbmZvcm1hdGlvbiB2aWFcbiAqIGxzdGF0LCByZWFkbGluaywgYW5kIHJlYWRkaXIsIGFuZCBjYWNoZXMgYWxsIGluZm9ybWF0aW9uIHRvIHRoZSBncmVhdGVzdFxuICogZGVncmVlIHBvc3NpYmxlLlxuICpcbiAqIE5vdGUgdGhhdCBmcyBvcGVyYXRpb25zIHRoYXQgd291bGQgbm9ybWFsbHkgdGhyb3cgd2lsbCBpbnN0ZWFkIHJldHVybiBhblxuICogXCJlbXB0eVwiIHZhbHVlLiBUaGlzIGlzIGluIG9yZGVyIHRvIHByZXZlbnQgZXhjZXNzaXZlIG92ZXJoZWFkIGZyb20gZXJyb3JcbiAqIHN0YWNrIHRyYWNlcy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFBhdGhCYXNlIGltcGxlbWVudHMgRGlyZW50IHtcbiAgLyoqXG4gICAqIHRoZSBiYXNlbmFtZSBvZiB0aGlzIHBhdGhcbiAgICpcbiAgICogKipJbXBvcnRhbnQqKjogKmFsd2F5cyogdGVzdCB0aGUgcGF0aCBuYW1lIGFnYWluc3QgYW55IHRlc3Qgc3RyaW5nXG4gICAqIHVzaW5ndGhlIHtAbGluayBpc05hbWVkfSBtZXRob2QsIGFuZCBub3QgYnkgZGlyZWN0bHkgY29tcGFyaW5nIHRoaXNcbiAgICogc3RyaW5nLiBPdGhlcndpc2UsIHVuaWNvZGUgcGF0aCBzdHJpbmdzIHRoYXQgdGhlIHN5c3RlbSBzZWVzIGFzIGlkZW50aWNhbFxuICAgKiB3aWxsIG5vdCBiZSBwcm9wZXJseSB0cmVhdGVkIGFzIHRoZSBzYW1lIHBhdGgsIGxlYWRpbmcgdG8gaW5jb3JyZWN0XG4gICAqIGJlaGF2aW9yIGFuZCBwb3NzaWJsZSBzZWN1cml0eSBpc3N1ZXMuXG4gICAqL1xuICBuYW1lOiBzdHJpbmdcbiAgLyoqXG4gICAqIHRoZSBQYXRoIGVudHJ5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHBhdGggcm9vdC5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICByb290OiBQYXRoQmFzZVxuICAvKipcbiAgICogQWxsIHJvb3RzIGZvdW5kIHdpdGhpbiB0aGUgY3VycmVudCBQYXRoU2N1cnJ5IGZhbWlseVxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHJvb3RzOiB7IFtrOiBzdHJpbmddOiBQYXRoQmFzZSB9XG4gIC8qKlxuICAgKiBhIHJlZmVyZW5jZSB0byB0aGUgcGFyZW50IHBhdGgsIG9yIHVuZGVmaW5lZCBpbiB0aGUgY2FzZSBvZiByb290IGVudHJpZXNcbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBwYXJlbnQ/OiBQYXRoQmFzZVxuICAvKipcbiAgICogYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgcGF0aHMgYXJlIGNvbXBhcmVkIGNhc2UtaW5zZW5zaXRpdmVseVxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIG5vY2FzZTogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBib29sZWFuIGluZGljYXRpbmcgdGhhdCB0aGlzIHBhdGggaXMgdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnlcbiAgICogb2YgdGhlIFBhdGhTY3VycnkgY29sbGVjdGlvbiB0aGF0IGNvbnRhaW5zIGl0LlxuICAgKi9cbiAgaXNDV0Q6IGJvb2xlYW4gPSBmYWxzZVxuXG4gIC8qKlxuICAgKiB0aGUgc3RyaW5nIG9yIHJlZ2V4cCB1c2VkIHRvIHNwbGl0IHBhdGhzLiBPbiBwb3NpeCwgaXQgaXMgYCcvJ2AsIGFuZCBvblxuICAgKiB3aW5kb3dzIGl0IGlzIGEgUmVnRXhwIG1hdGNoaW5nIGVpdGhlciBgJy8nYCBvciBgJ1xcXFwnYFxuICAgKi9cbiAgYWJzdHJhY3Qgc3BsaXRTZXA6IHN0cmluZyB8IFJlZ0V4cFxuICAvKipcbiAgICogVGhlIHBhdGggc2VwYXJhdG9yIHN0cmluZyB0byB1c2Ugd2hlbiBqb2luaW5nIHBhdGhzXG4gICAqL1xuICBhYnN0cmFjdCBzZXA6IHN0cmluZ1xuXG4gIC8vIHBvdGVudGlhbCBkZWZhdWx0IGZzIG92ZXJyaWRlXG4gICNmczogRlNWYWx1ZVxuXG4gIC8vIFN0YXRzIGZpZWxkc1xuICAjZGV2PzogbnVtYmVyXG4gIGdldCBkZXYoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2RldlxuICB9XG4gICNtb2RlPzogbnVtYmVyXG4gIGdldCBtb2RlKCkge1xuICAgIHJldHVybiB0aGlzLiNtb2RlXG4gIH1cbiAgI25saW5rPzogbnVtYmVyXG4gIGdldCBubGluaygpIHtcbiAgICByZXR1cm4gdGhpcy4jbmxpbmtcbiAgfVxuICAjdWlkPzogbnVtYmVyXG4gIGdldCB1aWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuI3VpZFxuICB9XG4gICNnaWQ/OiBudW1iZXJcbiAgZ2V0IGdpZCgpIHtcbiAgICByZXR1cm4gdGhpcy4jZ2lkXG4gIH1cbiAgI3JkZXY/OiBudW1iZXJcbiAgZ2V0IHJkZXYoKSB7XG4gICAgcmV0dXJuIHRoaXMuI3JkZXZcbiAgfVxuICAjYmxrc2l6ZT86IG51bWJlclxuICBnZXQgYmxrc2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy4jYmxrc2l6ZVxuICB9XG4gICNpbm8/OiBudW1iZXJcbiAgZ2V0IGlubygpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5vXG4gIH1cbiAgI3NpemU/OiBudW1iZXJcbiAgZ2V0IHNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuI3NpemVcbiAgfVxuICAjYmxvY2tzPzogbnVtYmVyXG4gIGdldCBibG9ja3MoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2Jsb2Nrc1xuICB9XG4gICNhdGltZU1zPzogbnVtYmVyXG4gIGdldCBhdGltZU1zKCkge1xuICAgIHJldHVybiB0aGlzLiNhdGltZU1zXG4gIH1cbiAgI210aW1lTXM/OiBudW1iZXJcbiAgZ2V0IG10aW1lTXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuI210aW1lTXNcbiAgfVxuICAjY3RpbWVNcz86IG51bWJlclxuICBnZXQgY3RpbWVNcygpIHtcbiAgICByZXR1cm4gdGhpcy4jY3RpbWVNc1xuICB9XG4gICNiaXJ0aHRpbWVNcz86IG51bWJlclxuICBnZXQgYmlydGh0aW1lTXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2JpcnRodGltZU1zXG4gIH1cbiAgI2F0aW1lPzogRGF0ZVxuICBnZXQgYXRpbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2F0aW1lXG4gIH1cbiAgI210aW1lPzogRGF0ZVxuICBnZXQgbXRpbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuI210aW1lXG4gIH1cbiAgI2N0aW1lPzogRGF0ZVxuICBnZXQgY3RpbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2N0aW1lXG4gIH1cbiAgI2JpcnRodGltZT86IERhdGVcbiAgZ2V0IGJpcnRodGltZSgpIHtcbiAgICByZXR1cm4gdGhpcy4jYmlydGh0aW1lXG4gIH1cblxuICAjbWF0Y2hOYW1lOiBzdHJpbmdcbiAgI2RlcHRoPzogbnVtYmVyXG4gICNmdWxscGF0aD86IHN0cmluZ1xuICAjZnVsbHBhdGhQb3NpeD86IHN0cmluZ1xuICAjcmVsYXRpdmU/OiBzdHJpbmdcbiAgI3JlbGF0aXZlUG9zaXg/OiBzdHJpbmdcbiAgI3R5cGU6IG51bWJlclxuICAjY2hpbGRyZW46IENoaWxkcmVuQ2FjaGVcbiAgI2xpbmtUYXJnZXQ/OiBQYXRoQmFzZVxuICAjcmVhbHBhdGg/OiBQYXRoQmFzZVxuXG4gIC8qKlxuICAgKiBUaGlzIHByb3BlcnR5IGlzIGZvciBjb21wYXRpYmlsaXR5IHdpdGggdGhlIERpcmVudCBjbGFzcyBhcyBvZlxuICAgKiBOb2RlIHYyMCwgd2hlcmUgRGlyZW50WydwYXJlbnRQYXRoJ10gcmVmZXJzIHRvIHRoZSBwYXRoIG9mIHRoZVxuICAgKiBkaXJlY3RvcnkgdGhhdCB3YXMgcGFzc2VkIHRvIHJlYWRkaXIuIEZvciByb290IGVudHJpZXMsIGl0J3MgdGhlIHBhdGhcbiAgICogdG8gdGhlIGVudHJ5IGl0c2VsZi5cbiAgICovXG4gIGdldCBwYXJlbnRQYXRoKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICh0aGlzLnBhcmVudCB8fCB0aGlzKS5mdWxscGF0aCgpXG4gIH1cblxuICAvKipcbiAgICogRGVwcmVjYXRlZCBhbGlhcyBmb3IgRGlyZW50WydwYXJlbnRQYXRoJ10gU29tZXdoYXQgY291bnRlcmludHVpdGl2ZWx5LFxuICAgKiB0aGlzIHByb3BlcnR5IHJlZmVycyB0byB0aGUgKnBhcmVudCogcGF0aCwgbm90IHRoZSBwYXRoIG9iamVjdCBpdHNlbGYuXG4gICAqXG4gICAqIEBkZXByZWNhdGVkXG4gICAqL1xuICBnZXQgcGF0aCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFBhdGhcbiAgfVxuXG4gIC8qKlxuICAgKiBEbyBub3QgY3JlYXRlIG5ldyBQYXRoIG9iamVjdHMgZGlyZWN0bHkuICBUaGV5IHNob3VsZCBhbHdheXMgYmUgYWNjZXNzZWRcbiAgICogdmlhIHRoZSBQYXRoU2N1cnJ5IGNsYXNzIG9yIG90aGVyIG1ldGhvZHMgb24gdGhlIFBhdGggY2xhc3MuXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHR5cGU6IG51bWJlciA9IFVOS05PV04sXG4gICAgcm9vdDogUGF0aEJhc2UgfCB1bmRlZmluZWQsXG4gICAgcm9vdHM6IHsgW2s6IHN0cmluZ106IFBhdGhCYXNlIH0sXG4gICAgbm9jYXNlOiBib29sZWFuLFxuICAgIGNoaWxkcmVuOiBDaGlsZHJlbkNhY2hlLFxuICAgIG9wdHM6IFBhdGhPcHRzLFxuICApIHtcbiAgICB0aGlzLm5hbWUgPSBuYW1lXG4gICAgdGhpcy4jbWF0Y2hOYW1lID0gbm9jYXNlID8gbm9ybWFsaXplTm9jYXNlKG5hbWUpIDogbm9ybWFsaXplKG5hbWUpXG4gICAgdGhpcy4jdHlwZSA9IHR5cGUgJiBUWVBFTUFTS1xuICAgIHRoaXMubm9jYXNlID0gbm9jYXNlXG4gICAgdGhpcy5yb290cyA9IHJvb3RzXG4gICAgdGhpcy5yb290ID0gcm9vdCB8fCB0aGlzXG4gICAgdGhpcy4jY2hpbGRyZW4gPSBjaGlsZHJlblxuICAgIHRoaXMuI2Z1bGxwYXRoID0gb3B0cy5mdWxscGF0aFxuICAgIHRoaXMuI3JlbGF0aXZlID0gb3B0cy5yZWxhdGl2ZVxuICAgIHRoaXMuI3JlbGF0aXZlUG9zaXggPSBvcHRzLnJlbGF0aXZlUG9zaXhcbiAgICB0aGlzLnBhcmVudCA9IG9wdHMucGFyZW50XG4gICAgaWYgKHRoaXMucGFyZW50KSB7XG4gICAgICB0aGlzLiNmcyA9IHRoaXMucGFyZW50LiNmc1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiNmcyA9IGZzRnJvbU9wdGlvbihvcHRzLmZzKVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBkZXB0aCBvZiB0aGUgUGF0aCBvYmplY3QgZnJvbSBpdHMgcm9vdC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIGEgcGF0aCBhdCBgL2Zvby9iYXJgIHdvdWxkIGhhdmUgYSBkZXB0aCBvZiAyLlxuICAgKi9cbiAgZGVwdGgoKTogbnVtYmVyIHtcbiAgICBpZiAodGhpcy4jZGVwdGggIT09IHVuZGVmaW5lZCkgcmV0dXJuIHRoaXMuI2RlcHRoXG4gICAgaWYgKCF0aGlzLnBhcmVudCkgcmV0dXJuICh0aGlzLiNkZXB0aCA9IDApXG4gICAgcmV0dXJuICh0aGlzLiNkZXB0aCA9IHRoaXMucGFyZW50LmRlcHRoKCkgKyAxKVxuICB9XG5cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgYWJzdHJhY3QgZ2V0Um9vdFN0cmluZyhwYXRoOiBzdHJpbmcpOiBzdHJpbmdcbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgYWJzdHJhY3QgZ2V0Um9vdChyb290UGF0aDogc3RyaW5nKTogUGF0aEJhc2VcbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgYWJzdHJhY3QgbmV3Q2hpbGQobmFtZTogc3RyaW5nLCB0eXBlPzogbnVtYmVyLCBvcHRzPzogUGF0aE9wdHMpOiBQYXRoQmFzZVxuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGNoaWxkcmVuQ2FjaGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2NoaWxkcmVuXG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBQYXRoIG9iamVjdCByZWZlcmVuY2VkIGJ5IHRoZSBzdHJpbmcgcGF0aCwgcmVzb2x2ZWQgZnJvbSB0aGlzIFBhdGhcbiAgICovXG4gIHJlc29sdmUocGF0aD86IHN0cmluZyk6IFBhdGhCYXNlIHtcbiAgICBpZiAoIXBhdGgpIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuICAgIGNvbnN0IHJvb3RQYXRoID0gdGhpcy5nZXRSb290U3RyaW5nKHBhdGgpXG4gICAgY29uc3QgZGlyID0gcGF0aC5zdWJzdHJpbmcocm9vdFBhdGgubGVuZ3RoKVxuICAgIGNvbnN0IGRpclBhcnRzID0gZGlyLnNwbGl0KHRoaXMuc3BsaXRTZXApXG4gICAgY29uc3QgcmVzdWx0OiBQYXRoQmFzZSA9XG4gICAgICByb290UGF0aCA/XG4gICAgICAgIHRoaXMuZ2V0Um9vdChyb290UGF0aCkuI3Jlc29sdmVQYXJ0cyhkaXJQYXJ0cylcbiAgICAgIDogdGhpcy4jcmVzb2x2ZVBhcnRzKGRpclBhcnRzKVxuICAgIHJldHVybiByZXN1bHRcbiAgfVxuXG4gICNyZXNvbHZlUGFydHMoZGlyUGFydHM6IHN0cmluZ1tdKSB7XG4gICAgbGV0IHA6IFBhdGhCYXNlID0gdGhpc1xuICAgIGZvciAoY29uc3QgcGFydCBvZiBkaXJQYXJ0cykge1xuICAgICAgcCA9IHAuY2hpbGQocGFydClcbiAgICB9XG4gICAgcmV0dXJuIHBcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBjYWNoZWQgY2hpbGRyZW4gUGF0aCBvYmplY3RzLCBpZiBzdGlsbCBhdmFpbGFibGUuICBJZiB0aGV5XG4gICAqIGhhdmUgZmFsbGVuIG91dCBvZiB0aGUgY2FjaGUsIHRoZW4gcmV0dXJucyBhbiBlbXB0eSBhcnJheSwgYW5kIHJlc2V0cyB0aGVcbiAgICogUkVBRERJUl9DQUxMRUQgYml0LCBzbyB0aGF0IGZ1dHVyZSBjYWxscyB0byByZWFkZGlyKCkgd2lsbCByZXF1aXJlIGFuIGZzXG4gICAqIGxvb2t1cC5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBjaGlsZHJlbigpOiBDaGlsZHJlbiB7XG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy4jY2hpbGRyZW4uZ2V0KHRoaXMpXG4gICAgaWYgKGNhY2hlZCkge1xuICAgICAgcmV0dXJuIGNhY2hlZFxuICAgIH1cbiAgICBjb25zdCBjaGlsZHJlbjogQ2hpbGRyZW4gPSBPYmplY3QuYXNzaWduKFtdLCB7IHByb3Zpc2lvbmFsOiAwIH0pXG4gICAgdGhpcy4jY2hpbGRyZW4uc2V0KHRoaXMsIGNoaWxkcmVuKVxuICAgIHRoaXMuI3R5cGUgJj0gflJFQURESVJfQ0FMTEVEXG4gICAgcmV0dXJuIGNoaWxkcmVuXG4gIH1cblxuICAvKipcbiAgICogUmVzb2x2ZXMgYSBwYXRoIHBvcnRpb24gYW5kIHJldHVybnMgb3IgY3JlYXRlcyB0aGUgY2hpbGQgUGF0aC5cbiAgICpcbiAgICogUmV0dXJucyBgdGhpc2AgaWYgcGF0aFBhcnQgaXMgYCcnYCBvciBgJy4nYCwgb3IgYHBhcmVudGAgaWYgcGF0aFBhcnQgaXNcbiAgICogYCcuLidgLlxuICAgKlxuICAgKiBUaGlzIHNob3VsZCBub3QgYmUgY2FsbGVkIGRpcmVjdGx5LiAgSWYgYHBhdGhQYXJ0YCBjb250YWlucyBhbnkgcGF0aFxuICAgKiBzZXBhcmF0b3JzLCBpdCB3aWxsIGxlYWQgdG8gdW5zYWZlIHVuZGVmaW5lZCBiZWhhdmlvci5cbiAgICpcbiAgICogVXNlIGBQYXRoLnJlc29sdmUoKWAgaW5zdGVhZC5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBjaGlsZChwYXRoUGFydDogc3RyaW5nLCBvcHRzPzogUGF0aE9wdHMpOiBQYXRoQmFzZSB7XG4gICAgaWYgKHBhdGhQYXJ0ID09PSAnJyB8fCBwYXRoUGFydCA9PT0gJy4nKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cbiAgICBpZiAocGF0aFBhcnQgPT09ICcuLicpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcmVudCB8fCB0aGlzXG4gICAgfVxuXG4gICAgLy8gZmluZCB0aGUgY2hpbGRcbiAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW4oKVxuICAgIGNvbnN0IG5hbWUgPVxuICAgICAgdGhpcy5ub2Nhc2UgPyBub3JtYWxpemVOb2Nhc2UocGF0aFBhcnQpIDogbm9ybWFsaXplKHBhdGhQYXJ0KVxuICAgIGZvciAoY29uc3QgcCBvZiBjaGlsZHJlbikge1xuICAgICAgaWYgKHAuI21hdGNoTmFtZSA9PT0gbmFtZSkge1xuICAgICAgICByZXR1cm4gcFxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGRpZG4ndCBmaW5kIGl0LCBjcmVhdGUgcHJvdmlzaW9uYWwgY2hpbGQsIHNpbmNlIGl0IG1pZ2h0IG5vdFxuICAgIC8vIGFjdHVhbGx5IGV4aXN0LiAgSWYgd2Uga25vdyB0aGUgcGFyZW50IGlzbid0IGEgZGlyLCB0aGVuXG4gICAgLy8gaW4gZmFjdCBpdCBDQU4nVCBleGlzdC5cbiAgICBjb25zdCBzID0gdGhpcy5wYXJlbnQgPyB0aGlzLnNlcCA6ICcnXG4gICAgY29uc3QgZnVsbHBhdGggPVxuICAgICAgdGhpcy4jZnVsbHBhdGggPyB0aGlzLiNmdWxscGF0aCArIHMgKyBwYXRoUGFydCA6IHVuZGVmaW5lZFxuICAgIGNvbnN0IHBjaGlsZCA9IHRoaXMubmV3Q2hpbGQocGF0aFBhcnQsIFVOS05PV04sIHtcbiAgICAgIC4uLm9wdHMsXG4gICAgICBwYXJlbnQ6IHRoaXMsXG4gICAgICBmdWxscGF0aCxcbiAgICB9KVxuXG4gICAgaWYgKCF0aGlzLmNhblJlYWRkaXIoKSkge1xuICAgICAgcGNoaWxkLiN0eXBlIHw9IEVOT0VOVFxuICAgIH1cblxuICAgIC8vIGRvbid0IGhhdmUgdG8gdXBkYXRlIHByb3Zpc2lvbmFsLCBiZWNhdXNlIGlmIHdlIGhhdmUgcmVhbCBjaGlsZHJlbixcbiAgICAvLyB0aGVuIHByb3Zpc2lvbmFsIGlzIHNldCB0byBjaGlsZHJlbi5sZW5ndGgsIG90aGVyd2lzZSBhIGxvd2VyIG51bWJlclxuICAgIGNoaWxkcmVuLnB1c2gocGNoaWxkKVxuICAgIHJldHVybiBwY2hpbGRcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgcmVsYXRpdmUgcGF0aCBmcm9tIHRoZSBjd2QuIElmIGl0IGRvZXMgbm90IHNoYXJlIGFuIGFuY2VzdG9yIHdpdGhcbiAgICogdGhlIGN3ZCwgdGhlbiB0aGlzIGVuZHMgdXAgYmVpbmcgZXF1aXZhbGVudCB0byB0aGUgZnVsbHBhdGgoKVxuICAgKi9cbiAgcmVsYXRpdmUoKTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy5pc0NXRCkgcmV0dXJuICcnXG4gICAgaWYgKHRoaXMuI3JlbGF0aXZlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLiNyZWxhdGl2ZVxuICAgIH1cbiAgICBjb25zdCBuYW1lID0gdGhpcy5uYW1lXG4gICAgY29uc3QgcCA9IHRoaXMucGFyZW50XG4gICAgaWYgKCFwKSB7XG4gICAgICByZXR1cm4gKHRoaXMuI3JlbGF0aXZlID0gdGhpcy5uYW1lKVxuICAgIH1cbiAgICBjb25zdCBwdiA9IHAucmVsYXRpdmUoKVxuICAgIHJldHVybiBwdiArICghcHYgfHwgIXAucGFyZW50ID8gJycgOiB0aGlzLnNlcCkgKyBuYW1lXG4gIH1cblxuICAvKipcbiAgICogVGhlIHJlbGF0aXZlIHBhdGggZnJvbSB0aGUgY3dkLCB1c2luZyAvIGFzIHRoZSBwYXRoIHNlcGFyYXRvci5cbiAgICogSWYgaXQgZG9lcyBub3Qgc2hhcmUgYW4gYW5jZXN0b3Igd2l0aFxuICAgKiB0aGUgY3dkLCB0aGVuIHRoaXMgZW5kcyB1cCBiZWluZyBlcXVpdmFsZW50IHRvIHRoZSBmdWxscGF0aFBvc2l4KClcbiAgICogT24gcG9zaXggc3lzdGVtcywgdGhpcyBpcyBpZGVudGljYWwgdG8gcmVsYXRpdmUoKS5cbiAgICovXG4gIHJlbGF0aXZlUG9zaXgoKTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy5zZXAgPT09ICcvJykgcmV0dXJuIHRoaXMucmVsYXRpdmUoKVxuICAgIGlmICh0aGlzLmlzQ1dEKSByZXR1cm4gJydcbiAgICBpZiAodGhpcy4jcmVsYXRpdmVQb3NpeCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdGhpcy4jcmVsYXRpdmVQb3NpeFxuICAgIGNvbnN0IG5hbWUgPSB0aGlzLm5hbWVcbiAgICBjb25zdCBwID0gdGhpcy5wYXJlbnRcbiAgICBpZiAoIXApIHtcbiAgICAgIHJldHVybiAodGhpcy4jcmVsYXRpdmVQb3NpeCA9IHRoaXMuZnVsbHBhdGhQb3NpeCgpKVxuICAgIH1cbiAgICBjb25zdCBwdiA9IHAucmVsYXRpdmVQb3NpeCgpXG4gICAgcmV0dXJuIHB2ICsgKCFwdiB8fCAhcC5wYXJlbnQgPyAnJyA6ICcvJykgKyBuYW1lXG4gIH1cblxuICAvKipcbiAgICogVGhlIGZ1bGx5IHJlc29sdmVkIHBhdGggc3RyaW5nIGZvciB0aGlzIFBhdGggZW50cnlcbiAgICovXG4gIGZ1bGxwYXRoKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuI2Z1bGxwYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLiNmdWxscGF0aFxuICAgIH1cbiAgICBjb25zdCBuYW1lID0gdGhpcy5uYW1lXG4gICAgY29uc3QgcCA9IHRoaXMucGFyZW50XG4gICAgaWYgKCFwKSB7XG4gICAgICByZXR1cm4gKHRoaXMuI2Z1bGxwYXRoID0gdGhpcy5uYW1lKVxuICAgIH1cbiAgICBjb25zdCBwdiA9IHAuZnVsbHBhdGgoKVxuICAgIGNvbnN0IGZwID0gcHYgKyAoIXAucGFyZW50ID8gJycgOiB0aGlzLnNlcCkgKyBuYW1lXG4gICAgcmV0dXJuICh0aGlzLiNmdWxscGF0aCA9IGZwKVxuICB9XG5cbiAgLyoqXG4gICAqIE9uIHBsYXRmb3JtcyBvdGhlciB0aGFuIHdpbmRvd3MsIHRoaXMgaXMgaWRlbnRpY2FsIHRvIGZ1bGxwYXRoLlxuICAgKlxuICAgKiBPbiB3aW5kb3dzLCB0aGlzIGlzIG92ZXJyaWRkZW4gdG8gcmV0dXJuIHRoZSBmb3J3YXJkLXNsYXNoIGZvcm0gb2YgdGhlXG4gICAqIGZ1bGwgVU5DIHBhdGguXG4gICAqL1xuICBmdWxscGF0aFBvc2l4KCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuI2Z1bGxwYXRoUG9zaXggIT09IHVuZGVmaW5lZCkgcmV0dXJuIHRoaXMuI2Z1bGxwYXRoUG9zaXhcbiAgICBpZiAodGhpcy5zZXAgPT09ICcvJykgcmV0dXJuICh0aGlzLiNmdWxscGF0aFBvc2l4ID0gdGhpcy5mdWxscGF0aCgpKVxuICAgIGlmICghdGhpcy5wYXJlbnQpIHtcbiAgICAgIGNvbnN0IHAgPSB0aGlzLmZ1bGxwYXRoKCkucmVwbGFjZSgvXFxcXC9nLCAnLycpXG4gICAgICBpZiAoL15bYS16XTpcXC8vaS50ZXN0KHApKSB7XG4gICAgICAgIHJldHVybiAodGhpcy4jZnVsbHBhdGhQb3NpeCA9IGAvLz8vJHtwfWApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKHRoaXMuI2Z1bGxwYXRoUG9zaXggPSBwKVxuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBwID0gdGhpcy5wYXJlbnRcbiAgICBjb25zdCBwZnBwID0gcC5mdWxscGF0aFBvc2l4KClcbiAgICBjb25zdCBmcHAgPSBwZnBwICsgKCFwZnBwIHx8ICFwLnBhcmVudCA/ICcnIDogJy8nKSArIHRoaXMubmFtZVxuICAgIHJldHVybiAodGhpcy4jZnVsbHBhdGhQb3NpeCA9IGZwcClcbiAgfVxuXG4gIC8qKlxuICAgKiBJcyB0aGUgUGF0aCBvZiBhbiB1bmtub3duIHR5cGU/XG4gICAqXG4gICAqIE5vdGUgdGhhdCB3ZSBtaWdodCBrbm93ICpzb21ldGhpbmcqIGFib3V0IGl0IGlmIHRoZXJlIGhhcyBiZWVuIGEgcHJldmlvdXNcbiAgICogZmlsZXN5c3RlbSBvcGVyYXRpb24sIGZvciBleGFtcGxlIHRoYXQgaXQgZG9lcyBub3QgZXhpc3QsIG9yIGlzIG5vdCBhXG4gICAqIGxpbmssIG9yIHdoZXRoZXIgaXQgaGFzIGNoaWxkIGVudHJpZXMuXG4gICAqL1xuICBpc1Vua25vd24oKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICh0aGlzLiN0eXBlICYgSUZNVCkgPT09IFVOS05PV05cbiAgfVxuXG4gIGlzVHlwZSh0eXBlOiBUeXBlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXNbYGlzJHt0eXBlfWBdKClcbiAgfVxuXG4gIGdldFR5cGUoKTogVHlwZSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuaXNVbmtub3duKCkgPyAnVW5rbm93bidcbiAgICAgIDogdGhpcy5pc0RpcmVjdG9yeSgpID8gJ0RpcmVjdG9yeSdcbiAgICAgIDogdGhpcy5pc0ZpbGUoKSA/ICdGaWxlJ1xuICAgICAgOiB0aGlzLmlzU3ltYm9saWNMaW5rKCkgPyAnU3ltYm9saWNMaW5rJ1xuICAgICAgOiB0aGlzLmlzRklGTygpID8gJ0ZJRk8nXG4gICAgICA6IHRoaXMuaXNDaGFyYWN0ZXJEZXZpY2UoKSA/ICdDaGFyYWN0ZXJEZXZpY2UnXG4gICAgICA6IHRoaXMuaXNCbG9ja0RldmljZSgpID8gJ0Jsb2NrRGV2aWNlJ1xuICAgICAgOiAvKiBjOCBpZ25vcmUgc3RhcnQgKi8gdGhpcy5pc1NvY2tldCgpID8gJ1NvY2tldCdcbiAgICAgIDogJ1Vua25vd24nXG4gICAgKVxuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIFBhdGggYSByZWd1bGFyIGZpbGU/XG4gICAqL1xuICBpc0ZpbGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICh0aGlzLiN0eXBlICYgSUZNVCkgPT09IElGUkVHXG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIFBhdGggYSBkaXJlY3Rvcnk/XG4gICAqL1xuICBpc0RpcmVjdG9yeSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKHRoaXMuI3R5cGUgJiBJRk1UKSA9PT0gSUZESVJcbiAgfVxuXG4gIC8qKlxuICAgKiBJcyB0aGUgcGF0aCBhIGNoYXJhY3RlciBkZXZpY2U/XG4gICAqL1xuICBpc0NoYXJhY3RlckRldmljZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKHRoaXMuI3R5cGUgJiBJRk1UKSA9PT0gSUZDSFJcbiAgfVxuXG4gIC8qKlxuICAgKiBJcyB0aGUgcGF0aCBhIGJsb2NrIGRldmljZT9cbiAgICovXG4gIGlzQmxvY2tEZXZpY2UoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICh0aGlzLiN0eXBlICYgSUZNVCkgPT09IElGQkxLXG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIHBhdGggYSBGSUZPIHBpcGU/XG4gICAqL1xuICBpc0ZJRk8oKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICh0aGlzLiN0eXBlICYgSUZNVCkgPT09IElGSUZPXG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIHBhdGggYSBzb2NrZXQ/XG4gICAqL1xuICBpc1NvY2tldCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKHRoaXMuI3R5cGUgJiBJRk1UKSA9PT0gSUZTT0NLXG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIHBhdGggYSBzeW1ib2xpYyBsaW5rP1xuICAgKi9cbiAgaXNTeW1ib2xpY0xpbmsoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICh0aGlzLiN0eXBlICYgSUZMTkspID09PSBJRkxOS1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgZW50cnkgaWYgaXQgaGFzIGJlZW4gc3ViamVjdCBvZiBhIHN1Y2Nlc3NmdWwgbHN0YXQsIG9yXG4gICAqIHVuZGVmaW5lZCBvdGhlcndpc2UuXG4gICAqXG4gICAqIERvZXMgbm90IHJlYWQgdGhlIGZpbGVzeXN0ZW0sIHNvIGFuIHVuZGVmaW5lZCByZXN1bHQgKmNvdWxkKiBzaW1wbHlcbiAgICogbWVhbiB0aGF0IHdlIGhhdmVuJ3QgY2FsbGVkIGxzdGF0IG9uIGl0LlxuICAgKi9cbiAgbHN0YXRDYWNoZWQoKTogUGF0aEJhc2UgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLiN0eXBlICYgTFNUQVRfQ0FMTEVEID8gdGhpcyA6IHVuZGVmaW5lZFxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgY2FjaGVkIGxpbmsgdGFyZ2V0IGlmIHRoZSBlbnRyeSBoYXMgYmVlbiB0aGUgc3ViamVjdCBvZiBhXG4gICAqIHN1Y2Nlc3NmdWwgcmVhZGxpbmssIG9yIHVuZGVmaW5lZCBvdGhlcndpc2UuXG4gICAqXG4gICAqIERvZXMgbm90IHJlYWQgdGhlIGZpbGVzeXN0ZW0sIHNvIGFuIHVuZGVmaW5lZCByZXN1bHQgKmNvdWxkKiBqdXN0IG1lYW4gd2VcbiAgICogZG9uJ3QgaGF2ZSBhbnkgY2FjaGVkIGRhdGEuIE9ubHkgdXNlIGl0IGlmIHlvdSBhcmUgdmVyeSBzdXJlIHRoYXQgYVxuICAgKiByZWFkbGluaygpIGhhcyBiZWVuIGNhbGxlZCBhdCBzb21lIHBvaW50LlxuICAgKi9cbiAgcmVhZGxpbmtDYWNoZWQoKTogUGF0aEJhc2UgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLiNsaW5rVGFyZ2V0XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgY2FjaGVkIHJlYWxwYXRoIHRhcmdldCBpZiB0aGUgZW50cnkgaGFzIGJlZW4gdGhlIHN1YmplY3RcbiAgICogb2YgYSBzdWNjZXNzZnVsIHJlYWxwYXRoLCBvciB1bmRlZmluZWQgb3RoZXJ3aXNlLlxuICAgKlxuICAgKiBEb2VzIG5vdCByZWFkIHRoZSBmaWxlc3lzdGVtLCBzbyBhbiB1bmRlZmluZWQgcmVzdWx0ICpjb3VsZCoganVzdCBtZWFuIHdlXG4gICAqIGRvbid0IGhhdmUgYW55IGNhY2hlZCBkYXRhLiBPbmx5IHVzZSBpdCBpZiB5b3UgYXJlIHZlcnkgc3VyZSB0aGF0IGFcbiAgICogcmVhbHBhdGgoKSBoYXMgYmVlbiBjYWxsZWQgYXQgc29tZSBwb2ludC5cbiAgICovXG4gIHJlYWxwYXRoQ2FjaGVkKCk6IFBhdGhCYXNlIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy4jcmVhbHBhdGhcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBjYWNoZWQgY2hpbGQgUGF0aCBlbnRyaWVzIGFycmF5IGlmIHRoZSBlbnRyeSBoYXMgYmVlbiB0aGVcbiAgICogc3ViamVjdCBvZiBhIHN1Y2Nlc3NmdWwgcmVhZGRpcigpLCBvciBbXSBvdGhlcndpc2UuXG4gICAqXG4gICAqIERvZXMgbm90IHJlYWQgdGhlIGZpbGVzeXN0ZW0sIHNvIGFuIGVtcHR5IGFycmF5ICpjb3VsZCoganVzdCBtZWFuIHdlXG4gICAqIGRvbid0IGhhdmUgYW55IGNhY2hlZCBkYXRhLiBPbmx5IHVzZSBpdCBpZiB5b3UgYXJlIHZlcnkgc3VyZSB0aGF0IGFcbiAgICogcmVhZGRpcigpIGhhcyBiZWVuIGNhbGxlZCByZWNlbnRseSBlbm91Z2ggdG8gc3RpbGwgYmUgdmFsaWQuXG4gICAqL1xuICByZWFkZGlyQ2FjaGVkKCk6IFBhdGhCYXNlW10ge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5jaGlsZHJlbigpXG4gICAgcmV0dXJuIGNoaWxkcmVuLnNsaWNlKDAsIGNoaWxkcmVuLnByb3Zpc2lvbmFsKVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0cnVlIGlmIGl0J3Mgd29ydGggdHJ5aW5nIHRvIHJlYWRsaW5rLiAgSWUsIHdlIGRvbid0ICh5ZXQpIGhhdmVcbiAgICogYW55IGluZGljYXRpb24gdGhhdCByZWFkbGluayB3aWxsIGRlZmluaXRlbHkgZmFpbC5cbiAgICpcbiAgICogUmV0dXJucyBmYWxzZSBpZiB0aGUgcGF0aCBpcyBrbm93biB0byBub3QgYmUgYSBzeW1saW5rLCBpZiBhIHByZXZpb3VzXG4gICAqIHJlYWRsaW5rIGZhaWxlZCwgb3IgaWYgdGhlIGVudHJ5IGRvZXMgbm90IGV4aXN0LlxuICAgKi9cbiAgY2FuUmVhZGxpbmsoKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuI2xpbmtUYXJnZXQpIHJldHVybiB0cnVlXG4gICAgaWYgKCF0aGlzLnBhcmVudCkgcmV0dXJuIGZhbHNlXG4gICAgLy8gY2FzZXMgd2hlcmUgaXQgY2Fubm90IHBvc3NpYmx5IHN1Y2NlZWRcbiAgICBjb25zdCBpZm10ID0gdGhpcy4jdHlwZSAmIElGTVRcbiAgICByZXR1cm4gIShcbiAgICAgIChpZm10ICE9PSBVTktOT1dOICYmIGlmbXQgIT09IElGTE5LKSB8fFxuICAgICAgdGhpcy4jdHlwZSAmIEVOT1JFQURMSU5LIHx8XG4gICAgICB0aGlzLiN0eXBlICYgRU5PRU5UXG4gICAgKVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0cnVlIGlmIHJlYWRkaXIgaGFzIHByZXZpb3VzbHkgYmVlbiBzdWNjZXNzZnVsbHkgY2FsbGVkIG9uIHRoaXNcbiAgICogcGF0aCwgaW5kaWNhdGluZyB0aGF0IGNhY2hlZFJlYWRkaXIoKSBpcyBsaWtlbHkgdmFsaWQuXG4gICAqL1xuICBjYWxsZWRSZWFkZGlyKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhISh0aGlzLiN0eXBlICYgUkVBRERJUl9DQUxMRUQpXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBwYXRoIGlzIGtub3duIHRvIG5vdCBleGlzdC4gVGhhdCBpcywgYSBwcmV2aW91cyBsc3RhdFxuICAgKiBvciByZWFkZGlyIGZhaWxlZCB0byB2ZXJpZnkgaXRzIGV4aXN0ZW5jZSB3aGVuIHRoYXQgd291bGQgaGF2ZSBiZWVuXG4gICAqIGV4cGVjdGVkLCBvciBhIHBhcmVudCBlbnRyeSB3YXMgbWFya2VkIGVpdGhlciBlbm9lbnQgb3IgZW5vdGRpci5cbiAgICovXG4gIGlzRU5PRU5UKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhISh0aGlzLiN0eXBlICYgRU5PRU5UKVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0cnVlIGlmIHRoZSBwYXRoIGlzIGEgbWF0Y2ggZm9yIHRoZSBnaXZlbiBwYXRoIG5hbWUuICBUaGlzIGhhbmRsZXNcbiAgICogY2FzZSBzZW5zaXRpdml0eSBhbmQgdW5pY29kZSBub3JtYWxpemF0aW9uLlxuICAgKlxuICAgKiBOb3RlOiBldmVuIG9uIGNhc2Utc2Vuc2l0aXZlIHN5c3RlbXMsIGl0IGlzICoqbm90Kiogc2FmZSB0byB0ZXN0IHRoZVxuICAgKiBlcXVhbGl0eSBvZiB0aGUgYC5uYW1lYCBwcm9wZXJ0eSB0byBkZXRlcm1pbmUgd2hldGhlciBhIGdpdmVuIHBhdGhuYW1lXG4gICAqIG1hdGNoZXMsIGR1ZSB0byB1bmljb2RlIG5vcm1hbGl6YXRpb24gbWlzbWF0Y2hlcy5cbiAgICpcbiAgICogQWx3YXlzIHVzZSB0aGlzIG1ldGhvZCBpbnN0ZWFkIG9mIHRlc3RpbmcgdGhlIGBwYXRoLm5hbWVgIHByb3BlcnR5XG4gICAqIGRpcmVjdGx5LlxuICAgKi9cbiAgaXNOYW1lZChuOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gIXRoaXMubm9jYXNlID9cbiAgICAgICAgdGhpcy4jbWF0Y2hOYW1lID09PSBub3JtYWxpemUobilcbiAgICAgIDogdGhpcy4jbWF0Y2hOYW1lID09PSBub3JtYWxpemVOb2Nhc2UobilcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIFBhdGggb2JqZWN0IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHRhcmdldCBvZiBhIHN5bWJvbGljIGxpbmsuXG4gICAqXG4gICAqIElmIHRoZSBQYXRoIGlzIG5vdCBhIHN5bWJvbGljIGxpbmssIG9yIGlmIHRoZSByZWFkbGluayBjYWxsIGZhaWxzIGZvciBhbnlcbiAgICogcmVhc29uLCBgdW5kZWZpbmVkYCBpcyByZXR1cm5lZC5cbiAgICpcbiAgICogUmVzdWx0IGlzIGNhY2hlZCwgYW5kIHRodXMgbWF5IGJlIG91dGRhdGVkIGlmIHRoZSBmaWxlc3lzdGVtIGlzIG11dGF0ZWQuXG4gICAqL1xuICBhc3luYyByZWFkbGluaygpOiBQcm9taXNlPFBhdGhCYXNlIHwgdW5kZWZpbmVkPiB7XG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy4jbGlua1RhcmdldFxuICAgIGlmICh0YXJnZXQpIHtcbiAgICAgIHJldHVybiB0YXJnZXRcbiAgICB9XG4gICAgaWYgKCF0aGlzLmNhblJlYWRsaW5rKCkpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgLy8gYWxyZWFkeSBjb3ZlcmVkIGJ5IHRoZSBjYW5SZWFkbGluayB0ZXN0LCBoZXJlIGZvciB0cyBncnVtcGxlc1xuICAgIGlmICghdGhpcy5wYXJlbnQpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVhZCA9IGF3YWl0IHRoaXMuI2ZzLnByb21pc2VzLnJlYWRsaW5rKHRoaXMuZnVsbHBhdGgoKSlcbiAgICAgIGNvbnN0IGxpbmtUYXJnZXQgPSAoYXdhaXQgdGhpcy5wYXJlbnQucmVhbHBhdGgoKSk/LnJlc29sdmUocmVhZClcbiAgICAgIGlmIChsaW5rVGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiAodGhpcy4jbGlua1RhcmdldCA9IGxpbmtUYXJnZXQpXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXIpIHtcbiAgICAgIHRoaXMuI3JlYWRsaW5rRmFpbCgoZXIgYXMgTm9kZUpTLkVycm5vRXhjZXB0aW9uKS5jb2RlKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91cyB7QGxpbmsgUGF0aEJhc2UucmVhZGxpbmt9XG4gICAqL1xuICByZWFkbGlua1N5bmMoKTogUGF0aEJhc2UgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuI2xpbmtUYXJnZXRcbiAgICBpZiAodGFyZ2V0KSB7XG4gICAgICByZXR1cm4gdGFyZ2V0XG4gICAgfVxuICAgIGlmICghdGhpcy5jYW5SZWFkbGluaygpKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgIC8vIGFscmVhZHkgY292ZXJlZCBieSB0aGUgY2FuUmVhZGxpbmsgdGVzdCwgaGVyZSBmb3IgdHMgZ3J1bXBsZXNcbiAgICBpZiAoIXRoaXMucGFyZW50KSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlYWQgPSB0aGlzLiNmcy5yZWFkbGlua1N5bmModGhpcy5mdWxscGF0aCgpKVxuICAgICAgY29uc3QgbGlua1RhcmdldCA9IHRoaXMucGFyZW50LnJlYWxwYXRoU3luYygpPy5yZXNvbHZlKHJlYWQpXG4gICAgICBpZiAobGlua1RhcmdldCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuI2xpbmtUYXJnZXQgPSBsaW5rVGFyZ2V0KVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVyKSB7XG4gICAgICB0aGlzLiNyZWFkbGlua0ZhaWwoKGVyIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSlcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gIH1cblxuICAjcmVhZGRpclN1Y2Nlc3MoY2hpbGRyZW46IENoaWxkcmVuKSB7XG4gICAgLy8gc3VjY2VlZGVkLCBtYXJrIHJlYWRkaXIgY2FsbGVkIGJpdFxuICAgIHRoaXMuI3R5cGUgfD0gUkVBRERJUl9DQUxMRURcbiAgICAvLyBtYXJrIGFsbCByZW1haW5pbmcgcHJvdmlzaW9uYWwgY2hpbGRyZW4gYXMgRU5PRU5UXG4gICAgZm9yIChsZXQgcCA9IGNoaWxkcmVuLnByb3Zpc2lvbmFsOyBwIDwgY2hpbGRyZW4ubGVuZ3RoOyBwKyspIHtcbiAgICAgIGNvbnN0IGMgPSBjaGlsZHJlbltwXVxuICAgICAgaWYgKGMpIGMuI21hcmtFTk9FTlQoKVxuICAgIH1cbiAgfVxuXG4gICNtYXJrRU5PRU5UKCkge1xuICAgIC8vIG1hcmsgYXMgVU5LTk9XTiBhbmQgRU5PRU5UXG4gICAgaWYgKHRoaXMuI3R5cGUgJiBFTk9FTlQpIHJldHVyblxuICAgIHRoaXMuI3R5cGUgPSAodGhpcy4jdHlwZSB8IEVOT0VOVCkgJiBJRk1UX1VOS05PV05cbiAgICB0aGlzLiNtYXJrQ2hpbGRyZW5FTk9FTlQoKVxuICB9XG5cbiAgI21hcmtDaGlsZHJlbkVOT0VOVCgpIHtcbiAgICAvLyBhbGwgY2hpbGRyZW4gYXJlIHByb3Zpc2lvbmFsIGFuZCBkbyBub3QgZXhpc3RcbiAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW4oKVxuICAgIGNoaWxkcmVuLnByb3Zpc2lvbmFsID0gMFxuICAgIGZvciAoY29uc3QgcCBvZiBjaGlsZHJlbikge1xuICAgICAgcC4jbWFya0VOT0VOVCgpXG4gICAgfVxuICB9XG5cbiAgI21hcmtFTk9SRUFMUEFUSCgpIHtcbiAgICB0aGlzLiN0eXBlIHw9IEVOT1JFQUxQQVRIXG4gICAgdGhpcy4jbWFya0VOT1RESVIoKVxuICB9XG5cbiAgLy8gc2F2ZSB0aGUgaW5mb3JtYXRpb24gd2hlbiB3ZSBrbm93IHRoZSBlbnRyeSBpcyBub3QgYSBkaXJcbiAgI21hcmtFTk9URElSKCkge1xuICAgIC8vIGVudHJ5IGlzIG5vdCBhIGRpcmVjdG9yeSwgc28gYW55IGNoaWxkcmVuIGNhbid0IGV4aXN0LlxuICAgIC8vIHRoaXMgKnNob3VsZCogYmUgaW1wb3NzaWJsZSwgc2luY2UgYW55IGNoaWxkcmVuIGNyZWF0ZWRcbiAgICAvLyBhZnRlciBpdCdzIGJlZW4gbWFya2VkIEVOT1RESVIgc2hvdWxkIGJlIG1hcmtlZCBFTk9FTlQsXG4gICAgLy8gc28gaXQgd29uJ3QgZXZlbiBnZXQgdG8gdGhpcyBwb2ludC5cbiAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICBpZiAodGhpcy4jdHlwZSAmIEVOT1RESVIpIHJldHVyblxuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgbGV0IHQgPSB0aGlzLiN0eXBlXG4gICAgLy8gdGhpcyBjb3VsZCBoYXBwZW4gaWYgd2Ugc3RhdCBhIGRpciwgdGhlbiBkZWxldGUgaXQsXG4gICAgLy8gdGhlbiB0cnkgdG8gcmVhZCBpdCBvciBvbmUgb2YgaXRzIGNoaWxkcmVuLlxuICAgIGlmICgodCAmIElGTVQpID09PSBJRkRJUikgdCAmPSBJRk1UX1VOS05PV05cbiAgICB0aGlzLiN0eXBlID0gdCB8IEVOT1RESVJcbiAgICB0aGlzLiNtYXJrQ2hpbGRyZW5FTk9FTlQoKVxuICB9XG5cbiAgI3JlYWRkaXJGYWlsKGNvZGU6IHN0cmluZyA9ICcnKSB7XG4gICAgLy8gbWFya0VOT1RESVIgYW5kIG1hcmtFTk9FTlQgYWxzbyBzZXQgcHJvdmlzaW9uYWw9MFxuICAgIGlmIChjb2RlID09PSAnRU5PVERJUicgfHwgY29kZSA9PT0gJ0VQRVJNJykge1xuICAgICAgdGhpcy4jbWFya0VOT1RESVIoKVxuICAgIH0gZWxzZSBpZiAoY29kZSA9PT0gJ0VOT0VOVCcpIHtcbiAgICAgIHRoaXMuI21hcmtFTk9FTlQoKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNoaWxkcmVuKCkucHJvdmlzaW9uYWwgPSAwXG4gICAgfVxuICB9XG5cbiAgI2xzdGF0RmFpbChjb2RlOiBzdHJpbmcgPSAnJykge1xuICAgIC8vIFdpbmRvd3MganVzdCByYWlzZXMgRU5PRU5UIGluIHRoaXMgY2FzZSwgZGlzYWJsZSBmb3Igd2luIENJXG4gICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgaWYgKGNvZGUgPT09ICdFTk9URElSJykge1xuICAgICAgLy8gYWxyZWFkeSBrbm93IGl0IGhhcyBhIHBhcmVudCBieSB0aGlzIHBvaW50XG4gICAgICBjb25zdCBwID0gdGhpcy5wYXJlbnQgYXMgUGF0aEJhc2VcbiAgICAgIHAuI21hcmtFTk9URElSKClcbiAgICB9IGVsc2UgaWYgKGNvZGUgPT09ICdFTk9FTlQnKSB7XG4gICAgICAvKiBjOCBpZ25vcmUgc3RvcCAqL1xuICAgICAgdGhpcy4jbWFya0VOT0VOVCgpXG4gICAgfVxuICB9XG5cbiAgI3JlYWRsaW5rRmFpbChjb2RlOiBzdHJpbmcgPSAnJykge1xuICAgIGxldCB0ZXIgPSB0aGlzLiN0eXBlXG4gICAgdGVyIHw9IEVOT1JFQURMSU5LXG4gICAgaWYgKGNvZGUgPT09ICdFTk9FTlQnKSB0ZXIgfD0gRU5PRU5UXG4gICAgLy8gd2luZG93cyBnZXRzIGEgd2VpcmQgZXJyb3Igd2hlbiB5b3UgdHJ5IHRvIHJlYWRsaW5rIGEgZmlsZVxuICAgIGlmIChjb2RlID09PSAnRUlOVkFMJyB8fCBjb2RlID09PSAnVU5LTk9XTicpIHtcbiAgICAgIC8vIGV4aXN0cywgYnV0IG5vdCBhIHN5bWxpbmssIHdlIGRvbid0IGtub3cgV0hBVCBpdCBpcywgc28gcmVtb3ZlXG4gICAgICAvLyBhbGwgSUZNVCBiaXRzLlxuICAgICAgdGVyICY9IElGTVRfVU5LTk9XTlxuICAgIH1cbiAgICB0aGlzLiN0eXBlID0gdGVyXG4gICAgLy8gd2luZG93cyBqdXN0IGdldHMgRU5PRU5UIGluIHRoaXMgY2FzZS4gIFdlIGRvIGNvdmVyIHRoZSBjYXNlLFxuICAgIC8vIGp1c3QgZGlzYWJsZWQgYmVjYXVzZSBpdCdzIGltcG9zc2libGUgb24gV2luZG93cyBDSVxuICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgIGlmIChjb2RlID09PSAnRU5PVERJUicgJiYgdGhpcy5wYXJlbnQpIHtcbiAgICAgIHRoaXMucGFyZW50LiNtYXJrRU5PVERJUigpXG4gICAgfVxuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gIH1cblxuICAjcmVhZGRpckFkZENoaWxkKGU6IERpcmVudCwgYzogQ2hpbGRyZW4pIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy4jcmVhZGRpck1heWJlUHJvbW90ZUNoaWxkKGUsIGMpIHx8XG4gICAgICB0aGlzLiNyZWFkZGlyQWRkTmV3Q2hpbGQoZSwgYylcbiAgICApXG4gIH1cblxuICAjcmVhZGRpckFkZE5ld0NoaWxkKGU6IERpcmVudCwgYzogQ2hpbGRyZW4pOiBQYXRoQmFzZSB7XG4gICAgLy8gYWxsb2MgbmV3IGVudHJ5IGF0IGhlYWQsIHNvIGl0J3MgbmV2ZXIgcHJvdmlzaW9uYWxcbiAgICBjb25zdCB0eXBlID0gZW50VG9UeXBlKGUpXG4gICAgY29uc3QgY2hpbGQgPSB0aGlzLm5ld0NoaWxkKGUubmFtZSwgdHlwZSwgeyBwYXJlbnQ6IHRoaXMgfSlcbiAgICBjb25zdCBpZm10ID0gY2hpbGQuI3R5cGUgJiBJRk1UXG4gICAgaWYgKGlmbXQgIT09IElGRElSICYmIGlmbXQgIT09IElGTE5LICYmIGlmbXQgIT09IFVOS05PV04pIHtcbiAgICAgIGNoaWxkLiN0eXBlIHw9IEVOT1RESVJcbiAgICB9XG4gICAgYy51bnNoaWZ0KGNoaWxkKVxuICAgIGMucHJvdmlzaW9uYWwrK1xuICAgIHJldHVybiBjaGlsZFxuICB9XG5cbiAgI3JlYWRkaXJNYXliZVByb21vdGVDaGlsZChlOiBEaXJlbnQsIGM6IENoaWxkcmVuKTogUGF0aEJhc2UgfCB1bmRlZmluZWQge1xuICAgIGZvciAobGV0IHAgPSBjLnByb3Zpc2lvbmFsOyBwIDwgYy5sZW5ndGg7IHArKykge1xuICAgICAgY29uc3QgcGNoaWxkID0gY1twXVxuICAgICAgY29uc3QgbmFtZSA9XG4gICAgICAgIHRoaXMubm9jYXNlID8gbm9ybWFsaXplTm9jYXNlKGUubmFtZSkgOiBub3JtYWxpemUoZS5uYW1lKVxuICAgICAgaWYgKG5hbWUgIT09IHBjaGlsZCEuI21hdGNoTmFtZSkge1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy4jcmVhZGRpclByb21vdGVDaGlsZChlLCBwY2hpbGQhLCBwLCBjKVxuICAgIH1cbiAgfVxuXG4gICNyZWFkZGlyUHJvbW90ZUNoaWxkKFxuICAgIGU6IERpcmVudCxcbiAgICBwOiBQYXRoQmFzZSxcbiAgICBpbmRleDogbnVtYmVyLFxuICAgIGM6IENoaWxkcmVuLFxuICApOiBQYXRoQmFzZSB7XG4gICAgY29uc3QgdiA9IHAubmFtZVxuICAgIC8vIHJldGFpbiBhbnkgb3RoZXIgZmxhZ3MsIGJ1dCBzZXQgaWZtdCBmcm9tIGRpcmVudFxuICAgIHAuI3R5cGUgPSAocC4jdHlwZSAmIElGTVRfVU5LTk9XTikgfCBlbnRUb1R5cGUoZSlcbiAgICAvLyBjYXNlIHNlbnNpdGl2aXR5IGZpeGluZyB3aGVuIHdlIGxlYXJuIHRoZSB0cnVlIG5hbWUuXG4gICAgaWYgKHYgIT09IGUubmFtZSkgcC5uYW1lID0gZS5uYW1lXG5cbiAgICAvLyBqdXN0IGFkdmFuY2UgcHJvdmlzaW9uYWwgaW5kZXggKHBvdGVudGlhbGx5IG9mZiB0aGUgbGlzdCksXG4gICAgLy8gb3RoZXJ3aXNlIHdlIGhhdmUgdG8gc3BsaWNlL3BvcCBpdCBvdXQgYW5kIHJlLWluc2VydCBhdCBoZWFkXG4gICAgaWYgKGluZGV4ICE9PSBjLnByb3Zpc2lvbmFsKSB7XG4gICAgICBpZiAoaW5kZXggPT09IGMubGVuZ3RoIC0gMSkgYy5wb3AoKVxuICAgICAgZWxzZSBjLnNwbGljZShpbmRleCwgMSlcbiAgICAgIGMudW5zaGlmdChwKVxuICAgIH1cbiAgICBjLnByb3Zpc2lvbmFsKytcbiAgICByZXR1cm4gcFxuICB9XG5cbiAgLyoqXG4gICAqIENhbGwgbHN0YXQoKSBvbiB0aGlzIFBhdGgsIGFuZCB1cGRhdGUgYWxsIGtub3duIGluZm9ybWF0aW9uIHRoYXQgY2FuIGJlXG4gICAqIGRldGVybWluZWQuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB1bmxpa2UgYGZzLmxzdGF0KClgLCB0aGUgcmV0dXJuZWQgdmFsdWUgZG9lcyBub3QgY29udGFpbiBzb21lXG4gICAqIGluZm9ybWF0aW9uLCBzdWNoIGFzIGBtb2RlYCwgYGRldmAsIGBubGlua2AsIGFuZCBgaW5vYC4gIElmIHRoYXRcbiAgICogaW5mb3JtYXRpb24gaXMgcmVxdWlyZWQsIHlvdSB3aWxsIG5lZWQgdG8gY2FsbCBgZnMubHN0YXRgIHlvdXJzZWxmLlxuICAgKlxuICAgKiBJZiB0aGUgUGF0aCByZWZlcnMgdG8gYSBub25leGlzdGVudCBmaWxlLCBvciBpZiB0aGUgbHN0YXQgY2FsbCBmYWlscyBmb3JcbiAgICogYW55IHJlYXNvbiwgYHVuZGVmaW5lZGAgaXMgcmV0dXJuZWQuICBPdGhlcndpc2UgdGhlIHVwZGF0ZWQgUGF0aCBvYmplY3QgaXNcbiAgICogcmV0dXJuZWQuXG4gICAqXG4gICAqIFJlc3VsdHMgYXJlIGNhY2hlZCwgYW5kIHRodXMgbWF5IGJlIG91dCBvZiBkYXRlIGlmIHRoZSBmaWxlc3lzdGVtIGlzXG4gICAqIG11dGF0ZWQuXG4gICAqL1xuICBhc3luYyBsc3RhdCgpOiBQcm9taXNlPFBhdGhCYXNlIHwgdW5kZWZpbmVkPiB7XG4gICAgaWYgKCh0aGlzLiN0eXBlICYgRU5PRU5UKSA9PT0gMCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy4jYXBwbHlTdGF0KGF3YWl0IHRoaXMuI2ZzLnByb21pc2VzLmxzdGF0KHRoaXMuZnVsbHBhdGgoKSkpXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgICB9IGNhdGNoIChlcikge1xuICAgICAgICB0aGlzLiNsc3RhdEZhaWwoKGVyIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogc3luY2hyb25vdXMge0BsaW5rIFBhdGhCYXNlLmxzdGF0fVxuICAgKi9cbiAgbHN0YXRTeW5jKCk6IFBhdGhCYXNlIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoKHRoaXMuI3R5cGUgJiBFTk9FTlQpID09PSAwKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLiNhcHBseVN0YXQodGhpcy4jZnMubHN0YXRTeW5jKHRoaXMuZnVsbHBhdGgoKSkpXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgICB9IGNhdGNoIChlcikge1xuICAgICAgICB0aGlzLiNsc3RhdEZhaWwoKGVyIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAjYXBwbHlTdGF0KHN0OiBTdGF0cykge1xuICAgIGNvbnN0IHtcbiAgICAgIGF0aW1lLFxuICAgICAgYXRpbWVNcyxcbiAgICAgIGJpcnRodGltZSxcbiAgICAgIGJpcnRodGltZU1zLFxuICAgICAgYmxrc2l6ZSxcbiAgICAgIGJsb2NrcyxcbiAgICAgIGN0aW1lLFxuICAgICAgY3RpbWVNcyxcbiAgICAgIGRldixcbiAgICAgIGdpZCxcbiAgICAgIGlubyxcbiAgICAgIG1vZGUsXG4gICAgICBtdGltZSxcbiAgICAgIG10aW1lTXMsXG4gICAgICBubGluayxcbiAgICAgIHJkZXYsXG4gICAgICBzaXplLFxuICAgICAgdWlkLFxuICAgIH0gPSBzdFxuICAgIHRoaXMuI2F0aW1lID0gYXRpbWVcbiAgICB0aGlzLiNhdGltZU1zID0gYXRpbWVNc1xuICAgIHRoaXMuI2JpcnRodGltZSA9IGJpcnRodGltZVxuICAgIHRoaXMuI2JpcnRodGltZU1zID0gYmlydGh0aW1lTXNcbiAgICB0aGlzLiNibGtzaXplID0gYmxrc2l6ZVxuICAgIHRoaXMuI2Jsb2NrcyA9IGJsb2Nrc1xuICAgIHRoaXMuI2N0aW1lID0gY3RpbWVcbiAgICB0aGlzLiNjdGltZU1zID0gY3RpbWVNc1xuICAgIHRoaXMuI2RldiA9IGRldlxuICAgIHRoaXMuI2dpZCA9IGdpZFxuICAgIHRoaXMuI2lubyA9IGlub1xuICAgIHRoaXMuI21vZGUgPSBtb2RlXG4gICAgdGhpcy4jbXRpbWUgPSBtdGltZVxuICAgIHRoaXMuI210aW1lTXMgPSBtdGltZU1zXG4gICAgdGhpcy4jbmxpbmsgPSBubGlua1xuICAgIHRoaXMuI3JkZXYgPSByZGV2XG4gICAgdGhpcy4jc2l6ZSA9IHNpemVcbiAgICB0aGlzLiN1aWQgPSB1aWRcbiAgICBjb25zdCBpZm10ID0gZW50VG9UeXBlKHN0KVxuICAgIC8vIHJldGFpbiBhbnkgb3RoZXIgZmxhZ3MsIGJ1dCBzZXQgdGhlIGlmbXRcbiAgICB0aGlzLiN0eXBlID0gKHRoaXMuI3R5cGUgJiBJRk1UX1VOS05PV04pIHwgaWZtdCB8IExTVEFUX0NBTExFRFxuICAgIGlmIChpZm10ICE9PSBVTktOT1dOICYmIGlmbXQgIT09IElGRElSICYmIGlmbXQgIT09IElGTE5LKSB7XG4gICAgICB0aGlzLiN0eXBlIHw9IEVOT1RESVJcbiAgICB9XG4gIH1cblxuICAjb25SZWFkZGlyQ0I6ICgoXG4gICAgZXI6IE5vZGVKUy5FcnJub0V4Y2VwdGlvbiB8IG51bGwsXG4gICAgZW50cmllczogUGF0aFtdLFxuICApID0+IGFueSlbXSA9IFtdXG4gICNyZWFkZGlyQ0JJbkZsaWdodDogYm9vbGVhbiA9IGZhbHNlXG4gICNjYWxsT25SZWFkZGlyQ0IoY2hpbGRyZW46IFBhdGhbXSkge1xuICAgIHRoaXMuI3JlYWRkaXJDQkluRmxpZ2h0ID0gZmFsc2VcbiAgICBjb25zdCBjYnMgPSB0aGlzLiNvblJlYWRkaXJDQi5zbGljZSgpXG4gICAgdGhpcy4jb25SZWFkZGlyQ0IubGVuZ3RoID0gMFxuICAgIGNicy5mb3JFYWNoKGNiID0+IGNiKG51bGwsIGNoaWxkcmVuKSlcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFuZGFyZCBub2RlLXN0eWxlIGNhbGxiYWNrIGludGVyZmFjZSB0byBnZXQgbGlzdCBvZiBkaXJlY3RvcnkgZW50cmllcy5cbiAgICpcbiAgICogSWYgdGhlIFBhdGggY2Fubm90IG9yIGRvZXMgbm90IGNvbnRhaW4gYW55IGNoaWxkcmVuLCB0aGVuIGFuIGVtcHR5IGFycmF5XG4gICAqIGlzIHJldHVybmVkLlxuICAgKlxuICAgKiBSZXN1bHRzIGFyZSBjYWNoZWQsIGFuZCB0aHVzIG1heSBiZSBvdXQgb2YgZGF0ZSBpZiB0aGUgZmlsZXN5c3RlbSBpc1xuICAgKiBtdXRhdGVkLlxuICAgKlxuICAgKiBAcGFyYW0gY2IgVGhlIGNhbGxiYWNrIGNhbGxlZCB3aXRoIChlciwgZW50cmllcykuICBOb3RlIHRoYXQgdGhlIGBlcmBcbiAgICogcGFyYW0gaXMgc29tZXdoYXQgZXh0cmFuZW91cywgYXMgYWxsIHJlYWRkaXIoKSBlcnJvcnMgYXJlIGhhbmRsZWQgYW5kXG4gICAqIHNpbXBseSByZXN1bHQgaW4gYW4gZW1wdHkgc2V0IG9mIGVudHJpZXMgYmVpbmcgcmV0dXJuZWQuXG4gICAqIEBwYXJhbSBhbGxvd1phbGdvIEJvb2xlYW4gaW5kaWNhdGluZyB0aGF0IGltbWVkaWF0ZWx5IGtub3duIHJlc3VsdHMgc2hvdWxkXG4gICAqICpub3QqIGJlIGRlZmVycmVkIHdpdGggYHF1ZXVlTWljcm90YXNrYC4gRGVmYXVsdHMgdG8gYGZhbHNlYC4gUmVsZWFzZVxuICAgKiB6YWxnbyBhdCB5b3VyIHBlcmlsLCB0aGUgZGFyayBwb255IGxvcmQgaXMgZGV2aW91cyBhbmQgdW5mb3JnaXZpbmcuXG4gICAqL1xuICByZWFkZGlyQ0IoXG4gICAgY2I6IChlcjogTm9kZUpTLkVycm5vRXhjZXB0aW9uIHwgbnVsbCwgZW50cmllczogUGF0aEJhc2VbXSkgPT4gYW55LFxuICAgIGFsbG93WmFsZ286IGJvb2xlYW4gPSBmYWxzZSxcbiAgKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNhblJlYWRkaXIoKSkge1xuICAgICAgaWYgKGFsbG93WmFsZ28pIGNiKG51bGwsIFtdKVxuICAgICAgZWxzZSBxdWV1ZU1pY3JvdGFzaygoKSA9PiBjYihudWxsLCBbXSkpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW4oKVxuICAgIGlmICh0aGlzLmNhbGxlZFJlYWRkaXIoKSkge1xuICAgICAgY29uc3QgYyA9IGNoaWxkcmVuLnNsaWNlKDAsIGNoaWxkcmVuLnByb3Zpc2lvbmFsKVxuICAgICAgaWYgKGFsbG93WmFsZ28pIGNiKG51bGwsIGMpXG4gICAgICBlbHNlIHF1ZXVlTWljcm90YXNrKCgpID0+IGNiKG51bGwsIGMpKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gZG9uJ3QgaGF2ZSB0byB3b3JyeSBhYm91dCB6YWxnbyBhdCB0aGlzIHBvaW50LlxuICAgIHRoaXMuI29uUmVhZGRpckNCLnB1c2goY2IpXG4gICAgaWYgKHRoaXMuI3JlYWRkaXJDQkluRmxpZ2h0KSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgdGhpcy4jcmVhZGRpckNCSW5GbGlnaHQgPSB0cnVlXG5cbiAgICAvLyBlbHNlIHJlYWQgdGhlIGRpcmVjdG9yeSwgZmlsbCB1cCBjaGlsZHJlblxuICAgIC8vIGRlLXByb3Zpc2lvbmFsaXplIGFueSBwcm92aXNpb25hbCBjaGlsZHJlbi5cbiAgICBjb25zdCBmdWxscGF0aCA9IHRoaXMuZnVsbHBhdGgoKVxuICAgIHRoaXMuI2ZzLnJlYWRkaXIoZnVsbHBhdGgsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9LCAoZXIsIGVudHJpZXMpID0+IHtcbiAgICAgIGlmIChlcikge1xuICAgICAgICB0aGlzLiNyZWFkZGlyRmFpbCgoZXIgYXMgTm9kZUpTLkVycm5vRXhjZXB0aW9uKS5jb2RlKVxuICAgICAgICBjaGlsZHJlbi5wcm92aXNpb25hbCA9IDBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIHdlIGRpZG4ndCBnZXQgYW4gZXJyb3IsIHdlIGFsd2F5cyBnZXQgZW50cmllcy5cbiAgICAgICAgLy9AdHMtaWdub3JlXG4gICAgICAgIGZvciAoY29uc3QgZSBvZiBlbnRyaWVzKSB7XG4gICAgICAgICAgdGhpcy4jcmVhZGRpckFkZENoaWxkKGUsIGNoaWxkcmVuKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuI3JlYWRkaXJTdWNjZXNzKGNoaWxkcmVuKVxuICAgICAgfVxuICAgICAgdGhpcy4jY2FsbE9uUmVhZGRpckNCKGNoaWxkcmVuLnNsaWNlKDAsIGNoaWxkcmVuLnByb3Zpc2lvbmFsKSlcbiAgICAgIHJldHVyblxuICAgIH0pXG4gIH1cblxuICAjYXN5bmNSZWFkZGlySW5GbGlnaHQ/OiBQcm9taXNlPHZvaWQ+XG5cbiAgLyoqXG4gICAqIFJldHVybiBhbiBhcnJheSBvZiBrbm93biBjaGlsZCBlbnRyaWVzLlxuICAgKlxuICAgKiBJZiB0aGUgUGF0aCBjYW5ub3Qgb3IgZG9lcyBub3QgY29udGFpbiBhbnkgY2hpbGRyZW4sIHRoZW4gYW4gZW1wdHkgYXJyYXlcbiAgICogaXMgcmV0dXJuZWQuXG4gICAqXG4gICAqIFJlc3VsdHMgYXJlIGNhY2hlZCwgYW5kIHRodXMgbWF5IGJlIG91dCBvZiBkYXRlIGlmIHRoZSBmaWxlc3lzdGVtIGlzXG4gICAqIG11dGF0ZWQuXG4gICAqL1xuICBhc3luYyByZWFkZGlyKCk6IFByb21pc2U8UGF0aEJhc2VbXT4ge1xuICAgIGlmICghdGhpcy5jYW5SZWFkZGlyKCkpIHtcbiAgICAgIHJldHVybiBbXVxuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5jaGlsZHJlbigpXG4gICAgaWYgKHRoaXMuY2FsbGVkUmVhZGRpcigpKSB7XG4gICAgICByZXR1cm4gY2hpbGRyZW4uc2xpY2UoMCwgY2hpbGRyZW4ucHJvdmlzaW9uYWwpXG4gICAgfVxuXG4gICAgLy8gZWxzZSByZWFkIHRoZSBkaXJlY3RvcnksIGZpbGwgdXAgY2hpbGRyZW5cbiAgICAvLyBkZS1wcm92aXNpb25hbGl6ZSBhbnkgcHJvdmlzaW9uYWwgY2hpbGRyZW4uXG4gICAgY29uc3QgZnVsbHBhdGggPSB0aGlzLmZ1bGxwYXRoKClcbiAgICBpZiAodGhpcy4jYXN5bmNSZWFkZGlySW5GbGlnaHQpIHtcbiAgICAgIGF3YWl0IHRoaXMuI2FzeW5jUmVhZGRpckluRmxpZ2h0XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgICAgbGV0IHJlc29sdmU6ICgpID0+IHZvaWQgPSAoKSA9PiB7fVxuICAgICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICAgIHRoaXMuI2FzeW5jUmVhZGRpckluRmxpZ2h0ID0gbmV3IFByb21pc2U8dm9pZD4oXG4gICAgICAgIHJlcyA9PiAocmVzb2x2ZSA9IHJlcyksXG4gICAgICApXG4gICAgICB0cnkge1xuICAgICAgICBmb3IgKGNvbnN0IGUgb2YgYXdhaXQgdGhpcy4jZnMucHJvbWlzZXMucmVhZGRpcihmdWxscGF0aCwge1xuICAgICAgICAgIHdpdGhGaWxlVHlwZXM6IHRydWUsXG4gICAgICAgIH0pKSB7XG4gICAgICAgICAgdGhpcy4jcmVhZGRpckFkZENoaWxkKGUsIGNoaWxkcmVuKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuI3JlYWRkaXJTdWNjZXNzKGNoaWxkcmVuKVxuICAgICAgfSBjYXRjaCAoZXIpIHtcbiAgICAgICAgdGhpcy4jcmVhZGRpckZhaWwoKGVyIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSlcbiAgICAgICAgY2hpbGRyZW4ucHJvdmlzaW9uYWwgPSAwXG4gICAgICB9XG4gICAgICB0aGlzLiNhc3luY1JlYWRkaXJJbkZsaWdodCA9IHVuZGVmaW5lZFxuICAgICAgcmVzb2x2ZSgpXG4gICAgfVxuICAgIHJldHVybiBjaGlsZHJlbi5zbGljZSgwLCBjaGlsZHJlbi5wcm92aXNpb25hbClcbiAgfVxuXG4gIC8qKlxuICAgKiBzeW5jaHJvbm91cyB7QGxpbmsgUGF0aEJhc2UucmVhZGRpcn1cbiAgICovXG4gIHJlYWRkaXJTeW5jKCk6IFBhdGhCYXNlW10ge1xuICAgIGlmICghdGhpcy5jYW5SZWFkZGlyKCkpIHtcbiAgICAgIHJldHVybiBbXVxuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5jaGlsZHJlbigpXG4gICAgaWYgKHRoaXMuY2FsbGVkUmVhZGRpcigpKSB7XG4gICAgICByZXR1cm4gY2hpbGRyZW4uc2xpY2UoMCwgY2hpbGRyZW4ucHJvdmlzaW9uYWwpXG4gICAgfVxuXG4gICAgLy8gZWxzZSByZWFkIHRoZSBkaXJlY3RvcnksIGZpbGwgdXAgY2hpbGRyZW5cbiAgICAvLyBkZS1wcm92aXNpb25hbGl6ZSBhbnkgcHJvdmlzaW9uYWwgY2hpbGRyZW4uXG4gICAgY29uc3QgZnVsbHBhdGggPSB0aGlzLmZ1bGxwYXRoKClcbiAgICB0cnkge1xuICAgICAgZm9yIChjb25zdCBlIG9mIHRoaXMuI2ZzLnJlYWRkaXJTeW5jKGZ1bGxwYXRoLCB7XG4gICAgICAgIHdpdGhGaWxlVHlwZXM6IHRydWUsXG4gICAgICB9KSkge1xuICAgICAgICB0aGlzLiNyZWFkZGlyQWRkQ2hpbGQoZSwgY2hpbGRyZW4pXG4gICAgICB9XG4gICAgICB0aGlzLiNyZWFkZGlyU3VjY2VzcyhjaGlsZHJlbilcbiAgICB9IGNhdGNoIChlcikge1xuICAgICAgdGhpcy4jcmVhZGRpckZhaWwoKGVyIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSlcbiAgICAgIGNoaWxkcmVuLnByb3Zpc2lvbmFsID0gMFxuICAgIH1cbiAgICByZXR1cm4gY2hpbGRyZW4uc2xpY2UoMCwgY2hpbGRyZW4ucHJvdmlzaW9uYWwpXG4gIH1cblxuICBjYW5SZWFkZGlyKCkge1xuICAgIGlmICh0aGlzLiN0eXBlICYgRU5PQ0hJTEQpIHJldHVybiBmYWxzZVxuICAgIGNvbnN0IGlmbXQgPSBJRk1UICYgdGhpcy4jdHlwZVxuICAgIC8vIHdlIGFsd2F5cyBzZXQgRU5PVERJUiB3aGVuIHNldHRpbmcgSUZNVCwgc28gc2hvdWxkIGJlIGltcG9zc2libGVcbiAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICBpZiAoIShpZm10ID09PSBVTktOT1dOIHx8IGlmbXQgPT09IElGRElSIHx8IGlmbXQgPT09IElGTE5LKSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuXG4gIHNob3VsZFdhbGsoXG4gICAgZGlyczogU2V0PFBhdGhCYXNlIHwgdW5kZWZpbmVkPixcbiAgICB3YWxrRmlsdGVyPzogKGU6IFBhdGhCYXNlKSA9PiBib29sZWFuLFxuICApOiBib29sZWFuIHtcbiAgICByZXR1cm4gKFxuICAgICAgKHRoaXMuI3R5cGUgJiBJRkRJUikgPT09IElGRElSICYmXG4gICAgICAhKHRoaXMuI3R5cGUgJiBFTk9DSElMRCkgJiZcbiAgICAgICFkaXJzLmhhcyh0aGlzKSAmJlxuICAgICAgKCF3YWxrRmlsdGVyIHx8IHdhbGtGaWx0ZXIodGhpcykpXG4gICAgKVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgUGF0aCBvYmplY3QgY29ycmVzcG9uZGluZyB0byBwYXRoIGFzIHJlc29sdmVkXG4gICAqIGJ5IHJlYWxwYXRoKDMpLlxuICAgKlxuICAgKiBJZiB0aGUgcmVhbHBhdGggY2FsbCBmYWlscyBmb3IgYW55IHJlYXNvbiwgYHVuZGVmaW5lZGAgaXMgcmV0dXJuZWQuXG4gICAqXG4gICAqIFJlc3VsdCBpcyBjYWNoZWQsIGFuZCB0aHVzIG1heSBiZSBvdXRkYXRlZCBpZiB0aGUgZmlsZXN5c3RlbSBpcyBtdXRhdGVkLlxuICAgKiBPbiBzdWNjZXNzLCByZXR1cm5zIGEgUGF0aCBvYmplY3QuXG4gICAqL1xuICBhc3luYyByZWFscGF0aCgpOiBQcm9taXNlPFBhdGhCYXNlIHwgdW5kZWZpbmVkPiB7XG4gICAgaWYgKHRoaXMuI3JlYWxwYXRoKSByZXR1cm4gdGhpcy4jcmVhbHBhdGhcbiAgICBpZiAoKEVOT1JFQUxQQVRIIHwgRU5PUkVBRExJTksgfCBFTk9FTlQpICYgdGhpcy4jdHlwZSkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBycCA9IGF3YWl0IHRoaXMuI2ZzLnByb21pc2VzLnJlYWxwYXRoKHRoaXMuZnVsbHBhdGgoKSlcbiAgICAgIHJldHVybiAodGhpcy4jcmVhbHBhdGggPSB0aGlzLnJlc29sdmUocnApKVxuICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgIHRoaXMuI21hcmtFTk9SRUFMUEFUSCgpXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIHtAbGluayByZWFscGF0aH1cbiAgICovXG4gIHJlYWxwYXRoU3luYygpOiBQYXRoQmFzZSB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKHRoaXMuI3JlYWxwYXRoKSByZXR1cm4gdGhpcy4jcmVhbHBhdGhcbiAgICBpZiAoKEVOT1JFQUxQQVRIIHwgRU5PUkVBRExJTksgfCBFTk9FTlQpICYgdGhpcy4jdHlwZSkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHRyeSB7XG4gICAgICBjb25zdCBycCA9IHRoaXMuI2ZzLnJlYWxwYXRoU3luYyh0aGlzLmZ1bGxwYXRoKCkpXG4gICAgICByZXR1cm4gKHRoaXMuI3JlYWxwYXRoID0gdGhpcy5yZXNvbHZlKHJwKSlcbiAgICB9IGNhdGNoIChfKSB7XG4gICAgICB0aGlzLiNtYXJrRU5PUkVBTFBBVEgoKVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gbWFyayB0aGlzIFBhdGggb2JqZWN0IGFzIHRoZSBzY3VycnkgY3dkLFxuICAgKiBjYWxsZWQgYnkge0BsaW5rIFBhdGhTY3VycnkjY2hkaXJ9XG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgW3NldEFzQ3dkXShvbGRDd2Q6IFBhdGhCYXNlKTogdm9pZCB7XG4gICAgaWYgKG9sZEN3ZCA9PT0gdGhpcykgcmV0dXJuXG4gICAgb2xkQ3dkLmlzQ1dEID0gZmFsc2VcbiAgICB0aGlzLmlzQ1dEID0gdHJ1ZVxuXG4gICAgY29uc3QgY2hhbmdlZCA9IG5ldyBTZXQ8UGF0aEJhc2U+KFtdKVxuICAgIGxldCBycCA9IFtdXG4gICAgbGV0IHA6IFBhdGhCYXNlID0gdGhpc1xuICAgIHdoaWxlIChwICYmIHAucGFyZW50KSB7XG4gICAgICBjaGFuZ2VkLmFkZChwKVxuICAgICAgcC4jcmVsYXRpdmUgPSBycC5qb2luKHRoaXMuc2VwKVxuICAgICAgcC4jcmVsYXRpdmVQb3NpeCA9IHJwLmpvaW4oJy8nKVxuICAgICAgcCA9IHAucGFyZW50XG4gICAgICBycC5wdXNoKCcuLicpXG4gICAgfVxuICAgIC8vIG5vdyB1bi1tZW1vaXplIHBhcmVudHMgb2Ygb2xkIGN3ZFxuICAgIHAgPSBvbGRDd2RcbiAgICB3aGlsZSAocCAmJiBwLnBhcmVudCAmJiAhY2hhbmdlZC5oYXMocCkpIHtcbiAgICAgIHAuI3JlbGF0aXZlID0gdW5kZWZpbmVkXG4gICAgICBwLiNyZWxhdGl2ZVBvc2l4ID0gdW5kZWZpbmVkXG4gICAgICBwID0gcC5wYXJlbnRcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBQYXRoIGNsYXNzIHVzZWQgb24gd2luMzIgc3lzdGVtc1xuICpcbiAqIFVzZXMgYCdcXFxcJ2AgYXMgdGhlIHBhdGggc2VwYXJhdG9yIGZvciByZXR1cm5lZCBwYXRocywgZWl0aGVyIGAnXFxcXCdgIG9yIGAnLydgXG4gKiBhcyB0aGUgcGF0aCBzZXBhcmF0b3IgZm9yIHBhcnNpbmcgcGF0aHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXRoV2luMzIgZXh0ZW5kcyBQYXRoQmFzZSB7XG4gIC8qKlxuICAgKiBTZXBhcmF0b3IgZm9yIGdlbmVyYXRpbmcgcGF0aCBzdHJpbmdzLlxuICAgKi9cbiAgc2VwOiAnXFxcXCcgPSAnXFxcXCdcbiAgLyoqXG4gICAqIFNlcGFyYXRvciBmb3IgcGFyc2luZyBwYXRoIHN0cmluZ3MuXG4gICAqL1xuICBzcGxpdFNlcDogUmVnRXhwID0gZWl0aGVyU2VwXG5cbiAgLyoqXG4gICAqIERvIG5vdCBjcmVhdGUgbmV3IFBhdGggb2JqZWN0cyBkaXJlY3RseS4gIFRoZXkgc2hvdWxkIGFsd2F5cyBiZSBhY2Nlc3NlZFxuICAgKiB2aWEgdGhlIFBhdGhTY3VycnkgY2xhc3Mgb3Igb3RoZXIgbWV0aG9kcyBvbiB0aGUgUGF0aCBjbGFzcy5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgdHlwZTogbnVtYmVyID0gVU5LTk9XTixcbiAgICByb290OiBQYXRoQmFzZSB8IHVuZGVmaW5lZCxcbiAgICByb290czogeyBbazogc3RyaW5nXTogUGF0aEJhc2UgfSxcbiAgICBub2Nhc2U6IGJvb2xlYW4sXG4gICAgY2hpbGRyZW46IENoaWxkcmVuQ2FjaGUsXG4gICAgb3B0czogUGF0aE9wdHMsXG4gICkge1xuICAgIHN1cGVyKG5hbWUsIHR5cGUsIHJvb3QsIHJvb3RzLCBub2Nhc2UsIGNoaWxkcmVuLCBvcHRzKVxuICB9XG5cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgbmV3Q2hpbGQobmFtZTogc3RyaW5nLCB0eXBlOiBudW1iZXIgPSBVTktOT1dOLCBvcHRzOiBQYXRoT3B0cyA9IHt9KSB7XG4gICAgcmV0dXJuIG5ldyBQYXRoV2luMzIoXG4gICAgICBuYW1lLFxuICAgICAgdHlwZSxcbiAgICAgIHRoaXMucm9vdCxcbiAgICAgIHRoaXMucm9vdHMsXG4gICAgICB0aGlzLm5vY2FzZSxcbiAgICAgIHRoaXMuY2hpbGRyZW5DYWNoZSgpLFxuICAgICAgb3B0cyxcbiAgICApXG4gIH1cblxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqL1xuICBnZXRSb290U3RyaW5nKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHdpbjMyLnBhcnNlKHBhdGgpLnJvb3RcbiAgfVxuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGdldFJvb3Qocm9vdFBhdGg6IHN0cmluZyk6IFBhdGhCYXNlIHtcbiAgICByb290UGF0aCA9IHVuY1RvRHJpdmUocm9vdFBhdGgudG9VcHBlckNhc2UoKSlcbiAgICBpZiAocm9vdFBhdGggPT09IHRoaXMucm9vdC5uYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy5yb290XG4gICAgfVxuICAgIC8vIG9rLCBub3QgdGhhdCBvbmUsIGNoZWNrIGlmIGl0IG1hdGNoZXMgYW5vdGhlciB3ZSBrbm93IGFib3V0XG4gICAgZm9yIChjb25zdCBbY29tcGFyZSwgcm9vdF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5yb290cykpIHtcbiAgICAgIGlmICh0aGlzLnNhbWVSb290KHJvb3RQYXRoLCBjb21wYXJlKSkge1xuICAgICAgICByZXR1cm4gKHRoaXMucm9vdHNbcm9vdFBhdGhdID0gcm9vdClcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gb3RoZXJ3aXNlLCBoYXZlIHRvIGNyZWF0ZSBhIG5ldyBvbmUuXG4gICAgcmV0dXJuICh0aGlzLnJvb3RzW3Jvb3RQYXRoXSA9IG5ldyBQYXRoU2N1cnJ5V2luMzIoXG4gICAgICByb290UGF0aCxcbiAgICAgIHRoaXMsXG4gICAgKS5yb290KVxuICB9XG5cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgc2FtZVJvb3Qocm9vdFBhdGg6IHN0cmluZywgY29tcGFyZTogc3RyaW5nID0gdGhpcy5yb290Lm5hbWUpOiBib29sZWFuIHtcbiAgICAvLyB3aW5kb3dzIGNhbiAocmFyZWx5KSBoYXZlIGNhc2Utc2Vuc2l0aXZlIGZpbGVzeXN0ZW0sIGJ1dFxuICAgIC8vIFVOQyBhbmQgZHJpdmUgbGV0dGVycyBhcmUgYWx3YXlzIGNhc2UtaW5zZW5zaXRpdmUsIGFuZCBjYW5vbmljYWxseVxuICAgIC8vIHJlcHJlc2VudGVkIHVwcGVyY2FzZS5cbiAgICByb290UGF0aCA9IHJvb3RQYXRoXG4gICAgICAudG9VcHBlckNhc2UoKVxuICAgICAgLnJlcGxhY2UoL1xcLy9nLCAnXFxcXCcpXG4gICAgICAucmVwbGFjZSh1bmNEcml2ZVJlZ2V4cCwgJyQxXFxcXCcpXG4gICAgcmV0dXJuIHJvb3RQYXRoID09PSBjb21wYXJlXG4gIH1cbn1cblxuLyoqXG4gKiBQYXRoIGNsYXNzIHVzZWQgb24gYWxsIHBvc2l4IHN5c3RlbXMuXG4gKlxuICogVXNlcyBgJy8nYCBhcyB0aGUgcGF0aCBzZXBhcmF0b3IuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXRoUG9zaXggZXh0ZW5kcyBQYXRoQmFzZSB7XG4gIC8qKlxuICAgKiBzZXBhcmF0b3IgZm9yIHBhcnNpbmcgcGF0aCBzdHJpbmdzXG4gICAqL1xuICBzcGxpdFNlcDogJy8nID0gJy8nXG4gIC8qKlxuICAgKiBzZXBhcmF0b3IgZm9yIGdlbmVyYXRpbmcgcGF0aCBzdHJpbmdzXG4gICAqL1xuICBzZXA6ICcvJyA9ICcvJ1xuXG4gIC8qKlxuICAgKiBEbyBub3QgY3JlYXRlIG5ldyBQYXRoIG9iamVjdHMgZGlyZWN0bHkuICBUaGV5IHNob3VsZCBhbHdheXMgYmUgYWNjZXNzZWRcbiAgICogdmlhIHRoZSBQYXRoU2N1cnJ5IGNsYXNzIG9yIG90aGVyIG1ldGhvZHMgb24gdGhlIFBhdGggY2xhc3MuXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHR5cGU6IG51bWJlciA9IFVOS05PV04sXG4gICAgcm9vdDogUGF0aEJhc2UgfCB1bmRlZmluZWQsXG4gICAgcm9vdHM6IHsgW2s6IHN0cmluZ106IFBhdGhCYXNlIH0sXG4gICAgbm9jYXNlOiBib29sZWFuLFxuICAgIGNoaWxkcmVuOiBDaGlsZHJlbkNhY2hlLFxuICAgIG9wdHM6IFBhdGhPcHRzLFxuICApIHtcbiAgICBzdXBlcihuYW1lLCB0eXBlLCByb290LCByb290cywgbm9jYXNlLCBjaGlsZHJlbiwgb3B0cylcbiAgfVxuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGdldFJvb3RTdHJpbmcocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gcGF0aC5zdGFydHNXaXRoKCcvJykgPyAnLycgOiAnJ1xuICB9XG5cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgZ2V0Um9vdChfcm9vdFBhdGg6IHN0cmluZyk6IFBhdGhCYXNlIHtcbiAgICByZXR1cm4gdGhpcy5yb290XG4gIH1cblxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqL1xuICBuZXdDaGlsZChuYW1lOiBzdHJpbmcsIHR5cGU6IG51bWJlciA9IFVOS05PV04sIG9wdHM6IFBhdGhPcHRzID0ge30pIHtcbiAgICByZXR1cm4gbmV3IFBhdGhQb3NpeChcbiAgICAgIG5hbWUsXG4gICAgICB0eXBlLFxuICAgICAgdGhpcy5yb290LFxuICAgICAgdGhpcy5yb290cyxcbiAgICAgIHRoaXMubm9jYXNlLFxuICAgICAgdGhpcy5jaGlsZHJlbkNhY2hlKCksXG4gICAgICBvcHRzLFxuICAgIClcbiAgfVxufVxuXG4vKipcbiAqIE9wdGlvbnMgdGhhdCBtYXkgYmUgcHJvdmlkZWQgdG8gdGhlIFBhdGhTY3VycnkgY29uc3RydWN0b3JcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQYXRoU2N1cnJ5T3B0cyB7XG4gIC8qKlxuICAgKiBwZXJmb3JtIGNhc2UtaW5zZW5zaXRpdmUgcGF0aCBtYXRjaGluZy4gRGVmYXVsdCBiYXNlZCBvbiBwbGF0Zm9ybVxuICAgKiBzdWJjbGFzcy5cbiAgICovXG4gIG5vY2FzZT86IGJvb2xlYW5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBQYXRoIGVudHJpZXMgdG8ga2VlcCBpbiB0aGUgY2FjaGUgb2YgUGF0aCBjaGlsZCByZWZlcmVuY2VzLlxuICAgKlxuICAgKiBTZXR0aW5nIHRoaXMgaGlnaGVyIHRoYW4gNjU1MzYgd2lsbCBkcmFtYXRpY2FsbHkgaW5jcmVhc2UgdGhlIGRhdGFcbiAgICogY29uc3VtcHRpb24gYW5kIGNvbnN0cnVjdGlvbiB0aW1lIG92ZXJoZWFkIG9mIGVhY2ggUGF0aFNjdXJyeS5cbiAgICpcbiAgICogU2V0dGluZyB0aGlzIHZhbHVlIHRvIDI1NiBvciBsb3dlciB3aWxsIHNpZ25pZmljYW50bHkgcmVkdWNlIHRoZSBkYXRhXG4gICAqIGNvbnN1bXB0aW9uIGFuZCBjb25zdHJ1Y3Rpb24gdGltZSBvdmVyaGVhZCwgYnV0IG1heSBhbHNvIHJlZHVjZSByZXNvbHZlKClcbiAgICogYW5kIHJlYWRkaXIoKSBwZXJmb3JtYW5jZSBvbiBsYXJnZSBmaWxlc3lzdGVtcy5cbiAgICpcbiAgICogRGVmYXVsdCBgMTYzODRgLlxuICAgKi9cbiAgY2hpbGRyZW5DYWNoZVNpemU/OiBudW1iZXJcbiAgLyoqXG4gICAqIEFuIG9iamVjdCB0aGF0IG92ZXJyaWRlcyB0aGUgYnVpbHQtaW4gZnVuY3Rpb25zIGZyb20gdGhlIGZzIGFuZFxuICAgKiBmcy9wcm9taXNlcyBtb2R1bGVzLlxuICAgKlxuICAgKiBTZWUge0BsaW5rIEZTT3B0aW9ufVxuICAgKi9cbiAgZnM/OiBGU09wdGlvblxufVxuXG4vKipcbiAqIFRoZSBiYXNlIGNsYXNzIGZvciBhbGwgUGF0aFNjdXJyeSBjbGFzc2VzLCBwcm92aWRpbmcgdGhlIGludGVyZmFjZSBmb3IgcGF0aFxuICogcmVzb2x1dGlvbiBhbmQgZmlsZXN5c3RlbSBvcGVyYXRpb25zLlxuICpcbiAqIFR5cGljYWxseSwgeW91IHNob3VsZCAqbm90KiBpbnN0YW50aWF0ZSB0aGlzIGNsYXNzIGRpcmVjdGx5LCBidXQgcmF0aGVyIG9uZVxuICogb2YgdGhlIHBsYXRmb3JtLXNwZWNpZmljIGNsYXNzZXMsIG9yIHRoZSBleHBvcnRlZCB7QGxpbmsgUGF0aFNjdXJyeX0gd2hpY2hcbiAqIGRlZmF1bHRzIHRvIHRoZSBjdXJyZW50IHBsYXRmb3JtLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgUGF0aFNjdXJyeUJhc2Uge1xuICAvKipcbiAgICogVGhlIHJvb3QgUGF0aCBlbnRyeSBmb3IgdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3Rvcnkgb2YgdGhpcyBTY3VycnlcbiAgICovXG4gIHJvb3Q6IFBhdGhCYXNlXG4gIC8qKlxuICAgKiBUaGUgc3RyaW5nIHBhdGggZm9yIHRoZSByb290IG9mIHRoaXMgU2N1cnJ5J3MgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeVxuICAgKi9cbiAgcm9vdFBhdGg6IHN0cmluZ1xuICAvKipcbiAgICogQSBjb2xsZWN0aW9uIG9mIGFsbCByb290cyBlbmNvdW50ZXJlZCwgcmVmZXJlbmNlZCBieSByb290UGF0aFxuICAgKi9cbiAgcm9vdHM6IHsgW2s6IHN0cmluZ106IFBhdGhCYXNlIH1cbiAgLyoqXG4gICAqIFRoZSBQYXRoIGVudHJ5IGNvcnJlc3BvbmRpbmcgdG8gdGhpcyBQYXRoU2N1cnJ5J3MgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeS5cbiAgICovXG4gIGN3ZDogUGF0aEJhc2VcbiAgI3Jlc29sdmVDYWNoZTogUmVzb2x2ZUNhY2hlXG4gICNyZXNvbHZlUG9zaXhDYWNoZTogUmVzb2x2ZUNhY2hlXG4gICNjaGlsZHJlbjogQ2hpbGRyZW5DYWNoZVxuICAvKipcbiAgICogUGVyZm9ybSBwYXRoIGNvbXBhcmlzb25zIGNhc2UtaW5zZW5zaXRpdmVseS5cbiAgICpcbiAgICogRGVmYXVsdHMgdHJ1ZSBvbiBEYXJ3aW4gYW5kIFdpbmRvd3Mgc3lzdGVtcywgZmFsc2UgZWxzZXdoZXJlLlxuICAgKi9cbiAgbm9jYXNlOiBib29sZWFuXG5cbiAgLyoqXG4gICAqIFRoZSBwYXRoIHNlcGFyYXRvciB1c2VkIGZvciBwYXJzaW5nIHBhdGhzXG4gICAqXG4gICAqIGAnLydgIG9uIFBvc2l4IHN5c3RlbXMsIGVpdGhlciBgJy8nYCBvciBgJ1xcXFwnYCBvbiBXaW5kb3dzXG4gICAqL1xuICBhYnN0cmFjdCBzZXA6IHN0cmluZyB8IFJlZ0V4cFxuXG4gICNmczogRlNWYWx1ZVxuXG4gIC8qKlxuICAgKiBUaGlzIGNsYXNzIHNob3VsZCBub3QgYmUgaW5zdGFudGlhdGVkIGRpcmVjdGx5LlxuICAgKlxuICAgKiBVc2UgUGF0aFNjdXJyeVdpbjMyLCBQYXRoU2N1cnJ5RGFyd2luLCBQYXRoU2N1cnJ5UG9zaXgsIG9yIFBhdGhTY3VycnlcbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBjd2Q6IFVSTCB8IHN0cmluZyA9IHByb2Nlc3MuY3dkKCksXG4gICAgcGF0aEltcGw6IHR5cGVvZiB3aW4zMiB8IHR5cGVvZiBwb3NpeCxcbiAgICBzZXA6IHN0cmluZyB8IFJlZ0V4cCxcbiAgICB7XG4gICAgICBub2Nhc2UsXG4gICAgICBjaGlsZHJlbkNhY2hlU2l6ZSA9IDE2ICogMTAyNCxcbiAgICAgIGZzID0gZGVmYXVsdEZTLFxuICAgIH06IFBhdGhTY3VycnlPcHRzID0ge30sXG4gICkge1xuICAgIHRoaXMuI2ZzID0gZnNGcm9tT3B0aW9uKGZzKVxuICAgIGlmIChjd2QgaW5zdGFuY2VvZiBVUkwgfHwgY3dkLnN0YXJ0c1dpdGgoJ2ZpbGU6Ly8nKSkge1xuICAgICAgY3dkID0gZmlsZVVSTFRvUGF0aChjd2QpXG4gICAgfVxuICAgIC8vIHJlc29sdmUgYW5kIHNwbGl0IHJvb3QsIGFuZCB0aGVuIGFkZCB0byB0aGUgc3RvcmUuXG4gICAgLy8gdGhpcyBpcyB0aGUgb25seSB0aW1lIHdlIGNhbGwgcGF0aC5yZXNvbHZlKClcbiAgICBjb25zdCBjd2RQYXRoID0gcGF0aEltcGwucmVzb2x2ZShjd2QpXG4gICAgdGhpcy5yb290cyA9IE9iamVjdC5jcmVhdGUobnVsbClcbiAgICB0aGlzLnJvb3RQYXRoID0gdGhpcy5wYXJzZVJvb3RQYXRoKGN3ZFBhdGgpXG4gICAgdGhpcy4jcmVzb2x2ZUNhY2hlID0gbmV3IFJlc29sdmVDYWNoZSgpXG4gICAgdGhpcy4jcmVzb2x2ZVBvc2l4Q2FjaGUgPSBuZXcgUmVzb2x2ZUNhY2hlKClcbiAgICB0aGlzLiNjaGlsZHJlbiA9IG5ldyBDaGlsZHJlbkNhY2hlKGNoaWxkcmVuQ2FjaGVTaXplKVxuXG4gICAgY29uc3Qgc3BsaXQgPSBjd2RQYXRoLnN1YnN0cmluZyh0aGlzLnJvb3RQYXRoLmxlbmd0aCkuc3BsaXQoc2VwKVxuICAgIC8vIHJlc29sdmUoJy8nKSBsZWF2ZXMgJycsIHNwbGl0cyB0byBbJyddLCB3ZSBkb24ndCB3YW50IHRoYXQuXG4gICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSAmJiAhc3BsaXRbMF0pIHtcbiAgICAgIHNwbGl0LnBvcCgpXG4gICAgfVxuICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgIGlmIChub2Nhc2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgJ211c3QgcHJvdmlkZSBub2Nhc2Ugc2V0dGluZyB0byBQYXRoU2N1cnJ5QmFzZSBjdG9yJyxcbiAgICAgIClcbiAgICB9XG4gICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICB0aGlzLm5vY2FzZSA9IG5vY2FzZVxuICAgIHRoaXMucm9vdCA9IHRoaXMubmV3Um9vdCh0aGlzLiNmcylcbiAgICB0aGlzLnJvb3RzW3RoaXMucm9vdFBhdGhdID0gdGhpcy5yb290XG4gICAgbGV0IHByZXY6IFBhdGhCYXNlID0gdGhpcy5yb290XG4gICAgbGV0IGxlbiA9IHNwbGl0Lmxlbmd0aCAtIDFcbiAgICBjb25zdCBqb2luU2VwID0gcGF0aEltcGwuc2VwXG4gICAgbGV0IGFicyA9IHRoaXMucm9vdFBhdGhcbiAgICBsZXQgc2F3Rmlyc3QgPSBmYWxzZVxuICAgIGZvciAoY29uc3QgcGFydCBvZiBzcGxpdCkge1xuICAgICAgY29uc3QgbCA9IGxlbi0tXG4gICAgICBwcmV2ID0gcHJldi5jaGlsZChwYXJ0LCB7XG4gICAgICAgIHJlbGF0aXZlOiBuZXcgQXJyYXkobCkuZmlsbCgnLi4nKS5qb2luKGpvaW5TZXApLFxuICAgICAgICByZWxhdGl2ZVBvc2l4OiBuZXcgQXJyYXkobCkuZmlsbCgnLi4nKS5qb2luKCcvJyksXG4gICAgICAgIGZ1bGxwYXRoOiAoYWJzICs9IChzYXdGaXJzdCA/ICcnIDogam9pblNlcCkgKyBwYXJ0KSxcbiAgICAgIH0pXG4gICAgICBzYXdGaXJzdCA9IHRydWVcbiAgICB9XG4gICAgdGhpcy5jd2QgPSBwcmV2XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBkZXB0aCBvZiBhIHByb3ZpZGVkIHBhdGgsIHN0cmluZywgb3IgdGhlIGN3ZFxuICAgKi9cbiAgZGVwdGgocGF0aDogUGF0aCB8IHN0cmluZyA9IHRoaXMuY3dkKTogbnVtYmVyIHtcbiAgICBpZiAodHlwZW9mIHBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgICBwYXRoID0gdGhpcy5jd2QucmVzb2x2ZShwYXRoKVxuICAgIH1cbiAgICByZXR1cm4gcGF0aC5kZXB0aCgpXG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgdGhlIHJvb3QgcG9ydGlvbiBvZiBhIHBhdGggc3RyaW5nXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgYWJzdHJhY3QgcGFyc2VSb290UGF0aChkaXI6IHN0cmluZyk6IHN0cmluZ1xuICAvKipcbiAgICogY3JlYXRlIGEgbmV3IFBhdGggdG8gdXNlIGFzIHJvb3QgZHVyaW5nIGNvbnN0cnVjdGlvbi5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBhYnN0cmFjdCBuZXdSb290KGZzOiBGU1ZhbHVlKTogUGF0aEJhc2VcbiAgLyoqXG4gICAqIERldGVybWluZSB3aGV0aGVyIGEgZ2l2ZW4gcGF0aCBzdHJpbmcgaXMgYWJzb2x1dGVcbiAgICovXG4gIGFic3RyYWN0IGlzQWJzb2x1dGUocDogc3RyaW5nKTogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGNhY2hlIG9mIGNoaWxkIGVudHJpZXMuICBFeHBvc2VkIHNvIHN1YmNsYXNzZXMgY2FuIGNyZWF0ZVxuICAgKiBjaGlsZCBQYXRoIG9iamVjdHMgaW4gYSBwbGF0Zm9ybS1zcGVjaWZpYyB3YXkuXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgY2hpbGRyZW5DYWNoZSgpIHtcbiAgICByZXR1cm4gdGhpcy4jY2hpbGRyZW5cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNvbHZlIG9uZSBvciBtb3JlIHBhdGggc3RyaW5ncyB0byBhIHJlc29sdmVkIHN0cmluZ1xuICAgKlxuICAgKiBTYW1lIGludGVyZmFjZSBhcyByZXF1aXJlKCdwYXRoJykucmVzb2x2ZS5cbiAgICpcbiAgICogTXVjaCBmYXN0ZXIgdGhhbiBwYXRoLnJlc29sdmUoKSB3aGVuIGNhbGxlZCBtdWx0aXBsZSB0aW1lcyBmb3IgdGhlIHNhbWVcbiAgICogcGF0aCwgYmVjYXVzZSB0aGUgcmVzb2x2ZWQgUGF0aCBvYmplY3RzIGFyZSBjYWNoZWQuICBNdWNoIHNsb3dlclxuICAgKiBvdGhlcndpc2UuXG4gICAqL1xuICByZXNvbHZlKC4uLnBhdGhzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gICAgLy8gZmlyc3QgZmlndXJlIG91dCB0aGUgbWluaW11bSBudW1iZXIgb2YgcGF0aHMgd2UgaGF2ZSB0byB0ZXN0XG4gICAgLy8gd2UgYWx3YXlzIHN0YXJ0IGF0IGN3ZCwgYnV0IGFueSBhYnNvbHV0ZXMgd2lsbCBidW1wIHRoZSBzdGFydFxuICAgIGxldCByID0gJydcbiAgICBmb3IgKGxldCBpID0gcGF0aHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IHAgPSBwYXRoc1tpXVxuICAgICAgaWYgKCFwIHx8IHAgPT09ICcuJykgY29udGludWVcbiAgICAgIHIgPSByID8gYCR7cH0vJHtyfWAgOiBwXG4gICAgICBpZiAodGhpcy5pc0Fic29sdXRlKHApKSB7XG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuI3Jlc29sdmVDYWNoZS5nZXQocilcbiAgICBpZiAoY2FjaGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBjYWNoZWRcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5jd2QucmVzb2x2ZShyKS5mdWxscGF0aCgpXG4gICAgdGhpcy4jcmVzb2x2ZUNhY2hlLnNldChyLCByZXN1bHQpXG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG5cbiAgLyoqXG4gICAqIFJlc29sdmUgb25lIG9yIG1vcmUgcGF0aCBzdHJpbmdzIHRvIGEgcmVzb2x2ZWQgc3RyaW5nLCByZXR1cm5pbmdcbiAgICogdGhlIHBvc2l4IHBhdGguICBJZGVudGljYWwgdG8gLnJlc29sdmUoKSBvbiBwb3NpeCBzeXN0ZW1zLCBidXQgb25cbiAgICogd2luZG93cyB3aWxsIHJldHVybiBhIGZvcndhcmQtc2xhc2ggc2VwYXJhdGVkIFVOQyBwYXRoLlxuICAgKlxuICAgKiBTYW1lIGludGVyZmFjZSBhcyByZXF1aXJlKCdwYXRoJykucmVzb2x2ZS5cbiAgICpcbiAgICogTXVjaCBmYXN0ZXIgdGhhbiBwYXRoLnJlc29sdmUoKSB3aGVuIGNhbGxlZCBtdWx0aXBsZSB0aW1lcyBmb3IgdGhlIHNhbWVcbiAgICogcGF0aCwgYmVjYXVzZSB0aGUgcmVzb2x2ZWQgUGF0aCBvYmplY3RzIGFyZSBjYWNoZWQuICBNdWNoIHNsb3dlclxuICAgKiBvdGhlcndpc2UuXG4gICAqL1xuICByZXNvbHZlUG9zaXgoLi4ucGF0aHM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgICAvLyBmaXJzdCBmaWd1cmUgb3V0IHRoZSBtaW5pbXVtIG51bWJlciBvZiBwYXRocyB3ZSBoYXZlIHRvIHRlc3RcbiAgICAvLyB3ZSBhbHdheXMgc3RhcnQgYXQgY3dkLCBidXQgYW55IGFic29sdXRlcyB3aWxsIGJ1bXAgdGhlIHN0YXJ0XG4gICAgbGV0IHIgPSAnJ1xuICAgIGZvciAobGV0IGkgPSBwYXRocy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgcCA9IHBhdGhzW2ldXG4gICAgICBpZiAoIXAgfHwgcCA9PT0gJy4nKSBjb250aW51ZVxuICAgICAgciA9IHIgPyBgJHtwfS8ke3J9YCA6IHBcbiAgICAgIGlmICh0aGlzLmlzQWJzb2x1dGUocCkpIHtcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy4jcmVzb2x2ZVBvc2l4Q2FjaGUuZ2V0KHIpXG4gICAgaWYgKGNhY2hlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gY2FjaGVkXG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuY3dkLnJlc29sdmUocikuZnVsbHBhdGhQb3NpeCgpXG4gICAgdGhpcy4jcmVzb2x2ZVBvc2l4Q2FjaGUuc2V0KHIsIHJlc3VsdClcbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cblxuICAvKipcbiAgICogZmluZCB0aGUgcmVsYXRpdmUgcGF0aCBmcm9tIHRoZSBjd2QgdG8gdGhlIHN1cHBsaWVkIHBhdGggc3RyaW5nIG9yIGVudHJ5XG4gICAqL1xuICByZWxhdGl2ZShlbnRyeTogUGF0aEJhc2UgfCBzdHJpbmcgPSB0aGlzLmN3ZCk6IHN0cmluZyB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2QucmVzb2x2ZShlbnRyeSlcbiAgICB9XG4gICAgcmV0dXJuIGVudHJ5LnJlbGF0aXZlKClcbiAgfVxuXG4gIC8qKlxuICAgKiBmaW5kIHRoZSByZWxhdGl2ZSBwYXRoIGZyb20gdGhlIGN3ZCB0byB0aGUgc3VwcGxpZWQgcGF0aCBzdHJpbmcgb3JcbiAgICogZW50cnksIHVzaW5nIC8gYXMgdGhlIHBhdGggZGVsaW1pdGVyLCBldmVuIG9uIFdpbmRvd3MuXG4gICAqL1xuICByZWxhdGl2ZVBvc2l4KGVudHJ5OiBQYXRoQmFzZSB8IHN0cmluZyA9IHRoaXMuY3dkKTogc3RyaW5nIHtcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgZW50cnkgPSB0aGlzLmN3ZC5yZXNvbHZlKGVudHJ5KVxuICAgIH1cbiAgICByZXR1cm4gZW50cnkucmVsYXRpdmVQb3NpeCgpXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBiYXNlbmFtZSBmb3IgdGhlIHByb3ZpZGVkIHN0cmluZyBvciBQYXRoIG9iamVjdFxuICAgKi9cbiAgYmFzZW5hbWUoZW50cnk6IFBhdGhCYXNlIHwgc3RyaW5nID0gdGhpcy5jd2QpOiBzdHJpbmcge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbnRyeSA9IHRoaXMuY3dkLnJlc29sdmUoZW50cnkpXG4gICAgfVxuICAgIHJldHVybiBlbnRyeS5uYW1lXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBkaXJuYW1lIGZvciB0aGUgcHJvdmlkZWQgc3RyaW5nIG9yIFBhdGggb2JqZWN0XG4gICAqL1xuICBkaXJuYW1lKGVudHJ5OiBQYXRoQmFzZSB8IHN0cmluZyA9IHRoaXMuY3dkKTogc3RyaW5nIHtcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgZW50cnkgPSB0aGlzLmN3ZC5yZXNvbHZlKGVudHJ5KVxuICAgIH1cbiAgICByZXR1cm4gKGVudHJ5LnBhcmVudCB8fCBlbnRyeSkuZnVsbHBhdGgoKVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhbiBhcnJheSBvZiBrbm93biBjaGlsZCBlbnRyaWVzLlxuICAgKlxuICAgKiBGaXJzdCBhcmd1bWVudCBtYXkgYmUgZWl0aGVyIGEgc3RyaW5nLCBvciBhIFBhdGggb2JqZWN0LlxuICAgKlxuICAgKiBJZiB0aGUgUGF0aCBjYW5ub3Qgb3IgZG9lcyBub3QgY29udGFpbiBhbnkgY2hpbGRyZW4sIHRoZW4gYW4gZW1wdHkgYXJyYXlcbiAgICogaXMgcmV0dXJuZWQuXG4gICAqXG4gICAqIFJlc3VsdHMgYXJlIGNhY2hlZCwgYW5kIHRodXMgbWF5IGJlIG91dCBvZiBkYXRlIGlmIHRoZSBmaWxlc3lzdGVtIGlzXG4gICAqIG11dGF0ZWQuXG4gICAqXG4gICAqIFVubGlrZSBgZnMucmVhZGRpcigpYCwgdGhlIGB3aXRoRmlsZVR5cGVzYCBvcHRpb24gZGVmYXVsdHMgdG8gYHRydWVgLiBTZXRcbiAgICogYHsgd2l0aEZpbGVUeXBlczogZmFsc2UgfWAgdG8gcmV0dXJuIHN0cmluZ3MuXG4gICAqL1xuXG4gIHJlYWRkaXIoKTogUHJvbWlzZTxQYXRoQmFzZVtdPlxuICByZWFkZGlyKG9wdHM6IHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTogUHJvbWlzZTxQYXRoQmFzZVtdPlxuICByZWFkZGlyKG9wdHM6IHsgd2l0aEZpbGVUeXBlczogZmFsc2UgfSk6IFByb21pc2U8c3RyaW5nW10+XG4gIHJlYWRkaXIob3B0czogeyB3aXRoRmlsZVR5cGVzOiBib29sZWFuIH0pOiBQcm9taXNlPFBhdGhCYXNlW10gfCBzdHJpbmdbXT5cbiAgcmVhZGRpcihlbnRyeTogUGF0aEJhc2UgfCBzdHJpbmcpOiBQcm9taXNlPFBhdGhCYXNlW10+XG4gIHJlYWRkaXIoXG4gICAgZW50cnk6IFBhdGhCYXNlIHwgc3RyaW5nLFxuICAgIG9wdHM6IHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9LFxuICApOiBQcm9taXNlPFBhdGhCYXNlW10+XG4gIHJlYWRkaXIoXG4gICAgZW50cnk6IFBhdGhCYXNlIHwgc3RyaW5nLFxuICAgIG9wdHM6IHsgd2l0aEZpbGVUeXBlczogZmFsc2UgfSxcbiAgKTogUHJvbWlzZTxzdHJpbmdbXT5cbiAgcmVhZGRpcihcbiAgICBlbnRyeTogUGF0aEJhc2UgfCBzdHJpbmcsXG4gICAgb3B0czogeyB3aXRoRmlsZVR5cGVzOiBib29sZWFuIH0sXG4gICk6IFByb21pc2U8UGF0aEJhc2VbXSB8IHN0cmluZ1tdPlxuICBhc3luYyByZWFkZGlyKFxuICAgIGVudHJ5OiBQYXRoQmFzZSB8IHN0cmluZyB8IHsgd2l0aEZpbGVUeXBlczogYm9vbGVhbiB9ID0gdGhpcy5jd2QsXG4gICAgb3B0czogeyB3aXRoRmlsZVR5cGVzOiBib29sZWFuIH0gPSB7XG4gICAgICB3aXRoRmlsZVR5cGVzOiB0cnVlLFxuICAgIH0sXG4gICk6IFByb21pc2U8UGF0aEJhc2VbXSB8IHN0cmluZ1tdPiB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2QucmVzb2x2ZShlbnRyeSlcbiAgICB9IGVsc2UgaWYgKCEoZW50cnkgaW5zdGFuY2VvZiBQYXRoQmFzZSkpIHtcbiAgICAgIG9wdHMgPSBlbnRyeVxuICAgICAgZW50cnkgPSB0aGlzLmN3ZFxuICAgIH1cbiAgICBjb25zdCB7IHdpdGhGaWxlVHlwZXMgfSA9IG9wdHNcbiAgICBpZiAoIWVudHJ5LmNhblJlYWRkaXIoKSkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHAgPSBhd2FpdCBlbnRyeS5yZWFkZGlyKClcbiAgICAgIHJldHVybiB3aXRoRmlsZVR5cGVzID8gcCA6IHAubWFwKGUgPT4gZS5uYW1lKVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBzeW5jaHJvbm91cyB7QGxpbmsgUGF0aFNjdXJyeUJhc2UucmVhZGRpcn1cbiAgICovXG4gIHJlYWRkaXJTeW5jKCk6IFBhdGhCYXNlW11cbiAgcmVhZGRpclN5bmMob3B0czogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pOiBQYXRoQmFzZVtdXG4gIHJlYWRkaXJTeW5jKG9wdHM6IHsgd2l0aEZpbGVUeXBlczogZmFsc2UgfSk6IHN0cmluZ1tdXG4gIHJlYWRkaXJTeW5jKG9wdHM6IHsgd2l0aEZpbGVUeXBlczogYm9vbGVhbiB9KTogUGF0aEJhc2VbXSB8IHN0cmluZ1tdXG4gIHJlYWRkaXJTeW5jKGVudHJ5OiBQYXRoQmFzZSB8IHN0cmluZyk6IFBhdGhCYXNlW11cbiAgcmVhZGRpclN5bmMoXG4gICAgZW50cnk6IFBhdGhCYXNlIHwgc3RyaW5nLFxuICAgIG9wdHM6IHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9LFxuICApOiBQYXRoQmFzZVtdXG4gIHJlYWRkaXJTeW5jKFxuICAgIGVudHJ5OiBQYXRoQmFzZSB8IHN0cmluZyxcbiAgICBvcHRzOiB7IHdpdGhGaWxlVHlwZXM6IGZhbHNlIH0sXG4gICk6IHN0cmluZ1tdXG4gIHJlYWRkaXJTeW5jKFxuICAgIGVudHJ5OiBQYXRoQmFzZSB8IHN0cmluZyxcbiAgICBvcHRzOiB7IHdpdGhGaWxlVHlwZXM6IGJvb2xlYW4gfSxcbiAgKTogUGF0aEJhc2VbXSB8IHN0cmluZ1tdXG4gIHJlYWRkaXJTeW5jKFxuICAgIGVudHJ5OiBQYXRoQmFzZSB8IHN0cmluZyB8IHsgd2l0aEZpbGVUeXBlczogYm9vbGVhbiB9ID0gdGhpcy5jd2QsXG4gICAgb3B0czogeyB3aXRoRmlsZVR5cGVzOiBib29sZWFuIH0gPSB7XG4gICAgICB3aXRoRmlsZVR5cGVzOiB0cnVlLFxuICAgIH0sXG4gICk6IFBhdGhCYXNlW10gfCBzdHJpbmdbXSB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2QucmVzb2x2ZShlbnRyeSlcbiAgICB9IGVsc2UgaWYgKCEoZW50cnkgaW5zdGFuY2VvZiBQYXRoQmFzZSkpIHtcbiAgICAgIG9wdHMgPSBlbnRyeVxuICAgICAgZW50cnkgPSB0aGlzLmN3ZFxuICAgIH1cbiAgICBjb25zdCB7IHdpdGhGaWxlVHlwZXMgPSB0cnVlIH0gPSBvcHRzXG4gICAgaWYgKCFlbnRyeS5jYW5SZWFkZGlyKCkpIHtcbiAgICAgIHJldHVybiBbXVxuICAgIH0gZWxzZSBpZiAod2l0aEZpbGVUeXBlcykge1xuICAgICAgcmV0dXJuIGVudHJ5LnJlYWRkaXJTeW5jKClcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGVudHJ5LnJlYWRkaXJTeW5jKCkubWFwKGUgPT4gZS5uYW1lKVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsIGxzdGF0KCkgb24gdGhlIHN0cmluZyBvciBQYXRoIG9iamVjdCwgYW5kIHVwZGF0ZSBhbGwga25vd25cbiAgICogaW5mb3JtYXRpb24gdGhhdCBjYW4gYmUgZGV0ZXJtaW5lZC5cbiAgICpcbiAgICogTm90ZSB0aGF0IHVubGlrZSBgZnMubHN0YXQoKWAsIHRoZSByZXR1cm5lZCB2YWx1ZSBkb2VzIG5vdCBjb250YWluIHNvbWVcbiAgICogaW5mb3JtYXRpb24sIHN1Y2ggYXMgYG1vZGVgLCBgZGV2YCwgYG5saW5rYCwgYW5kIGBpbm9gLiAgSWYgdGhhdFxuICAgKiBpbmZvcm1hdGlvbiBpcyByZXF1aXJlZCwgeW91IHdpbGwgbmVlZCB0byBjYWxsIGBmcy5sc3RhdGAgeW91cnNlbGYuXG4gICAqXG4gICAqIElmIHRoZSBQYXRoIHJlZmVycyB0byBhIG5vbmV4aXN0ZW50IGZpbGUsIG9yIGlmIHRoZSBsc3RhdCBjYWxsIGZhaWxzIGZvclxuICAgKiBhbnkgcmVhc29uLCBgdW5kZWZpbmVkYCBpcyByZXR1cm5lZC4gIE90aGVyd2lzZSB0aGUgdXBkYXRlZCBQYXRoIG9iamVjdCBpc1xuICAgKiByZXR1cm5lZC5cbiAgICpcbiAgICogUmVzdWx0cyBhcmUgY2FjaGVkLCBhbmQgdGh1cyBtYXkgYmUgb3V0IG9mIGRhdGUgaWYgdGhlIGZpbGVzeXN0ZW0gaXNcbiAgICogbXV0YXRlZC5cbiAgICovXG4gIGFzeW5jIGxzdGF0KFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSA9IHRoaXMuY3dkLFxuICApOiBQcm9taXNlPFBhdGhCYXNlIHwgdW5kZWZpbmVkPiB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2QucmVzb2x2ZShlbnRyeSlcbiAgICB9XG4gICAgcmV0dXJuIGVudHJ5LmxzdGF0KClcbiAgfVxuXG4gIC8qKlxuICAgKiBzeW5jaHJvbm91cyB7QGxpbmsgUGF0aFNjdXJyeUJhc2UubHN0YXR9XG4gICAqL1xuICBsc3RhdFN5bmMoZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlID0gdGhpcy5jd2QpOiBQYXRoQmFzZSB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2QucmVzb2x2ZShlbnRyeSlcbiAgICB9XG4gICAgcmV0dXJuIGVudHJ5LmxzdGF0U3luYygpXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBQYXRoIG9iamVjdCBvciBzdHJpbmcgcGF0aCBjb3JyZXNwb25kaW5nIHRvIHRoZSB0YXJnZXQgb2YgYVxuICAgKiBzeW1ib2xpYyBsaW5rLlxuICAgKlxuICAgKiBJZiB0aGUgcGF0aCBpcyBub3QgYSBzeW1ib2xpYyBsaW5rLCBvciBpZiB0aGUgcmVhZGxpbmsgY2FsbCBmYWlscyBmb3IgYW55XG4gICAqIHJlYXNvbiwgYHVuZGVmaW5lZGAgaXMgcmV0dXJuZWQuXG4gICAqXG4gICAqIFJlc3VsdCBpcyBjYWNoZWQsIGFuZCB0aHVzIG1heSBiZSBvdXRkYXRlZCBpZiB0aGUgZmlsZXN5c3RlbSBpcyBtdXRhdGVkLlxuICAgKlxuICAgKiBge3dpdGhGaWxlVHlwZXN9YCBvcHRpb24gZGVmYXVsdHMgdG8gYGZhbHNlYC5cbiAgICpcbiAgICogT24gc3VjY2VzcywgcmV0dXJucyBhIFBhdGggb2JqZWN0IGlmIGB3aXRoRmlsZVR5cGVzYCBvcHRpb24gaXMgdHJ1ZSxcbiAgICogb3RoZXJ3aXNlIGEgc3RyaW5nLlxuICAgKi9cbiAgcmVhZGxpbmsoKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+XG4gIHJlYWRsaW5rKG9wdDogeyB3aXRoRmlsZVR5cGVzOiBmYWxzZSB9KTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+XG4gIHJlYWRsaW5rKG9wdDogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pOiBQcm9taXNlPFBhdGhCYXNlIHwgdW5kZWZpbmVkPlxuICByZWFkbGluayhvcHQ6IHtcbiAgICB3aXRoRmlsZVR5cGVzOiBib29sZWFuXG4gIH0pOiBQcm9taXNlPFBhdGhCYXNlIHwgc3RyaW5nIHwgdW5kZWZpbmVkPlxuICByZWFkbGluayhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0PzogeyB3aXRoRmlsZVR5cGVzOiBmYWxzZSB9LFxuICApOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD5cbiAgcmVhZGxpbmsoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdDogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0sXG4gICk6IFByb21pc2U8UGF0aEJhc2UgfCB1bmRlZmluZWQ+XG4gIHJlYWRsaW5rKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSxcbiAgICBvcHQ6IHsgd2l0aEZpbGVUeXBlczogYm9vbGVhbiB9LFxuICApOiBQcm9taXNlPHN0cmluZyB8IFBhdGhCYXNlIHwgdW5kZWZpbmVkPlxuICBhc3luYyByZWFkbGluayhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UgfCB7IHdpdGhGaWxlVHlwZXM6IGJvb2xlYW4gfSA9IHRoaXMuY3dkLFxuICAgIHsgd2l0aEZpbGVUeXBlcyB9OiB7IHdpdGhGaWxlVHlwZXM6IGJvb2xlYW4gfSA9IHtcbiAgICAgIHdpdGhGaWxlVHlwZXM6IGZhbHNlLFxuICAgIH0sXG4gICk6IFByb21pc2U8c3RyaW5nIHwgUGF0aEJhc2UgfCB1bmRlZmluZWQ+IHtcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgZW50cnkgPSB0aGlzLmN3ZC5yZXNvbHZlKGVudHJ5KVxuICAgIH0gZWxzZSBpZiAoIShlbnRyeSBpbnN0YW5jZW9mIFBhdGhCYXNlKSkge1xuICAgICAgd2l0aEZpbGVUeXBlcyA9IGVudHJ5LndpdGhGaWxlVHlwZXNcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2RcbiAgICB9XG4gICAgY29uc3QgZSA9IGF3YWl0IGVudHJ5LnJlYWRsaW5rKClcbiAgICByZXR1cm4gd2l0aEZpbGVUeXBlcyA/IGUgOiBlPy5mdWxscGF0aCgpXG4gIH1cblxuICAvKipcbiAgICogc3luY2hyb25vdXMge0BsaW5rIFBhdGhTY3VycnlCYXNlLnJlYWRsaW5rfVxuICAgKi9cbiAgcmVhZGxpbmtTeW5jKCk6IHN0cmluZyB8IHVuZGVmaW5lZFxuICByZWFkbGlua1N5bmMob3B0OiB7IHdpdGhGaWxlVHlwZXM6IGZhbHNlIH0pOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgcmVhZGxpbmtTeW5jKG9wdDogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pOiBQYXRoQmFzZSB8IHVuZGVmaW5lZFxuICByZWFkbGlua1N5bmMob3B0OiB7XG4gICAgd2l0aEZpbGVUeXBlczogYm9vbGVhblxuICB9KTogUGF0aEJhc2UgfCBzdHJpbmcgfCB1bmRlZmluZWRcbiAgcmVhZGxpbmtTeW5jKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSxcbiAgICBvcHQ/OiB7IHdpdGhGaWxlVHlwZXM6IGZhbHNlIH0sXG4gICk6IHN0cmluZyB8IHVuZGVmaW5lZFxuICByZWFkbGlua1N5bmMoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdDogeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0sXG4gICk6IFBhdGhCYXNlIHwgdW5kZWZpbmVkXG4gIHJlYWRsaW5rU3luYyhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0OiB7IHdpdGhGaWxlVHlwZXM6IGJvb2xlYW4gfSxcbiAgKTogc3RyaW5nIHwgUGF0aEJhc2UgfCB1bmRlZmluZWRcbiAgcmVhZGxpbmtTeW5jKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSB8IHsgd2l0aEZpbGVUeXBlczogYm9vbGVhbiB9ID0gdGhpcy5jd2QsXG4gICAgeyB3aXRoRmlsZVR5cGVzIH06IHsgd2l0aEZpbGVUeXBlczogYm9vbGVhbiB9ID0ge1xuICAgICAgd2l0aEZpbGVUeXBlczogZmFsc2UsXG4gICAgfSxcbiAgKTogc3RyaW5nIHwgUGF0aEJhc2UgfCB1bmRlZmluZWQge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbnRyeSA9IHRoaXMuY3dkLnJlc29sdmUoZW50cnkpXG4gICAgfSBlbHNlIGlmICghKGVudHJ5IGluc3RhbmNlb2YgUGF0aEJhc2UpKSB7XG4gICAgICB3aXRoRmlsZVR5cGVzID0gZW50cnkud2l0aEZpbGVUeXBlc1xuICAgICAgZW50cnkgPSB0aGlzLmN3ZFxuICAgIH1cbiAgICBjb25zdCBlID0gZW50cnkucmVhZGxpbmtTeW5jKClcbiAgICByZXR1cm4gd2l0aEZpbGVUeXBlcyA/IGUgOiBlPy5mdWxscGF0aCgpXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBQYXRoIG9iamVjdCBvciBzdHJpbmcgcGF0aCBjb3JyZXNwb25kaW5nIHRvIHBhdGggYXMgcmVzb2x2ZWRcbiAgICogYnkgcmVhbHBhdGgoMykuXG4gICAqXG4gICAqIElmIHRoZSByZWFscGF0aCBjYWxsIGZhaWxzIGZvciBhbnkgcmVhc29uLCBgdW5kZWZpbmVkYCBpcyByZXR1cm5lZC5cbiAgICpcbiAgICogUmVzdWx0IGlzIGNhY2hlZCwgYW5kIHRodXMgbWF5IGJlIG91dGRhdGVkIGlmIHRoZSBmaWxlc3lzdGVtIGlzIG11dGF0ZWQuXG4gICAqXG4gICAqIGB7d2l0aEZpbGVUeXBlc31gIG9wdGlvbiBkZWZhdWx0cyB0byBgZmFsc2VgLlxuICAgKlxuICAgKiBPbiBzdWNjZXNzLCByZXR1cm5zIGEgUGF0aCBvYmplY3QgaWYgYHdpdGhGaWxlVHlwZXNgIG9wdGlvbiBpcyB0cnVlLFxuICAgKiBvdGhlcndpc2UgYSBzdHJpbmcuXG4gICAqL1xuICByZWFscGF0aCgpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD5cbiAgcmVhbHBhdGgob3B0OiB7IHdpdGhGaWxlVHlwZXM6IGZhbHNlIH0pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD5cbiAgcmVhbHBhdGgob3B0OiB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk6IFByb21pc2U8UGF0aEJhc2UgfCB1bmRlZmluZWQ+XG4gIHJlYWxwYXRoKG9wdDoge1xuICAgIHdpdGhGaWxlVHlwZXM6IGJvb2xlYW5cbiAgfSk6IFByb21pc2U8UGF0aEJhc2UgfCBzdHJpbmcgfCB1bmRlZmluZWQ+XG4gIHJlYWxwYXRoKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSxcbiAgICBvcHQ/OiB7IHdpdGhGaWxlVHlwZXM6IGZhbHNlIH0sXG4gICk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPlxuICByZWFscGF0aChcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0OiB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSxcbiAgKTogUHJvbWlzZTxQYXRoQmFzZSB8IHVuZGVmaW5lZD5cbiAgcmVhbHBhdGgoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdDogeyB3aXRoRmlsZVR5cGVzOiBib29sZWFuIH0sXG4gICk6IFByb21pc2U8c3RyaW5nIHwgUGF0aEJhc2UgfCB1bmRlZmluZWQ+XG4gIGFzeW5jIHJlYWxwYXRoKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSB8IHsgd2l0aEZpbGVUeXBlczogYm9vbGVhbiB9ID0gdGhpcy5jd2QsXG4gICAgeyB3aXRoRmlsZVR5cGVzIH06IHsgd2l0aEZpbGVUeXBlczogYm9vbGVhbiB9ID0ge1xuICAgICAgd2l0aEZpbGVUeXBlczogZmFsc2UsXG4gICAgfSxcbiAgKTogUHJvbWlzZTxzdHJpbmcgfCBQYXRoQmFzZSB8IHVuZGVmaW5lZD4ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbnRyeSA9IHRoaXMuY3dkLnJlc29sdmUoZW50cnkpXG4gICAgfSBlbHNlIGlmICghKGVudHJ5IGluc3RhbmNlb2YgUGF0aEJhc2UpKSB7XG4gICAgICB3aXRoRmlsZVR5cGVzID0gZW50cnkud2l0aEZpbGVUeXBlc1xuICAgICAgZW50cnkgPSB0aGlzLmN3ZFxuICAgIH1cbiAgICBjb25zdCBlID0gYXdhaXQgZW50cnkucmVhbHBhdGgoKVxuICAgIHJldHVybiB3aXRoRmlsZVR5cGVzID8gZSA6IGU/LmZ1bGxwYXRoKClcbiAgfVxuXG4gIHJlYWxwYXRoU3luYygpOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgcmVhbHBhdGhTeW5jKG9wdDogeyB3aXRoRmlsZVR5cGVzOiBmYWxzZSB9KTogc3RyaW5nIHwgdW5kZWZpbmVkXG4gIHJlYWxwYXRoU3luYyhvcHQ6IHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTogUGF0aEJhc2UgfCB1bmRlZmluZWRcbiAgcmVhbHBhdGhTeW5jKG9wdDoge1xuICAgIHdpdGhGaWxlVHlwZXM6IGJvb2xlYW5cbiAgfSk6IFBhdGhCYXNlIHwgc3RyaW5nIHwgdW5kZWZpbmVkXG4gIHJlYWxwYXRoU3luYyhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0PzogeyB3aXRoRmlsZVR5cGVzOiBmYWxzZSB9LFxuICApOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgcmVhbHBhdGhTeW5jKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSxcbiAgICBvcHQ6IHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9LFxuICApOiBQYXRoQmFzZSB8IHVuZGVmaW5lZFxuICByZWFscGF0aFN5bmMoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdDogeyB3aXRoRmlsZVR5cGVzOiBib29sZWFuIH0sXG4gICk6IHN0cmluZyB8IFBhdGhCYXNlIHwgdW5kZWZpbmVkXG4gIHJlYWxwYXRoU3luYyhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UgfCB7IHdpdGhGaWxlVHlwZXM6IGJvb2xlYW4gfSA9IHRoaXMuY3dkLFxuICAgIHsgd2l0aEZpbGVUeXBlcyB9OiB7IHdpdGhGaWxlVHlwZXM6IGJvb2xlYW4gfSA9IHtcbiAgICAgIHdpdGhGaWxlVHlwZXM6IGZhbHNlLFxuICAgIH0sXG4gICk6IHN0cmluZyB8IFBhdGhCYXNlIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgZW50cnkgPSB0aGlzLmN3ZC5yZXNvbHZlKGVudHJ5KVxuICAgIH0gZWxzZSBpZiAoIShlbnRyeSBpbnN0YW5jZW9mIFBhdGhCYXNlKSkge1xuICAgICAgd2l0aEZpbGVUeXBlcyA9IGVudHJ5LndpdGhGaWxlVHlwZXNcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2RcbiAgICB9XG4gICAgY29uc3QgZSA9IGVudHJ5LnJlYWxwYXRoU3luYygpXG4gICAgcmV0dXJuIHdpdGhGaWxlVHlwZXMgPyBlIDogZT8uZnVsbHBhdGgoKVxuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jaHJvbm91c2x5IHdhbGsgdGhlIGRpcmVjdG9yeSB0cmVlLCByZXR1cm5pbmcgYW4gYXJyYXkgb2ZcbiAgICogYWxsIHBhdGggc3RyaW5ncyBvciBQYXRoIG9iamVjdHMgZm91bmQuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIHdpbGwgYmUgZXh0cmVtZWx5IG1lbW9yeS1odW5ncnkgb24gbGFyZ2UgZmlsZXN5c3RlbXMuXG4gICAqIEluIHN1Y2ggY2FzZXMsIGl0IG1heSBiZSBiZXR0ZXIgdG8gdXNlIHRoZSBzdHJlYW0gb3IgYXN5bmMgaXRlcmF0b3JcbiAgICogd2FsayBpbXBsZW1lbnRhdGlvbi5cbiAgICovXG4gIHdhbGsoKTogUHJvbWlzZTxQYXRoQmFzZVtdPlxuICB3YWxrKFxuICAgIG9wdHM6IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUgfCBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNVbnNldCxcbiAgKTogUHJvbWlzZTxQYXRoQmFzZVtdPlxuICB3YWxrKG9wdHM6IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlKTogUHJvbWlzZTxzdHJpbmdbXT5cbiAgd2FsayhvcHRzOiBXYWxrT3B0aW9ucyk6IFByb21pc2U8c3RyaW5nW10gfCBQYXRoQmFzZVtdPlxuICB3YWxrKGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSk6IFByb21pc2U8UGF0aEJhc2VbXT5cbiAgd2FsayhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzVHJ1ZSB8IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1Vuc2V0LFxuICApOiBQcm9taXNlPFBhdGhCYXNlW10+XG4gIHdhbGsoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdHM6IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlLFxuICApOiBQcm9taXNlPHN0cmluZ1tdPlxuICB3YWxrKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSxcbiAgICBvcHRzOiBXYWxrT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQYXRoQmFzZVtdIHwgc3RyaW5nW10+XG4gIGFzeW5jIHdhbGsoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlIHwgV2Fsa09wdGlvbnMgPSB0aGlzLmN3ZCxcbiAgICBvcHRzOiBXYWxrT3B0aW9ucyA9IHt9LFxuICApOiBQcm9taXNlPFBhdGhCYXNlW10gfCBzdHJpbmdbXT4ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbnRyeSA9IHRoaXMuY3dkLnJlc29sdmUoZW50cnkpXG4gICAgfSBlbHNlIGlmICghKGVudHJ5IGluc3RhbmNlb2YgUGF0aEJhc2UpKSB7XG4gICAgICBvcHRzID0gZW50cnlcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2RcbiAgICB9XG4gICAgY29uc3Qge1xuICAgICAgd2l0aEZpbGVUeXBlcyA9IHRydWUsXG4gICAgICBmb2xsb3cgPSBmYWxzZSxcbiAgICAgIGZpbHRlcixcbiAgICAgIHdhbGtGaWx0ZXIsXG4gICAgfSA9IG9wdHNcbiAgICBjb25zdCByZXN1bHRzOiAoc3RyaW5nIHwgUGF0aEJhc2UpW10gPSBbXVxuICAgIGlmICghZmlsdGVyIHx8IGZpbHRlcihlbnRyeSkpIHtcbiAgICAgIHJlc3VsdHMucHVzaCh3aXRoRmlsZVR5cGVzID8gZW50cnkgOiBlbnRyeS5mdWxscGF0aCgpKVxuICAgIH1cbiAgICBjb25zdCBkaXJzID0gbmV3IFNldDxQYXRoQmFzZT4oKVxuICAgIGNvbnN0IHdhbGsgPSAoXG4gICAgICBkaXI6IFBhdGhCYXNlLFxuICAgICAgY2I6IChlcj86IE5vZGVKUy5FcnJub0V4Y2VwdGlvbikgPT4gdm9pZCxcbiAgICApID0+IHtcbiAgICAgIGRpcnMuYWRkKGRpcilcbiAgICAgIGRpci5yZWFkZGlyQ0IoKGVyLCBlbnRyaWVzKSA9PiB7XG4gICAgICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgICAgICBpZiAoZXIpIHtcbiAgICAgICAgICByZXR1cm4gY2IoZXIpXG4gICAgICAgIH1cbiAgICAgICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICAgICAgbGV0IGxlbiA9IGVudHJpZXMubGVuZ3RoXG4gICAgICAgIGlmICghbGVuKSByZXR1cm4gY2IoKVxuICAgICAgICBjb25zdCBuZXh0ID0gKCkgPT4ge1xuICAgICAgICAgIGlmICgtLWxlbiA9PT0gMCkge1xuICAgICAgICAgICAgY2IoKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGUgb2YgZW50cmllcykge1xuICAgICAgICAgIGlmICghZmlsdGVyIHx8IGZpbHRlcihlKSkge1xuICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHdpdGhGaWxlVHlwZXMgPyBlIDogZS5mdWxscGF0aCgpKVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZm9sbG93ICYmIGUuaXNTeW1ib2xpY0xpbmsoKSkge1xuICAgICAgICAgICAgZS5yZWFscGF0aCgpXG4gICAgICAgICAgICAgIC50aGVuKHIgPT4gKHI/LmlzVW5rbm93bigpID8gci5sc3RhdCgpIDogcikpXG4gICAgICAgICAgICAgIC50aGVuKHIgPT5cbiAgICAgICAgICAgICAgICByPy5zaG91bGRXYWxrKGRpcnMsIHdhbGtGaWx0ZXIpID8gd2FsayhyLCBuZXh0KSA6IG5leHQoKSxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoZS5zaG91bGRXYWxrKGRpcnMsIHdhbGtGaWx0ZXIpKSB7XG4gICAgICAgICAgICAgIHdhbGsoZSwgbmV4dClcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5leHQoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwgdHJ1ZSkgLy8gemFsZ29vb29vb29cbiAgICB9XG5cbiAgICBjb25zdCBzdGFydCA9IGVudHJ5XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFBhdGhCYXNlW10gfCBzdHJpbmdbXT4oKHJlcywgcmVqKSA9PiB7XG4gICAgICB3YWxrKHN0YXJ0LCBlciA9PiB7XG4gICAgICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgICAgICBpZiAoZXIpIHJldHVybiByZWooZXIpXG4gICAgICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgICAgIHJlcyhyZXN1bHRzIGFzIFBhdGhCYXNlW10gfCBzdHJpbmdbXSlcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5jaHJvbm91c2x5IHdhbGsgdGhlIGRpcmVjdG9yeSB0cmVlLCByZXR1cm5pbmcgYW4gYXJyYXkgb2ZcbiAgICogYWxsIHBhdGggc3RyaW5ncyBvciBQYXRoIG9iamVjdHMgZm91bmQuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIHdpbGwgYmUgZXh0cmVtZWx5IG1lbW9yeS1odW5ncnkgb24gbGFyZ2UgZmlsZXN5c3RlbXMuXG4gICAqIEluIHN1Y2ggY2FzZXMsIGl0IG1heSBiZSBiZXR0ZXIgdG8gdXNlIHRoZSBzdHJlYW0gb3IgYXN5bmMgaXRlcmF0b3JcbiAgICogd2FsayBpbXBsZW1lbnRhdGlvbi5cbiAgICovXG4gIHdhbGtTeW5jKCk6IFBhdGhCYXNlW11cbiAgd2Fsa1N5bmMoXG4gICAgb3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzVHJ1ZSB8IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1Vuc2V0LFxuICApOiBQYXRoQmFzZVtdXG4gIHdhbGtTeW5jKG9wdHM6IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlKTogc3RyaW5nW11cbiAgd2Fsa1N5bmMob3B0czogV2Fsa09wdGlvbnMpOiBzdHJpbmdbXSB8IFBhdGhCYXNlW11cbiAgd2Fsa1N5bmMoZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlKTogUGF0aEJhc2VbXVxuICB3YWxrU3luYyhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzVW5zZXQgfCBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlLFxuICApOiBQYXRoQmFzZVtdXG4gIHdhbGtTeW5jKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSxcbiAgICBvcHRzOiBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNGYWxzZSxcbiAgKTogc3RyaW5nW11cbiAgd2Fsa1N5bmMoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdHM6IFdhbGtPcHRpb25zLFxuICApOiBQYXRoQmFzZVtdIHwgc3RyaW5nW11cbiAgd2Fsa1N5bmMoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlIHwgV2Fsa09wdGlvbnMgPSB0aGlzLmN3ZCxcbiAgICBvcHRzOiBXYWxrT3B0aW9ucyA9IHt9LFxuICApOiBQYXRoQmFzZVtdIHwgc3RyaW5nW10ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbnRyeSA9IHRoaXMuY3dkLnJlc29sdmUoZW50cnkpXG4gICAgfSBlbHNlIGlmICghKGVudHJ5IGluc3RhbmNlb2YgUGF0aEJhc2UpKSB7XG4gICAgICBvcHRzID0gZW50cnlcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2RcbiAgICB9XG4gICAgY29uc3Qge1xuICAgICAgd2l0aEZpbGVUeXBlcyA9IHRydWUsXG4gICAgICBmb2xsb3cgPSBmYWxzZSxcbiAgICAgIGZpbHRlcixcbiAgICAgIHdhbGtGaWx0ZXIsXG4gICAgfSA9IG9wdHNcbiAgICBjb25zdCByZXN1bHRzOiAoc3RyaW5nIHwgUGF0aEJhc2UpW10gPSBbXVxuICAgIGlmICghZmlsdGVyIHx8IGZpbHRlcihlbnRyeSkpIHtcbiAgICAgIHJlc3VsdHMucHVzaCh3aXRoRmlsZVR5cGVzID8gZW50cnkgOiBlbnRyeS5mdWxscGF0aCgpKVxuICAgIH1cbiAgICBjb25zdCBkaXJzID0gbmV3IFNldDxQYXRoQmFzZT4oW2VudHJ5XSlcbiAgICBmb3IgKGNvbnN0IGRpciBvZiBkaXJzKSB7XG4gICAgICBjb25zdCBlbnRyaWVzID0gZGlyLnJlYWRkaXJTeW5jKClcbiAgICAgIGZvciAoY29uc3QgZSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIGlmICghZmlsdGVyIHx8IGZpbHRlcihlKSkge1xuICAgICAgICAgIHJlc3VsdHMucHVzaCh3aXRoRmlsZVR5cGVzID8gZSA6IGUuZnVsbHBhdGgoKSlcbiAgICAgICAgfVxuICAgICAgICBsZXQgcjogUGF0aEJhc2UgfCB1bmRlZmluZWQgPSBlXG4gICAgICAgIGlmIChlLmlzU3ltYm9saWNMaW5rKCkpIHtcbiAgICAgICAgICBpZiAoIShmb2xsb3cgJiYgKHIgPSBlLnJlYWxwYXRoU3luYygpKSkpIGNvbnRpbnVlXG4gICAgICAgICAgaWYgKHIuaXNVbmtub3duKCkpIHIubHN0YXRTeW5jKClcbiAgICAgICAgfVxuICAgICAgICBpZiAoci5zaG91bGRXYWxrKGRpcnMsIHdhbGtGaWx0ZXIpKSB7XG4gICAgICAgICAgZGlycy5hZGQocilcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cyBhcyBzdHJpbmdbXSB8IFBhdGhCYXNlW11cbiAgfVxuXG4gIC8qKlxuICAgKiBTdXBwb3J0IGZvciBgZm9yIGF3YWl0YFxuICAgKlxuICAgKiBBbGlhcyBmb3Ige0BsaW5rIFBhdGhTY3VycnlCYXNlLml0ZXJhdGV9XG4gICAqXG4gICAqIE5vdGU6IEFzIG9mIE5vZGUgMTksIHRoaXMgaXMgdmVyeSBzbG93LCBjb21wYXJlZCB0byBvdGhlciBtZXRob2RzIG9mXG4gICAqIHdhbGtpbmcuICBDb25zaWRlciB1c2luZyB7QGxpbmsgUGF0aFNjdXJyeUJhc2Uuc3RyZWFtfSBpZiBtZW1vcnkgb3ZlcmhlYWRcbiAgICogYW5kIGJhY2twcmVzc3VyZSBhcmUgY29uY2VybnMsIG9yIHtAbGluayBQYXRoU2N1cnJ5QmFzZS53YWxrfSBpZiBub3QuXG4gICAqL1xuICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgIHJldHVybiB0aGlzLml0ZXJhdGUoKVxuICB9XG5cbiAgLyoqXG4gICAqIEFzeW5jIGdlbmVyYXRvciBmb3JtIG9mIHtAbGluayBQYXRoU2N1cnJ5QmFzZS53YWxrfVxuICAgKlxuICAgKiBOb3RlOiBBcyBvZiBOb2RlIDE5LCB0aGlzIGlzIHZlcnkgc2xvdywgY29tcGFyZWQgdG8gb3RoZXIgbWV0aG9kcyBvZlxuICAgKiB3YWxraW5nLCBlc3BlY2lhbGx5IGlmIG1vc3QvYWxsIG9mIHRoZSBkaXJlY3RvcnkgdHJlZSBoYXMgYmVlbiBwcmV2aW91c2x5XG4gICAqIHdhbGtlZC4gIENvbnNpZGVyIHVzaW5nIHtAbGluayBQYXRoU2N1cnJ5QmFzZS5zdHJlYW19IGlmIG1lbW9yeSBvdmVyaGVhZFxuICAgKiBhbmQgYmFja3ByZXNzdXJlIGFyZSBjb25jZXJucywgb3Ige0BsaW5rIFBhdGhTY3VycnlCYXNlLndhbGt9IGlmIG5vdC5cbiAgICovXG4gIGl0ZXJhdGUoKTogQXN5bmNHZW5lcmF0b3I8UGF0aEJhc2UsIHZvaWQsIHZvaWQ+XG4gIGl0ZXJhdGUoXG4gICAgb3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzVHJ1ZSB8IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1Vuc2V0LFxuICApOiBBc3luY0dlbmVyYXRvcjxQYXRoQmFzZSwgdm9pZCwgdm9pZD5cbiAgaXRlcmF0ZShcbiAgICBvcHRzOiBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNGYWxzZSxcbiAgKTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB2b2lkPlxuICBpdGVyYXRlKG9wdHM6IFdhbGtPcHRpb25zKTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nIHwgUGF0aEJhc2UsIHZvaWQsIHZvaWQ+XG4gIGl0ZXJhdGUoZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlKTogQXN5bmNHZW5lcmF0b3I8UGF0aEJhc2UsIHZvaWQsIHZvaWQ+XG4gIGl0ZXJhdGUoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdHM6IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUgfCBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNVbnNldCxcbiAgKTogQXN5bmNHZW5lcmF0b3I8UGF0aEJhc2UsIHZvaWQsIHZvaWQ+XG4gIGl0ZXJhdGUoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdHM6IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlLFxuICApOiBBc3luY0dlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+XG4gIGl0ZXJhdGUoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdHM6IFdhbGtPcHRpb25zLFxuICApOiBBc3luY0dlbmVyYXRvcjxQYXRoQmFzZSB8IHN0cmluZywgdm9pZCwgdm9pZD5cbiAgaXRlcmF0ZShcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UgfCBXYWxrT3B0aW9ucyA9IHRoaXMuY3dkLFxuICAgIG9wdGlvbnM6IFdhbGtPcHRpb25zID0ge30sXG4gICk6IEFzeW5jR2VuZXJhdG9yPFBhdGhCYXNlIHwgc3RyaW5nLCB2b2lkLCB2b2lkPiB7XG4gICAgLy8gaXRlcmF0aW5nIGFzeW5jIG92ZXIgdGhlIHN0cmVhbSBpcyBzaWduaWZpY2FudGx5IG1vcmUgcGVyZm9ybWFudCxcbiAgICAvLyBlc3BlY2lhbGx5IGluIHRoZSB3YXJtLWNhY2hlIHNjZW5hcmlvLCBiZWNhdXNlIGl0IGJ1ZmZlcnMgdXAgZGlyZWN0b3J5XG4gICAgLy8gZW50cmllcyBpbiB0aGUgYmFja2dyb3VuZCBpbnN0ZWFkIG9mIHdhaXRpbmcgZm9yIGEgeWllbGQgZm9yIGVhY2ggb25lLlxuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbnRyeSA9IHRoaXMuY3dkLnJlc29sdmUoZW50cnkpXG4gICAgfSBlbHNlIGlmICghKGVudHJ5IGluc3RhbmNlb2YgUGF0aEJhc2UpKSB7XG4gICAgICBvcHRpb25zID0gZW50cnlcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2RcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc3RyZWFtKGVudHJ5LCBvcHRpb25zKVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKVxuICB9XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGluZyBvdmVyIGEgUGF0aFNjdXJyeSBwZXJmb3JtcyBhIHN5bmNocm9ub3VzIHdhbGsuXG4gICAqXG4gICAqIEFsaWFzIGZvciB7QGxpbmsgUGF0aFNjdXJyeUJhc2UuaXRlcmF0ZVN5bmN9XG4gICAqL1xuICBbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5pdGVyYXRlU3luYygpXG4gIH1cblxuICBpdGVyYXRlU3luYygpOiBHZW5lcmF0b3I8UGF0aEJhc2UsIHZvaWQsIHZvaWQ+XG4gIGl0ZXJhdGVTeW5jKFxuICAgIG9wdHM6IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUgfCBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNVbnNldCxcbiAgKTogR2VuZXJhdG9yPFBhdGhCYXNlLCB2b2lkLCB2b2lkPlxuICBpdGVyYXRlU3luYyhcbiAgICBvcHRzOiBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNGYWxzZSxcbiAgKTogR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD5cbiAgaXRlcmF0ZVN5bmMob3B0czogV2Fsa09wdGlvbnMpOiBHZW5lcmF0b3I8c3RyaW5nIHwgUGF0aEJhc2UsIHZvaWQsIHZvaWQ+XG4gIGl0ZXJhdGVTeW5jKGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSk6IEdlbmVyYXRvcjxQYXRoQmFzZSwgdm9pZCwgdm9pZD5cbiAgaXRlcmF0ZVN5bmMoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdHM6IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUgfCBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNVbnNldCxcbiAgKTogR2VuZXJhdG9yPFBhdGhCYXNlLCB2b2lkLCB2b2lkPlxuICBpdGVyYXRlU3luYyhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzRmFsc2UsXG4gICk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+XG4gIGl0ZXJhdGVTeW5jKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSxcbiAgICBvcHRzOiBXYWxrT3B0aW9ucyxcbiAgKTogR2VuZXJhdG9yPFBhdGhCYXNlIHwgc3RyaW5nLCB2b2lkLCB2b2lkPlxuICAqaXRlcmF0ZVN5bmMoXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlIHwgV2Fsa09wdGlvbnMgPSB0aGlzLmN3ZCxcbiAgICBvcHRzOiBXYWxrT3B0aW9ucyA9IHt9LFxuICApOiBHZW5lcmF0b3I8UGF0aEJhc2UgfCBzdHJpbmcsIHZvaWQsIHZvaWQ+IHtcbiAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgZW50cnkgPSB0aGlzLmN3ZC5yZXNvbHZlKGVudHJ5KVxuICAgIH0gZWxzZSBpZiAoIShlbnRyeSBpbnN0YW5jZW9mIFBhdGhCYXNlKSkge1xuICAgICAgb3B0cyA9IGVudHJ5XG4gICAgICBlbnRyeSA9IHRoaXMuY3dkXG4gICAgfVxuICAgIGNvbnN0IHtcbiAgICAgIHdpdGhGaWxlVHlwZXMgPSB0cnVlLFxuICAgICAgZm9sbG93ID0gZmFsc2UsXG4gICAgICBmaWx0ZXIsXG4gICAgICB3YWxrRmlsdGVyLFxuICAgIH0gPSBvcHRzXG4gICAgaWYgKCFmaWx0ZXIgfHwgZmlsdGVyKGVudHJ5KSkge1xuICAgICAgeWllbGQgd2l0aEZpbGVUeXBlcyA/IGVudHJ5IDogZW50cnkuZnVsbHBhdGgoKVxuICAgIH1cbiAgICBjb25zdCBkaXJzID0gbmV3IFNldDxQYXRoQmFzZT4oW2VudHJ5XSlcbiAgICBmb3IgKGNvbnN0IGRpciBvZiBkaXJzKSB7XG4gICAgICBjb25zdCBlbnRyaWVzID0gZGlyLnJlYWRkaXJTeW5jKClcbiAgICAgIGZvciAoY29uc3QgZSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIGlmICghZmlsdGVyIHx8IGZpbHRlcihlKSkge1xuICAgICAgICAgIHlpZWxkIHdpdGhGaWxlVHlwZXMgPyBlIDogZS5mdWxscGF0aCgpXG4gICAgICAgIH1cbiAgICAgICAgbGV0IHI6IFBhdGhCYXNlIHwgdW5kZWZpbmVkID0gZVxuICAgICAgICBpZiAoZS5pc1N5bWJvbGljTGluaygpKSB7XG4gICAgICAgICAgaWYgKCEoZm9sbG93ICYmIChyID0gZS5yZWFscGF0aFN5bmMoKSkpKSBjb250aW51ZVxuICAgICAgICAgIGlmIChyLmlzVW5rbm93bigpKSByLmxzdGF0U3luYygpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHIuc2hvdWxkV2FsayhkaXJzLCB3YWxrRmlsdGVyKSkge1xuICAgICAgICAgIGRpcnMuYWRkKHIpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3RyZWFtIGZvcm0gb2Yge0BsaW5rIFBhdGhTY3VycnlCYXNlLndhbGt9XG4gICAqXG4gICAqIFJldHVybnMgYSBNaW5pcGFzcyBzdHJlYW0gdGhhdCBlbWl0cyB7QGxpbmsgUGF0aEJhc2V9IG9iamVjdHMgYnkgZGVmYXVsdCxcbiAgICogb3Igc3RyaW5ncyBpZiBgeyB3aXRoRmlsZVR5cGVzOiBmYWxzZSB9YCBpcyBzZXQgaW4gdGhlIG9wdGlvbnMuXG4gICAqL1xuICBzdHJlYW0oKTogTWluaXBhc3M8UGF0aEJhc2U+XG4gIHN0cmVhbShcbiAgICBvcHRzOiBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlIHwgV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzVW5zZXQsXG4gICk6IE1pbmlwYXNzPFBhdGhCYXNlPlxuICBzdHJlYW0ob3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzRmFsc2UpOiBNaW5pcGFzczxzdHJpbmc+XG4gIHN0cmVhbShvcHRzOiBXYWxrT3B0aW9ucyk6IE1pbmlwYXNzPHN0cmluZyB8IFBhdGhCYXNlPlxuICBzdHJlYW0oZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlKTogTWluaXBhc3M8UGF0aEJhc2U+XG4gIHN0cmVhbShcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzVW5zZXQgfCBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlLFxuICApOiBNaW5pcGFzczxQYXRoQmFzZT5cbiAgc3RyZWFtKFxuICAgIGVudHJ5OiBzdHJpbmcgfCBQYXRoQmFzZSxcbiAgICBvcHRzOiBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNGYWxzZSxcbiAgKTogTWluaXBhc3M8c3RyaW5nPlxuICBzdHJlYW0oXG4gICAgZW50cnk6IHN0cmluZyB8IFBhdGhCYXNlLFxuICAgIG9wdHM6IFdhbGtPcHRpb25zLFxuICApOiBNaW5pcGFzczxzdHJpbmc+IHwgTWluaXBhc3M8UGF0aEJhc2U+XG4gIHN0cmVhbShcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UgfCBXYWxrT3B0aW9ucyA9IHRoaXMuY3dkLFxuICAgIG9wdHM6IFdhbGtPcHRpb25zID0ge30sXG4gICk6IE1pbmlwYXNzPHN0cmluZz4gfCBNaW5pcGFzczxQYXRoQmFzZT4ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbnRyeSA9IHRoaXMuY3dkLnJlc29sdmUoZW50cnkpXG4gICAgfSBlbHNlIGlmICghKGVudHJ5IGluc3RhbmNlb2YgUGF0aEJhc2UpKSB7XG4gICAgICBvcHRzID0gZW50cnlcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2RcbiAgICB9XG4gICAgY29uc3Qge1xuICAgICAgd2l0aEZpbGVUeXBlcyA9IHRydWUsXG4gICAgICBmb2xsb3cgPSBmYWxzZSxcbiAgICAgIGZpbHRlcixcbiAgICAgIHdhbGtGaWx0ZXIsXG4gICAgfSA9IG9wdHNcbiAgICBjb25zdCByZXN1bHRzID0gbmV3IE1pbmlwYXNzPHN0cmluZyB8IFBhdGhCYXNlPih7IG9iamVjdE1vZGU6IHRydWUgfSlcbiAgICBpZiAoIWZpbHRlciB8fCBmaWx0ZXIoZW50cnkpKSB7XG4gICAgICByZXN1bHRzLndyaXRlKHdpdGhGaWxlVHlwZXMgPyBlbnRyeSA6IGVudHJ5LmZ1bGxwYXRoKCkpXG4gICAgfVxuICAgIGNvbnN0IGRpcnMgPSBuZXcgU2V0PFBhdGhCYXNlPigpXG4gICAgY29uc3QgcXVldWU6IFBhdGhCYXNlW10gPSBbZW50cnldXG4gICAgbGV0IHByb2Nlc3NpbmcgPSAwXG4gICAgY29uc3QgcHJvY2VzcyA9ICgpID0+IHtcbiAgICAgIGxldCBwYXVzZWQgPSBmYWxzZVxuICAgICAgd2hpbGUgKCFwYXVzZWQpIHtcbiAgICAgICAgY29uc3QgZGlyID0gcXVldWUuc2hpZnQoKVxuICAgICAgICBpZiAoIWRpcikge1xuICAgICAgICAgIGlmIChwcm9jZXNzaW5nID09PSAwKSByZXN1bHRzLmVuZCgpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzaW5nKytcbiAgICAgICAgZGlycy5hZGQoZGlyKVxuXG4gICAgICAgIGNvbnN0IG9uUmVhZGRpciA9IChcbiAgICAgICAgICBlcjogbnVsbCB8IE5vZGVKUy5FcnJub0V4Y2VwdGlvbixcbiAgICAgICAgICBlbnRyaWVzOiBQYXRoQmFzZVtdLFxuICAgICAgICAgIGRpZFJlYWxwYXRoczogYm9vbGVhbiA9IGZhbHNlLFxuICAgICAgICApID0+IHtcbiAgICAgICAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICAgICAgICBpZiAoZXIpIHJldHVybiByZXN1bHRzLmVtaXQoJ2Vycm9yJywgZXIpXG4gICAgICAgICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICAgICAgICBpZiAoZm9sbG93ICYmICFkaWRSZWFscGF0aHMpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb21pc2VzOiBQcm9taXNlPFBhdGhCYXNlIHwgdW5kZWZpbmVkPltdID0gW11cbiAgICAgICAgICAgIGZvciAoY29uc3QgZSBvZiBlbnRyaWVzKSB7XG4gICAgICAgICAgICAgIGlmIChlLmlzU3ltYm9saWNMaW5rKCkpIHtcbiAgICAgICAgICAgICAgICBwcm9taXNlcy5wdXNoKFxuICAgICAgICAgICAgICAgICAgZVxuICAgICAgICAgICAgICAgICAgICAucmVhbHBhdGgoKVxuICAgICAgICAgICAgICAgICAgICAudGhlbigocjogUGF0aEJhc2UgfCB1bmRlZmluZWQpID0+XG4gICAgICAgICAgICAgICAgICAgICAgcj8uaXNVbmtub3duKCkgPyByLmxzdGF0KCkgOiByLFxuICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHByb21pc2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigoKSA9PlxuICAgICAgICAgICAgICAgIG9uUmVhZGRpcihudWxsLCBlbnRyaWVzLCB0cnVlKSxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGUgb2YgZW50cmllcykge1xuICAgICAgICAgICAgaWYgKGUgJiYgKCFmaWx0ZXIgfHwgZmlsdGVyKGUpKSkge1xuICAgICAgICAgICAgICBpZiAoIXJlc3VsdHMud3JpdGUod2l0aEZpbGVUeXBlcyA/IGUgOiBlLmZ1bGxwYXRoKCkpKSB7XG4gICAgICAgICAgICAgICAgcGF1c2VkID0gdHJ1ZVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcHJvY2Vzc2luZy0tXG4gICAgICAgICAgZm9yIChjb25zdCBlIG9mIGVudHJpZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHIgPSBlLnJlYWxwYXRoQ2FjaGVkKCkgfHwgZVxuICAgICAgICAgICAgaWYgKHIuc2hvdWxkV2FsayhkaXJzLCB3YWxrRmlsdGVyKSkge1xuICAgICAgICAgICAgICBxdWV1ZS5wdXNoKHIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwYXVzZWQgJiYgIXJlc3VsdHMuZmxvd2luZykge1xuICAgICAgICAgICAgcmVzdWx0cy5vbmNlKCdkcmFpbicsIHByb2Nlc3MpXG4gICAgICAgICAgfSBlbHNlIGlmICghc3luYykge1xuICAgICAgICAgICAgcHJvY2VzcygpXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gemFsZ28gY29udGFpbm1lbnRcbiAgICAgICAgbGV0IHN5bmMgPSB0cnVlXG4gICAgICAgIGRpci5yZWFkZGlyQ0Iob25SZWFkZGlyLCB0cnVlKVxuICAgICAgICBzeW5jID0gZmFsc2VcbiAgICAgIH1cbiAgICB9XG4gICAgcHJvY2VzcygpXG4gICAgcmV0dXJuIHJlc3VsdHMgYXMgTWluaXBhc3M8c3RyaW5nPiB8IE1pbmlwYXNzPFBhdGhCYXNlPlxuICB9XG5cbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzIGZvcm0gb2Yge0BsaW5rIFBhdGhTY3VycnlCYXNlLnN0cmVhbX1cbiAgICpcbiAgICogUmV0dXJucyBhIE1pbmlwYXNzIHN0cmVhbSB0aGF0IGVtaXRzIHtAbGluayBQYXRoQmFzZX0gb2JqZWN0cyBieSBkZWZhdWx0LFxuICAgKiBvciBzdHJpbmdzIGlmIGB7IHdpdGhGaWxlVHlwZXM6IGZhbHNlIH1gIGlzIHNldCBpbiB0aGUgb3B0aW9ucy5cbiAgICpcbiAgICogV2lsbCBjb21wbGV0ZSB0aGUgd2FsayBpbiBhIHNpbmdsZSB0aWNrIGlmIHRoZSBzdHJlYW0gaXMgY29uc3VtZWQgZnVsbHkuXG4gICAqIE90aGVyd2lzZSwgd2lsbCBwYXVzZSBhcyBuZWVkZWQgZm9yIHN0cmVhbSBiYWNrcHJlc3N1cmUuXG4gICAqL1xuICBzdHJlYW1TeW5jKCk6IE1pbmlwYXNzPFBhdGhCYXNlPlxuICBzdHJlYW1TeW5jKFxuICAgIG9wdHM6IFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUgfCBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNVbnNldCxcbiAgKTogTWluaXBhc3M8UGF0aEJhc2U+XG4gIHN0cmVhbVN5bmMob3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzRmFsc2UpOiBNaW5pcGFzczxzdHJpbmc+XG4gIHN0cmVhbVN5bmMob3B0czogV2Fsa09wdGlvbnMpOiBNaW5pcGFzczxzdHJpbmcgfCBQYXRoQmFzZT5cbiAgc3RyZWFtU3luYyhlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UpOiBNaW5pcGFzczxQYXRoQmFzZT5cbiAgc3RyZWFtU3luYyhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzVW5zZXQgfCBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlLFxuICApOiBNaW5pcGFzczxQYXRoQmFzZT5cbiAgc3RyZWFtU3luYyhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0czogV2Fsa09wdGlvbnNXaXRoRmlsZVR5cGVzRmFsc2UsXG4gICk6IE1pbmlwYXNzPHN0cmluZz5cbiAgc3RyZWFtU3luYyhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UsXG4gICAgb3B0czogV2Fsa09wdGlvbnMsXG4gICk6IE1pbmlwYXNzPHN0cmluZz4gfCBNaW5pcGFzczxQYXRoQmFzZT5cbiAgc3RyZWFtU3luYyhcbiAgICBlbnRyeTogc3RyaW5nIHwgUGF0aEJhc2UgfCBXYWxrT3B0aW9ucyA9IHRoaXMuY3dkLFxuICAgIG9wdHM6IFdhbGtPcHRpb25zID0ge30sXG4gICk6IE1pbmlwYXNzPHN0cmluZz4gfCBNaW5pcGFzczxQYXRoQmFzZT4ge1xuICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbnRyeSA9IHRoaXMuY3dkLnJlc29sdmUoZW50cnkpXG4gICAgfSBlbHNlIGlmICghKGVudHJ5IGluc3RhbmNlb2YgUGF0aEJhc2UpKSB7XG4gICAgICBvcHRzID0gZW50cnlcbiAgICAgIGVudHJ5ID0gdGhpcy5jd2RcbiAgICB9XG4gICAgY29uc3Qge1xuICAgICAgd2l0aEZpbGVUeXBlcyA9IHRydWUsXG4gICAgICBmb2xsb3cgPSBmYWxzZSxcbiAgICAgIGZpbHRlcixcbiAgICAgIHdhbGtGaWx0ZXIsXG4gICAgfSA9IG9wdHNcbiAgICBjb25zdCByZXN1bHRzID0gbmV3IE1pbmlwYXNzPHN0cmluZyB8IFBhdGhCYXNlPih7IG9iamVjdE1vZGU6IHRydWUgfSlcbiAgICBjb25zdCBkaXJzID0gbmV3IFNldDxQYXRoQmFzZT4oKVxuICAgIGlmICghZmlsdGVyIHx8IGZpbHRlcihlbnRyeSkpIHtcbiAgICAgIHJlc3VsdHMud3JpdGUod2l0aEZpbGVUeXBlcyA/IGVudHJ5IDogZW50cnkuZnVsbHBhdGgoKSlcbiAgICB9XG4gICAgY29uc3QgcXVldWU6IFBhdGhCYXNlW10gPSBbZW50cnldXG4gICAgbGV0IHByb2Nlc3NpbmcgPSAwXG4gICAgY29uc3QgcHJvY2VzcyA9ICgpID0+IHtcbiAgICAgIGxldCBwYXVzZWQgPSBmYWxzZVxuICAgICAgd2hpbGUgKCFwYXVzZWQpIHtcbiAgICAgICAgY29uc3QgZGlyID0gcXVldWUuc2hpZnQoKVxuICAgICAgICBpZiAoIWRpcikge1xuICAgICAgICAgIGlmIChwcm9jZXNzaW5nID09PSAwKSByZXN1bHRzLmVuZCgpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgcHJvY2Vzc2luZysrXG4gICAgICAgIGRpcnMuYWRkKGRpcilcblxuICAgICAgICBjb25zdCBlbnRyaWVzID0gZGlyLnJlYWRkaXJTeW5jKClcbiAgICAgICAgZm9yIChjb25zdCBlIG9mIGVudHJpZXMpIHtcbiAgICAgICAgICBpZiAoIWZpbHRlciB8fCBmaWx0ZXIoZSkpIHtcbiAgICAgICAgICAgIGlmICghcmVzdWx0cy53cml0ZSh3aXRoRmlsZVR5cGVzID8gZSA6IGUuZnVsbHBhdGgoKSkpIHtcbiAgICAgICAgICAgICAgcGF1c2VkID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBwcm9jZXNzaW5nLS1cbiAgICAgICAgZm9yIChjb25zdCBlIG9mIGVudHJpZXMpIHtcbiAgICAgICAgICBsZXQgcjogUGF0aEJhc2UgfCB1bmRlZmluZWQgPSBlXG4gICAgICAgICAgaWYgKGUuaXNTeW1ib2xpY0xpbmsoKSkge1xuICAgICAgICAgICAgaWYgKCEoZm9sbG93ICYmIChyID0gZS5yZWFscGF0aFN5bmMoKSkpKSBjb250aW51ZVxuICAgICAgICAgICAgaWYgKHIuaXNVbmtub3duKCkpIHIubHN0YXRTeW5jKClcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHIuc2hvdWxkV2FsayhkaXJzLCB3YWxrRmlsdGVyKSkge1xuICAgICAgICAgICAgcXVldWUucHVzaChyKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHBhdXNlZCAmJiAhcmVzdWx0cy5mbG93aW5nKSByZXN1bHRzLm9uY2UoJ2RyYWluJywgcHJvY2VzcylcbiAgICB9XG4gICAgcHJvY2VzcygpXG4gICAgcmV0dXJuIHJlc3VsdHMgYXMgTWluaXBhc3M8c3RyaW5nPiB8IE1pbmlwYXNzPFBhdGhCYXNlPlxuICB9XG5cbiAgY2hkaXIocGF0aDogc3RyaW5nIHwgUGF0aCA9IHRoaXMuY3dkKSB7XG4gICAgY29uc3Qgb2xkQ3dkID0gdGhpcy5jd2RcbiAgICB0aGlzLmN3ZCA9IHR5cGVvZiBwYXRoID09PSAnc3RyaW5nJyA/IHRoaXMuY3dkLnJlc29sdmUocGF0aCkgOiBwYXRoXG4gICAgdGhpcy5jd2Rbc2V0QXNDd2RdKG9sZEN3ZClcbiAgfVxufVxuXG4vKipcbiAqIE9wdGlvbnMgcHJvdmlkZWQgdG8gYWxsIHdhbGsgbWV0aG9kcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBXYWxrT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBSZXR1cm4gcmVzdWx0cyBhcyB7QGxpbmsgUGF0aEJhc2V9IG9iamVjdHMgcmF0aGVyIHRoYW4gc3RyaW5ncy5cbiAgICogV2hlbiBzZXQgdG8gZmFsc2UsIHJlc3VsdHMgYXJlIGZ1bGx5IHJlc29sdmVkIHBhdGhzLCBhcyByZXR1cm5lZCBieVxuICAgKiB7QGxpbmsgUGF0aEJhc2UuZnVsbHBhdGh9LlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICB3aXRoRmlsZVR5cGVzPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiAgQXR0ZW1wdCB0byByZWFkIGRpcmVjdG9yeSBlbnRyaWVzIGZyb20gc3ltYm9saWMgbGlua3MuIE90aGVyd2lzZSwgb25seVxuICAgKiAgYWN0dWFsIGRpcmVjdG9yaWVzIGFyZSB0cmF2ZXJzZWQuIFJlZ2FyZGxlc3Mgb2YgdGhpcyBzZXR0aW5nLCBhIGdpdmVuXG4gICAqICB0YXJnZXQgcGF0aCB3aWxsIG9ubHkgZXZlciBiZSB3YWxrZWQgb25jZSwgbWVhbmluZyB0aGF0IGEgc3ltYm9saWMgbGlua1xuICAgKiAgdG8gYSBwcmV2aW91c2x5IHRyYXZlcnNlZCBkaXJlY3Rvcnkgd2lsbCBuZXZlciBiZSBmb2xsb3dlZC5cbiAgICpcbiAgICogIFNldHRpbmcgdGhpcyBpbXBvc2VzIGEgc2xpZ2h0IHBlcmZvcm1hbmNlIHBlbmFsdHksIGJlY2F1c2UgYHJlYWRsaW5rYFxuICAgKiAgbXVzdCBiZSBjYWxsZWQgb24gYWxsIHN5bWJvbGljIGxpbmtzIGVuY291bnRlcmVkLCBpbiBvcmRlciB0byBhdm9pZFxuICAgKiAgaW5maW5pdGUgY3ljbGVzLlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgZm9sbG93PzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBPbmx5IHJldHVybiBlbnRyaWVzIHdoZXJlIHRoZSBwcm92aWRlZCBmdW5jdGlvbiByZXR1cm5zIHRydWUuXG4gICAqXG4gICAqIFRoaXMgd2lsbCBub3QgcHJldmVudCBkaXJlY3RvcmllcyBmcm9tIGJlaW5nIHRyYXZlcnNlZCwgZXZlbiBpZiB0aGV5IGRvXG4gICAqIG5vdCBwYXNzIHRoZSBmaWx0ZXIsIHRob3VnaCBpdCB3aWxsIHByZXZlbnQgZGlyZWN0b3JpZXMgdGhlbXNlbHZlcyBmcm9tXG4gICAqIGJlaW5nIGluY2x1ZGVkIGluIHRoZSByZXN1bHQgc2V0LiAgU2VlIHtAbGluayB3YWxrRmlsdGVyfVxuICAgKlxuICAgKiBBc3luY2hyb25vdXMgZnVuY3Rpb25zIGFyZSBub3Qgc3VwcG9ydGVkIGhlcmUuXG4gICAqXG4gICAqIEJ5IGRlZmF1bHQsIGlmIG5vIGZpbHRlciBpcyBwcm92aWRlZCwgYWxsIGVudHJpZXMgYW5kIHRyYXZlcnNlZFxuICAgKiBkaXJlY3RvcmllcyBhcmUgaW5jbHVkZWQuXG4gICAqL1xuICBmaWx0ZXI/OiAoZW50cnk6IFBhdGhCYXNlKSA9PiBib29sZWFuXG5cbiAgLyoqXG4gICAqIE9ubHkgdHJhdmVyc2UgZGlyZWN0b3JpZXMgKGFuZCBpbiB0aGUgY2FzZSBvZiB7QGxpbmsgZm9sbG93fSBiZWluZyBzZXQgdG9cbiAgICogdHJ1ZSwgc3ltYm9saWMgbGlua3MgdG8gZGlyZWN0b3JpZXMpIGlmIHRoZSBwcm92aWRlZCBmdW5jdGlvbiByZXR1cm5zXG4gICAqIHRydWUuXG4gICAqXG4gICAqIFRoaXMgd2lsbCBub3QgcHJldmVudCBkaXJlY3RvcmllcyBmcm9tIGJlaW5nIGluY2x1ZGVkIGluIHRoZSByZXN1bHQgc2V0LFxuICAgKiBldmVuIGlmIHRoZXkgZG8gbm90IHBhc3MgdGhlIHN1cHBsaWVkIGZpbHRlciBmdW5jdGlvbi4gIFNlZSB7QGxpbmsgZmlsdGVyfVxuICAgKiB0byBkbyB0aGF0LlxuICAgKlxuICAgKiBBc3luY2hyb25vdXMgZnVuY3Rpb25zIGFyZSBub3Qgc3VwcG9ydGVkIGhlcmUuXG4gICAqL1xuICB3YWxrRmlsdGVyPzogKGVudHJ5OiBQYXRoQmFzZSkgPT4gYm9vbGVhblxufVxuXG5leHBvcnQgdHlwZSBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNVbnNldCA9IFdhbGtPcHRpb25zICYge1xuICB3aXRoRmlsZVR5cGVzPzogdW5kZWZpbmVkXG59XG5leHBvcnQgdHlwZSBXYWxrT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlID0gV2Fsa09wdGlvbnMgJiB7XG4gIHdpdGhGaWxlVHlwZXM6IHRydWVcbn1cbmV4cG9ydCB0eXBlIFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlID0gV2Fsa09wdGlvbnMgJiB7XG4gIHdpdGhGaWxlVHlwZXM6IGZhbHNlXG59XG5cbi8qKlxuICogV2luZG93cyBpbXBsZW1lbnRhdGlvbiBvZiB7QGxpbmsgUGF0aFNjdXJyeUJhc2V9XG4gKlxuICogRGVmYXVsdHMgdG8gY2FzZSBpbnNlbnNpdHZlLCB1c2VzIGAnXFxcXCdgIHRvIGdlbmVyYXRlIHBhdGggc3RyaW5ncy4gIFVzZXNcbiAqIHtAbGluayBQYXRoV2luMzJ9IGZvciBQYXRoIG9iamVjdHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXRoU2N1cnJ5V2luMzIgZXh0ZW5kcyBQYXRoU2N1cnJ5QmFzZSB7XG4gIC8qKlxuICAgKiBzZXBhcmF0b3IgZm9yIGdlbmVyYXRpbmcgcGF0aCBzdHJpbmdzXG4gICAqL1xuICBzZXA6ICdcXFxcJyA9ICdcXFxcJ1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGN3ZDogVVJMIHwgc3RyaW5nID0gcHJvY2Vzcy5jd2QoKSxcbiAgICBvcHRzOiBQYXRoU2N1cnJ5T3B0cyA9IHt9LFxuICApIHtcbiAgICBjb25zdCB7IG5vY2FzZSA9IHRydWUgfSA9IG9wdHNcbiAgICBzdXBlcihjd2QsIHdpbjMyLCAnXFxcXCcsIHsgLi4ub3B0cywgbm9jYXNlIH0pXG4gICAgdGhpcy5ub2Nhc2UgPSBub2Nhc2VcbiAgICBmb3IgKGxldCBwOiBQYXRoQmFzZSB8IHVuZGVmaW5lZCA9IHRoaXMuY3dkOyBwOyBwID0gcC5wYXJlbnQpIHtcbiAgICAgIHAubm9jYXNlID0gdGhpcy5ub2Nhc2VcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqL1xuICBwYXJzZVJvb3RQYXRoKGRpcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBpZiB0aGUgcGF0aCBzdGFydHMgd2l0aCBhIHNpbmdsZSBzZXBhcmF0b3IsIGl0J3Mgbm90IGEgVU5DLCBhbmQgd2UnbGxcbiAgICAvLyBqdXN0IGdldCBzZXBhcmF0b3IgYXMgdGhlIHJvb3QsIGFuZCBkcml2ZUZyb21VTkMgd2lsbCByZXR1cm4gXFxcbiAgICAvLyBJbiB0aGF0IGNhc2UsIG1vdW50IFxcIG9uIHRoZSByb290IGZyb20gdGhlIGN3ZC5cbiAgICByZXR1cm4gd2luMzIucGFyc2UoZGlyKS5yb290LnRvVXBwZXJDYXNlKClcbiAgfVxuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIG5ld1Jvb3QoZnM6IEZTVmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFBhdGhXaW4zMihcbiAgICAgIHRoaXMucm9vdFBhdGgsXG4gICAgICBJRkRJUixcbiAgICAgIHVuZGVmaW5lZCxcbiAgICAgIHRoaXMucm9vdHMsXG4gICAgICB0aGlzLm5vY2FzZSxcbiAgICAgIHRoaXMuY2hpbGRyZW5DYWNoZSgpLFxuICAgICAgeyBmcyB9LFxuICAgIClcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdHJ1ZSBpZiB0aGUgcHJvdmlkZWQgcGF0aCBzdHJpbmcgaXMgYW4gYWJzb2x1dGUgcGF0aFxuICAgKi9cbiAgaXNBYnNvbHV0ZShwOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKFxuICAgICAgcC5zdGFydHNXaXRoKCcvJykgfHwgcC5zdGFydHNXaXRoKCdcXFxcJykgfHwgL15bYS16XTooXFwvfFxcXFwpL2kudGVzdChwKVxuICAgIClcbiAgfVxufVxuXG4vKipcbiAqIHtAbGluayBQYXRoU2N1cnJ5QmFzZX0gaW1wbGVtZW50YXRpb24gZm9yIGFsbCBwb3NpeCBzeXN0ZW1zIG90aGVyIHRoYW4gRGFyd2luLlxuICpcbiAqIERlZmF1bHRzIHRvIGNhc2Utc2Vuc2l0aXZlIG1hdGNoaW5nLCB1c2VzIGAnLydgIHRvIGdlbmVyYXRlIHBhdGggc3RyaW5ncy5cbiAqXG4gKiBVc2VzIHtAbGluayBQYXRoUG9zaXh9IGZvciBQYXRoIG9iamVjdHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXRoU2N1cnJ5UG9zaXggZXh0ZW5kcyBQYXRoU2N1cnJ5QmFzZSB7XG4gIC8qKlxuICAgKiBzZXBhcmF0b3IgZm9yIGdlbmVyYXRpbmcgcGF0aCBzdHJpbmdzXG4gICAqL1xuICBzZXA6ICcvJyA9ICcvJ1xuICBjb25zdHJ1Y3RvcihcbiAgICBjd2Q6IFVSTCB8IHN0cmluZyA9IHByb2Nlc3MuY3dkKCksXG4gICAgb3B0czogUGF0aFNjdXJyeU9wdHMgPSB7fSxcbiAgKSB7XG4gICAgY29uc3QgeyBub2Nhc2UgPSBmYWxzZSB9ID0gb3B0c1xuICAgIHN1cGVyKGN3ZCwgcG9zaXgsICcvJywgeyAuLi5vcHRzLCBub2Nhc2UgfSlcbiAgICB0aGlzLm5vY2FzZSA9IG5vY2FzZVxuICB9XG5cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgcGFyc2VSb290UGF0aChfZGlyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiAnLydcbiAgfVxuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIG5ld1Jvb3QoZnM6IEZTVmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFBhdGhQb3NpeChcbiAgICAgIHRoaXMucm9vdFBhdGgsXG4gICAgICBJRkRJUixcbiAgICAgIHVuZGVmaW5lZCxcbiAgICAgIHRoaXMucm9vdHMsXG4gICAgICB0aGlzLm5vY2FzZSxcbiAgICAgIHRoaXMuY2hpbGRyZW5DYWNoZSgpLFxuICAgICAgeyBmcyB9LFxuICAgIClcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdHJ1ZSBpZiB0aGUgcHJvdmlkZWQgcGF0aCBzdHJpbmcgaXMgYW4gYWJzb2x1dGUgcGF0aFxuICAgKi9cbiAgaXNBYnNvbHV0ZShwOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gcC5zdGFydHNXaXRoKCcvJylcbiAgfVxufVxuXG4vKipcbiAqIHtAbGluayBQYXRoU2N1cnJ5QmFzZX0gaW1wbGVtZW50YXRpb24gZm9yIERhcndpbiAobWFjT1MpIHN5c3RlbXMuXG4gKlxuICogRGVmYXVsdHMgdG8gY2FzZS1pbnNlbnNpdGl2ZSBtYXRjaGluZywgdXNlcyBgJy8nYCBmb3IgZ2VuZXJhdGluZyBwYXRoXG4gKiBzdHJpbmdzLlxuICpcbiAqIFVzZXMge0BsaW5rIFBhdGhQb3NpeH0gZm9yIFBhdGggb2JqZWN0cy5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhdGhTY3VycnlEYXJ3aW4gZXh0ZW5kcyBQYXRoU2N1cnJ5UG9zaXgge1xuICBjb25zdHJ1Y3RvcihcbiAgICBjd2Q6IFVSTCB8IHN0cmluZyA9IHByb2Nlc3MuY3dkKCksXG4gICAgb3B0czogUGF0aFNjdXJyeU9wdHMgPSB7fSxcbiAgKSB7XG4gICAgY29uc3QgeyBub2Nhc2UgPSB0cnVlIH0gPSBvcHRzXG4gICAgc3VwZXIoY3dkLCB7IC4uLm9wdHMsIG5vY2FzZSB9KVxuICB9XG59XG5cbi8qKlxuICogRGVmYXVsdCB7QGxpbmsgUGF0aEJhc2V9IGltcGxlbWVudGF0aW9uIGZvciB0aGUgY3VycmVudCBwbGF0Zm9ybS5cbiAqXG4gKiB7QGxpbmsgUGF0aFdpbjMyfSBvbiBXaW5kb3dzIHN5c3RlbXMsIHtAbGluayBQYXRoUG9zaXh9IG9uIGFsbCBvdGhlcnMuXG4gKi9cbmV4cG9ydCBjb25zdCBQYXRoID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/IFBhdGhXaW4zMiA6IFBhdGhQb3NpeFxuZXhwb3J0IHR5cGUgUGF0aCA9IFBhdGhCYXNlIHwgSW5zdGFuY2VUeXBlPHR5cGVvZiBQYXRoPlxuXG4vKipcbiAqIERlZmF1bHQge0BsaW5rIFBhdGhTY3VycnlCYXNlfSBpbXBsZW1lbnRhdGlvbiBmb3IgdGhlIGN1cnJlbnQgcGxhdGZvcm0uXG4gKlxuICoge0BsaW5rIFBhdGhTY3VycnlXaW4zMn0gb24gV2luZG93cyBzeXN0ZW1zLCB7QGxpbmsgUGF0aFNjdXJyeURhcndpbn0gb25cbiAqIERhcndpbiAobWFjT1MpIHN5c3RlbXMsIHtAbGluayBQYXRoU2N1cnJ5UG9zaXh9IG9uIGFsbCBvdGhlcnMuXG4gKi9cbmV4cG9ydCBjb25zdCBQYXRoU2N1cnJ5OlxuICB8IHR5cGVvZiBQYXRoU2N1cnJ5V2luMzJcbiAgfCB0eXBlb2YgUGF0aFNjdXJyeURhcndpblxuICB8IHR5cGVvZiBQYXRoU2N1cnJ5UG9zaXggPVxuICBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInID8gUGF0aFNjdXJyeVdpbjMyXG4gIDogcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2RhcndpbicgPyBQYXRoU2N1cnJ5RGFyd2luXG4gIDogUGF0aFNjdXJyeVBvc2l4XG5leHBvcnQgdHlwZSBQYXRoU2N1cnJ5ID0gUGF0aFNjdXJyeUJhc2UgfCBJbnN0YW5jZVR5cGU8dHlwZW9mIFBhdGhTY3Vycnk+XG4iLCAiY29uc3QgcHJvYyA9XG4gIHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJiBwcm9jZXNzXG4gICAgPyBwcm9jZXNzXG4gICAgOiB7XG4gICAgICAgIHN0ZG91dDogbnVsbCxcbiAgICAgICAgc3RkZXJyOiBudWxsLFxuICAgICAgfVxuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnbm9kZTpldmVudHMnXG5pbXBvcnQgU3RyZWFtIGZyb20gJ25vZGU6c3RyZWFtJ1xuaW1wb3J0IHsgU3RyaW5nRGVjb2RlciB9IGZyb20gJ25vZGU6c3RyaW5nX2RlY29kZXInXG5cbi8qKlxuICogU2FtZSBhcyBTdHJpbmdEZWNvZGVyLCBidXQgZXhwb3NpbmcgdGhlIGBsYXN0TmVlZGAgZmxhZyBvbiB0aGUgdHlwZVxuICovXG50eXBlIFNEID0gU3RyaW5nRGVjb2RlciAmIHsgbGFzdE5lZWQ6IGJvb2xlYW4gfVxuXG5leHBvcnQgdHlwZSB7IFNELCBQaXBlLCBQaXBlUHJveHlFcnJvcnMgfVxuXG4vKipcbiAqIFJldHVybiB0cnVlIGlmIHRoZSBhcmd1bWVudCBpcyBhIE1pbmlwYXNzIHN0cmVhbSwgTm9kZSBzdHJlYW0sIG9yIHNvbWV0aGluZ1xuICogZWxzZSB0aGF0IE1pbmlwYXNzIGNhbiBpbnRlcmFjdCB3aXRoLlxuICovXG5leHBvcnQgY29uc3QgaXNTdHJlYW0gPSAoXG4gIHM6IGFueVxuKTogcyBpcyBNaW5pcGFzcy5SZWFkYWJsZSB8IE1pbmlwYXNzLldyaXRhYmxlID0+XG4gICEhcyAmJlxuICB0eXBlb2YgcyA9PT0gJ29iamVjdCcgJiZcbiAgKHMgaW5zdGFuY2VvZiBNaW5pcGFzcyB8fFxuICAgIHMgaW5zdGFuY2VvZiBTdHJlYW0gfHxcbiAgICBpc1JlYWRhYmxlKHMpIHx8XG4gICAgaXNXcml0YWJsZShzKSlcblxuLyoqXG4gKiBSZXR1cm4gdHJ1ZSBpZiB0aGUgYXJndW1lbnQgaXMgYSB2YWxpZCB7QGxpbmsgTWluaXBhc3MuUmVhZGFibGV9XG4gKi9cbmV4cG9ydCBjb25zdCBpc1JlYWRhYmxlID0gKHM6IGFueSk6IHMgaXMgTWluaXBhc3MuUmVhZGFibGUgPT5cbiAgISFzICYmXG4gIHR5cGVvZiBzID09PSAnb2JqZWN0JyAmJlxuICBzIGluc3RhbmNlb2YgRXZlbnRFbWl0dGVyICYmXG4gIHR5cGVvZiAocyBhcyBNaW5pcGFzcy5SZWFkYWJsZSkucGlwZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAvLyBub2RlIGNvcmUgV3JpdGFibGUgc3RyZWFtcyBoYXZlIGEgcGlwZSgpIG1ldGhvZCwgYnV0IGl0IHRocm93c1xuICAocyBhcyBNaW5pcGFzcy5SZWFkYWJsZSkucGlwZSAhPT0gU3RyZWFtLldyaXRhYmxlLnByb3RvdHlwZS5waXBlXG5cbi8qKlxuICogUmV0dXJuIHRydWUgaWYgdGhlIGFyZ3VtZW50IGlzIGEgdmFsaWQge0BsaW5rIE1pbmlwYXNzLldyaXRhYmxlfVxuICovXG5leHBvcnQgY29uc3QgaXNXcml0YWJsZSA9IChzOiBhbnkpOiBzIGlzIE1pbmlwYXNzLlJlYWRhYmxlID0+XG4gICEhcyAmJlxuICB0eXBlb2YgcyA9PT0gJ29iamVjdCcgJiZcbiAgcyBpbnN0YW5jZW9mIEV2ZW50RW1pdHRlciAmJlxuICB0eXBlb2YgKHMgYXMgTWluaXBhc3MuV3JpdGFibGUpLndyaXRlID09PSAnZnVuY3Rpb24nICYmXG4gIHR5cGVvZiAocyBhcyBNaW5pcGFzcy5Xcml0YWJsZSkuZW5kID09PSAnZnVuY3Rpb24nXG5cbmNvbnN0IEVPRiA9IFN5bWJvbCgnRU9GJylcbmNvbnN0IE1BWUJFX0VNSVRfRU5EID0gU3ltYm9sKCdtYXliZUVtaXRFbmQnKVxuY29uc3QgRU1JVFRFRF9FTkQgPSBTeW1ib2woJ2VtaXR0ZWRFbmQnKVxuY29uc3QgRU1JVFRJTkdfRU5EID0gU3ltYm9sKCdlbWl0dGluZ0VuZCcpXG5jb25zdCBFTUlUVEVEX0VSUk9SID0gU3ltYm9sKCdlbWl0dGVkRXJyb3InKVxuY29uc3QgQ0xPU0VEID0gU3ltYm9sKCdjbG9zZWQnKVxuY29uc3QgUkVBRCA9IFN5bWJvbCgncmVhZCcpXG5jb25zdCBGTFVTSCA9IFN5bWJvbCgnZmx1c2gnKVxuY29uc3QgRkxVU0hDSFVOSyA9IFN5bWJvbCgnZmx1c2hDaHVuaycpXG5jb25zdCBFTkNPRElORyA9IFN5bWJvbCgnZW5jb2RpbmcnKVxuY29uc3QgREVDT0RFUiA9IFN5bWJvbCgnZGVjb2RlcicpXG5jb25zdCBGTE9XSU5HID0gU3ltYm9sKCdmbG93aW5nJylcbmNvbnN0IFBBVVNFRCA9IFN5bWJvbCgncGF1c2VkJylcbmNvbnN0IFJFU1VNRSA9IFN5bWJvbCgncmVzdW1lJylcbmNvbnN0IEJVRkZFUiA9IFN5bWJvbCgnYnVmZmVyJylcbmNvbnN0IFBJUEVTID0gU3ltYm9sKCdwaXBlcycpXG5jb25zdCBCVUZGRVJMRU5HVEggPSBTeW1ib2woJ2J1ZmZlckxlbmd0aCcpXG5jb25zdCBCVUZGRVJQVVNIID0gU3ltYm9sKCdidWZmZXJQdXNoJylcbmNvbnN0IEJVRkZFUlNISUZUID0gU3ltYm9sKCdidWZmZXJTaGlmdCcpXG5jb25zdCBPQkpFQ1RNT0RFID0gU3ltYm9sKCdvYmplY3RNb2RlJylcbi8vIGludGVybmFsIGV2ZW50IHdoZW4gc3RyZWFtIGlzIGRlc3Ryb3llZFxuY29uc3QgREVTVFJPWUVEID0gU3ltYm9sKCdkZXN0cm95ZWQnKVxuLy8gaW50ZXJuYWwgZXZlbnQgd2hlbiBzdHJlYW0gaGFzIGFuIGVycm9yXG5jb25zdCBFUlJPUiA9IFN5bWJvbCgnZXJyb3InKVxuY29uc3QgRU1JVERBVEEgPSBTeW1ib2woJ2VtaXREYXRhJylcbmNvbnN0IEVNSVRFTkQgPSBTeW1ib2woJ2VtaXRFbmQnKVxuY29uc3QgRU1JVEVORDIgPSBTeW1ib2woJ2VtaXRFbmQyJylcbmNvbnN0IEFTWU5DID0gU3ltYm9sKCdhc3luYycpXG5jb25zdCBBQk9SVCA9IFN5bWJvbCgnYWJvcnQnKVxuY29uc3QgQUJPUlRFRCA9IFN5bWJvbCgnYWJvcnRlZCcpXG5jb25zdCBTSUdOQUwgPSBTeW1ib2woJ3NpZ25hbCcpXG5jb25zdCBEQVRBTElTVEVORVJTID0gU3ltYm9sKCdkYXRhTGlzdGVuZXJzJylcbmNvbnN0IERJU0NBUkRFRCA9IFN5bWJvbCgnZGlzY2FyZGVkJylcblxuY29uc3QgZGVmZXIgPSAoZm46ICguLi5hOiBhbnlbXSkgPT4gYW55KSA9PiBQcm9taXNlLnJlc29sdmUoKS50aGVuKGZuKVxuY29uc3Qgbm9kZWZlciA9IChmbjogKC4uLmE6IGFueVtdKSA9PiBhbnkpID0+IGZuKClcblxuLy8gZXZlbnRzIHRoYXQgbWVhbiAndGhlIHN0cmVhbSBpcyBvdmVyJ1xuLy8gdGhlc2UgYXJlIHRyZWF0ZWQgc3BlY2lhbGx5LCBhbmQgcmUtZW1pdHRlZFxuLy8gaWYgdGhleSBhcmUgbGlzdGVuZWQgZm9yIGFmdGVyIGVtaXR0aW5nLlxudHlwZSBFbmRpc2hFdmVudCA9ICdlbmQnIHwgJ2ZpbmlzaCcgfCAncHJlZmluaXNoJ1xuY29uc3QgaXNFbmRpc2ggPSAoZXY6IGFueSk6IGV2IGlzIEVuZGlzaEV2ZW50ID0+XG4gIGV2ID09PSAnZW5kJyB8fCBldiA9PT0gJ2ZpbmlzaCcgfHwgZXYgPT09ICdwcmVmaW5pc2gnXG5cbmNvbnN0IGlzQXJyYXlCdWZmZXJMaWtlID0gKGI6IGFueSk6IGIgaXMgQXJyYXlCdWZmZXJMaWtlID0+XG4gIGIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciB8fFxuICAoISFiICYmXG4gICAgdHlwZW9mIGIgPT09ICdvYmplY3QnICYmXG4gICAgYi5jb25zdHJ1Y3RvciAmJlxuICAgIGIuY29uc3RydWN0b3IubmFtZSA9PT0gJ0FycmF5QnVmZmVyJyAmJlxuICAgIGIuYnl0ZUxlbmd0aCA+PSAwKVxuXG5jb25zdCBpc0FycmF5QnVmZmVyVmlldyA9IChiOiBhbnkpOiBiIGlzIEFycmF5QnVmZmVyVmlldyA9PlxuICAhQnVmZmVyLmlzQnVmZmVyKGIpICYmIEFycmF5QnVmZmVyLmlzVmlldyhiKVxuXG4vKipcbiAqIE9wdGlvbnMgdGhhdCBtYXkgYmUgcGFzc2VkIHRvIHN0cmVhbS5waXBlKClcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQaXBlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBlbmQgdGhlIGRlc3RpbmF0aW9uIHN0cmVhbSB3aGVuIHRoZSBzb3VyY2Ugc3RyZWFtIGVuZHNcbiAgICovXG4gIGVuZD86IGJvb2xlYW5cbiAgLyoqXG4gICAqIHByb3h5IGVycm9ycyBmcm9tIHRoZSBzb3VyY2Ugc3RyZWFtIHRvIHRoZSBkZXN0aW5hdGlvbiBzdHJlYW1cbiAgICovXG4gIHByb3h5RXJyb3JzPzogYm9vbGVhblxufVxuXG4vKipcbiAqIEludGVybmFsIGNsYXNzIHJlcHJlc2VudGluZyBhIHBpcGUgdG8gYSBkZXN0aW5hdGlvbiBzdHJlYW0uXG4gKlxuICogQGludGVybmFsXG4gKi9cbmNsYXNzIFBpcGU8VCBleHRlbmRzIHVua25vd24+IHtcbiAgc3JjOiBNaW5pcGFzczxUPlxuICBkZXN0OiBNaW5pcGFzczxhbnksIFQ+XG4gIG9wdHM6IFBpcGVPcHRpb25zXG4gIG9uZHJhaW46ICgpID0+IGFueVxuICBjb25zdHJ1Y3RvcihcbiAgICBzcmM6IE1pbmlwYXNzPFQ+LFxuICAgIGRlc3Q6IE1pbmlwYXNzLldyaXRhYmxlLFxuICAgIG9wdHM6IFBpcGVPcHRpb25zXG4gICkge1xuICAgIHRoaXMuc3JjID0gc3JjXG4gICAgdGhpcy5kZXN0ID0gZGVzdCBhcyBNaW5pcGFzczxhbnksIFQ+XG4gICAgdGhpcy5vcHRzID0gb3B0c1xuICAgIHRoaXMub25kcmFpbiA9ICgpID0+IHNyY1tSRVNVTUVdKClcbiAgICB0aGlzLmRlc3Qub24oJ2RyYWluJywgdGhpcy5vbmRyYWluKVxuICB9XG4gIHVucGlwZSgpIHtcbiAgICB0aGlzLmRlc3QucmVtb3ZlTGlzdGVuZXIoJ2RyYWluJywgdGhpcy5vbmRyYWluKVxuICB9XG4gIC8vIG9ubHkgaGVyZSBmb3IgdGhlIHByb3RvdHlwZVxuICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgcHJveHlFcnJvcnMoX2VyOiBhbnkpIHt9XG4gIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gIGVuZCgpIHtcbiAgICB0aGlzLnVucGlwZSgpXG4gICAgaWYgKHRoaXMub3B0cy5lbmQpIHRoaXMuZGVzdC5lbmQoKVxuICB9XG59XG5cbi8qKlxuICogSW50ZXJuYWwgY2xhc3MgcmVwcmVzZW50aW5nIGEgcGlwZSB0byBhIGRlc3RpbmF0aW9uIHN0cmVhbSB3aGVyZVxuICogZXJyb3JzIGFyZSBwcm94aWVkLlxuICpcbiAqIEBpbnRlcm5hbFxuICovXG5jbGFzcyBQaXBlUHJveHlFcnJvcnM8VD4gZXh0ZW5kcyBQaXBlPFQ+IHtcbiAgdW5waXBlKCkge1xuICAgIHRoaXMuc3JjLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIHRoaXMucHJveHlFcnJvcnMpXG4gICAgc3VwZXIudW5waXBlKClcbiAgfVxuICBjb25zdHJ1Y3RvcihcbiAgICBzcmM6IE1pbmlwYXNzPFQ+LFxuICAgIGRlc3Q6IE1pbmlwYXNzLldyaXRhYmxlLFxuICAgIG9wdHM6IFBpcGVPcHRpb25zXG4gICkge1xuICAgIHN1cGVyKHNyYywgZGVzdCwgb3B0cylcbiAgICB0aGlzLnByb3h5RXJyb3JzID0gZXIgPT4gZGVzdC5lbWl0KCdlcnJvcicsIGVyKVxuICAgIHNyYy5vbignZXJyb3InLCB0aGlzLnByb3h5RXJyb3JzKVxuICB9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgTWluaXBhc3Mge1xuICAvKipcbiAgICogRW5jb2RpbmcgdXNlZCB0byBjcmVhdGUgYSBzdHJlYW0gdGhhdCBvdXRwdXRzIHN0cmluZ3MgcmF0aGVyIHRoYW5cbiAgICogQnVmZmVyIG9iamVjdHMuXG4gICAqL1xuICBleHBvcnQgdHlwZSBFbmNvZGluZyA9IEJ1ZmZlckVuY29kaW5nIHwgJ2J1ZmZlcicgfCBudWxsXG5cbiAgLyoqXG4gICAqIEFueSBzdHJlYW0gdGhhdCBNaW5pcGFzcyBjYW4gcGlwZSBpbnRvXG4gICAqL1xuICBleHBvcnQgdHlwZSBXcml0YWJsZSA9XG4gICAgfCBNaW5pcGFzczxhbnksIGFueSwgYW55PlxuICAgIHwgTm9kZUpTLldyaXRlU3RyZWFtXG4gICAgfCAoTm9kZUpTLldyaXRlU3RyZWFtICYgeyBmZDogbnVtYmVyIH0pXG4gICAgfCAoRXZlbnRFbWl0dGVyICYge1xuICAgICAgICBlbmQoKTogYW55XG4gICAgICAgIHdyaXRlKGNodW5rOiBhbnksIC4uLmFyZ3M6IGFueVtdKTogYW55XG4gICAgICB9KVxuXG4gIC8qKlxuICAgKiBBbnkgc3RyZWFtIHRoYXQgY2FuIGJlIHJlYWQgZnJvbVxuICAgKi9cbiAgZXhwb3J0IHR5cGUgUmVhZGFibGUgPVxuICAgIHwgTWluaXBhc3M8YW55LCBhbnksIGFueT5cbiAgICB8IE5vZGVKUy5SZWFkU3RyZWFtXG4gICAgfCAoTm9kZUpTLlJlYWRTdHJlYW0gJiB7IGZkOiBudW1iZXIgfSlcbiAgICB8IChFdmVudEVtaXR0ZXIgJiB7XG4gICAgICAgIHBhdXNlKCk6IGFueVxuICAgICAgICByZXN1bWUoKTogYW55XG4gICAgICAgIHBpcGUoLi4uZGVzdEFyZ3M6IGFueVtdKTogYW55XG4gICAgICB9KVxuXG4gIC8qKlxuICAgKiBVdGlsaXR5IHR5cGUgdGhhdCBjYW4gYmUgaXRlcmF0ZWQgc3luYyBvciBhc3luY1xuICAgKi9cbiAgZXhwb3J0IHR5cGUgRHVhbEl0ZXJhYmxlPFQ+ID0gSXRlcmFibGU8VD4gJiBBc3luY0l0ZXJhYmxlPFQ+XG5cbiAgdHlwZSBFdmVudEFyZ3VtZW50cyA9IFJlY29yZDxzdHJpbmcgfCBzeW1ib2wsIHVua25vd25bXT5cblxuICAvKipcbiAgICogVGhlIGxpc3Rpbmcgb2YgZXZlbnRzIHRoYXQgYSBNaW5pcGFzcyBjbGFzcyBjYW4gZW1pdC5cbiAgICogRXh0ZW5kIHRoaXMgd2hlbiBleHRlbmRpbmcgdGhlIE1pbmlwYXNzIGNsYXNzLCBhbmQgcGFzcyBhc1xuICAgKiB0aGUgdGhpcmQgdGVtcGxhdGUgYXJndW1lbnQuICBUaGUga2V5IGlzIHRoZSBuYW1lIG9mIHRoZSBldmVudCxcbiAgICogYW5kIHRoZSB2YWx1ZSBpcyB0aGUgYXJndW1lbnQgbGlzdC5cbiAgICpcbiAgICogQW55IHVuZGVjbGFyZWQgZXZlbnRzIHdpbGwgc3RpbGwgYmUgYWxsb3dlZCwgYnV0IHRoZSBoYW5kbGVyIHdpbGwgZ2V0XG4gICAqIGFyZ3VtZW50cyBhcyBgdW5rbm93bltdYC5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgRXZlbnRzPFJUeXBlIGV4dGVuZHMgYW55ID0gQnVmZmVyPlxuICAgIGV4dGVuZHMgRXZlbnRBcmd1bWVudHMge1xuICAgIHJlYWRhYmxlOiBbXVxuICAgIGRhdGE6IFtjaHVuazogUlR5cGVdXG4gICAgZXJyb3I6IFtlcjogdW5rbm93bl1cbiAgICBhYm9ydDogW3JlYXNvbjogdW5rbm93bl1cbiAgICBkcmFpbjogW11cbiAgICByZXN1bWU6IFtdXG4gICAgZW5kOiBbXVxuICAgIGZpbmlzaDogW11cbiAgICBwcmVmaW5pc2g6IFtdXG4gICAgY2xvc2U6IFtdXG4gICAgW0RFU1RST1lFRF06IFtlcj86IHVua25vd25dXG4gICAgW0VSUk9SXTogW2VyOiB1bmtub3duXVxuICB9XG5cbiAgLyoqXG4gICAqIFN0cmluZyBvciBidWZmZXItbGlrZSBkYXRhIHRoYXQgY2FuIGJlIGpvaW5lZCBhbmQgc2xpY2VkXG4gICAqL1xuICBleHBvcnQgdHlwZSBDb250aWd1b3VzRGF0YSA9XG4gICAgfCBCdWZmZXJcbiAgICB8IEFycmF5QnVmZmVyTGlrZVxuICAgIHwgQXJyYXlCdWZmZXJWaWV3XG4gICAgfCBzdHJpbmdcbiAgZXhwb3J0IHR5cGUgQnVmZmVyT3JTdHJpbmcgPSBCdWZmZXIgfCBzdHJpbmdcblxuICAvKipcbiAgICogT3B0aW9ucyBwYXNzZWQgdG8gdGhlIE1pbmlwYXNzIGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgZXhwb3J0IHR5cGUgU2hhcmVkT3B0aW9ucyA9IHtcbiAgICAvKipcbiAgICAgKiBEZWZlciBhbGwgZGF0YSBlbWlzc2lvbiBhbmQgb3RoZXIgZXZlbnRzIHVudGlsIHRoZSBlbmQgb2YgdGhlXG4gICAgICogY3VycmVudCB0aWNrLCBzaW1pbGFyIHRvIE5vZGUgY29yZSBzdHJlYW1zXG4gICAgICovXG4gICAgYXN5bmM/OiBib29sZWFuXG4gICAgLyoqXG4gICAgICogQSBzaWduYWwgd2hpY2ggd2lsbCBhYm9ydCB0aGUgc3RyZWFtXG4gICAgICovXG4gICAgc2lnbmFsPzogQWJvcnRTaWduYWxcbiAgICAvKipcbiAgICAgKiBPdXRwdXQgc3RyaW5nIGVuY29kaW5nLiBTZXQgdG8gYG51bGxgIG9yIGAnYnVmZmVyJ2AgKG9yIG9taXQpIHRvXG4gICAgICogZW1pdCBCdWZmZXIgb2JqZWN0cyByYXRoZXIgdGhhbiBzdHJpbmdzLlxuICAgICAqXG4gICAgICogQ29uZmxpY3RzIHdpdGggYG9iamVjdE1vZGVgXG4gICAgICovXG4gICAgZW5jb2Rpbmc/OiBCdWZmZXJFbmNvZGluZyB8IG51bGwgfCAnYnVmZmVyJ1xuICAgIC8qKlxuICAgICAqIE91dHB1dCBkYXRhIGV4YWN0bHkgYXMgaXQgd2FzIHdyaXR0ZW4sIHN1cHBvcnRpbmcgbm9uLWJ1ZmZlci9zdHJpbmdcbiAgICAgKiBkYXRhIChzdWNoIGFzIGFyYml0cmFyeSBvYmplY3RzLCBmYWxzZXkgdmFsdWVzLCBldGMuKVxuICAgICAqXG4gICAgICogQ29uZmxpY3RzIHdpdGggYGVuY29kaW5nYFxuICAgICAqL1xuICAgIG9iamVjdE1vZGU/OiBib29sZWFuXG4gIH1cblxuICAvKipcbiAgICogT3B0aW9ucyBmb3IgYSBzdHJpbmcgZW5jb2RlZCBvdXRwdXRcbiAgICovXG4gIGV4cG9ydCB0eXBlIEVuY29kaW5nT3B0aW9ucyA9IFNoYXJlZE9wdGlvbnMgJiB7XG4gICAgZW5jb2Rpbmc6IEJ1ZmZlckVuY29kaW5nXG4gICAgb2JqZWN0TW9kZT86IGZhbHNlXG4gIH1cblxuICAvKipcbiAgICogT3B0aW9ucyBmb3IgY29udGlndW91cyBkYXRhIGJ1ZmZlciBvdXRwdXRcbiAgICovXG4gIGV4cG9ydCB0eXBlIEJ1ZmZlck9wdGlvbnMgPSBTaGFyZWRPcHRpb25zICYge1xuICAgIGVuY29kaW5nPzogbnVsbCB8ICdidWZmZXInXG4gICAgb2JqZWN0TW9kZT86IGZhbHNlXG4gIH1cblxuICAvKipcbiAgICogT3B0aW9ucyBmb3Igb2JqZWN0TW9kZSBhcmJpdHJhcnkgb3V0cHV0XG4gICAqL1xuICBleHBvcnQgdHlwZSBPYmplY3RNb2RlT3B0aW9ucyA9IFNoYXJlZE9wdGlvbnMgJiB7XG4gICAgb2JqZWN0TW9kZTogdHJ1ZVxuICAgIGVuY29kaW5nPzogbnVsbFxuICB9XG5cbiAgLyoqXG4gICAqIFV0aWxpdHkgdHlwZSB0byBkZXRlcm1pbmUgYWxsb3dlZCBvcHRpb25zIGJhc2VkIG9uIHJlYWQgdHlwZVxuICAgKi9cbiAgZXhwb3J0IHR5cGUgT3B0aW9uczxUPiA9XG4gICAgfCBPYmplY3RNb2RlT3B0aW9uc1xuICAgIHwgKFQgZXh0ZW5kcyBzdHJpbmdcbiAgICAgICAgPyBFbmNvZGluZ09wdGlvbnNcbiAgICAgICAgOiBUIGV4dGVuZHMgQnVmZmVyXG4gICAgICAgID8gQnVmZmVyT3B0aW9uc1xuICAgICAgICA6IFNoYXJlZE9wdGlvbnMpXG59XG5cbmNvbnN0IGlzT2JqZWN0TW9kZU9wdGlvbnMgPSAoXG4gIG86IE1pbmlwYXNzLlNoYXJlZE9wdGlvbnNcbik6IG8gaXMgTWluaXBhc3MuT2JqZWN0TW9kZU9wdGlvbnMgPT4gISFvLm9iamVjdE1vZGVcblxuY29uc3QgaXNFbmNvZGluZ09wdGlvbnMgPSAoXG4gIG86IE1pbmlwYXNzLlNoYXJlZE9wdGlvbnNcbik6IG8gaXMgTWluaXBhc3MuRW5jb2RpbmdPcHRpb25zID0+XG4gICFvLm9iamVjdE1vZGUgJiYgISFvLmVuY29kaW5nICYmIG8uZW5jb2RpbmcgIT09ICdidWZmZXInXG5cbi8qKlxuICogTWFpbiBleHBvcnQsIHRoZSBNaW5pcGFzcyBjbGFzc1xuICpcbiAqIGBSVHlwZWAgaXMgdGhlIHR5cGUgb2YgZGF0YSBlbWl0dGVkLCBkZWZhdWx0cyB0byBCdWZmZXJcbiAqXG4gKiBgV1R5cGVgIGlzIHRoZSB0eXBlIG9mIGRhdGEgdG8gYmUgd3JpdHRlbiwgaWYgUlR5cGUgaXMgYnVmZmVyIG9yIHN0cmluZyxcbiAqIHRoZW4gYW55IHtAbGluayBNaW5pcGFzcy5Db250aWd1b3VzRGF0YX0gaXMgYWxsb3dlZC5cbiAqXG4gKiBgRXZlbnRzYCBpcyB0aGUgc2V0IG9mIGV2ZW50IGhhbmRsZXIgc2lnbmF0dXJlcyB0aGF0IHRoaXMgb2JqZWN0XG4gKiB3aWxsIGVtaXQsIHNlZSB7QGxpbmsgTWluaXBhc3MuRXZlbnRzfVxuICovXG5leHBvcnQgY2xhc3MgTWluaXBhc3M8XG4gICAgUlR5cGUgZXh0ZW5kcyB1bmtub3duID0gQnVmZmVyLFxuICAgIFdUeXBlIGV4dGVuZHMgdW5rbm93biA9IFJUeXBlIGV4dGVuZHMgTWluaXBhc3MuQnVmZmVyT3JTdHJpbmdcbiAgICAgID8gTWluaXBhc3MuQ29udGlndW91c0RhdGFcbiAgICAgIDogUlR5cGUsXG4gICAgRXZlbnRzIGV4dGVuZHMgTWluaXBhc3MuRXZlbnRzPFJUeXBlPiA9IE1pbmlwYXNzLkV2ZW50czxSVHlwZT5cbiAgPlxuICBleHRlbmRzIEV2ZW50RW1pdHRlclxuICBpbXBsZW1lbnRzIE1pbmlwYXNzLkR1YWxJdGVyYWJsZTxSVHlwZT5cbntcbiAgW0ZMT1dJTkddOiBib29sZWFuID0gZmFsc2U7XG4gIFtQQVVTRURdOiBib29sZWFuID0gZmFsc2U7XG4gIFtQSVBFU106IFBpcGU8UlR5cGU+W10gPSBbXTtcbiAgW0JVRkZFUl06IFJUeXBlW10gPSBbXTtcbiAgW09CSkVDVE1PREVdOiBib29sZWFuO1xuICBbRU5DT0RJTkddOiBCdWZmZXJFbmNvZGluZyB8IG51bGw7XG4gIFtBU1lOQ106IGJvb2xlYW47XG4gIFtERUNPREVSXTogU0QgfCBudWxsO1xuICBbRU9GXTogYm9vbGVhbiA9IGZhbHNlO1xuICBbRU1JVFRFRF9FTkRdOiBib29sZWFuID0gZmFsc2U7XG4gIFtFTUlUVElOR19FTkRdOiBib29sZWFuID0gZmFsc2U7XG4gIFtDTE9TRURdOiBib29sZWFuID0gZmFsc2U7XG4gIFtFTUlUVEVEX0VSUk9SXTogdW5rbm93biA9IG51bGw7XG4gIFtCVUZGRVJMRU5HVEhdOiBudW1iZXIgPSAwO1xuICBbREVTVFJPWUVEXTogYm9vbGVhbiA9IGZhbHNlO1xuICBbU0lHTkFMXT86IEFib3J0U2lnbmFsO1xuICBbQUJPUlRFRF06IGJvb2xlYW4gPSBmYWxzZTtcbiAgW0RBVEFMSVNURU5FUlNdOiBudW1iZXIgPSAwO1xuICBbRElTQ0FSREVEXTogYm9vbGVhbiA9IGZhbHNlXG5cbiAgLyoqXG4gICAqIHRydWUgaWYgdGhlIHN0cmVhbSBjYW4gYmUgd3JpdHRlblxuICAgKi9cbiAgd3JpdGFibGU6IGJvb2xlYW4gPSB0cnVlXG4gIC8qKlxuICAgKiB0cnVlIGlmIHRoZSBzdHJlYW0gY2FuIGJlIHJlYWRcbiAgICovXG4gIHJlYWRhYmxlOiBib29sZWFuID0gdHJ1ZVxuXG4gIC8qKlxuICAgKiBJZiBgUlR5cGVgIGlzIEJ1ZmZlciwgdGhlbiBvcHRpb25zIGRvIG5vdCBuZWVkIHRvIGJlIHByb3ZpZGVkLlxuICAgKiBPdGhlcndpc2UsIGFuIG9wdGlvbnMgb2JqZWN0IG11c3QgYmUgcHJvdmlkZWQgdG8gc3BlY2lmeSBlaXRoZXJcbiAgICoge0BsaW5rIE1pbmlwYXNzLlNoYXJlZE9wdGlvbnMub2JqZWN0TW9kZX0gb3JcbiAgICoge0BsaW5rIE1pbmlwYXNzLlNoYXJlZE9wdGlvbnMuZW5jb2Rpbmd9LCBhcyBhcHByb3ByaWF0ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIC4uLmFyZ3M6XG4gICAgICB8IFtNaW5pcGFzcy5PYmplY3RNb2RlT3B0aW9uc11cbiAgICAgIHwgKFJUeXBlIGV4dGVuZHMgQnVmZmVyXG4gICAgICAgICAgPyBbXSB8IFtNaW5pcGFzcy5PcHRpb25zPFJUeXBlPl1cbiAgICAgICAgICA6IFtNaW5pcGFzcy5PcHRpb25zPFJUeXBlPl0pXG4gICkge1xuICAgIGNvbnN0IG9wdGlvbnM6IE1pbmlwYXNzLk9wdGlvbnM8UlR5cGU+ID0gKGFyZ3NbMF0gfHxcbiAgICAgIHt9KSBhcyBNaW5pcGFzcy5PcHRpb25zPFJUeXBlPlxuICAgIHN1cGVyKClcbiAgICBpZiAob3B0aW9ucy5vYmplY3RNb2RlICYmIHR5cGVvZiBvcHRpb25zLmVuY29kaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgJ0VuY29kaW5nIGFuZCBvYmplY3RNb2RlIG1heSBub3QgYmUgdXNlZCB0b2dldGhlcidcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKGlzT2JqZWN0TW9kZU9wdGlvbnMob3B0aW9ucykpIHtcbiAgICAgIHRoaXNbT0JKRUNUTU9ERV0gPSB0cnVlXG4gICAgICB0aGlzW0VOQ09ESU5HXSA9IG51bGxcbiAgICB9IGVsc2UgaWYgKGlzRW5jb2RpbmdPcHRpb25zKG9wdGlvbnMpKSB7XG4gICAgICB0aGlzW0VOQ09ESU5HXSA9IG9wdGlvbnMuZW5jb2RpbmdcbiAgICAgIHRoaXNbT0JKRUNUTU9ERV0gPSBmYWxzZVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzW09CSkVDVE1PREVdID0gZmFsc2VcbiAgICAgIHRoaXNbRU5DT0RJTkddID0gbnVsbFxuICAgIH1cbiAgICB0aGlzW0FTWU5DXSA9ICEhb3B0aW9ucy5hc3luY1xuICAgIHRoaXNbREVDT0RFUl0gPSB0aGlzW0VOQ09ESU5HXVxuICAgICAgPyAobmV3IFN0cmluZ0RlY29kZXIodGhpc1tFTkNPRElOR10pIGFzIFNEKVxuICAgICAgOiBudWxsXG5cbiAgICAvL0B0cy1pZ25vcmUgLSBwcml2YXRlIG9wdGlvbiBmb3IgZGVidWdnaW5nIGFuZCB0ZXN0aW5nXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5kZWJ1Z0V4cG9zZUJ1ZmZlciA9PT0gdHJ1ZSkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdidWZmZXInLCB7IGdldDogKCkgPT4gdGhpc1tCVUZGRVJdIH0pXG4gICAgfVxuICAgIC8vQHRzLWlnbm9yZSAtIHByaXZhdGUgb3B0aW9uIGZvciBkZWJ1Z2dpbmcgYW5kIHRlc3RpbmdcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmRlYnVnRXhwb3NlUGlwZXMgPT09IHRydWUpIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAncGlwZXMnLCB7IGdldDogKCkgPT4gdGhpc1tQSVBFU10gfSlcbiAgICB9XG5cbiAgICBjb25zdCB7IHNpZ25hbCB9ID0gb3B0aW9uc1xuICAgIGlmIChzaWduYWwpIHtcbiAgICAgIHRoaXNbU0lHTkFMXSA9IHNpZ25hbFxuICAgICAgaWYgKHNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICAgIHRoaXNbQUJPUlRdKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHRoaXNbQUJPUlRdKCkpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBhbW91bnQgb2YgZGF0YSBzdG9yZWQgaW4gdGhlIGJ1ZmZlciB3YWl0aW5nIHRvIGJlIHJlYWQuXG4gICAqXG4gICAqIEZvciBCdWZmZXIgc3RyaW5ncywgdGhpcyB3aWxsIGJlIHRoZSB0b3RhbCBieXRlIGxlbmd0aC5cbiAgICogRm9yIHN0cmluZyBlbmNvZGluZyBzdHJlYW1zLCB0aGlzIHdpbGwgYmUgdGhlIHN0cmluZyBjaGFyYWN0ZXIgbGVuZ3RoLFxuICAgKiBhY2NvcmRpbmcgdG8gSmF2YVNjcmlwdCdzIGBzdHJpbmcubGVuZ3RoYCBsb2dpYy5cbiAgICogRm9yIG9iamVjdE1vZGUgc3RyZWFtcywgdGhpcyBpcyBhIGNvdW50IG9mIHRoZSBpdGVtcyB3YWl0aW5nIHRvIGJlXG4gICAqIGVtaXR0ZWQuXG4gICAqL1xuICBnZXQgYnVmZmVyTGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzW0JVRkZFUkxFTkdUSF1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgYEJ1ZmZlckVuY29kaW5nYCBjdXJyZW50bHkgaW4gdXNlLCBvciBgbnVsbGBcbiAgICovXG4gIGdldCBlbmNvZGluZygpIHtcbiAgICByZXR1cm4gdGhpc1tFTkNPRElOR11cbiAgfVxuXG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCAtIFRoaXMgaXMgYSByZWFkIG9ubHkgcHJvcGVydHlcbiAgICovXG4gIHNldCBlbmNvZGluZyhfZW5jKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdFbmNvZGluZyBtdXN0IGJlIHNldCBhdCBpbnN0YW50aWF0aW9uIHRpbWUnKVxuICB9XG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIC0gRW5jb2RpbmcgbWF5IG9ubHkgYmUgc2V0IGF0IGluc3RhbnRpYXRpb24gdGltZVxuICAgKi9cbiAgc2V0RW5jb2RpbmcoX2VuYzogTWluaXBhc3MuRW5jb2RpbmcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0VuY29kaW5nIG11c3QgYmUgc2V0IGF0IGluc3RhbnRpYXRpb24gdGltZScpXG4gIH1cblxuICAvKipcbiAgICogVHJ1ZSBpZiB0aGlzIGlzIGFuIG9iamVjdE1vZGUgc3RyZWFtXG4gICAqL1xuICBnZXQgb2JqZWN0TW9kZSgpIHtcbiAgICByZXR1cm4gdGhpc1tPQkpFQ1RNT0RFXVxuICB9XG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIC0gVGhpcyBpcyBhIHJlYWQtb25seSBwcm9wZXJ0eVxuICAgKi9cbiAgc2V0IG9iamVjdE1vZGUoX29tKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdvYmplY3RNb2RlIG11c3QgYmUgc2V0IGF0IGluc3RhbnRpYXRpb24gdGltZScpXG4gIH1cblxuICAvKipcbiAgICogdHJ1ZSBpZiB0aGlzIGlzIGFuIGFzeW5jIHN0cmVhbVxuICAgKi9cbiAgZ2V0IFsnYXN5bmMnXSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpc1tBU1lOQ11cbiAgfVxuICAvKipcbiAgICogU2V0IHRvIHRydWUgdG8gbWFrZSB0aGlzIHN0cmVhbSBhc3luYy5cbiAgICpcbiAgICogT25jZSBzZXQsIGl0IGNhbm5vdCBiZSB1bnNldCwgYXMgdGhpcyB3b3VsZCBwb3RlbnRpYWxseSBjYXVzZSBpbmNvcnJlY3RcbiAgICogYmVoYXZpb3IuICBJZSwgYSBzeW5jIHN0cmVhbSBjYW4gYmUgbWFkZSBhc3luYywgYnV0IGFuIGFzeW5jIHN0cmVhbVxuICAgKiBjYW5ub3QgYmUgc2FmZWx5IG1hZGUgc3luYy5cbiAgICovXG4gIHNldCBbJ2FzeW5jJ10oYTogYm9vbGVhbikge1xuICAgIHRoaXNbQVNZTkNdID0gdGhpc1tBU1lOQ10gfHwgISFhXG4gIH1cblxuICAvLyBkcm9wIGV2ZXJ5dGhpbmcgYW5kIGdldCBvdXQgb2YgdGhlIGZsb3cgY29tcGxldGVseVxuICBbQUJPUlRdKCkge1xuICAgIHRoaXNbQUJPUlRFRF0gPSB0cnVlXG4gICAgdGhpcy5lbWl0KCdhYm9ydCcsIHRoaXNbU0lHTkFMXT8ucmVhc29uKVxuICAgIHRoaXMuZGVzdHJveSh0aGlzW1NJR05BTF0/LnJlYXNvbilcbiAgfVxuXG4gIC8qKlxuICAgKiBUcnVlIGlmIHRoZSBzdHJlYW0gaGFzIGJlZW4gYWJvcnRlZC5cbiAgICovXG4gIGdldCBhYm9ydGVkKCkge1xuICAgIHJldHVybiB0aGlzW0FCT1JURURdXG4gIH1cbiAgLyoqXG4gICAqIE5vLW9wIHNldHRlci4gU3RyZWFtIGFib3J0ZWQgc3RhdHVzIGlzIHNldCB2aWEgdGhlIEFib3J0U2lnbmFsIHByb3ZpZGVkXG4gICAqIGluIHRoZSBjb25zdHJ1Y3RvciBvcHRpb25zLlxuICAgKi9cbiAgc2V0IGFib3J0ZWQoXykge31cblxuICAvKipcbiAgICogV3JpdGUgZGF0YSBpbnRvIHRoZSBzdHJlYW1cbiAgICpcbiAgICogSWYgdGhlIGNodW5rIHdyaXR0ZW4gaXMgYSBzdHJpbmcsIGFuZCBlbmNvZGluZyBpcyBub3Qgc3BlY2lmaWVkLCB0aGVuXG4gICAqIGB1dGY4YCB3aWxsIGJlIGFzc3VtZWQuIElmIHRoZSBzdHJlYW0gZW5jb2RpbmcgbWF0Y2hlcyB0aGUgZW5jb2Rpbmcgb2ZcbiAgICogYSB3cml0dGVuIHN0cmluZywgYW5kIHRoZSBzdGF0ZSBvZiB0aGUgc3RyaW5nIGRlY29kZXIgYWxsb3dzIGl0LCB0aGVuXG4gICAqIHRoZSBzdHJpbmcgd2lsbCBiZSBwYXNzZWQgdGhyb3VnaCB0byBlaXRoZXIgdGhlIG91dHB1dCBvciB0aGUgaW50ZXJuYWxcbiAgICogYnVmZmVyIHdpdGhvdXQgYW55IHByb2Nlc3NpbmcuIE90aGVyd2lzZSwgaXQgd2lsbCBiZSB0dXJuZWQgaW50byBhXG4gICAqIEJ1ZmZlciBvYmplY3QgZm9yIHByb2Nlc3NpbmcgaW50byB0aGUgZGVzaXJlZCBlbmNvZGluZy5cbiAgICpcbiAgICogSWYgcHJvdmlkZWQsIGBjYmAgZnVuY3Rpb24gaXMgY2FsbGVkIGltbWVkaWF0ZWx5IGJlZm9yZSByZXR1cm4gZm9yXG4gICAqIHN5bmMgc3RyZWFtcywgb3Igb24gbmV4dCB0aWNrIGZvciBhc3luYyBzdHJlYW1zLCBiZWNhdXNlIGZvciB0aGlzXG4gICAqIGJhc2UgY2xhc3MsIGEgY2h1bmsgaXMgY29uc2lkZXJlZCBcInByb2Nlc3NlZFwiIG9uY2UgaXQgaXMgYWNjZXB0ZWRcbiAgICogYW5kIGVpdGhlciBlbWl0dGVkIG9yIGJ1ZmZlcmVkLiBUaGF0IGlzLCB0aGUgY2FsbGJhY2sgZG9lcyBub3QgaW5kaWNhdGVcbiAgICogdGhhdCB0aGUgY2h1bmsgaGFzIGJlZW4gZXZlbnR1YWxseSBlbWl0dGVkLCB0aG91Z2ggb2YgY291cnNlIGNoaWxkXG4gICAqIGNsYXNzZXMgY2FuIG92ZXJyaWRlIHRoaXMgZnVuY3Rpb24gdG8gZG8gd2hhdGV2ZXIgcHJvY2Vzc2luZyBpcyByZXF1aXJlZFxuICAgKiBhbmQgY2FsbCBgc3VwZXIud3JpdGUoLi4uKWAgb25seSBvbmNlIHByb2Nlc3NpbmcgaXMgY29tcGxldGVkLlxuICAgKi9cbiAgd3JpdGUoY2h1bms6IFdUeXBlLCBjYj86ICgpID0+IHZvaWQpOiBib29sZWFuXG4gIHdyaXRlKFxuICAgIGNodW5rOiBXVHlwZSxcbiAgICBlbmNvZGluZz86IE1pbmlwYXNzLkVuY29kaW5nLFxuICAgIGNiPzogKCkgPT4gdm9pZFxuICApOiBib29sZWFuXG4gIHdyaXRlKFxuICAgIGNodW5rOiBXVHlwZSxcbiAgICBlbmNvZGluZz86IE1pbmlwYXNzLkVuY29kaW5nIHwgKCgpID0+IHZvaWQpLFxuICAgIGNiPzogKCkgPT4gdm9pZFxuICApOiBib29sZWFuIHtcbiAgICBpZiAodGhpc1tBQk9SVEVEXSkgcmV0dXJuIGZhbHNlXG4gICAgaWYgKHRoaXNbRU9GXSkgdGhyb3cgbmV3IEVycm9yKCd3cml0ZSBhZnRlciBlbmQnKVxuXG4gICAgaWYgKHRoaXNbREVTVFJPWUVEXSkge1xuICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAnZXJyb3InLFxuICAgICAgICBPYmplY3QuYXNzaWduKFxuICAgICAgICAgIG5ldyBFcnJvcignQ2Fubm90IGNhbGwgd3JpdGUgYWZ0ZXIgYSBzdHJlYW0gd2FzIGRlc3Ryb3llZCcpLFxuICAgICAgICAgIHsgY29kZTogJ0VSUl9TVFJFQU1fREVTVFJPWUVEJyB9XG4gICAgICAgIClcbiAgICAgIClcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2IgPSBlbmNvZGluZ1xuICAgICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9XG5cbiAgICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gICAgY29uc3QgZm4gPSB0aGlzW0FTWU5DXSA/IGRlZmVyIDogbm9kZWZlclxuXG4gICAgLy8gY29udmVydCBhcnJheSBidWZmZXJzIGFuZCB0eXBlZCBhcnJheSB2aWV3cyBpbnRvIGJ1ZmZlcnNcbiAgICAvLyBhdCBzb21lIHBvaW50IGluIHRoZSBmdXR1cmUsIHdlIG1heSB3YW50IHRvIGRvIHRoZSBvcHBvc2l0ZSFcbiAgICAvLyBsZWF2ZSBzdHJpbmdzIGFuZCBidWZmZXJzIGFzLWlzXG4gICAgLy8gYW55dGhpbmcgaXMgb25seSBhbGxvd2VkIGlmIGluIG9iamVjdCBtb2RlLCBzbyB0aHJvd1xuICAgIGlmICghdGhpc1tPQkpFQ1RNT0RFXSAmJiAhQnVmZmVyLmlzQnVmZmVyKGNodW5rKSkge1xuICAgICAgaWYgKGlzQXJyYXlCdWZmZXJWaWV3KGNodW5rKSkge1xuICAgICAgICAvL0B0cy1pZ25vcmUgLSBzaW5mdWwgdW5zYWZlIHR5cGUgY2hhbmdpbmdcbiAgICAgICAgY2h1bmsgPSBCdWZmZXIuZnJvbShcbiAgICAgICAgICBjaHVuay5idWZmZXIsXG4gICAgICAgICAgY2h1bmsuYnl0ZU9mZnNldCxcbiAgICAgICAgICBjaHVuay5ieXRlTGVuZ3RoXG4gICAgICAgIClcbiAgICAgIH0gZWxzZSBpZiAoaXNBcnJheUJ1ZmZlckxpa2UoY2h1bmspKSB7XG4gICAgICAgIC8vQHRzLWlnbm9yZSAtIHNpbmZ1bCB1bnNhZmUgdHlwZSBjaGFuZ2luZ1xuICAgICAgICBjaHVuayA9IEJ1ZmZlci5mcm9tKGNodW5rKVxuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnTm9uLWNvbnRpZ3VvdXMgZGF0YSB3cml0dGVuIHRvIG5vbi1vYmplY3RNb2RlIHN0cmVhbSdcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGhhbmRsZSBvYmplY3QgbW9kZSB1cCBmcm9udCwgc2luY2UgaXQncyBzaW1wbGVyXG4gICAgLy8gdGhpcyB5aWVsZHMgYmV0dGVyIHBlcmZvcm1hbmNlLCBmZXdlciBjaGVja3MgbGF0ZXIuXG4gICAgaWYgKHRoaXNbT0JKRUNUTU9ERV0pIHtcbiAgICAgIC8vIG1heWJlIGltcG9zc2libGU/XG4gICAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICAgIGlmICh0aGlzW0ZMT1dJTkddICYmIHRoaXNbQlVGRkVSTEVOR1RIXSAhPT0gMCkgdGhpc1tGTFVTSF0odHJ1ZSlcbiAgICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG5cbiAgICAgIGlmICh0aGlzW0ZMT1dJTkddKSB0aGlzLmVtaXQoJ2RhdGEnLCBjaHVuayBhcyB1bmtub3duIGFzIFJUeXBlKVxuICAgICAgZWxzZSB0aGlzW0JVRkZFUlBVU0hdKGNodW5rIGFzIHVua25vd24gYXMgUlR5cGUpXG5cbiAgICAgIGlmICh0aGlzW0JVRkZFUkxFTkdUSF0gIT09IDApIHRoaXMuZW1pdCgncmVhZGFibGUnKVxuXG4gICAgICBpZiAoY2IpIGZuKGNiKVxuXG4gICAgICByZXR1cm4gdGhpc1tGTE9XSU5HXVxuICAgIH1cblxuICAgIC8vIGF0IHRoaXMgcG9pbnQgdGhlIGNodW5rIGlzIGEgYnVmZmVyIG9yIHN0cmluZ1xuICAgIC8vIGRvbid0IGJ1ZmZlciBpdCB1cCBvciBzZW5kIGl0IHRvIHRoZSBkZWNvZGVyXG4gICAgaWYgKCEoY2h1bmsgYXMgTWluaXBhc3MuQnVmZmVyT3JTdHJpbmcpLmxlbmd0aCkge1xuICAgICAgaWYgKHRoaXNbQlVGRkVSTEVOR1RIXSAhPT0gMCkgdGhpcy5lbWl0KCdyZWFkYWJsZScpXG4gICAgICBpZiAoY2IpIGZuKGNiKVxuICAgICAgcmV0dXJuIHRoaXNbRkxPV0lOR11cbiAgICB9XG5cbiAgICAvLyBmYXN0LXBhdGggd3JpdGluZyBzdHJpbmdzIG9mIHNhbWUgZW5jb2RpbmcgdG8gYSBzdHJlYW0gd2l0aFxuICAgIC8vIGFuIGVtcHR5IGJ1ZmZlciwgc2tpcHBpbmcgdGhlIGJ1ZmZlci9kZWNvZGVyIGRhbmNlXG4gICAgaWYgKFxuICAgICAgdHlwZW9mIGNodW5rID09PSAnc3RyaW5nJyAmJlxuICAgICAgLy8gdW5sZXNzIGl0IGlzIGEgc3RyaW5nIGFscmVhZHkgcmVhZHkgZm9yIHVzIHRvIHVzZVxuICAgICAgIShlbmNvZGluZyA9PT0gdGhpc1tFTkNPRElOR10gJiYgIXRoaXNbREVDT0RFUl0/Lmxhc3ROZWVkKVxuICAgICkge1xuICAgICAgLy9AdHMtaWdub3JlIC0gc2luZnVsIHVuc2FmZSB0eXBlIGNoYW5nZVxuICAgICAgY2h1bmsgPSBCdWZmZXIuZnJvbShjaHVuaywgZW5jb2RpbmcpXG4gICAgfVxuXG4gICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykgJiYgdGhpc1tFTkNPRElOR10pIHtcbiAgICAgIC8vQHRzLWlnbm9yZSAtIHNpbmZ1bCB1bnNhZmUgdHlwZSBjaGFuZ2VcbiAgICAgIGNodW5rID0gdGhpc1tERUNPREVSXS53cml0ZShjaHVuaylcbiAgICB9XG5cbiAgICAvLyBOb3RlOiBmbHVzaGluZyBDQU4gcG90ZW50aWFsbHkgc3dpdGNoIHVzIGludG8gbm90LWZsb3dpbmcgbW9kZVxuICAgIGlmICh0aGlzW0ZMT1dJTkddICYmIHRoaXNbQlVGRkVSTEVOR1RIXSAhPT0gMCkgdGhpc1tGTFVTSF0odHJ1ZSlcblxuICAgIGlmICh0aGlzW0ZMT1dJTkddKSB0aGlzLmVtaXQoJ2RhdGEnLCBjaHVuayBhcyB1bmtub3duIGFzIFJUeXBlKVxuICAgIGVsc2UgdGhpc1tCVUZGRVJQVVNIXShjaHVuayBhcyB1bmtub3duIGFzIFJUeXBlKVxuXG4gICAgaWYgKHRoaXNbQlVGRkVSTEVOR1RIXSAhPT0gMCkgdGhpcy5lbWl0KCdyZWFkYWJsZScpXG5cbiAgICBpZiAoY2IpIGZuKGNiKVxuXG4gICAgcmV0dXJuIHRoaXNbRkxPV0lOR11cbiAgfVxuXG4gIC8qKlxuICAgKiBMb3ctbGV2ZWwgZXhwbGljaXQgcmVhZCBtZXRob2QuXG4gICAqXG4gICAqIEluIG9iamVjdE1vZGUsIHRoZSBhcmd1bWVudCBpcyBpZ25vcmVkLCBhbmQgb25lIGl0ZW0gaXMgcmV0dXJuZWQgaWZcbiAgICogYXZhaWxhYmxlLlxuICAgKlxuICAgKiBgbmAgaXMgdGhlIG51bWJlciBvZiBieXRlcyAob3IgaW4gdGhlIGNhc2Ugb2YgZW5jb2Rpbmcgc3RyZWFtcyxcbiAgICogY2hhcmFjdGVycykgdG8gY29uc3VtZS4gSWYgYG5gIGlzIG5vdCBwcm92aWRlZCwgdGhlbiB0aGUgZW50aXJlIGJ1ZmZlclxuICAgKiBpcyByZXR1cm5lZCwgb3IgYG51bGxgIGlzIHJldHVybmVkIGlmIG5vIGRhdGEgaXMgYXZhaWxhYmxlLlxuICAgKlxuICAgKiBJZiBgbmAgaXMgZ3JlYXRlciB0aGF0IHRoZSBhbW91bnQgb2YgZGF0YSBpbiB0aGUgaW50ZXJuYWwgYnVmZmVyLFxuICAgKiB0aGVuIGBudWxsYCBpcyByZXR1cm5lZC5cbiAgICovXG4gIHJlYWQobj86IG51bWJlciB8IG51bGwpOiBSVHlwZSB8IG51bGwge1xuICAgIGlmICh0aGlzW0RFU1RST1lFRF0pIHJldHVybiBudWxsXG4gICAgdGhpc1tESVNDQVJERURdID0gZmFsc2VcblxuICAgIGlmIChcbiAgICAgIHRoaXNbQlVGRkVSTEVOR1RIXSA9PT0gMCB8fFxuICAgICAgbiA9PT0gMCB8fFxuICAgICAgKG4gJiYgbiA+IHRoaXNbQlVGRkVSTEVOR1RIXSlcbiAgICApIHtcbiAgICAgIHRoaXNbTUFZQkVfRU1JVF9FTkRdKClcbiAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgaWYgKHRoaXNbT0JKRUNUTU9ERV0pIG4gPSBudWxsXG5cbiAgICBpZiAodGhpc1tCVUZGRVJdLmxlbmd0aCA+IDEgJiYgIXRoaXNbT0JKRUNUTU9ERV0pIHtcbiAgICAgIC8vIG5vdCBvYmplY3QgbW9kZSwgc28gaWYgd2UgaGF2ZSBhbiBlbmNvZGluZywgdGhlbiBSVHlwZSBpcyBzdHJpbmdcbiAgICAgIC8vIG90aGVyd2lzZSwgbXVzdCBiZSBCdWZmZXJcbiAgICAgIHRoaXNbQlVGRkVSXSA9IFtcbiAgICAgICAgKHRoaXNbRU5DT0RJTkddXG4gICAgICAgICAgPyB0aGlzW0JVRkZFUl0uam9pbignJylcbiAgICAgICAgICA6IEJ1ZmZlci5jb25jYXQoXG4gICAgICAgICAgICAgIHRoaXNbQlVGRkVSXSBhcyBCdWZmZXJbXSxcbiAgICAgICAgICAgICAgdGhpc1tCVUZGRVJMRU5HVEhdXG4gICAgICAgICAgICApKSBhcyBSVHlwZSxcbiAgICAgIF1cbiAgICB9XG5cbiAgICBjb25zdCByZXQgPSB0aGlzW1JFQURdKG4gfHwgbnVsbCwgdGhpc1tCVUZGRVJdWzBdIGFzIFJUeXBlKVxuICAgIHRoaXNbTUFZQkVfRU1JVF9FTkRdKClcbiAgICByZXR1cm4gcmV0XG4gIH1cblxuICBbUkVBRF0objogbnVtYmVyIHwgbnVsbCwgY2h1bms6IFJUeXBlKSB7XG4gICAgaWYgKHRoaXNbT0JKRUNUTU9ERV0pIHRoaXNbQlVGRkVSU0hJRlRdKClcbiAgICBlbHNlIHtcbiAgICAgIGNvbnN0IGMgPSBjaHVuayBhcyBNaW5pcGFzcy5CdWZmZXJPclN0cmluZ1xuICAgICAgaWYgKG4gPT09IGMubGVuZ3RoIHx8IG4gPT09IG51bGwpIHRoaXNbQlVGRkVSU0hJRlRdKClcbiAgICAgIGVsc2UgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzW0JVRkZFUl1bMF0gPSBjLnNsaWNlKG4pIGFzIFJUeXBlXG4gICAgICAgIGNodW5rID0gYy5zbGljZSgwLCBuKSBhcyBSVHlwZVxuICAgICAgICB0aGlzW0JVRkZFUkxFTkdUSF0gLT0gblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpc1tCVUZGRVJdWzBdID0gYy5zdWJhcnJheShuKSBhcyBSVHlwZVxuICAgICAgICBjaHVuayA9IGMuc3ViYXJyYXkoMCwgbikgYXMgUlR5cGVcbiAgICAgICAgdGhpc1tCVUZGRVJMRU5HVEhdIC09IG5cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmVtaXQoJ2RhdGEnLCBjaHVuaylcblxuICAgIGlmICghdGhpc1tCVUZGRVJdLmxlbmd0aCAmJiAhdGhpc1tFT0ZdKSB0aGlzLmVtaXQoJ2RyYWluJylcblxuICAgIHJldHVybiBjaHVua1xuICB9XG5cbiAgLyoqXG4gICAqIEVuZCB0aGUgc3RyZWFtLCBvcHRpb25hbGx5IHByb3ZpZGluZyBhIGZpbmFsIHdyaXRlLlxuICAgKlxuICAgKiBTZWUge0BsaW5rIE1pbmlwYXNzI3dyaXRlfSBmb3IgYXJndW1lbnQgZGVzY3JpcHRpb25zXG4gICAqL1xuICBlbmQoY2I/OiAoKSA9PiB2b2lkKTogdGhpc1xuICBlbmQoY2h1bms6IFdUeXBlLCBjYj86ICgpID0+IHZvaWQpOiB0aGlzXG4gIGVuZChjaHVuazogV1R5cGUsIGVuY29kaW5nPzogTWluaXBhc3MuRW5jb2RpbmcsIGNiPzogKCkgPT4gdm9pZCk6IHRoaXNcbiAgZW5kKFxuICAgIGNodW5rPzogV1R5cGUgfCAoKCkgPT4gdm9pZCksXG4gICAgZW5jb2Rpbmc/OiBNaW5pcGFzcy5FbmNvZGluZyB8ICgoKSA9PiB2b2lkKSxcbiAgICBjYj86ICgpID0+IHZvaWRcbiAgKTogdGhpcyB7XG4gICAgaWYgKHR5cGVvZiBjaHVuayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2IgPSBjaHVuayBhcyAoKSA9PiB2b2lkXG4gICAgICBjaHVuayA9IHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IGVuY29kaW5nXG4gICAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIH1cbiAgICBpZiAoY2h1bmsgIT09IHVuZGVmaW5lZCkgdGhpcy53cml0ZShjaHVuaywgZW5jb2RpbmcpXG4gICAgaWYgKGNiKSB0aGlzLm9uY2UoJ2VuZCcsIGNiKVxuICAgIHRoaXNbRU9GXSA9IHRydWVcbiAgICB0aGlzLndyaXRhYmxlID0gZmFsc2VcblxuICAgIC8vIGlmIHdlIGhhdmVuJ3Qgd3JpdHRlbiBhbnl0aGluZywgdGhlbiBnbyBhaGVhZCBhbmQgZW1pdCxcbiAgICAvLyBldmVuIGlmIHdlJ3JlIG5vdCByZWFkaW5nLlxuICAgIC8vIHdlJ2xsIHJlLWVtaXQgaWYgYSBuZXcgJ2VuZCcgbGlzdGVuZXIgaXMgYWRkZWQgYW55d2F5LlxuICAgIC8vIFRoaXMgbWFrZXMgTVAgbW9yZSBzdWl0YWJsZSB0byB3cml0ZS1vbmx5IHVzZSBjYXNlcy5cbiAgICBpZiAodGhpc1tGTE9XSU5HXSB8fCAhdGhpc1tQQVVTRURdKSB0aGlzW01BWUJFX0VNSVRfRU5EXSgpXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8vIGRvbid0IGxldCB0aGUgaW50ZXJuYWwgcmVzdW1lIGJlIG92ZXJ3cml0dGVuXG4gIFtSRVNVTUVdKCkge1xuICAgIGlmICh0aGlzW0RFU1RST1lFRF0pIHJldHVyblxuXG4gICAgaWYgKCF0aGlzW0RBVEFMSVNURU5FUlNdICYmICF0aGlzW1BJUEVTXS5sZW5ndGgpIHtcbiAgICAgIHRoaXNbRElTQ0FSREVEXSA9IHRydWVcbiAgICB9XG4gICAgdGhpc1tQQVVTRURdID0gZmFsc2VcbiAgICB0aGlzW0ZMT1dJTkddID0gdHJ1ZVxuICAgIHRoaXMuZW1pdCgncmVzdW1lJylcbiAgICBpZiAodGhpc1tCVUZGRVJdLmxlbmd0aCkgdGhpc1tGTFVTSF0oKVxuICAgIGVsc2UgaWYgKHRoaXNbRU9GXSkgdGhpc1tNQVlCRV9FTUlUX0VORF0oKVxuICAgIGVsc2UgdGhpcy5lbWl0KCdkcmFpbicpXG4gIH1cblxuICAvKipcbiAgICogUmVzdW1lIHRoZSBzdHJlYW0gaWYgaXQgaXMgY3VycmVudGx5IGluIGEgcGF1c2VkIHN0YXRlXG4gICAqXG4gICAqIElmIGNhbGxlZCB3aGVuIHRoZXJlIGFyZSBubyBwaXBlIGRlc3RpbmF0aW9ucyBvciBgZGF0YWAgZXZlbnQgbGlzdGVuZXJzLFxuICAgKiB0aGlzIHdpbGwgcGxhY2UgdGhlIHN0cmVhbSBpbiBhIFwiZGlzY2FyZGVkXCIgc3RhdGUsIHdoZXJlIGFsbCBkYXRhIHdpbGxcbiAgICogYmUgdGhyb3duIGF3YXkuIFRoZSBkaXNjYXJkZWQgc3RhdGUgaXMgcmVtb3ZlZCBpZiBhIHBpcGUgZGVzdGluYXRpb24gb3JcbiAgICogZGF0YSBoYW5kbGVyIGlzIGFkZGVkLCBpZiBwYXVzZSgpIGlzIGNhbGxlZCwgb3IgaWYgYW55IHN5bmNocm9ub3VzIG9yXG4gICAqIGFzeW5jaHJvbm91cyBpdGVyYXRpb24gaXMgc3RhcnRlZC5cbiAgICovXG4gIHJlc3VtZSgpIHtcbiAgICByZXR1cm4gdGhpc1tSRVNVTUVdKClcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXVzZSB0aGUgc3RyZWFtXG4gICAqL1xuICBwYXVzZSgpIHtcbiAgICB0aGlzW0ZMT1dJTkddID0gZmFsc2VcbiAgICB0aGlzW1BBVVNFRF0gPSB0cnVlXG4gICAgdGhpc1tESVNDQVJERURdID0gZmFsc2VcbiAgfVxuXG4gIC8qKlxuICAgKiB0cnVlIGlmIHRoZSBzdHJlYW0gaGFzIGJlZW4gZm9yY2libHkgZGVzdHJveWVkXG4gICAqL1xuICBnZXQgZGVzdHJveWVkKCkge1xuICAgIHJldHVybiB0aGlzW0RFU1RST1lFRF1cbiAgfVxuXG4gIC8qKlxuICAgKiB0cnVlIGlmIHRoZSBzdHJlYW0gaXMgY3VycmVudGx5IGluIGEgZmxvd2luZyBzdGF0ZSwgbWVhbmluZyB0aGF0XG4gICAqIGFueSB3cml0ZXMgd2lsbCBiZSBpbW1lZGlhdGVseSBlbWl0dGVkLlxuICAgKi9cbiAgZ2V0IGZsb3dpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXNbRkxPV0lOR11cbiAgfVxuXG4gIC8qKlxuICAgKiB0cnVlIGlmIHRoZSBzdHJlYW0gaXMgY3VycmVudGx5IGluIGEgcGF1c2VkIHN0YXRlXG4gICAqL1xuICBnZXQgcGF1c2VkKCkge1xuICAgIHJldHVybiB0aGlzW1BBVVNFRF1cbiAgfVxuXG4gIFtCVUZGRVJQVVNIXShjaHVuazogUlR5cGUpIHtcbiAgICBpZiAodGhpc1tPQkpFQ1RNT0RFXSkgdGhpc1tCVUZGRVJMRU5HVEhdICs9IDFcbiAgICBlbHNlIHRoaXNbQlVGRkVSTEVOR1RIXSArPSAoY2h1bmsgYXMgTWluaXBhc3MuQnVmZmVyT3JTdHJpbmcpLmxlbmd0aFxuICAgIHRoaXNbQlVGRkVSXS5wdXNoKGNodW5rKVxuICB9XG5cbiAgW0JVRkZFUlNISUZUXSgpOiBSVHlwZSB7XG4gICAgaWYgKHRoaXNbT0JKRUNUTU9ERV0pIHRoaXNbQlVGRkVSTEVOR1RIXSAtPSAxXG4gICAgZWxzZVxuICAgICAgdGhpc1tCVUZGRVJMRU5HVEhdIC09IChcbiAgICAgICAgdGhpc1tCVUZGRVJdWzBdIGFzIE1pbmlwYXNzLkJ1ZmZlck9yU3RyaW5nXG4gICAgICApLmxlbmd0aFxuICAgIHJldHVybiB0aGlzW0JVRkZFUl0uc2hpZnQoKSBhcyBSVHlwZVxuICB9XG5cbiAgW0ZMVVNIXShub0RyYWluOiBib29sZWFuID0gZmFsc2UpIHtcbiAgICBkbyB7fSB3aGlsZSAoXG4gICAgICB0aGlzW0ZMVVNIQ0hVTktdKHRoaXNbQlVGRkVSU0hJRlRdKCkpICYmXG4gICAgICB0aGlzW0JVRkZFUl0ubGVuZ3RoXG4gICAgKVxuXG4gICAgaWYgKCFub0RyYWluICYmICF0aGlzW0JVRkZFUl0ubGVuZ3RoICYmICF0aGlzW0VPRl0pIHRoaXMuZW1pdCgnZHJhaW4nKVxuICB9XG5cbiAgW0ZMVVNIQ0hVTktdKGNodW5rOiBSVHlwZSkge1xuICAgIHRoaXMuZW1pdCgnZGF0YScsIGNodW5rKVxuICAgIHJldHVybiB0aGlzW0ZMT1dJTkddXG4gIH1cblxuICAvKipcbiAgICogUGlwZSBhbGwgZGF0YSBlbWl0dGVkIGJ5IHRoaXMgc3RyZWFtIGludG8gdGhlIGRlc3RpbmF0aW9uIHByb3ZpZGVkLlxuICAgKlxuICAgKiBUcmlnZ2VycyB0aGUgZmxvdyBvZiBkYXRhLlxuICAgKi9cbiAgcGlwZTxXIGV4dGVuZHMgTWluaXBhc3MuV3JpdGFibGU+KGRlc3Q6IFcsIG9wdHM/OiBQaXBlT3B0aW9ucyk6IFcge1xuICAgIGlmICh0aGlzW0RFU1RST1lFRF0pIHJldHVybiBkZXN0XG4gICAgdGhpc1tESVNDQVJERURdID0gZmFsc2VcblxuICAgIGNvbnN0IGVuZGVkID0gdGhpc1tFTUlUVEVEX0VORF1cbiAgICBvcHRzID0gb3B0cyB8fCB7fVxuICAgIGlmIChkZXN0ID09PSBwcm9jLnN0ZG91dCB8fCBkZXN0ID09PSBwcm9jLnN0ZGVycikgb3B0cy5lbmQgPSBmYWxzZVxuICAgIGVsc2Ugb3B0cy5lbmQgPSBvcHRzLmVuZCAhPT0gZmFsc2VcbiAgICBvcHRzLnByb3h5RXJyb3JzID0gISFvcHRzLnByb3h5RXJyb3JzXG5cbiAgICAvLyBwaXBpbmcgYW4gZW5kZWQgc3RyZWFtIGVuZHMgaW1tZWRpYXRlbHlcbiAgICBpZiAoZW5kZWQpIHtcbiAgICAgIGlmIChvcHRzLmVuZCkgZGVzdC5lbmQoKVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBcImFzXCIgaGVyZSBqdXN0IGlnbm9yZXMgdGhlIFdUeXBlLCB3aGljaCBwaXBlcyBkb24ndCBjYXJlIGFib3V0LFxuICAgICAgLy8gc2luY2UgdGhleSdyZSBvbmx5IGNvbnN1bWluZyBmcm9tIHVzLCBhbmQgd3JpdGluZyB0byB0aGUgZGVzdFxuICAgICAgdGhpc1tQSVBFU10ucHVzaChcbiAgICAgICAgIW9wdHMucHJveHlFcnJvcnNcbiAgICAgICAgICA/IG5ldyBQaXBlPFJUeXBlPih0aGlzIGFzIE1pbmlwYXNzPFJUeXBlPiwgZGVzdCwgb3B0cylcbiAgICAgICAgICA6IG5ldyBQaXBlUHJveHlFcnJvcnM8UlR5cGU+KHRoaXMgYXMgTWluaXBhc3M8UlR5cGU+LCBkZXN0LCBvcHRzKVxuICAgICAgKVxuICAgICAgaWYgKHRoaXNbQVNZTkNdKSBkZWZlcigoKSA9PiB0aGlzW1JFU1VNRV0oKSlcbiAgICAgIGVsc2UgdGhpc1tSRVNVTUVdKClcbiAgICB9XG5cbiAgICByZXR1cm4gZGVzdFxuICB9XG5cbiAgLyoqXG4gICAqIEZ1bGx5IHVuaG9vayBhIHBpcGVkIGRlc3RpbmF0aW9uIHN0cmVhbS5cbiAgICpcbiAgICogSWYgdGhlIGRlc3RpbmF0aW9uIHN0cmVhbSB3YXMgdGhlIG9ubHkgY29uc3VtZXIgb2YgdGhpcyBzdHJlYW0gKGllLFxuICAgKiB0aGVyZSBhcmUgbm8gb3RoZXIgcGlwZWQgZGVzdGluYXRpb25zIG9yIGAnZGF0YSdgIGV2ZW50IGxpc3RlbmVycylcbiAgICogdGhlbiB0aGUgZmxvdyBvZiBkYXRhIHdpbGwgc3RvcCB1bnRpbCB0aGVyZSBpcyBhbm90aGVyIGNvbnN1bWVyIG9yXG4gICAqIHtAbGluayBNaW5pcGFzcyNyZXN1bWV9IGlzIGV4cGxpY2l0bHkgY2FsbGVkLlxuICAgKi9cbiAgdW5waXBlPFcgZXh0ZW5kcyBNaW5pcGFzcy5Xcml0YWJsZT4oZGVzdDogVykge1xuICAgIGNvbnN0IHAgPSB0aGlzW1BJUEVTXS5maW5kKHAgPT4gcC5kZXN0ID09PSBkZXN0KVxuICAgIGlmIChwKSB7XG4gICAgICBpZiAodGhpc1tQSVBFU10ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGlmICh0aGlzW0ZMT1dJTkddICYmIHRoaXNbREFUQUxJU1RFTkVSU10gPT09IDApIHtcbiAgICAgICAgICB0aGlzW0ZMT1dJTkddID0gZmFsc2VcbiAgICAgICAgfVxuICAgICAgICB0aGlzW1BJUEVTXSA9IFtdXG4gICAgICB9IGVsc2UgdGhpc1tQSVBFU10uc3BsaWNlKHRoaXNbUElQRVNdLmluZGV4T2YocCksIDEpXG4gICAgICBwLnVucGlwZSgpXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFsaWFzIGZvciB7QGxpbmsgTWluaXBhc3Mjb259XG4gICAqL1xuICBhZGRMaXN0ZW5lcjxFdmVudCBleHRlbmRzIGtleW9mIEV2ZW50cz4oXG4gICAgZXY6IEV2ZW50LFxuICAgIGhhbmRsZXI6ICguLi5hcmdzOiBFdmVudHNbRXZlbnRdKSA9PiBhbnlcbiAgKTogdGhpcyB7XG4gICAgcmV0dXJuIHRoaXMub24oZXYsIGhhbmRsZXIpXG4gIH1cblxuICAvKipcbiAgICogTW9zdGx5IGlkZW50aWNhbCB0byBgRXZlbnRFbWl0dGVyLm9uYCwgd2l0aCB0aGUgZm9sbG93aW5nXG4gICAqIGJlaGF2aW9yIGRpZmZlcmVuY2VzIHRvIHByZXZlbnQgZGF0YSBsb3NzIGFuZCB1bm5lY2Vzc2FyeSBoYW5nczpcbiAgICpcbiAgICogLSBBZGRpbmcgYSAnZGF0YScgZXZlbnQgaGFuZGxlciB3aWxsIHRyaWdnZXIgdGhlIGZsb3cgb2YgZGF0YVxuICAgKlxuICAgKiAtIEFkZGluZyBhICdyZWFkYWJsZScgZXZlbnQgaGFuZGxlciB3aGVuIHRoZXJlIGlzIGRhdGEgd2FpdGluZyB0byBiZSByZWFkXG4gICAqICAgd2lsbCBjYXVzZSAncmVhZGFibGUnIHRvIGJlIGVtaXR0ZWQgaW1tZWRpYXRlbHkuXG4gICAqXG4gICAqIC0gQWRkaW5nIGFuICdlbmRpc2gnIGV2ZW50IGhhbmRsZXIgKCdlbmQnLCAnZmluaXNoJywgZXRjLikgd2hpY2ggaGFzXG4gICAqICAgYWxyZWFkeSBwYXNzZWQgd2lsbCBjYXVzZSB0aGUgZXZlbnQgdG8gYmUgZW1pdHRlZCBpbW1lZGlhdGVseSBhbmQgYWxsXG4gICAqICAgaGFuZGxlcnMgcmVtb3ZlZC5cbiAgICpcbiAgICogLSBBZGRpbmcgYW4gJ2Vycm9yJyBldmVudCBoYW5kbGVyIGFmdGVyIGFuIGVycm9yIGhhcyBiZWVuIGVtaXR0ZWQgd2lsbFxuICAgKiAgIGNhdXNlIHRoZSBldmVudCB0byBiZSByZS1lbWl0dGVkIGltbWVkaWF0ZWx5IHdpdGggdGhlIGVycm9yIHByZXZpb3VzbHlcbiAgICogICByYWlzZWQuXG4gICAqL1xuICBvbjxFdmVudCBleHRlbmRzIGtleW9mIEV2ZW50cz4oXG4gICAgZXY6IEV2ZW50LFxuICAgIGhhbmRsZXI6ICguLi5hcmdzOiBFdmVudHNbRXZlbnRdKSA9PiBhbnlcbiAgKTogdGhpcyB7XG4gICAgY29uc3QgcmV0ID0gc3VwZXIub24oXG4gICAgICBldiBhcyBzdHJpbmcgfCBzeW1ib2wsXG4gICAgICBoYW5kbGVyIGFzICguLi5hOiBhbnlbXSkgPT4gYW55XG4gICAgKVxuICAgIGlmIChldiA9PT0gJ2RhdGEnKSB7XG4gICAgICB0aGlzW0RJU0NBUkRFRF0gPSBmYWxzZVxuICAgICAgdGhpc1tEQVRBTElTVEVORVJTXSsrXG4gICAgICBpZiAoIXRoaXNbUElQRVNdLmxlbmd0aCAmJiAhdGhpc1tGTE9XSU5HXSkge1xuICAgICAgICB0aGlzW1JFU1VNRV0oKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXYgPT09ICdyZWFkYWJsZScgJiYgdGhpc1tCVUZGRVJMRU5HVEhdICE9PSAwKSB7XG4gICAgICBzdXBlci5lbWl0KCdyZWFkYWJsZScpXG4gICAgfSBlbHNlIGlmIChpc0VuZGlzaChldikgJiYgdGhpc1tFTUlUVEVEX0VORF0pIHtcbiAgICAgIHN1cGVyLmVtaXQoZXYpXG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhldilcbiAgICB9IGVsc2UgaWYgKGV2ID09PSAnZXJyb3InICYmIHRoaXNbRU1JVFRFRF9FUlJPUl0pIHtcbiAgICAgIGNvbnN0IGggPSBoYW5kbGVyIGFzICguLi5hOiBFdmVudHNbJ2Vycm9yJ10pID0+IGFueVxuICAgICAgaWYgKHRoaXNbQVNZTkNdKSBkZWZlcigoKSA9PiBoLmNhbGwodGhpcywgdGhpc1tFTUlUVEVEX0VSUk9SXSkpXG4gICAgICBlbHNlIGguY2FsbCh0aGlzLCB0aGlzW0VNSVRURURfRVJST1JdKVxuICAgIH1cbiAgICByZXR1cm4gcmV0XG4gIH1cblxuICAvKipcbiAgICogQWxpYXMgZm9yIHtAbGluayBNaW5pcGFzcyNvZmZ9XG4gICAqL1xuICByZW1vdmVMaXN0ZW5lcjxFdmVudCBleHRlbmRzIGtleW9mIEV2ZW50cz4oXG4gICAgZXY6IEV2ZW50LFxuICAgIGhhbmRsZXI6ICguLi5hcmdzOiBFdmVudHNbRXZlbnRdKSA9PiBhbnlcbiAgKSB7XG4gICAgcmV0dXJuIHRoaXMub2ZmKGV2LCBoYW5kbGVyKVxuICB9XG5cbiAgLyoqXG4gICAqIE1vc3RseSBpZGVudGljYWwgdG8gYEV2ZW50RW1pdHRlci5vZmZgXG4gICAqXG4gICAqIElmIGEgJ2RhdGEnIGV2ZW50IGhhbmRsZXIgaXMgcmVtb3ZlZCwgYW5kIGl0IHdhcyB0aGUgbGFzdCBjb25zdW1lclxuICAgKiAoaWUsIHRoZXJlIGFyZSBubyBwaXBlIGRlc3RpbmF0aW9ucyBvciBvdGhlciAnZGF0YScgZXZlbnQgbGlzdGVuZXJzKSxcbiAgICogdGhlbiB0aGUgZmxvdyBvZiBkYXRhIHdpbGwgc3RvcCB1bnRpbCB0aGVyZSBpcyBhbm90aGVyIGNvbnN1bWVyIG9yXG4gICAqIHtAbGluayBNaW5pcGFzcyNyZXN1bWV9IGlzIGV4cGxpY2l0bHkgY2FsbGVkLlxuICAgKi9cbiAgb2ZmPEV2ZW50IGV4dGVuZHMga2V5b2YgRXZlbnRzPihcbiAgICBldjogRXZlbnQsXG4gICAgaGFuZGxlcjogKC4uLmFyZ3M6IEV2ZW50c1tFdmVudF0pID0+IGFueVxuICApIHtcbiAgICBjb25zdCByZXQgPSBzdXBlci5vZmYoXG4gICAgICBldiBhcyBzdHJpbmcgfCBzeW1ib2wsXG4gICAgICBoYW5kbGVyIGFzICguLi5hOiBhbnlbXSkgPT4gYW55XG4gICAgKVxuICAgIC8vIGlmIHdlIHByZXZpb3VzbHkgaGFkIGxpc3RlbmVycywgYW5kIG5vdyB3ZSBkb24ndCwgYW5kIHdlIGRvbid0XG4gICAgLy8gaGF2ZSBhbnkgcGlwZXMsIHRoZW4gc3RvcCB0aGUgZmxvdywgdW5sZXNzIGl0J3MgYmVlbiBleHBsaWNpdGx5XG4gICAgLy8gcHV0IGluIGEgZGlzY2FyZGVkIGZsb3dpbmcgc3RhdGUgdmlhIHN0cmVhbS5yZXN1bWUoKS5cbiAgICBpZiAoZXYgPT09ICdkYXRhJykge1xuICAgICAgdGhpc1tEQVRBTElTVEVORVJTXSA9IHRoaXMubGlzdGVuZXJzKCdkYXRhJykubGVuZ3RoXG4gICAgICBpZiAoXG4gICAgICAgIHRoaXNbREFUQUxJU1RFTkVSU10gPT09IDAgJiZcbiAgICAgICAgIXRoaXNbRElTQ0FSREVEXSAmJlxuICAgICAgICAhdGhpc1tQSVBFU10ubGVuZ3RoXG4gICAgICApIHtcbiAgICAgICAgdGhpc1tGTE9XSU5HXSA9IGZhbHNlXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXRcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3N0bHkgaWRlbnRpY2FsIHRvIGBFdmVudEVtaXR0ZXIucmVtb3ZlQWxsTGlzdGVuZXJzYFxuICAgKlxuICAgKiBJZiBhbGwgJ2RhdGEnIGV2ZW50IGhhbmRsZXJzIGFyZSByZW1vdmVkLCBhbmQgdGhleSB3ZXJlIHRoZSBsYXN0IGNvbnN1bWVyXG4gICAqIChpZSwgdGhlcmUgYXJlIG5vIHBpcGUgZGVzdGluYXRpb25zKSwgdGhlbiB0aGUgZmxvdyBvZiBkYXRhIHdpbGwgc3RvcFxuICAgKiB1bnRpbCB0aGVyZSBpcyBhbm90aGVyIGNvbnN1bWVyIG9yIHtAbGluayBNaW5pcGFzcyNyZXN1bWV9IGlzIGV4cGxpY2l0bHlcbiAgICogY2FsbGVkLlxuICAgKi9cbiAgcmVtb3ZlQWxsTGlzdGVuZXJzPEV2ZW50IGV4dGVuZHMga2V5b2YgRXZlbnRzPihldj86IEV2ZW50KSB7XG4gICAgY29uc3QgcmV0ID0gc3VwZXIucmVtb3ZlQWxsTGlzdGVuZXJzKGV2IGFzIHN0cmluZyB8IHN5bWJvbCB8IHVuZGVmaW5lZClcbiAgICBpZiAoZXYgPT09ICdkYXRhJyB8fCBldiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzW0RBVEFMSVNURU5FUlNdID0gMFxuICAgICAgaWYgKCF0aGlzW0RJU0NBUkRFRF0gJiYgIXRoaXNbUElQRVNdLmxlbmd0aCkge1xuICAgICAgICB0aGlzW0ZMT1dJTkddID0gZmFsc2VcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJldFxuICB9XG5cbiAgLyoqXG4gICAqIHRydWUgaWYgdGhlICdlbmQnIGV2ZW50IGhhcyBiZWVuIGVtaXR0ZWRcbiAgICovXG4gIGdldCBlbWl0dGVkRW5kKCkge1xuICAgIHJldHVybiB0aGlzW0VNSVRURURfRU5EXVxuICB9XG5cbiAgW01BWUJFX0VNSVRfRU5EXSgpIHtcbiAgICBpZiAoXG4gICAgICAhdGhpc1tFTUlUVElOR19FTkRdICYmXG4gICAgICAhdGhpc1tFTUlUVEVEX0VORF0gJiZcbiAgICAgICF0aGlzW0RFU1RST1lFRF0gJiZcbiAgICAgIHRoaXNbQlVGRkVSXS5sZW5ndGggPT09IDAgJiZcbiAgICAgIHRoaXNbRU9GXVxuICAgICkge1xuICAgICAgdGhpc1tFTUlUVElOR19FTkRdID0gdHJ1ZVxuICAgICAgdGhpcy5lbWl0KCdlbmQnKVxuICAgICAgdGhpcy5lbWl0KCdwcmVmaW5pc2gnKVxuICAgICAgdGhpcy5lbWl0KCdmaW5pc2gnKVxuICAgICAgaWYgKHRoaXNbQ0xPU0VEXSkgdGhpcy5lbWl0KCdjbG9zZScpXG4gICAgICB0aGlzW0VNSVRUSU5HX0VORF0gPSBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNb3N0bHkgaWRlbnRpY2FsIHRvIGBFdmVudEVtaXR0ZXIuZW1pdGAsIHdpdGggdGhlIGZvbGxvd2luZ1xuICAgKiBiZWhhdmlvciBkaWZmZXJlbmNlcyB0byBwcmV2ZW50IGRhdGEgbG9zcyBhbmQgdW5uZWNlc3NhcnkgaGFuZ3M6XG4gICAqXG4gICAqIElmIHRoZSBzdHJlYW0gaGFzIGJlZW4gZGVzdHJveWVkLCBhbmQgdGhlIGV2ZW50IGlzIHNvbWV0aGluZyBvdGhlclxuICAgKiB0aGFuICdjbG9zZScgb3IgJ2Vycm9yJywgdGhlbiBgZmFsc2VgIGlzIHJldHVybmVkIGFuZCBubyBoYW5kbGVyc1xuICAgKiBhcmUgY2FsbGVkLlxuICAgKlxuICAgKiBJZiB0aGUgZXZlbnQgaXMgJ2VuZCcsIGFuZCBoYXMgYWxyZWFkeSBiZWVuIGVtaXR0ZWQsIHRoZW4gdGhlIGV2ZW50XG4gICAqIGlzIGlnbm9yZWQuIElmIHRoZSBzdHJlYW0gaXMgaW4gYSBwYXVzZWQgb3Igbm9uLWZsb3dpbmcgc3RhdGUsIHRoZW5cbiAgICogdGhlIGV2ZW50IHdpbGwgYmUgZGVmZXJyZWQgdW50aWwgZGF0YSBmbG93IHJlc3VtZXMuIElmIHRoZSBzdHJlYW0gaXNcbiAgICogYXN5bmMsIHRoZW4gaGFuZGxlcnMgd2lsbCBiZSBjYWxsZWQgb24gdGhlIG5leHQgdGljayByYXRoZXIgdGhhblxuICAgKiBpbW1lZGlhdGVseS5cbiAgICpcbiAgICogSWYgdGhlIGV2ZW50IGlzICdjbG9zZScsIGFuZCAnZW5kJyBoYXMgbm90IHlldCBiZWVuIGVtaXR0ZWQsIHRoZW5cbiAgICogdGhlIGV2ZW50IHdpbGwgYmUgZGVmZXJyZWQgdW50aWwgYWZ0ZXIgJ2VuZCcgaXMgZW1pdHRlZC5cbiAgICpcbiAgICogSWYgdGhlIGV2ZW50IGlzICdlcnJvcicsIGFuZCBhbiBBYm9ydFNpZ25hbCB3YXMgcHJvdmlkZWQgZm9yIHRoZSBzdHJlYW0sXG4gICAqIGFuZCB0aGVyZSBhcmUgbm8gbGlzdGVuZXJzLCB0aGVuIHRoZSBldmVudCBpcyBpZ25vcmVkLCBtYXRjaGluZyB0aGVcbiAgICogYmVoYXZpb3Igb2Ygbm9kZSBjb3JlIHN0cmVhbXMgaW4gdGhlIHByZXNlbnNlIG9mIGFuIEFib3J0U2lnbmFsLlxuICAgKlxuICAgKiBJZiB0aGUgZXZlbnQgaXMgJ2ZpbmlzaCcgb3IgJ3ByZWZpbmlzaCcsIHRoZW4gYWxsIGxpc3RlbmVycyB3aWxsIGJlXG4gICAqIHJlbW92ZWQgYWZ0ZXIgZW1pdHRpbmcgdGhlIGV2ZW50LCB0byBwcmV2ZW50IGRvdWJsZS1maXJpbmcuXG4gICAqL1xuICBlbWl0PEV2ZW50IGV4dGVuZHMga2V5b2YgRXZlbnRzPihcbiAgICBldjogRXZlbnQsXG4gICAgLi4uYXJnczogRXZlbnRzW0V2ZW50XVxuICApOiBib29sZWFuIHtcbiAgICBjb25zdCBkYXRhID0gYXJnc1swXVxuICAgIC8vIGVycm9yIGFuZCBjbG9zZSBhcmUgb25seSBldmVudHMgYWxsb3dlZCBhZnRlciBjYWxsaW5nIGRlc3Ryb3koKVxuICAgIGlmIChcbiAgICAgIGV2ICE9PSAnZXJyb3InICYmXG4gICAgICBldiAhPT0gJ2Nsb3NlJyAmJlxuICAgICAgZXYgIT09IERFU1RST1lFRCAmJlxuICAgICAgdGhpc1tERVNUUk9ZRURdXG4gICAgKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9IGVsc2UgaWYgKGV2ID09PSAnZGF0YScpIHtcbiAgICAgIHJldHVybiAhdGhpc1tPQkpFQ1RNT0RFXSAmJiAhZGF0YVxuICAgICAgICA/IGZhbHNlXG4gICAgICAgIDogdGhpc1tBU1lOQ11cbiAgICAgICAgPyAoZGVmZXIoKCkgPT4gdGhpc1tFTUlUREFUQV0oZGF0YSBhcyBSVHlwZSkpLCB0cnVlKVxuICAgICAgICA6IHRoaXNbRU1JVERBVEFdKGRhdGEgYXMgUlR5cGUpXG4gICAgfSBlbHNlIGlmIChldiA9PT0gJ2VuZCcpIHtcbiAgICAgIHJldHVybiB0aGlzW0VNSVRFTkRdKClcbiAgICB9IGVsc2UgaWYgKGV2ID09PSAnY2xvc2UnKSB7XG4gICAgICB0aGlzW0NMT1NFRF0gPSB0cnVlXG4gICAgICAvLyBkb24ndCBlbWl0IGNsb3NlIGJlZm9yZSAnZW5kJyBhbmQgJ2ZpbmlzaCdcbiAgICAgIGlmICghdGhpc1tFTUlUVEVEX0VORF0gJiYgIXRoaXNbREVTVFJPWUVEXSkgcmV0dXJuIGZhbHNlXG4gICAgICBjb25zdCByZXQgPSBzdXBlci5lbWl0KCdjbG9zZScpXG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygnY2xvc2UnKVxuICAgICAgcmV0dXJuIHJldFxuICAgIH0gZWxzZSBpZiAoZXYgPT09ICdlcnJvcicpIHtcbiAgICAgIHRoaXNbRU1JVFRFRF9FUlJPUl0gPSBkYXRhXG4gICAgICBzdXBlci5lbWl0KEVSUk9SLCBkYXRhKVxuICAgICAgY29uc3QgcmV0ID1cbiAgICAgICAgIXRoaXNbU0lHTkFMXSB8fCB0aGlzLmxpc3RlbmVycygnZXJyb3InKS5sZW5ndGhcbiAgICAgICAgICA/IHN1cGVyLmVtaXQoJ2Vycm9yJywgZGF0YSlcbiAgICAgICAgICA6IGZhbHNlXG4gICAgICB0aGlzW01BWUJFX0VNSVRfRU5EXSgpXG4gICAgICByZXR1cm4gcmV0XG4gICAgfSBlbHNlIGlmIChldiA9PT0gJ3Jlc3VtZScpIHtcbiAgICAgIGNvbnN0IHJldCA9IHN1cGVyLmVtaXQoJ3Jlc3VtZScpXG4gICAgICB0aGlzW01BWUJFX0VNSVRfRU5EXSgpXG4gICAgICByZXR1cm4gcmV0XG4gICAgfSBlbHNlIGlmIChldiA9PT0gJ2ZpbmlzaCcgfHwgZXYgPT09ICdwcmVmaW5pc2gnKSB7XG4gICAgICBjb25zdCByZXQgPSBzdXBlci5lbWl0KGV2KVxuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoZXYpXG4gICAgICByZXR1cm4gcmV0XG4gICAgfVxuXG4gICAgLy8gU29tZSBvdGhlciB1bmtub3duIGV2ZW50XG4gICAgY29uc3QgcmV0ID0gc3VwZXIuZW1pdChldiBhcyBzdHJpbmcsIC4uLmFyZ3MpXG4gICAgdGhpc1tNQVlCRV9FTUlUX0VORF0oKVxuICAgIHJldHVybiByZXRcbiAgfVxuXG4gIFtFTUlUREFUQV0oZGF0YTogUlR5cGUpIHtcbiAgICBmb3IgKGNvbnN0IHAgb2YgdGhpc1tQSVBFU10pIHtcbiAgICAgIGlmIChwLmRlc3Qud3JpdGUoZGF0YSBhcyBSVHlwZSkgPT09IGZhbHNlKSB0aGlzLnBhdXNlKClcbiAgICB9XG4gICAgY29uc3QgcmV0ID0gdGhpc1tESVNDQVJERURdID8gZmFsc2UgOiBzdXBlci5lbWl0KCdkYXRhJywgZGF0YSlcbiAgICB0aGlzW01BWUJFX0VNSVRfRU5EXSgpXG4gICAgcmV0dXJuIHJldFxuICB9XG5cbiAgW0VNSVRFTkRdKCkge1xuICAgIGlmICh0aGlzW0VNSVRURURfRU5EXSkgcmV0dXJuIGZhbHNlXG5cbiAgICB0aGlzW0VNSVRURURfRU5EXSA9IHRydWVcbiAgICB0aGlzLnJlYWRhYmxlID0gZmFsc2VcbiAgICByZXR1cm4gdGhpc1tBU1lOQ11cbiAgICAgID8gKGRlZmVyKCgpID0+IHRoaXNbRU1JVEVORDJdKCkpLCB0cnVlKVxuICAgICAgOiB0aGlzW0VNSVRFTkQyXSgpXG4gIH1cblxuICBbRU1JVEVORDJdKCkge1xuICAgIGlmICh0aGlzW0RFQ09ERVJdKSB7XG4gICAgICBjb25zdCBkYXRhID0gdGhpc1tERUNPREVSXS5lbmQoKVxuICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgZm9yIChjb25zdCBwIG9mIHRoaXNbUElQRVNdKSB7XG4gICAgICAgICAgcC5kZXN0LndyaXRlKGRhdGEgYXMgUlR5cGUpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzW0RJU0NBUkRFRF0pIHN1cGVyLmVtaXQoJ2RhdGEnLCBkYXRhKVxuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgcCBvZiB0aGlzW1BJUEVTXSkge1xuICAgICAgcC5lbmQoKVxuICAgIH1cbiAgICBjb25zdCByZXQgPSBzdXBlci5lbWl0KCdlbmQnKVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdlbmQnKVxuICAgIHJldHVybiByZXRcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgYWxsIGVtaXR0ZWQgZGF0YSBvbmNlXG4gICAqIHRoZSBzdHJlYW0gZW5kcy5cbiAgICovXG4gIGFzeW5jIGNvbGxlY3QoKTogUHJvbWlzZTxSVHlwZVtdICYgeyBkYXRhTGVuZ3RoOiBudW1iZXIgfT4ge1xuICAgIGNvbnN0IGJ1ZjogUlR5cGVbXSAmIHsgZGF0YUxlbmd0aDogbnVtYmVyIH0gPSBPYmplY3QuYXNzaWduKFtdLCB7XG4gICAgICBkYXRhTGVuZ3RoOiAwLFxuICAgIH0pXG4gICAgaWYgKCF0aGlzW09CSkVDVE1PREVdKSBidWYuZGF0YUxlbmd0aCA9IDBcbiAgICAvLyBzZXQgdGhlIHByb21pc2UgZmlyc3QsIGluIGNhc2UgYW4gZXJyb3IgaXMgcmFpc2VkXG4gICAgLy8gYnkgdHJpZ2dlcmluZyB0aGUgZmxvdyBoZXJlLlxuICAgIGNvbnN0IHAgPSB0aGlzLnByb21pc2UoKVxuICAgIHRoaXMub24oJ2RhdGEnLCBjID0+IHtcbiAgICAgIGJ1Zi5wdXNoKGMpXG4gICAgICBpZiAoIXRoaXNbT0JKRUNUTU9ERV0pXG4gICAgICAgIGJ1Zi5kYXRhTGVuZ3RoICs9IChjIGFzIE1pbmlwYXNzLkJ1ZmZlck9yU3RyaW5nKS5sZW5ndGhcbiAgICB9KVxuICAgIGF3YWl0IHBcbiAgICByZXR1cm4gYnVmXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGEgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRoZSBjb25jYXRlbmF0aW9uIG9mIGFsbCBlbWl0dGVkIGRhdGFcbiAgICogb25jZSB0aGUgc3RyZWFtIGVuZHMuXG4gICAqXG4gICAqIE5vdCBhbGxvd2VkIG9uIG9iamVjdE1vZGUgc3RyZWFtcy5cbiAgICovXG4gIGFzeW5jIGNvbmNhdCgpOiBQcm9taXNlPFJUeXBlPiB7XG4gICAgaWYgKHRoaXNbT0JKRUNUTU9ERV0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignY2Fubm90IGNvbmNhdCBpbiBvYmplY3RNb2RlJylcbiAgICB9XG4gICAgY29uc3QgYnVmID0gYXdhaXQgdGhpcy5jb2xsZWN0KClcbiAgICByZXR1cm4gKFxuICAgICAgdGhpc1tFTkNPRElOR11cbiAgICAgICAgPyBidWYuam9pbignJylcbiAgICAgICAgOiBCdWZmZXIuY29uY2F0KGJ1ZiBhcyBCdWZmZXJbXSwgYnVmLmRhdGFMZW5ndGgpXG4gICAgKSBhcyBSVHlwZVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIHZvaWQgUHJvbWlzZSB0aGF0IHJlc29sdmVzIG9uY2UgdGhlIHN0cmVhbSBlbmRzLlxuICAgKi9cbiAgYXN5bmMgcHJvbWlzZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5vbihERVNUUk9ZRUQsICgpID0+IHJlamVjdChuZXcgRXJyb3IoJ3N0cmVhbSBkZXN0cm95ZWQnKSkpXG4gICAgICB0aGlzLm9uKCdlcnJvcicsIGVyID0+IHJlamVjdChlcikpXG4gICAgICB0aGlzLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKCkpXG4gICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXMgYGZvciBhd2FpdCBvZmAgaXRlcmF0aW9uLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgY29udGludWUgZW1pdHRpbmcgYWxsIGNodW5rcyB1bnRpbCB0aGUgc3RyZWFtIHRlcm1pbmF0ZXMuXG4gICAqL1xuICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk6IEFzeW5jR2VuZXJhdG9yPFJUeXBlLCB2b2lkLCB2b2lkPiB7XG4gICAgLy8gc2V0IHRoaXMgdXAgZnJvbnQsIGluIGNhc2UgdGhlIGNvbnN1bWVyIGRvZXNuJ3QgY2FsbCBuZXh0KClcbiAgICAvLyByaWdodCBhd2F5LlxuICAgIHRoaXNbRElTQ0FSREVEXSA9IGZhbHNlXG4gICAgbGV0IHN0b3BwZWQgPSBmYWxzZVxuICAgIGNvbnN0IHN0b3AgPSBhc3luYyAoKTogUHJvbWlzZTxJdGVyYXRvclJldHVyblJlc3VsdDx2b2lkPj4gPT4ge1xuICAgICAgdGhpcy5wYXVzZSgpXG4gICAgICBzdG9wcGVkID0gdHJ1ZVxuICAgICAgcmV0dXJuIHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9XG4gICAgfVxuICAgIGNvbnN0IG5leHQgPSAoKTogUHJvbWlzZTxJdGVyYXRvclJlc3VsdDxSVHlwZSwgdm9pZD4+ID0+IHtcbiAgICAgIGlmIChzdG9wcGVkKSByZXR1cm4gc3RvcCgpXG4gICAgICBjb25zdCByZXMgPSB0aGlzLnJlYWQoKVxuICAgICAgaWYgKHJlcyAhPT0gbnVsbCkgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IGRvbmU6IGZhbHNlLCB2YWx1ZTogcmVzIH0pXG5cbiAgICAgIGlmICh0aGlzW0VPRl0pIHJldHVybiBzdG9wKClcblxuICAgICAgbGV0IHJlc29sdmUhOiAocmVzOiBJdGVyYXRvclJlc3VsdDxSVHlwZT4pID0+IHZvaWRcbiAgICAgIGxldCByZWplY3QhOiAoZXI6IHVua25vd24pID0+IHZvaWRcbiAgICAgIGNvbnN0IG9uZXJyID0gKGVyOiB1bmtub3duKSA9PiB7XG4gICAgICAgIHRoaXMub2ZmKCdkYXRhJywgb25kYXRhKVxuICAgICAgICB0aGlzLm9mZignZW5kJywgb25lbmQpXG4gICAgICAgIHRoaXMub2ZmKERFU1RST1lFRCwgb25kZXN0cm95KVxuICAgICAgICBzdG9wKClcbiAgICAgICAgcmVqZWN0KGVyKVxuICAgICAgfVxuICAgICAgY29uc3Qgb25kYXRhID0gKHZhbHVlOiBSVHlwZSkgPT4ge1xuICAgICAgICB0aGlzLm9mZignZXJyb3InLCBvbmVycilcbiAgICAgICAgdGhpcy5vZmYoJ2VuZCcsIG9uZW5kKVxuICAgICAgICB0aGlzLm9mZihERVNUUk9ZRUQsIG9uZGVzdHJveSlcbiAgICAgICAgdGhpcy5wYXVzZSgpXG4gICAgICAgIHJlc29sdmUoeyB2YWx1ZSwgZG9uZTogISF0aGlzW0VPRl0gfSlcbiAgICAgIH1cbiAgICAgIGNvbnN0IG9uZW5kID0gKCkgPT4ge1xuICAgICAgICB0aGlzLm9mZignZXJyb3InLCBvbmVycilcbiAgICAgICAgdGhpcy5vZmYoJ2RhdGEnLCBvbmRhdGEpXG4gICAgICAgIHRoaXMub2ZmKERFU1RST1lFRCwgb25kZXN0cm95KVxuICAgICAgICBzdG9wKClcbiAgICAgICAgcmVzb2x2ZSh7IGRvbmU6IHRydWUsIHZhbHVlOiB1bmRlZmluZWQgfSlcbiAgICAgIH1cbiAgICAgIGNvbnN0IG9uZGVzdHJveSA9ICgpID0+IG9uZXJyKG5ldyBFcnJvcignc3RyZWFtIGRlc3Ryb3llZCcpKVxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPEl0ZXJhdG9yUmVzdWx0PFJUeXBlPj4oKHJlcywgcmVqKSA9PiB7XG4gICAgICAgIHJlamVjdCA9IHJlalxuICAgICAgICByZXNvbHZlID0gcmVzXG4gICAgICAgIHRoaXMub25jZShERVNUUk9ZRUQsIG9uZGVzdHJveSlcbiAgICAgICAgdGhpcy5vbmNlKCdlcnJvcicsIG9uZXJyKVxuICAgICAgICB0aGlzLm9uY2UoJ2VuZCcsIG9uZW5kKVxuICAgICAgICB0aGlzLm9uY2UoJ2RhdGEnLCBvbmRhdGEpXG4gICAgICB9KVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBuZXh0LFxuICAgICAgdGhyb3c6IHN0b3AsXG4gICAgICByZXR1cm46IHN0b3AsXG4gICAgICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgICByZXR1cm4gdGhpc1xuICAgICAgfSxcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3luY2hyb25vdXMgYGZvciBvZmAgaXRlcmF0aW9uLlxuICAgKlxuICAgKiBUaGUgaXRlcmF0aW9uIHdpbGwgdGVybWluYXRlIHdoZW4gdGhlIGludGVybmFsIGJ1ZmZlciBydW5zIG91dCwgZXZlblxuICAgKiBpZiB0aGUgc3RyZWFtIGhhcyBub3QgeWV0IHRlcm1pbmF0ZWQuXG4gICAqL1xuICBbU3ltYm9sLml0ZXJhdG9yXSgpOiBHZW5lcmF0b3I8UlR5cGUsIHZvaWQsIHZvaWQ+IHtcbiAgICAvLyBzZXQgdGhpcyB1cCBmcm9udCwgaW4gY2FzZSB0aGUgY29uc3VtZXIgZG9lc24ndCBjYWxsIG5leHQoKVxuICAgIC8vIHJpZ2h0IGF3YXkuXG4gICAgdGhpc1tESVNDQVJERURdID0gZmFsc2VcbiAgICBsZXQgc3RvcHBlZCA9IGZhbHNlXG4gICAgY29uc3Qgc3RvcCA9ICgpOiBJdGVyYXRvclJldHVyblJlc3VsdDx2b2lkPiA9PiB7XG4gICAgICB0aGlzLnBhdXNlKClcbiAgICAgIHRoaXMub2ZmKEVSUk9SLCBzdG9wKVxuICAgICAgdGhpcy5vZmYoREVTVFJPWUVELCBzdG9wKVxuICAgICAgdGhpcy5vZmYoJ2VuZCcsIHN0b3ApXG4gICAgICBzdG9wcGVkID0gdHJ1ZVxuICAgICAgcmV0dXJuIHsgZG9uZTogdHJ1ZSwgdmFsdWU6IHVuZGVmaW5lZCB9XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dCA9ICgpOiBJdGVyYXRvclJlc3VsdDxSVHlwZSwgdm9pZD4gPT4ge1xuICAgICAgaWYgKHN0b3BwZWQpIHJldHVybiBzdG9wKClcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWFkKClcbiAgICAgIHJldHVybiB2YWx1ZSA9PT0gbnVsbCA/IHN0b3AoKSA6IHsgZG9uZTogZmFsc2UsIHZhbHVlIH1cbiAgICB9XG5cbiAgICB0aGlzLm9uY2UoJ2VuZCcsIHN0b3ApXG4gICAgdGhpcy5vbmNlKEVSUk9SLCBzdG9wKVxuICAgIHRoaXMub25jZShERVNUUk9ZRUQsIHN0b3ApXG5cbiAgICByZXR1cm4ge1xuICAgICAgbmV4dCxcbiAgICAgIHRocm93OiBzdG9wLFxuICAgICAgcmV0dXJuOiBzdG9wLFxuICAgICAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgICB9LFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEZXN0cm95IGEgc3RyZWFtLCBwcmV2ZW50aW5nIGl0IGZyb20gYmVpbmcgdXNlZCBmb3IgYW55IGZ1cnRoZXIgcHVycG9zZS5cbiAgICpcbiAgICogSWYgdGhlIHN0cmVhbSBoYXMgYSBgY2xvc2UoKWAgbWV0aG9kLCB0aGVuIGl0IHdpbGwgYmUgY2FsbGVkIG9uXG4gICAqIGRlc3RydWN0aW9uLlxuICAgKlxuICAgKiBBZnRlciBkZXN0cnVjdGlvbiwgYW55IGF0dGVtcHQgdG8gd3JpdGUgZGF0YSwgcmVhZCBkYXRhLCBvciBlbWl0IG1vc3RcbiAgICogZXZlbnRzIHdpbGwgYmUgaWdub3JlZC5cbiAgICpcbiAgICogSWYgYW4gZXJyb3IgYXJndW1lbnQgaXMgcHJvdmlkZWQsIHRoZW4gaXQgd2lsbCBiZSBlbWl0dGVkIGluIGFuXG4gICAqICdlcnJvcicgZXZlbnQuXG4gICAqL1xuICBkZXN0cm95KGVyPzogdW5rbm93bikge1xuICAgIGlmICh0aGlzW0RFU1RST1lFRF0pIHtcbiAgICAgIGlmIChlcikgdGhpcy5lbWl0KCdlcnJvcicsIGVyKVxuICAgICAgZWxzZSB0aGlzLmVtaXQoREVTVFJPWUVEKVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICB0aGlzW0RFU1RST1lFRF0gPSB0cnVlXG4gICAgdGhpc1tESVNDQVJERURdID0gdHJ1ZVxuXG4gICAgLy8gdGhyb3cgYXdheSBhbGwgYnVmZmVyZWQgZGF0YSwgaXQncyBuZXZlciBjb21pbmcgb3V0XG4gICAgdGhpc1tCVUZGRVJdLmxlbmd0aCA9IDBcbiAgICB0aGlzW0JVRkZFUkxFTkdUSF0gPSAwXG5cbiAgICBjb25zdCB3YyA9IHRoaXMgYXMgTWluaXBhc3M8UlR5cGUsIFdUeXBlLCBFdmVudHM+ICYge1xuICAgICAgY2xvc2U/OiAoKSA9PiB2b2lkXG4gICAgfVxuICAgIGlmICh0eXBlb2Ygd2MuY2xvc2UgPT09ICdmdW5jdGlvbicgJiYgIXRoaXNbQ0xPU0VEXSkgd2MuY2xvc2UoKVxuXG4gICAgaWYgKGVyKSB0aGlzLmVtaXQoJ2Vycm9yJywgZXIpXG4gICAgLy8gaWYgbm8gZXJyb3IgdG8gZW1pdCwgc3RpbGwgcmVqZWN0IHBlbmRpbmcgcHJvbWlzZXNcbiAgICBlbHNlIHRoaXMuZW1pdChERVNUUk9ZRUQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEFsaWFzIGZvciB7QGxpbmsgaXNTdHJlYW19XG4gICAqXG4gICAqIEZvcm1lciBleHBvcnQgbG9jYXRpb24sIG1haW50YWluZWQgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICAgKlxuICAgKiBAZGVwcmVjYXRlZFxuICAgKi9cbiAgc3RhdGljIGdldCBpc1N0cmVhbSgpIHtcbiAgICByZXR1cm4gaXNTdHJlYW1cbiAgfVxufVxuIiwgIi8vIHRoaXMgaXMganVzdCBhIHZlcnkgbGlnaHQgd3JhcHBlciBhcm91bmQgMiBhcnJheXMgd2l0aCBhbiBvZmZzZXQgaW5kZXhcblxuaW1wb3J0IHsgR0xPQlNUQVIgfSBmcm9tICdtaW5pbWF0Y2gnXG5leHBvcnQgdHlwZSBNTVBhdHRlcm4gPSBzdHJpbmcgfCBSZWdFeHAgfCB0eXBlb2YgR0xPQlNUQVJcblxuLy8gYW4gYXJyYXkgb2YgbGVuZ3RoID49IDFcbmV4cG9ydCB0eXBlIFBhdHRlcm5MaXN0ID0gW3A6IE1NUGF0dGVybiwgLi4ucmVzdDogTU1QYXR0ZXJuW11dXG5leHBvcnQgdHlwZSBVTkNQYXR0ZXJuTGlzdCA9IFtcbiAgcDA6ICcnLFxuICBwMTogJycsXG4gIHAyOiBzdHJpbmcsXG4gIHAzOiBzdHJpbmcsXG4gIC4uLnJlc3Q6IE1NUGF0dGVybltdLFxuXVxuZXhwb3J0IHR5cGUgRHJpdmVQYXR0ZXJuTGlzdCA9IFtwMDogc3RyaW5nLCAuLi5yZXN0OiBNTVBhdHRlcm5bXV1cbmV4cG9ydCB0eXBlIEFic29sdXRlUGF0dGVybkxpc3QgPSBbcDA6ICcnLCAuLi5yZXN0OiBNTVBhdHRlcm5bXV1cbmV4cG9ydCB0eXBlIEdsb2JMaXN0ID0gW3A6IHN0cmluZywgLi4ucmVzdDogc3RyaW5nW11dXG5cbmNvbnN0IGlzUGF0dGVybkxpc3QgPSAocGw6IE1NUGF0dGVybltdKTogcGwgaXMgUGF0dGVybkxpc3QgPT5cbiAgcGwubGVuZ3RoID49IDFcbmNvbnN0IGlzR2xvYkxpc3QgPSAoZ2w6IHN0cmluZ1tdKTogZ2wgaXMgR2xvYkxpc3QgPT4gZ2wubGVuZ3RoID49IDFcblxuLyoqXG4gKiBBbiBpbW11dGFibGUtaXNoIHZpZXcgb24gYW4gYXJyYXkgb2YgZ2xvYiBwYXJ0cyBhbmQgdGhlaXIgcGFyc2VkXG4gKiByZXN1bHRzXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXR0ZXJuIHtcbiAgcmVhZG9ubHkgI3BhdHRlcm5MaXN0OiBQYXR0ZXJuTGlzdFxuICByZWFkb25seSAjZ2xvYkxpc3Q6IEdsb2JMaXN0XG4gIHJlYWRvbmx5ICNpbmRleDogbnVtYmVyXG4gIHJlYWRvbmx5IGxlbmd0aDogbnVtYmVyXG4gIHJlYWRvbmx5ICNwbGF0Zm9ybTogTm9kZUpTLlBsYXRmb3JtXG4gICNyZXN0PzogUGF0dGVybiB8IG51bGxcbiAgI2dsb2JTdHJpbmc/OiBzdHJpbmdcbiAgI2lzRHJpdmU/OiBib29sZWFuXG4gICNpc1VOQz86IGJvb2xlYW5cbiAgI2lzQWJzb2x1dGU/OiBib29sZWFuXG4gICNmb2xsb3dHbG9ic3RhcjogYm9vbGVhbiA9IHRydWVcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwYXR0ZXJuTGlzdDogTU1QYXR0ZXJuW10sXG4gICAgZ2xvYkxpc3Q6IHN0cmluZ1tdLFxuICAgIGluZGV4OiBudW1iZXIsXG4gICAgcGxhdGZvcm06IE5vZGVKUy5QbGF0Zm9ybSxcbiAgKSB7XG4gICAgaWYgKCFpc1BhdHRlcm5MaXN0KHBhdHRlcm5MaXN0KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZW1wdHkgcGF0dGVybiBsaXN0JylcbiAgICB9XG4gICAgaWYgKCFpc0dsb2JMaXN0KGdsb2JMaXN0KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZW1wdHkgZ2xvYiBsaXN0JylcbiAgICB9XG4gICAgaWYgKGdsb2JMaXN0Lmxlbmd0aCAhPT0gcGF0dGVybkxpc3QubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtaXNtYXRjaGVkIHBhdHRlcm4gbGlzdCBhbmQgZ2xvYiBsaXN0IGxlbmd0aHMnKVxuICAgIH1cbiAgICB0aGlzLmxlbmd0aCA9IHBhdHRlcm5MaXN0Lmxlbmd0aFxuICAgIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG4gICAgfVxuICAgIHRoaXMuI3BhdHRlcm5MaXN0ID0gcGF0dGVybkxpc3RcbiAgICB0aGlzLiNnbG9iTGlzdCA9IGdsb2JMaXN0XG4gICAgdGhpcy4jaW5kZXggPSBpbmRleFxuICAgIHRoaXMuI3BsYXRmb3JtID0gcGxhdGZvcm1cblxuICAgIC8vIG5vcm1hbGl6ZSByb290IGVudHJpZXMgb2YgYWJzb2x1dGUgcGF0dGVybnMgb24gaW5pdGlhbCBjcmVhdGlvbi5cbiAgICBpZiAodGhpcy4jaW5kZXggPT09IDApIHtcbiAgICAgIC8vIGM6ID0+IFsnYzovJ11cbiAgICAgIC8vIEM6LyA9PiBbJ0M6LyddXG4gICAgICAvLyBDOi94ID0+IFsnQzovJywgJ3gnXVxuICAgICAgLy8gLy9ob3N0L3NoYXJlID0+IFsnLy9ob3N0L3NoYXJlLyddXG4gICAgICAvLyAvL2hvc3Qvc2hhcmUvID0+IFsnLy9ob3N0L3NoYXJlLyddXG4gICAgICAvLyAvL2hvc3Qvc2hhcmUveCA9PiBbJy8vaG9zdC9zaGFyZS8nLCAneCddXG4gICAgICAvLyAvZXRjID0+IFsnLycsICdldGMnXVxuICAgICAgLy8gLyA9PiBbJy8nXVxuICAgICAgaWYgKHRoaXMuaXNVTkMoKSkge1xuICAgICAgICAvLyAnJyAvICcnIC8gJ2hvc3QnIC8gJ3NoYXJlJ1xuICAgICAgICBjb25zdCBbcDAsIHAxLCBwMiwgcDMsIC4uLnByZXN0XSA9IHRoaXMuI3BhdHRlcm5MaXN0XG4gICAgICAgIGNvbnN0IFtnMCwgZzEsIGcyLCBnMywgLi4uZ3Jlc3RdID0gdGhpcy4jZ2xvYkxpc3RcbiAgICAgICAgaWYgKHByZXN0WzBdID09PSAnJykge1xuICAgICAgICAgIC8vIGVuZHMgaW4gL1xuICAgICAgICAgIHByZXN0LnNoaWZ0KClcbiAgICAgICAgICBncmVzdC5zaGlmdCgpXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcCA9IFtwMCwgcDEsIHAyLCBwMywgJyddLmpvaW4oJy8nKVxuICAgICAgICBjb25zdCBnID0gW2cwLCBnMSwgZzIsIGczLCAnJ10uam9pbignLycpXG4gICAgICAgIHRoaXMuI3BhdHRlcm5MaXN0ID0gW3AsIC4uLnByZXN0XVxuICAgICAgICB0aGlzLiNnbG9iTGlzdCA9IFtnLCAuLi5ncmVzdF1cbiAgICAgICAgdGhpcy5sZW5ndGggPSB0aGlzLiNwYXR0ZXJuTGlzdC5sZW5ndGhcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc0RyaXZlKCkgfHwgdGhpcy5pc0Fic29sdXRlKCkpIHtcbiAgICAgICAgY29uc3QgW3AxLCAuLi5wcmVzdF0gPSB0aGlzLiNwYXR0ZXJuTGlzdFxuICAgICAgICBjb25zdCBbZzEsIC4uLmdyZXN0XSA9IHRoaXMuI2dsb2JMaXN0XG4gICAgICAgIGlmIChwcmVzdFswXSA9PT0gJycpIHtcbiAgICAgICAgICAvLyBlbmRzIGluIC9cbiAgICAgICAgICBwcmVzdC5zaGlmdCgpXG4gICAgICAgICAgZ3Jlc3Quc2hpZnQoKVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHAgPSAocDEgYXMgc3RyaW5nKSArICcvJ1xuICAgICAgICBjb25zdCBnID0gZzEgKyAnLydcbiAgICAgICAgdGhpcy4jcGF0dGVybkxpc3QgPSBbcCwgLi4ucHJlc3RdXG4gICAgICAgIHRoaXMuI2dsb2JMaXN0ID0gW2csIC4uLmdyZXN0XVxuICAgICAgICB0aGlzLmxlbmd0aCA9IHRoaXMuI3BhdHRlcm5MaXN0Lmxlbmd0aFxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgZmlyc3QgZW50cnkgaW4gdGhlIHBhcnNlZCBsaXN0IG9mIHBhdHRlcm5zXG4gICAqL1xuICBwYXR0ZXJuKCk6IE1NUGF0dGVybiB7XG4gICAgcmV0dXJuIHRoaXMuI3BhdHRlcm5MaXN0W3RoaXMuI2luZGV4XSBhcyBNTVBhdHRlcm5cbiAgfVxuXG4gIC8qKlxuICAgKiB0cnVlIG9mIGlmIHBhdHRlcm4oKSByZXR1cm5zIGEgc3RyaW5nXG4gICAqL1xuICBpc1N0cmluZygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHlwZW9mIHRoaXMuI3BhdHRlcm5MaXN0W3RoaXMuI2luZGV4XSA9PT0gJ3N0cmluZydcbiAgfVxuICAvKipcbiAgICogdHJ1ZSBvZiBpZiBwYXR0ZXJuKCkgcmV0dXJucyBHTE9CU1RBUlxuICAgKi9cbiAgaXNHbG9ic3RhcigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy4jcGF0dGVybkxpc3RbdGhpcy4jaW5kZXhdID09PSBHTE9CU1RBUlxuICB9XG4gIC8qKlxuICAgKiB0cnVlIGlmIHBhdHRlcm4oKSByZXR1cm5zIGEgcmVnZXhwXG4gICAqL1xuICBpc1JlZ0V4cCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy4jcGF0dGVybkxpc3RbdGhpcy4jaW5kZXhdIGluc3RhbmNlb2YgUmVnRXhwXG4gIH1cblxuICAvKipcbiAgICogVGhlIC8tam9pbmVkIHNldCBvZiBnbG9iIHBhcnRzIHRoYXQgbWFrZSB1cCB0aGlzIHBhdHRlcm5cbiAgICovXG4gIGdsb2JTdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gKHRoaXMuI2dsb2JTdHJpbmcgPVxuICAgICAgdGhpcy4jZ2xvYlN0cmluZyB8fFxuICAgICAgKHRoaXMuI2luZGV4ID09PSAwID9cbiAgICAgICAgdGhpcy5pc0Fic29sdXRlKCkgP1xuICAgICAgICAgIHRoaXMuI2dsb2JMaXN0WzBdICsgdGhpcy4jZ2xvYkxpc3Quc2xpY2UoMSkuam9pbignLycpXG4gICAgICAgIDogdGhpcy4jZ2xvYkxpc3Quam9pbignLycpXG4gICAgICA6IHRoaXMuI2dsb2JMaXN0LnNsaWNlKHRoaXMuI2luZGV4KS5qb2luKCcvJykpKVxuICB9XG5cbiAgLyoqXG4gICAqIHRydWUgaWYgdGhlcmUgYXJlIG1vcmUgcGF0dGVybiBwYXJ0cyBhZnRlciB0aGlzIG9uZVxuICAgKi9cbiAgaGFzTW9yZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5sZW5ndGggPiB0aGlzLiNpbmRleCArIDFcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgcmVzdCBvZiB0aGUgcGF0dGVybiBhZnRlciB0aGlzIHBhcnQsIG9yIG51bGwgaWYgdGhpcyBpcyB0aGUgZW5kXG4gICAqL1xuICByZXN0KCk6IFBhdHRlcm4gfCBudWxsIHtcbiAgICBpZiAodGhpcy4jcmVzdCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gdGhpcy4jcmVzdFxuICAgIGlmICghdGhpcy5oYXNNb3JlKCkpIHJldHVybiAodGhpcy4jcmVzdCA9IG51bGwpXG4gICAgdGhpcy4jcmVzdCA9IG5ldyBQYXR0ZXJuKFxuICAgICAgdGhpcy4jcGF0dGVybkxpc3QsXG4gICAgICB0aGlzLiNnbG9iTGlzdCxcbiAgICAgIHRoaXMuI2luZGV4ICsgMSxcbiAgICAgIHRoaXMuI3BsYXRmb3JtLFxuICAgIClcbiAgICB0aGlzLiNyZXN0LiNpc0Fic29sdXRlID0gdGhpcy4jaXNBYnNvbHV0ZVxuICAgIHRoaXMuI3Jlc3QuI2lzVU5DID0gdGhpcy4jaXNVTkNcbiAgICB0aGlzLiNyZXN0LiNpc0RyaXZlID0gdGhpcy4jaXNEcml2ZVxuICAgIHJldHVybiB0aGlzLiNyZXN0XG4gIH1cblxuICAvKipcbiAgICogdHJ1ZSBpZiB0aGUgcGF0dGVybiByZXByZXNlbnRzIGEgLy91bmMvcGF0aC8gb24gd2luZG93c1xuICAgKi9cbiAgaXNVTkMoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgcGwgPSB0aGlzLiNwYXR0ZXJuTGlzdFxuICAgIHJldHVybiB0aGlzLiNpc1VOQyAhPT0gdW5kZWZpbmVkID9cbiAgICAgICAgdGhpcy4jaXNVTkNcbiAgICAgIDogKHRoaXMuI2lzVU5DID1cbiAgICAgICAgICB0aGlzLiNwbGF0Zm9ybSA9PT0gJ3dpbjMyJyAmJlxuICAgICAgICAgIHRoaXMuI2luZGV4ID09PSAwICYmXG4gICAgICAgICAgcGxbMF0gPT09ICcnICYmXG4gICAgICAgICAgcGxbMV0gPT09ICcnICYmXG4gICAgICAgICAgdHlwZW9mIHBsWzJdID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgICEhcGxbMl0gJiZcbiAgICAgICAgICB0eXBlb2YgcGxbM10gPT09ICdzdHJpbmcnICYmXG4gICAgICAgICAgISFwbFszXSlcbiAgfVxuXG4gIC8vIHBhdHRlcm4gbGlrZSBDOi8uLi5cbiAgLy8gc3BsaXQgPSBbJ0M6JywgLi4uXVxuICAvLyBYWFg6IHdvdWxkIGJlIG5pY2UgdG8gaGFuZGxlIHBhdHRlcm5zIGxpa2UgYGM6KmAgdG8gdGVzdCB0aGUgY3dkXG4gIC8vIGluIGM6IGZvciAqLCBidXQgSSBkb24ndCBrbm93IG9mIGEgd2F5IHRvIGV2ZW4gZmlndXJlIG91dCB3aGF0IHRoYXRcbiAgLy8gY3dkIGlzIHdpdGhvdXQgYWN0dWFsbHkgY2hkaXInaW5nIGludG8gaXQ/XG4gIC8qKlxuICAgKiBUcnVlIGlmIHRoZSBwYXR0ZXJuIHN0YXJ0cyB3aXRoIGEgZHJpdmUgbGV0dGVyIG9uIFdpbmRvd3NcbiAgICovXG4gIGlzRHJpdmUoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgcGwgPSB0aGlzLiNwYXR0ZXJuTGlzdFxuICAgIHJldHVybiB0aGlzLiNpc0RyaXZlICE9PSB1bmRlZmluZWQgP1xuICAgICAgICB0aGlzLiNpc0RyaXZlXG4gICAgICA6ICh0aGlzLiNpc0RyaXZlID1cbiAgICAgICAgICB0aGlzLiNwbGF0Zm9ybSA9PT0gJ3dpbjMyJyAmJlxuICAgICAgICAgIHRoaXMuI2luZGV4ID09PSAwICYmXG4gICAgICAgICAgdGhpcy5sZW5ndGggPiAxICYmXG4gICAgICAgICAgdHlwZW9mIHBsWzBdID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgIC9eW2Etel06JC9pLnRlc3QocGxbMF0pKVxuICB9XG5cbiAgLy8gcGF0dGVybiA9ICcvJyBvciAnLy4uLicgb3IgJy94Ly4uLidcbiAgLy8gc3BsaXQgPSBbJycsICcnXSBvciBbJycsIC4uLl0gb3IgWycnLCAneCcsIC4uLl1cbiAgLy8gRHJpdmUgYW5kIFVOQyBib3RoIGNvbnNpZGVyZWQgYWJzb2x1dGUgb24gd2luZG93c1xuICAvKipcbiAgICogVHJ1ZSBpZiB0aGUgcGF0dGVybiBpcyByb290ZWQgb24gYW4gYWJzb2x1dGUgcGF0aFxuICAgKi9cbiAgaXNBYnNvbHV0ZSgpOiBib29sZWFuIHtcbiAgICBjb25zdCBwbCA9IHRoaXMuI3BhdHRlcm5MaXN0XG4gICAgcmV0dXJuIHRoaXMuI2lzQWJzb2x1dGUgIT09IHVuZGVmaW5lZCA/XG4gICAgICAgIHRoaXMuI2lzQWJzb2x1dGVcbiAgICAgIDogKHRoaXMuI2lzQWJzb2x1dGUgPVxuICAgICAgICAgIChwbFswXSA9PT0gJycgJiYgcGwubGVuZ3RoID4gMSkgfHxcbiAgICAgICAgICB0aGlzLmlzRHJpdmUoKSB8fFxuICAgICAgICAgIHRoaXMuaXNVTkMoKSlcbiAgfVxuXG4gIC8qKlxuICAgKiBjb25zdW1lIHRoZSByb290IG9mIHRoZSBwYXR0ZXJuLCBhbmQgcmV0dXJuIGl0XG4gICAqL1xuICByb290KCk6IHN0cmluZyB7XG4gICAgY29uc3QgcCA9IHRoaXMuI3BhdHRlcm5MaXN0WzBdXG4gICAgcmV0dXJuIChcbiAgICAgICAgdHlwZW9mIHAgPT09ICdzdHJpbmcnICYmIHRoaXMuaXNBYnNvbHV0ZSgpICYmIHRoaXMuI2luZGV4ID09PSAwXG4gICAgICApID9cbiAgICAgICAgcFxuICAgICAgOiAnJ1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHRvIHNlZSBpZiB0aGUgY3VycmVudCBnbG9ic3RhciBwYXR0ZXJuIGlzIGFsbG93ZWQgdG8gZm9sbG93XG4gICAqIGEgc3ltYm9saWMgbGluay5cbiAgICovXG4gIGNoZWNrRm9sbG93R2xvYnN0YXIoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICEoXG4gICAgICB0aGlzLiNpbmRleCA9PT0gMCB8fFxuICAgICAgIXRoaXMuaXNHbG9ic3RhcigpIHx8XG4gICAgICAhdGhpcy4jZm9sbG93R2xvYnN0YXJcbiAgICApXG4gIH1cblxuICAvKipcbiAgICogTWFyayB0aGF0IHRoZSBjdXJyZW50IGdsb2JzdGFyIHBhdHRlcm4gaXMgZm9sbG93aW5nIGEgc3ltYm9saWMgbGlua1xuICAgKi9cbiAgbWFya0ZvbGxvd0dsb2JzdGFyKCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLiNpbmRleCA9PT0gMCB8fCAhdGhpcy5pc0dsb2JzdGFyKCkgfHwgIXRoaXMuI2ZvbGxvd0dsb2JzdGFyKVxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgdGhpcy4jZm9sbG93R2xvYnN0YXIgPSBmYWxzZVxuICAgIHJldHVybiB0cnVlXG4gIH1cbn1cbiIsICIvLyBnaXZlIGl0IGEgcGF0dGVybiwgYW5kIGl0J2xsIGJlIGFibGUgdG8gdGVsbCB5b3UgaWZcbi8vIGEgZ2l2ZW4gcGF0aCBzaG91bGQgYmUgaWdub3JlZC5cbi8vIElnbm9yaW5nIGEgcGF0aCBpZ25vcmVzIGl0cyBjaGlsZHJlbiBpZiB0aGUgcGF0dGVybiBlbmRzIGluIC8qKlxuLy8gSWdub3JlcyBhcmUgYWx3YXlzIHBhcnNlZCBpbiBkb3Q6dHJ1ZSBtb2RlXG5cbmltcG9ydCB7IE1pbmltYXRjaCwgTWluaW1hdGNoT3B0aW9ucyB9IGZyb20gJ21pbmltYXRjaCdcbmltcG9ydCB7IFBhdGggfSBmcm9tICdwYXRoLXNjdXJyeSdcbmltcG9ydCB7IFBhdHRlcm4gfSBmcm9tICcuL3BhdHRlcm4uanMnXG5pbXBvcnQgeyBHbG9iV2Fsa2VyT3B0cyB9IGZyb20gJy4vd2Fsa2VyLmpzJ1xuXG5leHBvcnQgaW50ZXJmYWNlIElnbm9yZUxpa2Uge1xuICBpZ25vcmVkPzogKHA6IFBhdGgpID0+IGJvb2xlYW5cbiAgY2hpbGRyZW5JZ25vcmVkPzogKHA6IFBhdGgpID0+IGJvb2xlYW5cbiAgYWRkPzogKGlnbm9yZTogc3RyaW5nKSA9PiB2b2lkXG59XG5cbmNvbnN0IGRlZmF1bHRQbGF0Zm9ybTogTm9kZUpTLlBsYXRmb3JtID1cbiAgKFxuICAgIHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJlxuICAgIHByb2Nlc3MgJiZcbiAgICB0eXBlb2YgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3N0cmluZydcbiAgKSA/XG4gICAgcHJvY2Vzcy5wbGF0Zm9ybVxuICA6ICdsaW51eCdcblxuLyoqXG4gKiBDbGFzcyB1c2VkIHRvIHByb2Nlc3MgaWdub3JlZCBwYXR0ZXJuc1xuICovXG5leHBvcnQgY2xhc3MgSWdub3JlIGltcGxlbWVudHMgSWdub3JlTGlrZSB7XG4gIHJlbGF0aXZlOiBNaW5pbWF0Y2hbXVxuICByZWxhdGl2ZUNoaWxkcmVuOiBNaW5pbWF0Y2hbXVxuICBhYnNvbHV0ZTogTWluaW1hdGNoW11cbiAgYWJzb2x1dGVDaGlsZHJlbjogTWluaW1hdGNoW11cbiAgcGxhdGZvcm06IE5vZGVKUy5QbGF0Zm9ybVxuICBtbW9wdHM6IE1pbmltYXRjaE9wdGlvbnNcblxuICBjb25zdHJ1Y3RvcihcbiAgICBpZ25vcmVkOiBzdHJpbmdbXSxcbiAgICB7XG4gICAgICBub2JyYWNlLFxuICAgICAgbm9jYXNlLFxuICAgICAgbm9leHQsXG4gICAgICBub2dsb2JzdGFyLFxuICAgICAgcGxhdGZvcm0gPSBkZWZhdWx0UGxhdGZvcm0sXG4gICAgfTogR2xvYldhbGtlck9wdHMsXG4gICkge1xuICAgIHRoaXMucmVsYXRpdmUgPSBbXVxuICAgIHRoaXMuYWJzb2x1dGUgPSBbXVxuICAgIHRoaXMucmVsYXRpdmVDaGlsZHJlbiA9IFtdXG4gICAgdGhpcy5hYnNvbHV0ZUNoaWxkcmVuID0gW11cbiAgICB0aGlzLnBsYXRmb3JtID0gcGxhdGZvcm1cbiAgICB0aGlzLm1tb3B0cyA9IHtcbiAgICAgIGRvdDogdHJ1ZSxcbiAgICAgIG5vYnJhY2UsXG4gICAgICBub2Nhc2UsXG4gICAgICBub2V4dCxcbiAgICAgIG5vZ2xvYnN0YXIsXG4gICAgICBvcHRpbWl6YXRpb25MZXZlbDogMixcbiAgICAgIHBsYXRmb3JtLFxuICAgICAgbm9jb21tZW50OiB0cnVlLFxuICAgICAgbm9uZWdhdGU6IHRydWUsXG4gICAgfVxuICAgIGZvciAoY29uc3QgaWduIG9mIGlnbm9yZWQpIHRoaXMuYWRkKGlnbilcbiAgfVxuXG4gIGFkZChpZ246IHN0cmluZykge1xuICAgIC8vIHRoaXMgaXMgYSBsaXR0bGUgd2VpcmQsIGJ1dCBpdCBnaXZlcyB1cyBhIGNsZWFuIHNldCBvZiBvcHRpbWl6ZWRcbiAgICAvLyBtaW5pbWF0Y2ggbWF0Y2hlcnMsIHdpdGhvdXQgZ2V0dGluZyB0cmlwcGVkIHVwIGlmIG9uZSBvZiB0aGVtXG4gICAgLy8gZW5kcyBpbiAvKiogaW5zaWRlIGEgYnJhY2Ugc2VjdGlvbiwgYW5kIGl0J3Mgb25seSBpbmVmZmljaWVudCBhdFxuICAgIC8vIHRoZSBzdGFydCBvZiB0aGUgd2Fsaywgbm90IGFsb25nIGl0LlxuICAgIC8vIEl0J2QgYmUgbmljZSBpZiB0aGUgUGF0dGVybiBjbGFzcyBqdXN0IGhhZCBhIC50ZXN0KCkgbWV0aG9kLCBidXRcbiAgICAvLyBoYW5kbGluZyBnbG9ic3RhcnMgaXMgYSBiaXQgb2YgYSBwaXRhLCBhbmQgdGhhdCBjb2RlIGFscmVhZHkgbGl2ZXNcbiAgICAvLyBpbiBtaW5pbWF0Y2ggYW55d2F5LlxuICAgIC8vIEFub3RoZXIgd2F5IHdvdWxkIGJlIGlmIG1heWJlIE1pbmltYXRjaCBjb3VsZCB0YWtlIGl0cyBzZXQvZ2xvYlBhcnRzXG4gICAgLy8gYXMgYW4gb3B0aW9uLCBhbmQgdGhlbiB3ZSBjb3VsZCBhdCBsZWFzdCBqdXN0IHVzZSBQYXR0ZXJuIHRvIHRlc3RcbiAgICAvLyBmb3IgYWJzb2x1dGUtbmVzcy5cbiAgICAvLyBZZXQgYW5vdGhlciB3YXksIE1pbmltYXRjaCBjb3VsZCB0YWtlIGFuIGFycmF5IG9mIGdsb2Igc3RyaW5ncywgYW5kXG4gICAgLy8gYSBjd2Qgb3B0aW9uLCBhbmQgZG8gdGhlIHJpZ2h0IHRoaW5nLlxuICAgIGNvbnN0IG1tID0gbmV3IE1pbmltYXRjaChpZ24sIHRoaXMubW1vcHRzKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbW0uc2V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBwYXJzZWQgPSBtbS5zZXRbaV1cbiAgICAgIGNvbnN0IGdsb2JQYXJ0cyA9IG1tLmdsb2JQYXJ0c1tpXVxuICAgICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgICBpZiAoIXBhcnNlZCB8fCAhZ2xvYlBhcnRzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBwYXR0ZXJuIG9iamVjdCcpXG4gICAgICB9XG4gICAgICAvLyBzdHJpcCBvZmYgbGVhZGluZyAuLyBwb3J0aW9uc1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2lzYWFjcy9ub2RlLWdsb2IvaXNzdWVzLzU3MFxuICAgICAgd2hpbGUgKHBhcnNlZFswXSA9PT0gJy4nICYmIGdsb2JQYXJ0c1swXSA9PT0gJy4nKSB7XG4gICAgICAgIHBhcnNlZC5zaGlmdCgpXG4gICAgICAgIGdsb2JQYXJ0cy5zaGlmdCgpXG4gICAgICB9XG4gICAgICAvKiBjOCBpZ25vcmUgc3RvcCAqL1xuICAgICAgY29uc3QgcCA9IG5ldyBQYXR0ZXJuKHBhcnNlZCwgZ2xvYlBhcnRzLCAwLCB0aGlzLnBsYXRmb3JtKVxuICAgICAgY29uc3QgbSA9IG5ldyBNaW5pbWF0Y2gocC5nbG9iU3RyaW5nKCksIHRoaXMubW1vcHRzKVxuICAgICAgY29uc3QgY2hpbGRyZW4gPSBnbG9iUGFydHNbZ2xvYlBhcnRzLmxlbmd0aCAtIDFdID09PSAnKionXG4gICAgICBjb25zdCBhYnNvbHV0ZSA9IHAuaXNBYnNvbHV0ZSgpXG4gICAgICBpZiAoYWJzb2x1dGUpIHRoaXMuYWJzb2x1dGUucHVzaChtKVxuICAgICAgZWxzZSB0aGlzLnJlbGF0aXZlLnB1c2gobSlcbiAgICAgIGlmIChjaGlsZHJlbikge1xuICAgICAgICBpZiAoYWJzb2x1dGUpIHRoaXMuYWJzb2x1dGVDaGlsZHJlbi5wdXNoKG0pXG4gICAgICAgIGVsc2UgdGhpcy5yZWxhdGl2ZUNoaWxkcmVuLnB1c2gobSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZ25vcmVkKHA6IFBhdGgpOiBib29sZWFuIHtcbiAgICBjb25zdCBmdWxscGF0aCA9IHAuZnVsbHBhdGgoKVxuICAgIGNvbnN0IGZ1bGxwYXRocyA9IGAke2Z1bGxwYXRofS9gXG4gICAgY29uc3QgcmVsYXRpdmUgPSBwLnJlbGF0aXZlKCkgfHwgJy4nXG4gICAgY29uc3QgcmVsYXRpdmVzID0gYCR7cmVsYXRpdmV9L2BcbiAgICBmb3IgKGNvbnN0IG0gb2YgdGhpcy5yZWxhdGl2ZSkge1xuICAgICAgaWYgKG0ubWF0Y2gocmVsYXRpdmUpIHx8IG0ubWF0Y2gocmVsYXRpdmVzKSkgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgZm9yIChjb25zdCBtIG9mIHRoaXMuYWJzb2x1dGUpIHtcbiAgICAgIGlmIChtLm1hdGNoKGZ1bGxwYXRoKSB8fCBtLm1hdGNoKGZ1bGxwYXRocykpIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgY2hpbGRyZW5JZ25vcmVkKHA6IFBhdGgpOiBib29sZWFuIHtcbiAgICBjb25zdCBmdWxscGF0aCA9IHAuZnVsbHBhdGgoKSArICcvJ1xuICAgIGNvbnN0IHJlbGF0aXZlID0gKHAucmVsYXRpdmUoKSB8fCAnLicpICsgJy8nXG4gICAgZm9yIChjb25zdCBtIG9mIHRoaXMucmVsYXRpdmVDaGlsZHJlbikge1xuICAgICAgaWYgKG0ubWF0Y2gocmVsYXRpdmUpKSByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IG0gb2YgdGhpcy5hYnNvbHV0ZUNoaWxkcmVuKSB7XG4gICAgICBpZiAobS5tYXRjaChmdWxscGF0aCkpIHJldHVybiB0cnVlXG4gICAgfVxuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG4iLCAiLy8gc3luY2hyb25vdXMgdXRpbGl0eSBmb3IgZmlsdGVyaW5nIGVudHJpZXMgYW5kIGNhbGN1bGF0aW5nIHN1YndhbGtzXG5cbmltcG9ydCB7IEdMT0JTVEFSLCBNTVJlZ0V4cCB9IGZyb20gJ21pbmltYXRjaCdcbmltcG9ydCB7IFBhdGggfSBmcm9tICdwYXRoLXNjdXJyeSdcbmltcG9ydCB7IE1NUGF0dGVybiwgUGF0dGVybiB9IGZyb20gJy4vcGF0dGVybi5qcydcbmltcG9ydCB7IEdsb2JXYWxrZXJPcHRzIH0gZnJvbSAnLi93YWxrZXIuanMnXG5cbi8qKlxuICogQSBjYWNoZSBvZiB3aGljaCBwYXR0ZXJucyBoYXZlIGJlZW4gcHJvY2Vzc2VkIGZvciBhIGdpdmVuIFBhdGhcbiAqL1xuZXhwb3J0IGNsYXNzIEhhc1dhbGtlZENhY2hlIHtcbiAgc3RvcmU6IE1hcDxzdHJpbmcsIFNldDxzdHJpbmc+PlxuICBjb25zdHJ1Y3RvcihzdG9yZTogTWFwPHN0cmluZywgU2V0PHN0cmluZz4+ID0gbmV3IE1hcCgpKSB7XG4gICAgdGhpcy5zdG9yZSA9IHN0b3JlXG4gIH1cbiAgY29weSgpIHtcbiAgICByZXR1cm4gbmV3IEhhc1dhbGtlZENhY2hlKG5ldyBNYXAodGhpcy5zdG9yZSkpXG4gIH1cbiAgaGFzV2Fsa2VkKHRhcmdldDogUGF0aCwgcGF0dGVybjogUGF0dGVybikge1xuICAgIHJldHVybiB0aGlzLnN0b3JlLmdldCh0YXJnZXQuZnVsbHBhdGgoKSk/LmhhcyhwYXR0ZXJuLmdsb2JTdHJpbmcoKSlcbiAgfVxuICBzdG9yZVdhbGtlZCh0YXJnZXQ6IFBhdGgsIHBhdHRlcm46IFBhdHRlcm4pIHtcbiAgICBjb25zdCBmdWxscGF0aCA9IHRhcmdldC5mdWxscGF0aCgpXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5zdG9yZS5nZXQoZnVsbHBhdGgpXG4gICAgaWYgKGNhY2hlZCkgY2FjaGVkLmFkZChwYXR0ZXJuLmdsb2JTdHJpbmcoKSlcbiAgICBlbHNlIHRoaXMuc3RvcmUuc2V0KGZ1bGxwYXRoLCBuZXcgU2V0KFtwYXR0ZXJuLmdsb2JTdHJpbmcoKV0pKVxuICB9XG59XG5cbi8qKlxuICogQSByZWNvcmQgb2Ygd2hpY2ggcGF0aHMgaGF2ZSBiZWVuIG1hdGNoZWQgaW4gYSBnaXZlbiB3YWxrIHN0ZXAsXG4gKiBhbmQgd2hldGhlciB0aGV5IG9ubHkgYXJlIGNvbnNpZGVyZWQgYSBtYXRjaCBpZiB0aGV5IGFyZSBhIGRpcmVjdG9yeSxcbiAqIGFuZCB3aGV0aGVyIHRoZWlyIGFic29sdXRlIG9yIHJlbGF0aXZlIHBhdGggc2hvdWxkIGJlIHJldHVybmVkLlxuICovXG5leHBvcnQgY2xhc3MgTWF0Y2hSZWNvcmQge1xuICBzdG9yZTogTWFwPFBhdGgsIG51bWJlcj4gPSBuZXcgTWFwKClcbiAgYWRkKHRhcmdldDogUGF0aCwgYWJzb2x1dGU6IGJvb2xlYW4sIGlmRGlyOiBib29sZWFuKSB7XG4gICAgY29uc3QgbiA9IChhYnNvbHV0ZSA/IDIgOiAwKSB8IChpZkRpciA/IDEgOiAwKVxuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLnN0b3JlLmdldCh0YXJnZXQpXG4gICAgdGhpcy5zdG9yZS5zZXQodGFyZ2V0LCBjdXJyZW50ID09PSB1bmRlZmluZWQgPyBuIDogbiAmIGN1cnJlbnQpXG4gIH1cbiAgLy8gbWF0Y2gsIGFic29sdXRlLCBpZmRpclxuICBlbnRyaWVzKCk6IFtQYXRoLCBib29sZWFuLCBib29sZWFuXVtdIHtcbiAgICByZXR1cm4gWy4uLnRoaXMuc3RvcmUuZW50cmllcygpXS5tYXAoKFtwYXRoLCBuXSkgPT4gW1xuICAgICAgcGF0aCxcbiAgICAgICEhKG4gJiAyKSxcbiAgICAgICEhKG4gJiAxKSxcbiAgICBdKVxuICB9XG59XG5cbi8qKlxuICogQSBjb2xsZWN0aW9uIG9mIHBhdHRlcm5zIHRoYXQgbXVzdCBiZSBwcm9jZXNzZWQgaW4gYSBzdWJzZXF1ZW50IHN0ZXBcbiAqIGZvciBhIGdpdmVuIHBhdGguXG4gKi9cbmV4cG9ydCBjbGFzcyBTdWJXYWxrcyB7XG4gIHN0b3JlOiBNYXA8UGF0aCwgUGF0dGVybltdPiA9IG5ldyBNYXAoKVxuICBhZGQodGFyZ2V0OiBQYXRoLCBwYXR0ZXJuOiBQYXR0ZXJuKSB7XG4gICAgaWYgKCF0YXJnZXQuY2FuUmVhZGRpcigpKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgY29uc3Qgc3VicyA9IHRoaXMuc3RvcmUuZ2V0KHRhcmdldClcbiAgICBpZiAoc3Vicykge1xuICAgICAgaWYgKCFzdWJzLmZpbmQocCA9PiBwLmdsb2JTdHJpbmcoKSA9PT0gcGF0dGVybi5nbG9iU3RyaW5nKCkpKSB7XG4gICAgICAgIHN1YnMucHVzaChwYXR0ZXJuKVxuICAgICAgfVxuICAgIH0gZWxzZSB0aGlzLnN0b3JlLnNldCh0YXJnZXQsIFtwYXR0ZXJuXSlcbiAgfVxuICBnZXQodGFyZ2V0OiBQYXRoKTogUGF0dGVybltdIHtcbiAgICBjb25zdCBzdWJzID0gdGhpcy5zdG9yZS5nZXQodGFyZ2V0KVxuICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgIGlmICghc3Vicykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdhdHRlbXB0aW5nIHRvIHdhbGsgdW5rbm93biBwYXRoJylcbiAgICB9XG4gICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICByZXR1cm4gc3Vic1xuICB9XG4gIGVudHJpZXMoKTogW1BhdGgsIFBhdHRlcm5bXV1bXSB7XG4gICAgcmV0dXJuIHRoaXMua2V5cygpLm1hcChrID0+IFtrLCB0aGlzLnN0b3JlLmdldChrKSBhcyBQYXR0ZXJuW11dKVxuICB9XG4gIGtleXMoKTogUGF0aFtdIHtcbiAgICByZXR1cm4gWy4uLnRoaXMuc3RvcmUua2V5cygpXS5maWx0ZXIodCA9PiB0LmNhblJlYWRkaXIoKSlcbiAgfVxufVxuXG4vKipcbiAqIFRoZSBjbGFzcyB0aGF0IHByb2Nlc3NlcyBwYXR0ZXJucyBmb3IgYSBnaXZlbiBwYXRoLlxuICpcbiAqIEhhbmRsZXMgY2hpbGQgZW50cnkgZmlsdGVyaW5nLCBhbmQgZGV0ZXJtaW5pbmcgd2hldGhlciBhIHBhdGgnc1xuICogZGlyZWN0b3J5IGNvbnRlbnRzIG11c3QgYmUgcmVhZC5cbiAqL1xuZXhwb3J0IGNsYXNzIFByb2Nlc3NvciB7XG4gIGhhc1dhbGtlZENhY2hlOiBIYXNXYWxrZWRDYWNoZVxuICBtYXRjaGVzID0gbmV3IE1hdGNoUmVjb3JkKClcbiAgc3Vid2Fsa3MgPSBuZXcgU3ViV2Fsa3MoKVxuICBwYXR0ZXJucz86IFBhdHRlcm5bXVxuICBmb2xsb3c6IGJvb2xlYW5cbiAgZG90OiBib29sZWFuXG4gIG9wdHM6IEdsb2JXYWxrZXJPcHRzXG5cbiAgY29uc3RydWN0b3Iob3B0czogR2xvYldhbGtlck9wdHMsIGhhc1dhbGtlZENhY2hlPzogSGFzV2Fsa2VkQ2FjaGUpIHtcbiAgICB0aGlzLm9wdHMgPSBvcHRzXG4gICAgdGhpcy5mb2xsb3cgPSAhIW9wdHMuZm9sbG93XG4gICAgdGhpcy5kb3QgPSAhIW9wdHMuZG90XG4gICAgdGhpcy5oYXNXYWxrZWRDYWNoZSA9XG4gICAgICBoYXNXYWxrZWRDYWNoZSA/IGhhc1dhbGtlZENhY2hlLmNvcHkoKSA6IG5ldyBIYXNXYWxrZWRDYWNoZSgpXG4gIH1cblxuICBwcm9jZXNzUGF0dGVybnModGFyZ2V0OiBQYXRoLCBwYXR0ZXJuczogUGF0dGVybltdKSB7XG4gICAgdGhpcy5wYXR0ZXJucyA9IHBhdHRlcm5zXG4gICAgY29uc3QgcHJvY2Vzc2luZ1NldDogW1BhdGgsIFBhdHRlcm5dW10gPSBwYXR0ZXJucy5tYXAocCA9PiBbdGFyZ2V0LCBwXSlcblxuICAgIC8vIG1hcCBvZiBwYXRocyB0byB0aGUgbWFnaWMtc3RhcnRpbmcgc3Vid2Fsa3MgdGhleSBuZWVkIHRvIHdhbGtcbiAgICAvLyBmaXJzdCBpdGVtIGluIHBhdHRlcm5zIGlzIHRoZSBmaWx0ZXJcblxuICAgIGZvciAobGV0IFt0LCBwYXR0ZXJuXSBvZiBwcm9jZXNzaW5nU2V0KSB7XG4gICAgICB0aGlzLmhhc1dhbGtlZENhY2hlLnN0b3JlV2Fsa2VkKHQsIHBhdHRlcm4pXG5cbiAgICAgIGNvbnN0IHJvb3QgPSBwYXR0ZXJuLnJvb3QoKVxuICAgICAgY29uc3QgYWJzb2x1dGUgPSBwYXR0ZXJuLmlzQWJzb2x1dGUoKSAmJiB0aGlzLm9wdHMuYWJzb2x1dGUgIT09IGZhbHNlXG5cbiAgICAgIC8vIHN0YXJ0IGFic29sdXRlIHBhdHRlcm5zIGF0IHJvb3RcbiAgICAgIGlmIChyb290KSB7XG4gICAgICAgIHQgPSB0LnJlc29sdmUoXG4gICAgICAgICAgcm9vdCA9PT0gJy8nICYmIHRoaXMub3B0cy5yb290ICE9PSB1bmRlZmluZWQgP1xuICAgICAgICAgICAgdGhpcy5vcHRzLnJvb3RcbiAgICAgICAgICA6IHJvb3QsXG4gICAgICAgIClcbiAgICAgICAgY29uc3QgcmVzdCA9IHBhdHRlcm4ucmVzdCgpXG4gICAgICAgIGlmICghcmVzdCkge1xuICAgICAgICAgIHRoaXMubWF0Y2hlcy5hZGQodCwgdHJ1ZSwgZmFsc2UpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwYXR0ZXJuID0gcmVzdFxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0LmlzRU5PRU5UKCkpIGNvbnRpbnVlXG5cbiAgICAgIGxldCBwOiBNTVBhdHRlcm5cbiAgICAgIGxldCByZXN0OiBQYXR0ZXJuIHwgbnVsbFxuICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZVxuICAgICAgd2hpbGUgKFxuICAgICAgICB0eXBlb2YgKHAgPSBwYXR0ZXJuLnBhdHRlcm4oKSkgPT09ICdzdHJpbmcnICYmXG4gICAgICAgIChyZXN0ID0gcGF0dGVybi5yZXN0KCkpXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgYyA9IHQucmVzb2x2ZShwKVxuICAgICAgICB0ID0gY1xuICAgICAgICBwYXR0ZXJuID0gcmVzdFxuICAgICAgICBjaGFuZ2VkID0gdHJ1ZVxuICAgICAgfVxuICAgICAgcCA9IHBhdHRlcm4ucGF0dGVybigpXG4gICAgICByZXN0ID0gcGF0dGVybi5yZXN0KClcbiAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc1dhbGtlZENhY2hlLmhhc1dhbGtlZCh0LCBwYXR0ZXJuKSkgY29udGludWVcbiAgICAgICAgdGhpcy5oYXNXYWxrZWRDYWNoZS5zdG9yZVdhbGtlZCh0LCBwYXR0ZXJuKVxuICAgICAgfVxuXG4gICAgICAvLyBub3cgd2UgaGF2ZSBlaXRoZXIgYSBmaW5hbCBzdHJpbmcgZm9yIGEga25vd24gZW50cnksXG4gICAgICAvLyBtb3JlIHN0cmluZ3MgZm9yIGFuIHVua25vd24gZW50cnksXG4gICAgICAvLyBvciBhIHBhdHRlcm4gc3RhcnRpbmcgd2l0aCBtYWdpYywgbW91bnRlZCBvbiB0LlxuICAgICAgaWYgKHR5cGVvZiBwID09PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBtdXN0IG5vdCBiZSBmaW5hbCBlbnRyeSwgb3RoZXJ3aXNlIHdlIHdvdWxkIGhhdmVcbiAgICAgICAgLy8gY29uY2F0ZW5hdGVkIGl0IGVhcmxpZXIuXG4gICAgICAgIGNvbnN0IGlmRGlyID0gcCA9PT0gJy4uJyB8fCBwID09PSAnJyB8fCBwID09PSAnLidcbiAgICAgICAgdGhpcy5tYXRjaGVzLmFkZCh0LnJlc29sdmUocCksIGFic29sdXRlLCBpZkRpcilcbiAgICAgICAgY29udGludWVcbiAgICAgIH0gZWxzZSBpZiAocCA9PT0gR0xPQlNUQVIpIHtcbiAgICAgICAgLy8gaWYgbm8gcmVzdCwgbWF0Y2ggYW5kIHN1YndhbGsgcGF0dGVyblxuICAgICAgICAvLyBpZiByZXN0LCBwcm9jZXNzIHJlc3QgYW5kIHN1YndhbGsgcGF0dGVyblxuICAgICAgICAvLyBpZiBpdCdzIGEgc3ltbGluaywgYnV0IHdlIGRpZG4ndCBnZXQgaGVyZSBieSB3YXkgb2YgYVxuICAgICAgICAvLyBnbG9ic3RhciBtYXRjaCAobWVhbmluZyBpdCdzIHRoZSBmaXJzdCB0aW1lIFRISVMgZ2xvYnN0YXJcbiAgICAgICAgLy8gaGFzIHRyYXZlcnNlZCBhIHN5bWxpbmspLCB0aGVuIHdlIGZvbGxvdyBpdC4gT3RoZXJ3aXNlLCBzdG9wLlxuICAgICAgICBpZiAoXG4gICAgICAgICAgIXQuaXNTeW1ib2xpY0xpbmsoKSB8fFxuICAgICAgICAgIHRoaXMuZm9sbG93IHx8XG4gICAgICAgICAgcGF0dGVybi5jaGVja0ZvbGxvd0dsb2JzdGFyKClcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhpcy5zdWJ3YWxrcy5hZGQodCwgcGF0dGVybilcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBycCA9IHJlc3Q/LnBhdHRlcm4oKVxuICAgICAgICBjb25zdCBycmVzdCA9IHJlc3Q/LnJlc3QoKVxuICAgICAgICBpZiAoIXJlc3QgfHwgKChycCA9PT0gJycgfHwgcnAgPT09ICcuJykgJiYgIXJyZXN0KSkge1xuICAgICAgICAgIC8vIG9ubHkgSEFTIHRvIGJlIGEgZGlyIGlmIGl0IGVuZHMgaW4gKiovIG9yICoqLy5cbiAgICAgICAgICAvLyBidXQgZW5kaW5nIGluICoqIHdpbGwgbWF0Y2ggZmlsZXMgYXMgd2VsbC5cbiAgICAgICAgICB0aGlzLm1hdGNoZXMuYWRkKHQsIGFic29sdXRlLCBycCA9PT0gJycgfHwgcnAgPT09ICcuJylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAocnAgPT09ICcuLicpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgd291bGQgbWVhbiB5b3UncmUgbWF0Y2hpbmcgKiovLi4gYXQgdGhlIGZzIHJvb3QsXG4gICAgICAgICAgICAvLyBhbmQgbm8gdGhhbmtzLCBJJ20gbm90IGdvbm5hIHRlc3QgdGhhdCBzcGVjaWZpYyBjYXNlLlxuICAgICAgICAgICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgICAgICAgICBjb25zdCB0cCA9IHQucGFyZW50IHx8IHRcbiAgICAgICAgICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgICAgICAgICBpZiAoIXJyZXN0KSB0aGlzLm1hdGNoZXMuYWRkKHRwLCBhYnNvbHV0ZSwgdHJ1ZSlcbiAgICAgICAgICAgIGVsc2UgaWYgKCF0aGlzLmhhc1dhbGtlZENhY2hlLmhhc1dhbGtlZCh0cCwgcnJlc3QpKSB7XG4gICAgICAgICAgICAgIHRoaXMuc3Vid2Fsa3MuYWRkKHRwLCBycmVzdClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICB0aGlzLnN1YndhbGtzLmFkZCh0LCBwYXR0ZXJuKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBzdWJ3YWxrVGFyZ2V0cygpOiBQYXRoW10ge1xuICAgIHJldHVybiB0aGlzLnN1YndhbGtzLmtleXMoKVxuICB9XG5cbiAgY2hpbGQoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9jZXNzb3IodGhpcy5vcHRzLCB0aGlzLmhhc1dhbGtlZENhY2hlKVxuICB9XG5cbiAgLy8gcmV0dXJuIGEgbmV3IFByb2Nlc3NvciBjb250YWluaW5nIHRoZSBzdWJ3YWxrcyBmb3IgZWFjaFxuICAvLyBjaGlsZCBlbnRyeSwgYW5kIGEgc2V0IG9mIG1hdGNoZXMsIGFuZFxuICAvLyBhIGhhc1dhbGtlZENhY2hlIHRoYXQncyBhIGNvcHkgb2YgdGhpcyBvbmVcbiAgLy8gdGhlbiB3ZSdyZSBnb2luZyB0byBjYWxsXG4gIGZpbHRlckVudHJpZXMocGFyZW50OiBQYXRoLCBlbnRyaWVzOiBQYXRoW10pOiBQcm9jZXNzb3Ige1xuICAgIGNvbnN0IHBhdHRlcm5zID0gdGhpcy5zdWJ3YWxrcy5nZXQocGFyZW50KVxuICAgIC8vIHB1dCBtYXRjaGVzIGFuZCBlbnRyeSB3YWxrcyBpbnRvIHRoZSByZXN1bHRzIHByb2Nlc3NvclxuICAgIGNvbnN0IHJlc3VsdHMgPSB0aGlzLmNoaWxkKClcbiAgICBmb3IgKGNvbnN0IGUgb2YgZW50cmllcykge1xuICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHBhdHRlcm5zKSB7XG4gICAgICAgIGNvbnN0IGFic29sdXRlID0gcGF0dGVybi5pc0Fic29sdXRlKClcbiAgICAgICAgY29uc3QgcCA9IHBhdHRlcm4ucGF0dGVybigpXG4gICAgICAgIGNvbnN0IHJlc3QgPSBwYXR0ZXJuLnJlc3QoKVxuICAgICAgICBpZiAocCA9PT0gR0xPQlNUQVIpIHtcbiAgICAgICAgICByZXN1bHRzLnRlc3RHbG9ic3RhcihlLCBwYXR0ZXJuLCByZXN0LCBhYnNvbHV0ZSlcbiAgICAgICAgfSBlbHNlIGlmIChwIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgcmVzdWx0cy50ZXN0UmVnRXhwKGUsIHAsIHJlc3QsIGFic29sdXRlKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdHMudGVzdFN0cmluZyhlLCBwLCByZXN0LCBhYnNvbHV0ZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0c1xuICB9XG5cbiAgdGVzdEdsb2JzdGFyKFxuICAgIGU6IFBhdGgsXG4gICAgcGF0dGVybjogUGF0dGVybixcbiAgICByZXN0OiBQYXR0ZXJuIHwgbnVsbCxcbiAgICBhYnNvbHV0ZTogYm9vbGVhbixcbiAgKSB7XG4gICAgaWYgKHRoaXMuZG90IHx8ICFlLm5hbWUuc3RhcnRzV2l0aCgnLicpKSB7XG4gICAgICBpZiAoIXBhdHRlcm4uaGFzTW9yZSgpKSB7XG4gICAgICAgIHRoaXMubWF0Y2hlcy5hZGQoZSwgYWJzb2x1dGUsIGZhbHNlKVxuICAgICAgfVxuICAgICAgaWYgKGUuY2FuUmVhZGRpcigpKSB7XG4gICAgICAgIC8vIGlmIHdlJ3JlIGluIGZvbGxvdyBtb2RlIG9yIGl0J3Mgbm90IGEgc3ltbGluaywganVzdCBrZWVwXG4gICAgICAgIC8vIHRlc3RpbmcgdGhlIHNhbWUgcGF0dGVybi4gSWYgdGhlcmUncyBtb3JlIGFmdGVyIHRoZSBnbG9ic3RhcixcbiAgICAgICAgLy8gdGhlbiB0aGlzIHN5bWxpbmsgY29uc3VtZXMgdGhlIGdsb2JzdGFyLiBJZiBub3QsIHRoZW4gd2UgY2FuXG4gICAgICAgIC8vIGZvbGxvdyBhdCBtb3N0IE9ORSBzeW1saW5rIGFsb25nIHRoZSB3YXksIHNvIHdlIG1hcmsgaXQsIHdoaWNoXG4gICAgICAgIC8vIGFsc28gY2hlY2tzIHRvIGVuc3VyZSB0aGF0IGl0IHdhc24ndCBhbHJlYWR5IG1hcmtlZC5cbiAgICAgICAgaWYgKHRoaXMuZm9sbG93IHx8ICFlLmlzU3ltYm9saWNMaW5rKCkpIHtcbiAgICAgICAgICB0aGlzLnN1YndhbGtzLmFkZChlLCBwYXR0ZXJuKVxuICAgICAgICB9IGVsc2UgaWYgKGUuaXNTeW1ib2xpY0xpbmsoKSkge1xuICAgICAgICAgIGlmIChyZXN0ICYmIHBhdHRlcm4uY2hlY2tGb2xsb3dHbG9ic3RhcigpKSB7XG4gICAgICAgICAgICB0aGlzLnN1YndhbGtzLmFkZChlLCByZXN0KVxuICAgICAgICAgIH0gZWxzZSBpZiAocGF0dGVybi5tYXJrRm9sbG93R2xvYnN0YXIoKSkge1xuICAgICAgICAgICAgdGhpcy5zdWJ3YWxrcy5hZGQoZSwgcGF0dGVybilcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgdGhlIE5FWFQgdGhpbmcgbWF0Y2hlcyB0aGlzIGVudHJ5LCB0aGVuIGFsc28gYWRkXG4gICAgLy8gdGhlIHJlc3QuXG4gICAgaWYgKHJlc3QpIHtcbiAgICAgIGNvbnN0IHJwID0gcmVzdC5wYXR0ZXJuKClcbiAgICAgIGlmIChcbiAgICAgICAgdHlwZW9mIHJwID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAvLyBkb3RzIGFuZCBlbXB0eSB3ZXJlIGhhbmRsZWQgYWxyZWFkeVxuICAgICAgICBycCAhPT0gJy4uJyAmJlxuICAgICAgICBycCAhPT0gJycgJiZcbiAgICAgICAgcnAgIT09ICcuJ1xuICAgICAgKSB7XG4gICAgICAgIHRoaXMudGVzdFN0cmluZyhlLCBycCwgcmVzdC5yZXN0KCksIGFic29sdXRlKVxuICAgICAgfSBlbHNlIGlmIChycCA9PT0gJy4uJykge1xuICAgICAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICAgICAgY29uc3QgZXAgPSBlLnBhcmVudCB8fCBlXG4gICAgICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgICAgIHRoaXMuc3Vid2Fsa3MuYWRkKGVwLCByZXN0KVxuICAgICAgfSBlbHNlIGlmIChycCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICB0aGlzLnRlc3RSZWdFeHAoZSwgcnAsIHJlc3QucmVzdCgpLCBhYnNvbHV0ZSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0ZXN0UmVnRXhwKFxuICAgIGU6IFBhdGgsXG4gICAgcDogTU1SZWdFeHAsXG4gICAgcmVzdDogUGF0dGVybiB8IG51bGwsXG4gICAgYWJzb2x1dGU6IGJvb2xlYW4sXG4gICkge1xuICAgIGlmICghcC50ZXN0KGUubmFtZSkpIHJldHVyblxuICAgIGlmICghcmVzdCkge1xuICAgICAgdGhpcy5tYXRjaGVzLmFkZChlLCBhYnNvbHV0ZSwgZmFsc2UpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3Vid2Fsa3MuYWRkKGUsIHJlc3QpXG4gICAgfVxuICB9XG5cbiAgdGVzdFN0cmluZyhlOiBQYXRoLCBwOiBzdHJpbmcsIHJlc3Q6IFBhdHRlcm4gfCBudWxsLCBhYnNvbHV0ZTogYm9vbGVhbikge1xuICAgIC8vIHNob3VsZCBuZXZlciBoYXBwZW4/XG4gICAgaWYgKCFlLmlzTmFtZWQocCkpIHJldHVyblxuICAgIGlmICghcmVzdCkge1xuICAgICAgdGhpcy5tYXRjaGVzLmFkZChlLCBhYnNvbHV0ZSwgZmFsc2UpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3Vid2Fsa3MuYWRkKGUsIHJlc3QpXG4gICAgfVxuICB9XG59XG4iLCAiLyoqXG4gKiBTaW5nbGUtdXNlIHV0aWxpdHkgY2xhc3NlcyB0byBwcm92aWRlIGZ1bmN0aW9uYWxpdHkgdG8gdGhlIHtAbGluayBHbG9ifVxuICogbWV0aG9kcy5cbiAqXG4gKiBAbW9kdWxlXG4gKi9cbmltcG9ydCB7IE1pbmlwYXNzIH0gZnJvbSAnbWluaXBhc3MnXG5pbXBvcnQgeyBQYXRoIH0gZnJvbSAncGF0aC1zY3VycnknXG5pbXBvcnQgeyBJZ25vcmUsIElnbm9yZUxpa2UgfSBmcm9tICcuL2lnbm9yZS5qcydcblxuLy8gWFhYIGNhbiB3ZSBzb21laG93IG1ha2UgaXQgc28gdGhhdCBpdCBORVZFUiBwcm9jZXNzZXMgYSBnaXZlbiBwYXRoIG1vcmUgdGhhblxuLy8gb25jZSwgZW5vdWdoIHRoYXQgdGhlIG1hdGNoIHNldCB0cmFja2luZyBpcyBubyBsb25nZXIgbmVlZGVkPyAgdGhhdCdkIHNwZWVkXG4vLyB0aGluZ3MgdXAgYSBsb3QuICBPciBtYXliZSBicmluZyBiYWNrIG5vdW5pcXVlLCBhbmQgc2tpcCBpdCBpbiB0aGF0IGNhc2U/XG5cbi8vIGEgc2luZ2xlIG1pbmltYXRjaCBzZXQgZW50cnkgd2l0aCAxIG9yIG1vcmUgcGFydHNcbmltcG9ydCB7IFBhdHRlcm4gfSBmcm9tICcuL3BhdHRlcm4uanMnXG5pbXBvcnQgeyBQcm9jZXNzb3IgfSBmcm9tICcuL3Byb2Nlc3Nvci5qcydcblxuZXhwb3J0IGludGVyZmFjZSBHbG9iV2Fsa2VyT3B0cyB7XG4gIGFic29sdXRlPzogYm9vbGVhblxuICBhbGxvd1dpbmRvd3NFc2NhcGU/OiBib29sZWFuXG4gIGN3ZD86IHN0cmluZyB8IFVSTFxuICBkb3Q/OiBib29sZWFuXG4gIGRvdFJlbGF0aXZlPzogYm9vbGVhblxuICBmb2xsb3c/OiBib29sZWFuXG4gIGlnbm9yZT86IHN0cmluZyB8IHN0cmluZ1tdIHwgSWdub3JlTGlrZVxuICBtYXJrPzogYm9vbGVhblxuICBtYXRjaEJhc2U/OiBib29sZWFuXG4gIC8vIE5vdGU6IG1heERlcHRoIGhlcmUgbWVhbnMgXCJtYXhpbXVtIGFjdHVhbCBQYXRoLmRlcHRoKClcIixcbiAgLy8gbm90IFwibWF4aW11bSBkZXB0aCBiZXlvbmQgY3dkXCJcbiAgbWF4RGVwdGg/OiBudW1iZXJcbiAgbm9icmFjZT86IGJvb2xlYW5cbiAgbm9jYXNlPzogYm9vbGVhblxuICBub2Rpcj86IGJvb2xlYW5cbiAgbm9leHQ/OiBib29sZWFuXG4gIG5vZ2xvYnN0YXI/OiBib29sZWFuXG4gIHBsYXRmb3JtPzogTm9kZUpTLlBsYXRmb3JtXG4gIHBvc2l4PzogYm9vbGVhblxuICByZWFscGF0aD86IGJvb2xlYW5cbiAgcm9vdD86IHN0cmluZ1xuICBzdGF0PzogYm9vbGVhblxuICBzaWduYWw/OiBBYm9ydFNpZ25hbFxuICB3aW5kb3dzUGF0aHNOb0VzY2FwZT86IGJvb2xlYW5cbiAgd2l0aEZpbGVUeXBlcz86IGJvb2xlYW5cbiAgaW5jbHVkZUNoaWxkTWF0Y2hlcz86IGJvb2xlYW5cbn1cblxuZXhwb3J0IHR5cGUgR1dPRmlsZVR5cGVzVHJ1ZSA9IEdsb2JXYWxrZXJPcHRzICYge1xuICB3aXRoRmlsZVR5cGVzOiB0cnVlXG59XG5leHBvcnQgdHlwZSBHV09GaWxlVHlwZXNGYWxzZSA9IEdsb2JXYWxrZXJPcHRzICYge1xuICB3aXRoRmlsZVR5cGVzOiBmYWxzZVxufVxuZXhwb3J0IHR5cGUgR1dPRmlsZVR5cGVzVW5zZXQgPSBHbG9iV2Fsa2VyT3B0cyAmIHtcbiAgd2l0aEZpbGVUeXBlcz86IHVuZGVmaW5lZFxufVxuXG5leHBvcnQgdHlwZSBSZXN1bHQ8TyBleHRlbmRzIEdsb2JXYWxrZXJPcHRzPiA9XG4gIE8gZXh0ZW5kcyBHV09GaWxlVHlwZXNUcnVlID8gUGF0aFxuICA6IE8gZXh0ZW5kcyBHV09GaWxlVHlwZXNGYWxzZSA/IHN0cmluZ1xuICA6IE8gZXh0ZW5kcyBHV09GaWxlVHlwZXNVbnNldCA/IHN0cmluZ1xuICA6IFBhdGggfCBzdHJpbmdcblxuZXhwb3J0IHR5cGUgTWF0Y2hlczxPIGV4dGVuZHMgR2xvYldhbGtlck9wdHM+ID1cbiAgTyBleHRlbmRzIEdXT0ZpbGVUeXBlc1RydWUgPyBTZXQ8UGF0aD5cbiAgOiBPIGV4dGVuZHMgR1dPRmlsZVR5cGVzRmFsc2UgPyBTZXQ8c3RyaW5nPlxuICA6IE8gZXh0ZW5kcyBHV09GaWxlVHlwZXNVbnNldCA/IFNldDxzdHJpbmc+XG4gIDogU2V0PFBhdGggfCBzdHJpbmc+XG5cbmV4cG9ydCB0eXBlIE1hdGNoU3RyZWFtPE8gZXh0ZW5kcyBHbG9iV2Fsa2VyT3B0cz4gPSBNaW5pcGFzczxcbiAgUmVzdWx0PE8+LFxuICBSZXN1bHQ8Tz5cbj5cblxuY29uc3QgbWFrZUlnbm9yZSA9IChcbiAgaWdub3JlOiBzdHJpbmcgfCBzdHJpbmdbXSB8IElnbm9yZUxpa2UsXG4gIG9wdHM6IEdsb2JXYWxrZXJPcHRzLFxuKTogSWdub3JlTGlrZSA9PlxuICB0eXBlb2YgaWdub3JlID09PSAnc3RyaW5nJyA/IG5ldyBJZ25vcmUoW2lnbm9yZV0sIG9wdHMpXG4gIDogQXJyYXkuaXNBcnJheShpZ25vcmUpID8gbmV3IElnbm9yZShpZ25vcmUsIG9wdHMpXG4gIDogaWdub3JlXG5cbi8qKlxuICogYmFzaWMgd2Fsa2luZyB1dGlsaXRpZXMgdGhhdCBhbGwgdGhlIGdsb2Igd2Fsa2VyIHR5cGVzIHVzZVxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgR2xvYlV0aWw8TyBleHRlbmRzIEdsb2JXYWxrZXJPcHRzID0gR2xvYldhbGtlck9wdHM+IHtcbiAgcGF0aDogUGF0aFxuICBwYXR0ZXJuczogUGF0dGVybltdXG4gIG9wdHM6IE9cbiAgc2VlbjogU2V0PFBhdGg+ID0gbmV3IFNldDxQYXRoPigpXG4gIHBhdXNlZDogYm9vbGVhbiA9IGZhbHNlXG4gIGFib3J0ZWQ6IGJvb2xlYW4gPSBmYWxzZVxuICAjb25SZXN1bWU6ICgoKSA9PiBhbnkpW10gPSBbXVxuICAjaWdub3JlPzogSWdub3JlTGlrZVxuICAjc2VwOiAnXFxcXCcgfCAnLydcbiAgc2lnbmFsPzogQWJvcnRTaWduYWxcbiAgbWF4RGVwdGg6IG51bWJlclxuICBpbmNsdWRlQ2hpbGRNYXRjaGVzOiBib29sZWFuXG5cbiAgY29uc3RydWN0b3IocGF0dGVybnM6IFBhdHRlcm5bXSwgcGF0aDogUGF0aCwgb3B0czogTylcbiAgY29uc3RydWN0b3IocGF0dGVybnM6IFBhdHRlcm5bXSwgcGF0aDogUGF0aCwgb3B0czogTykge1xuICAgIHRoaXMucGF0dGVybnMgPSBwYXR0ZXJuc1xuICAgIHRoaXMucGF0aCA9IHBhdGhcbiAgICB0aGlzLm9wdHMgPSBvcHRzXG4gICAgdGhpcy4jc2VwID0gIW9wdHMucG9zaXggJiYgb3B0cy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICdcXFxcJyA6ICcvJ1xuICAgIHRoaXMuaW5jbHVkZUNoaWxkTWF0Y2hlcyA9IG9wdHMuaW5jbHVkZUNoaWxkTWF0Y2hlcyAhPT0gZmFsc2VcbiAgICBpZiAob3B0cy5pZ25vcmUgfHwgIXRoaXMuaW5jbHVkZUNoaWxkTWF0Y2hlcykge1xuICAgICAgdGhpcy4jaWdub3JlID0gbWFrZUlnbm9yZShvcHRzLmlnbm9yZSA/PyBbXSwgb3B0cylcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuaW5jbHVkZUNoaWxkTWF0Y2hlcyAmJlxuICAgICAgICB0eXBlb2YgdGhpcy4jaWdub3JlLmFkZCAhPT0gJ2Z1bmN0aW9uJ1xuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IG0gPSAnY2Fubm90IGlnbm9yZSBjaGlsZCBtYXRjaGVzLCBpZ25vcmUgbGFja3MgYWRkKCkgbWV0aG9kLidcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG0pXG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlnbm9yZSwgYWx3YXlzIHNldCB3aXRoIG1heERlcHRoLCBidXQgaXQncyBvcHRpb25hbCBvbiB0aGVcbiAgICAvLyBHbG9iT3B0aW9ucyB0eXBlXG4gICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgdGhpcy5tYXhEZXB0aCA9IG9wdHMubWF4RGVwdGggfHwgSW5maW5pdHlcbiAgICAvKiBjOCBpZ25vcmUgc3RvcCAqL1xuICAgIGlmIChvcHRzLnNpZ25hbCkge1xuICAgICAgdGhpcy5zaWduYWwgPSBvcHRzLnNpZ25hbFxuICAgICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuI29uUmVzdW1lLmxlbmd0aCA9IDBcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgI2lnbm9yZWQocGF0aDogUGF0aCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnNlZW4uaGFzKHBhdGgpIHx8ICEhdGhpcy4jaWdub3JlPy5pZ25vcmVkPy4ocGF0aClcbiAgfVxuICAjY2hpbGRyZW5JZ25vcmVkKHBhdGg6IFBhdGgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gISF0aGlzLiNpZ25vcmU/LmNoaWxkcmVuSWdub3JlZD8uKHBhdGgpXG4gIH1cblxuICAvLyBiYWNrcHJlc3N1cmUgbWVjaGFuaXNtXG4gIHBhdXNlKCkge1xuICAgIHRoaXMucGF1c2VkID0gdHJ1ZVxuICB9XG4gIHJlc3VtZSgpIHtcbiAgICAvKiBjOCBpZ25vcmUgc3RhcnQgKi9cbiAgICBpZiAodGhpcy5zaWduYWw/LmFib3J0ZWQpIHJldHVyblxuICAgIC8qIGM4IGlnbm9yZSBzdG9wICovXG4gICAgdGhpcy5wYXVzZWQgPSBmYWxzZVxuICAgIGxldCBmbjogKCgpID0+IGFueSkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcbiAgICB3aGlsZSAoIXRoaXMucGF1c2VkICYmIChmbiA9IHRoaXMuI29uUmVzdW1lLnNoaWZ0KCkpKSB7XG4gICAgICBmbigpXG4gICAgfVxuICB9XG4gIG9uUmVzdW1lKGZuOiAoKSA9PiBhbnkpIHtcbiAgICBpZiAodGhpcy5zaWduYWw/LmFib3J0ZWQpIHJldHVyblxuICAgIC8qIGM4IGlnbm9yZSBzdGFydCAqL1xuICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgIGZuKClcbiAgICB9IGVsc2Uge1xuICAgICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICAgIHRoaXMuI29uUmVzdW1lLnB1c2goZm4pXG4gICAgfVxuICB9XG5cbiAgLy8gZG8gdGhlIHJlcXVpc2l0ZSByZWFscGF0aC9zdGF0IGNoZWNraW5nLCBhbmQgcmV0dXJuIHRoZSBwYXRoXG4gIC8vIHRvIGFkZCBvciB1bmRlZmluZWQgdG8gZmlsdGVyIGl0IG91dC5cbiAgYXN5bmMgbWF0Y2hDaGVjayhlOiBQYXRoLCBpZkRpcjogYm9vbGVhbik6IFByb21pc2U8UGF0aCB8IHVuZGVmaW5lZD4ge1xuICAgIGlmIChpZkRpciAmJiB0aGlzLm9wdHMubm9kaXIpIHJldHVybiB1bmRlZmluZWRcbiAgICBsZXQgcnBjOiBQYXRoIHwgdW5kZWZpbmVkXG4gICAgaWYgKHRoaXMub3B0cy5yZWFscGF0aCkge1xuICAgICAgcnBjID0gZS5yZWFscGF0aENhY2hlZCgpIHx8IChhd2FpdCBlLnJlYWxwYXRoKCkpXG4gICAgICBpZiAoIXJwYykgcmV0dXJuIHVuZGVmaW5lZFxuICAgICAgZSA9IHJwY1xuICAgIH1cbiAgICBjb25zdCBuZWVkU3RhdCA9IGUuaXNVbmtub3duKCkgfHwgdGhpcy5vcHRzLnN0YXRcbiAgICBjb25zdCBzID0gbmVlZFN0YXQgPyBhd2FpdCBlLmxzdGF0KCkgOiBlXG4gICAgaWYgKHRoaXMub3B0cy5mb2xsb3cgJiYgdGhpcy5vcHRzLm5vZGlyICYmIHM/LmlzU3ltYm9saWNMaW5rKCkpIHtcbiAgICAgIGNvbnN0IHRhcmdldCA9IGF3YWl0IHMucmVhbHBhdGgoKVxuICAgICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgICBpZiAodGFyZ2V0ICYmICh0YXJnZXQuaXNVbmtub3duKCkgfHwgdGhpcy5vcHRzLnN0YXQpKSB7XG4gICAgICAgIGF3YWl0IHRhcmdldC5sc3RhdCgpXG4gICAgICB9XG4gICAgICAvKiBjOCBpZ25vcmUgc3RvcCAqL1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5tYXRjaENoZWNrVGVzdChzLCBpZkRpcilcbiAgfVxuXG4gIG1hdGNoQ2hlY2tUZXN0KGU6IFBhdGggfCB1bmRlZmluZWQsIGlmRGlyOiBib29sZWFuKTogUGF0aCB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIChcbiAgICAgICAgZSAmJlxuICAgICAgICAgICh0aGlzLm1heERlcHRoID09PSBJbmZpbml0eSB8fCBlLmRlcHRoKCkgPD0gdGhpcy5tYXhEZXB0aCkgJiZcbiAgICAgICAgICAoIWlmRGlyIHx8IGUuY2FuUmVhZGRpcigpKSAmJlxuICAgICAgICAgICghdGhpcy5vcHRzLm5vZGlyIHx8ICFlLmlzRGlyZWN0b3J5KCkpICYmXG4gICAgICAgICAgKCF0aGlzLm9wdHMubm9kaXIgfHxcbiAgICAgICAgICAgICF0aGlzLm9wdHMuZm9sbG93IHx8XG4gICAgICAgICAgICAhZS5pc1N5bWJvbGljTGluaygpIHx8XG4gICAgICAgICAgICAhZS5yZWFscGF0aENhY2hlZCgpPy5pc0RpcmVjdG9yeSgpKSAmJlxuICAgICAgICAgICF0aGlzLiNpZ25vcmVkKGUpXG4gICAgICApID9cbiAgICAgICAgZVxuICAgICAgOiB1bmRlZmluZWRcbiAgfVxuXG4gIG1hdGNoQ2hlY2tTeW5jKGU6IFBhdGgsIGlmRGlyOiBib29sZWFuKTogUGF0aCB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKGlmRGlyICYmIHRoaXMub3B0cy5ub2RpcikgcmV0dXJuIHVuZGVmaW5lZFxuICAgIGxldCBycGM6IFBhdGggfCB1bmRlZmluZWRcbiAgICBpZiAodGhpcy5vcHRzLnJlYWxwYXRoKSB7XG4gICAgICBycGMgPSBlLnJlYWxwYXRoQ2FjaGVkKCkgfHwgZS5yZWFscGF0aFN5bmMoKVxuICAgICAgaWYgKCFycGMpIHJldHVybiB1bmRlZmluZWRcbiAgICAgIGUgPSBycGNcbiAgICB9XG4gICAgY29uc3QgbmVlZFN0YXQgPSBlLmlzVW5rbm93bigpIHx8IHRoaXMub3B0cy5zdGF0XG4gICAgY29uc3QgcyA9IG5lZWRTdGF0ID8gZS5sc3RhdFN5bmMoKSA6IGVcbiAgICBpZiAodGhpcy5vcHRzLmZvbGxvdyAmJiB0aGlzLm9wdHMubm9kaXIgJiYgcz8uaXNTeW1ib2xpY0xpbmsoKSkge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gcy5yZWFscGF0aFN5bmMoKVxuICAgICAgaWYgKHRhcmdldCAmJiAodGFyZ2V0Py5pc1Vua25vd24oKSB8fCB0aGlzLm9wdHMuc3RhdCkpIHtcbiAgICAgICAgdGFyZ2V0LmxzdGF0U3luYygpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1hdGNoQ2hlY2tUZXN0KHMsIGlmRGlyKVxuICB9XG5cbiAgYWJzdHJhY3QgbWF0Y2hFbWl0KHA6IFJlc3VsdDxPPik6IHZvaWRcbiAgYWJzdHJhY3QgbWF0Y2hFbWl0KHA6IHN0cmluZyB8IFBhdGgpOiB2b2lkXG5cbiAgbWF0Y2hGaW5pc2goZTogUGF0aCwgYWJzb2x1dGU6IGJvb2xlYW4pIHtcbiAgICBpZiAodGhpcy4jaWdub3JlZChlKSkgcmV0dXJuXG4gICAgLy8gd2Uga25vdyB3ZSBoYXZlIGFuIGlnbm9yZSBpZiB0aGlzIGlzIGZhbHNlLCBidXQgVFMgZG9lc24ndFxuICAgIGlmICghdGhpcy5pbmNsdWRlQ2hpbGRNYXRjaGVzICYmIHRoaXMuI2lnbm9yZT8uYWRkKSB7XG4gICAgICBjb25zdCBpZ24gPSBgJHtlLnJlbGF0aXZlUG9zaXgoKX0vKipgXG4gICAgICB0aGlzLiNpZ25vcmUuYWRkKGlnbilcbiAgICB9XG4gICAgY29uc3QgYWJzID1cbiAgICAgIHRoaXMub3B0cy5hYnNvbHV0ZSA9PT0gdW5kZWZpbmVkID8gYWJzb2x1dGUgOiB0aGlzLm9wdHMuYWJzb2x1dGVcbiAgICB0aGlzLnNlZW4uYWRkKGUpXG4gICAgY29uc3QgbWFyayA9IHRoaXMub3B0cy5tYXJrICYmIGUuaXNEaXJlY3RvcnkoKSA/IHRoaXMuI3NlcCA6ICcnXG4gICAgLy8gb2ssIHdlIGhhdmUgd2hhdCB3ZSBuZWVkIVxuICAgIGlmICh0aGlzLm9wdHMud2l0aEZpbGVUeXBlcykge1xuICAgICAgdGhpcy5tYXRjaEVtaXQoZSlcbiAgICB9IGVsc2UgaWYgKGFicykge1xuICAgICAgY29uc3QgYWJzID0gdGhpcy5vcHRzLnBvc2l4ID8gZS5mdWxscGF0aFBvc2l4KCkgOiBlLmZ1bGxwYXRoKClcbiAgICAgIHRoaXMubWF0Y2hFbWl0KGFicyArIG1hcmspXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlbCA9IHRoaXMub3B0cy5wb3NpeCA/IGUucmVsYXRpdmVQb3NpeCgpIDogZS5yZWxhdGl2ZSgpXG4gICAgICBjb25zdCBwcmUgPVxuICAgICAgICB0aGlzLm9wdHMuZG90UmVsYXRpdmUgJiYgIXJlbC5zdGFydHNXaXRoKCcuLicgKyB0aGlzLiNzZXApID9cbiAgICAgICAgICAnLicgKyB0aGlzLiNzZXBcbiAgICAgICAgOiAnJ1xuICAgICAgdGhpcy5tYXRjaEVtaXQoIXJlbCA/ICcuJyArIG1hcmsgOiBwcmUgKyByZWwgKyBtYXJrKVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1hdGNoKGU6IFBhdGgsIGFic29sdXRlOiBib29sZWFuLCBpZkRpcjogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHAgPSBhd2FpdCB0aGlzLm1hdGNoQ2hlY2soZSwgaWZEaXIpXG4gICAgaWYgKHApIHRoaXMubWF0Y2hGaW5pc2gocCwgYWJzb2x1dGUpXG4gIH1cblxuICBtYXRjaFN5bmMoZTogUGF0aCwgYWJzb2x1dGU6IGJvb2xlYW4sIGlmRGlyOiBib29sZWFuKTogdm9pZCB7XG4gICAgY29uc3QgcCA9IHRoaXMubWF0Y2hDaGVja1N5bmMoZSwgaWZEaXIpXG4gICAgaWYgKHApIHRoaXMubWF0Y2hGaW5pc2gocCwgYWJzb2x1dGUpXG4gIH1cblxuICB3YWxrQ0IodGFyZ2V0OiBQYXRoLCBwYXR0ZXJuczogUGF0dGVybltdLCBjYjogKCkgPT4gYW55KSB7XG4gICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgaWYgKHRoaXMuc2lnbmFsPy5hYm9ydGVkKSBjYigpXG4gICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICB0aGlzLndhbGtDQjIodGFyZ2V0LCBwYXR0ZXJucywgbmV3IFByb2Nlc3Nvcih0aGlzLm9wdHMpLCBjYilcbiAgfVxuXG4gIHdhbGtDQjIoXG4gICAgdGFyZ2V0OiBQYXRoLFxuICAgIHBhdHRlcm5zOiBQYXR0ZXJuW10sXG4gICAgcHJvY2Vzc29yOiBQcm9jZXNzb3IsXG4gICAgY2I6ICgpID0+IGFueSxcbiAgKSB7XG4gICAgaWYgKHRoaXMuI2NoaWxkcmVuSWdub3JlZCh0YXJnZXQpKSByZXR1cm4gY2IoKVxuICAgIGlmICh0aGlzLnNpZ25hbD8uYWJvcnRlZCkgY2IoKVxuICAgIGlmICh0aGlzLnBhdXNlZCkge1xuICAgICAgdGhpcy5vblJlc3VtZSgoKSA9PiB0aGlzLndhbGtDQjIodGFyZ2V0LCBwYXR0ZXJucywgcHJvY2Vzc29yLCBjYikpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgcHJvY2Vzc29yLnByb2Nlc3NQYXR0ZXJucyh0YXJnZXQsIHBhdHRlcm5zKVxuXG4gICAgLy8gZG9uZSBwcm9jZXNzaW5nLiAgYWxsIG9mIHRoZSBhYm92ZSBpcyBzeW5jLCBjYW4gYmUgYWJzdHJhY3RlZCBvdXQuXG4gICAgLy8gc3Vid2Fsa3MgaXMgYSBtYXAgb2YgcGF0aHMgdG8gdGhlIGVudHJ5IGZpbHRlcnMgdGhleSBuZWVkXG4gICAgLy8gbWF0Y2hlcyBpcyBhIG1hcCBvZiBwYXRocyB0byBbYWJzb2x1dGUsIGlmRGlyXSB0dXBsZXMuXG4gICAgbGV0IHRhc2tzID0gMVxuICAgIGNvbnN0IG5leHQgPSAoKSA9PiB7XG4gICAgICBpZiAoLS10YXNrcyA9PT0gMCkgY2IoKVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgW20sIGFic29sdXRlLCBpZkRpcl0gb2YgcHJvY2Vzc29yLm1hdGNoZXMuZW50cmllcygpKSB7XG4gICAgICBpZiAodGhpcy4jaWdub3JlZChtKSkgY29udGludWVcbiAgICAgIHRhc2tzKytcbiAgICAgIHRoaXMubWF0Y2gobSwgYWJzb2x1dGUsIGlmRGlyKS50aGVuKCgpID0+IG5leHQoKSlcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHQgb2YgcHJvY2Vzc29yLnN1YndhbGtUYXJnZXRzKCkpIHtcbiAgICAgIGlmICh0aGlzLm1heERlcHRoICE9PSBJbmZpbml0eSAmJiB0LmRlcHRoKCkgPj0gdGhpcy5tYXhEZXB0aCkge1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgdGFza3MrK1xuICAgICAgY29uc3QgY2hpbGRyZW5DYWNoZWQgPSB0LnJlYWRkaXJDYWNoZWQoKVxuICAgICAgaWYgKHQuY2FsbGVkUmVhZGRpcigpKVxuICAgICAgICB0aGlzLndhbGtDQjModCwgY2hpbGRyZW5DYWNoZWQsIHByb2Nlc3NvciwgbmV4dClcbiAgICAgIGVsc2Uge1xuICAgICAgICB0LnJlYWRkaXJDQihcbiAgICAgICAgICAoXywgZW50cmllcykgPT4gdGhpcy53YWxrQ0IzKHQsIGVudHJpZXMsIHByb2Nlc3NvciwgbmV4dCksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH1cblxuICAgIG5leHQoKVxuICB9XG5cbiAgd2Fsa0NCMyhcbiAgICB0YXJnZXQ6IFBhdGgsXG4gICAgZW50cmllczogUGF0aFtdLFxuICAgIHByb2Nlc3NvcjogUHJvY2Vzc29yLFxuICAgIGNiOiAoKSA9PiBhbnksXG4gICkge1xuICAgIHByb2Nlc3NvciA9IHByb2Nlc3Nvci5maWx0ZXJFbnRyaWVzKHRhcmdldCwgZW50cmllcylcblxuICAgIGxldCB0YXNrcyA9IDFcbiAgICBjb25zdCBuZXh0ID0gKCkgPT4ge1xuICAgICAgaWYgKC0tdGFza3MgPT09IDApIGNiKClcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IFttLCBhYnNvbHV0ZSwgaWZEaXJdIG9mIHByb2Nlc3Nvci5tYXRjaGVzLmVudHJpZXMoKSkge1xuICAgICAgaWYgKHRoaXMuI2lnbm9yZWQobSkpIGNvbnRpbnVlXG4gICAgICB0YXNrcysrXG4gICAgICB0aGlzLm1hdGNoKG0sIGFic29sdXRlLCBpZkRpcikudGhlbigoKSA9PiBuZXh0KCkpXG4gICAgfVxuICAgIGZvciAoY29uc3QgW3RhcmdldCwgcGF0dGVybnNdIG9mIHByb2Nlc3Nvci5zdWJ3YWxrcy5lbnRyaWVzKCkpIHtcbiAgICAgIHRhc2tzKytcbiAgICAgIHRoaXMud2Fsa0NCMih0YXJnZXQsIHBhdHRlcm5zLCBwcm9jZXNzb3IuY2hpbGQoKSwgbmV4dClcbiAgICB9XG5cbiAgICBuZXh0KClcbiAgfVxuXG4gIHdhbGtDQlN5bmModGFyZ2V0OiBQYXRoLCBwYXR0ZXJuczogUGF0dGVybltdLCBjYjogKCkgPT4gYW55KSB7XG4gICAgLyogYzggaWdub3JlIHN0YXJ0ICovXG4gICAgaWYgKHRoaXMuc2lnbmFsPy5hYm9ydGVkKSBjYigpXG4gICAgLyogYzggaWdub3JlIHN0b3AgKi9cbiAgICB0aGlzLndhbGtDQjJTeW5jKHRhcmdldCwgcGF0dGVybnMsIG5ldyBQcm9jZXNzb3IodGhpcy5vcHRzKSwgY2IpXG4gIH1cblxuICB3YWxrQ0IyU3luYyhcbiAgICB0YXJnZXQ6IFBhdGgsXG4gICAgcGF0dGVybnM6IFBhdHRlcm5bXSxcbiAgICBwcm9jZXNzb3I6IFByb2Nlc3NvcixcbiAgICBjYjogKCkgPT4gYW55LFxuICApIHtcbiAgICBpZiAodGhpcy4jY2hpbGRyZW5JZ25vcmVkKHRhcmdldCkpIHJldHVybiBjYigpXG4gICAgaWYgKHRoaXMuc2lnbmFsPy5hYm9ydGVkKSBjYigpXG4gICAgaWYgKHRoaXMucGF1c2VkKSB7XG4gICAgICB0aGlzLm9uUmVzdW1lKCgpID0+XG4gICAgICAgIHRoaXMud2Fsa0NCMlN5bmModGFyZ2V0LCBwYXR0ZXJucywgcHJvY2Vzc29yLCBjYiksXG4gICAgICApXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgcHJvY2Vzc29yLnByb2Nlc3NQYXR0ZXJucyh0YXJnZXQsIHBhdHRlcm5zKVxuXG4gICAgLy8gZG9uZSBwcm9jZXNzaW5nLiAgYWxsIG9mIHRoZSBhYm92ZSBpcyBzeW5jLCBjYW4gYmUgYWJzdHJhY3RlZCBvdXQuXG4gICAgLy8gc3Vid2Fsa3MgaXMgYSBtYXAgb2YgcGF0aHMgdG8gdGhlIGVudHJ5IGZpbHRlcnMgdGhleSBuZWVkXG4gICAgLy8gbWF0Y2hlcyBpcyBhIG1hcCBvZiBwYXRocyB0byBbYWJzb2x1dGUsIGlmRGlyXSB0dXBsZXMuXG4gICAgbGV0IHRhc2tzID0gMVxuICAgIGNvbnN0IG5leHQgPSAoKSA9PiB7XG4gICAgICBpZiAoLS10YXNrcyA9PT0gMCkgY2IoKVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgW20sIGFic29sdXRlLCBpZkRpcl0gb2YgcHJvY2Vzc29yLm1hdGNoZXMuZW50cmllcygpKSB7XG4gICAgICBpZiAodGhpcy4jaWdub3JlZChtKSkgY29udGludWVcbiAgICAgIHRoaXMubWF0Y2hTeW5jKG0sIGFic29sdXRlLCBpZkRpcilcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHQgb2YgcHJvY2Vzc29yLnN1YndhbGtUYXJnZXRzKCkpIHtcbiAgICAgIGlmICh0aGlzLm1heERlcHRoICE9PSBJbmZpbml0eSAmJiB0LmRlcHRoKCkgPj0gdGhpcy5tYXhEZXB0aCkge1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgdGFza3MrK1xuICAgICAgY29uc3QgY2hpbGRyZW4gPSB0LnJlYWRkaXJTeW5jKClcbiAgICAgIHRoaXMud2Fsa0NCM1N5bmModCwgY2hpbGRyZW4sIHByb2Nlc3NvciwgbmV4dClcbiAgICB9XG5cbiAgICBuZXh0KClcbiAgfVxuXG4gIHdhbGtDQjNTeW5jKFxuICAgIHRhcmdldDogUGF0aCxcbiAgICBlbnRyaWVzOiBQYXRoW10sXG4gICAgcHJvY2Vzc29yOiBQcm9jZXNzb3IsXG4gICAgY2I6ICgpID0+IGFueSxcbiAgKSB7XG4gICAgcHJvY2Vzc29yID0gcHJvY2Vzc29yLmZpbHRlckVudHJpZXModGFyZ2V0LCBlbnRyaWVzKVxuXG4gICAgbGV0IHRhc2tzID0gMVxuICAgIGNvbnN0IG5leHQgPSAoKSA9PiB7XG4gICAgICBpZiAoLS10YXNrcyA9PT0gMCkgY2IoKVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgW20sIGFic29sdXRlLCBpZkRpcl0gb2YgcHJvY2Vzc29yLm1hdGNoZXMuZW50cmllcygpKSB7XG4gICAgICBpZiAodGhpcy4jaWdub3JlZChtKSkgY29udGludWVcbiAgICAgIHRoaXMubWF0Y2hTeW5jKG0sIGFic29sdXRlLCBpZkRpcilcbiAgICB9XG4gICAgZm9yIChjb25zdCBbdGFyZ2V0LCBwYXR0ZXJuc10gb2YgcHJvY2Vzc29yLnN1YndhbGtzLmVudHJpZXMoKSkge1xuICAgICAgdGFza3MrK1xuICAgICAgdGhpcy53YWxrQ0IyU3luYyh0YXJnZXQsIHBhdHRlcm5zLCBwcm9jZXNzb3IuY2hpbGQoKSwgbmV4dClcbiAgICB9XG5cbiAgICBuZXh0KClcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgR2xvYldhbGtlcjxcbiAgTyBleHRlbmRzIEdsb2JXYWxrZXJPcHRzID0gR2xvYldhbGtlck9wdHMsXG4+IGV4dGVuZHMgR2xvYlV0aWw8Tz4ge1xuICBtYXRjaGVzID0gbmV3IFNldDxSZXN1bHQ8Tz4+KClcblxuICBjb25zdHJ1Y3RvcihwYXR0ZXJuczogUGF0dGVybltdLCBwYXRoOiBQYXRoLCBvcHRzOiBPKSB7XG4gICAgc3VwZXIocGF0dGVybnMsIHBhdGgsIG9wdHMpXG4gIH1cblxuICBtYXRjaEVtaXQoZTogUmVzdWx0PE8+KTogdm9pZCB7XG4gICAgdGhpcy5tYXRjaGVzLmFkZChlKVxuICB9XG5cbiAgYXN5bmMgd2FsaygpOiBQcm9taXNlPFNldDxSZXN1bHQ8Tz4+PiB7XG4gICAgaWYgKHRoaXMuc2lnbmFsPy5hYm9ydGVkKSB0aHJvdyB0aGlzLnNpZ25hbC5yZWFzb25cbiAgICBpZiAodGhpcy5wYXRoLmlzVW5rbm93bigpKSB7XG4gICAgICBhd2FpdCB0aGlzLnBhdGgubHN0YXQoKVxuICAgIH1cbiAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzLCByZWopID0+IHtcbiAgICAgIHRoaXMud2Fsa0NCKHRoaXMucGF0aCwgdGhpcy5wYXR0ZXJucywgKCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5zaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgICAgICByZWoodGhpcy5zaWduYWwucmVhc29uKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcyh0aGlzLm1hdGNoZXMpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcbiAgICByZXR1cm4gdGhpcy5tYXRjaGVzXG4gIH1cblxuICB3YWxrU3luYygpOiBTZXQ8UmVzdWx0PE8+PiB7XG4gICAgaWYgKHRoaXMuc2lnbmFsPy5hYm9ydGVkKSB0aHJvdyB0aGlzLnNpZ25hbC5yZWFzb25cbiAgICBpZiAodGhpcy5wYXRoLmlzVW5rbm93bigpKSB7XG4gICAgICB0aGlzLnBhdGgubHN0YXRTeW5jKClcbiAgICB9XG4gICAgLy8gbm90aGluZyBmb3IgdGhlIGNhbGxiYWNrIHRvIGRvLCBiZWNhdXNlIHRoaXMgbmV2ZXIgcGF1c2VzXG4gICAgdGhpcy53YWxrQ0JTeW5jKHRoaXMucGF0aCwgdGhpcy5wYXR0ZXJucywgKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuc2lnbmFsPy5hYm9ydGVkKSB0aHJvdyB0aGlzLnNpZ25hbC5yZWFzb25cbiAgICB9KVxuICAgIHJldHVybiB0aGlzLm1hdGNoZXNcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgR2xvYlN0cmVhbTxcbiAgTyBleHRlbmRzIEdsb2JXYWxrZXJPcHRzID0gR2xvYldhbGtlck9wdHMsXG4+IGV4dGVuZHMgR2xvYlV0aWw8Tz4ge1xuICByZXN1bHRzOiBNaW5pcGFzczxSZXN1bHQ8Tz4sIFJlc3VsdDxPPj5cblxuICBjb25zdHJ1Y3RvcihwYXR0ZXJuczogUGF0dGVybltdLCBwYXRoOiBQYXRoLCBvcHRzOiBPKSB7XG4gICAgc3VwZXIocGF0dGVybnMsIHBhdGgsIG9wdHMpXG4gICAgdGhpcy5yZXN1bHRzID0gbmV3IE1pbmlwYXNzPFJlc3VsdDxPPiwgUmVzdWx0PE8+Pih7XG4gICAgICBzaWduYWw6IHRoaXMuc2lnbmFsLFxuICAgICAgb2JqZWN0TW9kZTogdHJ1ZSxcbiAgICB9KVxuICAgIHRoaXMucmVzdWx0cy5vbignZHJhaW4nLCAoKSA9PiB0aGlzLnJlc3VtZSgpKVxuICAgIHRoaXMucmVzdWx0cy5vbigncmVzdW1lJywgKCkgPT4gdGhpcy5yZXN1bWUoKSlcbiAgfVxuXG4gIG1hdGNoRW1pdChlOiBSZXN1bHQ8Tz4pOiB2b2lkIHtcbiAgICB0aGlzLnJlc3VsdHMud3JpdGUoZSlcbiAgICBpZiAoIXRoaXMucmVzdWx0cy5mbG93aW5nKSB0aGlzLnBhdXNlKClcbiAgfVxuXG4gIHN0cmVhbSgpOiBNYXRjaFN0cmVhbTxPPiB7XG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5wYXRoXG4gICAgaWYgKHRhcmdldC5pc1Vua25vd24oKSkge1xuICAgICAgdGFyZ2V0LmxzdGF0KCkudGhlbigoKSA9PiB7XG4gICAgICAgIHRoaXMud2Fsa0NCKHRhcmdldCwgdGhpcy5wYXR0ZXJucywgKCkgPT4gdGhpcy5yZXN1bHRzLmVuZCgpKVxuICAgICAgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy53YWxrQ0IodGFyZ2V0LCB0aGlzLnBhdHRlcm5zLCAoKSA9PiB0aGlzLnJlc3VsdHMuZW5kKCkpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJlc3VsdHNcbiAgfVxuXG4gIHN0cmVhbVN5bmMoKTogTWF0Y2hTdHJlYW08Tz4ge1xuICAgIGlmICh0aGlzLnBhdGguaXNVbmtub3duKCkpIHtcbiAgICAgIHRoaXMucGF0aC5sc3RhdFN5bmMoKVxuICAgIH1cbiAgICB0aGlzLndhbGtDQlN5bmModGhpcy5wYXRoLCB0aGlzLnBhdHRlcm5zLCAoKSA9PiB0aGlzLnJlc3VsdHMuZW5kKCkpXG4gICAgcmV0dXJuIHRoaXMucmVzdWx0c1xuICB9XG59XG4iLCAiaW1wb3J0IHsgTWluaW1hdGNoIH0gZnJvbSAnbWluaW1hdGNoJ1xuaW1wb3J0IHsgR2xvYk9wdGlvbnMgfSBmcm9tICcuL2dsb2IuanMnXG5cbi8qKlxuICogUmV0dXJuIHRydWUgaWYgdGhlIHBhdHRlcm5zIHByb3ZpZGVkIGNvbnRhaW4gYW55IG1hZ2ljIGdsb2IgY2hhcmFjdGVycyxcbiAqIGdpdmVuIHRoZSBvcHRpb25zIHByb3ZpZGVkLlxuICpcbiAqIEJyYWNlIGV4cGFuc2lvbiBpcyBub3QgY29uc2lkZXJlZCBcIm1hZ2ljXCIgdW5sZXNzIHRoZSBgbWFnaWNhbEJyYWNlc2Agb3B0aW9uXG4gKiBpcyBzZXQsIGFzIGJyYWNlIGV4cGFuc2lvbiBqdXN0IHR1cm5zIG9uZSBzdHJpbmcgaW50byBhbiBhcnJheSBvZiBzdHJpbmdzLlxuICogU28gYSBwYXR0ZXJuIGxpa2UgYCd4e2EsYn15J2Agd291bGQgcmV0dXJuIGBmYWxzZWAsIGJlY2F1c2UgYCd4YXknYCBhbmRcbiAqIGAneGJ5J2AgYm90aCBkbyBub3QgY29udGFpbiBhbnkgbWFnaWMgZ2xvYiBjaGFyYWN0ZXJzLCBhbmQgaXQncyB0cmVhdGVkIHRoZVxuICogc2FtZSBhcyBpZiB5b3UgaGFkIGNhbGxlZCBpdCBvbiBgWyd4YXknLCAneGJ5J11gLiBXaGVuIGBtYWdpY2FsQnJhY2VzOnRydWVgXG4gKiBpcyBpbiB0aGUgb3B0aW9ucywgYnJhY2UgZXhwYW5zaW9uIF9pc18gdHJlYXRlZCBhcyBhIHBhdHRlcm4gaGF2aW5nIG1hZ2ljLlxuICovXG5leHBvcnQgY29uc3QgaGFzTWFnaWMgPSAoXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9ucyA9IHt9LFxuKTogYm9vbGVhbiA9PiB7XG4gIGlmICghQXJyYXkuaXNBcnJheShwYXR0ZXJuKSkge1xuICAgIHBhdHRlcm4gPSBbcGF0dGVybl1cbiAgfVxuICBmb3IgKGNvbnN0IHAgb2YgcGF0dGVybikge1xuICAgIGlmIChuZXcgTWluaW1hdGNoKHAsIG9wdGlvbnMpLmhhc01hZ2ljKCkpIHJldHVybiB0cnVlXG4gIH1cbiAgcmV0dXJuIGZhbHNlXG59XG4iLCAiaW1wb3J0IHsgZXNjYXBlLCB1bmVzY2FwZSB9IGZyb20gJ21pbmltYXRjaCdcbmltcG9ydCB7IE1pbmlwYXNzIH0gZnJvbSAnbWluaXBhc3MnXG5pbXBvcnQgeyBQYXRoIH0gZnJvbSAncGF0aC1zY3VycnknXG5pbXBvcnQgdHlwZSB7XG4gIEdsb2JPcHRpb25zLFxuICBHbG9iT3B0aW9uc1dpdGhGaWxlVHlwZXNGYWxzZSxcbiAgR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzVHJ1ZSxcbiAgR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzVW5zZXQsXG59IGZyb20gJy4vZ2xvYi5qcydcbmltcG9ydCB7IEdsb2IgfSBmcm9tICcuL2dsb2IuanMnXG5pbXBvcnQgeyBoYXNNYWdpYyB9IGZyb20gJy4vaGFzLW1hZ2ljLmpzJ1xuXG5leHBvcnQgeyBlc2NhcGUsIHVuZXNjYXBlIH0gZnJvbSAnbWluaW1hdGNoJ1xuZXhwb3J0IHR5cGUge1xuICBGU09wdGlvbixcbiAgUGF0aCxcbiAgV2Fsa09wdGlvbnMsXG4gIFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUsXG4gIFdhbGtPcHRpb25zV2l0aEZpbGVUeXBlc1Vuc2V0LFxufSBmcm9tICdwYXRoLXNjdXJyeSdcbmV4cG9ydCB7IEdsb2IgfSBmcm9tICcuL2dsb2IuanMnXG5leHBvcnQgdHlwZSB7XG4gIEdsb2JPcHRpb25zLFxuICBHbG9iT3B0aW9uc1dpdGhGaWxlVHlwZXNGYWxzZSxcbiAgR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzVHJ1ZSxcbiAgR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzVW5zZXQsXG59IGZyb20gJy4vZ2xvYi5qcydcbmV4cG9ydCB7IGhhc01hZ2ljIH0gZnJvbSAnLi9oYXMtbWFnaWMuanMnXG5leHBvcnQgeyBJZ25vcmUgfSBmcm9tICcuL2lnbm9yZS5qcydcbmV4cG9ydCB0eXBlIHsgSWdub3JlTGlrZSB9IGZyb20gJy4vaWdub3JlLmpzJ1xuZXhwb3J0IHR5cGUgeyBNYXRjaFN0cmVhbSB9IGZyb20gJy4vd2Fsa2VyLmpzJ1xuXG4vKipcbiAqIFN5bmNyb25vdXMgZm9ybSBvZiB7QGxpbmsgZ2xvYlN0cmVhbX0uIFdpbGwgcmVhZCBhbGwgdGhlIG1hdGNoZXMgYXMgZmFzdCBhc1xuICogeW91IGNvbnN1bWUgdGhlbSwgZXZlbiBhbGwgaW4gYSBzaW5nbGUgdGljayBpZiB5b3UgY29uc3VtZSB0aGVtIGltbWVkaWF0ZWx5LFxuICogYnV0IHdpbGwgc3RpbGwgcmVzcG9uZCB0byBiYWNrcHJlc3N1cmUgaWYgdGhleSdyZSBub3QgY29uc3VtZWQgaW1tZWRpYXRlbHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnbG9iU3RyZWFtU3luYyhcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUsXG4pOiBNaW5pcGFzczxQYXRoLCBQYXRoPlxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JTdHJlYW1TeW5jKFxuICBwYXR0ZXJuOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgb3B0aW9uczogR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzRmFsc2UsXG4pOiBNaW5pcGFzczxzdHJpbmcsIHN0cmluZz5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iU3RyZWFtU3luYyhcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc1Vuc2V0LFxuKTogTWluaXBhc3M8c3RyaW5nLCBzdHJpbmc+XG5leHBvcnQgZnVuY3Rpb24gZ2xvYlN0cmVhbVN5bmMoXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9ucyxcbik6IE1pbmlwYXNzPFBhdGgsIFBhdGg+IHwgTWluaXBhc3M8c3RyaW5nLCBzdHJpbmc+XG5leHBvcnQgZnVuY3Rpb24gZ2xvYlN0cmVhbVN5bmMoXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9ucyA9IHt9LFxuKSB7XG4gIHJldHVybiBuZXcgR2xvYihwYXR0ZXJuLCBvcHRpb25zKS5zdHJlYW1TeW5jKClcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSBzdHJlYW0gdGhhdCBlbWl0cyBhbGwgdGhlIHN0cmluZ3Mgb3IgYFBhdGhgIG9iamVjdHMgYW5kXG4gKiB0aGVuIGVtaXRzIGBlbmRgIHdoZW4gY29tcGxldGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2xvYlN0cmVhbShcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlLFxuKTogTWluaXBhc3M8c3RyaW5nLCBzdHJpbmc+XG5leHBvcnQgZnVuY3Rpb24gZ2xvYlN0cmVhbShcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUsXG4pOiBNaW5pcGFzczxQYXRoLCBQYXRoPlxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JTdHJlYW0oXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zPzogR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzVW5zZXQgfCB1bmRlZmluZWQsXG4pOiBNaW5pcGFzczxzdHJpbmcsIHN0cmluZz5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iU3RyZWFtKFxuICBwYXR0ZXJuOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgb3B0aW9uczogR2xvYk9wdGlvbnMsXG4pOiBNaW5pcGFzczxQYXRoLCBQYXRoPiB8IE1pbmlwYXNzPHN0cmluZywgc3RyaW5nPlxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JTdHJlYW0oXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9ucyA9IHt9LFxuKSB7XG4gIHJldHVybiBuZXcgR2xvYihwYXR0ZXJuLCBvcHRpb25zKS5zdHJlYW0oKVxufVxuXG4vKipcbiAqIFN5bmNocm9ub3VzIGZvcm0gb2Yge0BsaW5rIGdsb2J9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnbG9iU3luYyhcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlLFxuKTogc3RyaW5nW11cbmV4cG9ydCBmdW5jdGlvbiBnbG9iU3luYyhcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc1RydWUsXG4pOiBQYXRoW11cbmV4cG9ydCBmdW5jdGlvbiBnbG9iU3luYyhcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM/OiBHbG9iT3B0aW9uc1dpdGhGaWxlVHlwZXNVbnNldCB8IHVuZGVmaW5lZCxcbik6IHN0cmluZ1tdXG5leHBvcnQgZnVuY3Rpb24gZ2xvYlN5bmMoXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9ucyxcbik6IFBhdGhbXSB8IHN0cmluZ1tdXG5leHBvcnQgZnVuY3Rpb24gZ2xvYlN5bmMoXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9ucyA9IHt9LFxuKSB7XG4gIHJldHVybiBuZXcgR2xvYihwYXR0ZXJuLCBvcHRpb25zKS53YWxrU3luYygpXG59XG5cbi8qKlxuICogUGVyZm9ybSBhbiBhc3luY2hyb25vdXMgZ2xvYiBzZWFyY2ggZm9yIHRoZSBwYXR0ZXJuKHMpIHNwZWNpZmllZC4gUmV0dXJuc1xuICogW1BhdGhdKGh0dHBzOi8vaXNhYWNzLmdpdGh1Yi5pby9wYXRoLXNjdXJyeS9jbGFzc2VzL1BhdGhCYXNlKSBvYmplY3RzIGlmIHRoZVxuICoge0BsaW5rIHdpdGhGaWxlVHlwZXN9IG9wdGlvbiBpcyBzZXQgdG8gYHRydWVgLiBTZWUge0BsaW5rIEdsb2JPcHRpb25zfSBmb3JcbiAqIGZ1bGwgb3B0aW9uIGRlc2NyaXB0aW9ucy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2xvYl8oXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zPzogR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzVW5zZXQgfCB1bmRlZmluZWQsXG4pOiBQcm9taXNlPHN0cmluZ1tdPlxuYXN5bmMgZnVuY3Rpb24gZ2xvYl8oXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlLFxuKTogUHJvbWlzZTxQYXRoW10+XG5hc3luYyBmdW5jdGlvbiBnbG9iXyhcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlLFxuKTogUHJvbWlzZTxzdHJpbmdbXT5cbmFzeW5jIGZ1bmN0aW9uIGdsb2JfKFxuICBwYXR0ZXJuOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgb3B0aW9uczogR2xvYk9wdGlvbnMsXG4pOiBQcm9taXNlPFBhdGhbXSB8IHN0cmluZ1tdPlxuYXN5bmMgZnVuY3Rpb24gZ2xvYl8oXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9ucyA9IHt9LFxuKSB7XG4gIHJldHVybiBuZXcgR2xvYihwYXR0ZXJuLCBvcHRpb25zKS53YWxrKClcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSBzeW5jIGl0ZXJhdG9yIGZvciB3YWxraW5nIGdsb2IgcGF0dGVybiBtYXRjaGVzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2xvYkl0ZXJhdGVTeW5jKFxuICBwYXR0ZXJuOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgb3B0aW9ucz86IEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc1Vuc2V0IHwgdW5kZWZpbmVkLFxuKTogR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iSXRlcmF0ZVN5bmMoXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlLFxuKTogR2VuZXJhdG9yPFBhdGgsIHZvaWQsIHZvaWQ+XG5leHBvcnQgZnVuY3Rpb24gZ2xvYkl0ZXJhdGVTeW5jKFxuICBwYXR0ZXJuOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgb3B0aW9uczogR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzRmFsc2UsXG4pOiBHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB2b2lkPlxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JJdGVyYXRlU3luYyhcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zLFxuKTogR2VuZXJhdG9yPFBhdGgsIHZvaWQsIHZvaWQ+IHwgR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iSXRlcmF0ZVN5bmMoXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9ucyA9IHt9LFxuKSB7XG4gIHJldHVybiBuZXcgR2xvYihwYXR0ZXJuLCBvcHRpb25zKS5pdGVyYXRlU3luYygpXG59XG5cbi8qKlxuICogUmV0dXJuIGFuIGFzeW5jIGl0ZXJhdG9yIGZvciB3YWxraW5nIGdsb2IgcGF0dGVybiBtYXRjaGVzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2xvYkl0ZXJhdGUoXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zPzogR2xvYk9wdGlvbnNXaXRoRmlsZVR5cGVzVW5zZXQgfCB1bmRlZmluZWQsXG4pOiBBc3luY0dlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+XG5leHBvcnQgZnVuY3Rpb24gZ2xvYkl0ZXJhdGUoXG4gIHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdLFxuICBvcHRpb25zOiBHbG9iT3B0aW9uc1dpdGhGaWxlVHlwZXNUcnVlLFxuKTogQXN5bmNHZW5lcmF0b3I8UGF0aCwgdm9pZCwgdm9pZD5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iSXRlcmF0ZShcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zV2l0aEZpbGVUeXBlc0ZhbHNlLFxuKTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nLCB2b2lkLCB2b2lkPlxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JJdGVyYXRlKFxuICBwYXR0ZXJuOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgb3B0aW9uczogR2xvYk9wdGlvbnMsXG4pOiBBc3luY0dlbmVyYXRvcjxQYXRoLCB2b2lkLCB2b2lkPiB8IEFzeW5jR2VuZXJhdG9yPHN0cmluZywgdm9pZCwgdm9pZD5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iSXRlcmF0ZShcbiAgcGF0dGVybjogc3RyaW5nIHwgc3RyaW5nW10sXG4gIG9wdGlvbnM6IEdsb2JPcHRpb25zID0ge30sXG4pIHtcbiAgcmV0dXJuIG5ldyBHbG9iKHBhdHRlcm4sIG9wdGlvbnMpLml0ZXJhdGUoKVxufVxuXG4vLyBhbGlhc2VzOiBnbG9iLnN5bmMuc3RyZWFtKCkgZ2xvYi5zdHJlYW0uc3luYygpIGdsb2Iuc3luYygpIGV0Y1xuZXhwb3J0IGNvbnN0IHN0cmVhbVN5bmMgPSBnbG9iU3RyZWFtU3luY1xuZXhwb3J0IGNvbnN0IHN0cmVhbSA9IE9iamVjdC5hc3NpZ24oZ2xvYlN0cmVhbSwgeyBzeW5jOiBnbG9iU3RyZWFtU3luYyB9KVxuZXhwb3J0IGNvbnN0IGl0ZXJhdGVTeW5jID0gZ2xvYkl0ZXJhdGVTeW5jXG5leHBvcnQgY29uc3QgaXRlcmF0ZSA9IE9iamVjdC5hc3NpZ24oZ2xvYkl0ZXJhdGUsIHtcbiAgc3luYzogZ2xvYkl0ZXJhdGVTeW5jLFxufSlcbmV4cG9ydCBjb25zdCBzeW5jID0gT2JqZWN0LmFzc2lnbihnbG9iU3luYywge1xuICBzdHJlYW06IGdsb2JTdHJlYW1TeW5jLFxuICBpdGVyYXRlOiBnbG9iSXRlcmF0ZVN5bmMsXG59KVxuXG5leHBvcnQgY29uc3QgZ2xvYiA9IE9iamVjdC5hc3NpZ24oZ2xvYl8sIHtcbiAgZ2xvYjogZ2xvYl8sXG4gIGdsb2JTeW5jLFxuICBzeW5jLFxuICBnbG9iU3RyZWFtLFxuICBzdHJlYW0sXG4gIGdsb2JTdHJlYW1TeW5jLFxuICBzdHJlYW1TeW5jLFxuICBnbG9iSXRlcmF0ZSxcbiAgaXRlcmF0ZSxcbiAgZ2xvYkl0ZXJhdGVTeW5jLFxuICBpdGVyYXRlU3luYyxcbiAgR2xvYixcbiAgaGFzTWFnaWMsXG4gIGVzY2FwZSxcbiAgdW5lc2NhcGUsXG59KVxuZ2xvYi5nbG9iID0gZ2xvYlxuIiwgIi8qKlxuICogSW1wbGVtZW50LVBsYW4gUmVsb2FkZXIgLSBTZXNzaW9uU3RhcnQgaG9vayB0aGF0IHJlc3RvcmVzIGltcGxlbWVudC1wbGFuIGluc3RydWN0aW9ucyBhZnRlciBjb250ZXh0IGNvbXBhY3Rpb24uXG4gKlxuICogV2hlbiBhIHNlc3Npb24gc3RhcnRzIGR1ZSB0byBjb21wYWN0aW9uLCB0aGlzIGhvb2sgb3V0cHV0cyB0aGUgaW1wbGVtZW50LXBsYW5cbiAqIGluc3RydWN0aW9ucyB0byByZXN0b3JlIHRoZSB3b3JrZmxvdyBjb250ZXh0LCBhbGxvd2luZyB0aGUgYWdlbnQgdG8gY29udGludWVcbiAqIGV4ZWN1dGluZyB0aGUgcGxhbiBmcm9tIHdoZXJlIGl0IGxlZnQgb2ZmLlxuICpcbiAqIEltcGxlbWVudHMgb25lLXNob3QgYmVoYXZpb3IgYnkgZGVsZXRpbmcgdGhlIGVuYWJsZW1lbnQgZmxhZyBhZnRlciBydW5uaW5nLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNzZXNzaW9uc3RhcnRcbiAqL1xuXG5pbXBvcnQgeyBleGlzdHNTeW5jLCB1bmxpbmtTeW5jLCB3cml0ZUZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IHNlc3Npb25TdGFydEhvb2ssIHNlc3Npb25TdGFydE91dHB1dCB9IGZyb20gXCJAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3NcIjtcbmltcG9ydCB7IElNUExFTUVOVF9QTEFOX0lOU1RSVUNUSU9OUyB9IGZyb20gXCIuL2ltcGxlbWVudC1wbGFuLWluc3RydWN0aW9ucy5qc1wiO1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHBhdGggdG8gdGhlIGltcGxlbWVudC1wbGFuIHJlbG9hZCBlbmFibGVtZW50IGZsYWcgZmlsZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEltcGxlbWVudFBsYW5SZWxvYWRGbGFnUGF0aChzZXNzaW9uSWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgL3RtcC9jbGF1ZGVfaW1wbGVtZW50X3BsYW5fcmVsb2FkXyR7c2Vzc2lvbklkfS5lbmFibGVkYDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgc2Vzc2lvblN0YXJ0SG9vayh7IG1hdGNoZXI6IFwiY29tcGFjdFwiIH0sIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICBjb25zdCBlbmFibGVtZW50RmxhZyA9IGdldEltcGxlbWVudFBsYW5SZWxvYWRGbGFnUGF0aChpbnB1dC5zZXNzaW9uX2lkKTtcblxuICAvLyBDaGVjayBpZiBlbmFibGVtZW50IGZsYWcgZXhpc3RzIChzZXQgYnkgUHJlQ29tcGFjdCBob29rIG9yIG1hbnVhbGx5KVxuICBpZiAoIWV4aXN0c1N5bmMoZW5hYmxlbWVudEZsYWcpKSB7XG4gICAgbG9nZ2VyLmRlYnVnKFwiSW1wbGVtZW50LXBsYW4gcmVsb2FkIG5vdCBlbmFibGVkIGZvciB0aGlzIHNlc3Npb25cIik7XG4gICAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7fSk7XG4gIH1cblxuICAvLyBEZWxldGUgdGhlIGVuYWJsZW1lbnQgZmxhZyAob25lLXNob3QgYmVoYXZpb3IpXG4gIHRyeSB7XG4gICAgdW5saW5rU3luYyhlbmFibGVtZW50RmxhZyk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIElnbm9yZSBjbGVhbnVwIGVycm9yc1xuICB9XG5cbiAgbG9nZ2VyLmluZm8oXCJSZWxvYWRpbmcgaW1wbGVtZW50LXBsYW4gaW5zdHJ1Y3Rpb25zIGFmdGVyIGNvbXBhY3Rpb25cIik7XG5cbiAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7XG4gICAgc3lzdGVtTWVzc2FnZTogXCJJbXBsZW1lbnQtcGxhbiByZWxvYWRlcjogSW5zdHJ1Y3Rpb25zIHJlc3RvcmVkIGFmdGVyIGNvbnRleHQgY29tcGFjdGlvblwiLFxuICAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICAgICAgYWRkaXRpb25hbENvbnRleHQ6IElNUExFTUVOVF9QTEFOX0lOU1RSVUNUSU9OUyxcbiAgICB9LFxuICB9KTtcbn0pO1xuXG4vKipcbiAqIEVuYWJsZXMgaW1wbGVtZW50LXBsYW4gcmVsb2FkIGZvciB0aGUgbmV4dCBjb21wYWN0aW9uLlxuICogQ2FsbCB0aGlzIGZyb20gYSBQcmVDb21wYWN0IGhvb2sgdG8gZW5hYmxlIHRoZSByZWxvYWQgbWVjaGFuaXNtLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlSW1wbGVtZW50UGxhblJlbG9hZChzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBlbmFibGVtZW50RmxhZyA9IGdldEltcGxlbWVudFBsYW5SZWxvYWRGbGFnUGF0aChzZXNzaW9uSWQpO1xuICB3cml0ZUZpbGVTeW5jKGVuYWJsZW1lbnRGbGFnLCBcIjFcIiwgXCJ1dGYtOFwiKTtcbn1cbiIsICIvKipcbiAqIEltcGxlbWVudC1wbGFuIGluc3RydWN0aW9ucyBmb3IgcmVzdG9yYXRpb24gYWZ0ZXIgY29udGV4dCBjb21wYWN0aW9uLlxuICpcbiAqIENvbnRhaW5zIHRoZSBvcGVyYXRpb25hbCBndWlkZWxpbmVzIGFuZCBzdGVwcyBuZWVkZWQgdG8gY29udGludWVcbiAqIGltcGxlbWVudC1wbGFuIGV4ZWN1dGlvbiBhZnRlciBjb21wYWN0aW9uIChleGNsdWRlcyBTdGVwcyAxIGFuZCAzXG4gKiB3aGljaCBhcmUgYWxyZWFkeSBjb21wbGV0ZWQgYmVmb3JlIGNvbXBhY3Rpb24gb2NjdXJzKS5cbiAqL1xuXG5leHBvcnQgY29uc3QgSU1QTEVNRU5UX1BMQU5fSU5TVFJVQ1RJT05TID0gYFxuSW1wbGVtZW50LXBsYW4gaW5zdHJ1Y3Rpb25zIHJlc3RvcmVkIGFmdGVyIGNvbnRleHQgY29tcGFjdGlvbi4gQ29udGludWUgZnJvbSB5b3VyIGN1cnJlbnQgc3RlcC5cblxuPG9wZXJhdGlvbmFsLWd1aWRlbGluZXM+XG5Gb2xsb3cgdGhlc2UgZ3VpZGVsaW5lcyB0aHJvdWdob3V0IGV4ZWN1dGlvbjpcblxuMS4gKipBdm9pZCBvdmVyLWVuZ2luZWVyaW5nKiogLSBPbmx5IG1ha2UgY2hhbmdlcyB0aGF0IGFyZSBkaXJlY3RseSByZXF1ZXN0ZWQgb3IgY2xlYXJseSBuZWNlc3NhcnkuIERvbid0IGFkZCBmZWF0dXJlcywgcmVmYWN0b3IgY29kZSwgb3IgbWFrZSBcImltcHJvdmVtZW50c1wiIGJleW9uZCB3aGF0IHdhcyBhc2tlZC5cblxuMi4gKipBbHdheXMgZGlzcGF0Y2ggdGFza3MqKiAtIERpc3BhdGNoIGV2ZXJ5IGltcGxlbWVudGF0aW9uIHRhc2sgdG8gYSBzdWJhZ2VudC4gRG8gbm90IGltcGxlbWVudCB0YXNrcyBkaXJlY3RseSB1c2luZyBFZGl0L1dyaXRlIHRvb2xzLiBUaGlzIGFwcGxpZXMgcmVnYXJkbGVzcyBvZiB0YXNrIHNpbXBsaWNpdHkuXG5cbjMuICoqRHluYW1pYyBtb2RlbCBzZWxlY3Rpb24qKiAtIENob29zZSB0aGUgbW9kZWwgYmFzZWQgb24gdGFzayBjb21wbGV4aXR5OlxuICAgLSAqKm9wdXMqKjogQW1iaWd1b3VzIHJlcXVpcmVtZW50cywgbXVsdGlwbGUgcG9zc2libGUgYXBwcm9hY2hlcywgb3IgdGFza3Mgd2hlcmUgeW91J3JlIHVuc3VyZSBob3cgdG8gc3RhcnRcbiAgIC0gKipzb25uZXQqKjogQ2xlYXIgZ29hbCB3aXRoIG11bHRpcGxlIHN0ZXBzLCBidWlsZGluZyBmZWF0dXJlcywgb3IgZml4aW5nIGJ1Z3MgaW4gdW5mYW1pbGlhciBjb2RlXG4gICAtICoqaGFpa3UqKjogU2luZ2xlLXN0ZXAgdGFza3MsIGZvbGxvd2luZyBlc3RhYmxpc2hlZCBwYXR0ZXJucywgb3IgbWFraW5nIGNoYW5nZXMgeW91IGFscmVhZHkgdW5kZXJzdGFuZFxuXG40LiAqKlVzZSBnZW5lcmFsLXB1cnBvc2Ugc3ViYWdlbnQqKiAtIEltcGxlbWVudGF0aW9uIGFuZCB2YWxpZGF0aW9uIHN1YmFnZW50cyBzaG91bGQgdXNlIFxcYHN1YmFnZW50X3R5cGU9XCJnZW5lcmFsLXB1cnBvc2VcIlxcYC4gVGhlIHJlZmFjdG9yaW5nIHN0ZXAgdXNlcyBcXGBjb2RlLXNpbXBsaWZpZXI6Y29kZS1zaW1wbGlmaWVyXFxgLlxuXG41LiAqKlNlbGYtY29udGFpbmVkIHRhc2sgcHJvbXB0cyoqIC0gQWdlbnRzIGhhdmUgbm8gY29udmVyc2F0aW9uIGNvbnRleHQuIEluY2x1ZGUgZnVsbCBwYXRocywgY29kZSBzbmlwcGV0cywgcGF0dGVybnMsIGFuZCByZXF1aXJlbWVudHMgaW4gZXZlcnkgdGFzayBwcm9tcHQuXG48L29wZXJhdGlvbmFsLWd1aWRlbGluZXM+XG5cbiMjIFN0ZXAgMjogTG9jYXRlIGFuZCBSZWFkIFBsYW5cblxuTG9jYXRlIHRoZSBwbGFuIGZpbGU6XG5cbioqSWYgW1BMQU5fUEFUSF0gcHJvdmlkZWQ6KipcblxcYFxcYFxcYGJhc2hcbmNhdCBcIltQTEFOX1BBVEhdXCJcblxcYFxcYFxcYFxuXG4qKklmIFtQTEFOX1BBVEhdIG5vdCBwcm92aWRlZDoqKlxuXFxgXFxgXFxgYmFzaFxuIyBDaGVjayBmb3IgYWN0aXZlIHBsYW5zIGZpcnN0IChyZXN1bWUgd29yaylcbmxzIC1sYSBwcm9qZWN0cy9hY3RpdmUvKi9wbGFuLm1kIDI+L2Rldi9udWxsXG5cbiMgVGhlbiBjaGVjayBmb3IgbmV3IHBsYW5zXG5scyAtbGEgcHJvamVjdHMvbmV3LyovcGxhbi5tZCAyPi9kZXYvbnVsbFxuXFxgXFxgXFxgXG5cbklmIG11bHRpcGxlIHBsYW5zIGZvdW5kLCBhc2sgdGhlIHVzZXIgd2hpY2ggdG8gaW1wbGVtZW50LlxuXG5SZWFkIHRoZSBwbGFuIGFuZCBleHRyYWN0OlxuLSBbUFJPSkVDVF9OQU1FXSA9IEZyb20gcGxhbiB0aXRsZSBvciBkaXJlY3RvcnkgbmFtZVxuLSBbUFJPSkVDVF9ESVJdID0gRGlyZWN0b3J5IGNvbnRhaW5pbmcgcGxhbi5tZFxuLSBbVEFTS1NdID0gQWxsIHRhc2tzIHdpdGggZGVwZW5kZW5jaWVzIGFuZCBmaWxlIGFzc2lnbm1lbnRzXG4tIFtQTEFOX0ZJTEVTXSA9IEFsbCBmaWxlcyB0aGUgcGxhbiBpbnRlbmRzIHRvIG1vZGlmeSAoZnJvbSB0YXNrIGZpbGUgYXNzaWdubWVudHMpXG4tIFtWQUxJREFUSU9OX0NPTU1BTkRTXSA9IENvbW1hbmRzIGZyb20gVmFsaWRhdGlvbiBDb21tYW5kcyBzZWN0aW9uXG4tIFtFWFBMT1JBVElPTl9TVU1NQVJZXSA9IENvbnRleHQgZnJvbSBFeHBsb3JhdGlvbiBTdW1tYXJ5IHNlY3Rpb24gKGlmIHByZXNlbnQpXG5cbkNyZWF0ZSBiYXNlbGluZSBjaGVja3BvaW50IG5vdyB0aGF0IFtQUk9KRUNUX05BTUVdIGlzIGtub3duOlxuXG5cXGBcXGBcXGBiYXNoXG5naXQgdGFnIC1mIGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9iYXNlbGluZSBIRUFEXG5cXGBcXGBcXGBcblxuIyMgU3RlcCA0OiBBc3Nlc3MgQ29oZXJlbmNlXG5cbkFuYWx5emUgdGFza3MgYWxvbmcgdGhyZWUgZGltZW5zaW9ucyBiZWZvcmUgZGlzcGF0Y2hpbmc6XG5cbnwgRGltZW5zaW9uIHwgUXVlc3Rpb24gfFxufC0tLS0tLS0tLS0tfC0tLS0tLS0tLS18XG58ICoqRGVwZW5kZW5jeSoqIHwgRG8gZmlsZXMgaW1wb3J0L3JlZmVyZW5jZSBlYWNoIG90aGVyPyB8XG58ICoqVW5pZm9ybWl0eSoqIHwgU2FtZSBvcGVyYXRpb24gYWNyb3NzIGZpbGVzLCBvciB2YXJpZWQgb3BlcmF0aW9ucz8gfFxufCAqKlNpemUqKiB8IFN1YnN0YW50aWFsIHRhc2tzIHdpdGggY2xlYXIgY29tcGxldGlvbiBnYXRlcz8gfFxuXG4qKlJvdXRlIGJhc2VkIG9uIGFzc2Vzc21lbnQ6KipcblxufCBQYXR0ZXJuIHwgUm91dGUgfCBEZXNjcmlwdGlvbiB8XG58LS0tLS0tLS0tfC0tLS0tLS18LS0tLS0tLS0tLS0tLXxcbnwgSW5kZXBlbmRlbnQgZmlsZXMgT1IgdW5pZm9ybSB0YXNrcyB8ICoqUGFyYWxsZWwqKiB8IExhdW5jaCBjb25jdXJyZW50IGFnZW50cyB8XG58IERlcGVuZGVudCArIHZhcmllZCArIHNtYWxsIHwgKipDb2hlcmVudCoqIHwgU2luZ2xlIGFnZW50IGhhbmRsZXMgYWxsIHxcbnwgRGVwZW5kZW50ICsgdmFyaWVkICsgc3Vic3RhbnRpYWwgd2l0aCBjbGVhciBnYXRlcyB8ICoqU2VxdWVudGlhbCoqIHwgT3JkZXJlZCBhZ2VudHMsIHZhbGlkYXRlIGJldHdlZW4gfFxuXG4qKkNsZWFyIGdhdGVzKiogaW5jbHVkZTogdHlwZS1jaGVjayBwYXNzZXMsIHRlc3RzIHBhc3MsIEFQSSBmdW5jdGlvbmFsLCBVSSByZW5kZXJzLlxuXG5XaGVuIHVuY2VydGFpbiBiZXR3ZWVuIENvaGVyZW50IGFuZCBTZXF1ZW50aWFsLCBjaG9vc2UgKipTZXF1ZW50aWFsKiouIENoZWNrcG9pbnRzIGhhdmUgbG93IGNvc3Q7IG1pc3NlZCB2YWxpZGF0aW9uIG9wcG9ydHVuaXRpZXMgaGF2ZSBoaWdoIGNvc3QuXG5cbiMjIFN0ZXAgNTogU2VsZWN0IE1vZGVsIGFuZCBEaXNwYXRjaCBUYXNrc1xuXG5DcmVhdGUgcHJlLWltcGxlbWVudGF0aW9uIGNoZWNrcG9pbnQ6XG5cblxcYFxcYFxcYGJhc2hcbmdpdCBhZGQgLUFcbmdpdCBjb21taXQgLS1hbGxvdy1lbXB0eSAtbSBcImNoZWNrcG9pbnQ6IGJlZm9yZSBpbXBsZW1lbnRhdGlvblxuXG5Qcm9qZWN0OiBbUFJPSkVDVF9OQU1FXVxuVGFza3M6IFtOXSB0YXNrcyB0byBpbXBsZW1lbnRcIlxuZ2l0IHRhZyAtZiBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vcHJlLWltcGxlbWVudGF0aW9uIEhFQURcblxcYFxcYFxcYFxuXG5EaXNwYXRjaCB0YXNrcyB0byBzdWJhZ2VudHMgdXNpbmcgdGhlIFRhc2sgdG9vbC4gRG8gbm90IGltcGxlbWVudCB0YXNrcyBkaXJlY3RseVx1MjAxNGFsd2F5cyBkaXNwYXRjaCwgZXZlbiBmb3Igc2ltcGxlIHNpbmdsZS1maWxlIGNoYW5nZXMuXG5cbiMjIyBNb2RlbCBTZWxlY3Rpb25cblxuRm9yIGVhY2ggdGFzayBvciB0YXNrIGdyb3VwLCBzZWxlY3QgdGhlIGFwcHJvcHJpYXRlIG1vZGVsOlxuXG58IE1vZGVsIHwgV2hlbiB0byBVc2UgfFxufC0tLS0tLS18LS0tLS0tLS0tLS0tLXxcbnwgKipvcHVzKiogfCBBbWJpZ3VvdXMgcmVxdWlyZW1lbnRzLCBtdWx0aXBsZSBhcHByb2FjaGVzIHBvc3NpYmxlLCB1bmZhbWlsaWFyIHRlcnJpdG9yeSB8XG58ICoqc29ubmV0KiogfCBDbGVhciBnb2FsIHdpdGggbXVsdGlwbGUgc3RlcHMsIGJ1aWxkaW5nIGZlYXR1cmVzLCBmaXhpbmcgYnVncyBpbiB1bmZhbWlsaWFyIGNvZGUgfFxufCAqKmhhaWt1KiogfCBTaW5nbGUtc3RlcCB0YXNrcywgZXN0YWJsaXNoZWQgcGF0dGVybnMsIGNoYW5nZXMgeW91IGFscmVhZHkgdW5kZXJzdGFuZCB8XG5cbiMjIyBUYXNrIFByb21wdCBSZXF1aXJlbWVudHNcblxuRWFjaCB0YXNrIHByb21wdCBzaG91bGQgYmUgc2VsZi1jb250YWluZWQgd2l0aDpcbi0gRnVsbCBmaWxlIHBhdGhzIChhYnNvbHV0ZSlcbi0gQ3VycmVudCBmaWxlIGNvbnRlbnQgKHJlYWQgZmlsZXMgZmlyc3QpXG4tIFRlc3RpbmcgcmVxdWlyZW1lbnRzIGZyb20gcGxhblxuLSBQYXR0ZXJucyBmcm9tIEV4cGxvcmF0aW9uIFN1bW1hcnlcbi0gQ29uc3RyYWludHMgZnJvbSBwbGFuXG5cbiMjIyBEaXNwYXRjaCBieSBDb2hlcmVuY2UgUm91dGVcblxuKipQYXJhbGxlbCBSb3V0ZSoqIC0gTGF1bmNoIGFsbCBpbmRlcGVuZGVudCB0YXNrcyBpbiBhIHNpbmdsZSBtZXNzYWdlOlxuXG5cXGBcXGBcXGB4bWxcbjxpbnZva2UgbmFtZT1cIlRhc2tcIj5cbjxwYXJhbWV0ZXIgbmFtZT1cImRlc2NyaXB0aW9uXCI+W3Rhc2stZ3JvdXAtYV08L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cInN1YmFnZW50X3R5cGVcIj5nZW5lcmFsLXB1cnBvc2U8L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cIm1vZGVsXCI+W01PREVMIGJhc2VkIG9uIGNvbXBsZXhpdHldPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJwcm9tcHRcIj5Zb3UgYXJlIGltcGxlbWVudGluZyBhIHBvcnRpb24gb2YgYSBwbGFuLiBPdGhlciBzdWJhZ2VudHMgYXJlIGFsc28gd29ya2luZyBvbiB0aGlzIHBsYW4uXG5cbiMgVGFza1xuW0Rlc2NyaXB0aW9uIHdpdGggdGVzdGluZyByZXF1aXJlbWVudHMgZnJvbSBwbGFuXVxuXG4jIyBQbGFuXG5AW1BST0pFQ1RfRElSXS9wbGFuLm1kXG5cbiMjIENvbnRleHRcbltXaHkgdGhpcyB0YXNrIGV4aXN0cyAtIGZyb20gcGxhbiByYXRpb25hbGVdXG5bUmVsZXZhbnQgY29udGV4dCBmcm9tIEV4cGxvcmF0aW9uIFN1bW1hcnldXG5cbiMjIEZpbGUgT3duZXJzaGlwXG5UaGlzIHRhc2sgb3duczogW2Fic29sdXRlIHBhdGhzIGZyb20gcGxhbl1cbkRvIG5vdCBtb2RpZnkgZmlsZXMgb3V0c2lkZSB0aGlzIGxpc3QuXG5cbiMjIEN1cnJlbnQgRmlsZSBDb250ZW50XG5bUmVhZCBhbmQgaW5jbHVkZSBjdXJyZW50IGNvbnRlbnQgb2YgZmlsZXMgdG8gYmUgbW9kaWZpZWRdXG5cbiMjIENvbnN0cmFpbnRzXG5bRnJvbSBwbGFuOiBwYXR0ZXJucywgaW50ZXJmYWNlcywgZGVwZW5kZW5jaWVzIHRvIHJlc3BlY3RdXG5cbiMjIFJlcXVpcmVtZW50c1xuW0xpc3QgYWxsIHJlcXVpcmVtZW50c11cbjEuIFtSZXF1aXJlbWVudCAxXVxuMi4gW1JlcXVpcmVtZW50IDJdXG5cbiMjIFBhdHRlcm5zIHRvIEZvbGxvd1xuW0NvZGUgc25pcHBldHMgc2hvd2luZyBjb252ZW50aW9ucyAtIGZyb20gZXhwbG9yYXRpb24gb3IgZmlsZSByZWFkc11cblxuIyMgR3VpZGVsaW5lc1xuLSBPbmx5IG1ha2UgcmVxdWVzdGVkIGNoYW5nZXNcbi0gRG9uJ3QgYWRkIHVucmVxdWVzdGVkIGZlYXR1cmVzIG9yIGFic3RyYWN0aW9uc1xuLSBLZWVwIGltcGxlbWVudGF0aW9uIG1pbmltYWwgYW5kIGZvY3VzZWRcblxuIyMgU3VjY2VzcyBDcml0ZXJpYVxuLSBbIF0gSW1wbGVtZW50YXRpb24gY29tcGxldGVcbi0gWyBdIFRlc3RzIHBhc3MgKGlmIGFwcGxpY2FibGUpXG4tIFsgXSBUeXBlcyBjb3JyZWN0XG4tIFsgXSBGb2xsb3dzIGV4aXN0aW5nIHBhdHRlcm5zPC9wYXJhbWV0ZXI+XG48L2ludm9rZT5cbjxpbnZva2UgbmFtZT1cIlRhc2tcIj5cbjxwYXJhbWV0ZXIgbmFtZT1cImRlc2NyaXB0aW9uXCI+W3Rhc2stZ3JvdXAtYl08L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cInN1YmFnZW50X3R5cGVcIj5nZW5lcmFsLXB1cnBvc2U8L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cIm1vZGVsXCI+W01PREVMIGJhc2VkIG9uIGNvbXBsZXhpdHldPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJwcm9tcHRcIj5bU2FtZSBzdHJ1Y3R1cmUgYXMgYWJvdmVdPC9wYXJhbWV0ZXI+XG48L2ludm9rZT5cblxcYFxcYFxcYFxuXG4qKlNlcXVlbnRpYWwgUm91dGUqKiAtIEVhY2ggcGhhc2UgbXVzdCBwYXNzIHZhbGlkYXRpb24gYmVmb3JlIHRoZSBuZXh0IGJlZ2luczpcblxuXFxgXFxgXFxgXG5cdTI1MENcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MTBcblx1MjUwMiAgRm9yIGVhY2ggcGhhc2U6ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MDIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjUwMlxuXHUyNTAyICAgIERpc3BhdGNoIHBoYXNlIHRhc2tzICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcdTI1MDJcblx1MjUwMiAgICAgICAgICAgIFx1MjE5MyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcdTI1MDJcblx1MjUwMiAgICBXYWl0IGZvciBjb21wbGV0aW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MDIgICAgICAgICAgICBcdTIxOTMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MDIgICAgUnVuIHZhbGlkYXRpb24gKHR5cGVjaGVjaywgdGVzdCwgbGludCkgICAgICAgICAgIFx1MjUwMlxuXHUyNTAyICAgICAgICAgICAgXHUyMTkzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjUwMlxuXHUyNTAyICAgIFx1MjUwQ1x1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUzNFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUxMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MDIgICAgXHUyNTAyICAgICAgICAgICAgICAgXHUyNTAyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcdTI1MDJcblx1MjUwMiAgUGFzcyAgICAgICAgICAgIEZhaWwgXHUyMTkyIEZpeCBlcnJvcnMsIHJlLXZhbGlkYXRlICAgICBcdTI1MDJcblx1MjUwMiAgICBcdTI1MDIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcdTI1MDJcblx1MjUwMiAgICBcdTIxOTMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcdTI1MDJcblx1MjUwMiAgTmV4dCBwaGFzZSAob3IgU3RlcCA2IGlmIGZpbmFsIHBoYXNlKSAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MTRcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MThcblxcYFxcYFxcYFxuXG5EbyBub3QgZGlzcGF0Y2ggdGhlIG5leHQgcGhhc2UgdW50aWwgdGhlIGN1cnJlbnQgcGhhc2UgcGFzc2VzIHZhbGlkYXRpb24uXG5cbioqQ29oZXJlbnQgUm91dGUqKiAtIFNpbmdsZSBhZ2VudCBoYW5kbGVzIGFsbCByZWxhdGVkIHRhc2tzOlxuXG5cXGBcXGBcXGB4bWxcbjxpbnZva2UgbmFtZT1cIlRhc2tcIj5cbjxwYXJhbWV0ZXIgbmFtZT1cImRlc2NyaXB0aW9uXCI+W2FsbC1yZWxhdGVkLXRhc2tzXTwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwic3ViYWdlbnRfdHlwZVwiPmdlbmVyYWwtcHVycG9zZTwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwibW9kZWxcIj5bTU9ERUwgLSB0eXBpY2FsbHkgb3B1cyBmb3IgY29oZXJlbnQgd29ya108L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cInByb21wdFwiPllvdSBhcmUgaW1wbGVtZW50aW5nIGEgY29tcGxldGUgZmVhdHVyZS4gQ29tcGxldGUgYWxsIHRhc2tzIGluIHNlcXVlbmNlLlxuXG4jIFRhc2tzXG5bTGlzdCBhbGwgdGFza3MgdG8gY29tcGxldGUgaW4gb3JkZXJdXG5cbiMjIFBsYW5cbkBbUFJPSkVDVF9ESVJdL3BsYW4ubWRcblxuIyMgQ29udGV4dFxuW0Z1bGwgY29udGV4dCBmb3IgdGhlIGNvaGVyZW50IHdvcmtdXG5cbiMjIEZpbGUgT3duZXJzaGlwXG5UaGlzIHRhc2sgb3duczogW2FsbCBmaWxlcyBmb3IgdGhpcyBjb2hlcmVudCBncm91cF1cblxuIyMgQ3VycmVudCBGaWxlIENvbnRlbnRcbltSZWFkIGFuZCBpbmNsdWRlIGN1cnJlbnQgY29udGVudCBvZiBBTEwgZmlsZXNdXG5cbiMjIFJlcXVpcmVtZW50c1xuW0NvbWJpbmVkIHJlcXVpcmVtZW50cyBmcm9tIGFsbCB0YXNrc11cblxuIyMgR3VpZGVsaW5lc1xuLSBDb21wbGV0ZSB0YXNrcyBpbiBkZXBlbmRlbmN5IG9yZGVyXG4tIE9ubHkgbWFrZSByZXF1ZXN0ZWQgY2hhbmdlc1xuLSBEb24ndCBhZGQgdW5yZXF1ZXN0ZWQgZmVhdHVyZXMgb3IgYWJzdHJhY3Rpb25zXG5cbiMjIFN1Y2Nlc3MgQ3JpdGVyaWFcbi0gWyBdIEFsbCB0YXNrcyBjb21wbGV0ZVxuLSBbIF0gVGVzdHMgcGFzc1xuLSBbIF0gVHlwZXMgY29ycmVjdFxuLSBbIF0gRm9sbG93cyBleGlzdGluZyBwYXR0ZXJuczwvcGFyYW1ldGVyPlxuPC9pbnZva2U+XG5cXGBcXGBcXGBcblxuIyMgU3RlcCA2OiBWYWxpZGF0aW9uIEdhdGVcblxuQ3JlYXRlIHBvc3QtaW1wbGVtZW50YXRpb24gY2hlY2twb2ludDpcblxuXFxgXFxgXFxgYmFzaFxuZ2l0IGFkZCAtQVxuZ2l0IGNvbW1pdCAtLWFsbG93LWVtcHR5IC1tIFwiY2hlY2twb2ludDogYWZ0ZXIgaW1wbGVtZW50YXRpb24sIGJlZm9yZSB2YWxpZGF0aW9uXG5cblByb2plY3Q6IFtQUk9KRUNUX05BTUVdXCJcbmdpdCB0YWcgLWYgaW1wbGVtZW50L1tQUk9KRUNUX05BTUVdL3Bvc3QtaW1wbGVtZW50YXRpb24gSEVBRFxuXFxgXFxgXFxgXG5cbiMjIyBDaGVjayBmb3IgVW5leHBlY3RlZCBNb2RpZmljYXRpb25zXG5cblZlcmlmeSB0aGF0IG9ubHkgcGxhbi1vd25lZCBmaWxlcyB3ZXJlIG1vZGlmaWVkOlxuXG5cXGBcXGBcXGBiYXNoXG4jIEZpbGVzIG1vZGlmaWVkIHNpbmNlIGJhc2VsaW5lXG5NT0RJRklFRD0kKGdpdCBkaWZmIGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9iYXNlbGluZSAtLW5hbWUtb25seSlcblxuIyBDaGVjayBmb3IgZmlsZXMgb3V0c2lkZSBbUExBTl9GSUxFU11cbiMgKENvbXBhcmUgTU9ESUZJRUQgYWdhaW5zdCB0aGUgbGlzdCBvZiBwbGFuLW93bmVkIGZpbGVzKVxuVU5FWFBFQ1RFRD0kKGNvbW0gLTIzIDwoZWNobyBcIiRNT0RJRklFRFwiIHwgc29ydCkgPChlY2hvIFwiW1BMQU5fRklMRVNdXCIgfCBzb3J0KSlcblxcYFxcYFxcYFxuXG4qKklmIHVuZXhwZWN0ZWQgbW9kaWZpY2F0aW9ucyBleGlzdDoqKiBSZXBvcnQgdGhlbSB0byB1c2VyIGFuZCBhc2sgaG93IHRvIHByb2NlZWQ6XG4tIFwiS2VlcFwiIFx1MjE5MiBDb250aW51ZSB3aXRoIG1vZGlmaWNhdGlvbnMgaW4gcGxhY2Vcbi0gXCJTdGFzaFwiIFx1MjE5MiBcXGBnaXQgc3Rhc2ggcHVzaCAtbSBcInVuZXhwZWN0ZWQtY2hhbmdlc1wiIC0tICRVTkVYUEVDVEVEXFxgXG4tIFwiRGlzY2FyZFwiIFx1MjE5MiBcXGBnaXQgY2hlY2tvdXQgaW1wbGVtZW50L1tQUk9KRUNUX05BTUVdL2Jhc2VsaW5lIC0tICRVTkVYUEVDVEVEXFxgXG5cbkRvIG5vdCBkaXNjYXJkIHdpdGhvdXQgZXhwbGljaXQgdXNlciBjb25zZW50LlxuXG4qKlJlcXVpcmVtZW50OioqIEFMTCB2YWxpZGF0aW9uIGNvbW1hbmRzIG11c3QgcGFzcyBiZWZvcmUgcHJvY2VlZGluZy5cblxuUnVuIHZhbGlkYXRpb24gY29tbWFuZHMgZnJvbSB0aGUgcGxhbidzIFwiIyMgVmFsaWRhdGlvbiBDb21tYW5kc1wiIHNlY3Rpb24uIElmIG5vIHZhbGlkYXRpb24gY29tbWFuZHMgYXJlIHNwZWNpZmllZCwgdXNlIHRoZXNlIGRlZmF1bHRzOlxuXG5cXGBcXGBcXGBiYXNoXG5jZCBwYWNrYWdlcy9bcGFja2FnZV0gJiYgeWFybiB0eXBlY2hlY2sgMj4mMVxuY2QgcGFja2FnZXMvW3BhY2thZ2VdICYmIHlhcm4gdGVzdCAyPiYxXG5jZCBwYWNrYWdlcy9bcGFja2FnZV0gJiYgeWFybiBsaW50IDI+JjFcblxcYFxcYFxcYFxuXG4jIyMgT24gRmFpbHVyZVxuXG4xLiAqKkVycm9yIGluIGNvZGUgeW91IGNhbiBtb2RpZnkqKiBcdTIxOTIgRGlzcGF0Y2ggZml4IHRhc2sgdG8gc3ViYWdlbnQsIHJlLXJ1biB2YWxpZGF0aW9uXG4yLiAqKkVycm9yIG91dHNpZGUgeW91ciBzY29wZSoqIFx1MjE5MiBCbG9jayBpbW1lZGlhdGVseSBhbmQgcmVwb3J0IHRvIHVzZXJcblxuIyMjIFZhbGlkYXRpb24gTG9vcFxuXG5Db250aW51ZSB0aGUgZml4LWFuZC12YWxpZGF0ZSBjeWNsZSB1bnRpbDpcbi0gKipBbGwgdmFsaWRhdGlvbnMgcGFzcyoqIFx1MjE5MiBQcm9jZWVkIHRvIFN0ZXAgN1xuLSAqKkVycm9yIGlzIG91dHNpZGUgc2NvcGUqKiBcdTIxOTIgUmVwb3J0IGJsb2NrZXIgdG8gdXNlciwga2VlcCBwcm9qZWN0IGluIFxcYHByb2plY3RzL2FjdGl2ZS9cXGAsICoqU1RPUCoqXG4tICoqRml4IGF0dGVtcHRzIGV4Y2VlZCAzIGZvciB0aGUgc2FtZSBlcnJvcioqIFx1MjE5MiBSZXBvcnQgYmxvY2tlciB0byB1c2VyLCBrZWVwIHByb2plY3QgaW4gXFxgcHJvamVjdHMvYWN0aXZlL1xcYCwgKipTVE9QKipcblxuIyMjIEZpeCBUYXNrIERpc3BhdGNoXG5cbldoZW4gZGlzcGF0Y2hpbmcgZml4IHRhc2tzLCBpbmNsdWRlIHRoZSBleGFjdCBlcnJvciBvdXRwdXQ6XG5cblxcYFxcYFxcYHhtbFxuPGludm9rZSBuYW1lPVwiVGFza1wiPlxuPHBhcmFtZXRlciBuYW1lPVwiZGVzY3JpcHRpb25cIj5GaXggW2Vycm9yLXR5cGVdPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJzdWJhZ2VudF90eXBlXCI+Z2VuZXJhbC1wdXJwb3NlPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJtb2RlbFwiPltNT0RFTCAtIGhhaWt1IGZvciBzaW1wbGUgZml4ZXMsIHNvbm5ldCBmb3IgY29tcGxleF08L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cInByb21wdFwiPiMgVGFzazogRml4IFZhbGlkYXRpb24gRXJyb3JcblxuIyMgRXJyb3IgT3V0cHV0XG5cXGBcXGBcXGBcbltFeGFjdCBlcnJvciBvdXRwdXQgd2l0aCBmaWxlOmxpbmUgcmVmZXJlbmNlc11cblxcYFxcYFxcYFxuXG4jIyBQbGFuXG5AW1BST0pFQ1RfRElSXS9wbGFuLm1kXG5cbiMjIEZpbGUgT3duZXJzaGlwXG5UaGlzIHRhc2sgb3duczogW2ZpbGVzIG1lbnRpb25lZCBpbiBlcnJvcl1cblxuIyMgQ3VycmVudCBGaWxlIENvbnRlbnRcbltDb250ZW50IG9mIGZpbGVzIHdpdGggZXJyb3JzXVxuXG4jIyBHdWlkZWxpbmVzXG4tIEZpeCBvbmx5IHRoZSBzcGVjaWZpYyBlcnJvciBzaG93blxuLSBEbyBub3QgcmVmYWN0b3Igb3IgaW1wcm92ZSBzdXJyb3VuZGluZyBjb2RlXG4tIE1haW50YWluIGV4aXN0aW5nIHBhdHRlcm5zXG5cbiMjIFN1Y2Nlc3MgQ3JpdGVyaWFcbi0gWyBdIEVycm9yIHJlc29sdmVkXG4tIFsgXSBObyBuZXcgZXJyb3JzIGludHJvZHVjZWQ8L3BhcmFtZXRlcj5cbjwvaW52b2tlPlxuXFxgXFxgXFxgXG5cbiMjIFN0ZXAgNzogUmVmYWN0b3JcblxuQ3JlYXRlIHByZS1yZWZhY3RvciBjaGVja3BvaW50OlxuXG5cXGBcXGBcXGBiYXNoXG5naXQgYWRkIC1BXG5naXQgY29tbWl0IC0tYWxsb3ctZW1wdHkgLW0gXCJjaGVja3BvaW50OiBiZWZvcmUgcmVmYWN0b3JpbmdcblxuUHJvamVjdDogW1BST0pFQ1RfTkFNRV1cblN0YXR1czogVmFsaWRhdGlvbiBwYXNzZWRcIlxuZ2l0IHRhZyAtZiBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vcHJlLXJlZmFjdG9yIEhFQURcblxcYFxcYFxcYFxuXG5EZWxlZ2F0ZSByZWZhY3RvcmluZyB0byBpbXByb3ZlIGNvZGUgcXVhbGl0eSB3aGlsZSBwcmVzZXJ2aW5nIGJlaGF2aW9yLlxuXG4jIyMgRGlzcGF0Y2ggUmVmYWN0b3JpbmdcblxuXFxgXFxgXFxgeG1sXG48aW52b2tlIG5hbWU9XCJUYXNrXCI+XG48cGFyYW1ldGVyIG5hbWU9XCJkZXNjcmlwdGlvblwiPlJlZmFjdG9yIGltcGxlbWVudGF0aW9uPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJzdWJhZ2VudF90eXBlXCI+Y29kZS1zaW1wbGlmaWVyOmNvZGUtc2ltcGxpZmllcjwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwicHJvbXB0XCI+XG4jIFRhc2s6IFJlZmFjdG9yIFJlY2VudCBJbXBsZW1lbnRhdGlvblxuXG4jIyBQbGFuXG5AW1BST0pFQ1RfRElSXS9wbGFuLm1kXG5cbiMjIEZvY3VzIEFyZWFzXG4xLiBFbGltaW5hdGUgZGVhZCBjb2RlXG4yLiBTaW1wbGlmeSBsb2dpYyAoZ3VhcmQgY2xhdXNlcywgc21hbGxlciBmdW5jdGlvbnMpXG4zLiBSZW1vdmUgb3Zlci1lbmdpbmVlcmluZyAoWUFHTkkpXG40LiBJbXByb3ZlIG5hbWluZyAoYWxpZ24gd2l0aCBwbGFuIGludGVudClcbjUuIEhhcm1vbml6ZSBwYXR0ZXJucyAobWF0Y2ggY29kZWJhc2UgY29udmVudGlvbnMpXG42LiBSZWZpbmUgdGVzdHMgKHJlbW92ZSByZWR1bmRhbnQsIGZvY3VzIG9uIGJlaGF2aW9yKVxuXG4jIyBDb25zdHJhaW50c1xuLSBQcmVzZXJ2ZSBvYnNlcnZhYmxlIGJlaGF2aW9yXG4tIE1haW50YWluIHRlc3QgY292ZXJhZ2Vcbi0gU3RheSB3aXRoaW4gcGxhbiBzY29wZVxuLSBWYWxpZGF0ZSBhZnRlciBlYWNoIGNoYW5nZVxuXG4jIyBHdWlkZWxpbmVzXG4tIE9ubHkgcmVmYWN0b3IgZmlsZXMgbW9kaWZpZWQgYnkgdGhlIGltcGxlbWVudGF0aW9uXG4tIERvIG5vdCBhZGQgbmV3IGZlYXR1cmVzIG9yIGNhcGFiaWxpdGllc1xuLSBLZWVwIGNoYW5nZXMgbWluaW1hbCBhbmQgZm9jdXNlZCBvbiBjbGFyaXR5XG48L3BhcmFtZXRlcj5cbjwvaW52b2tlPlxuXFxgXFxgXFxgXG5cbiMjIyBQcm9jZXNzIFJlc3VsdFxuXG5CYXNlZCBvbiBhZ2VudCBzdGF0dXM6XG4tICoqQ09NUExFVEVEKio6IFByb2NlZWQgdG8gU3RlcCA4XG4tICoqSEFTX1JFQ09NTUVOREFUSU9OUyoqOiBMb2cgcmVjb21tZW5kYXRpb25zLCBwcm9jZWVkIHRvIFN0ZXAgOFxuLSAqKkJMT0NLRUQqKjogRG9jdW1lbnQgcmVhc29ucywgcHJvY2VlZCB0byBTdGVwIDhcblxuIyMgU3RlcCA4OiBQb3N0LVJlZmFjdG9yIFZhbGlkYXRpb25cblxuUmUtcnVuIHRoZSB2YWxpZGF0aW9uIGNvbW1hbmRzICh0eXBlY2hlY2ssIHRlc3QsIGxpbnQpIHRvIGVuc3VyZSByZWZhY3RvcmluZyBkaWRuJ3QgaW50cm9kdWNlIHJlZ3Jlc3Npb25zLlxuXG4qKklmIHZhbGlkYXRpb24gcGFzc2VzOioqIENvbW1pdCByZWZhY3RvcmluZyBjaGFuZ2VzIGFuZCBwcm9jZWVkIHRvIFN0ZXAgOTpcblxcYFxcYFxcYGJhc2hcbmdpdCBhZGQgLUFcbmdpdCBjb21taXQgLW0gXCJyZWZhY3Rvcjogc2ltcGxpZnkgaW1wbGVtZW50YXRpb25cblxuUHJvamVjdDogW1BST0pFQ1RfTkFNRV1cIlxuXFxgXFxgXFxgXG5cbioqSWYgdmFsaWRhdGlvbiBmYWlsczoqKiBSZXZlcnQgb25seSBwbGFuLW93bmVkIGZpbGVzIHRvIHByZS1yZWZhY3RvciBzdGF0ZSwgdGhlbiBwcm9jZWVkIHRvIFN0ZXAgOTpcblxcYFxcYFxcYGJhc2hcbiMgSWRlbnRpZnkgZmlsZXMgY2hhbmdlZCBieSByZWZhY3RvcmluZyB0aGF0IGFyZSBpbiBbUExBTl9GSUxFU11cblJFRkFDVE9SX0NIQU5HRVM9JChnaXQgZGlmZiBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vcHJlLXJlZmFjdG9yIC0tbmFtZS1vbmx5KVxuUExBTl9DSEFOR0VTPSQoY29tbSAtMTIgPChlY2hvIFwiJFJFRkFDVE9SX0NIQU5HRVNcIiB8IHNvcnQpIDwoZWNobyBcIltQTEFOX0ZJTEVTXVwiIHwgc29ydCkpXG5cbiMgUmV2ZXJ0IG9ubHkgdGhvc2UgZmlsZXNcbmdpdCBjaGVja291dCBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vcHJlLXJlZmFjdG9yIC0tICRQTEFOX0NIQU5HRVNcblxcYFxcYFxcYFxuXG4jIyBTdGVwIDk6IEV2YWx1YXRlIFF1YWxpdHlcblxuRGlzcGF0Y2ggYSBzdWJhZ2VudCB0byBldmFsdWF0ZSB0aGUgaW1wbGVtZW50YXRpb24gZm9yIHByb2R1Y3Rpb24gcmVhZGluZXNzOlxuXG5cXGBcXGBcXGB4bWxcbjxpbnZva2UgbmFtZT1cIlRhc2tcIj5cbjxwYXJhbWV0ZXIgbmFtZT1cImRlc2NyaXB0aW9uXCI+RXZhbHVhdGUgaW1wbGVtZW50YXRpb24gcXVhbGl0eTwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwic3ViYWdlbnRfdHlwZVwiPmdlbmVyYWwtcHVycG9zZTwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwibW9kZWxcIj5bTU9ERUwgLSB0eXBpY2FsbHkgc29ubmV0XTwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwicHJvbXB0XCI+IyBUYXNrOiBFdmFsdWF0ZSBJbXBsZW1lbnRhdGlvbiBRdWFsaXR5XG5cbiMjIFBsYW5cbkBbUFJPSkVDVF9ESVJdL3BsYW4ubWRcblxuIyMgU3RhdHVzIERlZmluaXRpb25zXG4tICoqUFJPRFVDVElPTl9SRUFEWSoqOiBJbXBsZW1lbnRhdGlvbiBtZWV0cyBhbGwgc3VjY2VzcyBjcml0ZXJpYSwgY29kZSBxdWFsaXR5IGlzIGFjY2VwdGFibGVcbi0gKipDT05USU5VRSoqOiBDb3JlIHdvcmtzIGJ1dCBoYXMgcXVhbGl0eSBpc3N1ZXMgdGhhdCBzaG91bGQgYmUgYWRkcmVzc2VkIChub3QgdmFsaWRhdGlvbiBmYWlsdXJlcylcbi0gKipCTE9DS0VEKio6IEZ1bmRhbWVudGFsIGRlc2lnbiBpc3N1ZXMgb3IgbWlzc2luZyByZXF1aXJlbWVudHMgdGhhdCBjYW4ndCBiZSBmaXhlZCB3aXRob3V0IHJlLXBsYW5uaW5nXG5cbiMjIEV2YWx1YXRpb24gQ3JpdGVyaWFcblxuMS4gKipSZXF1aXJlbWVudHMgQ292ZXJhZ2UqKjogRG9lcyB0aGUgaW1wbGVtZW50YXRpb24gc2F0aXNmeSBhbGwgc3VjY2VzcyBjcml0ZXJpYSBpbiB0aGUgcGxhbj9cbjIuICoqQ29kZSBRdWFsaXR5Kio6IElzIHRoZSBjb2RlIG1haW50YWluYWJsZSwgcmVhZGFibGUsIGFuZCBmb2xsb3dpbmcgcHJvamVjdCBjb252ZW50aW9ucz9cbjMuICoqRWRnZSBDYXNlcyoqOiBBcmUgZXJyb3IgY29uZGl0aW9ucyBhbmQgZWRnZSBjYXNlcyBoYW5kbGVkIGFwcHJvcHJpYXRlbHk/XG40LiAqKlRlc3QgQ292ZXJhZ2UqKjogQXJlIHRoZSBjaGFuZ2VzIGFkZXF1YXRlbHkgdGVzdGVkP1xuNS4gKipJbnRlZ3JhdGlvbioqOiBEb2VzIHRoZSBpbXBsZW1lbnRhdGlvbiBpbnRlZ3JhdGUgY2xlYW5seSB3aXRoIGV4aXN0aW5nIGNvZGU/XG5cbiMjIFN0ZXBzXG5cbjEuIFJlYWQgdGhlIHBsYW4ncyBTdWNjZXNzIENyaXRlcmlhIHNlY3Rpb25cbjIuIFJldmlldyB0aGUgaW1wbGVtZW50YXRpb24gYWdhaW5zdCBlYWNoIGNyaXRlcmlvblxuMy4gQXNzZXNzIGNvZGUgcXVhbGl0eSBhbmQgY29tcGxldGVuZXNzXG40LiBEZXRlcm1pbmUgc3RhdHVzXG5cbiMjIFJldHVybiBGb3JtYXRcblxcYFxcYFxcYFxuU1RBVFVTOiBbU1RBVFVTXVxuQ1JJVEVSSUFfTUVUOiBbTl0vW05dXG5RVUFMSVRZX05PVEVTOiBbb2JzZXJ2YXRpb25zIGFib3V0IGNvZGUgcXVhbGl0eV1cbklTU1VFUzogW0xpc3QgYW55IGNvbmNlcm5zLCBvciBcIk5vbmVcIl1cblJFQ09NTUVOREFUSU9OUzogW0lmIENPTlRJTlVFLCBsaXN0IHNwZWNpZmljIGltcHJvdmVtZW50cyBuZWVkZWRdXG5cXGBcXGBcXGA8L3BhcmFtZXRlcj5cbjwvaW52b2tlPlxuXFxgXFxgXFxgXG5cbiMjIyBIYW5kbGUgRXZhbHVhdGlvbiBSZXN1bHRcblxuQmFzZWQgb24gZXZhbHVhdGlvbiBzdGF0dXM6XG5cbioqUFJPRFVDVElPTl9SRUFEWToqKlxuLSBQcm9jZWVkIHRvIFN0ZXAgMTBcblxuKipDT05USU5VRToqKlxuMS4gUmV2aWV3IHJlY29tbWVuZGF0aW9uc1xuMi4gRGlzcGF0Y2ggZml4L2ltcHJvdmVtZW50IHRhc2tzIHRvIHN1YmFnZW50c1xuMy4gUmUtcnVuIHZhbGlkYXRpb24gKHR5cGVjaGVjaywgdGVzdCwgbGludClcbjQuIENvbW1pdCBjaGFuZ2VzOlxuICAgXFxgXFxgXFxgYmFzaFxuICAgZ2l0IGFkZCAtQVxuICAgZ2l0IGNvbW1pdCAtbSBcImZpeDogYWRkcmVzcyBldmFsdWF0aW9uIGZlZWRiYWNrXG5cbiAgIFByb2plY3Q6IFtQUk9KRUNUX05BTUVdXG4gICBDeWNsZTogW05dXCJcbiAgIFxcYFxcYFxcYFxuNS4gUmUtcnVuIFN0ZXAgOSAoRXZhbHVhdGUgUXVhbGl0eSlcbjYuIElmIGV2YWx1YXRpb24gY3ljbGVzIGV4Y2VlZCAyLCBwcm9jZWVkIHRvIFN0ZXAgMTAgd2l0aCBjdXJyZW50IHN0YXRlXG5cbk5vdGU6IFN1YnNlcXVlbnQgY3ljbGVzIHNraXAgU3RlcHMgNy04IChSZWZhY3RvciBhbmQgUG9zdC1SZWZhY3RvciBWYWxpZGF0aW9uKSBzaW5jZSByZWZhY3RvcmluZyBhbHJlYWR5IG9jY3VycmVkLlxuXG4qKkJMT0NLRUQ6KipcbjEuIFJlcG9ydCBmdW5kYW1lbnRhbCBpc3N1ZXMgdG8gdXNlclxuMi4gS2VlcCB0aGUgcHJvamVjdCBpbiBcXGBwcm9qZWN0cy9hY3RpdmUvXFxgXG4zLiAqKlNUT1AqKlxuXG4jIyBTdGVwIDEwOiBSZXBvcnQgUmVzdWx0c1xuXG5SZXBvcnQgaW1wbGVtZW50YXRpb24gc3RhdHVzIHRvIHVzZXI6XG5cblxcYFxcYFxcYFxuIyMgSW1wbGVtZW50YXRpb24gQ29tcGxldGVcblxuUGxhbjogXFxgW1BST0pFQ1RfRElSXS9wbGFuLm1kXFxgXG5TdGF0dXM6IFtTVEFUVVNdXG5cbiMjIyBRdWFsaXR5IEFzc2Vzc21lbnRcbi0gVHlwZSBDaGVjazogW1BBU1MvRkFJTF1cbi0gVGVzdHM6IFtQQVNTL0ZBSUxdXG4tIExpbnQ6IFtQQVNTL0ZBSUxdXG5cbiMjIyBUYXNrcyBDb21wbGV0ZWRcbltOXS9bTl0gdGFza3NcblxuW0lmIGlzc3VlczogbGlzdCB3aXRoIGZpbGU6bGluZSByZWZlcmVuY2VzXVxuXFxgXFxgXFxgXG5cbiMjIFN0ZXAgMTE6IEZpbmFsIENvbW1pdCBhbmQgTW92ZSBQcm9qZWN0XG5cbkNvbW1pdCBhbnkgcmVtYWluaW5nIHVuY29tbWl0dGVkIGNoYW5nZXM6XG5cblxcYFxcYFxcYGJhc2hcbmdpdCBhZGQgLUFcbmdpdCBkaWZmIC0tY2FjaGVkIC0tcXVpZXQgfHwgZ2l0IGNvbW1pdCAtbSBcImZlYXQ6IGltcGxlbWVudCBbUFJPSkVDVF9OQU1FXVxuXG5bQlJJRUZfU1VNTUFSWV9PRl9JTVBMRU1FTlRBVElPTl1cIlxuXFxgXFxgXFxgXG5cbioqT25seSBpZiBzdGF0dXMgaXMgUFJPRFVDVElPTl9SRUFEWSoqLCBtb3ZlIHRoZSBwcm9qZWN0OlxuXG5cXGBcXGBcXGBiYXNoXG5tdiBwcm9qZWN0cy9hY3RpdmUvW1BST0pFQ1RfTkFNRV0gcHJvamVjdHMvcmVhZHktZm9yLXJldmlldy9cblxcYFxcYFxcYFxuXG5SZXBvcnQ6XG5cblxcYFxcYFxcYFxuIyMgUHJvamVjdCBSZWFkeSBmb3IgUmV2aWV3XG5cblBsYW46IFxcYHByb2plY3RzL3JlYWR5LWZvci1yZXZpZXcvW1BST0pFQ1RfTkFNRV0vcGxhbi5tZFxcYFxuXG5BbGwgdGFza3MgY29tcGxldGVkIGFuZCB2YWxpZGF0ZWQgc3VjY2Vzc2Z1bGx5LlxuXFxgXFxgXFxgXG5cbioqSWYgc3RhdHVzIGlzIG5vdCBQUk9EVUNUSU9OX1JFQURZKiogKGUuZy4sIGV2YWx1YXRpb24gY3ljbGVzIGV4Y2VlZGVkKSwga2VlcCBwcm9qZWN0IGluIFxcYHByb2plY3RzL2FjdGl2ZS9cXGAgYW5kIGluZm9ybSB1c2VyIHRoYXQgbWFudWFsIHJldmlldyBpcyBuZWVkZWQuXG5cbiMjIyBDaGVja3BvaW50IENsZWFudXAgKE9wdGlvbmFsKVxuXG5BZnRlciBzdWNjZXNzZnVsIGNvbXBsZXRpb24sIGNoZWNrcG9pbnRzIGNhbiBiZSBjbGVhbmVkIHVwOlxuXG5cXGBcXGBcXGBiYXNoXG5naXQgdGFnIC1kIGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9iYXNlbGluZSBcXFxcXG4gICAgICAgICBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vcHJlLWltcGxlbWVudGF0aW9uIFxcXFxcbiAgICAgICAgIGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9wb3N0LWltcGxlbWVudGF0aW9uIFxcXFxcbiAgICAgICAgIGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9wcmUtcmVmYWN0b3IgMj4vZGV2L251bGxcblxcYFxcYFxcYFxuXG4jIyMgQXZhaWxhYmxlIENoZWNrcG9pbnRzXG5cblRoZSBmb2xsb3dpbmcgY2hlY2twb2ludHMgYXJlIGNyZWF0ZWQgZHVyaW5nIGV4ZWN1dGlvbiBmb3Igcm9sbGJhY2s6XG5cbnwgVGFnIHwgQ3JlYXRlZCBBdCB8IFB1cnBvc2UgfFxufC0tLS0tfC0tLS0tLS0tLS0tLXwtLS0tLS0tLS18XG58IFxcYGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9iYXNlbGluZVxcYCB8IFN0ZXAgMiB8IE9yaWdpbmFsIHN0YXRlIGJlZm9yZSBhbnkgY2hhbmdlcyB8XG58IFxcYGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9wcmUtaW1wbGVtZW50YXRpb25cXGAgfCBTdGVwIDUgfCBCZWZvcmUgdGFzayBkaXNwYXRjaCB8XG58IFxcYGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9wb3N0LWltcGxlbWVudGF0aW9uXFxgIHwgU3RlcCA2IHwgQWZ0ZXIgaW1wbGVtZW50YXRpb24sIGJlZm9yZSB2YWxpZGF0aW9uIHxcbnwgXFxgaW1wbGVtZW50L1tQUk9KRUNUX05BTUVdL3ByZS1yZWZhY3RvclxcYCB8IFN0ZXAgNyB8IEFmdGVyIHZhbGlkYXRpb24gcGFzc2VzLCBiZWZvcmUgcmVmYWN0b3JpbmcgfFxuXG4qKk5vdGU6KiogUmV2ZXJ0cyBhcmUgc2NvcGVkIHRvIFtQTEFOX0ZJTEVTXSBvbmx5XHUyMDE0ZmlsZXMgb3V0c2lkZSB0aGUgcGxhbidzIHNjb3BlIGFyZSBuZXZlciBtb2RpZmllZCBvciBkaXNjYXJkZWQgd2l0aG91dCBleHBsaWNpdCB1c2VyIGNvbnNlbnQuXG5gO1xuIiwgIi8qKlxuICogUHJlLUNvbXBhY3QgaG9vayB0aGF0IGVuYWJsZXMgaW1wbGVtZW50LXBsYW4gcmVsb2FkIGJlZm9yZSBjb21wYWN0aW9uIG9jY3Vycy5cbiAqXG4gKiBCZWZvcmUgY29udGV4dCBjb21wYWN0aW9uLCB0aGlzIGhvb2sgY2hlY2tzIGlmIGFuIGFjdGl2ZSBwcm9qZWN0IGV4aXN0cyBieVxuICogbG9va2luZyBmb3IgYSBwbGFuLm1kIGZpbGUgaW4gYW4gYWN0aXZlIHByb2plY3QgZGlyZWN0b3J5LiBJZiBmb3VuZCwgaXQgc2V0c1xuICogYW4gZW5hYmxlbWVudCBmbGFnIHRoYXQgdHJpZ2dlcnMgdGhlIGltcGxlbWVudC1wbGFuLXJlbG9hZGVyIGhvb2sgdG8gcmVzdG9yZVxuICogaW5zdHJ1Y3Rpb25zIGFmdGVyIGNvbXBhY3Rpb24gY29tcGxldGVzLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNwcmVjb21wYWN0XG4gKi9cblxuaW1wb3J0IHsgcHJlQ29tcGFjdEhvb2ssIHByZUNvbXBhY3RPdXRwdXQgfSBmcm9tIFwiQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzXCI7XG5pbXBvcnQgeyBzeW5jIGFzIGdsb2JTeW5jIH0gZnJvbSBcImdsb2JcIjtcbmltcG9ydCB7IGVuYWJsZUltcGxlbWVudFBsYW5SZWxvYWQgfSBmcm9tIFwiLi9pbXBsZW1lbnQtcGxhbi1yZWxvYWRlci5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBwcmVDb21wYWN0SG9vayh7fSwgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gIC8vIENoZWNrIGZvciBhY3RpdmUgcHJvamVjdHNcbiAgY29uc3QgYWN0aXZlUHJvamVjdHMgPSBnbG9iU3luYyhcInByb2plY3RzL2FjdGl2ZS8qL3BsYW4ubWRcIiwgeyBjd2Q6IGlucHV0LmN3ZCB9KTtcblxuICBpZiAoYWN0aXZlUHJvamVjdHMubGVuZ3RoID09PSAwKSB7XG4gICAgbG9nZ2VyLmRlYnVnKFwiTm8gYWN0aXZlIHByb2plY3QgZm91bmQsIHNraXBwaW5nIGltcGxlbWVudC1wbGFuIHJlbG9hZCBlbmFibGVtZW50XCIpO1xuICAgIHJldHVybiBwcmVDb21wYWN0T3V0cHV0KHt9KTtcbiAgfVxuXG4gIGVuYWJsZUltcGxlbWVudFBsYW5SZWxvYWQoaW5wdXQuc2Vzc2lvbl9pZCk7XG4gIGxvZ2dlci5pbmZvKFwiRW5hYmxlZCBpbXBsZW1lbnQtcGxhbiByZWxvYWQgZm9yIHBvc3QtY29tcGFjdGlvblwiLCB7XG4gICAgc2Vzc2lvbklkOiBpbnB1dC5zZXNzaW9uX2lkLFxuICAgIGFjdGl2ZVByb2plY3RzLFxuICB9KTtcblxuICByZXR1cm4gcHJlQ29tcGFjdE91dHB1dCh7fSk7XG59KTtcbiIsICJcbmltcG9ydCBob29rIGZyb20gJy93b3Jrc3BhY2UvcGFja2FnZXMvZ29vZGZvb3QtaG9va3Mvc3JjL2ltcGxlbWVudC1wbGFuLXByZS1jb21wYWN0LnRzJztcbmltcG9ydCB7IGV4ZWN1dGUgfSBmcm9tICcvd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvcnVudGltZS5qcyc7XG5cbmV4ZWN1dGUoaG9vayk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBa0NBLFlBQVksUUFBUTtBQU1iLElBQU0sa0JBQWtCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUszQixhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTWIsVUFBVTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLVixRQUFRO0FBQ1o7QUFrQ08sU0FBUyxpQkFBaUI7QUFDN0IsU0FBTyxRQUFRLElBQUksZ0JBQWdCLFFBQVE7QUFDL0M7QUE4Q08sU0FBUyxjQUFjLE1BQU0sT0FBTztBQUN2QyxRQUFNLFVBQVUsZUFBZTtBQUMvQixNQUFJLFlBQVksUUFBVztBQUN2QixVQUFNLElBQUksTUFBTSx3R0FBNkc7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QUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTs7O0FEV3BDLFNBQVMsK0JBQStCLFdBQTJCO0FBQ3hFLFNBQU8scUNBQXFDLFNBQVM7QUFDdkQ7QUFFQSxJQUFPLGtDQUFRLGlCQUFpQixFQUFFLFNBQVMsVUFBVSxHQUFHLENBQUMsT0FBTyxFQUFFLFFBQUFDLFFBQU8sTUFBTTtBQUM3RSxRQUFNLGlCQUFpQiwrQkFBK0IsTUFBTSxVQUFVO0FBR3RFLE1BQUksQ0FBQ0MsWUFBVyxjQUFjLEdBQUc7QUFDL0IsSUFBQUQsUUFBTyxNQUFNLG9EQUFvRDtBQUNqRSxXQUFPLG1CQUFtQixDQUFDLENBQUM7QUFBQSxFQUM5QjtBQUdBLE1BQUk7QUFDRixlQUFXLGNBQWM7QUFBQSxFQUMzQixRQUFRO0FBQUEsRUFFUjtBQUVBLEVBQUFBLFFBQU8sS0FBSyx3REFBd0Q7QUFFcEUsU0FBTyxtQkFBbUI7QUFBQSxJQUN4QixlQUFlO0FBQUEsSUFDZixvQkFBb0I7QUFBQSxNQUNsQixtQkFBbUI7QUFBQSxJQUNyQjtBQUFBLEVBQ0YsQ0FBQztBQUNILENBQUM7QUFNTSxTQUFTLDBCQUEwQixXQUF5QjtBQUNqRSxRQUFNLGlCQUFpQiwrQkFBK0IsU0FBUztBQUMvRCxnQkFBYyxnQkFBZ0IsS0FBSyxPQUFPO0FBQzVDOzs7QUV6Q0EsSUFBTyxxQ0FBUSxlQUFlLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxRQUFBRSxRQUFPLE1BQU07QUFFdkQsUUFBTSxpQkFBaUIsS0FBUyw2QkFBNkIsRUFBRSxLQUFLLE1BQU0sSUFBSSxDQUFDO0FBRS9FLE1BQUksZUFBZSxXQUFXLEdBQUc7QUFDL0IsSUFBQUEsUUFBTyxNQUFNLG9FQUFvRTtBQUNqRixXQUFPLGlCQUFpQixDQUFDLENBQUM7QUFBQSxFQUM1QjtBQUVBLDRCQUEwQixNQUFNLFVBQVU7QUFDMUMsRUFBQUEsUUFBTyxLQUFLLHFEQUFxRDtBQUFBLElBQy9ELFdBQVcsTUFBTTtBQUFBLElBQ2pCO0FBQUEsRUFDRixDQUFDO0FBRUQsU0FBTyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzVCLENBQUM7OztBQzNCRCxRQUFRLGtDQUFJOyIsCiAgIm5hbWVzIjogWyJnbG9iIiwgImkiLCAiYWNjIiwgImV4dCIsICJnbG9iIiwgImhhc01hZ2ljIiwgInN0YXJ0IiwgImZpbmFsIiwgImV4dCIsICJxbWFyayIsICJzdGFyIiwgInJlZ0V4cEVzY2FwZSIsICJmaWxlVVJMVG9QYXRoIiwgInYiLCAiYmYiLCAicCIsICJyZXQiLCAicmVzIiwgInBhdGgiLCAicCIsICJzZXAiLCAiZnMiLCAiZmlsdGVyIiwgInByb2Nlc3MiLCAic3luYyIsICJkZWZhdWx0UGxhdGZvcm0iLCAicGF0aCIsICJyZXN0IiwgInBhdGgiLCAiYWJzIiwgInRhcmdldCIsICJkZWZhdWx0UGxhdGZvcm0iLCAiZmlsZVVSTFRvUGF0aCIsICJleGlzdHNTeW5jIiwgImxvZ2dlciIsICJleGlzdHNTeW5jIiwgImxvZ2dlciJdCn0K
