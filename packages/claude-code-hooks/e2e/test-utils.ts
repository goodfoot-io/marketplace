/**
 * Shared utilities for E2E tests.
 */

import { execSync, type SpawnSyncReturns, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";

/**
 * Resolves the tsx CLI entrypoint (a `.mjs` file) so it can be executed
 * directly with the current Node binary. This avoids spawning the `npx` /
 * `tsx` shell shims, which on Windows are `.cmd` files that `spawnSync`
 * cannot launch without `shell: true` (and `shell: true` with an args array
 * introduces Windows quoting hazards). Resolving the JS entrypoint and
 * running it with `process.execPath` is byte-identical across platforms.
 */
// Use the package's public `./cli` export, not the internal `./dist/cli.mjs`
// path: tsx's `exports` map only exposes `./cli`, so resolving the internal
// subpath throws ERR_PACKAGE_PATH_NOT_EXPORTED at module load.
const tsxCliPath = createRequire(import.meta.url).resolve("tsx/cli");

/**
 * Runs the library CLI under tsx using the current Node binary.
 *
 * Cross-platform replacement for `spawnSync("npx", ["tsx", ...])`. Behaviour
 * on POSIX is identical to invoking `npx tsx <cliPath> <args>` since the same
 * tsx entrypoint and Node runtime are used; only the executable resolution
 * differs (and only to remain functional on Windows).
 * @param cliPath - Absolute path to the CLI source/entry to execute under tsx
 * @param args - Arguments passed to the CLI
 * @param options - spawnSync options (cwd, env, etc.)
 * @returns The spawnSync result
 */
export function runTsxCli(
  cliPath: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [tsxCliPath, cliPath, ...args], {
    encoding: "utf-8",
    stdio: "pipe",
    ...options,
  });
}

/**
 * Represents a compiled hook entry in hooks.json.
 */
export interface CompiledHookEntry {
  type: string;
  command: string;
}

/**
 * Represents a matcher entry in hooks.json.
 */
export interface MatcherEntry {
  matcher?: string;
  hooks: CompiledHookEntry[];
}

/**
 * Represents the hooks.json file structure.
 */
export interface HooksJson {
  __generated: {
    files: string[];
    timestamp: string;
  };
  hooks: {
    PreToolUse?: MatcherEntry[];
    PostToolUse?: MatcherEntry[];
    PostToolUseFailure?: MatcherEntry[];
    SessionStart?: MatcherEntry[];
    SessionEnd?: MatcherEntry[];
    UserPromptSubmit?: MatcherEntry[];
    PreCompact?: MatcherEntry[];
    PermissionRequest?: MatcherEntry[];
    Stop?: MatcherEntry[];
    SubagentStart?: MatcherEntry[];
    SubagentStop?: MatcherEntry[];
    Notification?: MatcherEntry[];
  };
}

/**
 * Reads and parses a hooks.json file with proper typing.
 * @param hooksJsonPath - Absolute path to the hooks.json file
 * @returns Parsed hooks.json content with typed structure
 * @example
 * ```typescript
 * const hooks = readHooksJson('/path/to/hooks.json');
 * console.log(hooks.hooks.PreToolUse);
 * ```
 */
export function readHooksJson(hooksJsonPath: string): HooksJson {
  return JSON.parse(fs.readFileSync(hooksJsonPath, "utf-8")) as HooksJson;
}

/**
 * Quick synchronous check if Claude CLI binary exists.
 * @returns True if the `claude` command is available in PATH
 * @example
 * ```typescript
 * if (isClaudeBinaryAvailable()) {
 *   // Run tests that require Claude CLI
 * }
 * ```
 */
export function isClaudeBinaryAvailable(): boolean {
  // If CLAUDECODE is set, we're inside a Claude Code session and can't launch nested sessions
  if (process.env.CLAUDECODE) {
    return false;
  }
  try {
    execSync("which claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the Claude CLI is available in the environment.
 */
export const CLAUDE_AVAILABLE = isClaudeBinaryAvailable();

/**
 * Options for running the Claude CLI.
 */
export interface RunClaudeOptions {
  prompt: string;
  pluginDir?: string;
  timeout?: number;
  tools?: string[];
}

/**
 * Result from running the Claude CLI.
 */
export interface RunClaudeResult {
  stdout: string;
  stderr: string;
}

/**
 * Run claude CLI with given options.
 * @param options - CLI options including prompt, pluginDir, timeout, and tools
 * @returns Object containing stdout and stderr from the command
 * @example
 * ```typescript
 * const result = runClaude({
 *   prompt: 'Hello, Claude!',
 *   pluginDir: '/path/to/plugin',
 *   timeout: 30000
 * });
 * console.log(result.stdout);
 * ```
 */
export function runClaude(options: RunClaudeOptions): RunClaudeResult {
  const { prompt, pluginDir, timeout = 60000, tools } = options;

  // Build args: flags first, then prompt, then --plugin-dir and --tools
  // The prompt must come BEFORE --tools and --plugin-dir due to CLI arg parsing
  const args: string[] = ["--print", "--model", "haiku", "--no-session-persistence", "--dangerously-skip-permissions"];

  // Add prompt before --plugin-dir and --tools
  args.push(prompt);

  if (pluginDir) {
    args.push("--plugin-dir", pluginDir);
  }

  if (tools && tools.length > 0) {
    args.push("--tools", tools.join(","));
  }

  const cmd = `claude ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`;
  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "" };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "stdout" in error && "stderr" in error) {
      const execError = error as { stdout: Buffer | string | null; stderr: Buffer | string | null };
      const stdout = execError.stdout;
      const stderr = execError.stderr;
      return {
        stdout: typeof stdout === "string" ? stdout : (stdout?.toString() ?? ""),
        stderr: typeof stderr === "string" ? stderr : (stderr?.toString() ?? ""),
      };
    }
    throw error;
  }
}
