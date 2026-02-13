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
	it("valid file produces no status groups", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("two-summaries.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.invalid).toBe(0);
		expect(result.summary.truncated).toBe(false);
		expect(result.syntax_error).toBeUndefined();
		expect(result.missing_jsdoc).toBeUndefined();
		expect(result.missing_summary).toBeUndefined();
		expect(result.missing_description).toBeUndefined();
	});

	it("file with @summary but no description is missing_description", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("summary-only.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.invalid).toBe(1);
		expect(result.missing_description).toEqual(["summary-only.ts"]);
		expect(result.missing_jsdoc).toBeUndefined();
		expect(result.missing_summary).toBeUndefined();
	});

	it("file with no @summary is missing_summary", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("description-only.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.invalid).toBe(1);
		expect(result.missing_summary).toEqual(["description-only.ts"]);
	});

	it("file with no file-level JSDoc is missing_jsdoc", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("no-jsdoc.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.invalid).toBe(1);
		expect(result.missing_jsdoc).toEqual(["no-jsdoc.ts"]);
	});

	it("file with syntax error is syntax_error", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("syntax-error.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.invalid).toBe(1);
		expect(result.syntax_error).toEqual(["syntax-error.ts"]);
	});

	it("whitespace-only @summary is skipped, uses next non-empty one", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("whitespace-summary.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.invalid).toBe(0);
		expect(result.missing_summary).toBeUndefined();
	});

	it("rejects @depth suffix with INVALID_DEPTH error", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "**/*.ts",
			depth: 1,
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

	it("output groups only contain invalid files, empty groups omitted", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBeGreaterThan(0);
		expect(result).toHaveProperty("summary");

		// Every group key that exists should be an array of strings
		for (const key of [
			"syntax_error",
			"missing_jsdoc",
			"missing_summary",
			"missing_description",
		] as const) {
			const group = result[key];
			if (group !== undefined) {
				expect(Array.isArray(group)).toBe(true);
				expect(group.length).toBeGreaterThan(0);
				for (const p of group) {
					expect(typeof p).toBe("string");
				}
			}
		}
	});

	it("summary counts are consistent", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		const totalInvalid =
			(result.syntax_error?.length ?? 0) +
			(result.missing_jsdoc?.length ?? 0) +
			(result.missing_summary?.length ?? 0) +
			(result.missing_description?.length ?? 0);

		expect(result.summary.invalid).toBe(totalInvalid);
		expect(result.summary.total).toBeGreaterThanOrEqual(result.summary.invalid);
	});

	it("works with glob selectors", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "two-*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBeGreaterThan(0);
		// two-summaries.ts is valid, so no groups should mention it
		expect(result.summary.invalid).toBe(0);
	});

	it("works with path selectors", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("two-summaries.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.summary.total).toBe(1);
		expect(result.summary.invalid).toBe(0);
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

	describe("limit", () => {
		it("truncated is false when invalid count is within limit", () => {
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = validate(selector, fixturesDir, 100);

			expect(result.summary.truncated).toBe(false);
		});

		it("truncated is true when invalid count exceeds limit", () => {
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = validate(selector, fixturesDir, 1);

			expect(result.summary.truncated).toBe(true);
			// Total shown paths should equal limit
			const shownPaths =
				(result.syntax_error?.length ?? 0) +
				(result.missing_jsdoc?.length ?? 0) +
				(result.missing_summary?.length ?? 0) +
				(result.missing_description?.length ?? 0);
			expect(shownPaths).toBe(1);
			// But summary.invalid reflects the real total
			expect(result.summary.invalid).toBeGreaterThan(1);
		});

		it("limit of 0 shows no file paths but counts remain accurate", () => {
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = validate(selector, fixturesDir, 0);

			expect(result.summary.truncated).toBe(true);
			expect(result.syntax_error).toBeUndefined();
			expect(result.missing_jsdoc).toBeUndefined();
			expect(result.missing_summary).toBeUndefined();
			expect(result.missing_description).toBeUndefined();
			expect(result.summary.invalid).toBeGreaterThan(0);
		});

		it("groups are filled in priority order (syntax_error first)", () => {
			const files = [
				fixture("syntax-error.ts"),
				fixture("no-jsdoc.ts"),
				fixture("description-only.ts"),
				fixture("summary-only.ts"),
			];
			const result = validateFiles(files, fixturesDir, 2);

			expect(result.summary.invalid).toBe(4);
			expect(result.summary.truncated).toBe(true);
			// syntax_error should be filled first
			expect(result.syntax_error).toEqual(["syntax-error.ts"]);
			// Then missing_jsdoc
			expect(result.missing_jsdoc).toEqual(["no-jsdoc.ts"]);
			// Remaining groups should not appear (limit reached)
			expect(result.missing_summary).toBeUndefined();
			expect(result.missing_description).toBeUndefined();
		});
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
		expect(result.summary.invalid).toBe(1);
		expect(result.missing_jsdoc).toEqual(["no-jsdoc.ts"]);
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
		expect(result.summary.total).toBe(2);
		expect(result.summary.invalid).toBe(0);
	});

	it("produces grouped output format with summary", () => {
		const files = [fixture("two-summaries.ts")];
		const result = validateFiles(files, fixturesDir);

		expect(result).toHaveProperty("summary");
		expect(result.summary).toHaveProperty("total");
		expect(result.summary).toHaveProperty("invalid");
		expect(result.summary).toHaveProperty("truncated");
	});

	it("handles empty file list", () => {
		const result = validateFiles([], fixturesDir);

		expect(result.summary.total).toBe(0);
		expect(result.summary.invalid).toBe(0);
		expect(result.summary.truncated).toBe(false);
	});

	it("handles mixed pass/fail results", () => {
		const files = [
			fixture("one-summary.ts"), // Pass
			fixture("description-only.ts"), // Fail — missing_summary
		];
		const result = validateFiles(files, fixturesDir);

		expect(result.summary.total).toBe(2);
		expect(result.summary.invalid).toBe(1);
		expect(result.missing_summary).toEqual(["description-only.ts"]);
	});
});
