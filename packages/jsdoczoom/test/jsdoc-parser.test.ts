import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";
import { extractFileJsdoc, parseFileSummaries } from "../src/jsdoc-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "fixtures", "leaf-files");

function fixture(name: string): string {
	return path.join(fixturesDir, name);
}

/** Write source to a temp .ts file, run the callback, then clean up. */
function withTempFile(source: string, fn: (filePath: string) => void): void {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jsdoczoom-test-"));
	const tmpFile = path.join(tmpDir, "temp.ts");
	fs.writeFileSync(tmpFile, source);
	try {
		fn(tmpFile);
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
	it("extracts first @summary tag", () => {
		const result = parseFileSummaries(fixture("two-summaries.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("First summary - concise overview");
		expect(result.description).toBe(
			"This is the free-text description of the module.",
		);
	});

	it("joins multi-line @summary content with spaces", () => {
		const result = parseFileSummaries(fixture("multi-line-summary.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe(
			"This is a multi-line summary that spans across multiple lines and should be joined with spaces",
		);
		expect(result.description).toBe("Module description.");
	});

	it("skips whitespace-only @summary, uses next non-empty one", () => {
		const result = parseFileSummaries(fixture("whitespace-summary.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("Real summary here");
		expect(result.description).toBe("Module with whitespace summaries.");
	});

	it("returns free-text as description field", () => {
		const result = parseFileSummaries(fixture("one-summary.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("Single summary line");
		expect(result.description).toBe("Module description as free-text.");
	});

	it("summary is null, description is the free-text", () => {
		const result = parseFileSummaries(fixture("description-only.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBeNull();
		expect(result.description).toBe(
			"This module only has a free-text description with no @summary tags.",
		);
	});

	it("summary null, description null, hasFileJsdoc false", () => {
		const result = parseFileSummaries(fixture("no-jsdoc.ts"));
		expect(result.hasFileJsdoc).toBe(false);
		expect(result.summary).toBeNull();
		expect(result.description).toBeNull();
	});

	it("only recognizes lowercase @summary", () => {
		const source = [
			"/**",
			" * Free text here.",
			" *",
			" * @Summary Uppercase summary",
			" * @SUMMARY All caps summary",
			" * @desc Description tag",
			" * @description Full description tag",
			" * @summary Real summary",
			" */",
			"",
			"export const x = 1;",
		].join("\n");

		withTempFile(source, (tmpFile) => {
			const result = parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBe("Real summary");
			expect(result.description).toBe("Free text here.");
		});
	});

	it("handles TypeScript syntax errors (throws PARSE_ERROR)", () => {
		expect(() => parseFileSummaries(fixture("syntax-error.ts"))).toThrow(
			JsdocError,
		);
		try {
			parseFileSummaries(fixture("syntax-error.ts"));
		} catch (e) {
			expect(e).toBeInstanceOf(JsdocError);
			expect((e as JsdocError).code).toBe("PARSE_ERROR");
		}
	});

	it("@param after @summary does not corrupt summary", () => {
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

		withTempFile(source, (tmpFile) => {
			const result = parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBe("The real summary");
			expect(result.description).toBe("Module with various tags.");
		});
	});

	it("ignores second @summary tag, uses only first", () => {
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

		withTempFile(source, (tmpFile) => {
			const result = parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBe("First summary");
			expect(result.description).toBe("Module description.");
		});
	});

	it("file with @summary but no free-text has null description", () => {
		const result = parseFileSummaries(fixture("summary-only.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("Summary without description");
		expect(result.description).toBeNull();
	});

	it("literal @ in prose does not start a new tag", () => {
		const result = parseFileSummaries(fixture("email-in-prose.ts"));
		expect(result.hasFileJsdoc).toBe(true);
		expect(result.summary).toBe("Email module summary");
		expect(result.description).toBe(
			"Contact user@example.com for more info about this module.",
		);
	});
});
