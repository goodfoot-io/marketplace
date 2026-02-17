import { describe, expect, it } from "vitest";
import { extractFileJsdoc } from "../src/jsdoc-parser.js";

/**
 * Regression test for file-level JSDoc extraction when a file has:
 * 1. A file-level JSDoc (with @summary) before imports
 * 2. Import statements
 * 3. A constant/declaration with its own JSDoc after imports
 *
 * The parser should return the file-level JSDoc (before imports), not the
 * JSDoc attached to the first non-import declaration.
 *
 * @summary Bug reproduction: extractFileJsdoc picks wrong JSDoc when file-level JSDoc precedes imports
 */

describe("extractFileJsdoc with file-level JSDoc before imports", () => {
	it("returns the file-level JSDoc before imports, not the constant's JSDoc after imports", () => {
		const source = [
			"/**",
			" * File description paragraph.",
			" *",
			" * @summary File-level summary",
			" */",
			"",
			'import { something } from "somewhere";',
			"",
			"/**",
			" * Well-known constant docs.",
			" */",
			"const FOO = 42;",
		].join("\n");

		const result = extractFileJsdoc(source);
		expect(result).not.toBeNull();
		// The file-level JSDoc should contain the @summary tag
		expect(result).toContain("@summary File-level summary");
		// It should contain the file description paragraph
		expect(result).toContain("File description paragraph.");
		// It should NOT contain the constant's JSDoc content
		expect(result).not.toContain("Well-known constant docs.");
	});
});
