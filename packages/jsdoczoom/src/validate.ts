import { relative } from "node:path";
import { JsdocError } from "./errors.js";
import { discoverFiles } from "./file-discovery.js";
import { parseFileSummaries } from "./jsdoc-parser.js";
import type {
	SelectorInfo,
	ValidationResult,
	ValidationStatus,
} from "./types.js";

/** Internal per-file classification */
interface FileStatus {
	path: string;
	status: ValidationStatus | "valid";
}

/**
 * Classify a single file against validation requirements.
 *
 * Priority order (first failing check wins):
 * 1. syntax_error
 * 2. missing_jsdoc
 * 3. missing_summary
 * 4. missing_description
 */
function classifyFile(filePath: string, cwd: string): FileStatus {
	const relativePath = relative(cwd, filePath);

	try {
		const info = parseFileSummaries(filePath);

		if (!info.hasFileJsdoc) {
			return { path: relativePath, status: "missing_jsdoc" };
		}

		if (info.summary === null) {
			return { path: relativePath, status: "missing_summary" };
		}

		if (info.description === null) {
			return { path: relativePath, status: "missing_description" };
		}

		return { path: relativePath, status: "valid" };
	} catch (error) {
		if (error instanceof JsdocError && error.code === "PARSE_ERROR") {
			return { path: relativePath, status: "syntax_error" };
		}
		throw error;
	}
}

/** Priority order for filling groups when applying limit */
const STATUS_PRIORITY: ValidationStatus[] = [
	"syntax_error",
	"missing_jsdoc",
	"missing_summary",
	"missing_description",
];

/**
 * Group file statuses into a ValidationResult, applying a limit
 * to the total number of invalid file paths shown.
 */
function buildGroupedResult(
	statuses: FileStatus[],
	limit: number,
): ValidationResult {
	const groups: Record<ValidationStatus, string[]> = {
		syntax_error: [],
		missing_jsdoc: [],
		missing_summary: [],
		missing_description: [],
	};

	for (const { path, status } of statuses) {
		if (status !== "valid") {
			groups[status].push(path);
		}
	}

	const totalInvalid = Object.values(groups).reduce(
		(sum, arr) => sum + arr.length,
		0,
	);
	const truncated = totalInvalid > limit;

	const result: ValidationResult = {
		summary: {
			total: statuses.length,
			invalid: totalInvalid,
			truncated,
		},
	};

	let remaining = limit;
	for (const status of STATUS_PRIORITY) {
		const files = groups[status];
		if (files.length === 0) continue;
		if (remaining <= 0) break;

		const slice = files.slice(0, remaining);
		result[status] = slice;
		remaining -= slice.length;
	}

	return result;
}

/**
 * Validate files matching a selector pattern.
 *
 * @param selector - Selector information (glob or path)
 * @param cwd - Working directory for resolving paths
 * @param limit - Max number of invalid file paths to include (default 100)
 * @returns Grouped validation results with summary
 * @throws {JsdocError} INVALID_DEPTH if selector has @depth suffix
 * @throws {JsdocError} NO_FILES_MATCHED if glob selector matches no files
 * @throws {JsdocError} FILE_NOT_FOUND if path selector targets nonexistent file
 */
export function validate(
	selector: SelectorInfo,
	cwd: string,
	limit = 100,
	gitignore = true,
): ValidationResult {
	if (selector.depth !== undefined) {
		throw new JsdocError(
			"INVALID_DEPTH",
			"Validation mode does not support @depth",
		);
	}

	const files = discoverFiles(selector.pattern, cwd, gitignore);
	if (files.length === 0) {
		throw new JsdocError(
			"NO_FILES_MATCHED",
			`No files matched: ${selector.pattern}`,
		);
	}

	const statuses = files.map((f) => classifyFile(f, cwd));
	return buildGroupedResult(statuses, limit);
}

/**
 * Validate an explicit list of file paths.
 *
 * Filters to .ts/.tsx files only (useful for stdin input).
 *
 * @param filePaths - List of file paths to validate
 * @param cwd - Working directory for resolving relative paths
 * @param limit - Max number of invalid file paths to include (default 100)
 * @returns Grouped validation results with summary
 */
export function validateFiles(
	filePaths: string[],
	cwd: string,
	limit = 100,
): ValidationResult {
	const tsFiles = filePaths.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);
	const statuses = tsFiles.map((f) => classifyFile(f, cwd));
	return buildGroupedResult(statuses, limit);
}
