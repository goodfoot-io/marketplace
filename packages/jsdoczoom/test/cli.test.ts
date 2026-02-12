import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";

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

		it("-v runs validation mode", async () => {
			await main(["-v", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("files");
			expect(output).toHaveProperty("summary");
			expect(output.summary.total).toBe(1);
			expect(process.exitCode).toBe(0);
		});

		it("--validate runs validation mode", async () => {
			await main(["--validate", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("files");
			expect(output).toHaveProperty("summary");
		});

		it("--pretty outputs indented JSON (2-space indent)", async () => {
			await main(["--pretty", "two-summaries.ts"]);
			const raw = capture.getStdout();
			// Pretty JSON starts with "[\n" and contains indented lines
			expect(raw).toContain("\n  ");
			const parsed = JSON.parse(raw);
			// Verify it's valid JSON array
			expect(Array.isArray(parsed)).toBe(true);
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

		it("--pretty works with validation mode", async () => {
			await main(["--pretty", "-v", "two-summaries.ts"]);
			const raw = capture.getStdout();
			expect(raw).toContain("\n  ");
			const parsed = JSON.parse(raw);
			expect(parsed).toHaveProperty("summary");
			expect(raw.trimEnd()).toBe(JSON.stringify(parsed, null, 2));
		});
	});

	describe("selectors", () => {
		it("bare invocation (no args, no stdin) uses default selector", async () => {
			cwdSpy.mockReturnValue(depthDir);
			await main([]);
			const output = JSON.parse(capture.getStdout());
			expect(Array.isArray(output)).toBe(true);
			// depth-advancement dir has one-summary.ts and three-summaries.ts
			expect(output.length).toBeGreaterThanOrEqual(2);
			const paths = output.map((e: { path: string }) => e.path);
			expect(paths).toContain("one-summary.ts");
			expect(paths).toContain("three-summaries.ts");
		});

		it("selector argument is parsed and passed to drilldown", async () => {
			await main(["two-summaries.ts@1"]);
			const output = JSON.parse(capture.getStdout());
			expect(Array.isArray(output)).toBe(true);
			expect(output).toHaveLength(1);
			expect(output[0].id).toBe("two-summaries.ts@1");
		});
	});

	describe("stdin", () => {
		it("when stdin is provided, file paths are read one per line", async () => {
			const stdin = "two-summaries.ts\none-summary.ts";
			await main([], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(Array.isArray(output)).toBe(true);
			expect(output.length).toBe(2);
		});

		it("stdin paths are processed via drilldownFiles", async () => {
			const stdin = "two-summaries.ts";
			await main([], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(Array.isArray(output)).toBe(true);
			expect(output).toHaveLength(1);
			expect(output[0].path).toBe("two-summaries.ts");
		});

		it("stdin with -v processes via validateFiles", async () => {
			const stdin = "two-summaries.ts\none-summary.ts";
			await main(["-v"], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output).toHaveProperty("files");
			expect(output).toHaveProperty("summary");
			expect(output.summary.total).toBe(2);
		});

		it("stdin combined with @depth suffix applies depth to all paths", async () => {
			const stdin = "two-summaries.ts";
			await main(["@1"], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(Array.isArray(output)).toBe(true);
			expect(output).toHaveLength(1);
			expect(output[0].id).toBe("two-summaries.ts@1");
		});

		it("stdin ignores blank lines", async () => {
			const stdin = "two-summaries.ts\n\n\none-summary.ts\n";
			await main([], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output.length).toBe(2);
		});

		it("stdin trims whitespace from paths", async () => {
			const stdin = "  two-summaries.ts  \n  one-summary.ts  ";
			await main([], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(output.length).toBe(2);
		});

		it("when both a full selector and stdin are provided, stdin takes priority (depth still extracted from arg)", async () => {
			// Provide a selector with a pattern and depth; stdin takes priority for file list
			// but depth should be extracted from the selector argument
			const stdin = "two-summaries.ts";
			await main(["some-other-pattern.ts@1"], stdin);
			const output = JSON.parse(capture.getStdout());
			expect(Array.isArray(output)).toBe(true);
			expect(output).toHaveLength(1);
			// Depth 1 should be applied from the selector argument
			expect(output[0].id).toBe("two-summaries.ts@1");
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
			// one-summary.ts has only 1 @summary tag, which fails validation (needs 2)
			await main(["-v", "one-summary.ts"]);
			expect(process.exitCode).toBe(2);

			// Stderr should have VALIDATION_FAILED
			const errOutput = capture.getStderr();
			const parsed = JSON.parse(errOutput);
			expect(parsed.error.code).toBe("VALIDATION_FAILED");
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
		it("normal mode output is valid JSON array on stdout", async () => {
			await main(["two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(Array.isArray(output)).toBe(true);
			expect(output).toHaveLength(1);
			expect(output[0]).toHaveProperty("id");
			expect(output[0]).toHaveProperty("path");
			expect(output[0]).toHaveProperty("more");
			expect(output[0]).toHaveProperty("text");
		});

		it("validation mode output is valid JSON object on stdout", async () => {
			await main(["-v", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(typeof output).toBe("object");
			expect(Array.isArray(output)).toBe(false);
			expect(output).toHaveProperty("files");
			expect(output).toHaveProperty("summary");
		});

		it("output always ends with a newline", async () => {
			await main(["two-summaries.ts"]);
			const raw = capture.getStdout();
			expect(raw.endsWith("\n")).toBe(true);
		});

		it("validation success writes result to stdout only, no stderr", async () => {
			await main(["-v", "two-summaries.ts"]);
			const output = JSON.parse(capture.getStdout());
			expect(output.summary.passed).toBe(1);
			expect(output.summary.failed).toBe(0);
			expect(capture.getStderr()).toBe("");
			expect(process.exitCode).toBe(0);
		});

		it("validation failure writes result to stdout and error to stderr", async () => {
			await main(["-v", "one-summary.ts"]);
			// stdout has the validation result
			const output = JSON.parse(capture.getStdout());
			expect(output.summary.failed).toBe(1);
			// stderr has the VALIDATION_FAILED error
			const errOutput = JSON.parse(capture.getStderr());
			expect(errOutput.error.code).toBe("VALIDATION_FAILED");
			expect(process.exitCode).toBe(2);
		});
	});
});
