#!/usr/bin/env node
/** Filesystem-derived changelogs for an explicitly selected release purpose. */
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveReleaseIdentity } from "./release-identity.mjs";

const REGISTRY = "packages/plugin-layout-checks/registry/plugins.json";
const PURPOSE = "plugin-release";
const CHECKOUT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A plugin release owns notes at its plugin root and, only for a lockstep
 * sibling, notes at the npm root. Independent npm notes are another release.
 * @param {string} pluginName
 * @param {"plugin-release"} purpose
 * @param {string} repoRoot
 */
export function changelogSurfaces(pluginName, purpose, repoRoot) {
	if (purpose !== PURPOSE) {
		throw new Error(
			`changelog-surfaces: unsupported purpose ${JSON.stringify(purpose)}; expected ${PURPOSE}`,
		);
	}
	const plugin = resolveReleaseIdentity({ pluginName, surface: "plugin" });
	const identities = [plugin];
	if (plugin.relationship === "lockstep") {
		const npm = resolveReleaseIdentity({ pluginName, surface: "npm" });
		identities.push(npm);
	}
	return identities
		.map((identity) => ({
			path: path.posix.join(identity.authoritativeRoot, "CHANGELOG.md"),
			label: identity.label,
			versionSource: identity.versionSource,
		}))
		.filter((surface) => existsSync(path.join(repoRoot, surface.path)));
}

function usage() {
	return `usage: node scripts/changelog-surfaces.mjs ${PURPOSE} [plugin-name]`;
}

function main(argv) {
	const [purpose, name, ...extra] = argv;
	if (purpose !== PURPOSE || extra.length > 0) {
		process.stderr.write(`${usage()}\n`);
		return 2;
	}
	try {
		const registryPath = path.join(CHECKOUT_ROOT, REGISTRY);
		let registry;
		try {
			registry = JSON.parse(readFileSync(registryPath, "utf8"));
		} catch (error) {
			throw new Error(
				`changelog-surfaces: could not read registry at ${registryPath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		const selected = registry.plugins
			.filter((plugin) => name === undefined || plugin.name === name)
			.map((plugin) => plugin.name);
		if (name !== undefined && selected.length === 0) {
			process.stderr.write(`changelog-surfaces: no registry plugin named ${name}\n`);
			return 2;
		}
		for (const pluginName of selected) {
			for (const surface of changelogSurfaces(pluginName, purpose, CHECKOUT_ROOT))
				process.stdout.write(`${JSON.stringify(surface)}\n`);
		}
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		return 1;
	}
	return 0;
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
	process.exit(main(process.argv.slice(2)));
}
