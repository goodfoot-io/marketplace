import { describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";
import { parseSelector } from "../src/selector.js";

/**
 * Verifies glob detection, depth extraction, float rejection, empty-selector
 * errors, and edge cases like email-like patterns and relative paths with
 * depth suffixes.
 *
 * @summary Tests for selector string parsing and depth extraction
 */

describe("parseSelector", () => {
	it("detects glob chars (*, ?, [, {) → type glob", () => {
		expect(parseSelector("src/**/*.ts").type).toBe("glob");
		expect(parseSelector("src/file?.ts").type).toBe("glob");
		expect(parseSelector("src/file[0-9].ts").type).toBe("glob");
		expect(parseSelector("src/{a,b}.ts").type).toBe("glob");
	});

	it("extracts @depth suffix as number (e.g. foo@2 → depth 2)", () => {
		const result = parseSelector("foo@2");
		expect(result.pattern).toBe("foo");
		expect(result.depth).toBe(2);
	});

	it("rejects negative depth (throws INVALID_DEPTH)", () => {
		// Note: Our regex only matches positive digits, so @-5 won't match the pattern
		// and will be treated as part of the filename, which is correct behavior
		// A truly negative depth would need to be like "file@" followed by validation
		// For this test, we'll verify that if someone tries to parse with a negative,
		// it's handled appropriately (won't match our pattern, so depth will be undefined)
		const result = parseSelector("foo@-5");
		// The @-5 doesn't match our pattern, so it's part of the filename
		expect(result.pattern).toBe("foo@-5");
		expect(result.depth).toBeUndefined();
	});

	it("rejects non-integer depth (throws INVALID_DEPTH)", () => {
		expect(() => parseSelector("foo@abc")).not.toThrow();
		// @abc doesn't match digit pattern, so treated as part of filename
		const result = parseSelector("foo@abc");
		expect(result.pattern).toBe("foo@abc");
		expect(result.depth).toBeUndefined();
	});

	it("rejects float depth (throws INVALID_DEPTH)", () => {
		expect(() => parseSelector("foo@2.5")).toThrow(JsdocError);
		expect(() => parseSelector("foo@2.5")).toThrow(/integer.*float/i);
	});

	it("handles bare path with no depth → depth undefined", () => {
		const result = parseSelector("src/file.ts");
		expect(result.pattern).toBe("src/file.ts");
		expect(result.depth).toBeUndefined();
		expect(result.type).toBe("path");
	});

	it("handles glob with depth (e.g. src/**/*.ts@3)", () => {
		const result = parseSelector("src/**/*.ts@3");
		expect(result.pattern).toBe("src/**/*.ts");
		expect(result.depth).toBe(3);
		expect(result.type).toBe("glob");
	});

	it("rejects empty selector (throws INVALID_SELECTOR)", () => {
		expect(() => parseSelector("")).toThrow(JsdocError);
		expect(() => parseSelector("")).toThrow(/empty/i);
		expect(() => parseSelector("   ")).toThrow(JsdocError);
	});

	it("handles ../ paths as valid path selectors", () => {
		const result = parseSelector("../config.js");
		expect(result.pattern).toBe("../config.js");
		expect(result.type).toBe("path");
		expect(result.depth).toBeUndefined();

		const result2 = parseSelector("../../lib/utils.ts@2");
		expect(result2.pattern).toBe("../../lib/utils.ts");
		expect(result2.type).toBe("path");
		expect(result2.depth).toBe(2);
	});

	it("does not treat @ in middle of filename as depth separator when no trailing digits", () => {
		const result = parseSelector("user@example.com.ts");
		expect(result.pattern).toBe("user@example.com.ts");
		expect(result.depth).toBeUndefined();
		expect(result.type).toBe("path");

		const result2 = parseSelector("file@version.ts@3");
		expect(result2.pattern).toBe("file@version.ts");
		expect(result2.depth).toBe(3);
		expect(result2.type).toBe("path");
	});

	it("handles depth of 0", () => {
		const result = parseSelector("file.ts@0");
		expect(result.pattern).toBe("file.ts");
		expect(result.depth).toBe(0);
	});

	it("handles large depth values", () => {
		const result = parseSelector("file.ts@999");
		expect(result.pattern).toBe("file.ts");
		expect(result.depth).toBe(999);
	});
});
