#!/usr/bin/env node
/**
 * CLI tool for compiling Claude Code hooks using esbuild.
 *
 * Compiles TypeScript hooks to standalone ESM modules and generates hooks.json
 * with correct command paths and matcher configurations.
 * @example
 * ```bash
 * # Compile hooks and generate hooks.json
 * claude-code-hooks -i "hooks/**\/*.ts" -o "./dist/hooks.json"
 *
 * # With optional log file
 * claude-code-hooks -i "hooks/**\/*.ts" -o "./dist/hooks.json" --log ./logs/build.log
 * ```
 * @module
 */
import type { HookEventName } from '../types/inputs.js';
/**
 * Command-line arguments parsed from process.argv.
 */
interface CliArgs {
  /** Glob pattern for hook source files. */
  input: string;
  /** Path for hooks.json output file. */
  output: string;
  /** Optional log file path. */
  log?: string;
  /** Show help. */
  help: boolean;
  /** Show version. */
  version: boolean;
}
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
  type: 'command';
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
/**
 * Maps hook factory function names to their event names.
 */
declare const HOOK_FACTORY_TO_EVENT: Record<string, HookEventName>;
/**
 * Parses command-line arguments.
 * @param argv - Process argv (usually process.argv.slice(2))
 * @returns Parsed arguments
 */
declare function parseArgs(argv: string[]): CliArgs;
/**
 * Validates CLI arguments and returns error message if invalid.
 * @param args - Parsed CLI arguments
 * @returns Error message if invalid, undefined if valid
 */
declare function validateArgs(args: CliArgs): string | undefined;
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
declare function analyzeHookFile(sourcePath: string): HookMetadata | undefined;
/**
 * Discovers hook files matching the glob pattern.
 * @param pattern - Glob pattern for hook files
 * @param cwd - Current working directory for relative patterns
 * @returns Array of absolute paths to hook files
 */
declare function discoverHookFiles(pattern: string, cwd: string): Promise<string[]>;
/**
 * Compiles a TypeScript hook file to a self-contained ESM executable.
 *
 * Creates a wrapper that imports the hook and calls execute(), then bundles
 * everything together including the runtime.
 * @param sourcePath - Absolute path to source file
 * @param outputDir - Directory for compiled output
 * @returns Compiled output content as a string
 */
declare function compileHook(sourcePath: string, outputDir: string): Promise<string>;
/**
 * Generates a content hash (SHA-256, 8-char prefix) for a compiled hook.
 * @param content - Compiled hook content
 * @returns 8-character hex hash
 */
declare function generateContentHash(content: string): string;
/**
 * Groups compiled hooks by event type, then by matcher pattern.
 * @param compiledHooks - Array of compiled hooks
 * @returns Nested map: EventType -> Matcher -> Hooks
 */
declare function groupHooksByEventAndMatcher(
  compiledHooks: CompiledHook[]
): Map<HookEventName, Map<string | undefined, CompiledHook[]>>;
/**
 * Generates the hooks.json content in Claude Code's expected format.
 *
 * Format: { hooks: { EventType: [ { matcher?, hooks: [...] } ] } }
 * @param compiledHooks - Array of compiled hooks
 * @returns The hooks.json structure
 */
declare function generateHooksJson(compiledHooks: CompiledHook[]): HooksJson;
export {
  parseArgs,
  validateArgs,
  analyzeHookFile,
  discoverHookFiles,
  compileHook,
  generateContentHash,
  generateHooksJson,
  groupHooksByEventAndMatcher,
  HOOK_FACTORY_TO_EVENT
};
export type { CliArgs, HookMetadata, CompiledHook, HookConfig, MatcherEntry, HooksJson };
//# sourceMappingURL=index.d.ts.map
