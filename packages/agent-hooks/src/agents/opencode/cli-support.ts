/**
 * OpenCode-specific CLI internals: bundling each selected plugin entry to an
 * ESM plugin directory and validating its V2 `{ id, setup }` contract
 * against a real dynamic import of the built output — not a hand-rolled AST check, which could pass a shape the
 * actual OpenCode loader would still reject.
 *
 * Unlike Codex's `compileCodexHook`, there is no wrapper content and no
 * `execute()` runtime module to link: OpenCode imports the plugin author's
 * own default export directly from the package entry point — no
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
  sourcemap: boolean = false,
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
 * V2 loader contract: an object with a stable non-empty `id` and a
 * `setup` function. Imports the built artifact itself
 * rather than statically analyzing source, so the check exercises exactly
 * what OpenCode's loader will see.
 * @throws Error when the default export is not a V2 plugin definition.
 */
export async function validateOpenCodePluginModule(outputPath: string): Promise<void> {
  const imported: unknown = await import(pathToFileURL(outputPath).href);
  const defaultExport = (imported as { default?: unknown }).default;
  const definition = defaultExport as { id?: unknown; setup?: unknown } | null;
  if (
    typeof definition !== "object" ||
    definition === null ||
    typeof definition.id !== "string" ||
    definition.id.trim().length === 0 ||
    typeof definition.setup !== "function"
  ) {
    throw new Error(`${outputPath}: default export must be a V2 { id, setup } plugin definition`);
  }
}

async function compileAllOpenCodePlugins(
  pluginFiles: string[],
  outputDir: string,
  loaders: HookLoaderMap,
  sourcemap: boolean,
): Promise<CompiledOpenCodePlugin[]> {
  const outputPaths = pluginFiles.map((sourcePath) =>
    path.join(outputDir, path.basename(sourcePath, path.extname(sourcePath))),
  );
  if (new Set(outputPaths).size !== outputPaths.length) {
    throw new Error("OpenCode plugin source basenames must be unique within the output directory");
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const stagingDir = fs.mkdtempSync(path.join(outputDir, ".opencode-build-"));
  const compiled: CompiledOpenCodePlugin[] = [];
  try {
    // Validate fresh modules before replacing any previously built entry points.
    // Unique staging paths also prevent dynamic import's cache hiding rebuild errors.
    for (const [index, sourcePath] of pluginFiles.entries()) {
      const content = await compileOpenCodePlugin(sourcePath, loaders, sourcemap);
      const stagedPath = path.join(stagingDir, String(index));
      fs.mkdirSync(stagedPath);
      fs.writeFileSync(
        path.join(stagedPath, "package.json"),
        `${JSON.stringify({ private: true, type: "module", main: "index.js", exports: "./index.js" }, null, 2)}\n`,
        "utf-8",
      );
      const entryPath = path.join(stagedPath, "index.js");
      fs.writeFileSync(entryPath, content, "utf-8");
      await validateOpenCodePluginModule(entryPath);
      compiled.push({ sourcePath, outputPath: outputPaths[index] as string });
    }
    for (const [index, { outputPath }] of compiled.entries()) {
      fs.mkdirSync(outputPath, { recursive: true });
      for (const filename of ["package.json", "index.js"]) {
        fs.renameSync(path.join(stagingDir, String(index), filename), path.join(outputPath, filename));
      }
    }
  } finally {
    // Only remove compiler-owned staging data; preserve other files in plugin directories.
    fs.rmSync(stagingDir, { recursive: true, force: true });
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
 * files matching `--input`, bundles each to a package directory under
 * `--output`. OpenCode plugin config references these directories; each contains
 * package.json and index.js. Validates each entry point's
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
