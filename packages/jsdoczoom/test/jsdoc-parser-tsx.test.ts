import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractFileJsdoc, parseFileSummaries } from "../src/jsdoc-parser.js";

/**
 * Demonstrates that TSX files with JSX syntax are incorrectly rejected
 * as parse errors because extractFileJsdoc hardcodes "input.ts" as the
 * filename, preventing TypeScript from enabling JSX parsing.
 *
 * @summary Tests for TSX/JSX file support in JSDoc extraction
 */

const TSX_SOURCE = [
	"/**",
	" * A React component.",
	" *",
	" * @summary Example TSX component",
	" */",
	"",
	"import type { ReactElement } from 'react';",
	"",
	"export function Hello(): ReactElement {",
	"  return <div>Hello</div>;",
	"}",
].join("\n");

/** Write source to a temp .tsx file, run the callback, then clean up. */
async function withTempTsxFile(
	source: string,
	fn: (filePath: string) => Promise<void>,
): Promise<void> {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jsdoczoom-test-"));
	const tmpFile = path.join(tmpDir, "temp.tsx");
	fs.writeFileSync(tmpFile, source);
	try {
		await fn(tmpFile);
	} finally {
		fs.rmSync(tmpDir, { recursive: true });
	}
}

describe("extractFileJsdoc with TSX content", () => {
	it("extracts JSDoc from valid TSX source without throwing PARSE_ERROR", () => {
		// This test fails because extractFileJsdoc hardcodes "input.ts" as the
		// filename. TypeScript sees .ts and does not enable JSX parsing, so
		// `<div>` is misinterpreted as a comparison operator, producing a
		// parse error like "'>' expected" or "Type expected."
		const result = extractFileJsdoc(TSX_SOURCE);
		expect(result).not.toBeNull();
		expect(result).toContain("@summary Example TSX component");
	});
});

describe("parseFileSummaries with TSX file", () => {
	it("parses a .tsx file and extracts summary without throwing PARSE_ERROR", async () => {
		// parseFileSummaries calls extractFileJsdoc(sourceText) without passing
		// the filename, so the hardcoded "input.ts" is used regardless of the
		// actual .tsx extension. This causes the same JSX parse failure.
		await withTempTsxFile(TSX_SOURCE, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBe("Example TSX component");
			expect(result.description).toBe("A React component.");
		});
	});
});
