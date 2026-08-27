import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The bundler-managed plugin registry: the single declared source for every
 * path, tree, and marketplace surface the layout gates, the build driver, the
 * version sync script, and CI derive their work from.
 *
 * Values are declared, never computed, so a gate comparing a declaration
 * against the filesystem is comparing two independent things.
 */

export type Platform = "claude-code" | "codex" | "opencode";

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

export interface RegistryPlugin {
  name: string;
  /** Authored Eta templates for this plugin. */
  skillsSrc: string;
  /** Claude Code plugin home: holds the manifest and any hand-maintained siblings. */
  claudePluginRoot: string;
  codexPluginRoot: string;
  opencodePluginRoot: string;
  targets: RegistryTarget[];
  /** `--platform-dir` flags, as `<platform>:<kind>=<path>` strings. */
  platformDirs: string[];
  /** Exact top-level skill directory names in every one of this plugin's trees. */
  skills: string[];
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
  versionSurfaces: {
    /** Source of truth the other surfaces are synced from. */
    source: string;
    codexManifest: string;
    opencodePackage: string;
  };
  /** `<file>:<lineRange>:<rule>` sites, counted against the suppression budget. */
  lintSuppressions: string[];
}

export interface UnmanagedPlugin {
  name: string;
  reason: string;
}

export interface Registry {
  /** Pinned total of lintSuppressions entries across every plugin. */
  lintSuppressionBudget: number;
  plugins: RegistryPlugin[];
  /** Marketplace plugins that are deliberately not bundler-managed. */
  unmanaged: UnmanagedPlugin[];
}

const REGISTRY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../registry/plugins.json");

function load(): Registry {
  const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8")) as Registry;
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
    if (!Array.isArray(plugin.lintSuppressions)) {
      throw new Error(`registry: ${plugin.name} is missing lintSuppressions`);
    }
    for (const platform of ["claude-code", "codex", "opencode"] as const) {
      if (!plugin.targets.some((target) => target.platform === platform)) {
        throw new Error(`registry: ${plugin.name} declares no ${platform} target`);
      }
    }
  }
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

/** OpenCode roots that opencode.json's skills.paths must list, exactly. */
export function registeredOpencodeRoots(): string[] {
  return allTargets()
    .filter((target) => target.platform === "opencode" && target.opencodeRegistered === true)
    .map((target) => `./${target.path}`);
}
