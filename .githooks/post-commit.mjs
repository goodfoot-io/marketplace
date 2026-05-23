// src/workspace/post-commit.ts
import { execFileSync as execFileSync3 } from "node:child_process";
import { existsSync as existsSync2, readFileSync as readFileSync3, realpathSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join3, resolve } from "node:path";

// ../../../public/packages/sdk/src/config/logger.ts
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
   * import { logger } from '@cards/sdk/config';
   *
   * // Or create custom instance
   * const customLogger = new Logger({ logFilePath: '/var/log/hooks.log' });
   * ```
   */
  constructor(config = {}) {
    for (const level of LOG_LEVELS) {
      this.handlers.set(level, /* @__PURE__ */ new Set());
    }
    this.logFilePath = config.logFilePath ?? process.env["CARDS_HOOKS_LOG_FILE"] ?? null;
  }
  /**
   * Logs a debug message.
   *
   * Use for detailed debugging information that is typically only useful
   * during development or troubleshooting.
   * @param message - Diagnostic text describing low-level execution details.
   * @param context - Optional structured metadata merged into the emitted event.
   * @example
   * ```typescript
   * logger.debug('Processing hook input', { taskId: 'task-123', inputSize: 256 });
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
   * @param message - Operational message describing normal hook progress.
   * @param context - Optional structured metadata merged into the emitted event.
   * @example
   * ```typescript
   * logger.info('Task started', { taskId: 'task-123', cardId: 'card-456' });
   * ```
   */
  info(message, context) {
    this.emit("info", message, context);
  }
  /**
   * Logs a warning message.
   *
   * Use for conditions that may indicate cards but don't prevent
   * operation, such as deprecated patterns or performance concerns.
   * @param message - Warning text for recoverable or suspicious conditions.
   * @param context - Optional structured metadata merged into the emitted event.
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
   * @param message - Error text describing a handled failure condition.
   * @param context - Optional structured metadata merged into the emitted event.
   * @example
   * ```typescript
   * logger.error('Failed to validate hook input', { reason: 'empty taskId' });
   * ```
   */
  error(message, context) {
    this.emit("error", message, context);
  }
  /**
   * Logs a structured error with full error details.
   *
   * Use this for caught exceptions. Non-Error values are normalized so handlers
   * always receive a consistent error shape.
   * @param error - The error to log
   * @param message - Human-readable description of what failed
   * @param context - Optional structured metadata merged into the emitted event.
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
   * is no longer needed. Handler errors are ignored to avoid disrupting hooks.
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
   * Sets a default log file path that only takes effect if no other source
   * has configured file logging.
   *
   * This is the lowest-priority file path source. It will be ignored if
   * any of these have already set a path:
   * - `logFilePath` in the constructor config
   * - `CARDS_HOOKS_LOG_FILE` environment variable
   * - {@link setLogFile} called at runtime
   *
   * Intended for use by CLI entry points (e.g., the `--log` flag).
   * @param filePath - Default path to the log file
   * @example
   * ```typescript
   * // Wire --log CLI argument as a fallback
   * if (args.log) {
   *   logger.setDefaultLogFile(args.log);
   * }
   * ```
   */
  setDefaultLogFile(filePath) {
    if (this.logFilePath === null) {
      this.logFilePath = filePath;
      this.fileInitialized = false;
    }
  }
  /**
   * Configures the log file path at runtime.
   *
   * Call this to enable or change file logging. Setting to `null` disables
   * file logging and closes any open file handle. Directories are created
   * on demand when the first write occurs.
   * @param filePath - Path to the log file, or null to disable
   * @example
   * ```typescript
   * // Enable file logging at runtime
   * logger.setLogFile('/var/log/cards-sdk.log');
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
   * Safe to call multiple times.
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
   * Useful for deciding whether to compute expensive log context.
   * @returns Whether the logger has any active output destinations
   */
  hasDestinations() {
    const hasHandlers = Array.from(this.handlers.values()).some((handlers) => handlers.size > 0);
    return hasHandlers || this.logFilePath !== null;
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

// ../../../public/packages/claude-code-sessions/src/index.ts
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// ../../../public/packages/claude-code-sessions/src/internal.ts
import { closeSync as closeSync2, mkdirSync as mkdirSync2, openSync as openSync2, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname as dirname2 } from "node:path";

// ../../../public/packages/claude-code-sessions/src/ipc.ts
import { execFileSync } from "node:child_process";
function isProcessAlive(pid) {
  if (process.platform === "win32") {
    try {
      const output = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], {
        encoding: "utf-8"
      });
      return output.includes(String(pid));
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = error.code;
      if (code === "ESRCH") return false;
      if (code === "EPERM") return true;
    }
    throw error;
  }
}

// ../../../public/packages/claude-code-sessions/src/internal.ts
function sleep(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}
function hasErrnoCode(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}
function tryRemoveStaleLock(lockPath) {
  try {
    const lockContent = readFileSync(lockPath, "utf-8");
    const holderPid = Number.parseInt(lockContent.trim(), 10);
    if (!Number.isNaN(holderPid) && !isProcessAlive(holderPid)) {
      if (readFileSync(lockPath, "utf-8") === lockContent) {
        unlinkSync(lockPath);
        return true;
      }
    }
  } catch {
    try {
      unlinkSync(lockPath);
      return true;
    } catch {
    }
  }
  return false;
}
function writeLockHolderPid(lockPath) {
  const fd = openSync2(lockPath, "wx", 384);
  try {
    writeFileSync(fd, String(process.pid));
  } finally {
    closeSync2(fd);
  }
}
async function acquireLock(lockPath, timeoutMs) {
  const startTime = Date.now();
  const dir = dirname2(lockPath);
  while (Date.now() - startTime < timeoutMs) {
    try {
      mkdirSync2(dir, { recursive: true, mode: 448 });
      writeLockHolderPid(lockPath);
      return;
    } catch (error) {
      if (!hasErrnoCode(error, "EEXIST")) throw error;
      if (tryRemoveStaleLock(lockPath)) continue;
      const remaining = timeoutMs - (Date.now() - startTime);
      if (remaining > 0) {
        await sleep(Math.min(50, remaining));
      }
    }
  }
  throw new Error("Lock acquisition timeout");
}
function releaseLock(lockPath) {
  try {
    unlinkSync(lockPath);
  } catch (error) {
    if (!hasErrnoCode(error, "ENOENT")) throw error;
  }
}
function pruneStaleEntries(registry, isAlive, maxAgeMs) {
  const now = Date.now();
  for (const [pidStr, entry] of Object.entries(registry)) {
    const pid = Number.parseInt(pidStr, 10);
    if (Number.isNaN(pid)) {
      delete registry[pidStr];
      continue;
    }
    try {
      const updatedAt = new Date(entry.updatedAt).getTime();
      if (now - updatedAt > maxAgeMs) {
        delete registry[pidStr];
        continue;
      }
    } catch {
      delete registry[pidStr];
      continue;
    }
    try {
      if (!isAlive(pid)) {
        delete registry[pidStr];
      }
    } catch {
    }
  }
}
function readRegistry(path, defaultValue) {
  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (hasErrnoCode(error, "ENOENT")) return defaultValue;
    throw error;
  }
}
function writeRegistryLocked(registry, registryPath) {
  const dir = dirname2(registryPath);
  mkdirSync2(dir, { recursive: true, mode: 448 });
  const tempPath = `${registryPath}.tmp`;
  try {
    writeFileSync(tempPath, JSON.stringify(registry, null, 2), { mode: 384 });
    renameSync(tempPath, registryPath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
    }
    throw error;
  }
}
async function executeTransaction(registryPath, lockPath, operation, pruner, defaultRegistry, lockTimeoutMs) {
  await acquireLock(lockPath, lockTimeoutMs ?? 2e3);
  try {
    const registry = readRegistry(registryPath, defaultRegistry);
    if (pruner) pruner(registry);
    const result = operation(registry);
    writeRegistryLocked(registry, registryPath);
    return result;
  } finally {
    releaseLock(lockPath);
  }
}

// ../../../public/packages/claude-code-sessions/src/process-tree.ts
import { execSync } from "node:child_process";
var PROCESS_TREE_MAX_DEPTH = 10;
var AGENT_ARGS_PATTERNS = [/((^|\s|\/)claude(\/|\s|$))/i, /((^|\s|\/)codex(\/|\s|$))/i];
function isSupportedAgent(pid) {
  try {
    const args = execSync(`ps -p ${pid} -o args=`, { encoding: "utf8" }).trim();
    return AGENT_ARGS_PATTERNS.some((pattern) => pattern.test(args));
  } catch {
    return false;
  }
}
function getParentPid(pid) {
  try {
    const ppidStr = execSync(`ps -p ${pid} -o ppid=`, { encoding: "utf8" }).trim();
    const parentPid = Number.parseInt(ppidStr, 10);
    if (Number.isNaN(parentPid) || parentPid === pid) return null;
    return parentPid;
  } catch {
    return null;
  }
}
function findAllAgentPids(startPid) {
  const results = [];
  let pid = startPid ?? process.ppid;
  for (let depth = 0; depth < PROCESS_TREE_MAX_DEPTH; depth++) {
    if (pid <= 1) break;
    if (isSupportedAgent(pid)) {
      results.push(pid);
    }
    const parentPid = getParentPid(pid);
    if (parentPid === null) break;
    pid = parentPid;
  }
  return results;
}

// ../../../public/packages/claude-code-sessions/src/index.ts
function getCardsDir() {
  return join(homedir(), ".cards");
}
function getRegistryPath() {
  return join(getCardsDir(), "sessions.json");
}
function getLockPath() {
  return join(getCardsDir(), "sessions.lock");
}
var LOCK_TIMEOUT_MS = 2e3;
var MAX_ENTRY_AGE_MS = 24 * 60 * 60 * 1e3;
async function recordPendingCommit(pid, sha) {
  await executeTransaction(
    getRegistryPath(),
    getLockPath(),
    (registry) => {
      const pidStr = String(pid);
      const entry = registry.sessions[pidStr] ?? {
        pendingCommits: [],
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!entry.pendingCommits.includes(sha)) {
        entry.pendingCommits.push(sha);
      }
      entry.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      registry.sessions[pidStr] = entry;
    },
    (registry) => pruneStaleEntries(registry.sessions, isProcessAlive, MAX_ENTRY_AGE_MS),
    { sessions: {} },
    LOCK_TIMEOUT_MS
  );
}
async function getPidCardAssociation(pid) {
  return executeTransaction(
    getRegistryPath(),
    getLockPath(),
    (registry) => {
      const entry = registry.sessions[String(pid)];
      if (!entry?.cardId) return null;
      const result = { cardId: entry.cardId };
      if (entry.mode !== void 0) result.mode = entry.mode;
      if (entry.workspacePath !== void 0) result.workspacePath = entry.workspacePath;
      return result;
    },
    (registry) => pruneStaleEntries(registry.sessions, isProcessAlive, MAX_ENTRY_AGE_MS),
    { sessions: {} },
    LOCK_TIMEOUT_MS
  );
}
function getCardRepoPidsRegistryPath() {
  return join(getCardsDir(), "card-repo-commits", "pids.json");
}
async function getSessionIdForPid(pid) {
  const registryPath = getCardRepoPidsRegistryPath();
  try {
    const content = await readFile(registryPath, "utf-8");
    const registry = JSON.parse(content);
    return registry.sessions[String(pid)]?.sessionId ?? null;
  } catch (error) {
    if (hasErrnoCode(error, "ENOENT")) return null;
    throw error;
  }
}

// src/logger.ts
function resolveWorkspaceLogFile() {
  return process.env["CARDS_GIT_WORKSPACE_REPO_HOOKS_LOG_FILE"];
}

// src/workspace/shared.ts
import { execFileSync as execFileSync2, spawnSync } from "node:child_process";
import { readFileSync as readFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
var debug = process.env["CARDS_DEBUG"] === "1";
function readCardBoundCardId(worktreeRoot) {
  try {
    const content = readFileSync2(join2(worktreeRoot, ".cards", "CARD_ID"), "utf-8").trim();
    return content.length > 0 ? content : "empty";
  } catch (error) {
    if (error.code === "ENOENT") return "missing";
    if (debug)
      process.stderr.write(
        `cards-hook: failed to read .cards/CARD_ID: ${error instanceof Error ? error.message : String(error)}
`
      );
    return "unreadable";
  }
}
var SHA_PATTERN = /^[0-9a-f]{40}$/i;
function isValidSha(sha) {
  return SHA_PATTERN.test(sha);
}
function isAncestorOfHead(sha) {
  if (!isValidSha(sha)) return false;
  const result = spawnSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], {
    stdio: "ignore",
    timeout: 3e3
  });
  if (result.error) {
    throw result.error;
  }
  return result.status === 0;
}
function buildCleanEnv() {
  const output = execFileSync2("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" });
  const localVars = output.replace(/\r\n/g, "\n").split("\n").map((v) => v.trim()).filter(Boolean);
  const env = { ...process.env };
  for (const varName of localVars) {
    delete env[varName];
  }
  return env;
}
async function cardHasWorktreeAt(baseUrl, token, cardId, worktreePath) {
  const response = await fetch(`${baseUrl}/cards/${cardId}/branches`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(3e3)
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.branches.some((b) => b.worktree === worktreePath);
}
async function cleanOrphanedCommits(baseUrl, token, cardId, currentSha, sessionId) {
  try {
    const response = await fetch(`${baseUrl}/cards/${cardId}/commits`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3e3)
    });
    if (!response.ok) return;
    const deleteHeaders = { Authorization: `Bearer ${token}` };
    if (sessionId) deleteHeaders["X-Cards-Session-Id"] = sessionId;
    const { commits } = await response.json();
    for (const sha of commits) {
      if (sha === currentSha) continue;
      const shouldDelete = !isValidSha(sha) || !isAncestorOfHead(sha);
      if (shouldDelete) {
        await fetch(`${baseUrl}/cards/${cardId}/commits/${encodeURIComponent(sha)}`, {
          method: "DELETE",
          headers: deleteHeaders,
          signal: AbortSignal.timeout(3e3)
        });
      }
    }
  } catch (error) {
    if (debug)
      process.stderr.write(
        `cards-hook: failed to clean orphaned commits: ${error instanceof Error ? error.message : String(error)}
`
      );
  }
}
async function resolveSessionId(logger2) {
  const envSessionId = process.env["CARDS_SESSION_ID"];
  if (envSessionId) {
    logger2?.info("workspace/hook: session ID resolved from CARDS_SESSION_ID env var", {
      sessionId: envSessionId
    });
    return envSessionId;
  }
  const agentPids = findAllAgentPids();
  logger2?.info("workspace/hook: CARDS_SESSION_ID not set, falling back to PID walk", {
    agentPidCount: agentPids.length,
    agentPids
  });
  for (const pid of agentPids) {
    const sessionId = await getSessionIdForPid(pid);
    if (sessionId) {
      logger2?.info("workspace/hook: session ID resolved from PID", { pid, sessionId });
      return sessionId;
    }
  }
  logger2?.warn("workspace/hook: session ID could not be resolved from env or PID walk");
  return null;
}

// src/workspace/post-commit.ts
async function checkpointSessionStream(reposPath, cardId, sha, getCleanEnv, logger2) {
  if (!reposPath) return;
  try {
    const cardRepoPath = join3(reposPath, cardId);
    if (!existsSync2(cardRepoPath)) return;
    const sessionId = await resolveSessionId(logger2);
    if (!sessionId) return;
    const streamRel = join3("streams", "claude-code-session", `${sessionId}.jsonl`);
    if (!existsSync2(join3(cardRepoPath, streamRel))) return;
    const metaRel = `${streamRel}.meta.json`;
    const filesToAdd = existsSync2(join3(cardRepoPath, metaRel)) ? [streamRel, metaRel] : [streamRel];
    const cleanEnv = getCleanEnv();
    execFileSync3("git", ["add", ...filesToAdd], { cwd: cardRepoPath, stdio: "pipe", env: cleanEnv, timeout: 5e3 });
    execFileSync3("git", ["commit", "--no-gpg-sign", "-m", `Checkpoint stream: ${sessionId}.jsonl (workspace ${sha})`], {
      cwd: cardRepoPath,
      stdio: "pipe",
      env: cleanEnv,
      timeout: 5e3
    });
  } catch (error) {
    if (debug)
      process.stderr.write(
        `cards-hook: stream checkpoint failed: ${error instanceof Error ? error.message : String(error)}
`
      );
  }
}
async function main() {
  const logger2 = new Logger({ logFilePath: resolveWorkspaceLogFile() });
  const discoveryPath = process.env["CARDS_DISCOVERY_PATH"] ?? join3(homedir2(), ".cards", "cards-api.json");
  let config;
  try {
    config = JSON.parse(readFileSync3(discoveryPath, "utf-8"));
  } catch (error) {
    if (debug)
      process.stderr.write(
        `cards-hook: failed to read discovery file: ${error instanceof Error ? error.message : String(error)}
`
      );
    logger2.debug("workspace/post-commit: failed to read discovery file", {
      error: error instanceof Error ? error.message : String(error)
    });
    logger2.close();
    return;
  }
  if (!config.host || !config.port || !config.accessToken) {
    logger2.close();
    return;
  }
  const rawGitDir = execFileSync3("git", ["rev-parse", "--git-dir"], { encoding: "utf8" }).trim();
  const absGitDir = resolve(rawGitDir);
  if (existsSync2(join3(absGitDir, "rebase-merge")) || existsSync2(join3(absGitDir, "rebase-apply"))) {
    logger2.info("workspace/post-commit: rebase in progress, skipping attribution");
    logger2.close();
    return;
  }
  const baseUrl = `http://${config.host}:${config.port}`;
  const token = config.accessToken;
  const sha = execFileSync3("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const rawWorktreePath = execFileSync3("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  let worktreePath;
  try {
    worktreePath = realpathSync(rawWorktreePath);
  } catch {
    worktreePath = rawWorktreePath;
  }
  let cleanEnv;
  const getCleanEnv = () => {
    cleanEnv ??= buildCleanEnv();
    return cleanEnv;
  };
  const cardIdResult = readCardBoundCardId(worktreePath);
  const cardId = cardIdResult !== "missing" && cardIdResult !== "empty" && cardIdResult !== "unreadable" ? cardIdResult : null;
  logger2.info("workspace/post-commit: running", {
    sha,
    cardId,
    markerState: cardId !== null ? "present" : cardIdResult
  });
  const sessionId = await resolveSessionId(logger2);
  logger2.info("workspace/post-commit: session ID resolution complete", {
    sessionId: sessionId ?? "null",
    willSendHeader: sessionId !== null
  });
  if (cardId) {
    await processCommitForCard(baseUrl, token, cardId, sha, worktreePath, sessionId);
    await checkpointSessionStream(config.reposPath, cardId, sha, getCleanEnv, logger2);
    logger2.close();
    return;
  }
  const agentPids = findAllAgentPids();
  if (agentPids.length === 0) {
    logger2.close();
    return;
  }
  let anyAssociation = false;
  for (const pid of agentPids) {
    const association = await getPidCardAssociation(pid);
    if (!association) {
      logger2.debug("workspace/post-commit: no card association", { pid });
      continue;
    }
    anyAssociation = true;
    const { cardId: pidCardId, mode, workspacePath: attachedPath } = association;
    if (mode === "attach" || attachedPath !== void 0) {
      let canonicalAttached;
      try {
        canonicalAttached = attachedPath !== void 0 ? realpathSync(attachedPath) : "";
      } catch {
        canonicalAttached = attachedPath ?? "";
      }
      if (canonicalAttached !== worktreePath) {
        logger2.info("workspace/post-commit: workspace mismatch (attach-mode)", {
          attachedPath: canonicalAttached,
          worktreePath,
          cardId: pidCardId
        });
        continue;
      }
    } else {
      if (!await cardHasWorktreeAt(baseUrl, token, pidCardId, worktreePath)) continue;
    }
    await processCommitForCard(baseUrl, token, pidCardId, sha, worktreePath, sessionId);
    await checkpointSessionStream(config.reposPath, pidCardId, sha, getCleanEnv, logger2);
    logger2.close();
    return;
  }
  if (!anyAssociation) await recordPendingCommit(agentPids[0], sha);
  logger2.close();
}
async function processCommitForCard(baseUrl, token, cardId, sha, workspacePath, sessionId) {
  await postCommit(baseUrl, token, cardId, sha, sessionId);
  await cleanOrphanedCommits(baseUrl, token, cardId, sha, sessionId);
  await cleanStaleBranches(baseUrl, token, cardId, sessionId);
  const changedFiles = getChangedFiles();
  await triggerReindex(baseUrl, token, cardId, changedFiles, sha, workspacePath);
}
async function postCommit(baseUrl, token, cardId, sha, sessionId) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
  if (sessionId) headers["X-Cards-Session-Id"] = sessionId;
  await fetch(`${baseUrl}/cards/${cardId}/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sha }),
    signal: AbortSignal.timeout(3e3)
  });
}
async function cleanStaleBranches(baseUrl, token, cardId, sessionId) {
  try {
    const response = await fetch(`${baseUrl}/cards/${cardId}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3e3)
    });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.branches || data.branches.length === 0) return;
    for (const branch of data.branches) {
      let gitBranchExists;
      try {
        const result = execFileSync3("git", ["branch", "--list", branch.name], { encoding: "utf8" });
        gitBranchExists = result.trim() !== "";
      } catch {
        continue;
      }
      const worktreeMissing = branch.worktree !== void 0 && !existsSync2(branch.worktree);
      const isStale = !gitBranchExists || worktreeMissing;
      if (!isStale) continue;
      try {
        const deleteHeaders = { Authorization: `Bearer ${token}` };
        if (sessionId) deleteHeaders["X-Cards-Session-Id"] = sessionId;
        await fetch(`${baseUrl}/cards/${cardId}/branches/${encodeURIComponent(branch.name)}`, {
          method: "DELETE",
          headers: deleteHeaders,
          signal: AbortSignal.timeout(3e3)
        });
      } catch (error) {
        if (debug)
          process.stderr.write(
            `cards-hook: failed to delete stale branch ${branch.name}: ${error instanceof Error ? error.message : String(error)}
`
          );
      }
    }
  } catch (error) {
    if (debug)
      process.stderr.write(
        `cards-hook: failed to clean stale branches: ${error instanceof Error ? error.message : String(error)}
`
      );
  }
}
function getChangedFiles() {
  try {
    const output = execFileSync3("git", ["diff-tree", "--root", "--no-commit-id", "-r", "-M", "HEAD", "--name-status"], {
      encoding: "utf8"
    });
    const lines = output.replace(/\r\n/g, "\n").trim().split("\n");
    const changedFiles = [];
    for (const line of lines) {
      if (!line) continue;
      const parts = line.split("	");
      if (parts.length >= 2) {
        const status = parts[0];
        const sourcePath = parts[1];
        const destinationPath = parts[2];
        const path = /^(R|C)/.test(status) ? destinationPath ?? sourcePath : sourcePath;
        changedFiles.push({
          status,
          path
        });
      }
    }
    return changedFiles;
  } catch (error) {
    process.stderr.write(
      `cards-hook: failed to get changed files: ${error instanceof Error ? error.message : String(error)}
`
    );
    return [];
  }
}
async function triggerReindex(apiBaseUrl, accessToken, cardId, changedFiles, commitSha, workspacePath) {
  try {
    await fetch(`${apiBaseUrl}/internal/workspace-post-commit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ cardId, changedFiles, commitSha, workspacePath }),
      signal: AbortSignal.timeout(3e3)
    });
  } catch (error) {
    if (debug)
      process.stderr.write(
        `cards-hook: failed to trigger reindex: ${error instanceof Error ? error.message : String(error)}
`
      );
  }
}
if (process.argv[1]?.endsWith("post-commit.mjs")) {
  main().catch((err) => {
    process.stderr.write(`[post-commit] Fatal: ${err instanceof Error ? err.message : String(err)}
`);
    process.exit(0);
  });
}
export {
  main
};
