/**
 * Codex-specific CLI internals: AST analysis (with `statusMessage`), bundle
 * compilation linking the Codex runtime module, command-context detection
 * (`.codex-plugin` marker / `.codex` local mode / absolute), hooks.json
 * generation with Codex's matcher/timeout-seconds/statusMessage rules, and
 * plugin-mode stable-names default.
 *
 * Driver-level primitives (loader parsing, glob discovery, content hashing,
 * symlink re-rooting, stale-bundle pruning) are imported from the shared CLI
 * module — never re-derived here.
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import ts from "typescript";
import {
  buildEsbuildLoaderMap,
  discoverHookSourceFiles,
  parseEsbuildLoaderFlag,
  pruneStaleHashedBundles,
  sha256Prefix8,
  symlinkVisiblePath,
} from "../../cli.js";
import { EVENTS_WITH_MATCHER, HOOK_FACTORY_TO_EVENT } from "./constants.js";
import type { HookEventName } from "./types.js";

/** Codex CLI arguments accepted on top of the shared `--agent codex` gate. */
export interface CodexCliArgs {
  input: string;
  output: string;
  executable?: string;
  loaderFlags: string[];
  pluginRoot: boolean;
  stableNames?: boolean;
  sourcemap?: boolean;
}

export type CommandMode = "plugin" | "codex-local" | "absolute";

export interface CommandContext {
  mode: CommandMode;
  pluginRoot?: string;
}

export interface CodexHookMetadata {
  hookEventName: HookEventName;
  matcher?: string;
  timeout?: number;
  statusMessage?: string;
}

interface CompiledHook {
  sourcePath: string;
  outputPath: string;
  outputFilename: string;
  metadata: CodexHookMetadata;
}

interface HookConfigEntry {
  type: "command";
  command: string;
  timeout?: number;
  statusMessage?: string;
}

export interface CodexMatcherEntry {
  matcher?: string;
  hooks: HookConfigEntry[];
}

export interface CodexHooksJson {
  hooks: Partial<Record<HookEventName, CodexMatcherEntry[]>>;
}

type HookLoaderMap = Record<string, esbuild.Loader>;

/**
 * Extracts Codex hook metadata (event name, matcher, timeout in
 * milliseconds, status message) from a TypeScript source file's default
 * export of a hook factory call.
 */
export function analyzeCodexHookFile(sourcePath: string): CodexHookMetadata | undefined {
  const sourceCode = fs.readFileSync(sourcePath, "utf-8");
  const sourceFile = ts.createSourceFile(sourcePath, sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let metadata: CodexHookMetadata | undefined;

  function extractFromExpression(expression: ts.Expression): CodexHookMetadata | undefined {
    if (ts.isParenthesizedExpression(expression)) {
      return extractFromExpression(expression.expression);
    }
    if (!ts.isCallExpression(expression)) {
      return undefined;
    }

    let factoryName: string | undefined;
    if (ts.isIdentifier(expression.expression)) {
      factoryName = expression.expression.text;
    } else if (ts.isPropertyAccessExpression(expression.expression)) {
      factoryName = expression.expression.name.text;
    }
    if (factoryName === undefined) {
      return undefined;
    }

    const hookEventName = HOOK_FACTORY_TO_EVENT[factoryName];
    if (hookEventName === undefined) {
      return undefined;
    }

    let matcher: string | undefined;
    let timeout: number | undefined;
    let statusMessage: string | undefined;
    const configArg = expression.arguments[0];
    if (configArg !== undefined && ts.isObjectLiteralExpression(configArg)) {
      for (const property of configArg.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }
        const name = ts.isIdentifier(property.name) ? property.name.text : undefined;
        if (name === undefined) {
          continue;
        }
        if (
          name === "matcher" &&
          (ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer))
        ) {
          matcher = property.initializer.text;
        }
        if (
          name === "statusMessage" &&
          (ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer))
        ) {
          statusMessage = property.initializer.text;
        }
        if (name === "timeout" && ts.isNumericLiteral(property.initializer)) {
          timeout = Number(property.initializer.text);
        }
      }
    }
    return { hookEventName, matcher, timeout, statusMessage };
  }

  function visit(node: ts.Node): void {
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      metadata = extractFromExpression(node.expression);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return metadata;
}

/**
 * Compiles one Codex hook to a self-contained ESM executable whose entry
 * wrapper imports this package's Codex runtime module (`execute`).
 */
export async function compileCodexHook(
  sourcePath: string,
  loaders: HookLoaderMap,
  sourcemap: boolean = true,
): Promise<{ content: string; contentHash: string }> {
  const resolveDir = path.dirname(sourcePath);
  const runtimePathAbsolute = symlinkVisiblePath(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./transport.js"),
    resolveDir,
  );
  let relativeRuntimePath = path.relative(resolveDir, runtimePathAbsolute).replace(/\\/g, "/");
  if (!relativeRuntimePath.startsWith(".")) {
    relativeRuntimePath = `./${relativeRuntimePath}`;
  }
  const relativeSourcePath = `./${path.basename(sourcePath)}`.replace(/\\/g, "/");
  const wrapperContent = `import hook from ${JSON.stringify(relativeSourcePath)};
import { execute } from ${JSON.stringify(relativeRuntimePath)};
execute(hook);
`;
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const result = await esbuild.build({
    stdin: {
      contents: wrapperContent,
      resolveDir,
      sourcefile: `${baseName}-entry.ts`,
      loader: "ts",
    },
    loader: loaders,
    format: "esm",
    platform: "node",
    target: "node20",
    bundle: true,
    sourcemap: sourcemap ? "inline" : false,
    write: false,
    external: ["node:*", "fs", "path", "os", "crypto", "module", "url"],
    mainFields: ["module", "main"],
    conditions: ["import", "node"],
    preserveSymlinks: true,
  });
  const content = result.outputFiles?.[0]?.text;
  if (content === undefined) {
    throw new Error(`esbuild produced no output for ${sourcePath}`);
  }
  return { content, contentHash: sha256Prefix8(content) };
}

async function compileAllCodexHooks(
  hookFiles: string[],
  outputDir: string,
  loaders: HookLoaderMap,
  options: { stableNames: boolean; sourcemap: boolean },
): Promise<CompiledHook[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const compiledHooks: CompiledHook[] = [];
  const writtenFilenames = new Set<string>();
  for (const sourcePath of hookFiles) {
    const metadata = analyzeCodexHookFile(sourcePath);
    if (metadata === undefined) {
      continue;
    }
    const { content, contentHash } = await compileCodexHook(sourcePath, loaders, options.sourcemap);
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const outputFilename = options.stableNames ? `${baseName}.mjs` : `${baseName}.${contentHash}.mjs`;
    const outputPath = path.join(outputDir, outputFilename);
    fs.writeFileSync(outputPath, `#!/usr/bin/env -S node --enable-source-maps\n${content}`, {
      encoding: "utf-8",
      mode: 0o755,
    });
    writtenFilenames.add(outputFilename);
    compiledHooks.push({ sourcePath, outputPath, outputFilename, metadata });
  }
  if (options.stableNames) {
    pruneStaleHashedBundles(outputDir, writtenFilenames);
  }
  return compiledHooks;
}

/**
 * Detects the command context: `.codex-plugin/` marker found by walking up
 * from the output → plugin mode; explicit `--plugin-root` flag → plugin mode
 * anchored at the output's parent; output under a `/.codex` segment →
 * codex-local mode; otherwise absolute.
 */
export function detectCodexCommandContext(outputPath: string, pluginRootFlag: boolean): CommandContext {
  const normalizedOutputPath = outputPath.replace(/\\/g, "/");
  let currentDir = path.dirname(outputPath);
  const filesystemRoot = path.parse(currentDir).root;
  const maxLevels = 4;
  let level = 0;
  while (currentDir !== filesystemRoot && level < maxLevels) {
    const marker = path.join(currentDir, ".codex-plugin");
    if (fs.existsSync(marker) && fs.statSync(marker).isDirectory()) {
      return { mode: "plugin", pluginRoot: currentDir };
    }
    currentDir = path.dirname(currentDir);
    level++;
  }
  if (pluginRootFlag) {
    const hooksDir = path.dirname(outputPath);
    return { mode: "plugin", pluginRoot: path.dirname(hooksDir) };
  }
  if (normalizedOutputPath.indexOf("/.codex") >= 0) {
    return { mode: "codex-local" };
  }
  return { mode: "absolute" };
}

function timeoutMsToSeconds(timeout?: number): number | undefined {
  if (timeout === undefined) {
    return undefined;
  }
  return Math.max(1, Math.ceil(timeout / 1000));
}

function groupCodexHooksByEventAndMatcher(
  compiledHooks: CompiledHook[],
): Map<HookEventName, Map<string | undefined, CompiledHook[]>> {
  const grouped = new Map<HookEventName, Map<string | undefined, CompiledHook[]>>();
  for (const hook of compiledHooks) {
    const eventGroup = grouped.get(hook.metadata.hookEventName) ?? new Map<string | undefined, CompiledHook[]>();
    grouped.set(hook.metadata.hookEventName, eventGroup);
    const matcherKey = EVENTS_WITH_MATCHER.has(hook.metadata.hookEventName) ? hook.metadata.matcher : undefined;
    const matcherGroup = eventGroup.get(matcherKey) ?? [];
    matcherGroup.push(hook);
    eventGroup.set(matcherKey, matcherGroup);
  }
  return grouped;
}

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

function generateCodexCommandPath(
  outputPath: string,
  hookOutputPath: string,
  executable: string,
  context: CommandContext,
): string {
  const normalizedHookPath = hookOutputPath.replace(/\\/g, "/");

  if (context.mode === "plugin" && context.pluginRoot !== undefined) {
    const relativeHookPath = path.relative(context.pluginRoot, hookOutputPath).replace(/\\/g, "/");
    return `${executable} ${shellQuote(`\${PLUGIN_ROOT}/${relativeHookPath}`)}`;
  }

  if (context.mode === "codex-local") {
    const normalizedOutputPath = outputPath.replace(/\\/g, "/");
    const repoMarkerIndex = normalizedOutputPath.indexOf("/.codex");
    if (repoMarkerIndex >= 0) {
      const repoRoot = normalizedOutputPath.slice(0, repoMarkerIndex);
      const relativeHookPath = path.relative(repoRoot, hookOutputPath).replace(/\\/g, "/");
      return `${executable} "$(git rev-parse --show-toplevel)/${relativeHookPath}"`;
    }
  }

  return `${executable} ${shellQuote(normalizedHookPath)}`;
}

/** Generates Codex hooks.json: matchers only where the event supports them, timeouts in seconds, statusMessage when set. */
export function generateCodexHooksJson(
  compiledHooks: CompiledHook[],
  outputPath: string,
  executable: string = "node",
  context: CommandContext = detectCodexCommandContext(outputPath, false),
): CodexHooksJson {
  const grouped = groupCodexHooksByEventAndMatcher(compiledHooks);
  const hooks: CodexHooksJson["hooks"] = {};
  for (const eventName of [
    "PreToolUse",
    "PostToolUse",
    "PermissionRequest",
    "UserPromptSubmit",
    "SessionStart",
    "SubagentStart",
    "Stop",
    "SubagentStop",
    "PreCompact",
    "PostCompact",
  ] as const) {
    const matcherMap = grouped.get(eventName);
    if (matcherMap === undefined) {
      continue;
    }
    hooks[eventName] = Array.from(matcherMap.entries()).map(([matcher, entries]) => ({
      ...(EVENTS_WITH_MATCHER.has(eventName) && matcher !== undefined ? { matcher } : {}),
      hooks: entries.map((entry) => ({
        type: "command" as const,
        command: generateCodexCommandPath(outputPath, entry.outputPath, executable, context),
        ...(timeoutMsToSeconds(entry.metadata.timeout) !== undefined
          ? { timeout: timeoutMsToSeconds(entry.metadata.timeout) }
          : {}),
        ...(entry.metadata.statusMessage !== undefined ? { statusMessage: entry.metadata.statusMessage } : {}),
      })),
    }));
  }
  return { hooks };
}

/**
 * Validates Codex build/scaffold arguments beyond the shared `--agent` gate:
 * `-i` and `-o` required for build mode; scaffold requires `--hooks` and
 * `-o`.
 */
export function validateCodexArgs(args: CodexCliArgs & { scaffold?: string; hooks?: string }): string | undefined {
  if (args.scaffold !== undefined && args.scaffold !== "") {
    if (args.output === "") {
      return "Scaffold mode requires -o/--output";
    }
    if (args.hooks === undefined || args.hooks === "") {
      return "Scaffold mode requires --hooks";
    }
    return undefined;
  }
  if (args.input === "") {
    return "Missing required argument: -i/--input";
  }
  if (args.output === "") {
    return "Missing required argument: -o/--output";
  }
  for (const loaderFlag of args.loaderFlags) {
    if (parseEsbuildLoaderFlag(loaderFlag) === undefined) {
      return `Invalid --loader value: ${loaderFlag}. Expected .ext=type`;
    }
  }
  return undefined;
}

/**
 * Runs the Codex build/scaffold branch of the unified CLI. Plugin mode
 * defaults to hash-free stable filenames; every other mode defaults to
 * hashed names unless `--stable-names` is passed explicitly (source
 * parity).
 */
export async function runCodexCli(args: {
  input: string;
  output: string;
  executable?: string;
  loaderFlags: string[];
  pluginRoot: boolean;
  stableNames?: boolean;
  sourcemap?: boolean;
  scaffold?: string;
  hooks?: string;
}): Promise<void> {
  if (args.scaffold !== undefined && args.scaffold !== "") {
    const { scaffoldProject } = await import("./scaffold.js");
    scaffoldProject({
      directory: path.resolve(process.cwd(), args.scaffold),
      hooks: (args.hooks ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      outputPath: args.output,
    });
    return;
  }

  const cwd = process.cwd();
  const hookFiles = await discoverHookSourceFiles(args.input, cwd);
  const absoluteOutputPath = path.resolve(cwd, args.output);
  const outputDir = path.dirname(absoluteOutputPath);
  const context = detectCodexCommandContext(absoluteOutputPath, args.pluginRoot);
  const stableNames = args.stableNames ?? context.mode === "plugin";
  const sourcemap = args.sourcemap ?? true;
  const loaders = buildEsbuildLoaderMap(args.loaderFlags);
  const compiledHooks = await compileAllCodexHooks(hookFiles, outputDir, loaders, {
    stableNames,
    sourcemap,
  });
  const hooksJson = generateCodexHooksJson(compiledHooks, absoluteOutputPath, args.executable ?? "node", context);
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(hooksJson, null, 2)}\n`);
}
