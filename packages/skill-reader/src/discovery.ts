import { existsSync, readFileSync } from "node:fs";
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
		join(homedir(), ".claude", "skills", name, "SKILL.md"),
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
			const skillPath = join(
				record.installPath,
				"skills",
				skillName,
				"SKILL.md",
			);
			if (existsSync(skillPath)) {
				return {
					path: skillPath,
					baseDir: dirname(skillPath),
					pluginRoot: record.installPath,
				};
			}
		}
	}

	return undefined;
}
