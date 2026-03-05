import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { ESLint } from "eslint";
import { findMissingBarrels } from "./barrel.js";
import { processWithCache } from "./cache.js";
import { debugValidate, flushCacheSummary, time } from "./debug.js";
import { JsdocError } from "./errors.js";
import {
	createValidationLinter,
	lintFileForValidation,
	mapToValidationStatus,
} from "./eslint-engine.js";
import { discoverFiles } from "./file-discovery.js";
import { GUIDANCE } from "./skill-text.js";
import type {
	CacheConfig,
	SelectorInfo,
	ValidationResult,
	ValidationStatus,
} from "./types.js";
import { DEFAULT_CACHE_DIR, VALIDATION_STATUS_PRIORITY } from "./types.js";

/**
 * Each file is classified into exactly one status category: the first
 * failing check wins (syntax_error > missing_jsdoc > missing_summary >
 * multiple_summary > missing_description). Directories with more than
 * 3 TypeScript files that lack a barrel are flagged as missing_barrel.
 * Valid files are omitted from output entirely. The limit parameter
 * caps the total number of invalid paths shown, filled in priority
 * order across groups.
 *
 * @summary Validate file-level JSDoc and group results by status category
 */

/** Internal per-file classification */
interface FileStatus {
	path: string;
	status: ValidationStatus | "valid";
}

/**
 * Classify a single file against validation requirements.
 *
 * Reads the file, lints it with the ESLint engine, and maps the
 * resulting messages to a single ValidationStatus using priority order.
 * Results are cached by file content hash.
 */
async function classifyFile(
	eslint: ESLint,
	filePath: string,
	cwd: string,
	config: CacheConfig,
): Promise<FileStatus> {
	const relativePath = relative(cwd, filePath);

	let sourceText: string;
	try {
		sourceText = await readFile(filePath, "utf-8");
	} catch {
		throw new JsdocError("FILE_NOT_FOUND", `File not found: ${filePath}`);
	}

	const { status } = await processWithCache(
		config,
		"validate",
		sourceText,
		async () => {
			const messages = await lintFileForValidation(
				eslint,
				sourceText,
				filePath,
			);
			const status = mapToValidationStatus(messages);
			return { status };
		},
	);
	return { path: relativePath, status };
}

/**
 * Group file statuses into a ValidationResult, applying a limit
 * to the total number of invalid file paths shown.
 */
function buildGroupedResult(
	statuses: FileStatus[],
	missingBarrels: string[],
	limit: number,
): ValidationResult {
	const groups: Record<ValidationStatus, string[]> = {
		syntax_error: [],
		missing_jsdoc: [],
		missing_summary: [],
		multiple_summary: [],
		missing_description: [],
		missing_barrel: missingBarrels,
	};

	for (const { path, status } of statuses) {
		if (status !== "valid") {
			groups[status].push(path);
		}
	}

	const result: ValidationResult = {};

	let remaining = limit;
	let totalInvalid = 0;
	for (const status of VALIDATION_STATUS_PRIORITY) {
		const files = groups[status];
		totalInvalid += files.length;
		if (files.length === 0) continue;
		if (remaining <= 0) break;

		const slice = files.slice(0, remaining);
		result[status] = { guidance: GUIDANCE[status], files: slice };
		remaining -= slice.length;
	}

	if (remaining <= 0 && totalInvalid > limit) {
		result.truncated = true;
	}

	return result;
}

/**
 * Validate files matching a selector pattern.
 *
 * @param selector - Selector information (glob or path)
 * @param cwd - Working directory for resolving paths
 * @param limit - Max number of invalid file paths to include (default 100)
 * @param gitignore - Whether to respect .gitignore (default true)
 * @param config - Cache configuration (default: enabled with system temp dir)
 * @returns Grouped validation results
 * @throws {JsdocError} NO_FILES_MATCHED if glob selector matches no files
 * @throws {JsdocError} FILE_NOT_FOUND if path selector targets nonexistent file
 */
export async function validate(
	selector: SelectorInfo,
	cwd: string,
	limit = 100,
	gitignore = true,
	config: CacheConfig = { enabled: true, directory: DEFAULT_CACHE_DIR },
): Promise<ValidationResult> {
	const files = await discoverFiles(selector.pattern, cwd, gitignore);
	if (files.length === 0) {
		throw new JsdocError(
			"NO_FILES_MATCHED",
			`No files matched: ${selector.pattern}`,
		);
	}

	const eslint = createValidationLinter();
	debugValidate("validate start files=%d pattern=%s", files.length, selector.pattern);
	const statuses = await time(debugValidate, `validate ${files.length} files`, () =>
		Promise.all(files.map((f) => classifyFile(eslint, f, cwd, config))),
	);
	flushCacheSummary(`validate ${files.length} files`);
	const missingBarrels = await findMissingBarrels(files, cwd);
	return buildGroupedResult(statuses, missingBarrels, limit);
}

/**
 * Validate an explicit list of file paths.
 *
 * Filters to .ts/.tsx files only (useful for stdin input).
 *
 * @param filePaths - List of file paths to validate
 * @param cwd - Working directory for resolving relative paths
 * @param limit - Max number of invalid file paths to include (default 100)
 * @param config - Cache configuration (default: enabled with system temp dir)
 * @returns Grouped validation results
 */
export async function validateFiles(
	filePaths: string[],
	cwd: string,
	limit = 100,
	config: CacheConfig = { enabled: true, directory: DEFAULT_CACHE_DIR },
): Promise<ValidationResult> {
	const tsFiles = filePaths.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);

	const eslint = createValidationLinter();
	debugValidate("validateFiles start files=%d", tsFiles.length);
	const statuses = await time(debugValidate, `validateFiles ${tsFiles.length} files`, () =>
		Promise.all(tsFiles.map((f) => classifyFile(eslint, f, cwd, config))),
	);
	flushCacheSummary(`validateFiles ${tsFiles.length} files`);
	const missingBarrels = await findMissingBarrels(tsFiles, cwd);
	return buildGroupedResult(statuses, missingBarrels, limit);
}
