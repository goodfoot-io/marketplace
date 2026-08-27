import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

/**
 * The bundler-managed plugin registry: the single declared source for every
 * path, tree, and marketplace surface the layout gates, the build driver, the
 * version sync script, and CI derive their work from.
 *
 * Values are declared, never computed, so a gate comparing a declaration
 * against the filesystem is comparing two independent things.
 */

export type Platform = "claude-code" | "codex" | "opencode" | "antigravity";

export interface RegistryTarget {
  /** Platform dialect this tree is rendered for. */
  platform: Platform;
  /** Repo-relative `--target` path. Never a plugin root — see targetsAreNeverPluginRoots. */
  path: string;
  /** OpenCode targets only: whether this root is listed in opencode.json's skills.paths. */
  opencodeRegistered?: boolean;
  /** Required whenever a declaration needs a reason a reader would otherwise have to guess. */
  note?: string;
}

export interface VersionLiteral {
  path: string;
  /** Regex with one capture group around the version, as sync and the gate both apply it. */
  match: string;
  note: string;
}

export type ReleaseRelationship = "independent" | "lockstep";

export interface PluginReleaseIdentity {
  /** Stable artifact identity; distinct from any same-name npm package identity. */
  identity: string;
  /** Human-facing release-line name used in diagnostics and remediation. */
  label: string;
  /** Manifest whose current version and committed history define plugin releases. */
  versionSource: string;
  historySource: "manifest-git-history";
  /** Root beneath which plugin release notes are discovered from the filesystem. */
  authoritativeRoot: string;
}

export interface NpmReleaseIdentity {
  /** Published package name from the declared package manifest. */
  identity: string;
  /** Human-facing release-line name used in diagnostics and remediation. */
  label: string;
  packageJson: string;
  historySource: "legacy-npm-tags";
  /** Root beneath which npm release notes are discovered from the filesystem. */
  authoritativeRoot: string;
  relationship: ReleaseRelationship;
  /** Existing bare `<plugin-name>-v<semver>` tags are npm-owned. */
  legacyTagPrefix: string;
}

export interface ReleaseIdentityDeclaration {
  plugin: PluginReleaseIdentity;
  /** Explicit null means no same-name npm release line exists. */
  npm: NpmReleaseIdentity | null;
}

export interface RegistryPlugin {
  name: string;
  /** Exhaustive identities for the plugin and its optional same-name npm sibling. */
  releaseIdentity: ReleaseIdentityDeclaration;
  /** Authored Eta templates for this plugin. */
  skillsSrc: string;
  /** Claude Code plugin home: holds the manifest and any hand-maintained siblings. */
  claudePluginRoot: string;
  codexPluginRoot: string;
  opencodePluginRoot: string;
  /** Antigravity plugin home, required when this plugin declares an Antigravity target. */
  antigravityPluginRoot?: string;
  targets: RegistryTarget[];
  /** Why this plugin's set of targets is what it is, where a reader would otherwise guess. */
  targetsNote?: string;
  /** `--platform-dir` flags, as `<platform>:<kind>=<path>` strings. */
  platformDirs: string[];
  /** Exact top-level skill directory names across this plugin's trees. */
  skills: string[];
  /**
   * Skills whose template restricts itself to a subset of platforms via
   * front-config `platforms:`, and which therefore do not appear in every
   * tree. Declared here so the restriction has one source that the trees, the
   * freshness inventory, and the equivalence check all derive from — rather
   * than each test carrying its own copy of which skill is missing where.
   *
   * agent-hooks/antigravity is the only member: it is intentionally limited to
   * Claude Code and Antigravity, the two hosts where its Antigravity boundary
   * is directly actionable, and stays out of the flat OpenCode namespace where
   * it would collide with agent-skills/antigravity.
   */
  skillPlatforms?: Record<string, Platform[]>;
  /**
   * Skill-owned `bin/` payloads, as skill -> filenames, that must stay mode
   * 100755 at every physical location. Omitted where a plugin ships none —
   * none of the seven migration candidates does, so this stays goodfoot-only
   * deliberately rather than by oversight.
   */
  skillBin?: Record<string, string[]>;
  marketplace: {
    /** Entry name in .claude-plugin/marketplace.json. */
    claude: string;
    /** Entry name in .agents/plugins/marketplace.json, or null when not published to Codex. */
    codex: string | null;
  };
  /**
   * Every file that carries this plugin's version, declared in one place so
   * the propagating script, the pre-commit hook, CI, and the lockstep test
   * derive the same list. A surface known to only one of them is a surface
   * that moves only when that one runs.
   */
  versionSurfaces: {
    /** Source of truth the other surfaces are synced from. */
    source: string;
    codexManifest: string;
    opencodePackage: string;
    /** Bare Antigravity plugin manifest, required with an Antigravity target. */
    antigravityManifest?: string;
    /** The published npm package, where the plugin ships one. */
    packageJson?: string;
    /** Versions embedded in source rather than in a JSON field. */
    literals?: VersionLiteral[];
    // Release notes are deliberately absent here. They were declared once, as
    // `changelogs`, and only agent-skills was ever enumerated — so every gate
    // that iterated the list ran for one plugin of eight and reported success
    // by iterating nothing for the rest. They are derived from disk instead,
    // by scripts/changelog-surfaces.mjs; see changelogSurfaces() below.
  };
  /** `<file>:<lineRange>:<rule>` sites, counted against the suppression budget. */
  lintSuppressions: string[];
  /**
   * Lint diagnostics this plugin currently produces, as `<file>:<line>:<rule>`
   * sites, with the reason they are tolerated. Declared rather than counted so
   * the exact inventory is in the diff, and compared in both directions so a
   * baseline cannot outlive the problem it excuses.
   */
  lintBaseline: {
    reason: string;
    diagnostics: string[];
  };
}

export interface UnmanagedPlugin {
  name: string;
  reason: string;
}

export interface Registry {
  /** Pinned total of lintSuppressions entries across every plugin. */
  lintSuppressionBudget: number;
  /** The one target path that is not a `<pluginRoot>/skills` leaf. */
  sharedOpencodeRoot: string;
  plugins: RegistryPlugin[];
  /** Marketplace plugins that are deliberately not bundler-managed. */
  unmanaged: UnmanagedPlugin[];
}

/** Validate release identities against declarations and the repository filesystem. */
export function validateReleaseIdentities(registry: Pick<Registry, "plugins">, repoRoot: string): void {
  const prefixes = new Map<string, string>();
  for (const plugin of registry.plugins) {
    const declaration = plugin.releaseIdentity;
    if (!declaration?.plugin) {
      throw new Error(`registry: ${plugin.name} is missing releaseIdentity.plugin`);
    }
    const pluginIdentity = declaration.plugin;
    validateMeaningfulReleaseString(plugin.name, "plugin.identity", pluginIdentity.identity);
    validateMeaningfulReleaseString(plugin.name, "plugin.label", pluginIdentity.label);
    if (pluginIdentity.identity !== plugin.name) {
      throw new Error(
        `registry: ${plugin.name} releaseIdentity.plugin.identity declares ${pluginIdentity.identity}; observed plugin name ${plugin.name}`,
      );
    }
    if (pluginIdentity.versionSource !== plugin.versionSurfaces.source) {
      throw new Error(
        `registry: ${plugin.name} releaseIdentity.plugin.versionSource declares ${pluginIdentity.versionSource}; ` +
          `versionSurfaces.source declares ${plugin.versionSurfaces.source}`,
      );
    }
    if (pluginIdentity.historySource !== "manifest-git-history") {
      throw new Error(
        `registry: ${plugin.name} releaseIdentity.plugin.historySource declares ${pluginIdentity.historySource}; ` +
          "expected manifest-git-history",
      );
    }
    if (pluginIdentity.authoritativeRoot !== plugin.claudePluginRoot) {
      throw new Error(
        `registry: ${plugin.name} releaseIdentity.plugin.authoritativeRoot declares ${pluginIdentity.authoritativeRoot}; ` +
          `expected owning plugin root ${plugin.claudePluginRoot} for ${pluginIdentity.versionSource}`,
      );
    }
    validateReleasePath(plugin.name, "plugin.versionSource", pluginIdentity.versionSource, repoRoot, "file");
    validateReleasePath(
      plugin.name,
      "plugin.authoritativeRoot",
      pluginIdentity.authoritativeRoot,
      repoRoot,
      "directory",
    );
    const pluginManifest = readVersionManifest(plugin.name, pluginIdentity.versionSource, repoRoot);
    if (pluginManifest.name !== pluginIdentity.identity) {
      throw new Error(
        `registry: ${plugin.name} plugin identity declares ${pluginIdentity.identity} at ${pluginIdentity.versionSource}; ` +
          `observed manifest name ${String(pluginManifest.name)}`,
      );
    }

    const collision = `packages/${plugin.name}/package.json`;
    const collisionExists = fs.existsSync(path.join(repoRoot, collision));
    const npm = declaration.npm;
    if (npm === null) {
      if (collisionExists) {
        throw new Error(
          `registry: ${plugin.name} has same-name npm package ${collision}, but releaseIdentity.npm is undeclared`,
        );
      }
      if (plugin.versionSurfaces.packageJson) {
        throw new Error(
          `registry: ${plugin.name} versionSurfaces.packageJson declares ${plugin.versionSurfaces.packageJson} without an npm identity`,
        );
      }
      continue;
    }
    if (!npm) throw new Error(`registry: ${plugin.name} is missing explicit releaseIdentity.npm (object or null)`);
    validateMeaningfulReleaseString(plugin.name, "npm.identity", npm.identity);
    validateMeaningfulReleaseString(plugin.name, "npm.label", npm.label);
    if (npm.historySource !== "legacy-npm-tags") {
      throw new Error(
        `registry: ${plugin.name} releaseIdentity.npm.historySource declares ${npm.historySource}; expected legacy-npm-tags`,
      );
    }
    if (npm.relationship !== "independent" && npm.relationship !== "lockstep") {
      throw new Error(
        `registry: ${plugin.name} releaseIdentity.npm.relationship must be independent or lockstep; received ${npm.relationship}`,
      );
    }
    if (!collisionExists) {
      throw new Error(
        `registry: ${plugin.name} declares npm package ${npm.packageJson}; observed no same-name package at ${collision}`,
      );
    }
    if (npm.packageJson !== collision) {
      throw new Error(
        `registry: ${plugin.name} npm packageJson declares ${npm.packageJson}; observed same-name package ${collision}`,
      );
    }
    const expectedNpmRoot = path.posix.dirname(npm.packageJson);
    if (npm.authoritativeRoot !== expectedNpmRoot) {
      throw new Error(
        `registry: ${plugin.name} releaseIdentity.npm.authoritativeRoot declares ${npm.authoritativeRoot}; ` +
          `expected package root ${expectedNpmRoot} for ${npm.packageJson}`,
      );
    }
    validateReleasePath(plugin.name, "npm.packageJson", npm.packageJson, repoRoot, "file");
    validateReleasePath(plugin.name, "npm.authoritativeRoot", npm.authoritativeRoot, repoRoot, "directory");
    const npmManifest = readVersionManifest(plugin.name, npm.packageJson, repoRoot);
    if (npmManifest.name !== npm.identity) {
      throw new Error(
        `registry: ${plugin.name} npm identity declares ${npm.identity} at ${npm.packageJson}; ` +
          `observed manifest name ${String(npmManifest.name)}`,
      );
    }
    const expectedPrefix = `${plugin.name}-v`;
    if (npm.legacyTagPrefix !== expectedPrefix) {
      throw new Error(
        `registry: ${plugin.name} npm legacyTagPrefix declares ${npm.legacyTagPrefix}; observed convention ${expectedPrefix}`,
      );
    }
    const prefixOwner = prefixes.get(npm.legacyTagPrefix);
    if (prefixOwner) {
      throw new Error(
        `registry: ${plugin.name} npm legacyTagPrefix ${npm.legacyTagPrefix} conflicts with ${prefixOwner}`,
      );
    }
    prefixes.set(npm.legacyTagPrefix, plugin.name);
    if (npm.relationship === "lockstep") {
      if (plugin.versionSurfaces.packageJson !== npm.packageJson) {
        throw new Error(
          `registry: ${plugin.name} lockstep npm package ${npm.packageJson} must equal versionSurfaces.packageJson; ` +
            `observed ${String(plugin.versionSurfaces.packageJson)}`,
        );
      }
    } else if (plugin.versionSurfaces.packageJson) {
      throw new Error(
        `registry: ${plugin.name} versionSurfaces.packageJson declares ${plugin.versionSurfaces.packageJson} for an independent npm release`,
      );
    }
  }
}

function validateMeaningfulReleaseString(pluginName: string, field: string, value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`registry: ${pluginName} releaseIdentity.${field} must be a nonempty meaningful string`);
  }
}

function validateReleasePath(
  pluginName: string,
  field: string,
  declared: string,
  repoRoot: string,
  kind: "file" | "directory",
): void {
  if (typeof declared !== "string" || declared.length === 0) {
    throw new Error(`registry: ${pluginName} releaseIdentity.${field} is missing`);
  }
  const absolute = path.join(repoRoot, declared);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolute);
  } catch {
    throw new Error(`registry: ${pluginName} releaseIdentity.${field} declares ${declared}, which does not exist`);
  }
  if ((kind === "file" && !stat.isFile()) || (kind === "directory" && !stat.isDirectory())) {
    throw new Error(`registry: ${pluginName} releaseIdentity.${field} declares ${declared}, which is not a ${kind}`);
  }
}

function readVersionManifest(
  pluginName: string,
  declared: string,
  repoRoot: string,
): { name?: unknown; version?: unknown } {
  const parsed = JSON.parse(fs.readFileSync(path.join(repoRoot, declared), "utf8")) as {
    name?: unknown;
    version?: unknown;
  };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`registry: ${pluginName} release manifest ${declared} has no string version`);
  }
  return parsed;
}

const REGISTRY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../registry/plugins.json");

/** packages/plugin-layout-checks/registry -> the repository root. */
const REPO_ROOT = path.resolve(path.dirname(REGISTRY_PATH), "../../..");

function load(): Registry {
  const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8")) as Registry;
  // Absent, the allow-list would silently admit `undefined` as a target path.
  if (typeof parsed.sharedOpencodeRoot !== "string" || parsed.sharedOpencodeRoot.length === 0) {
    throw new Error("registry: sharedOpencodeRoot is missing");
  }
  // A missing field would otherwise reach an assertion as `undefined` and
  // compare equal to another `undefined`, turning a gate green by absence.
  for (const plugin of parsed.plugins) {
    for (const field of ["name", "skillsSrc", "claudePluginRoot", "codexPluginRoot", "opencodePluginRoot"] as const) {
      if (typeof plugin[field] !== "string" || plugin[field].length === 0) {
        throw new Error(`registry: ${plugin.name ?? "<unnamed>"} is missing ${field}`);
      }
    }
    if (!Array.isArray(plugin.skills) || plugin.skills.length === 0) {
      throw new Error(`registry: ${plugin.name} declares no skills`);
    }
    // A declared surface pointing at nothing is worse than an undeclared one:
    // every gate that iterates the declarations reports it converged.
    const surfaces = plugin.versionSurfaces;
    const declaredPaths = [
      surfaces.source,
      surfaces.codexManifest,
      surfaces.opencodePackage,
      ...(surfaces.antigravityManifest ? [surfaces.antigravityManifest] : []),
      ...(surfaces.packageJson ? [surfaces.packageJson] : []),
      ...(surfaces.literals ?? []).map((literal) => literal.path),
    ];
    for (const declared of declaredPaths) {
      if (typeof declared !== "string" || !fs.existsSync(path.join(REPO_ROOT, declared))) {
        throw new Error(`registry: ${plugin.name} declares version surface ${declared}, which does not exist`);
      }
    }
    if (!Array.isArray(plugin.lintSuppressions)) {
      throw new Error(`registry: ${plugin.name} is missing lintSuppressions`);
    }
    if (!Array.isArray(plugin.lintBaseline?.diagnostics) || typeof plugin.lintBaseline.reason !== "string") {
      throw new Error(`registry: ${plugin.name} is missing lintBaseline`);
    }
    // A skillPlatforms key naming a skill the plugin does not ship would
    // silently restrict nothing, leaving the tree it was meant to exclude
    // asserted against the full list and the gate green for the wrong reason.
    for (const skill of Object.keys(plugin.skillPlatforms ?? {})) {
      if (!plugin.skills.includes(skill)) {
        throw new Error(`registry: ${plugin.name} restricts unknown skill ${skill}`);
      }
    }
    const antigravityTarget = plugin.targets.find((target) => target.platform === "antigravity");
    if (antigravityTarget && (!plugin.antigravityPluginRoot || plugin.antigravityPluginRoot.length === 0)) {
      throw new Error(`registry: ${plugin.name} requires antigravityPluginRoot for its Antigravity target`);
    }
    if (antigravityTarget && !plugin.versionSurfaces.antigravityManifest) {
      throw new Error(`registry: ${plugin.name} requires versionSurfaces.antigravityManifest for its Antigravity target`);
    }
    // The platforms a plugin declares targets for must be exactly the platforms
    // its skills render to. Requiring all three instead is what put voice's
    // empty Codex and OpenCode trees in the registry: nothing rendered into
    // them, git cannot store an empty directory, and so they existed only on
    // machines that had already run a build.
    const defaultPlatforms: Platform[] = antigravityTarget
      ? ["claude-code", "codex", "opencode", "antigravity"]
      : ["claude-code", "codex", "opencode"];
    const rendered = new Set<Platform>(
      plugin.skills.flatMap((skill): Platform[] => plugin.skillPlatforms?.[skill] ?? defaultPlatforms),
    );
    const declared = new Set(plugin.targets.map((target) => target.platform));
    for (const platform of rendered) {
      if (!declared.has(platform)) {
        throw new Error(`registry: ${plugin.name} renders to ${platform} but declares no ${platform} target`);
      }
    }
    for (const platform of declared) {
      if (!rendered.has(platform)) {
        throw new Error(
          `registry: ${plugin.name} declares a ${platform} target but no skill renders there, ` +
            `so the tree would be published empty and could not be committed`,
        );
      }
    }
  }
  validateReleaseIdentities(parsed, REPO_ROOT);
  return parsed;
}

export const REGISTRY: Registry = load();

export const PLUGINS: RegistryPlugin[] = REGISTRY.plugins;

export function pluginNamed(name: string): RegistryPlugin {
  const found = PLUGINS.find((plugin) => plugin.name === name);
  if (!found) throw new Error(`registry: no plugin named ${name}`);
  return found;
}

/** Every declared output tree, flattened across plugins. */
export function allTargets(): (RegistryTarget & { plugin: string })[] {
  return PLUGINS.flatMap((plugin) => plugin.targets.map((target) => ({ ...target, plugin: plugin.name })));
}

/**
 * The exact top-level skill names one target's tree carries, after applying
 * any front-config platform restriction. Equals `plugin.skills` for every
 * plugin that restricts nothing.
 */
export function skillsInTarget(plugin: RegistryPlugin, platform: Platform): string[] {
  return plugin.skills.filter((skill) => plugin.skillPlatforms?.[skill]?.includes(platform) ?? true);
}

/**
 * The repo-root tree OpenCode reads without a plugin installed. The only
 * target path that is not a `<pluginRoot>/skills` leaf, and the only reason
 * the allow-list needs an exception at all.
 *
 * Declared in the registry rather than written here so the build driver's
 * copy of the allow-list and this one cannot drift into disagreeing about
 * which paths are safe to publish into.
 */
export const SHARED_OPENCODE_ROOT: string = REGISTRY.sharedOpencodeRoot;

/**
 * Every path a plugin is permitted to publish into.
 *
 * An allow-list rather than a deny-list because the failure it guards is
 * unbounded: materializeAll() replaces a target by renaming the whole
 * directory away, so any path that is not a skills leaf destroys whatever
 * else lives there. Enumerating the safe shapes leaves an unanticipated
 * shape rejected by default; enumerating the unsafe ones leaves it published.
 */
export function allowedTargetPaths(plugin: RegistryPlugin): Set<string> {
  const paths = [
    `${plugin.claudePluginRoot}/skills`,
    `${plugin.codexPluginRoot}/skills`,
    `${plugin.opencodePluginRoot}/skills`,
    SHARED_OPENCODE_ROOT,
  ];
  if (plugin.antigravityPluginRoot) paths.push(`${plugin.antigravityPluginRoot}/skills`);
  return new Set(paths);
}

const FRONT_OPEN = "<!-- agent-skills\n";
const FRONT_CLOSE = "-->";

interface FrontConfigSuppression {
  rule: string;
  lines: [number, number];
}

/**
 * Reads a template's front-config `lintSuppressions`, using the same
 * delimiters and YAML parse the compiler's own parseFrontConfig uses.
 *
 * The compiler does not export that function, so this reproduces the read
 * rather than importing it. The duplication is confined to locating and
 * parsing the block: the assertion that matters compares this derived set
 * against the registry's declared set, so a divergence in either direction
 * fails rather than passing quietly.
 */
export function frontConfigSuppressions(templateText: string): FrontConfigSuppression[] {
  if (!templateText.startsWith(FRONT_OPEN)) return [];
  const close = templateText.indexOf(FRONT_CLOSE, FRONT_OPEN.length);
  if (close < 0) throw new Error("Unterminated agent-skills front-config");
  const parsed: unknown = parseYaml(templateText.slice(FRONT_OPEN.length, close));
  if (!parsed || typeof parsed !== "object") return [];
  const suppressions = (parsed as { lintSuppressions?: unknown }).lintSuppressions;
  if (suppressions === undefined) return [];
  if (!Array.isArray(suppressions)) throw new Error("front-config lintSuppressions must be a list");
  return suppressions as FrontConfigSuppression[];
}

/**
 * The suppression inventory a plugin's templates actually declare, as
 * `<template-relative-path>:<start>-<end>:<rule>`.
 *
 * Derived by walking the templates rather than read from the registry, so the
 * registry's declared list is checked against the source of truth instead of
 * against itself. A count-only check cannot see a declared entry whose path
 * matches no template.
 */
export function derivedSuppressions(plugin: RegistryPlugin, repoRoot: string): string[] {
  const root = path.join(repoRoot, plugin.skillsSrc);
  const walk = (dir: string, prefix = ""): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? walk(path.join(dir, entry.name), rel) : [rel];
    });

  return walk(root)
    .filter((rel) => rel.endsWith(".md.eta"))
    .flatMap((rel) =>
      frontConfigSuppressions(fs.readFileSync(path.join(root, rel), "utf8")).map(
        (suppression) => `${rel}:${suppression.lines[0]}-${suppression.lines[1]}:${suppression.rule}`,
      ),
    )
    .sort();
}

/**
 * Every declared version surface that disagrees with the plugin's source of
 * truth, described well enough to name the file in a failure message.
 *
 * Derived from versionSurfaces rather than from a list written here, so the
 * lockstep gate and scripts/sync-plugin-versions.sh cannot disagree about what
 * a release surface is. They disagreed once already: six machine-writable
 * surfaces were declared and propagated while the two CHANGELOGs a user
 * actually opens were known to neither, so `--check` reported convergence at
 * 1.0.12 over files that still ended at 1.0.11.
 *
 * The changelog arm shells out to the same scripts/check-changelog-entry.mjs
 * the shell script calls, so "has a real entry" has one definition.
 */
export function versionDrift(plugin: RegistryPlugin, repoRoot: string): string[] {
  const surfaces = plugin.versionSurfaces;
  const readJson = (rel: string): { version?: string } =>
    JSON.parse(fs.readFileSync(path.join(repoRoot, rel), "utf8")) as { version?: string };

  const expected = readJson(surfaces.source).version;
  if (expected === undefined || !/^\d+\.\d+\.\d+$/.test(expected)) {
    return [`${surfaces.source} carries no parseable version`];
  }

  const drift: string[] = [];
  const jsonSurfaces = [
    surfaces.codexManifest,
    surfaces.opencodePackage,
    ...(surfaces.antigravityManifest ? [surfaces.antigravityManifest] : []),
    ...(surfaces.packageJson ? [surfaces.packageJson] : []),
  ];
  for (const rel of jsonSurfaces) {
    const found = readJson(rel).version;
    if (found !== expected) drift.push(`${rel}=${found} (expected ${expected})`);
  }

  const marketplacePath = ".claude-plugin/marketplace.json";
  const marketplace = JSON.parse(fs.readFileSync(path.join(repoRoot, marketplacePath), "utf8")) as {
    plugins: { name: string; version?: string }[];
  };
  const entry = marketplace.plugins.find((candidate) => candidate.name === plugin.marketplace.claude);
  if (!entry) drift.push(`${marketplacePath} has no ${plugin.marketplace.claude} entry`);
  else if (entry.version !== expected)
    drift.push(`${marketplacePath} ${entry.name}=${entry.version} (expected ${expected})`);

  for (const literal of surfaces.literals ?? []) {
    const text = fs.readFileSync(path.join(repoRoot, literal.path), "utf8");
    const found = new RegExp(literal.match).exec(text)?.[1];
    if (found === undefined) drift.push(`${literal.path} matched no version literal`);
    else if (found !== expected) drift.push(`${literal.path}=${found} (expected ${expected})`);
  }

  for (const changelog of changelogSurfaces(plugin, repoRoot)) {
    const npmIdentity = plugin.releaseIdentity.npm;
    const identity =
      npmIdentity && changelog === `${npmIdentity.authoritativeRoot}/CHANGELOG.md`
        ? { label: npmIdentity.label, versionSource: npmIdentity.packageJson }
        : { label: plugin.releaseIdentity.plugin.label, versionSource: surfaces.source };
    const result = spawnSync(
      process.execPath,
      // surfaces.source relative, with repoRoot as cwd: the script reads that
      // path's git history, so it has to be spelled the way git spells it.
      [
        path.join(repoRoot, "scripts/check-changelog-entry.mjs"),
        path.join(repoRoot, changelog),
        expected,
        identity.label,
        identity.versionSource,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) drift.push(`${changelog}: ${(result.stderr ?? "").trim()}`);
  }

  return drift;
}

/**
 * The plugin's release-note files, from scripts/changelog-surfaces.mjs — the
 * one definition the hook and sync-plugin-versions.sh also read.
 *
 * Presence on disk, not a registry field. The field existed and was filled in
 * for agent-skills alone, so every gate that iterated it reported success for
 * the other seven plugins by iterating an empty array; agent-hooks shipped
 * 1.0.3 against a changelog ending at 1.0.0 with nothing to say so. Deriving it
 * also means there is no declared-versus-existing pair left to keep in sync.
 */
export function changelogSurfaces(plugin: RegistryPlugin, repoRoot: string): string[] {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts/changelog-surfaces.mjs"), "plugin-release", plugin.name],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(`changelog-surfaces failed for ${plugin.name}: ${(result.stderr ?? "").trim()}`);
  }
  return result.stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => (JSON.parse(line) as { path: string }).path);
}

/** OpenCode roots that opencode.json's skills.paths must list, exactly. */
export function registeredOpencodeRoots(): string[] {
  return allTargets()
    .filter((target) => target.platform === "opencode" && target.opencodeRegistered === true)
    .map((target) => `./${target.path}`);
}
