/**
 * Content-hash-based disk caching layer for expensive operations (TypeScript
 * compilation, ESLint linting, JSDoc parsing). Uses SHA-256 hashing to cache
 * results keyed by file content, enabling near-instantaneous repeated runs
 * when files haven't changed. All cache errors degrade gracefully without
 * propagating to callers.
 *
 * @summary Content-hash-based disk cache with graceful error handling
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { debugCache, recordCacheHit, recordCacheMiss } from "./debug.js";
import type { CacheConfig, CacheOperationMode } from "./types.js";

/**
 * Compute a SHA-256 content hash for the given string.
 *
 * @param content - The content to hash
 * @returns Hex-encoded SHA-256 digest
 */
export function computeContentHash(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

/**
 * Ensure the cache directory exists for the given operation mode.
 * Silently swallows all errors (mkdir failures are handled by read/write ops).
 *
 * @param config - Cache configuration
 * @param mode - Operation mode (drilldown, validate, or lint)
 */
export async function ensureCacheDir(
	config: CacheConfig,
	mode: CacheOperationMode,
): Promise<void> {
	try {
		await mkdir(join(config.directory, mode), { recursive: true });
	} catch {
		// Silently swallow - subsequent reads will miss, writes will fail silently
	}
}

/**
 * Read a cached entry from disk. Returns null on any error (cache miss, ENOENT,
 * corrupted JSON, permission denied, etc.). Never throws.
 *
 * @param config - Cache configuration
 * @param mode - Operation mode namespace
 * @param hash - Content hash key
 * @returns Parsed cached data or null on any error
 */
export async function readCacheEntry<T>(
	config: CacheConfig,
	mode: CacheOperationMode,
	hash: string,
): Promise<T | null> {
	try {
		const filePath = join(config.directory, mode, `${hash}.json`);
		const content = await readFile(filePath, "utf-8");
		return JSON.parse(content) as T;
	} catch {
		return null;
	}
}

/**
 * Write a cache entry to disk using atomic write (write to .tmp then rename).
 * Silently swallows all errors (permission denied, disk full, etc.). Never throws.
 *
 * @param config - Cache configuration
 * @param mode - Operation mode namespace
 * @param hash - Content hash key
 * @param data - Data to cache (must be JSON-serializable)
 */
export async function writeCacheEntry<T>(
	config: CacheConfig,
	mode: CacheOperationMode,
	hash: string,
	data: T,
): Promise<void> {
	try {
		const filePath = join(config.directory, mode, `${hash}.json`);
		const tmpPath = `${filePath}.tmp`;
		await writeFile(tmpPath, JSON.stringify(data), "utf-8");
		await rename(tmpPath, filePath);
	} catch {
		// Silently swallow - cache write failures should never affect correctness
	}
}

/**
 * Execute a computation with caching. If cache is enabled and entry exists,
 * returns cached result. Otherwise, computes result, stores it (fire-and-forget),
 * and returns it. Degrades gracefully on all cache errors by always computing.
 *
 * @param config - Cache configuration
 * @param mode - Operation mode namespace
 * @param content - File content to hash for cache key
 * @param compute - Function to compute the result on cache miss
 * @returns Cached or computed result
 */
export async function processWithCache<T>(
	config: CacheConfig,
	mode: CacheOperationMode,
	content: string,
	compute: () => T | Promise<T>,
): Promise<T> {
	if (!config.enabled) {
		return await compute();
	}

	const hash = computeContentHash(content);
	await ensureCacheDir(config, mode);

	const cached = await readCacheEntry<T>(config, mode, hash);
	if (cached !== null) {
		recordCacheHit();
		return cached;
	}

	recordCacheMiss();
	debugCache("[MISS] mode=%s hash=%s", mode, hash.slice(0, 8));
	const result = await compute();
	await writeCacheEntry(config, mode, hash, result);
	return result;
}
