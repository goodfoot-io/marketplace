/**
 * OpenCode-specific CLI internals: bundling each selected plugin entry to a
 * standalone ESM artifact and validating its `{ id, server }` (or bare
 * function) default-export contract against a real dynamic import of the
 * built output — not a hand-rolled AST check, which could pass a shape the
 * actual OpenCode loader would still reject.
 *
 * Unlike Codex's `compileCodexHook`, there is no wrapper content and no
 * `execute()` runtime module to link: OpenCode imports the plugin author's
 * own default export directly, so the bundle *is* the artifact — no
 * stdin/stdout driver, no `hooks.json` manifest, no shebang.
 *
 * Driver-level primitives (loader parsing, glob discovery) are imported from
 * the shared CLI module — never re-derived here.
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { buildEsbuildLoaderMap, discoverHookSourceFiles, parseEsbuildLoaderFlag } from "../../cli.js";

/** OpenCode CLI arguments accepted on top of the shared `--agent opencode` gate. */
export interface OpenCodeCliArgs {
  input: string;
  output: string;
  loaderFlags: string[];
  sourcemap?: boolean;
}

type HookLoaderMap = Record<string, esbuild.Loader>;

interface CompiledOpenCodePlugin {
  sourcePath: string;
  outputPath: string;
}

/**
 * Bundles one OpenCode plugin entry to a self-contained ESM artifact. The
 * source file's own default export is preserved unchanged — no wrapper.
 */
export async function compileOpenCodePlugin(
  sourcePath: string,
  loaders: HookLoaderMap,
  sourcemap: boolean = true,
): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [sourcePath],
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
  return content;
}

/**
 * Validates that `outputPath`'s default export matches OpenCode's real
 * loader contract (`getServerPlugin`): either a bare function, or an object
 * with a `server` function property. Imports the built artifact itself
 * rather than statically analyzing source, so the check exercises exactly
 * what OpenCode's loader will see.
 * @throws Error when the default export matches neither shape.
 */
export async function validateOpenCodePluginModule(outputPath: string): Promise<void> {
  const imported: unknown = await import(pathToFileURL(outputPath).href);
  const defaultExport = (imported as { default?: unknown }).default;
  const isBareFunction = typeof defaultExport === "function";
  const isServerModule =
    typeof defaultExport === "object" &&
    defaultExport !== null &&
    typeof (defaultExport as { server?: unknown }).server === "function";
  if (!isBareFunction && !isServerModule) {
    throw new Error(
      `${outputPath}: default export must be a function or a { server } object (OpenCode's loader contract), got ${typeof defaultExport}`,
    );
  }
}

async function compileAllOpenCodePlugins(
  pluginFiles: string[],
  outputDir: string,
  loaders: HookLoaderMap,
  sourcemap: boolean,
): Promise<CompiledOpenCodePlugin[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const compiled: CompiledOpenCodePlugin[] = [];
  for (const sourcePath of pluginFiles) {
    const content = await compileOpenCodePlugin(sourcePath, loaders, sourcemap);
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const outputPath = path.join(outputDir, `${baseName}.mjs`);
    fs.writeFileSync(outputPath, content, { encoding: "utf-8" });
    try {
      await validateOpenCodePluginModule(outputPath);
    } catch (error) {
      fs.rmSync(outputPath);
      throw error;
    }
    compiled.push({ sourcePath, outputPath });
  }
  return compiled;
}

/**
 * Validates OpenCode build arguments beyond the shared `--agent` gate: `-i`
 * and `-o` required, loader flags well-formed.
 */
export function validateOpenCodeArgs(args: OpenCodeCliArgs): string | undefined {
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
 * Runs the OpenCode build branch of the unified CLI: discovers plugin entry
 * files matching `--input`, bundles each to a standalone ESM artifact under
 * `--output` (treated as a directory — OpenCode plugin config references
 * these files directly, there is no manifest), and validates each artifact's
 * default export against OpenCode's real loader contract.
 */
export async function runOpenCodeCli(args: OpenCodeCliArgs): Promise<CompiledOpenCodePlugin[]> {
  const cwd = process.cwd();
  const pluginFiles = await discoverHookSourceFiles(args.input, cwd);
  const outputDir = path.resolve(cwd, args.output);
  const loaders = buildEsbuildLoaderMap(args.loaderFlags);
  const sourcemap = args.sourcemap ?? true;
  return compileAllOpenCodePlugins(pluginFiles, outputDir, loaders, sourcemap);
}
