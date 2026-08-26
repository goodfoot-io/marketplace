import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Eta } from "eta";
import { glob } from "glob";
import { parse } from "yaml";
import { createHelpers } from "./helpers.js";
import type {
  BuildOptions,
  BuildResult,
  Diagnostic,
  LintOptions,
  LintResult,
  ManifestFile,
  Platform,
  PlatformManifest,
  RenderedTemplate,
  RenderTemplateOptions,
  TemplateFrontConfig,
} from "./types.js";
import { PLATFORMS } from "./types.js";

const FRONT_OPEN = "<!-- agent-skills\n";
const FRONT_CLOSE = "-->";
const posix = (value: string): string => value.split(sep).join("/");
const inside = (root: string, candidate: string): boolean => {
  const path = relative(resolve(root), resolve(candidate));
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
};
const validPlatform = (value: unknown): value is Platform =>
  typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);

function parseFrontConfig(template: string): { config?: TemplateFrontConfig; body: string } {
  if (!template.startsWith(FRONT_OPEN)) return { body: template };
  const close = template.indexOf(FRONT_CLOSE, FRONT_OPEN.length);
  if (close < 0) throw new Error("Unterminated agent-skills front-config");
  const raw = parse(template.slice(FRONT_OPEN.length, close));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Front-config must be a mapping");
  const config = raw as Record<string, unknown>;
  const allowed = new Set(["platforms", "outputName", "kind", "lintSuppressions"]);
  for (const key of Object.keys(config)) if (!allowed.has(key)) throw new Error(`Unknown front-config key: ${key}`);
  if (config.platforms !== undefined) {
    if (!Array.isArray(config.platforms) || config.platforms.length === 0 || !config.platforms.every(validPlatform))
      throw new Error("front-config platforms must be a non-empty canonical platform list");
    if (new Set(config.platforms).size !== config.platforms.length)
      throw new Error("front-config platforms contains duplicates");
  }
  if (config.outputName !== undefined) {
    if (
      typeof config.outputName !== "string" ||
      !config.outputName ||
      isAbsolute(config.outputName) ||
      config.outputName.split(/[\\/]/).includes("..")
    )
      throw new Error("front-config outputName must be a safe relative path");
  }
  const kinds = ["skill", "agent", "hook", "manifest", "documentation"];
  if (config.kind !== undefined && (typeof config.kind !== "string" || !kinds.includes(config.kind)))
    throw new Error("front-config kind is invalid");
  return { config: config as unknown as TemplateFrontConfig, body: template.slice(close + FRONT_CLOSE.length) };
}

export async function renderTemplate(options: RenderTemplateOptions): Promise<RenderedTemplate> {
  if (!inside(options.root, options.sourcePath))
    throw new Error(`Template escapes declared root: ${options.sourcePath}`);
  const { config, body } = parseFrontConfig(options.template);
  if (config?.platforms && !config.platforms.includes(options.platform))
    throw new Error(`Template does not target ${options.platform}`);
  const outputName = config?.outputName ?? basename(options.sourcePath).replace(/\.eta$/, "");
  const outputPath = posix(join(posix(relative(options.root, dirname(options.sourcePath))), outputName));
  if (outputPath.startsWith("../") || isAbsolute(outputPath))
    throw new Error(`Rendered output escapes root: ${outputPath}`);
  const eta = new Eta({ autoEscape: false, autoTrim: false, views: options.root });
  const data = { ...(options.data ?? {}) };
  Object.defineProperties(
    data,
    Object.getOwnPropertyDescriptors(createHelpers(options.platform, { platformDirs: options.platformDirs })),
  );
  const content = eta.renderString(body, data);
  return { content, outputPath, config };
}

async function discover(options: BuildOptions): Promise<string[]> {
  if (!options.patterns.length) throw new Error("At least one file or glob is required");
  const paths = new Set<string>();
  for (const pattern of options.patterns) {
    const matches = await glob(pattern, { cwd: options.root, nodir: true, dot: true, posix: true });
    for (const match of matches) paths.add(posix(match));
  }
  for (const asset of await glob("**/*", { cwd: options.root, nodir: true, dot: true, posix: true })) {
    if (!asset.endsWith(".md.eta")) paths.add(posix(asset));
  }
  if (!paths.size) throw new Error("No input files matched");
  return [...paths].sort();
}

function selectedPlatforms(options: BuildOptions): Platform[] {
  const requested = options.platforms ?? [...new Set(options.targets.map((target) => target.platform))];
  if (!requested.length) throw new Error("At least one platform is required");
  for (const platform of requested) if (!validPlatform(platform)) throw new Error(`Unknown platform: ${platform}`);
  const targeted = new Set(options.targets.map((target) => target.platform));
  for (const platform of requested)
    if (!targeted.has(platform)) throw new Error(`Platform filter has no target: ${platform}`);
  return [...new Set(requested)].sort();
}

async function manifests(options: BuildOptions): Promise<ReadonlyMap<Platform, PlatformManifest>> {
  const rootReal = await realpath(options.root);
  const paths = await discover(options);
  const result = new Map<Platform, PlatformManifest>();
  for (const platform of selectedPlatforms(options)) {
    const files = new Map<string, ManifestFile>();
    for (const path of paths) {
      const sourcePath = resolve(options.root, path);
      const sourceReal = await realpath(sourcePath);
      if (!inside(rootReal, sourceReal)) throw new Error(`Input symlink escapes declared root: ${path}`);
      const info = await stat(sourcePath);
      let outputPath = path;
      let bytes: Uint8Array;
      if (path.endsWith(".md.eta")) {
        const template = await readFile(sourcePath, "utf8");
        const parsed = parseFrontConfig(template);
        if (parsed.config?.platforms && !parsed.config.platforms.includes(platform)) continue;
        const rendered = await renderTemplate({ platform, root: options.root, sourcePath, template });
        outputPath = rendered.outputPath;
        bytes = Buffer.from(rendered.content);
      } else {
        bytes = await readFile(sourcePath);
      }
      const collision =
        files.get(outputPath) ??
        [...files.entries()].find(([key]) => key.toLocaleLowerCase() === outputPath.toLocaleLowerCase())?.[1];
      if (collision) throw new Error(`Two sources resolve to output ${outputPath}`);
      files.set(outputPath, { path: outputPath, bytes, mode: info.mode & 0o111 ? 0o755 : 0o644 });
    }
    result.set(platform, { platform, files });
  }
  return result;
}

async function materialize(target: string, manifest: PlatformManifest): Promise<void> {
  await mkdir(dirname(resolve(target)), { recursive: true });
  const stage = await mkdtemp(join(dirname(resolve(target)), `.${basename(target)}.agent-skills-stage-`));
  try {
    for (const file of manifest.files.values()) {
      const destination = join(stage, file.path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, file.bytes);
      await chmod(destination, file.mode);
    }
    const backup = `${resolve(target)}.agent-skills-backup-${process.pid}`;
    let existed = false;
    try {
      await lstat(resolve(target));
      existed = true;
      await rename(resolve(target), backup);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      await rename(stage, resolve(target));
      if (existed) await rm(backup, { recursive: true, force: true });
    } catch (error) {
      if (existed) await rename(backup, resolve(target));
      throw error;
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

function validateTargets(options: BuildOptions): void {
  if (!options.targets.length) throw new Error("At least one target is required");
  const seen = new Set<string>();
  for (const target of options.targets) {
    if (!validPlatform(target.platform)) throw new Error(`Unknown target platform: ${target.platform}`);
    const path = resolve(target.outDir);
    const folded = path.toLocaleLowerCase();
    if (seen.has(folded)) throw new Error(`Duplicate or colliding target: ${target.outDir}`);
    seen.add(folded);
    if (inside(options.root, path) || inside(path, options.root))
      throw new Error(`Input and output trees overlap: ${target.outDir}`);
    if (options.outputBoundary && !inside(options.outputBoundary, path))
      throw new Error(`Target is outside output boundary: ${target.outDir}`);
  }
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  validateTargets(options);
  const rendered = await manifests(options);
  const targets = options.targets.filter((target) => !options.platforms || options.platforms.includes(target.platform));
  for (const target of targets) {
    const manifest = rendered.get(target.platform);
    if (!manifest) throw new Error(`Missing manifest for ${target.platform}`);
    await materialize(target.outDir, manifest);
  }
  return {
    manifests: rendered,
    written: targets.map((target) => ({ target, files: [...(rendered.get(target.platform)?.files.keys() ?? [])] })),
  };
}

function location(content: string, offset: number): { line: number; column: number } {
  const before = content.slice(0, offset).split("\n");
  return { line: before.length, column: before.at(-1)?.length ? (before.at(-1)?.length ?? 0) + 1 : 1 };
}
function diagnose(content: string, sourcePath: string, platform: Platform, outputPath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const add = (rule: Diagnostic["rule"], message: string, offset = 0) =>
    diagnostics.push({ rule, message, sourcePath, outputPath, platform, location: location(content, offset) });
  if (content.includes("<%")) add("unexpanded-eta", "Unexpanded Eta syntax", content.indexOf("<%"));
  for (const token of ["$" + "{PLUGIN_ROOT}", "$" + "{CLAUDE_PLUGIN_ROOT}"])
    if (content.includes(token))
      add("plugin-root-variable", `Forbidden plugin-root variable ${token}`, content.indexOf(token));
  const front = content.match(/^---\n([\s\S]*?)\n---/);
  if (front) {
    const data = parse(front[1] ?? "") as Record<string, unknown>;
    const allowed = PLATFORM_DEFINITIONS_KEYS[platform];
    for (const key of Object.keys(data ?? {}))
      if (!allowed.includes(key))
        add("frontmatter-key", `Unsupported frontmatter key ${key}`, content.indexOf(`${key}:`));
    if (platform === "opencode" && (typeof data?.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name)))
      add("opencode-name", "OpenCode skill name must be lowercase kebab-case", content.indexOf("name:"));
  }
  if (platform !== "claude-code" && content.includes("cards:markdown"))
    add(
      "cross-dialect-reference",
      "Claude-style namespaced reference leaked into output",
      content.indexOf("cards:markdown"),
    );
  return diagnostics;
}
const PLATFORM_DEFINITIONS_KEYS: Record<Platform, readonly string[]> = {
  "claude-code": ["name", "description", "allowed-tools", "argument-hint", "model"],
  codex: ["name", "description"],
  opencode: ["name", "description"],
  antigravity: ["name", "description"],
};

export async function lint(options: LintOptions): Promise<LintResult> {
  validateTargets(options);
  let rendered: ReadonlyMap<Platform, PlatformManifest>;
  try {
    rendered = await manifests(options);
  } catch (error) {
    return {
      ok: false,
      manifests: new Map(),
      diagnostics: [
        { rule: "config", sourcePath: options.root, message: error instanceof Error ? error.message : String(error) },
      ],
    };
  }
  const diagnostics: Diagnostic[] = [];
  for (const [platform, manifest] of rendered)
    for (const file of manifest.files.values()) {
      if (file.path.endsWith(".md"))
        diagnostics.push(...diagnose(Buffer.from(file.bytes).toString("utf8"), file.path, platform, file.path));
    }
  diagnostics.sort((a, b) =>
    `${a.sourcePath}\0${a.platform}\0${a.location?.line}\0${a.rule}`.localeCompare(
      `${b.sourcePath}\0${b.platform}\0${b.location?.line}\0${b.rule}`,
    ),
  );
  return { ok: diagnostics.length === 0, diagnostics, manifests: rendered };
}
