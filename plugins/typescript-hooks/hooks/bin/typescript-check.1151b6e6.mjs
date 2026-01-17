#!/usr/bin/env -S node --enable-source-maps
// src/typescript-check.ts
import { execSync } from "node:child_process";
import fs2 from "node:fs";
import path from "node:path";

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

// ../claude-code-hooks/dist/tool-helpers.js
function getFilePath(input) {
  const toolInput = input.tool_input;
  if (toolInput && typeof toolInput === "object" && "file_path" in toolInput) {
    const filePath = toolInput.file_path;
    return typeof filePath === "string" ? filePath : null;
  }
  return null;
}
function isTsFile(filePath) {
  return /\.[cm]?tsx?$/.test(filePath);
}

// src/typescript-check.ts
function getFileLines(filePath) {
  try {
    const content = fs2.readFileSync(filePath, "utf8");
    return content.split("\n");
  } catch {
    return [];
  }
}
function getContextLines(lines, lineNum, contextSize = 1) {
  const line = lineNum;
  const start = Math.max(0, line - contextSize - 1);
  const end = Math.min(lines.length, line + contextSize);
  const context = [];
  for (let i = start; i < end; i++) {
    context.push({
      line: i + 1,
      content: lines[i],
      current: i === line - 1
    });
  }
  return context;
}
function findPackageJson(filePath) {
  let dir = path.dirname(filePath);
  while (dir !== "/") {
    const packagePath = path.join(dir, "package.json");
    if (fs2.existsSync(packagePath)) {
      return packagePath;
    }
    dir = path.dirname(dir);
  }
  return null;
}
function getPackageDirectory(filePath) {
  const packageJsonPath = findPackageJson(filePath);
  return packageJsonPath ? path.dirname(packageJsonPath) : null;
}
function parseAllTypeScriptErrors(output, packageDir) {
  const errors = [];
  const signatures = /* @__PURE__ */ new Map();
  const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, "");
  const lines = cleanOutput.split("\n");
  for (const line of lines) {
    const match = line.match(/^(.+?)(?:\(|:)(\d+)(?:,|:)(\d+)\)?\s*[-:]?\s*error\s+(TS\d+):\s*(.+)$/);
    if (match) {
      const [, filePath, lineNum, colNum, code, message] = match;
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(packageDir, filePath);
      const fileLines = getFileLines(absolutePath);
      errors.push({
        type: "typescript",
        file: absolutePath,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
        code,
        message: message.trim(),
        context: getContextLines(fileLines, parseInt(lineNum, 10))
      });
    }
  }
  return { errors, signatures };
}
function parseESLintErrors(output, filePath) {
  const errors = [];
  const lines = output.split("\n");
  const fileLines = getFileLines(filePath);
  let inFileSection = false;
  for (const line of lines) {
    if (line.trim() === filePath) {
      inFileSection = true;
      continue;
    }
    if (!line.trim() || line.includes("problem") || line.includes("warning")) {
      inFileSection = false;
      continue;
    }
    if (inFileSection) {
      const match = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s\s+(.+)$/);
      if (match) {
        const [, lineNum, colNum, severity, message, rule] = match;
        errors.push({
          type: "eslint",
          file: filePath,
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          severity,
          message: message.trim(),
          rule: rule.trim(),
          context: getContextLines(fileLines, parseInt(lineNum, 10))
        });
      }
    }
  }
  return errors;
}
function findDependentFiles(filePath, packageDir) {
  try {
    const fileName = path.basename(filePath, path.extname(filePath));
    const relativePath = path.relative(packageDir, filePath);
    const patterns = [
      `from.*${fileName}`,
      `from.*${relativePath.replace(/\.[tj]sx?$/, "")}`,
      `import.*from.*${fileName}`,
      `require.*${fileName}`
    ];
    const dependentFiles = /* @__PURE__ */ new Set();
    for (const pattern of patterns) {
      try {
        const cmd = `/usr/bin/rg -l "${pattern}" --type-add 'tsx:*.tsx' --type-add 'jsx:*.jsx' --type ts --type tsx --type js --type jsx "${packageDir}" 2>/dev/null | head -10`;
        const result = execSync(cmd, {
          cwd: packageDir,
          stdio: "pipe",
          encoding: "utf8",
          shell: "/bin/bash",
          env: process.env
        });
        const files = result.split("\n").filter((f) => f.trim() && f !== filePath);
        files.forEach((f) => dependentFiles.add(f));
      } catch {
      }
    }
    return Array.from(dependentFiles).slice(0, 5);
  } catch {
    return [];
  }
}
function runProjectTypeCheck(packageDir) {
  try {
    const tsconfigPath = path.join(packageDir, "tsconfig.json");
    if (!fs2.existsSync(tsconfigPath)) {
      return { success: true, errors: [], signatures: /* @__PURE__ */ new Map() };
    }
    const tscCommand = "npx tsc --project tsconfig.json --noEmit --incremental --tsBuildInfoFile ./build/.tsbuildinfo-hook --pretty";
    execSync(tscCommand, {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_PATH: path.join(packageDir, "node_modules")
      }
    });
    return { success: true, errors: [], signatures: /* @__PURE__ */ new Map() };
  } catch (error) {
    const errorOutput = error.stdout || error.stderr || "";
    const { errors, signatures } = parseAllTypeScriptErrors(errorOutput, packageDir);
    return { success: false, errors, signatures };
  }
}
function runESLint(filePath, packageDir) {
  const relativePath = path.relative(packageDir, filePath);
  try {
    execSync(`yarn eslint:files "${relativePath}" --cache --cache-location ./build/.eslintcache`, {
      cwd: packageDir,
      stdio: "pipe",
      encoding: "utf8"
    });
    return { success: true, errors: [] };
  } catch (lintError) {
    let errorOutput = "";
    const err = lintError;
    if (err.stdout) {
      errorOutput = typeof err.stdout === "string" ? err.stdout : err.stdout.toString("utf8");
    } else if (err.output && Array.isArray(err.output)) {
      const out = err.output[1] || err.output[2];
      errorOutput = out ? typeof out === "string" ? out : out.toString("utf8") : "";
    } else if (err.stderr) {
      errorOutput = typeof err.stderr === "string" ? err.stderr : err.stderr.toString("utf8");
    }
    const errors = parseESLintErrors(errorOutput, filePath);
    return { success: false, errors };
  }
}
function filterDependentFileErrors(allErrors, dependentFiles, _editedFile) {
  const depFileSet = new Set(dependentFiles);
  return allErrors.filter((error) => {
    if (depFileSet.has(error.file)) {
      return error.code === "TS2305" || // Module has no exported member
      error.code === "TS2339" || // Property does not exist
      error.code === "TS2345" || // Argument type mismatch
      error.code === "TS2322" || // Type assignment error
      error.code === "TS2554" || // Expected arguments error
      error.code === "TS2741" || // Missing properties
      error.message.toLowerCase().includes("import") || error.message.toLowerCase().includes("export");
    }
    return false;
  });
}
function formatErrorsAsYAML(directErrors, externalErrors, signatures) {
  let yaml = "";
  if (directErrors.length > 0) {
    yaml += "errors:\n";
    for (const error of directErrors) {
      yaml += `  - type: ${error.type}
`;
      yaml += `    file: ${error.file}
`;
      yaml += `    line: ${error.line}
`;
      yaml += `    column: ${error.column}
`;
      if ("code" in error && error.code) {
        yaml += `    code: ${error.code}
`;
      }
      if ("severity" in error && error.severity) {
        yaml += `    severity: ${error.severity}
`;
      }
      if ("rule" in error && error.rule) {
        yaml += `    rule: ${error.rule}
`;
      }
      yaml += `    message: "${error.message.replace(/"/g, '\\"')}"
`;
      if ("usageRef" in error && error.usageRef) {
        yaml += `    usage_ref: ${error.usageRef}
`;
      }
      yaml += "    context:\n";
      for (const ctx of error.context) {
        const marker = ctx.current ? ">" : " ";
        yaml += `      ${marker} ${ctx.line}: "${ctx.content.replace(/"/g, '\\"')}"
`;
      }
    }
  }
  if (externalErrors.length > 0) {
    yaml += "\nexternal:\n";
    const errorsByFile = {};
    for (const error of externalErrors) {
      if (!errorsByFile[error.file]) {
        errorsByFile[error.file] = [];
      }
      errorsByFile[error.file].push(error);
    }
    for (const [file, fileErrors] of Object.entries(errorsByFile)) {
      yaml += `  "${file}":
`;
      for (const error of fileErrors) {
        yaml += `    - type: ${error.type}
`;
        yaml += `      line: ${error.line}
`;
        yaml += `      column: ${error.column}
`;
        if (error.code) {
          yaml += `      code: ${error.code}
`;
        }
        yaml += `      message: "${error.message.replace(/"/g, '\\"')}"
`;
        if (error.context && error.context.length > 0) {
          const currentLine = error.context.find((c) => c.current);
          if (currentLine) {
            yaml += `      source: "${currentLine.content.replace(/"/g, '\\"')}"
`;
          }
        }
      }
    }
  }
  if (signatures && signatures.size > 0) {
    yaml += "\nusage:\n";
    for (const [key, info] of signatures) {
      yaml += `  "${key}":
`;
      yaml += `    signature: "${info.signature.replace(/"/g, '\\"')}"
`;
      yaml += `    type: ${info.type}
`;
    }
  }
  return yaml;
}
var typescript_check_default = postToolUseHook({ matcher: "Write|Edit|MultiEdit", timeout: 6e4 }, (input, { logger: logger2 }) => {
  const filePath = getFilePath(input);
  if (!filePath) {
    logger2.debug("No file path found in input");
    return postToolUseOutput({});
  }
  if (!isTsFile(filePath)) {
    logger2.debug("Skipping non-TypeScript file", { filePath });
    return postToolUseOutput({});
  }
  if (!fs2.existsSync(filePath)) {
    logger2.warn("File not found", { filePath });
    return postToolUseOutput({});
  }
  logger2.info("Checking TypeScript file", { filePath });
  const packageDir = getPackageDirectory(filePath);
  if (!packageDir) {
    logger2.warn("Could not find package.json for file", { filePath });
    return postToolUseOutput({
      hookSpecificOutput: {
        additionalContext: `Could not find package.json for file: ${filePath}`
      }
    });
  }
  logger2.debug("Package directory", { packageDir });
  const typeCheckResult = runProjectTypeCheck(packageDir);
  const eslintResult = runESLint(filePath, packageDir);
  const dependentFiles = findDependentFiles(filePath, packageDir);
  const directTsErrors = typeCheckResult.errors.filter((e) => e.file === filePath);
  const directErrors = [...directTsErrors, ...eslintResult.errors];
  const externalErrors = filterDependentFileErrors(typeCheckResult.errors, dependentFiles, filePath);
  if (directErrors.length > 0 || externalErrors.length > 0) {
    const yamlOutput = formatErrorsAsYAML(directErrors, externalErrors, typeCheckResult.signatures);
    const errorSummary = `Found ${directErrors.length} direct error(s)${externalErrors.length > 0 ? ` and ${externalErrors.length} error(s) in dependent files` : ""}`;
    const systemMessage = `TypeScript check: ${errorSummary}. Review the error details and fix type issues before proceeding.`;
    logger2.info("Validation errors found", {
      directCount: directErrors.length,
      externalCount: externalErrors.length
    });
    return postToolUseOutput({
      systemMessage,
      hookSpecificOutput: {
        additionalContext: yamlOutput
      }
    });
  }
  logger2.debug("No validation errors");
  return postToolUseOutput({});
});

// ../../../tmp/claude-code-hooks-build/352d0da0f914e11a/wrapper.ts
execute(typescript_check_default);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL3R5cGVzY3JpcHQtaG9va3Mvc3JjL3R5cGVzY3JpcHQtY2hlY2sudHMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3Qvb3V0cHV0cy5qcyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvY2xhdWRlLWNvZGUtaG9va3MvZGlzdC9sb2dnZXIuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvaG9va3MuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvZW52LmpzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9wYWNrYWdlcy9jbGF1ZGUtY29kZS1ob29rcy9kaXN0L3J1bnRpbWUuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvdG9vbC1oZWxwZXJzLmpzIiwgIndyYXBwZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogUG9zdFRvb2xVc2UgaG9vazogVHlwZVNjcmlwdCBhbmQgRVNMaW50IHZhbGlkYXRpb24uXG4gKlxuICogUnVucyBUeXBlU2NyaXB0IHR5cGUgY2hlY2tpbmcgYW5kIEVTTGludCBhZnRlciBXcml0ZS9FZGl0L011bHRpRWRpdCBvcGVyYXRpb25zXG4gKiBvbiBUeXBlU2NyaXB0IGZpbGVzLiBSZXBvcnRzIGVycm9ycyB3aXRoIGRldGFpbGVkIGNvbnRleHQgaW5jbHVkaW5nIGxpbmUgbnVtYmVyc1xuICogYW5kIGNvZGUgc25pcHBldHMuXG4gKlxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3Bvc3R0b29sdXNlXG4gKi9cblxuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcblxuaW1wb3J0IHsgcG9zdFRvb2xVc2VIb29rLCBwb3N0VG9vbFVzZU91dHB1dCwgZ2V0RmlsZVBhdGgsIGlzVHNGaWxlIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gVHlwZXNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuaW50ZXJmYWNlIFR5cGVTY3JpcHRFcnJvciB7XG4gIHR5cGU6ICd0eXBlc2NyaXB0JztcbiAgZmlsZTogc3RyaW5nO1xuICBsaW5lOiBudW1iZXI7XG4gIGNvbHVtbjogbnVtYmVyO1xuICBjb2RlOiBzdHJpbmc7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgY29udGV4dDogQ29udGV4dExpbmVbXTtcbiAgdXNhZ2VSZWY/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBFU0xpbnRFcnJvciB7XG4gIHR5cGU6ICdlc2xpbnQnO1xuICBmaWxlOiBzdHJpbmc7XG4gIGxpbmU6IG51bWJlcjtcbiAgY29sdW1uOiBudW1iZXI7XG4gIHNldmVyaXR5OiBzdHJpbmc7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgcnVsZTogc3RyaW5nO1xuICBjb250ZXh0OiBDb250ZXh0TGluZVtdO1xufVxuXG5pbnRlcmZhY2UgQ29udGV4dExpbmUge1xuICBsaW5lOiBudW1iZXI7XG4gIGNvbnRlbnQ6IHN0cmluZztcbiAgY3VycmVudDogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIFNpZ25hdHVyZUluZm8ge1xuICBzaWduYXR1cmU6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xufVxuXG50eXBlIFBhcnNlZEVycm9yID0gVHlwZVNjcmlwdEVycm9yIHwgRVNMaW50RXJyb3I7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEZpbGUgVXRpbGl0aWVzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGdldEZpbGVMaW5lcyhmaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nW10ge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGY4Jyk7XG4gICAgcmV0dXJuIGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q29udGV4dExpbmVzKGxpbmVzOiBzdHJpbmdbXSwgbGluZU51bTogbnVtYmVyLCBjb250ZXh0U2l6ZSA9IDEpOiBDb250ZXh0TGluZVtdIHtcbiAgY29uc3QgbGluZSA9IGxpbmVOdW07XG4gIGNvbnN0IHN0YXJ0ID0gTWF0aC5tYXgoMCwgbGluZSAtIGNvbnRleHRTaXplIC0gMSk7XG4gIGNvbnN0IGVuZCA9IE1hdGgubWluKGxpbmVzLmxlbmd0aCwgbGluZSArIGNvbnRleHRTaXplKTtcblxuICBjb25zdCBjb250ZXh0OiBDb250ZXh0TGluZVtdID0gW107XG4gIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgY29udGV4dC5wdXNoKHtcbiAgICAgIGxpbmU6IGkgKyAxLFxuICAgICAgY29udGVudDogbGluZXNbaV0sXG4gICAgICBjdXJyZW50OiBpID09PSBsaW5lIC0gMVxuICAgIH0pO1xuICB9XG4gIHJldHVybiBjb250ZXh0O1xufVxuXG5mdW5jdGlvbiBmaW5kUGFja2FnZUpzb24oZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICBsZXQgZGlyID0gcGF0aC5kaXJuYW1lKGZpbGVQYXRoKTtcbiAgd2hpbGUgKGRpciAhPT0gJy8nKSB7XG4gICAgY29uc3QgcGFja2FnZVBhdGggPSBwYXRoLmpvaW4oZGlyLCAncGFja2FnZS5qc29uJyk7XG4gICAgaWYgKGZzLmV4aXN0c1N5bmMocGFja2FnZVBhdGgpKSB7XG4gICAgICByZXR1cm4gcGFja2FnZVBhdGg7XG4gICAgfVxuICAgIGRpciA9IHBhdGguZGlybmFtZShkaXIpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRQYWNrYWdlRGlyZWN0b3J5KGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgcGFja2FnZUpzb25QYXRoID0gZmluZFBhY2thZ2VKc29uKGZpbGVQYXRoKTtcbiAgcmV0dXJuIHBhY2thZ2VKc29uUGF0aCA/IHBhdGguZGlybmFtZShwYWNrYWdlSnNvblBhdGgpIDogbnVsbDtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gVHlwZVNjcmlwdCBFcnJvciBQYXJzaW5nXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIHBhcnNlQWxsVHlwZVNjcmlwdEVycm9ycyhcbiAgb3V0cHV0OiBzdHJpbmcsXG4gIHBhY2thZ2VEaXI6IHN0cmluZ1xuKTogeyBlcnJvcnM6IFR5cGVTY3JpcHRFcnJvcltdOyBzaWduYXR1cmVzOiBNYXA8c3RyaW5nLCBTaWduYXR1cmVJbmZvPiB9IHtcbiAgY29uc3QgZXJyb3JzOiBUeXBlU2NyaXB0RXJyb3JbXSA9IFtdO1xuICBjb25zdCBzaWduYXR1cmVzID0gbmV3IE1hcDxzdHJpbmcsIFNpZ25hdHVyZUluZm8+KCk7XG5cbiAgLy8gUmVtb3ZlIEFOU0kgY29sb3IgY29kZXMgZnJvbSB0aGUgb3V0cHV0XG4gIGNvbnN0IGNsZWFuT3V0cHV0ID0gb3V0cHV0LnJlcGxhY2UoL1xceDFiXFxbWzAtOTtdKm0vZywgJycpO1xuICBjb25zdCBsaW5lcyA9IGNsZWFuT3V0cHV0LnNwbGl0KCdcXG4nKTtcblxuICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAvLyBNYXRjaCBUeXBlU2NyaXB0IGVycm9yIGZvcm1hdCBmb3IgQU5ZIGZpbGVcbiAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL14oLis/KSg/OlxcKHw6KShcXGQrKSg/Oix8OikoXFxkKylcXCk/XFxzKlstOl0/XFxzKmVycm9yXFxzKyhUU1xcZCspOlxccyooLispJC8pO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgWywgZmlsZVBhdGgsIGxpbmVOdW0sIGNvbE51bSwgY29kZSwgbWVzc2FnZV0gPSBtYXRjaDtcblxuICAgICAgLy8gUmVzb2x2ZSB0byBhYnNvbHV0ZSBwYXRoXG4gICAgICBjb25zdCBhYnNvbHV0ZVBhdGggPSBwYXRoLmlzQWJzb2x1dGUoZmlsZVBhdGgpID8gZmlsZVBhdGggOiBwYXRoLnJlc29sdmUocGFja2FnZURpciwgZmlsZVBhdGgpO1xuXG4gICAgICBjb25zdCBmaWxlTGluZXMgPSBnZXRGaWxlTGluZXMoYWJzb2x1dGVQYXRoKTtcblxuICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICB0eXBlOiAndHlwZXNjcmlwdCcsXG4gICAgICAgIGZpbGU6IGFic29sdXRlUGF0aCxcbiAgICAgICAgbGluZTogcGFyc2VJbnQobGluZU51bSwgMTApLFxuICAgICAgICBjb2x1bW46IHBhcnNlSW50KGNvbE51bSwgMTApLFxuICAgICAgICBjb2RlOiBjb2RlLFxuICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLnRyaW0oKSxcbiAgICAgICAgY29udGV4dDogZ2V0Q29udGV4dExpbmVzKGZpbGVMaW5lcywgcGFyc2VJbnQobGluZU51bSwgMTApKVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgZXJyb3JzLCBzaWduYXR1cmVzIH07XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEVTTGludCBFcnJvciBQYXJzaW5nXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIHBhcnNlRVNMaW50RXJyb3JzKG91dHB1dDogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nKTogRVNMaW50RXJyb3JbXSB7XG4gIGNvbnN0IGVycm9yczogRVNMaW50RXJyb3JbXSA9IFtdO1xuICBjb25zdCBsaW5lcyA9IG91dHB1dC5zcGxpdCgnXFxuJyk7XG4gIGNvbnN0IGZpbGVMaW5lcyA9IGdldEZpbGVMaW5lcyhmaWxlUGF0aCk7XG5cbiAgbGV0IGluRmlsZVNlY3Rpb24gPSBmYWxzZTtcbiAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgLy8gQ2hlY2sgaWYgd2UncmUgaW4gdGhlIGZpbGUgc2VjdGlvblxuICAgIGlmIChsaW5lLnRyaW0oKSA9PT0gZmlsZVBhdGgpIHtcbiAgICAgIGluRmlsZVNlY3Rpb24gPSB0cnVlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gU2tpcCBlbXB0eSBsaW5lcyBhbmQgc3VtbWFyeSBsaW5lc1xuICAgIGlmICghbGluZS50cmltKCkgfHwgbGluZS5pbmNsdWRlcygncHJvYmxlbScpIHx8IGxpbmUuaW5jbHVkZXMoJ3dhcm5pbmcnKSkge1xuICAgICAgaW5GaWxlU2VjdGlvbiA9IGZhbHNlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGluRmlsZVNlY3Rpb24pIHtcbiAgICAgIC8vIE1hdGNoIEVTTGludCBlcnJvciBmb3JtYXQ6IGxpbmU6Y29sICBzZXZlcml0eSAgbWVzc2FnZSAgcnVsZVxuICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKihcXGQrKTooXFxkKylcXHMrKGVycm9yfHdhcm5pbmcpXFxzKyguKz8pXFxzXFxzKyguKykkLyk7XG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgY29uc3QgWywgbGluZU51bSwgY29sTnVtLCBzZXZlcml0eSwgbWVzc2FnZSwgcnVsZV0gPSBtYXRjaDtcbiAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgIHR5cGU6ICdlc2xpbnQnLFxuICAgICAgICAgIGZpbGU6IGZpbGVQYXRoLFxuICAgICAgICAgIGxpbmU6IHBhcnNlSW50KGxpbmVOdW0sIDEwKSxcbiAgICAgICAgICBjb2x1bW46IHBhcnNlSW50KGNvbE51bSwgMTApLFxuICAgICAgICAgIHNldmVyaXR5OiBzZXZlcml0eSxcbiAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLnRyaW0oKSxcbiAgICAgICAgICBydWxlOiBydWxlLnRyaW0oKSxcbiAgICAgICAgICBjb250ZXh0OiBnZXRDb250ZXh0TGluZXMoZmlsZUxpbmVzLCBwYXJzZUludChsaW5lTnVtLCAxMCkpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gZXJyb3JzO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBEZXBlbmRlbnQgRmlsZSBEaXNjb3Zlcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gZmluZERlcGVuZGVudEZpbGVzKGZpbGVQYXRoOiBzdHJpbmcsIHBhY2thZ2VEaXI6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZmlsZVBhdGgsIHBhdGguZXh0bmFtZShmaWxlUGF0aCkpO1xuICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHBhdGgucmVsYXRpdmUocGFja2FnZURpciwgZmlsZVBhdGgpO1xuXG4gICAgLy8gQ3JlYXRlIHBhdHRlcm5zIGZvciBkaWZmZXJlbnQgaW1wb3J0IHN0eWxlc1xuICAgIGNvbnN0IHBhdHRlcm5zID0gW1xuICAgICAgYGZyb20uKiR7ZmlsZU5hbWV9YCxcbiAgICAgIGBmcm9tLioke3JlbGF0aXZlUGF0aC5yZXBsYWNlKC9cXC5bdGpdc3g/JC8sICcnKX1gLFxuICAgICAgYGltcG9ydC4qZnJvbS4qJHtmaWxlTmFtZX1gLFxuICAgICAgYHJlcXVpcmUuKiR7ZmlsZU5hbWV9YFxuICAgIF07XG5cbiAgICBjb25zdCBkZXBlbmRlbnRGaWxlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHBhdHRlcm5zKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjbWQgPSBgL3Vzci9iaW4vcmcgLWwgXCIke3BhdHRlcm59XCIgLS10eXBlLWFkZCAndHN4OioudHN4JyAtLXR5cGUtYWRkICdqc3g6Ki5qc3gnIC0tdHlwZSB0cyAtLXR5cGUgdHN4IC0tdHlwZSBqcyAtLXR5cGUganN4IFwiJHtwYWNrYWdlRGlyfVwiIDI+L2Rldi9udWxsIHwgaGVhZCAtMTBgO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGV4ZWNTeW5jKGNtZCwge1xuICAgICAgICAgIGN3ZDogcGFja2FnZURpcixcbiAgICAgICAgICBzdGRpbzogJ3BpcGUnLFxuICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgc2hlbGw6ICcvYmluL2Jhc2gnLFxuICAgICAgICAgIGVudjogcHJvY2Vzcy5lbnZcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZmlsZXMgPSByZXN1bHQuc3BsaXQoJ1xcbicpLmZpbHRlcigoZikgPT4gZi50cmltKCkgJiYgZiAhPT0gZmlsZVBhdGgpO1xuICAgICAgICBmaWxlcy5mb3JFYWNoKChmKSA9PiBkZXBlbmRlbnRGaWxlcy5hZGQoZikpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIElnbm9yZSBlcnJvcnMgZnJvbSByaXBncmVwIChlLmcuLCBubyBtYXRjaGVzKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBBcnJheS5mcm9tKGRlcGVuZGVudEZpbGVzKS5zbGljZSgwLCA1KTsgLy8gTGltaXQgdG8gNSBmaWxlcyBmb3IgcGVyZm9ybWFuY2VcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFZhbGlkYXRpb24gQ29tbWFuZHNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gcnVuUHJvamVjdFR5cGVDaGVjayhwYWNrYWdlRGlyOiBzdHJpbmcpOiB7IHN1Y2Nlc3M6IGJvb2xlYW47IGVycm9yczogVHlwZVNjcmlwdEVycm9yW107IHNpZ25hdHVyZXM6IE1hcDxzdHJpbmcsIFNpZ25hdHVyZUluZm8+IH0ge1xuICB0cnkge1xuICAgIGNvbnN0IHRzY29uZmlnUGF0aCA9IHBhdGguam9pbihwYWNrYWdlRGlyLCAndHNjb25maWcuanNvbicpO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyh0c2NvbmZpZ1BhdGgpKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBlcnJvcnM6IFtdLCBzaWduYXR1cmVzOiBuZXcgTWFwKCkgfTtcbiAgICB9XG5cbiAgICBjb25zdCB0c2NDb21tYW5kID0gJ25weCB0c2MgLS1wcm9qZWN0IHRzY29uZmlnLmpzb24gLS1ub0VtaXQgLS1pbmNyZW1lbnRhbCAtLXRzQnVpbGRJbmZvRmlsZSAuL2J1aWxkLy50c2J1aWxkaW5mby1ob29rIC0tcHJldHR5JztcblxuICAgIGV4ZWNTeW5jKHRzY0NvbW1hbmQsIHtcbiAgICAgIGN3ZDogcGFja2FnZURpcixcbiAgICAgIHN0ZGlvOiAncGlwZScsXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgZW52OiB7XG4gICAgICAgIC4uLnByb2Nlc3MuZW52LFxuICAgICAgICBOT0RFX1BBVEg6IHBhdGguam9pbihwYWNrYWdlRGlyLCAnbm9kZV9tb2R1bGVzJylcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGVycm9yczogW10sIHNpZ25hdHVyZXM6IG5ldyBNYXAoKSB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnN0IGVycm9yT3V0cHV0ID0gKGVycm9yIGFzIHsgc3Rkb3V0Pzogc3RyaW5nOyBzdGRlcnI/OiBzdHJpbmcgfSkuc3Rkb3V0IHx8IChlcnJvciBhcyB7IHN0ZGVycj86IHN0cmluZyB9KS5zdGRlcnIgfHwgJyc7XG4gICAgY29uc3QgeyBlcnJvcnMsIHNpZ25hdHVyZXMgfSA9IHBhcnNlQWxsVHlwZVNjcmlwdEVycm9ycyhlcnJvck91dHB1dCwgcGFja2FnZURpcik7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9ycywgc2lnbmF0dXJlcyB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIHJ1bkVTTGludChmaWxlUGF0aDogc3RyaW5nLCBwYWNrYWdlRGlyOiBzdHJpbmcpOiB7IHN1Y2Nlc3M6IGJvb2xlYW47IGVycm9yczogRVNMaW50RXJyb3JbXSB9IHtcbiAgY29uc3QgcmVsYXRpdmVQYXRoID0gcGF0aC5yZWxhdGl2ZShwYWNrYWdlRGlyLCBmaWxlUGF0aCk7XG5cbiAgdHJ5IHtcbiAgICBleGVjU3luYyhgeWFybiBlc2xpbnQ6ZmlsZXMgXCIke3JlbGF0aXZlUGF0aH1cIiAtLWNhY2hlIC0tY2FjaGUtbG9jYXRpb24gLi9idWlsZC8uZXNsaW50Y2FjaGVgLCB7XG4gICAgICBjd2Q6IHBhY2thZ2VEaXIsXG4gICAgICBzdGRpbzogJ3BpcGUnLFxuICAgICAgZW5jb2Rpbmc6ICd1dGY4J1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZXJyb3JzOiBbXSB9O1xuICB9IGNhdGNoIChsaW50RXJyb3IpIHtcbiAgICBsZXQgZXJyb3JPdXRwdXQgPSAnJztcblxuICAgIGNvbnN0IGVyciA9IGxpbnRFcnJvciBhcyB7IHN0ZG91dD86IHN0cmluZyB8IEJ1ZmZlcjsgc3RkZXJyPzogc3RyaW5nIHwgQnVmZmVyOyBvdXRwdXQ/OiAoc3RyaW5nIHwgQnVmZmVyIHwgbnVsbClbXSB9O1xuICAgIGlmIChlcnIuc3Rkb3V0KSB7XG4gICAgICBlcnJvck91dHB1dCA9IHR5cGVvZiBlcnIuc3Rkb3V0ID09PSAnc3RyaW5nJyA/IGVyci5zdGRvdXQgOiBlcnIuc3Rkb3V0LnRvU3RyaW5nKCd1dGY4Jyk7XG4gICAgfSBlbHNlIGlmIChlcnIub3V0cHV0ICYmIEFycmF5LmlzQXJyYXkoZXJyLm91dHB1dCkpIHtcbiAgICAgIGNvbnN0IG91dCA9IGVyci5vdXRwdXRbMV0gfHwgZXJyLm91dHB1dFsyXTtcbiAgICAgIGVycm9yT3V0cHV0ID0gb3V0ID8gKHR5cGVvZiBvdXQgPT09ICdzdHJpbmcnID8gb3V0IDogb3V0LnRvU3RyaW5nKCd1dGY4JykpIDogJyc7XG4gICAgfSBlbHNlIGlmIChlcnIuc3RkZXJyKSB7XG4gICAgICBlcnJvck91dHB1dCA9IHR5cGVvZiBlcnIuc3RkZXJyID09PSAnc3RyaW5nJyA/IGVyci5zdGRlcnIgOiBlcnIuc3RkZXJyLnRvU3RyaW5nKCd1dGY4Jyk7XG4gICAgfVxuXG4gICAgY29uc3QgZXJyb3JzID0gcGFyc2VFU0xpbnRFcnJvcnMoZXJyb3JPdXRwdXQsIGZpbGVQYXRoKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcnMgfTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBFcnJvciBGaWx0ZXJpbmdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gZmlsdGVyRGVwZW5kZW50RmlsZUVycm9ycyhhbGxFcnJvcnM6IFR5cGVTY3JpcHRFcnJvcltdLCBkZXBlbmRlbnRGaWxlczogc3RyaW5nW10sIF9lZGl0ZWRGaWxlOiBzdHJpbmcpOiBUeXBlU2NyaXB0RXJyb3JbXSB7XG4gIGNvbnN0IGRlcEZpbGVTZXQgPSBuZXcgU2V0KGRlcGVuZGVudEZpbGVzKTtcblxuICByZXR1cm4gYWxsRXJyb3JzLmZpbHRlcigoZXJyb3IpID0+IHtcbiAgICBpZiAoZGVwRmlsZVNldC5oYXMoZXJyb3IuZmlsZSkpIHtcbiAgICAgIC8vIE9ubHkgaW5jbHVkZSBlcnJvcnMgbGlrZWx5IGNhdXNlZCBieSBjaGFuZ2VzIHRvIHRoZSBlZGl0ZWQgZmlsZVxuICAgICAgcmV0dXJuIChcbiAgICAgICAgZXJyb3IuY29kZSA9PT0gJ1RTMjMwNScgfHwgLy8gTW9kdWxlIGhhcyBubyBleHBvcnRlZCBtZW1iZXJcbiAgICAgICAgZXJyb3IuY29kZSA9PT0gJ1RTMjMzOScgfHwgLy8gUHJvcGVydHkgZG9lcyBub3QgZXhpc3RcbiAgICAgICAgZXJyb3IuY29kZSA9PT0gJ1RTMjM0NScgfHwgLy8gQXJndW1lbnQgdHlwZSBtaXNtYXRjaFxuICAgICAgICBlcnJvci5jb2RlID09PSAnVFMyMzIyJyB8fCAvLyBUeXBlIGFzc2lnbm1lbnQgZXJyb3JcbiAgICAgICAgZXJyb3IuY29kZSA9PT0gJ1RTMjU1NCcgfHwgLy8gRXhwZWN0ZWQgYXJndW1lbnRzIGVycm9yXG4gICAgICAgIGVycm9yLmNvZGUgPT09ICdUUzI3NDEnIHx8IC8vIE1pc3NpbmcgcHJvcGVydGllc1xuICAgICAgICBlcnJvci5tZXNzYWdlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2ltcG9ydCcpIHx8XG4gICAgICAgIGVycm9yLm1lc3NhZ2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnZXhwb3J0JylcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfSk7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIE91dHB1dCBGb3JtYXR0aW5nXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGZvcm1hdEVycm9yc0FzWUFNTChcbiAgZGlyZWN0RXJyb3JzOiBQYXJzZWRFcnJvcltdLFxuICBleHRlcm5hbEVycm9yczogVHlwZVNjcmlwdEVycm9yW10sXG4gIHNpZ25hdHVyZXM6IE1hcDxzdHJpbmcsIFNpZ25hdHVyZUluZm8+XG4pOiBzdHJpbmcge1xuICBsZXQgeWFtbCA9ICcnO1xuXG4gIC8vIERpcmVjdCBlcnJvcnMgaW4gdGhlIGVkaXRlZCBmaWxlXG4gIGlmIChkaXJlY3RFcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHlhbWwgKz0gJ2Vycm9yczpcXG4nO1xuXG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBkaXJlY3RFcnJvcnMpIHtcbiAgICAgIHlhbWwgKz0gYCAgLSB0eXBlOiAke2Vycm9yLnR5cGV9XFxuYDtcbiAgICAgIHlhbWwgKz0gYCAgICBmaWxlOiAke2Vycm9yLmZpbGV9XFxuYDtcbiAgICAgIHlhbWwgKz0gYCAgICBsaW5lOiAke2Vycm9yLmxpbmV9XFxuYDtcbiAgICAgIHlhbWwgKz0gYCAgICBjb2x1bW46ICR7ZXJyb3IuY29sdW1ufVxcbmA7XG5cbiAgICAgIGlmICgnY29kZScgaW4gZXJyb3IgJiYgZXJyb3IuY29kZSkge1xuICAgICAgICB5YW1sICs9IGAgICAgY29kZTogJHtlcnJvci5jb2RlfVxcbmA7XG4gICAgICB9XG4gICAgICBpZiAoJ3NldmVyaXR5JyBpbiBlcnJvciAmJiBlcnJvci5zZXZlcml0eSkge1xuICAgICAgICB5YW1sICs9IGAgICAgc2V2ZXJpdHk6ICR7ZXJyb3Iuc2V2ZXJpdHl9XFxuYDtcbiAgICAgIH1cbiAgICAgIGlmICgncnVsZScgaW4gZXJyb3IgJiYgZXJyb3IucnVsZSkge1xuICAgICAgICB5YW1sICs9IGAgICAgcnVsZTogJHtlcnJvci5ydWxlfVxcbmA7XG4gICAgICB9XG5cbiAgICAgIHlhbWwgKz0gYCAgICBtZXNzYWdlOiBcIiR7ZXJyb3IubWVzc2FnZS5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJyl9XCJcXG5gO1xuXG4gICAgICBpZiAoJ3VzYWdlUmVmJyBpbiBlcnJvciAmJiBlcnJvci51c2FnZVJlZikge1xuICAgICAgICB5YW1sICs9IGAgICAgdXNhZ2VfcmVmOiAke2Vycm9yLnVzYWdlUmVmfVxcbmA7XG4gICAgICB9XG5cbiAgICAgIHlhbWwgKz0gJyAgICBjb250ZXh0Olxcbic7XG5cbiAgICAgIGZvciAoY29uc3QgY3R4IG9mIGVycm9yLmNvbnRleHQpIHtcbiAgICAgICAgY29uc3QgbWFya2VyID0gY3R4LmN1cnJlbnQgPyAnPicgOiAnICc7XG4gICAgICAgIHlhbWwgKz0gYCAgICAgICR7bWFya2VyfSAke2N0eC5saW5lfTogXCIke2N0eC5jb250ZW50LnJlcGxhY2UoL1wiL2csICdcXFxcXCInKX1cIlxcbmA7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gRXh0ZXJuYWwgZXJyb3JzIGluIGRlcGVuZGVudCBmaWxlc1xuICBpZiAoZXh0ZXJuYWxFcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHlhbWwgKz0gJ1xcbmV4dGVybmFsOlxcbic7XG5cbiAgICAvLyBHcm91cCBlcnJvcnMgYnkgZmlsZVxuICAgIGNvbnN0IGVycm9yc0J5RmlsZTogUmVjb3JkPHN0cmluZywgVHlwZVNjcmlwdEVycm9yW10+ID0ge307XG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBleHRlcm5hbEVycm9ycykge1xuICAgICAgaWYgKCFlcnJvcnNCeUZpbGVbZXJyb3IuZmlsZV0pIHtcbiAgICAgICAgZXJyb3JzQnlGaWxlW2Vycm9yLmZpbGVdID0gW107XG4gICAgICB9XG4gICAgICBlcnJvcnNCeUZpbGVbZXJyb3IuZmlsZV0ucHVzaChlcnJvcik7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBbZmlsZSwgZmlsZUVycm9yc10gb2YgT2JqZWN0LmVudHJpZXMoZXJyb3JzQnlGaWxlKSkge1xuICAgICAgeWFtbCArPSBgICBcIiR7ZmlsZX1cIjpcXG5gO1xuXG4gICAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGZpbGVFcnJvcnMpIHtcbiAgICAgICAgeWFtbCArPSBgICAgIC0gdHlwZTogJHtlcnJvci50eXBlfVxcbmA7XG4gICAgICAgIHlhbWwgKz0gYCAgICAgIGxpbmU6ICR7ZXJyb3IubGluZX1cXG5gO1xuICAgICAgICB5YW1sICs9IGAgICAgICBjb2x1bW46ICR7ZXJyb3IuY29sdW1ufVxcbmA7XG5cbiAgICAgICAgaWYgKGVycm9yLmNvZGUpIHtcbiAgICAgICAgICB5YW1sICs9IGAgICAgICBjb2RlOiAke2Vycm9yLmNvZGV9XFxuYDtcbiAgICAgICAgfVxuXG4gICAgICAgIHlhbWwgKz0gYCAgICAgIG1lc3NhZ2U6IFwiJHtlcnJvci5tZXNzYWdlLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKX1cIlxcbmA7XG5cbiAgICAgICAgLy8gSW5jbHVkZSBtaW5pbWFsIGNvbnRleHQgZm9yIGV4dGVybmFsIGVycm9yc1xuICAgICAgICBpZiAoZXJyb3IuY29udGV4dCAmJiBlcnJvci5jb250ZXh0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCBjdXJyZW50TGluZSA9IGVycm9yLmNvbnRleHQuZmluZCgoYykgPT4gYy5jdXJyZW50KTtcbiAgICAgICAgICBpZiAoY3VycmVudExpbmUpIHtcbiAgICAgICAgICAgIHlhbWwgKz0gYCAgICAgIHNvdXJjZTogXCIke2N1cnJlbnRMaW5lLmNvbnRlbnQucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpfVwiXFxuYDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBBZGQgdXNhZ2Ugc2VjdGlvbiBpZiB3ZSBoYXZlIHNpZ25hdHVyZXNcbiAgaWYgKHNpZ25hdHVyZXMgJiYgc2lnbmF0dXJlcy5zaXplID4gMCkge1xuICAgIHlhbWwgKz0gJ1xcbnVzYWdlOlxcbic7XG4gICAgZm9yIChjb25zdCBba2V5LCBpbmZvXSBvZiBzaWduYXR1cmVzKSB7XG4gICAgICB5YW1sICs9IGAgIFwiJHtrZXl9XCI6XFxuYDtcbiAgICAgIHlhbWwgKz0gYCAgICBzaWduYXR1cmU6IFwiJHtpbmZvLnNpZ25hdHVyZS5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJyl9XCJcXG5gO1xuICAgICAgeWFtbCArPSBgICAgIHR5cGU6ICR7aW5mby50eXBlfVxcbmA7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHlhbWw7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIE1haW4gSG9va1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgZGVmYXVsdCBwb3N0VG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnV3JpdGV8RWRpdHxNdWx0aUVkaXQnLCB0aW1lb3V0OiA2MDAwMCB9LCAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAgY29uc3QgZmlsZVBhdGggPSBnZXRGaWxlUGF0aChpbnB1dCk7XG5cbiAgaWYgKCFmaWxlUGF0aCkge1xuICAgIGxvZ2dlci5kZWJ1ZygnTm8gZmlsZSBwYXRoIGZvdW5kIGluIGlucHV0Jyk7XG4gICAgcmV0dXJuIHBvc3RUb29sVXNlT3V0cHV0KHt9KTtcbiAgfVxuXG4gIGlmICghaXNUc0ZpbGUoZmlsZVBhdGgpKSB7XG4gICAgbG9nZ2VyLmRlYnVnKCdTa2lwcGluZyBub24tVHlwZVNjcmlwdCBmaWxlJywgeyBmaWxlUGF0aCB9KTtcbiAgICByZXR1cm4gcG9zdFRvb2xVc2VPdXRwdXQoe30pO1xuICB9XG5cbiAgaWYgKCFmcy5leGlzdHNTeW5jKGZpbGVQYXRoKSkge1xuICAgIGxvZ2dlci53YXJuKCdGaWxlIG5vdCBmb3VuZCcsIHsgZmlsZVBhdGggfSk7XG4gICAgcmV0dXJuIHBvc3RUb29sVXNlT3V0cHV0KHt9KTtcbiAgfVxuXG4gIGxvZ2dlci5pbmZvKCdDaGVja2luZyBUeXBlU2NyaXB0IGZpbGUnLCB7IGZpbGVQYXRoIH0pO1xuXG4gIGNvbnN0IHBhY2thZ2VEaXIgPSBnZXRQYWNrYWdlRGlyZWN0b3J5KGZpbGVQYXRoKTtcbiAgaWYgKCFwYWNrYWdlRGlyKSB7XG4gICAgbG9nZ2VyLndhcm4oJ0NvdWxkIG5vdCBmaW5kIHBhY2thZ2UuanNvbiBmb3IgZmlsZScsIHsgZmlsZVBhdGggfSk7XG4gICAgcmV0dXJuIHBvc3RUb29sVXNlT3V0cHV0KHtcbiAgICAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICAgICAgICBhZGRpdGlvbmFsQ29udGV4dDogYENvdWxkIG5vdCBmaW5kIHBhY2thZ2UuanNvbiBmb3IgZmlsZTogJHtmaWxlUGF0aH1gXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBsb2dnZXIuZGVidWcoJ1BhY2thZ2UgZGlyZWN0b3J5JywgeyBwYWNrYWdlRGlyIH0pO1xuXG4gIC8vIFJ1biBUeXBlU2NyaXB0IGNoZWNrIE9OQ0UgZm9yIGVudGlyZSBwcm9qZWN0XG4gIGNvbnN0IHR5cGVDaGVja1Jlc3VsdCA9IHJ1blByb2plY3RUeXBlQ2hlY2socGFja2FnZURpcik7XG5cbiAgLy8gUnVuIEVTTGludCBhbmQgZmluZCBkZXBlbmRlbnQgZmlsZXNcbiAgY29uc3QgZXNsaW50UmVzdWx0ID0gcnVuRVNMaW50KGZpbGVQYXRoLCBwYWNrYWdlRGlyKTtcbiAgY29uc3QgZGVwZW5kZW50RmlsZXMgPSBmaW5kRGVwZW5kZW50RmlsZXMoZmlsZVBhdGgsIHBhY2thZ2VEaXIpO1xuXG4gIC8vIEZpbHRlciBlcnJvcnMgZm9yIGVkaXRlZCBmaWxlXG4gIGNvbnN0IGRpcmVjdFRzRXJyb3JzID0gdHlwZUNoZWNrUmVzdWx0LmVycm9ycy5maWx0ZXIoKGUpID0+IGUuZmlsZSA9PT0gZmlsZVBhdGgpO1xuICBjb25zdCBkaXJlY3RFcnJvcnM6IFBhcnNlZEVycm9yW10gPSBbLi4uZGlyZWN0VHNFcnJvcnMsIC4uLmVzbGludFJlc3VsdC5lcnJvcnNdO1xuXG4gIC8vIEZpbHRlciBlcnJvcnMgZm9yIGRlcGVuZGVudCBmaWxlcyAobm8gYWRkaXRpb25hbCB0c2MgcnVucyBuZWVkZWQhKVxuICBjb25zdCBleHRlcm5hbEVycm9ycyA9IGZpbHRlckRlcGVuZGVudEZpbGVFcnJvcnModHlwZUNoZWNrUmVzdWx0LmVycm9ycywgZGVwZW5kZW50RmlsZXMsIGZpbGVQYXRoKTtcblxuICBpZiAoZGlyZWN0RXJyb3JzLmxlbmd0aCA+IDAgfHwgZXh0ZXJuYWxFcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHlhbWxPdXRwdXQgPSBmb3JtYXRFcnJvcnNBc1lBTUwoZGlyZWN0RXJyb3JzLCBleHRlcm5hbEVycm9ycywgdHlwZUNoZWNrUmVzdWx0LnNpZ25hdHVyZXMpO1xuICAgIGNvbnN0IGVycm9yU3VtbWFyeSA9IGBGb3VuZCAke2RpcmVjdEVycm9ycy5sZW5ndGh9IGRpcmVjdCBlcnJvcihzKSR7ZXh0ZXJuYWxFcnJvcnMubGVuZ3RoID4gMCA/IGAgYW5kICR7ZXh0ZXJuYWxFcnJvcnMubGVuZ3RofSBlcnJvcihzKSBpbiBkZXBlbmRlbnQgZmlsZXNgIDogJyd9YDtcbiAgICBjb25zdCBzeXN0ZW1NZXNzYWdlID0gYFR5cGVTY3JpcHQgY2hlY2s6ICR7ZXJyb3JTdW1tYXJ5fS4gUmV2aWV3IHRoZSBlcnJvciBkZXRhaWxzIGFuZCBmaXggdHlwZSBpc3N1ZXMgYmVmb3JlIHByb2NlZWRpbmcuYDtcblxuICAgIGxvZ2dlci5pbmZvKCdWYWxpZGF0aW9uIGVycm9ycyBmb3VuZCcsIHtcbiAgICAgIGRpcmVjdENvdW50OiBkaXJlY3RFcnJvcnMubGVuZ3RoLFxuICAgICAgZXh0ZXJuYWxDb3VudDogZXh0ZXJuYWxFcnJvcnMubGVuZ3RoXG4gICAgfSk7XG5cbiAgICByZXR1cm4gcG9zdFRvb2xVc2VPdXRwdXQoe1xuICAgICAgc3lzdGVtTWVzc2FnZSxcbiAgICAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICAgICAgICBhZGRpdGlvbmFsQ29udGV4dDogeWFtbE91dHB1dFxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgbG9nZ2VyLmRlYnVnKCdObyB2YWxpZGF0aW9uIGVycm9ycycpO1xuICByZXR1cm4gcG9zdFRvb2xVc2VPdXRwdXQoe30pO1xufSk7XG4iLCAiLyoqXG4gKiBPdXRwdXQgdHlwZXMgYW5kIGJ1aWxkZXJzIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyB0eXBlLXNhZmUgb3V0cHV0IGJ1aWxkZXIgZnVuY3Rpb25zIGZvciBhbGwgMTIgaG9vayB0eXBlcy4gRWFjaCBidWlsZGVyXG4gKiBhY2NlcHRzIG9wdGlvbnMgdGhhdCBtYXRjaCB0aGUgd2lyZSBmb3JtYXQgZXhwZWN0ZWQgYnkgQ2xhdWRlIENvZGUsIHdpdGggdHlwZXNcbiAqIGRlcml2ZWQgZnJvbSB0aGUgQ2xhdWRlIEFnZW50IFNESydzIGBTeW5jSG9va0pTT05PdXRwdXRgIHR5cGUuXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3NcbiAqIEBtb2R1bGVcbiAqL1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRXhpdCBDb2RlIENvbnN0YW50c1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBFeGl0IGNvZGVzIHVzZWQgYnkgQ2xhdWRlIENvZGUgaG9va3MuXG4gKlxuICogfCBFeGl0IENvZGUgfCBOYW1lIHwgV2hlbiBVc2VkIHwgQ2xhdWRlIENvZGUgQmVoYXZpb3IgfFxuICogfC0tLS0tLS0tLS0tfC0tLS0tLXwtLS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tLS0tLS0tLS18XG4gKiB8IDAgfCBTdWNjZXNzIHwgSGFuZGxlciByZXR1cm5zIG5vcm1hbGx5IHwgQ29udGludWUsIHBhcnNlIHN0ZG91dCBhcyBKU09OIHxcbiAqIHwgMSB8IEVycm9yIHwgSW52YWxpZCBpbnB1dCwgbm9uLWJsb2NraW5nIGVycm9yIHwgTm9uLWJsb2NraW5nLCBzdGRlcnIgdG8gdXNlciBvbmx5IHxcbiAqIHwgMiB8IEJsb2NrIHwgSGFuZGxlciB0aHJvd3MgT1IgYHN0b3BSZWFzb25gIHNldCB8IEJsb2NraW5nLCBzdGRlcnIgc2hvd24gdG8gQ2xhdWRlIHxcbiAqL1xuZXhwb3J0IGNvbnN0IEVYSVRfQ09ERVMgPSB7XG4gIC8qKiBIYW5kbGVyIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHkuIENsYXVkZSBDb2RlIHBhcnNlcyBzdGRvdXQgYXMgSlNPTi4gKi9cbiAgU1VDQ0VTUzogMCxcbiAgLyoqIE5vbi1ibG9ja2luZyBlcnJvciBvY2N1cnJlZCAoZS5nLiwgaW52YWxpZCBpbnB1dCkuIHN0ZGVyciBzaG93biB0byB1c2VyIG9ubHkuICovXG4gIEVSUk9SOiAxLFxuICAvKiogSGFuZGxlciB0aHJldyBleGNlcHRpb24gT1IgYmxvY2tpbmcgYWN0aW9uIHJlcXVlc3RlZC4gc3RkZXJyIHNob3duIHRvIENsYXVkZS4gKi9cbiAgQkxPQ0s6IDJcbn07XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBPdXRwdXQgQnVpbGRlciBGYWN0b3JpZXNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogRmFjdG9yeSBmb3IgaG9va3MgdGhhdCBoYXZlIGhvb2tTcGVjaWZpY091dHB1dCB3aXRoIGEgaG9va0V2ZW50TmFtZSBkaXNjcmltaW5hdG9yLlxuICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIGhvb2sgdHlwZSBuYW1lIHVzZWQgYXMgdGhlIF90eXBlIGRpc2NyaW1pbmF0b3JcbiAqIEByZXR1cm5zIEEgYnVpbGRlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIG91dHB1dCBvYmplY3RcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKGhvb2tUeXBlKSB7XG4gIHJldHVybiAob3B0aW9ucyA9IHt9KSA9PiB7XG4gICAgY29uc3QgeyBob29rU3BlY2lmaWNPdXRwdXQsIC4uLnJlc3QgfSA9IG9wdGlvbnM7XG4gICAgY29uc3Qgc3Rkb3V0ID1cbiAgICAgIGhvb2tTcGVjaWZpY091dHB1dCAhPT0gdW5kZWZpbmVkXG4gICAgICAgID8geyAuLi5yZXN0LCBob29rU3BlY2lmaWNPdXRwdXQ6IHsgaG9va0V2ZW50TmFtZTogaG9va1R5cGUsIC4uLmhvb2tTcGVjaWZpY091dHB1dCB9IH1cbiAgICAgICAgOiByZXN0O1xuICAgIHJldHVybiB7IF90eXBlOiBob29rVHlwZSwgc3Rkb3V0IH07XG4gIH07XG59XG4vKipcbiAqIEZhY3RvcnkgZm9yIGhvb2tzIHRoYXQgb25seSB1c2UgQ29tbW9uT3B0aW9ucyAoc2ltcGxlIHBhc3N0aHJvdWdoKS5cbiAqIEBwYXJhbSBob29rVHlwZSAtIFRoZSBob29rIHR5cGUgbmFtZSB1c2VkIGFzIHRoZSBfdHlwZSBkaXNjcmltaW5hdG9yXG4gKiBAcmV0dXJucyBBIGJ1aWxkZXIgZnVuY3Rpb24gdGhhdCBjcmVhdGVzIHRoZSBvdXRwdXQgb2JqZWN0XG4gKiBAaW50ZXJuYWxcbiAqL1xuZnVuY3Rpb24gY3JlYXRlU2ltcGxlT3V0cHV0QnVpbGRlcihob29rVHlwZSkge1xuICByZXR1cm4gKG9wdGlvbnMgPSB7fSkgPT4gKHtcbiAgICBfdHlwZTogaG9va1R5cGUsXG4gICAgc3Rkb3V0OiBvcHRpb25zXG4gIH0pO1xufVxuLyoqXG4gKiBGYWN0b3J5IGZvciBob29rcyB0aGF0IHVzZSBkZWNpc2lvbi1iYXNlZCBvcHRpb25zIChTdG9wLCBTdWJhZ2VudFN0b3ApLlxuICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIGhvb2sgdHlwZSBuYW1lIHVzZWQgYXMgdGhlIF90eXBlIGRpc2NyaW1pbmF0b3JcbiAqIEByZXR1cm5zIEEgYnVpbGRlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgdGhlIG91dHB1dCBvYmplY3RcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVEZWNpc2lvbk91dHB1dEJ1aWxkZXIoaG9va1R5cGUpIHtcbiAgcmV0dXJuIChvcHRpb25zID0ge30pID0+ICh7XG4gICAgX3R5cGU6IGhvb2tUeXBlLFxuICAgIHN0ZG91dDogb3B0aW9uc1xuICB9KTtcbn1cbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFByZVRvb2xVc2UgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFByZVRvb2xVc2VPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEFsbG93IHRvb2wgZXhlY3V0aW9uXG4gKiBwcmVUb29sVXNlT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7IHBlcm1pc3Npb25EZWNpc2lvbjogJ2FsbG93JyB9XG4gKiB9KTtcbiAqXG4gKiAvLyBEZW55IHdpdGggcmVhc29uXG4gKiBwcmVUb29sVXNlT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgcGVybWlzc2lvbkRlY2lzaW9uOiAnZGVueScsXG4gKiAgICAgcGVybWlzc2lvbkRlY2lzaW9uUmVhc29uOiAnRGFuZ2Vyb3VzIGNvbW1hbmQgZGV0ZWN0ZWQnXG4gKiAgIH1cbiAqIH0pO1xuICpcbiAqIC8vIEFsbG93IHdpdGggbW9kaWZpZWQgaW5wdXRcbiAqIHByZVRvb2xVc2VPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBwZXJtaXNzaW9uRGVjaXNpb246ICdhbGxvdycsXG4gKiAgICAgdXBkYXRlZElucHV0OiB7IGNvbW1hbmQ6ICdscyAtbGEnIH1cbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHByZVRvb2xVc2VPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcignUHJlVG9vbFVzZScpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUG9zdFRvb2xVc2UgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFBvc3RUb29sVXNlT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBZGQgY29udGV4dCBhZnRlciBhIGZpbGUgcmVhZFxuICogcG9zdFRvb2xVc2VPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ0ZpbGUgY29udGFpbnMgc2Vuc2l0aXZlIGRhdGEnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwb3N0VG9vbFVzZU91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKCdQb3N0VG9vbFVzZScpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUG9zdFRvb2xVc2VGYWlsdXJlIGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBQb3N0VG9vbFVzZUZhaWx1cmVPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHBvc3RUb29sVXNlRmFpbHVyZU91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiAnVHJ5IHVzaW5nIGEgZGlmZmVyZW50IGFwcHJvYWNoJ1xuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3QgcG9zdFRvb2xVc2VGYWlsdXJlT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoJ1Bvc3RUb29sVXNlRmFpbHVyZScpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgVXNlclByb21wdFN1Ym1pdCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgVXNlclByb21wdFN1Ym1pdE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogdXNlclByb21wdFN1Ym1pdE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiAnVGhpcyBwcm9qZWN0IHVzZXMgVHlwZVNjcmlwdCBzdHJpY3QgbW9kZSdcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHVzZXJQcm9tcHRTdWJtaXRPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcignVXNlclByb21wdFN1Ym1pdCcpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgU2Vzc2lvblN0YXJ0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTZXNzaW9uU3RhcnRPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHNlc3Npb25TdGFydE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiBKU09OLnN0cmluZ2lmeSh7IHByb2plY3Q6ICdteS1wcm9qZWN0JyB9KVxuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc2Vzc2lvblN0YXJ0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoJ1Nlc3Npb25TdGFydCcpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgU2Vzc2lvbkVuZCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgU2Vzc2lvbkVuZE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogc2Vzc2lvbkVuZE91dHB1dCh7fSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHNlc3Npb25FbmRPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlU2ltcGxlT3V0cHV0QnVpbGRlcignU2Vzc2lvbkVuZCcpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgU3RvcCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgU3RvcE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gQWxsb3cgdGhlIHN0b3BcbiAqIHN0b3BPdXRwdXQoeyBkZWNpc2lvbjogJ2FwcHJvdmUnIH0pO1xuICpcbiAqIC8vIEJsb2NrIHdpdGggcmVhc29uXG4gKiBzdG9wT3V0cHV0KHtcbiAqICAgZGVjaXNpb246ICdibG9jaycsXG4gKiAgIHJlYXNvbjogJ1RoZXJlIGFyZSB1bmNvbW1pdHRlZCBjaGFuZ2VzJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHN0b3BPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlRGVjaXNpb25PdXRwdXRCdWlsZGVyKCdTdG9wJyk7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTdWJhZ2VudFN0YXJ0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTdWJhZ2VudFN0YXJ0T3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBzdWJhZ2VudFN0YXJ0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdGb2N1cyBvbiBmaW5kaW5nIHBhdHRlcm5zJ1xuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc3ViYWdlbnRTdGFydE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKCdTdWJhZ2VudFN0YXJ0Jyk7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTdWJhZ2VudFN0b3AgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFN1YmFnZW50U3RvcE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gQmxvY2sgd2l0aCByZWFzb25cbiAqIHN1YmFnZW50U3RvcE91dHB1dCh7XG4gKiAgIGRlY2lzaW9uOiAnYmxvY2snLFxuICogICByZWFzb246ICdUYXNrIG5vdCBjb21wbGV0ZSdcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBzdWJhZ2VudFN0b3BPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlRGVjaXNpb25PdXRwdXRCdWlsZGVyKCdTdWJhZ2VudFN0b3AnKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIE5vdGlmaWNhdGlvbiBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgTm90aWZpY2F0aW9uT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBZGQgY29udGV4dCBhYm91dCB0aGUgbm90aWZpY2F0aW9uXG4gKiBub3RpZmljYXRpb25PdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ05vdGlmaWNhdGlvbiBmb3J3YXJkZWQgdG8gU2xhY2sgI2FsZXJ0cyBjaGFubmVsJ1xuICogICB9XG4gKiB9KTtcbiAqXG4gKiAvLyBTdXBwcmVzcyB0aGUgbm90aWZpY2F0aW9uXG4gKiBub3RpZmljYXRpb25PdXRwdXQoeyBzdXBwcmVzc091dHB1dDogdHJ1ZSB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgbm90aWZpY2F0aW9uT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoJ05vdGlmaWNhdGlvbicpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgUHJlQ29tcGFjdCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgUHJlQ29tcGFjdE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogcHJlQ29tcGFjdE91dHB1dCh7XG4gKiAgIHN5c3RlbU1lc3NhZ2U6ICdSZW1lbWJlcjogc3RyaWN0IG1vZGUgaXMgZW5hYmxlZCdcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwcmVDb21wYWN0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZVNpbXBsZU91dHB1dEJ1aWxkZXIoJ1ByZUNvbXBhY3QnKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFBlcm1pc3Npb25SZXF1ZXN0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBQZXJtaXNzaW9uUmVxdWVzdE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gQXV0by1hcHByb3ZlXG4gKiBwZXJtaXNzaW9uUmVxdWVzdE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGRlY2lzaW9uOiB7IGJlaGF2aW9yOiAnYWxsb3cnIH1cbiAqICAgfVxuICogfSk7XG4gKlxuICogLy8gQXV0by1hcHByb3ZlIHdpdGggbW9kaWZpZWQgaW5wdXRcbiAqIHBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgZGVjaXNpb246IHtcbiAqICAgICAgIGJlaGF2aW9yOiAnYWxsb3cnLFxuICogICAgICAgdXBkYXRlZElucHV0OiB7IGZpbGVfcGF0aDogJy9zYWZlL3BhdGgnIH1cbiAqICAgICB9XG4gKiAgIH1cbiAqIH0pO1xuICpcbiAqIC8vIEF1dG8tZGVueVxuICogcGVybWlzc2lvblJlcXVlc3RPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBkZWNpc2lvbjoge1xuICogICAgICAgYmVoYXZpb3I6ICdkZW55JyxcbiAqICAgICAgIG1lc3NhZ2U6ICdOb3QgYWxsb3dlZCcsXG4gKiAgICAgICBpbnRlcnJ1cHQ6IHRydWVcbiAqICAgICB9XG4gKiAgIH1cbiAqIH0pO1xuICpcbiAqIC8vIEZhbGwgdGhyb3VnaCB0byBub3JtYWwgcHJvbXB0XG4gKiBwZXJtaXNzaW9uUmVxdWVzdE91dHB1dCh7fSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoJ1Blcm1pc3Npb25SZXF1ZXN0Jyk7XG4iLCAiLyoqXG4gKiBMb2dnZXIgc3lzdGVtIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBQcm92aWRlcyBzdHJ1Y3R1cmVkIGxvZ2dpbmcgd2l0aCBldmVudCBzdWJzY3JpcHRpb24gYW5kIG9wdGlvbmFsIGZpbGUgb3V0cHV0LlxuICogVGhlIGxvZ2dlciBpcyAqKnNpbGVudCBieSBkZWZhdWx0KiogdG8gYXZvaWQgaW50ZXJmZXJpbmcgd2l0aCBob29rIHByb3RvY29sXG4gKiAoc3Rkb3V0IGlzIHJlc2VydmVkIGZvciBKU09OIHJlc3BvbnNlcywgc3RkZXJyIG1heSBjb25mbGljdCB3aXRoIENsYXVkZSBDb2RlKS5cbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBsb2dnZXIgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIFN1YnNjcmliZSB0byBsb2cgZXZlbnRzXG4gKiBjb25zdCB1bnN1YnNjcmliZSA9IGxvZ2dlci5vbignZXJyb3InLCAoZXZlbnQpID0+IHtcbiAqICAgY29uc29sZS5lcnJvcihgRXJyb3IgaW4gJHtldmVudC5ob29rVHlwZX06ICR7ZXZlbnQubWVzc2FnZX1gKTtcbiAqIH0pO1xuICpcbiAqIC8vIExhdGVyLCBjbGVhbiB1cFxuICogdW5zdWJzY3JpYmUoKTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzXG4gKi9cbmltcG9ydCB7IGNsb3NlU3luYywgZXhpc3RzU3luYywgbWtkaXJTeW5jLCBvcGVuU3luYywgd3JpdGVTeW5jIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAnbm9kZTpwYXRoJztcbi8qKlxuICogQWxsIGxvZyBsZXZlbHMgaW4gb3JkZXIgb2Ygc2V2ZXJpdHkgKGxvd2VzdCB0byBoaWdoZXN0KS5cbiAqL1xuZXhwb3J0IGNvbnN0IExPR19MRVZFTFMgPSBbJ2RlYnVnJywgJ2luZm8nLCAnd2FybicsICdlcnJvciddO1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gTG9nZ2VyIENsYXNzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIExvZ2dlciBmb3IgQ2xhdWRlIENvZGUgaG9va3Mgd2l0aCBldmVudCBzdWJzY3JpcHRpb24gYW5kIGZpbGUgb3V0cHV0LlxuICpcbiAqICMjIEtleSBCZWhhdmlvcnNcbiAqXG4gKiB8IENvbmZpZ3VyYXRpb24gfCBCZWhhdmlvciB8XG4gKiB8LS0tLS0tLS0tLS0tLS18LS0tLS0tLS0tLXxcbiAqIHwgTm8gY29uZmlnIChkZWZhdWx0KSB8ICoqU2lsZW50KiogLSBubyBvdXRwdXQgYW55d2hlcmUgfFxuICogfCBgQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEVgIGVudiB2YXIgfCBBcHBlbmQgSlNPTiBsaW5lcyB0byBmaWxlIHxcbiAqIHwgYC5vbihsZXZlbCwgaGFuZGxlcilgIHJlZ2lzdGVyZWQgfCBFdmVudHMgZGVsaXZlcmVkIHRvIGhhbmRsZXJzIG9ubHkgfFxuICogfCBNdWx0aXBsZSBkZXN0aW5hdGlvbnMgfCBBbGwgZGVzdGluYXRpb25zIHJlY2VpdmUgZXZlbnRzIHxcbiAqXG4gKiAjIyBJbXBvcnRhbnQgTm90ZXNcbiAqXG4gKiAtICoqTmV2ZXIgb3V0cHV0cyB0byBzdGRvdXQqKiAocmVzZXJ2ZWQgZm9yIEpTT04gaG9vayByZXNwb25zZSlcbiAqIC0gKipOZXZlciBvdXRwdXRzIHRvIHN0ZGVycioqIChtYXkgaW50ZXJmZXJlIHdpdGggQ2xhdWRlIENvZGUgZXJyb3IgaGFuZGxpbmcpXG4gKiAtIEZpbGUgb3V0cHV0IHVzZXMgSlNPTiBMaW5lcyBmb3JtYXQgZm9yIGVhc3kgcGFyc2luZ1xuICogLSBgLm9uKGxldmVsLCBoYW5kbGVyKWAgcmV0dXJucyBhbiB1bnN1YnNjcmliZSBmdW5jdGlvblxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gU3Vic2NyaWJlIHRvIGV2ZW50cyBhdCBzcGVjaWZpYyBsZXZlbFxuICogbG9nZ2VyLm9uKCd3YXJuJywgKGV2ZW50KSA9PiB7XG4gKiAgIHNlbmRBbGVydChldmVudC5tZXNzYWdlKTtcbiAqIH0pO1xuICpcbiAqIC8vIExvZyB3aXRoaW4gYSBob29rIGhhbmRsZXJcbiAqIGV4cG9ydCBkZWZhdWx0IHByZVRvb2xVc2VIb29rKHsgbWF0Y2hlcjogJ0Jhc2gnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIud2FybignQWJvdXQgdG8gdmFsaWRhdGUgQmFzaCBjb21tYW5kJyk7XG4gKiAgIHJldHVybiBwcmVUb29sVXNlT3V0cHV0KHsgYWxsb3c6IHRydWUgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgTG9nZ2VyIHtcbiAgLyoqXG4gICAqIFJlZ2lzdGVyZWQgZXZlbnQgaGFuZGxlcnMgYnkgbG9nIGxldmVsLlxuICAgKi9cbiAgaGFuZGxlcnMgPSBuZXcgTWFwKCk7XG4gIC8qKlxuICAgKiBGaWxlIGRlc2NyaXB0b3IgZm9yIGxvZyBmaWxlIG91dHB1dC5cbiAgICogTGF6aWx5IGluaXRpYWxpemVkIG9uIGZpcnN0IHdyaXRlLlxuICAgKi9cbiAgbG9nRmlsZUZkID0gbnVsbDtcbiAgLyoqXG4gICAqIFBhdGggdG8gdGhlIGxvZyBmaWxlLCBpZiBjb25maWd1cmVkLlxuICAgKi9cbiAgbG9nRmlsZVBhdGggPSBudWxsO1xuICAvKipcbiAgICogV2hldGhlciBmaWxlIGluaXRpYWxpemF0aW9uIGhhcyBiZWVuIGF0dGVtcHRlZC5cbiAgICovXG4gIGZpbGVJbml0aWFsaXplZCA9IGZhbHNlO1xuICAvKipcbiAgICogQ3VycmVudCBob29rIGNvbnRleHQgZm9yIGVucmljaGluZyBsb2cgZXZlbnRzLlxuICAgKi9cbiAgY3VycmVudEhvb2tUeXBlO1xuICAvKipcbiAgICogQ3VycmVudCBob29rIGlucHV0IGZvciBlbnJpY2hpbmcgbG9nIGV2ZW50cy5cbiAgICovXG4gIGN1cnJlbnRJbnB1dDtcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgTG9nZ2VyIGluc3RhbmNlLlxuICAgKlxuICAgKiBUeXBpY2FsbHkgeW91IHNob3VsZCB1c2UgdGhlIGV4cG9ydGVkIGBsb2dnZXJgIHNpbmdsZXRvbiByYXRoZXIgdGhhblxuICAgKiBjcmVhdGluZyBuZXcgaW5zdGFuY2VzLlxuICAgKiBAcGFyYW0gY29uZmlnIC0gT3B0aW9uYWwgY29uZmlndXJhdGlvblxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIC8vIFVzZSBzaW5nbGV0b24gKHJlY29tbWVuZGVkKVxuICAgKiBpbXBvcnQgeyBsb2dnZXIgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICAgKlxuICAgKiAvLyBPciBjcmVhdGUgY3VzdG9tIGluc3RhbmNlXG4gICAqIGNvbnN0IGN1c3RvbUxvZ2dlciA9IG5ldyBMb2dnZXIoeyBsb2dGaWxlUGF0aDogJy92YXIvbG9nL2hvb2tzLmxvZycgfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICAvLyBJbml0aWFsaXplIGhhbmRsZXJzIG1hcCBmb3IgZWFjaCBsZXZlbFxuICAgIGZvciAoY29uc3QgbGV2ZWwgb2YgTE9HX0xFVkVMUykge1xuICAgICAgdGhpcy5oYW5kbGVycy5zZXQobGV2ZWwsIG5ldyBTZXQoKSk7XG4gICAgfVxuICAgIC8vIFNldCBsb2cgZmlsZSBwYXRoIGZyb20gY29uZmlnIG9yIGVudmlyb25tZW50XG4gICAgdGhpcy5sb2dGaWxlUGF0aCA9IGNvbmZpZy5sb2dGaWxlUGF0aCA/PyBwcm9jZXNzLmVudlsnQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEUnXSA/PyBudWxsO1xuICB9XG4gIC8qKlxuICAgKiBMb2dzIGEgZGVidWcgbWVzc2FnZS5cbiAgICpcbiAgICogVXNlIGZvciBkZXRhaWxlZCBkZWJ1Z2dpbmcgaW5mb3JtYXRpb24gdGhhdCBpcyB0eXBpY2FsbHkgb25seSB1c2VmdWxcbiAgICogZHVyaW5nIGRldmVsb3BtZW50IG9yIHRyb3VibGVzaG9vdGluZy5cbiAgICogQHBhcmFtIG1lc3NhZ2UgLSBUaGUgZGVidWcgbWVzc2FnZVxuICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGxvZ2dlci5kZWJ1ZygnUHJvY2Vzc2luZyB0b29sIGlucHV0JywgeyB0b29sTmFtZTogJ0Jhc2gnLCBpbnB1dFNpemU6IDI1NiB9KTtcbiAgICogYGBgXG4gICAqL1xuICBkZWJ1ZyhtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgdGhpcy5lbWl0KCdkZWJ1ZycsIG1lc3NhZ2UsIGNvbnRleHQpO1xuICB9XG4gIC8qKlxuICAgKiBMb2dzIGFuIGluZm8gbWVzc2FnZS5cbiAgICpcbiAgICogVXNlIGZvciBnZW5lcmFsIG9wZXJhdGlvbmFsIGV2ZW50cyBsaWtlIGhvb2sgaW52b2NhdGlvbnMsIHN1Y2Nlc3NmdWxcbiAgICogY29tcGxldGlvbnMsIG9yIHN0YXRlIGNoYW5nZXMuXG4gICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIGluZm8gbWVzc2FnZVxuICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGxvZ2dlci5pbmZvKCdTZXNzaW9uIHN0YXJ0ZWQnLCB7IHNvdXJjZTogJ3N0YXJ0dXAnLCBzZXNzaW9uSWQ6ICdhYmMxMjMnIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIGluZm8obWVzc2FnZSwgY29udGV4dCkge1xuICAgIHRoaXMuZW1pdCgnaW5mbycsIG1lc3NhZ2UsIGNvbnRleHQpO1xuICB9XG4gIC8qKlxuICAgKiBMb2dzIGEgd2FybmluZyBtZXNzYWdlLlxuICAgKlxuICAgKiBVc2UgZm9yIGNvbmRpdGlvbnMgdGhhdCBtYXkgaW5kaWNhdGUgaXNzdWVzIGJ1dCBkb24ndCBwcmV2ZW50XG4gICAqIG9wZXJhdGlvbiwgc3VjaCBhcyBkZXByZWNhdGVkIHBhdHRlcm5zIG9yIHBlcmZvcm1hbmNlIGNvbmNlcm5zLlxuICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSB3YXJuaW5nIG1lc3NhZ2VcbiAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHRcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiBsb2dnZXIud2FybignRGVwcmVjYXRlZCBob29rIHBhdHRlcm4gZGV0ZWN0ZWQnLCB7IHBhdHRlcm46ICdsZWdhY3lNYXRjaGVyJyB9KTtcbiAgICogYGBgXG4gICAqL1xuICB3YXJuKG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICB0aGlzLmVtaXQoJ3dhcm4nLCBtZXNzYWdlLCBjb250ZXh0KTtcbiAgfVxuICAvKipcbiAgICogTG9ncyBhbiBlcnJvciBtZXNzYWdlLlxuICAgKlxuICAgKiBVc2UgZm9yIGVycm9yIGNvbmRpdGlvbnMgdGhhdCByZXF1aXJlIGF0dGVudGlvbiBidXQgd2VyZSBoYW5kbGVkXG4gICAqIGdyYWNlZnVsbHkuIEZvciBleGNlcHRpb25zLCBwcmVmZXIge0BsaW5rIGxvZ0Vycm9yfS5cbiAgICogQHBhcmFtIG1lc3NhZ2UgLSBUaGUgZXJyb3IgbWVzc2FnZVxuICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIGxvZ2dlci5lcnJvcignRmFpbGVkIHRvIHZhbGlkYXRlIHRvb2wgaW5wdXQnLCB7IHRvb2xOYW1lOiAnQmFzaCcsIHJlYXNvbjogJ2VtcHR5IGNvbW1hbmQnIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIGVycm9yKG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICB0aGlzLmVtaXQoJ2Vycm9yJywgbWVzc2FnZSwgY29udGV4dCk7XG4gIH1cbiAgLyoqXG4gICAqIExvZ3MgYSBzdHJ1Y3R1cmVkIGVycm9yIHdpdGggZnVsbCBlcnJvciBkZXRhaWxzLlxuICAgKlxuICAgKiBVc2UgdGhpcyBtZXRob2Qgd2hlbiBsb2dnaW5nIGNhdWdodCBleGNlcHRpb25zIHRvIGNhcHR1cmUgdGhlIGZ1bGxcbiAgICogZXJyb3IgY29udGV4dCBpbmNsdWRpbmcgbmFtZSwgbWVzc2FnZSwgc3RhY2sgdHJhY2UsIGFuZCBjYXVzZSBjaGFpbi5cbiAgICogQHBhcmFtIGVycm9yIC0gVGhlIGVycm9yIHRvIGxvZ1xuICAgKiBAcGFyYW0gbWVzc2FnZSAtIEh1bWFuLXJlYWRhYmxlIGRlc2NyaXB0aW9uIG9mIHdoYXQgZmFpbGVkXG4gICAqIEBwYXJhbSBjb250ZXh0IC0gT3B0aW9uYWwgYWRkaXRpb25hbCBjb250ZXh0XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYHR5cGVzY3JpcHRcbiAgICogdHJ5IHtcbiAgICogICBhd2FpdCBkYW5nZXJvdXNPcGVyYXRpb24oKTtcbiAgICogfSBjYXRjaCAoZXJyKSB7XG4gICAqICAgbG9nZ2VyLmxvZ0Vycm9yKGVyciwgJ0ZhaWxlZCB0byBleGVjdXRlIGRhbmdlcm91cyBvcGVyYXRpb24nLCB7XG4gICAqICAgICBvcGVyYXRpb246ICdkZWxldGUnLFxuICAgKiAgICAgdGFyZ2V0OiAnL2ltcG9ydGFudC9maWxlLnR4dCdcbiAgICogICB9KTtcbiAgICogfVxuICAgKiBgYGBcbiAgICovXG4gIGxvZ0Vycm9yKGVycm9yLCBtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgY29uc3QgZXJyb3JJbmZvID0gdGhpcy5leHRyYWN0RXJyb3JJbmZvKGVycm9yKTtcbiAgICBjb25zdCBldmVudCA9IHtcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICBob29rVHlwZTogdGhpcy5jdXJyZW50SG9va1R5cGUsXG4gICAgICBtZXNzYWdlLFxuICAgICAgaW5wdXQ6IHRoaXMuY3VycmVudElucHV0LFxuICAgICAgZXJyb3I6IGVycm9ySW5mbyxcbiAgICAgIGNvbnRleHRcbiAgICB9O1xuICAgIHRoaXMuZGVsaXZlckV2ZW50KGV2ZW50KTtcbiAgfVxuICAvKipcbiAgICogU3Vic2NyaWJlcyBhIGhhbmRsZXIgdG8gbG9nIGV2ZW50cyBhdCB0aGUgc3BlY2lmaWVkIGxldmVsLlxuICAgKlxuICAgKiBUaGUgaGFuZGxlciB3aWxsIGJlIGNhbGxlZCBmb3IgZXZlcnkgbG9nIGV2ZW50IGF0IHRoZSBzcGVjaWZpZWQgbGV2ZWwuXG4gICAqIFJldHVybnMgYW4gdW5zdWJzY3JpYmUgZnVuY3Rpb24gdGhhdCBzaG91bGQgYmUgY2FsbGVkIHdoZW4gdGhlIGhhbmRsZXJcbiAgICogaXMgbm8gbG9uZ2VyIG5lZWRlZC5cbiAgICogQHBhcmFtIGxldmVsIC0gVGhlIGxvZyBsZXZlbCB0byBzdWJzY3JpYmUgdG9cbiAgICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBjYWxsIGZvciBlYWNoIGV2ZW50XG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gdW5zdWJzY3JpYmUgdGhlIGhhbmRsZXJcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiAvLyBTdWJzY3JpYmUgdG8gZXJyb3IgZXZlbnRzXG4gICAqIGNvbnN0IHVuc3Vic2NyaWJlID0gbG9nZ2VyLm9uKCdlcnJvcicsIChldmVudCkgPT4ge1xuICAgKiAgIGNvbnNvbGUuZXJyb3IoYFske2V2ZW50Lmhvb2tUeXBlfV0gJHtldmVudC5tZXNzYWdlfWApO1xuICAgKiAgIGlmIChldmVudC5lcnJvcikge1xuICAgKiAgICAgY29uc29sZS5lcnJvcihldmVudC5lcnJvci5zdGFjayk7XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICpcbiAgICogLy8gTGF0ZXIsIGNsZWFuIHVwXG4gICAqIHVuc3Vic2NyaWJlKCk7XG4gICAqIGBgYFxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIC8vIEZvcndhcmQgdG8gZXh0ZXJuYWwgbG9nZ2luZyBsaWJyYXJ5XG4gICAqIGltcG9ydCBwaW5vIGZyb20gJ3Bpbm8nO1xuICAgKiBjb25zdCBwaW5vTG9nZ2VyID0gcGlubygpO1xuICAgKlxuICAgKiBsb2dnZXIub24oJ2luZm8nLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIuaW5mbyhldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICAgKiBsb2dnZXIub24oJ3dhcm4nLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIud2FybihldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICAgKiBsb2dnZXIub24oJ2Vycm9yJywgKGV2ZW50KSA9PiBwaW5vTG9nZ2VyLmVycm9yKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gICAqIGBgYFxuICAgKi9cbiAgb24obGV2ZWwsIGhhbmRsZXIpIHtcbiAgICBjb25zdCBsZXZlbEhhbmRsZXJzID0gdGhpcy5oYW5kbGVycy5nZXQobGV2ZWwpO1xuICAgIGlmIChsZXZlbEhhbmRsZXJzKSB7XG4gICAgICBsZXZlbEhhbmRsZXJzLmFkZChoYW5kbGVyKTtcbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGxldmVsSGFuZGxlcnM/LmRlbGV0ZShoYW5kbGVyKTtcbiAgICB9O1xuICB9XG4gIC8qKlxuICAgKiBTZXRzIHRoZSBjdXJyZW50IGhvb2sgY29udGV4dCBmb3IgZW5yaWNoaW5nIGxvZyBldmVudHMuXG4gICAqXG4gICAqIFRoaXMgaXMgY2FsbGVkIGludGVybmFsbHkgYnkgdGhlIHJ1bnRpbWUgYmVmb3JlIGludm9raW5nIGhvb2sgaGFuZGxlcnMuXG4gICAqIFlvdSB0eXBpY2FsbHkgZG9uJ3QgbmVlZCB0byBjYWxsIHRoaXMgZGlyZWN0bHkuXG4gICAqIEBwYXJhbSBob29rVHlwZSAtIFRoZSB0eXBlIG9mIGhvb2sgYmVpbmcgZXhlY3V0ZWRcbiAgICogQHBhcmFtIGlucHV0IC0gVGhlIGhvb2sgaW5wdXQgZGF0YVxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHNldENvbnRleHQoaG9va1R5cGUsIGlucHV0KSB7XG4gICAgdGhpcy5jdXJyZW50SG9va1R5cGUgPSBob29rVHlwZTtcbiAgICB0aGlzLmN1cnJlbnRJbnB1dCA9IGlucHV0O1xuICB9XG4gIC8qKlxuICAgKiBDbGVhcnMgdGhlIGN1cnJlbnQgaG9vayBjb250ZXh0LlxuICAgKlxuICAgKiBDYWxsZWQgaW50ZXJuYWxseSBieSB0aGUgcnVudGltZSBhZnRlciBob29rIGV4ZWN1dGlvbiBjb21wbGV0ZXMuXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgY2xlYXJDb250ZXh0KCkge1xuICAgIHRoaXMuY3VycmVudEhvb2tUeXBlID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuY3VycmVudElucHV0ID0gdW5kZWZpbmVkO1xuICB9XG4gIC8qKlxuICAgKiBDb25maWd1cmVzIHRoZSBsb2cgZmlsZSBwYXRoIGF0IHJ1bnRpbWUuXG4gICAqXG4gICAqIENhbGwgdGhpcyB0byBlbmFibGUgb3IgY2hhbmdlIGZpbGUgbG9nZ2luZy4gU2V0dGluZyB0byBgbnVsbGAgZGlzYWJsZXNcbiAgICogZmlsZSBsb2dnaW5nIChidXQgZG9lc24ndCBjbG9zZSBleGlzdGluZyBmaWxlIGhhbmRsZSBpbW1lZGlhdGVseSkuXG4gICAqIEBwYXJhbSBmaWxlUGF0aCAtIFBhdGggdG8gdGhlIGxvZyBmaWxlLCBvciBudWxsIHRvIGRpc2FibGVcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHlwZXNjcmlwdFxuICAgKiAvLyBFbmFibGUgZmlsZSBsb2dnaW5nIGF0IHJ1bnRpbWVcbiAgICogbG9nZ2VyLnNldExvZ0ZpbGUoJy92YXIvbG9nL2NsYXVkZS1ob29rcy5sb2cnKTtcbiAgICpcbiAgICogLy8gRGlzYWJsZSBmaWxlIGxvZ2dpbmdcbiAgICogbG9nZ2VyLnNldExvZ0ZpbGUobnVsbCk7XG4gICAqIGBgYFxuICAgKi9cbiAgc2V0TG9nRmlsZShmaWxlUGF0aCkge1xuICAgIC8vIENsb3NlIGV4aXN0aW5nIGZpbGUgaWYgb3BlblxuICAgIGlmICh0aGlzLmxvZ0ZpbGVGZCAhPT0gbnVsbCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY2xvc2VTeW5jKHRoaXMubG9nRmlsZUZkKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBJZ25vcmUgZXJyb3JzIG9uIGNsb3NlXG4gICAgICB9XG4gICAgICB0aGlzLmxvZ0ZpbGVGZCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMubG9nRmlsZVBhdGggPSBmaWxlUGF0aDtcbiAgICB0aGlzLmZpbGVJbml0aWFsaXplZCA9IGZhbHNlO1xuICB9XG4gIC8qKlxuICAgKiBDbG9zZXMgYWxsIHJlc291cmNlcyBoZWxkIGJ5IHRoZSBsb2dnZXIuXG4gICAqXG4gICAqIENhbGwgdGhpcyBkdXJpbmcgZ3JhY2VmdWwgc2h1dGRvd24gdG8gZW5zdXJlIGFsbCBsb2cgZGF0YSBpcyBmbHVzaGVkLlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0eXBlc2NyaXB0XG4gICAqIHByb2Nlc3Mub24oJ2V4aXQnLCAoKSA9PiB7XG4gICAqICAgbG9nZ2VyLmNsb3NlKCk7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIGNsb3NlKCkge1xuICAgIGlmICh0aGlzLmxvZ0ZpbGVGZCAhPT0gbnVsbCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY2xvc2VTeW5jKHRoaXMubG9nRmlsZUZkKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBJZ25vcmUgZXJyb3JzIG9uIGNsb3NlXG4gICAgICB9XG4gICAgICB0aGlzLmxvZ0ZpbGVGZCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuZmlsZUluaXRpYWxpemVkID0gZmFsc2U7XG4gIH1cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGVyZSBhcmUgYW55IGFjdGl2ZSBoYW5kbGVycyBvciBkZXN0aW5hdGlvbnMuXG4gICAqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiBhbnkgaGFuZGxlcnMgYXJlIHJlZ2lzdGVyZWQgb3IgZmlsZSBsb2dnaW5nIGlzIGVuYWJsZWQuXG4gICAqIEByZXR1cm5zIFdoZXRoZXIgdGhlIGxvZ2dlciBoYXMgYW55IGFjdGl2ZSBvdXRwdXQgZGVzdGluYXRpb25zXG4gICAqL1xuICBoYXNEZXN0aW5hdGlvbnMoKSB7XG4gICAgZm9yIChjb25zdCBoYW5kbGVycyBvZiB0aGlzLmhhbmRsZXJzLnZhbHVlcygpKSB7XG4gICAgICBpZiAoaGFuZGxlcnMuc2l6ZSA+IDApIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5sb2dGaWxlUGF0aCAhPT0gbnVsbDtcbiAgfVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIFByaXZhdGUgTWV0aG9kc1xuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8qKlxuICAgKiBFbWl0cyBhIGxvZyBldmVudC5cbiAgICogQHBhcmFtIGxldmVsIC0gVGhlIHNldmVyaXR5IGxldmVsIG9mIHRoZSBldmVudFxuICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBsb2cgbWVzc2FnZVxuICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dCBkYXRhXG4gICAqL1xuICBlbWl0KGxldmVsLCBtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgY29uc3QgZXZlbnQgPSB7XG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIGxldmVsLFxuICAgICAgaG9va1R5cGU6IHRoaXMuY3VycmVudEhvb2tUeXBlLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIGlucHV0OiB0aGlzLmN1cnJlbnRJbnB1dCxcbiAgICAgIGNvbnRleHRcbiAgICB9O1xuICAgIHRoaXMuZGVsaXZlckV2ZW50KGV2ZW50KTtcbiAgfVxuICAvKipcbiAgICogRGVsaXZlcnMgYW4gZXZlbnQgdG8gYWxsIHJlZ2lzdGVyZWQgZGVzdGluYXRpb25zLlxuICAgKiBAcGFyYW0gZXZlbnQgLSBUaGUgbG9nIGV2ZW50IHRvIGRlbGl2ZXJcbiAgICovXG4gIGRlbGl2ZXJFdmVudChldmVudCkge1xuICAgIC8vIERlbGl2ZXIgdG8gZXZlbnQgaGFuZGxlcnNcbiAgICBjb25zdCBsZXZlbEhhbmRsZXJzID0gdGhpcy5oYW5kbGVycy5nZXQoZXZlbnQubGV2ZWwpO1xuICAgIGlmIChsZXZlbEhhbmRsZXJzKSB7XG4gICAgICBmb3IgKGNvbnN0IGhhbmRsZXIgb2YgbGV2ZWxIYW5kbGVycykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGhhbmRsZXIoZXZlbnQpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyBTaWxlbnRseSBpZ25vcmUgaGFuZGxlciBlcnJvcnMgdG8gbm90IGRpc3J1cHQgaG9vayBleGVjdXRpb25cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBXcml0ZSB0byBmaWxlIGlmIGNvbmZpZ3VyZWRcbiAgICB0aGlzLndyaXRlVG9GaWxlKGV2ZW50KTtcbiAgfVxuICAvKipcbiAgICogV3JpdGVzIGFuIGV2ZW50IHRvIHRoZSBsb2cgZmlsZS5cbiAgICogQHBhcmFtIGV2ZW50IC0gVGhlIGxvZyBldmVudCB0byB3cml0ZVxuICAgKi9cbiAgd3JpdGVUb0ZpbGUoZXZlbnQpIHtcbiAgICBpZiAoIXRoaXMubG9nRmlsZVBhdGgpIHJldHVybjtcbiAgICAvLyBMYXp5IGluaXRpYWxpemF0aW9uIG9mIGZpbGUgaGFuZGxlXG4gICAgaWYgKCF0aGlzLmZpbGVJbml0aWFsaXplZCkge1xuICAgICAgdGhpcy5pbml0aWFsaXplRmlsZSgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5sb2dGaWxlRmQgPT09IG51bGwpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbGluZSA9IEpTT04uc3RyaW5naWZ5KGV2ZW50KSArICdcXG4nO1xuICAgICAgd3JpdGVTeW5jKHRoaXMubG9nRmlsZUZkLCBsaW5lKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIFNpbGVudGx5IGlnbm9yZSBmaWxlIHdyaXRlIGVycm9ycyB0byBub3QgZGlzcnVwdCBob29rIGV4ZWN1dGlvblxuICAgICAgLy8gVGhpcyBmb2xsb3dzIHRoZSByaXNrIG1pdGlnYXRpb246IFwiR3JhY2VmdWwgZGVncmFkYXRpb24gLSBsb2cgd3JpdGVcbiAgICAgIC8vIGZhaWx1cmVzIGFyZSBzaWxlbnRseSBpZ25vcmVkIHRvIG5vdCBkaXNydXB0IGhvb2sgZXhlY3V0aW9uXCJcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIEluaXRpYWxpemVzIHRoZSBsb2cgZmlsZSBmb3Igd3JpdGluZy5cbiAgICovXG4gIGluaXRpYWxpemVGaWxlKCkge1xuICAgIHRoaXMuZmlsZUluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICBpZiAoIXRoaXMubG9nRmlsZVBhdGgpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgLy8gRW5zdXJlIGRpcmVjdG9yeSBleGlzdHNcbiAgICAgIGNvbnN0IGRpciA9IGRpcm5hbWUodGhpcy5sb2dGaWxlUGF0aCk7XG4gICAgICBpZiAoIWV4aXN0c1N5bmMoZGlyKSkge1xuICAgICAgICBta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICAgIC8vIE9wZW4gZmlsZSBmb3IgYXBwZW5kaW5nXG4gICAgICB0aGlzLmxvZ0ZpbGVGZCA9IG9wZW5TeW5jKHRoaXMubG9nRmlsZVBhdGgsICdhJyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBTaWxlbnRseSBpZ25vcmUgZmlsZSBpbml0aWFsaXphdGlvbiBlcnJvcnNcbiAgICAgIHRoaXMubG9nRmlsZUZkID0gbnVsbDtcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIEV4dHJhY3RzIHN0cnVjdHVyZWQgZXJyb3IgaW5mb3JtYXRpb24gZnJvbSBhbiB1bmtub3duIGVycm9yLlxuICAgKiBAcGFyYW0gZXJyb3IgLSBUaGUgZXJyb3IgdG8gZXh0cmFjdCBpbmZvcm1hdGlvbiBmcm9tXG4gICAqIEByZXR1cm5zIFN0cnVjdHVyZWQgZXJyb3IgaW5mb3JtYXRpb25cbiAgICovXG4gIGV4dHJhY3RFcnJvckluZm8oZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgY29uc3QgaW5mbyA9IHtcbiAgICAgICAgbmFtZTogZXJyb3IubmFtZSxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrXG4gICAgICB9O1xuICAgICAgLy8gRXh0cmFjdCBjYXVzZSBjaGFpbiBpZiBwcmVzZW50XG4gICAgICBpZiAoZXJyb3IuY2F1c2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpbmZvLmNhdXNlID0gdGhpcy5leHRyYWN0RXJyb3JJbmZvKGVycm9yLmNhdXNlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbmZvO1xuICAgIH1cbiAgICAvLyBIYW5kbGUgbm9uLUVycm9yIHZhbHVlc1xuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiAnVW5rbm93bkVycm9yJyxcbiAgICAgIG1lc3NhZ2U6IFN0cmluZyhlcnJvcilcbiAgICB9O1xuICB9XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTaW5nbGV0b24gRXhwb3J0XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIEdsb2JhbCBsb2dnZXIgaW5zdGFuY2UgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIFVzZSB0aGlzIHNpbmdsZXRvbiBmb3IgYWxsIGxvZ2dpbmcgd2l0aGluIGhvb2tzLiBUaGUgbG9nZ2VyIGlzIGNvbmZpZ3VyZWRcbiAqIHZpYSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHN1cHBvcnRzIGV2ZW50IHN1YnNjcmlwdGlvbiBmb3IgY3VzdG9tXG4gKiBkZXN0aW5hdGlvbnMuXG4gKlxuICogIyMgQ29uZmlndXJhdGlvblxuICpcbiAqIHwgRW52aXJvbm1lbnQgVmFyaWFibGUgfCBEZXNjcmlwdGlvbiB8XG4gKiB8LS0tLS0tLS0tLS0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS18XG4gKiB8IGBDTEFVREVfQ09ERV9IT09LU19MT0dfRklMRWAgfCBQYXRoIHRvIGxvZyBmaWxlIChKU09OIExpbmVzIGZvcm1hdCkgfFxuICpcbiAqICMjIFVzYWdlIGluIEhvb2tzXG4gKlxuICogVGhlIGxvZ2dlciBpcyBwYXNzZWQgdG8gaG9vayBoYW5kbGVycyB2aWEgY29udGV4dCBmb3IgY29udmVuaWVuY2U6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogZXhwb3J0IGRlZmF1bHQgcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnQmFzaCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci53YXJuKCdWYWxpZGF0aW5nIEJhc2ggY29tbWFuZCcpO1xuICogICByZXR1cm4gcHJlVG9vbFVzZU91dHB1dCh7IGFsbG93OiB0cnVlIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiAjIyBFeHRlcm5hbCBJbnRlZ3JhdGlvblxuICpcbiAqIFN1YnNjcmliZSB0byBldmVudHMgdG8gZm9yd2FyZCBsb2dzIHRvIGV4dGVybmFsIHN5c3RlbXM6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqIGltcG9ydCBwaW5vIGZyb20gJ3Bpbm8nO1xuICpcbiAqIGNvbnN0IHBpbm9Mb2dnZXIgPSBwaW5vKHsgbGV2ZWw6ICdkZWJ1ZycgfSk7XG4gKlxuICogbG9nZ2VyLm9uKCdkZWJ1ZycsIChldmVudCkgPT4gcGlub0xvZ2dlci5kZWJ1ZyhldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICogbG9nZ2VyLm9uKCdpbmZvJywgKGV2ZW50KSA9PiBwaW5vTG9nZ2VyLmluZm8oZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAqIGxvZ2dlci5vbignd2FybicsIChldmVudCkgPT4gcGlub0xvZ2dlci53YXJuKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gKiBsb2dnZXIub24oJ2Vycm9yJywgKGV2ZW50KSA9PiBwaW5vTG9nZ2VyLmVycm9yKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBEaXJlY3QgdXNhZ2VcbiAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogbG9nZ2VyLmluZm8oJ1N0YXJ0aW5nIG9wZXJhdGlvbicpO1xuICogbG9nZ2VyLndhcm4oJ1Jlc291cmNlIGxpbWl0IGFwcHJvYWNoaW5nJywgeyB1c2FnZTogMC45IH0pO1xuICpcbiAqIHRyeSB7XG4gKiAgIGF3YWl0IHJpc2t5T3BlcmF0aW9uKCk7XG4gKiB9IGNhdGNoIChlcnIpIHtcbiAqICAgbG9nZ2VyLmxvZ0Vycm9yKGVyciwgJ1Jpc2t5IG9wZXJhdGlvbiBmYWlsZWQnKTtcbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3QgbG9nZ2VyID0gbmV3IExvZ2dlcigpO1xuIiwgIi8qKlxuICogSG9vayBmYWN0b3J5IGZ1bmN0aW9ucyBmb3IgQ2xhdWRlIENvZGUgaG9va3MuXG4gKlxuICogUHJvdmlkZXMgdHlwZWQgZmFjdG9yeSBmdW5jdGlvbnMgZm9yIGFsbCAxMiBob29rIHR5cGVzIHRoYXQgaGFuZGxlOlxuICogLSBJbnB1dCB0eXBlIG5hcnJvd2luZyBiYXNlZCBvbiBob29rIGV2ZW50IHR5cGVcbiAqIC0gT3V0cHV0IHR5cGUgZW5mb3JjZW1lbnQgdmlhIHJldHVybiB0eXBlc1xuICogLSBFcnJvciB3cmFwcGluZyB3aXRoIGF1dG9tYXRpYyBsb2dnaW5nXG4gKiAtIExvZ2dlciBjb250ZXh0IGluamVjdGlvblxuICpcbiAqIEVhY2ggZmFjdG9yeSBhY2NlcHRzIGEgSG9va0NvbmZpZyB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXQgc2V0dGluZ3MsXG4gKiBhbmQgcmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgdGhlIHJ1bnRpbWUgaW52b2tlcyB3aGVuIHRoZSBob29rIGZpbGUgZXhlY3V0ZXMuXG4gKiBAbW9kdWxlXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgcHJlVG9vbFVzZUhvb2ssIHByZVRvb2xVc2VPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIGV4cG9ydCBkZWZhdWx0IHByZVRvb2xVc2VIb29rKHsgbWF0Y2hlcjogJ0Jhc2gnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnUHJvY2Vzc2luZyBCYXNoIGNvbW1hbmQnKTtcbiAqICAgcmV0dXJuIHByZVRvb2xVc2VPdXRwdXQoeyBhbGxvdzogdHJ1ZSB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3NcbiAqL1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gR2VuZXJpYyBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBob29rIGZhY3RvcnkgZnVuY3Rpb24gZm9yIGEgc3BlY2lmaWMgaG9vayB0eXBlLlxuICpcbiAqIFRoaXMgaXMgdGhlIGludGVybmFsIGltcGxlbWVudGF0aW9uIHVzZWQgYnkgYWxsIHR5cGVkIGZhY3Rvcmllcy5cbiAqIEl0IHdyYXBzIHRoZSBoYW5kbGVyIHdpdGggZXJyb3IgY2F0Y2hpbmcgYW5kIGxvZ2dpbmcuXG4gKiBAcGFyYW0gaG9va0V2ZW50TmFtZSAtIFRoZSBob29rIGV2ZW50IG5hbWVcbiAqIEBwYXJhbSBjb25maWcgLSBIb29rIGNvbmZpZ3VyYXRpb25cbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gd3JhcFxuICogQHJldHVybnMgQSB3cmFwcGVkIGhvb2sgZnVuY3Rpb25cbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBjcmVhdGVIb29rRnVuY3Rpb24oaG9va0V2ZW50TmFtZSwgY29uZmlnLCBoYW5kbGVyKSB7XG4gIGNvbnN0IGhvb2tGbiA9IGFzeW5jIChpbnB1dCwgY29udGV4dCkgPT4ge1xuICAgIC8vIERlbGVnYXRlIGVycm9yIGhhbmRsaW5nIHRvIHRoZSBydW50aW1lIC0ganVzdCBleGVjdXRlIHRoZSBoYW5kbGVyXG4gICAgLy8gVGhlIHJ1bnRpbWUgd2lsbCBjYXRjaCBlcnJvcnMsIGxvZyB0aGVtLCBhbmQgcmV0dXJuIGFwcHJvcHJpYXRlIG91dHB1dFxuICAgIHJldHVybiBhd2FpdCBoYW5kbGVyKGlucHV0LCBjb250ZXh0KTtcbiAgfTtcbiAgLy8gQXR0YWNoIG1ldGFkYXRhIGZvciBydW50aW1lIGluc3BlY3Rpb25cbiAgaG9va0ZuLmhvb2tFdmVudE5hbWUgPSBob29rRXZlbnROYW1lO1xuICBob29rRm4ubWF0Y2hlciA9IGNvbmZpZy5tYXRjaGVyO1xuICBob29rRm4udGltZW91dCA9IGNvbmZpZy50aW1lb3V0O1xuICByZXR1cm4gaG9va0ZuO1xufVxuLyoqIEBpbmhlcml0ZG9jICovXG5leHBvcnQgZnVuY3Rpb24gcHJlVG9vbFVzZUhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oJ1ByZVRvb2xVc2UnLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLyoqIEBpbmhlcml0ZG9jICovXG5leHBvcnQgZnVuY3Rpb24gcG9zdFRvb2xVc2VIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKCdQb3N0VG9vbFVzZScsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwb3N0VG9vbFVzZUZhaWx1cmVIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKCdQb3N0VG9vbFVzZUZhaWx1cmUnLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gTm90aWZpY2F0aW9uIEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgTm90aWZpY2F0aW9uIGhvb2sgaGFuZGxlci5cbiAqXG4gKiBOb3RpZmljYXRpb24gaG9va3MgZmlyZSB3aGVuIENsYXVkZSBDb2RlIHNlbmRzIGEgbm90aWZpY2F0aW9uLCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEZvcndhcmQgbm90aWZpY2F0aW9ucyB0byBleHRlcm5hbCBzeXN0ZW1zXG4gKiAtIExvZyBpbXBvcnRhbnQgZXZlbnRzXG4gKiAtIFRyaWdnZXIgY3VzdG9tIGFsZXJ0aW5nXG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgbm90aWZpY2F0aW9uX3R5cGVgXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgbm90aWZpY2F0aW9uSG9vaywgbm90aWZpY2F0aW9uT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBGb3J3YXJkIG5vdGlmaWNhdGlvbnMgdG8gU2xhY2tcbiAqIGV4cG9ydCBkZWZhdWx0IG5vdGlmaWNhdGlvbkhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnTm90aWZpY2F0aW9uIHJlY2VpdmVkJywge1xuICogICAgIHR5cGU6IGlucHV0Lm5vdGlmaWNhdGlvbl90eXBlLFxuICogICAgIHRpdGxlOiBpbnB1dC50aXRsZVxuICogICB9KTtcbiAqXG4gKiAgIGF3YWl0IHNlbmRTbGFja01lc3NhZ2UoaW5wdXQudGl0bGUgPz8gJ05vdGlmaWNhdGlvbicsIGlucHV0Lm1lc3NhZ2UpO1xuICpcbiAqICAgcmV0dXJuIG5vdGlmaWNhdGlvbk91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI25vdGlmaWNhdGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gbm90aWZpY2F0aW9uSG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbignTm90aWZpY2F0aW9uJywgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFVzZXJQcm9tcHRTdWJtaXQgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBVc2VyUHJvbXB0U3VibWl0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBVc2VyUHJvbXB0U3VibWl0IGhvb2tzIGZpcmUgd2hlbiBhIHVzZXIgc3VibWl0cyBhIHByb21wdCwgYWxsb3dpbmcgeW91IHRvOlxuICogLSBBZGQgYWRkaXRpb25hbCBjb250ZXh0IG9yIGluc3RydWN0aW9uc1xuICogLSBMb2cgdXNlciBpbnRlcmFjdGlvbnNcbiAqIC0gVmFsaWRhdGUgb3IgdHJhbnNmb3JtIHByb21wdHNcbiAqXG4gKiAqKk1hdGNoZXIqKjogTm8gbWF0Y2hlciBzdXBwb3J0IC0gZmlyZXMgb24gYWxsIHByb21wdCBzdWJtaXNzaW9uc1xuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIHRpbWVvdXQgKG1hdGNoZXIgaXMgaWdub3JlZClcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHVzZXJQcm9tcHRTdWJtaXRIb29rLCB1c2VyUHJvbXB0U3VibWl0T3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBBZGQgcHJvamVjdCBjb250ZXh0IHRvIGV2ZXJ5IHByb21wdFxuICogZXhwb3J0IGRlZmF1bHQgdXNlclByb21wdFN1Ym1pdEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuZGVidWcoJ1VzZXIgcHJvbXB0IHN1Ym1pdHRlZCcsIHsgcHJvbXB0TGVuZ3RoOiBpbnB1dC5wcm9tcHQubGVuZ3RoIH0pO1xuICpcbiAqICAgY29uc3QgcHJvamVjdENvbnRleHQgPSBhd2FpdCBnZXRQcm9qZWN0Q29udGV4dCgpO1xuICpcbiAqICAgcmV0dXJuIHVzZXJQcm9tcHRTdWJtaXRPdXRwdXQoe1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiBwcm9qZWN0Q29udGV4dFxuICogICB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjdXNlcnByb21wdHN1Ym1pdFxuICovXG5leHBvcnQgZnVuY3Rpb24gdXNlclByb21wdFN1Ym1pdEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oJ1VzZXJQcm9tcHRTdWJtaXQnLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2Vzc2lvblN0YXJ0IEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgU2Vzc2lvblN0YXJ0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTZXNzaW9uU3RhcnQgaG9va3MgZmlyZSB3aGVuIGEgQ2xhdWRlIENvZGUgc2Vzc2lvbiBzdGFydHMgb3IgcmVzdGFydHMsXG4gKiBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEluaXRpYWxpemUgc2Vzc2lvbiBzdGF0ZVxuICogLSBJbmplY3QgY29udGV4dCBvciBpbnN0cnVjdGlvbnNcbiAqIC0gUGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIHN1YnNlcXVlbnQgYmFzaCBjb21tYW5kc1xuICogLSBTZXQgdXAgbG9nZ2luZyBvciBtb25pdG9yaW5nXG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgc291cmNlYCAoJ3N0YXJ0dXAnLCAncmVzdW1lJywgJ2NsZWFyJywgJ2NvbXBhY3QnKVxuICpcbiAqICoqQ29udGV4dCoqOiBTZXNzaW9uU3RhcnQgaG9va3MgcmVjZWl2ZSBhbiBleHRlbmRlZCBjb250ZXh0IHdpdGggYHBlcnNpc3RFbnZWYXJgXG4gKiBhbmQgYHBlcnNpc3RFbnZWYXJzYCBmdW5jdGlvbnMgZm9yIHNldHRpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHNlc3Npb25TdGFydEhvb2ssIHNlc3Npb25TdGFydE91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gUGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIHRoZSBzZXNzaW9uXG4gKiBleHBvcnQgZGVmYXVsdCBzZXNzaW9uU3RhcnRIb29rKHsgbWF0Y2hlcjogJ3N0YXJ0dXAnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIsIHBlcnNpc3RFbnZWYXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnTmV3IHNlc3Npb24gc3RhcnRlZCcsIHtcbiAqICAgICBzZXNzaW9uSWQ6IGlucHV0LnNlc3Npb25faWQsXG4gKiAgICAgY3dkOiBpbnB1dC5jd2RcbiAqICAgfSk7XG4gKlxuICogICAvLyBTZXQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciBhbGwgc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzXG4gKiAgIHBlcnNpc3RFbnZWYXIoJ05PREVfRU5WJywgJ2RldmVsb3BtZW50Jyk7XG4gKiAgIHBlcnNpc3RFbnZWYXIoJ0RFQlVHJywgJ3RydWUnKTtcbiAqXG4gKiAgIHJldHVybiBzZXNzaW9uU3RhcnRPdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBTZXQgbXVsdGlwbGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIGF0IG9uY2VcbiAqIGV4cG9ydCBkZWZhdWx0IHNlc3Npb25TdGFydEhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBwZXJzaXN0RW52VmFycyB9KSA9PiB7XG4gKiAgIHBlcnNpc3RFbnZWYXJzKHtcbiAqICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICogICAgIEFQSV9LRVk6ICdzZWNyZXQnLFxuICogICAgIERFQlVHOiAnZmFsc2UnXG4gKiAgIH0pO1xuICpcbiAqICAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3Nlc3Npb25zdGFydFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2Vzc2lvblN0YXJ0SG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbignU2Vzc2lvblN0YXJ0JywgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNlc3Npb25FbmQgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTZXNzaW9uRW5kIGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTZXNzaW9uRW5kIGhvb2tzIGZpcmUgd2hlbiBhIENsYXVkZSBDb2RlIHNlc3Npb24gZW5kcywgYWxsb3dpbmcgeW91IHRvOlxuICogLSBDbGVhbiB1cCBzZXNzaW9uIHJlc291cmNlc1xuICogLSBMb2cgc2Vzc2lvbiBtZXRyaWNzXG4gKiAtIFBlcnNpc3Qgc2Vzc2lvbiBzdGF0ZVxuICpcbiAqICoqTWF0Y2hlcioqOiBNYXRjaGVzIGFnYWluc3QgYHJlYXNvbmAgKHRoZSBleGl0IHJlYXNvbiBzdHJpbmcpXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc2Vzc2lvbkVuZEhvb2ssIHNlc3Npb25FbmRPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIExvZyBzZXNzaW9uIGVuZCBhbmQgY2xlYW4gdXBcbiAqIGV4cG9ydCBkZWZhdWx0IHNlc3Npb25FbmRIb29rKHt9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ1Nlc3Npb24gZW5kZWQnLCB7XG4gKiAgICAgc2Vzc2lvbklkOiBpbnB1dC5zZXNzaW9uX2lkLFxuICogICAgIHJlYXNvbjogaW5wdXQucmVhc29uXG4gKiAgIH0pO1xuICpcbiAqICAgYXdhaXQgY2xlYW51cFNlc3Npb25SZXNvdXJjZXMoaW5wdXQuc2Vzc2lvbl9pZCk7XG4gKlxuICogICByZXR1cm4gc2Vzc2lvbkVuZE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3Nlc3Npb25lbmRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlc3Npb25FbmRIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKCdTZXNzaW9uRW5kJywgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN0b3AgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTdG9wIGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTdG9wIGhvb2tzIGZpcmUgd2hlbiBDbGF1ZGUgQ29kZSBpcyBhYm91dCB0byBzdG9wLCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEJsb2NrIHRoZSBzdG9wIGFuZCByZXF1aXJlIGFkZGl0aW9uYWwgYWN0aW9uXG4gKiAtIENvbmZpcm0gdGhlIHVzZXIgd2FudHMgdG8gc3RvcFxuICogLSBDbGVhbiB1cCByZXNvdXJjZXMgYmVmb3JlIHN0b3BwaW5nXG4gKlxuICogKipNYXRjaGVyKio6IE5vIG1hdGNoZXIgc3VwcG9ydCAtIGZpcmVzIG9uIGFsbCBzdG9wIGV2ZW50c1xuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIHRpbWVvdXQgKG1hdGNoZXIgaXMgaWdub3JlZClcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHN0b3BIb29rLCBzdG9wT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBCbG9jayBzdG9wIGlmIHRoZXJlIGFyZSBwZW5kaW5nIGNoYW5nZXNcbiAqIGV4cG9ydCBkZWZhdWx0IHN0b3BIb29rKHt9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgY29uc3QgcGVuZGluZ0NoYW5nZXMgPSBhd2FpdCBjaGVja1BlbmRpbmdDaGFuZ2VzKCk7XG4gKlxuICogICBpZiAocGVuZGluZ0NoYW5nZXMubGVuZ3RoID4gMCkge1xuICogICAgIGxvZ2dlci53YXJuKCdCbG9ja2luZyBzdG9wIGR1ZSB0byBwZW5kaW5nIGNoYW5nZXMnLCB7XG4gKiAgICAgICBjb3VudDogcGVuZGluZ0NoYW5nZXMubGVuZ3RoXG4gKiAgICAgfSk7XG4gKlxuICogICAgIHJldHVybiBzdG9wT3V0cHV0KHtcbiAqICAgICAgIGRlY2lzaW9uOiAnYmxvY2snLFxuICogICAgICAgcmVhc29uOiBgVGhlcmUgYXJlICR7cGVuZGluZ0NoYW5nZXMubGVuZ3RofSB1bmNvbW1pdHRlZCBjaGFuZ2VzYCxcbiAqICAgICAgIHN5c3RlbU1lc3NhZ2U6ICdQbGVhc2UgY29tbWl0IG9yIGRpc2NhcmQgY2hhbmdlcyBiZWZvcmUgc3RvcHBpbmcnXG4gKiAgICAgfSk7XG4gKiAgIH1cbiAqXG4gKiAgIGxvZ2dlci5pbmZvKCdBcHByb3Zpbmcgc3RvcCcpO1xuICogICByZXR1cm4gc3RvcE91dHB1dCh7IGRlY2lzaW9uOiAnYXBwcm92ZScgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3N0b3BcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0b3BIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKCdTdG9wJywgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN1YmFnZW50U3RhcnQgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTdWJhZ2VudFN0YXJ0IGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTdWJhZ2VudFN0YXJ0IGhvb2tzIGZpcmUgd2hlbiBhIHN1YmFnZW50IChUYXNrIHRvb2wpIHN0YXJ0cywgYWxsb3dpbmcgeW91IHRvOlxuICogLSBJbmplY3QgY29udGV4dCBmb3IgdGhlIHN1YmFnZW50XG4gKiAtIExvZyBzdWJhZ2VudCBpbnZvY2F0aW9uc1xuICogLSBDb25maWd1cmUgc3ViYWdlbnQgYmVoYXZpb3JcbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGBhZ2VudF90eXBlYCAoZS5nLiwgJ2V4cGxvcmUnLCAnY29kZWJhc2UtYW5hbHlzaXMnKVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHN1YmFnZW50U3RhcnRIb29rLCBzdWJhZ2VudFN0YXJ0T3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBBZGQgY29udGV4dCBmb3IgZXhwbG9yZSBzdWJhZ2VudHNcbiAqIGV4cG9ydCBkZWZhdWx0IHN1YmFnZW50U3RhcnRIb29rKHsgbWF0Y2hlcjogJ2V4cGxvcmUnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnRXhwbG9yZSBzdWJhZ2VudCBzdGFydGluZycsIHtcbiAqICAgICBhZ2VudElkOiBpbnB1dC5hZ2VudF9pZCxcbiAqICAgICBhZ2VudFR5cGU6IGlucHV0LmFnZW50X3R5cGVcbiAqICAgfSk7XG4gKlxuICogICByZXR1cm4gc3ViYWdlbnRTdGFydE91dHB1dCh7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6ICdGb2N1cyBvbiBmaW5kaW5nIHBhdHRlcm5zIGFuZCBjb252ZW50aW9ucydcbiAqICAgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3N1YmFnZW50c3RhcnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1YmFnZW50U3RhcnRIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKCdTdWJhZ2VudFN0YXJ0JywgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN1YmFnZW50U3RvcCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFN1YmFnZW50U3RvcCBob29rIGhhbmRsZXIuXG4gKlxuICogU3ViYWdlbnRTdG9wIGhvb2tzIGZpcmUgd2hlbiBhIHN1YmFnZW50IGNvbXBsZXRlcyBvciBzdG9wcywgYWxsb3dpbmcgeW91IHRvOlxuICogLSBCbG9jayB0aGUgc3ViYWdlbnQgZnJvbSBzdG9wcGluZ1xuICogLSBQcm9jZXNzIHN1YmFnZW50IHJlc3VsdHNcbiAqIC0gQ2xlYW4gdXAgc3ViYWdlbnQgcmVzb3VyY2VzXG4gKiAtIExvZyBzdWJhZ2VudCBjb21wbGV0aW9uXG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgYWdlbnRfdHlwZWAgKGUuZy4sICdleHBsb3JlJywgJ2NvZGViYXNlLWFuYWx5c2lzJylcbiAqIEBwYXJhbSBjb25maWcgLSBIb29rIGNvbmZpZ3VyYXRpb24gd2l0aCBvcHRpb25hbCBtYXRjaGVyIGFuZCB0aW1lb3V0XG4gKiBAcGFyYW0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcbiAqIEByZXR1cm5zIEEgaG9vayBmdW5jdGlvbiB0aGF0IGNhbiBiZSBleHBvcnRlZCBhcyB0aGUgZGVmYXVsdCBleHBvcnRcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBzdWJhZ2VudFN0b3BIb29rLCBzdWJhZ2VudFN0b3BPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEJsb2NrIGV4cGxvcmUgc3ViYWdlbnRzIGlmIHRhc2sgaW5jb21wbGV0ZVxuICogZXhwb3J0IGRlZmF1bHQgc3ViYWdlbnRTdG9wSG9vayh7IG1hdGNoZXI6ICdleHBsb3JlJyB9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ1N1YmFnZW50IHN0b3BwaW5nJywge1xuICogICAgIGFnZW50SWQ6IGlucHV0LmFnZW50X2lkLFxuICogICAgIGFnZW50VHlwZTogaW5wdXQuYWdlbnRfdHlwZVxuICogICB9KTtcbiAqXG4gKiAgIC8vIEJsb2NrIGlmIHRyYW5zY3JpcHQgc2hvd3MgaW5jb21wbGV0ZSB3b3JrXG4gKiAgIHJldHVybiBzdWJhZ2VudFN0b3BPdXRwdXQoe1xuICogICAgIGRlY2lzaW9uOiAnYmxvY2snLFxuICogICAgIHJlYXNvbjogJ1BsZWFzZSB2ZXJpZnkgZXhwbG9yYXRpb24gaXMgY29tcGxldGUnXG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNzdWJhZ2VudHN0b3BcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1YmFnZW50U3RvcEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oJ1N1YmFnZW50U3RvcCcsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBQcmVDb21wYWN0IEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgUHJlQ29tcGFjdCBob29rIGhhbmRsZXIuXG4gKlxuICogUHJlQ29tcGFjdCBob29rcyBmaXJlIGJlZm9yZSBjb250ZXh0IGNvbXBhY3Rpb24gb2NjdXJzLCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIFByZXNlcnZlIGltcG9ydGFudCBpbmZvcm1hdGlvbiBiZWZvcmUgY29tcGFjdGlvblxuICogLSBMb2cgY29tcGFjdGlvbiBldmVudHNcbiAqIC0gTW9kaWZ5IGN1c3RvbSBpbnN0cnVjdGlvbnMgZm9yIHRoZSBjb21wYWN0ZWQgY29udGV4dFxuICpcbiAqICoqTWF0Y2hlcioqOiBNYXRjaGVzIGFnYWluc3QgYHRyaWdnZXJgICgnbWFudWFsJywgJ2F1dG8nKVxuICogQHBhcmFtIGNvbmZpZyAtIEhvb2sgY29uZmlndXJhdGlvbiB3aXRoIG9wdGlvbmFsIG1hdGNoZXIgYW5kIHRpbWVvdXRcbiAqIEBwYXJhbSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHJldHVybnMgQSBob29rIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIGV4cG9ydGVkIGFzIHRoZSBkZWZhdWx0IGV4cG9ydFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHByZUNvbXBhY3RIb29rLCBwcmVDb21wYWN0T3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBMb2cgY29tcGFjdGlvbiBldmVudHMgYW5kIHByZXNlcnZlIGNvbnRleHRcbiAqIGV4cG9ydCBkZWZhdWx0IHByZUNvbXBhY3RIb29rKHt9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ0NvbnRleHQgY29tcGFjdGlvbiB0cmlnZ2VyZWQnLCB7XG4gKiAgICAgdHJpZ2dlcjogaW5wdXQudHJpZ2dlcixcbiAqICAgICBoYXNDdXN0b21JbnN0cnVjdGlvbnM6IGlucHV0LmN1c3RvbV9pbnN0cnVjdGlvbnMgIT09IG51bGxcbiAqICAgfSk7XG4gKlxuICogICByZXR1cm4gcHJlQ29tcGFjdE91dHB1dCh7XG4gKiAgICAgc3lzdGVtTWVzc2FnZTogJ1JlbWVtYmVyOiBzdHJpY3QgbW9kZSBpcyBlbmFibGVkJ1xuICogICB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gT25seSBoYW5kbGUgbWFudWFsIGNvbXBhY3Rpb25cbiAqIGV4cG9ydCBkZWZhdWx0IHByZUNvbXBhY3RIb29rKHsgbWF0Y2hlcjogJ21hbnVhbCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdNYW51YWwgY29tcGFjdGlvbiByZXF1ZXN0ZWQnKTtcbiAqICAgcmV0dXJuIHByZUNvbXBhY3RPdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNwcmVjb21wYWN0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmVDb21wYWN0SG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbignUHJlQ29tcGFjdCcsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vKiogQGluaGVyaXRkb2MgKi9cbmV4cG9ydCBmdW5jdGlvbiBwZXJtaXNzaW9uUmVxdWVzdEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oJ1Blcm1pc3Npb25SZXF1ZXN0JywgY29uZmlnLCBoYW5kbGVyKTtcbn1cbiIsICIvKipcbiAqIEVudmlyb25tZW50IHZhcmlhYmxlIHV0aWxpdGllcyBmb3IgQ2xhdWRlIENvZGUgaG9va3MuXG4gKlxuICogUHJvdmlkZXMgdHlwZWQgYWNjZXNzIHRvIENsYXVkZSBDb2RlJ3MgZW52aXJvbm1lbnQgdmFyaWFibGVzIGFuZCB1dGlsaXRpZXNcbiAqIGZvciBwZXJzaXN0aW5nIGVudmlyb25tZW50IHZhcmlhYmxlcyBpbiBTZXNzaW9uU3RhcnQgaG9va3MuXG4gKlxuICogIyMgRW52aXJvbm1lbnQgVmFyaWFibGVzXG4gKlxuICogQ2xhdWRlIENvZGUgc2V0cyB0aGVzZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgd2hlbiBydW5uaW5nIGhvb2tzOlxuICpcbiAqIHwgVmFyaWFibGUgfCBEZXNjcmlwdGlvbiB8IEF2YWlsYWJsZSBJbiB8XG4gKiB8LS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tfFxuICogfCBgQ0xBVURFX1BST0pFQ1RfRElSYCB8IEFic29sdXRlIHBhdGggdG8gcHJvamVjdCByb290IHwgQWxsIGhvb2tzIHxcbiAqIHwgYENMQVVERV9FTlZfRklMRWAgfCBQYXRoIHRvIGZpbGUgZm9yIHBlcnNpc3RpbmcgZW52IHZhcnMgfCBTZXNzaW9uU3RhcnQgb25seSB8XG4gKiB8IGBDTEFVREVfQ09ERV9SRU1PVEVgIHwgYFwidHJ1ZVwiYCBpZiBydW5uaW5nIHJlbW90ZWx5IHwgQWxsIGhvb2tzIHxcbiAqIEBtb2R1bGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBnZXRQcm9qZWN0RGlyLCBwZXJzaXN0RW52VmFyLCBpc1JlbW90ZUVudmlyb25tZW50IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBHZXQgcHJvamVjdCBkaXJlY3RvcnlcbiAqIGNvbnN0IHByb2plY3REaXIgPSBnZXRQcm9qZWN0RGlyKCk7XG4gKlxuICogLy8gQ2hlY2sgaWYgcnVubmluZyByZW1vdGVseVxuICogaWYgKGlzUmVtb3RlRW52aXJvbm1lbnQoKSkge1xuICogICAvLyBIYW5kbGUgcmVtb3RlLXNwZWNpZmljIGxvZ2ljXG4gKiB9XG4gKlxuICogLy8gSW4gU2Vzc2lvblN0YXJ0IGhvb2s6IHBlcnNpc3QgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gKiBwZXJzaXN0RW52VmFyKCdOT0RFX0VOVicsICdwcm9kdWN0aW9uJyk7XG4gKiBwZXJzaXN0RW52VmFyKCdBUElfS0VZJywgJ3NlY3JldC1rZXknKTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI2hvb2stZXhlY3V0aW9uLWRldGFpbHNcbiAqL1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnbm9kZTpmcyc7XG4vKipcbiAqIENsYXVkZSBDb2RlIGVudmlyb25tZW50IHZhcmlhYmxlIG5hbWVzLlxuICpcbiAqIFRoZXNlIGFyZSB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIHRoYXQgQ2xhdWRlIENvZGUgc2V0cyB3aGVuIHJ1bm5pbmcgaG9va3MuXG4gKi9cbmV4cG9ydCBjb25zdCBDTEFVREVfRU5WX1ZBUlMgPSB7XG4gIC8qKlxuICAgKiBBYnNvbHV0ZSBwYXRoIHRvIHRoZSBwcm9qZWN0IHJvb3QgZGlyZWN0b3J5IHdoZXJlIENsYXVkZSBDb2RlIHdhcyBzdGFydGVkLlxuICAgKiBBdmFpbGFibGUgaW4gYWxsIGhvb2tzLlxuICAgKi9cbiAgUFJPSkVDVF9ESVI6ICdDTEFVREVfUFJPSkVDVF9ESVInLFxuICAvKipcbiAgICogUGF0aCB0byBhIGZpbGUgd2hlcmUgU2Vzc2lvblN0YXJ0IGhvb2tzIGNhbiBwZXJzaXN0IGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAgICogVmFyaWFibGVzIHdyaXR0ZW4gdG8gdGhpcyBmaWxlIHdpbGwgYmUgYXZhaWxhYmxlIGluIGFsbCBzdWJzZXF1ZW50IGJhc2ggY29tbWFuZHMuXG4gICAqIE9ubHkgYXZhaWxhYmxlIGluIFNlc3Npb25TdGFydCBob29rcy5cbiAgICovXG4gIEVOVl9GSUxFOiAnQ0xBVURFX0VOVl9GSUxFJyxcbiAgLyoqXG4gICAqIFNldCB0byBcInRydWVcIiB3aGVuIHJ1bm5pbmcgaW4gYSByZW1vdGUgKHdlYikgZW52aXJvbm1lbnQuXG4gICAqIE5vdCBzZXQgb3IgZW1wdHkgd2hlbiBydW5uaW5nIGluIGxvY2FsIENMSSBlbnZpcm9ubWVudC5cbiAgICovXG4gIFJFTU9URTogJ0NMQVVERV9DT0RFX1JFTU9URSdcbn07XG4vKipcbiAqIEdldHMgdGhlIENsYXVkZSBDb2RlIHByb2plY3QgZGlyZWN0b3J5LlxuICpcbiAqIFRoaXMgaXMgdGhlIGFic29sdXRlIHBhdGggdG8gdGhlIHByb2plY3Qgcm9vdCB3aGVyZSBDbGF1ZGUgQ29kZSB3YXMgc3RhcnRlZC5cbiAqIFRoZSB2YWx1ZSBjb21lcyBmcm9tIHRoZSBgQ0xBVURFX1BST0pFQ1RfRElSYCBlbnZpcm9ubWVudCB2YXJpYWJsZS5cbiAqIEByZXR1cm5zIFRoZSBwcm9qZWN0IGRpcmVjdG9yeSBwYXRoLCBvciB1bmRlZmluZWQgaWYgbm90IHNldFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IHByb2plY3REaXIgPSBnZXRQcm9qZWN0RGlyKCk7XG4gKiBpZiAocHJvamVjdERpcikge1xuICogICBjb25zdCBjb25maWdQYXRoID0gYCR7cHJvamVjdERpcn0vLmNsYXVkZS9jb25maWcuanNvbmA7XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFByb2plY3REaXIoKSB7XG4gIHJldHVybiBwcm9jZXNzLmVudltDTEFVREVfRU5WX1ZBUlMuUFJPSkVDVF9ESVJdO1xufVxuLyoqXG4gKiBHZXRzIHRoZSBDbGF1ZGUgQ29kZSBlbnYgZmlsZSBwYXRoIGZvciBwZXJzaXN0aW5nIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAqXG4gKiBUaGlzIGlzIG9ubHkgYXZhaWxhYmxlIGluIFNlc3Npb25TdGFydCBob29rcy4gVGhlIHBhdGggcG9pbnRzIHRvIGEgZmlsZVxuICogd2hlcmUgeW91IGNhbiB3cml0ZSBzaGVsbCBleHBvcnQgc3RhdGVtZW50cyB0byBwZXJzaXN0IGVudmlyb25tZW50IHZhcmlhYmxlc1xuICogZm9yIGFsbCBzdWJzZXF1ZW50IGJhc2ggY29tbWFuZHMgaW4gdGhlIHNlc3Npb24uXG4gKiBAcmV0dXJucyBUaGUgZW52IGZpbGUgcGF0aCwgb3IgdW5kZWZpbmVkIGlmIG5vdCBzZXQgKG5vdCBhIFNlc3Npb25TdGFydCBob29rKVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IGVudkZpbGUgPSBnZXRFbnZGaWxlUGF0aCgpO1xuICogaWYgKGVudkZpbGUpIHtcbiAqICAgLy8gV2UncmUgaW4gYSBTZXNzaW9uU3RhcnQgaG9vayBhbmQgY2FuIHBlcnNpc3QgZW52IHZhcnNcbiAqICAgcGVyc2lzdEVudlZhcignTVlfVkFSJywgJ215LXZhbHVlJyk7XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEVudkZpbGVQYXRoKCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnZbQ0xBVURFX0VOVl9WQVJTLkVOVl9GSUxFXTtcbn1cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBob29rIGlzIHJ1bm5pbmcgaW4gYSByZW1vdGUgKHdlYikgZW52aXJvbm1lbnQuXG4gKlxuICogUmVtb3RlIGVudmlyb25tZW50cyBtYXkgaGF2ZSBkaWZmZXJlbnQgY2FwYWJpbGl0aWVzIG9yIHJlc3RyaWN0aW9uc1xuICogY29tcGFyZWQgdG8gbG9jYWwgQ0xJIGVudmlyb25tZW50cy5cbiAqIEByZXR1cm5zIHRydWUgaWYgcnVubmluZyByZW1vdGVseSwgZmFsc2UgaWYgcnVubmluZyBsb2NhbGx5XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaWYgKGlzUmVtb3RlRW52aXJvbm1lbnQoKSkge1xuICogICAvLyBVc2Ugd2ViLWNvbXBhdGlibGUgYXBwcm9hY2hlc1xuICogfSBlbHNlIHtcbiAqICAgLy8gQ2FuIHVzZSBsb2NhbCBDTEkgZmVhdHVyZXNcbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNSZW1vdGVFbnZpcm9ubWVudCgpIHtcbiAgcmV0dXJuIHByb2Nlc3MuZW52W0NMQVVERV9FTlZfVkFSUy5SRU1PVEVdID09PSAndHJ1ZSc7XG59XG4vKipcbiAqIFBlcnNpc3RzIGFuIGVudmlyb25tZW50IHZhcmlhYmxlIGZvciB1c2UgaW4gc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gd3JpdGVzIGEgc2hlbGwgZXhwb3J0IHN0YXRlbWVudCB0byB0aGUgYENMQVVERV9FTlZfRklMRWAsXG4gKiB3aGljaCBDbGF1ZGUgQ29kZSBzb3VyY2VzIGJlZm9yZSBydW5uaW5nIGJhc2ggY29tbWFuZHMuIFRoaXMgYWxsb3dzXG4gKiBTZXNzaW9uU3RhcnQgaG9va3MgdG8gY29uZmlndXJlIHRoZSBlbnZpcm9ubWVudCBmb3IgdGhlIGVudGlyZSBzZXNzaW9uLlxuICpcbiAqICoqSW1wb3J0YW50Kio6IFRoaXMgZnVuY3Rpb24gb25seSB3b3JrcyBpbiBTZXNzaW9uU3RhcnQgaG9va3Mgd2hlcmVcbiAqIGBDTEFVREVfRU5WX0ZJTEVgIGlzIHNldC4gSW4gb3RoZXIgaG9va3MsIGl0IHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gKiBAcGFyYW0gbmFtZSAtIFRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBuYW1lXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgZW52aXJvbm1lbnQgdmFyaWFibGUgdmFsdWUgKHdpbGwgYmUgc2hlbGwtZXNjYXBlZClcbiAqIEB0aHJvd3MgRXJyb3IgaWYgQ0xBVURFX0VOVl9GSUxFIGlzIG5vdCBzZXQgKG5vdCBpbiBhIFNlc3Npb25TdGFydCBob29rKVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHNlc3Npb25TdGFydEhvb2ssIHNlc3Npb25TdGFydE91dHB1dCwgcGVyc2lzdEVudlZhciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogZXhwb3J0IGRlZmF1bHQgc2Vzc2lvblN0YXJ0SG9vayh7fSwgYXN5bmMgKGlucHV0KSA9PiB7XG4gKiAgIC8vIFBlcnNpc3QgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciB0aGUgc2Vzc2lvblxuICogICBwZXJzaXN0RW52VmFyKCdOT0RFX0VOVicsICdwcm9kdWN0aW9uJyk7XG4gKiAgIHBlcnNpc3RFbnZWYXIoJ0FQSV9LRVknLCBwcm9jZXNzLmVudi5NWV9BUElfS0VZID8/ICdkZWZhdWx0Jyk7XG4gKiAgIHBlcnNpc3RFbnZWYXIoJ1BBVEgnLCBgJHtwcm9jZXNzLmVudi5QQVRIfTouL25vZGVfbW9kdWxlcy8uYmluYCk7XG4gKlxuICogICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHt9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjcGVyc2lzdGluZy1lbnZpcm9ubWVudC12YXJpYWJsZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBlcnNpc3RFbnZWYXIobmFtZSwgdmFsdWUpIHtcbiAgY29uc3QgZW52RmlsZSA9IGdldEVudkZpbGVQYXRoKCk7XG4gIGlmIChlbnZGaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAncGVyc2lzdEVudlZhciBjYW4gb25seSBiZSB1c2VkIGluIFNlc3Npb25TdGFydCBob29rcy4gJyArICdDTEFVREVfRU5WX0ZJTEUgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgbm90IHNldC4nXG4gICAgKTtcbiAgfVxuICAvLyBTaGVsbC1lc2NhcGUgdGhlIHZhbHVlIHRvIGhhbmRsZSBzcGVjaWFsIGNoYXJhY3RlcnNcbiAgY29uc3QgZXNjYXBlZFZhbHVlID0gZXNjYXBlU2hlbGxWYWx1ZSh2YWx1ZSk7XG4gIC8vIFdyaXRlIHRoZSBleHBvcnQgc3RhdGVtZW50XG4gIGNvbnN0IGV4cG9ydFN0YXRlbWVudCA9IGBleHBvcnQgJHtuYW1lfT0ke2VzY2FwZWRWYWx1ZX1cXG5gO1xuICBmcy5hcHBlbmRGaWxlU3luYyhlbnZGaWxlLCBleHBvcnRTdGF0ZW1lbnQsICd1dGYtOCcpO1xufVxuLyoqXG4gKiBQZXJzaXN0cyBtdWx0aXBsZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYXQgb25jZS5cbiAqXG4gKiBUaGlzIGlzIGEgY29udmVuaWVuY2Ugd3JhcHBlciBhcm91bmQgYHBlcnNpc3RFbnZWYXJgIGZvciBzZXR0aW5nXG4gKiBtdWx0aXBsZSB2YXJpYWJsZXMgaW4gYSBzaW5nbGUgY2FsbC5cbiAqIEBwYXJhbSB2YXJzIC0gT2JqZWN0IG1hcHBpbmcgdmFyaWFibGUgbmFtZXMgdG8gdmFsdWVzXG4gKiBAdGhyb3dzIEVycm9yIGlmIENMQVVERV9FTlZfRklMRSBpcyBub3Qgc2V0IChub3QgaW4gYSBTZXNzaW9uU3RhcnQgaG9vaylcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBwZXJzaXN0RW52VmFycyh7XG4gKiAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXG4gKiAgIEFQSV9LRVk6ICdzZWNyZXQnLFxuICogICBERUJVRzogJ2ZhbHNlJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBlcnNpc3RFbnZWYXJzKHZhcnMpIHtcbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHZhcnMpKSB7XG4gICAgcGVyc2lzdEVudlZhcihuYW1lLCB2YWx1ZSk7XG4gIH1cbn1cbi8qKlxuICogRXNjYXBlcyBhIHZhbHVlIGZvciBzYWZlIHVzZSBpbiBhIHNoZWxsIGV4cG9ydCBzdGF0ZW1lbnQuXG4gKlxuICogVXNlcyBzaW5nbGUgcXVvdGVzIGFuZCBlc2NhcGVzIGFueSBlbWJlZGRlZCBzaW5nbGUgcXVvdGVzLlxuICogVGhpcyBwcmV2ZW50cyBzaGVsbCBpbmplY3Rpb24gYW5kIGhhbmRsZXMgc3BlY2lhbCBjaGFyYWN0ZXJzLlxuICogQHBhcmFtIHZhbHVlIC0gVGhlIHZhbHVlIHRvIGVzY2FwZVxuICogQHJldHVybnMgVGhlIHNoZWxsLWVzY2FwZWQgdmFsdWUgKHdpdGggcXVvdGVzKVxuICogQGludGVybmFsXG4gKi9cbmZ1bmN0aW9uIGVzY2FwZVNoZWxsVmFsdWUodmFsdWUpIHtcbiAgLy8gVXNlIHNpbmdsZSBxdW90ZXMgYW5kIGVzY2FwZSBhbnkgZW1iZWRkZWQgc2luZ2xlIHF1b3Rlc1xuICAvLyAndmFsdWUnIC0+ICd2YWwnXFwnJ3VlJyBmb3IgdmFsdWVzIGNvbnRhaW5pbmcgc2luZ2xlIHF1b3Rlc1xuICBjb25zdCBlc2NhcGVkID0gdmFsdWUucmVwbGFjZSgvJy9nLCBcIidcXFxcJydcIik7XG4gIHJldHVybiBgJyR7ZXNjYXBlZH0nYDtcbn1cbiIsICIvKipcbiAqIFJ1bnRpbWUgbW9kdWxlIGZvciBDbGF1ZGUgQ29kZSBob29rcy5cbiAqXG4gKiBIYW5kbGVzIHN0ZGluL3N0ZG91dC9leGl0IGNvZGUgc2VtYW50aWNzIGZvciBjb21waWxlZCBob29rIGV4ZWN1dGlvbi5cbiAqIFRoaXMgbW9kdWxlIGlzIHRoZSBjb3JlIG9yY2hlc3RyYXRvciB0aGF0OlxuICogLSBSZWFkcyBKU09OIGZyb20gc3RkaW4gKHdpcmUgZm9ybWF0IHdpdGggc25ha2VfY2FzZSBwcm9wZXJ0aWVzKVxuICogLSBJbnZva2VzIHRoZSBob29rIGhhbmRsZXJcbiAqIC0gV3JpdGVzIG91dHB1dCB0byBzdGRvdXRcbiAqIC0gTWFuYWdlcyBleGl0IGNvZGVzXG4gKiBAbW9kdWxlXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gSW4gYSBjb21waWxlZCBob29rIGZpbGVcbiAqIGltcG9ydCB7IGV4ZWN1dGUgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MvcnVudGltZSc7XG4gKiBpbXBvcnQgbXlIb29rIGZyb20gJy4vbXktaG9vay5qcyc7XG4gKlxuICogZXhlY3V0ZShteUhvb2spO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3NcbiAqL1xuaW1wb3J0IHsgcGVyc2lzdEVudlZhciwgcGVyc2lzdEVudlZhcnMgfSBmcm9tICcuL2Vudi5qcyc7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tICcuL2xvZ2dlci5qcyc7XG5pbXBvcnQgeyBFWElUX0NPREVTIH0gZnJvbSAnLi9vdXRwdXRzLmpzJztcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN0ZGluL1N0ZG91dCBIYW5kbGluZ1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBSZWFkcyBhbGwgZGF0YSBmcm9tIHN0ZGluLlxuICogQHJldHVybnMgUHJvbWlzZSByZXNvbHZpbmcgdG8gdGhlIGNvbXBsZXRlIHN0ZGluIGNvbnRlbnRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVhZFN0ZGluKCkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgIC8vIFNldCBlbmNvZGluZyBmaXJzdCB0byBlbnN1cmUgZGF0YSBldmVudHMgcmVjZWl2ZSBzdHJpbmdzXG4gICAgcHJvY2Vzcy5zdGRpbi5zZXRFbmNvZGluZygndXRmLTgnKTtcbiAgICBwcm9jZXNzLnN0ZGluLm9uKCdkYXRhJywgKGNodW5rKSA9PiB7XG4gICAgICBjaHVua3MucHVzaChjaHVuayk7XG4gICAgfSk7XG4gICAgcHJvY2Vzcy5zdGRpbi5vbignZW5kJywgKCkgPT4ge1xuICAgICAgcmVzb2x2ZShjaHVua3Muam9pbignJykpO1xuICAgIH0pO1xuICAgIHByb2Nlc3Muc3RkaW4ub24oJ2Vycm9yJywgKGVycm9yKSA9PiB7XG4gICAgICByZWplY3QoZXJyb3IpO1xuICAgIH0pO1xuICB9KTtcbn1cbi8qKlxuICogUGFyc2VzIHN0ZGluIEpTT04gaW5wdXQuXG4gKiBAcGFyYW0gc3RkaW5Db250ZW50IC0gUmF3IHN0ZGluIGNvbnRlbnRcbiAqIEByZXR1cm5zIFBhcnNlZCBpbnB1dCAod2lyZSBmb3JtYXQgd2l0aCBzbmFrZV9jYXNlIHByb3BlcnRpZXMpXG4gKiBAdGhyb3dzIEVycm9yIGlmIEpTT04gaXMgbWFsZm9ybWVkXG4gKi9cbmZ1bmN0aW9uIHBhcnNlU3RkaW5JbnB1dChzdGRpbkNvbnRlbnQpIHtcbiAgLy8gUGFyc2UgSlNPTiAtIGlucHV0IHVzZXMgd2lyZSBmb3JtYXQgKHNuYWtlX2Nhc2UpIGRpcmVjdGx5XG4gIGNvbnN0IHJhd0lucHV0ID0gSlNPTi5wYXJzZShzdGRpbkNvbnRlbnQpO1xuICByZXR1cm4gcmF3SW5wdXQ7XG59XG4vKipcbiAqIFdyaXRlcyBob29rIG91dHB1dCB0byBzdGRvdXQuXG4gKlxuICogT3V0cHV0IHVzZXMgY2FtZWxDYXNlIGtleXMgcGVyIENsYXVkZSBDb2RlIGhvb2sgc3BlY2lmaWNhdGlvbi5cbiAqIEBwYXJhbSBvdXRwdXQgLSBUaGUgaG9vayBvdXRwdXQgdG8gd3JpdGVcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNob29rLW91dHB1dC1zdHJ1Y3R1cmVcbiAqL1xuZnVuY3Rpb24gd3JpdGVTdGRvdXQob3V0cHV0KSB7XG4gIC8vIE91dHB1dCB1c2VzIGNhbWVsQ2FzZSAtIG5vIHRyYW5zZm9ybWF0aW9uIG5lZWRlZFxuICBwcm9jZXNzLnN0ZG91dC53cml0ZShKU09OLnN0cmluZ2lmeShvdXRwdXQpKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEVycm9yIEhhbmRsaW5nXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYW4gZXJyb3Igb3V0cHV0IGZvciBtYWxmb3JtZWQgc3RkaW4gSlNPTi5cbiAqIEBwYXJhbSBlcnJvciAtIFRoZSBwYXJzZSBlcnJvclxuICogQHJldHVybnMgSG9va091dHB1dCB3aXRoIGVtcHR5IHN0ZG91dFxuICovXG5mdW5jdGlvbiBjcmVhdGVNYWxmb3JtZWRJbnB1dE91dHB1dChlcnJvcikge1xuICBsb2dnZXIuZXJyb3IoYEludmFsaWQgSlNPTiBpbnB1dDogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCk7XG4gIHJldHVybiB7IHN0ZG91dDoge30gfTtcbn1cbi8qKlxuICogV3JpdGVzIGhhbmRsZXIgZXJyb3Igc3RhY2t0cmFjZSB0byBzdGRlcnIgYW5kIGV4aXRzIHdpdGggY29kZSAyLlxuICpcbiAqIFdoZW4gYSBob29rIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbjpcbiAqIC0gU3RhY2t0cmFjZSAod2l0aCBzb3VyY2VtYXBzIGlmIGF2YWlsYWJsZSkgaXMgb3V0cHV0IHRvIHN0ZGVyclxuICogLSBQcm9jZXNzIGV4aXRzIHdpdGggY29kZSAyIChCTE9DSylcbiAqIC0gTm8gSlNPTiBpcyBvdXRwdXQgdG8gc3Rkb3V0XG4gKiBAcGFyYW0gZXJyb3IgLSBUaGUgZXJyb3IgdGhyb3duIGJ5IHRoZSBoYW5kbGVyXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZUhhbmRsZXJFcnJvcihlcnJvcikge1xuICAvLyBXcml0ZSBzdGFjayB0cmFjZSB0byBzdGRlcnIgKHNvdXJjZW1hcHMgYXJlIGFwcGxpZWQgYXV0b21hdGljYWxseSBieSBOb2RlLmpzKVxuICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKGAke2Vycm9yLnN0YWNrID8/IGVycm9yLm1lc3NhZ2V9XFxuYCk7XG4gIH0gZWxzZSB7XG4gICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoYCR7U3RyaW5nKGVycm9yKX1cXG5gKTtcbiAgfVxuICAvLyBMb2cgdG8gZmlsZSBpZiBjb25maWd1cmVkXG4gIGxvZ2dlci5lcnJvcihgSG9vayBoYW5kbGVyIGVycm9yOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gKTtcbiAgLy8gQ2xlYXIgbG9nZ2VyIGNvbnRleHQgYW5kIGNsb3NlXG4gIGxvZ2dlci5jbGVhckNvbnRleHQoKTtcbiAgbG9nZ2VyLmNsb3NlKCk7XG4gIC8vIEV4aXQgd2l0aCBjb2RlIDIgKEJMT0NLKSAtIG5vIEpTT04gb3V0cHV0XG4gIHByb2Nlc3MuZXhpdChFWElUX0NPREVTLkJMT0NLKTtcbn1cbi8qKlxuICogQ29udmVydHMgYSBTcGVjaWZpY0hvb2tPdXRwdXQgdG8gSG9va091dHB1dCBmb3Igd2lyZSBmb3JtYXQuXG4gKlxuICogU3BlY2lmaWNIb29rT3V0cHV0IHR5cGVzIGhhdmU6IHsgX3R5cGUsIGV4aXRDb2RlLCBzdGRvdXQsIHN0ZGVycj8gfVxuICogSG9va091dHB1dCBoYXM6IHsgZXhpdENvZGUsIHN0ZG91dCwgc3RkZXJyPyB9XG4gKlxuICogU2luY2Ugb3V0cHV0IGJ1aWxkZXJzIG5vdyBwcm9kdWNlIHdpcmUtZm9ybWF0IGRpcmVjdGx5LCB0aGlzIGZ1bmN0aW9uXG4gKiBzaW1wbHkgc3RyaXBzIHRoZSBgX3R5cGVgIGRpc2NyaW1pbmF0b3IgZmllbGQuXG4gKiBAcGFyYW0gc3BlY2lmaWNPdXRwdXQgLSBUaGUgc3BlY2lmaWMgb3V0cHV0IGZyb20gYSBob29rIGhhbmRsZXJcbiAqIEByZXR1cm5zIEhvb2tPdXRwdXQgcmVhZHkgZm9yIHNlcmlhbGl6YXRpb25cbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNob29rLW91dHB1dC1zdHJ1Y3R1cmVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBzcGVjaWZpY091dHB1dCA9IHByZVRvb2xVc2VPdXRwdXQoeyBob29rU3BlY2lmaWNPdXRwdXQ6IHsgcGVybWlzc2lvbkRlY2lzaW9uOiAnYWxsb3cnIH0gfSk7XG4gKiBjb25zdCBob29rT3V0cHV0ID0gY29udmVydFRvSG9va091dHB1dChzcGVjaWZpY091dHB1dCk7XG4gKiAvLyBob29rT3V0cHV0OiB7IGV4aXRDb2RlOiAwLCBzdGRvdXQ6IHsgaG9va1NwZWNpZmljT3V0cHV0OiB7IC4uLiB9IH0gfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0VG9Ib29rT3V0cHV0KHNwZWNpZmljT3V0cHV0KSB7XG4gIHJldHVybiB7IHN0ZG91dDogc3BlY2lmaWNPdXRwdXQuc3Rkb3V0IH07XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBFeGVjdXRlIEZ1bmN0aW9uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIEV4ZWN1dGVzIGEgaG9vayBoYW5kbGVyIHdpdGggZnVsbCBydW50aW1lIG9yY2hlc3RyYXRpb24uXG4gKlxuICogVGhpcyBpcyB0aGUgbWFpbiBlbnRyeSBwb2ludCB0aGF0IGNvbXBpbGVkIGhvb2tzIHVzZS4gV2hlbiBhIGNvbXBpbGVkIGhvb2tcbiAqIHJ1bnMgYXMgYSBDTEk6XG4gKlxuICogMS4gUmVhZHMgYWxsIHN0ZGluXG4gKiAyLiBQYXJzZXMgSlNPTiAod2lyZSBmb3JtYXQgd2l0aCBzbmFrZV9jYXNlIHByb3BlcnRpZXMpXG4gKiAzLiBTZXRzIHVwIGxvZ2dlciBjb250ZXh0IChob29rVHlwZSwgaW5wdXQpXG4gKiA0LiBDYWxscyBoYW5kbGVyIHdpdGggaW5wdXQgYW5kIGNvbnRleHQgKGxvZ2dlcilcbiAqIDUuIEhhbmRsZXMgYW55IGVycm9ycywgbG9ncyB0aGVtXG4gKiA2LiBXcml0ZXMgSlNPTiB0byBzdGRvdXRcbiAqIDcuIENsb3NlcyBsb2dnZXJcbiAqIDguIEV4aXRzIHdpdGggYXBwcm9wcmlhdGUgY29kZVxuICogQHBhcmFtIGhvb2tGbiAtIFRoZSBob29rIGZ1bmN0aW9uIHRvIGV4ZWN1dGUgKGZyb20gaG9vayBmYWN0b3J5KVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEluIGNvbXBpbGVkIGhvb2sgZmlsZVxuICogaW1wb3J0IHsgZXhlY3V0ZSB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcy9ydW50aW1lJztcbiAqIGltcG9ydCB7IHByZVRvb2xVc2VIb29rLCBwcmVUb29sVXNlT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiBjb25zdCBteUhvb2sgPSBwcmVUb29sVXNlSG9vayh7IG1hdGNoZXI6ICdCYXNoJyB9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ1Byb2Nlc3NpbmcgQmFzaCBjb21tYW5kJyk7XG4gKiAgIHJldHVybiBwcmVUb29sVXNlT3V0cHV0KHsgYWxsb3c6IHRydWUgfSk7XG4gKiB9KTtcbiAqXG4gKiBleGVjdXRlKG15SG9vayk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZShob29rRm4pIHtcbiAgbGV0IG91dHB1dDtcbiAgdHJ5IHtcbiAgICAvLyBDaGVjayBmb3IgbG9nIGZpbGUgY29uZmlndXJhdGlvbiBjb25mbGljdHNcbiAgICAvLyBDTEFVREVfQ09ERV9IT09LU19DTElfTE9HX0ZJTEUgaXMgaW5qZWN0ZWQgYnkgdGhlIENMSSAtLWxvZyBwYXJhbWV0ZXJcbiAgICAvLyBDTEFVREVfQ09ERV9IT09LU19MT0dfRklMRSBpcyB0aGUgdXNlcidzIGVudmlyb25tZW50IHZhcmlhYmxlXG4gICAgY29uc3QgY2xpTG9nRmlsZSA9IHByb2Nlc3MuZW52WydDTEFVREVfQ09ERV9IT09LU19DTElfTE9HX0ZJTEUnXTtcbiAgICBjb25zdCBlbnZMb2dGaWxlID0gcHJvY2Vzcy5lbnZbJ0NMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFJ107XG4gICAgaWYgKGNsaUxvZ0ZpbGUgIT09IHVuZGVmaW5lZCAmJiBlbnZMb2dGaWxlICE9PSB1bmRlZmluZWQgJiYgY2xpTG9nRmlsZSAhPT0gZW52TG9nRmlsZSkge1xuICAgICAgLy8gV3JpdGUgZXJyb3IgdG8gc3RkZXJyIGFuZCBleGl0IHdpdGggZXJyb3IgY29kZVxuICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgIGBMb2cgZmlsZSBjb25maWd1cmF0aW9uIGNvbmZsaWN0OiBDTEkgLS1sb2c9XCIke2NsaUxvZ0ZpbGV9XCIgdnMgQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEU9XCIke2VudkxvZ0ZpbGV9XCIuIGAgK1xuICAgICAgICAgICdVc2Ugb25seSBvbmUgbWV0aG9kIHRvIGNvbmZpZ3VyZSBob29rIGxvZ2dpbmcuXFxuJ1xuICAgICAgKTtcbiAgICAgIHByb2Nlc3MuZXhpdChFWElUX0NPREVTLkVSUk9SKTtcbiAgICB9XG4gICAgLy8gSWYgQ0xJIGxvZyBmaWxlIGlzIHNldCwgY29uZmlndXJlIHRoZSBsb2dnZXJcbiAgICBpZiAoY2xpTG9nRmlsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsb2dnZXIuc2V0TG9nRmlsZShjbGlMb2dGaWxlKTtcbiAgICB9XG4gICAgLy8gUmVhZCBhbmQgcGFyc2Ugc3RkaW5cbiAgICBsZXQgc3RkaW5Db250ZW50O1xuICAgIHRyeSB7XG4gICAgICBzdGRpbkNvbnRlbnQgPSBhd2FpdCByZWFkU3RkaW4oKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nZ2VyLmxvZ0Vycm9yKGVycm9yLCAnRmFpbGVkIHRvIHJlYWQgc3RkaW4nKTtcbiAgICAgIG91dHB1dCA9IGNyZWF0ZU1hbGZvcm1lZElucHV0T3V0cHV0KGVycm9yKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gUGFyc2UgYW5kIHRyYW5zZm9ybSBpbnB1dFxuICAgIGxldCBpbnB1dDtcbiAgICB0cnkge1xuICAgICAgaW5wdXQgPSBwYXJzZVN0ZGluSW5wdXQoc3RkaW5Db250ZW50KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nZ2VyLmxvZ0Vycm9yKGVycm9yLCAnRmFpbGVkIHRvIHBhcnNlIHN0ZGluIEpTT04nKTtcbiAgICAgIG91dHB1dCA9IGNyZWF0ZU1hbGZvcm1lZElucHV0T3V0cHV0KGVycm9yKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gU2V0IGxvZ2dlciBjb250ZXh0XG4gICAgY29uc3QgaG9va0V2ZW50TmFtZSA9IGhvb2tGbi5ob29rRXZlbnROYW1lO1xuICAgIGxvZ2dlci5zZXRDb250ZXh0KGhvb2tFdmVudE5hbWUsIGlucHV0KTtcbiAgICAvLyBCdWlsZCBjb250ZXh0IC0gU2Vzc2lvblN0YXJ0IGhvb2tzIGdldCBleHRlbmRlZCBjb250ZXh0IHdpdGggcGVyc2lzdEVudlZhclxuICAgIGNvbnN0IGNvbnRleHQgPSBob29rRXZlbnROYW1lID09PSAnU2Vzc2lvblN0YXJ0JyA/IHsgbG9nZ2VyLCBwZXJzaXN0RW52VmFyLCBwZXJzaXN0RW52VmFycyB9IDogeyBsb2dnZXIgfTtcbiAgICAvLyBFeGVjdXRlIGhhbmRsZXJcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3BlY2lmaWNPdXRwdXQgPSBhd2FpdCBob29rRm4oaW5wdXQsIGNvbnRleHQpO1xuICAgICAgb3V0cHV0ID0gY29udmVydFRvSG9va091dHB1dChzcGVjaWZpY091dHB1dCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIEhhbmRsZXIgdGhyZXcgLSBvdXRwdXQgc3RhY2t0cmFjZSB0byBzdGRlcnIgYW5kIGV4aXQgd2l0aCBjb2RlIDJcbiAgICAgIC8vIFRoaXMgY2FsbCBuZXZlciByZXR1cm5zIChwcm9jZXNzLmV4aXQpXG4gICAgICBoYW5kbGVIYW5kbGVyRXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBXcml0ZSBvdXRwdXQgaWYgd2UgaGF2ZSBpdFxuICAgIGlmIChvdXRwdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgd3JpdGVTdGRvdXQob3V0cHV0LnN0ZG91dCk7XG4gICAgfVxuICAgIC8vIENsZWFyIGxvZ2dlciBjb250ZXh0XG4gICAgbG9nZ2VyLmNsZWFyQ29udGV4dCgpO1xuICAgIGxvZ2dlci5jbG9zZSgpO1xuICAgIC8vIEV4aXQgd2l0aCBzdWNjZXNzIChoYW5kbGVyIGVycm9ycyBleGl0IHZpYSBoYW5kbGVIYW5kbGVyRXJyb3Igd2l0aCBjb2RlIDIpXG4gICAgcHJvY2Vzcy5leGl0KEVYSVRfQ09ERVMuU1VDQ0VTUyk7XG4gIH1cbn1cbiIsICIvKipcbiAqIFR5cGUgZ3VhcmRzIGFuZCBoZWxwZXIgZnVuY3Rpb25zIGZvciBDbGF1ZGUgQ29kZSB0b29sIGlucHV0cy5cbiAqXG4gKiBQcm92aWRlcyBzYWZlIHR5cGUgbmFycm93aW5nIGZvciB0b29sIGlucHV0cyBhbmQgdXRpbGl0eSBmdW5jdGlvbnNcbiAqIGZvciBjb21tb24gcGF0dGVybnMgbGlrZSBmaWxlIHBhdGggZXh0cmFjdGlvbiBhbmQgY29udGVudCBpbnNwZWN0aW9uLlxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7XG4gKiAgIHByZVRvb2xVc2VIb29rLFxuICogICBwcmVUb29sVXNlT3V0cHV0LFxuICogICBpc1dyaXRlVG9vbCxcbiAqICAgZ2V0RmlsZVBhdGgsXG4gKiAgIGlzVHNGaWxlLFxuICogICBjaGVja0NvbnRlbnRGb3JQYXR0ZXJuXG4gKiB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogZXhwb3J0IGRlZmF1bHQgcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnV3JpdGV8RWRpdHxNdWx0aUVkaXQnIH0sIChpbnB1dCkgPT4ge1xuICogICBjb25zdCBmaWxlUGF0aCA9IGdldEZpbGVQYXRoKGlucHV0KTtcbiAqICAgaWYgKCFmaWxlUGF0aCB8fCAhaXNUc0ZpbGUoZmlsZVBhdGgpKSByZXR1cm4gcHJlVG9vbFVzZU91dHB1dCh7fSk7XG4gKlxuICogICBjb25zdCByZXN1bHQgPSBjaGVja0NvbnRlbnRGb3JQYXR0ZXJuKGlucHV0LCAvQHRzLWlnbm9yZS9nKTtcbiAqICAgaWYgKHJlc3VsdD8uaXNBZGRpdGlvbikge1xuICogICAgIHJldHVybiBwcmVUb29sVXNlT3V0cHV0KHtcbiAqICAgICAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgICAgICBwZXJtaXNzaW9uRGVjaXNpb246ICdkZW55JyxcbiAqICAgICAgICAgcGVybWlzc2lvbkRlY2lzaW9uUmVhc29uOiBgQ2Fubm90IGFkZDogJHtyZXN1bHQubWF0Y2hlcy5qb2luKCcsICcpfWBcbiAqICAgICAgIH1cbiAqICAgICB9KTtcbiAqICAgfVxuICpcbiAqICAgcmV0dXJuIHByZVRvb2xVc2VPdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICogQG1vZHVsZVxuICovXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBUeXBlIEd1YXJkc1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBUeXBlIGd1YXJkIGZvciBXcml0ZSB0b29sIGlucHV0cy5cbiAqXG4gKiBOYXJyb3dzIHRoZSBpbnB1dCB0eXBlIHRvIGluY2x1ZGUgYSB0eXBlZCBXcml0ZVRvb2xJbnB1dC5cbiAqIEBwYXJhbSBpbnB1dCAtIFRoZSBob29rIGlucHV0IHRvIGNoZWNrXG4gKiBAcmV0dXJucyBUcnVlIGlmIHRoZSBpbnB1dCBpcyBmb3IgYSBXcml0ZSB0b29sXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaWYgKGlzV3JpdGVUb29sKGlucHV0KSkge1xuICogICAvLyBpbnB1dC50b29sX2lucHV0IGlzIG5vdyB0eXBlZCBhcyBXcml0ZVRvb2xJbnB1dFxuICogICBjb25zb2xlLmxvZyhpbnB1dC50b29sX2lucHV0LmZpbGVfcGF0aCk7XG4gKiAgIGNvbnNvbGUubG9nKGlucHV0LnRvb2xfaW5wdXQuY29udGVudCk7XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzV3JpdGVUb29sKGlucHV0KSB7XG4gIHJldHVybiBpbnB1dC50b29sX25hbWUgPT09ICdXcml0ZSc7XG59XG4vKipcbiAqIFR5cGUgZ3VhcmQgZm9yIEVkaXQgdG9vbCBpbnB1dHMuXG4gKlxuICogTmFycm93cyB0aGUgaW5wdXQgdHlwZSB0byBpbmNsdWRlIGEgdHlwZWQgRWRpdFRvb2xJbnB1dC5cbiAqIEBwYXJhbSBpbnB1dCAtIFRoZSBob29rIGlucHV0IHRvIGNoZWNrXG4gKiBAcmV0dXJucyBUcnVlIGlmIHRoZSBpbnB1dCBpcyBmb3IgYW4gRWRpdCB0b29sXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaWYgKGlzRWRpdFRvb2woaW5wdXQpKSB7XG4gKiAgIGNvbnNvbGUubG9nKGlucHV0LnRvb2xfaW5wdXQub2xkX3N0cmluZyk7XG4gKiAgIGNvbnNvbGUubG9nKGlucHV0LnRvb2xfaW5wdXQubmV3X3N0cmluZyk7XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRWRpdFRvb2woaW5wdXQpIHtcbiAgcmV0dXJuIGlucHV0LnRvb2xfbmFtZSA9PT0gJ0VkaXQnO1xufVxuLyoqXG4gKiBUeXBlIGd1YXJkIGZvciBNdWx0aUVkaXQgdG9vbCBpbnB1dHMuXG4gKlxuICogTmFycm93cyB0aGUgaW5wdXQgdHlwZSB0byBpbmNsdWRlIGEgdHlwZWQgTXVsdGlFZGl0VG9vbElucHV0LlxuICogQHBhcmFtIGlucHV0IC0gVGhlIGhvb2sgaW5wdXQgdG8gY2hlY2tcbiAqIEByZXR1cm5zIFRydWUgaWYgdGhlIGlucHV0IGlzIGZvciBhIE11bHRpRWRpdCB0b29sXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaWYgKGlzTXVsdGlFZGl0VG9vbChpbnB1dCkpIHtcbiAqICAgZm9yIChjb25zdCBlZGl0IG9mIGlucHV0LnRvb2xfaW5wdXQuZWRpdHMpIHtcbiAqICAgICBjb25zb2xlLmxvZyhgJHtlZGl0Lm9sZF9zdHJpbmd9IC0+ICR7ZWRpdC5uZXdfc3RyaW5nfWApO1xuICogICB9XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTXVsdGlFZGl0VG9vbChpbnB1dCkge1xuICByZXR1cm4gaW5wdXQudG9vbF9uYW1lID09PSAnTXVsdGlFZGl0Jztcbn1cbi8qKlxuICogVHlwZSBndWFyZCBmb3IgYW55IGZpbGUtbW9kaWZ5aW5nIHRvb2wgKFdyaXRlLCBFZGl0LCBvciBNdWx0aUVkaXQpLlxuICpcbiAqIFVzZSB0aGlzIHdoZW4geW91IG5lZWQgdG8gaGFuZGxlIGFsbCBmaWxlIG1vZGlmaWNhdGlvbnMgZ2VuZXJpY2FsbHkuXG4gKiBAcGFyYW0gaW5wdXQgLSBUaGUgaG9vayBpbnB1dCB0byBjaGVja1xuICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgaW5wdXQgaXMgZm9yIGEgV3JpdGUsIEVkaXQsIG9yIE11bHRpRWRpdCB0b29sXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaWYgKGlzRmlsZU1vZGlmeWluZ1Rvb2woaW5wdXQpKSB7XG4gKiAgIGNvbnN0IGZpbGVQYXRoID0gZ2V0RmlsZVBhdGgoaW5wdXQpOyAvLyBXb3JrcyBmb3IgYWxsIHRocmVlIHR5cGVzXG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRmlsZU1vZGlmeWluZ1Rvb2woaW5wdXQpIHtcbiAgcmV0dXJuIGlucHV0LnRvb2xfbmFtZSA9PT0gJ1dyaXRlJyB8fCBpbnB1dC50b29sX25hbWUgPT09ICdFZGl0JyB8fCBpbnB1dC50b29sX25hbWUgPT09ICdNdWx0aUVkaXQnO1xufVxuLyoqXG4gKiBUeXBlIGd1YXJkIGZvciBSZWFkIHRvb2wgaW5wdXRzLlxuICpcbiAqIE5hcnJvd3MgdGhlIGlucHV0IHR5cGUgdG8gaW5jbHVkZSBhIHR5cGVkIFJlYWRUb29sSW5wdXQuXG4gKiBAcGFyYW0gaW5wdXQgLSBUaGUgaG9vayBpbnB1dCB0byBjaGVja1xuICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgaW5wdXQgaXMgZm9yIGEgUmVhZCB0b29sXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaWYgKGlzUmVhZFRvb2woaW5wdXQpKSB7XG4gKiAgIGNvbnNvbGUubG9nKGlucHV0LnRvb2xfaW5wdXQuZmlsZV9wYXRoKTtcbiAqICAgY29uc29sZS5sb2coaW5wdXQudG9vbF9pbnB1dC5vZmZzZXQpO1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1JlYWRUb29sKGlucHV0KSB7XG4gIHJldHVybiBpbnB1dC50b29sX25hbWUgPT09ICdSZWFkJztcbn1cbi8qKlxuICogVHlwZSBndWFyZCBmb3IgQmFzaCB0b29sIGlucHV0cy5cbiAqXG4gKiBOYXJyb3dzIHRoZSBpbnB1dCB0eXBlIHRvIGluY2x1ZGUgYSB0eXBlZCBCYXNoVG9vbElucHV0LlxuICogQHBhcmFtIGlucHV0IC0gVGhlIGhvb2sgaW5wdXQgdG8gY2hlY2tcbiAqIEByZXR1cm5zIFRydWUgaWYgdGhlIGlucHV0IGlzIGZvciBhIEJhc2ggdG9vbFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGlmIChpc0Jhc2hUb29sKGlucHV0KSkge1xuICogICBjb25zb2xlLmxvZyhpbnB1dC50b29sX2lucHV0LmNvbW1hbmQpO1xuICogICBjb25zb2xlLmxvZyhpbnB1dC50b29sX2lucHV0LnRpbWVvdXQpO1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Jhc2hUb29sKGlucHV0KSB7XG4gIHJldHVybiBpbnB1dC50b29sX25hbWUgPT09ICdCYXNoJztcbn1cbi8qKlxuICogVHlwZSBndWFyZCBmb3IgR2xvYiB0b29sIGlucHV0cy5cbiAqXG4gKiBOYXJyb3dzIHRoZSBpbnB1dCB0eXBlIHRvIGluY2x1ZGUgYSB0eXBlZCBHbG9iVG9vbElucHV0LlxuICogQHBhcmFtIGlucHV0IC0gVGhlIGhvb2sgaW5wdXQgdG8gY2hlY2tcbiAqIEByZXR1cm5zIFRydWUgaWYgdGhlIGlucHV0IGlzIGZvciBhIEdsb2IgdG9vbFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGlmIChpc0dsb2JUb29sKGlucHV0KSkge1xuICogICBjb25zb2xlLmxvZyhpbnB1dC50b29sX2lucHV0LnBhdHRlcm4pO1xuICogICBjb25zb2xlLmxvZyhpbnB1dC50b29sX2lucHV0LnBhdGgpO1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0dsb2JUb29sKGlucHV0KSB7XG4gIHJldHVybiBpbnB1dC50b29sX25hbWUgPT09ICdHbG9iJztcbn1cbi8qKlxuICogVHlwZSBndWFyZCBmb3IgR3JlcCB0b29sIGlucHV0cy5cbiAqXG4gKiBOYXJyb3dzIHRoZSBpbnB1dCB0eXBlIHRvIGluY2x1ZGUgYSB0eXBlZCBHcmVwVG9vbElucHV0LlxuICogQHBhcmFtIGlucHV0IC0gVGhlIGhvb2sgaW5wdXQgdG8gY2hlY2tcbiAqIEByZXR1cm5zIFRydWUgaWYgdGhlIGlucHV0IGlzIGZvciBhIEdyZXAgdG9vbFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGlmIChpc0dyZXBUb29sKGlucHV0KSkge1xuICogICBjb25zb2xlLmxvZyhpbnB1dC50b29sX2lucHV0LnBhdHRlcm4pO1xuICogICBjb25zb2xlLmxvZyhpbnB1dC50b29sX2lucHV0Lmdsb2IpO1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0dyZXBUb29sKGlucHV0KSB7XG4gIHJldHVybiBpbnB1dC50b29sX25hbWUgPT09ICdHcmVwJztcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEZpbGUgUGF0aCBVdGlsaXRpZXNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogRXh0cmFjdHMgdGhlIGZpbGUgcGF0aCBmcm9tIGEgdG9vbCBpbnB1dC5cbiAqXG4gKiBXb3JrcyB3aXRoIFdyaXRlLCBFZGl0LCBNdWx0aUVkaXQsIGFuZCBSZWFkIHRvb2xzLlxuICogUmV0dXJucyBudWxsIGZvciBvdGhlciB0b29scyBvciBpZiBmaWxlX3BhdGggaXMgbWlzc2luZy5cbiAqIEBwYXJhbSBpbnB1dCAtIFRoZSBob29rIGlucHV0IHRvIGV4dHJhY3QgZnJvbVxuICogQHJldHVybnMgVGhlIGZpbGUgcGF0aCwgb3IgbnVsbCBpZiBub3QgYXBwbGljYWJsZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IGZpbGVQYXRoID0gZ2V0RmlsZVBhdGgoaW5wdXQpO1xuICogaWYgKGZpbGVQYXRoICYmIGlzVHNGaWxlKGZpbGVQYXRoKSkge1xuICogICAvLyBIYW5kbGUgVHlwZVNjcmlwdCBmaWxlXG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEZpbGVQYXRoKGlucHV0KSB7XG4gIGNvbnN0IHRvb2xJbnB1dCA9IGlucHV0LnRvb2xfaW5wdXQ7XG4gIGlmICh0b29sSW5wdXQgJiYgdHlwZW9mIHRvb2xJbnB1dCA9PT0gJ29iamVjdCcgJiYgJ2ZpbGVfcGF0aCcgaW4gdG9vbElucHV0KSB7XG4gICAgY29uc3QgZmlsZVBhdGggPSB0b29sSW5wdXQuZmlsZV9wYXRoO1xuICAgIHJldHVybiB0eXBlb2YgZmlsZVBhdGggPT09ICdzdHJpbmcnID8gZmlsZVBhdGggOiBudWxsO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuLyoqXG4gKiBDaGVja3MgaWYgYSBmaWxlIHBhdGggaXMgYSBKYXZhU2NyaXB0IG9yIFR5cGVTY3JpcHQgZmlsZS5cbiAqXG4gKiBNYXRjaGVzIC5qcywgLmpzeCwgLnRzLCAudHN4LCAubWpzLCAubXRzLCAuY2pzLCAuY3RzIGV4dGVuc2lvbnMuXG4gKiBAcGFyYW0gZmlsZVBhdGggLSBUaGUgZmlsZSBwYXRoIHRvIGNoZWNrXG4gKiBAcmV0dXJucyBUcnVlIGlmIHRoZSBmaWxlIGlzIEphdmFTY3JpcHQgb3IgVHlwZVNjcmlwdFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGlmIChpc0pzVHNGaWxlKGZpbGVQYXRoKSkge1xuICogICAvLyBDaGVjayBmb3IgVHlwZVNjcmlwdC1zcGVjaWZpYyBwYXR0ZXJuc1xuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0pzVHNGaWxlKGZpbGVQYXRoKSB7XG4gIHJldHVybiAvXFwuW2NtXT9banRdc3g/JC8udGVzdChmaWxlUGF0aCk7XG59XG4vKipcbiAqIENoZWNrcyBpZiBhIGZpbGUgcGF0aCBpcyBhIFR5cGVTY3JpcHQgZmlsZS5cbiAqXG4gKiBNYXRjaGVzIC50cywgLnRzeCwgLm10cywgLmN0cyBleHRlbnNpb25zLlxuICogQHBhcmFtIGZpbGVQYXRoIC0gVGhlIGZpbGUgcGF0aCB0byBjaGVja1xuICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgZmlsZSBpcyBUeXBlU2NyaXB0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaWYgKGlzVHNGaWxlKGZpbGVQYXRoKSkge1xuICogICAvLyBFbmZvcmNlIFR5cGVTY3JpcHQtc3BlY2lmaWMgcnVsZXNcbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNUc0ZpbGUoZmlsZVBhdGgpIHtcbiAgcmV0dXJuIC9cXC5bY21dP3RzeD8kLy50ZXN0KGZpbGVQYXRoKTtcbn1cbi8qKlxuICogQ2hlY2tzIGlmIGEgcGF0dGVybiBleGlzdHMgaW4gdGhlIGNvbnRlbnQgYmVpbmcgd3JpdHRlbiBvciBlZGl0ZWQuXG4gKlxuICogRm9yIFdyaXRlOiBjaGVja3MgdGhlIGNvbnRlbnQgYmVpbmcgd3JpdHRlblxuICogRm9yIEVkaXQ6IGNoZWNrcyBuZXdfc3RyaW5nIChhbmQgb2xkX3N0cmluZyB0byBkZXRlY3QgYWRkaXRpb25zKVxuICogRm9yIE11bHRpRWRpdDogY2hlY2tzIGFsbCBlZGl0cyBhbmQgYWdncmVnYXRlcyByZXN1bHRzXG4gKiBAcGFyYW0gaW5wdXQgLSBUaGUgUHJlVG9vbFVzZSBob29rIGlucHV0XG4gKiBAcGFyYW0gcGF0dGVybiAtIFRoZSByZWdleCBwYXR0ZXJuIHRvIHNlYXJjaCBmb3IgKGdsb2JhbCBmbGFnIHdpbGwgYmUgdXNlZClcbiAqIEByZXR1cm5zIFJlc3VsdCBvYmplY3QsIG9yIG51bGwgaWYgbm90IGEgZmlsZS1tb2RpZnlpbmcgdG9vbFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEJsb2NrIEB0cy1pZ25vcmUgYmVpbmcgYWRkZWRcbiAqIGNvbnN0IHJlc3VsdCA9IGNoZWNrQ29udGVudEZvclBhdHRlcm4oaW5wdXQsIC9AdHMtaWdub3JlL2cpO1xuICogaWYgKHJlc3VsdD8uaXNBZGRpdGlvbikge1xuICogICByZXR1cm4gcHJlVG9vbFVzZU91dHB1dCh7XG4gKiAgICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgICBwZXJtaXNzaW9uRGVjaXNpb246ICdkZW55JyxcbiAqICAgICAgIHBlcm1pc3Npb25EZWNpc2lvblJlYXNvbjogYENhbm5vdCBhZGQ6ICR7cmVzdWx0Lm1hdGNoZXMuam9pbignLCAnKX1gXG4gKiAgICAgfVxuICogICB9KTtcbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tDb250ZW50Rm9yUGF0dGVybihpbnB1dCwgcGF0dGVybikge1xuICAvLyBFbnN1cmUgcGF0dGVybiBoYXMgZ2xvYmFsIGZsYWcgZm9yIG1hdGNoQWxsXG4gIGNvbnN0IGdsb2JhbFBhdHRlcm4gPSBwYXR0ZXJuLmdsb2JhbCA/IHBhdHRlcm4gOiBuZXcgUmVnRXhwKHBhdHRlcm4uc291cmNlLCBwYXR0ZXJuLmZsYWdzICsgJ2cnKTtcbiAgaWYgKGlzV3JpdGVUb29sKGlucHV0KSkge1xuICAgIGNvbnN0IG1hdGNoZXMgPSBbLi4uaW5wdXQudG9vbF9pbnB1dC5jb250ZW50Lm1hdGNoQWxsKGdsb2JhbFBhdHRlcm4pXS5tYXAoKG0pID0+IG1bMF0pO1xuICAgIGNvbnN0IHVuaXF1ZU1hdGNoZXMgPSBbLi4ubmV3IFNldChtYXRjaGVzKV07XG4gICAgcmV0dXJuIHtcbiAgICAgIGZvdW5kOiB1bmlxdWVNYXRjaGVzLmxlbmd0aCA+IDAsXG4gICAgICBpc0FkZGl0aW9uOiB1bmlxdWVNYXRjaGVzLmxlbmd0aCA+IDAsIC8vIEZvciBXcml0ZSwgYW55IG1hdGNoIGlzIGFuIGFkZGl0aW9uXG4gICAgICBtYXRjaGVzOiB1bmlxdWVNYXRjaGVzXG4gICAgfTtcbiAgfVxuICBpZiAoaXNFZGl0VG9vbChpbnB1dCkpIHtcbiAgICBjb25zdCBuZXdNYXRjaGVzID0gWy4uLmlucHV0LnRvb2xfaW5wdXQubmV3X3N0cmluZy5tYXRjaEFsbChnbG9iYWxQYXR0ZXJuKV0ubWFwKChtKSA9PiBtWzBdKTtcbiAgICBjb25zdCBvbGRNYXRjaGVzID0gWy4uLmlucHV0LnRvb2xfaW5wdXQub2xkX3N0cmluZy5tYXRjaEFsbChnbG9iYWxQYXR0ZXJuKV0ubWFwKChtKSA9PiBtWzBdKTtcbiAgICBjb25zdCB1bmlxdWVOZXdNYXRjaGVzID0gWy4uLm5ldyBTZXQobmV3TWF0Y2hlcyldO1xuICAgIGNvbnN0IHVuaXF1ZU9sZE1hdGNoZXMgPSBuZXcgU2V0KG9sZE1hdGNoZXMpO1xuICAgIC8vIEFkZGl0aW9uID0gZm91bmQgaW4gbmV3IGJ1dCBub3QgaW4gb2xkXG4gICAgY29uc3QgYWRkaXRpb25zID0gdW5pcXVlTmV3TWF0Y2hlcy5maWx0ZXIoKG0pID0+ICF1bmlxdWVPbGRNYXRjaGVzLmhhcyhtKSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGZvdW5kOiB1bmlxdWVOZXdNYXRjaGVzLmxlbmd0aCA+IDAsXG4gICAgICBpc0FkZGl0aW9uOiBhZGRpdGlvbnMubGVuZ3RoID4gMCxcbiAgICAgIG1hdGNoZXM6IHVuaXF1ZU5ld01hdGNoZXNcbiAgICB9O1xuICB9XG4gIGlmIChpc011bHRpRWRpdFRvb2woaW5wdXQpKSB7XG4gICAgY29uc3QgZGV0YWlscyA9IFtdO1xuICAgIGNvbnN0IGFsbE1hdGNoZXMgPSBuZXcgU2V0KCk7XG4gICAgbGV0IGFueUZvdW5kID0gZmFsc2U7XG4gICAgbGV0IGFueUFkZGl0aW9uID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dC50b29sX2lucHV0LmVkaXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBlZGl0ID0gaW5wdXQudG9vbF9pbnB1dC5lZGl0c1tpXTtcbiAgICAgIGNvbnN0IG5ld01hdGNoZXMgPSBbLi4uZWRpdC5uZXdfc3RyaW5nLm1hdGNoQWxsKGdsb2JhbFBhdHRlcm4pXS5tYXAoKG0pID0+IG1bMF0pO1xuICAgICAgY29uc3Qgb2xkTWF0Y2hlcyA9IFsuLi5lZGl0Lm9sZF9zdHJpbmcubWF0Y2hBbGwoZ2xvYmFsUGF0dGVybildLm1hcCgobSkgPT4gbVswXSk7XG4gICAgICBjb25zdCB1bmlxdWVOZXdNYXRjaGVzID0gWy4uLm5ldyBTZXQobmV3TWF0Y2hlcyldO1xuICAgICAgY29uc3QgdW5pcXVlT2xkTWF0Y2hlcyA9IG5ldyBTZXQob2xkTWF0Y2hlcyk7XG4gICAgICBjb25zdCBhZGRpdGlvbnMgPSB1bmlxdWVOZXdNYXRjaGVzLmZpbHRlcigobSkgPT4gIXVuaXF1ZU9sZE1hdGNoZXMuaGFzKG0pKTtcbiAgICAgIGNvbnN0IGZvdW5kID0gdW5pcXVlTmV3TWF0Y2hlcy5sZW5ndGggPiAwO1xuICAgICAgY29uc3QgaXNBZGRpdGlvbiA9IGFkZGl0aW9ucy5sZW5ndGggPiAwO1xuICAgICAgaWYgKGZvdW5kKSBhbnlGb3VuZCA9IHRydWU7XG4gICAgICBpZiAoaXNBZGRpdGlvbikgYW55QWRkaXRpb24gPSB0cnVlO1xuICAgICAgdW5pcXVlTmV3TWF0Y2hlcy5mb3JFYWNoKChtKSA9PiBhbGxNYXRjaGVzLmFkZChtKSk7XG4gICAgICBkZXRhaWxzLnB1c2goe1xuICAgICAgICBpbmRleDogaSxcbiAgICAgICAgZm91bmQsXG4gICAgICAgIGlzQWRkaXRpb24sXG4gICAgICAgIG1hdGNoZXM6IHVuaXF1ZU5ld01hdGNoZXNcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgZm91bmQ6IGFueUZvdW5kLFxuICAgICAgaXNBZGRpdGlvbjogYW55QWRkaXRpb24sXG4gICAgICBtYXRjaGVzOiBbLi4uYWxsTWF0Y2hlc10sXG4gICAgICBkZXRhaWxzXG4gICAgfTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cbi8qKlxuICogSXRlcmF0ZXMgb3ZlciBjb250ZW50IGluIFdyaXRlL0VkaXQvTXVsdGlFZGl0IG9wZXJhdGlvbnMuXG4gKlxuICogUHJvdmlkZXMgYSB1bmlmaWVkIHdheSB0byBpbnNwZWN0IGNvbnRlbnQgcmVnYXJkbGVzcyBvZiBvcGVyYXRpb24gdHlwZS5cbiAqIFJldHVybiBmYWxzZSBmcm9tIHRoZSBjYWxsYmFjayB0byBzdG9wIGl0ZXJhdGlvbiBlYXJseS5cbiAqIEBwYXJhbSBpbnB1dCAtIFRoZSBQcmVUb29sVXNlIGhvb2sgaW5wdXRcbiAqIEBwYXJhbSBjYWxsYmFjayAtIEZ1bmN0aW9uIGNhbGxlZCBmb3IgZWFjaCBjb250ZW50IHBpZWNlLCByZXR1cm4gZmFsc2UgdG8gc3RvcFxuICogQHJldHVybnMgVHJ1ZSBpZiBhbGwgY2FsbGJhY2tzIHJldHVybmVkIHRydWUsIGZhbHNlIGlmIHN0b3BwZWQgZWFybHkgb3Igbm90IGFwcGxpY2FibGVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBDaGVjayBhbGwgY29udGVudCBmb3Igc2Vuc2l0aXZlIGRhdGFcbiAqIGNvbnN0IGhhc1NlbnNpdGl2ZSA9ICFmb3JFYWNoQ29udGVudChpbnB1dCwgKHsgbmV3Q29udGVudCB9KSA9PiB7XG4gKiAgIGlmICgvcGFzc3dvcmR8c2VjcmV0fGFwaS4/a2V5L2kudGVzdChuZXdDb250ZW50KSkge1xuICogICAgIHJldHVybiBmYWxzZTsgLy8gU3RvcCAtIGZvdW5kIHNlbnNpdGl2ZSBkYXRhXG4gKiAgIH1cbiAqICAgcmV0dXJuIHRydWU7IC8vIENvbnRpbnVlXG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9yRWFjaENvbnRlbnQoaW5wdXQsIGNhbGxiYWNrKSB7XG4gIGlmIChpc1dyaXRlVG9vbChpbnB1dCkpIHtcbiAgICByZXR1cm4gY2FsbGJhY2soe1xuICAgICAgbmV3Q29udGVudDogaW5wdXQudG9vbF9pbnB1dC5jb250ZW50LFxuICAgICAgb2xkQ29udGVudDogbnVsbCxcbiAgICAgIGluZGV4OiAwLFxuICAgICAgaXNXcml0ZTogdHJ1ZVxuICAgIH0pO1xuICB9XG4gIGlmIChpc0VkaXRUb29sKGlucHV0KSkge1xuICAgIHJldHVybiBjYWxsYmFjayh7XG4gICAgICBuZXdDb250ZW50OiBpbnB1dC50b29sX2lucHV0Lm5ld19zdHJpbmcsXG4gICAgICBvbGRDb250ZW50OiBpbnB1dC50b29sX2lucHV0Lm9sZF9zdHJpbmcsXG4gICAgICBpbmRleDogMCxcbiAgICAgIGlzV3JpdGU6IGZhbHNlXG4gICAgfSk7XG4gIH1cbiAgaWYgKGlzTXVsdGlFZGl0VG9vbChpbnB1dCkpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0LnRvb2xfaW5wdXQuZWRpdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGVkaXQgPSBpbnB1dC50b29sX2lucHV0LmVkaXRzW2ldO1xuICAgICAgY29uc3Qgc2hvdWxkQ29udGludWUgPSBjYWxsYmFjayh7XG4gICAgICAgIG5ld0NvbnRlbnQ6IGVkaXQubmV3X3N0cmluZyxcbiAgICAgICAgb2xkQ29udGVudDogZWRpdC5vbGRfc3RyaW5nLFxuICAgICAgICBpbmRleDogaSxcbiAgICAgICAgaXNXcml0ZTogZmFsc2VcbiAgICAgIH0pO1xuICAgICAgaWYgKCFzaG91bGRDb250aW51ZSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG4iLCAiXG5pbXBvcnQgaG9vayBmcm9tICcvd29ya3NwYWNlL3BhY2thZ2VzL3R5cGVzY3JpcHQtaG9va3Mvc3JjL3R5cGVzY3JpcHQtY2hlY2sudHMnO1xuaW1wb3J0IHsgZXhlY3V0ZSB9IGZyb20gJy93b3Jrc3BhY2UvcGFja2FnZXMvY2xhdWRlLWNvZGUtaG9va3MvZGlzdC9ydW50aW1lLmpzJztcblxuZXhlY3V0ZShob29rKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFVQSxTQUFTLGdCQUFnQjtBQUN6QixPQUFPQSxTQUFRO0FBQ2YsT0FBTyxVQUFVOzs7QUNTVixJQUFNLGFBQWE7QUFBQTtBQUFBLEVBRXhCLFNBQVM7QUFBQTtBQUFBLEVBRVQsT0FBTztBQUFBO0FBQUEsRUFFUCxPQUFPO0FBQ1Q7QUFVQSxTQUFTLGdD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SSxDQUFDLFNBQVMsUUFBUSxHQUFHO0FBQ3ZCLElBQUFBLFFBQU8sTUFBTSxnQ0FBZ0MsRUFBRSxTQUFTLENBQUM7QUFDekQsV0FBTyxrQkFBa0IsQ0FBQyxDQUFDO0FBQUEsRUFDN0I7QUFFQSxNQUFJLENBQUNELElBQUcsV0FBVyxRQUFRLEdBQUc7QUFDNUIsSUFBQUMsUUFBTyxLQUFLLGtCQUFrQixFQUFFLFNBQVMsQ0FBQztBQUMxQyxXQUFPLGtCQUFrQixDQUFDLENBQUM7QUFBQSxFQUM3QjtBQUVBLEVBQUFBLFFBQU8sS0FBSyw0QkFBNEIsRUFBRSxTQUFTLENBQUM7QUFFcEQsUUFBTSxhQUFhLG9CQUFvQixRQUFRO0FBQy9DLE1BQUksQ0FBQyxZQUFZO0FBQ2YsSUFBQUEsUUFBTyxLQUFLLHdDQUF3QyxFQUFFLFNBQVMsQ0FBQztBQUNoRSxXQUFPLGtCQUFrQjtBQUFBLE1BQ3ZCLG9CQUFvQjtBQUFBLFFBQ2xCLG1CQUFtQix5Q0FBeUMsUUFBUTtBQUFBLE1BQ3RFO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUVBLEVBQUFBLFFBQU8sTUFBTSxxQkFBcUIsRUFBRSxXQUFXLENBQUM7QUFHaEQsUUFBTSxrQkFBa0Isb0JBQW9CLFVBQVU7QUFHdEQsUUFBTSxlQUFlLFVBQVUsVUFBVSxVQUFVO0FBQ25ELFFBQU0saUJBQWlCLG1CQUFtQixVQUFVLFVBQVU7QUFHOUQsUUFBTSxpQkFBaUIsZ0JBQWdCLE9BQU8sT0FBTyxDQUFDLE1BQU0sRUFBRSxTQUFTLFFBQVE7QUFDL0UsUUFBTSxlQUE4QixDQUFDLEdBQUcsZ0JBQWdCLEdBQUcsYUFBYSxNQUFNO0FBRzlFLFFBQU0saUJBQWlCLDBCQUEwQixnQkFBZ0IsUUFBUSxnQkFBZ0IsUUFBUTtBQUVqRyxNQUFJLGFBQWEsU0FBUyxLQUFLLGVBQWUsU0FBUyxHQUFHO0FBQ3hELFVBQU0sYUFBYSxtQkFBbUIsY0FBYyxnQkFBZ0IsZ0JBQWdCLFVBQVU7QUFDOUYsVUFBTSxlQUFlLFNBQVMsYUFBYSxNQUFNLG1CQUFtQixlQUFlLFNBQVMsSUFBSSxRQUFRLGVBQWUsTUFBTSxpQ0FBaUMsRUFBRTtBQUNoSyxVQUFNLGdCQUFnQixxQkFBcUIsWUFBWTtBQUV2RCxJQUFBQSxRQUFPLEtBQUssMkJBQTJCO0FBQUEsTUFDckMsYUFBYSxhQUFhO0FBQUEsTUFDMUIsZUFBZSxlQUFlO0FBQUEsSUFDaEMsQ0FBQztBQUVELFdBQU8sa0JBQWtCO0FBQUEsTUFDdkI7QUFBQSxNQUNBLG9CQUFvQjtBQUFBLFFBQ2xCLG1CQUFtQjtBQUFBLE1BQ3JCO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUVBLEVBQUFBLFFBQU8sTUFBTSxzQkFBc0I7QUFDbkMsU0FBTyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzdCLENBQUM7OztBTy9kRCxRQUFRLHdCQUFJOyIsCiAgIm5hbWVzIjogWyJmcyIsICJmcyIsICJsb2dnZXIiXQp9Cg==
