import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";
import { extractFileJsdoc, parseFileSummaries } from "../src/jsdoc-parser.js";

/**
 * Verifies extraction of file-level JSDoc blocks before code statements,
 * multi-line summary joining, whitespace-only summary skipping, tag isolation,
 * and PARSE_ERROR on syntax errors. Uses both fixture files and temp files.
 *
 * @summary Tests for JSDoc extraction and summary/description parsing
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "fixtures", "leaf-files");

function fixture(name: string): string {
	return path.join(fixturesDir, name);
}

/** Write source to a temp .ts file, run the callback, then clean up. */
async function withTempFile(
	source: string,
	fn: (filePath: string) => Promise<void>,
): Promise<void> {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jsdoczoom-test-"));
	const tmpFile = path.join(tmpDir, "temp.ts");
	fs.writeFileSync(tmpFile, source);
	try {
		await fn(tmpFile);
	} finally {
		fs.rmSync(tmpDir, { recursive: true });
	}
}

describe("extractFileJsdoc", () => {
	it("extracts first /** */ block before code statements", () => {
		const source = [
			"/**",
			" * Hello world.",
			" *",
			" * @summary A summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");
		const result = extractFileJsdoc(source);
		expect(result).not.toBeNull();
		expect(result).toContain("Hello world.");
		expect(result).toContain("@summary A summary");
	});

	it("JSDoc after import statements is valid (extracted correctly)", () => {
		const source = [
			"import { readFileSync } from 'fs';",
			"",
			"/**",
			" * This JSDoc appears after imports but before code.",
			" *",
			" * @summary After imports summary",
			" */",
			"",
			"export function doSomething(): string {",
			"  return readFileSync('/dev/null', 'utf-8');",
			"}",
		].join("\n");
		const result = extractFileJsdoc(source);
		expect(result).not.toBeNull();
		expect(result).toContain(
			"This JSDoc appears after imports but before code.",
		);
		expect(result).toContain("@summary After imports summary");
	});

	it("ignores JSDoc blocks that appear after code statements", () => {
		const source = [
			"export const x = 1;",
			"",
			"/**",
			" * This JSDoc is after code, so it should not be the file-level JSDoc.",
			" *",
			" * @summary Should be ignored",
			" */",
			"",
			"export const y = 2;",
		].join("\n");
		const result = extractFileJsdoc(source);
		expect(result).toBeNull();
	});

	it("handles TypeScript syntax errors (throws PARSE_ERROR)", () => {
		const source = "export const broken: = { this is not valid };";
		expect(() => extractFileJsdoc(source)).toThrow(JsdocError);
		try {
			extractFileJsdoc(source);
		} catch (e) {
			expect(e).toBeInstanceOf(JsdocError);
			expect((e as JsdocError).code).toBe("PARSE_ERROR");
		}
	});

	it("literal @ in prose (like user@example.com) does not start a new tag", () => {
		const source = [
			"/**",
			" * Contact user@example.com for more info.",
			" *",
			" * @summary Email module summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");
		const result = extractFileJsdoc(source);
		expect(result).not.toBeNull();
		expect(result).toContain("user@example.com");
	});
});

describe("parseFileSummaries", () => {
	it("extracts first @summary tag", async () => {
		const result = await parseFileSummaries(fixture("two-summaries.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("First summary - concise overview");
		expect(result.description).toBe(
			"This is the free-text description of the module.",
		);
	});

	it("joins multi-line @summary content with spaces", async () => {
		const result = await parseFileSummaries(fixture("multi-line-summary.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe(
			"This is a multi-line summary that spans across multiple lines and should be joined with spaces",
		);
		expect(result.description).toBe("Module description.");
	});

	it("skips whitespace-only @summary, uses next non-empty one", async () => {
		const result = await parseFileSummaries(fixture("whitespace-summary.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("Real summary here");
		expect(result.description).toBe("Module with whitespace summaries.");
	});

	it("returns free-text as description field", async () => {
		const result = await parseFileSummaries(fixture("one-summary.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("Single summary line");
		expect(result.description).toBe("Module description as free-text.");
	});

	it("summary is null, description is the free-text", async () => {
		const result = await parseFileSummaries(fixture("description-only.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBeNull();
		expect(result.description).toBe(
			"This module only has a free-text description with no @summary tags.",
		);
	});

	it("summary null, description null, hasFileJsdoc false", async () => {
		const result = await parseFileSummaries(fixture("no-jsdoc.ts"));
		expect(result.hasFileJsdoc).toBe(false);
		expect(result.summary).toBeNull();
		expect(result.description).toBeNull();
	});

	it("only recognizes exact lowercase @summary", async () => {
		const source = [
			"/**",
			" * Free text here.",
			" *",
			" * @Summary Uppercase summary",
			" * @SUMMARY All caps summary",
			" * @summary Real summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		await withTempFile(source, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBe("Real summary");
			expect(result.summaryCount).toBe(1);
			expect(result.description).toBe("Free text here.");
		});
	});

	it("@Summary without lowercase @summary results in missing summary", async () => {
		const source = [
			"/**",
			" * Description.",
			" *",
			" * @Summary Uppercase summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		await withTempFile(source, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBeNull();
			expect(result.summaryCount).toBe(0);
		});
	});

	it("@desc tag content is included in description", async () => {
		const source = [
			"/**",
			" * @desc Module description via desc tag.",
			" *",
			" * @summary My summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		await withTempFile(source, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.summary).toBe("My summary");
			expect(result.description).toBe("Module description via desc tag.");
		});
	});

	it("@description tag content is included in description", async () => {
		const source = [
			"/**",
			" * @description Full description tag content.",
			" *",
			" * @summary My summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		await withTempFile(source, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.summary).toBe("My summary");
			expect(result.description).toBe("Full description tag content.");
		});
	});

	it("@file and @fileoverview tags are included in description", async () => {
		const source = [
			"/**",
			" * @file File-level overview.",
			" *",
			" * @summary My summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		await withTempFile(source, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.summary).toBe("My summary");
			expect(result.description).toBe("File-level overview.");
		});
	});

	it("free-text and @description tag are combined in description", async () => {
		const source = [
			"/**",
			" * Free text first.",
			" *",
			" * @description Additional description.",
			" *",
			" * @summary My summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		await withTempFile(source, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.summary).toBe("My summary");
			expect(result.description).toBe(
				"Free text first. Additional description.",
			);
		});
	});

	it("@description continuation lines are included in description", async () => {
		const source = [
			"/**",
			" * @description First line of description",
			" * continues on this line.",
			" *",
			" * @summary My summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		await withTempFile(source, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.summary).toBe("My summary");
			expect(result.description).toBe(
				"First line of description continues on this line.",
			);
		});
	});

	it("summaryCount is 1 for single @summary", async () => {
		const result = await parseFileSummaries(fixture("one-summary.ts"));
		expect(result.summaryCount).toBe(1);
	});

	it("summaryCount is 0 for no @summary", async () => {
		const result = await parseFileSummaries(fixture("description-only.ts"));
		expect(result.summaryCount).toBe(0);
	});

	it("summaryCount tracks multiple @summary tags", async () => {
		const result = await parseFileSummaries(fixture("multiple-summaries.ts"));
		expect(result.summaryCount).toBe(2);
		expect(result.summary).toBe("First summary tag");
	});

	it("handles TypeScript syntax errors (throws PARSE_ERROR)", async () => {
		await expect(
			parseFileSummaries(fixture("syntax-error.ts")),
		).rejects.toThrow(JsdocError);
		try {
			await parseFileSummaries(fixture("syntax-error.ts"));
		} catch (e) {
			expect(e).toBeInstanceOf(JsdocError);
			expect((e as JsdocError).code).toBe("PARSE_ERROR");
		}
	});

	it("@param after @summary does not corrupt summary", async () => {
		const source = [
			"/**",
			" * Module with various tags.",
			" *",
			" * @summary The real summary",
			" * @param x - some param",
			" * @returns nothing",
			" * @deprecated Use something else",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		await withTempFile(source, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBe("The real summary");
			expect(result.description).toBe("Module with various tags.");
		});
	});

	it("ignores second @summary tag, uses only first", async () => {
		const source = [
			"/**",
			" * Module description.",
			" *",
			" * @summary First summary",
			" * @param x - some param",
			" * @summary Second summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		await withTempFile(source, async (tmpFile) => {
			const result = await parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBe("First summary");
			expect(result.description).toBe("Module description.");
		});
	});

	it("file with @summary but no free-text has null description", async () => {
		const result = await parseFileSummaries(fixture("summary-only.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("Summary without description");
		expect(result.description).toBeNull();
	});

	it("literal @ in prose does not start a new tag", async () => {
		const result = await parseFileSummaries(fixture("email-in-prose.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("Email module summary");
		expect(result.description).toBe(
			"Contact user@example.com for more info about this module.",
		);
	});
});
