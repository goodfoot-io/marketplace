#!/usr/bin/env node

/**
 * CLI tool for compiling Claude Code hooks using esbuild.
 *
 * Compiles TypeScript hooks to standalone ESM modules and generates hooks.json
 * with correct command paths and matcher configurations.
 * @example
 * ```bash
 * # Compile hooks and generate hooks.json
 * agent-hooks --agent claude-code -i "hooks/**\/*.ts" -o "./dist/hooks.json"
 *
 * # With runtime logging (equivalent to AGENT_HOOKS_LOG_FILE)
 * agent-hooks --agent claude-code -i "hooks/**\/*.ts" -o "./dist/hooks.json" --log /tmp/hooks.log
 * ```
 * @module
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { glob } from "glob";
import ts from "typescript";
import type { HookEventName } from "./agents/claude-code/types.js";
import { HOOK_FACTORY_TO_EVENT } from "./constants.js";
import { scaffoldProject } from "./scaffold.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Hook context determines how paths are resolved in hooks.json.
 *
 * - `plugin`: Uses `$CLAUDE_PLUGIN_ROOT` for plugin hooks
 * - `agent`: Uses `"$CLAUDE_PROJECT_DIR"` for agent hooks (.claude/hooks/)
 */
type HookContext = "plugin" | "agent";

/**
 * Command-line arguments parsed from process.argv.
 */
interface CliArgs {
  /** Target agent runtime (required): "claude-code" | "codex" | "antigravity". */
  agent: string;
  /** Glob pattern for hook source files. */
  input: string;
  /** Path for hooks.json output file. */
  output: string;
  /** Optional log file path (hardcoded into bundle). */
  log?: string;
  /** Optional env var name whose value supplies the log file path at runtime. */
  logEnvVar?: string;
  /** Show help. */
  help: boolean;
  /** Show version. */
  version: boolean;
  /** Directory path for scaffolding a new hook project. */
  scaffold?: string;
  /** Comma-separated list of hook types to generate when scaffolding. */
  hooks?: string;
  /** Node executable path to use in command output (default: "node"). */
  executable?: string;
  /** Repeated esbuild loader flags in EXT=TYPE form. */
  loaderFlags: string[];
  /** Force Codex plugin mode: ${PLUGIN_ROOT}-relative commands + stable names default. */
  pluginRoot?: boolean;
  /** Emit hash-free `<name>.mjs` bundles. Defaults to true; set false with --no-stable-names. */
  stableNames?: boolean;
  /** Embed an inline sourcemap in compiled bundles. Defaults to true; set false with --no-sourcemap. */
  sourcemap?: boolean;
}

type HookLoaderMap = Record<string, esbuild.Loader>;

/**
 * Metadata extracted from a hook file via TypeScript AST analysis.
 */
interface HookMetadata {
  /** The hook event type (PreToolUse, SessionStart, etc.). */
  hookEventName: HookEventName;
  /** Optional matcher pattern from hook config. */
  matcher?: string;
  /** Optional timeout in milliseconds from hook config. */
  timeout?: number;
}

/**
 * A compiled hook with its metadata and output path.
 */
interface CompiledHook {
  /** Original source file path. */
  sourcePath: string;
  /** Compiled output file path. */
  outputPath: string;
  /** Output filename (e.g., "my-hook.abc123de.mjs"). */
  outputFilename: string;
  /** Extracted hook metadata. */
  metadata: HookMetadata;
}

/**
 * Individual hook configuration within a matcher group.
 */
interface HookConfig {
  /** Hook type - always "command" for compiled hooks. */
  type: "command";
  /** Absolute path to compiled hook executable. */
  command: string;
  /** Optional timeout in seconds. */
  timeout?: number;
}

/**
 * Matcher group entry within an event type.
 */
interface MatcherEntry {
  /** Matcher pattern (tool name, regex, etc.). Optional for some event types. */
  matcher?: string;
  /** Array of hook configurations in this matcher group. */
  hooks: HookConfig[];
}

/**
 * The complete hooks.json structure expected by Claude Code.
 *
 * Format: { hooks: { EventType: [ { matcher?, hooks: [...] } ] } }
 */
interface HooksJson {
  /** Object keyed by event type (PreToolUse, SessionStart, etc.). */
  hooks: Partial<Record<HookEventName, MatcherEntry[]>>;
  /** Generated file tracking metadata. */
  __generated: {
    /** Array of generated filenames. */
    files: string[];
    /** ISO timestamp of generation. */
    timestamp: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const VERSION = "1.0.2";
const DEFAULT_ESBUILD_LOADERS: HookLoaderMap = {
  ".md": "text",
};
const VALID_ESBUILD_LOADERS: readonly esbuild.Loader[] = [
  "base64",
  "binary",
  "copy",
  "css",
  "dataurl",
  "empty",
  "file",
  "js",
  "json",
  "jsx",
  "local-css",
  "text",
  "ts",
  "tsx",
];

const HELP_TEXT = `
@goodfoot/agent-hooks - Type-safe, compiled hooks for Claude Code, Codex, and Antigravity

Description:
  This tool acts as a build system for agent hooks. It scans your TypeScript files for
  exported hook factories (e.g., preToolUseHook), compiles them into standalone ESM modules,
  and generates a hooks.json manifest that you can reference in your Claude Code configuration.

Usage:
  npx -y @goodfoot/agent-hooks --agent <agent> -i <glob> -o <path> [options]
  npx -y @goodfoot/agent-hooks --agent <agent> --scaffold <dir> --hooks <types> -o <path>

  Codex-specific options (with --agent codex):
  --plugin-root             Force plugin mode: emit \${PLUGIN_ROOT}-relative commands and
                            stable, hash-free filenames. Auto-enabled when a .codex-plugin/
                            marker is found by walking up from the output path. Outputs
                            under a .codex/ directory use git-toplevel-relative commands.

Required Arguments:
  --agent <claude-code|codex|antigravity|opencode>
      The agent runtime the hooks are built for. Determines the hook surface
      validated at build time and the runtime module linked into each compiled
      bundle. There is no default: omitting this flag is an error.
      With --agent opencode, -o/--output is treated as a plugin artifact
      directory (no hooks.json manifest is generated).
      Example: --agent claude-code

Build Mode (compile existing hooks):
  -i, --input <glob>
      Glob pattern to find your hook source files.
      Example: "hooks/**/*.ts" (Quotes are recommended to prevent shell expansion)

  -o, --output <path>
      Path where the hooks.json manifest should be generated.
      Compiled hook files (.mjs) will be placed in the same directory as this file.
      Example: "dist/hooks.json"

Scaffold Mode (create new hook project):
  --scaffold <directory>
      Create a new hook project at the specified directory path.
      The directory must not already exist.
      Example: --scaffold ./my-hooks

  --hooks <types>
      Comma-separated list of hook types to generate in the scaffolded project.
      Valid types: PreToolUse, PostToolUse, PostToolUseFailure, Notification,
                   UserPromptSubmit, SessionStart, SessionEnd, Stop,
                   SubagentStart, SubagentStop, PreCompact, PermissionRequest
      Example: --hooks Stop,SubagentStop,PreToolUse

  -o, --output <path>
      In scaffold mode, configures where the generated build script will output hooks.json.
      This path is relative to the scaffolded project directory.
      Example: -o dist/hooks.json

Optional Arguments:
  --log <path>
      Hardcode a log file path into the compiled bundle.
      All context.logger calls within your hooks will write to this file.
      A runtime AGENT_HOOKS_LOG_FILE env var overrides this hardcoded path.
      Cannot be combined with --log-env-var.
      Example: "/tmp/claude-hooks.log"

  --log-env-var <var>
      Name of the environment variable that will supply the log file path at runtime.
      The Logger reads process.env[VAR_NAME] at startup instead of a hardcoded path.
      Use this when the log path must be determined dynamically (e.g. across worktrees).
      Cannot be combined with --log.
      Example: --log-env-var MY_PLUGIN_LOG_FILE

  --executable <path>
      Node executable path to use in generated commands (default: "node").
      Use this to specify a custom node path in the generated hooks.json commands.
      Example: "/usr/local/bin/node" or "node22"

  --loader <ext=type>
      Register an esbuild loader for non-code imports used by hooks.
      Repeat the flag to enable additional extensions.
      Example: --loader .txt=text --loader .svg=dataurl
      Default loaders: .md=text

  --stable-names (default)
      Emit hash-free compiled bundles (<name>.mjs). Keeps generated hooks.json
      byte-stable across rebuilds so Claude Code's hook trust hash stays valid
      and users do not have to re-trust hooks after every update. Stale hashed
      leftovers are pruned automatically.

  --no-stable-names
      Restore the pre-1.7 behavior: hashed compiled bundles (<name>.<hash>.mjs).

  --sourcemap (default)
      Embed an inline sourcemap in each compiled bundle so stack traces show
      original TypeScript source locations.

  --no-sourcemap
      Emit bundles without the inline sourcemap, shrinking compiled output by
      roughly 85-90%. The content hash is unaffected.

  -h, --help
      Show this help message.

  -v, --version
      Show the current version of the CLI.

Examples:
  1. Basic Compilation:
     npx -y @goodfoot/agent-hooks --agent claude-code -i "hooks/**/*.ts" -o "dist/hooks.json"

  2. With Hardcoded Log Path:
     npx -y @goodfoot/agent-hooks --agent claude-code -i "src/hooks/*.ts" -o "bin/hooks.json" --log /tmp/claude-hooks.log

  2b. With Dynamic Log Path (env var set at runtime):
     npx -y @goodfoot/agent-hooks --agent claude-code -i "src/hooks/*.ts" -o "bin/hooks.json" --log-env-var AGENT_HOOKS_LOG_FILE

  3. Scaffold a New Hook Project:
     npx -y @goodfoot/agent-hooks --agent claude-code --scaffold ./my-hooks --hooks Stop,SubagentStop -o dist/hooks.json

  4. With Custom Node Executable:
     npx -y @goodfoot/agent-hooks --agent claude-code -i "hooks/**/*.ts" -o "dist/hooks.json" --executable /usr/local/bin/node

  4b. With Text Assets:
     npx -y @goodfoot/agent-hooks --agent claude-code -i "hooks/**/*.ts" -o "dist/hooks.json" --loader .txt=text

  5. Build Codex hooks (plugin mode via .codex-plugin marker or --plugin-root):
     npx -y @goodfoot/agent-hooks --agent codex -i "src/**/*.ts" -o ".codex/hooks.json"
     npx -y @goodfoot/agent-hooks --agent codex -i "src/**/*.ts" -o "my-plugin/hooks/hooks.json" --plugin-root

  6. Configure Claude to use the hooks:
     After building, add this to your ~/.claude/config.json:
     {
       "hooks": "/absolute/path/to/your/project/dist/hooks.json"
     }

Troubleshooting:
  - Always pass --agent; there is no default agent.
  - Ensure your hook files use 'export default'.
  - Use absolute paths in your glob patterns if relative paths aren't finding files.
  - Check the log file specified by --log (or the env var named by --log-env-var) if hooks don't seem to run.
`;

// ============================================================================
// Logging
// ============================================================================

let logFile: fs.WriteStream | undefined;

/**
 * Initializes the log file if a path is provided.
 * @param logPath - Optional path to log file
 * @internal
 */
function _initLog(logPath?: string): void {
  if (logPath !== undefined) {
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    logFile = fs.createWriteStream(logPath, { flags: "a" });
  }
}

/**
 * Closes the log file if open.
 */
function closeLog(): void {
  if (logFile !== undefined) {
    logFile.close();
    logFile = undefined;
  }
}

/**
 * Logs a message to the log file (if configured).
 * Does NOT write to stdout/stderr to avoid interfering with hook protocol.
 * @param level - Log level
 * @param message - Log message
 * @param data - Optional additional data
 */
function log(level: "info" | "warn" | "error" | "debug", message: string, data?: unknown): void {
  if (logFile !== undefined) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data !== undefined ? { data } : {}),
    };
    logFile.write(`${JSON.stringify(entry)}\n`);
  }
}

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * Parses command-line arguments.
 * @param argv - Process argv (usually process.argv.slice(2))
 * @returns Parsed arguments
 */
function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    agent: "",
    input: "",
    output: "",
    help: false,
    version: false,
    loaderFlags: [],
    pluginRoot: false,
    // Undefined unless explicitly passed: the Claude Code branch treats it
    // as true, while the Codex branch defaults by command context
    // (plugin mode → stable, otherwise hashed).
    stableNames: undefined,
    sourcemap: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--agent":
        args.agent = argv[++i] ?? "";
        break;
      case "-i":
      case "--input":
        args.input = argv[++i] ?? "";
        break;
      case "-o":
      case "--output":
        args.output = argv[++i] ?? "";
        break;
      case "--log":
        args.log = argv[++i];
        break;
      case "--log-env-var":
        args.logEnvVar = argv[++i];
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-v":
      case "--version":
        args.version = true;
        break;
      case "--scaffold":
        args.scaffold = argv[++i] ?? "";
        break;
      case "--hooks":
        args.hooks = argv[++i] ?? "";
        break;
      case "--executable":
        args.executable = argv[++i] ?? "";
        break;
      case "--loader":
        args.loaderFlags.push(argv[++i] ?? "");
        break;
      case "--plugin-root":
        args.pluginRoot = true;
        break;
      case "--stable-names":
        args.stableNames = true;
        break;
      case "--no-stable-names":
        args.stableNames = false;
        break;
      case "--sourcemap":
        args.sourcemap = true;
        break;
      case "--no-sourcemap":
        args.sourcemap = false;
        break;
      default:
        // Unknown argument - ignore
        break;
    }
  }

  return args;
}

/**
 * Validates CLI arguments and returns error message if invalid.
 * @param args - Parsed CLI arguments
 * @returns Error message if invalid, undefined if valid
 */
function validateArgs(args: CliArgs): string | undefined {
  if (args.help || args.version) {
    return undefined;
  }

  // --agent is required and never inferred (plan step 2.3). Validate the
  // value against the agents this release knows, so a typo fails closed
  // instead of silently building for the wrong runtime.
  const VALID_AGENTS = ["claude-code", "codex", "antigravity", "opencode"] as const;
  type ValidAgent = (typeof VALID_AGENTS)[number];
  const isKnownAgent = (value: string): value is ValidAgent => (VALID_AGENTS as readonly string[]).includes(value);

  if (!isKnownAgent(args.agent)) {
    return args.agent === ""
      ? "Missing required argument: --agent <claude-code|codex|antigravity|opencode>"
      : `Invalid --agent value: ${args.agent}. Valid agents: ${VALID_AGENTS.join(", ")}`;
  }

  // Scaffold mode validation
  if (args.scaffold !== undefined && args.scaffold !== "") {
    if (args.hooks === undefined || args.hooks === "") {
      return "Scaffold mode requires --hooks argument (comma-separated hook types)";
    }
    if (args.output === "") {
      return "Scaffold mode requires -o/--output argument (path for generated hooks.json)";
    }
    // In scaffold mode, --input is not required
    return undefined;
  }

  // Normal build mode validation
  if (args.log !== undefined && args.logEnvVar !== undefined) {
    return "Cannot use --log and --log-env-var together: choose one method to configure log output";
  }

  if (args.input === "") {
    return "Missing required argument: -i/--input <glob>";
  }

  if (args.output === "") {
    return "Missing required argument: -o/--output <path>";
  }

  for (const loaderFlag of args.loaderFlags ?? []) {
    const parsedLoader = parseLoaderFlag(loaderFlag);
    if (parsedLoader === undefined) {
      return `Invalid --loader value: ${loaderFlag}. Expected .ext=type`;
    }

    if (!VALID_ESBUILD_LOADERS.includes(parsedLoader.loader)) {
      return `Invalid esbuild loader type for ${parsedLoader.extension}: ${parsedLoader.loader}`;
    }
  }

  return undefined;
}

function parseLoaderFlag(spec: string): { extension: string; loader: esbuild.Loader } | undefined {
  const separatorIndex = spec.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === spec.length - 1) {
    return undefined;
  }

  const extension = spec.slice(0, separatorIndex);
  const loader = spec.slice(separatorIndex + 1);

  if (!extension.startsWith(".") || extension.length < 2) {
    return undefined;
  }

  return { extension, loader: loader as esbuild.Loader };
}

function buildLoaderMap(loaderFlags: string[] = []): HookLoaderMap {
  const loaders: HookLoaderMap = { ...DEFAULT_ESBUILD_LOADERS };

  for (const loaderFlag of loaderFlags) {
    const parsedLoader = parseLoaderFlag(loaderFlag);
    if (parsedLoader !== undefined) {
      loaders[parsedLoader.extension] = parsedLoader.loader;
    }
  }

  return loaders;
}

// ============================================================================
// TypeScript AST Analysis
// ============================================================================

/**
 * Extracts hook metadata from a TypeScript source file using AST analysis.
 *
 * Looks for default exports that call hook factory functions (preToolUseHook, etc.)
 * and extracts the hook type, matcher, and timeout from the config object.
 * @param sourcePath - Absolute path to the TypeScript source file
 * @returns Extracted hook metadata or undefined if not a valid hook file
 * @example
 * ```typescript
 * // For a file containing:
 * // export default preToolUseHook({ matcher: 'Bash', timeout: 5000 }, handler);
 *
 * const metadata = analyzeHookFile('/path/to/hook.ts');
 * // { hookEventName: 'PreToolUse', matcher: 'Bash', timeout: 5000 }
 * ```
 */
function analyzeHookFile(sourcePath: string): HookMetadata | undefined {
  const sourceCode = fs.readFileSync(sourcePath, "utf-8");
  const sourceFile = ts.createSourceFile(sourcePath, sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  let metadata: HookMetadata | undefined;

  /**
   * Recursively visits AST nodes to find hook factory calls.
   * @param node - The AST node to visit
   */
  function visit(node: ts.Node): void {
    // Look for export default or export = assignment
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      // export default <expression>
      const expression = node.expression;
      const result = extractHookMetadataFromExpression(expression);
      if (result !== undefined) {
        metadata = result;
      }
    }

    // Also check for: export default preToolUseHook(...)
    // which might be wrapped in other expressions
    ts.forEachChild(node, visit);
  }

  /**
   * Extracts metadata from a call expression to a hook factory.
   * @param expression - The expression node to analyze
   * @returns Hook metadata if found, undefined otherwise
   */
  function extractHookMetadataFromExpression(expression: ts.Expression): HookMetadata | undefined {
    // Handle direct call: preToolUseHook({ ... }, handler)
    if (ts.isCallExpression(expression)) {
      return extractFromCallExpression(expression);
    }

    // Handle await: await preToolUseHook(...)
    if (ts.isAwaitExpression(expression)) {
      return extractHookMetadataFromExpression(expression.expression);
    }

    // Handle parenthesized: (preToolUseHook(...))
    if (ts.isParenthesizedExpression(expression)) {
      return extractHookMetadataFromExpression(expression.expression);
    }

    return undefined;
  }

  /**
   * Extracts metadata from a CallExpression node.
   * @param callExpr - The call expression to extract metadata from
   * @returns Hook metadata if the call is to a hook factory, undefined otherwise
   */
  function extractFromCallExpression(callExpr: ts.CallExpression): HookMetadata | undefined {
    // Get the function being called
    const callee = callExpr.expression;
    let factoryName: string | undefined;

    if (ts.isIdentifier(callee)) {
      factoryName = callee.text;
    } else if (ts.isPropertyAccessExpression(callee)) {
      // Could be namespace.preToolUseHook
      factoryName = callee.name.text;
    }

    if (factoryName === undefined) {
      return undefined;
    }

    // Check if it's a known hook factory
    const hookEventName = HOOK_FACTORY_TO_EVENT[factoryName];
    if (hookEventName === undefined) {
      return undefined;
    }

    // Extract config from first argument
    const configArg = callExpr.arguments[0];
    let matcher: string | undefined;
    let timeout: number | undefined;

    if (configArg !== undefined && ts.isObjectLiteralExpression(configArg)) {
      for (const prop of configArg.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;

        const propName = ts.isIdentifier(prop.name) ? prop.name.text : undefined;
        if (propName === undefined) continue;

        if (propName === "matcher") {
          // Extract string value
          if (ts.isStringLiteral(prop.initializer)) {
            matcher = prop.initializer.text;
          } else if (ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
            matcher = prop.initializer.text;
          }
        } else if (propName === "timeout") {
          // Extract number value
          if (ts.isNumericLiteral(prop.initializer)) {
            timeout = Number(prop.initializer.text);
          }
        }
      }
    }

    return { hookEventName, matcher, timeout };
  }

  visit(sourceFile);
  return metadata;
}

// ============================================================================
// Hook File Discovery
// ============================================================================

/**
 * Discovers hook files matching the glob pattern.
 * @param pattern - Glob pattern for hook files
 * @param cwd - Current working directory for relative patterns
 * @returns Array of absolute paths to hook files
 */
async function discoverHookFiles(pattern: string, cwd: string): Promise<string[]> {
  // `glob` treats backslashes as escape characters and requires POSIX
  // separators even on Windows. Callers routinely build patterns with
  // `path.join` (native separators), so normalize before matching. This is
  // a no-op on POSIX where paths already use forward slashes.
  const globPattern = pattern.replace(/\\/g, "/");
  const files = await glob(globPattern, {
    cwd,
    absolute: true,
    nodir: true,
  });

  return files.filter((file) => file.endsWith(".ts") || file.endsWith(".mts"));
}

// ============================================================================
// esbuild Compilation
// ============================================================================

/**
 * Options for compiling a hook.
 */
interface CompileHookOptions {
  /** Absolute path to source file. */
  sourcePath: string;
  /** Directory for compiled output. */
  outputDir: string;
  /** Optional log file path to hardcode into the bundle via the banner. */
  logFilePath?: string;
  /** Optional env var name the Logger should read for the log file path at runtime. */
  logEnvVar?: string;
  /** Explicit esbuild loaders for non-code imports. */
  loaders: HookLoaderMap;
  /** Embed an inline sourcemap in the compiled content. Defaults to true; set false with --no-sourcemap. */
  sourcemap?: boolean;
}

/**
 * Result of compiling a hook.
 */
interface CompileHookResult {
  /** Compiled content, with inline sourcemaps unless disabled. */
  content: string;
  /** Stable content hash generated from sourcemap-free output. */
  contentHash: string;
}

/**
 * Re-roots a realpath through the node_modules symlink chain visible from
 * `resolveDir`, so relative paths computed against it do not depend on how
 * deeply the checkout is nested below a shared install.
 *
 * Walks `resolveDir`'s ancestors for a `node_modules` directory whose
 * realpath contains `realPath` (e.g. a checkout-level symlink to a shared
 * install) and returns `realPath` as seen through that directory. Also
 * recognizes the package directory itself being symlinked into that
 * `node_modules` — whether the package lives in a store (pnpm-style store
 * link, npx cache, external install) or in the checkout's own source tree
 * (`packages/` with a `node_modules` entry symlinked back into it) — and
 * re-roots through the symlink form, so esbuild records one module identity
 * regardless of install topology. Falls back to the realpath when no such
 * node_modules exists — with no symlink involved, the realpath is already
 * checkout-local.
 */
function symlinkVisiblePath(realPath: string, resolveDir: string): string {
  // Position of the runtime relative to its own nearest node_modules
  // ancestor, used below to recognize the same package reached through a
  // symlink in a node_modules on the resolveDir walk.
  let pkgRelPath: string | undefined;
  for (let dir = path.dirname(realPath); ; ) {
    if (path.basename(dir) === "node_modules") {
      pkgRelPath = path.relative(dir, realPath);
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  // The runtime's package entry name (`[scope/]name`) from its own nearest
  // package.json, and the runtime's position within that package's tree,
  // used below to recognize the same package reached through its usual
  // node_modules entry when the package directory itself is not under any
  // node_modules — the checkout's own source tree.
  let pkgEntry: string | undefined;
  let pkgRel: string | undefined;
  for (let dir = path.dirname(realPath); ; ) {
    const pkgJsonPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as { name?: unknown };
        if (typeof manifest.name === "string" && /^(@[^/]+\/)?[^/]+$/.test(manifest.name)) {
          pkgEntry = manifest.name;
          pkgRel = path.relative(dir, realPath);
        }
      } catch {
        // Not a readable package.json — the realpath is not under a package.
      }
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  // The runtime's real on-disk path: the `.js` specifier maps to the `.ts`
  // source when the CLI runs from its TypeScript sources (tsx); the `.js`
  // form is the compiled artifact in an installed package. Identity checks
  // below must compare real files, so resolve the form that exists.
  const realPathOnDisk = fs.existsSync(realPath) ? realPath : realPath.replace(/\.js$/, ".ts");

  for (let dir = resolveDir; ; ) {
    const nodeModules = path.join(dir, "node_modules");
    if (fs.existsSync(nodeModules)) {
      const resolved = fs.realpathSync(nodeModules);
      if (realPath.startsWith(resolved + path.sep)) {
        return path.join(nodeModules, path.relative(resolved, realPath));
      }
      if (pkgEntry !== undefined && pkgRel !== undefined) {
        // The package directory itself is symlinked into this node_modules
        // under its own name (pnpm-style store link, npx cache, external
        // install, or the checkout's own source tree): reach the runtime
        // through the same symlink form so esbuild records one module
        // identity regardless of install topology. The identity check is
        // file-level (realpath equality), so it also covers the package's
        // own tree reaching the shared install through nested symlinks
        // (e.g. a `dist/` directory linked into the store).
        const visible = path.join(nodeModules, pkgEntry, pkgRel);
        const visibleOnDisk = fs.existsSync(visible) ? visible : visible.replace(/\.js$/, ".ts");
        if (fs.existsSync(visibleOnDisk) && fs.realpathSync(visibleOnDisk) === realPathOnDisk) {
          return visible;
        }
      }
      if (pkgRelPath !== undefined) {
        // A store link under a different entry name than the package's own:
        // the runtime's position within its nearest node_modules matches a
        // symlink in this one. Reach the runtime through the same symlink
        // form so esbuild records one module identity regardless of install
        // topology.
        const visible = path.join(nodeModules, pkgRelPath);
        const visibleOnDisk = fs.existsSync(visible) ? visible : visible.replace(/\.js$/, ".ts");
        if (fs.existsSync(visibleOnDisk) && fs.realpathSync(visibleOnDisk) === realPathOnDisk) {
          return visible;
        }
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return realPath;
    }
    dir = parent;
  }
}

/**
 * Compiles a TypeScript hook file to a self-contained ESM executable.
 *
 * Uses esbuild's stdin option to avoid writing temporary wrapper files to disk.
 * This produces stable, reproducible builds by:
 * - Using a distinct sourcefile name to avoid import resolution conflicts
 * - Eliminating environment-specific temp paths from source comments
 *
 * Uses a two-step process to generate stable content hashes:
 * 1. Compile WITHOUT sourcemaps → generate stable content hash
 * 2. Compile WITH sourcemaps → final output content
 *
 * @param options - Compilation options
 * @returns Compiled content and stable content hash
 */
async function compileHook(options: CompileHookOptions): Promise<CompileHookResult> {
  const { sourcePath, logFilePath, logEnvVar, loaders, sourcemap } = options;

  // Get the path to the runtime module (absolute, then converted to relative).
  // Use fileURLToPath, not `new URL(...).pathname`: on Windows the latter
  // yields `/C:/...` (leading slash before the drive letter), which corrupts
  // path.resolve/path.relative and emits a broken `../../../C:/...` import.
  //
  // import.meta.url is the CLI module's realpath (Node dereferences symlinks
  // by default), which sits outside the checkout when node_modules is a
  // symlink to a shared install. Re-root it through the checkout's own
  // node_modules symlink so the import specifier below — and everything
  // esbuild records about it — is identical across checkouts regardless of
  // nesting depth.
  const resolveDir = path.dirname(sourcePath);
  const runtimePathAbsolute = symlinkVisiblePath(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./agents/claude-code/transport.js"),
    resolveDir,
  );

  // Compute relative paths from resolveDir to avoid absolute paths in source maps.
  // This ensures reproducible builds regardless of checkout directory.
  const relativeSourcePath = `./${path.basename(sourcePath)}`;
  let relativeRuntimePath = path.relative(resolveDir, runtimePathAbsolute);
  // Ensure the specifier reads as a relative path: when the runtime is
  // reached through the checkout's own node_modules, path.relative yields
  // "node_modules/..." with no leading "../", which esbuild would otherwise
  // interpret as a package path.
  if (!relativeRuntimePath.startsWith(".")) {
    relativeRuntimePath = `./${relativeRuntimePath}`;
  }

  // Create wrapper content that imports the hook and calls execute
  // Uses relative paths to produce reproducible builds
  const wrapperContent = `import hook from '${relativeSourcePath.replace(/\\/g, "/")}';
import { execute } from '${relativeRuntimePath.replace(/\\/g, "/")}';

execute(hook);
`;

  // Use stdin instead of a temp file - sourcefile becomes the stable reference
  // The sourcefile name must be distinct from the actual source file to avoid
  // esbuild resolving the import to the stdin content instead of the real file
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const stdinOptions: esbuild.StdinOptions = {
    contents: wrapperContent,
    resolveDir,
    sourcefile: `${baseName}-entry.ts`,
    loader: "ts",
  };

  // Banner to polyfill CJS globals for dependencies bundled into ESM.
  // Some packages (e.g. typescript) use require(), __filename, and __dirname
  // internally, which are unavailable in ESM scope.
  //
  // Log configuration is also embedded here (before all bundled code) so the
  // Logger singleton reads it at construction time.
  //
  // --log PATH:         sets AGENT_HOOKS_LOG_FILE if not already present
  //                     (runtime env var wins over the hardcoded path)
  // --log-env-var NAME: unconditionally sets AGENT_HOOKS_LOG_ENV_VAR
  //                     (the var name is fixed at build time, no runtime override)
  const logFileLines =
    logFilePath !== undefined
      ? [
          `if (!process.env['AGENT_HOOKS_LOG_FILE']) {`,
          `  process.env['AGENT_HOOKS_LOG_FILE'] = ${JSON.stringify(logFilePath)};`,
          `}`,
        ]
      : [];
  const logEnvVarLines =
    logEnvVar !== undefined ? [`process.env['AGENT_HOOKS_LOG_ENV_VAR'] = ${JSON.stringify(logEnvVar)};`] : [];
  const esmRequireBanner = [
    `import { createRequire as __createRequire } from "node:module";`,
    `import { fileURLToPath as __fileURLToPath } from "node:url";`,
    `import { dirname as __pathDirname } from "node:path";`,
    `const require = __createRequire(import.meta.url);`,
    `const __filename = __fileURLToPath(import.meta.url);`,
    `const __dirname = __pathDirname(__filename);`,
    ...logFileLines,
    ...logEnvVarLines,
  ].join("\n");

  // Common esbuild options
  const commonOptions: esbuild.BuildOptions = {
    stdin: stdinOptions,
    loader: loaders,
    format: "esm",
    platform: "node",
    target: "node20",
    bundle: true,
    minify: false,
    treeShaking: true,
    write: false, // Return content directly via outputFiles
    banner: { js: esmRequireBanner },
    // Preserve symlink identity so module-boundary comments and sourcemaps
    // are computed relative to the checkout-local symlink path rather than
    // the dereferenced realpath, which varies by checkout nesting depth.
    preserveSymlinks: true,
    // Keep node built-ins external
    external: [
      "node:*",
      "http",
      "https",
      "url",
      "stream",
      "zlib",
      "events",
      "buffer",
      "util",
      "path",
      "fs",
      "os",
      "crypto",
      "child_process",
      "perf_hooks",
      "async_hooks",
      "diagnostics_channel",
    ],
    // Ensure we get clean ESM output
    mainFields: ["module", "main"],
    conditions: ["import", "node"],
  };

  // Step 1: Compile WITHOUT sourcemaps to generate stable content hash
  const resultNoSourcemap = await esbuild.build({
    ...commonOptions,
    sourcemap: false,
  });
  const contentForHash = resultNoSourcemap.outputFiles?.[0]?.text;
  if (contentForHash === undefined) {
    throw new Error(`esbuild produced no output for ${sourcePath}`);
  }
  const contentHash = generateContentHash(contentForHash);

  // Step 2: Compile WITH sourcemaps for final output. With --no-sourcemap
  // this pass is skipped entirely: pass-1 output is byte-identical to pass-2
  // output minus the trailing sourceMappingURL comment (verified on esbuild
  // 0.24.2), so the sourcemap-free content is emitted directly. The content
  // hash is always derived from pass-1 output, so it is unchanged by the flag.
  if (sourcemap === false) {
    return { content: contentForHash, contentHash };
  }

  const resultWithSourcemap = await esbuild.build({
    ...commonOptions,
    sourcemap: "inline",
  });
  const content = resultWithSourcemap.outputFiles?.[0]?.text;
  if (content === undefined) {
    throw new Error(`esbuild produced no output for ${sourcePath}`);
  }

  return { content, contentHash };
}

/**
 * Generates a content hash (SHA-256, 8-char prefix) for a compiled hook.
 * @param content - Compiled hook content
 * @returns 8-character hex hash
 */
function generateContentHash(content: string): string {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  return hash.substring(0, 8);
}

/**
 * Options for compiling all hooks.
 */
interface CompileAllHooksOptions {
  /** Array of source file paths. */
  hookFiles: string[];
  /** Directory for compiled output. */
  outputDir: string;
  /** Optional log file path to hardcode into the bundle via the banner. */
  logFilePath?: string;
  /** Optional env var name the Logger should read for the log file path at runtime. */
  logEnvVar?: string;
  /** Explicit esbuild loaders for non-code imports. */
  loaders: HookLoaderMap;
  /** Emit hash-free `<name>.mjs` bundles (default true). */
  stableNames?: boolean;
  /** Embed inline sourcemaps in compiled bundles (default true). */
  sourcemap?: boolean;
}

/**
 * Compiles all discovered hooks and returns their metadata.
 * @param options - Compilation options
 * @returns Array of compiled hook information
 */
async function compileAllHooks(options: CompileAllHooksOptions): Promise<CompiledHook[]> {
  const { hookFiles, outputDir, logFilePath, logEnvVar, loaders } = options;
  const stableNames = options.stableNames !== false;
  const compiledHooks: CompiledHook[] = [];
  const writtenFilenames = new Set<string>();

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const sourcePath of hookFiles) {
    log("info", `Analyzing hook file: ${sourcePath}`);

    // Extract metadata from source
    const metadata = analyzeHookFile(sourcePath);
    if (metadata === undefined) {
      log("warn", `Skipping ${sourcePath}: not a valid hook file (no hook factory found)`);
      continue;
    }

    log("info", `Found hook: ${metadata.hookEventName}`, {
      matcher: metadata.matcher,
      timeout: metadata.timeout,
    });

    // Compile the hook (two-step process for stable content hash)
    log("info", `Compiling: ${sourcePath}`);
    const { content, contentHash } = await compileHook({
      sourcePath,
      outputDir,
      logFilePath,
      logEnvVar,
      loaders,
      sourcemap: options.sourcemap,
    });

    // Determine output filename. Stable names (the default) keep generated
    // hooks.json byte-stable across rebuilds so Claude Code's hook trust hash
    // stays valid; --no-stable-names restores the legacy hashed form.
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const outputFilename = stableNames ? `${baseName}.mjs` : `${baseName}.${contentHash}.mjs`;
    const outputPath = path.join(outputDir, outputFilename);

    // Write compiled output with shebang for direct execution
    // --enable-source-maps enables stack traces with original source locations
    const shebang = "#!/usr/bin/env -S node --enable-source-maps\n";
    fs.writeFileSync(outputPath, shebang + content, { encoding: "utf-8", mode: 0o755 });
    log("info", `Wrote: ${outputPath}`);
    writtenFilenames.add(outputFilename);

    compiledHooks.push({
      sourcePath,
      outputPath,
      outputFilename,
      metadata,
    });
  }

  if (stableNames) {
    pruneStaleHashedBundles(outputDir, writtenFilenames);
  }
  return compiledHooks;
}

/**
 * Removes hashed `<name>.<hash>.mjs` siblings of the stable bundles we just
 * wrote, so re-running the build with --stable-names cleans up leftovers from
 * previous --no-stable-names (or pre-1.7) runs.
 */
function pruneStaleHashedBundles(outputDir: string, keepFilenames: Set<string>): void {
  if (!fs.existsSync(outputDir)) {
    return;
  }
  const hashedBundlePattern = /^(.+)\.[0-9a-f]{8}\.mjs$/;
  for (const entry of fs.readdirSync(outputDir)) {
    if (keepFilenames.has(entry)) {
      continue;
    }
    const match = entry.match(hashedBundlePattern);
    if (match === null) {
      continue;
    }
    const stableEquivalent = `${match[1]}.mjs`;
    if (keepFilenames.has(stableEquivalent)) {
      fs.rmSync(path.join(outputDir, entry), { force: true });
    }
  }
}

// ============================================================================
// hooks.json Generation
// ============================================================================

/**
 * Groups compiled hooks by event type, then by matcher pattern.
 * @param compiledHooks - Array of compiled hooks
 * @returns Nested map: EventType -> Matcher -> Hooks
 */
function groupHooksByEventAndMatcher(
  compiledHooks: CompiledHook[],
): Map<HookEventName, Map<string | undefined, CompiledHook[]>> {
  const groups = new Map<HookEventName, Map<string | undefined, CompiledHook[]>>();

  for (const hook of compiledHooks) {
    const eventName = hook.metadata.hookEventName;
    const matcher = hook.metadata.matcher;

    let eventGroup = groups.get(eventName);
    if (eventGroup === undefined) {
      eventGroup = new Map<string | undefined, CompiledHook[]>();
      groups.set(eventName, eventGroup);
    }

    const existing = eventGroup.get(matcher);
    if (existing !== undefined) {
      existing.push(hook);
    } else {
      eventGroup.set(matcher, [hook]);
    }
  }

  return groups;
}

/**
 * Result of detecting the hook context, including the root directory.
 */
interface HookContextInfo {
  /** Hook context type. */
  context: HookContext;
  /** Absolute path to the root directory (plugin root or project root). */
  rootDir: string;
}

/**
 * Auto-detects the hook context and root directory based on directory structure.
 *
 * Detection logic:
 * - If output path contains `.claude/` directory segment → agent context, root is parent of .claude/
 * - If `.claude-plugin/` directory exists within 3 levels up → plugin context, root is that directory
 * - Default: plugin context with hooks.json parent directory as root
 * @param outputPath - Absolute path to the hooks.json output file
 * @returns Detected hook context and root directory
 */
function detectHookContext(outputPath: string): HookContextInfo {
  // Normalize path separators for cross-platform compatibility
  const normalizedPath = outputPath.replace(/\\/g, "/");

  // Plugin marker takes precedence: if a .claude-plugin/ directory exists by
  // walking up from the output, this is a plugin build regardless of whether
  // the output path happens to also contain a .claude/ segment.
  let currentDir = path.dirname(outputPath);
  const root = path.parse(currentDir).root;
  const maxLevels = 4;
  let level = 0;

  while (currentDir !== root && level < maxLevels) {
    const pluginDir = path.join(currentDir, ".claude-plugin");
    if (fs.existsSync(pluginDir) && fs.statSync(pluginDir).isDirectory()) {
      return {
        context: "plugin",
        rootDir: currentDir,
      };
    }
    currentDir = path.dirname(currentDir);
    level++;
  }

  // Check if the output path is within a .claude/ directory (agent hooks)
  // This matches paths like: /project/.claude/hooks/hooks.json
  const claudeMatch = normalizedPath.match(/^(.+)\/\.claude\//);
  if (claudeMatch !== null) {
    // Slice the original (native-separator) path to preserve OS-appropriate
    // separators in the returned rootDir. The match group length equals the
    // length of the root prefix in the normalized path, which has the same
    // length as the original since normalization is a 1:1 character swap.
    return {
      context: "agent",
      rootDir: outputPath.slice(0, claudeMatch[1].length),
    };
  }

  // Default to plugin context with output directory as root
  return {
    context: "plugin",
    rootDir: path.dirname(outputPath),
  };
}

/**
 * Generates a command path based on the hook context.
 *
 * Calculates the relative path from the root directory to the bin directory.
 * Prepends the node executable.
 *
 * - `plugin`: Uses `node "$CLAUDE_PLUGIN_ROOT"/hooks/bin/filename`
 * - `agent`: Uses `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/bin/filename`
 * @param filename - The compiled hook filename
 * @param buildDir - Absolute path to the bin directory
 * @param contextInfo - Hook context info including root directory
 * @param executable - Node executable path (default: "node")
 * @returns The command path string
 */
function generateCommandPath(
  filename: string,
  buildDir: string,
  contextInfo: HookContextInfo,
  executable: string = "node",
): string {
  // Calculate relative path from root to bin directory
  const relativeBuildPath = path.relative(contextInfo.rootDir, buildDir);
  // Normalize to forward slashes for cross-platform compatibility
  const normalizedRelativePath = relativeBuildPath.replace(/\\/g, "/");

  if (contextInfo.context === "agent") {
    // Agent hooks use $CLAUDE_PROJECT_DIR with shell-style quoting
    return `${executable} "$CLAUDE_PROJECT_DIR"/${normalizedRelativePath}/${filename}`;
  }
  // Plugin hooks use $CLAUDE_PLUGIN_ROOT
  return `${executable} "$CLAUDE_PLUGIN_ROOT"/${normalizedRelativePath}/${filename}`;
}

/**
 * Generates the hooks.json content in Claude Code's expected format.
 *
 * Format: { hooks: { EventType: [ { matcher?, hooks: [...] } ] } }
 * @param compiledHooks - Array of compiled hooks
 * @param buildDir - Absolute path to the bin directory
 * @param contextInfo - Hook context info for path resolution
 * @param executable - Node executable path (default: "node")
 * @returns The hooks.json structure
 */
function generateHooksJson(
  compiledHooks: CompiledHook[],
  buildDir: string,
  contextInfo: HookContextInfo,
  executable: string = "node",
): HooksJson {
  const groups = groupHooksByEventAndMatcher(compiledHooks);
  const hooks: Partial<Record<HookEventName, MatcherEntry[]>> = {};

  for (const [eventName, matcherGroups] of groups) {
    const entries: MatcherEntry[] = [];

    for (const [matcher, hookList] of matcherGroups) {
      const entry: MatcherEntry = {
        hooks: hookList.map((hook) => ({
          type: "command" as const,
          command: generateCommandPath(hook.outputFilename, buildDir, contextInfo, executable),
          ...(hook.metadata.timeout !== undefined ? { timeout: hook.metadata.timeout } : {}),
        })),
      };

      // Only include matcher if defined
      if (matcher !== undefined) {
        entry.matcher = matcher;
      }

      entries.push(entry);
    }

    hooks[eventName] = entries;
  }

  return {
    hooks,
    __generated: {
      files: compiledHooks.map((h) => h.outputFilename),
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Reads an existing hooks.json file if it exists.
 * @param outputPath - Path to the hooks.json file
 * @returns Parsed HooksJson or undefined if file doesn't exist
 */
function readExistingHooksJson(outputPath: string): HooksJson | undefined {
  if (!fs.existsSync(outputPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(outputPath, "utf-8");
    return JSON.parse(content) as HooksJson;
  } catch (error) {
    log("warn", "Failed to parse existing hooks.json, will overwrite", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Removes previously generated hook files from disk.
 * Only removes files that were tracked in __generated.files.
 * @param existingHooksJson - The existing hooks.json content
 * @param outputDir - Directory containing the generated files
 */
function removeOldGeneratedFiles(existingHooksJson: HooksJson, outputDir: string): void {
  const filesToRemove = existingHooksJson.__generated?.files ?? [];

  for (const filename of filesToRemove) {
    const filePath = path.join(outputDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        log("info", `Removed old generated file: ${filename}`);
      } catch (error) {
        log("warn", `Failed to remove old generated file: ${filename}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

/**
 * Extracts hooks from an existing hooks.json that were NOT generated by this package.
 * Identifies generated hooks by checking if their command path matches the generated file pattern.
 * @param existingHooksJson - The existing hooks.json content
 * @returns Object containing preserved hooks (keyed by event type)
 */
function extractPreservedHooks(existingHooksJson: HooksJson): Partial<Record<HookEventName, MatcherEntry[]>> {
  const generatedFiles = new Set(existingHooksJson.__generated?.files ?? []);
  const preserved: Partial<Record<HookEventName, MatcherEntry[]>> = {};

  for (const [eventType, entries] of Object.entries(existingHooksJson.hooks)) {
    if (!entries) continue;
    const preservedEntries: MatcherEntry[] = [];

    for (const entry of entries) {
      // Filter out hooks whose command matches a generated file
      const preservedHooks = entry.hooks.filter((hook) => {
        // Extract filename from the command path
        // Command format: ${CLAUDE_PLUGIN_ROOT:-./}/filename.hash.mjs
        const match = hook.command.match(/\/([^/]+)$/);
        const filename = match ? match[1] : "";
        return !generatedFiles.has(filename);
      });

      if (preservedHooks.length > 0) {
        preservedEntries.push({
          ...entry,
          hooks: preservedHooks,
        });
      }
    }

    if (preservedEntries.length > 0) {
      preserved[eventType as HookEventName] = preservedEntries;
    }
  }

  return preserved;
}

/**
 * Merges preserved hooks with newly generated hooks.
 * Preserved hooks are added first, then new hooks are appended.
 * @param newHooksJson - The newly generated hooks.json content
 * @param preservedHooks - Hooks to preserve from the existing hooks.json
 * @returns Merged HooksJson
 */
function mergeHooksJson(
  newHooksJson: HooksJson,
  preservedHooks: Partial<Record<HookEventName, MatcherEntry[]>>,
): HooksJson {
  const mergedHooks: Partial<Record<HookEventName, MatcherEntry[]>> = {};

  // Get all event types from both sources
  const allEventTypes = new Set([
    ...Object.keys(preservedHooks),
    ...Object.keys(newHooksJson.hooks),
  ]) as Set<HookEventName>;

  for (const eventType of allEventTypes) {
    const preserved = preservedHooks[eventType] ?? [];
    const generated = newHooksJson.hooks[eventType] ?? [];

    // Combine preserved and generated entries
    mergedHooks[eventType] = [...preserved, ...generated];
  }

  return {
    hooks: mergedHooks,
    __generated: newHooksJson.__generated,
  };
}

/**
 * Writes hooks.json to the specified path atomically.
 * Uses write-to-temp-then-rename pattern for atomicity.
 * @param hooksJson - The hooks.json content
 * @param outputPath - Path to write hooks.json
 */
function writeHooksJson(hooksJson: HooksJson, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write to a temporary file first, then rename for atomicity
  const tempPath = `${outputPath}.tmp.${process.pid}`;
  const content = `${JSON.stringify(hooksJson, null, 2)}\n`;

  try {
    fs.writeFileSync(tempPath, content, "utf-8");
    fs.renameSync(tempPath, outputPath);
  } catch (error) {
    // Clean up temp file if rename failed
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        log("warn", "Failed to clean up temp file", { path: tempPath, error: cleanupError });
      }
    }
    throw error;
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const args = parseArgs(rawArgs);

  // Handle help. A bare invocation is NOT a help request anymore: with
  // --agent required there is no default behavior to fall back to, so empty
  // argv falls through to validateArgs and fails closed.
  if (args.help) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  // Handle version
  if (args.version) {
    process.stdout.write(`agent-hooks v${VERSION}\n`);
    process.exit(0);
  }

  // Validate arguments
  const validationError = validateArgs(args);
  if (validationError !== undefined) {
    process.stderr.write(`Error: ${validationError}\n\n`);
    process.stdout.write(HELP_TEXT);
    process.exit(1);
  }

  // Codex parity (plan step 3): its own AST analysis (statusMessage-aware),
  // command-context detection (.codex-plugin marker / .codex local mode),
  // plugin-mode stable-names default, and hooks.json shape.
  if (args.agent === "codex") {
    const { runCodexCli } = await import("./agents/codex/cli-support.js");
    try {
      await runCodexCli({
        input: args.input,
        output: args.output,
        executable: args.executable,
        loaderFlags: args.loaderFlags,
        pluginRoot: args.pluginRoot === true,
        stableNames: args.stableNames,
        sourcemap: args.sourcemap,
        scaffold: args.scaffold,
        hooks: args.hooks,
      });
      process.stdout.write(`Generated ${path.resolve(process.cwd(), args.output)}\n`);
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("error", "Codex build failed", { error: message });
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    } finally {
      closeLog();
    }
  }

  if (args.agent === "opencode") {
    const { runOpenCodeCli, validateOpenCodeArgs } = await import("./agents/opencode/cli-support.js");
    const openCodeValidationError = validateOpenCodeArgs({
      input: args.input,
      output: args.output,
      loaderFlags: args.loaderFlags ?? [],
      sourcemap: args.sourcemap,
    });
    if (openCodeValidationError !== undefined) {
      process.stderr.write(`Error: ${openCodeValidationError}\n\n`);
      process.stdout.write(HELP_TEXT);
      process.exit(1);
    }
    try {
      const compiled = await runOpenCodeCli({
        input: args.input,
        output: args.output,
        loaderFlags: args.loaderFlags ?? [],
        sourcemap: args.sourcemap,
      });
      process.stdout.write(
        `Generated ${compiled.length} plugin artifact(s) in ${path.resolve(process.cwd(), args.output)}\n`,
      );
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("error", "OpenCode build failed", { error: message });
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    } finally {
      closeLog();
    }
  }

  // Antigravity ships in step 5; fail closed until then.
  if (args.agent !== "claude-code") {
    process.stderr.write(
      `Error: --agent ${args.agent} is not implemented in this release; only "claude-code", "codex", and "opencode" build today (antigravity ships in step 5).\n`,
    );
    process.exit(1);
  }

  // Handle scaffold mode
  if (args.scaffold !== undefined && args.scaffold !== "") {
    const hookNames = (args.hooks ?? "").split(",").filter((h) => h.length > 0);
    scaffoldProject({
      directory: args.scaffold,
      hooks: hookNames,
      outputPath: args.output,
    });
    process.exit(0);
  }

  try {
    const cwd = process.cwd();
    const outputPath = path.resolve(cwd, args.output);
    const hooksJsonDir = path.dirname(outputPath);
    // Compiled hooks go in a 'bin' subdirectory relative to hooks.json
    const buildDir = path.join(hooksJsonDir, "bin");

    // Resolve log file path: --log flag takes priority, then AGENT_HOOKS_LOG_FILE env var
    const logFileRaw = args.log ?? process.env.AGENT_HOOKS_LOG_FILE;
    const logFilePath = logFileRaw !== undefined ? path.resolve(cwd, logFileRaw) : undefined;

    // --log-env-var names the env var the Logger should read at runtime
    const logEnvVar = args.logEnvVar;
    const loaders = buildLoaderMap(args.loaderFlags);

    log("info", "Starting hook compilation", {
      input: args.input,
      output: args.output,
      logFilePath,
      logEnvVar,
      loaders,
      cwd,
    });

    // Discover hook files
    const hookFiles = await discoverHookFiles(args.input, cwd);
    log("info", `Discovered ${hookFiles.length} hook files`, { files: hookFiles });

    if (hookFiles.length === 0) {
      process.stderr.write(`Error: No hook files found matching pattern: ${args.input}\n`);
      process.exit(1);
    }

    // Read existing hooks.json to preserve non-generated hooks
    const existingHooksJson = readExistingHooksJson(outputPath);
    let preservedHooks: Partial<Record<HookEventName, MatcherEntry[]>> = {};

    if (existingHooksJson !== undefined) {
      log("info", "Found existing hooks.json, will preserve non-generated hooks");

      // Extract hooks that were NOT generated by this package
      preservedHooks = extractPreservedHooks(existingHooksJson);

      // Remove old generated files from disk
      removeOldGeneratedFiles(existingHooksJson, buildDir);

      const preservedCount = Object.values(preservedHooks).reduce(
        (sum, entries) => sum + (entries?.reduce((s, e) => s + e.hooks.length, 0) ?? 0),
        0,
      );
      log("info", `Preserved ${preservedCount} hooks from other sources`);
    }

    // Compile all hooks
    const compiledHooks = await compileAllHooks({
      hookFiles,
      outputDir: buildDir,
      logFilePath,
      logEnvVar,
      loaders,
      stableNames: args.stableNames,
      sourcemap: args.sourcemap,
    });

    if (compiledHooks.length === 0 && hookFiles.length > 0) {
      process.stderr.write("Error: No valid hooks found in discovered files.\n");
      process.exit(1);
    }

    // Auto-detect hook context based on output path
    const hookContext = detectHookContext(outputPath);
    log("info", `Detected hook context: ${hookContext.context}`, { rootDir: hookContext.rootDir });

    // Generate hooks.json for newly compiled hooks
    const executable = args.executable !== undefined && args.executable !== "" ? args.executable : "node";
    const newHooksJson = generateHooksJson(compiledHooks, buildDir, hookContext, executable);

    // Preserve timestamp if generated files haven't changed
    if (existingHooksJson !== undefined) {
      const existingFiles = [...(existingHooksJson.__generated?.files ?? [])].sort();
      const newFiles = [...newHooksJson.__generated.files].sort();
      const filesUnchanged =
        existingFiles.length === newFiles.length && existingFiles.every((f, i) => f === newFiles[i]);

      if (filesUnchanged && existingHooksJson.__generated?.timestamp) {
        newHooksJson.__generated.timestamp = existingHooksJson.__generated.timestamp;
        log("info", "Files unchanged, preserving existing timestamp");
      }
    }

    // Merge with preserved hooks
    const finalHooksJson = mergeHooksJson(newHooksJson, preservedHooks);
    writeHooksJson(finalHooksJson, outputPath);

    log("info", "Compilation complete", {
      hooksCompiled: compiledHooks.length,
      outputPath,
    });

    // Output summary to stdout
    process.stdout.write(`Compiled ${compiledHooks.length} hooks to ${buildDir}\n`);
    if (Object.keys(preservedHooks).length > 0) {
      const preservedCount = Object.values(preservedHooks).reduce(
        (sum, entries) => sum + (entries?.reduce((s, e) => s + e.hooks.length, 0) ?? 0),
        0,
      );
      process.stdout.write(`Preserved ${preservedCount} hooks from other sources\n`);
    }
    process.stdout.write(`Generated ${outputPath}\n`);

    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", "Build failed", { error: message });
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  } finally {
    closeLog();
  }
}

// Run main only when executed directly (not when imported for testing)
// Check if this file is the entry point by checking if import.meta.url matches process.argv[1]
// Resolves symlinks to handle npm bin symlinks correctly
const isDirectExecution = (() => {
  try {
    const scriptPath = process.argv[1];
    if (!scriptPath) return false;
    // Resolve symlinks to get the real path (npm creates symlinks in node_modules/.bin)
    const realScriptPath = fs.realpathSync(scriptPath);
    const scriptUrl = new URL(`file://${realScriptPath}`);
    return import.meta.url === scriptUrl.href;
  } catch {
    return false;
  }
})();

if (isDirectExecution) {
  main().catch((error) => {
    process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}

export type { CliArgs, CompiledHook, HookConfig, HookLoaderMap, HookMetadata, HooksJson, MatcherEntry };
// Export for testing
// Shared build primitives reused by the per-agent CLI branches (single
// source for driver logic — the duplication check forbids re-deriving these
// inside agents/*).
export {
  analyzeHookFile,
  buildLoaderMap,
  buildLoaderMap as buildEsbuildLoaderMap,
  compileHook,
  detectHookContext,
  discoverHookFiles,
  discoverHookFiles as discoverHookSourceFiles,
  extractPreservedHooks,
  generateCommandPath,
  generateContentHash,
  generateContentHash as sha256Prefix8,
  generateHooksJson,
  groupHooksByEventAndMatcher,
  HOOK_FACTORY_TO_EVENT,
  mergeHooksJson,
  parseArgs,
  parseLoaderFlag,
  parseLoaderFlag as parseEsbuildLoaderFlag,
  pruneStaleHashedBundles,
  readExistingHooksJson,
  removeOldGeneratedFiles,
  symlinkVisiblePath,
  validateArgs,
};
