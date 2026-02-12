import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

/**
 * Barrel detection and child discovery for index.ts/index.tsx files.
 *
 * @summary Barrel tree model for hierarchical gating in glob mode
 * @summary Detects barrels and discovers their children for drill-down gating
 */

/**
 * Check if a file path refers to a barrel file (index.ts or index.tsx).
 *
 * A barrel is a file named exactly `index.ts` or `index.tsx`.
 * Files like `index.test.ts`, `index.d.ts`, `index.stories.tsx` are NOT barrels.
 *
 * @param filePath - Absolute or relative file path to check
 * @returns true if the file is a barrel (index.ts or index.tsx)
 */
export function isBarrel(filePath: string): boolean {
	const name = basename(filePath);
	return name === "index.ts" || name === "index.tsx";
}

/**
 * Discover the children of a barrel file.
 *
 * Children include:
 * - Sibling .ts/.tsx files in the same directory (excluding the barrel itself, excluding .d.ts)
 * - Child barrels (index.ts or index.tsx) in immediate subdirectories
 *   - index.ts takes priority over index.tsx in the same subdirectory
 *
 * @param barrelPath - Absolute path to the barrel file (index.ts or index.tsx)
 * @param _cwd - Working directory (unused, kept for API consistency)
 * @returns Sorted array of absolute paths to child files
 */
export function getBarrelChildren(barrelPath: string, _cwd: string): string[] {
	const dir = dirname(barrelPath);
	const barrelName = basename(barrelPath);

	let entries: string[];
	try {
		entries = readdirSync(dir, { withFileTypes: true })
			.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
			.flatMap((entry) => {
				if (entry.isDirectory) {
					// Check for child barrel in this subdirectory
					const childBarrel = findChildBarrel(resolve(dir, entry.name));
					return childBarrel ? [childBarrel] : [];
				}
				// Sibling file: must be .ts/.tsx, not .d.ts, not the barrel itself
				if (isTsFile(entry.name) && entry.name !== barrelName) {
					return [resolve(dir, entry.name)];
				}
				return [];
			});
	} catch {
		return [];
	}

	return entries.sort();
}

/**
 * Check if a filename is a .ts or .tsx file (excluding .d.ts).
 */
function isTsFile(name: string): boolean {
	return (
		(name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".d.ts")
	);
}

/**
 * Find the barrel file in a subdirectory.
 * index.ts takes priority over index.tsx.
 * Returns the absolute path to the barrel, or null if none found.
 */
function findChildBarrel(subdirPath: string): string | null {
	const tsPath = resolve(subdirPath, "index.ts");
	if (existsSync(tsPath)) {
		return tsPath;
	}
	const tsxPath = resolve(subdirPath, "index.tsx");
	if (existsSync(tsxPath)) {
		return tsxPath;
	}
	return null;
}
