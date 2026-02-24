import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillReaderError } from "../src/errors.js";
import {
	fetchGithubSource,
	fetchGitSource,
	fetchUrlSource,
	findSkillInMarketplace,
	resolveMarketplace,
	withTempDir,
} from "../src/marketplace.js";

// Suppress unused import warnings
void execSync;

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

describe("withTempDir", () => {
	it("creates temp directory and cleans up on completion", () => {
		let capturedDir = "";
		const result = withTempDir((dir) => {
			capturedDir = dir;
			expect(existsSync(dir)).toBe(true);
			return "done";
		});
		expect(result).toBe("done");
		expect(existsSync(capturedDir)).toBe(false);
	});

	it("cleans up on error", () => {
		let capturedDir = "";
		expect(() => {
			withTempDir((dir) => {
				capturedDir = dir;
				throw new Error("test error");
			});
		}).toThrow("test error");
		expect(existsSync(capturedDir)).toBe(false);
	});
});

describe("fetchGithubSource", () => {
	it("github source clones repo via git (mock execSync)", () => {
		const mockExecSync = vi.mocked(execSync);
		mockExecSync.mockImplementation(() => Buffer.from(""));

		fetchGithubSource("myorg/myrepo", "/tmp/target");

		expect(mockExecSync).toHaveBeenCalledWith(
			"git clone --depth 1 git@github.com:myorg/myrepo.git /tmp/target",
			{ stdio: "pipe" },
		);
	});
});

describe("fetchGitSource", () => {
	it("git source clones url via git (mock execSync)", () => {
		const mockExecSync = vi.mocked(execSync);
		mockExecSync.mockImplementation(() => Buffer.from(""));

		fetchGitSource("https://example.com/repo.git", "/tmp/target");

		expect(mockExecSync).toHaveBeenCalledWith(
			"git clone --depth 1 https://example.com/repo.git /tmp/target",
			{ stdio: "pipe" },
		);
	});
});

describe("fetchUrlSource", () => {
	it("url source fetches via curl (mock execSync)", () => {
		const mockExecSync = vi.mocked(execSync);
		mockExecSync.mockImplementation(() => Buffer.from(""));

		fetchUrlSource(
			"https://example.com/marketplace.json",
			"/tmp/marketplace.json",
		);

		expect(mockExecSync).toHaveBeenCalledWith(
			"curl -sL -o /tmp/marketplace.json https://example.com/marketplace.json",
		);
	});
});

describe("resolveMarketplace", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "skill-reader-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("resolves directory source to local path", () => {
		const localDir = join(tempDir, "marketplace");
		mkdirSync(localDir);

		const result = resolveMarketplace(
			{ source: "directory", path: localDir },
			tempDir,
		);
		expect(result).toBe(localDir);
	});

	it("resolves file source to parent directory", () => {
		const fileDir = join(tempDir, "marketplace");
		mkdirSync(fileDir);
		const filePath = join(fileDir, "marketplace.json");
		writeFileSync(filePath, JSON.stringify({ name: "test", plugins: [] }));

		const result = resolveMarketplace(
			{ source: "file", path: filePath },
			tempDir,
		);
		expect(result).toBe(fileDir);
	});

	it("throws SkillReaderError for non-existent directory source path", () => {
		const nonExistentDir = join(tempDir, "does-not-exist");

		expect(() => {
			resolveMarketplace(
				{ source: "directory", path: nonExistentDir },
				tempDir,
			);
		}).toThrow(SkillReaderError);
	});
});

describe("findSkillInMarketplace", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "skill-reader-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("reads marketplace.json and finds plugin by name", () => {
		const pluginDir = join(tempDir, "myplugin");
		const skillsDir = join(pluginDir, "skills", "myskill");
		mkdirSync(skillsDir, { recursive: true });
		writeFileSync(join(skillsDir, "SKILL.md"), "# My Skill");

		const manifest = {
			name: "test-marketplace",
			plugins: [{ name: "myplugin", version: "1.0.0", source: "myplugin" }],
		};
		const claudePluginDir = join(tempDir, ".claude-plugin");
		mkdirSync(claudePluginDir);
		writeFileSync(
			join(claudePluginDir, "marketplace.json"),
			JSON.stringify(manifest),
		);

		const result = findSkillInMarketplace(tempDir, "myplugin", "myskill");
		expect(result).toBeDefined();
		expect(result?.path).toBe(join(pluginDir, "skills", "myskill", "SKILL.md"));
	});

	it("resolves plugin source path relative to marketplace root", () => {
		const manifest = {
			name: "test-marketplace",
			plugins: [
				{ name: "myplugin", version: "1.0.0", source: "path/to/plugin" },
			],
		};
		const claudePluginDir = join(tempDir, ".claude-plugin");
		const pluginSkillDir = join(
			tempDir,
			"path",
			"to",
			"plugin",
			"skills",
			"myskill",
		);
		mkdirSync(claudePluginDir);
		mkdirSync(pluginSkillDir, { recursive: true });
		writeFileSync(
			join(claudePluginDir, "marketplace.json"),
			JSON.stringify(manifest),
		);
		writeFileSync(join(pluginSkillDir, "SKILL.md"), "# My Skill");

		const result = findSkillInMarketplace(tempDir, "myplugin", "myskill");
		expect(result?.pluginRoot).toBe(join(tempDir, "path", "to", "plugin"));
	});

	it("finds SKILL.md in resolved plugin skills directory", () => {
		const pluginDir = join(tempDir, "myplugin");
		const skillsDir = join(pluginDir, "skills", "myskill");
		mkdirSync(skillsDir, { recursive: true });
		writeFileSync(join(skillsDir, "SKILL.md"), "# My Skill");

		const manifest = {
			name: "test-marketplace",
			plugins: [{ name: "myplugin", version: "1.0.0", source: "myplugin" }],
		};
		const claudePluginDir = join(tempDir, ".claude-plugin");
		mkdirSync(claudePluginDir);
		writeFileSync(
			join(claudePluginDir, "marketplace.json"),
			JSON.stringify(manifest),
		);

		const result = findSkillInMarketplace(tempDir, "myplugin", "myskill");
		expect(result?.path).toBe(join(pluginDir, "skills", "myskill", "SKILL.md"));
		expect(result?.baseDir).toBe(join(pluginDir, "skills", "myskill"));
	});

	it("throws SkillReaderError for invalid marketplace manifest (missing plugins array)", () => {
		const claudePluginDir = join(tempDir, ".claude-plugin");
		mkdirSync(claudePluginDir);
		writeFileSync(
			join(claudePluginDir, "marketplace.json"),
			JSON.stringify({ name: "broken-marketplace" }),
		);

		expect(() => {
			findSkillInMarketplace(tempDir, "myplugin", "myskill");
		}).toThrow(SkillReaderError);
	});

	it("throws SkillReaderError for missing marketplace.json", () => {
		expect(() => {
			findSkillInMarketplace(tempDir, "myplugin", "myskill");
		}).toThrow(SkillReaderError);
	});
});
