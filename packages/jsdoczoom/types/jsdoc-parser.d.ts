import type { ParsedFileInfo } from "./types.js";
/**
 * Extract the first file-level JSDoc block from TypeScript source text.
 *
 * The JSDoc block must appear before any code statements (after imports is OK).
 * Returns the raw JSDoc text without the leading `/**` and trailing `*​/` delimiters,
 * or null if no file-level JSDoc is found.
 */
export declare function extractFileJsdoc(sourceText: string): string | null;
/**
 * Parse a TypeScript file and extract its summary levels from file-level JSDoc.
 *
 * Reads the file, extracts the first file-level JSDoc block, and parses @summary
 * tags and free-text into ordered summary levels.
 */
export declare function parseFileSummaries(filePath: string): ParsedFileInfo;
