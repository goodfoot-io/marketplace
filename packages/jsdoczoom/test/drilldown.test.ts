import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drilldown, drilldownFiles } from "../src/drilldown.js";
import { JsdocError } from "../src/errors.js";
import type {
	OutputEntry,
	OutputErrorItem,
	OutputItem,
	OutputItemNext,
	OutputItemTerminal,
	SelectorInfo,
} from "../src/types.js";

/**
 * Verifies the fixed 4-level drill-down model (summary, description, type
 * declarations, full file) for both path and glob selectors. Levels are
 * 1-indexed. Covers depth advancement, null-level skipping, clamping,
 * alphabetical ordering, PARSE_ERROR handling in glob vs path contexts,
 * and drilldownFiles behavior.
 *
 * @summary Tests for progressive drill-down depth advancement and file processing
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");
const leafFilesDir = resolve(fixturesDir, "leaf-files");
const depthDir = resolve(fixturesDir, "depth-advancement");

/** Cache disabled for test isolation. */
const NO_CACHE = { enabled: false, directory: "" };

function pathSelector(pattern: string, depth?: number): SelectorInfo {
	return { type: "path", pattern, depth };
}

function globSelector(pattern: string, depth?: number): SelectorInfo {
	return { type: "glob", pattern, depth };
}

function isOutputItem(entry: OutputEntry): entry is OutputItem {
	return "text" in entry;
}

function isOutputErrorItem(entry: OutputEntry): entry is OutputErrorItem {
	return "error" in entry;
}

function hasNextId(entry: OutputEntry): entry is OutputItemNext {
	return "next_id" in entry;
}

function hasId(
	entry: OutputEntry,
): entry is OutputItemTerminal | OutputErrorItem {
	return "id" in entry;
}

/** Extract the key (next_id or id) from an entry for path extraction and sorting. */
function entryKey(entry: OutputEntry): string {
	if ("next_id" in entry) return entry.next_id;
	return entry.id;
}

function pathFromEntry(entry: OutputEntry): string {
	const key = entryKey(entry);
	const atIndex = key.lastIndexOf("@");
	return atIndex === -1 ? key : key.substring(0, atIndex);
}

describe("drilldown", () => {
	// Fixed levels (1-indexed): 1=summary, 2=description, 3=type declarations, 4=full file
	// one-summary.ts has @summary + description → all 4 levels populated

	it("path selector returns summary with next_id pointing to level 2", async () => {
		const results = await drilldown(
			pathSelector("one-summary.ts"),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		expect(hasNextId(entry)).toBe(true);
		if (hasNextId(entry)) {
			expect(entry.next_id).toBe("one-summary.ts@2");
			expect(entry.text).toBe("Single summary line");
		}
	});

	it("depth 2 returns description with next_id pointing to level 3", async () => {
		// one-summary.ts has @summary + description:
		// depth 1 = summary, depth 2 = description
		const results = await drilldown(
			pathSelector("one-summary.ts", 2),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		expect(hasNextId(entry)).toBe(true);
		if (hasNextId(entry)) {
			expect(entry.next_id).toBe("one-summary.ts@3");
			expect(entry.text).toBe("Module description as free-text.");
		}
	});

	it("depth 3 returns type declarations with next_id pointing to level 4", async () => {
		// one-summary.ts: summary + description → type declarations is depth 3
		const results = await drilldown(
			pathSelector("one-summary.ts", 3),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		expect(hasNextId(entry)).toBe(true);
		if (hasNextId(entry)) {
			expect(entry.next_id).toBe("one-summary.ts@4");
			// Type declarations output — not full file content
			expect(entry.text).not.toBe(
				readFileSync(resolve(leafFilesDir, "one-summary.ts"), "utf-8"),
			);
		}
	});

	it("depth 4 returns full file content (terminal, has id)", async () => {
		// one-summary.ts: terminal level is 4
		const results = await drilldown(
			pathSelector("one-summary.ts", 4),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		expect(hasNextId(entry)).toBe(false);
		if (hasId(entry) && isOutputItem(entry)) {
			expect(entry.id).toBe("one-summary.ts@4");
			const expectedContent = readFileSync(
				resolve(leafFilesDir, "one-summary.ts"),
				"utf-8",
			);
			expect(entry.text).toBe(expectedContent);
		}
	});

	it("depth clamping (F@99 returns terminal level 4)", async () => {
		const results = await drilldown(
			pathSelector("one-summary.ts", 99),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		expect(hasNextId(entry)).toBe(false);
		if (hasId(entry) && isOutputItem(entry)) {
			expect(entry.id).toBe("one-summary.ts@4");
			const expectedContent = readFileSync(
				resolve(leafFilesDir, "one-summary.ts"),
				"utf-8",
			);
			expect(entry.text).toBe(expectedContent);
		}
	});

	it("file without description skips level 2, advancing to type declarations", async () => {
		// summary-only.ts has @summary but no description
		// Level 1 = summary, Level 2 = null (no description), Level 3 = type decls, Level 4 = full file
		const results1 = await drilldown(
			pathSelector("summary-only.ts", 1),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results1.items).toHaveLength(1);
		const entry1 = results1.items[0];
		expect(isOutputItem(entry1)).toBe(true);
		expect(hasNextId(entry1)).toBe(true);
		if (hasNextId(entry1)) {
			expect(entry1.next_id).toBe("summary-only.ts@2");
			expect(entry1.text).toBe("Summary without description");
		}

		// Depth 2 has no description, advances to level 3 (type declarations)
		const results2 = await drilldown(
			pathSelector("summary-only.ts", 2),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results2.items).toHaveLength(1);
		const entry2 = results2.items[0];
		expect(isOutputItem(entry2)).toBe(true);
		expect(hasNextId(entry2)).toBe(true);
		if (hasNextId(entry2)) {
			expect(entry2.next_id).toBe("summary-only.ts@4");
		}

		// Depth 99 clamps to terminal (level 4)
		const results99 = await drilldown(
			pathSelector("summary-only.ts", 99),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results99.items).toHaveLength(1);
		const entry99 = results99.items[0];
		expect(isOutputItem(entry99)).toBe(true);
		expect(hasNextId(entry99)).toBe(false);
		if (hasId(entry99) && isOutputItem(entry99)) {
			expect(entry99.id).toBe("summary-only.ts@4");
		}
	});

	it("glob returns all matching files at requested depth independently", async () => {
		// Use a glob that matches multiple files in leaf-files with summaries
		const results = await drilldown(
			globSelector("*-summary.ts"),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		// Should match one-summary.ts and two-summaries.ts (both have summaries)
		expect(results.items.length).toBeGreaterThanOrEqual(2);
		for (const entry of results.items) {
			expect(isOutputItem(entry)).toBe(true);
			// Files with summaries have next_id at depth 1
			expect(hasNextId(entry)).toBe(true);
			if (hasNextId(entry)) {
				expect(entry.next_id).toMatch(/@2$/);
			}
		}
	});

	it("glob includes files without summaries", async () => {
		const results = await drilldown(
			globSelector("*.ts"),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		const paths = results.items.map((r) => pathFromEntry(r));
		// no-jsdoc.ts has no JSDoc — still included (starts at type decls)
		expect(paths).toContain("no-jsdoc.ts");
		// description-only.ts has no @summary — still included (starts at description)
		expect(paths).toContain("description-only.ts");
	});

	it("glob NO_FILES_MATCHED when glob matches zero .ts/.tsx files on disk", async () => {
		await expect(
			drilldown(
				globSelector("nonexistent/**/*.ts"),
				leafFilesDir,
				true,
				100,
				NO_CACHE,
			),
		).rejects.toThrow(JsdocError);
		try {
			await drilldown(
				globSelector("nonexistent/**/*.ts"),
				leafFilesDir,
				true,
				100,
				NO_CACHE,
			);
		} catch (error) {
			expect(error).toBeInstanceOf(JsdocError);
			expect((error as JsdocError).code).toBe("NO_FILES_MATCHED");
		}
	});

	it("file without summaries advances from level 1 to level 3 (type declarations)", async () => {
		const results = await drilldown(
			globSelector("no-jsdoc.ts"),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		// No summary (level 1), no description (level 2) → advances to level 3 (type decls)
		expect(hasNextId(entry)).toBe(true);
		if (hasNextId(entry)) {
			expect(entry.next_id).toBe("no-jsdoc.ts@4");
		}
	});

	it("path selector on file without summaries advances to level 3", async () => {
		const results = await drilldown(
			pathSelector("no-jsdoc.ts"),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		expect(hasNextId(entry)).toBe(true);
		if (hasNextId(entry)) {
			expect(entry.next_id).toBe("no-jsdoc.ts@4");
		}
	});

	it("alphabetical ordering by path", async () => {
		const results = await drilldown(
			globSelector("*.ts"),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		const paths = results.items.map((r) => pathFromEntry(r));
		const sorted = [...paths].sort();
		expect(paths).toEqual(sorted);
	});

	it("PARSE_ERROR in glob context produces OutputErrorItem (partial results)", async () => {
		// Use a glob that matches both syntax-error.ts and valid files
		const results = await drilldown(
			globSelector("*.ts"),
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);

		// Should have results (some valid files + the error entry for syntax-error.ts)
		expect(results.items.length).toBeGreaterThan(1);

		const errorEntry = results.items.find(
			(r) => hasId(r) && r.id === "syntax-error.ts",
		);
		expect(errorEntry).toBeDefined();
		if (errorEntry && isOutputErrorItem(errorEntry)) {
			// Error item id has no depth suffix
			expect(errorEntry.id).toBe("syntax-error.ts");
			expect(errorEntry.error.code).toBe("PARSE_ERROR");
		}

		// Valid files should still be present
		const validEntries = results.items.filter((r) => isOutputItem(r));
		expect(validEntries.length).toBeGreaterThan(0);
	});

	it("PARSE_ERROR for path selector throws fatal error", async () => {
		await expect(
			drilldown(
				pathSelector("syntax-error.ts"),
				leafFilesDir,
				true,
				100,
				NO_CACHE,
			),
		).rejects.toThrow(JsdocError);
		try {
			await drilldown(
				pathSelector("syntax-error.ts"),
				leafFilesDir,
				true,
				100,
				NO_CACHE,
			);
		} catch (error) {
			expect(error).toBeInstanceOf(JsdocError);
			expect((error as JsdocError).code).toBe("PARSE_ERROR");
		}
	});

	it("independent depth advancement (glob @2 returns description for both files)", async () => {
		// Both files have @summary + description
		// At depth 2, both show description (next_id → @3)
		const results = await drilldown(
			globSelector("*.ts", 2),
			depthDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results.items).toHaveLength(2);

		const oneSum = results.items.find(
			(r) => hasNextId(r) && r.next_id.startsWith("one-summary.ts@"),
		);
		const threeSum = results.items.find(
			(r) => hasNextId(r) && r.next_id.startsWith("three-summaries.ts@"),
		);

		expect(oneSum).toBeDefined();
		expect(threeSum).toBeDefined();

		if (oneSum && hasNextId(oneSum)) {
			expect(oneSum.next_id).toBe("one-summary.ts@3");
		}

		if (threeSum && hasNextId(threeSum)) {
			expect(threeSum.next_id).toBe("three-summaries.ts@3");
		}
	});

	it("../ path resolution uses resolved path in output", async () => {
		// From leaf-files, use ../ to access depth-advancement/one-summary.ts
		const selector = pathSelector("../depth-advancement/one-summary.ts", 1);
		const results = await drilldown(
			selector,
			leafFilesDir,
			true,
			100,
			NO_CACHE,
		);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (hasNextId(entry)) {
			// The path should be relative to leafFilesDir, using ../
			expect(pathFromEntry(entry)).toBe(
				relative(leafFilesDir, resolve(depthDir, "one-summary.ts")),
			);
			expect(entry.next_id).toContain("@2");
		}
	});
});

describe("drilldownFiles", () => {
	it("processes explicit file list at given depth", async () => {
		const files = [resolve(leafFilesDir, "one-summary.ts")];
		const results = await drilldownFiles(files, 1, leafFilesDir, 100, NO_CACHE);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (hasNextId(entry)) {
			expect(entry.next_id).toBe("one-summary.ts@2");
			expect(entry.text).toBe("Single summary line");
		}
	});

	it("filters to .ts/.tsx only", async () => {
		const files = [
			resolve(leafFilesDir, "one-summary.ts"),
			resolve(leafFilesDir, "one-summary.js"), // Non-existent .js file should be filtered
			"/some/file.json",
		];
		const results = await drilldownFiles(files, 1, leafFilesDir, 100, NO_CACHE);
		// Only the .ts file should be processed
		expect(results.items).toHaveLength(1);
		expect(pathFromEntry(results.items[0])).toBe("one-summary.ts");
	});

	it("includes files without summaries", async () => {
		const files = [
			resolve(leafFilesDir, "one-summary.ts"),
			resolve(leafFilesDir, "no-jsdoc.ts"),
		];
		const results = await drilldownFiles(files, 1, leafFilesDir, 100, NO_CACHE);
		expect(results.items).toHaveLength(2);
		const paths = results.items.map((r) => pathFromEntry(r));
		expect(paths).toContain("one-summary.ts");
		expect(paths).toContain("no-jsdoc.ts");
	});

	it("each file advances independently through its own levels", async () => {
		const files = [
			resolve(depthDir, "one-summary.ts"),
			resolve(depthDir, "three-summaries.ts"),
		];
		// Both files have @summary + description
		// At depth 2, both show description (next_id → @3)
		const results = await drilldownFiles(files, 2, depthDir, 100, NO_CACHE);
		expect(results.items).toHaveLength(2);

		const oneSum = results.items.find(
			(r) => hasNextId(r) && r.next_id.startsWith("one-summary.ts@"),
		);
		const threeSum = results.items.find(
			(r) => hasNextId(r) && r.next_id.startsWith("three-summaries.ts@"),
		);

		expect(oneSum).toBeDefined();
		expect(threeSum).toBeDefined();

		if (oneSum && hasNextId(oneSum)) {
			expect(oneSum.next_id).toBe("one-summary.ts@3");
		}

		if (threeSum && hasNextId(threeSum)) {
			expect(threeSum.next_id).toBe("three-summaries.ts@3");
		}
	});

	it("alphabetical ordering by path", async () => {
		const files = [
			resolve(leafFilesDir, "two-summaries.ts"),
			resolve(leafFilesDir, "one-summary.ts"),
			resolve(leafFilesDir, "exported-types.ts"),
		];
		const results = await drilldownFiles(files, 1, leafFilesDir, 100, NO_CACHE);
		const paths = results.items.map((r) => pathFromEntry(r));
		const sorted = [...paths].sort();
		expect(paths).toEqual(sorted);
	});

	it("handles files outside cwd without throwing (monorepo cross-package paths)", async () => {
		// Simulate monorepo scenario: cwd is a subdirectory but files are in sibling packages.
		// relative(depthDir, leafFile) produces a "../leaf-files/..." path.
		const files = [resolve(leafFilesDir, "one-summary.ts")];
		const results = await drilldownFiles(files, 1, depthDir, 100, NO_CACHE);
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
	});
});
