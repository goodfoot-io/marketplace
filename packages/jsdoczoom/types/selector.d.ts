import type { SelectorInfo } from './types.js';
/**
 * Parses a selector string into its components.
 *
 * @param input - Selector string (e.g., "src/star-star/star.ts@3", "file.ts", "../config.js@2")
 * @returns SelectorInfo with type, pattern, and optional depth
 * @throws JsdocError INVALID_SELECTOR if input is empty
 * @throws JsdocError INVALID_DEPTH if depth is negative, non-integer, or float
 */
export declare function parseSelector(input: string): SelectorInfo;
