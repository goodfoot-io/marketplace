/**
 * Defines the output shapes, error codes, validation statuses, and
 * parsed-file structures used across all modules. These types form the
 * public contract for both JSON output and programmatic API consumers.
 *
 * @summary Shared type definitions for output shapes, error codes, and parsed structures
 */

/** Output item with more detail available — next_id points to the next level */
export interface OutputItemNext {
	next_id: string;
	text: string;
	children?: string[];  // gated file/directory paths (barrel only)
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
}

/** Parsed summary and description from a file's JSDoc */
export interface ParsedFileInfo {
	path: string;
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
