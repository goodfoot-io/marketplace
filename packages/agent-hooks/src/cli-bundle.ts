/** Shared ESM hook bundling; each target supplies only its own runtime module. */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { moduleWorkingDir, sha256Prefix8, symlinkVisiblePath } from "./cli.js";

/** Compile a hook against the selected transport, retaining worktree/symlink portability. */
export async function compileHookBundle(
  sourcePath: string,
  runtimeUrl: URL,
  loaders: Record<string, esbuild.Loader>,
  sourcemap: boolean = false,
): Promise<{ content: string; contentHash: string }> {
  const resolveDir = path.dirname(sourcePath);
  const runtimeAbsolute = symlinkVisiblePath(fileURLToPath(runtimeUrl), resolveDir);
  const absWorkingDir = moduleWorkingDir(runtimeAbsolute, resolveDir);
  const runtimeRelative = path.relative(resolveDir, runtimeAbsolute).replace(/\\/g, "/");
  const runtimeSpecifier = runtimeRelative.startsWith(".") ? runtimeRelative : `./${runtimeRelative}`;
  const entry = [
    `import hook from ${JSON.stringify(`./${path.basename(sourcePath)}`)};`,
    `import { execute } from ${JSON.stringify(runtimeSpecifier)};`,
    `execute(hook);`,
    ``,
  ].join("\n");

  const built = await esbuild.build({
    absWorkingDir,
    stdin: {
      contents: entry,
      resolveDir,
      sourcefile: `${path.basename(sourcePath, path.extname(sourcePath))}-entry.ts`,
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

  const content = built.outputFiles?.[0]?.text;
  if (content === undefined) {
    throw new Error(`esbuild produced no output for ${sourcePath}`);
  }
  return { content, contentHash: sha256Prefix8(content) };
}
