import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Eta } from "eta";
import { glob } from "glob";
import { parse } from "yaml";
import { createHelpers } from "./helpers.js";
import { PLATFORM_DEFINITIONS } from "./platforms.js";
import type {
  BuildFileSystem,
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
  if (config.lintSuppressions !== undefined) {
    if (!Array.isArray(config.lintSuppressions)) throw new Error("front-config lintSuppressions must be a list");
    for (const suppression of config.lintSuppressions) {
      if (!suppression || typeof suppression !== "object" || Array.isArray(suppression))
        throw new Error("lint suppression must be a mapping");
      const item = suppression as Record<string, unknown>;
      if (Object.keys(item).some((key) => key !== "rule" && key !== "lines"))
        throw new Error("lint suppression has unknown keys");
      if (typeof item.rule !== "string" || !LINT_RULES.has(item.rule as Diagnostic["rule"]))
        throw new Error(`lint suppression has invalid rule ${String(item.rule)}`);
      if (
        !Array.isArray(item.lines) ||
        item.lines.length !== 2 ||
        !item.lines.every((line) => Number.isSafeInteger(line) && Number(line) > 0) ||
        Number(item.lines[0]) > Number(item.lines[1])
      )
        throw new Error("lint suppression lines must be a positive [start, end] range");
    }
  }
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

interface Discovery {
  readonly paths: readonly string[];
  readonly templates: readonly string[];
}
async function discover(options: BuildOptions): Promise<Discovery> {
  if (!options.patterns.length) throw new Error("At least one file or glob is required");
  const templates = new Set<string>();
  for (const pattern of options.patterns) {
    const matches = await glob(pattern, { cwd: options.root, nodir: true, dot: true, posix: true });
    for (const match of matches) if (match.endsWith(".md.eta")) templates.add(posix(match));
  }
  if (!templates.size) throw new Error("No template files matched positional patterns");
  const owners = new Set([...templates].map((path) => (path.includes("/") ? path.split("/")[0] : ".")));
  const paths = new Set(templates);
  for (const owner of owners)
    for (const asset of await glob(owner === "." ? "**/*" : `${owner}/**/*`, {
      cwd: options.root,
      nodir: true,
      dot: true,
      posix: true,
    })) {
      if (!asset.endsWith(".md.eta")) paths.add(posix(asset));
    }
  return { paths: [...paths].sort(), templates: [...templates].sort() };
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
  const { paths } = await discover(options);
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
        const rendered = await renderTemplate({
          platform,
          root: options.root,
          sourcePath,
          template,
          platformDirs: options.platformDirs?.[platform],
        });
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

const DEFAULT_FS: BuildFileSystem = { mkdir, mkdtemp, writeFile, chmod, lstat, rename, rm };
async function physicalPath(path: string): Promise<string> {
  const suffix: string[] = [];
  let cursor = resolve(path);
  while (true) {
    try {
      return resolve(await realpath(cursor), ...suffix.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(cursor);
      if (parent === cursor) return resolve(cursor, ...suffix.reverse());
      suffix.push(basename(cursor));
      cursor = parent;
    }
  }
}
const overlap = (one: string, two: string): boolean => inside(one, two) || inside(two, one);
async function validateTargets(options: BuildOptions): Promise<void> {
  if (!options.targets.length) throw new Error("At least one target is required");
  const paths: { lexical: string; folded: string; physical: string; original: string }[] = [];
  for (const target of options.targets) {
    if (!validPlatform(target.platform)) throw new Error(`Unknown target platform: ${target.platform}`);
    const path = resolve(target.outDir);
    if (inside(options.root, path) || inside(path, options.root))
      throw new Error(`Input and output trees overlap: ${target.outDir}`);
    if (options.outputBoundary && !inside(options.outputBoundary, path))
      throw new Error(`Target is outside output boundary: ${target.outDir}`);
    paths.push({
      lexical: path,
      folded: path.toLocaleLowerCase(),
      physical: await physicalPath(path),
      original: target.outDir,
    });
  }
  for (let left = 0; left < paths.length; left += 1)
    for (let right = left + 1; right < paths.length; right += 1) {
      const one = paths[left];
      const two = paths[right];
      if (!one || !two) continue;
      if (overlap(one.lexical, two.lexical) || overlap(one.folded, two.folded) || overlap(one.physical, two.physical)) {
        throw new Error(`Overlapping targets: ${one.original} and ${two.original}`);
      }
    }
}

interface PreparedTarget {
  readonly target: string;
  readonly stage: string;
  readonly backup: string;
  existed: boolean;
  swapped: boolean;
  restored: boolean;
}
async function materializeAll(
  targets: readonly { target: string; manifest: PlatformManifest }[],
  fileSystem: BuildFileSystem,
): Promise<void> {
  const prepared: PreparedTarget[] = [];
  const transactionId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const locks = (
    await Promise.all(targets.map(async (item) => `${await physicalPath(item.target)}.agent-skills.lock`))
  ).sort();
  const acquiredLocks: string[] = [];
  let transactionFailed = false;
  try {
    for (const lock of locks) {
      try {
        await fileSystem.mkdir(dirname(lock), { recursive: true });
        await fileSystem.mkdir(lock);
        acquiredLocks.push(lock);
        await fileSystem.writeFile(join(lock, "owner"), transactionId);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`Target lock contention: ${lock}`);
        throw error;
      }
    }
    for (const item of targets) {
      const target = resolve(item.target);
      await fileSystem.mkdir(dirname(target), { recursive: true });
      const stage = await fileSystem.mkdtemp(join(dirname(target), `.${basename(target)}.agent-skills-stage-`));
      const state: PreparedTarget = {
        target,
        stage,
        backup: `${target}.agent-skills-backup-${transactionId}-${prepared.length}`,
        existed: false,
        swapped: false,
        restored: false,
      };
      prepared.push(state);
      for (const file of item.manifest.files.values()) {
        const destination = join(stage, file.path);
        await fileSystem.mkdir(dirname(destination), { recursive: true });
        await fileSystem.writeFile(destination, file.bytes);
        await fileSystem.chmod(destination, file.mode);
      }
    }
    for (const state of prepared) {
      try {
        await fileSystem.lstat(state.target);
        state.existed = true;
        await fileSystem.rename(state.target, state.backup);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await fileSystem.rename(state.stage, state.target);
      state.swapped = true;
    }
    for (const state of prepared)
      if (state.existed) await fileSystem.rm(state.backup, { recursive: true, force: true });
  } catch (error) {
    transactionFailed = true;
    const rollbackErrors: Error[] = [];
    for (const state of [...prepared].reverse()) {
      if (state.swapped) {
        try {
          await fileSystem.rm(state.target, { recursive: true, force: true });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError as Error);
          continue;
        }
      }
      if (state.existed) {
        try {
          await fileSystem.rename(state.backup, state.target);
          state.restored = true;
        } catch (rollbackError) {
          rollbackErrors.push(
            new Error(
              `Failed to restore ${state.target} from recoverable backup ${state.backup}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
            ),
          );
        }
      }
    }
    if (rollbackErrors.length) {
      const backups = prepared.filter((state) => state.existed && !state.restored).map((state) => state.backup);
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Transaction failed: ${error instanceof Error ? error.message : String(error)}; rollback failed. Recoverable backup paths: ${backups.join(", ")}`,
      );
    }
    throw error;
  } finally {
    for (const state of prepared) {
      await fileSystem.rm(state.stage, { recursive: true, force: true });
      if (!state.existed || state.restored || !transactionFailed)
        await fileSystem.rm(state.backup, { recursive: true, force: true });
    }
    for (const lock of acquiredLocks.reverse()) await fileSystem.rm(lock, { recursive: true, force: true });
  }
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  await validateTargets(options);
  const rendered = await manifests(options);
  const targets = options.targets.filter((target) => !options.platforms || options.platforms.includes(target.platform));
  const swaps: { target: string; manifest: PlatformManifest }[] = [];
  for (const target of targets) {
    const manifest = rendered.get(target.platform);
    if (!manifest) throw new Error(`Missing manifest for ${target.platform}`);
    swaps.push({ target: target.outDir, manifest });
  }
  await materializeAll(swaps, options.fileSystem ?? DEFAULT_FS);
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
  const visible = markdownVisible(content, true);
  if (visible.includes("<%")) add("unexpanded-eta", "Unexpanded Eta syntax", visible.indexOf("<%"));
  for (const token of ["$" + "{PLUGIN_ROOT}", "$" + "{CLAUDE_PLUGIN_ROOT}"])
    for (const match of visible.matchAll(new RegExp(token.replace(/[${}]/g, "\\$&"), "g")))
      add("plugin-root-variable", `Forbidden plugin-root variable ${token}`, match.index);
  const front = content.match(/^---\n([\s\S]*?)\n---/);
  if (front) {
    const data = parse(front[1] ?? "") as Record<string, unknown>;
    const allowed = PLATFORM_DEFINITIONS[platform].frontmatterKeys.value ?? [];
    for (const key of Object.keys(data ?? {}))
      if (!allowed.includes(key))
        add("frontmatter-key", `Unsupported frontmatter key ${key}`, content.indexOf(`${key}:`));
    if (platform === "opencode" && (typeof data?.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name)))
      add("opencode-name", "OpenCode skill name must be lowercase kebab-case", content.indexOf("name:"));
  }
  const reference = /\$?[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*/g;
  for (const match of visible.matchAll(reference)) {
    const token = match[0];
    const invalid =
      platform === "opencode" ||
      platform === "antigravity" ||
      (platform === "claude-code" && token.startsWith("$")) ||
      (platform === "codex" && !token.startsWith("$"));
    if (invalid) add("cross-dialect-reference", `Cross-dialect skill reference ${token}`, match.index);
  }
  const skillPath =
    /(?:^|[\s`])(?:\.\.\/|\.\/|\/)?(?:plugins-(?:claude|codex|opencode)\/[^\s`]+\/)?skills(?:\/[A-Za-z0-9_./-]+)?/gm;
  for (const match of visible.matchAll(skillPath))
    add("skill-relative-path", `Skill path must use it.platformDir(): ${match[0].trim()}`, match.index);
  return diagnostics;
}
const LINT_RULES = new Set<Diagnostic["rule"]>([
  "config",
  "include",
  "unexpanded-eta",
  "frontmatter-key",
  "cross-dialect-reference",
  "literal-platform-prose",
  "plugin-root-variable",
  "skill-relative-path",
  "opencode-name",
]);
function markdownVisible(content: string, preserveInlineCode = false): string {
  let fenced = false;
  return content
    .split(/(?<=\n)/)
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return " ".repeat(line.length - (line.endsWith("\n") ? 1 : 0)) + (line.endsWith("\n") ? "\n" : "");
      }
      if (fenced) return " ".repeat(line.length - (line.endsWith("\n") ? 1 : 0)) + (line.endsWith("\n") ? "\n" : "");
      return preserveInlineCode ? line : line.replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length));
    })
    .join("");
}
function sourceDiagnostics(content: string, sourcePath: string): Diagnostic[] {
  const visible = markdownVisible(content);
  const diagnostics: Diagnostic[] = [];
  const patterns: readonly [Diagnostic["rule"], RegExp, string][] = [
    [
      "literal-platform-prose",
      /\b(?:CLAUDE\.md|AGENTS\.md|EnterWorktree|ExitWorktree|create-worktree|remove-worktree)\b/g,
      "Use a platform helper instead of literal platform prose",
    ],
    ["plugin-root-variable", /\$\{(?:CLAUDE_)?PLUGIN_ROOT\}/g, "Use it.pluginRootVar instead of a literal variable"],
    [
      "skill-relative-path",
      /(?:\.\.\/|\.\/|\/)skills\/[A-Za-z0-9_./-]+/g,
      "Use it.platformDir() instead of a literal skill path",
    ],
  ];
  for (const [rule, pattern, message] of patterns)
    for (const match of visible.matchAll(pattern))
      diagnostics.push({ rule, message, sourcePath, location: location(content, match.index) });
  return diagnostics;
}
function applySuppressions(diagnostics: readonly Diagnostic[], config?: TemplateFrontConfig): Diagnostic[] {
  return diagnostics.filter(
    (item) =>
      !config?.lintSuppressions?.some(
        (suppression) =>
          suppression.rule === item.rule &&
          item.location &&
          item.location.line >= suppression.lines[0] &&
          item.location.line <= suppression.lines[1],
      ),
  );
}
export async function lint(options: LintOptions): Promise<LintResult> {
  await validateTargets(options);
  let rendered: ReadonlyMap<Platform, PlatformManifest>;
  try {
    rendered = await manifests(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      manifests: new Map(),
      diagnostics: [
        { rule: /include|layout|cycle/i.test(message) ? "include" : "config", sourcePath: options.root, message },
      ],
    };
  }
  const diagnostics: Diagnostic[] = [];
  const discovery = await discover(options);
  const configs = new Map<string, TemplateFrontConfig | undefined>();
  for (const path of discovery.templates) {
    const source = await readFile(resolve(options.root, path), "utf8");
    const parsed = parseFrontConfig(source);
    diagnostics.push(...applySuppressions(sourceDiagnostics(parsed.body, path), parsed.config));
    const output = posix(join(dirname(path), parsed.config?.outputName ?? basename(path).replace(/\.eta$/, "")));
    configs.set(output, parsed.config);
  }
  for (const [platform, manifest] of rendered)
    for (const file of manifest.files.values()) {
      if (file.path.endsWith(".md"))
        diagnostics.push(
          ...applySuppressions(
            diagnose(Buffer.from(file.bytes).toString("utf8"), file.path, platform, file.path),
            configs.get(file.path),
          ),
        );
    }
  diagnostics.sort((a, b) =>
    `${a.sourcePath}\0${a.platform}\0${a.location?.line}\0${a.rule}`.localeCompare(
      `${b.sourcePath}\0${b.platform}\0${b.location?.line}\0${b.rule}`,
    ),
  );
  return { ok: diagnostics.length === 0, diagnostics, manifests: rendered };
}
