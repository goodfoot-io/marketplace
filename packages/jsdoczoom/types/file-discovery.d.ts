/**
 * Resolve a selector pattern to a list of .ts/.tsx file paths.
 *
 * Glob patterns use the glob package. Plain paths resolve to single-element arrays.
 * Results exclude .d.ts files and are sorted alphabetically.
 *
 * @param pattern - A glob pattern or direct file path
 * @param cwd - The working directory for resolving relative paths
 * @returns Array of absolute file paths
 * @throws {JsdocError} FILE_NOT_FOUND when a direct path does not exist
 */
export declare function discoverFiles(pattern: string, cwd: string): string[];
