/** Single output item representing a file at a specific drill-down level */
export interface OutputItem {
	id: string;
	more: boolean;
	text: string;
}

/** Output item for files that encountered errors during processing */
export interface OutputErrorItem {
	id: string;
	more: false;
	error: {
		code: string;
		message: string;
	};
}

/** Union of successful and error output entries */
export type OutputEntry = OutputItem | OutputErrorItem;

/** All recognized error codes */
export type ErrorCode =
	| "INVALID_SELECTOR"
	| "INVALID_DEPTH"
	| "FILE_NOT_FOUND"
	| "NO_FILES_MATCHED"
	| "NO_SUMMARY_FOUND"
	| "PARSE_ERROR"
	| "VALIDATION_FAILED"
	| "INTERNAL_ERROR";

/** Validation status categories for invalid files */
export type ValidationStatus =
	| "syntax_error"
	| "missing_jsdoc"
	| "missing_summary"
	| "missing_description";

/** Grouped validation result — only invalid-file groups appear */
export interface ValidationResult {
	syntax_error?: string[];
	missing_jsdoc?: string[];
	missing_summary?: string[];
	missing_description?: string[];
	summary: {
		total: number;
		invalid: number;
		truncated: boolean;
	};
}

/** Parsed summary and description from a file's JSDoc */
export interface ParsedFileInfo {
	path: string;
	summary: string | null;
	description: string | null;
	hasFileJsdoc: boolean;
}

/** Parsed selector information */
export interface SelectorInfo {
	type: "glob" | "path";
	pattern: string;
	depth: number | undefined;
}
