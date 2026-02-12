import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";
import { discoverFiles } from "../src/file-discovery.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");
const leafFilesDir = resolve(fixturesDir, "leaf-files");

describe("discoverFiles", () => {
	it("glob matches .ts and .tsx files", () => {
		const results = discoverFiles("**/*.ts", leafFilesDir);
		expect(results.length).toBeGreaterThan(0);
		for (const f of results) {
			expect(f).toMatch(/\.ts$/);
		}
	});

	it("glob excludes .d.ts files", () => {
		// Create a temp directory with .ts, .tsx, and .d.ts files
		const tmpDir = mkdtempSync(resolve(tmpdir(), "jsdoczoom-test-"));
		try {
			writeFileSync(resolve(tmpDir, "real.ts"), "export const a = 1;");
			writeFileSync(resolve(tmpDir, "component.tsx"), "export const b = 2;");
			writeFileSync(resolve(tmpDir, "real.d.ts"), "declare const a: number;");

			const results = discoverFiles("**/*.ts", tmpDir);
			expect(results).toHaveLength(1);
			expect(results[0]).toMatch(/real\.ts$/);
			expect(results[0]).not.toMatch(/\.d\.ts$/);

			// Also check .tsx is matched with its own pattern
			const tsxResults = discoverFiles("**/*.tsx", tmpDir);
			expect(tsxResults).toHaveLength(1);
			expect(tsxResults[0]).toMatch(/component\.tsx$/);
		} finally {
			rmSync(tmpDir, { recursive: true });
		}
	});

	it("glob returns empty array when no matches", () => {
		const results = discoverFiles("nonexistent/**/*.ts", leafFilesDir);
		expect(results).toEqual([]);
	});

	it("path resolves to single-element array", () => {
		const filePath = "one-summary.ts";
		const results = discoverFiles(filePath, leafFilesDir);
		expect(results).toHaveLength(1);
		expect(results[0]).toBe(resolve(leafFilesDir, filePath));
	});

	it("path throws FILE_NOT_FOUND for missing file", () => {
		expect(() => discoverFiles("does-not-exist.ts", leafFilesDir)).toThrow(
			JsdocError,
		);
		try {
			discoverFiles("does-not-exist.ts", leafFilesDir);
		} catch (error) {
			expect(error).toBeInstanceOf(JsdocError);
			expect((error as JsdocError).code).toBe("FILE_NOT_FOUND");
		}
	});
});
