import { access, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

/**
 * Barrel detection and child discovery for index.ts/index.tsx files.
 * A barrel is strictly `index.ts` or `index.tsx`; other index variants
 * (e.g. `index.test.ts`, `index.d.ts`) are excluded. Children include
 * sibling .ts/.tsx files and child barrels in immediate subdirectories,
 * with index.ts taking priority over index.tsx in the same subdirectory.
 *
 * @summary Detect barrel files and discover their children for drill-down gating
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
export async function getBarrelChildren(
	barrelPath: string,
	_cwd: string,
): Promise<string[]> {
	const dir = dirname(barrelPath);
	const barrelName = basename(barrelPath);

	let rawEntries: { name: string; isDirectory: boolean }[];
	try {
		const dirents = await readdir(dir, { withFileTypes: true });
		rawEntries = dirents.map((e) => ({
			name: e.name,
			isDirectory: e.isDirectory(),
		}));
	} catch {
		// Directory unreadable (permissions, deleted, etc.) — no children discoverable
		return [];
	}

	const entries = (
		await Promise.all(
			rawEntries.map(async (entry) => {
				if (entry.isDirectory) {
					const childBarrel = await findChildBarrel(resolve(dir, entry.name));
					return childBarrel ? [childBarrel] : [];
				}
				if (isTsFile(entry.name) && entry.name !== barrelName) {
					return [resolve(dir, entry.name)];
				}
				return [];
			}),
		)
	).flat();

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
async function findChildBarrel(subdirPath: string): Promise<string | null> {
	const tsPath = resolve(subdirPath, "index.ts");
	try {
		await access(tsPath);
		return tsPath;
	} catch {
		// no index.ts
	}
	const tsxPath = resolve(subdirPath, "index.tsx");
	try {
		await access(tsxPath);
		return tsxPath;
	} catch {
		return null;
	}
}

/** Minimum number of .ts/.tsx files in a directory to require a barrel. */
export const BARREL_THRESHOLD = 3;

/**
 * Find directories with more than BARREL_THRESHOLD .ts/.tsx files
 * that lack a barrel file (index.ts or index.tsx).
 */
export async function findMissingBarrels(
	filePaths: string[],
	cwd: string,
): Promise<string[]> {
	const dirCounts = new Map<string, number>();

	for (const filePath of filePaths) {
		if (isBarrel(filePath)) continue;
		const dir = dirname(filePath);
		dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
	}

	const missing: string[] = [];
	await Promise.all(
		[...dirCounts.entries()].map(async ([dir, count]) => {
			if (count <= BARREL_THRESHOLD) return;
			const [tsExists, tsxExists] = await Promise.all([
				access(join(dir, "index.ts")).then(
					() => true,
					() => false,
				),
				access(join(dir, "index.tsx")).then(
					() => true,
					() => false,
				),
			]);
			if (!tsExists && !tsxExists) {
				missing.push(relative(cwd, dir) || ".");
			}
		}),
	);

	return missing.sort();
}
