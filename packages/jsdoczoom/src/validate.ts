import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { ESLint } from "eslint";
import { isBarrel } from "./barrel.js";
import { JsdocError } from "./errors.js";
import {
	createValidationLinter,
	lintFileForValidation,
	mapToValidationStatus,
} from "./eslint-engine.js";
import { discoverFiles } from "./file-discovery.js";
import { GUIDANCE } from "./skill-text.js";
import type {
	SelectorInfo,
	ValidationResult,
	ValidationStatus,
} from "./types.js";

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
 */
async function classifyFile(
	eslint: ESLint,
	filePath: string,
	cwd: string,
): Promise<FileStatus> {
	const relativePath = relative(cwd, filePath);

	let sourceText: string;
	try {
		sourceText = readFileSync(filePath, "utf-8");
	} catch {
		throw new JsdocError("FILE_NOT_FOUND", `File not found: ${filePath}`);
	}

	const messages = await lintFileForValidation(eslint, sourceText, filePath);
	const status = mapToValidationStatus(messages);
	return { path: relativePath, status };
}

/** Minimum number of .ts/.tsx files in a directory to require a barrel. */
const BARREL_THRESHOLD = 3;

/**
 * Find directories with more than BARREL_THRESHOLD .ts/.tsx files
 * that lack a barrel file (index.ts or index.tsx).
 */
function findMissingBarrels(filePaths: string[], cwd: string): string[] {
	const dirCounts = new Map<string, number>();

	for (const filePath of filePaths) {
		if (isBarrel(filePath)) continue;
		const dir = dirname(filePath);
		dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
	}

	const missing: string[] = [];
	for (const [dir, count] of dirCounts) {
		if (count <= BARREL_THRESHOLD) continue;
		const hasBarrel =
			existsSync(join(dir, "index.ts")) || existsSync(join(dir, "index.tsx"));
		if (!hasBarrel) {
			const rel = relative(cwd, dir) || ".";
			missing.push(rel);
		}
	}

	return missing.sort();
}

/** Priority order for filling groups when applying limit */
const STATUS_PRIORITY: ValidationStatus[] = [
	"syntax_error",
	"missing_jsdoc",
	"missing_summary",
	"multiple_summary",
	"missing_description",
	"missing_barrel",
];

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
	for (const status of STATUS_PRIORITY) {
		const files = groups[status];
		if (files.length === 0) continue;
		if (remaining <= 0) break;

		const slice = files.slice(0, remaining);
		result[status] = { guidance: GUIDANCE[status], files: slice };
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
 * @returns Grouped validation results
 * @throws {JsdocError} NO_FILES_MATCHED if glob selector matches no files
 * @throws {JsdocError} FILE_NOT_FOUND if path selector targets nonexistent file
 */
export async function validate(
	selector: SelectorInfo,
	cwd: string,
	limit = 100,
	gitignore = true,
): Promise<ValidationResult> {
	const files = discoverFiles(selector.pattern, cwd, gitignore);
	if (files.length === 0) {
		throw new JsdocError(
			"NO_FILES_MATCHED",
			`No files matched: ${selector.pattern}`,
		);
	}

	const eslint = createValidationLinter();
	const statuses = await Promise.all(
		files.map((f) => classifyFile(eslint, f, cwd)),
	);
	const missingBarrels = findMissingBarrels(files, cwd);
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
 * @returns Grouped validation results
 */
export async function validateFiles(
	filePaths: string[],
	cwd: string,
	limit = 100,
): Promise<ValidationResult> {
	const tsFiles = filePaths.filter(
		(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
	);

	const eslint = createValidationLinter();
	const statuses = await Promise.all(
		tsFiles.map((f) => classifyFile(eslint, f, cwd)),
	);
	const missingBarrels = findMissingBarrels(tsFiles, cwd);
	return buildGroupedResult(statuses, missingBarrels, limit);
}
