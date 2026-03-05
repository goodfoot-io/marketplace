/**
 * Shared debug instances and timing utilities for jsdoczoom.
 *
 * Activate with DEBUG=jsdoczoom:* or via the --debug CLI flag.
 * Each namespace maps to a source module. Delta timing (+NNNms) is
 * provided automatically by the debug package between calls on the
 * same namespace.
 *
 * @summary Namespaced debug loggers and perf_hooks timing helper
 */

import { performance } from "node:perf_hooks";
import createDebug from "debug";
import type { Debugger } from "debug";

export const debugDiscovery = createDebug("jsdoczoom:discovery");
export const debugSearch = createDebug("jsdoczoom:search");
export const debugCache = createDebug("jsdoczoom:cache");
export const debugEslint = createDebug("jsdoczoom:eslint");
export const debugLint = createDebug("jsdoczoom:lint");
export const debugValidate = createDebug("jsdoczoom:validate");
export const debugBarrel = createDebug("jsdoczoom:barrel");
export const debugDrilldown = createDebug("jsdoczoom:drilldown");
export const debugTs = createDebug("jsdoczoom:ts");

export { createDebug };

/** Accumulated cache hits since last flushCacheSummary call. */
let _cacheHits = 0;
/** Accumulated cache misses since last flushCacheSummary call. */
let _cacheMisses = 0;

/** Record a cache hit without emitting a log line. */
export function recordCacheHit(): void {
	_cacheHits++;
}

/** Record a cache miss without emitting a log line. */
export function recordCacheMiss(): void {
	_cacheMisses++;
}

/**
 * Emit a single cache summary line and reset the counters.
 * Call this after each batch of processWithCache operations.
 *
 * @param label - Describes the batch (e.g. "search 326 files")
 */
export function flushCacheSummary(label: string): void {
	if (_cacheHits === 0 && _cacheMisses === 0) return;
	debugCache(
		"[SUMMARY] %s hits=%d misses=%d",
		label,
		_cacheHits,
		_cacheMisses,
	);
	_cacheHits = 0;
	_cacheMisses = 0;
}

/**
 * Wrap an async operation with start/done timing logs.
 *
 * @param dbg - Debug instance to log to
 * @param label - Label shown in start/done messages
 * @param fn - Async operation to time
 * @returns Result of fn
 */
export async function time<T>(
	dbg: Debugger,
	label: string,
	fn: () => Promise<T>,
): Promise<T> {
	const t0 = performance.now();
	dbg("%s start", label);
	const result = await fn();
	dbg("%s done %sms", label, (performance.now() - t0).toFixed(1));
	return result;
}
