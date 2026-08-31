/**
 * Antigravity-specific CLI internals: source analysis, bundle compilation
 * linking the Antigravity runtime module, and `hooks.json` generation in the
 * host's own named-hook shape.
 *
 * The manifest shape here has no counterpart in the other agents. Claude Code
 * and Codex both emit `{ "hooks": { "<Event>": [...] } }`; Antigravity's
 * top-level keys are **hook names**, each mapping to its own event table, and
 * only two of the five events wrap their handlers in a `{ matcher, hooks }`
 * group. The host also sets each handler's working directory to the directory
 * containing `hooks.json`, so commands are emitted relative to it and need no
 * `${PLUGIN_ROOT}` substitution or git-toplevel escape. See `CONTRACT.md` in
 * this directory for the pinned reference all of that is transcribed from.
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
  moduleWorkingDir,
  parseEsbuildLoaderFlag,
  pruneStaleHashedBundles,
  sha256Prefix8,
  symlinkVisiblePath,
} from "../../cli.js";
import { DEFAULT_TIMEOUT_SECONDS, GROUPED_EVENTS, HOOK_FACTORY_TO_EVENT } from "./constants.js";
import { HOOK_EVENT_NAMES } from "./events.js";
import type { HookEventName } from "./types.js";

/** Arguments the `--agent antigravity` branch accepts. */
export interface AntigravityCliArgs {
  input: string;
  output: string;
  executable?: string;
  loaderFlags: string[];
  sourcemap?: boolean;
  stableNames?: boolean;
}

/** What the analyzer recovers from one hook source file. */
export interface AntigravityHookMetadata {
  hookEventName: HookEventName;
  matcher?: string;
  /** As written in the source config, in milliseconds. Converted to seconds on the wire. */
  timeout?: number;
}

interface CompiledAntigravityHook {
  sourcePath: string;
  outputPath: string;
  hookName: string;
  metadata: AntigravityHookMetadata;
}

/** One handler entry, as it appears in `hooks.json`. */
export interface AntigravityHandler {
  type: "command";
  command: string;
  timeout: number;
}

/** A grouped entry, used by `PreToolUse` and `PostToolUse` only. */
export interface AntigravityMatcherGroup {
  matcher: string;
  hooks: AntigravityHandler[];
}

/**
 * One named hook's event table. Grouped events carry
 * {@link AntigravityMatcherGroup} entries; flat events carry handlers
 * directly.
 */
export type AntigravityNamedHook = {
  [Event in HookEventName]?: Event extends "PreToolUse" | "PostToolUse"
    ? AntigravityMatcherGroup[]
    : AntigravityHandler[];
};

/** The whole manifest: hook name to event table. */
export type AntigravityHooksJson = Record<string, AntigravityNamedHook>;

/** The matcher emitted when a grouped event's config names none. `"*"` matches every tool. */
const MATCH_ALL = "*";

/**
 * Recovers the bound event, matcher, and timeout from a hook module's default
 * export. Returns `undefined` when the default export is not a call to a
 * known Antigravity factory, which is how non-hook files in the input glob
 * are skipped.
 */
export function analyzeAntigravityHookFile(sourcePath: string): AntigravityHookMetadata | undefined {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    fs.readFileSync(sourcePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const unwrap = (node: ts.Expression): ts.CallExpression | undefined => {
    if (ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node)) {
      return unwrap(node.expression);
    }
    return ts.isCallExpression(node) ? node : undefined;
  };

  const factoryOf = (call: ts.CallExpression): string | undefined => {
    if (ts.isIdentifier(call.expression)) {
      return call.expression.text;
    }
    return ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : undefined;
  };

  const literalString = (node: ts.Expression): string | undefined =>
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;

  let found: AntigravityHookMetadata | undefined;

  const inspect = (node: ts.Node): void => {
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      const call = unwrap(node.expression);
      const factory = call === undefined ? undefined : factoryOf(call);
      const hookEventName = factory === undefined ? undefined : HOOK_FACTORY_TO_EVENT[factory];
      if (call !== undefined && hookEventName !== undefined) {
        const result: AntigravityHookMetadata = { hookEventName };
        const [config] = call.arguments;
        if (config !== undefined && ts.isObjectLiteralExpression(config)) {
          for (const property of config.properties) {
            if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
              continue;
            }
            if (property.name.text === "matcher") {
              result.matcher = literalString(property.initializer);
            }
            if (property.name.text === "timeout" && ts.isNumericLiteral(property.initializer)) {
              result.timeout = Number(property.initializer.text);
            }
          }
        }
        found = result;
      }
    }
    ts.forEachChild(node, inspect);
  };

  inspect(sourceFile);
  return found;
}

/**
 * Bundles one hook source into a self-contained ESM executable whose entry
 * wrapper calls this agent's `execute`.
 */
export async function compileAntigravityHook(
  sourcePath: string,
  loaders: Record<string, esbuild.Loader>,
  sourcemap: boolean = false,
): Promise<{ content: string; contentHash: string }> {
  const resolveDir = path.dirname(sourcePath);
  const runtimeAbsolute = symlinkVisiblePath(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./transport.js"),
    resolveDir,
  );
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

/**
 * Converts a source file's basename to the manifest's top-level hook name.
 * Names must be unique across the whole manifest, since the host merges
 * same-named entries; a collision is suffixed rather than silently dropped.
 */
function assignHookName(sourcePath: string, taken: Set<string>): string {
  const base = path.basename(sourcePath, path.extname(sourcePath));
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix++;
  }
  const unique = `${base}-${suffix}`;
  taken.add(unique);
  return unique;
}

async function compileAll(
  hookFiles: string[],
  binDir: string,
  loaders: Record<string, esbuild.Loader>,
  options: { stableNames: boolean; sourcemap: boolean },
): Promise<CompiledAntigravityHook[]> {
  fs.mkdirSync(binDir, { recursive: true });
  const compiled: CompiledAntigravityHook[] = [];
  const taken = new Set<string>();
  const written = new Set<string>();

  for (const sourcePath of hookFiles) {
    const metadata = analyzeAntigravityHookFile(sourcePath);
    if (metadata === undefined) {
      continue;
    }
    const { content, contentHash } = await compileAntigravityHook(sourcePath, loaders, options.sourcemap);
    const hookName = assignHookName(sourcePath, taken);
    const filename = options.stableNames ? `${hookName}.mjs` : `${hookName}.${contentHash}.mjs`;
    const outputPath = path.join(binDir, filename);
    fs.writeFileSync(outputPath, `#!/usr/bin/env -S node --enable-source-maps\n${content}`, {
      encoding: "utf-8",
      mode: 0o755,
    });
    written.add(filename);
    compiled.push({ sourcePath, outputPath, hookName, metadata });
  }

  pruneStaleHashedBundles(binDir, written);
  return compiled;
}

/**
 * Renders the command string for one bundle. The host runs each handler
 * through `sh -c` with the working directory set to the directory holding
 * `hooks.json`, so a manifest-relative path is portable across every install
 * location without substitution.
 */
function commandFor(manifestDir: string, outputPath: string, executable: string): string {
  const relative = path.relative(manifestDir, outputPath).replace(/\\/g, "/");
  const specifier = relative.startsWith(".") ? relative : `./${relative}`;
  return `${executable} ${JSON.stringify(specifier)}`;
}

function timeoutSeconds(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return DEFAULT_TIMEOUT_SECONDS;
  }
  return Math.max(1, Math.ceil(timeoutMs / 1000));
}

/**
 * Builds the manifest. Each compiled hook becomes one top-level named entry
 * holding exactly one event, which is what the host merges across plugins.
 */
export function generateAntigravityHooksJson(
  compiled: CompiledAntigravityHook[],
  manifestPath: string,
  executable: string = "node",
): AntigravityHooksJson {
  const manifestDir = path.dirname(manifestPath);
  const manifest: AntigravityHooksJson = {};

  for (const entry of compiled) {
    const handler: AntigravityHandler = {
      type: "command",
      command: commandFor(manifestDir, entry.outputPath, executable),
      timeout: timeoutSeconds(entry.metadata.timeout),
    };
    const event = entry.metadata.hookEventName;
    const named: AntigravityNamedHook = {};
    if (GROUPED_EVENTS.has(event)) {
      const group: AntigravityMatcherGroup = { matcher: entry.metadata.matcher ?? MATCH_ALL, hooks: [handler] };
      if (event === "PreToolUse") {
        named.PreToolUse = [group];
      } else {
        named.PostToolUse = [group];
      }
    } else if (event === "PreInvocation") {
      named.PreInvocation = [handler];
    } else if (event === "PostInvocation") {
      named.PostInvocation = [handler];
    } else {
      named.Stop = [handler];
    }
    manifest[entry.hookName] = named;
  }

  return manifest;
}

/** Validates the Antigravity build arguments beyond the shared `--agent` gate. */
export function validateAntigravityArgs(
  args: AntigravityCliArgs & { scaffold?: string; hooks?: string },
): string | undefined {
  if (args.scaffold !== undefined && args.scaffold !== "") {
    if (args.output === "") {
      return "Scaffold mode requires -o/--output";
    }
    if (args.hooks === undefined || args.hooks === "") {
      return "Scaffold mode requires --hooks";
    }
    const unknown = args.hooks
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .filter(
        (value) => !(HOOK_EVENT_NAMES as readonly string[]).some((name) => name.toLowerCase() === value.toLowerCase()),
      );
    if (unknown.length > 0) {
      return `Unknown Antigravity hook name(s): ${unknown.join(", ")}. Valid names: ${HOOK_EVENT_NAMES.join(", ")}`;
    }
    return undefined;
  }
  if (args.input === "") {
    return "Missing required argument: -i/--input";
  }
  if (args.output === "") {
    return "Missing required argument: -o/--output";
  }
  for (const flag of args.loaderFlags) {
    if (parseEsbuildLoaderFlag(flag) === undefined) {
      return `Invalid --loader value: ${flag}. Expected .ext=type`;
    }
  }
  return undefined;
}

/**
 * Runs the Antigravity build or scaffold branch. Bundle filenames are stable
 * by default: a manifest committed into a plugin tree must not churn on every
 * rebuild, and the host reads the command string rather than globbing the
 * directory.
 */
export async function runAntigravityCli(
  args: AntigravityCliArgs & { scaffold?: string; hooks?: string },
): Promise<number> {
  if (args.scaffold !== undefined && args.scaffold !== "") {
    const { scaffoldProject } = await import("./scaffold.js");
    scaffoldProject({
      directory: path.resolve(process.cwd(), args.scaffold),
      hooks: (args.hooks ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
      outputPath: args.output,
    });
    return 0;
  }

  const cwd = process.cwd();
  const manifestPath = path.resolve(cwd, args.output);
  const binDir = path.join(path.dirname(manifestPath), "bin");
  const hookFiles = await discoverHookSourceFiles(args.input, cwd);
  const loaders = buildEsbuildLoaderMap(args.loaderFlags);
  const compiled = await compileAll(hookFiles, binDir, loaders, {
    stableNames: args.stableNames ?? true,
    sourcemap: args.sourcemap ?? true,
  });
  const manifest = generateAntigravityHooksJson(compiled, manifestPath, args.executable ?? "node");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return compiled.length;
}
