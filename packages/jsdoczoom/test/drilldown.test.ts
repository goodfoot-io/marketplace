import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drilldown, drilldownFiles } from "../src/drilldown.js";
import { JsdocError } from "../src/errors.js";
import type {
	OutputErrorItem,
	OutputItem,
	SelectorInfo,
} from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");
const leafFilesDir = resolve(fixturesDir, "leaf-files");
const depthDir = resolve(fixturesDir, "depth-advancement");

function pathSelector(pattern: string, depth?: number): SelectorInfo {
	return { type: "path", pattern, depth };
}

function globSelector(pattern: string, depth?: number): SelectorInfo {
	return { type: "glob", pattern, depth };
}

function isOutputItem(entry: { id: string }): entry is OutputItem {
	return "text" in entry;
}

function isOutputErrorItem(entry: { id: string }): entry is OutputErrorItem {
	return "error" in entry;
}

function pathFromId(id: string): string {
	const atIndex = id.lastIndexOf("@");
	return atIndex === -1 ? id : id.substring(0, atIndex);
}

describe("drilldown", () => {
	// Fixed levels: 0=summary, 1=description, 2=full file
	// one-summary.ts has @summary + description → all 3 levels populated

	it("path selector returns L0 with id F@0 and more=true", () => {
		const results = drilldown(pathSelector("one-summary.ts"), leafFilesDir);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			expect(entry.id).toBe("one-summary.ts@0");
			expect(entry.more).toBe(true);
			expect(entry.text).toBe("Single summary line");
		}
	});

	it("depth 1 returns description with more=true", () => {
		// one-summary.ts has @summary + description:
		// depth 0 = summary, depth 1 = description
		const results = drilldown(pathSelector("one-summary.ts", 1), leafFilesDir);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			expect(entry.id).toBe("one-summary.ts@1");
			expect(entry.more).toBe(true);
			expect(entry.text).toBe("Module description as free-text.");
		}
	});

	it("depth 2 returns full file content with more=false", () => {
		// one-summary.ts: summary + description → full content is depth 2
		const results = drilldown(pathSelector("one-summary.ts", 2), leafFilesDir);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			expect(entry.id).toBe("one-summary.ts@2");
			expect(entry.more).toBe(false);
			const expectedContent = readFileSync(
				resolve(leafFilesDir, "one-summary.ts"),
				"utf-8",
			);
			expect(entry.text).toBe(expectedContent);
		}
	});

	it("depth clamping (F@99 returns terminal level 2)", () => {
		const results = drilldown(pathSelector("one-summary.ts", 99), leafFilesDir);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			expect(entry.id).toBe("one-summary.ts@2");
			expect(entry.more).toBe(false);
			const expectedContent = readFileSync(
				resolve(leafFilesDir, "one-summary.ts"),
				"utf-8",
			);
			expect(entry.text).toBe(expectedContent);
		}
	});

	it("file without description skips level 1, advancing to full file", () => {
		// summary-only.ts has @summary but no description
		// Level 0 = summary, Level 1 = null (no description), Level 2 = full file
		const results0 = drilldown(
			pathSelector("summary-only.ts", 0),
			leafFilesDir,
		);
		expect(results0.items).toHaveLength(1);
		const entry0 = results0.items[0];
		expect(isOutputItem(entry0)).toBe(true);
		if (isOutputItem(entry0)) {
			expect(entry0.id).toBe("summary-only.ts@0");
			expect(entry0.more).toBe(true);
			expect(entry0.text).toBe("Summary without description");
		}

		// Depth 1 has no description, advances to level 2 (full file)
		const results1 = drilldown(
			pathSelector("summary-only.ts", 1),
			leafFilesDir,
		);
		expect(results1.items).toHaveLength(1);
		const entry1 = results1.items[0];
		expect(isOutputItem(entry1)).toBe(true);
		if (isOutputItem(entry1)) {
			expect(entry1.id).toBe("summary-only.ts@2");
			expect(entry1.more).toBe(false);
			const expectedContent = readFileSync(
				resolve(leafFilesDir, "summary-only.ts"),
				"utf-8",
			);
			expect(entry1.text).toBe(expectedContent);
		}

		// Depth 99 clamps to terminal (level 2)
		const results99 = drilldown(
			pathSelector("summary-only.ts", 99),
			leafFilesDir,
		);
		expect(results99.items).toHaveLength(1);
		const entry99 = results99.items[0];
		expect(isOutputItem(entry99)).toBe(true);
		if (isOutputItem(entry99)) {
			expect(entry99.id).toBe("summary-only.ts@2");
			expect(entry99.more).toBe(false);
		}
	});

	it("glob returns all matching files at requested depth independently", () => {
		// Use a glob that matches multiple files in leaf-files with summaries
		const results = drilldown(globSelector("*-summary.ts", 0), leafFilesDir);
		// Should match one-summary.ts and two-summaries.ts (both have summaries)
		expect(results.items.length).toBeGreaterThanOrEqual(2);
		for (const entry of results.items) {
			expect(isOutputItem(entry)).toBe(true);
			if (isOutputItem(entry)) {
				expect(entry.id).toMatch(/@0$/);
				// Files with summaries have more=true at depth 0
				expect(entry.more).toBe(true);
			}
		}
	});

	it("glob includes files without summaries", () => {
		const results = drilldown(globSelector("*.ts", 0), leafFilesDir);
		const paths = results.items.map((r) => pathFromId(r.id));
		// no-jsdoc.ts has no JSDoc — still included (starts at full file)
		expect(paths).toContain("no-jsdoc.ts");
		// description-only.ts has no @summary — still included (starts at description)
		expect(paths).toContain("description-only.ts");
	});

	it("glob NO_FILES_MATCHED when glob matches zero .ts/.tsx files on disk", () => {
		expect(() =>
			drilldown(globSelector("nonexistent/**/*.ts"), leafFilesDir),
		).toThrow(JsdocError);
		try {
			drilldown(globSelector("nonexistent/**/*.ts"), leafFilesDir);
		} catch (error) {
			expect(error).toBeInstanceOf(JsdocError);
			expect((error as JsdocError).code).toBe("NO_FILES_MATCHED");
		}
	});

	it("file without summaries advances from level 0 to level 2 (full file)", () => {
		const results = drilldown(globSelector("no-jsdoc.ts"), leafFilesDir);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			// No summary (level 0), no description (level 1) → advances to level 2
			expect(entry.id).toBe("no-jsdoc.ts@2");
			expect(entry.more).toBe(false);
		}
	});

	it("path selector on file without summaries advances to level 2", () => {
		const results = drilldown(pathSelector("no-jsdoc.ts"), leafFilesDir);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			expect(entry.id).toBe("no-jsdoc.ts@2");
			expect(entry.more).toBe(false);
		}
	});

	it("alphabetical ordering by path", () => {
		const results = drilldown(globSelector("*.ts", 0), leafFilesDir);
		const paths = results.items.map((r) => pathFromId(r.id));
		const sorted = [...paths].sort();
		expect(paths).toEqual(sorted);
	});

	it("PARSE_ERROR in glob context produces OutputErrorItem (partial results)", () => {
		// Use a glob that matches both syntax-error.ts and valid files
		const results = drilldown(globSelector("*.ts", 0), leafFilesDir);

		// Should have results (some valid files + the error entry for syntax-error.ts)
		expect(results.items.length).toBeGreaterThan(1);

		const errorEntry = results.items.find((r) => r.id === "syntax-error.ts");
		expect(errorEntry).toBeDefined();
		if (errorEntry && isOutputErrorItem(errorEntry)) {
			// Error item id has no depth suffix
			expect(errorEntry.id).toBe("syntax-error.ts");
			expect(errorEntry.more).toBe(false);
			expect(errorEntry.error.code).toBe("PARSE_ERROR");
		}

		// Valid files should still be present
		const validEntries = results.items.filter((r) => isOutputItem(r));
		expect(validEntries.length).toBeGreaterThan(0);
	});

	it("PARSE_ERROR for path selector throws fatal error", () => {
		expect(() =>
			drilldown(pathSelector("syntax-error.ts"), leafFilesDir),
		).toThrow(JsdocError);
		try {
			drilldown(pathSelector("syntax-error.ts"), leafFilesDir);
		} catch (error) {
			expect(error).toBeInstanceOf(JsdocError);
			expect((error as JsdocError).code).toBe("PARSE_ERROR");
		}
	});

	it("independent depth advancement (glob @1 returns description for both files)", () => {
		// Both files have @summary + description
		// At depth 1, both show description (more=true)
		const results = drilldown(globSelector("*.ts", 1), depthDir);
		expect(results.items).toHaveLength(2);

		const oneSum = results.items.find((r) =>
			r.id.startsWith("one-summary.ts@"),
		);
		const threeSum = results.items.find((r) =>
			r.id.startsWith("three-summaries.ts@"),
		);

		expect(oneSum).toBeDefined();
		expect(threeSum).toBeDefined();

		if (oneSum && isOutputItem(oneSum)) {
			expect(oneSum.id).toBe("one-summary.ts@1");
			expect(oneSum.more).toBe(true);
		}

		if (threeSum && isOutputItem(threeSum)) {
			expect(threeSum.id).toBe("three-summaries.ts@1");
			expect(threeSum.more).toBe(true);
		}
	});

	it("../ path resolution uses resolved path in output", () => {
		// From leaf-files, use ../ to access depth-advancement/one-summary.ts
		const selector = pathSelector("../depth-advancement/one-summary.ts", 0);
		const results = drilldown(selector, leafFilesDir);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			// The path should be relative to leafFilesDir, using ../
			expect(pathFromId(entry.id)).toBe(
				relative(leafFilesDir, resolve(depthDir, "one-summary.ts")),
			);
			expect(entry.id).toContain("@0");
		}
	});
});

describe("drilldownFiles", () => {
	it("processes explicit file list at given depth", () => {
		const files = [resolve(leafFilesDir, "one-summary.ts")];
		const results = drilldownFiles(files, 0, leafFilesDir);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			expect(entry.id).toBe("one-summary.ts@0");
			expect(entry.text).toBe("Single summary line");
		}
	});

	it("filters to .ts/.tsx only", () => {
		const files = [
			resolve(leafFilesDir, "one-summary.ts"),
			resolve(leafFilesDir, "one-summary.js"), // Non-existent .js file should be filtered
			"/some/file.json",
		];
		const results = drilldownFiles(files, 0, leafFilesDir);
		// Only the .ts file should be processed
		expect(results.items).toHaveLength(1);
		expect(pathFromId(results.items[0].id)).toBe("one-summary.ts");
	});

	it("includes files without summaries", () => {
		const files = [
			resolve(leafFilesDir, "one-summary.ts"),
			resolve(leafFilesDir, "no-jsdoc.ts"),
		];
		const results = drilldownFiles(files, 0, leafFilesDir);
		expect(results.items).toHaveLength(2);
		const paths = results.items.map((r) => pathFromId(r.id));
		expect(paths).toContain("one-summary.ts");
		expect(paths).toContain("no-jsdoc.ts");
	});

	it("each file advances independently through its own levels", () => {
		const files = [
			resolve(depthDir, "one-summary.ts"),
			resolve(depthDir, "three-summaries.ts"),
		];
		// Both files have @summary + description
		// At depth 1, both show description (more=true)
		const results = drilldownFiles(files, 1, depthDir);
		expect(results.items).toHaveLength(2);

		const oneSum = results.items.find((r) =>
			r.id.startsWith("one-summary.ts@"),
		);
		const threeSum = results.items.find((r) =>
			r.id.startsWith("three-summaries.ts@"),
		);

		expect(oneSum).toBeDefined();
		expect(threeSum).toBeDefined();

		if (oneSum && isOutputItem(oneSum)) {
			expect(oneSum.id).toBe("one-summary.ts@1");
			expect(oneSum.more).toBe(true);
		}

		if (threeSum && isOutputItem(threeSum)) {
			expect(threeSum.id).toBe("three-summaries.ts@1");
			expect(threeSum.more).toBe(true);
		}
	});

	it("alphabetical ordering by path", () => {
		const files = [
			resolve(leafFilesDir, "two-summaries.ts"),
			resolve(leafFilesDir, "one-summary.ts"),
			resolve(leafFilesDir, "exported-types.ts"),
		];
		const results = drilldownFiles(files, 0, leafFilesDir);
		const paths = results.items.map((r) => pathFromId(r.id));
		const sorted = [...paths].sort();
		expect(paths).toEqual(sorted);
	});
});
