#!/usr/bin/env -S node --enable-source-maps
// src/implement-plan-reloader.ts
import { execSync } from "node:child_process";
import { existsSync as existsSync2, unlinkSync } from "node:fs";

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
function findClaudePid() {
  let currentPid = process.ppid;
  const maxDepth = 10;
  for (let depth = 0; depth < maxDepth && currentPid > 1; depth++) {
    try {
      const comm = execSync(`ps -p ${currentPid} -o comm=`, { encoding: "utf-8" }).trim();
      if (comm === "claude") {
        return currentPid;
      }
      const ppid = execSync(`ps -p ${currentPid} -o ppid=`, { encoding: "utf-8" }).trim();
      currentPid = parseInt(ppid, 10);
    } catch {
      return null;
    }
  }
  return null;
}
function getImplementPlanReloadFlagPath(claudePid) {
  return `/tmp/claude_implement_plan_reload_${claudePid}.enabled`;
}
var implement_plan_reloader_default = sessionStartHook({ matcher: "compact" }, (_input, { logger: logger2 }) => {
  const claudePid = findClaudePid();
  if (claudePid === null) {
    logger2.debug("Could not find Claude PID");
    return sessionStartOutput({});
  }
  const enablementFlag = getImplementPlanReloadFlagPath(claudePid);
  if (!existsSync2(enablementFlag)) {
    logger2.debug("Implement-plan reload not enabled for this session", { claudePid });
    return sessionStartOutput({});
  }
  try {
    unlinkSync(enablementFlag);
  } catch {
  }
  logger2.info("Reloading implement-plan instructions after compaction", { claudePid });
  return sessionStartOutput({
    systemMessage: "Implement-plan reloader: Instructions restored after context compaction",
    hookSpecificOutput: {
      additionalContext: IMPLEMENT_PLAN_INSTRUCTIONS
    }
  });
});

// ../../../tmp/claude-code-hooks-build/c5230c8c0aae9fcb/wrapper.ts
execute(implement_plan_reloader_default);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2dvb2Rmb290LWhvb2tzL3NyYy9pbXBsZW1lbnQtcGxhbi1yZWxvYWRlci50cyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvY2xhdWRlLWNvZGUtaG9va3MvZGlzdC9lbnYuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvaG9va3MuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvbG9nZ2VyLmpzIiwgIi4uLy4uLy4uL3dvcmtzcGFjZS9wYWNrYWdlcy9jbGF1ZGUtY29kZS1ob29rcy9kaXN0L291dHB1dHMuanMiLCAiLi4vLi4vLi4vd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvcnVudGltZS5qcyIsICIuLi8uLi8uLi93b3Jrc3BhY2UvcGFja2FnZXMvZ29vZGZvb3QtaG9va3Mvc3JjL2ltcGxlbWVudC1wbGFuLWluc3RydWN0aW9ucy50cyIsICJ3cmFwcGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEltcGxlbWVudC1QbGFuIFJlbG9hZGVyIC0gU2Vzc2lvblN0YXJ0IGhvb2sgdGhhdCByZXN0b3JlcyBpbXBsZW1lbnQtcGxhbiBpbnN0cnVjdGlvbnMgYWZ0ZXIgY29udGV4dCBjb21wYWN0aW9uLlxuICpcbiAqIFdoZW4gYSBzZXNzaW9uIHN0YXJ0cyBkdWUgdG8gY29tcGFjdGlvbiwgdGhpcyBob29rIGNoZWNrcyBpZiBpbXBsZW1lbnQtcGxhblxuICogd2FzIHJ1bm5pbmcgKHZpYSBhIGZsYWcgZmlsZSBrZXllZCBieSBDbGF1ZGUgUElEKSBhbmQgb3V0cHV0cyB0aGUgaW5zdHJ1Y3Rpb25zXG4gKiB0byByZXN0b3JlIHRoZSB3b3JrZmxvdyBjb250ZXh0LlxuICpcbiAqIFRoZSBmbGFnIGlzIHNldCBieSBpbXBsZW1lbnQtcGxhbi5tZCB3aGVuIGl0IHN0YXJ0cyBydW5uaW5nLCB1c2luZyBlbWJlZGRlZCBiYXNoXG4gKiB0byBmaW5kIHRoZSBDbGF1ZGUgUElEIGFuZCB3cml0ZSB0aGUgZmxhZyBmaWxlLlxuICpcbiAqIEltcGxlbWVudHMgb25lLXNob3QgYmVoYXZpb3IgYnkgZGVsZXRpbmcgdGhlIGVuYWJsZW1lbnQgZmxhZyBhZnRlciBydW5uaW5nLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNzZXNzaW9uc3RhcnRcbiAqL1xuXG5pbXBvcnQgeyBleGVjU3luYyB9IGZyb20gXCJub2RlOmNoaWxkX3Byb2Nlc3NcIjtcbmltcG9ydCB7IGV4aXN0c1N5bmMsIHVubGlua1N5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgc2Vzc2lvblN0YXJ0SG9vaywgc2Vzc2lvblN0YXJ0T3V0cHV0IH0gZnJvbSBcIkBnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rc1wiO1xuaW1wb3J0IHsgSU1QTEVNRU5UX1BMQU5fSU5TVFJVQ1RJT05TIH0gZnJvbSBcIi4vaW1wbGVtZW50LXBsYW4taW5zdHJ1Y3Rpb25zLmpzXCI7XG5cbi8qKlxuICogRmluZHMgdGhlIENsYXVkZSBwcm9jZXNzIFBJRCBieSB3YWxraW5nIHVwIHRoZSBwcm9jZXNzIHRyZWUuXG4gKiBSZXR1cm5zIG51bGwgaWYgbm8gQ2xhdWRlIHByb2Nlc3MgaXMgZm91bmQgd2l0aGluIDEwIGxldmVscy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRDbGF1ZGVQaWQoKTogbnVtYmVyIHwgbnVsbCB7XG4gIGxldCBjdXJyZW50UGlkID0gcHJvY2Vzcy5wcGlkO1xuICBjb25zdCBtYXhEZXB0aCA9IDEwO1xuXG4gIGZvciAobGV0IGRlcHRoID0gMDsgZGVwdGggPCBtYXhEZXB0aCAmJiBjdXJyZW50UGlkID4gMTsgZGVwdGgrKykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb21tID0gZXhlY1N5bmMoYHBzIC1wICR7Y3VycmVudFBpZH0gLW8gY29tbT1gLCB7IGVuY29kaW5nOiBcInV0Zi04XCIgfSkudHJpbSgpO1xuICAgICAgaWYgKGNvbW0gPT09IFwiY2xhdWRlXCIpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnRQaWQ7XG4gICAgICB9XG4gICAgICBjb25zdCBwcGlkID0gZXhlY1N5bmMoYHBzIC1wICR7Y3VycmVudFBpZH0gLW8gcHBpZD1gLCB7IGVuY29kaW5nOiBcInV0Zi04XCIgfSkudHJpbSgpO1xuICAgICAgY3VycmVudFBpZCA9IHBhcnNlSW50KHBwaWQsIDEwKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIHBhdGggdG8gdGhlIGltcGxlbWVudC1wbGFuIHJlbG9hZCBlbmFibGVtZW50IGZsYWcgZmlsZS5cbiAqIFVzZXMgdGhlIENsYXVkZSBQSUQgdG8gdGllIHRoZSBmbGFnIHRvIHRoZSBjdXJyZW50IENsYXVkZSBzZXNzaW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW1wbGVtZW50UGxhblJlbG9hZEZsYWdQYXRoKGNsYXVkZVBpZDogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAvdG1wL2NsYXVkZV9pbXBsZW1lbnRfcGxhbl9yZWxvYWRfJHtjbGF1ZGVQaWR9LmVuYWJsZWRgO1xufVxuXG5leHBvcnQgZGVmYXVsdCBzZXNzaW9uU3RhcnRIb29rKHsgbWF0Y2hlcjogXCJjb21wYWN0XCIgfSwgKF9pbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICBjb25zdCBjbGF1ZGVQaWQgPSBmaW5kQ2xhdWRlUGlkKCk7XG5cbiAgaWYgKGNsYXVkZVBpZCA9PT0gbnVsbCkge1xuICAgIGxvZ2dlci5kZWJ1ZyhcIkNvdWxkIG5vdCBmaW5kIENsYXVkZSBQSURcIik7XG4gICAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7fSk7XG4gIH1cblxuICBjb25zdCBlbmFibGVtZW50RmxhZyA9IGdldEltcGxlbWVudFBsYW5SZWxvYWRGbGFnUGF0aChjbGF1ZGVQaWQpO1xuXG4gIC8vIENoZWNrIGlmIGVuYWJsZW1lbnQgZmxhZyBleGlzdHMgKHNldCBieSBpbXBsZW1lbnQtcGxhbi5tZCB3aGVuIGl0IHN0YXJ0ZWQpXG4gIGlmICghZXhpc3RzU3luYyhlbmFibGVtZW50RmxhZykpIHtcbiAgICBsb2dnZXIuZGVidWcoXCJJbXBsZW1lbnQtcGxhbiByZWxvYWQgbm90IGVuYWJsZWQgZm9yIHRoaXMgc2Vzc2lvblwiLCB7IGNsYXVkZVBpZCB9KTtcbiAgICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHt9KTtcbiAgfVxuXG4gIC8vIERlbGV0ZSB0aGUgZW5hYmxlbWVudCBmbGFnIChvbmUtc2hvdCBiZWhhdmlvcilcbiAgdHJ5IHtcbiAgICB1bmxpbmtTeW5jKGVuYWJsZW1lbnRGbGFnKTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gSWdub3JlIGNsZWFudXAgZXJyb3JzXG4gIH1cblxuICBsb2dnZXIuaW5mbyhcIlJlbG9hZGluZyBpbXBsZW1lbnQtcGxhbiBpbnN0cnVjdGlvbnMgYWZ0ZXIgY29tcGFjdGlvblwiLCB7IGNsYXVkZVBpZCB9KTtcblxuICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHtcbiAgICBzeXN0ZW1NZXNzYWdlOiBcIkltcGxlbWVudC1wbGFuIHJlbG9hZGVyOiBJbnN0cnVjdGlvbnMgcmVzdG9yZWQgYWZ0ZXIgY29udGV4dCBjb21wYWN0aW9uXCIsXG4gICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gICAgICBhZGRpdGlvbmFsQ29udGV4dDogSU1QTEVNRU5UX1BMQU5fSU5TVFJVQ1RJT05TLFxuICAgIH0sXG4gIH0pO1xufSk7XG4iLCAiLyoqXG4gKiBFbnZpcm9ubWVudCB2YXJpYWJsZSB1dGlsaXRpZXMgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIFByb3ZpZGVzIHR5cGVkIGFjY2VzcyB0byBDbGF1ZGUgQ29kZSdzIGVudmlyb25tZW50IHZhcmlhYmxlcyBhbmQgdXRpbGl0aWVzXG4gKiBmb3IgcGVyc2lzdGluZyBlbnZpcm9ubWVudCB2YXJpYWJsZXMgaW4gU2Vzc2lvblN0YXJ0IGhvb2tzLlxuICpcbiAqICMjIEVudmlyb25tZW50IFZhcmlhYmxlc1xuICpcbiAqIENsYXVkZSBDb2RlIHNldHMgdGhlc2UgZW52aXJvbm1lbnQgdmFyaWFibGVzIHdoZW4gcnVubmluZyBob29rczpcbiAqXG4gKiB8IFZhcmlhYmxlIHwgRGVzY3JpcHRpb24gfCBBdmFpbGFibGUgSW4gfFxuICogfC0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tLXxcbiAqIHwgYENMQVVERV9QUk9KRUNUX0RJUmAgfCBBYnNvbHV0ZSBwYXRoIHRvIHByb2plY3Qgcm9vdCB8IEFsbCBob29rcyB8XG4gKiB8IGBDTEFVREVfRU5WX0ZJTEVgIHwgUGF0aCB0byBmaWxlIGZvciBwZXJzaXN0aW5nIGVudiB2YXJzIHwgU2Vzc2lvblN0YXJ0IG9ubHkgfFxuICogfCBgQ0xBVURFX0NPREVfUkVNT1RFYCB8IGBcInRydWVcImAgaWYgcnVubmluZyByZW1vdGVseSB8IEFsbCBob29rcyB8XG4gKiBAbW9kdWxlXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgZ2V0UHJvamVjdERpciwgcGVyc2lzdEVudlZhciwgaXNSZW1vdGVFbnZpcm9ubWVudCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gR2V0IHByb2plY3QgZGlyZWN0b3J5XG4gKiBjb25zdCBwcm9qZWN0RGlyID0gZ2V0UHJvamVjdERpcigpO1xuICpcbiAqIC8vIENoZWNrIGlmIHJ1bm5pbmcgcmVtb3RlbHlcbiAqIGlmIChpc1JlbW90ZUVudmlyb25tZW50KCkpIHtcbiAqICAgLy8gSGFuZGxlIHJlbW90ZS1zcGVjaWZpYyBsb2dpY1xuICogfVxuICpcbiAqIC8vIEluIFNlc3Npb25TdGFydCBob29rOiBwZXJzaXN0IGVudmlyb25tZW50IHZhcmlhYmxlc1xuICogcGVyc2lzdEVudlZhcignTk9ERV9FTlYnLCAncHJvZHVjdGlvbicpO1xuICogcGVyc2lzdEVudlZhcignQVBJX0tFWScsICdzZWNyZXQta2V5Jyk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNob29rLWV4ZWN1dGlvbi1kZXRhaWxzXG4gKi9cbmltcG9ydCAqIGFzIGZzIGZyb20gXCJub2RlOmZzXCI7XG4vKipcbiAqIENsYXVkZSBDb2RlIGVudmlyb25tZW50IHZhcmlhYmxlIG5hbWVzLlxuICpcbiAqIFRoZXNlIGFyZSB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIHRoYXQgQ2xhdWRlIENvZGUgc2V0cyB3aGVuIHJ1bm5pbmcgaG9va3MuXG4gKi9cbmV4cG9ydCBjb25zdCBDTEFVREVfRU5WX1ZBUlMgPSB7XG4gICAgLyoqXG4gICAgICogQWJzb2x1dGUgcGF0aCB0byB0aGUgcHJvamVjdCByb290IGRpcmVjdG9yeSB3aGVyZSBDbGF1ZGUgQ29kZSB3YXMgc3RhcnRlZC5cbiAgICAgKiBBdmFpbGFibGUgaW4gYWxsIGhvb2tzLlxuICAgICAqL1xuICAgIFBST0pFQ1RfRElSOiBcIkNMQVVERV9QUk9KRUNUX0RJUlwiLFxuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYSBmaWxlIHdoZXJlIFNlc3Npb25TdGFydCBob29rcyBjYW4gcGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXG4gICAgICogVmFyaWFibGVzIHdyaXR0ZW4gdG8gdGhpcyBmaWxlIHdpbGwgYmUgYXZhaWxhYmxlIGluIGFsbCBzdWJzZXF1ZW50IGJhc2ggY29tbWFuZHMuXG4gICAgICogT25seSBhdmFpbGFibGUgaW4gU2Vzc2lvblN0YXJ0IGhvb2tzLlxuICAgICAqL1xuICAgIEVOVl9GSUxFOiBcIkNMQVVERV9FTlZfRklMRVwiLFxuICAgIC8qKlxuICAgICAqIFNldCB0byBcInRydWVcIiB3aGVuIHJ1bm5pbmcgaW4gYSByZW1vdGUgKHdlYikgZW52aXJvbm1lbnQuXG4gICAgICogTm90IHNldCBvciBlbXB0eSB3aGVuIHJ1bm5pbmcgaW4gbG9jYWwgQ0xJIGVudmlyb25tZW50LlxuICAgICAqL1xuICAgIFJFTU9URTogXCJDTEFVREVfQ09ERV9SRU1PVEVcIixcbn07XG4vKipcbiAqIEdldHMgdGhlIENsYXVkZSBDb2RlIHByb2plY3QgZGlyZWN0b3J5LlxuICpcbiAqIFRoaXMgaXMgdGhlIGFic29sdXRlIHBhdGggdG8gdGhlIHByb2plY3Qgcm9vdCB3aGVyZSBDbGF1ZGUgQ29kZSB3YXMgc3RhcnRlZC5cbiAqIFRoZSB2YWx1ZSBjb21lcyBmcm9tIHRoZSBgQ0xBVURFX1BST0pFQ1RfRElSYCBlbnZpcm9ubWVudCB2YXJpYWJsZS5cbiAqIEByZXR1cm5zIFRoZSBwcm9qZWN0IGRpcmVjdG9yeSBwYXRoLCBvciB1bmRlZmluZWQgaWYgbm90IHNldFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IHByb2plY3REaXIgPSBnZXRQcm9qZWN0RGlyKCk7XG4gKiBpZiAocHJvamVjdERpcikge1xuICogICBjb25zdCBjb25maWdQYXRoID0gYCR7cHJvamVjdERpcn0vLmNsYXVkZS9jb25maWcuanNvbmA7XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFByb2plY3REaXIoKSB7XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52W0NMQVVERV9FTlZfVkFSUy5QUk9KRUNUX0RJUl07XG59XG4vKipcbiAqIEdldHMgdGhlIENsYXVkZSBDb2RlIGVudiBmaWxlIHBhdGggZm9yIHBlcnNpc3RpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICpcbiAqIFRoaXMgaXMgb25seSBhdmFpbGFibGUgaW4gU2Vzc2lvblN0YXJ0IGhvb2tzLiBUaGUgcGF0aCBwb2ludHMgdG8gYSBmaWxlXG4gKiB3aGVyZSB5b3UgY2FuIHdyaXRlIHNoZWxsIGV4cG9ydCBzdGF0ZW1lbnRzIHRvIHBlcnNpc3QgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gKiBmb3IgYWxsIHN1YnNlcXVlbnQgYmFzaCBjb21tYW5kcyBpbiB0aGUgc2Vzc2lvbi5cbiAqIEByZXR1cm5zIFRoZSBlbnYgZmlsZSBwYXRoLCBvciB1bmRlZmluZWQgaWYgbm90IHNldCAobm90IGEgU2Vzc2lvblN0YXJ0IGhvb2spXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3QgZW52RmlsZSA9IGdldEVudkZpbGVQYXRoKCk7XG4gKiBpZiAoZW52RmlsZSkge1xuICogICAvLyBXZSdyZSBpbiBhIFNlc3Npb25TdGFydCBob29rIGFuZCBjYW4gcGVyc2lzdCBlbnYgdmFyc1xuICogICBwZXJzaXN0RW52VmFyKCdNWV9WQVInLCAnbXktdmFsdWUnKTtcbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RW52RmlsZVBhdGgoKSB7XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52W0NMQVVERV9FTlZfVkFSUy5FTlZfRklMRV07XG59XG4vKipcbiAqIENoZWNrcyBpZiB0aGUgaG9vayBpcyBydW5uaW5nIGluIGEgcmVtb3RlICh3ZWIpIGVudmlyb25tZW50LlxuICpcbiAqIFJlbW90ZSBlbnZpcm9ubWVudHMgbWF5IGhhdmUgZGlmZmVyZW50IGNhcGFiaWxpdGllcyBvciByZXN0cmljdGlvbnNcbiAqIGNvbXBhcmVkIHRvIGxvY2FsIENMSSBlbnZpcm9ubWVudHMuXG4gKiBAcmV0dXJucyB0cnVlIGlmIHJ1bm5pbmcgcmVtb3RlbHksIGZhbHNlIGlmIHJ1bm5pbmcgbG9jYWxseVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGlmIChpc1JlbW90ZUVudmlyb25tZW50KCkpIHtcbiAqICAgLy8gVXNlIHdlYi1jb21wYXRpYmxlIGFwcHJvYWNoZXNcbiAqIH0gZWxzZSB7XG4gKiAgIC8vIENhbiB1c2UgbG9jYWwgQ0xJIGZlYXR1cmVzXG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUmVtb3RlRW52aXJvbm1lbnQoKSB7XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52W0NMQVVERV9FTlZfVkFSUy5SRU1PVEVdID09PSBcInRydWVcIjtcbn1cbi8qKlxuICogUGVyc2lzdHMgYW4gZW52aXJvbm1lbnQgdmFyaWFibGUgZm9yIHVzZSBpbiBzdWJzZXF1ZW50IGJhc2ggY29tbWFuZHMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB3cml0ZXMgYSBzaGVsbCBleHBvcnQgc3RhdGVtZW50IHRvIHRoZSBgQ0xBVURFX0VOVl9GSUxFYCxcbiAqIHdoaWNoIENsYXVkZSBDb2RlIHNvdXJjZXMgYmVmb3JlIHJ1bm5pbmcgYmFzaCBjb21tYW5kcy4gVGhpcyBhbGxvd3NcbiAqIFNlc3Npb25TdGFydCBob29rcyB0byBjb25maWd1cmUgdGhlIGVudmlyb25tZW50IGZvciB0aGUgZW50aXJlIHNlc3Npb24uXG4gKlxuICogKipJbXBvcnRhbnQqKjogVGhpcyBmdW5jdGlvbiBvbmx5IHdvcmtzIGluIFNlc3Npb25TdGFydCBob29rcyB3aGVyZVxuICogYENMQVVERV9FTlZfRklMRWAgaXMgc2V0LiBJbiBvdGhlciBob29rcywgaXQgd2lsbCB0aHJvdyBhbiBlcnJvci5cbiAqIEBwYXJhbSBuYW1lIC0gVGhlIGVudmlyb25tZW50IHZhcmlhYmxlIG5hbWVcbiAqIEBwYXJhbSB2YWx1ZSAtIFRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSB2YWx1ZSAod2lsbCBiZSBzaGVsbC1lc2NhcGVkKVxuICogQHRocm93cyBFcnJvciBpZiBDTEFVREVfRU5WX0ZJTEUgaXMgbm90IHNldCAobm90IGluIGEgU2Vzc2lvblN0YXJ0IGhvb2spXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc2Vzc2lvblN0YXJ0SG9vaywgc2Vzc2lvblN0YXJ0T3V0cHV0LCBwZXJzaXN0RW52VmFyIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiBleHBvcnQgZGVmYXVsdCBzZXNzaW9uU3RhcnRIb29rKHt9LCBhc3luYyAoaW5wdXQpID0+IHtcbiAqICAgLy8gUGVyc2lzdCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIHRoZSBzZXNzaW9uXG4gKiAgIHBlcnNpc3RFbnZWYXIoJ05PREVfRU5WJywgJ3Byb2R1Y3Rpb24nKTtcbiAqICAgcGVyc2lzdEVudlZhcignQVBJX0tFWScsIHByb2Nlc3MuZW52Lk1ZX0FQSV9LRVkgPz8gJ2RlZmF1bHQnKTtcbiAqICAgcGVyc2lzdEVudlZhcignUEFUSCcsIGAke3Byb2Nlc3MuZW52LlBBVEh9Oi4vbm9kZV9tb2R1bGVzLy5iaW5gKTtcbiAqXG4gKiAgIHJldHVybiBzZXNzaW9uU3RhcnRPdXRwdXQoe30pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNwZXJzaXN0aW5nLWVudmlyb25tZW50LXZhcmlhYmxlc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcGVyc2lzdEVudlZhcihuYW1lLCB2YWx1ZSkge1xuICAgIGNvbnN0IGVudkZpbGUgPSBnZXRFbnZGaWxlUGF0aCgpO1xuICAgIGlmIChlbnZGaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwicGVyc2lzdEVudlZhciBjYW4gb25seSBiZSB1c2VkIGluIFNlc3Npb25TdGFydCBob29rcy4gXCIgKyBcIkNMQVVERV9FTlZfRklMRSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBub3Qgc2V0LlwiKTtcbiAgICB9XG4gICAgLy8gU2hlbGwtZXNjYXBlIHRoZSB2YWx1ZSB0byBoYW5kbGUgc3BlY2lhbCBjaGFyYWN0ZXJzXG4gICAgY29uc3QgZXNjYXBlZFZhbHVlID0gZXNjYXBlU2hlbGxWYWx1ZSh2YWx1ZSk7XG4gICAgLy8gV3JpdGUgdGhlIGV4cG9ydCBzdGF0ZW1lbnRcbiAgICBjb25zdCBleHBvcnRTdGF0ZW1lbnQgPSBgZXhwb3J0ICR7bmFtZX09JHtlc2NhcGVkVmFsdWV9XFxuYDtcbiAgICBmcy5hcHBlbmRGaWxlU3luYyhlbnZGaWxlLCBleHBvcnRTdGF0ZW1lbnQsIFwidXRmLThcIik7XG59XG4vKipcbiAqIFBlcnNpc3RzIG11bHRpcGxlIGVudmlyb25tZW50IHZhcmlhYmxlcyBhdCBvbmNlLlxuICpcbiAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSB3cmFwcGVyIGFyb3VuZCBgcGVyc2lzdEVudlZhcmAgZm9yIHNldHRpbmdcbiAqIG11bHRpcGxlIHZhcmlhYmxlcyBpbiBhIHNpbmdsZSBjYWxsLlxuICogQHBhcmFtIHZhcnMgLSBPYmplY3QgbWFwcGluZyB2YXJpYWJsZSBuYW1lcyB0byB2YWx1ZXNcbiAqIEB0aHJvd3MgRXJyb3IgaWYgQ0xBVURFX0VOVl9GSUxFIGlzIG5vdCBzZXQgKG5vdCBpbiBhIFNlc3Npb25TdGFydCBob29rKVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHBlcnNpc3RFbnZWYXJzKHtcbiAqICAgTk9ERV9FTlY6ICdwcm9kdWN0aW9uJyxcbiAqICAgQVBJX0tFWTogJ3NlY3JldCcsXG4gKiAgIERFQlVHOiAnZmFsc2UnXG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGVyc2lzdEVudlZhcnModmFycykge1xuICAgIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh2YXJzKSkge1xuICAgICAgICBwZXJzaXN0RW52VmFyKG5hbWUsIHZhbHVlKTtcbiAgICB9XG59XG4vKipcbiAqIEVzY2FwZXMgYSB2YWx1ZSBmb3Igc2FmZSB1c2UgaW4gYSBzaGVsbCBleHBvcnQgc3RhdGVtZW50LlxuICpcbiAqIFVzZXMgc2luZ2xlIHF1b3RlcyBhbmQgZXNjYXBlcyBhbnkgZW1iZWRkZWQgc2luZ2xlIHF1b3Rlcy5cbiAqIFRoaXMgcHJldmVudHMgc2hlbGwgaW5qZWN0aW9uIGFuZCBoYW5kbGVzIHNwZWNpYWwgY2hhcmFjdGVycy5cbiAqIEBwYXJhbSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byBlc2NhcGVcbiAqIEByZXR1cm5zIFRoZSBzaGVsbC1lc2NhcGVkIHZhbHVlICh3aXRoIHF1b3RlcylcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBlc2NhcGVTaGVsbFZhbHVlKHZhbHVlKSB7XG4gICAgLy8gVXNlIHNpbmdsZSBxdW90ZXMgYW5kIGVzY2FwZSBhbnkgZW1iZWRkZWQgc2luZ2xlIHF1b3Rlc1xuICAgIC8vICd2YWx1ZScgLT4gJ3ZhbCdcXCcndWUnIGZvciB2YWx1ZXMgY29udGFpbmluZyBzaW5nbGUgcXVvdGVzXG4gICAgY29uc3QgZXNjYXBlZCA9IHZhbHVlLnJlcGxhY2UoLycvZywgXCInXFxcXCcnXCIpO1xuICAgIHJldHVybiBgJyR7ZXNjYXBlZH0nYDtcbn1cbiIsICIvKipcbiAqIEhvb2sgZmFjdG9yeSBmdW5jdGlvbnMgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIFByb3ZpZGVzIHR5cGVkIGZhY3RvcnkgZnVuY3Rpb25zIGZvciBhbGwgMTIgaG9vayB0eXBlcyB0aGF0IGhhbmRsZTpcbiAqIC0gSW5wdXQgdHlwZSBuYXJyb3dpbmcgYmFzZWQgb24gaG9vayBldmVudCB0eXBlXG4gKiAtIE91dHB1dCB0eXBlIGVuZm9yY2VtZW50IHZpYSByZXR1cm4gdHlwZXNcbiAqIC0gRXJyb3Igd3JhcHBpbmcgd2l0aCBhdXRvbWF0aWMgbG9nZ2luZ1xuICogLSBMb2dnZXIgY29udGV4dCBpbmplY3Rpb25cbiAqXG4gKiBFYWNoIGZhY3RvcnkgYWNjZXB0cyBhIEhvb2tDb25maWcgd2l0aCBvcHRpb25hbCBtYXRjaGVyIGFuZCB0aW1lb3V0IHNldHRpbmdzLFxuICogYW5kIHJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHRoZSBydW50aW1lIGludm9rZXMgd2hlbiB0aGUgaG9vayBmaWxlIGV4ZWN1dGVzLlxuICogQG1vZHVsZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHByZVRvb2xVc2VIb29rLCBwcmVUb29sVXNlT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiBleHBvcnQgZGVmYXVsdCBwcmVUb29sVXNlSG9vayh7IG1hdGNoZXI6ICdCYXNoJyB9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ1Byb2Nlc3NpbmcgQmFzaCBjb21tYW5kJyk7XG4gKiAgIHJldHVybiBwcmVUb29sVXNlT3V0cHV0KHsgYWxsb3c6IHRydWUgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzXG4gKi9cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEdlbmVyaWMgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgaG9vayBmYWN0b3J5IGZ1bmN0aW9uIGZvciBhIHNwZWNpZmljIGhvb2sgdHlwZS5cbiAqXG4gKiBUaGlzIGlzIHRoZSBpbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiB1c2VkIGJ5IGFsbCB0eXBlZCBmYWN0b3JpZXMuXG4gKiBJdCB3cmFwcyB0aGUgaGFuZGxlciB3aXRoIGVycm9yIGNhdGNoaW5nIGFuZCBsb2dnaW5nLlxuICogQHBhcmFtIGhvb2tFdmVudE5hbWUgLSBUaGUgaG9vayBldmVudCBuYW1lXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uXG4gKiBAcGFyYW0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIHdyYXBcbiAqIEByZXR1cm5zIEEgd3JhcHBlZCBob29rIGZ1bmN0aW9uXG4gKiBAaW50ZXJuYWxcbiAqL1xuZnVuY3Rpb24gY3JlYXRlSG9va0Z1bmN0aW9uKGhvb2tFdmVudE5hbWUsIGNvbmZpZywgaGFuZGxlcikge1xuICAgIGNvbnN0IGhvb2tGbiA9IGFzeW5jIChpbnB1dCwgY29udGV4dCkgPT4ge1xuICAgICAgICAvLyBEZWxlZ2F0ZSBlcnJvciBoYW5kbGluZyB0byB0aGUgcnVudGltZSAtIGp1c3QgZXhlY3V0ZSB0aGUgaGFuZGxlclxuICAgICAgICAvLyBUaGUgcnVudGltZSB3aWxsIGNhdGNoIGVycm9ycywgbG9nIHRoZW0sIGFuZCByZXR1cm4gYXBwcm9wcmlhdGUgb3V0cHV0XG4gICAgICAgIHJldHVybiBhd2FpdCBoYW5kbGVyKGlucHV0LCBjb250ZXh0KTtcbiAgICB9O1xuICAgIC8vIEF0dGFjaCBtZXRhZGF0YSBmb3IgcnVudGltZSBpbnNwZWN0aW9uXG4gICAgaG9va0ZuLmhvb2tFdmVudE5hbWUgPSBob29rRXZlbnROYW1lO1xuICAgIGhvb2tGbi5tYXRjaGVyID0gY29uZmlnLm1hdGNoZXI7XG4gICAgaG9va0ZuLnRpbWVvdXQgPSBjb25maWcudGltZW91dDtcbiAgICByZXR1cm4gaG9va0ZuO1xufVxuLyoqIEBpbmhlcml0ZG9jICovXG5leHBvcnQgZnVuY3Rpb24gcHJlVG9vbFVzZUhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlByZVRvb2xVc2VcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8qKiBAaW5oZXJpdGRvYyAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBvc3RUb29sVXNlSG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiUG9zdFRvb2xVc2VcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8qKiBAaW5oZXJpdGRvYyAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBvc3RUb29sVXNlRmFpbHVyZUhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlBvc3RUb29sVXNlRmFpbHVyZVwiLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gTm90aWZpY2F0aW9uIEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgTm90aWZpY2F0aW9uIGhvb2sgaGFuZGxlci5cbiAqXG4gKiBOb3RpZmljYXRpb24gaG9va3MgZmlyZSB3aGVuIENsYXVkZSBDb2RlIHNlbmRzIGEgbm90aWZpY2F0aW9uLCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEZvcndhcmQgbm90aWZpY2F0aW9ucyB0byBleHRlcm5hbCBzeXN0ZW1zXG4gKiAtIExvZyBpbXBvcnRhbnQgZXZlbnRzXG4gKiAtIFRyaWdnZXIgY3VzdG9tIGFsZXJ0aW5nXG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgbm90aWZpY2F0aW9uX3R5cGVgXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgbm90aWZpY2F0aW9uSG9vaywgbm90aWZpY2F0aW9uT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBGb3J3YXJkIG5vdGlmaWNhdGlvbnMgdG8gU2xhY2tcbiAqIGV4cG9ydCBkZWZhdWx0IG5vdGlmaWNhdGlvbkhvb2soe30sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnTm90aWZpY2F0aW9uIHJlY2VpdmVkJywge1xuICogICAgIHR5cGU6IGlucHV0Lm5vdGlmaWNhdGlvbl90eXBlLFxuICogICAgIHRpdGxlOiBpbnB1dC50aXRsZVxuICogICB9KTtcbiAqXG4gKiAgIGF3YWl0IHNlbmRTbGFja01lc3NhZ2UoaW5wdXQudGl0bGUgPz8gJ05vdGlmaWNhdGlvbicsIGlucHV0Lm1lc3NhZ2UpO1xuICpcbiAqICAgcmV0dXJuIG5vdGlmaWNhdGlvbk91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI25vdGlmaWNhdGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gbm90aWZpY2F0aW9uSG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiTm90aWZpY2F0aW9uXCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBVc2VyUHJvbXB0U3VibWl0IEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgVXNlclByb21wdFN1Ym1pdCBob29rIGhhbmRsZXIuXG4gKlxuICogVXNlclByb21wdFN1Ym1pdCBob29rcyBmaXJlIHdoZW4gYSB1c2VyIHN1Ym1pdHMgYSBwcm9tcHQsIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gQWRkIGFkZGl0aW9uYWwgY29udGV4dCBvciBpbnN0cnVjdGlvbnNcbiAqIC0gTG9nIHVzZXIgaW50ZXJhY3Rpb25zXG4gKiAtIFZhbGlkYXRlIG9yIHRyYW5zZm9ybSBwcm9tcHRzXG4gKlxuICogKipNYXRjaGVyKio6IE5vIG1hdGNoZXIgc3VwcG9ydCAtIGZpcmVzIG9uIGFsbCBwcm9tcHQgc3VibWlzc2lvbnNcbiAqIEBwYXJhbSBjb25maWcgLSBIb29rIGNvbmZpZ3VyYXRpb24gd2l0aCBvcHRpb25hbCB0aW1lb3V0IChtYXRjaGVyIGlzIGlnbm9yZWQpXG4gKiBAcGFyYW0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcbiAqIEByZXR1cm5zIEEgaG9vayBmdW5jdGlvbiB0aGF0IGNhbiBiZSBleHBvcnRlZCBhcyB0aGUgZGVmYXVsdCBleHBvcnRcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyB1c2VyUHJvbXB0U3VibWl0SG9vaywgdXNlclByb21wdFN1Ym1pdE91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gQWRkIHByb2plY3QgY29udGV4dCB0byBldmVyeSBwcm9tcHRcbiAqIGV4cG9ydCBkZWZhdWx0IHVzZXJQcm9tcHRTdWJtaXRIb29rKHt9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmRlYnVnKCdVc2VyIHByb21wdCBzdWJtaXR0ZWQnLCB7IHByb21wdExlbmd0aDogaW5wdXQucHJvbXB0Lmxlbmd0aCB9KTtcbiAqXG4gKiAgIGNvbnN0IHByb2plY3RDb250ZXh0ID0gYXdhaXQgZ2V0UHJvamVjdENvbnRleHQoKTtcbiAqXG4gKiAgIHJldHVybiB1c2VyUHJvbXB0U3VibWl0T3V0cHV0KHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogcHJvamVjdENvbnRleHRcbiAqICAgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3VzZXJwcm9tcHRzdWJtaXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVzZXJQcm9tcHRTdWJtaXRIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJVc2VyUHJvbXB0U3VibWl0XCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTZXNzaW9uU3RhcnQgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTZXNzaW9uU3RhcnQgaG9vayBoYW5kbGVyLlxuICpcbiAqIFNlc3Npb25TdGFydCBob29rcyBmaXJlIHdoZW4gYSBDbGF1ZGUgQ29kZSBzZXNzaW9uIHN0YXJ0cyBvciByZXN0YXJ0cyxcbiAqIGFsbG93aW5nIHlvdSB0bzpcbiAqIC0gSW5pdGlhbGl6ZSBzZXNzaW9uIHN0YXRlXG4gKiAtIEluamVjdCBjb250ZXh0IG9yIGluc3RydWN0aW9uc1xuICogLSBQZXJzaXN0IGVudmlyb25tZW50IHZhcmlhYmxlcyBmb3Igc3Vic2VxdWVudCBiYXNoIGNvbW1hbmRzXG4gKiAtIFNldCB1cCBsb2dnaW5nIG9yIG1vbml0b3JpbmdcbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGBzb3VyY2VgICgnc3RhcnR1cCcsICdyZXN1bWUnLCAnY2xlYXInLCAnY29tcGFjdCcpXG4gKlxuICogKipDb250ZXh0Kio6IFNlc3Npb25TdGFydCBob29rcyByZWNlaXZlIGFuIGV4dGVuZGVkIGNvbnRleHQgd2l0aCBgcGVyc2lzdEVudlZhcmBcbiAqIGFuZCBgcGVyc2lzdEVudlZhcnNgIGZ1bmN0aW9ucyBmb3Igc2V0dGluZyBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc2Vzc2lvblN0YXJ0SG9vaywgc2Vzc2lvblN0YXJ0T3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBQZXJzaXN0IGVudmlyb25tZW50IHZhcmlhYmxlcyBmb3IgdGhlIHNlc3Npb25cbiAqIGV4cG9ydCBkZWZhdWx0IHNlc3Npb25TdGFydEhvb2soeyBtYXRjaGVyOiAnc3RhcnR1cCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciwgcGVyc2lzdEVudlZhciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdOZXcgc2Vzc2lvbiBzdGFydGVkJywge1xuICogICAgIHNlc3Npb25JZDogaW5wdXQuc2Vzc2lvbl9pZCxcbiAqICAgICBjd2Q6IGlucHV0LmN3ZFxuICogICB9KTtcbiAqXG4gKiAgIC8vIFNldCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZm9yIGFsbCBzdWJzZXF1ZW50IGJhc2ggY29tbWFuZHNcbiAqICAgcGVyc2lzdEVudlZhcignTk9ERV9FTlYnLCAnZGV2ZWxvcG1lbnQnKTtcbiAqICAgcGVyc2lzdEVudlZhcignREVCVUcnLCAndHJ1ZScpO1xuICpcbiAqICAgcmV0dXJuIHNlc3Npb25TdGFydE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIFNldCBtdWx0aXBsZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYXQgb25jZVxuICogZXhwb3J0IGRlZmF1bHQgc2Vzc2lvblN0YXJ0SG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IHBlcnNpc3RFbnZWYXJzIH0pID0+IHtcbiAqICAgcGVyc2lzdEVudlZhcnMoe1xuICogICAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXG4gKiAgICAgQVBJX0tFWTogJ3NlY3JldCcsXG4gKiAgICAgREVCVUc6ICdmYWxzZSdcbiAqICAgfSk7XG4gKlxuICogICByZXR1cm4gc2Vzc2lvblN0YXJ0T3V0cHV0KHt9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc2Vzc2lvbnN0YXJ0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXNzaW9uU3RhcnRIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJTZXNzaW9uU3RhcnRcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFNlc3Npb25FbmQgSG9vayBGYWN0b3J5XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIENyZWF0ZXMgYSBTZXNzaW9uRW5kIGhvb2sgaGFuZGxlci5cbiAqXG4gKiBTZXNzaW9uRW5kIGhvb2tzIGZpcmUgd2hlbiBhIENsYXVkZSBDb2RlIHNlc3Npb24gZW5kcywgYWxsb3dpbmcgeW91IHRvOlxuICogLSBDbGVhbiB1cCBzZXNzaW9uIHJlc291cmNlc1xuICogLSBMb2cgc2Vzc2lvbiBtZXRyaWNzXG4gKiAtIFBlcnNpc3Qgc2Vzc2lvbiBzdGF0ZVxuICpcbiAqICoqTWF0Y2hlcioqOiBNYXRjaGVzIGFnYWluc3QgYHJlYXNvbmAgKHRoZSBleGl0IHJlYXNvbiBzdHJpbmcpXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc2Vzc2lvbkVuZEhvb2ssIHNlc3Npb25FbmRPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIExvZyBzZXNzaW9uIGVuZCBhbmQgY2xlYW4gdXBcbiAqIGV4cG9ydCBkZWZhdWx0IHNlc3Npb25FbmRIb29rKHt9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ1Nlc3Npb24gZW5kZWQnLCB7XG4gKiAgICAgc2Vzc2lvbklkOiBpbnB1dC5zZXNzaW9uX2lkLFxuICogICAgIHJlYXNvbjogaW5wdXQucmVhc29uXG4gKiAgIH0pO1xuICpcbiAqICAgYXdhaXQgY2xlYW51cFNlc3Npb25SZXNvdXJjZXMoaW5wdXQuc2Vzc2lvbl9pZCk7XG4gKlxuICogICByZXR1cm4gc2Vzc2lvbkVuZE91dHB1dCh7fSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzI3Nlc3Npb25lbmRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlc3Npb25FbmRIb29rKGNvbmZpZywgaGFuZGxlcikge1xuICAgIHJldHVybiBjcmVhdGVIb29rRnVuY3Rpb24oXCJTZXNzaW9uRW5kXCIsIGNvbmZpZywgaGFuZGxlcik7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdG9wIEhvb2sgRmFjdG9yeVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGEgU3RvcCBob29rIGhhbmRsZXIuXG4gKlxuICogU3RvcCBob29rcyBmaXJlIHdoZW4gQ2xhdWRlIENvZGUgaXMgYWJvdXQgdG8gc3RvcCwgYWxsb3dpbmcgeW91IHRvOlxuICogLSBCbG9jayB0aGUgc3RvcCBhbmQgcmVxdWlyZSBhZGRpdGlvbmFsIGFjdGlvblxuICogLSBDb25maXJtIHRoZSB1c2VyIHdhbnRzIHRvIHN0b3BcbiAqIC0gQ2xlYW4gdXAgcmVzb3VyY2VzIGJlZm9yZSBzdG9wcGluZ1xuICpcbiAqICoqTWF0Y2hlcioqOiBObyBtYXRjaGVyIHN1cHBvcnQgLSBmaXJlcyBvbiBhbGwgc3RvcCBldmVudHNcbiAqIEBwYXJhbSBjb25maWcgLSBIb29rIGNvbmZpZ3VyYXRpb24gd2l0aCBvcHRpb25hbCB0aW1lb3V0IChtYXRjaGVyIGlzIGlnbm9yZWQpXG4gKiBAcGFyYW0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcbiAqIEByZXR1cm5zIEEgaG9vayBmdW5jdGlvbiB0aGF0IGNhbiBiZSBleHBvcnRlZCBhcyB0aGUgZGVmYXVsdCBleHBvcnRcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBzdG9wSG9vaywgc3RvcE91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gQmxvY2sgc3RvcCBpZiB0aGVyZSBhcmUgcGVuZGluZyBjaGFuZ2VzXG4gKiBleHBvcnQgZGVmYXVsdCBzdG9wSG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGNvbnN0IHBlbmRpbmdDaGFuZ2VzID0gYXdhaXQgY2hlY2tQZW5kaW5nQ2hhbmdlcygpO1xuICpcbiAqICAgaWYgKHBlbmRpbmdDaGFuZ2VzLmxlbmd0aCA+IDApIHtcbiAqICAgICBsb2dnZXIud2FybignQmxvY2tpbmcgc3RvcCBkdWUgdG8gcGVuZGluZyBjaGFuZ2VzJywge1xuICogICAgICAgY291bnQ6IHBlbmRpbmdDaGFuZ2VzLmxlbmd0aFxuICogICAgIH0pO1xuICpcbiAqICAgICByZXR1cm4gc3RvcE91dHB1dCh7XG4gKiAgICAgICBkZWNpc2lvbjogJ2Jsb2NrJyxcbiAqICAgICAgIHJlYXNvbjogYFRoZXJlIGFyZSAke3BlbmRpbmdDaGFuZ2VzLmxlbmd0aH0gdW5jb21taXR0ZWQgY2hhbmdlc2AsXG4gKiAgICAgICBzeXN0ZW1NZXNzYWdlOiAnUGxlYXNlIGNvbW1pdCBvciBkaXNjYXJkIGNoYW5nZXMgYmVmb3JlIHN0b3BwaW5nJ1xuICogICAgIH0pO1xuICogICB9XG4gKlxuICogICBsb2dnZXIuaW5mbygnQXBwcm92aW5nIHN0b3AnKTtcbiAqICAgcmV0dXJuIHN0b3BPdXRwdXQoeyBkZWNpc2lvbjogJ2FwcHJvdmUnIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNzdG9wXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdG9wSG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiU3RvcFwiLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3ViYWdlbnRTdGFydCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFN1YmFnZW50U3RhcnQgaG9vayBoYW5kbGVyLlxuICpcbiAqIFN1YmFnZW50U3RhcnQgaG9va3MgZmlyZSB3aGVuIGEgc3ViYWdlbnQgKFRhc2sgdG9vbCkgc3RhcnRzLCBhbGxvd2luZyB5b3UgdG86XG4gKiAtIEluamVjdCBjb250ZXh0IGZvciB0aGUgc3ViYWdlbnRcbiAqIC0gTG9nIHN1YmFnZW50IGludm9jYXRpb25zXG4gKiAtIENvbmZpZ3VyZSBzdWJhZ2VudCBiZWhhdmlvclxuICpcbiAqICoqTWF0Y2hlcioqOiBNYXRjaGVzIGFnYWluc3QgYGFnZW50X3R5cGVgIChlLmcuLCAnZXhwbG9yZScsICdjb2RlYmFzZS1hbmFseXNpcycpXG4gKiBAcGFyYW0gY29uZmlnIC0gSG9vayBjb25maWd1cmF0aW9uIHdpdGggb3B0aW9uYWwgbWF0Y2hlciBhbmQgdGltZW91dFxuICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcmV0dXJucyBBIGhvb2sgZnVuY3Rpb24gdGhhdCBjYW4gYmUgZXhwb3J0ZWQgYXMgdGhlIGRlZmF1bHQgZXhwb3J0XG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgc3ViYWdlbnRTdGFydEhvb2ssIHN1YmFnZW50U3RhcnRPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEFkZCBjb250ZXh0IGZvciBleHBsb3JlIHN1YmFnZW50c1xuICogZXhwb3J0IGRlZmF1bHQgc3ViYWdlbnRTdGFydEhvb2soeyBtYXRjaGVyOiAnZXhwbG9yZScgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdFeHBsb3JlIHN1YmFnZW50IHN0YXJ0aW5nJywge1xuICogICAgIGFnZW50SWQ6IGlucHV0LmFnZW50X2lkLFxuICogICAgIGFnZW50VHlwZTogaW5wdXQuYWdlbnRfdHlwZVxuICogICB9KTtcbiAqXG4gKiAgIHJldHVybiBzdWJhZ2VudFN0YXJ0T3V0cHV0KHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ0ZvY3VzIG9uIGZpbmRpbmcgcGF0dGVybnMgYW5kIGNvbnZlbnRpb25zJ1xuICogICB9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3Mjc3ViYWdlbnRzdGFydFxuICovXG5leHBvcnQgZnVuY3Rpb24gc3ViYWdlbnRTdGFydEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlN1YmFnZW50U3RhcnRcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFN1YmFnZW50U3RvcCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFN1YmFnZW50U3RvcCBob29rIGhhbmRsZXIuXG4gKlxuICogU3ViYWdlbnRTdG9wIGhvb2tzIGZpcmUgd2hlbiBhIHN1YmFnZW50IGNvbXBsZXRlcyBvciBzdG9wcywgYWxsb3dpbmcgeW91IHRvOlxuICogLSBCbG9jayB0aGUgc3ViYWdlbnQgZnJvbSBzdG9wcGluZ1xuICogLSBQcm9jZXNzIHN1YmFnZW50IHJlc3VsdHNcbiAqIC0gQ2xlYW4gdXAgc3ViYWdlbnQgcmVzb3VyY2VzXG4gKiAtIExvZyBzdWJhZ2VudCBjb21wbGV0aW9uXG4gKlxuICogKipNYXRjaGVyKio6IE1hdGNoZXMgYWdhaW5zdCBgYWdlbnRfdHlwZWAgKGUuZy4sICdleHBsb3JlJywgJ2NvZGViYXNlLWFuYWx5c2lzJylcbiAqIEBwYXJhbSBjb25maWcgLSBIb29rIGNvbmZpZ3VyYXRpb24gd2l0aCBvcHRpb25hbCBtYXRjaGVyIGFuZCB0aW1lb3V0XG4gKiBAcGFyYW0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcbiAqIEByZXR1cm5zIEEgaG9vayBmdW5jdGlvbiB0aGF0IGNhbiBiZSBleHBvcnRlZCBhcyB0aGUgZGVmYXVsdCBleHBvcnRcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBzdWJhZ2VudFN0b3BIb29rLCBzdWJhZ2VudFN0b3BPdXRwdXQgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICpcbiAqIC8vIEJsb2NrIGV4cGxvcmUgc3ViYWdlbnRzIGlmIHRhc2sgaW5jb21wbGV0ZVxuICogZXhwb3J0IGRlZmF1bHQgc3ViYWdlbnRTdG9wSG9vayh7IG1hdGNoZXI6ICdleHBsb3JlJyB9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ1N1YmFnZW50IHN0b3BwaW5nJywge1xuICogICAgIGFnZW50SWQ6IGlucHV0LmFnZW50X2lkLFxuICogICAgIGFnZW50VHlwZTogaW5wdXQuYWdlbnRfdHlwZVxuICogICB9KTtcbiAqXG4gKiAgIC8vIEJsb2NrIGlmIHRyYW5zY3JpcHQgc2hvd3MgaW5jb21wbGV0ZSB3b3JrXG4gKiAgIHJldHVybiBzdWJhZ2VudFN0b3BPdXRwdXQoe1xuICogICAgIGRlY2lzaW9uOiAnYmxvY2snLFxuICogICAgIHJlYXNvbjogJ1BsZWFzZSB2ZXJpZnkgZXhwbG9yYXRpb24gaXMgY29tcGxldGUnXG4gKiAgIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNzdWJhZ2VudHN0b3BcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1YmFnZW50U3RvcEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlN1YmFnZW50U3RvcFwiLCBjb25maWcsIGhhbmRsZXIpO1xufVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gUHJlQ29tcGFjdCBIb29rIEZhY3Rvcnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogQ3JlYXRlcyBhIFByZUNvbXBhY3QgaG9vayBoYW5kbGVyLlxuICpcbiAqIFByZUNvbXBhY3QgaG9va3MgZmlyZSBiZWZvcmUgY29udGV4dCBjb21wYWN0aW9uIG9jY3VycywgYWxsb3dpbmcgeW91IHRvOlxuICogLSBQcmVzZXJ2ZSBpbXBvcnRhbnQgaW5mb3JtYXRpb24gYmVmb3JlIGNvbXBhY3Rpb25cbiAqIC0gTG9nIGNvbXBhY3Rpb24gZXZlbnRzXG4gKiAtIE1vZGlmeSBjdXN0b20gaW5zdHJ1Y3Rpb25zIGZvciB0aGUgY29tcGFjdGVkIGNvbnRleHRcbiAqXG4gKiAqKk1hdGNoZXIqKjogTWF0Y2hlcyBhZ2FpbnN0IGB0cmlnZ2VyYCAoJ21hbnVhbCcsICdhdXRvJylcbiAqIEBwYXJhbSBjb25maWcgLSBIb29rIGNvbmZpZ3VyYXRpb24gd2l0aCBvcHRpb25hbCBtYXRjaGVyIGFuZCB0aW1lb3V0XG4gKiBAcGFyYW0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcbiAqIEByZXR1cm5zIEEgaG9vayBmdW5jdGlvbiB0aGF0IGNhbiBiZSBleHBvcnRlZCBhcyB0aGUgZGVmYXVsdCBleHBvcnRcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBwcmVDb21wYWN0SG9vaywgcHJlQ29tcGFjdE91dHB1dCB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gTG9nIGNvbXBhY3Rpb24gZXZlbnRzIGFuZCBwcmVzZXJ2ZSBjb250ZXh0XG4gKiBleHBvcnQgZGVmYXVsdCBwcmVDb21wYWN0SG9vayh7fSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci5pbmZvKCdDb250ZXh0IGNvbXBhY3Rpb24gdHJpZ2dlcmVkJywge1xuICogICAgIHRyaWdnZXI6IGlucHV0LnRyaWdnZXIsXG4gKiAgICAgaGFzQ3VzdG9tSW5zdHJ1Y3Rpb25zOiBpbnB1dC5jdXN0b21faW5zdHJ1Y3Rpb25zICE9PSBudWxsXG4gKiAgIH0pO1xuICpcbiAqICAgcmV0dXJuIHByZUNvbXBhY3RPdXRwdXQoe1xuICogICAgIHN5c3RlbU1lc3NhZ2U6ICdSZW1lbWJlcjogc3RyaWN0IG1vZGUgaXMgZW5hYmxlZCdcbiAqICAgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIE9ubHkgaGFuZGxlIG1hbnVhbCBjb21wYWN0aW9uXG4gKiBleHBvcnQgZGVmYXVsdCBwcmVDb21wYWN0SG9vayh7IG1hdGNoZXI6ICdtYW51YWwnIH0sIGFzeW5jIChpbnB1dCwgeyBsb2dnZXIgfSkgPT4ge1xuICogICBsb2dnZXIuaW5mbygnTWFudWFsIGNvbXBhY3Rpb24gcmVxdWVzdGVkJyk7XG4gKiAgIHJldHVybiBwcmVDb21wYWN0T3V0cHV0KHt9KTtcbiAqIH0pO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjcHJlY29tcGFjdFxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJlQ29tcGFjdEhvb2soY29uZmlnLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUhvb2tGdW5jdGlvbihcIlByZUNvbXBhY3RcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbi8qKiBAaW5oZXJpdGRvYyAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBlcm1pc3Npb25SZXF1ZXN0SG9vayhjb25maWcsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gY3JlYXRlSG9va0Z1bmN0aW9uKFwiUGVybWlzc2lvblJlcXVlc3RcIiwgY29uZmlnLCBoYW5kbGVyKTtcbn1cbiIsICIvKipcbiAqIExvZ2dlciBzeXN0ZW0gZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIFByb3ZpZGVzIHN0cnVjdHVyZWQgbG9nZ2luZyB3aXRoIGV2ZW50IHN1YnNjcmlwdGlvbiBhbmQgb3B0aW9uYWwgZmlsZSBvdXRwdXQuXG4gKiBUaGUgbG9nZ2VyIGlzICoqc2lsZW50IGJ5IGRlZmF1bHQqKiB0byBhdm9pZCBpbnRlcmZlcmluZyB3aXRoIGhvb2sgcHJvdG9jb2xcbiAqIChzdGRvdXQgaXMgcmVzZXJ2ZWQgZm9yIEpTT04gcmVzcG9uc2VzLCBzdGRlcnIgbWF5IGNvbmZsaWN0IHdpdGggQ2xhdWRlIENvZGUpLlxuICogQG1vZHVsZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogLy8gU3Vic2NyaWJlIHRvIGxvZyBldmVudHNcbiAqIGNvbnN0IHVuc3Vic2NyaWJlID0gbG9nZ2VyLm9uKCdlcnJvcicsIChldmVudCkgPT4ge1xuICogICBjb25zb2xlLmVycm9yKGBFcnJvciBpbiAke2V2ZW50Lmhvb2tUeXBlfTogJHtldmVudC5tZXNzYWdlfWApO1xuICogfSk7XG4gKlxuICogLy8gTGF0ZXIsIGNsZWFuIHVwXG4gKiB1bnN1YnNjcmliZSgpO1xuICogYGBgXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3NcbiAqL1xuaW1wb3J0IHsgY2xvc2VTeW5jLCBleGlzdHNTeW5jLCBta2RpclN5bmMsIG9wZW5TeW5jLCB3cml0ZVN5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgZGlybmFtZSB9IGZyb20gXCJub2RlOnBhdGhcIjtcbi8qKlxuICogQWxsIGxvZyBsZXZlbHMgaW4gb3JkZXIgb2Ygc2V2ZXJpdHkgKGxvd2VzdCB0byBoaWdoZXN0KS5cbiAqL1xuZXhwb3J0IGNvbnN0IExPR19MRVZFTFMgPSBbXCJkZWJ1Z1wiLCBcImluZm9cIiwgXCJ3YXJuXCIsIFwiZXJyb3JcIl07XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBMb2dnZXIgQ2xhc3Ncbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogTG9nZ2VyIGZvciBDbGF1ZGUgQ29kZSBob29rcyB3aXRoIGV2ZW50IHN1YnNjcmlwdGlvbiBhbmQgZmlsZSBvdXRwdXQuXG4gKlxuICogIyMgS2V5IEJlaGF2aW9yc1xuICpcbiAqIHwgQ29uZmlndXJhdGlvbiB8IEJlaGF2aW9yIHxcbiAqIHwtLS0tLS0tLS0tLS0tLXwtLS0tLS0tLS0tfFxuICogfCBObyBjb25maWcgKGRlZmF1bHQpIHwgKipTaWxlbnQqKiAtIG5vIG91dHB1dCBhbnl3aGVyZSB8XG4gKiB8IGBDTEFVREVfQ09ERV9IT09LU19MT0dfRklMRWAgZW52IHZhciB8IEFwcGVuZCBKU09OIGxpbmVzIHRvIGZpbGUgfFxuICogfCBgLm9uKGxldmVsLCBoYW5kbGVyKWAgcmVnaXN0ZXJlZCB8IEV2ZW50cyBkZWxpdmVyZWQgdG8gaGFuZGxlcnMgb25seSB8XG4gKiB8IE11bHRpcGxlIGRlc3RpbmF0aW9ucyB8IEFsbCBkZXN0aW5hdGlvbnMgcmVjZWl2ZSBldmVudHMgfFxuICpcbiAqICMjIEltcG9ydGFudCBOb3Rlc1xuICpcbiAqIC0gKipOZXZlciBvdXRwdXRzIHRvIHN0ZG91dCoqIChyZXNlcnZlZCBmb3IgSlNPTiBob29rIHJlc3BvbnNlKVxuICogLSAqKk5ldmVyIG91dHB1dHMgdG8gc3RkZXJyKiogKG1heSBpbnRlcmZlcmUgd2l0aCBDbGF1ZGUgQ29kZSBlcnJvciBoYW5kbGluZylcbiAqIC0gRmlsZSBvdXRwdXQgdXNlcyBKU09OIExpbmVzIGZvcm1hdCBmb3IgZWFzeSBwYXJzaW5nXG4gKiAtIGAub24obGV2ZWwsIGhhbmRsZXIpYCByZXR1cm5zIGFuIHVuc3Vic2NyaWJlIGZ1bmN0aW9uXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiAvLyBTdWJzY3JpYmUgdG8gZXZlbnRzIGF0IHNwZWNpZmljIGxldmVsXG4gKiBsb2dnZXIub24oJ3dhcm4nLCAoZXZlbnQpID0+IHtcbiAqICAgc2VuZEFsZXJ0KGV2ZW50Lm1lc3NhZ2UpO1xuICogfSk7XG4gKlxuICogLy8gTG9nIHdpdGhpbiBhIGhvb2sgaGFuZGxlclxuICogZXhwb3J0IGRlZmF1bHQgcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnQmFzaCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci53YXJuKCdBYm91dCB0byB2YWxpZGF0ZSBCYXNoIGNvbW1hbmQnKTtcbiAqICAgcmV0dXJuIHByZVRvb2xVc2VPdXRwdXQoeyBhbGxvdzogdHJ1ZSB9KTtcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2dnZXIge1xuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyZWQgZXZlbnQgaGFuZGxlcnMgYnkgbG9nIGxldmVsLlxuICAgICAqL1xuICAgIGhhbmRsZXJzID0gbmV3IE1hcCgpO1xuICAgIC8qKlxuICAgICAqIEZpbGUgZGVzY3JpcHRvciBmb3IgbG9nIGZpbGUgb3V0cHV0LlxuICAgICAqIExhemlseSBpbml0aWFsaXplZCBvbiBmaXJzdCB3cml0ZS5cbiAgICAgKi9cbiAgICBsb2dGaWxlRmQgPSBudWxsO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gdGhlIGxvZyBmaWxlLCBpZiBjb25maWd1cmVkLlxuICAgICAqL1xuICAgIGxvZ0ZpbGVQYXRoID0gbnVsbDtcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIGZpbGUgaW5pdGlhbGl6YXRpb24gaGFzIGJlZW4gYXR0ZW1wdGVkLlxuICAgICAqL1xuICAgIGZpbGVJbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIC8qKlxuICAgICAqIEN1cnJlbnQgaG9vayBjb250ZXh0IGZvciBlbnJpY2hpbmcgbG9nIGV2ZW50cy5cbiAgICAgKi9cbiAgICBjdXJyZW50SG9va1R5cGU7XG4gICAgLyoqXG4gICAgICogQ3VycmVudCBob29rIGlucHV0IGZvciBlbnJpY2hpbmcgbG9nIGV2ZW50cy5cbiAgICAgKi9cbiAgICBjdXJyZW50SW5wdXQ7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBMb2dnZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBUeXBpY2FsbHkgeW91IHNob3VsZCB1c2UgdGhlIGV4cG9ydGVkIGBsb2dnZXJgIHNpbmdsZXRvbiByYXRoZXIgdGhhblxuICAgICAqIGNyZWF0aW5nIG5ldyBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIGNvbmZpZyAtIE9wdGlvbmFsIGNvbmZpZ3VyYXRpb25cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiAvLyBVc2Ugc2luZ2xldG9uIChyZWNvbW1lbmRlZClcbiAgICAgKiBpbXBvcnQgeyBsb2dnZXIgfSBmcm9tICdAZ29vZGZvb3QvY2xhdWRlLWNvZGUtaG9va3MnO1xuICAgICAqXG4gICAgICogLy8gT3IgY3JlYXRlIGN1c3RvbSBpbnN0YW5jZVxuICAgICAqIGNvbnN0IGN1c3RvbUxvZ2dlciA9IG5ldyBMb2dnZXIoeyBsb2dGaWxlUGF0aDogJy92YXIvbG9nL2hvb2tzLmxvZycgfSk7XG4gICAgICogYGBgXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBoYW5kbGVycyBtYXAgZm9yIGVhY2ggbGV2ZWxcbiAgICAgICAgZm9yIChjb25zdCBsZXZlbCBvZiBMT0dfTEVWRUxTKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZXJzLnNldChsZXZlbCwgbmV3IFNldCgpKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBTZXQgbG9nIGZpbGUgcGF0aCBmcm9tIGNvbmZpZyBvciBlbnZpcm9ubWVudFxuICAgICAgICB0aGlzLmxvZ0ZpbGVQYXRoID0gY29uZmlnLmxvZ0ZpbGVQYXRoID8/IHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0hPT0tTX0xPR19GSUxFID8/IG51bGw7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIExvZ3MgYSBkZWJ1ZyBtZXNzYWdlLlxuICAgICAqXG4gICAgICogVXNlIGZvciBkZXRhaWxlZCBkZWJ1Z2dpbmcgaW5mb3JtYXRpb24gdGhhdCBpcyB0eXBpY2FsbHkgb25seSB1c2VmdWxcbiAgICAgKiBkdXJpbmcgZGV2ZWxvcG1lbnQgb3IgdHJvdWJsZXNob290aW5nLlxuICAgICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIGRlYnVnIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBgdHlwZXNjcmlwdFxuICAgICAqIGxvZ2dlci5kZWJ1ZygnUHJvY2Vzc2luZyB0b29sIGlucHV0JywgeyB0b29sTmFtZTogJ0Jhc2gnLCBpbnB1dFNpemU6IDI1NiB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBkZWJ1ZyhtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgICAgIHRoaXMuZW1pdChcImRlYnVnXCIsIG1lc3NhZ2UsIGNvbnRleHQpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBMb2dzIGFuIGluZm8gbWVzc2FnZS5cbiAgICAgKlxuICAgICAqIFVzZSBmb3IgZ2VuZXJhbCBvcGVyYXRpb25hbCBldmVudHMgbGlrZSBob29rIGludm9jYXRpb25zLCBzdWNjZXNzZnVsXG4gICAgICogY29tcGxldGlvbnMsIG9yIHN0YXRlIGNoYW5nZXMuXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgLSBUaGUgaW5mbyBtZXNzYWdlXG4gICAgICogQHBhcmFtIGNvbnRleHQgLSBPcHRpb25hbCBhZGRpdGlvbmFsIGNvbnRleHRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiBsb2dnZXIuaW5mbygnU2Vzc2lvbiBzdGFydGVkJywgeyBzb3VyY2U6ICdzdGFydHVwJywgc2Vzc2lvbklkOiAnYWJjMTIzJyB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBpbmZvKG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgdGhpcy5lbWl0KFwiaW5mb1wiLCBtZXNzYWdlLCBjb250ZXh0KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTG9ncyBhIHdhcm5pbmcgbWVzc2FnZS5cbiAgICAgKlxuICAgICAqIFVzZSBmb3IgY29uZGl0aW9ucyB0aGF0IG1heSBpbmRpY2F0ZSBpc3N1ZXMgYnV0IGRvbid0IHByZXZlbnRcbiAgICAgKiBvcGVyYXRpb24sIHN1Y2ggYXMgZGVwcmVjYXRlZCBwYXR0ZXJucyBvciBwZXJmb3JtYW5jZSBjb25jZXJucy5cbiAgICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSB3YXJuaW5nIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBgdHlwZXNjcmlwdFxuICAgICAqIGxvZ2dlci53YXJuKCdEZXByZWNhdGVkIGhvb2sgcGF0dGVybiBkZXRlY3RlZCcsIHsgcGF0dGVybjogJ2xlZ2FjeU1hdGNoZXInIH0pO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHdhcm4obWVzc2FnZSwgY29udGV4dCkge1xuICAgICAgICB0aGlzLmVtaXQoXCJ3YXJuXCIsIG1lc3NhZ2UsIGNvbnRleHQpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBMb2dzIGFuIGVycm9yIG1lc3NhZ2UuXG4gICAgICpcbiAgICAgKiBVc2UgZm9yIGVycm9yIGNvbmRpdGlvbnMgdGhhdCByZXF1aXJlIGF0dGVudGlvbiBidXQgd2VyZSBoYW5kbGVkXG4gICAgICogZ3JhY2VmdWxseS4gRm9yIGV4Y2VwdGlvbnMsIHByZWZlciB7QGxpbmsgbG9nRXJyb3J9LlxuICAgICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIGVycm9yIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBgdHlwZXNjcmlwdFxuICAgICAqIGxvZ2dlci5lcnJvcignRmFpbGVkIHRvIHZhbGlkYXRlIHRvb2wgaW5wdXQnLCB7IHRvb2xOYW1lOiAnQmFzaCcsIHJlYXNvbjogJ2VtcHR5IGNvbW1hbmQnIH0pO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGVycm9yKG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgdGhpcy5lbWl0KFwiZXJyb3JcIiwgbWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIExvZ3MgYSBzdHJ1Y3R1cmVkIGVycm9yIHdpdGggZnVsbCBlcnJvciBkZXRhaWxzLlxuICAgICAqXG4gICAgICogVXNlIHRoaXMgbWV0aG9kIHdoZW4gbG9nZ2luZyBjYXVnaHQgZXhjZXB0aW9ucyB0byBjYXB0dXJlIHRoZSBmdWxsXG4gICAgICogZXJyb3IgY29udGV4dCBpbmNsdWRpbmcgbmFtZSwgbWVzc2FnZSwgc3RhY2sgdHJhY2UsIGFuZCBjYXVzZSBjaGFpbi5cbiAgICAgKiBAcGFyYW0gZXJyb3IgLSBUaGUgZXJyb3IgdG8gbG9nXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgLSBIdW1hbi1yZWFkYWJsZSBkZXNjcmlwdGlvbiBvZiB3aGF0IGZhaWxlZFxuICAgICAqIEBwYXJhbSBjb250ZXh0IC0gT3B0aW9uYWwgYWRkaXRpb25hbCBjb250ZXh0XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBgYGB0eXBlc2NyaXB0XG4gICAgICogdHJ5IHtcbiAgICAgKiAgIGF3YWl0IGRhbmdlcm91c09wZXJhdGlvbigpO1xuICAgICAqIH0gY2F0Y2ggKGVycikge1xuICAgICAqICAgbG9nZ2VyLmxvZ0Vycm9yKGVyciwgJ0ZhaWxlZCB0byBleGVjdXRlIGRhbmdlcm91cyBvcGVyYXRpb24nLCB7XG4gICAgICogICAgIG9wZXJhdGlvbjogJ2RlbGV0ZScsXG4gICAgICogICAgIHRhcmdldDogJy9pbXBvcnRhbnQvZmlsZS50eHQnXG4gICAgICogICB9KTtcbiAgICAgKiB9XG4gICAgICogYGBgXG4gICAgICovXG4gICAgbG9nRXJyb3IoZXJyb3IsIG1lc3NhZ2UsIGNvbnRleHQpIHtcbiAgICAgICAgY29uc3QgZXJyb3JJbmZvID0gdGhpcy5leHRyYWN0RXJyb3JJbmZvKGVycm9yKTtcbiAgICAgICAgY29uc3QgZXZlbnQgPSB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGxldmVsOiBcImVycm9yXCIsXG4gICAgICAgICAgICBob29rVHlwZTogdGhpcy5jdXJyZW50SG9va1R5cGUsXG4gICAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICAgICAgaW5wdXQ6IHRoaXMuY3VycmVudElucHV0LFxuICAgICAgICAgICAgZXJyb3I6IGVycm9ySW5mbyxcbiAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZGVsaXZlckV2ZW50KGV2ZW50KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU3Vic2NyaWJlcyBhIGhhbmRsZXIgdG8gbG9nIGV2ZW50cyBhdCB0aGUgc3BlY2lmaWVkIGxldmVsLlxuICAgICAqXG4gICAgICogVGhlIGhhbmRsZXIgd2lsbCBiZSBjYWxsZWQgZm9yIGV2ZXJ5IGxvZyBldmVudCBhdCB0aGUgc3BlY2lmaWVkIGxldmVsLlxuICAgICAqIFJldHVybnMgYW4gdW5zdWJzY3JpYmUgZnVuY3Rpb24gdGhhdCBzaG91bGQgYmUgY2FsbGVkIHdoZW4gdGhlIGhhbmRsZXJcbiAgICAgKiBpcyBubyBsb25nZXIgbmVlZGVkLlxuICAgICAqIEBwYXJhbSBsZXZlbCAtIFRoZSBsb2cgbGV2ZWwgdG8gc3Vic2NyaWJlIHRvXG4gICAgICogQHBhcmFtIGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBjYWxsIGZvciBlYWNoIGV2ZW50XG4gICAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byB1bnN1YnNjcmliZSB0aGUgaGFuZGxlclxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBgdHlwZXNjcmlwdFxuICAgICAqIC8vIFN1YnNjcmliZSB0byBlcnJvciBldmVudHNcbiAgICAgKiBjb25zdCB1bnN1YnNjcmliZSA9IGxvZ2dlci5vbignZXJyb3InLCAoZXZlbnQpID0+IHtcbiAgICAgKiAgIGNvbnNvbGUuZXJyb3IoYFske2V2ZW50Lmhvb2tUeXBlfV0gJHtldmVudC5tZXNzYWdlfWApO1xuICAgICAqICAgaWYgKGV2ZW50LmVycm9yKSB7XG4gICAgICogICAgIGNvbnNvbGUuZXJyb3IoZXZlbnQuZXJyb3Iuc3RhY2spO1xuICAgICAqICAgfVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gTGF0ZXIsIGNsZWFuIHVwXG4gICAgICogdW5zdWJzY3JpYmUoKTtcbiAgICAgKiBgYGBcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGBgYHR5cGVzY3JpcHRcbiAgICAgKiAvLyBGb3J3YXJkIHRvIGV4dGVybmFsIGxvZ2dpbmcgbGlicmFyeVxuICAgICAqIGltcG9ydCBwaW5vIGZyb20gJ3Bpbm8nO1xuICAgICAqIGNvbnN0IHBpbm9Mb2dnZXIgPSBwaW5vKCk7XG4gICAgICpcbiAgICAgKiBsb2dnZXIub24oJ2luZm8nLCAoZXZlbnQpID0+IHBpbm9Mb2dnZXIuaW5mbyhldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICAgICAqIGxvZ2dlci5vbignd2FybicsIChldmVudCkgPT4gcGlub0xvZ2dlci53YXJuKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gICAgICogbG9nZ2VyLm9uKCdlcnJvcicsIChldmVudCkgPT4gcGlub0xvZ2dlci5lcnJvcihldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIG9uKGxldmVsLCBoYW5kbGVyKSB7XG4gICAgICAgIGNvbnN0IGxldmVsSGFuZGxlcnMgPSB0aGlzLmhhbmRsZXJzLmdldChsZXZlbCk7XG4gICAgICAgIGlmIChsZXZlbEhhbmRsZXJzKSB7XG4gICAgICAgICAgICBsZXZlbEhhbmRsZXJzLmFkZChoYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgbGV2ZWxIYW5kbGVycz8uZGVsZXRlKGhhbmRsZXIpO1xuICAgICAgICB9O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBjdXJyZW50IGhvb2sgY29udGV4dCBmb3IgZW5yaWNoaW5nIGxvZyBldmVudHMuXG4gICAgICpcbiAgICAgKiBUaGlzIGlzIGNhbGxlZCBpbnRlcm5hbGx5IGJ5IHRoZSBydW50aW1lIGJlZm9yZSBpbnZva2luZyBob29rIGhhbmRsZXJzLlxuICAgICAqIFlvdSB0eXBpY2FsbHkgZG9uJ3QgbmVlZCB0byBjYWxsIHRoaXMgZGlyZWN0bHkuXG4gICAgICogQHBhcmFtIGhvb2tUeXBlIC0gVGhlIHR5cGUgb2YgaG9vayBiZWluZyBleGVjdXRlZFxuICAgICAqIEBwYXJhbSBpbnB1dCAtIFRoZSBob29rIGlucHV0IGRhdGFcbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKi9cbiAgICBzZXRDb250ZXh0KGhvb2tUeXBlLCBpbnB1dCkge1xuICAgICAgICB0aGlzLmN1cnJlbnRIb29rVHlwZSA9IGhvb2tUeXBlO1xuICAgICAgICB0aGlzLmN1cnJlbnRJbnB1dCA9IGlucHV0O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgdGhlIGN1cnJlbnQgaG9vayBjb250ZXh0LlxuICAgICAqXG4gICAgICogQ2FsbGVkIGludGVybmFsbHkgYnkgdGhlIHJ1bnRpbWUgYWZ0ZXIgaG9vayBleGVjdXRpb24gY29tcGxldGVzLlxuICAgICAqIEBpbnRlcm5hbFxuICAgICAqL1xuICAgIGNsZWFyQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50SG9va1R5cGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuY3VycmVudElucHV0ID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHRoZSBsb2cgZmlsZSBwYXRoIGF0IHJ1bnRpbWUuXG4gICAgICpcbiAgICAgKiBDYWxsIHRoaXMgdG8gZW5hYmxlIG9yIGNoYW5nZSBmaWxlIGxvZ2dpbmcuIFNldHRpbmcgdG8gYG51bGxgIGRpc2FibGVzXG4gICAgICogZmlsZSBsb2dnaW5nIChidXQgZG9lc24ndCBjbG9zZSBleGlzdGluZyBmaWxlIGhhbmRsZSBpbW1lZGlhdGVseSkuXG4gICAgICogQHBhcmFtIGZpbGVQYXRoIC0gUGF0aCB0byB0aGUgbG9nIGZpbGUsIG9yIG51bGwgdG8gZGlzYWJsZVxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBgdHlwZXNjcmlwdFxuICAgICAqIC8vIEVuYWJsZSBmaWxlIGxvZ2dpbmcgYXQgcnVudGltZVxuICAgICAqIGxvZ2dlci5zZXRMb2dGaWxlKCcvdmFyL2xvZy9jbGF1ZGUtaG9va3MubG9nJyk7XG4gICAgICpcbiAgICAgKiAvLyBEaXNhYmxlIGZpbGUgbG9nZ2luZ1xuICAgICAqIGxvZ2dlci5zZXRMb2dGaWxlKG51bGwpO1xuICAgICAqIGBgYFxuICAgICAqL1xuICAgIHNldExvZ0ZpbGUoZmlsZVBhdGgpIHtcbiAgICAgICAgLy8gQ2xvc2UgZXhpc3RpbmcgZmlsZSBpZiBvcGVuXG4gICAgICAgIGlmICh0aGlzLmxvZ0ZpbGVGZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjbG9zZVN5bmModGhpcy5sb2dGaWxlRmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2gge1xuICAgICAgICAgICAgICAgIC8vIElnbm9yZSBlcnJvcnMgb24gY2xvc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubG9nRmlsZUZkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxvZ0ZpbGVQYXRoID0gZmlsZVBhdGg7XG4gICAgICAgIHRoaXMuZmlsZUluaXRpYWxpemVkID0gZmFsc2U7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENsb3NlcyBhbGwgcmVzb3VyY2VzIGhlbGQgYnkgdGhlIGxvZ2dlci5cbiAgICAgKlxuICAgICAqIENhbGwgdGhpcyBkdXJpbmcgZ3JhY2VmdWwgc2h1dGRvd24gdG8gZW5zdXJlIGFsbCBsb2cgZGF0YSBpcyBmbHVzaGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYGBgdHlwZXNjcmlwdFxuICAgICAqIHByb2Nlc3Mub24oJ2V4aXQnLCAoKSA9PiB7XG4gICAgICogICBsb2dnZXIuY2xvc2UoKTtcbiAgICAgKiB9KTtcbiAgICAgKiBgYGBcbiAgICAgKi9cbiAgICBjbG9zZSgpIHtcbiAgICAgICAgaWYgKHRoaXMubG9nRmlsZUZkICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNsb3NlU3luYyh0aGlzLmxvZ0ZpbGVGZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCB7XG4gICAgICAgICAgICAgICAgLy8gSWdub3JlIGVycm9ycyBvbiBjbG9zZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2dGaWxlRmQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZmlsZUluaXRpYWxpemVkID0gZmFsc2U7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiB0aGVyZSBhcmUgYW55IGFjdGl2ZSBoYW5kbGVycyBvciBkZXN0aW5hdGlvbnMuXG4gICAgICpcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgYW55IGhhbmRsZXJzIGFyZSByZWdpc3RlcmVkIG9yIGZpbGUgbG9nZ2luZyBpcyBlbmFibGVkLlxuICAgICAqIEByZXR1cm5zIFdoZXRoZXIgdGhlIGxvZ2dlciBoYXMgYW55IGFjdGl2ZSBvdXRwdXQgZGVzdGluYXRpb25zXG4gICAgICovXG4gICAgaGFzRGVzdGluYXRpb25zKCkge1xuICAgICAgICBmb3IgKGNvbnN0IGhhbmRsZXJzIG9mIHRoaXMuaGFuZGxlcnMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIGlmIChoYW5kbGVycy5zaXplID4gMClcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5sb2dGaWxlUGF0aCAhPT0gbnVsbDtcbiAgICB9XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFByaXZhdGUgTWV0aG9kc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvKipcbiAgICAgKiBFbWl0cyBhIGxvZyBldmVudC5cbiAgICAgKiBAcGFyYW0gbGV2ZWwgLSBUaGUgc2V2ZXJpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50XG4gICAgICogQHBhcmFtIG1lc3NhZ2UgLSBUaGUgbG9nIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gY29udGV4dCAtIE9wdGlvbmFsIGFkZGl0aW9uYWwgY29udGV4dCBkYXRhXG4gICAgICovXG4gICAgZW1pdChsZXZlbCwgbWVzc2FnZSwgY29udGV4dCkge1xuICAgICAgICBjb25zdCBldmVudCA9IHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgbGV2ZWwsXG4gICAgICAgICAgICBob29rVHlwZTogdGhpcy5jdXJyZW50SG9va1R5cGUsXG4gICAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICAgICAgaW5wdXQ6IHRoaXMuY3VycmVudElucHV0LFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5kZWxpdmVyRXZlbnQoZXZlbnQpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWxpdmVycyBhbiBldmVudCB0byBhbGwgcmVnaXN0ZXJlZCBkZXN0aW5hdGlvbnMuXG4gICAgICogQHBhcmFtIGV2ZW50IC0gVGhlIGxvZyBldmVudCB0byBkZWxpdmVyXG4gICAgICovXG4gICAgZGVsaXZlckV2ZW50KGV2ZW50KSB7XG4gICAgICAgIC8vIERlbGl2ZXIgdG8gZXZlbnQgaGFuZGxlcnNcbiAgICAgICAgY29uc3QgbGV2ZWxIYW5kbGVycyA9IHRoaXMuaGFuZGxlcnMuZ2V0KGV2ZW50LmxldmVsKTtcbiAgICAgICAgaWYgKGxldmVsSGFuZGxlcnMpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgaGFuZGxlciBvZiBsZXZlbEhhbmRsZXJzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlcihldmVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU2lsZW50bHkgaWdub3JlIGhhbmRsZXIgZXJyb3JzIHRvIG5vdCBkaXNydXB0IGhvb2sgZXhlY3V0aW9uXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFdyaXRlIHRvIGZpbGUgaWYgY29uZmlndXJlZFxuICAgICAgICB0aGlzLndyaXRlVG9GaWxlKGV2ZW50KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogV3JpdGVzIGFuIGV2ZW50IHRvIHRoZSBsb2cgZmlsZS5cbiAgICAgKiBAcGFyYW0gZXZlbnQgLSBUaGUgbG9nIGV2ZW50IHRvIHdyaXRlXG4gICAgICovXG4gICAgd3JpdGVUb0ZpbGUoZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLmxvZ0ZpbGVQYXRoKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAvLyBMYXp5IGluaXRpYWxpemF0aW9uIG9mIGZpbGUgaGFuZGxlXG4gICAgICAgIGlmICghdGhpcy5maWxlSW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZUZpbGUoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5sb2dGaWxlRmQgPT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsaW5lID0gYCR7SlNPTi5zdHJpbmdpZnkoZXZlbnQpfVxcbmA7XG4gICAgICAgICAgICB3cml0ZVN5bmModGhpcy5sb2dGaWxlRmQsIGxpbmUpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIHtcbiAgICAgICAgICAgIC8vIFNpbGVudGx5IGlnbm9yZSBmaWxlIHdyaXRlIGVycm9ycyB0byBub3QgZGlzcnVwdCBob29rIGV4ZWN1dGlvblxuICAgICAgICAgICAgLy8gVGhpcyBmb2xsb3dzIHRoZSByaXNrIG1pdGlnYXRpb246IFwiR3JhY2VmdWwgZGVncmFkYXRpb24gLSBsb2cgd3JpdGVcbiAgICAgICAgICAgIC8vIGZhaWx1cmVzIGFyZSBzaWxlbnRseSBpZ25vcmVkIHRvIG5vdCBkaXNydXB0IGhvb2sgZXhlY3V0aW9uXCJcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplcyB0aGUgbG9nIGZpbGUgZm9yIHdyaXRpbmcuXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZUZpbGUoKSB7XG4gICAgICAgIHRoaXMuZmlsZUluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKCF0aGlzLmxvZ0ZpbGVQYXRoKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gRW5zdXJlIGRpcmVjdG9yeSBleGlzdHNcbiAgICAgICAgICAgIGNvbnN0IGRpciA9IGRpcm5hbWUodGhpcy5sb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICBpZiAoIWV4aXN0c1N5bmMoZGlyKSkge1xuICAgICAgICAgICAgICAgIG1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gT3BlbiBmaWxlIGZvciBhcHBlbmRpbmdcbiAgICAgICAgICAgIHRoaXMubG9nRmlsZUZkID0gb3BlblN5bmModGhpcy5sb2dGaWxlUGF0aCwgXCJhXCIpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIHtcbiAgICAgICAgICAgIC8vIFNpbGVudGx5IGlnbm9yZSBmaWxlIGluaXRpYWxpemF0aW9uIGVycm9yc1xuICAgICAgICAgICAgdGhpcy5sb2dGaWxlRmQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHN0cnVjdHVyZWQgZXJyb3IgaW5mb3JtYXRpb24gZnJvbSBhbiB1bmtub3duIGVycm9yLlxuICAgICAqIEBwYXJhbSBlcnJvciAtIFRoZSBlcnJvciB0byBleHRyYWN0IGluZm9ybWF0aW9uIGZyb21cbiAgICAgKiBAcmV0dXJucyBTdHJ1Y3R1cmVkIGVycm9yIGluZm9ybWF0aW9uXG4gICAgICovXG4gICAgZXh0cmFjdEVycm9ySW5mbyhlcnJvcikge1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgICAgY29uc3QgaW5mbyA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBlcnJvci5uYW1lLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIC8vIEV4dHJhY3QgY2F1c2UgY2hhaW4gaWYgcHJlc2VudFxuICAgICAgICAgICAgaWYgKGVycm9yLmNhdXNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBpbmZvLmNhdXNlID0gdGhpcy5leHRyYWN0RXJyb3JJbmZvKGVycm9yLmNhdXNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbmZvO1xuICAgICAgICB9XG4gICAgICAgIC8vIEhhbmRsZSBub24tRXJyb3IgdmFsdWVzXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBuYW1lOiBcIlVua25vd25FcnJvclwiLFxuICAgICAgICAgICAgbWVzc2FnZTogU3RyaW5nKGVycm9yKSxcbiAgICAgICAgfTtcbiAgICB9XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTaW5nbGV0b24gRXhwb3J0XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIEdsb2JhbCBsb2dnZXIgaW5zdGFuY2UgZm9yIENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIFVzZSB0aGlzIHNpbmdsZXRvbiBmb3IgYWxsIGxvZ2dpbmcgd2l0aGluIGhvb2tzLiBUaGUgbG9nZ2VyIGlzIGNvbmZpZ3VyZWRcbiAqIHZpYSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIHN1cHBvcnRzIGV2ZW50IHN1YnNjcmlwdGlvbiBmb3IgY3VzdG9tXG4gKiBkZXN0aW5hdGlvbnMuXG4gKlxuICogIyMgQ29uZmlndXJhdGlvblxuICpcbiAqIHwgRW52aXJvbm1lbnQgVmFyaWFibGUgfCBEZXNjcmlwdGlvbiB8XG4gKiB8LS0tLS0tLS0tLS0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS18XG4gKiB8IGBDTEFVREVfQ09ERV9IT09LU19MT0dfRklMRWAgfCBQYXRoIHRvIGxvZyBmaWxlIChKU09OIExpbmVzIGZvcm1hdCkgfFxuICpcbiAqICMjIFVzYWdlIGluIEhvb2tzXG4gKlxuICogVGhlIGxvZ2dlciBpcyBwYXNzZWQgdG8gaG9vayBoYW5kbGVycyB2aWEgY29udGV4dCBmb3IgY29udmVuaWVuY2U6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogZXhwb3J0IGRlZmF1bHQgcHJlVG9vbFVzZUhvb2soeyBtYXRjaGVyOiAnQmFzaCcgfSwgYXN5bmMgKGlucHV0LCB7IGxvZ2dlciB9KSA9PiB7XG4gKiAgIGxvZ2dlci53YXJuKCdWYWxpZGF0aW5nIEJhc2ggY29tbWFuZCcpO1xuICogICByZXR1cm4gcHJlVG9vbFVzZU91dHB1dCh7IGFsbG93OiB0cnVlIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiAjIyBFeHRlcm5hbCBJbnRlZ3JhdGlvblxuICpcbiAqIFN1YnNjcmliZSB0byBldmVudHMgdG8gZm9yd2FyZCBsb2dzIHRvIGV4dGVybmFsIHN5c3RlbXM6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqIGltcG9ydCBwaW5vIGZyb20gJ3Bpbm8nO1xuICpcbiAqIGNvbnN0IHBpbm9Mb2dnZXIgPSBwaW5vKHsgbGV2ZWw6ICdkZWJ1ZycgfSk7XG4gKlxuICogbG9nZ2VyLm9uKCdkZWJ1ZycsIChldmVudCkgPT4gcGlub0xvZ2dlci5kZWJ1ZyhldmVudCwgZXZlbnQubWVzc2FnZSkpO1xuICogbG9nZ2VyLm9uKCdpbmZvJywgKGV2ZW50KSA9PiBwaW5vTG9nZ2VyLmluZm8oZXZlbnQsIGV2ZW50Lm1lc3NhZ2UpKTtcbiAqIGxvZ2dlci5vbignd2FybicsIChldmVudCkgPT4gcGlub0xvZ2dlci53YXJuKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gKiBsb2dnZXIub24oJ2Vycm9yJywgKGV2ZW50KSA9PiBwaW5vTG9nZ2VyLmVycm9yKGV2ZW50LCBldmVudC5tZXNzYWdlKSk7XG4gKiBgYGBcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBEaXJlY3QgdXNhZ2VcbiAqIGltcG9ydCB7IGxvZ2dlciB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcyc7XG4gKlxuICogbG9nZ2VyLmluZm8oJ1N0YXJ0aW5nIG9wZXJhdGlvbicpO1xuICogbG9nZ2VyLndhcm4oJ1Jlc291cmNlIGxpbWl0IGFwcHJvYWNoaW5nJywgeyB1c2FnZTogMC45IH0pO1xuICpcbiAqIHRyeSB7XG4gKiAgIGF3YWl0IHJpc2t5T3BlcmF0aW9uKCk7XG4gKiB9IGNhdGNoIChlcnIpIHtcbiAqICAgbG9nZ2VyLmxvZ0Vycm9yKGVyciwgJ1Jpc2t5IG9wZXJhdGlvbiBmYWlsZWQnKTtcbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3QgbG9nZ2VyID0gbmV3IExvZ2dlcigpO1xuIiwgIi8qKlxuICogT3V0cHV0IHR5cGVzIGFuZCBidWlsZGVycyBmb3IgQ2xhdWRlIENvZGUgaG9va3MuXG4gKlxuICogUHJvdmlkZXMgdHlwZS1zYWZlIG91dHB1dCBidWlsZGVyIGZ1bmN0aW9ucyBmb3IgYWxsIDEyIGhvb2sgdHlwZXMuIEVhY2ggYnVpbGRlclxuICogYWNjZXB0cyBvcHRpb25zIHRoYXQgbWF0Y2ggdGhlIHdpcmUgZm9ybWF0IGV4cGVjdGVkIGJ5IENsYXVkZSBDb2RlLCB3aXRoIHR5cGVzXG4gKiBkZXJpdmVkIGZyb20gdGhlIENsYXVkZSBBZ2VudCBTREsncyBgU3luY0hvb2tKU09OT3V0cHV0YCB0eXBlLlxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzXG4gKiBAbW9kdWxlXG4gKi9cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEV4aXQgQ29kZSBDb25zdGFudHNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogRXhpdCBjb2RlcyB1c2VkIGJ5IENsYXVkZSBDb2RlIGhvb2tzLlxuICpcbiAqIHwgRXhpdCBDb2RlIHwgTmFtZSB8IFdoZW4gVXNlZCB8IENsYXVkZSBDb2RlIEJlaGF2aW9yIHxcbiAqIHwtLS0tLS0tLS0tLXwtLS0tLS18LS0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tfFxuICogfCAwIHwgU3VjY2VzcyB8IEhhbmRsZXIgcmV0dXJucyBub3JtYWxseSB8IENvbnRpbnVlLCBwYXJzZSBzdGRvdXQgYXMgSlNPTiB8XG4gKiB8IDEgfCBFcnJvciB8IEludmFsaWQgaW5wdXQsIG5vbi1ibG9ja2luZyBlcnJvciB8IE5vbi1ibG9ja2luZywgc3RkZXJyIHRvIHVzZXIgb25seSB8XG4gKiB8IDIgfCBCbG9jayB8IEhhbmRsZXIgdGhyb3dzIE9SIGBzdG9wUmVhc29uYCBzZXQgfCBCbG9ja2luZywgc3RkZXJyIHNob3duIHRvIENsYXVkZSB8XG4gKi9cbmV4cG9ydCBjb25zdCBFWElUX0NPREVTID0ge1xuICAgIC8qKiBIYW5kbGVyIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHkuIENsYXVkZSBDb2RlIHBhcnNlcyBzdGRvdXQgYXMgSlNPTi4gKi9cbiAgICBTVUNDRVNTOiAwLFxuICAgIC8qKiBOb24tYmxvY2tpbmcgZXJyb3Igb2NjdXJyZWQgKGUuZy4sIGludmFsaWQgaW5wdXQpLiBzdGRlcnIgc2hvd24gdG8gdXNlciBvbmx5LiAqL1xuICAgIEVSUk9SOiAxLFxuICAgIC8qKiBIYW5kbGVyIHRocmV3IGV4Y2VwdGlvbiBPUiBibG9ja2luZyBhY3Rpb24gcmVxdWVzdGVkLiBzdGRlcnIgc2hvd24gdG8gQ2xhdWRlLiAqL1xuICAgIEJMT0NLOiAyLFxufTtcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIE91dHB1dCBCdWlsZGVyIEZhY3Rvcmllc1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBGYWN0b3J5IGZvciBob29rcyB0aGF0IGhhdmUgaG9va1NwZWNpZmljT3V0cHV0IHdpdGggYSBob29rRXZlbnROYW1lIGRpc2NyaW1pbmF0b3IuXG4gKiBAcGFyYW0gaG9va1R5cGUgLSBUaGUgaG9vayB0eXBlIG5hbWUgdXNlZCBhcyB0aGUgX3R5cGUgZGlzY3JpbWluYXRvclxuICogQHJldHVybnMgQSBidWlsZGVyIGZ1bmN0aW9uIHRoYXQgY3JlYXRlcyB0aGUgb3V0cHV0IG9iamVjdFxuICogQGludGVybmFsXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoaG9va1R5cGUpIHtcbiAgICByZXR1cm4gKG9wdGlvbnMgPSB7fSkgPT4ge1xuICAgICAgICBjb25zdCB7IGhvb2tTcGVjaWZpY091dHB1dCwgLi4ucmVzdCB9ID0gb3B0aW9ucztcbiAgICAgICAgY29uc3Qgc3Rkb3V0ID0gaG9va1NwZWNpZmljT3V0cHV0ICE9PSB1bmRlZmluZWRcbiAgICAgICAgICAgID8geyAuLi5yZXN0LCBob29rU3BlY2lmaWNPdXRwdXQ6IHsgaG9va0V2ZW50TmFtZTogaG9va1R5cGUsIC4uLmhvb2tTcGVjaWZpY091dHB1dCB9IH1cbiAgICAgICAgICAgIDogcmVzdDtcbiAgICAgICAgcmV0dXJuIHsgX3R5cGU6IGhvb2tUeXBlLCBzdGRvdXQgfTtcbiAgICB9O1xufVxuLyoqXG4gKiBGYWN0b3J5IGZvciBob29rcyB0aGF0IG9ubHkgdXNlIENvbW1vbk9wdGlvbnMgKHNpbXBsZSBwYXNzdGhyb3VnaCkuXG4gKiBAcGFyYW0gaG9va1R5cGUgLSBUaGUgaG9vayB0eXBlIG5hbWUgdXNlZCBhcyB0aGUgX3R5cGUgZGlzY3JpbWluYXRvclxuICogQHJldHVybnMgQSBidWlsZGVyIGZ1bmN0aW9uIHRoYXQgY3JlYXRlcyB0aGUgb3V0cHV0IG9iamVjdFxuICogQGludGVybmFsXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVNpbXBsZU91dHB1dEJ1aWxkZXIoaG9va1R5cGUpIHtcbiAgICByZXR1cm4gKG9wdGlvbnMgPSB7fSkgPT4gKHtcbiAgICAgICAgX3R5cGU6IGhvb2tUeXBlLFxuICAgICAgICBzdGRvdXQ6IG9wdGlvbnMsXG4gICAgfSk7XG59XG4vKipcbiAqIEZhY3RvcnkgZm9yIGhvb2tzIHRoYXQgdXNlIGRlY2lzaW9uLWJhc2VkIG9wdGlvbnMgKFN0b3AsIFN1YmFnZW50U3RvcCkuXG4gKiBAcGFyYW0gaG9va1R5cGUgLSBUaGUgaG9vayB0eXBlIG5hbWUgdXNlZCBhcyB0aGUgX3R5cGUgZGlzY3JpbWluYXRvclxuICogQHJldHVybnMgQSBidWlsZGVyIGZ1bmN0aW9uIHRoYXQgY3JlYXRlcyB0aGUgb3V0cHV0IG9iamVjdFxuICogQGludGVybmFsXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZURlY2lzaW9uT3V0cHV0QnVpbGRlcihob29rVHlwZSkge1xuICAgIHJldHVybiAob3B0aW9ucyA9IHt9KSA9PiAoe1xuICAgICAgICBfdHlwZTogaG9va1R5cGUsXG4gICAgICAgIHN0ZG91dDogb3B0aW9ucyxcbiAgICB9KTtcbn1cbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFByZVRvb2xVc2UgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFByZVRvb2xVc2VPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEFsbG93IHRvb2wgZXhlY3V0aW9uXG4gKiBwcmVUb29sVXNlT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7IHBlcm1pc3Npb25EZWNpc2lvbjogJ2FsbG93JyB9XG4gKiB9KTtcbiAqXG4gKiAvLyBEZW55IHdpdGggcmVhc29uXG4gKiBwcmVUb29sVXNlT3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgcGVybWlzc2lvbkRlY2lzaW9uOiAnZGVueScsXG4gKiAgICAgcGVybWlzc2lvbkRlY2lzaW9uUmVhc29uOiAnRGFuZ2Vyb3VzIGNvbW1hbmQgZGV0ZWN0ZWQnXG4gKiAgIH1cbiAqIH0pO1xuICpcbiAqIC8vIEFsbG93IHdpdGggbW9kaWZpZWQgaW5wdXRcbiAqIHByZVRvb2xVc2VPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBwZXJtaXNzaW9uRGVjaXNpb246ICdhbGxvdycsXG4gKiAgICAgdXBkYXRlZElucHV0OiB7IGNvbW1hbmQ6ICdscyAtbGEnIH1cbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHByZVRvb2xVc2VPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcihcIlByZVRvb2xVc2VcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQb3N0VG9vbFVzZSBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgUG9zdFRvb2xVc2VPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEFkZCBjb250ZXh0IGFmdGVyIGEgZmlsZSByZWFkXG4gKiBwb3N0VG9vbFVzZU91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiAnRmlsZSBjb250YWlucyBzZW5zaXRpdmUgZGF0YSdcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHBvc3RUb29sVXNlT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoXCJQb3N0VG9vbFVzZVwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFBvc3RUb29sVXNlRmFpbHVyZSBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgUG9zdFRvb2xVc2VGYWlsdXJlT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBwb3N0VG9vbFVzZUZhaWx1cmVPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ1RyeSB1c2luZyBhIGRpZmZlcmVudCBhcHByb2FjaCdcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHBvc3RUb29sVXNlRmFpbHVyZU91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKFwiUG9zdFRvb2xVc2VGYWlsdXJlXCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgVXNlclByb21wdFN1Ym1pdCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgVXNlclByb21wdFN1Ym1pdE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogdXNlclByb21wdFN1Ym1pdE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGFkZGl0aW9uYWxDb250ZXh0OiAnVGhpcyBwcm9qZWN0IHVzZXMgVHlwZVNjcmlwdCBzdHJpY3QgbW9kZSdcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHVzZXJQcm9tcHRTdWJtaXRPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcihcIlVzZXJQcm9tcHRTdWJtaXRcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBTZXNzaW9uU3RhcnQgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFNlc3Npb25TdGFydE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogc2Vzc2lvblN0YXJ0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgYWRkaXRpb25hbENvbnRleHQ6IEpTT04uc3RyaW5naWZ5KHsgcHJvamVjdDogJ215LXByb2plY3QnIH0pXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBzZXNzaW9uU3RhcnRPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSG9va1NwZWNpZmljT3V0cHV0QnVpbGRlcihcIlNlc3Npb25TdGFydFwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFNlc3Npb25FbmQgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFNlc3Npb25FbmRPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHNlc3Npb25FbmRPdXRwdXQoe30pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBzZXNzaW9uRW5kT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZVNpbXBsZU91dHB1dEJ1aWxkZXIoXCJTZXNzaW9uRW5kXCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgU3RvcCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgU3RvcE91dHB1dCBvYmplY3QgcmVhZHkgZm9yIHRoZSBydW50aW1lXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gQWxsb3cgdGhlIHN0b3BcbiAqIHN0b3BPdXRwdXQoeyBkZWNpc2lvbjogJ2FwcHJvdmUnIH0pO1xuICpcbiAqIC8vIEJsb2NrIHdpdGggcmVhc29uXG4gKiBzdG9wT3V0cHV0KHtcbiAqICAgZGVjaXNpb246ICdibG9jaycsXG4gKiAgIHJlYXNvbjogJ1RoZXJlIGFyZSB1bmNvbW1pdHRlZCBjaGFuZ2VzJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHN0b3BPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlRGVjaXNpb25PdXRwdXRCdWlsZGVyKFwiU3RvcFwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIFN1YmFnZW50U3RhcnQgaG9va3MuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIGhvb2sgb3V0cHV0XG4gKiBAcmV0dXJucyBBIFN1YmFnZW50U3RhcnRPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIHN1YmFnZW50U3RhcnRPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ0ZvY3VzIG9uIGZpbmRpbmcgcGF0dGVybnMnXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBzdWJhZ2VudFN0YXJ0T3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoXCJTdWJhZ2VudFN0YXJ0XCIpO1xuLyoqXG4gKiBDcmVhdGVzIGFuIG91dHB1dCBmb3IgU3ViYWdlbnRTdG9wIGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBTdWJhZ2VudFN0b3BPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEJsb2NrIHdpdGggcmVhc29uXG4gKiBzdWJhZ2VudFN0b3BPdXRwdXQoe1xuICogICBkZWNpc2lvbjogJ2Jsb2NrJyxcbiAqICAgcmVhc29uOiAnVGFzayBub3QgY29tcGxldGUnXG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgc3ViYWdlbnRTdG9wT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZURlY2lzaW9uT3V0cHV0QnVpbGRlcihcIlN1YmFnZW50U3RvcFwiKTtcbi8qKlxuICogQ3JlYXRlcyBhbiBvdXRwdXQgZm9yIE5vdGlmaWNhdGlvbiBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgTm90aWZpY2F0aW9uT3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBBZGQgY29udGV4dCBhYm91dCB0aGUgbm90aWZpY2F0aW9uXG4gKiBub3RpZmljYXRpb25PdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBhZGRpdGlvbmFsQ29udGV4dDogJ05vdGlmaWNhdGlvbiBmb3J3YXJkZWQgdG8gU2xhY2sgI2FsZXJ0cyBjaGFubmVsJ1xuICogICB9XG4gKiB9KTtcbiAqXG4gKiAvLyBTdXBwcmVzcyB0aGUgbm90aWZpY2F0aW9uXG4gKiBub3RpZmljYXRpb25PdXRwdXQoeyBzdXBwcmVzc091dHB1dDogdHJ1ZSB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3Qgbm90aWZpY2F0aW9uT3V0cHV0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhvb2tTcGVjaWZpY091dHB1dEJ1aWxkZXIoXCJOb3RpZmljYXRpb25cIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQcmVDb21wYWN0IGhvb2tzLlxuICogQHBhcmFtIG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rIG91dHB1dFxuICogQHJldHVybnMgQSBQcmVDb21wYWN0T3V0cHV0IG9iamVjdCByZWFkeSBmb3IgdGhlIHJ1bnRpbWVcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBwcmVDb21wYWN0T3V0cHV0KHtcbiAqICAgc3lzdGVtTWVzc2FnZTogJ1JlbWVtYmVyOiBzdHJpY3QgbW9kZSBpcyBlbmFibGVkJ1xuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHByZUNvbXBhY3RPdXRwdXQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlU2ltcGxlT3V0cHV0QnVpbGRlcihcIlByZUNvbXBhY3RcIik7XG4vKipcbiAqIENyZWF0ZXMgYW4gb3V0cHV0IGZvciBQZXJtaXNzaW9uUmVxdWVzdCBob29rcy5cbiAqIEBwYXJhbSBvcHRpb25zIC0gQ29uZmlndXJhdGlvbiBvcHRpb25zIGZvciB0aGUgaG9vayBvdXRwdXRcbiAqIEByZXR1cm5zIEEgUGVybWlzc2lvblJlcXVlc3RPdXRwdXQgb2JqZWN0IHJlYWR5IGZvciB0aGUgcnVudGltZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEF1dG8tYXBwcm92ZVxuICogcGVybWlzc2lvblJlcXVlc3RPdXRwdXQoe1xuICogICBob29rU3BlY2lmaWNPdXRwdXQ6IHtcbiAqICAgICBkZWNpc2lvbjogeyBiZWhhdmlvcjogJ2FsbG93JyB9XG4gKiAgIH1cbiAqIH0pO1xuICpcbiAqIC8vIEF1dG8tYXBwcm92ZSB3aXRoIG1vZGlmaWVkIGlucHV0XG4gKiBwZXJtaXNzaW9uUmVxdWVzdE91dHB1dCh7XG4gKiAgIGhvb2tTcGVjaWZpY091dHB1dDoge1xuICogICAgIGRlY2lzaW9uOiB7XG4gKiAgICAgICBiZWhhdmlvcjogJ2FsbG93JyxcbiAqICAgICAgIHVwZGF0ZWRJbnB1dDogeyBmaWxlX3BhdGg6ICcvc2FmZS9wYXRoJyB9XG4gKiAgICAgfVxuICogICB9XG4gKiB9KTtcbiAqXG4gKiAvLyBBdXRvLWRlbnlcbiAqIHBlcm1pc3Npb25SZXF1ZXN0T3V0cHV0KHtcbiAqICAgaG9va1NwZWNpZmljT3V0cHV0OiB7XG4gKiAgICAgZGVjaXNpb246IHtcbiAqICAgICAgIGJlaGF2aW9yOiAnZGVueScsXG4gKiAgICAgICBtZXNzYWdlOiAnTm90IGFsbG93ZWQnLFxuICogICAgICAgaW50ZXJydXB0OiB0cnVlXG4gKiAgICAgfVxuICogICB9XG4gKiB9KTtcbiAqXG4gKiAvLyBGYWxsIHRocm91Z2ggdG8gbm9ybWFsIHByb21wdFxuICogcGVybWlzc2lvblJlcXVlc3RPdXRwdXQoe30pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwZXJtaXNzaW9uUmVxdWVzdE91dHB1dCA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIb29rU3BlY2lmaWNPdXRwdXRCdWlsZGVyKFwiUGVybWlzc2lvblJlcXVlc3RcIik7XG4iLCAiLyoqXG4gKiBSdW50aW1lIG1vZHVsZSBmb3IgQ2xhdWRlIENvZGUgaG9va3MuXG4gKlxuICogSGFuZGxlcyBzdGRpbi9zdGRvdXQvZXhpdCBjb2RlIHNlbWFudGljcyBmb3IgY29tcGlsZWQgaG9vayBleGVjdXRpb24uXG4gKiBUaGlzIG1vZHVsZSBpcyB0aGUgY29yZSBvcmNoZXN0cmF0b3IgdGhhdDpcbiAqIC0gUmVhZHMgSlNPTiBmcm9tIHN0ZGluICh3aXJlIGZvcm1hdCB3aXRoIHNuYWtlX2Nhc2UgcHJvcGVydGllcylcbiAqIC0gSW52b2tlcyB0aGUgaG9vayBoYW5kbGVyXG4gKiAtIFdyaXRlcyBvdXRwdXQgdG8gc3Rkb3V0XG4gKiAtIE1hbmFnZXMgZXhpdCBjb2Rlc1xuICogQG1vZHVsZVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEluIGEgY29tcGlsZWQgaG9vayBmaWxlXG4gKiBpbXBvcnQgeyBleGVjdXRlIH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzL3J1bnRpbWUnO1xuICogaW1wb3J0IG15SG9vayBmcm9tICcuL215LWhvb2suanMnO1xuICpcbiAqIGV4ZWN1dGUobXlIb29rKTtcbiAqIGBgYFxuICogQHNlZSBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL2hvb2tzXG4gKi9cbmltcG9ydCB7IHBlcnNpc3RFbnZWYXIsIHBlcnNpc3RFbnZWYXJzIH0gZnJvbSBcIi4vZW52LmpzXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi9sb2dnZXIuanNcIjtcbmltcG9ydCB7IEVYSVRfQ09ERVMgfSBmcm9tIFwiLi9vdXRwdXRzLmpzXCI7XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGRpbi9TdGRvdXQgSGFuZGxpbmdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8qKlxuICogUmVhZHMgYWxsIGRhdGEgZnJvbSBzdGRpbi5cbiAqIEByZXR1cm5zIFByb21pc2UgcmVzb2x2aW5nIHRvIHRoZSBjb21wbGV0ZSBzdGRpbiBjb250ZW50XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlYWRTdGRpbigpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICAgICAgLy8gU2V0IGVuY29kaW5nIGZpcnN0IHRvIGVuc3VyZSBkYXRhIGV2ZW50cyByZWNlaXZlIHN0cmluZ3NcbiAgICAgICAgcHJvY2Vzcy5zdGRpbi5zZXRFbmNvZGluZyhcInV0Zi04XCIpO1xuICAgICAgICBwcm9jZXNzLnN0ZGluLm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHtcbiAgICAgICAgICAgIGNodW5rcy5wdXNoKGNodW5rKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHByb2Nlc3Muc3RkaW4ub24oXCJlbmRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZShjaHVua3Muam9pbihcIlwiKSk7XG4gICAgICAgIH0pO1xuICAgICAgICBwcm9jZXNzLnN0ZGluLm9uKFwiZXJyb3JcIiwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cbi8qKlxuICogUGFyc2VzIHN0ZGluIEpTT04gaW5wdXQuXG4gKiBAcGFyYW0gc3RkaW5Db250ZW50IC0gUmF3IHN0ZGluIGNvbnRlbnRcbiAqIEByZXR1cm5zIFBhcnNlZCBpbnB1dCAod2lyZSBmb3JtYXQgd2l0aCBzbmFrZV9jYXNlIHByb3BlcnRpZXMpXG4gKiBAdGhyb3dzIEVycm9yIGlmIEpTT04gaXMgbWFsZm9ybWVkXG4gKi9cbmZ1bmN0aW9uIHBhcnNlU3RkaW5JbnB1dChzdGRpbkNvbnRlbnQpIHtcbiAgICAvLyBQYXJzZSBKU09OIC0gaW5wdXQgdXNlcyB3aXJlIGZvcm1hdCAoc25ha2VfY2FzZSkgZGlyZWN0bHlcbiAgICBjb25zdCByYXdJbnB1dCA9IEpTT04ucGFyc2Uoc3RkaW5Db250ZW50KTtcbiAgICByZXR1cm4gcmF3SW5wdXQ7XG59XG4vKipcbiAqIFdyaXRlcyBob29rIG91dHB1dCB0byBzdGRvdXQuXG4gKlxuICogT3V0cHV0IHVzZXMgY2FtZWxDYXNlIGtleXMgcGVyIENsYXVkZSBDb2RlIGhvb2sgc3BlY2lmaWNhdGlvbi5cbiAqIEBwYXJhbSBvdXRwdXQgLSBUaGUgaG9vayBvdXRwdXQgdG8gd3JpdGVcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rcyNob29rLW91dHB1dC1zdHJ1Y3R1cmVcbiAqL1xuZnVuY3Rpb24gd3JpdGVTdGRvdXQob3V0cHV0KSB7XG4gICAgLy8gT3V0cHV0IHVzZXMgY2FtZWxDYXNlIC0gbm8gdHJhbnNmb3JtYXRpb24gbmVlZGVkXG4gICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoSlNPTi5zdHJpbmdpZnkob3V0cHV0KSk7XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBFcnJvciBIYW5kbGluZ1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLyoqXG4gKiBDcmVhdGVzIGFuIGVycm9yIG91dHB1dCBmb3IgbWFsZm9ybWVkIHN0ZGluIEpTT04uXG4gKiBAcGFyYW0gZXJyb3IgLSBUaGUgcGFyc2UgZXJyb3JcbiAqIEByZXR1cm5zIEhvb2tPdXRwdXQgd2l0aCBlbXB0eSBzdGRvdXRcbiAqL1xuZnVuY3Rpb24gY3JlYXRlTWFsZm9ybWVkSW5wdXRPdXRwdXQoZXJyb3IpIHtcbiAgICBsb2dnZXIuZXJyb3IoYEludmFsaWQgSlNPTiBpbnB1dDogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCk7XG4gICAgcmV0dXJuIHsgc3Rkb3V0OiB7fSB9O1xufVxuLyoqXG4gKiBXcml0ZXMgaGFuZGxlciBlcnJvciBzdGFja3RyYWNlIHRvIHN0ZGVyciBhbmQgZXhpdHMgd2l0aCBjb2RlIDIuXG4gKlxuICogV2hlbiBhIGhvb2sgaGFuZGxlciB0aHJvd3MgYW4gZXhjZXB0aW9uOlxuICogLSBTdGFja3RyYWNlICh3aXRoIHNvdXJjZW1hcHMgaWYgYXZhaWxhYmxlKSBpcyBvdXRwdXQgdG8gc3RkZXJyXG4gKiAtIFByb2Nlc3MgZXhpdHMgd2l0aCBjb2RlIDIgKEJMT0NLKVxuICogLSBObyBKU09OIGlzIG91dHB1dCB0byBzdGRvdXRcbiAqIEBwYXJhbSBlcnJvciAtIFRoZSBlcnJvciB0aHJvd24gYnkgdGhlIGhhbmRsZXJcbiAqL1xuZnVuY3Rpb24gaGFuZGxlSGFuZGxlckVycm9yKGVycm9yKSB7XG4gICAgLy8gV3JpdGUgc3RhY2sgdHJhY2UgdG8gc3RkZXJyIChzb3VyY2VtYXBzIGFyZSBhcHBsaWVkIGF1dG9tYXRpY2FsbHkgYnkgTm9kZS5qcylcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShgJHtlcnJvci5zdGFjayA/PyBlcnJvci5tZXNzYWdlfVxcbmApO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoYCR7U3RyaW5nKGVycm9yKX1cXG5gKTtcbiAgICB9XG4gICAgLy8gTG9nIHRvIGZpbGUgaWYgY29uZmlndXJlZFxuICAgIGxvZ2dlci5lcnJvcihgSG9vayBoYW5kbGVyIGVycm9yOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gKTtcbiAgICAvLyBDbGVhciBsb2dnZXIgY29udGV4dCBhbmQgY2xvc2VcbiAgICBsb2dnZXIuY2xlYXJDb250ZXh0KCk7XG4gICAgbG9nZ2VyLmNsb3NlKCk7XG4gICAgLy8gRXhpdCB3aXRoIGNvZGUgMiAoQkxPQ0spIC0gbm8gSlNPTiBvdXRwdXRcbiAgICBwcm9jZXNzLmV4aXQoRVhJVF9DT0RFUy5CTE9DSyk7XG59XG4vKipcbiAqIENvbnZlcnRzIGEgU3BlY2lmaWNIb29rT3V0cHV0IHRvIEhvb2tPdXRwdXQgZm9yIHdpcmUgZm9ybWF0LlxuICpcbiAqIFNwZWNpZmljSG9va091dHB1dCB0eXBlcyBoYXZlOiB7IF90eXBlLCBleGl0Q29kZSwgc3Rkb3V0LCBzdGRlcnI/IH1cbiAqIEhvb2tPdXRwdXQgaGFzOiB7IGV4aXRDb2RlLCBzdGRvdXQsIHN0ZGVycj8gfVxuICpcbiAqIFNpbmNlIG91dHB1dCBidWlsZGVycyBub3cgcHJvZHVjZSB3aXJlLWZvcm1hdCBkaXJlY3RseSwgdGhpcyBmdW5jdGlvblxuICogc2ltcGx5IHN0cmlwcyB0aGUgYF90eXBlYCBkaXNjcmltaW5hdG9yIGZpZWxkLlxuICogQHBhcmFtIHNwZWNpZmljT3V0cHV0IC0gVGhlIHNwZWNpZmljIG91dHB1dCBmcm9tIGEgaG9vayBoYW5kbGVyXG4gKiBAcmV0dXJucyBIb29rT3V0cHV0IHJlYWR5IGZvciBzZXJpYWxpemF0aW9uXG4gKiBAc2VlIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vaG9va3MjaG9vay1vdXRwdXQtc3RydWN0dXJlXG4gKiBAZXhhbXBsZVxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3Qgc3BlY2lmaWNPdXRwdXQgPSBwcmVUb29sVXNlT3V0cHV0KHsgaG9va1NwZWNpZmljT3V0cHV0OiB7IHBlcm1pc3Npb25EZWNpc2lvbjogJ2FsbG93JyB9IH0pO1xuICogY29uc3QgaG9va091dHB1dCA9IGNvbnZlcnRUb0hvb2tPdXRwdXQoc3BlY2lmaWNPdXRwdXQpO1xuICogLy8gaG9va091dHB1dDogeyBleGl0Q29kZTogMCwgc3Rkb3V0OiB7IGhvb2tTcGVjaWZpY091dHB1dDogeyAuLi4gfSB9IH1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFRvSG9va091dHB1dChzcGVjaWZpY091dHB1dCkge1xuICAgIHJldHVybiB7IHN0ZG91dDogc3BlY2lmaWNPdXRwdXQuc3Rkb3V0IH07XG59XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBFeGVjdXRlIEZ1bmN0aW9uXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vKipcbiAqIEV4ZWN1dGVzIGEgaG9vayBoYW5kbGVyIHdpdGggZnVsbCBydW50aW1lIG9yY2hlc3RyYXRpb24uXG4gKlxuICogVGhpcyBpcyB0aGUgbWFpbiBlbnRyeSBwb2ludCB0aGF0IGNvbXBpbGVkIGhvb2tzIHVzZS4gV2hlbiBhIGNvbXBpbGVkIGhvb2tcbiAqIHJ1bnMgYXMgYSBDTEk6XG4gKlxuICogMS4gUmVhZHMgYWxsIHN0ZGluXG4gKiAyLiBQYXJzZXMgSlNPTiAod2lyZSBmb3JtYXQgd2l0aCBzbmFrZV9jYXNlIHByb3BlcnRpZXMpXG4gKiAzLiBTZXRzIHVwIGxvZ2dlciBjb250ZXh0IChob29rVHlwZSwgaW5wdXQpXG4gKiA0LiBDYWxscyBoYW5kbGVyIHdpdGggaW5wdXQgYW5kIGNvbnRleHQgKGxvZ2dlcilcbiAqIDUuIEhhbmRsZXMgYW55IGVycm9ycywgbG9ncyB0aGVtXG4gKiA2LiBXcml0ZXMgSlNPTiB0byBzdGRvdXRcbiAqIDcuIENsb3NlcyBsb2dnZXJcbiAqIDguIEV4aXRzIHdpdGggYXBwcm9wcmlhdGUgY29kZVxuICogQHBhcmFtIGhvb2tGbiAtIFRoZSBob29rIGZ1bmN0aW9uIHRvIGV4ZWN1dGUgKGZyb20gaG9vayBmYWN0b3J5KVxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIC8vIEluIGNvbXBpbGVkIGhvb2sgZmlsZVxuICogaW1wb3J0IHsgZXhlY3V0ZSB9IGZyb20gJ0Bnb29kZm9vdC9jbGF1ZGUtY29kZS1ob29rcy9ydW50aW1lJztcbiAqIGltcG9ydCB7IHByZVRvb2xVc2VIb29rLCBwcmVUb29sVXNlT3V0cHV0IH0gZnJvbSAnQGdvb2Rmb290L2NsYXVkZS1jb2RlLWhvb2tzJztcbiAqXG4gKiBjb25zdCBteUhvb2sgPSBwcmVUb29sVXNlSG9vayh7IG1hdGNoZXI6ICdCYXNoJyB9LCBhc3luYyAoaW5wdXQsIHsgbG9nZ2VyIH0pID0+IHtcbiAqICAgbG9nZ2VyLmluZm8oJ1Byb2Nlc3NpbmcgQmFzaCBjb21tYW5kJyk7XG4gKiAgIHJldHVybiBwcmVUb29sVXNlT3V0cHV0KHsgYWxsb3c6IHRydWUgfSk7XG4gKiB9KTtcbiAqXG4gKiBleGVjdXRlKG15SG9vayk7XG4gKiBgYGBcbiAqIEBzZWUgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9ob29rc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZShob29rRm4pIHtcbiAgICBsZXQgb3V0cHV0O1xuICAgIHRyeSB7XG4gICAgICAgIC8vIENoZWNrIGZvciBsb2cgZmlsZSBjb25maWd1cmF0aW9uIGNvbmZsaWN0c1xuICAgICAgICAvLyBDTEFVREVfQ09ERV9IT09LU19DTElfTE9HX0ZJTEUgaXMgaW5qZWN0ZWQgYnkgdGhlIENMSSAtLWxvZyBwYXJhbWV0ZXJcbiAgICAgICAgLy8gQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEUgaXMgdGhlIHVzZXIncyBlbnZpcm9ubWVudCB2YXJpYWJsZVxuICAgICAgICBjb25zdCBjbGlMb2dGaWxlID0gcHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfSE9PS1NfQ0xJX0xPR19GSUxFO1xuICAgICAgICBjb25zdCBlbnZMb2dGaWxlID0gcHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEU7XG4gICAgICAgIGlmIChjbGlMb2dGaWxlICE9PSB1bmRlZmluZWQgJiYgZW52TG9nRmlsZSAhPT0gdW5kZWZpbmVkICYmIGNsaUxvZ0ZpbGUgIT09IGVudkxvZ0ZpbGUpIHtcbiAgICAgICAgICAgIC8vIFdyaXRlIGVycm9yIHRvIHN0ZGVyciBhbmQgZXhpdCB3aXRoIGVycm9yIGNvZGVcbiAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKGBMb2cgZmlsZSBjb25maWd1cmF0aW9uIGNvbmZsaWN0OiBDTEkgLS1sb2c9XCIke2NsaUxvZ0ZpbGV9XCIgdnMgQ0xBVURFX0NPREVfSE9PS1NfTE9HX0ZJTEU9XCIke2VudkxvZ0ZpbGV9XCIuIGAgK1xuICAgICAgICAgICAgICAgIFwiVXNlIG9ubHkgb25lIG1ldGhvZCB0byBjb25maWd1cmUgaG9vayBsb2dnaW5nLlxcblwiKTtcbiAgICAgICAgICAgIHByb2Nlc3MuZXhpdChFWElUX0NPREVTLkVSUk9SKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiBDTEkgbG9nIGZpbGUgaXMgc2V0LCBjb25maWd1cmUgdGhlIGxvZ2dlclxuICAgICAgICBpZiAoY2xpTG9nRmlsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsb2dnZXIuc2V0TG9nRmlsZShjbGlMb2dGaWxlKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBSZWFkIGFuZCBwYXJzZSBzdGRpblxuICAgICAgICBsZXQgc3RkaW5Db250ZW50O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgc3RkaW5Db250ZW50ID0gYXdhaXQgcmVhZFN0ZGluKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nRXJyb3IoZXJyb3IsIFwiRmFpbGVkIHRvIHJlYWQgc3RkaW5cIik7XG4gICAgICAgICAgICBvdXRwdXQgPSBjcmVhdGVNYWxmb3JtZWRJbnB1dE91dHB1dChlcnJvcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gUGFyc2UgYW5kIHRyYW5zZm9ybSBpbnB1dFxuICAgICAgICBsZXQgaW5wdXQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpbnB1dCA9IHBhcnNlU3RkaW5JbnB1dChzdGRpbkNvbnRlbnQpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZ0Vycm9yKGVycm9yLCBcIkZhaWxlZCB0byBwYXJzZSBzdGRpbiBKU09OXCIpO1xuICAgICAgICAgICAgb3V0cHV0ID0gY3JlYXRlTWFsZm9ybWVkSW5wdXRPdXRwdXQoZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIFNldCBsb2dnZXIgY29udGV4dFxuICAgICAgICBjb25zdCBob29rRXZlbnROYW1lID0gaG9va0ZuLmhvb2tFdmVudE5hbWU7XG4gICAgICAgIGxvZ2dlci5zZXRDb250ZXh0KGhvb2tFdmVudE5hbWUsIGlucHV0KTtcbiAgICAgICAgLy8gQnVpbGQgY29udGV4dCAtIFNlc3Npb25TdGFydCBob29rcyBnZXQgZXh0ZW5kZWQgY29udGV4dCB3aXRoIHBlcnNpc3RFbnZWYXJcbiAgICAgICAgY29uc3QgY29udGV4dCA9IGhvb2tFdmVudE5hbWUgPT09IFwiU2Vzc2lvblN0YXJ0XCIgPyB7IGxvZ2dlciwgcGVyc2lzdEVudlZhciwgcGVyc2lzdEVudlZhcnMgfSA6IHsgbG9nZ2VyIH07XG4gICAgICAgIC8vIEV4ZWN1dGUgaGFuZGxlclxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3BlY2lmaWNPdXRwdXQgPSBhd2FpdCBob29rRm4oaW5wdXQsIGNvbnRleHQpO1xuICAgICAgICAgICAgb3V0cHV0ID0gY29udmVydFRvSG9va091dHB1dChzcGVjaWZpY091dHB1dCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAvLyBIYW5kbGVyIHRocmV3IC0gb3V0cHV0IHN0YWNrdHJhY2UgdG8gc3RkZXJyIGFuZCBleGl0IHdpdGggY29kZSAyXG4gICAgICAgICAgICAvLyBUaGlzIGNhbGwgbmV2ZXIgcmV0dXJucyAocHJvY2Vzcy5leGl0KVxuICAgICAgICAgICAgaGFuZGxlSGFuZGxlckVycm9yKGVycm9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmaW5hbGx5IHtcbiAgICAgICAgLy8gV3JpdGUgb3V0cHV0IGlmIHdlIGhhdmUgaXRcbiAgICAgICAgaWYgKG91dHB1dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB3cml0ZVN0ZG91dChvdXRwdXQuc3Rkb3V0KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDbGVhciBsb2dnZXIgY29udGV4dFxuICAgICAgICBsb2dnZXIuY2xlYXJDb250ZXh0KCk7XG4gICAgICAgIGxvZ2dlci5jbG9zZSgpO1xuICAgICAgICAvLyBFeGl0IHdpdGggc3VjY2VzcyAoaGFuZGxlciBlcnJvcnMgZXhpdCB2aWEgaGFuZGxlSGFuZGxlckVycm9yIHdpdGggY29kZSAyKVxuICAgICAgICBwcm9jZXNzLmV4aXQoRVhJVF9DT0RFUy5TVUNDRVNTKTtcbiAgICB9XG59XG4iLCAiLyoqXG4gKiBJbXBsZW1lbnQtcGxhbiBpbnN0cnVjdGlvbnMgZm9yIHJlc3RvcmF0aW9uIGFmdGVyIGNvbnRleHQgY29tcGFjdGlvbi5cbiAqXG4gKiBDb250YWlucyB0aGUgb3BlcmF0aW9uYWwgZ3VpZGVsaW5lcyBhbmQgc3RlcHMgbmVlZGVkIHRvIGNvbnRpbnVlXG4gKiBpbXBsZW1lbnQtcGxhbiBleGVjdXRpb24gYWZ0ZXIgY29tcGFjdGlvbiAoZXhjbHVkZXMgU3RlcHMgMSBhbmQgM1xuICogd2hpY2ggYXJlIGFscmVhZHkgY29tcGxldGVkIGJlZm9yZSBjb21wYWN0aW9uIG9jY3VycykuXG4gKi9cblxuZXhwb3J0IGNvbnN0IElNUExFTUVOVF9QTEFOX0lOU1RSVUNUSU9OUyA9IGBcbkltcGxlbWVudC1wbGFuIGluc3RydWN0aW9ucyByZXN0b3JlZCBhZnRlciBjb250ZXh0IGNvbXBhY3Rpb24uIENvbnRpbnVlIGZyb20geW91ciBjdXJyZW50IHN0ZXAuXG5cbjxvcGVyYXRpb25hbC1ndWlkZWxpbmVzPlxuRm9sbG93IHRoZXNlIGd1aWRlbGluZXMgdGhyb3VnaG91dCBleGVjdXRpb246XG5cbjEuICoqQXZvaWQgb3Zlci1lbmdpbmVlcmluZyoqIC0gT25seSBtYWtlIGNoYW5nZXMgdGhhdCBhcmUgZGlyZWN0bHkgcmVxdWVzdGVkIG9yIGNsZWFybHkgbmVjZXNzYXJ5LiBEb24ndCBhZGQgZmVhdHVyZXMsIHJlZmFjdG9yIGNvZGUsIG9yIG1ha2UgXCJpbXByb3ZlbWVudHNcIiBiZXlvbmQgd2hhdCB3YXMgYXNrZWQuXG5cbjIuICoqQWx3YXlzIGRpc3BhdGNoIHRhc2tzKiogLSBEaXNwYXRjaCBldmVyeSBpbXBsZW1lbnRhdGlvbiB0YXNrIHRvIGEgc3ViYWdlbnQuIERvIG5vdCBpbXBsZW1lbnQgdGFza3MgZGlyZWN0bHkgdXNpbmcgRWRpdC9Xcml0ZSB0b29scy4gVGhpcyBhcHBsaWVzIHJlZ2FyZGxlc3Mgb2YgdGFzayBzaW1wbGljaXR5LlxuXG4zLiAqKkR5bmFtaWMgbW9kZWwgc2VsZWN0aW9uKiogLSBDaG9vc2UgdGhlIG1vZGVsIGJhc2VkIG9uIHRhc2sgY29tcGxleGl0eTpcbiAgIC0gKipvcHVzKio6IEFtYmlndW91cyByZXF1aXJlbWVudHMsIG11bHRpcGxlIHBvc3NpYmxlIGFwcHJvYWNoZXMsIG9yIHRhc2tzIHdoZXJlIHlvdSdyZSB1bnN1cmUgaG93IHRvIHN0YXJ0XG4gICAtICoqc29ubmV0Kio6IENsZWFyIGdvYWwgd2l0aCBtdWx0aXBsZSBzdGVwcywgYnVpbGRpbmcgZmVhdHVyZXMsIG9yIGZpeGluZyBidWdzIGluIHVuZmFtaWxpYXIgY29kZVxuICAgLSAqKmhhaWt1Kio6IFNpbmdsZS1zdGVwIHRhc2tzLCBmb2xsb3dpbmcgZXN0YWJsaXNoZWQgcGF0dGVybnMsIG9yIG1ha2luZyBjaGFuZ2VzIHlvdSBhbHJlYWR5IHVuZGVyc3RhbmRcblxuNC4gKipVc2UgZ2VuZXJhbC1wdXJwb3NlIHN1YmFnZW50KiogLSBJbXBsZW1lbnRhdGlvbiBhbmQgdmFsaWRhdGlvbiBzdWJhZ2VudHMgc2hvdWxkIHVzZSBcXGBzdWJhZ2VudF90eXBlPVwiZ2VuZXJhbC1wdXJwb3NlXCJcXGAuIFRoZSByZWZhY3RvcmluZyBzdGVwIHVzZXMgXFxgY29kZS1zaW1wbGlmaWVyOmNvZGUtc2ltcGxpZmllclxcYC5cblxuNS4gKipTZWxmLWNvbnRhaW5lZCB0YXNrIHByb21wdHMqKiAtIEFnZW50cyBoYXZlIG5vIGNvbnZlcnNhdGlvbiBjb250ZXh0LiBJbmNsdWRlIGZ1bGwgcGF0aHMsIGNvZGUgc25pcHBldHMsIHBhdHRlcm5zLCBhbmQgcmVxdWlyZW1lbnRzIGluIGV2ZXJ5IHRhc2sgcHJvbXB0LlxuPC9vcGVyYXRpb25hbC1ndWlkZWxpbmVzPlxuXG4jIyBTdGVwIDI6IExvY2F0ZSBhbmQgUmVhZCBQbGFuXG5cbkxvY2F0ZSB0aGUgcGxhbiBmaWxlOlxuXG4qKklmIFtQTEFOX1BBVEhdIHByb3ZpZGVkOioqXG5cXGBcXGBcXGBiYXNoXG5jYXQgXCJbUExBTl9QQVRIXVwiXG5cXGBcXGBcXGBcblxuKipJZiBbUExBTl9QQVRIXSBub3QgcHJvdmlkZWQ6KipcblxcYFxcYFxcYGJhc2hcbiMgQ2hlY2sgZm9yIGFjdGl2ZSBwbGFucyBmaXJzdCAocmVzdW1lIHdvcmspXG5scyAtbGEgcHJvamVjdHMvYWN0aXZlLyovcGxhbi5tZCAyPi9kZXYvbnVsbFxuXG4jIFRoZW4gY2hlY2sgZm9yIG5ldyBwbGFuc1xubHMgLWxhIHByb2plY3RzL25ldy8qL3BsYW4ubWQgMj4vZGV2L251bGxcblxcYFxcYFxcYFxuXG5JZiBtdWx0aXBsZSBwbGFucyBmb3VuZCwgYXNrIHRoZSB1c2VyIHdoaWNoIHRvIGltcGxlbWVudC5cblxuUmVhZCB0aGUgcGxhbiBhbmQgZXh0cmFjdDpcbi0gW1BST0pFQ1RfTkFNRV0gPSBGcm9tIHBsYW4gdGl0bGUgb3IgZGlyZWN0b3J5IG5hbWVcbi0gW1BST0pFQ1RfRElSXSA9IERpcmVjdG9yeSBjb250YWluaW5nIHBsYW4ubWRcbi0gW1RBU0tTXSA9IEFsbCB0YXNrcyB3aXRoIGRlcGVuZGVuY2llcyBhbmQgZmlsZSBhc3NpZ25tZW50c1xuLSBbUExBTl9GSUxFU10gPSBBbGwgZmlsZXMgdGhlIHBsYW4gaW50ZW5kcyB0byBtb2RpZnkgKGZyb20gdGFzayBmaWxlIGFzc2lnbm1lbnRzKVxuLSBbVkFMSURBVElPTl9DT01NQU5EU10gPSBDb21tYW5kcyBmcm9tIFZhbGlkYXRpb24gQ29tbWFuZHMgc2VjdGlvblxuLSBbRVhQTE9SQVRJT05fU1VNTUFSWV0gPSBDb250ZXh0IGZyb20gRXhwbG9yYXRpb24gU3VtbWFyeSBzZWN0aW9uIChpZiBwcmVzZW50KVxuXG5DcmVhdGUgYmFzZWxpbmUgY2hlY2twb2ludCBub3cgdGhhdCBbUFJPSkVDVF9OQU1FXSBpcyBrbm93bjpcblxuXFxgXFxgXFxgYmFzaFxuZ2l0IHRhZyAtZiBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vYmFzZWxpbmUgSEVBRFxuXFxgXFxgXFxgXG5cbiMjIFN0ZXAgNDogQXNzZXNzIENvaGVyZW5jZVxuXG5BbmFseXplIHRhc2tzIGFsb25nIHRocmVlIGRpbWVuc2lvbnMgYmVmb3JlIGRpc3BhdGNoaW5nOlxuXG58IERpbWVuc2lvbiB8IFF1ZXN0aW9uIHxcbnwtLS0tLS0tLS0tLXwtLS0tLS0tLS0tfFxufCAqKkRlcGVuZGVuY3kqKiB8IERvIGZpbGVzIGltcG9ydC9yZWZlcmVuY2UgZWFjaCBvdGhlcj8gfFxufCAqKlVuaWZvcm1pdHkqKiB8IFNhbWUgb3BlcmF0aW9uIGFjcm9zcyBmaWxlcywgb3IgdmFyaWVkIG9wZXJhdGlvbnM/IHxcbnwgKipTaXplKiogfCBTdWJzdGFudGlhbCB0YXNrcyB3aXRoIGNsZWFyIGNvbXBsZXRpb24gZ2F0ZXM/IHxcblxuKipSb3V0ZSBiYXNlZCBvbiBhc3Nlc3NtZW50OioqXG5cbnwgUGF0dGVybiB8IFJvdXRlIHwgRGVzY3JpcHRpb24gfFxufC0tLS0tLS0tLXwtLS0tLS0tfC0tLS0tLS0tLS0tLS18XG58IEluZGVwZW5kZW50IGZpbGVzIE9SIHVuaWZvcm0gdGFza3MgfCAqKlBhcmFsbGVsKiogfCBMYXVuY2ggY29uY3VycmVudCBhZ2VudHMgfFxufCBEZXBlbmRlbnQgKyB2YXJpZWQgKyBzbWFsbCB8ICoqQ29oZXJlbnQqKiB8IFNpbmdsZSBhZ2VudCBoYW5kbGVzIGFsbCB8XG58IERlcGVuZGVudCArIHZhcmllZCArIHN1YnN0YW50aWFsIHdpdGggY2xlYXIgZ2F0ZXMgfCAqKlNlcXVlbnRpYWwqKiB8IE9yZGVyZWQgYWdlbnRzLCB2YWxpZGF0ZSBiZXR3ZWVuIHxcblxuKipDbGVhciBnYXRlcyoqIGluY2x1ZGU6IHR5cGUtY2hlY2sgcGFzc2VzLCB0ZXN0cyBwYXNzLCBBUEkgZnVuY3Rpb25hbCwgVUkgcmVuZGVycy5cblxuV2hlbiB1bmNlcnRhaW4gYmV0d2VlbiBDb2hlcmVudCBhbmQgU2VxdWVudGlhbCwgY2hvb3NlICoqU2VxdWVudGlhbCoqLiBDaGVja3BvaW50cyBoYXZlIGxvdyBjb3N0OyBtaXNzZWQgdmFsaWRhdGlvbiBvcHBvcnR1bml0aWVzIGhhdmUgaGlnaCBjb3N0LlxuXG4jIyBTdGVwIDU6IFNlbGVjdCBNb2RlbCBhbmQgRGlzcGF0Y2ggVGFza3NcblxuQ3JlYXRlIHByZS1pbXBsZW1lbnRhdGlvbiBjaGVja3BvaW50OlxuXG5cXGBcXGBcXGBiYXNoXG5naXQgYWRkIC1BXG5naXQgY29tbWl0IC0tYWxsb3ctZW1wdHkgLW0gXCJjaGVja3BvaW50OiBiZWZvcmUgaW1wbGVtZW50YXRpb25cblxuUHJvamVjdDogW1BST0pFQ1RfTkFNRV1cblRhc2tzOiBbTl0gdGFza3MgdG8gaW1wbGVtZW50XCJcbmdpdCB0YWcgLWYgaW1wbGVtZW50L1tQUk9KRUNUX05BTUVdL3ByZS1pbXBsZW1lbnRhdGlvbiBIRUFEXG5cXGBcXGBcXGBcblxuRGlzcGF0Y2ggdGFza3MgdG8gc3ViYWdlbnRzIHVzaW5nIHRoZSBUYXNrIHRvb2wuIERvIG5vdCBpbXBsZW1lbnQgdGFza3MgZGlyZWN0bHlcdTIwMTRhbHdheXMgZGlzcGF0Y2gsIGV2ZW4gZm9yIHNpbXBsZSBzaW5nbGUtZmlsZSBjaGFuZ2VzLlxuXG4jIyMgTW9kZWwgU2VsZWN0aW9uXG5cbkZvciBlYWNoIHRhc2sgb3IgdGFzayBncm91cCwgc2VsZWN0IHRoZSBhcHByb3ByaWF0ZSBtb2RlbDpcblxufCBNb2RlbCB8IFdoZW4gdG8gVXNlIHxcbnwtLS0tLS0tfC0tLS0tLS0tLS0tLS18XG58ICoqb3B1cyoqIHwgQW1iaWd1b3VzIHJlcXVpcmVtZW50cywgbXVsdGlwbGUgYXBwcm9hY2hlcyBwb3NzaWJsZSwgdW5mYW1pbGlhciB0ZXJyaXRvcnkgfFxufCAqKnNvbm5ldCoqIHwgQ2xlYXIgZ29hbCB3aXRoIG11bHRpcGxlIHN0ZXBzLCBidWlsZGluZyBmZWF0dXJlcywgZml4aW5nIGJ1Z3MgaW4gdW5mYW1pbGlhciBjb2RlIHxcbnwgKipoYWlrdSoqIHwgU2luZ2xlLXN0ZXAgdGFza3MsIGVzdGFibGlzaGVkIHBhdHRlcm5zLCBjaGFuZ2VzIHlvdSBhbHJlYWR5IHVuZGVyc3RhbmQgfFxuXG4jIyMgVGFzayBQcm9tcHQgUmVxdWlyZW1lbnRzXG5cbkVhY2ggdGFzayBwcm9tcHQgc2hvdWxkIGJlIHNlbGYtY29udGFpbmVkIHdpdGg6XG4tIEZ1bGwgZmlsZSBwYXRocyAoYWJzb2x1dGUpXG4tIEN1cnJlbnQgZmlsZSBjb250ZW50IChyZWFkIGZpbGVzIGZpcnN0KVxuLSBUZXN0aW5nIHJlcXVpcmVtZW50cyBmcm9tIHBsYW5cbi0gUGF0dGVybnMgZnJvbSBFeHBsb3JhdGlvbiBTdW1tYXJ5XG4tIENvbnN0cmFpbnRzIGZyb20gcGxhblxuXG4jIyMgRGlzcGF0Y2ggYnkgQ29oZXJlbmNlIFJvdXRlXG5cbioqUGFyYWxsZWwgUm91dGUqKiAtIExhdW5jaCBhbGwgaW5kZXBlbmRlbnQgdGFza3MgaW4gYSBzaW5nbGUgbWVzc2FnZTpcblxuXFxgXFxgXFxgeG1sXG48aW52b2tlIG5hbWU9XCJUYXNrXCI+XG48cGFyYW1ldGVyIG5hbWU9XCJkZXNjcmlwdGlvblwiPlt0YXNrLWdyb3VwLWFdPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJzdWJhZ2VudF90eXBlXCI+Z2VuZXJhbC1wdXJwb3NlPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJtb2RlbFwiPltNT0RFTCBiYXNlZCBvbiBjb21wbGV4aXR5XTwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwicHJvbXB0XCI+WW91IGFyZSBpbXBsZW1lbnRpbmcgYSBwb3J0aW9uIG9mIGEgcGxhbi4gT3RoZXIgc3ViYWdlbnRzIGFyZSBhbHNvIHdvcmtpbmcgb24gdGhpcyBwbGFuLlxuXG4jIFRhc2tcbltEZXNjcmlwdGlvbiB3aXRoIHRlc3RpbmcgcmVxdWlyZW1lbnRzIGZyb20gcGxhbl1cblxuIyMgUGxhblxuQFtQUk9KRUNUX0RJUl0vcGxhbi5tZFxuXG4jIyBDb250ZXh0XG5bV2h5IHRoaXMgdGFzayBleGlzdHMgLSBmcm9tIHBsYW4gcmF0aW9uYWxlXVxuW1JlbGV2YW50IGNvbnRleHQgZnJvbSBFeHBsb3JhdGlvbiBTdW1tYXJ5XVxuXG4jIyBGaWxlIE93bmVyc2hpcFxuVGhpcyB0YXNrIG93bnM6IFthYnNvbHV0ZSBwYXRocyBmcm9tIHBsYW5dXG5EbyBub3QgbW9kaWZ5IGZpbGVzIG91dHNpZGUgdGhpcyBsaXN0LlxuXG4jIyBDdXJyZW50IEZpbGUgQ29udGVudFxuW1JlYWQgYW5kIGluY2x1ZGUgY3VycmVudCBjb250ZW50IG9mIGZpbGVzIHRvIGJlIG1vZGlmaWVkXVxuXG4jIyBDb25zdHJhaW50c1xuW0Zyb20gcGxhbjogcGF0dGVybnMsIGludGVyZmFjZXMsIGRlcGVuZGVuY2llcyB0byByZXNwZWN0XVxuXG4jIyBSZXF1aXJlbWVudHNcbltMaXN0IGFsbCByZXF1aXJlbWVudHNdXG4xLiBbUmVxdWlyZW1lbnQgMV1cbjIuIFtSZXF1aXJlbWVudCAyXVxuXG4jIyBQYXR0ZXJucyB0byBGb2xsb3dcbltDb2RlIHNuaXBwZXRzIHNob3dpbmcgY29udmVudGlvbnMgLSBmcm9tIGV4cGxvcmF0aW9uIG9yIGZpbGUgcmVhZHNdXG5cbiMjIEd1aWRlbGluZXNcbi0gT25seSBtYWtlIHJlcXVlc3RlZCBjaGFuZ2VzXG4tIERvbid0IGFkZCB1bnJlcXVlc3RlZCBmZWF0dXJlcyBvciBhYnN0cmFjdGlvbnNcbi0gS2VlcCBpbXBsZW1lbnRhdGlvbiBtaW5pbWFsIGFuZCBmb2N1c2VkXG5cbiMjIFN1Y2Nlc3MgQ3JpdGVyaWFcbi0gWyBdIEltcGxlbWVudGF0aW9uIGNvbXBsZXRlXG4tIFsgXSBUZXN0cyBwYXNzIChpZiBhcHBsaWNhYmxlKVxuLSBbIF0gVHlwZXMgY29ycmVjdFxuLSBbIF0gRm9sbG93cyBleGlzdGluZyBwYXR0ZXJuczwvcGFyYW1ldGVyPlxuPC9pbnZva2U+XG48aW52b2tlIG5hbWU9XCJUYXNrXCI+XG48cGFyYW1ldGVyIG5hbWU9XCJkZXNjcmlwdGlvblwiPlt0YXNrLWdyb3VwLWJdPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJzdWJhZ2VudF90eXBlXCI+Z2VuZXJhbC1wdXJwb3NlPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJtb2RlbFwiPltNT0RFTCBiYXNlZCBvbiBjb21wbGV4aXR5XTwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwicHJvbXB0XCI+W1NhbWUgc3RydWN0dXJlIGFzIGFib3ZlXTwvcGFyYW1ldGVyPlxuPC9pbnZva2U+XG5cXGBcXGBcXGBcblxuKipTZXF1ZW50aWFsIFJvdXRlKiogLSBFYWNoIHBoYXNlIG11c3QgcGFzcyB2YWxpZGF0aW9uIGJlZm9yZSB0aGUgbmV4dCBiZWdpbnM6XG5cblxcYFxcYFxcYFxuXHUyNTBDXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTEwXG5cdTI1MDIgIEZvciBlYWNoIHBoYXNlOiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjUwMlxuXHUyNTAyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcdTI1MDJcblx1MjUwMiAgICBEaXNwYXRjaCBwaGFzZSB0YXNrcyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MDIgICAgICAgICAgICBcdTIxOTMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MDIgICAgV2FpdCBmb3IgY29tcGxldGlvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjUwMlxuXHUyNTAyICAgICAgICAgICAgXHUyMTkzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjUwMlxuXHUyNTAyICAgIFJ1biB2YWxpZGF0aW9uICh0eXBlY2hlY2ssIHRlc3QsIGxpbnQpICAgICAgICAgICBcdTI1MDJcblx1MjUwMiAgICAgICAgICAgIFx1MjE5MyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcdTI1MDJcblx1MjUwMiAgICBcdTI1MENcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MzRcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MTAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjUwMlxuXHUyNTAyICAgIFx1MjUwMiAgICAgICAgICAgICAgIFx1MjUwMiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MDIgIFBhc3MgICAgICAgICAgICBGYWlsIFx1MjE5MiBGaXggZXJyb3JzLCByZS12YWxpZGF0ZSAgICAgXHUyNTAyXG5cdTI1MDIgICAgXHUyNTAyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MDIgICAgXHUyMTkzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyXG5cdTI1MDIgIE5leHQgcGhhc2UgKG9yIFN0ZXAgNiBpZiBmaW5hbCBwaGFzZSkgICAgICAgICAgICAgIFx1MjUwMlxuXHUyNTE0XHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTE4XG5cXGBcXGBcXGBcblxuRG8gbm90IGRpc3BhdGNoIHRoZSBuZXh0IHBoYXNlIHVudGlsIHRoZSBjdXJyZW50IHBoYXNlIHBhc3NlcyB2YWxpZGF0aW9uLlxuXG4qKkNvaGVyZW50IFJvdXRlKiogLSBTaW5nbGUgYWdlbnQgaGFuZGxlcyBhbGwgcmVsYXRlZCB0YXNrczpcblxuXFxgXFxgXFxgeG1sXG48aW52b2tlIG5hbWU9XCJUYXNrXCI+XG48cGFyYW1ldGVyIG5hbWU9XCJkZXNjcmlwdGlvblwiPlthbGwtcmVsYXRlZC10YXNrc108L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cInN1YmFnZW50X3R5cGVcIj5nZW5lcmFsLXB1cnBvc2U8L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cIm1vZGVsXCI+W01PREVMIC0gdHlwaWNhbGx5IG9wdXMgZm9yIGNvaGVyZW50IHdvcmtdPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJwcm9tcHRcIj5Zb3UgYXJlIGltcGxlbWVudGluZyBhIGNvbXBsZXRlIGZlYXR1cmUuIENvbXBsZXRlIGFsbCB0YXNrcyBpbiBzZXF1ZW5jZS5cblxuIyBUYXNrc1xuW0xpc3QgYWxsIHRhc2tzIHRvIGNvbXBsZXRlIGluIG9yZGVyXVxuXG4jIyBQbGFuXG5AW1BST0pFQ1RfRElSXS9wbGFuLm1kXG5cbiMjIENvbnRleHRcbltGdWxsIGNvbnRleHQgZm9yIHRoZSBjb2hlcmVudCB3b3JrXVxuXG4jIyBGaWxlIE93bmVyc2hpcFxuVGhpcyB0YXNrIG93bnM6IFthbGwgZmlsZXMgZm9yIHRoaXMgY29oZXJlbnQgZ3JvdXBdXG5cbiMjIEN1cnJlbnQgRmlsZSBDb250ZW50XG5bUmVhZCBhbmQgaW5jbHVkZSBjdXJyZW50IGNvbnRlbnQgb2YgQUxMIGZpbGVzXVxuXG4jIyBSZXF1aXJlbWVudHNcbltDb21iaW5lZCByZXF1aXJlbWVudHMgZnJvbSBhbGwgdGFza3NdXG5cbiMjIEd1aWRlbGluZXNcbi0gQ29tcGxldGUgdGFza3MgaW4gZGVwZW5kZW5jeSBvcmRlclxuLSBPbmx5IG1ha2UgcmVxdWVzdGVkIGNoYW5nZXNcbi0gRG9uJ3QgYWRkIHVucmVxdWVzdGVkIGZlYXR1cmVzIG9yIGFic3RyYWN0aW9uc1xuXG4jIyBTdWNjZXNzIENyaXRlcmlhXG4tIFsgXSBBbGwgdGFza3MgY29tcGxldGVcbi0gWyBdIFRlc3RzIHBhc3Ncbi0gWyBdIFR5cGVzIGNvcnJlY3Rcbi0gWyBdIEZvbGxvd3MgZXhpc3RpbmcgcGF0dGVybnM8L3BhcmFtZXRlcj5cbjwvaW52b2tlPlxuXFxgXFxgXFxgXG5cbiMjIFN0ZXAgNjogVmFsaWRhdGlvbiBHYXRlXG5cbkNyZWF0ZSBwb3N0LWltcGxlbWVudGF0aW9uIGNoZWNrcG9pbnQ6XG5cblxcYFxcYFxcYGJhc2hcbmdpdCBhZGQgLUFcbmdpdCBjb21taXQgLS1hbGxvdy1lbXB0eSAtbSBcImNoZWNrcG9pbnQ6IGFmdGVyIGltcGxlbWVudGF0aW9uLCBiZWZvcmUgdmFsaWRhdGlvblxuXG5Qcm9qZWN0OiBbUFJPSkVDVF9OQU1FXVwiXG5naXQgdGFnIC1mIGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9wb3N0LWltcGxlbWVudGF0aW9uIEhFQURcblxcYFxcYFxcYFxuXG4jIyMgQ2hlY2sgZm9yIFVuZXhwZWN0ZWQgTW9kaWZpY2F0aW9uc1xuXG5WZXJpZnkgdGhhdCBvbmx5IHBsYW4tb3duZWQgZmlsZXMgd2VyZSBtb2RpZmllZDpcblxuXFxgXFxgXFxgYmFzaFxuIyBGaWxlcyBtb2RpZmllZCBzaW5jZSBiYXNlbGluZVxuTU9ESUZJRUQ9JChnaXQgZGlmZiBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vYmFzZWxpbmUgLS1uYW1lLW9ubHkpXG5cbiMgQ2hlY2sgZm9yIGZpbGVzIG91dHNpZGUgW1BMQU5fRklMRVNdXG4jIChDb21wYXJlIE1PRElGSUVEIGFnYWluc3QgdGhlIGxpc3Qgb2YgcGxhbi1vd25lZCBmaWxlcylcblVORVhQRUNURUQ9JChjb21tIC0yMyA8KGVjaG8gXCIkTU9ESUZJRURcIiB8IHNvcnQpIDwoZWNobyBcIltQTEFOX0ZJTEVTXVwiIHwgc29ydCkpXG5cXGBcXGBcXGBcblxuKipJZiB1bmV4cGVjdGVkIG1vZGlmaWNhdGlvbnMgZXhpc3Q6KiogUmVwb3J0IHRoZW0gdG8gdXNlciBhbmQgYXNrIGhvdyB0byBwcm9jZWVkOlxuLSBcIktlZXBcIiBcdTIxOTIgQ29udGludWUgd2l0aCBtb2RpZmljYXRpb25zIGluIHBsYWNlXG4tIFwiU3Rhc2hcIiBcdTIxOTIgXFxgZ2l0IHN0YXNoIHB1c2ggLW0gXCJ1bmV4cGVjdGVkLWNoYW5nZXNcIiAtLSAkVU5FWFBFQ1RFRFxcYFxuLSBcIkRpc2NhcmRcIiBcdTIxOTIgXFxgZ2l0IGNoZWNrb3V0IGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9iYXNlbGluZSAtLSAkVU5FWFBFQ1RFRFxcYFxuXG5EbyBub3QgZGlzY2FyZCB3aXRob3V0IGV4cGxpY2l0IHVzZXIgY29uc2VudC5cblxuKipSZXF1aXJlbWVudDoqKiBBTEwgdmFsaWRhdGlvbiBjb21tYW5kcyBtdXN0IHBhc3MgYmVmb3JlIHByb2NlZWRpbmcuXG5cblJ1biB2YWxpZGF0aW9uIGNvbW1hbmRzIGZyb20gdGhlIHBsYW4ncyBcIiMjIFZhbGlkYXRpb24gQ29tbWFuZHNcIiBzZWN0aW9uLiBJZiBubyB2YWxpZGF0aW9uIGNvbW1hbmRzIGFyZSBzcGVjaWZpZWQsIHVzZSB0aGVzZSBkZWZhdWx0czpcblxuXFxgXFxgXFxgYmFzaFxuY2QgcGFja2FnZXMvW3BhY2thZ2VdICYmIHlhcm4gdHlwZWNoZWNrIDI+JjFcbmNkIHBhY2thZ2VzL1twYWNrYWdlXSAmJiB5YXJuIHRlc3QgMj4mMVxuY2QgcGFja2FnZXMvW3BhY2thZ2VdICYmIHlhcm4gbGludCAyPiYxXG5cXGBcXGBcXGBcblxuIyMjIE9uIEZhaWx1cmVcblxuMS4gKipFcnJvciBpbiBjb2RlIHlvdSBjYW4gbW9kaWZ5KiogXHUyMTkyIERpc3BhdGNoIGZpeCB0YXNrIHRvIHN1YmFnZW50LCByZS1ydW4gdmFsaWRhdGlvblxuMi4gKipFcnJvciBvdXRzaWRlIHlvdXIgc2NvcGUqKiBcdTIxOTIgQmxvY2sgaW1tZWRpYXRlbHkgYW5kIHJlcG9ydCB0byB1c2VyXG5cbiMjIyBWYWxpZGF0aW9uIExvb3BcblxuQ29udGludWUgdGhlIGZpeC1hbmQtdmFsaWRhdGUgY3ljbGUgdW50aWw6XG4tICoqQWxsIHZhbGlkYXRpb25zIHBhc3MqKiBcdTIxOTIgUHJvY2VlZCB0byBTdGVwIDdcbi0gKipFcnJvciBpcyBvdXRzaWRlIHNjb3BlKiogXHUyMTkyIFJlcG9ydCBibG9ja2VyIHRvIHVzZXIsIGtlZXAgcHJvamVjdCBpbiBcXGBwcm9qZWN0cy9hY3RpdmUvXFxgLCAqKlNUT1AqKlxuLSAqKkZpeCBhdHRlbXB0cyBleGNlZWQgMyBmb3IgdGhlIHNhbWUgZXJyb3IqKiBcdTIxOTIgUmVwb3J0IGJsb2NrZXIgdG8gdXNlciwga2VlcCBwcm9qZWN0IGluIFxcYHByb2plY3RzL2FjdGl2ZS9cXGAsICoqU1RPUCoqXG5cbiMjIyBGaXggVGFzayBEaXNwYXRjaFxuXG5XaGVuIGRpc3BhdGNoaW5nIGZpeCB0YXNrcywgaW5jbHVkZSB0aGUgZXhhY3QgZXJyb3Igb3V0cHV0OlxuXG5cXGBcXGBcXGB4bWxcbjxpbnZva2UgbmFtZT1cIlRhc2tcIj5cbjxwYXJhbWV0ZXIgbmFtZT1cImRlc2NyaXB0aW9uXCI+Rml4IFtlcnJvci10eXBlXTwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwic3ViYWdlbnRfdHlwZVwiPmdlbmVyYWwtcHVycG9zZTwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwibW9kZWxcIj5bTU9ERUwgLSBoYWlrdSBmb3Igc2ltcGxlIGZpeGVzLCBzb25uZXQgZm9yIGNvbXBsZXhdPC9wYXJhbWV0ZXI+XG48cGFyYW1ldGVyIG5hbWU9XCJwcm9tcHRcIj4jIFRhc2s6IEZpeCBWYWxpZGF0aW9uIEVycm9yXG5cbiMjIEVycm9yIE91dHB1dFxuXFxgXFxgXFxgXG5bRXhhY3QgZXJyb3Igb3V0cHV0IHdpdGggZmlsZTpsaW5lIHJlZmVyZW5jZXNdXG5cXGBcXGBcXGBcblxuIyMgUGxhblxuQFtQUk9KRUNUX0RJUl0vcGxhbi5tZFxuXG4jIyBGaWxlIE93bmVyc2hpcFxuVGhpcyB0YXNrIG93bnM6IFtmaWxlcyBtZW50aW9uZWQgaW4gZXJyb3JdXG5cbiMjIEN1cnJlbnQgRmlsZSBDb250ZW50XG5bQ29udGVudCBvZiBmaWxlcyB3aXRoIGVycm9yc11cblxuIyMgR3VpZGVsaW5lc1xuLSBGaXggb25seSB0aGUgc3BlY2lmaWMgZXJyb3Igc2hvd25cbi0gRG8gbm90IHJlZmFjdG9yIG9yIGltcHJvdmUgc3Vycm91bmRpbmcgY29kZVxuLSBNYWludGFpbiBleGlzdGluZyBwYXR0ZXJuc1xuXG4jIyBTdWNjZXNzIENyaXRlcmlhXG4tIFsgXSBFcnJvciByZXNvbHZlZFxuLSBbIF0gTm8gbmV3IGVycm9ycyBpbnRyb2R1Y2VkPC9wYXJhbWV0ZXI+XG48L2ludm9rZT5cblxcYFxcYFxcYFxuXG4jIyBTdGVwIDc6IFJlZmFjdG9yXG5cbkNyZWF0ZSBwcmUtcmVmYWN0b3IgY2hlY2twb2ludDpcblxuXFxgXFxgXFxgYmFzaFxuZ2l0IGFkZCAtQVxuZ2l0IGNvbW1pdCAtLWFsbG93LWVtcHR5IC1tIFwiY2hlY2twb2ludDogYmVmb3JlIHJlZmFjdG9yaW5nXG5cblByb2plY3Q6IFtQUk9KRUNUX05BTUVdXG5TdGF0dXM6IFZhbGlkYXRpb24gcGFzc2VkXCJcbmdpdCB0YWcgLWYgaW1wbGVtZW50L1tQUk9KRUNUX05BTUVdL3ByZS1yZWZhY3RvciBIRUFEXG5cXGBcXGBcXGBcblxuRGVsZWdhdGUgcmVmYWN0b3JpbmcgdG8gaW1wcm92ZSBjb2RlIHF1YWxpdHkgd2hpbGUgcHJlc2VydmluZyBiZWhhdmlvci5cblxuIyMjIERpc3BhdGNoIFJlZmFjdG9yaW5nXG5cblxcYFxcYFxcYHhtbFxuPGludm9rZSBuYW1lPVwiVGFza1wiPlxuPHBhcmFtZXRlciBuYW1lPVwiZGVzY3JpcHRpb25cIj5SZWZhY3RvciBpbXBsZW1lbnRhdGlvbjwvcGFyYW1ldGVyPlxuPHBhcmFtZXRlciBuYW1lPVwic3ViYWdlbnRfdHlwZVwiPmNvZGUtc2ltcGxpZmllcjpjb2RlLXNpbXBsaWZpZXI8L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cInByb21wdFwiPlxuIyBUYXNrOiBSZWZhY3RvciBSZWNlbnQgSW1wbGVtZW50YXRpb25cblxuIyMgUGxhblxuQFtQUk9KRUNUX0RJUl0vcGxhbi5tZFxuXG4jIyBGb2N1cyBBcmVhc1xuMS4gRWxpbWluYXRlIGRlYWQgY29kZVxuMi4gU2ltcGxpZnkgbG9naWMgKGd1YXJkIGNsYXVzZXMsIHNtYWxsZXIgZnVuY3Rpb25zKVxuMy4gUmVtb3ZlIG92ZXItZW5naW5lZXJpbmcgKFlBR05JKVxuNC4gSW1wcm92ZSBuYW1pbmcgKGFsaWduIHdpdGggcGxhbiBpbnRlbnQpXG41LiBIYXJtb25pemUgcGF0dGVybnMgKG1hdGNoIGNvZGViYXNlIGNvbnZlbnRpb25zKVxuNi4gUmVmaW5lIHRlc3RzIChyZW1vdmUgcmVkdW5kYW50LCBmb2N1cyBvbiBiZWhhdmlvcilcblxuIyMgQ29uc3RyYWludHNcbi0gUHJlc2VydmUgb2JzZXJ2YWJsZSBiZWhhdmlvclxuLSBNYWludGFpbiB0ZXN0IGNvdmVyYWdlXG4tIFN0YXkgd2l0aGluIHBsYW4gc2NvcGVcbi0gVmFsaWRhdGUgYWZ0ZXIgZWFjaCBjaGFuZ2VcblxuIyMgR3VpZGVsaW5lc1xuLSBPbmx5IHJlZmFjdG9yIGZpbGVzIG1vZGlmaWVkIGJ5IHRoZSBpbXBsZW1lbnRhdGlvblxuLSBEbyBub3QgYWRkIG5ldyBmZWF0dXJlcyBvciBjYXBhYmlsaXRpZXNcbi0gS2VlcCBjaGFuZ2VzIG1pbmltYWwgYW5kIGZvY3VzZWQgb24gY2xhcml0eVxuPC9wYXJhbWV0ZXI+XG48L2ludm9rZT5cblxcYFxcYFxcYFxuXG4jIyMgUHJvY2VzcyBSZXN1bHRcblxuQmFzZWQgb24gYWdlbnQgc3RhdHVzOlxuLSAqKkNPTVBMRVRFRCoqOiBQcm9jZWVkIHRvIFN0ZXAgOFxuLSAqKkhBU19SRUNPTU1FTkRBVElPTlMqKjogTG9nIHJlY29tbWVuZGF0aW9ucywgcHJvY2VlZCB0byBTdGVwIDhcbi0gKipCTE9DS0VEKio6IERvY3VtZW50IHJlYXNvbnMsIHByb2NlZWQgdG8gU3RlcCA4XG5cbiMjIFN0ZXAgODogUG9zdC1SZWZhY3RvciBWYWxpZGF0aW9uXG5cblJlLXJ1biB0aGUgdmFsaWRhdGlvbiBjb21tYW5kcyAodHlwZWNoZWNrLCB0ZXN0LCBsaW50KSB0byBlbnN1cmUgcmVmYWN0b3JpbmcgZGlkbid0IGludHJvZHVjZSByZWdyZXNzaW9ucy5cblxuKipJZiB2YWxpZGF0aW9uIHBhc3NlczoqKiBDb21taXQgcmVmYWN0b3JpbmcgY2hhbmdlcyBhbmQgcHJvY2VlZCB0byBTdGVwIDk6XG5cXGBcXGBcXGBiYXNoXG5naXQgYWRkIC1BXG5naXQgY29tbWl0IC1tIFwicmVmYWN0b3I6IHNpbXBsaWZ5IGltcGxlbWVudGF0aW9uXG5cblByb2plY3Q6IFtQUk9KRUNUX05BTUVdXCJcblxcYFxcYFxcYFxuXG4qKklmIHZhbGlkYXRpb24gZmFpbHM6KiogUmV2ZXJ0IG9ubHkgcGxhbi1vd25lZCBmaWxlcyB0byBwcmUtcmVmYWN0b3Igc3RhdGUsIHRoZW4gcHJvY2VlZCB0byBTdGVwIDk6XG5cXGBcXGBcXGBiYXNoXG4jIElkZW50aWZ5IGZpbGVzIGNoYW5nZWQgYnkgcmVmYWN0b3JpbmcgdGhhdCBhcmUgaW4gW1BMQU5fRklMRVNdXG5SRUZBQ1RPUl9DSEFOR0VTPSQoZ2l0IGRpZmYgaW1wbGVtZW50L1tQUk9KRUNUX05BTUVdL3ByZS1yZWZhY3RvciAtLW5hbWUtb25seSlcblBMQU5fQ0hBTkdFUz0kKGNvbW0gLTEyIDwoZWNobyBcIiRSRUZBQ1RPUl9DSEFOR0VTXCIgfCBzb3J0KSA8KGVjaG8gXCJbUExBTl9GSUxFU11cIiB8IHNvcnQpKVxuXG4jIFJldmVydCBvbmx5IHRob3NlIGZpbGVzXG5naXQgY2hlY2tvdXQgaW1wbGVtZW50L1tQUk9KRUNUX05BTUVdL3ByZS1yZWZhY3RvciAtLSAkUExBTl9DSEFOR0VTXG5cXGBcXGBcXGBcblxuIyMgU3RlcCA5OiBFdmFsdWF0ZSBRdWFsaXR5XG5cbkRpc3BhdGNoIGEgc3ViYWdlbnQgdG8gZXZhbHVhdGUgdGhlIGltcGxlbWVudGF0aW9uIGZvciBwcm9kdWN0aW9uIHJlYWRpbmVzczpcblxuXFxgXFxgXFxgeG1sXG48aW52b2tlIG5hbWU9XCJUYXNrXCI+XG48cGFyYW1ldGVyIG5hbWU9XCJkZXNjcmlwdGlvblwiPkV2YWx1YXRlIGltcGxlbWVudGF0aW9uIHF1YWxpdHk8L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cInN1YmFnZW50X3R5cGVcIj5nZW5lcmFsLXB1cnBvc2U8L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cIm1vZGVsXCI+W01PREVMIC0gdHlwaWNhbGx5IHNvbm5ldF08L3BhcmFtZXRlcj5cbjxwYXJhbWV0ZXIgbmFtZT1cInByb21wdFwiPiMgVGFzazogRXZhbHVhdGUgSW1wbGVtZW50YXRpb24gUXVhbGl0eVxuXG4jIyBQbGFuXG5AW1BST0pFQ1RfRElSXS9wbGFuLm1kXG5cbiMjIFN0YXR1cyBEZWZpbml0aW9uc1xuLSAqKlBST0RVQ1RJT05fUkVBRFkqKjogSW1wbGVtZW50YXRpb24gbWVldHMgYWxsIHN1Y2Nlc3MgY3JpdGVyaWEsIGNvZGUgcXVhbGl0eSBpcyBhY2NlcHRhYmxlXG4tICoqQ09OVElOVUUqKjogQ29yZSB3b3JrcyBidXQgaGFzIHF1YWxpdHkgaXNzdWVzIHRoYXQgc2hvdWxkIGJlIGFkZHJlc3NlZCAobm90IHZhbGlkYXRpb24gZmFpbHVyZXMpXG4tICoqQkxPQ0tFRCoqOiBGdW5kYW1lbnRhbCBkZXNpZ24gaXNzdWVzIG9yIG1pc3NpbmcgcmVxdWlyZW1lbnRzIHRoYXQgY2FuJ3QgYmUgZml4ZWQgd2l0aG91dCByZS1wbGFubmluZ1xuXG4jIyBFdmFsdWF0aW9uIENyaXRlcmlhXG5cbjEuICoqUmVxdWlyZW1lbnRzIENvdmVyYWdlKio6IERvZXMgdGhlIGltcGxlbWVudGF0aW9uIHNhdGlzZnkgYWxsIHN1Y2Nlc3MgY3JpdGVyaWEgaW4gdGhlIHBsYW4/XG4yLiAqKkNvZGUgUXVhbGl0eSoqOiBJcyB0aGUgY29kZSBtYWludGFpbmFibGUsIHJlYWRhYmxlLCBhbmQgZm9sbG93aW5nIHByb2plY3QgY29udmVudGlvbnM/XG4zLiAqKkVkZ2UgQ2FzZXMqKjogQXJlIGVycm9yIGNvbmRpdGlvbnMgYW5kIGVkZ2UgY2FzZXMgaGFuZGxlZCBhcHByb3ByaWF0ZWx5P1xuNC4gKipUZXN0IENvdmVyYWdlKio6IEFyZSB0aGUgY2hhbmdlcyBhZGVxdWF0ZWx5IHRlc3RlZD9cbjUuICoqSW50ZWdyYXRpb24qKjogRG9lcyB0aGUgaW1wbGVtZW50YXRpb24gaW50ZWdyYXRlIGNsZWFubHkgd2l0aCBleGlzdGluZyBjb2RlP1xuXG4jIyBTdGVwc1xuXG4xLiBSZWFkIHRoZSBwbGFuJ3MgU3VjY2VzcyBDcml0ZXJpYSBzZWN0aW9uXG4yLiBSZXZpZXcgdGhlIGltcGxlbWVudGF0aW9uIGFnYWluc3QgZWFjaCBjcml0ZXJpb25cbjMuIEFzc2VzcyBjb2RlIHF1YWxpdHkgYW5kIGNvbXBsZXRlbmVzc1xuNC4gRGV0ZXJtaW5lIHN0YXR1c1xuXG4jIyBSZXR1cm4gRm9ybWF0XG5cXGBcXGBcXGBcblNUQVRVUzogW1NUQVRVU11cbkNSSVRFUklBX01FVDogW05dL1tOXVxuUVVBTElUWV9OT1RFUzogW29ic2VydmF0aW9ucyBhYm91dCBjb2RlIHF1YWxpdHldXG5JU1NVRVM6IFtMaXN0IGFueSBjb25jZXJucywgb3IgXCJOb25lXCJdXG5SRUNPTU1FTkRBVElPTlM6IFtJZiBDT05USU5VRSwgbGlzdCBzcGVjaWZpYyBpbXByb3ZlbWVudHMgbmVlZGVkXVxuXFxgXFxgXFxgPC9wYXJhbWV0ZXI+XG48L2ludm9rZT5cblxcYFxcYFxcYFxuXG4jIyMgSGFuZGxlIEV2YWx1YXRpb24gUmVzdWx0XG5cbkJhc2VkIG9uIGV2YWx1YXRpb24gc3RhdHVzOlxuXG4qKlBST0RVQ1RJT05fUkVBRFk6Kipcbi0gUHJvY2VlZCB0byBTdGVwIDEwXG5cbioqQ09OVElOVUU6KipcbjEuIFJldmlldyByZWNvbW1lbmRhdGlvbnNcbjIuIERpc3BhdGNoIGZpeC9pbXByb3ZlbWVudCB0YXNrcyB0byBzdWJhZ2VudHNcbjMuIFJlLXJ1biB2YWxpZGF0aW9uICh0eXBlY2hlY2ssIHRlc3QsIGxpbnQpXG40LiBDb21taXQgY2hhbmdlczpcbiAgIFxcYFxcYFxcYGJhc2hcbiAgIGdpdCBhZGQgLUFcbiAgIGdpdCBjb21taXQgLW0gXCJmaXg6IGFkZHJlc3MgZXZhbHVhdGlvbiBmZWVkYmFja1xuXG4gICBQcm9qZWN0OiBbUFJPSkVDVF9OQU1FXVxuICAgQ3ljbGU6IFtOXVwiXG4gICBcXGBcXGBcXGBcbjUuIFJlLXJ1biBTdGVwIDkgKEV2YWx1YXRlIFF1YWxpdHkpXG42LiBJZiBldmFsdWF0aW9uIGN5Y2xlcyBleGNlZWQgMiwgcHJvY2VlZCB0byBTdGVwIDEwIHdpdGggY3VycmVudCBzdGF0ZVxuXG5Ob3RlOiBTdWJzZXF1ZW50IGN5Y2xlcyBza2lwIFN0ZXBzIDctOCAoUmVmYWN0b3IgYW5kIFBvc3QtUmVmYWN0b3IgVmFsaWRhdGlvbikgc2luY2UgcmVmYWN0b3JpbmcgYWxyZWFkeSBvY2N1cnJlZC5cblxuKipCTE9DS0VEOioqXG4xLiBSZXBvcnQgZnVuZGFtZW50YWwgaXNzdWVzIHRvIHVzZXJcbjIuIEtlZXAgdGhlIHByb2plY3QgaW4gXFxgcHJvamVjdHMvYWN0aXZlL1xcYFxuMy4gKipTVE9QKipcblxuIyMgU3RlcCAxMDogUmVwb3J0IFJlc3VsdHNcblxuUmVwb3J0IGltcGxlbWVudGF0aW9uIHN0YXR1cyB0byB1c2VyOlxuXG5cXGBcXGBcXGBcbiMjIEltcGxlbWVudGF0aW9uIENvbXBsZXRlXG5cblBsYW46IFxcYFtQUk9KRUNUX0RJUl0vcGxhbi5tZFxcYFxuU3RhdHVzOiBbU1RBVFVTXVxuXG4jIyMgUXVhbGl0eSBBc3Nlc3NtZW50XG4tIFR5cGUgQ2hlY2s6IFtQQVNTL0ZBSUxdXG4tIFRlc3RzOiBbUEFTUy9GQUlMXVxuLSBMaW50OiBbUEFTUy9GQUlMXVxuXG4jIyMgVGFza3MgQ29tcGxldGVkXG5bTl0vW05dIHRhc2tzXG5cbltJZiBpc3N1ZXM6IGxpc3Qgd2l0aCBmaWxlOmxpbmUgcmVmZXJlbmNlc11cblxcYFxcYFxcYFxuXG4jIyBTdGVwIDExOiBGaW5hbCBDb21taXQgYW5kIE1vdmUgUHJvamVjdFxuXG5Db21taXQgYW55IHJlbWFpbmluZyB1bmNvbW1pdHRlZCBjaGFuZ2VzOlxuXG5cXGBcXGBcXGBiYXNoXG5naXQgYWRkIC1BXG5naXQgZGlmZiAtLWNhY2hlZCAtLXF1aWV0IHx8IGdpdCBjb21taXQgLW0gXCJmZWF0OiBpbXBsZW1lbnQgW1BST0pFQ1RfTkFNRV1cblxuW0JSSUVGX1NVTU1BUllfT0ZfSU1QTEVNRU5UQVRJT05dXCJcblxcYFxcYFxcYFxuXG4qKk9ubHkgaWYgc3RhdHVzIGlzIFBST0RVQ1RJT05fUkVBRFkqKiwgbW92ZSB0aGUgcHJvamVjdDpcblxuXFxgXFxgXFxgYmFzaFxubXYgcHJvamVjdHMvYWN0aXZlL1tQUk9KRUNUX05BTUVdIHByb2plY3RzL3JlYWR5LWZvci1yZXZpZXcvXG5cXGBcXGBcXGBcblxuUmVwb3J0OlxuXG5cXGBcXGBcXGBcbiMjIFByb2plY3QgUmVhZHkgZm9yIFJldmlld1xuXG5QbGFuOiBcXGBwcm9qZWN0cy9yZWFkeS1mb3ItcmV2aWV3L1tQUk9KRUNUX05BTUVdL3BsYW4ubWRcXGBcblxuQWxsIHRhc2tzIGNvbXBsZXRlZCBhbmQgdmFsaWRhdGVkIHN1Y2Nlc3NmdWxseS5cblxcYFxcYFxcYFxuXG4qKklmIHN0YXR1cyBpcyBub3QgUFJPRFVDVElPTl9SRUFEWSoqIChlLmcuLCBldmFsdWF0aW9uIGN5Y2xlcyBleGNlZWRlZCksIGtlZXAgcHJvamVjdCBpbiBcXGBwcm9qZWN0cy9hY3RpdmUvXFxgIGFuZCBpbmZvcm0gdXNlciB0aGF0IG1hbnVhbCByZXZpZXcgaXMgbmVlZGVkLlxuXG4jIyMgQ2hlY2twb2ludCBDbGVhbnVwIChPcHRpb25hbClcblxuQWZ0ZXIgc3VjY2Vzc2Z1bCBjb21wbGV0aW9uLCBjaGVja3BvaW50cyBjYW4gYmUgY2xlYW5lZCB1cDpcblxuXFxgXFxgXFxgYmFzaFxuZ2l0IHRhZyAtZCBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vYmFzZWxpbmUgXFxcXFxuICAgICAgICAgaW1wbGVtZW50L1tQUk9KRUNUX05BTUVdL3ByZS1pbXBsZW1lbnRhdGlvbiBcXFxcXG4gICAgICAgICBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vcG9zdC1pbXBsZW1lbnRhdGlvbiBcXFxcXG4gICAgICAgICBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vcHJlLXJlZmFjdG9yIDI+L2Rldi9udWxsXG5cXGBcXGBcXGBcblxuIyMjIEF2YWlsYWJsZSBDaGVja3BvaW50c1xuXG5UaGUgZm9sbG93aW5nIGNoZWNrcG9pbnRzIGFyZSBjcmVhdGVkIGR1cmluZyBleGVjdXRpb24gZm9yIHJvbGxiYWNrOlxuXG58IFRhZyB8IENyZWF0ZWQgQXQgfCBQdXJwb3NlIHxcbnwtLS0tLXwtLS0tLS0tLS0tLS18LS0tLS0tLS0tfFxufCBcXGBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vYmFzZWxpbmVcXGAgfCBTdGVwIDIgfCBPcmlnaW5hbCBzdGF0ZSBiZWZvcmUgYW55IGNoYW5nZXMgfFxufCBcXGBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vcHJlLWltcGxlbWVudGF0aW9uXFxgIHwgU3RlcCA1IHwgQmVmb3JlIHRhc2sgZGlzcGF0Y2ggfFxufCBcXGBpbXBsZW1lbnQvW1BST0pFQ1RfTkFNRV0vcG9zdC1pbXBsZW1lbnRhdGlvblxcYCB8IFN0ZXAgNiB8IEFmdGVyIGltcGxlbWVudGF0aW9uLCBiZWZvcmUgdmFsaWRhdGlvbiB8XG58IFxcYGltcGxlbWVudC9bUFJPSkVDVF9OQU1FXS9wcmUtcmVmYWN0b3JcXGAgfCBTdGVwIDcgfCBBZnRlciB2YWxpZGF0aW9uIHBhc3NlcywgYmVmb3JlIHJlZmFjdG9yaW5nIHxcblxuKipOb3RlOioqIFJldmVydHMgYXJlIHNjb3BlZCB0byBbUExBTl9GSUxFU10gb25seVx1MjAxNGZpbGVzIG91dHNpZGUgdGhlIHBsYW4ncyBzY29wZSBhcmUgbmV2ZXIgbW9kaWZpZWQgb3IgZGlzY2FyZGVkIHdpdGhvdXQgZXhwbGljaXQgdXNlciBjb25zZW50LlxuYDtcbiIsICJcbmltcG9ydCBob29rIGZyb20gJy93b3Jrc3BhY2UvcGFja2FnZXMvZ29vZGZvb3QtaG9va3Mvc3JjL2ltcGxlbWVudC1wbGFuLXJlbG9hZGVyLnRzJztcbmltcG9ydCB7IGV4ZWN1dGUgfSBmcm9tICcvd29ya3NwYWNlL3BhY2thZ2VzL2NsYXVkZS1jb2RlLWhvb2tzL2Rpc3QvcnVudGltZS5qcyc7XG5cbmV4ZWN1dGUoaG9vayk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBZUEsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxjQUFBQSxhQUFZLGtCQUFrQjs7O0FDa0J2QyxZQUFZLFFBQVE7QUFNYixJQUFNLGtCQUFrQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLM0IsYUFBYTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1iLFVBQVU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS1YsUUFBUTtBQUNaO0FBa0NPLFNBQVMsaUJBQWlCO0FBQzdCLFNBQU8sUUFBUSxJQUFJLGdCQUFnQixRQUFRO0FBQy9DO0FBOENPLFNBQVMsY0FBYyxNQUFNLE9BQU87QUFDdkMsUUFBTSxVQUFVLGVBQWU7QUFDL0IsTUFBSSxZQUFZLFFBQVc7QUFDdkIsVUFBTSxJQUFJLE1BQU0sd0dBQTZHO0FBQUEsRUFDakk7QUFFQSxRQUFNLGVBQWUsaUJBQWlCLEtBQUs7QUFFM0MsUUFBTSxrQkFBa0IsVUFBVSxJQUFJLElBQUksWUFBWTtBQUFBO0FBQ3RELEVBQUcsa0JBQWUsU0FBUyxpQkFBaUIsT0FBTztBQUN2RDtBQWlCTyxTQUFTLGVBQWUsTUFBTTtBQUNqQyxhQUFXLENBQUMsTUFBTSxLQUFLLEtBQUssT0FBTyxRQUFRLElBQUksR0FBRztBQUM5QyxrQkFBYyxNQUFNLEtBQUs7QUFBQSxFQUM3QjtBQUNKO0FBVUEsU0FBUyxpQkFBaUIsT0FBTztBQUc3QixRQUFNLFVBQVUsTUFBTSxRQUFRLE1BQU0sT0FBTztBQUMzQyxTQUFPLElBQUksT0FBTztBQUN0Qjs7O0FDcEpBLFNBQVMsbUJBQW1CLGVBQWUsUUFBUSxTQUFTO0FBQ3hELFFBQU0sU0FBUyxPQUFPLE9BQU8sWUFBWTtBQUdyQyxXQUFPLE1BQU0sUUFBUSxPQUFPLE9BQU87QUFBQSxFQUN2QztBQUVBLFNBQU8sZ0JBQWdCO0FBQ3ZCLFNBQU8sVUFBVSxPQUFPO0FBQ3hCLFNBQU8sVUFBVSxPQUFPO0FBQ3hCLFNBQU87QUFDWDtBQXlJTyxTQUFTLGlCQUFpQixRQUFRLFNBQVM7QUFDOUMsU0FBTyxtQkFBbUIsZ0JBQWdCLFFBQVEsT0FBTztBQUM3RDs7O0FDdEtBLFNBQVMsV0FBVyxZQUFZLFdBQVcsVUFBVSxpQkFBaUI7QUFDdEUsU0FBUyxlQUFlO0FBSWpCLElBQU0sYUFBYSxDQUFDLFNBQVMsUUFBUSxRQUFRLE9BQU87QUFzQ3BELElBQU0sU0FBTixNQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFJaEIsV0FBVyxvQkFBSSxJQUFJO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtuQixZQUFZO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFJWixjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFJZCxrQkFBa0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUlsQjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBSUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWdCQSxZQUFZLFNBQVMsQ0FBQyxHQUFHO0FBRXJCLGVBQVcsU0FBUyxZQUFZO0FBQzVCLFdBQUssU0FBUyxJQUFJLE9BQU8sb0JBQUksSUFBSSxDQUFDO0FBQUEsSUFDdEM7QUFFQSxTQUFLLGNBQWMsT0FBTyxlQUFlLFFBQVEsSUFBSSw4QkFBOEI7QUFBQSxFQUN2RjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBYUEsTUFBTSxTQUFTLFNBQVM7QUFDcEIsU0FBSyxLQUFLLFNBQVMsU0FBUyxPQUFPO0FBQUEsRUFDdkM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWFBLEtBQUssU0FBUyxTQUFTO0FBQ25CLFNBQUssS0FBSyxRQUFRLFNBQVMsT0FBTztBQUFBLEVBQ3RDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFhQSxLQUFLLFNBQVMsU0FBUztBQUNuQixTQUFLLEtBQUssUUFBUSxTQUFTLE9BQU87QUFBQSxFQUN0QztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBYUEsTUFBTSxTQUFTLFNBQVM7QUFDcEIsU0FBSyxLQUFLLFNBQVMsU0FBUyxPQUFPO0FBQUEsRUFDdkM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFxQkEsU0FBUyxPQUFPLFNBQVMsU0FBUztBQUM5QixVQUFNLFlBQVksS0FBSyxpQkFBaUIsS0FBSztBQUM3QyxVQUFNLFFBQVE7QUFBQSxNQUNWLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxNQUNsQyxPQUFPO0FBQUEsTUFDUCxVQUFVLEtBQUs7QUFBQSxNQUNmO0FBQUEsTUFDQSxPQUFPLEtBQUs7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQO0FBQUEsSUFDSjtBQUNBLFNBQUssYUFBYSxLQUFLO0FBQUEsRUFDM0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWtDQSxHQUFHLE9BQU8sU0FBUztBQUNmLFVBQU0sZ0JBQWdCLEtBQUssU0FBUyxJQUFJLEtBQUs7QUFDN0MsUUFBSSxlQUFlO0FBQ2Ysb0JBQWMsSUFBSSxPQUFPO0FBQUEsSUFDN0I7QUFDQSxXQUFPLE1BQU07QUFDVCxxQkFBZSxPQUFPLE9BQU87QUFBQSxJQUNqQztBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVVBLFdBQVcsVUFBVSxPQUFPO0FBQ3hCLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssZUFBZTtBQUFBLEVBQ3hCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxlQUFlO0FBQ1gsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxlQUFlO0FBQUEsRUFDeEI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWdCQSxXQUFXLFVBQVU7QUFFakIsUUFBSSxLQUFLLGNBQWMsTUFBTTtBQUN6QixVQUFJO0FBQ0Esa0JBQVUsS0FBSyxTQUFTO0FBQUEsTUFDNUIsUUFDTTtBQUFBLE1BRU47QUFDQSxXQUFLLFlBQVk7QUFBQSxJQUNyQjtBQUNBLFNBQUssY0FBYztBQUNuQixTQUFLLGtCQUFrQjtBQUFBLEVBQzNCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBWUEsUUFBUTtBQUNKLFFBQUksS0FBSyxjQUFjLE1BQU07QUFDekIsVUFBSTtBQUNBLGtCQUFVLEtBQUssU0FBUztBQUFBLE1BQzVCLFFBQ007QUFBQSxNQUVOO0FBQ0EsV0FBSyxZQUFZO0FBQUEsSUFDckI7QUFDQSxTQUFLLGtCQUFrQjtBQUFBLEVBQzNCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxrQkFBa0I7QUFDZCxlQUFXLFlBQVksS0FBSyxTQUFTLE9BQU8sR0FBRztBQUMzQyxVQUFJLFNBQVMsT0FBTztBQUNoQixlQUFPO0FBQUEsSUFDZjtBQUNBLFdBQU8sS0FBSyxnQkFBZ0I7QUFBQSxFQUNoQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBVUEsS0FBSyxPQUFPLFNBQVMsU0FBUztBQUMxQixVQUFNLFFBQVE7QUFBQSxNQUNWLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxNQUNsQztBQUFBLE1BQ0EsVUFBVSxLQUFLO0FBQUEsTUFDZjtBQUFBLE1BQ0EsT0FBTyxLQUFLO0FBQUEsTUFDWjtBQUFBLElBQ0o7QUFDQSxTQUFLLGFBQWEsS0FBSztBQUFBLEVBQzNCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLGFBQWEsT0FBTztBQUVoQixVQUFNLGdCQUFnQixLQUFLLFNBQVMsSUFBSSxNQUFNLEtBQUs7QUFDbkQsUUFBSSxlQUFlO0FBQ2YsaUJBQVcsV0FBVyxlQUFlO0FBQ2pDLFlBQUk7QUFDQSxrQkFBUSxLQUFLO0FBQUEsUUFDakIsUUFDTTtBQUFBLFFBRU47QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUVBLFNBQUssWUFBWSxLQUFLO0FBQUEsRUFDMUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsWUFBWSxPQUFPO0FBQ2YsUUFBSSxDQUFDLEtBQUs7QUFDTjtBQUVKLFFBQUksQ0FBQyxLQUFLLGlCQUFpQjtBQUN2QixXQUFLLGVBQWU7QUFBQSxJQUN4QjtBQUNBLFFBQUksS0FBSyxjQUFjO0FBQ25CO0FBQ0osUUFBSTtBQUNBLFlBQU0sT0FBTyxHQUFHLEtBQUssVUFBVSxLQUFLLENBQUM7QUFBQTtBQUNyQyxnQkFBVSxLQUFLLFdBQVcsSUFBSTtBQUFBLElBQ2xDLFFBQ007QUFBQSxJQUlOO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBSUEsaUJBQWlCO0FBQ2IsU0FBSyxrQkFBa0I7QUFDdkIsUUFBSSxDQUFDLEtBQUs7QUFDTjtBQUNKLFFBQUk7QUFFQSxZQUFNLE1BQU0sUUFBUSxLQUFLLFdBQVc7QUFDcEMsVUFBSSxDQUFDLFdBQVcsR0FBRyxHQUFHO0FBQ2xCLGtCQUFVLEtBQUssRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLE1BQ3RDO0FBRUEsV0FBSyxZQUFZLFNBQVMsS0FBSyxhQUFhLEdBQUc7QUFBQSxJQUNuRCxRQUNNO0FBRUYsV0FBSyxZQUFZO0FBQUEsSUFDckI7QUFBQSxFQUNKO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUEsaUJBQWlCLE9BQU87QUFDcEIsUUFBSSxpQkFBaUIsT0FBTztBQUN4QixZQUFNLE9BQU87QUFBQSxRQUNULE1BQU0sTUFBTTtBQUFBLFFBQ1osU0FBUyxNQUFNO0FBQUEsUUFDZixPQUFPLE1BQU07QUFBQSxNQUNqQjtBQUVBLFVBQUksTUFBTSxVQUFVLFFBQVc7QUFDM0IsYUFBSyxRQUFRLEtBQUssaUJBQWlCLE1BQU0sS0FBSztBQUFBLE1BQ2xEO0FBQ0EsYUFBTztBQUFBLElBQ1g7QUFFQSxXQUFPO0FBQUEsTUFDSCxNQUFNO0FBQUEsTUFDTixTQUFTLE9BQU8sS0FBSztBQUFBLElBQ3pCO0FBQUEsRUFDSjtBQUNKO0FBMERPLElBQU0sU0FBUyxJQUFJLE9BQU87OztBQ2plMUIsSUFBTSxhQUFhO0FBQUE7QUFBQSxFQUV0QixTQUFTO0FBQUE7QUFBQSxFQUVULE9BQU87QUFBQTtBQUFBLEVBRVAsT0FBTztBQUNYO0FBVUEsU0FBUyxnQ0FBZ0MsVUFBVTtBQUMvQyxTQUFPLENBQUMsVUFBVSxDQUFDLE1BQU07QUFDckIsVUFBTSxFQUFFLG9CQUFvQixHQUFHLEtBQUssSUFBSTtBQUN4QyxVQUFNLFNBQVMsdUJBQXVCLFNBQ2hDLEVBQUUsR0FBRyxNQUFNLG9CQUFvQixFQUFFLGVBQWUsVUFBVSxHQUFHLG1CQUFtQixFQUFFLElBQ2xGO0FBQ04sV0FBTyxFQUFFLE9BQU8sVUFBVSxPQUFPO0FBQUEsRUFDckM7QUFDSjtBQThHTyxJQUFNLHFCQUFxQyxnREFBZ0MsY0FBYzs7O0FDOUhoRyxlQUFlLFlBQVk7QUFDdkIsU0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDcEMsVUFBTSxTQUFTLENBQUM7QUFFaEIsWUFBUSxNQUFNLFlBQVksT0FBTztBQUNqQyxZQUFRLE1BQU0sR0FBRyxRQUFRLENBQUMsVUFBVTtBQUNoQyxhQUFPLEtBQUssS0FBSztBQUFBLElBQ3JCLENBQUM7QUFDRCxZQUFRLE1BQU0sR0FBRyxPQUFPLE1BQU07QUFDMUIsY0FBUSxPQUFPLEtBQUssRUFBRSxDQUFDO0FBQUEsSUFDM0IsQ0FBQztBQUNELFlBQVEsTUFBTSxHQUFHLFNBQVMsQ0FBQyxVQUFVO0FBQ2pDLGFBQU8sS0FBSztBQUFBLElBQ2hCLENBQUM7QUFBQSxFQUNMLENBQUM7QUFDTDtBQU9BLFNBQVMsZ0JBQWdCLGNBQWM7QUFFbkMsUUFBTSxXQUFXLEtBQUssTUFBTSxZQUFZO0FBQ3hDLFNBQU87QUFDWDtBQVFBLFNBQVMsWUFBWSxRQUFRO0FBRXpCLFVBQVEsT0FBTyxNQUFNLEtBQUssVUFBVSxNQUFNLENBQUM7QUFDL0M7QUFTQSxTQUFTLDJCQUEyQixPQUFPO0FBQ3ZDLFNBQU8sTUFBTSx1QkFBdUIsaUJBQWlCLFFBQVEsTUFBTSxVQUFVLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDNUYsU0FBTyxFQUFFLFFBQVEsQ0FBQyxFQUFFO0FBQ3hCO0FBVUEsU0FBUyxtQkFBbUIsT0FBTztBQUUvQixNQUFJLGlCQUFpQixPQUFPO0FBQ3hCLFlBQVEsT0FBTyxNQUFNLEdBQUcsTUFBTSxTQUFTLE1BQU0sT0FBTztBQUFBLENBQUk7QUFBQSxFQUM1RCxPQUNLO0FBQ0QsWUFBUSxPQUFPLE1BQU0sR0FBRyxPQUFPLEtBQUssQ0FBQztBQUFBLENBQUk7QUFBQSxFQUM3QztBQUVBLFNBQU8sTUFBTSx1QkFBdUIsaUJBQWlCLFFBQVEsTUFBTSxVQUFVLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFFNUYsU0FBTyxhQUFhO0FBQ3BCLFNBQU8sTUFBTTtBQUViLFVBQVEsS0FBSyxXQUFXLEtBQUs7QUFDakM7QUFtQk8sU0FBUyxvQkFBb0IsZ0JBQWdCO0FBQ2hELFNBQU8sRUFBRSxRQUFRLGVBQWUsT0FBTztBQUMzQztBQWtDQSxlQUFzQixRQUFRLFFBQVE7QUFDbEMsTUFBSTtBQUNKLE1BQUk7QUFJQSxVQUFNLGFBQWEsUUFBUSxJQUFJO0FBQy9CLFVBQU0sYUFBYSxRQUFRLElBQUk7QUFDL0IsUUFBSSxlQUFlLFVBQWEsZUFBZSxVQUFhLGVBQWUsWUFBWTtBQUVuRixjQUFRLE9BQU8sTUFBTSwrQ0FBK0MsVUFBVSxvQ0FBb0MsVUFBVTtBQUFBLENBQ3RFO0FBQ3RELGNBQVEsS0FBSyxXQUFXLEtBQUs7QUFBQSxJQUNqQztBQUVBLFFBQUksZUFBZSxRQUFXO0FBQzFCLGFBQU8sV0FBVyxVQUFVO0FBQUEsSUFDaEM7QUFFQSxRQUFJO0FBQ0osUUFBSTtBQUNBLHFCQUFlLE1BQU0sVUFBVTtBQUFBLElBQ25DLFNBQ08sT0FBTztBQUNWLGFBQU8sU0FBUyxPQUFPLHNCQUFzQjtBQUM3QyxlQUFTLDJCQUEyQixLQUFLO0FBQ3pDO0FBQUEsSUFDSjtBQUVBLFFBQUk7QUFDSixRQUFJO0FBQ0EsY0FBUSxnQkFBZ0IsWUFBWTtBQUFBLElBQ3hDLFNBQ08sT0FBTztBQUNWLGFBQU8sU0FBUyxPQUFPLDRCQUE0QjtBQUNuRCxlQUFTLDJCQUEyQixLQUFLO0FBQ3pDO0FBQUEsSUFDSjtBQUVBLFVBQU0sZ0JBQWdCLE9BQU87QUFDN0IsV0FBTyxXQUFXLGVBQWUsS0FBSztBQUV0QyxVQUFNLFVBQVUsa0JBQWtCLGlCQUFpQixFQUFFLFFBQVEsZUFBZSxlQUFlLElBQUksRUFBRSxPQUFPO0FBRXhHLFFBQUk7QUFDQSxZQUFNLGlCQUFpQixNQUFNLE9BQU8sT0FBTyxPQUFPO0FBQ2xELGVBQVMsb0JBQW9CLGNBQWM7QUFBQSxJQUMvQyxTQUNPLE9BQU87QUFHVix5QkFBbUIsS0FBSztBQUFBLElBQzVCO0FBQUEsRUFDSixVQUNBO0FBRUksUUFBSSxXQUFXLFFBQVc7QUFDdEIsa0JBQVksT0FBTyxNQUFNO0FBQUEsSUFDN0I7QUFFQSxXQUFPLGFBQWE7QUFDcEIsV0FBTyxNQUFNO0FBRWIsWUFBUSxLQUFLLFdBQVcsT0FBTztBQUFBLEVBQ25DO0FBQ0o7OztBQ3hOTyxJQUFNLDhCQUE4QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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
