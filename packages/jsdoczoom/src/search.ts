import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { processWithCache } from "./cache.js";
import { JsdocError } from "./errors.js";
import { discoverFiles, loadGitignore } from "./file-discovery.js";
import { parseFileSummaries } from "./jsdoc-parser.js";
import {
	extractSourceBlocks,
	generateTypeDeclarations,
	splitDeclarations,
} from "./type-declarations.js";
import type {
	CacheConfig,
	DrilldownResult,
	OutputEntry,
	SelectorInfo,
} from "./types.js";
import { DEFAULT_CACHE_DIR } from "./types.js";

/**
 * Searches TypeScript files for a regex query, returning results at the
 * shallowest matching depth level. Processes each file through a 4-level
 * matching hierarchy: filename/path, summary, description/declarations,
 * and full source content.
 *
 * @summary Search TypeScript documentation and source by regex query
 */

/** Default cache configuration used when no config is provided. */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
	enabled: true,
	directory: DEFAULT_CACHE_DIR,
};

/**
 * Compute the display id path for a file.
 * Uses simple relative path — no barrel-to-directory conversion.
 */
function displayPath(filePath: string, cwd: string): string {
	return relative(cwd, filePath);
}

/**
 * Extract the sort key from an output entry (either next_id or id).
 */
function sortKey(entry: OutputEntry): string {
	if ("next_id" in entry) return entry.next_id;
	return entry.id;
}

/**
 * Process a single file through the 4-level search hierarchy.
 * Returns an OutputEntry if the file matches the query at any level,
 * or null if there is no match. PARSE_ERROR exceptions are rethrown
 * for the caller to handle silently.
 */
async function processFileSafe(
	filePath: string,
	regex: RegExp,
	cwd: string,
	config: CacheConfig,
): Promise<OutputEntry | null> {
	const content = await readFile(filePath, "utf-8");
	const idPath = displayPath(filePath, cwd);

	// Parse summaries once for levels 1-3a
	const info = await processWithCache(config, "drilldown", content, () =>
		parseFileSummaries(filePath),
	);

	// Level 1: filename/path match
	if (regex.test(idPath)) {
		return { next_id: `${idPath}@2`, text: info.summary ?? idPath };
	}

	// Level 2: summary match
	if (info.summary !== null && regex.test(info.summary)) {
		return { next_id: `${idPath}@2`, text: info.summary };
	}

	// Level 3a: description match
	if (info.description !== null && regex.test(info.description)) {
		return { next_id: `${idPath}@3`, text: info.description };
	}

	// Level 3b: type declaration match
	const dts = await processWithCache(
		config,
		"drilldown",
		`${content}\0typedecl`,
		() => generateTypeDeclarations(filePath),
	);
	if (dts.length > 0) {
		const chunks = splitDeclarations(dts);
		const matching = chunks.filter((c) => regex.test(c));
		if (matching.length > 0) {
			return {
				next_id: `${idPath}@3`,
				text: `\`\`\`typescript\n${matching.join("\n\n")}\n\`\`\``,
			};
		}
	}

	// Level 4: source match — prefer extracted blocks, fall back to full file
	const sourceBlocks = extractSourceBlocks(filePath, regex);
	if (sourceBlocks !== null) {
		return {
			id: `${idPath}@4`,
			text: `\`\`\`typescript\n${sourceBlocks}\n\`\`\``,
		};
	}
	if (regex.test(content)) {
		return { id: `${idPath}@4`, text: content };
	}

	return null; // no match
}

/**
 * Compile a query string into a case-insensitive regex.
 * Throws INVALID_SELECTOR if the query is not a valid regex pattern.
 */
function compileRegex(query: string): RegExp {
	try {
		return new RegExp(query, "i");
	} catch (_error) {
		throw new JsdocError("INVALID_SELECTOR", `Invalid regex: ${query}`);
	}
}

/**
 * Apply limit/truncation to sorted results.
 */
function applyLimit(sorted: OutputEntry[], limit: number): DrilldownResult {
	const count = sorted.length;
	const isTruncated = count > limit;
	return {
		items: sorted.slice(0, limit),
		truncated: isTruncated,
		...(isTruncated ? { total: count } : {}),
	};
}

/**
 * Process a list of file paths through the search hierarchy and return sorted results.
 * Files with parse errors are silently skipped.
 */
async function searchFileList(
	files: string[],
	regex: RegExp,
	cwd: string,
	limit: number,
	config: CacheConfig,
): Promise<DrilldownResult> {
	const results = await Promise.all(
		files.map(async (filePath) => {
			try {
				return await processFileSafe(filePath, regex, cwd, config);
			} catch (error) {
				if (error instanceof JsdocError && error.code === "PARSE_ERROR") {
					return null;
				}
				throw error;
			}
		}),
	);

	const matched = results.filter((r): r is OutputEntry => r !== null);
	const sorted = matched.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
	return applyLimit(sorted, limit);
}

/**
 * Search TypeScript files matching a selector for a regex query.
 *
 * Discovers files from the selector pattern, processes each through
 * the 4-level matching hierarchy, and returns results at the shallowest
 * matching depth. Files with parse errors are silently skipped.
 *
 * @param selector - Parsed selector with type and pattern
 * @param query - Regex query string (case-insensitive)
 * @param cwd - Working directory for file resolution
 * @param gitignore - Whether to respect .gitignore rules (default true)
 * @param limit - Maximum number of results to return (default 100)
 * @param config - Cache configuration
 * @throws {JsdocError} INVALID_SELECTOR for invalid regex
 */
export async function search(
	selector: SelectorInfo,
	query: string,
	cwd: string,
	gitignore = true,
	limit = 100,
	config: CacheConfig = DEFAULT_CACHE_CONFIG,
): Promise<DrilldownResult> {
	const regex = compileRegex(query);
	const files = discoverFiles(selector.pattern, cwd, gitignore);
	return searchFileList(files, regex, cwd, limit, config);
}

/**
 * Search an explicit list of file paths for a regex query.
 *
 * Used for stdin input. Filters to .ts/.tsx files, excludes .d.ts.
 * Processes each file through the 4-level matching hierarchy.
 *
 * @param filePaths - Array of absolute file paths
 * @param query - Regex query string (case-insensitive)
 * @param cwd - Working directory for relative path output
 * @param limit - Maximum number of results to return (default 100)
 * @param config - Cache configuration
 * @throws {JsdocError} INVALID_SELECTOR for invalid regex
 */
export async function searchFiles(
	filePaths: string[],
	query: string,
	cwd: string,
	limit = 100,
	config: CacheConfig = DEFAULT_CACHE_CONFIG,
): Promise<DrilldownResult> {
	const regex = compileRegex(query);

	const ig = loadGitignore(cwd);
	const tsFiles = filePaths.filter((f) => {
		if (!(f.endsWith(".ts") || f.endsWith(".tsx")) || f.endsWith(".d.ts")) {
			return false;
		}
		const rel = relative(cwd, f);
		// Files outside cwd (traversal paths) are beyond the gitignore scope
		if (rel.startsWith("..")) return true;
		return !ig.ignores(rel);
	});

	return searchFileList(tsFiles, regex, cwd, limit, config);
}
