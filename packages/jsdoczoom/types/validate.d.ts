import type { SelectorInfo, ValidationResult } from "./types.js";
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
export declare function validate(selector: SelectorInfo, cwd: string): ValidationResult;
/**
 * Validate an explicit list of file paths.
 *
 * Filters to .ts/.tsx files only (useful for stdin input).
 *
 * @param filePaths - List of file paths to validate
 * @param cwd - Working directory for resolving relative paths
 * @returns Validation results with per-file details and summary
 */
export declare function validateFiles(filePaths: string[], cwd: string): ValidationResult;
