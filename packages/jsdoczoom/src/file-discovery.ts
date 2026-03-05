import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { glob } from "glob";
import ignore, { type Ignore } from "ignore";
import { debugDiscovery } from "./debug.js";
import { JsdocError } from "./errors.js";

/**
 * Walks .gitignore files from cwd to filesystem root, building an ignore
 * filter that glob results pass through. Direct-path lookups bypass the
 * filter since the user explicitly named the file. Results are cached per
 * cwd for the process lifetime so concurrent discoverFiles calls sharing a
 * cwd only walk the filesystem once.
 *
 * @summary Resolve selector patterns to absolute file paths with gitignore filtering
 */

/** Process-lifetime cache: cwd → in-flight or settled Ignore promise. */
const gitignoreCache = new Map<string, Promise<Ignore>>();

/**
 * Walk from `cwd` up to the filesystem root, collecting .gitignore entries.
 * Returns an Ignore instance loaded with all discovered rules. Results are
 * cached per cwd so repeated calls (e.g. from concurrent discoverFiles calls)
 * only perform the filesystem walk once.
 */
export function loadGitignore(cwd: string): Promise<Ignore> {
	const key = resolve(cwd);
	const cached = gitignoreCache.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const promise = loadGitignoreUncached(key);
	gitignoreCache.set(key, promise);
	return promise;
}

async function loadGitignoreUncached(cwd: string): Promise<Ignore> {
	const ig = ignore();
	let dir = resolve(cwd);
	let walkDepth = 0;

	while (true) {
		debugDiscovery("gitignore walk depth=%d dir=%s", walkDepth, dir);
		const gitignorePath = join(dir, ".gitignore");
		try {
			const content = await readFile(gitignorePath, "utf-8");
			const prefix = relative(cwd, dir);
			const lines = content
				.split("\n")
				.map((l: string) => l.trim())
				.filter((l: string) => l && !l.startsWith("#"));

			debugDiscovery(
				"gitignore depth=%d loaded %d rules from %s",
				walkDepth,
				lines.length,
				gitignorePath,
			);

			for (const line of lines) {
				// Prefix rules from ancestor .gitignore files so paths are
				// relative to `cwd`, which is where glob results are anchored.
				ig.add(prefix ? `${prefix}/${line}` : line);
			}
		} catch {
			// No .gitignore at this level, continue walking up
		}

		const parent = dirname(dir);
		if (parent === dir) {
			debugDiscovery(
				"gitignore walk complete at depth=%d (reached root)",
				walkDepth,
			);
			break;
		}
		dir = parent;
		walkDepth++;
	}

	return ig;
}

/**
 * Resolve a selector pattern to a list of .ts/.tsx file paths.
 *
 * Glob patterns use the glob package. Plain paths resolve to single-element arrays.
 * Results exclude .d.ts files and are sorted alphabetically.
 * When gitignore is true (default), results are filtered through .gitignore rules.
 *
 * @param pattern - A glob pattern or direct file path
 * @param cwd - The working directory for resolving relative paths
 * @param gitignore - Whether to respect .gitignore rules (default true)
 * @returns Array of absolute file paths
 * @throws {JsdocError} FILE_NOT_FOUND when a direct path does not exist
 */
export async function discoverFiles(
	pattern: string,
	cwd: string,
	gitignore = true,
): Promise<string[]> {
	const hasGlobChars = /[*?[\]{]/.test(pattern);

	if (hasGlobChars) {
		debugDiscovery("glob pattern=%s", pattern);
		const matches = await glob(pattern, { cwd, absolute: true });
		let filtered = matches.filter(
			(f: string) =>
				(f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".d.ts"),
		);

		if (gitignore) {
			const preFilter = filtered.length;
			const ig = await loadGitignore(cwd);
			filtered = filtered.filter(
				(abs: string) => !ig.ignores(relative(cwd, abs)),
			);
			debugDiscovery(
				"glob done pattern=%s matched=%d after-gitignore=%d",
				pattern,
				preFilter,
				filtered.length,
			);
		} else {
			debugDiscovery(
				"glob done pattern=%s matched=%d",
				pattern,
				filtered.length,
			);
		}

		// Deduplicate by realpath so symlinks to the same physical file are
		// processed only once. Glob prevents infinite cycles but can still
		// return the same inode at multiple paths (e.g. via directory symlinks).
		const withRealpaths = await Promise.all(
			filtered.map(async (abs) => ({
				abs,
				real: await realpath(abs).catch(() => abs),
			})),
		);
		const seen = new Set<string>();
		const deduped: string[] = [];
		for (const { abs, real } of withRealpaths) {
			if (seen.has(real)) {
				debugDiscovery(
					"symlink dedup: skipping %s (same realpath as earlier entry %s)",
					abs,
					real,
				);
				continue;
			}
			seen.add(real);
			deduped.push(abs);
		}

		return deduped.sort();
	}

	// Direct path
	const resolved = resolve(cwd, pattern);
	let statResult: Awaited<ReturnType<typeof stat>>;
	try {
		statResult = await stat(resolved);
	} catch {
		throw new JsdocError("FILE_NOT_FOUND", `File not found: ${pattern}`);
	}
	if (statResult.isDirectory()) {
		debugDiscovery(
			"discoverFiles recursing: directory path=%s → glob",
			resolved,
		);
		return discoverFiles(`${resolved}/**`, cwd, gitignore);
	}
	return [resolved];
}
