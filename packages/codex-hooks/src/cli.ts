#!/usr/bin/env node

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { glob } from "glob";
import ts from "typescript";
import { DEFAULT_ESBUILD_LOADERS, EVENTS_WITH_MATCHER, HOOK_FACTORY_TO_EVENT, PACKAGE_NAME } from "./constants.js";
import { scaffoldProject } from "./scaffold.js";
import type { HookEventName } from "./types.js";

interface CliArgs {
  input: string;
  output: string;
  executable?: string;
  help: boolean;
  version: boolean;
  scaffold?: string;
  hooks?: string;
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

export interface HookMetadata {
  hookEventName: HookEventName;
  matcher?: string;
  timeout?: number;
  statusMessage?: string;
}

interface CompiledHook {
  sourcePath: string;
  outputPath: string;
  outputFilename: string;
  metadata: HookMetadata;
}

interface HookConfigEntry {
  type: "command";
  command: string;
  timeout?: number;
  statusMessage?: string;
}

interface MatcherEntry {
  matcher?: string;
  hooks: HookConfigEntry[];
}

interface HooksJson {
  hooks: Partial<Record<HookEventName, MatcherEntry[]>>;
}

type HookLoaderMap = Record<string, esbuild.Loader>;

const VERSION = "0.1.0";
const HELP_TEXT = `
${PACKAGE_NAME}

Usage:
  codex-hooks -i "src/**/*.ts" -o ".codex/hooks.json"
  codex-hooks -i "src/**/*.ts" -o "my-plugin/hooks/hooks.json" --plugin-root
  codex-hooks --scaffold ./my-codex-hooks --hooks SessionStart,PreToolUse -o ./.codex/hooks.json

Options:
  -i, --input <glob>        Input glob for hook source files
  -o, --output <path>       Output hooks.json path
  --executable <path>       Executable prefix for generated commands (default: node)
  --loader <ext=type>       Additional esbuild loader, repeatable
  --plugin-root             Force plugin mode: emit \${PLUGIN_ROOT}-relative commands and
                            stable, hash-free filenames. Auto-enabled when a .codex-plugin/
                            marker is found by walking up from the output path.
  --stable-names            Force hash-free compiled filenames (<name>.mjs). On by default
                            in plugin mode. Use --no-stable-names to opt back into hashes.
  --no-stable-names         Force hashed compiled filenames (<name>.<hash>.mjs).
  --sourcemap               Embed an inline sourcemap in compiled bundles. On by default.
                            Use --no-sourcemap to disable and shrink output size.
  --no-sourcemap            Compile without an inline sourcemap.
  --scaffold <dir>          Create a starter project
  --hooks <types>           Comma-separated scaffold hook names
  -h, --help                Show help
  -v, --version             Show version
`;

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: "",
    output: "",
    help: false,
    version: false,
    loaderFlags: [],
    pluginRoot: false,
    sourcemap: true,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    switch (arg) {
      case "-i":
      case "--input":
        args.input = argv[++index] ?? "";
        break;
      case "-o":
      case "--output":
        args.output = argv[++index] ?? "";
        break;
      case "--executable":
        args.executable = argv[++index] ?? "";
        break;
      case "--loader":
        args.loaderFlags.push(argv[++index] ?? "");
        break;
      case "--scaffold":
        args.scaffold = argv[++index] ?? "";
        break;
      case "--hooks":
        args.hooks = argv[++index] ?? "";
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
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-v":
      case "--version":
        args.version = true;
        break;
      default:
        break;
    }
  }
  return args;
}

function validateArgs(args: CliArgs): string | undefined {
  if (args.help || args.version) {
    return undefined;
  }
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
  return undefined;
}

function parseLoaderFlag(spec: string): { extension: string; loader: esbuild.Loader } | undefined {
  const separatorIndex = spec.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === spec.length - 1) {
    return undefined;
  }
  const extension = spec.slice(0, separatorIndex);
  const loader = spec.slice(separatorIndex + 1) as esbuild.Loader;
  if (!extension.startsWith(".")) {
    return undefined;
  }
  return { extension, loader };
}

function buildLoaderMap(loaderFlags: string[]): HookLoaderMap {
  const loaders: HookLoaderMap = { ...DEFAULT_ESBUILD_LOADERS };
  for (const loaderFlag of loaderFlags) {
    const parsed = parseLoaderFlag(loaderFlag);
    if (parsed !== undefined) {
      loaders[parsed.extension] = parsed.loader;
    }
  }
  return loaders;
}

export function analyzeHookFile(sourcePath: string): HookMetadata | undefined {
  const sourceCode = fs.readFileSync(sourcePath, "utf-8");
  const sourceFile = ts.createSourceFile(sourcePath, sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let metadata: HookMetadata | undefined;

  function extractFromExpression(expression: ts.Expression): HookMetadata | undefined {
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

async function discoverHookFiles(pattern: string, cwd: string): Promise<string[]> {
  const files = await glob(pattern, {
    cwd,
    absolute: true,
    nodir: true,
  });
  return files.filter((file) => file.endsWith(".ts") || file.endsWith(".mts"));
}

function generateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 8);
}

/**
 * Re-roots a realpath through the node_modules symlink chain visible from
 * `resolveDir`, so relative paths computed against it do not depend on how
 * deeply the checkout is nested below a shared install.
 *
 * Walks `resolveDir`'s ancestors for a `node_modules` directory whose
 * realpath contains `realPath` (e.g. a checkout-level symlink to a shared
 * install) and returns `realPath` as seen through that directory. Falls back
 * to the realpath when no such node_modules exists — with no symlink
 * involved, the realpath is already checkout-local.
 */
function symlinkVisiblePath(realPath: string, resolveDir: string): string {
  for (let dir = resolveDir; ; ) {
    const nodeModules = path.join(dir, "node_modules");
    if (fs.existsSync(nodeModules)) {
      const resolved = fs.realpathSync(nodeModules);
      if (realPath.startsWith(resolved + path.sep)) {
        return path.join(nodeModules, path.relative(resolved, realPath));
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return realPath;
    }
    dir = parent;
  }
}

export async function compileHook(
  sourcePath: string,
  loaders: HookLoaderMap,
  sourcemap: boolean = true,
): Promise<{ content: string; contentHash: string }> {
  // import.meta.url is the CLI module's realpath (Node dereferences symlinks
  // by default), which sits outside the checkout when node_modules is a
  // symlink to a shared install. Re-root it through the checkout's own
  // node_modules symlink so the import specifier below — and everything
  // esbuild records about it — is identical across checkouts regardless of
  // nesting depth.
  const resolveDir = path.dirname(sourcePath);
  const runtimePathAbsolute = symlinkVisiblePath(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./runtime.js"),
    resolveDir,
  );
  // Ensure the specifier reads as a relative path: when the runtime is
  // reached through the checkout's own node_modules, path.relative yields
  // "node_modules/..." with no leading "../", which esbuild would otherwise
  // interpret as a package path.
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
    // Preserve symlink identity so module-boundary comments and sourcemaps
    // are computed relative to the checkout-local symlink path rather than
    // the dereferenced realpath, which varies by checkout nesting depth.
    preserveSymlinks: true,
  });
  const content = result.outputFiles?.[0]?.text;
  if (content === undefined) {
    throw new Error(`esbuild produced no output for ${sourcePath}`);
  }
  return { content, contentHash: generateContentHash(content) };
}

async function compileAllHooks(
  hookFiles: string[],
  outputDir: string,
  loaders: HookLoaderMap,
  options: { stableNames: boolean; sourcemap: boolean } = { stableNames: false, sourcemap: true },
): Promise<CompiledHook[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const compiledHooks: CompiledHook[] = [];
  const writtenFilenames = new Set<string>();
  for (const sourcePath of hookFiles) {
    const metadata = analyzeHookFile(sourcePath);
    if (metadata === undefined) {
      continue;
    }
    const { content, contentHash } = await compileHook(sourcePath, loaders, options.sourcemap);
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

export function detectCommandContext(outputPath: string, pluginRootFlag: boolean): CommandContext {
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

function groupHooksByEventAndMatcher(
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

function generateCommandPath(
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

export function generateHooksJson(
  compiledHooks: CompiledHook[],
  outputPath: string,
  executable: string = "node",
  context: CommandContext = detectCommandContext(outputPath, false),
): HooksJson {
  const grouped = groupHooksByEventAndMatcher(compiledHooks);
  const hooks: HooksJson["hooks"] = {};
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
        command: generateCommandPath(outputPath, entry.outputPath, executable, context),
        ...(timeoutMsToSeconds(entry.metadata.timeout) !== undefined
          ? { timeout: timeoutMsToSeconds(entry.metadata.timeout) }
          : {}),
        ...(entry.metadata.statusMessage !== undefined ? { statusMessage: entry.metadata.statusMessage } : {}),
      })),
    }));
  }
  return { hooks };
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const validationError = validateArgs(args);

  if (args.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }
  if (args.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (validationError !== undefined) {
    process.stderr.write(`${validationError}\n`);
    process.exitCode = 1;
    return;
  }

  if (args.scaffold !== undefined && args.scaffold !== "") {
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
  const hookFiles = await discoverHookFiles(args.input, cwd);
  const absoluteOutputPath = path.resolve(cwd, args.output);
  const outputDir = path.dirname(absoluteOutputPath);
  const context = detectCommandContext(absoluteOutputPath, args.pluginRoot);
  const stableNames = args.stableNames ?? context.mode === "plugin";
  const sourcemap = args.sourcemap ?? true;
  const compiledHooks = await compileAllHooks(hookFiles, outputDir, buildLoaderMap(args.loaderFlags), {
    stableNames,
    sourcemap,
  });
  const hooksJson = generateHooksJson(compiledHooks, absoluteOutputPath, args.executable ?? "node", context);
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(hooksJson, null, 2)}\n`);
}

const cliEntryPath = fileURLToPath(import.meta.url);
const isDirectExecution =
  process.argv[1] !== undefined &&
  fs.existsSync(process.argv[1]) &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(cliEntryPath);
if (isDirectExecution) {
  void main();
}
