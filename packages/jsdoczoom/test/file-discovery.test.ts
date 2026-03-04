import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JsdocError } from "../src/errors.js";
import { discoverFiles } from "../src/file-discovery.js";

/**
 * Verifies glob matching, .d.ts exclusion, single-path resolution, and
 * FILE_NOT_FOUND error behavior for the file discovery module.
 *
 * @summary Tests for file discovery via glob patterns and direct paths
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");
const leafFilesDir = resolve(fixturesDir, "leaf-files");

describe("discoverFiles", () => {
	it("glob matches .ts and .tsx files", async () => {
		const results = await discoverFiles("**/*.ts", leafFilesDir);
		expect(results.length).toBeGreaterThan(0);
		for (const f of results) {
			expect(f).toMatch(/\.ts$/);
		}
	});

	it("glob excludes .d.ts files", async () => {
		// Create a temp directory with .ts, .tsx, and .d.ts files
		const tmpDir = await mkdtemp(resolve(tmpdir(), "jsdoczoom-test-"));
		try {
			await writeFile(resolve(tmpDir, "real.ts"), "export const a = 1;");
			await writeFile(resolve(tmpDir, "component.tsx"), "export const b = 2;");
			await writeFile(resolve(tmpDir, "real.d.ts"), "declare const a: number;");

			const results = await discoverFiles("**/*.ts", tmpDir);
			expect(results).toHaveLength(1);
			expect(results[0]).toMatch(/real\.ts$/);
			expect(results[0]).not.toMatch(/\.d\.ts$/);

			// Also check .tsx is matched with its own pattern
			const tsxResults = await discoverFiles("**/*.tsx", tmpDir);
			expect(tsxResults).toHaveLength(1);
			expect(tsxResults[0]).toMatch(/component\.tsx$/);
		} finally {
			await rm(tmpDir, { recursive: true });
		}
	});

	it("glob returns empty array when no matches", async () => {
		const results = await discoverFiles("nonexistent/**/*.ts", leafFilesDir);
		expect(results).toEqual([]);
	});

	it("path resolves to single-element array", async () => {
		const filePath = "one-summary.ts";
		const results = await discoverFiles(filePath, leafFilesDir);
		expect(results).toHaveLength(1);
		expect(results[0]).toBe(resolve(leafFilesDir, filePath));
	});

	it("directory path returns discovered .ts/.tsx files within it", async () => {
		const [dirResults, globResults] = await Promise.all([
			discoverFiles(leafFilesDir, "/"),
			discoverFiles(`${leafFilesDir}/**`, "/"),
		]);
		expect(dirResults.length).toBeGreaterThan(0);
		expect(dirResults).toEqual(globResults);
	});

	it("path throws FILE_NOT_FOUND for missing file", async () => {
		await expect(
			discoverFiles("does-not-exist.ts", leafFilesDir),
		).rejects.toThrow(JsdocError);
		try {
			await discoverFiles("does-not-exist.ts", leafFilesDir);
		} catch (error) {
			expect(error).toBeInstanceOf(JsdocError);
			expect((error as JsdocError).code).toBe("FILE_NOT_FOUND");
		}
	});
});
