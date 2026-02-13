import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";
import type { SelectorInfo } from "../src/types.js";
import { validate, validateFiles } from "../src/validate.js";

/**
 * Verifies status classification (valid, syntax_error, missing_jsdoc,
 * missing_summary, missing_description), priority-order group filling
 * under limits, and error handling for missing files and empty globs.
 *
 * @summary Tests for file-level JSDoc validation and grouped result output
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "fixtures", "leaf-files");

function fixture(name: string): string {
	return path.join(fixturesDir, name);
}

describe("validate", () => {
	it("valid file produces empty result", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("two-summaries.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

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

		expect(result.missing_description?.files).toEqual(["summary-only.ts"]);
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

		expect(result.missing_summary?.files).toEqual(["description-only.ts"]);
	});

	it("file with no file-level JSDoc is missing_jsdoc", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("no-jsdoc.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.missing_jsdoc?.files).toEqual(["no-jsdoc.ts"]);
	});

	it("file with syntax error is syntax_error", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("syntax-error.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.syntax_error?.files).toEqual(["syntax-error.ts"]);
	});

	it("whitespace-only @summary is skipped, uses next non-empty one", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("whitespace-summary.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.missing_summary).toBeUndefined();
	});

	it("flags files with multiple @summary tags", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: "multiple-summaries.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);
		expect(result.multiple_summary).toBeDefined();
		expect(result.multiple_summary?.files).toEqual(["multiple-summaries.ts"]);
	});

	it("silently strips @depth suffix", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "**/*.ts",
			depth: 1,
		};

		const result = validate(selector, fixturesDir);
		// Should succeed without throwing — depth is ignored
		expect(typeof result).toBe("object");
	});

	it("output groups only contain invalid files, empty groups omitted", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		// Every group key that exists should have { guidance, files } shape
		for (const key of [
			"syntax_error",
			"missing_jsdoc",
			"missing_summary",
			"multiple_summary",
			"missing_description",
			"missing_barrel",
		] as const) {
			const group = result[key];
			if (group !== undefined) {
				expect(typeof group.guidance).toBe("string");
				expect(group.guidance.length).toBeGreaterThan(0);
				expect(Array.isArray(group.files)).toBe(true);
				expect(group.files.length).toBeGreaterThan(0);
				for (const p of group.files) {
					expect(typeof p).toBe("string");
				}
			}
		}
	});

	it("each group includes guidance text", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		if (result.syntax_error) {
			expect(result.syntax_error.guidance).toContain("### Syntax error");
		}
		if (result.missing_jsdoc) {
			expect(result.missing_jsdoc.guidance).toContain(
				"### Missing file-level JSDoc",
			);
		}
		if (result.missing_summary) {
			expect(result.missing_summary.guidance).toContain("### The @summary tag");
		}
		if (result.missing_description) {
			expect(result.missing_description.guidance).toContain(
				"### The description paragraph",
			);
		}
	});

	it("works with glob selectors", () => {
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "two-*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		// two-summaries.ts is valid, so no groups should appear
		expect(result.syntax_error).toBeUndefined();
		expect(result.missing_jsdoc).toBeUndefined();
		expect(result.missing_summary).toBeUndefined();
		expect(result.missing_description).toBeUndefined();
	});

	it("works with path selectors", () => {
		const selector: SelectorInfo = {
			type: "path",
			pattern: fixture("two-summaries.ts"),
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);

		expect(result.syntax_error).toBeUndefined();
		expect(result.missing_jsdoc).toBeUndefined();
		expect(result.missing_summary).toBeUndefined();
		expect(result.missing_description).toBeUndefined();
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

	it("flags directories with >3 files and no barrel as missing_barrel", () => {
		// leaf-files has 12+ .ts files and no index.ts
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "*.ts",
			depth: undefined,
		};
		const result = validate(selector, fixturesDir);
		expect(result.missing_barrel).toBeDefined();
		expect(result.missing_barrel?.files).toContain(".");
	});

	it("does not flag directories with <=3 files as missing_barrel", () => {
		// depth-advancement has only 2 files
		const depthDir = path.resolve(__dirname, "fixtures", "depth-advancement");
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "*.ts",
			depth: undefined,
		};
		const result = validate(selector, depthDir);
		expect(result.missing_barrel).toBeUndefined();
	});

	it("does not flag directories that have a barrel as missing_barrel", () => {
		// barrel-basic has index.ts + helper.ts + utils.ts
		const barrelDir = path.resolve(__dirname, "fixtures", "barrel-basic");
		const selector: SelectorInfo = {
			type: "glob",
			pattern: "**/*.ts",
			depth: undefined,
		};
		const result = validate(selector, barrelDir);
		expect(result.missing_barrel).toBeUndefined();
	});

	describe("limit", () => {
		it("all invalid files shown when within limit", () => {
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = validate(selector, fixturesDir, 100);

			// With a high limit, all invalid files should be present
			const totalShown =
				(result.syntax_error?.files.length ?? 0) +
				(result.missing_jsdoc?.files.length ?? 0) +
				(result.missing_summary?.files.length ?? 0) +
				(result.missing_description?.files.length ?? 0);
			expect(totalShown).toBeGreaterThan(0);
		});

		it("total shown paths capped at limit", () => {
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = validate(selector, fixturesDir, 1);

			// Total shown paths should equal limit
			const shownPaths =
				(result.syntax_error?.files.length ?? 0) +
				(result.missing_jsdoc?.files.length ?? 0) +
				(result.missing_summary?.files.length ?? 0) +
				(result.missing_description?.files.length ?? 0);
			expect(shownPaths).toBe(1);
		});

		it("limit of 0 shows no file paths", () => {
			const selector: SelectorInfo = {
				type: "glob",
				pattern: "*.ts",
				depth: undefined,
			};
			const result = validate(selector, fixturesDir, 0);

			expect(result.syntax_error).toBeUndefined();
			expect(result.missing_jsdoc).toBeUndefined();
			expect(result.missing_summary).toBeUndefined();
			expect(result.missing_description).toBeUndefined();
		});

		it("groups are filled in priority order (syntax_error first)", () => {
			const files = [
				fixture("syntax-error.ts"),
				fixture("no-jsdoc.ts"),
				fixture("description-only.ts"),
				fixture("summary-only.ts"),
			];
			const result = validateFiles(files, fixturesDir, 2);

			// syntax_error should be filled first
			expect(result.syntax_error?.files).toEqual(["syntax-error.ts"]);
			// Then missing_jsdoc
			expect(result.missing_jsdoc?.files).toEqual(["no-jsdoc.ts"]);
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

		expect(result.missing_jsdoc?.files).toEqual(["no-jsdoc.ts"]);
	});

	it("filters to .ts/.tsx only", () => {
		const files = [
			fixture("two-summaries.ts"),
			"/some/path/file.js",
			"/some/path/file.jsx",
			fixture("one-summary.ts"),
		];
		const result = validateFiles(files, fixturesDir);

		// Should only validate .ts/.tsx files (filters out .js/.jsx) — all valid
		expect(result.syntax_error).toBeUndefined();
		expect(result.missing_jsdoc).toBeUndefined();
		expect(result.missing_summary).toBeUndefined();
		expect(result.missing_description).toBeUndefined();
	});

	it("produces grouped output format with ValidationGroup shape", () => {
		const files = [fixture("no-jsdoc.ts")];
		const result = validateFiles(files, fixturesDir);

		expect(result.missing_jsdoc).toBeDefined();
		expect(typeof result.missing_jsdoc?.guidance).toBe("string");
		expect(Array.isArray(result.missing_jsdoc?.files)).toBe(true);
	});

	it("handles empty file list", () => {
		const result = validateFiles([], fixturesDir);

		expect(result.syntax_error).toBeUndefined();
		expect(result.missing_jsdoc).toBeUndefined();
		expect(result.missing_summary).toBeUndefined();
		expect(result.missing_description).toBeUndefined();
	});

	it("handles mixed pass/fail results", () => {
		const files = [
			fixture("one-summary.ts"), // Pass
			fixture("description-only.ts"), // Fail — missing_summary
		];
		const result = validateFiles(files, fixturesDir);

		expect(result.missing_summary?.files).toEqual(["description-only.ts"]);
	});
});
