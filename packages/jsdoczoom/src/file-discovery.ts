import { readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { glob } from "glob";
import ignore, { type Ignore } from "ignore";
import { JsdocError } from "./errors.js";

/**
 * Walks .gitignore files from cwd to filesystem root, building an ignore
 * filter that glob results pass through. Direct-path lookups bypass the
 * filter since the user explicitly named the file. The ignore instance is
 * created per call -- no caching -- because cwd may differ between invocations.
 *
 * @summary Resolve selector patterns to absolute file paths with gitignore filtering
 */

/**
 * Walk from `cwd` up to the filesystem root, collecting .gitignore entries.
 * Returns an Ignore instance loaded with all discovered rules.
 */
export async function loadGitignore(cwd: string): Promise<Ignore> {
	const ig = ignore();
	let dir = resolve(cwd);

	while (true) {
		const gitignorePath = join(dir, ".gitignore");
		try {
			const content = await readFile(gitignorePath, "utf-8");
			const prefix = relative(cwd, dir);
			const lines = content
				.split("\n")
				.map((l: string) => l.trim())
				.filter((l: string) => l && !l.startsWith("#"));

			for (const line of lines) {
				// Prefix rules from ancestor .gitignore files so paths are
				// relative to `cwd`, which is where glob results are anchored.
				ig.add(prefix ? `${prefix}/${line}` : line);
			}
		} catch {
			// No .gitignore at this level, continue walking up
		}

		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
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
		const matches = await glob(pattern, { cwd, absolute: true });
		let filtered = matches.filter(
			(f: string) =>
				(f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".d.ts"),
		);

		if (gitignore) {
			const ig = await loadGitignore(cwd);
			filtered = filtered.filter(
				(abs: string) => !ig.ignores(relative(cwd, abs)),
			);
		}

		return filtered.sort();
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
		return discoverFiles(`${resolved}/**`, cwd, gitignore);
	}
	return [resolved];
}
