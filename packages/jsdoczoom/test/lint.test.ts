/**
 * Tests for the lint module which runs comprehensive JSDoc quality checks
 * using the ESLint engine. Uses temp directories with controlled fixtures
 * to verify diagnostic output, summary statistics, limit capping, file
 * filtering, and error handling.
 *
 * @summary Unit and integration tests for lint() and lintFiles()
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";
import { lint, lintFiles } from "../src/lint.js";
import type { SelectorInfo } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "fixtures", "leaf-files");

function fixture(name: string): string {
	return path.join(fixturesDir, name);
}

/**
 * Create a temporary directory, run a callback with it, then clean up.
 *
 * @param fn - Callback receiving the temp directory path
 * @returns Promise that resolves when the callback and cleanup are done
 */
function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jsdoczoom-lint-"));
	return fn(tmpDir).finally(() => fs.rmSync(tmpDir, { recursive: true }));
}

/**
 * Write a file into a directory and return its absolute path.
 *
 * @param dir - Directory to write into
 * @param name - File name
 * @param content - File content
 * @returns Absolute path to the written file
 */
function writeFile(dir: string, name: string, content: string): string {
	const filePath = path.join(dir, name);
	fs.writeFileSync(filePath, content);
	return filePath;
}

/** A fully valid file that passes all lint rules */
const VALID_FILE = [
	"/**",
	" * File description explaining the purpose of this module.",
	" * @summary File summary for the module",
	" */",
	"",
	"/** The primary numeric value used for calculations */",
	"export const x = 1;",
	"",
].join("\n");

/** A file with an exported function missing @param */
const MISSING_PARAM_FILE = [
	"/**",
	" * File description explaining the purpose of this module.",
	" * @summary File summary for the module",
	" */",
	"",
	"/** Does something important with the input */",
	"export function foo(x: string): void {}",
	"",
].join("\n");

/** A file with no JSDoc at all */
const NO_JSDOC_FILE = "export const x = 1;\n";

/** A file with only file-level JSDoc and no exports */
const NO_EXPORTS_FILE = [
	"/**",
	" * File description explaining the purpose of this module.",
	" * @summary File summary for the module",
	" */",
	"",
].join("\n");

describe("lint", () => {
	it("valid file produces no diagnostics", async () => {
		await withTempDir(async (dir) => {
			writeFile(dir, "valid.ts", VALID_FILE);
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = await lint(selector, dir);

			expect(result.summary.filesWithIssues).toBe(0);
			expect(result.summary.totalDiagnostics).toBe(0);
			expect(result.summary.totalFiles).toBe(1);
		});
	});

	it("file missing @param gets lint diagnostic", async () => {
		await withTempDir(async (dir) => {
			writeFile(dir, "missing-param.ts", MISSING_PARAM_FILE);
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = await lint(selector, dir);

			expect(result.summary.filesWithIssues).toBe(1);
			expect(result.files.length).toBe(1);
			expect(
				result.files[0].diagnostics.some(
					(d) => d.rule === "jsdoc/require-param",
				),
			).toBe(true);
		});
	});

	it("result includes summary counts", async () => {
		await withTempDir(async (dir) => {
			writeFile(dir, "a.ts", MISSING_PARAM_FILE);
			writeFile(dir, "b.ts", VALID_FILE);
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = await lint(selector, dir);

			expect(result.summary.totalFiles).toBe(2);
			expect(result.summary.filesWithIssues).toBe(1);
			expect(result.summary.totalDiagnostics).toBeGreaterThan(0);
		});
	});

	it("limit caps files with issues shown", async () => {
		await withTempDir(async (dir) => {
			writeFile(dir, "a.ts", MISSING_PARAM_FILE);
			writeFile(dir, "b.ts", NO_JSDOC_FILE);
			writeFile(dir, "c.ts", NO_JSDOC_FILE);
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = await lint(selector, dir, 1);

			// Only 1 file with issues should be in the files array
			expect(result.files.length).toBe(1);
			// But summary should reflect actual totals
			expect(result.summary.filesWithIssues).toBeGreaterThanOrEqual(2);
			expect(result.summary.totalFiles).toBe(3);
		});
	});

	it("lint only reports JSDoc diagnostics, not general code issues", async () => {
		await withTempDir(async (dir) => {
			const content = [
				"/**",
				" * File description explaining the purpose of this module.",
				" * @summary File summary for the module",
				" */",
				"",
				"/** The unused variable for testing purposes */",
				"var unused = 1;",
				"",
			].join("\n");
			writeFile(dir, "unused.ts", content);
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = await lint(selector, dir);

			// Should NOT have no-unused-vars or any non-jsdoc rule
			for (const file of result.files) {
				for (const d of file.diagnostics) {
					expect(
						d.rule.startsWith("jsdoc/") || d.rule.startsWith("jsdoczoom/"),
					).toBe(true);
				}
			}
		});
	});

	it("diagnostics include line, column, rule, message, and severity", async () => {
		await withTempDir(async (dir) => {
			writeFile(dir, "missing-param.ts", MISSING_PARAM_FILE);
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = await lint(selector, dir);

			expect(result.files.length).toBeGreaterThan(0);
			const diag = result.files[0].diagnostics[0];
			expect(typeof diag.line).toBe("number");
			expect(typeof diag.column).toBe("number");
			expect(typeof diag.rule).toBe("string");
			expect(typeof diag.message).toBe("string");
			expect(["error", "warning"]).toContain(diag.severity);
		});
	});

	it("file paths in result are relative to cwd", async () => {
		await withTempDir(async (dir) => {
			writeFile(dir, "missing-param.ts", MISSING_PARAM_FILE);
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = await lint(selector, dir);

			expect(result.files.length).toBeGreaterThan(0);
			expect(result.files[0].filePath).toBe("missing-param.ts");
		});
	});

	it("glob with no matches throws NO_FILES_MATCHED", async () => {
		await withTempDir(async (dir) => {
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "nonexistent-*.ts",
				depth: undefined,
			};

			await expect(lint(selector, dir)).rejects.toThrow(JsdocError);
			try {
				await lint(selector, dir);
			} catch (e) {
				expect(e).toBeInstanceOf(JsdocError);
				expect((e as JsdocError).code).toBe("NO_FILES_MATCHED");
			}
		});
	});

	it("file with no exports and valid file-level JSDoc produces no diagnostics", async () => {
		await withTempDir(async (dir) => {
			writeFile(dir, "no-exports.ts", NO_EXPORTS_FILE);
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = await lint(selector, dir);

			expect(result.summary.filesWithIssues).toBe(0);
		});
	});

	it("respects gitignore parameter", async () => {
		await withTempDir(async (dir) => {
			writeFile(dir, "included.ts", MISSING_PARAM_FILE);
			writeFile(dir, ".gitignore", "ignored.ts\n");
			writeFile(dir, "ignored.ts", NO_JSDOC_FILE);

			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};

			// With gitignore=true (default), ignored.ts should be excluded
			const resultWithGitignore = await lint(selector, dir, 100, true);
			expect(resultWithGitignore.summary.totalFiles).toBe(1);

			// With gitignore=false, both files should be included
			const resultWithoutGitignore = await lint(selector, dir, 100, false);
			expect(resultWithoutGitignore.summary.totalFiles).toBe(2);
		});
	});
});

describe("lintFiles", () => {
	it("lints an explicit list of file paths", async () => {
		await withTempDir(async (dir) => {
			const filePath = writeFile(dir, "missing-param.ts", MISSING_PARAM_FILE);
			const result = await lintFiles([filePath], dir);

			expect(result.summary.totalFiles).toBe(1);
			expect(result.summary.filesWithIssues).toBe(1);
			expect(result.files.length).toBe(1);
		});
	});

	it("filters to .ts/.tsx only", async () => {
		await withTempDir(async (dir) => {
			const tsFile = writeFile(dir, "valid.ts", VALID_FILE);
			const jsFile = path.join(dir, "file.js");
			fs.writeFileSync(jsFile, "var x = 1;\n");

			const result = await lintFiles([tsFile, jsFile], dir);

			// Should only lint the .ts file
			expect(result.summary.totalFiles).toBe(1);
		});
	});

	it("handles empty file list", async () => {
		const result = await lintFiles([], "/tmp");

		expect(result.summary.totalFiles).toBe(0);
		expect(result.summary.filesWithIssues).toBe(0);
		expect(result.summary.totalDiagnostics).toBe(0);
		expect(result.files).toEqual([]);
	});

	it("handles mixed pass/fail results", async () => {
		await withTempDir(async (dir) => {
			const validPath = writeFile(dir, "valid.ts", VALID_FILE);
			const invalidPath = writeFile(
				dir,
				"missing-param.ts",
				MISSING_PARAM_FILE,
			);
			const result = await lintFiles([validPath, invalidPath], dir);

			expect(result.summary.totalFiles).toBe(2);
			expect(result.summary.filesWithIssues).toBe(1);
			expect(result.files.length).toBe(1);
			expect(result.files[0].filePath).toBe("missing-param.ts");
		});
	});

	it("works with existing leaf-files fixture", async () => {
		// two-summaries.ts has a blank line before @summary which triggers jsdoc/tag-lines
		const result = await lintFiles([fixture("two-summaries.ts")], fixturesDir);

		expect(result.summary.totalFiles).toBe(1);
		expect(result.summary.filesWithIssues).toBe(1);
		expect(
			result.files[0].diagnostics.some((d) => d.rule === "jsdoc/tag-lines"),
		).toBe(true);
	});

	it("limit caps files shown in result", async () => {
		await withTempDir(async (dir) => {
			const file1 = writeFile(dir, "a.ts", NO_JSDOC_FILE);
			const file2 = writeFile(dir, "b.ts", NO_JSDOC_FILE);
			const file3 = writeFile(dir, "c.ts", NO_JSDOC_FILE);

			const result = await lintFiles([file1, file2, file3], dir, 2);

			expect(result.files.length).toBe(2);
			expect(result.summary.filesWithIssues).toBe(3);
			expect(result.summary.totalFiles).toBe(3);
		});
	});
});
