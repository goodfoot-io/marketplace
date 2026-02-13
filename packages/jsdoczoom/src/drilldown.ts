import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { getBarrelChildren, isBarrel } from "./barrel.js";
import { JsdocError } from "./errors.js";
import { discoverFiles } from "./file-discovery.js";
import { parseFileSummaries } from "./jsdoc-parser.js";
import { generateTypeDeclarations } from "./type-declarations.js";
import type { OutputEntry, OutputErrorItem, SelectorInfo } from "./types.js";

/**
 * Process a single file at a given depth through the drill-down levels.
 *
 * Layer-skipping model — builds an ordered level list from non-empty layers:
 * - Level 0: @summary text (always present — files with null summary are filtered before reaching here)
 * - Level 1: description text (included only if non-null, otherwise skipped)
 * - Next level: type declarations + JSDoc (more=true)
 * - Last level: full file content (more=false, terminal)
 *
 * Files with description have 4 levels (depths 0–3).
 * Files without description have 3 levels (depths 0–2).
 * Depth is clamped to the terminal level.
 */
function processFile(
	filePath: string,
	depth: number,
	cwd: string,
): OutputEntry {
	const info = parseFileSummaries(filePath);
	const relativePath = relative(cwd, filePath);

	// Build ordered level list, skipping empty layers
	const levels: Array<{ text: () => string; more: boolean }> = [];

	// Level 0: summary (always present)
	levels.push({ text: () => info.summary as string, more: true });

	// Level 1: description (only if non-null)
	if (info.description !== null) {
		levels.push({ text: () => info.description as string, more: true });
	}

	// Type declarations level (more=true)
	levels.push({ text: () => generateTypeDeclarations(filePath), more: true });

	// Full file content level (terminal, more=false)
	levels.push({ text: () => readFileSync(filePath, "utf-8"), more: false });

	const terminalIndex = levels.length - 1;
	const effectiveDepth = Math.min(depth, terminalIndex);

	const level = levels[effectiveDepth];
	return {
		id: `${relativePath}@${effectiveDepth}`,
		path: relativePath,
		more: level.more,
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
		path: relativePath,
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
 * Returns null if the file has no summaries.
 * Rethrows non-PARSE_ERROR exceptions.
 */
function processFileSafe(
	filePath: string,
	depth: number,
	cwd: string,
): OutputEntry | null {
	try {
		const info = parseFileSummaries(filePath);
		if (info.summary === null) return null;
		return processFile(filePath, depth, cwd);
	} catch (error) {
		if (isParseError(error)) return makeParseErrorItem(filePath, error, cwd);
		throw error;
	}
}

/**
 * Information about a barrel file's summary levels and children.
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
 * Returns the barrel's own summary entry if still gating, or its children's entries
 * if the barrel has transitioned.
 */
function processBarrelAtDepth(
	barrel: BarrelInfo,
	depth: number,
	cwd: string,
): OutputEntry[] {
	if (!barrel.hasSummary) return [];

	if (depth < 1) {
		const result = processFileSafe(barrel.path, depth, cwd);
		return result ? [result] : [];
	}

	// Barrel transitions: barrel disappears, children appear
	const childDepth = depth - 1;
	return collectSafeResults(barrel.children, childDepth, cwd);
}

/**
 * Process a list of files through processFileSafe, collecting non-null results.
 */
function collectSafeResults(
	files: string[],
	depth: number,
	cwd: string,
): OutputEntry[] {
	const results: OutputEntry[] = [];
	for (const filePath of files) {
		const result = processFileSafe(filePath, depth, cwd);
		if (result) results.push(result);
	}
	return results;
}

/**
 * Process files discovered via glob with barrel gating.
 *
 * When a glob discovers an index.ts barrel:
 * 1. If the barrel has summaries and depth < barrel's summary count:
 *    show barrel summary (barrel gates its children)
 * 2. If depth >= barrel's summary count: barrel transitions -- barrel disappears
 *    and its children appear at depth - barrelSummaryCount
 * 3. If barrel has 0 summaries: not a tree node, children appear as leaves
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
 * @throws {JsdocError} NO_SUMMARY_FOUND for path selector targeting file without summaries
 * @throws {JsdocError} PARSE_ERROR for path selector targeting file with syntax errors
 */
export function drilldown(selector: SelectorInfo, cwd: string): OutputEntry[] {
	const depth = selector.depth ?? 0;

	if (selector.type === "path") {
		// Single file path — errors are fatal, no barrel gating
		const files = discoverFiles(selector.pattern, cwd);
		const filePath = files[0];
		const info = parseFileSummaries(filePath);
		if (info.summary === null) {
			throw new JsdocError(
				"NO_SUMMARY_FOUND",
				`No summary found: ${selector.pattern}`,
			);
		}
		return [processFile(filePath, depth, cwd)];
	}

	// Glob selector — apply barrel gating
	const files = discoverFiles(selector.pattern, cwd);
	if (files.length === 0) {
		throw new JsdocError(
			"NO_FILES_MATCHED",
			`No files matched: ${selector.pattern}`,
		);
	}

	const results = processGlobWithBarrels(files, depth, cwd);

	if (results.length === 0) {
		throw new JsdocError(
			"NO_FILES_MATCHED",
			`No files with summaries matched: ${selector.pattern}`,
		);
	}

	// Sort alphabetically by path
	return results.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Process an explicit list of file paths at a given depth.
 *
 * Used for stdin input. Always treats paths as leaf files (no barrel gating).
 * Filters to .ts/.tsx only. Excludes files with no summaries.
 * Does NOT throw NO_FILES_MATCHED for empty results.
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
): OutputEntry[] {
	const d = depth ?? 0;
	const tsFiles = filePaths.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);

	const results = collectSafeResults(tsFiles, d, cwd);
	return results.sort((a, b) => a.path.localeCompare(b.path));
}
