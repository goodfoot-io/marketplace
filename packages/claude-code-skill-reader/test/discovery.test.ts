import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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
