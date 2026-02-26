import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractFileJsdoc, parseFileSummaries } from "../src/jsdoc-parser.js";

/**
 * Reproduction tests for the shebang bug: extractFileJsdoc() returns null
 * when a shebang line (#!/usr/bin/env ...) precedes the file-level JSDoc block.
 * TypeScript's parser treats the shebang as an expression statement at position 0,
 * causing the trivia range to be empty (0-0), so the JSDoc block is never found.
 *
 * @summary Shebang line causes extractFileJsdoc to miss file-level JSDoc blocks
 */

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

describe("extractFileJsdoc with shebang", () => {
	it("extracts JSDoc block when shebang precedes it (no imports)", () => {
		const source = [
			"#!/usr/bin/env node",
			"/**",
			" * CLI entry point for the tool.",
			" *",
			" * @summary CLI entry point",
			" */",
			"",
			"export const main = () => {};",
		].join("\n");
		const result = extractFileJsdoc(source);
		expect(result).not.toBeNull();
		expect(result).toContain("CLI entry point for the tool.");
		expect(result).toContain("@summary CLI entry point");
	});

	it("extracts JSDoc block when shebang and imports precede it", () => {
		const source = [
			"#!/usr/bin/env node",
			"import { readFileSync } from 'fs';",
			"",
			"/**",
			" * Module with shebang and imports.",
			" *",
			" * @summary Shebang with imports",
			" */",
			"",
			"export function run(): void {}",
		].join("\n");
		const result = extractFileJsdoc(source);
		expect(result).not.toBeNull();
		expect(result).toContain("Module with shebang and imports.");
		expect(result).toContain("@summary Shebang with imports");
	});

	it("extracts JSDoc block between shebang and imports", () => {
		const source = [
			"#!/usr/bin/env ts-node",
			"/**",
			" * File-level docs before imports.",
			" *",
			" * @summary Before imports summary",
			" */",
			"import { join } from 'path';",
			"",
			"export const x = join('a', 'b');",
		].join("\n");
		const result = extractFileJsdoc(source);
		expect(result).not.toBeNull();
		expect(result).toContain("File-level docs before imports.");
		expect(result).toContain("@summary Before imports summary");
	});
});

describe("parseFileSummaries with shebang", () => {
	it("parses summary and description from file with shebang", () => {
		const source = [
			"#!/usr/bin/env node",
			"/**",
			" * CLI tool description.",
			" *",
			" * @summary CLI tool summary",
			" */",
			"",
			"export const main = () => {};",
		].join("\n");

		withTempFile(source, (tmpFile) => {
			const result = parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBe("CLI tool summary");
			expect(result.description).toBe("CLI tool description.");
		});
	});

	it("parses summary from file with shebang and imports", () => {
		const source = [
			"#!/usr/bin/env node",
			"import { existsSync } from 'fs';",
			"",
			"/**",
			" * Module with shebang before imports.",
			" *",
			" * @summary Shebang module summary",
			" */",
			"",
			"export function check(): boolean { return existsSync('/tmp'); }",
		].join("\n");

		withTempFile(source, (tmpFile) => {
			const result = parseFileSummaries(tmpFile);
			expect(result.hasFileJsdoc).toBe(true);
			expect(result.summary).toBe("Shebang module summary");
			expect(result.description).toBe(
				"Module with shebang before imports.",
			);
		});
	});
});
