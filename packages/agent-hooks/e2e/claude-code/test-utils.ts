/**
 * Shared utilities for E2E tests.
 */

import { execFileSync, type SpawnSyncReturns, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

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
    timeout: 45000,
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
 * Represents the hooks.json file structure. `hooks` is the only key the host
 * accepts here — build tracking lives in the sidecar (see HooksMeta).
 */
export interface HooksJson {
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
    WorktreeCreate?: MatcherEntry[];
    WorktreeRemove?: MatcherEntry[];
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
 * Build tracking metadata for a generated hooks.json.
 */
export interface HooksMeta {
  files: string[];
}

/**
 * Gets the path of the tracking sidecar that sits beside a hooks.json.
 * @param hooksJsonPath - Absolute path to the hooks.json file
 * @returns Path to the hooks.meta.json file beside it
 */
export function getHooksMetaPath(hooksJsonPath: string): string {
  return path.join(path.dirname(hooksJsonPath), "hooks.meta.json");
}

/**
 * Reads and parses the tracking sidecar beside a hooks.json file.
 * @param hooksJsonPath - Absolute path to the hooks.json file
 * @returns Parsed sidecar content with typed structure
 * @example
 * ```typescript
 * const meta = readHooksMeta('/path/to/hooks.json');
 * console.log(meta.files);
 * ```
 */
export function readHooksMeta(hooksJsonPath: string): HooksMeta {
  return JSON.parse(fs.readFileSync(getHooksMetaPath(hooksJsonPath), "utf-8")) as HooksMeta;
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
    execFileSync("which", ["claude"], { stdio: "ignore", timeout: 5000 });
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
  env?: NodeJS.ProcessEnv;
}

/**
 * Result from running the Claude CLI.
 */
export interface RunClaudeResult {
  exitCode: number;
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
  const { prompt, pluginDir, timeout = 60000, tools, env } = options;

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

  const result = spawnSync("claude", args, {
    encoding: "utf-8",
    timeout,
    stdio: "pipe",
    env: { ...process.env, ...env },
  });
  if (result.error) {
    throw result.error;
  }
  return { exitCode: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/**
 * Gives a generated consumer project its own Yarn installation boundary.
 * @param testDir - Owned generated project directory
 */
export function prepareYarnProject(testDir: string): void {
  const workspaceManifest: { packageManager: string } = JSON.parse(
    fs.readFileSync(new URL("../../../../package.json", import.meta.url), "utf-8"),
  );
  const manifestPath = path.join(testDir, "package.json");
  const manifest: Record<string, unknown> = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  manifest.packageManager = workspaceManifest.packageManager;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(testDir, "yarn.lock"), "");
  fs.writeFileSync(path.join(testDir, ".yarnrc.yml"), "nodeLinker: node-modules\nenableImmutableInstalls: false\n");
}

/**
 * Runs the current Yarn executable directly with an argument array.
 * @param testDir - Owned generated project directory
 * @param args - Yarn command arguments
 * @param timeout - Child process limit below the enclosing test budget
 * @returns Captured command result for assertions
 */
export function runYarnProject(testDir: string, args: string[], timeout: number): SpawnSyncReturns<string> {
  const yarnEntrypoint = process.env.npm_execpath;
  if (!yarnEntrypoint) {
    throw new Error("Scaffold integration tests must be launched with Yarn");
  }
  return spawnSync(yarnEntrypoint, args, {
    cwd: testDir,
    encoding: "utf-8",
    stdio: "pipe",
    timeout,
    env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: "false", YARN_NODE_LINKER: "node-modules" },
  });
}

/**
 * Copies actual built publication files into an owned immutable install input.
 * @param packageRoot - Library package with a successful source build
 * @param ownedParent - Test-owned directory cleaned by its suite
 * @returns Stable package directory for a real file-protocol installation
 */
export function preparePackageSnapshot(packageRoot: string, ownedParent: string): string {
  const snapshot = fs.mkdtempSync(path.join(ownedParent, "agent-hooks-package-"));
  const manifestPath = path.join(packageRoot, "package.json");
  const manifest: { files: string[] } = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  fs.copyFileSync(manifestPath, path.join(snapshot, "package.json"));
  for (const file of manifest.files) {
    fs.cpSync(path.join(packageRoot, file), path.join(snapshot, file), { recursive: true });
  }
  return snapshot;
}
