/**
 * Barrel detection and child discovery for index.ts/index.tsx files.
 *
 * @summary Barrel tree model for hierarchical gating in glob mode
 * @summary Detects barrels and discovers their children for drill-down gating
 */
/**
 * Check if a file path refers to a barrel file (index.ts or index.tsx).
 *
 * A barrel is a file named exactly `index.ts` or `index.tsx`.
 * Files like `index.test.ts`, `index.d.ts`, `index.stories.tsx` are NOT barrels.
 *
 * @param filePath - Absolute or relative file path to check
 * @returns true if the file is a barrel (index.ts or index.tsx)
 */
export declare function isBarrel(filePath: string): boolean;
/**
 * Discover the children of a barrel file.
 *
 * Children include:
 * - Sibling .ts/.tsx files in the same directory (excluding the barrel itself, excluding .d.ts)
 * - Child barrels (index.ts or index.tsx) in immediate subdirectories
 *   - index.ts takes priority over index.tsx in the same subdirectory
 *
 * @param barrelPath - Absolute path to the barrel file (index.ts or index.tsx)
 * @param _cwd - Working directory (unused, kept for API consistency)
 * @returns Sorted array of absolute paths to child files
 */
export declare function getBarrelChildren(barrelPath: string, _cwd: string): string[];
