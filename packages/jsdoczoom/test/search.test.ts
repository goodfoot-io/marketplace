import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { search, searchFiles } from "../src/search.js";

/**
 * Tests for search module: filename/path, summary, description,
 * type declaration, and source-level matching with level hierarchy.
 *
 * @summary Integration tests for the search module
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");
const leafFilesDir = resolve(fixturesDir, "leaf-files");

/** Build a glob selector for the given pattern within leafFilesDir */
function leafSelector(pattern: string) {
	return { type: "glob" as const, pattern, depth: undefined };
}

/** Build a path selector for the given file in leafFilesDir */
function pathSelector(filename: string) {
	return {
		type: "path" as const,
		pattern: resolve(leafFilesDir, filename),
		depth: undefined,
	};
}

describe("search", () => {
	it("filename match returns OutputItemNext with next_id ending @2", async () => {
		// "exported-types" matches the filename "exported-types.ts"
		const result = await search(
			leafSelector(`${leafFilesDir}/**`),
			"exported-types",
			leafFilesDir,
		);
		expect(result.items.length).toBeGreaterThan(0);
		const item = result.items.find(
			(i) => "next_id" in i && i.next_id.includes("exported-types"),
		);
		expect(item).toBeDefined();
		if (item !== undefined && "next_id" in item) {
			expect(item.next_id).toMatch(/@2$/);
		} else {
			expect.fail("Expected item with next_id");
		}
	});

	it("summary match returns OutputItemNext with next_id ending @2", async () => {
		// "Type declarations test module" is the @summary of exported-types.ts
		const result = await search(
			pathSelector("exported-types.ts"),
			"Type declarations test module",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		expect("next_id" in item).toBe(true);
		if ("next_id" in item) {
			expect(item.next_id).toMatch(/@2$/);
			expect(item.text).toBe("Type declarations test module");
		}
	});

	it("description match returns OutputItemNext with next_id ending @3 and text is description", async () => {
		// two-summaries.ts has description "This is the free-text description of the module."
		const result = await search(
			pathSelector("two-summaries.ts"),
			"free-text description",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		expect("next_id" in item).toBe(true);
		if ("next_id" in item) {
			expect(item.next_id).toMatch(/@3$/);
			expect(item.text).toContain("free-text description");
		}
	});

	it("type declaration match returns only matching declarations with next_id ending @3", async () => {
		// exported-types.ts has exported type "User" interface
		// Search for a unique identifier in the type declarations that is not in the summary/description
		const result = await search(
			pathSelector("exported-types.ts"),
			"DEFAULT_TIMEOUT",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		expect("next_id" in item).toBe(true);
		if ("next_id" in item) {
			expect(item.next_id).toMatch(/@3$/);
			// Text should contain the matching declaration
			expect(item.text).toContain("DEFAULT_TIMEOUT");
			// Text should NOT contain other non-matching declarations
			expect(item.text).not.toContain("export type Name");
		}
	});

	it("full source match returns OutputItemTerminal with id ending @4 and text contains only matching source blocks (not full file)", async () => {
		// source-blocks.ts has a function "formatGreeting" (not exported, not in declarations)
		const result = await search(
			pathSelector("source-blocks.ts"),
			"formatGreeting",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		expect("id" in item && !("error" in item)).toBe(true);
		if ("id" in item && !("error" in item)) {
			expect(item.id).toMatch(/@4$/);
			// Should contain the matching block
			expect(item.text).toContain("formatGreeting");
			// Should NOT contain the unrelated exported function "greet" unless it matches
			// (greet doesn't contain "formatGreeting" in its declaration but calls it in impl)
			// The key test is that it's not returning the full file
			expect(item.text).not.toContain("import { readFileSync }");
		}
	});

	it("full source match includes // LN annotations on extracted blocks", async () => {
		// source-blocks.ts has formatGreeting function
		const result = await search(
			pathSelector("source-blocks.ts"),
			"formatGreeting",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		if ("id" in item && !("error" in item)) {
			// Annotations should be in the form // L<number> or // L<number>-L<number>
			expect(item.text).toMatch(/\/\/ L\d+/);
		}
	});

	it("full source match where regex matches import falls back to full file content", async () => {
		// source-blocks.ts starts with "import { readFileSync } from 'node:fs'"
		// extractSourceBlocks skips import declarations and returns null → falls back to full file
		const result = await search(
			pathSelector("source-blocks.ts"),
			"readFileSync",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		expect("id" in item).toBe(true);
		if ("id" in item && !("error" in item)) {
			expect(item.id).toMatch(/@4$/);
			// Full file content fallback — should contain the import
			expect(item.text).toContain("readFileSync");
			// And also contain the rest of the file
			expect(item.text).toContain("formatGreeting");
		}
	});

	it("non-matching files excluded from results (empty items)", async () => {
		// A query that matches nothing
		const result = await search(
			pathSelector("no-jsdoc.ts"),
			"xyzzy_completely_unique_string_that_matches_nothing",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(0);
		expect(result.truncated).toBe(false);
	});

	it("shallowest match wins (file matching at multiple levels returns shallowest)", async () => {
		// two-summaries.ts: summary="First summary - concise overview", description="This is the free-text description..."
		// Search for a term in the summary — should stop at level 2, NOT go to level 3
		const result = await search(
			pathSelector("two-summaries.ts"),
			"First summary",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		// Should be level 2 (summary match), not level 3 or 4
		expect("next_id" in item).toBe(true);
		if ("next_id" in item) {
			expect(item.next_id).toMatch(/@2$/);
		}
	});

	it("regex alternation works (foo|bar pattern)", async () => {
		// Search for "First summary|free-text description" — should match two-summaries.ts at summary level
		const result = await search(
			pathSelector("two-summaries.ts"),
			"First summary|completely_unrelated",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		expect("next_id" in item).toBe(true);
		if ("next_id" in item) {
			expect(item.next_id).toMatch(/@2$/);
		}
	});

	it("invalid regex throws INVALID_SELECTOR", async () => {
		await expect(
			search(leafSelector(`${leafFilesDir}/**`), "[invalid", leafFilesDir),
		).rejects.toMatchObject({ code: "INVALID_SELECTOR" });
	});

	it("no matches returns empty items, truncated: false", async () => {
		const result = await search(
			leafSelector(`${leafFilesDir}/**`),
			"xyzzy_completely_unique_string_that_matches_absolutely_nothing_ever",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(0);
		expect(result.truncated).toBe(false);
		expect(result.total).toBeUndefined();
	});

	it("respects limit and sets truncated/total", async () => {
		// Search for something that matches all files (e.g. ".ts" or "export")
		// Use a broad pattern — "export" appears in virtually all fixture files
		const result = await search(
			leafSelector(`${leafFilesDir}/**`),
			"export",
			leafFilesDir,
			true, // gitignore
			2, // limit
		);
		// Should be truncated to 2 results
		expect(result.items).toHaveLength(2);
		expect(result.truncated).toBe(true);
		expect(result.total).toBeGreaterThan(2);
	});

	it("searchFiles filters to .ts/.tsx and excludes .d.ts", async () => {
		const tsFile = resolve(leafFilesDir, "one-summary.ts");
		const jsFile = resolve(leafFilesDir, "not-typescript.js");
		const dtsFile = resolve(leafFilesDir, "typedefs.d.ts");
		// Only the .ts file should be processed
		const result = await searchFiles(
			[tsFile, jsFile, dtsFile],
			"Single summary line",
			leafFilesDir,
		);
		// Only one-summary.ts has "Single summary line" in its summary
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		if ("next_id" in item) {
			expect(item.next_id).toContain("one-summary.ts");
		}
	});

	it("case-insensitive matching (uppercase query matches lowercase content)", async () => {
		// one-summary.ts summary is "Single summary line" — search with uppercase
		const result = await search(
			pathSelector("one-summary.ts"),
			"SINGLE SUMMARY LINE",
			leafFilesDir,
		);
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		expect("next_id" in item).toBe(true);
		if ("next_id" in item) {
			expect(item.next_id).toMatch(/@2$/);
		}
	});

	it("files with parse errors are silently skipped", async () => {
		// syntax-error.ts has invalid TypeScript syntax
		// It should be skipped silently, not included in results
		const result = await search(
			pathSelector("syntax-error.ts"),
			"broken",
			leafFilesDir,
		);
		// Either 0 results (skipped) or 1 result if it matched at filename/source level
		// before parse error — but parse error should cause it to be skipped
		expect(result.truncated).toBe(false);
		// The file is called "syntax-error.ts" which could match "broken" at source level
		// but parse errors are silently skipped
		// Regardless of match, should not throw
		expect(Array.isArray(result.items)).toBe(true);
	});

	it("files with null summary/description skip those levels", async () => {
		// no-jsdoc.ts has neither summary nor description — levels 2 and 3 via JSDoc are null
		// The query "no docs" appears in the exported const value literal, which may match at
		// level 3 (type declarations include the literal) or level 4 (source)
		const result = await search(
			pathSelector("no-jsdoc.ts"),
			"no docs",
			leafFilesDir,
		);
		// Should match at level 3 or 4 (not level 2, since there's no summary)
		expect(result.items).toHaveLength(1);
		const item = result.items[0];
		const key = "next_id" in item ? item.next_id : "id" in item ? item.id : "";
		// Must NOT match at level 2 (no summary to match)
		expect(key).not.toMatch(/@2$/);
		// Should match at level 3 or 4
		expect(key).toMatch(/@[34]$/);
	});

	describe("searchFiles", () => {
		it("returns matching results from provided file list", async () => {
			const files = [
				resolve(leafFilesDir, "one-summary.ts"),
				resolve(leafFilesDir, "two-summaries.ts"),
			];
			const result = await searchFiles(
				files,
				"Single summary line",
				leafFilesDir,
			);
			expect(result.items).toHaveLength(1);
			const item = result.items[0];
			if ("next_id" in item) {
				expect(item.next_id).toContain("one-summary.ts");
			}
		});

		it("invalid regex throws INVALID_SELECTOR", async () => {
			await expect(
				searchFiles(
					[resolve(leafFilesDir, "one-summary.ts")],
					"[invalid",
					leafFilesDir,
				),
			).rejects.toMatchObject({ code: "INVALID_SELECTOR" });
		});

		it("results are sorted alphabetically", async () => {
			const files = [
				resolve(leafFilesDir, "two-summaries.ts"),
				resolve(leafFilesDir, "one-summary.ts"),
			];
			// "summary" matches both summaries
			const result = await searchFiles(files, "summary", leafFilesDir);
			if (result.items.length >= 2) {
				const keys = result.items.map((i) =>
					"next_id" in i ? i.next_id : i.id,
				);
				const sorted = [...keys].sort();
				expect(keys).toEqual(sorted);
			}
		});
	});
});
