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
 * Verifies barrel gating behavior in glob mode: barrels with summaries
 * gate children at depths 1 and 2, transition at depth 3 revealing children,
 * and barrels without summaries pass through as regular files. Covers nested
 * barrels, zero-child barrels, null-skip at barrel L2, and alphabetical ordering.
 *
 * @summary Tests for barrel gating and transition behavior in drilldown glob mode
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");

function globSelector(pattern: string, depth?: number): SelectorInfo {
	return { type: "glob", pattern, depth };
}

function pathSelector(pattern: string, depth?: number): SelectorInfo {
	return { type: "path", pattern, depth };
}

function isOutputItem(entry: OutputEntry): entry is OutputItem {
	return "text" in entry;
}

function hasNextId(entry: OutputEntry): entry is OutputItemNext {
	return "next_id" in entry;
}

/** Extract the key (next_id or id) from an entry. */
function entryKey(entry: OutputEntry): string {
	if ("next_id" in entry) return entry.next_id;
	return entry.id;
}

function pathFromEntry(entry: OutputEntry): string {
	const key = entryKey(entry);
	const atIndex = key.lastIndexOf("@");
	return atIndex === -1 ? key : key.substring(0, atIndex);
}

describe("drilldown with barrels", () => {
	// barrel-basic has:
	//   index.ts with 1 @summary + description: summary="Barrel overview", description="Basic barrel module."
	//   helper.ts with 1 @summary + description: summary="Helper overview", description="Helper utilities."
	//   utils.ts with 1 @summary + description: summary="Utils overview", description="Utility functions."

	it("glob access returns barrel summaries first", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		const results = drilldown(globSelector("**/*.ts", 1), basicDir);

		// At depth 1, barrel has summaries so it gates children.
		// Only the barrel's own L1 summary should appear.
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		expect(hasNextId(entry)).toBe(true);
		if (hasNextId(entry)) {
			expect(pathFromEntry(entry)).toBe(".");
			expect(entry.text).toBe("Barrel overview");
			expect(entry.children).toBeDefined();
			expect(entry.children).toContain("helper.ts");
			expect(entry.children).toContain("utils.ts");
		}
	});

	it("glob drill-down reveals children after barrel levels exhausted", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// barrel-basic/index.ts has @summary + description → gates for 2 depths
		// At depth 3, barrel transitions. Children appear at depth 3-2=1.
		const results = drilldown(globSelector("**/*.ts", 3), basicDir);

		// Children: helper.ts and utils.ts — each at their L1
		const paths = results.items.map((r) => pathFromEntry(r));
		expect(paths).toContain("helper.ts");
		expect(paths).toContain("utils.ts");
	});

	it("barrel itself absent from output at transition depth", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// At depth 3, barrel transitions
		const results = drilldown(globSelector("**/*.ts", 3), basicDir);

		const paths = results.items.map((r) => pathFromEntry(r));
		expect(paths).not.toContain(".");
	});

	it("children appear at their shallowest summary level", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// barrel gates for 2 depths. At depth 3, children appear at depth 1.
		const results = drilldown(globSelector("**/*.ts", 3), basicDir);

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

	it("direct path access follows leaf rules (no gating)", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// Access the barrel directly via path — should follow normal leaf rules
		// Barrel id uses directory path instead of index.ts
		const results = drilldown(pathSelector("index.ts", 1), basicDir);

		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		expect(hasNextId(entry)).toBe(true);
		if (hasNextId(entry)) {
			expect(pathFromEntry(entry)).toBe(".");
			expect(entry.next_id).toBe(".@2");
			expect(entry.text).toBe("Barrel overview");
		}
	});

	it("barrel with 0 summaries — barrel and children both appear in glob results", () => {
		const zeroSumDir = resolve(fixturesDir, "barrel-zero-summaries");
		// index.ts has no summaries, so it's not a gating tree node.
		// Both the barrel and child.ts appear directly.
		const results = drilldown(globSelector("**/*.ts", 1), zeroSumDir);

		const paths = results.items.map((r) => pathFromEntry(r));
		expect(paths).toContain("child.ts");
		// The barrel itself appears as a regular file (no gating), id uses directory
		expect(paths).toContain(".");
	});

	it("barrel with summary gates for two depths then reveals children", () => {
		const rootDir = resolve(fixturesDir, "barrel-root");
		// barrel-root/index.ts has 1 @summary + description
		// At depth 1, barrel gates: only barrel summary shown
		const results1 = drilldown(globSelector("**/*.ts", 1), rootDir);
		const paths1 = results1.items.map((r) => pathFromEntry(r));
		expect(paths1).toContain(".");
		expect(paths1).not.toContain("sibling.ts");
		const barrelEntry1 = results1.items.find(
			(r) => hasNextId(r) && pathFromEntry(r) === ".",
		);
		expect(barrelEntry1).toBeDefined();
		if (barrelEntry1 && hasNextId(barrelEntry1)) {
			expect(barrelEntry1.children).toBeDefined();
			expect(barrelEntry1.children).toContain("sibling.ts");
		}

		// At depth 2, barrel still gates: barrel description shown
		const results2 = drilldown(globSelector("**/*.ts", 2), rootDir);
		const paths2 = results2.items.map((r) => pathFromEntry(r));
		expect(paths2).toContain(".");
		expect(paths2).not.toContain("sibling.ts");
		const barrelEntry = results2.items.find(
			(r) => hasNextId(r) && r.next_id.startsWith(".@"),
		);
		expect(barrelEntry).toBeDefined();
		if (barrelEntry && hasNextId(barrelEntry)) {
			expect(barrelEntry.next_id).toBe(".@3");
			expect(barrelEntry.text).toBe("Root barrel.");
			expect(barrelEntry.children).toBeDefined();
			expect(barrelEntry.children).toContain("sibling.ts");
		}

		// At depth 3, barrel transitions: children appear
		const results3 = drilldown(globSelector("**/*.ts", 3), rootDir);
		const paths3 = results3.items.map((r) => pathFromEntry(r));
		expect(paths3).not.toContain(".");
		expect(paths3).toContain("sibling.ts");
		expect(paths3).toContain("nested");
	});

	it("barrel with zero children returns empty items at transition", () => {
		const zeroChildDir = resolve(fixturesDir, "barrel-zero-children");
		// barrel-zero-children/index.ts has 1 @summary + description
		// At depth 1, the barrel summary is shown
		const results1 = drilldown(globSelector("**/*.ts", 1), zeroChildDir);
		expect(results1.items).toHaveLength(1);
		const entry1 = results1.items[0];
		if (entry1 && hasNextId(entry1)) {
			expect(entry1.children).toEqual([]);
		}

		// At depth 2, barrel still gates: barrel description shown
		const results2 = drilldown(globSelector("**/*.ts", 2), zeroChildDir);
		expect(results2.items).toHaveLength(1);
		const barrelEntry = results2.items[0];
		if (barrelEntry && hasNextId(barrelEntry)) {
			expect(barrelEntry.next_id).toBe(".@3");
			expect(barrelEntry.text).toBe("Lonely barrel.");
			expect(barrelEntry.children).toEqual([]);
		}

		// At depth 3 (transition), barrel disappears and there are no children
		const results3 = drilldown(globSelector("**/*.ts", 3), zeroChildDir);
		expect(results3.items).toHaveLength(0);
	});

	it("nested barrel child appears as regular item with directory id (when revealed)", () => {
		const nestedDir = resolve(fixturesDir, "barrel-nested");
		// barrel-nested/index.ts has 1 @summary + description
		// At depth 3, parent barrel transitions. Children: leaf.ts, sub/index.ts
		// sub/index.ts is itself a barrel but appears as a regular item at this level
		const results = drilldown(globSelector("**/*.ts", 3), nestedDir);

		const subBarrel = results.items.find(
			(r) => hasNextId(r) && r.next_id.startsWith("sub@"),
		);
		expect(subBarrel).toBeDefined();
		if (subBarrel && hasNextId(subBarrel)) {
			// The sub-barrel at depth 1 shows its own summary, id uses directory
			expect(subBarrel.next_id).toBe("sub@2");
			expect(subBarrel.text).toBe("Sub overview");
		}
	});

	it("children ordered alphabetically", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// At barrel transition depth (3), children appear sorted
		const results = drilldown(globSelector("**/*.ts", 3), basicDir);
		const paths = results.items.map((r) => pathFromEntry(r));
		const sorted = [...paths].sort();
		expect(paths).toEqual(sorted);
	});

	it("root-level barrel gates sibling files and child barrels", () => {
		const rootDir = resolve(fixturesDir, "barrel-root");
		// At depth 1, only barrel summary shown
		const results = drilldown(globSelector("**/*.ts", 1), rootDir);

		// Only the root barrel should appear
		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry) && hasNextId(entry)) {
			expect(pathFromEntry(entry)).toBe(".");
			expect(entry.text).toBe("Root overview");
			expect(entry.children).toBeDefined();
			expect(entry.children).toContain("sibling.ts");
		}

		// At transition depth (3), sibling and child barrel appear
		const results3 = drilldown(globSelector("**/*.ts", 3), rootDir);
		const paths3 = results3.items.map((r) => pathFromEntry(r));
		expect(paths3).toContain("sibling.ts");
		expect(paths3).toContain("nested");
		expect(paths3).not.toContain(".");
	});

	it("barrel at depth 2 shows description", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// barrel-basic/index.ts has @summary + description
		// At depth 2, barrel still gates: shows its description (L2)
		const results = drilldown(globSelector("**/*.ts", 2), basicDir);

		expect(results.items).toHaveLength(1);
		const entry = results.items[0];
		expect(isOutputItem(entry)).toBe(true);
		expect(hasNextId(entry)).toBe(true);
		if (hasNextId(entry)) {
			expect(entry.next_id).toBe(".@3");
			expect(entry.text).toBe("Basic barrel module.");
			expect(entry.children).toBeDefined();
			expect(entry.children).toContain("helper.ts");
			expect(entry.children).toContain("utils.ts");
		}
	});

	it("barrel with summary but no description null-skips at depth 2", () => {
		const summaryOnlyDir = resolve(fixturesDir, "barrel-summary-only");
		// barrel-summary-only/index.ts has @summary but no description
		// At depth 1, barrel gates: shows its summary
		const results1 = drilldown(globSelector("**/*.ts", 1), summaryOnlyDir);
		expect(results1.items).toHaveLength(1);
		const entry1 = results1.items[0];
		expect(isOutputItem(entry1)).toBe(true);
		expect(hasNextId(entry1)).toBe(true);
		if (hasNextId(entry1)) {
			expect(entry1.next_id).toBe(".@2");
			expect(entry1.text).toBe("Summary-only barrel");
			expect(entry1.children).toBeDefined();
			expect(entry1.children).toContain("child.ts");
		}

		// At depth 2, no description → null-skip to transition, children appear
		const results2 = drilldown(globSelector("**/*.ts", 2), summaryOnlyDir);
		const paths2 = results2.items.map((r) => pathFromEntry(r));
		expect(paths2).not.toContain(".");
		expect(paths2).toContain("child.ts");
	});
});
