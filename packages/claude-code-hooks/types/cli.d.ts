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
 * # With runtime logging (equivalent to CLAUDE_CODE_HOOKS_LOG_FILE)
 * claude-code-hooks -i "hooks/**\/*.ts" -o "./dist/hooks.json" --log /tmp/hooks.log
 * ```
 * @module
 */
import type { HookEventName } from './inputs.js';
import { HOOK_FACTORY_TO_EVENT } from './constants.js';
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
    /** Directory path for scaffolding a new hook project. */
    scaffold?: string;
    /** Comma-separated list of hook types to generate when scaffolding. */
    hooks?: string;
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
 * Options for compiling a hook.
 */
interface CompileHookOptions {
    /** Absolute path to source file. */
    sourcePath: string;
    /** Directory for compiled output. */
    outputDir: string;
    /** Optional log file path to inject into compiled hook. */
    logFilePath?: string;
}
/**
 * Compiles a TypeScript hook file to a self-contained ESM executable.
 *
 * Creates a wrapper that imports the hook and calls execute(), then bundles
 * everything together including the runtime.
 * @param options - Compilation options
 * @returns Compiled output content as a string
 */
declare function compileHook(options: CompileHookOptions): Promise<string>;
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
declare function groupHooksByEventAndMatcher(compiledHooks: CompiledHook[]): Map<HookEventName, Map<string | undefined, CompiledHook[]>>;
/**
 * Generates the hooks.json content in Claude Code's expected format.
 *
 * Format: { hooks: { EventType: [ { matcher?, hooks: [...] } ] } }
 * @param compiledHooks - Array of compiled hooks
 * @returns The hooks.json structure
 */
declare function generateHooksJson(compiledHooks: CompiledHook[]): HooksJson;
/**
 * Reads an existing hooks.json file if it exists.
 * @param outputPath - Path to the hooks.json file
 * @returns Parsed HooksJson or undefined if file doesn't exist
 */
declare function readExistingHooksJson(outputPath: string): HooksJson | undefined;
/**
 * Removes previously generated hook files from disk.
 * Only removes files that were tracked in __generated.files.
 * @param existingHooksJson - The existing hooks.json content
 * @param outputDir - Directory containing the generated files
 */
declare function removeOldGeneratedFiles(existingHooksJson: HooksJson, outputDir: string): void;
/**
 * Extracts hooks from an existing hooks.json that were NOT generated by this package.
 * Identifies generated hooks by checking if their command path matches the generated file pattern.
 * @param existingHooksJson - The existing hooks.json content
 * @returns Object containing preserved hooks (keyed by event type)
 */
declare function extractPreservedHooks(existingHooksJson: HooksJson): Partial<Record<HookEventName, MatcherEntry[]>>;
/**
 * Merges preserved hooks with newly generated hooks.
 * Preserved hooks are added first, then new hooks are appended.
 * @param newHooksJson - The newly generated hooks.json content
 * @param preservedHooks - Hooks to preserve from the existing hooks.json
 * @returns Merged HooksJson
 */
declare function mergeHooksJson(newHooksJson: HooksJson, preservedHooks: Partial<Record<HookEventName, MatcherEntry[]>>): HooksJson;
export { parseArgs, validateArgs, analyzeHookFile, discoverHookFiles, compileHook, generateContentHash, generateHooksJson, groupHooksByEventAndMatcher, readExistingHooksJson, removeOldGeneratedFiles, extractPreservedHooks, mergeHooksJson, HOOK_FACTORY_TO_EVENT };
export type { CliArgs, HookMetadata, CompiledHook, HookConfig, MatcherEntry, HooksJson };
