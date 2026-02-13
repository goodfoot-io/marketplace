import type { SelectorInfo, ValidationResult } from "./types.js";
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
export declare function validate(selector: SelectorInfo, cwd: string, limit?: number, gitignore?: boolean): ValidationResult;
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
export declare function validateFiles(filePaths: string[], cwd: string, limit?: number): ValidationResult;
