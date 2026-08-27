#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {"plugin" | "npm"} ReleaseSurface */
/** @typedef {"independent" | "lockstep"} ReleaseRelationship */
/** @typedef {"manifest-git-history" | "legacy-npm-tags"} ReleaseHistorySource */

/**
 * @typedef {object} ReleaseIdentityRequest
 * @property {string} pluginName Registry plugin name; never inferred from a package name.
 * @property {ReleaseSurface} surface Explicit release line; there is no name-only default.
 */

/**
 * @typedef {object} ResolvedReleaseIdentity
 * @property {string} pluginName
 * @property {ReleaseSurface} surface
 * @property {string} identity
 * @property {string} label
 * @property {string} currentVersion
 * @property {string} versionSource Repo-relative manifest path containing the current version.
 * @property {ReleaseHistorySource} historySource
 * @property {string} authoritativeRoot Filesystem root from which consumers discover changelogs.
 * @property {ReleaseRelationship | null} relationship Null when the plugin has no npm sibling.
 * @property {string | null} legacyTagPrefix Npm-owned bare tag prefix; null for plugin history.
 */

/**
 * @typedef {object} PluginReleaseSequence
 * @property {string} pluginName
 * @property {"plugin"} surface
 * @property {"manifest-git-history"} historySource
 * @property {string} versionSource
 * @property {string[]} versions Oldest to newest, de-duplicated and bounded by the current version.
 */

/**
 * Resolve one explicitly selected release line.
 *
 * @param {ReleaseIdentityRequest} _request
 * @param {{ repoRoot?: string }} [options]
 * @returns {ResolvedReleaseIdentity}
 */
export function resolveReleaseIdentity(_request, options = {}) {
	const request = _request;
	if (!request || typeof request.pluginName !== "string" || request.pluginName.length === 0) {
		throw new Error("release-identity: pluginName is required");
	}
	if (request.surface !== "plugin" && request.surface !== "npm") {
		throw new Error('release-identity: surface must be "plugin" or "npm"');
	}
	const repoRoot = options.repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const registryPath = path.join(repoRoot, "packages/plugin-layout-checks/registry/plugins.json");
	const registry = JSON.parse(readFileSync(registryPath, "utf8"));
	validateReleaseIdentityRegistry(registry, repoRoot);
	const plugin = registry.plugins.find((candidate) => candidate.name === request.pluginName);
	if (!plugin) throw new Error(`release-identity: no registry plugin named ${request.pluginName}`);
	const npm = plugin.releaseIdentity.npm;
	if (request.surface === "npm" && npm === null) {
		throw new Error(`release-identity: ${request.pluginName} has no npm release identity`);
	}
	const selected = request.surface === "plugin" ? plugin.releaseIdentity.plugin : npm;
	const versionSource = request.surface === "plugin" ? selected.versionSource : selected.packageJson;
	const manifest = readManifest(repoRoot, plugin.name, versionSource);
	return {
		pluginName: plugin.name,
		surface: request.surface,
		identity: selected.identity,
		label: selected.label,
		currentVersion: manifest.version,
		versionSource,
		historySource: selected.historySource,
		authoritativeRoot: selected.authoritativeRoot,
		relationship: npm?.relationship ?? null,
		legacyTagPrefix: request.surface === "npm" ? npm.legacyTagPrefix : null,
	};
}

/**
 * Read the selected plugin's release sequence from its manifest's Git history.
 * Npm tag history is deliberately not a fallback.
 *
 * @param {ReleaseIdentityRequest} request
 * @param {{ repoRoot?: string }} [options]
 * @returns {PluginReleaseSequence}
 */
export function pluginReleaseSequence(request, options = {}) {
	if (request?.surface !== "plugin") {
		throw new Error('release-identity: plugin release sequence requires the explicit "plugin" surface');
	}
	const repoRoot = options.repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const identity = resolveReleaseIdentity(request, { repoRoot });
	let shallow;
	try {
		shallow = git(repoRoot, ["rev-parse", "--is-shallow-repository"]).trim();
	} catch (error) {
		throw historyError(identity, `could not determine checkout depth: ${errorMessage(error)}`);
	}
	if (shallow !== "false") {
		throw historyError(identity, `checkout history is ${shallow === "true" ? "shallow" : "of unknown depth"}`);
	}

	try {
		const committedManifest = JSON.parse(git(repoRoot, ["show", `HEAD:${identity.versionSource}`]));
		if (typeof committedManifest.version !== "string" || committedManifest.version.length === 0) {
			throw new Error(`committed manifest ${identity.versionSource} has no string version`);
		}
		const committedVersion = committedManifest.version;
		const commits = git(repoRoot, ["log", "--follow", "--format=%H", "--", identity.versionSource])
			.split("\n")
			.filter((commit) => commit.length > 0);
		if (commits.length === 0) throw new Error("Git returned no commits for the version source");
		const latestOccupation = new Map();
		let historicalPath = identity.versionSource;
		const manifests = [];
		for (const commit of commits) {
			manifests.push({ commit, historicalPath });
			const changes = git(repoRoot, ["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "-M", commit]);
			for (const line of changes.split("\n")) {
				const [status, oldPath, newPath] = line.split("\t");
				if (status?.startsWith("R") && newPath === historicalPath) historicalPath = oldPath;
			}
		}
		for (const [index, entry] of manifests.reverse().entries()) {
			const manifest = JSON.parse(git(repoRoot, ["show", `${entry.commit}:${entry.historicalPath}`]));
			if (typeof manifest.version !== "string") continue;
			if (compareVersions(manifest.version, committedVersion) <= 0) latestOccupation.set(manifest.version, index);
		}
		const versions = [...latestOccupation.entries()]
			.sort((left, right) => left[1] - right[1])
			.map(([version]) => version);
		if (versions.length === 0 || versions.at(-1) !== committedVersion) {
			throw new Error(`committed HEAD version ${committedVersion} was absent from its manifest history`);
		}
		return {
			pluginName: identity.pluginName,
			surface: "plugin",
			historySource: "manifest-git-history",
			versionSource: identity.versionSource,
			versions,
		};
	} catch (error) {
		throw historyError(identity, errorMessage(error));
	}
}

/**
 * Fail-closed validation shared by the resolver and its fixture checks.
 * @param {{ plugins?: unknown }} registry
 * @param {string} repoRoot
 */
export function validateReleaseIdentityRegistry(registry, repoRoot) {
	if (!registry || !Array.isArray(registry.plugins)) {
		throw new Error("release-identity: registry.plugins must be an array");
	}
	const prefixes = new Map();
	for (const plugin of registry.plugins) {
		if (!plugin || typeof plugin.name !== "string") throw new Error("release-identity: registry plugin has no name");
		const declaration = plugin.releaseIdentity;
		if (!declaration?.plugin) throw new Error(`release-identity: ${plugin.name} is missing releaseIdentity.plugin`);
		const pluginIdentity = declaration.plugin;
		assertMeaningful(plugin.name, "plugin.identity", pluginIdentity.identity);
		assertMeaningful(plugin.name, "plugin.label", pluginIdentity.label);
		if (pluginIdentity.identity !== plugin.name) {
			throw new Error(
				`release-identity: ${plugin.name} plugin identity declares ${String(pluginIdentity.identity)}; observed ${plugin.name}`,
			);
		}
		if (pluginIdentity.versionSource !== plugin.versionSurfaces?.source) {
			throw new Error(
				`release-identity: ${plugin.name} plugin versionSource ${String(pluginIdentity.versionSource)} contradicts ` +
					`versionSurfaces.source ${String(plugin.versionSurfaces?.source)}`,
			);
		}
		if (pluginIdentity.historySource !== "manifest-git-history") {
			throw new Error(
				`release-identity: ${plugin.name} plugin.historySource declares ${String(pluginIdentity.historySource)}; ` +
					"expected manifest-git-history",
			);
		}
		if (pluginIdentity.authoritativeRoot !== plugin.claudePluginRoot) {
			throw new Error(
				`release-identity: ${plugin.name} plugin.authoritativeRoot declares ${String(pluginIdentity.authoritativeRoot)}; ` +
					`expected owning plugin root ${String(plugin.claudePluginRoot)} for ${pluginIdentity.versionSource}`,
			);
		}
		assertPath(repoRoot, plugin.name, "plugin.versionSource", pluginIdentity.versionSource, "file");
		assertPath(repoRoot, plugin.name, "plugin.authoritativeRoot", pluginIdentity.authoritativeRoot, "directory");
		const pluginManifest = readManifest(repoRoot, plugin.name, pluginIdentity.versionSource);
		if (pluginManifest.name !== pluginIdentity.identity) {
			throw new Error(
				`release-identity: ${plugin.name} plugin identity ${String(pluginIdentity.identity)} contradicts manifest name ` +
					`${String(pluginManifest.name)} at ${pluginIdentity.versionSource}`,
			);
		}

		const collision = `packages/${plugin.name}/package.json`;
		const collisionExists = existsSync(path.join(repoRoot, collision));
		const npm = declaration.npm;
		if (npm === null) {
			if (collisionExists) {
				throw new Error(
					`release-identity: ${plugin.name} has same-name npm package ${collision}, but releaseIdentity.npm is undeclared`,
				);
			}
			if (plugin.versionSurfaces?.packageJson) {
				throw new Error(
					`release-identity: ${plugin.name} declares versionSurfaces.packageJson without an npm release identity`,
				);
			}
			continue;
		}
		if (!npm) throw new Error(`release-identity: ${plugin.name} must declare releaseIdentity.npm as an object or null`);
		assertMeaningful(plugin.name, "npm.identity", npm.identity);
		assertMeaningful(plugin.name, "npm.label", npm.label);
		if (npm.historySource !== "legacy-npm-tags") {
			throw new Error(
				`release-identity: ${plugin.name} npm.historySource declares ${String(npm.historySource)}; expected legacy-npm-tags`,
			);
		}
		if (npm.relationship !== "independent" && npm.relationship !== "lockstep") {
			throw new Error(
				`release-identity: ${plugin.name} npm.relationship must be independent or lockstep; received ${String(npm.relationship)}`,
			);
		}
		if (!collisionExists || npm.packageJson !== collision) {
			throw new Error(
				`release-identity: ${plugin.name} npm packageJson declares ${String(npm.packageJson)}; observed same-name package ${collision}`,
			);
		}
		const expectedNpmRoot = path.posix.dirname(npm.packageJson);
		if (npm.authoritativeRoot !== expectedNpmRoot) {
			throw new Error(
				`release-identity: ${plugin.name} npm.authoritativeRoot declares ${String(npm.authoritativeRoot)}; ` +
					`expected package root ${expectedNpmRoot} for ${npm.packageJson}`,
			);
		}
		assertPath(repoRoot, plugin.name, "npm.packageJson", npm.packageJson, "file");
		assertPath(repoRoot, plugin.name, "npm.authoritativeRoot", npm.authoritativeRoot, "directory");
		const npmManifest = readManifest(repoRoot, plugin.name, npm.packageJson);
		if (npmManifest.name !== npm.identity) {
			throw new Error(
				`release-identity: ${plugin.name} npm identity ${String(npm.identity)} contradicts manifest name ` +
					`${String(npmManifest.name)} at ${npm.packageJson}`,
			);
		}
		const expectedPrefix = `${plugin.name}-v`;
		if (npm.legacyTagPrefix !== expectedPrefix) {
			throw new Error(
				`release-identity: ${plugin.name} npm legacyTagPrefix ${String(npm.legacyTagPrefix)} contradicts ${expectedPrefix}`,
			);
		}
		if (prefixes.has(npm.legacyTagPrefix)) {
			throw new Error(
				`release-identity: ${plugin.name} npm legacyTagPrefix ${npm.legacyTagPrefix} conflicts with ${prefixes.get(npm.legacyTagPrefix)}`,
			);
		}
		prefixes.set(npm.legacyTagPrefix, plugin.name);
		if (npm.relationship !== "independent" && npm.relationship !== "lockstep") {
			throw new Error(
				`release-identity: ${plugin.name} npm relationship must be independent or lockstep; received ${String(npm.relationship)}`,
			);
		}
		if (npm.relationship === "lockstep" && plugin.versionSurfaces?.packageJson !== npm.packageJson) {
			throw new Error(
				`release-identity: ${plugin.name} lockstep npm package ${npm.packageJson} must equal versionSurfaces.packageJson`,
			);
		}
		if (npm.relationship === "independent" && plugin.versionSurfaces?.packageJson) {
			throw new Error(
				`release-identity: ${plugin.name} versionSurfaces.packageJson contradicts independent npm relationship`,
			);
		}
	}
}

function assertMeaningful(pluginName, field, value) {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`release-identity: ${pluginName} ${field} must be a nonempty meaningful string`);
	}
}

function git(repoRoot, args) {
	return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function compareVersions(a, b) {
	const left = a.split(".").map((part) => Number.parseInt(part, 10));
	const right = b.split(".").map((part) => Number.parseInt(part, 10));
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}

function historyError(identity, detail) {
	return new Error(
		`release-identity: could not read ${identity.label} history at ${identity.versionSource}: ${detail}. ` +
			"A history that cannot be read is not an empty release sequence; refusing.",
	);
}

function errorMessage(error) {
	return error instanceof Error ? error.message.trim() : String(error);
}

function assertPath(repoRoot, pluginName, field, declared, kind) {
	if (typeof declared !== "string" || declared.length === 0) {
		throw new Error(`release-identity: ${pluginName} ${field} is missing`);
	}
	const absolute = path.join(repoRoot, declared);
	if (!existsSync(absolute)) {
		throw new Error(`release-identity: ${pluginName} ${field} declares ${declared}, which does not exist`);
	}
	const stat = statSync(absolute);
	if ((kind === "file" && !stat.isFile()) || (kind === "directory" && !stat.isDirectory())) {
		throw new Error(`release-identity: ${pluginName} ${field} declares ${declared}, which is not a ${kind}`);
	}
}

function readManifest(repoRoot, pluginName, declared) {
	let manifest;
	try {
		manifest = JSON.parse(readFileSync(path.join(repoRoot, declared), "utf8"));
	} catch (error) {
		throw new Error(
			`release-identity: ${pluginName} cannot read manifest ${declared}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (typeof manifest.version !== "string" || manifest.version.length === 0) {
		throw new Error(`release-identity: ${pluginName} manifest ${declared} has no string version`);
	}
	return manifest;
}

function usage() {
	return (
		"usage: node scripts/release-identity.mjs <plugin-name> <plugin|npm> [--sequence] [--repo-root <path>]\n" +
		"       --sequence reads plugin versions only from full manifest Git history (never npm tags)"
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [pluginName, surface, ...flags] = process.argv.slice(2);
	let sequence = false;
	let repoRoot;
	let invalid = false;
	for (let index = 0; index < flags.length; index += 1) {
		if (flags[index] === "--sequence" && !sequence) sequence = true;
		else if (flags[index] === "--repo-root" && repoRoot === undefined && flags[index + 1]) {
			repoRoot = path.resolve(flags[index + 1]);
			index += 1;
		} else invalid = true;
	}
	if (!pluginName || !surface || invalid) {
		process.stderr.write(`${usage()}\n`);
		process.exitCode = 2;
	} else if (surface !== "plugin" && surface !== "npm") {
		process.stderr.write(`release-identity: surface must be \"plugin\" or \"npm\"; received ${JSON.stringify(surface)}\n`);
		process.stderr.write(`${usage()}\n`);
		process.exitCode = 2;
	} else {
		try {
			const request = { pluginName, surface };
			const options = repoRoot ? { repoRoot } : undefined;
			const resolved = sequence ? pluginReleaseSequence(request, options) : resolveReleaseIdentity(request, options);
			process.stdout.write(`${JSON.stringify(resolved)}\n`);
		} catch (error) {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		}
	}
}
