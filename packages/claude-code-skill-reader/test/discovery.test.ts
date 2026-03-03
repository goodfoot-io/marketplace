import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	discoverCachedSkill,
	discoverPluginSkill,
	discoverSkill,
	splitSkillName,
} from "../src/discovery.js";
import { SkillReaderError } from "../src/errors.js";

// Mutable holder for the homedir stub - updated per test
let _mockHomeDir = tmpdir();

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return {
		...actual,
		homedir: () => _mockHomeDir,
	};
});

describe("splitSkillName", () => {
	it("splits plugin:skill into pluginName and skillName", () => {
		const result = splitSkillName("my-plugin:my-skill");
		expect(result).toEqual({ pluginName: "my-plugin", skillName: "my-skill" });
	});

	it("splits plain name into undefined pluginName and skillName", () => {
		const result = splitSkillName("my-skill");
		expect(result).toEqual({ pluginName: undefined, skillName: "my-skill" });
	});

	it("rejects skill names containing .. (path traversal)", () => {
		expect(() => splitSkillName("../evil")).toThrow(SkillReaderError);
		expect(() => splitSkillName("../evil")).toThrow(
			"Skill name must not contain '..'",
		);
	});
});

describe("discoverSkill", () => {
	let tmpDir: string;
	let homeDirStub: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-test-"));
		homeDirStub = mkdtempSync(join(tmpdir(), "skill-reader-home-"));
		_mockHomeDir = homeDirStub;
	});

	afterEach(() => {
		_mockHomeDir = tmpdir();
		rmSync(tmpDir, { recursive: true, force: true });
		rmSync(homeDirStub, { recursive: true, force: true });
	});

	it("finds skill in project .claude/skills/{name}/SKILL.md", () => {
		const skillDir = join(tmpDir, ".claude", "skills", "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# My Skill");

		const result = discoverSkill("my-skill", tmpDir);
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(skillDir, "SKILL.md"));
		expect(result?.baseDir).toBe(skillDir);
		expect(result?.pluginRoot).toBeUndefined();
	});

	it("finds skill in user ~/.claude/skills/{name}/SKILL.md", () => {
		const skillDir = join(homeDirStub, ".claude", "skills", "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# My Skill");

		const result = discoverSkill("my-skill", tmpDir);
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(skillDir, "SKILL.md"));
		expect(result?.baseDir).toBe(skillDir);
		expect(result?.pluginRoot).toBeUndefined();
	});

	it("project skills take priority over user skills", () => {
		const projectSkillDir = join(tmpDir, ".claude", "skills", "my-skill");
		mkdirSync(projectSkillDir, { recursive: true });
		writeFileSync(join(projectSkillDir, "SKILL.md"), "# Project Skill");

		const userSkillDir = join(homeDirStub, ".claude", "skills", "my-skill");
		mkdirSync(userSkillDir, { recursive: true });
		writeFileSync(join(userSkillDir, "SKILL.md"), "# User Skill");

		const result = discoverSkill("my-skill", tmpDir);
		expect(result?.path).toBe(join(projectSkillDir, "SKILL.md"));
	});

	it("finds command in project .claude/commands/{name}.md", () => {
		const commandsDir = join(tmpDir, ".claude", "commands");
		mkdirSync(commandsDir, { recursive: true });
		writeFileSync(join(commandsDir, "my-cmd.md"), "# My Command");

		const result = discoverSkill("my-cmd", tmpDir);
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(commandsDir, "my-cmd.md"));
		expect(result?.baseDir).toBe(commandsDir);
		expect(result?.pluginRoot).toBeUndefined();
	});

	it("finds command in user ~/.claude/commands/{name}.md", () => {
		const commandsDir = join(homeDirStub, ".claude", "commands");
		mkdirSync(commandsDir, { recursive: true });
		writeFileSync(join(commandsDir, "my-cmd.md"), "# My Command");

		const result = discoverSkill("my-cmd", tmpDir);
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(commandsDir, "my-cmd.md"));
		expect(result?.baseDir).toBe(commandsDir);
		expect(result?.pluginRoot).toBeUndefined();
	});

	it("skills take priority over commands", () => {
		const skillDir = join(tmpDir, ".claude", "skills", "my-name");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# Skill");

		const commandsDir = join(tmpDir, ".claude", "commands");
		mkdirSync(commandsDir, { recursive: true });
		writeFileSync(join(commandsDir, "my-name.md"), "# Command");

		const result = discoverSkill("my-name", tmpDir);
		expect(result?.path).toBe(join(skillDir, "SKILL.md"));
	});

	it("returns undefined for non-existent skill", () => {
		const result = discoverSkill("does-not-exist", tmpDir);
		expect(result).toBeUndefined();
	});
});

describe("discoverPluginSkill", () => {
	let homeDirStub: string;

	beforeEach(() => {
		homeDirStub = mkdtempSync(join(tmpdir(), "skill-reader-home-"));
		_mockHomeDir = homeDirStub;
	});

	afterEach(() => {
		_mockHomeDir = tmpdir();
		rmSync(homeDirStub, { recursive: true, force: true });
	});

	it("resolves plugin:skill by reading installed_plugins.json and scanning plugin cache", () => {
		const pluginInstallPath = join(homeDirStub, "plugin-cache", "my-plugin");
		const skillDir = join(pluginInstallPath, "skills", "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# Plugin Skill");

		const registry = {
			version: 2,
			plugins: {
				"my-plugin@marketplace": [
					{
						scope: "user",
						installPath: pluginInstallPath,
						version: "1.0.0",
					},
				],
			},
		};

		const pluginsDir = join(homeDirStub, ".claude", "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		writeFileSync(
			join(pluginsDir, "installed_plugins.json"),
			JSON.stringify(registry),
		);

		const result = discoverPluginSkill("my-plugin", "my-skill");
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(skillDir, "SKILL.md"));
		expect(result?.baseDir).toBe(skillDir);
		expect(result?.pluginRoot).toBe(pluginInstallPath);
	});

	it("returns undefined when installed_plugins.json does not exist", () => {
		const result = discoverPluginSkill("my-plugin", "my-skill");
		expect(result).toBeUndefined();
	});

	it("returns undefined when installed_plugins.json is malformed JSON", () => {
		const pluginsDir = join(homeDirStub, ".claude", "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		writeFileSync(
			join(pluginsDir, "installed_plugins.json"),
			"{ this is not valid json }",
		);

		const result = discoverPluginSkill("my-plugin", "my-skill");
		expect(result).toBeUndefined();
	});

	it("resolves plugin command from commands/{name}.md", () => {
		const pluginInstallPath = join(homeDirStub, "plugin-cache", "my-plugin");
		const commandsDir = join(pluginInstallPath, "commands");
		mkdirSync(commandsDir, { recursive: true });
		writeFileSync(join(commandsDir, "my-cmd.md"), "# Plugin Command");

		const registry = {
			version: 2,
			plugins: {
				"my-plugin@marketplace": [
					{
						scope: "user",
						installPath: pluginInstallPath,
						version: "1.0.0",
					},
				],
			},
		};

		const pluginsDir = join(homeDirStub, ".claude", "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		writeFileSync(
			join(pluginsDir, "installed_plugins.json"),
			JSON.stringify(registry),
		);

		const result = discoverPluginSkill("my-plugin", "my-cmd");
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(commandsDir, "my-cmd.md"));
		expect(result?.baseDir).toBe(commandsDir);
		expect(result?.pluginRoot).toBe(pluginInstallPath);
	});
});

describe("discoverCachedSkill", () => {
	let homeDirStub: string;

	beforeEach(() => {
		homeDirStub = mkdtempSync(join(tmpdir(), "skill-reader-home-"));
		_mockHomeDir = homeDirStub;
	});

	afterEach(() => {
		_mockHomeDir = tmpdir();
		rmSync(homeDirStub, { recursive: true, force: true });
	});

	it("finds plugin skill in cache at {marketplace}/{pluginName}/{version}/skills/{skillName}/SKILL.md", () => {
		const versionDir = join(
			homeDirStub,
			".claude",
			"plugins",
			"cache",
			"goodfoot",
			"my-plugin",
			"1.0.0",
		);
		const skillDir = join(versionDir, "skills", "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# Plugin Skill");

		const result = discoverCachedSkill("my-plugin", "my-skill");
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(skillDir, "SKILL.md"));
		expect(result?.baseDir).toBe(skillDir);
		expect(result?.pluginRoot).toBe(versionDir);
	});

	it("finds plugin command in cache at {marketplace}/{pluginName}/{version}/commands/{skillName}.md", () => {
		const versionDir = join(
			homeDirStub,
			".claude",
			"plugins",
			"cache",
			"goodfoot",
			"my-plugin",
			"1.0.0",
		);
		const commandsDir = join(versionDir, "commands");
		mkdirSync(commandsDir, { recursive: true });
		writeFileSync(join(commandsDir, "my-cmd.md"), "# Plugin Command");

		const result = discoverCachedSkill("my-plugin", "my-cmd");
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(commandsDir, "my-cmd.md"));
		expect(result?.baseDir).toBe(commandsDir);
		expect(result?.pluginRoot).toBe(versionDir);
	});

	it("selects highest semver version when multiple versions exist", () => {
		const cacheBase = join(
			homeDirStub,
			".claude",
			"plugins",
			"cache",
			"goodfoot",
			"my-plugin",
		);
		for (const version of ["1.0.4", "1.0.71", "1.0.72"]) {
			const skillDir = join(cacheBase, version, "skills", "my-skill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(join(skillDir, "SKILL.md"), `# Skill ${version}`);
		}

		const result = discoverCachedSkill("my-plugin", "my-skill");
		expect(result).toBeDefined();
		expect(result?.pluginRoot).toBe(join(cacheBase, "1.0.72"));
	});

	it("prefers semver versions over non-semver (git hash) directories", () => {
		const cacheBase = join(
			homeDirStub,
			".claude",
			"plugins",
			"cache",
			"goodfoot",
			"my-plugin",
		);
		const gitHash = "abc1234def5678";
		for (const version of [gitHash, "1.0.5"]) {
			const skillDir = join(cacheBase, version, "skills", "my-skill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(join(skillDir, "SKILL.md"), `# Skill ${version}`);
		}

		const result = discoverCachedSkill("my-plugin", "my-skill");
		expect(result).toBeDefined();
		expect(result?.pluginRoot).toBe(join(cacheBase, "1.0.5"));
	});

	it("returns undefined when cache directory doesn't exist", () => {
		const result = discoverCachedSkill("my-plugin", "my-skill");
		expect(result).toBeUndefined();
	});

	it("finds plain skill (no pluginName) by scanning all {marketplace}/{plugin}/{version}/ directories", () => {
		const versionDir = join(
			homeDirStub,
			".claude",
			"plugins",
			"cache",
			"goodfoot",
			"some-plugin",
			"2.1.0",
		);
		const skillDir = join(versionDir, "skills", "plain-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# Plain Skill");

		const result = discoverCachedSkill(undefined, "plain-skill");
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(skillDir, "SKILL.md"));
		expect(result?.baseDir).toBe(skillDir);
		expect(result?.pluginRoot).toBe(versionDir);
	});

	it("returns undefined when no match found in cache", () => {
		const versionDir = join(
			homeDirStub,
			".claude",
			"plugins",
			"cache",
			"goodfoot",
			"my-plugin",
			"1.0.0",
		);
		const skillDir = join(versionDir, "skills", "other-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# Other Skill");

		const result = discoverCachedSkill("my-plugin", "missing-skill");
		expect(result).toBeUndefined();
	});

	it("scans across multiple marketplace directories", () => {
		const cacheBase = join(homeDirStub, ".claude", "plugins", "cache");
		// Put skill in second marketplace
		const versionDir = join(
			cacheBase,
			"marketplace-b",
			"their-plugin",
			"3.0.0",
		);
		const skillDir = join(versionDir, "skills", "shared-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# Shared Skill");

		// Also create an empty marketplace-a directory
		mkdirSync(join(cacheBase, "marketplace-a"), { recursive: true });

		const result = discoverCachedSkill("their-plugin", "shared-skill");
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(skillDir, "SKILL.md"));
		expect(result?.baseDir).toBe(skillDir);
		expect(result?.pluginRoot).toBe(versionDir);
	});

	it("returns a result when all versions are non-semver (git hashes only)", () => {
		const cacheBase = join(
			homeDirStub,
			".claude",
			"plugins",
			"cache",
			"goodfoot",
			"my-plugin",
		);
		const gitHash = "deadbeefcafe1234";
		const skillDir = join(cacheBase, gitHash, "skills", "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# Git Hash Skill");

		const result = discoverCachedSkill("my-plugin", "my-skill");
		expect(result).toBeDefined();
		expect(result?.pluginRoot).toBe(join(cacheBase, gitHash));
	});

	it("skips version directories that don't contain the requested skill", () => {
		const cacheBase = join(
			homeDirStub,
			".claude",
			"plugins",
			"cache",
			"goodfoot",
			"my-plugin",
		);
		// Only 1.0.1 has the skill, 1.0.2 does not
		const skillDir = join(cacheBase, "1.0.1", "skills", "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# My Skill 1.0.1");
		// 1.0.2 exists but doesn't have the skill
		mkdirSync(join(cacheBase, "1.0.2"), { recursive: true });

		const result = discoverCachedSkill("my-plugin", "my-skill");
		expect(result).toBeDefined();
		expect(result?.pluginRoot).toBe(join(cacheBase, "1.0.1"));
	});
});
