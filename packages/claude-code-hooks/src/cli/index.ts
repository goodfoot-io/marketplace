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
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as esbuild from 'esbuild';
import { glob } from 'glob';
import ts from 'typescript';

// ============================================================================
// Types
// ============================================================================

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
 * Entry in the hooks.json "hooks" array.
 */
interface HooksJsonEntry {
  /** Matcher pattern for this hook group. */
  matcher?: string;
  /** Array of hook configurations. */
  hooks: Array<{
    /** Hook event type. */
    type: HookEventName;
    /** Absolute path to compiled hook. */
    command: string;
    /** Optional timeout. */
    timeout?: number;
  }>;
}

/**
 * The complete hooks.json structure.
 */
interface HooksJson {
  /** Array of hook group entries. */
  hooks: HooksJsonEntry[];
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

const VERSION = '0.0.1';

const HELP_TEXT = `
claude-code-hooks - Compile TypeScript hooks for Claude Code

Usage:
  claude-code-hooks -i <glob> -o <path> [options]

Options:
  -i, --input <glob>    Glob pattern for hook source files (required)
  -o, --output <path>   Path for hooks.json output (required)
  --log <path>          Optional log file path for build output
  -h, --help            Show this help message
  -v, --version         Show version

Examples:
  # Compile all hooks in hooks/ directory
  claude-code-hooks -i "hooks/**/*.ts" -o "./dist/hooks.json"

  # With logging
  claude-code-hooks -i "src/hooks/*.ts" -o "./hooks.json" --log ./build.log

Output:
  - Compiled hooks: {outDir}/{hookName}.{hash}.mjs
  - hooks.json with matcher configurations and absolute command paths
`;

/**
 * Maps hook factory function names to their event names.
 */
const HOOK_FACTORY_TO_EVENT: Record<string, HookEventName> = {
  preToolUseHook: 'PreToolUse',
  postToolUseHook: 'PostToolUse',
  postToolUseFailureHook: 'PostToolUseFailure',
  notificationHook: 'Notification',
  userPromptSubmitHook: 'UserPromptSubmit',
  sessionStartHook: 'SessionStart',
  sessionEndHook: 'SessionEnd',
  stopHook: 'Stop',
  subagentStartHook: 'SubagentStart',
  subagentStopHook: 'SubagentStop',
  preCompactHook: 'PreCompact',
  permissionRequestHook: 'PermissionRequest'
};

// ============================================================================
// Logging
// ============================================================================

let logFile: fs.WriteStream | undefined;

/**
 * Initializes the log file if a path is provided.
 * @param logPath - Optional path to log file
 */
function initLog(logPath?: string): void {
  if (logPath !== undefined) {
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    logFile = fs.createWriteStream(logPath, { flags: 'a' });
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
function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown): void {
  if (logFile !== undefined) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data !== undefined ? { data } : {})
    };
    logFile.write(JSON.stringify(entry) + '\n');
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
    input: '',
    output: '',
    help: false,
    version: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '-i':
      case '--input':
        args.input = argv[++i] ?? '';
        break;
      case '-o':
      case '--output':
        args.output = argv[++i] ?? '';
        break;
      case '--log':
        args.log = argv[++i];
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
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

  if (args.input === '') {
    return 'Missing required argument: -i/--input <glob>';
  }

  if (args.output === '') {
    return 'Missing required argument: -o/--output <path>';
  }

  return undefined;
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
  const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
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

        if (propName === 'matcher') {
          // Extract string value
          if (ts.isStringLiteral(prop.initializer)) {
            matcher = prop.initializer.text;
          } else if (ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
            matcher = prop.initializer.text;
          }
        } else if (propName === 'timeout') {
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
  const files = await glob(pattern, {
    cwd,
    absolute: true,
    nodir: true
  });

  return files.filter((file) => file.endsWith('.ts') || file.endsWith('.mts'));
}

// ============================================================================
// esbuild Compilation
// ============================================================================

/**
 * Compiles a TypeScript hook file to ESM using esbuild.
 * @param sourcePath - Absolute path to source file
 * @param outputDir - Directory for compiled output
 * @returns Compiled output content as a string
 */
async function compileHook(sourcePath: string, outputDir: string): Promise<string> {
  // First, compile to a temporary location to get the content
  const tempOutput = path.join(outputDir, `_temp_${Date.now()}.mjs`);

  try {
    await esbuild.build({
      entryPoints: [sourcePath],
      outfile: tempOutput,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      external: ['*'], // Don't bundle any dependencies
      bundle: true, // But resolve imports to mark them external
      sourcemap: false,
      minify: false,
      // Ensure we get clean ESM output
      mainFields: ['module', 'main'],
      conditions: ['import', 'node']
    });

    // Read the compiled content
    const content = fs.readFileSync(tempOutput, 'utf-8');

    // Clean up temp file
    fs.unlinkSync(tempOutput);

    return content;
  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempOutput)) {
      fs.unlinkSync(tempOutput);
    }
    throw error;
  }
}

/**
 * Generates a content hash (SHA-256, 8-char prefix) for a compiled hook.
 * @param content - Compiled hook content
 * @returns 8-character hex hash
 */
function generateContentHash(content: string): string {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return hash.substring(0, 8);
}

/**
 * Compiles all discovered hooks and returns their metadata.
 * @param hookFiles - Array of source file paths
 * @param outputDir - Directory for compiled output
 * @returns Array of compiled hook information
 */
async function compileAllHooks(hookFiles: string[], outputDir: string): Promise<CompiledHook[]> {
  const compiledHooks: CompiledHook[] = [];

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const sourcePath of hookFiles) {
    log('info', `Analyzing hook file: ${sourcePath}`);

    // Extract metadata from source
    const metadata = analyzeHookFile(sourcePath);
    if (metadata === undefined) {
      log('warn', `Skipping ${sourcePath}: not a valid hook file (no hook factory found)`);
      continue;
    }

    log('info', `Found hook: ${metadata.hookEventName}`, {
      matcher: metadata.matcher,
      timeout: metadata.timeout
    });

    // Compile the hook
    log('info', `Compiling: ${sourcePath}`);
    const compiledContent = await compileHook(sourcePath, outputDir);

    // Generate content hash
    const hash = generateContentHash(compiledContent);

    // Determine output filename
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const outputFilename = `${baseName}.${hash}.mjs`;
    const outputPath = path.join(outputDir, outputFilename);

    // Write compiled output
    fs.writeFileSync(outputPath, compiledContent, 'utf-8');
    log('info', `Wrote: ${outputPath}`);

    compiledHooks.push({
      sourcePath,
      outputPath,
      outputFilename,
      metadata
    });
  }

  return compiledHooks;
}

// ============================================================================
// hooks.json Generation
// ============================================================================

/**
 * Groups compiled hooks by their matcher pattern for hooks.json.
 * @param compiledHooks - Array of compiled hooks
 * @returns Map of matcher pattern to hooks
 */
function groupHooksByMatcher(compiledHooks: CompiledHook[]): Map<string | undefined, CompiledHook[]> {
  const groups = new Map<string | undefined, CompiledHook[]>();

  for (const hook of compiledHooks) {
    const matcher = hook.metadata.matcher;
    const existing = groups.get(matcher);
    if (existing !== undefined) {
      existing.push(hook);
    } else {
      groups.set(matcher, [hook]);
    }
  }

  return groups;
}

/**
 * Generates the hooks.json content.
 * @param compiledHooks - Array of compiled hooks
 * @returns The hooks.json structure
 */
function generateHooksJson(compiledHooks: CompiledHook[]): HooksJson {
  const groups = groupHooksByMatcher(compiledHooks);
  const entries: HooksJsonEntry[] = [];

  for (const [matcher, hooks] of groups) {
    const entry: HooksJsonEntry = {
      hooks: hooks.map((hook) => ({
        type: hook.metadata.hookEventName,
        command: hook.outputPath, // Absolute path
        ...(hook.metadata.timeout !== undefined ? { timeout: hook.metadata.timeout } : {})
      }))
    };

    // Only include matcher if defined
    if (matcher !== undefined) {
      entry.matcher = matcher;
    }

    entries.push(entry);
  }

  return {
    hooks: entries,
    __generated: {
      files: compiledHooks.map((h) => h.outputFilename),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Writes hooks.json to the specified path.
 * @param hooksJson - The hooks.json content
 * @param outputPath - Path to write hooks.json
 */
function writeHooksJson(hooksJson: HooksJson, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(hooksJson, null, 2) + '\n', 'utf-8');
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Handle help
  if (args.help) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  // Handle version
  if (args.version) {
    process.stdout.write(`claude-code-hooks v${VERSION}\n`);
    process.exit(0);
  }

  // Validate arguments
  const validationError = validateArgs(args);
  if (validationError !== undefined) {
    process.stderr.write(`Error: ${validationError}\n`);
    process.stderr.write('Run with --help for usage information.\n');
    process.exit(1);
  }

  // Initialize logging
  initLog(args.log);

  try {
    const cwd = process.cwd();
    const outputPath = path.resolve(cwd, args.output);
    const outputDir = path.dirname(outputPath);

    log('info', 'Starting hook compilation', {
      input: args.input,
      output: args.output,
      cwd
    });

    // Discover hook files
    const hookFiles = await discoverHookFiles(args.input, cwd);
    log('info', `Discovered ${hookFiles.length} hook files`, { files: hookFiles });

    if (hookFiles.length === 0) {
      process.stderr.write(`No hook files found matching pattern: ${args.input}\n`);
      process.exit(1);
    }

    // Compile all hooks
    const compiledHooks = await compileAllHooks(hookFiles, outputDir);

    if (compiledHooks.length === 0) {
      process.stderr.write('No valid hooks found in discovered files.\n');
      process.exit(1);
    }

    // Generate hooks.json
    const hooksJson = generateHooksJson(compiledHooks);
    writeHooksJson(hooksJson, outputPath);

    log('info', 'Compilation complete', {
      hooksCompiled: compiledHooks.length,
      outputPath
    });

    // Output summary to stdout
    process.stdout.write(`Compiled ${compiledHooks.length} hooks to ${outputDir}\n`);
    process.stdout.write(`Generated ${outputPath}\n`);

    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('error', 'Build failed', { error: message });
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  } finally {
    closeLog();
  }
}

// Run main only when executed directly (not when imported for testing)
// Check if this file is the entry point by checking if import.meta.url matches process.argv[1]
const isDirectExecution = (() => {
  try {
    const scriptPath = process.argv[1];
    if (!scriptPath) return false;
    const scriptUrl = new URL(`file://${scriptPath}`);
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

// Export for testing
export {
  parseArgs,
  validateArgs,
  analyzeHookFile,
  discoverHookFiles,
  compileHook,
  generateContentHash,
  generateHooksJson,
  groupHooksByMatcher,
  HOOK_FACTORY_TO_EVENT
};
export type { CliArgs, HookMetadata, CompiledHook, HooksJsonEntry, HooksJson };
