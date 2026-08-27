#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import {
	assertNoUntrackedInTargets,
	assertSafeTargets,
	assertTargetsRenderFiles,
	cliArgs,
	loadRegistry,
	repo,
} from "./agent-skills-registry.mjs";

const registry = loadRegistry();

// All three guards run before anything is built. materializeAll() publishes by
// renaming the whole target directory away, so a target pointed one level too
// high does not corrupt the plugin's hand-maintained siblings — it deletes
// them, atomically, on a build that exits 0. A check that notices afterwards is
// too late, and one that waits on a slow workspace build is one nobody runs.
assertSafeTargets(registry);
assertTargetsRenderFiles(registry);
assertNoUntrackedInTargets(registry);

// Lets CI and the layout suite ask "would this registry be safe to publish?"
// without publishing. The alternative — a test asserting its own copy of the
// rules above — is exactly the arrangement that let the guard drift from what
// the build actually does.
if (process.argv.includes("--check-targets")) process.exit(0);

execFileSync("yarn", ["workspace", "@goodfoot/typescript-metrics", "build"], {
	cwd: repo,
	stdio: "inherit",
	env: process.env,
});

for (const plugin of registry.plugins) {
	// The CLI writes "Warning: publication succeeded; cleanup residue …" to
	// stderr and exits 0, so a driver reading only the exit code treats leaked
	// backup, stage, and lock paths as success. A leaked lock is the sharp one:
	// the next build fails with "Target lock contention" pointing nowhere near
	// the run that leaked it.
	const result = spawnSync(process.execPath, cliArgs(plugin, "build"), {
		cwd: repo,
		stdio: ["ignore", "inherit", "pipe"],
		env: process.env,
		encoding: "utf8",
	});

	const stderr = result.stderr ?? "";
	if (stderr) process.stderr.write(stderr);
	if (result.error) throw result.error;
	if (result.status !== 0) {
		process.stderr.write(
			`\nagent-skills build failed for ${plugin.name} (exit ${result.status}).\n`,
		);
		process.exit(result.status ?? 1);
	}

	const residue = stderr
		.split("\n")
		.filter((line) => line.includes("cleanup residue"));
	if (residue.length > 0) {
		process.stderr.write(
			`\nRefusing to report success for ${plugin.name}: publication left residue behind.\n`,
		);
		process.exit(1);
	}

	// The pre-build guard reasons from the registry's declarations; this reads
	// what was actually written. They disagree exactly when skillPlatforms has
	// drifted from the templates' own front-config, and the result of that
	// disagreement is a directory git will not carry.
	for (const target of plugin.targets) {
		if (readdirSync(path.join(repo, target.path)).length === 0) {
			process.stderr.write(
				`\n${plugin.name}: ${target.path} is empty after publishing. ` +
					`Git cannot commit an empty directory, so this tree would exist only here.\n`,
			);
			process.exit(1);
		}
	}
}
