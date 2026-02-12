import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";
import type { SelectorInfo } from "../src/types.js";
import { validate, validateFiles } from "../src/validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "fixtures", "leaf-files");

function fixture(name: string): string {
	return path.join(fixturesDir, name);
}

describe("validate", () => {
	it("passes file with ≥2 non-empty @summary tags", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("two-summaries.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.passed).toBe(1);
		expect(result.summary.failed).toBe(0);
		expect(result.files).toHaveLength(1);
		expect(result.files[0].passed).toBe(true);
		expect(result.files[0].issues).toHaveLength(0);
	});

	it("fails file with 1 @summary tag (even with free-text)", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("one-summary.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.passed).toBe(0);
		expect(result.summary.failed).toBe(1);
		expect(result.files).toHaveLength(1);
		expect(result.files[0].passed).toBe(false);
		expect(result.files[0].issues).toContain(
			"Found 1 @summary tag(s), minimum is 2",
		);
	});

	it("fails file with 0 @summary tags", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("description-only.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.passed).toBe(0);
		expect(result.summary.failed).toBe(1);
		expect(result.files).toHaveLength(1);
		expect(result.files[0].passed).toBe(false);
		expect(result.files[0].issues).toContain(
			"Found 0 @summary tag(s), minimum is 2",
		);
	});

	it("fails file with no file-level JSDoc block", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("no-jsdoc.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.passed).toBe(0);
		expect(result.summary.failed).toBe(1);
		expect(result.files).toHaveLength(1);
		expect(result.files[0].passed).toBe(false);
		expect(result.files[0].issues).toContain("Missing file-level JSDoc block");
	});

	it("fails file with syntax error", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("syntax-error.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.passed).toBe(0);
		expect(result.summary.failed).toBe(1);
		expect(result.files).toHaveLength(1);
		expect(result.files[0].passed).toBe(false);
		expect(result.files[0].issues).toHaveLength(1);
		expect(result.files[0].issues[0]).toContain("Syntax error");
	});

	it("whitespace-only @summary not counted toward the 2-tag requirement", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("whitespace-summary.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.passed).toBe(0);
		expect(result.summary.failed).toBe(1);
		expect(result.files).toHaveLength(1);
		expect(result.files[0].passed).toBe(false);
		// Should only count 1 @summary (the non-empty one), not the whitespace one
		expect(result.files[0].issues).toContain(
			"Found 1 @summary tag(s), minimum is 2",
		);
	});

	it("rejects @depth suffix with INVALID_DEPTH error", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "**/*.ts",
			depth: 1, // Validation doesn't support depth
		};

		expect(() => validate(selector, fixturesDir)).toThrow(JsdocError);
		try {
			validate(selector, fixturesDir);
		} catch (e) {
			expect(e).toBeInstanceOf(JsdocError);
			expect((e as JsdocError).code).toBe("INVALID_DEPTH");
			expect((e as JsdocError).message).toBe(
				"Validation mode does not support @depth",
			);
		}
	});

	it("output includes per-file results with path/passed/issues", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.files.length).toBeGreaterThan(0);
		for (const file of result.files) {
			expect(file).toHaveProperty("path");
			expect(file).toHaveProperty("passed");
			expect(file).toHaveProperty("issues");
			expect(typeof file.path).toBe("string");
			expect(typeof file.passed).toBe("boolean");
			expect(Array.isArray(file.issues)).toBe(true);
		}
	});

	it("output includes summary counts (total/passed/failed)", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary).toHaveProperty("total");
		expect(result.summary).toHaveProperty("passed");
		expect(result.summary).toHaveProperty("failed");
		expect(result.summary.total).toBe(result.files.length);
		expect(result.summary.passed + result.summary.failed).toBe(
			result.summary.total,
		);
	});

	it("works with glob selectors", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "two-*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.files.length).toBeGreaterThan(0);
		expect(result.summary.total).toBeGreaterThan(0);
		// two-summaries.ts should pass
		const twoSummaries = result.files.find((f) =>
			f.path.includes("two-summaries.ts"),
		);
		expect(twoSummaries).toBeDefined();
		expect(twoSummaries?.passed).toBe(true);
	});

	it("works with path selectors", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("two-summaries.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.files).toHaveLength(1);
		expect(result.files[0].passed).toBe(true);
	});

	it("path targeting nonexistent file throws FILE_NOT_FOUND", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("nonexistent.ts"),
			depth: undefined,
		};

		expect(() => validate(selector, fixturesDir)).toThrow(JsdocError);
		try {
			validate(selector, fixturesDir);
		} catch (e) {
			expect(e).toBeInstanceOf(JsdocError);
			expect((e as JsdocError).code).toBe("FILE_NOT_FOUND");
		}
	});

	it("glob with no matches throws NO_FILES_MATCHED", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "nonexistent-*.ts",
			depth: undefined,
		};

		expect(() => validate(selector, fixturesDir)).toThrow(JsdocError);
		try {
			validate(selector, fixturesDir);
		} catch (e) {
			expect(e).toBeInstanceOf(JsdocError);
			expect((e as JsdocError).code).toBe("NO_FILES_MATCHED");
		}
	});
});

describe("validateFiles", () => {
	it("validates explicit file list", () => {
		const files = [
			fixture("two-summaries.ts"),
			fixture("one-summary.ts"),
			fixture("no-jsdoc.ts"),
		];
		const result = validateFiles(files, fixturesDir);

		expect(result.summary.total).toBe(3);
		expect(result.summary.passed).toBe(1); // Only two-summaries.ts passes
		expect(result.summary.failed).toBe(2);
		expect(result.files).toHaveLength(3);
	});

	it("filters to .ts/.tsx only", () => {
		const files = [
			fixture("two-summaries.ts"),
			"/some/path/file.js",
			"/some/path/file.jsx",
			fixture("one-summary.ts"),
		];
		const result = validateFiles(files, fixturesDir);

		// Should only validate .ts/.tsx files (filters out .js/.jsx)
		expect(result.files).toHaveLength(2);
		// All results should be .ts or .tsx files
		expect(
			result.files.every(
				(f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"),
			),
		).toBe(true);
	});

	it("produces same output format as validate", () => {
		const files = [fixture("two-summaries.ts")];
		const result = validateFiles(files, fixturesDir);

		expect(result).toHaveProperty("files");
		expect(result).toHaveProperty("summary");
		expect(result.summary).toHaveProperty("total");
		expect(result.summary).toHaveProperty("passed");
		expect(result.summary).toHaveProperty("failed");
		expect(result.files[0]).toHaveProperty("path");
		expect(result.files[0]).toHaveProperty("passed");
		expect(result.files[0]).toHaveProperty("issues");
	});

	it("handles empty file list", () => {
		const result = validateFiles([], fixturesDir);

		expect(result.summary.total).toBe(0);
		expect(result.summary.passed).toBe(0);
		expect(result.summary.failed).toBe(0);
		expect(result.files).toHaveLength(0);
	});

	it("handles mixed pass/fail results", () => {
		const files = [
			fixture("two-summaries.ts"), // Pass
			fixture("one-summary.ts"), // Fail
		];
		const result = validateFiles(files, fixturesDir);

		expect(result.summary.total).toBe(2);
		expect(result.summary.passed).toBe(1);
		expect(result.summary.failed).toBe(1);

		const passed = result.files.filter((f) => f.passed);
		const failed = result.files.filter((f) => !f.passed);
		expect(passed).toHaveLength(1);
		expect(failed).toHaveLength(1);
		expect(passed[0].issues).toHaveLength(0);
		expect(failed[0].issues.length).toBeGreaterThan(0);
	});
});
