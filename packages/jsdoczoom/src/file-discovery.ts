import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { globSync } from "glob";
import { JsdocError } from "./errors.js";

/**
 * Resolve a selector pattern to a list of .ts/.tsx file paths.
 *
 * Glob patterns use the glob package. Plain paths resolve to single-element arrays.
 * Results exclude .d.ts files and are sorted alphabetically.
 *
 * @param pattern - A glob pattern or direct file path
 * @param cwd - The working directory for resolving relative paths
 * @returns Array of absolute file paths
 * @throws {JsdocError} FILE_NOT_FOUND when a direct path does not exist
 */
export function discoverFiles(pattern: string, cwd: string): string[] {
	const hasGlobChars = /[*?[\]{]/.test(pattern);

	if (hasGlobChars) {
		const matches = globSync(pattern, { cwd, absolute: true });
		return matches
			.filter(
				(f) =>
					(f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".d.ts"),
			)
			.sort();
	}

	// Direct path
	const resolved = resolve(cwd, pattern);
	if (!existsSync(resolved)) {
		throw new JsdocError("FILE_NOT_FOUND", `File not found: ${pattern}`);
	}
	return [resolved];
}
