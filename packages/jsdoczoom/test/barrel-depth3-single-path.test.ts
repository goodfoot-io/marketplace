import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drilldown } from "../src/drilldown.js";
import type {
	OutputEntry,
	OutputItem,
	OutputItemNext,
	SelectorInfo,
} from "../src/types.js";

/**
 * Reproduces the bug where a single-path selector on a barrel file at depth 3
 * returns empty text instead of applying barrel transition logic.
 *
 * @summary Reproduction test for barrel depth 3 empty output with single-path selector
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");

const NO_CACHE = { enabled: false, directory: "" };

function pathSelector(pattern: string, depth?: number): SelectorInfo {
	return { type: "path", pattern, depth };
}

function isOutputItem(entry: OutputEntry): entry is OutputItem {
	return "text" in entry;
}

function hasNextId(entry: OutputEntry): entry is OutputItemNext {
	return "next_id" in entry;
}

function entryKey(entry: OutputEntry): string {
	if ("next_id" in entry) return entry.next_id;
	return entry.id;
}

function pathFromEntry(entry: OutputEntry): string {
	const key = entryKey(entry);
	const atIndex = key.lastIndexOf("@");
	return atIndex === -1 ? key : key.substring(0, atIndex);
}

describe("barrel depth 3 single-path selector", () => {
	// barrel-basic has:
	//   index.ts: re-exports from helper.js and utils.js, has @summary + description
	//   helper.ts: has @summary + description
	//   utils.ts: has @summary + description

	it("path selector on barrel at depth 3 returns non-empty content", async () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// Depth 3 on a barrel with a path selector should apply barrel transition:
		// barrel disappears, children appear at depth 3-2=1
		const results = await drilldown(
			pathSelector("index.ts", 3),
			basicDir,
			true,
			100,
			NO_CACHE,
		);

		// The result should contain the barrel's children (helper.ts, utils.ts),
		// each at their depth 1 (summary). It should NOT return a single item
		// with empty text.
		const hasEmptyText = results.items.some(
			(item) => isOutputItem(item) && item.text === "",
		);
		expect(hasEmptyText).toBe(false);

		// Should have expanded to children
		expect(results.items.length).toBeGreaterThanOrEqual(2);

		const paths = results.items.map((r) => pathFromEntry(r));
		expect(paths).toContain("helper.ts");
		expect(paths).toContain("utils.ts");
	});

	it("path selector on barrel at depth 3 shows children at depth 1 (summaries)", async () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		const results = await drilldown(
			pathSelector("index.ts", 3),
			basicDir,
			true,
			100,
			NO_CACHE,
		);

		// Each child should be at its L1 (summary) with a next_id pointing to L2
		for (const item of results.items) {
			expect(isOutputItem(item)).toBe(true);
			expect(hasNextId(item)).toBe(true);
			if (hasNextId(item)) {
				expect(item.text.length).toBeGreaterThan(0);
			}
		}

		const helperEntry = results.items.find(
			(r) => hasNextId(r) && r.next_id.startsWith("helper.ts@"),
		);
		expect(helperEntry).toBeDefined();
		if (helperEntry && hasNextId(helperEntry)) {
			expect(helperEntry.next_id).toBe("helper.ts@2");
			expect(helperEntry.text).toBe("Helper overview");
		}

		const utilsEntry = results.items.find(
			(r) => hasNextId(r) && r.next_id.startsWith("utils.ts@"),
		);
		expect(utilsEntry).toBeDefined();
		if (utilsEntry && hasNextId(utilsEntry)) {
			expect(utilsEntry.next_id).toBe("utils.ts@2");
			expect(utilsEntry.text).toBe("Utils overview");
		}
	});

	it("matches glob behavior at depth 3", async () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");

		// Glob at depth 3 (known working)
		const globResults = await drilldown(
			{ type: "glob", pattern: "**/*.ts", depth: 3 },
			basicDir,
			true,
			100,
			NO_CACHE,
		);

		// Path selector at depth 3 (buggy: returns empty text)
		const pathResults = await drilldown(
			pathSelector("index.ts", 3),
			basicDir,
			true,
			100,
			NO_CACHE,
		);

		// Both should produce the same children
		const globPaths = globResults.items.map((r) => pathFromEntry(r)).sort();
		const pathPaths = pathResults.items.map((r) => pathFromEntry(r)).sort();
		expect(pathPaths).toEqual(globPaths);
	});
});
