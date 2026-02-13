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

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import tsParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import jsdocPlugin from "eslint-plugin-jsdoc";
import { lintFileForLint } from "./eslint-engine.js";
import plugin from "./eslint-plugin.js";
import { JsdocError } from "./errors.js";
import { discoverFiles } from "./file-discovery.js";
import type { LintFileResult, LintResult, SelectorInfo } from "./types.js";

/**
 * Create an ESLint instance configured for lint mode with the given cwd.
 *
 * Sets the ESLint base path to cwd so that files in that directory are
 * not ignored as "outside of base path".
 *
 * @param cwd - Working directory for ESLint base path resolution
 * @returns Configured ESLint instance for lint mode
 */
function createLinterForCwd(cwd: string): ESLint {
	return new ESLint({
		cwd,
		overrideConfigFile: true,
		overrideConfig: [
			{
				files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
				plugins: { jsdoczoom: plugin, jsdoc: jsdocPlugin },
				rules: {
					"jsdoczoom/require-file-jsdoc": "error",
					"jsdoczoom/require-file-summary": "error",
					"jsdoczoom/require-file-description": "error",
					"jsdoc/require-jsdoc": ["error", { publicOnly: true }],
					"jsdoc/require-param": "error",
					"jsdoc/require-param-description": "error",
					"jsdoc/require-returns": "error",
					"jsdoc/require-returns-description": "error",
					"jsdoc/require-throws": "error",
					"jsdoc/check-param-names": "error",
					"jsdoc/check-tag-names": "error",
					"jsdoc/no-types": "error",
					"jsdoc/informative-docs": "error",
					"jsdoc/tag-lines": "error",
					"jsdoc/no-blank-blocks": "error",
					"jsdoc/require-description": "error",
				},
				languageOptions: {
					parser: tsParser,
					ecmaVersion: "latest" as const,
					sourceType: "module" as const,
				},
			},
		],
	});
}

/**
 * Lint a single file and return per-file diagnostics.
 *
 * @param eslint - Reusable ESLint instance with correct cwd
 * @param filePath - Absolute path to the file
 * @param cwd - Working directory for computing relative paths
 * @returns File result with relative path and diagnostics array
 */
async function lintSingleFile(
	eslint: ESLint,
	filePath: string,
	cwd: string,
): Promise<LintFileResult> {
	const sourceText = readFileSync(filePath, "utf-8");
	const diagnostics = await lintFileForLint(eslint, sourceText, filePath);
	return {
		filePath: relative(cwd, filePath),
		diagnostics,
	};
}

/**
 * Build a LintResult from per-file results, applying a limit to files with issues.
 *
 * @param fileResults - All per-file lint results
 * @param totalFiles - Total number of files that were linted
 * @param limit - Maximum number of files with issues to include
 * @returns Aggregated lint result with summary statistics
 */
function buildLintResult(
	fileResults: LintFileResult[],
	totalFiles: number,
	limit: number,
): LintResult {
	const filesWithIssues = fileResults.filter(
		(f) => f.diagnostics.length > 0,
	);
	const totalDiagnostics = filesWithIssues.reduce(
		(sum, f) => sum + f.diagnostics.length,
		0,
	);

	const cappedFiles = filesWithIssues.slice(0, limit);

	return {
		files: cappedFiles,
		summary: {
			totalFiles,
			filesWithIssues: filesWithIssues.length,
			totalDiagnostics,
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
 * @returns Lint result with per-file diagnostics and summary
 * @throws {JsdocError} NO_FILES_MATCHED if glob selector matches no files
 */
export async function lint(
	selector: SelectorInfo,
	cwd: string,
	limit = 100,
	gitignore = true,
): Promise<LintResult> {
	const files = discoverFiles(selector.pattern, cwd, gitignore);
	if (files.length === 0 && selector.type === "glob") {
		throw new JsdocError(
			"NO_FILES_MATCHED",
			`No files matched: ${selector.pattern}`,
		);
	}

	const tsFiles = files.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);

	const eslint = createLinterForCwd(cwd);
	const fileResults = await Promise.all(
		tsFiles.map((f) => lintSingleFile(eslint, f, cwd)),
	);

	return buildLintResult(fileResults, tsFiles.length, limit);
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
 * @returns Lint result with per-file diagnostics and summary
 */
export async function lintFiles(
	filePaths: string[],
	cwd: string,
	limit = 100,
): Promise<LintResult> {
	const tsFiles = filePaths.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);

	const eslint = createLinterForCwd(cwd);
	const fileResults = await Promise.all(
		tsFiles.map((f) => lintSingleFile(eslint, f, cwd)),
	);

	return buildLintResult(fileResults, tsFiles.length, limit);
}
