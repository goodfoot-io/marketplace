import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { getBarrelChildren, isBarrel } from "./barrel.js";
import { JsdocError } from "./errors.js";
import { discoverFiles } from "./file-discovery.js";
import { parseFileSummaries } from "./jsdoc-parser.js";
import type {
	DrilldownResult,
	OutputEntry,
	OutputErrorItem,
	ParsedFileInfo,
	SelectorInfo,
} from "./types.js";

/** Level content with a lazy text accessor. */
type Level = { text: () => string } | null;

/** Fixed 3-level structure: 0=summary, 1=description, 2=full file. */
const TERMINAL_LEVEL = 2;

/**
 * Build the fixed drill-down level array for a file.
 *
 * - Level 0: @summary text (null if absent)
 * - Level 1: description text (null if absent)
 * - Level 2: full file content (always present, terminal)
 *
 * The array always has 3 entries. Null entries are skipped during processing.
 */
function buildLevels(info: ParsedFileInfo): [Level, Level, Level] {
	const { summary, description } = info;
	return [
		summary !== null ? { text: () => summary } : null,
		description !== null ? { text: () => description } : null,
		{ text: () => readFileSync(info.path, "utf-8") },
	];
}

/**
 * Process a single file at a given depth through the drill-down levels.
 *
 * Levels are fixed: 0=summary, 1=description, 2=full file.
 * If the requested depth is null (empty), advance to the next non-null level.
 * The output id always reflects the actual level shown.
 */
function processFile(
	info: ParsedFileInfo,
	depth: number,
	cwd: string,
): OutputEntry {
	const relativePath = relative(cwd, info.path);
	const levels = buildLevels(info);

	// Start at requested depth (clamped to terminal), advance past null levels
	let effectiveDepth = Math.min(depth, TERMINAL_LEVEL);
	while (effectiveDepth < TERMINAL_LEVEL && levels[effectiveDepth] === null) {
		effectiveDepth++;
	}
	const level = levels[effectiveDepth] as { text: () => string };

	return {
		id: `${relativePath}@${effectiveDepth}`,
		more: effectiveDepth < TERMINAL_LEVEL,
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
	const relativePath = relative(cwd, filePath);
	return {
		id: relativePath,
		more: false as const,
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
 * Process a single barrel at the given depth.
 * Barrels without summaries appear as regular files (no gating).
 * Barrels with summaries gate children until transition depth.
 */
function processBarrelAtDepth(
	barrel: BarrelInfo,
	depth: number,
	cwd: string,
): OutputEntry[] {
	if (!barrel.hasSummary) return [processFileSafe(barrel.path, depth, cwd)];

	if (depth < 1) {
		return [processFileSafe(barrel.path, depth, cwd)];
	}

	// Barrel transitions: barrel disappears, children appear
	const childDepth = depth - 1;
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
 * 1. If the barrel has a summary and depth < 1: show barrel summary (gates children)
 * 2. If depth >= 1: barrel transitions -- barrel disappears and children appear at depth - 1
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
	const depth = selector.depth ?? 0;

	if (selector.type === "path") {
		// Single file path — errors are fatal, no barrel gating
		const files = discoverFiles(selector.pattern, cwd, gitignore);
		const filePath = files[0];
		const info = parseFileSummaries(filePath);
		const items = [processFile(info, depth, cwd)];
		return { items, summary: { total: 1, truncated: false } };
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

	// Sort alphabetically by id
	const sorted = results.sort((a, b) => a.id.localeCompare(b.id));
	const total = sorted.length;
	const truncated = total > limit;
	return {
		items: sorted.slice(0, limit),
		summary: { total, truncated },
	};
}

/**
 * Process an explicit list of file paths at a given depth.
 *
 * Used for stdin input. Always treats paths as leaf files (no barrel gating).
 * Filters to .ts/.tsx only.
 *
 * @param filePaths - Array of absolute file paths
 * @param depth - Drill-down depth (defaults to 0 if undefined)
 * @param cwd - Working directory for relative path output
 * @returns Array of output entries sorted alphabetically by path
 */
export function drilldownFiles(
	filePaths: string[],
	depth: number | undefined,
	cwd: string,
	limit = 100,
): DrilldownResult {
	const d = depth ?? 0;
	const tsFiles = filePaths.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);

	const results = collectSafeResults(tsFiles, d, cwd);
	const sorted = results.sort((a, b) => a.id.localeCompare(b.id));
	const total = sorted.length;
	const truncated = total > limit;
	return {
		items: sorted.slice(0, limit),
		summary: { total, truncated },
	};
}
