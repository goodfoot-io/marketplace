import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";

/**
 * Regression tests for the empty-stdin bug: when `stdin=""` is passed to
 * `main()`, the CLI incorrectly enters the stdin-processing branch instead of
 * the selector branch. `parseStdinPaths("")` yields zero paths, so
 * `lintFiles([])` / `validateFiles([])` runs against no files, exits 0, and
 * silently ignores the positional selector argument.
 *
 * These tests assert the CORRECT behavior (exit 2, diagnostics produced) and
 * therefore FAIL with the current buggy code.
 *
 * @summary Reproduces empty-stdin-bypasses-selector bug for -c and -l modes
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const leafFilesDir = resolve(__dirname, "fixtures", "leaf-files");

/**
 * Helper to capture stdout and stderr writes during a test.
 * Matches the pattern used in cli.test.ts.
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

describe("empty stdin bypasses selector (bug reproduction)", () => {
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

	describe("-c mode with empty stdin", () => {
		it("should detect validation failures, not silently pass (exit 2, not 0)", async () => {
			// description-only.ts has no @summary tag — validation must fail.
			// When stdin="" is passed (non-TTY shell with no piped data), the bug
			// causes the selector to be ignored: validateFiles([]) runs, reports
			// "All files passed validation", and exits 0.
			await main(["-c", "description-only.ts"], "");

			// CORRECT behavior: selector is used, validation finds issues, exit 2.
			// BUG behavior: exit 0, "All files passed validation".
			expect(process.exitCode).toBe(2);
		});

		it("should produce validation failure output, not a false-success message", async () => {
			await main(["-c", "description-only.ts"], "");

			const output = JSON.parse(capture.getStdout());

			// CORRECT: validation result with success:false and a VALIDATION_FAILED error.
			// BUG: { success: true, message: "All files passed validation" }
			expect(output.success).toBe(false);
			expect(output.error?.code).toBe("VALIDATION_FAILED");
		});

		it("should report description-only.ts as a failing file", async () => {
			await main(["-c", "description-only.ts"], "");

			const output = JSON.parse(capture.getStdout());

			// CORRECT: at least one validation group lists description-only.ts.
			// BUG: output has no file lists because zero files were processed.
			const allFiles = Object.values(output)
				.filter(
					(v): v is { files: string[] } =>
						v !== null &&
						typeof v === "object" &&
						"files" in (v as object) &&
						Array.isArray((v as { files: unknown }).files),
				)
				.flatMap((v) => v.files);

			expect(allFiles).toContain("description-only.ts");
		});

		it("undefined stdin processes selector correctly (control case)", async () => {
			// Passing undefined stdin (TTY mode) must work — this is the baseline.
			await main(["-c", "description-only.ts"], undefined);

			expect(process.exitCode).toBe(2);
			const output = JSON.parse(capture.getStdout());
			expect(output.success).toBe(false);
		});
	});

	describe("-l mode with empty stdin", () => {
		it("should detect lint issues, not produce empty output (exit 2, not 0)", async () => {
			// description-only.ts lacks @summary, triggering lint rules.
			// With the bug, stdin="" causes lintFiles([]) to run, producing no
			// output and exiting 0.
			await main(["-l", "description-only.ts"], "");

			// CORRECT: selector used, lint finds issues, exit 2.
			// BUG: exit 0, stdout empty.
			expect(process.exitCode).toBe(2);
		});

		it("should produce lint diagnostics, not empty stdout", async () => {
			await main(["-l", "description-only.ts"], "");

			const raw = capture.getStdout();

			// CORRECT: lint output is non-empty JSON with files and summary.
			// BUG: stdout is "" because lintFiles([]) returned no issues.
			expect(raw.length).toBeGreaterThan(0);

			const output = JSON.parse(raw);
			expect(output).toHaveProperty("files");
			expect(output).toHaveProperty("summary");
			expect(output.summary.totalFiles).toBeGreaterThan(0);
		});

		it("should report diagnostics for description-only.ts", async () => {
			await main(["-l", "description-only.ts"], "");

			const output = JSON.parse(capture.getStdout());

			// CORRECT: at least one file entry for description-only.ts with diagnostics.
			// BUG: output.files is [] because no files were linted.
			expect(output.files.length).toBeGreaterThan(0);
			const paths = output.files.map(
				(f: { filePath: string }) => f.filePath,
			);
			expect(paths.some((p: string) => p.endsWith("description-only.ts"))).toBe(
				true,
			);
		});

		it("undefined stdin processes selector correctly (control case)", async () => {
			// Passing undefined stdin (TTY mode) must work — this is the baseline.
			await main(["-l", "description-only.ts"], undefined);

			expect(process.exitCode).toBe(2);
			const output = JSON.parse(capture.getStdout());
			expect(output.summary.totalFiles).toBeGreaterThan(0);
		});
	});
});
