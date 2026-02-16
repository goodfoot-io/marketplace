/**
 * Tests for the content-hash-based disk cache module. Verifies content hashing,
 * cache read/write operations, directory creation, graceful error handling,
 * concurrency safety, and mode namespacing using temporary test directories.
 *
 * @summary Unit and integration tests for cache operations
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	computeContentHash,
	ensureCacheDir,
	processWithCache,
	readCacheEntry,
	writeCacheEntry,
} from "../src/cache.js";
import type { CacheConfig, CacheOperationMode } from "../src/types.js";

/**
 * Create a temporary directory, run a callback with it, then clean up.
 *
 * @param fn - Callback receiving the temp directory path
 * @returns Promise that resolves when the callback and cleanup are done
 */
function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jsdoczoom-cache-"));
	return fn(tmpDir).finally(() => fs.rmSync(tmpDir, { recursive: true }));
}

describe("computeContentHash", () => {
	it("returns consistent SHA-256 hex for same input", () => {
		const content = "hello world";
		const hash1 = computeContentHash(content);
		const hash2 = computeContentHash(content);

		expect(hash1).toBe(hash2);
		expect(hash1).toMatch(/^[a-f0-9]{64}$/);
	});

	it("returns different hashes for different input", () => {
		const hash1 = computeContentHash("content A");
		const hash2 = computeContentHash("content B");

		expect(hash1).not.toBe(hash2);
	});
});

describe("readCacheEntry", () => {
	it("returns null for cache miss (file not found)", async () => {
		await withTempDir(async (dir) => {
			const config: CacheConfig = { enabled: true, directory: dir };
			const result = await readCacheEntry(config, "drilldown", "nonexistent");

			expect(result).toBeNull();
		});
	});

	it("returns null for corrupted/unparseable cache file (invalid JSON)", async () => {
		await withTempDir(async (dir) => {
			const config: CacheConfig = { enabled: true, directory: dir };
			const mode: CacheOperationMode = "drilldown";
			const hash = "corrupted";

			// Create directory and write invalid JSON
			await ensureCacheDir(config, mode);
			const filePath = path.join(dir, mode, `${hash}.json`);
			fs.writeFileSync(filePath, "{ invalid json }", "utf-8");

			const result = await readCacheEntry(config, mode, hash);
			expect(result).toBeNull();
		});
	});
});

describe("writeCacheEntry and readCacheEntry", () => {
	it("returns stored data after writing", async () => {
		await withTempDir(async (dir) => {
			const config: CacheConfig = { enabled: true, directory: dir };
			const mode: CacheOperationMode = "lint";
			const hash = "test-hash";
			const data = { foo: "bar", count: 42 };

			await ensureCacheDir(config, mode);
			await writeCacheEntry(config, mode, hash, data);
			const retrieved = await readCacheEntry<typeof data>(config, mode, hash);

			expect(retrieved).toEqual(data);
		});
	});
});

describe("processWithCache", () => {
	it("calls compute on cache miss", async () => {
		await withTempDir(async (dir) => {
			const config: CacheConfig = { enabled: true, directory: dir };
			const compute = vi.fn(() => ({ result: "computed" }));

			const result = await processWithCache(
				config,
				"validate",
				"file content",
				compute,
			);

			expect(compute).toHaveBeenCalledTimes(1);
			expect(result).toEqual({ result: "computed" });
		});
	});

	it("returns cached data on cache hit without calling compute", async () => {
		await withTempDir(async (dir) => {
			const config: CacheConfig = { enabled: true, directory: dir };
			const content = "cached file content";
			const expectedData = { result: "cached" };

			// First call populates cache
			await processWithCache(config, "drilldown", content, () => expectedData);

			// Second call should hit cache
			const compute = vi.fn(() => ({ result: "should not be called" }));
			const result = await processWithCache(
				config,
				"drilldown",
				content,
				compute,
			);

			expect(compute).not.toHaveBeenCalled();
			expect(result).toEqual(expectedData);
		});
	});

	it("works when cache is disabled (always calls compute)", async () => {
		await withTempDir(async (dir) => {
			const config: CacheConfig = { enabled: false, directory: dir };
			const compute = vi.fn(() => ({ result: "computed" }));

			const result1 = await processWithCache(
				config,
				"lint",
				"content",
				compute,
			);
			const result2 = await processWithCache(
				config,
				"lint",
				"content",
				compute,
			);

			expect(compute).toHaveBeenCalledTimes(2);
			expect(result1).toEqual({ result: "computed" });
			expect(result2).toEqual({ result: "computed" });
		});
	});

	it("degrades gracefully when cache directory is unwritable (calls compute, does not throw)", async () => {
		// Use a path that doesn't exist and can't be created
		const config: CacheConfig = {
			enabled: true,
			directory: "/nonexistent/readonly/path",
		};
		const compute = vi.fn(() => ({ result: "computed" }));

		const result = await processWithCache(
			config,
			"drilldown",
			"content",
			compute,
		);

		expect(compute).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ result: "computed" });
	});
});

describe("ensureCacheDir", () => {
	it("creates nested directory structure", async () => {
		await withTempDir(async (dir) => {
			const config: CacheConfig = { enabled: true, directory: dir };
			const mode: CacheOperationMode = "validate";

			await ensureCacheDir(config, mode);

			const expectedPath = path.join(dir, mode);
			expect(fs.existsSync(expectedPath)).toBe(true);
			expect(fs.statSync(expectedPath).isDirectory()).toBe(true);
		});
	});
});

describe("concurrent writes", () => {
	it("concurrent writes to same key don't corrupt", async () => {
		await withTempDir(async (dir) => {
			const config: CacheConfig = { enabled: true, directory: dir };
			const mode: CacheOperationMode = "drilldown";
			const hash = "concurrent-key";

			await ensureCacheDir(config, mode);

			// Launch multiple concurrent writes
			const writes = Array.from({ length: 10 }, (_, i) =>
				writeCacheEntry(config, mode, hash, { value: i }),
			);

			await Promise.all(writes);

			// Read back - should be valid JSON (one of the written values)
			const retrieved = await readCacheEntry<{ value: number }>(
				config,
				mode,
				hash,
			);

			expect(retrieved).not.toBeNull();
			expect(typeof retrieved?.value).toBe("number");
			expect(retrieved?.value).toBeGreaterThanOrEqual(0);
			expect(retrieved?.value).toBeLessThan(10);
		});
	});
});

describe("cache mode namespacing", () => {
	it("cache entries are namespaced by mode", async () => {
		await withTempDir(async (dir) => {
			const config: CacheConfig = { enabled: true, directory: dir };
			const content = "shared content";
			const drilldownData = { mode: "drilldown", value: 1 };
			const validateData = { mode: "validate", value: 2 };
			const lintData = { mode: "lint", value: 3 };

			// Store same content in different modes
			await processWithCache(config, "drilldown", content, () => drilldownData);
			await processWithCache(config, "validate", content, () => validateData);
			await processWithCache(config, "lint", content, () => lintData);

			// Verify each mode returns its own cached data
			const drilldownResult = await processWithCache(
				config,
				"drilldown",
				content,
				() => {
					throw new Error("Should not compute");
				},
			);
			const validateResult = await processWithCache(
				config,
				"validate",
				content,
				() => {
					throw new Error("Should not compute");
				},
			);
			const lintResult = await processWithCache(config, "lint", content, () => {
				throw new Error("Should not compute");
			});

			expect(drilldownResult).toEqual(drilldownData);
			expect(validateResult).toEqual(validateData);
			expect(lintResult).toEqual(lintData);
		});
	});
});
