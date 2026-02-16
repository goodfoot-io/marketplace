import fs from "node:fs";
import os from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";

/**
 * Verifies flag parsing, selector dispatch, stdin piping, JSON output
 * formatting, exit codes, and error serialization by capturing stdout
 * and stderr writes during CLI invocation.
 *
 * @summary Integration tests for CLI argument parsing, output format, and exit codes
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");
const leafFilesDir = resolve(fixturesDir, "leaf-files");
const depthDir = resolve(fixturesDir, "depth-advancement");

/**
 * Helper to capture stdout and stderr writes during a test.
 */
function captureOutput() {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const origStdoutWrite = process.stdout.write;
	const origStderrWrite = process.stderr.write;

	process.stdout.write = (chunk: string | Uint8Array): boolean => {
		stdout.push(
			typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
		);
		return true;
	};
	process.stderr.write = (chunk: string | Uint8Array): boolean => {
		stderr.push(
			typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
		);
		return true;
	};

	return {
		stdout,
		stderr,
		restore: () => {
			process.stdout.write = origStdoutWrite;
			process.stderr.write = origStderrWrite;
		},
		getStdout: () => stdout.join(""),
		getStderr: () => stderr.join(""),
	};
}

/** Extract the key from an output item (either next_id or id). */
function itemKey(item: Record<string, unknown>): string {
	if ("next_id" in item && typeof item.next_id === "string")
		return item.next_id;
	if ("id" in item && typeof item.id === "string") return item.id;
	return "";
}

/** Extract path from an output item key. */
function pathFromItem(item: Record<string, unknown>): string {
	const key = itemKey(item);
	const atIndex = key.lastIndexOf("@");
	return atIndex === -1 ? key : key.substring(0, atIndex);
}

describe("cli", () => {
	let capture: ReturnType<typeof captureOutput>;
	let cwdSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		process.exitCode = 0;
		capture = captureOutput();
		cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(leafFilesDir);
	});

	afterEach(() => {
		capture.restore();
		cwdSpy.mockRestore();
		process.exitCode = 0;
	});

	describe("flags", () => {
		it("--help prints help text and exits 0", async () => {
			await main(["--help"]);
			expect(capture.getStdout()).toContain("Usage: jsdoczoom");
			expect(process.exitCode).toBe(0);
		});

		it("-h prints help text and exits 0", async () => {
			await main(["-h"]);
			expect(capture.getStdout()).toContain("Usage: jsdoczoom");
			expect(process.exitCode).toBe(0);
		});

		it("-c runs check (validation) mode", async () => {
			await main(["-c", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(output.success).toBe(true);
			expect(output.message).toBe("All files passed validation");
			expect(process.exitCode).toBe(0);
		});

		it("--check runs check (validation) mode", async () => {
			await main(["--check", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(output.success).toBe(true);
		});

		it("-v prints version number", async () => {
			await main(["-v"]);
			const output = capture.getStdout().trim();
			expect(output).toMatch(/^\d+\.\d+\.\d+$/);
			expect(process.exitCode).toBe(0);
		});

		it("--version prints version number", async () => {
			await main(["--version"]);
			const output = capture.getStdout().trim();
			expect(output).toMatch(/^\d+\.\d+\.\d+$/);
			expect(process.exitCode).toBe(0);
		});

		it("--pretty outputs indented JSON (2-space indent)", async () => {
			await main(["--pretty", "two-summaries.ts"]);
			const raw = capture.getStdout();
			// Pretty JSON starts with "{\n" and contains indented lines
			expect(raw).toContain("\n  ");
			const parsed = JSON.parse(raw);
			// Verify it's valid JSON object with items and truncated
			expect(parsed).toHaveProperty("items");
			expect(parsed).toHaveProperty("truncated");
			// Verify the indentation matches 2-space indent
			expect(raw.trimEnd()).toBe(JSON.stringify(parsed, null, 2));
		});

		it("default output is compact JSON (no extra whitespace)", async () => {
			await main(["two-summaries.ts"]);
			const raw = capture.getStdout();
			const parsed = JSON.parse(raw);
			// Compact JSON: single line, no indentation
			expect(raw.trimEnd()).toBe(JSON.stringify(parsed));
		});

		it("--pretty works with check mode", async () => {
			await main(["--pretty", "-c", "two-summaries.ts"]);
			const raw = capture.getStdout();
			const parsed = JSON.parse(raw);
			expect(parsed.success).toBe(true);
			expect(raw.trimEnd()).toBe(JSON.stringify(parsed, null, 2));
		});
	});

	describe("selectors", () => {
		it("bare invocation (no args, no stdin) uses default selector", async () => {
			cwdSpy.mockReturnValue(depthDir);
			await main([]);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("items");
			// depth-advancement dir has one-summary.ts and three-summaries.ts
			expect(output.items.length).toBeGreaterThanOrEqual(2);
			const paths = output.items.map((e: Record<string, unknown>) =>
				pathFromItem(e),
			);
			expect(paths).toContain("one-summary.ts");
			expect(paths).toContain("three-summaries.ts");
		});

		it("directory path discovers files and produces drilldown output", async () => {
			cwdSpy.mockReturnValue(fixturesDir);
			await main(["leaf-files"]);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("items");
			expect(output.items.length).toBeGreaterThan(0);
		});

		it("selector argument is parsed and passed to drilldown", async () => {
			await main(["two-summaries.ts@2"]);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("items");
			expect(output.items).toHaveLength(1);
			// Level 2 (description) has next_id pointing to @3
			expect(output.items[0].next_id).toBe("two-summaries.ts@3");
		});
	});

	describe("stdin", () => {
		it("when stdin is provided, file paths are read one per line", async () => {
			const stdin = "two-summaries.ts\none-summary.ts";
			await main([], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("items");
			expect(output.items.length).toBe(2);
		});

		it("stdin paths are processed via drilldownFiles", async () => {
			const stdin = "two-summaries.ts";
			await main([], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("items");
			expect(output.items).toHaveLength(1);
			expect(pathFromItem(output.items[0])).toBe("two-summaries.ts");
		});

		it("stdin with -c processes via validateFiles", async () => {
			const stdin = "two-summaries.ts\none-summary.ts";
			await main(["-c"], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output.success).toBe(true);
		});

		it("stdin combined with @depth suffix applies depth to all paths", async () => {
			const stdin = "two-summaries.ts";
			await main(["@2"], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("items");
			expect(output.items).toHaveLength(1);
			// Level 2 (description) → next_id points to @3
			expect(output.items[0].next_id).toBe("two-summaries.ts@3");
		});

		it("stdin ignores blank lines", async () => {
			const stdin = "two-summaries.ts\n\n\none-summary.ts\n";
			await main([], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output.items.length).toBe(2);
		});

		it("stdin trims whitespace from paths", async () => {
			const stdin = "  two-summaries.ts  \n  one-summary.ts  ";
			await main([], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output.items.length).toBe(2);
		});

		it("when both a full selector and stdin are provided, stdin takes priority (depth still extracted from arg)", async () => {
			// Provide a selector with a pattern and depth; stdin takes priority for file list
			// but depth should be extracted from the selector argument
			const stdin = "two-summaries.ts";
			await main(["some-other-pattern.ts@2"], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("items");
			expect(output.items).toHaveLength(1);
			// Depth 2 should be applied from the selector argument → next_id @3
			expect(output.items[0].next_id).toBe("two-summaries.ts@3");
		});
	});

	describe("errors", () => {
		it("error JSON { error: { code, message } } written to stderr on failure", async () => {
			await main(["nonexistent-file-that-does-not-exist.ts"]);
			const errOutput = capture.getStderr();
			const parsed = JSON.parse(errOutput);
			expect(parsed).toHaveProperty("error");
			expect(parsed.error).toHaveProperty("code");
			expect(parsed.error).toHaveProperty("message");
		});

		it("exit code 1 on errors", async () => {
			await main(["nonexistent-file-that-does-not-exist.ts"]);
			expect(process.exitCode).toBe(1);
		});

		it("exit code 2 on validation failure", async () => {
			// description-only.ts has no @summary tag, which fails validation
			await main(["-c", "description-only.ts"]);
			expect(process.exitCode).toBe(2);

			// Stdout should have VALIDATION_FAILED error nested in the result
			const output = JSON.parse(capture.getStdout());
			expect(output.error.code).toBe("VALIDATION_FAILED");
		});

		it("exit code 0 on success", async () => {
			await main(["two-summaries.ts"]);
			expect(process.exitCode).toBe(0);
		});

		it("unexpected exceptions caught as INTERNAL_ERROR", async () => {
			// Mock drilldown to throw a non-JsdocError
			cwdSpy.mockImplementation(() => {
				throw new TypeError("something unexpected");
			});
			await main(["two-summaries.ts"]);
			const errOutput = capture.getStderr();
			const parsed = JSON.parse(errOutput);
			expect(parsed.error.code).toBe("INTERNAL_ERROR");
			expect(parsed.error.message).toBe("something unexpected");
			expect(process.exitCode).toBe(1);
		});

		it("error output on stderr is always compact JSON regardless of --pretty", async () => {
			await main(["--pretty", "nonexistent-file-that-does-not-exist.ts"]);
			const errOutput = capture.getStderr();
			// Should be compact (single line, no indentation)
			expect(errOutput.trimEnd().split("\n")).toHaveLength(1);
			const parsed = JSON.parse(errOutput);
			expect(errOutput.trimEnd()).toBe(JSON.stringify(parsed));
		});
	});

	describe("output", () => {
		it("normal mode output is valid JSON object on stdout", async () => {
			await main(["two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("items");
			expect(output).toHaveProperty("truncated");
			expect(output.items).toHaveLength(1);
			// Item should have either next_id or id, plus text
			const item = output.items[0];
			expect(item).toHaveProperty("text");
			expect("next_id" in item || "id" in item).toBe(true);
		});

		it("validation mode output is valid JSON object on stdout", async () => {
			await main(["-c", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(typeof output).toBe("object");
			expect(Array.isArray(output)).toBe(false);
			expect(output.success).toBe(true);
			expect(output.message).toBe("All files passed validation");
		});

		it("output always ends with a newline", async () => {
			await main(["two-summaries.ts"]);
			const raw = capture.getStdout();
			expect(raw.endsWith("\n")).toBe(true);
		});

		it("validation success writes result to stdout only, no stderr", async () => {
			await main(["-c", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(output.success).toBe(true);
			expect(capture.getStderr()).toBe("");
			expect(process.exitCode).toBe(0);
		});

		it("validation failure writes single consolidated result to stdout", async () => {
			await main(["-c", "description-only.ts"]);
			// stdout has the validation result with groups, success: false, and nested error
			const output = JSON.parse(capture.getStdout());
			expect(output.success).toBe(false);
			expect(output.missing_summary).toBeDefined();
			expect(output.missing_summary.files).toEqual(["description-only.ts"]);
			// Error metadata is nested in the stdout result, not on stderr
			expect(output.error.code).toBe("VALIDATION_FAILED");
			expect(capture.getStderr()).toBe("");
			expect(process.exitCode).toBe(2);
		});
	});

	describe("lint mode", () => {
		/** A fully valid file that passes all lint rules */
		const VALID_LINT_FILE = [
			"/**",
			" * File description explaining the purpose of this module.",
			" * @summary File summary for the module",
			" */",
			"",
			"/** The primary numeric value used for calculations */",
			"export const x = 1;",
			"",
		].join("\n");

		/**
		 * Create a temp dir with a valid file and mock cwd to it.
		 * Returns the directory path.
		 */
		function setupCleanLintDir(): string {
			const tmpDir = fs.mkdtempSync(
				resolve(os.tmpdir(), "jsdoczoom-cli-lint-"),
			);
			fs.writeFileSync(resolve(tmpDir, "clean.ts"), VALID_LINT_FILE);
			cwdSpy.mockReturnValue(tmpDir);
			return tmpDir;
		}

		it("-l flag runs lint mode", async () => {
			// two-summaries.ts has an export without JSDoc, so lint will find issues
			await main(["-l", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("files");
			expect(output).toHaveProperty("summary");
			expect(output.summary).toHaveProperty("totalFiles");
			expect(output.summary).toHaveProperty("filesWithIssues");
			expect(output.summary).toHaveProperty("totalDiagnostics");
		});

		it("--lint flag runs lint mode", async () => {
			await main(["--lint", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("files");
			expect(output).toHaveProperty("summary");
		});

		it("lint success exits 0", async () => {
			const tmpDir = setupCleanLintDir();
			try {
				await main(["-l", "clean.ts"]);
				expect(process.exitCode).toBe(0);
			} finally {
				fs.rmSync(tmpDir, { recursive: true });
			}
		});

		it("lint failure exits 2", async () => {
			// description-only.ts has no @summary, which triggers lint rules
			await main(["-l", "description-only.ts"]);
			expect(process.exitCode).toBe(2);
		});

		it("-l output is valid JSON with files and summary", async () => {
			await main(["-l", "description-only.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(Array.isArray(output.files)).toBe(true);
			expect(typeof output.summary.totalFiles).toBe("number");
			expect(typeof output.summary.filesWithIssues).toBe("number");
			expect(typeof output.summary.totalDiagnostics).toBe("number");

			// Should have diagnostics since export const value lacks JSDoc
			expect(output.files.length).toBeGreaterThan(0);
			expect(output.files[0]).toHaveProperty("filePath");
			expect(output.files[0]).toHaveProperty("diagnostics");
			expect(Array.isArray(output.files[0].diagnostics)).toBe(true);
		});

		it("-c and -l together produces error", async () => {
			await main(["-c", "-l", "two-summaries.ts"]);
			const errOutput = capture.getStderr();
			const parsed = JSON.parse(errOutput);
			expect(parsed.error.code).toBe("INVALID_SELECTOR");
			expect(parsed.error.message).toContain("Cannot use -c and -l together");
			expect(process.exitCode).toBe(1);
		});

		it("stdin piped paths with -l flag", async () => {
			const stdin = "two-summaries.ts\none-summary.ts";
			await main(["-l"], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("files");
			expect(output).toHaveProperty("summary");
			expect(output.summary.totalFiles).toBe(2);
		});

		it("--pretty with -l flag outputs indented JSON", async () => {
			await main(["--pretty", "-l", "two-summaries.ts"]);
			const raw = capture.getStdout();
			expect(raw).toContain("\n  ");
			const parsed = JSON.parse(raw);
			expect(raw.trimEnd()).toBe(JSON.stringify(parsed, null, 2));
			expect(parsed).toHaveProperty("files");
			expect(parsed).toHaveProperty("summary");
		});

		it("--no-gitignore with -l flag", async () => {
			const tmpDir = setupCleanLintDir();
			try {
				await main(["-l", "--no-gitignore", "*.ts"]);
				const output = JSON.parse(capture.getStdout());
				expect(output).toHaveProperty("files");
				expect(output).toHaveProperty("summary");
				expect(process.exitCode).toBe(0);
			} finally {
				fs.rmSync(tmpDir, { recursive: true });
			}
		});

		it("help text includes -c/--check and -l/--lint options", async () => {
			await main(["--help"]);
			const helpText = capture.getStdout();
			expect(helpText).toContain("-c, --check");
			expect(helpText).toContain("-l, --lint");
			expect(helpText).toContain("comprehensive JSDoc quality");
		});

		it("lint clean result writes only to stdout, no stderr", async () => {
			const tmpDir = setupCleanLintDir();
			try {
				await main(["-l", "clean.ts"]);
				expect(capture.getStderr()).toBe("");
				expect(process.exitCode).toBe(0);
			} finally {
				fs.rmSync(tmpDir, { recursive: true });
			}
		});

		it("lint output always ends with a newline", async () => {
			await main(["-l", "two-summaries.ts"]);
			const raw = capture.getStdout();
			expect(raw.endsWith("\n")).toBe(true);
		});
	});

	describe("--explain-rule", () => {
		it("prints explanation for known rule", async () => {
			await main(["--explain-rule", "jsdoc/informative-docs"]);
			const output = capture.getStdout();
			expect(output).toContain("jsdoc/informative-docs");
			expect(output).toContain("Passes with");
			expect(process.exitCode).toBe(0);
		});

		it("errors for unknown rule", async () => {
			await main(["--explain-rule", "nonexistent/rule"]);
			const errOutput = capture.getStderr();
			expect(errOutput).toContain("Unknown rule");
			expect(errOutput).toContain("nonexistent/rule");
			expect(process.exitCode).toBe(1);
		});
	});
});
