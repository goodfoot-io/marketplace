#!/usr/bin/env node
/**
 * The single definition of which CHANGELOG files are release surfaces, derived
 * from what exists on disk rather than from a registry declaration.
 *
 * It used to be declared, as `versionSurfaces.changelogs`. Only agent-skills
 * ever filled it in — it was the plugin being worked on when the field was
 * added — so the gate that iterates it ran for one plugin of eight and reported
 * success for the other seven by iterating an empty array. agent-hooks was the
 * live casualty: it shipped 1.0.3 against a changelog whose newest heading was
 * 1.0.0, and nothing anywhere said so.
 *
 * Presence cannot drift from itself. A plugin that gains a CHANGELOG is covered
 * by the next commit that bumps it, with nothing to remember to declare.
 *
 * Read by the pre-commit hook, sync-plugin-versions.sh, and the layout suite,
 * so all three answer "what are this plugin's release notes" identically.
 */
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * Fixed, and resolved from the working directory exactly as the hook and
 * sync-plugin-versions.sh resolve it.
 *
 * This honoured AGENT_SKILLS_REGISTRY once, copied from agent-skills-registry.mjs
 * where the override exists so the layout suite can aim the build and lint
 * drivers at a scratch registry. On the release path that affordance was a hole:
 * exporting the variable pointed this script at another registry, it exited 2
 * with empty stdout, and every caller read the empty list as "this plugin has no
 * release notes" — cutting an undocumented release and exiting 0. A release gate
 * must not be redirectable by the environment it runs in.
 */
const REGISTRY = "packages/plugin-layout-checks/registry/plugins.json";

/**
 * A plugin's release-note files: the ones that exist beside the surfaces it
 * already declares. The marketplace installer reads the plugin-root changelog,
 * an npm consumer the package-root one, and a plugin may ship either, both, or
 * neither.
 */
export function changelogSurfaces(plugin, repoRoot) {
	const candidates = [`${plugin.claudePluginRoot}/CHANGELOG.md`];
	const packageJson = plugin.versionSurfaces?.packageJson;
	if (typeof packageJson === "string")
		candidates.push(`${path.posix.dirname(packageJson)}/CHANGELOG.md`);
	return candidates.filter((relative) =>
		existsSync(path.join(repoRoot, relative)),
	);
}

function main(argv) {
	const [name] = argv;
	const registry = JSON.parse(readFileSync(path.resolve(REGISTRY), "utf8"));
	const selected =
		name === undefined
			? registry.plugins
			: registry.plugins.filter((plugin) => plugin.name === name);
	if (name !== undefined && selected.length === 0) {
		process.stderr.write(
			`changelog-surfaces: no registry plugin named ${name}\n`,
		);
		return 2;
	}
	for (const plugin of selected) {
		for (const surface of changelogSurfaces(plugin, process.cwd()))
			process.stdout.write(`${surface}\n`);
	}
	return 0;
}

if (
	process.argv[1] &&
	import.meta.url === `file://${path.resolve(process.argv[1])}`
) {
	process.exit(main(process.argv.slice(2)));
}
