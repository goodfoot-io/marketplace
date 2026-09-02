import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { parseFrontConfig } from "../packages/agent-skills/src/compiler.js";
import { PLATFORMS } from "../packages/agent-skills/src/types.js";
import type { Platform } from "../packages/agent-skills/src/types.js";

/**
 * The one place the build driver, the lint driver, and CI turn a plugin's
 * on-disk shape into agent-skills CLI invocations.
 *
 * Kept shared rather than copied because the drivers must agree about what a
 * plugin's flags are: a lint run that derives `--root` or `--platform-dir`
 * differently from the build run reports diagnostics about output nobody
 * ships, and misses the output everybody does.
 *
 * There is no declared registry of plugins, build targets, or platform
 * directories anywhere in the repository. A plugin is any directory under
 * `skills-src/`; every one of them builds into all four supported platforms
 * (Claude Code, Codex, OpenCode, Antigravity) at the same standard
 * `plugins-<platform>/<name>/...` layout, with no per-plugin opt-out. Which
 * *content* actually renders to a given platform is read live from each
 * template's own front-config, not declared separately — a plugin whose
 * skills are all gated to one platform (voice) simply renders nothing on the
 * others, the same way it does today.
 */

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface RegistryTarget {
  readonly platform: Platform;
  readonly path: string;
}

export interface RegistryPlugin {
  readonly name: string;
  readonly skillsSrc: string;
  readonly claudePluginRoot: string;
  readonly codexPluginRoot: string;
  readonly opencodePluginRoot: string;
  readonly antigravityPluginRoot: string;
  readonly renderedPlatforms: readonly Platform[];
  readonly targets: readonly RegistryTarget[];
  readonly platformDirs: readonly string[];
  readonly versionSurfaces: {
    readonly source: string;
    readonly codexManifest: string;
    readonly opencodePackage: string;
    readonly antigravityManifest: string;
  };
  readonly lintBaseline: {
    readonly reason: string;
    readonly diagnostics: readonly string[];
  };
}

export interface Registry {
  readonly plugins: readonly RegistryPlugin[];
}

const PLATFORM_DIR_NAME: Record<Platform, string> = {
  "claude-code": "claude",
  codex: "codex",
  opencode: "opencode",
  antigravity: "antigravity",
};

function pluginRoot(platform: Platform, name: string): string {
  return `plugins-${PLATFORM_DIR_NAME[platform]}/${name}`;
}

/** `platform:kind=path` flags, identical in shape for every plugin. */
function platformDirsFor(name: string): string[] {
  const entries: string[] = [];
  for (const platform of PLATFORMS) {
    const root = pluginRoot(platform, name);
    entries.push(`${platform}:skills=${root}/skills`);
    entries.push(`${platform}:agents=${root}/agents`);
    entries.push(`${platform}:hooks=${root}/hooks`);
    entries.push(`${platform}:plugin=${root}`);
    const conventions =
      platform === "claude-code" ? "CLAUDE.md" : platform === "antigravity" ? `${root}/AGENTS.md` : "AGENTS.md";
    entries.push(`${platform}:conventions=${conventions}`);
  }
  return entries;
}

/**
 * Which platforms a plugin's templates actually render to, read live from
 * each `.md.eta` file's own front-config `platforms:` key (defaulting to all
 * four when a file omits it). This is what makes voice's Claude-only content
 * stay Claude-only without a hand-maintained exception: its one skill
 * declares `platforms: [claude-code]` in the template itself.
 */
async function renderedPlatformsFor(name: string): Promise<Platform[]> {
  const root = path.join(repo, "skills-src", name);
  const files = await glob("**/*.md.eta", { cwd: root, nodir: true });
  if (files.length === 0) throw new Error(`${name}: skills-src/${name} contains no .md.eta templates`);
  const rendered = new Set<Platform>();
  for (const file of files) {
    const template = await readFile(path.join(root, file), "utf8");
    const { config } = parseFrontConfig(template);
    for (const platform of config?.platforms ?? PLATFORMS) rendered.add(platform);
  }
  return PLATFORMS.filter((platform) => rendered.has(platform));
}

/**
 * goodfoot's second, unregistered OpenCode target: a bare repo-root `skills/`
 * dir mirrored alongside `plugins-opencode/goodfoot/skills` because tooling
 * and docs still reference it. It is byte-identical to the registered tree
 * and deliberately not listed in `opencode.json` — registering both would
 * collide on all six skill names. This is the one hardcoded exception in the
 * whole build: every other plugin's target list is exactly its rendered
 * platforms.
 */
function extraTargetsFor(name: string): RegistryTarget[] {
  return name === "goodfoot" ? [{ platform: "opencode", path: "skills" }] : [];
}

function versionSurfacesFor(name: string) {
  return {
    source: `${pluginRoot("claude-code", name)}/.claude-plugin/plugin.json`,
    codexManifest: `${pluginRoot("codex", name)}/.codex-plugin/plugin.json`,
    opencodePackage: `${pluginRoot("opencode", name)}/package.json`,
    antigravityManifest: `${pluginRoot("antigravity", name)}/plugin.json`,
  };
}

const DEFAULT_LINT_BASELINE = {
  reason: "No diagnostics: every template renders portably on all declared targets.",
  diagnostics: [] as readonly string[],
};

/**
 * Curated lint-diagnostic exceptions have no on-disk formula to derive them
 * from — they live in an optional `.lint-baseline.json` next to a plugin's
 * templates. Every plugin but goodfoot's marketing corpus is clean today and
 * needs no file at all.
 */
async function lintBaselineFor(name: string): Promise<{ reason: string; diagnostics: readonly string[] }> {
  const file = path.join(repo, "skills-src", name, ".lint-baseline.json");
  if (!existsSync(file)) return DEFAULT_LINT_BASELINE;
  const parsed = JSON.parse(await readFile(file, "utf8"));
  if (typeof parsed?.reason !== "string" || !Array.isArray(parsed?.diagnostics))
    throw new Error(`${file}: must be { "reason": string, "diagnostics": string[] }`);
  return { reason: parsed.reason, diagnostics: parsed.diagnostics };
}

/**
 * Overridable via AGENT_SKILLS_SKILLS_SRC so a caller can point the drivers
 * at a scratch tree without touching the real one.
 */
export async function loadRegistry(): Promise<Registry> {
  const skillsSrcRoot = process.env.AGENT_SKILLS_SKILLS_SRC ?? path.join(repo, "skills-src");
  const names = (await readdir(skillsSrcRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) throw new Error(`${skillsSrcRoot} declares no plugins`);
  const plugins = await Promise.all(
    names.map(async (name): Promise<RegistryPlugin> => {
      const renderedPlatforms = await renderedPlatformsFor(name);
      const targets = [
        ...renderedPlatforms.map((platform) => ({ platform, path: `${pluginRoot(platform, name)}/skills` })),
        ...extraTargetsFor(name),
      ];
      return {
        name,
        skillsSrc: `skills-src/${name}`,
        claudePluginRoot: pluginRoot("claude-code", name),
        codexPluginRoot: pluginRoot("codex", name),
        opencodePluginRoot: pluginRoot("opencode", name),
        antigravityPluginRoot: pluginRoot("antigravity", name),
        renderedPlatforms,
        targets,
        platformDirs: platformDirsFor(name),
        versionSurfaces: versionSurfacesFor(name),
        lintBaseline: await lintBaselineFor(name),
      };
    }),
  );
  return { plugins };
}

/** Every path a plugin is permitted to publish into. */
function allowedTargets(plugin: RegistryPlugin): Set<string> {
  return new Set([
    `${plugin.claudePluginRoot}/skills`,
    `${plugin.codexPluginRoot}/skills`,
    `${plugin.opencodePluginRoot}/skills`,
    `${plugin.antigravityPluginRoot}/skills`,
    ...extraTargetsFor(plugin.name).map((target) => target.path),
  ]);
}

/**
 * An allow-list, not a list of known-bad shapes. Publishing renames the whole
 * target directory away, so a target computed outside this formula — however
 * it got there — must never reach the CLI.
 */
export function assertSafeTargets(registry: Registry): void {
  for (const plugin of registry.plugins) {
    const allowed = allowedTargets(plugin);
    for (const target of plugin.targets) {
      if (!allowed.has(target.path)) {
        throw new Error(
          `${plugin.name}: --target ${target.platform}=${target.path} is not a standard skills tree. ` +
            `Publishing renames the whole directory away, so only ${[...allowed].join(", ")} may be published into.`,
        );
      }
    }
  }
}

/**
 * A target no template renders into publishes an empty directory, and git
 * cannot store one. Targets are now built directly from each plugin's own
 * rendered platforms, so this can only fire if that formula and the target
 * list it produced disagree — a guard against the two drifting apart under a
 * future edit, not a check on hand-maintained data.
 */
export function assertTargetsRenderFiles(registry: Registry): void {
  for (const plugin of registry.plugins) {
    const rendered = new Set(plugin.renderedPlatforms);
    for (const target of plugin.targets) {
      if (!rendered.has(target.platform)) {
        throw new Error(
          `${plugin.name}: --target ${target.platform}=${target.path} would publish an empty directory. ` +
            `No template renders to ${target.platform}, and git cannot commit an empty tree.`,
        );
      }
    }
  }
}

/**
 * The rename that publishes a target takes the directory's whole prior
 * contents with it, tracked or not. Tracked losses come back from the index;
 * untracked ones are gone, which is how a peer session lost in-progress work
 * to a build it did not know it had started. Nothing downstream can restore
 * it, so the refusal has to come before the CLI runs.
 */
export function assertNoUntrackedInTargets(registry: Registry): void {
  for (const plugin of registry.plugins) {
    for (const target of plugin.targets) {
      const gitLsFiles = (args: string[]) =>
        execFileSync("git", ["ls-files", ...args, "--", target.path], { cwd: repo, encoding: "utf8" })
          .split("\n")
          .filter(Boolean);
      const untracked = [
        ...new Set([
          ...gitLsFiles(["--others", "--exclude-standard"]),
          ...gitLsFiles(["--others", "--ignored", "--exclude-standard"]),
        ]),
      ].sort();
      if (untracked.length > 0) {
        throw new Error(
          `${plugin.name}: ${target.path} holds untracked files that publishing would destroy irrecoverably:\n` +
            `${untracked.map((file) => `  ${file}`).join("\n")}\n` +
            `Commit or move them, then build again.`,
        );
      }
    }
  }
}

/** The agent-skills CLI argv for one plugin, identical between build and lint. */
export function cliArgs(plugin: RegistryPlugin, command: "build" | "lint"): string[] {
  return [
    "node_modules/tsx/dist/cli.mjs",
    "packages/agent-skills/src/cli.ts",
    command,
    "--root",
    plugin.skillsSrc,
    ...plugin.targets.flatMap((target) => ["--target", `${target.platform}=${target.path}`]),
    ...plugin.platformDirs.flatMap((flag) => ["--platform-dir", flag]),
    "**/*",
  ];
}

/**
 * Diagnostics reduced to the sites they name: `<file>:<line>:<rule>`, deduped
 * because the same template site is reported once per target it renders into.
 * Comparing sites rather than raw lines keeps a declared baseline something a
 * reviewer can read.
 */
export function diagnosticSites(stderr: string): string[] {
  const sites = stderr
    .split("\n")
    .map((line) => /^(.+?):(\d+):\d+ \[([^\]]+)\]/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => `${match[1]}:${match[2]}:${match[3]}`);
  return [...new Set(sites)].sort();
}
