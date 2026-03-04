import { readFileSync } from "node:fs";
import ts from "typescript";
import { JsdocError } from "./errors.js";
import { appendText, DESCRIPTION_TAGS, type ParsedFileInfo } from "./types.js";

/**
 * Uses the TypeScript compiler to locate the first JSDoc block before any
 * code statements, then extracts the first `@summary` tag and free-text
 * description. Syntax errors in the source file produce PARSE_ERROR;
 * whitespace-only summaries are skipped in favor of the next non-empty one.
 *
 * @summary Extract file-level JSDoc summary and description from TypeScript source files
 */

/**
 * Extract the first file-level JSDoc block from TypeScript source text.
 *
 * The JSDoc block must appear before any code statements (after imports is OK).
 * Returns the raw JSDoc text without the leading `/**` and trailing `*​/` delimiters,
 * or null if no file-level JSDoc is found.
 */
export function extractFileJsdoc(
	sourceText: string,
	fileName = "input.tsx",
): string | null {
	const sourceFile = ts.createSourceFile(
		fileName,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
	);

	// Check for syntax errors — if the file has diagnostics, throw PARSE_ERROR
	const diagnostics = getDiagnostics(sourceFile);
	if (diagnostics.length > 0) {
		throw new JsdocError(
			"PARSE_ERROR",
			`TypeScript parse error: ${diagnostics[0]}`,
		);
	}

	// Find the first non-import top-level statement
	let firstImport: ts.Statement | undefined;
	let firstNonImportStatement: ts.Statement | undefined;
	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) {
			firstImport ??= statement;
			continue;
		}
		firstNonImportStatement = statement;
		break;
	}

	// If there are no non-import statements, check for comments at file start
	if (firstNonImportStatement === undefined) {
		return findFirstJsdocBlock(sourceText, 0, sourceText.length);
	}

	// When imports exist, the file-level JSDoc lives in the leading trivia of
	// the first import (before any imports), not the first non-import statement.
	// Check there first; fall back to the first non-import statement's trivia
	// for the "JSDoc after imports" pattern.
	if (firstImport) {
		const importFullStart = firstImport.getFullStart();
		const importNodeStart = firstImport.getStart(sourceFile);
		const preImportJsdoc = findFirstJsdocBlock(
			sourceText,
			importFullStart,
			importNodeStart,
		);
		if (preImportJsdoc !== null) {
			return preImportJsdoc;
		}
	}

	// JSDoc in the leading trivia of the first non-import statement
	// (handles "JSDoc after imports but before code" pattern).
	const fullStart = firstNonImportStatement.getFullStart();
	const nodeStart = firstNonImportStatement.getStart(sourceFile);

	return findFirstJsdocBlock(sourceText, fullStart, nodeStart);
}

/**
 * Find the first `/** ... *​/` block comment in the given text range.
 */
function findFirstJsdocBlock(
	sourceText: string,
	start: number,
	end: number,
): string | null {
	const commentRanges = getAllBlockComments(sourceText, start, end);

	for (const range of commentRanges) {
		const commentText = sourceText.slice(range.start, range.end);
		if (commentText.startsWith("/**") && !commentText.startsWith("/***")) {
			// Strip /** and */ delimiters
			const inner = commentText.slice(3, -2);
			return inner;
		}
	}

	return null;
}

/**
 * Find the end position of a block comment starting at `pos` (after the `/*`).
 */
function findBlockCommentEnd(sourceText: string, pos: number): number {
	while (pos < sourceText.length) {
		if (sourceText[pos] === "*" && sourceText[pos + 1] === "/") {
			return pos + 2;
		}
		pos++;
	}
	return pos;
}

/**
 * Skip past a line comment starting at `pos` (after the `//`).
 */
function findLineCommentEnd(sourceText: string, pos: number): number {
	while (pos < sourceText.length && sourceText[pos] !== "\n") {
		pos++;
	}
	return pos;
}

const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);

/**
 * Scan for block comments in the source text between start and end positions.
 * Stops at the first non-whitespace, non-comment character (code).
 */
function getAllBlockComments(
	sourceText: string,
	start: number,
	end: number,
): Array<{ start: number; end: number }> {
	const results: Array<{ start: number; end: number }> = [];
	let pos = start;

	while (pos < end) {
		if (WHITESPACE.has(sourceText[pos])) {
			pos++;
			continue;
		}

		// Skip shebang line (e.g. #!/usr/bin/env node) — only valid at position 0
		if (pos === 0 && sourceText[0] === "#" && sourceText[1] === "!") {
			pos = findLineCommentEnd(sourceText, pos + 2);
			continue;
		}

		const nextChar = sourceText[pos + 1];
		if (sourceText[pos] !== "/" || pos + 1 >= end) break;

		if (nextChar === "*") {
			const commentStart = pos;
			pos = findBlockCommentEnd(sourceText, pos + 2);
			results.push({ start: commentStart, end: pos });
			continue;
		}

		if (nextChar === "/") {
			pos = findLineCommentEnd(sourceText, pos + 2);
			continue;
		}

		break;
	}

	return results;
}

/**
 * Get syntax error diagnostics from a parsed source file.
 */
function getDiagnostics(sourceFile: ts.SourceFile): string[] {
	// parseDiagnostics is available on the internal SourceFile
	const diags = (
		sourceFile as unknown as { parseDiagnostics: ts.DiagnosticWithLocation[] }
	).parseDiagnostics;
	if (!diags || diags.length === 0) return [];
	return diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

/**
 * Parse @summary tag and free-text description from raw JSDoc inner text.
 *
 * Returns:
 * - summary: First non-empty @summary tag content (or null if none)
 * - description: Free-text before first @ tag (or null if none)
 *
 * Only exact lowercase @summary is recognized. Case variants like
 * @Summary or @SUMMARY are ignored (causing missing_summary in
 * validation). The @desc, @description, @file, and @fileoverview
 * tags (case-insensitive) are treated as description synonyms —
 * their content is included in the description field.
 *
 * Additional @summary tags are silently ignored.
 * Whitespace-only @summary tags are skipped.
 */
function parseJsdocContent(jsdocText: string): {
	summary: string | null;
	description: string | null;
	summaryCount: number;
} {
	const lines = jsdocText.split("\n");

	let freeText = "";
	let firstSummary: string | null = null;
	let summaryCount = 0;
	let currentTag: string | null = null;
	let currentContent = "";

	/** Flush a pending @summary tag, counting all non-empty occurrences. */
	function flushSummary(): void {
		if (currentTag !== "summary") return;
		const trimmed = currentContent.trim();
		if (trimmed.length > 0) {
			summaryCount++;
			if (firstSummary === null) {
				firstSummary = trimmed;
			}
		}
	}

	for (const rawLine of lines) {
		const stripped = rawLine.replace(/^\s*\*?\s?/, "");
		const tagMatch = stripped.match(/^@([a-zA-Z]+)(?:\s|$)/);

		if (tagMatch) {
			flushSummary();
			const rawTagName = tagMatch[1];
			const tagContent = stripped.slice(tagMatch[0].length);

			if (DESCRIPTION_TAGS.has(rawTagName.toLowerCase())) {
				freeText = appendText(freeText, tagContent);
				currentTag = null;
				currentContent = "";
			} else {
				currentTag = rawTagName;
				currentContent = tagContent;
			}
			continue;
		}

		// Continuation line
		if (currentTag === null) {
			freeText = appendText(freeText, stripped);
		} else if (stripped.length > 0) {
			currentContent += ` ${stripped}`;
		}
	}

	flushSummary();

	const trimmedFreeText = freeText.trim();

	return {
		summary: firstSummary,
		description: trimmedFreeText.length > 0 ? trimmedFreeText : null,
		summaryCount,
	};
}

/**
 * Parse a TypeScript file and extract its summary and description from file-level JSDoc.
 *
 * Reads the file, extracts the first file-level JSDoc block, and parses the first
 * @summary tag and free-text description.
 */
export function parseFileSummaries(filePath: string): ParsedFileInfo {
	let sourceText: string;
	try {
		sourceText = readFileSync(filePath, "utf-8");
	} catch {
		throw new JsdocError("FILE_NOT_FOUND", `File not found: ${filePath}`);
	}

	const jsdocText = extractFileJsdoc(sourceText, filePath);

	if (jsdocText === null) {
		return {
			summary: null,
			description: null,
			summaryCount: 0,
			hasFileJsdoc: false,
		};
	}

	const { summary, description, summaryCount } = parseJsdocContent(jsdocText);

	return {
		summary,
		description,
		summaryCount,
		hasFileJsdoc: true,
	};
}
