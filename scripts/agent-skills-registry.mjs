import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The one place the build driver, the lint driver, and CI turn registry
 * declarations into agent-skills CLI invocations.
 *
 * Kept shared rather than copied because the drivers must agree about what a
 * plugin's flags are: a lint run that derives `--root` or `--platform-dir`
 * differently from the build run reports diagnostics about output nobody
 * ships, and misses the output everybody does.
 */

export const repo = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

const DEFAULT_REGISTRY = path.join(
	repo,
	"packages/plugin-layout-checks/registry/plugins.json",
);

/**
 * Overridable via AGENT_SKILLS_REGISTRY so the layout suite can run a driver
 * end-to-end against a deliberately unsafe registry and observe the refusal,
 * rather than trusting a unit check on a copy of the rule.
 */
export function loadRegistry() {
	return JSON.parse(
		readFileSync(process.env.AGENT_SKILLS_REGISTRY ?? DEFAULT_REGISTRY, "utf8"),
	);
}

/** Every path a plugin is permitted to publish into. */
function allowedTargets(registry, plugin) {
	return new Set([
		`${plugin.claudePluginRoot}/skills`,
		`${plugin.codexPluginRoot}/skills`,
		`${plugin.opencodePluginRoot}/skills`,
		registry.sharedOpencodeRoot,
	]);
}

/**
 * An allow-list, not a list of known-bad shapes. The two rules this replaced
 * caught a plugin root and a non-/skills path under plugins*, because those
 * were the two mistakes that had been made; `skills-src/gmail` is neither, and
 * would have deleted the authored templates the build was reading from.
 */
export function assertSafeTargets(registry) {
	for (const plugin of registry.plugins) {
		const allowed = allowedTargets(registry, plugin);
		for (const target of plugin.targets) {
			if (!allowed.has(target.path)) {
				throw new Error(
					`${plugin.name}: --target ${target.platform}=${target.path} is not a declared skills tree. ` +
						`Publishing renames the whole directory away, so only ${[...allowed].join(", ")} may be published into.`,
				);
			}
		}
	}
}

const ALL_PLATFORMS = ["claude-code", "codex", "opencode"];

/** The platforms a plugin's skills actually render to, after front-config gating. */
function renderedPlatforms(plugin) {
	return new Set(
		(plugin.skills ?? []).flatMap(
			(skill) => plugin.skillPlatforms?.[skill] ?? ALL_PLATFORMS,
		),
	);
}

/**
 * A target no skill renders into publishes an empty directory, and git cannot
 * store one. The tree then exists only on machines that have run a build:
 * `git status` stays clean, the layout suite passes locally, and a fresh
 * checkout fails on trees that were never in the commit. Voice's Codex and
 * OpenCode targets sat like that through two review rounds because every
 * measurement was taken after a build.
 *
 * Declared here rather than discovered after publishing, so the empty tree is
 * never created in the first place.
 */
export function assertTargetsRenderFiles(registry) {
	for (const plugin of registry.plugins) {
		const rendered = renderedPlatforms(plugin);
		for (const target of plugin.targets) {
			if (!rendered.has(target.platform)) {
				throw new Error(
					`${plugin.name}: --target ${target.platform}=${target.path} would publish an empty directory. ` +
						`No skill renders to ${target.platform}, and git cannot commit an empty tree. ` +
						`Remove the target, or ship a skill that renders there.`,
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
export function assertNoUntrackedInTargets(registry) {
	for (const plugin of registry.plugins) {
		for (const target of plugin.targets) {
			const untracked = execFileSync(
				"git",
				["ls-files", "--others", "--exclude-standard", "--", target.path],
				{
					cwd: repo,
					encoding: "utf8",
				},
			)
				.split("\n")
				.filter(Boolean);
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
export function cliArgs(plugin, command) {
	return [
		"node_modules/tsx/dist/cli.mjs",
		"packages/agent-skills/src/cli.ts",
		command,
		"--root",
		plugin.skillsSrc,
		...plugin.targets.flatMap((target) => [
			"--target",
			`${target.platform}=${target.path}`,
		]),
		...plugin.platformDirs.flatMap((flag) => ["--platform-dir", flag]),
		"**/*",
	];
}

/**
 * Diagnostics reduced to the sites they name: `<file>:<line>:<rule>`, deduped
 * because the same template site is reported once per target it renders into.
 * Comparing sites rather than raw lines keeps the registry's declared baseline
 * something a reviewer can read.
 */
export function diagnosticSites(stderr) {
	const sites = stderr
		.split("\n")
		.map((line) => /^(.+?):(\d+):\d+ \[([^\]]+)\]/.exec(line))
		.filter((match) => match !== null)
		.map((match) => `${match[1]}:${match[2]}:${match[3]}`);
	return [...new Set(sites)].sort();
}
