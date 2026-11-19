/** Cursor source analysis, flat versioned manifests, and source-aware command paths. */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type * as esbuild from "esbuild";
import ts from "typescript";
import { buildEsbuildLoaderMap, discoverHookSourceFiles, pruneStaleHashedBundles } from "../../cli.js";
import { compileHookBundle } from "../../cli-bundle.js";
import { defaultFailClosed, validateHookConfig } from "./config.js";
import { HOOK_EVENT_NAMES } from "./events.js";
import type { HookConfig } from "./hooks.js";
import type { HookEventName } from "./types.js";

export interface CursorCliArgs {
  input: string;
  output: string;
  loaderFlags: string[];
  executable?: string;
  pluginRoot?: boolean;
  stableNames?: boolean;
  sourcemap?: boolean;
  scaffold?: string;
  hooks?: string;
}
export interface CursorHookMetadata extends HookConfig {
  hookEventName: HookEventName;
}
export interface CursorScript {
  command: string;
  matcher?: string;
  /** Seconds on the wire, milliseconds in factories. */
  timeout?: number;
  failClosed?: boolean;
  loop_limit?: number | null;
}
export interface CursorHooksJson {
  version: 1;
  hooks: Partial<Record<HookEventName, CursorScript[]>>;
}
export interface CursorCommandContext {
  mode: "plugin" | "project" | "user" | "absolute";
  root?: string;
}
interface CompiledCursorHook {
  outputPath: string;
  metadata: CursorHookMetadata;
}

const FACTORIES = new Map(HOOK_EVENT_NAMES.map((event) => [`${event}Hook`, event]));

function unwrap(node: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
    ? unwrap(node.expression)
    : node;
}

/** Build-time configuration must be literal: never silently discard a computed safety option. */
export function analyzeCursorHookFile(filename: string): CursorHookMetadata | undefined {
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
  const imports = new Map<string, string>();
  const namespaces = new Set<string>();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text.replace(/\\/g, "/");
    if (!/(?:^|\/)cursor(?:\/index\.[cm]?[jt]s)?$/.test(specifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements)
        imports.set(binding.name.text, (binding.propertyName ?? binding.name).text);
    } else if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
  }
  for (const statement of ast.statements) {
    if (!ts.isExportAssignment(statement) || statement.isExportEquals) continue;
    const call = unwrap(statement.expression);
    if (!ts.isCallExpression(call)) continue;
    const callee = call.expression;
    const name = ts.isIdentifier(callee)
      ? imports.get(callee.text)
      : ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          namespaces.has(callee.expression.text)
        ? callee.name.text
        : undefined;
    const event = name === undefined ? undefined : FACTORIES.get(name);
    if (event === undefined) continue;
    const config = call.arguments[0];
    if (!config || !ts.isObjectLiteralExpression(unwrap(config))) {
      throw new Error(`${filename}: Cursor hook config must be an inline object literal`);
    }
    const values: Record<string, unknown> = {};
    for (const member of (unwrap(config) as ts.ObjectLiteralExpression).properties) {
      if (!ts.isPropertyAssignment(member) || !(ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) {
        throw new Error(`${filename}: Cursor config cannot use spreads, shorthand, or computed properties`);
      }
      const key = member.name.text;
      if (key === "onUnexpectedError") continue;
      if (!["matcher", "timeout", "failClosed", "loopLimit", "unexpectedError"].includes(key)) {
        throw new Error(`${filename}: Unknown Cursor hook option ${key}`);
      }
      const value = unwrap(member.initializer);
      if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) values[key] = value.text;
      else if (ts.isNumericLiteral(value)) values[key] = Number(value.text);
      else if (value.kind === ts.SyntaxKind.TrueKeyword) values[key] = true;
      else if (value.kind === ts.SyntaxKind.FalseKeyword) values[key] = false;
      else if (value.kind === ts.SyntaxKind.NullKeyword) values[key] = null;
      else throw new Error(`${filename}: Cursor ${key} must be a literal`);
    }
    const metadata = { ...values, hookEventName: event } as CursorHookMetadata;
    validateHookConfig(event, metadata);
    return metadata;
  }
  return undefined;
}

function pluginRootAt(directory: string): string | undefined {
  for (let current = path.resolve(directory); ; current = path.dirname(current)) {
    const marker = path.join(current, ".cursor-plugin");
    if (fs.existsSync(marker) && fs.statSync(marker).isDirectory()) return current;
    if (current === path.dirname(current)) return undefined;
  }
}

/** Plugin mode takes precedence over project mode; directory names are exact path segments. */
export function detectCursorCommandContext(manifestPath: string, pluginRoot = false): CursorCommandContext {
  const directory = path.dirname(path.resolve(manifestPath));
  const plugin = pluginRootAt(directory);
  if (plugin) return { mode: "plugin", root: plugin };
  if (pluginRoot) return { mode: "plugin", root: path.dirname(directory) };
  for (let current = directory; current !== path.dirname(current); current = path.dirname(current)) {
    if (path.basename(current) === ".cursor") {
      return path.dirname(current) === os.homedir()
        ? { mode: "user", root: current }
        : { mode: "project", root: path.dirname(current) };
    }
  }
  return { mode: "absolute" };
}

/** Omitted -o uses Cursor's plugin discovery path, never .cursor-plugin/hooks.json. */
export function resolveCursorOutput(args: Pick<CursorCliArgs, "output" | "pluginRoot">, cwd = process.cwd()): string {
  if (args.output) return path.resolve(cwd, args.output);
  const root = pluginRootAt(cwd) ?? (args.pluginRoot ? cwd : undefined);
  if (!root) throw new Error("Cursor build requires -o/--output outside a .cursor-plugin plugin");
  return path.join(root, "hooks", "hooks.json");
}

/** POSIX shell quoting: paths containing $, backticks, apostrophes, or spaces stay literal. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function commandFor(entry: CompiledCursorHook, context: CursorCommandContext, executable: string): string {
  if (!context.root) return `${executable} ${quote(entry.outputPath)}`;
  const relative = path.relative(context.root, entry.outputPath).split(path.sep).join("/");
  if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error("Cursor hook bundle must remain inside its command root");
  }
  if (
    context.mode === "plugin" &&
    (entry.metadata.hookEventName === "stop" || entry.metadata.hookEventName === "subagentStop")
  ) {
    // Cursor runs these two events from the workspace. Let the shell expand the
    // documented environment variable; do not depend on host interpolation.
    return `${executable} "\${CURSOR_PLUGIN_ROOT:?CURSOR_PLUGIN_ROOT is required}"/${quote(relative)}`;
  }
  return `${executable} ${quote(`./${relative}`)}`;
}

/** No matcher grouping: even two sessionStart hooks remain separate commands. */
export function generateCursorHooksJson(
  entries: CompiledCursorHook[],
  manifestPath: string,
  executable = "node",
  context = detectCursorCommandContext(manifestPath),
): CursorHooksJson {
  const manifest: CursorHooksJson = { version: 1, hooks: {} };
  for (const entry of entries) {
    const { hookEventName: event, matcher, timeout, loopLimit, failClosed } = entry.metadata;
    validateHookConfig(event, entry.metadata);
    const failClosedValue = defaultFailClosed(event, failClosed);
    const script: CursorScript = {
      command: commandFor(entry, context, executable),
      ...(matcher !== undefined ? { matcher } : {}),
      ...(timeout !== undefined ? { timeout: Math.max(1, Math.ceil(timeout / 1000)) } : {}),
      ...(failClosedValue !== undefined ? { failClosed: failClosedValue } : {}),
      ...(loopLimit !== undefined ? { loop_limit: loopLimit } : {}),
    };
    manifest.hooks[event] ??= [];
    manifest.hooks[event].push(script);
  }
  return manifest;
}

/** Bundle against Cursor's transport using the shared, symlink-aware compiler. */
export function compileCursorHook(source: string, loaders: Record<string, esbuild.Loader>, sourcemap = false) {
  return compileHookBundle(source, new URL("./transport.js", import.meta.url), loaders, sourcemap);
}

/** Compile all hooks before writing any output, so an invalid source leaves the old manifest intact. */
export async function runCursorCli(args: CursorCliArgs): Promise<{ outputPath: string; count: number }> {
  if (args.scaffold) {
    const { scaffoldProject } = await import("./scaffold.js");
    const directory = path.resolve(args.scaffold);
    const count = scaffoldProject({
      directory,
      hooks: args.hooks ?? "",
      outputPath: args.output || "hooks/hooks.json",
    });
    return { outputPath: directory, count };
  }
  const outputPath = resolveCursorOutput(args);
  const context = detectCursorCommandContext(outputPath, args.pluginRoot);
  const sources = (await discoverHookSourceFiles(args.input, process.cwd())).sort();
  const loaders = buildEsbuildLoaderMap(args.loaderFlags);
  const used = new Set<string>();
  const bundles: { filename: string; content: string; entry: CompiledCursorHook }[] = [];
  for (const source of sources) {
    const metadata = analyzeCursorHookFile(source);
    if (!metadata) continue;
    const { content, contentHash } = await compileCursorHook(source, loaders, args.sourcemap ?? false);
    const base = path.basename(source, path.extname(source));
    let name = base;
    for (let suffix = 2; used.has(name); suffix++) name = `${base}-${suffix}`;
    used.add(name);
    const stable = args.stableNames ?? context.mode === "plugin";
    const filename = stable ? `${name}.mjs` : `${name}.${contentHash}.mjs`;
    bundles.push({
      filename,
      content,
      entry: { metadata, outputPath: path.join(path.dirname(outputPath), "bin", filename) },
    });
  }
  if (!bundles.length) throw new Error("No Cursor hooks found; import factories from @goodfoot/agent-hooks/cursor");
  const manifest = generateCursorHooksJson(
    bundles.map((bundle) => bundle.entry),
    outputPath,
    args.executable,
    context,
  );
  const bin = path.join(path.dirname(outputPath), "bin");
  fs.mkdirSync(bin, { recursive: true });
  for (const bundle of bundles) {
    fs.writeFileSync(bundle.entry.outputPath, `#!/usr/bin/env -S node --enable-source-maps\n${bundle.content}`, {
      mode: 0o755,
    });
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  pruneStaleHashedBundles(bin, new Set(bundles.map((bundle) => bundle.filename)));
  return { outputPath, count: bundles.length };
}
