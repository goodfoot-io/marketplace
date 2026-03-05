/**
 * Lint mode runs eslint-plugin-jsdoc and custom jsdoczoom rules against
 * discovered files, returning per-file diagnostics with line/column
 * positions, rule names, messages, and severity levels. A single ESLint
 * instance is created per invocation with the correct working directory
 * so that files outside the process cwd are handled correctly. The limit
 * parameter caps the number of files with issues included in the result.
 *
 * @summary Lint files for comprehensive JSDoc quality using ESLint engine
 */

import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { ESLint } from "eslint";
import { findMissingBarrels } from "./barrel.js";
import { processWithCache } from "./cache.js";
import { debugLint, flushCacheSummary, time } from "./debug.js";
import { JsdocError } from "./errors.js";
import { createLintLinter, lintFileForLint } from "./eslint-engine.js";
import { discoverFiles } from "./file-discovery.js";
import type {
	CacheConfig,
	LintFileResult,
	LintResult,
	SelectorInfo,
} from "./types.js";
import { DEFAULT_CACHE_DIR } from "./types.js";

/**
 * Lint a single file and return per-file diagnostics.
 *
 * @param eslint - Reusable ESLint instance with correct cwd
 * @param filePath - Absolute path to the file
 * @param cwd - Working directory for computing relative paths
 * @param config - Cache configuration
 * @returns File result with relative path and diagnostics array
 */
async function lintSingleFile(
	eslint: ESLint,
	filePath: string,
	cwd: string,
	config: CacheConfig,
): Promise<LintFileResult> {
	const sourceText = await readFile(filePath, "utf-8");
	const { diagnostics } = await processWithCache(
		config,
		"lint",
		sourceText,
		async () => {
			const diagnostics = await lintFileForLint(eslint, sourceText, filePath);
			return { diagnostics };
		},
	);
	return { filePath: relative(cwd, filePath), diagnostics };
}

/**
 * Build a LintResult from per-file results, applying a limit to files with issues.
 *
 * @param fileResults - All per-file lint results
 * @param totalFiles - Total number of files that were linted
 * @param limit - Maximum number of files with issues to include
 * @param missingBarrels - Directories missing barrel files
 * @returns Aggregated lint result with summary statistics
 */
function buildLintResult(
	fileResults: LintFileResult[],
	totalFiles: number,
	limit: number,
	missingBarrels: string[],
): LintResult {
	const filesWithIssues = fileResults.filter((f) => f.diagnostics.length > 0);
	const totalDiagnostics = filesWithIssues.reduce(
		(sum, f) => sum + f.diagnostics.length,
		0,
	);

	const cappedFiles = filesWithIssues.slice(0, limit);
	const truncated = filesWithIssues.length > limit;

	return {
		files: cappedFiles,
		...(missingBarrels.length > 0 ? { missingBarrels } : {}),
		summary: {
			totalFiles,
			filesWithIssues: filesWithIssues.length,
			totalDiagnostics,
			...(truncated ? { truncated: true } : {}),
		},
	};
}

/**
 * Lint files matching a selector pattern for comprehensive JSDoc quality.
 *
 * Discovers files via glob or path selector, creates a single ESLint instance
 * with both jsdoczoom and eslint-plugin-jsdoc rules, and returns per-file
 * diagnostics with summary statistics.
 *
 * @param selector - Selector information (glob or path)
 * @param cwd - Working directory for resolving paths
 * @param limit - Max number of files with issues to include (default 100)
 * @param gitignore - Whether to respect .gitignore rules (default true)
 * @param config - Cache configuration (default enabled with DEFAULT_CACHE_DIR)
 * @returns Lint result with per-file diagnostics and summary
 * @throws {JsdocError} NO_FILES_MATCHED if glob selector matches no files
 */
export async function lint(
	selector: SelectorInfo,
	cwd: string,
	limit = 100,
	gitignore = true,
	config: CacheConfig = { enabled: true, directory: DEFAULT_CACHE_DIR },
): Promise<LintResult> {
	const files = await discoverFiles(selector.pattern, cwd, gitignore);
	if (files.length === 0 && selector.type === "glob") {
		throw new JsdocError(
			"NO_FILES_MATCHED",
			`No files matched: ${selector.pattern}`,
		);
	}

	const tsFiles = files.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

	const eslint = createLintLinter(cwd);
	debugLint("lint start files=%d pattern=%s", tsFiles.length, selector.pattern);
	const fileResults = await time(
		debugLint,
		`lint ${tsFiles.length} files`,
		() =>
			Promise.all(tsFiles.map((f) => lintSingleFile(eslint, f, cwd, config))),
	);
	flushCacheSummary(`lint ${tsFiles.length} files`);
	const missingBarrels = await findMissingBarrels(tsFiles, cwd);

	return buildLintResult(fileResults, tsFiles.length, limit, missingBarrels);
}

/**
 * Lint an explicit list of file paths for comprehensive JSDoc quality.
 *
 * Filters to .ts/.tsx files only (useful for stdin input), then runs
 * the full lint rule set against each file.
 *
 * @param filePaths - List of absolute file paths to lint
 * @param cwd - Working directory for computing relative paths
 * @param limit - Max number of files with issues to include (default 100)
 * @param config - Cache configuration (default enabled with DEFAULT_CACHE_DIR)
 * @returns Lint result with per-file diagnostics and summary
 */
export async function lintFiles(
	filePaths: string[],
	cwd: string,
	limit = 100,
	config: CacheConfig = { enabled: true, directory: DEFAULT_CACHE_DIR },
): Promise<LintResult> {
	const tsFiles = filePaths.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);

	const eslint = createLintLinter(cwd);
	debugLint("lintFiles start files=%d", tsFiles.length);
	const fileResults = await time(
		debugLint,
		`lintFiles ${tsFiles.length} files`,
		() =>
			Promise.all(tsFiles.map((f) => lintSingleFile(eslint, f, cwd, config))),
	);
	flushCacheSummary(`lintFiles ${tsFiles.length} files`);
	const missingBarrels = await findMissingBarrels(tsFiles, cwd);

	return buildLintResult(fileResults, tsFiles.length, limit, missingBarrels);
}
