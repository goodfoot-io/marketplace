import { readFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { getBarrelChildren, isBarrel } from "./barrel.js";
import { JsdocError } from "./errors.js";
import { discoverFiles } from "./file-discovery.js";
import { parseFileSummaries } from "./jsdoc-parser.js";
import { generateTypeDeclarations } from "./type-declarations.js";
import type {
	DrilldownResult,
	OutputEntry,
	OutputErrorItem,
	ParsedFileInfo,
	SelectorInfo,
} from "./types.js";

/**
 * Each file has a fixed 4-level structure: summary (L1), description (L2),
 * type declarations (L3), and full file content (L4). Levels are 1-indexed.
 * Null levels are skipped automatically. In glob mode, barrel files (index.ts)
 * with summaries gate their children for two depths (L1 and L2), then
 * transition at depth 3 where the barrel disappears and children appear.
 *
 * When more detail is available, output items contain a `next_id` pointing
 * to the next level. At the terminal level, items contain an `id` representing
 * the current state.
 *
 * @summary Progressive drill-down through file documentation with barrel gating in glob mode
 */

/** Level content with a lazy text accessor. */
type Level = { text: () => string } | null;

/** Terminal level (1-indexed): 1=summary, 2=description, 3=type declarations, 4=full file. */
const TERMINAL_LEVEL = 4;

/**
 * Build the fixed drill-down level array for a file.
 *
 * - Level 1 (index 0): @summary text (null if absent)
 * - Level 2 (index 1): description text (null if absent)
 * - Level 3 (index 2): type declarations (always present)
 * - Level 4 (index 3): full file content (always present, terminal)
 *
 * The array always has 4 entries. Null entries are skipped during processing.
 */
function buildLevels(info: ParsedFileInfo): [Level, Level, Level, Level] {
	const { summary, description } = info;
	return [
		summary !== null ? { text: () => summary } : null,
		description !== null ? { text: () => description } : null,
		{ text: () => generateTypeDeclarations(info.path) },
		{ text: () => readFileSync(info.path, "utf-8") },
	];
}

/**
 * Compute the display id path for a file. Barrel files (index.ts/index.tsx)
 * use their parent directory path so they represent the directory.
 */
function displayPath(filePath: string, cwd: string): string {
	const rel = relative(cwd, filePath);
	if (isBarrel(filePath)) {
		const dir = relative(cwd, dirname(filePath));
		return dir || ".";
	}
	return rel;
}

/**
 * Extract the sort key from an output entry (either next_id or id).
 */
function sortKey(entry: OutputEntry): string {
	if ("next_id" in entry) return entry.next_id;
	return entry.id;
}

/**
 * Process a single file at a given depth through the drill-down levels.
 *
 * Levels are 1-indexed: 1=summary, 2=description, 3=type declarations, 4=full file.
 * If the requested depth level is null (empty), advance to the next non-null level.
 * Output contains next_id when more detail is available, or id at terminal level.
 */
function processFile(
	info: ParsedFileInfo,
	depth: number,
	cwd: string,
): OutputEntry {
	const idPath = displayPath(info.path, cwd);
	const levels = buildLevels(info);

	// Clamp depth to [1, TERMINAL_LEVEL], advance past null levels
	let effectiveDepth = Math.max(1, Math.min(depth, TERMINAL_LEVEL));
	while (
		effectiveDepth < TERMINAL_LEVEL &&
		levels[effectiveDepth - 1] === null
	) {
		effectiveDepth++;
	}
	const level = levels[effectiveDepth - 1] as { text: () => string };

	if (effectiveDepth < TERMINAL_LEVEL) {
		return {
			next_id: `${idPath}@${effectiveDepth + 1}`,
			text: level.text(),
		};
	}
	return {
		id: `${idPath}@${effectiveDepth}`,
		text: level.text(),
	};
}

/**
 * Create an OutputErrorItem for a PARSE_ERROR.
 */
function makeParseErrorItem(
	filePath: string,
	error: JsdocError,
	cwd: string,
): OutputErrorItem {
	return {
		id: displayPath(filePath, cwd),
		error: { code: error.code, message: error.message },
	};
}

/**
 * Check if an error is a PARSE_ERROR JsdocError.
 */
function isParseError(error: unknown): error is JsdocError {
	return error instanceof JsdocError && error.code === "PARSE_ERROR";
}

/**
 * Process a file safely, returning an OutputErrorItem on PARSE_ERROR.
 * Rethrows non-PARSE_ERROR exceptions.
 */
function processFileSafe(
	filePath: string,
	depth: number,
	cwd: string,
): OutputEntry {
	try {
		const info = parseFileSummaries(filePath);
		return processFile(info, depth, cwd);
	} catch (error) {
		if (isParseError(error)) return makeParseErrorItem(filePath, error, cwd);
		throw error;
	}
}

/**
 * Information about a barrel file's summary status and children.
 */
interface BarrelInfo {
	path: string;
	hasSummary: boolean;
	hasDescription: boolean;
	children: string[];
}

/**
 * Gather barrel info and error entries from a list of barrel file paths.
 * Returns successfully parsed barrel infos and error entries for unparseable barrels.
 */
function gatherBarrelInfos(
	barrelPaths: string[],
	cwd: string,
): { infos: BarrelInfo[]; errors: OutputEntry[] } {
	const infos: BarrelInfo[] = [];
	const errors: OutputEntry[] = [];

	for (const barrelPath of barrelPaths) {
		try {
			const info = parseFileSummaries(barrelPath);
			const children = getBarrelChildren(barrelPath, cwd);
			infos.push({
				path: barrelPath,
				hasSummary: info.summary !== null,
				hasDescription: info.description !== null,
				children,
			});
		} catch (error) {
			if (isParseError(error)) {
				errors.push(makeParseErrorItem(barrelPath, error, cwd));
				continue;
			}
			throw error;
		}
	}

	return { infos, errors };
}

/**
 * Build the set of files gated by barrels that have summaries.
 */
function buildGatedFileSet(barrelInfos: BarrelInfo[]): Set<string> {
	const gated = new Set<string>();
	for (const barrel of barrelInfos) {
		if (barrel.hasSummary) {
			for (const child of barrel.children) {
				gated.add(child);
			}
		}
	}
	return gated;
}

/**
 * Process a single barrel at the given depth (1-indexed).
 * Barrels without summaries appear as regular files (no gating).
 * Barrels with summaries gate children for two depths (L1 summary, L2 description),
 * then transition at depth 3 where the barrel disappears and children appear.
 */
function processBarrelAtDepth(
	barrel: BarrelInfo,
	depth: number,
	cwd: string,
): OutputEntry[] {
	if (!barrel.hasSummary) return [processFileSafe(barrel.path, depth, cwd)];

	// Null-skip: if depth 2 but no description, advance to transition depth
	let effectiveDepth = depth;
	if (effectiveDepth === 2 && !barrel.hasDescription) {
		effectiveDepth = 3;
	}

	if (effectiveDepth < 3) {
		// Show barrel's own L1 (summary) or L2 (description)
		return [processFileSafe(barrel.path, effectiveDepth, cwd)];
	}

	// Barrel transitions: barrel disappears, children appear
	const childDepth = effectiveDepth - 2;
	return collectSafeResults(barrel.children, childDepth, cwd);
}

/**
 * Process a list of files through processFileSafe.
 */
function collectSafeResults(
	files: string[],
	depth: number,
	cwd: string,
): OutputEntry[] {
	return files.map((filePath) => processFileSafe(filePath, depth, cwd));
}

/**
 * Process files discovered via glob with barrel gating.
 *
 * When a glob discovers an index.ts barrel:
 * 1. If the barrel has a summary and depth < 3: show barrel summary/description (gates children)
 * 2. If depth >= 3: barrel transitions -- barrel disappears and children appear at depth - 2
 * 3. If barrel has no summary: not a tree node, children appear as leaves
 *
 * A barrel that is itself gated by a parent barrel is not processed independently.
 * Non-barrel files that are not gated by any barrel are processed normally.
 */
function processGlobWithBarrels(
	files: string[],
	depth: number,
	cwd: string,
): OutputEntry[] {
	const barrelPaths: string[] = [];
	const nonBarrelPaths: string[] = [];

	for (const filePath of files) {
		if (isBarrel(filePath)) {
			barrelPaths.push(filePath);
		} else {
			nonBarrelPaths.push(filePath);
		}
	}

	if (barrelPaths.length === 0) {
		return collectSafeResults(nonBarrelPaths, depth, cwd);
	}

	const { infos: barrelInfos, errors: barrelErrors } = gatherBarrelInfos(
		barrelPaths,
		cwd,
	);
	const gatedFiles = buildGatedFileSet(barrelInfos);

	const results: OutputEntry[] = [...barrelErrors];

	for (const barrel of barrelInfos) {
		if (gatedFiles.has(barrel.path)) continue;
		results.push(...processBarrelAtDepth(barrel, depth, cwd));
	}

	const ungatedNonBarrels = nonBarrelPaths.filter((f) => !gatedFiles.has(f));
	results.push(...collectSafeResults(ungatedNonBarrels, depth, cwd));

	return results;
}

/**
 * Main entry point for normal-mode processing.
 *
 * Resolves files from a selector, processes each through the drill-down model,
 * and returns an array of output entries. Barrel gating is applied in glob mode.
 * Depth is 1-indexed (default 1).
 *
 * @param selector - Parsed selector with type, pattern, and optional depth
 * @param cwd - Working directory for file resolution
 * @returns Array of output entries sorted alphabetically by path
 * @throws {JsdocError} FILE_NOT_FOUND for missing path selector target
 * @throws {JsdocError} NO_FILES_MATCHED for empty glob results
 * @throws {JsdocError} PARSE_ERROR for path selector targeting file with syntax errors
 */
export function drilldown(
	selector: SelectorInfo,
	cwd: string,
	gitignore = true,
	limit = 100,
): DrilldownResult {
	const depth = selector.depth ?? 1;

	if (selector.type === "path") {
		const files = discoverFiles(selector.pattern, cwd, gitignore);

		if (files.length > 1) {
			// Directory expanded to multiple files — route through glob pipeline
			const results = processGlobWithBarrels(files, depth, cwd);
			const sorted = results.sort((a, b) =>
				sortKey(a).localeCompare(sortKey(b)),
			);
			const total = sorted.length;
			const truncated = total > limit;
			return {
				items: sorted.slice(0, limit),
				truncated,
			};
		}

		// Single file path — errors are fatal, no barrel gating
		const filePath = files[0];
		const info = parseFileSummaries(filePath);
		const items = [processFile(info, depth, cwd)];
		return { items, truncated: false };
	}

	// Glob selector — apply barrel gating
	const files = discoverFiles(selector.pattern, cwd, gitignore);
	if (files.length === 0) {
		throw new JsdocError(
			"NO_FILES_MATCHED",
			`No files matched: ${selector.pattern}`,
		);
	}

	const results = processGlobWithBarrels(files, depth, cwd);

	// Sort alphabetically by key
	const sorted = results.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
	const total = sorted.length;
	const truncated = total > limit;
	return {
		items: sorted.slice(0, limit),
		truncated,
	};
}

/**
 * Process an explicit list of file paths at a given depth.
 *
 * Used for stdin input. Always treats paths as leaf files (no barrel gating).
 * Filters to .ts/.tsx only. Depth is 1-indexed (default 1).
 *
 * @param filePaths - Array of absolute file paths
 * @param depth - Drill-down depth, 1-indexed (defaults to 1 if undefined)
 * @param cwd - Working directory for relative path output
 * @returns Array of output entries sorted alphabetically by path
 */
export function drilldownFiles(
	filePaths: string[],
	depth: number | undefined,
	cwd: string,
	limit = 100,
): DrilldownResult {
	const d = depth ?? 1;
	const tsFiles = filePaths.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);

	const results = collectSafeResults(tsFiles, d, cwd);
	const sorted = results.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
	const total = sorted.length;
	const truncated = total > limit;
	return {
		items: sorted.slice(0, limit),
		truncated,
	};
}
