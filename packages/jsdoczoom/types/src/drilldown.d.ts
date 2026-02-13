import type { DrilldownResult, SelectorInfo } from "./types.js";
/**
 * Main entry point for normal-mode processing.
 *
 * Resolves files from a selector, processes each through the drill-down model,
 * and returns an array of output entries. Barrel gating is applied in glob mode.
 *
 * @param selector - Parsed selector with type, pattern, and optional depth
 * @param cwd - Working directory for file resolution
 * @returns Array of output entries sorted alphabetically by path
 * @throws {JsdocError} FILE_NOT_FOUND for missing path selector target
 * @throws {JsdocError} NO_FILES_MATCHED for empty glob results
 * @throws {JsdocError} PARSE_ERROR for path selector targeting file with syntax errors
 */
export declare function drilldown(selector: SelectorInfo, cwd: string, gitignore?: boolean, limit?: number): DrilldownResult;
/**
 * Process an explicit list of file paths at a given depth.
 *
 * Used for stdin input. Always treats paths as leaf files (no barrel gating).
 * Filters to .ts/.tsx only.
 *
 * @param filePaths - Array of absolute file paths
 * @param depth - Drill-down depth (defaults to 0 if undefined)
 * @param cwd - Working directory for relative path output
 * @returns Array of output entries sorted alphabetically by path
 */
export declare function drilldownFiles(filePaths: string[], depth: number | undefined, cwd: string, limit?: number): DrilldownResult;
