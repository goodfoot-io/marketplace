/**
 * Defines the output shapes, error codes, validation statuses, and
 * parsed-file structures used across all modules. These types form the
 * public contract for both JSON output and programmatic API consumers.
 *
 * @summary Shared type definitions for output shapes, error codes, and parsed structures
 */

import { tmpdir } from "node:os";
import { join } from "node:path";

/** Output item with more detail available — next_id points to the next level */
export interface OutputItemNext {
	next_id: string;
	text: string;
	children?: string[]; // gated file/directory paths (barrel only)
}

/** Output item at terminal level — id represents the current (final) state */
export interface OutputItemTerminal {
	id: string;
	text: string;
}

/** Single output item representing a file at a specific drill-down level */
export type OutputItem = OutputItemNext | OutputItemTerminal;

/** Output item for files that encountered errors during processing */
export interface OutputErrorItem {
	id: string;
	error: {
		code: string;
		message: string;
	};
}

/** Union of successful and error output entries */
export type OutputEntry = OutputItem | OutputErrorItem;

/** Drilldown result with items and truncation flag */
export interface DrilldownResult {
	items: OutputEntry[];
	truncated: boolean;
	total?: number;
}

/** All recognized error codes */
export type ErrorCode =
	| "INVALID_SELECTOR"
	| "INVALID_DEPTH"
	| "FILE_NOT_FOUND"
	| "NO_FILES_MATCHED"
	| "PARSE_ERROR"
	| "VALIDATION_FAILED"
	| "INTERNAL_ERROR";

/** Validation status categories for invalid files */
export type ValidationStatus =
	| "syntax_error"
	| "missing_jsdoc"
	| "missing_summary"
	| "multiple_summary"
	| "missing_description"
	| "missing_barrel";

/** Priority order for validation status categories */
export const VALIDATION_STATUS_PRIORITY: ValidationStatus[] = [
	"syntax_error",
	"missing_jsdoc",
	"missing_summary",
	"multiple_summary",
	"missing_description",
	"missing_barrel",
];

/** A validation group: guidance text and file paths */
export interface ValidationGroup {
	guidance: string;
	files: string[];
}

/** Grouped validation result — only invalid-file groups appear */
export interface ValidationResult {
	syntax_error?: ValidationGroup;
	missing_jsdoc?: ValidationGroup;
	missing_summary?: ValidationGroup;
	multiple_summary?: ValidationGroup;
	missing_description?: ValidationGroup;
	missing_barrel?: ValidationGroup;
	truncated?: boolean;
}

/** Parsed summary and description from a file's JSDoc */
export interface ParsedFileInfo {
	summary: string | null;
	description: string | null;
	summaryCount: number;
	hasFileJsdoc: boolean;
}

/** Parsed selector information */
export interface SelectorInfo {
	type: "glob" | "path";
	pattern: string;
	depth: number | undefined;
}

/** Tags whose content is treated as description (free-text). */
export const DESCRIPTION_TAGS = new Set([
	"desc",
	"description",
	"file",
	"fileoverview",
]);

/**
 * Append non-empty text to an accumulator with space separation.
 */
export function appendText(existing: string, addition: string): string {
	if (addition.length === 0) return existing;
	if (existing.length === 0) return addition;
	return `${existing} ${addition}`;
}

/** A single lint diagnostic from ESLint */
export interface LintDiagnostic {
	line: number;
	column: number;
	rule: string;
	message: string;
	severity: "error" | "warning";
	symbol?: string;
}

/** Lint result for a single file */
export interface LintFileResult {
	filePath: string;
	diagnostics: LintDiagnostic[];
}

/** Overall lint result with summary statistics */
export interface LintResult {
	files: LintFileResult[];
	missingBarrels?: string[];
	summary: {
		totalFiles: number;
		filesWithIssues: number;
		totalDiagnostics: number;
		truncated?: boolean;
	};
}

/** Configuration for the disk cache layer */
export interface CacheConfig {
	enabled: boolean;
	directory: string;
}

/** Operation modes that produce cacheable results */
export type CacheOperationMode = "drilldown" | "validate" | "lint";

/** Default cache directory under os.tmpdir() */
export const DEFAULT_CACHE_DIR = join(tmpdir(), ".jsdoczoom-cache");
