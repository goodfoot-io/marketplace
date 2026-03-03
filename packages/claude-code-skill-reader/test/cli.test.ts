import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";

// Mutable holder for the homedir stub — updated per test
let _mockHomeDir = tmpdir();

vi.mock("node:os", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:os")>();
	return {
		...actual,
		homedir: () => _mockHomeDir,
	};
});

/**
 * Helper to capture stdout and stderr writes during a test.
 */
function captureOutput() {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const origStdoutWrite = process.stdout.write;
	const origStderrWrite = process.stderr.write;

	process.stdout.write = (chunk: string | Uint8Array): boolean => {
		stdout.push(
			typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
		);
		return true;
	};
	process.stderr.write = (chunk: string | Uint8Array): boolean => {
		stderr.push(
			typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
		);
		return true;
	};

	return {
		stdout,
		stderr,
		restore: () => {
			process.stdout.write = origStdoutWrite;
			process.stderr.write = origStderrWrite;
		},
		getStdout: () => stdout.join(""),
		getStderr: () => stderr.join(""),
	};
}

describe("cli", () => {
	let capture: ReturnType<typeof captureOutput>;
	let cwdSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		process.exitCode = 0;
		capture = captureOutput();
		cwdSpy = vi.spyOn(process, "cwd");
	});

	afterEach(() => {
		capture.restore();
		cwdSpy.mockRestore();
		process.exitCode = 0;
	});

	it("--help prints usage text to stdout", async () => {
		await main(["--help"]);
		expect(capture.getStdout()).toContain("Usage: claude-code-skill-reader");
		expect(process.exitCode).toBe(0);
	});

	it("--version prints version to stdout", async () => {
		await main(["--version"]);
		const output = capture.getStdout().trim();
		expect(output).toMatch(/^\d+\.\d+\.\d+$/);
		expect(process.exitCode).toBe(0);
	});

	it("unknown flag writes error to stderr and sets exitCode 1", async () => {
		await main(["--unknown-flag"]);
		const errOutput = capture.getStderr();
		const parsed = JSON.parse(errOutput);
		expect(parsed.error.code).toBe("INVALID_ARGS");
		expect(parsed.error.message).toContain("Unrecognized option");
		expect(process.exitCode).toBe(1);
	});

	it("reads a local skill and writes processed body to stdout", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
		try {
			const skillDir = join(tmpDir, ".claude", "skills", "test-skill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(
				join(skillDir, "SKILL.md"),
				"---\nname: test\n---\nHello from test skill",
			);

			cwdSpy.mockReturnValue(tmpDir);
			await main(["test-skill"]);

			expect(capture.getStdout()).toContain("Hello from test skill");
			expect(process.exitCode).toBe(0);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("reads a plugin:skill namespaced skill", async () => {
		const homeDirStub = mkdtempSync(join(tmpdir(), "skill-reader-home-"));
		const prevHomeDir = _mockHomeDir;
		_mockHomeDir = homeDirStub;
		try {
			const pluginInstallPath = join(homeDirStub, "plugin-cache", "my-plugin");
			const skillDir = join(pluginInstallPath, "skills", "my-skill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(join(skillDir, "SKILL.md"), "Plugin skill body");

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

			// Also set cwd to a dir without local skills so it falls through to plugin
			const tmpCwd = mkdtempSync(join(tmpdir(), "skill-reader-cwd-"));
			cwdSpy.mockReturnValue(tmpCwd);

			await main(["my-plugin:my-skill"]);

			expect(capture.getStdout()).toContain("Plugin skill body");
			expect(process.exitCode).toBe(0);

			rmSync(tmpCwd, { recursive: true, force: true });
		} finally {
			_mockHomeDir = prevHomeDir;
			rmSync(homeDirStub, { recursive: true, force: true });
		}
	});

	it("writes JSON error to stderr for missing skill with exitCode 1", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
		try {
			cwdSpy.mockReturnValue(tmpDir);
			await main(["nonexistent-skill"]);

			const errOutput = capture.getStderr();
			const parsed = JSON.parse(errOutput);
			expect(parsed.error.code).toBe("SKILL_NOT_FOUND");
			expect(parsed.error.message).toContain("nonexistent-skill");
			expect(process.exitCode).toBe(1);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("reads multiple skills and outputs each body separated by newline", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
		try {
			const skillDir1 = join(tmpDir, ".claude", "skills", "skill-one");
			mkdirSync(skillDir1, { recursive: true });
			writeFileSync(join(skillDir1, "SKILL.md"), "Body one");

			const skillDir2 = join(tmpDir, ".claude", "skills", "skill-two");
			mkdirSync(skillDir2, { recursive: true });
			writeFileSync(join(skillDir2, "SKILL.md"), "Body two");

			cwdSpy.mockReturnValue(tmpDir);
			await main(["skill-one", "skill-two"]);

			const stdout = capture.getStdout();
			expect(stdout).toContain("Body one");
			expect(stdout).toContain("Body two");
			expect(process.exitCode).toBe(0);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it('--marketplace \'{"source":"directory","path":"..."}\' resolves skill from marketplace', async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
		try {
			// Set up a marketplace directory structure
			const marketplaceDir = join(tmpDir, "marketplace");
			const pluginDir = join(marketplaceDir, "myplugin");
			const skillDir = join(pluginDir, "skills", "myskill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(join(skillDir, "SKILL.md"), "Marketplace skill body");

			const claudePluginDir = join(marketplaceDir, ".claude-plugin");
			mkdirSync(claudePluginDir);
			writeFileSync(
				join(claudePluginDir, "marketplace.json"),
				JSON.stringify({
					name: "test-marketplace",
					plugins: [{ name: "myplugin", version: "1.0.0", source: "myplugin" }],
				}),
			);

			// Set cwd to somewhere without local skills
			cwdSpy.mockReturnValue(tmpDir);

			const marketplaceJson = JSON.stringify({
				source: "directory",
				path: marketplaceDir,
			});

			await main(["--marketplace", marketplaceJson, "myplugin:myskill"]);

			expect(capture.getStdout()).toContain("Marketplace skill body");
			expect(process.exitCode).toBe(0);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("--marketplace with invalid JSON writes error to stderr", async () => {
		await main(["--marketplace", "not-valid-json", "some:skill"]);

		const errOutput = capture.getStderr();
		const parsed = JSON.parse(errOutput);
		expect(parsed.error.code).toBe("INVALID_ARGS");
		expect(parsed.error.message).toContain("Invalid marketplace JSON");
		expect(process.exitCode).toBe(1);
	});

	it("--no-bash skips bash execution", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
		try {
			const skillDir = join(tmpDir, ".claude", "skills", "bash-skill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(join(skillDir, "SKILL.md"), "Result: !`echo hello`");

			cwdSpy.mockReturnValue(tmpDir);
			await main(["--no-bash", "bash-skill"]);

			const stdout = capture.getStdout();
			// The bash pattern should remain unprocessed
			expect(stdout).toContain("!`echo hello`");
			expect(process.exitCode).toBe(0);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("--raw outputs unprocessed SKILL.md body (no bash, no CLAUDE_PLUGIN_ROOT replacement)", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
		try {
			const skillDir = join(tmpDir, ".claude", "skills", "raw-skill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(
				join(skillDir, "SKILL.md"),
				"---\nname: raw\n---\nPath: ${CLAUDE_PLUGIN_ROOT}/bin and !`echo hello`",
			);

			cwdSpy.mockReturnValue(tmpDir);
			await main(["--raw", "raw-skill"]);

			const stdout = capture.getStdout();
			// Both patterns should remain unprocessed
			expect(stdout).toContain("${CLAUDE_PLUGIN_ROOT}");
			expect(stdout).toContain("!`echo hello`");
			expect(process.exitCode).toBe(0);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("reads a local command file and writes processed body to stdout", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
		try {
			const commandsDir = join(tmpDir, ".claude", "commands");
			mkdirSync(commandsDir, { recursive: true });
			writeFileSync(
				join(commandsDir, "test-cmd.md"),
				"---\nname: test\n---\nHello from test command",
			);

			cwdSpy.mockReturnValue(tmpDir);
			await main(["test-cmd"]);

			expect(capture.getStdout()).toContain("Hello from test command");
			expect(process.exitCode).toBe(0);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("process.exitCode is 0 on success", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
		try {
			const skillDir = join(tmpDir, ".claude", "skills", "ok-skill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(join(skillDir, "SKILL.md"), "All good");

			cwdSpy.mockReturnValue(tmpDir);
			await main(["ok-skill"]);

			expect(process.exitCode).toBe(0);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("--use-cached flag is accepted without error", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
		try {
			const skillDir = join(tmpDir, ".claude", "skills", "cached-skill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(join(skillDir, "SKILL.md"), "Locally found skill");

			cwdSpy.mockReturnValue(tmpDir);
			await main(["--use-cached", "cached-skill"]);

			expect(capture.getStdout()).toContain("Locally found skill");
			expect(process.exitCode).toBe(0);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("--use-cached resolves a plugin skill from cache when not in installed_plugins.json", async () => {
		const homeDirStub = mkdtempSync(join(tmpdir(), "skill-reader-home-"));
		const prevHomeDir = _mockHomeDir;
		_mockHomeDir = homeDirStub;
		try {
			// Set up cache dir structure: ~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/skills/{skillName}/SKILL.md
			const cacheSkillDir = join(
				homeDirStub,
				".claude",
				"plugins",
				"cache",
				"test-marketplace",
				"my-plugin",
				"1.0.0",
				"skills",
				"my-skill",
			);
			mkdirSync(cacheSkillDir, { recursive: true });
			writeFileSync(join(cacheSkillDir, "SKILL.md"), "Cached plugin skill body");

			// No installed_plugins.json — plugin is only in cache
			const tmpCwd = mkdtempSync(join(tmpdir(), "skill-reader-cwd-"));
			cwdSpy.mockReturnValue(tmpCwd);

			await main(["--use-cached", "my-plugin:my-skill"]);

			expect(capture.getStdout()).toContain("Cached plugin skill body");
			expect(process.exitCode).toBe(0);

			rmSync(tmpCwd, { recursive: true, force: true });
		} finally {
			_mockHomeDir = prevHomeDir;
			rmSync(homeDirStub, { recursive: true, force: true });
		}
	});

	it("--use-cached resolves a plain skill from cache when not in local .claude/ dirs", async () => {
		const homeDirStub = mkdtempSync(join(tmpdir(), "skill-reader-home-"));
		const prevHomeDir = _mockHomeDir;
		_mockHomeDir = homeDirStub;
		try {
			// Set up cache dir structure for a plain skill (no pluginName filter)
			const cacheSkillDir = join(
				homeDirStub,
				".claude",
				"plugins",
				"cache",
				"test-marketplace",
				"some-plugin",
				"2.0.0",
				"skills",
				"plain-skill",
			);
			mkdirSync(cacheSkillDir, { recursive: true });
			writeFileSync(join(cacheSkillDir, "SKILL.md"), "Cached plain skill body");

			// cwd has no local skills
			const tmpCwd = mkdtempSync(join(tmpdir(), "skill-reader-cwd-"));
			cwdSpy.mockReturnValue(tmpCwd);

			await main(["--use-cached", "plain-skill"]);

			expect(capture.getStdout()).toContain("Cached plain skill body");
			expect(process.exitCode).toBe(0);

			rmSync(tmpCwd, { recursive: true, force: true });
		} finally {
			_mockHomeDir = prevHomeDir;
			rmSync(homeDirStub, { recursive: true, force: true });
		}
	});

	it("without --use-cached, cache is NOT searched (skill-not-found error)", async () => {
		const homeDirStub = mkdtempSync(join(tmpdir(), "skill-reader-home-"));
		const prevHomeDir = _mockHomeDir;
		_mockHomeDir = homeDirStub;
		try {
			// Same cache setup as above
			const cacheSkillDir = join(
				homeDirStub,
				".claude",
				"plugins",
				"cache",
				"test-marketplace",
				"some-plugin",
				"2.0.0",
				"skills",
				"cached-only-skill",
			);
			mkdirSync(cacheSkillDir, { recursive: true });
			writeFileSync(join(cacheSkillDir, "SKILL.md"), "Cached only");

			// cwd has no local skills, no --use-cached flag
			const tmpCwd = mkdtempSync(join(tmpdir(), "skill-reader-cwd-"));
			cwdSpy.mockReturnValue(tmpCwd);

			await main(["cached-only-skill"]);

			const errOutput = capture.getStderr();
			const parsed = JSON.parse(errOutput);
			expect(parsed.error.code).toBe("SKILL_NOT_FOUND");
			expect(process.exitCode).toBe(1);

			rmSync(tmpCwd, { recursive: true, force: true });
		} finally {
			_mockHomeDir = prevHomeDir;
			rmSync(homeDirStub, { recursive: true, force: true });
		}
	});

	it("--help output includes --use-cached documentation", async () => {
		await main(["--help"]);
		expect(capture.getStdout()).toContain("--use-cached");
		expect(process.exitCode).toBe(0);
	});

	it("--use-cached combined with --marketplace uses cache when only cache has the skill", async () => {
		const homeDirStub = mkdtempSync(join(tmpdir(), "skill-reader-home-"));
		const prevHomeDir = _mockHomeDir;
		_mockHomeDir = homeDirStub;
		try {
			// Skill exists in cache
			const cacheSkillDir = join(
				homeDirStub,
				".claude",
				"plugins",
				"cache",
				"test-marketplace",
				"combo-plugin",
				"1.2.3",
				"skills",
				"combo-skill",
			);
			mkdirSync(cacheSkillDir, { recursive: true });
			writeFileSync(join(cacheSkillDir, "SKILL.md"), "Combo cache skill body");

			// Set up a marketplace dir that does NOT have the skill
			const tmpDir = mkdtempSync(join(tmpdir(), "skill-reader-cli-"));
			const marketplaceDir = join(tmpDir, "marketplace");
			const claudePluginDir = join(marketplaceDir, ".claude-plugin");
			mkdirSync(claudePluginDir, { recursive: true });
			writeFileSync(
				join(claudePluginDir, "marketplace.json"),
				JSON.stringify({
					name: "test-marketplace",
					plugins: [],
				}),
			);

			cwdSpy.mockReturnValue(tmpDir);

			const marketplaceJson = JSON.stringify({
				source: "directory",
				path: marketplaceDir,
			});

			await main([
				"--use-cached",
				"--marketplace",
				marketplaceJson,
				"combo-plugin:combo-skill",
			]);

			expect(capture.getStdout()).toContain("Combo cache skill body");
			expect(process.exitCode).toBe(0);

			rmSync(tmpDir, { recursive: true, force: true });
		} finally {
			_mockHomeDir = prevHomeDir;
			rmSync(homeDirStub, { recursive: true, force: true });
		}
	});
});
