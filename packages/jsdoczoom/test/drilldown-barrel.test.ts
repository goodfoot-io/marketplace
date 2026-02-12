import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drilldown } from "../src/drilldown.js";
import type { OutputItem, SelectorInfo } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");

function globSelector(pattern: string, depth?: number): SelectorInfo {
	return { type: "glob", pattern, depth };
}

function pathSelector(pattern: string, depth?: number): SelectorInfo {
	return { type: "path", pattern, depth };
}

function isOutputItem(entry: { id: string }): entry is OutputItem {
	return "text" in entry;
}

describe("drilldown with barrels", () => {
	// barrel-basic has:
	//   index.ts with 3 summary levels: ["Barrel overview", "Barrel detail", "Basic barrel module."]
	//   helper.ts with 2 summary levels: ["Helper overview", "Helper utilities."]
	//   utils.ts with 3 summary levels: ["Utils overview", "Utils detail", "Utility functions."]

	it("glob access returns barrel summaries first", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		const results = drilldown(globSelector("**/*.ts", 0), basicDir);

		// At depth 0, barrel has summaries so it gates children.
		// Only the barrel's own L0 summary should appear.
		expect(results).toHaveLength(1);
		const entry = results[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			expect(entry.path).toBe("index.ts");
			expect(entry.text).toBe("Barrel overview");
			expect(entry.more).toBe(true);
		}
	});

	it("glob drill-down reveals children after barrel summaries exhausted", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// barrel-basic/index.ts has 3 summary levels (2 @summary + free-text)
		// At depth 3, barrel transitions. Children appear at depth 3-3=0.
		const results = drilldown(globSelector("**/*.ts", 3), basicDir);

		// Children: helper.ts and utils.ts — each at their L0
		const paths = results.map((r) => r.path);
		expect(paths).toContain("helper.ts");
		expect(paths).toContain("utils.ts");
	});

	it("barrel itself absent from output at transition depth", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// At depth 3 (= barrel's summary count), barrel transitions
		const results = drilldown(globSelector("**/*.ts", 3), basicDir);

		const paths = results.map((r) => r.path);
		expect(paths).not.toContain("index.ts");
	});

	it("children appear at their shallowest summary level", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// barrel has 3 summary levels. At depth 3, children appear at depth 0.
		const results = drilldown(globSelector("**/*.ts", 3), basicDir);

		const helperEntry = results.find((r) => r.path === "helper.ts");
		expect(helperEntry).toBeDefined();
		if (helperEntry && isOutputItem(helperEntry)) {
			expect(helperEntry.id).toBe("helper.ts@0");
			expect(helperEntry.text).toBe("Helper overview");
			expect(helperEntry.more).toBe(true);
		}

		const utilsEntry = results.find((r) => r.path === "utils.ts");
		expect(utilsEntry).toBeDefined();
		if (utilsEntry && isOutputItem(utilsEntry)) {
			expect(utilsEntry.id).toBe("utils.ts@0");
			expect(utilsEntry.text).toBe("Utils overview");
			expect(utilsEntry.more).toBe(true);
		}
	});

	it("direct path access follows leaf rules (no gating)", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// Access the barrel directly via path — should follow normal leaf rules
		const results = drilldown(pathSelector("index.ts", 0), basicDir);

		expect(results).toHaveLength(1);
		const entry = results[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			expect(entry.path).toBe("index.ts");
			expect(entry.id).toBe("index.ts@0");
			expect(entry.text).toBe("Barrel overview");
			expect(entry.more).toBe(true);
		}
	});

	it("barrel with 0 summaries — children appear directly in glob results", () => {
		const zeroSumDir = resolve(fixturesDir, "barrel-zero-summaries");
		// index.ts has no summaries, so it's not a tree node.
		// child.ts should appear directly.
		const results = drilldown(globSelector("**/*.ts", 0), zeroSumDir);

		const paths = results.map((r) => r.path);
		// child.ts should appear as a leaf since the barrel has no summaries
		expect(paths).toContain("child.ts");
		// The barrel itself (index.ts) has no summaries, so it's excluded
		expect(paths).not.toContain("index.ts");
	});

	it("barrel with 1 summary gates for one depth then reveals children", () => {
		const rootDir = resolve(fixturesDir, "barrel-root");
		// barrel-root/index.ts has 2 summary levels: ["Root overview", "Root barrel."]
		// At depth 0, barrel gates: only barrel summary shown
		const results0 = drilldown(globSelector("**/*.ts", 0), rootDir);
		const paths0 = results0.map((r) => r.path);
		expect(paths0).toContain("index.ts");
		expect(paths0).not.toContain("sibling.ts");

		// At depth 2 (= barrel's summary count), barrel transitions: children appear
		const results2 = drilldown(globSelector("**/*.ts", 2), rootDir);
		const paths2 = results2.map((r) => r.path);
		expect(paths2).not.toContain("index.ts");
		expect(paths2).toContain("sibling.ts");
		expect(paths2).toContain("nested/index.ts");
	});

	it("barrel with zero children returns empty array at transition", () => {
		const zeroChildDir = resolve(fixturesDir, "barrel-zero-children");
		// barrel-zero-children/index.ts has 2 summary levels: ["Lonely overview", "Lonely barrel."]
		// At depth 0, the barrel summary is shown
		const results0 = drilldown(globSelector("**/*.ts", 0), zeroChildDir);
		expect(results0).toHaveLength(1);

		// At depth 2 (transition), barrel disappears and there are no children
		// This should throw NO_FILES_MATCHED since no results remain
		expect(() => drilldown(globSelector("**/*.ts", 2), zeroChildDir)).toThrow();
	});

	it("nested barrel child appears as regular item with direct-path id (when revealed)", () => {
		const nestedDir = resolve(fixturesDir, "barrel-nested");
		// barrel-nested/index.ts has 3 summary levels: ["Parent overview", "Parent detail", "Nested barrel parent."]
		// At depth 3, parent barrel transitions. Children: leaf.ts, sub/index.ts
		// sub/index.ts is itself a barrel but appears as a regular item at this level
		const results = drilldown(globSelector("**/*.ts", 3), nestedDir);

		const subBarrel = results.find((r) => r.path === "sub/index.ts");
		expect(subBarrel).toBeDefined();
		if (subBarrel && isOutputItem(subBarrel)) {
			// The sub-barrel at depth 0 shows its own summary
			expect(subBarrel.id).toBe("sub/index.ts@0");
			expect(subBarrel.text).toBe("Sub overview");
		}
	});

	it("children ordered alphabetically", () => {
		const basicDir = resolve(fixturesDir, "barrel-basic");
		// At barrel transition depth, children appear sorted
		const results = drilldown(globSelector("**/*.ts", 3), basicDir);
		const paths = results.map((r) => r.path);
		const sorted = [...paths].sort();
		expect(paths).toEqual(sorted);
	});

	it("root-level barrel gates sibling files and child barrels", () => {
		const rootDir = resolve(fixturesDir, "barrel-root");
		// At depth 0, only barrel summary shown
		const results = drilldown(globSelector("**/*.ts", 0), rootDir);

		// Only the root barrel should appear
		expect(results).toHaveLength(1);
		const entry = results[0];
		expect(isOutputItem(entry)).toBe(true);
		if (isOutputItem(entry)) {
			expect(entry.path).toBe("index.ts");
			expect(entry.text).toBe("Root overview");
		}

		// At transition depth (2), sibling and child barrel appear
		const results2 = drilldown(globSelector("**/*.ts", 2), rootDir);
		const paths2 = results2.map((r) => r.path);
		expect(paths2).toContain("sibling.ts");
		expect(paths2).toContain("nested/index.ts");
		expect(paths2).not.toContain("index.ts");
	});
});
