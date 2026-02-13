import { relative } from "node:path";
import { JsdocError } from "./errors.js";
import { discoverFiles } from "./file-discovery.js";
import { parseFileSummaries } from "./jsdoc-parser.js";
import type {
	SelectorInfo,
	ValidationFileResult,
	ValidationResult,
} from "./types.js";

/**
 * Validate a single file against validation requirements.
 *
 * Validation checks:
 * 1. No syntax errors
 * 2. Has file-level JSDoc block
 * 3. Has @summary tag
 * 4. Has description
 */
function validateFile(filePath: string, cwd: string): ValidationFileResult {
	const relativePath = relative(cwd, filePath);
	const issues: string[] = [];

	try {
		const info = parseFileSummaries(filePath);

		if (!info.hasFileJsdoc) {
			issues.push(
				"Missing file-level JSDoc block. Add a /** ... */ comment before the first code statement with a @summary tag for concise orientation and a description paragraph explaining responsibilities, invariants, and trade-offs.",
			);
			return { path: relativePath, passed: false, issues };
		}

		if (info.summary === null) {
			issues.push(
				"Missing @summary tag. Add @summary followed by a concise one-line overview of what this file does — enough for quick orientation when scanning a codebase.",
			);
			return { path: relativePath, passed: false, issues };
		}

		if (info.description === null) {
			issues.push(
				"Missing description. Add a prose paragraph at the top of the JSDoc block (before any @ tags) explaining the file's responsibilities, invariants, trade-offs, and failure modes — the deepest native documentation level.",
			);
			return { path: relativePath, passed: false, issues };
		}

		return { path: relativePath, passed: true, issues: [] };
	} catch (error) {
		if (error instanceof JsdocError && error.code === "PARSE_ERROR") {
			issues.push(`Syntax error: ${error.message}`);
			return { path: relativePath, passed: false, issues };
		}
		throw error;
	}
}

/**
 * Build a ValidationResult from a list of file validation results.
 */
function buildResult(fileResults: ValidationFileResult[]): ValidationResult {
	const passed = fileResults.filter((f) => f.passed).length;
	return {
		files: fileResults,
		summary: {
			total: fileResults.length,
			passed,
			failed: fileResults.length - passed,
		},
	};
}

/**
 * Validate files matching a selector pattern.
 *
 * @param selector - Selector information (glob or path)
 * @param cwd - Working directory for resolving paths
 * @returns Validation results with per-file details and summary
 * @throws {JsdocError} INVALID_DEPTH if selector has @depth suffix
 * @throws {JsdocError} NO_FILES_MATCHED if glob selector matches no files
 * @throws {JsdocError} FILE_NOT_FOUND if path selector targets nonexistent file
 */
export function validate(
	selector: SelectorInfo,
	cwd: string,
): ValidationResult {
	if (selector.depth !== undefined) {
		throw new JsdocError(
			"INVALID_DEPTH",
			"Validation mode does not support @depth",
		);
	}

	const files = discoverFiles(selector.pattern, cwd);
	if (files.length === 0) {
		throw new JsdocError(
			"NO_FILES_MATCHED",
			`No files matched: ${selector.pattern}`,
		);
	}

	const results = files.map((f) => validateFile(f, cwd));
	return buildResult(results);
}

/**
 * Validate an explicit list of file paths.
 *
 * Filters to .ts/.tsx files only (useful for stdin input).
 *
 * @param filePaths - List of file paths to validate
 * @param cwd - Working directory for resolving relative paths
 * @returns Validation results with per-file details and summary
 */
export function validateFiles(
	filePaths: string[],
	cwd: string,
): ValidationResult {
	const tsFiles = filePaths.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);
	const results = tsFiles.map((f) => validateFile(f, cwd));
	return buildResult(results);
}
