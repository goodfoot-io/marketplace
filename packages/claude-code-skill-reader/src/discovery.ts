import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { SkillReaderError } from "./errors.js";
import type { InstalledPluginsRegistry, SkillLocation } from "./types.js";

/**
 * Splits a skill name into an optional plugin name and skill name.
 * Format: "plugin:skill" or "skill"
 */
export function splitSkillName(name: string): {
	pluginName: string | undefined;
	skillName: string;
} {
	if (name.includes("..")) {
		throw new SkillReaderError(
			"INVALID_ARGS",
			"Skill name must not contain '..'",
		);
	}

	const colonIndex = name.indexOf(":");
	if (colonIndex === -1) {
		return { pluginName: undefined, skillName: name };
	}

	const pluginName = name.slice(0, colonIndex);
	const skillName = name.slice(colonIndex + 1);
	return { pluginName, skillName };
}

/**
 * Discovers a plain (non-plugin) skill by searching project and user skill directories.
 * Returns the first match found, or undefined if not found.
 */
export function discoverSkill(
	name: string,
	cwd: string,
): SkillLocation | undefined {
	const searchPaths = [
		join(cwd, ".claude", "skills", name, "SKILL.md"),
		join(cwd, ".claude", "commands", `${name}.md`),
		join(homedir(), ".claude", "skills", name, "SKILL.md"),
		join(homedir(), ".claude", "commands", `${name}.md`),
	];

	for (const skillPath of searchPaths) {
		if (existsSync(skillPath)) {
			return {
				path: skillPath,
				baseDir: dirname(skillPath),
				pluginRoot: undefined,
			};
		}
	}

	return undefined;
}

/**
 * Discovers a plugin skill by reading the installed plugins registry.
 * Returns the first match found, or undefined if not found.
 */
export function discoverPluginSkill(
	pluginName: string,
	skillName: string,
): SkillLocation | undefined {
	const registryPath = join(
		homedir(),
		".claude",
		"plugins",
		"installed_plugins.json",
	);

	if (!existsSync(registryPath)) {
		return undefined;
	}

	let registry: InstalledPluginsRegistry;
	try {
		const content = readFileSync(registryPath, "utf8");
		registry = JSON.parse(content) as InstalledPluginsRegistry;
	} catch {
		return undefined;
	}

	const prefix = `${pluginName}@`;
	for (const [key, records] of Object.entries(registry.plugins)) {
		if (!key.startsWith(prefix)) {
			continue;
		}
		for (const record of records) {
			const candidates = [
				join(record.installPath, "skills", skillName, "SKILL.md"),
				join(record.installPath, "commands", `${skillName}.md`),
			];
			for (const candidatePath of candidates) {
				if (existsSync(candidatePath)) {
					return {
						path: candidatePath,
						baseDir: dirname(candidatePath),
						pluginRoot: record.installPath,
					};
				}
			}
		}
	}

	return undefined;
}

/**
 * Picks the highest semver version directory from a list of directory names.
 * Returns the highest semver version, or the first non-semver entry if no semver found, or undefined if empty.
 */
function pickHighestSemverDir(dirs: string[]): string | undefined {
	if (dirs.length === 0) {
		return undefined;
	}

	const isSemver = (dir: string): boolean => {
		const parts = dir.split(".");
		return parts.length === 3 && parts.every((p) => /^\d+$/.test(p));
	};

	const semverDirs = dirs.filter(isSemver);
	if (semverDirs.length === 0) {
		return dirs[0];
	}

	semverDirs.sort((a, b) => {
		const [aMaj, aMin, aPat] = a.split(".").map(Number);
		const [bMaj, bMin, bPat] = b.split(".").map(Number);
		if (aMaj !== bMaj) return bMaj - aMaj;
		if (aMin !== bMin) return bMin - aMin;
		return bPat - aPat;
	});

	return semverDirs[0];
}

/**
 * Discovers a skill by scanning the plugin cache directory at ~/.claude/plugins/cache/.
 * Returns the first match found in the highest semver version, or undefined if not found.
 */
export function discoverCachedSkill(
	pluginName: string | undefined,
	skillName: string,
): SkillLocation | undefined {
	const cacheDir = join(homedir(), ".claude", "plugins", "cache");

	if (!existsSync(cacheDir)) {
		return undefined;
	}

	const marketplaceDirs = readdirSync(cacheDir);
	for (const marketplace of marketplaceDirs) {
		const marketplaceDir = join(cacheDir, marketplace);
		const pluginDirs = readdirSync(marketplaceDir);

		for (const plugin of pluginDirs) {
			if (pluginName !== undefined && plugin !== pluginName) {
				continue;
			}

			const pluginDir = join(marketplaceDir, plugin);
			const versionDirNames = readdirSync(pluginDir);
			const orderedVersions: string[] = [];

			const highest = pickHighestSemverDir(versionDirNames);
			if (highest !== undefined) {
				orderedVersions.push(highest);
				for (const v of versionDirNames) {
					if (v !== highest) {
						orderedVersions.push(v);
					}
				}
			}

			for (const version of orderedVersions) {
				const versionDir = join(pluginDir, version);
				const candidates = [
					join(versionDir, "skills", skillName, "SKILL.md"),
					join(versionDir, "commands", `${skillName}.md`),
				];
				for (const candidatePath of candidates) {
					if (existsSync(candidatePath)) {
						return {
							path: candidatePath,
							baseDir: dirname(candidatePath),
							pluginRoot: versionDir,
						};
					}
				}
			}
		}
	}

	return undefined;
}
