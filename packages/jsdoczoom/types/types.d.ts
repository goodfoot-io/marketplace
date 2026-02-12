/** Single output item representing a file at a specific drill-down level */
export interface OutputItem {
    id: string;
    path: string;
    more: boolean;
    text: string;
}
/** Output item for files that encountered errors during processing */
export interface OutputErrorItem {
    id: string;
    path: string;
    more: false;
    error: {
        code: string;
        message: string;
    };
}
/** Union of successful and error output entries */
export type OutputEntry = OutputItem | OutputErrorItem;
/** All recognized error codes */
export type ErrorCode = 'INVALID_SELECTOR' | 'INVALID_DEPTH' | 'FILE_NOT_FOUND' | 'NO_FILES_MATCHED' | 'NO_SUMMARY_FOUND' | 'PARSE_ERROR' | 'VALIDATION_FAILED' | 'INTERNAL_ERROR';
/** Validation result for a single file */
export interface ValidationFileResult {
    path: string;
    passed: boolean;
    issues: string[];
}
/** Complete validation result */
export interface ValidationResult {
    files: ValidationFileResult[];
    summary: {
        total: number;
        passed: number;
        failed: number;
    };
}
/** Parsed summary levels from a file's JSDoc */
export interface ParsedFileInfo {
    path: string;
    summaryLevels: string[];
    hasFileJsdoc: boolean;
}
/** Parsed selector information */
export interface SelectorInfo {
    type: 'glob' | 'path';
    pattern: string;
    depth: number | undefined;
}
