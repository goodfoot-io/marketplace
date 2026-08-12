/**
 * Cache management for tool descriptions
 */

import type { ServerConfig, CachedToolDescription, AggregatedTools } from './types/wrapper.js';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { debug, info, warn } from './logger.js';
import { validateCachedToolDescription } from './types/wrapper.js';

/**
 * Cache format version
 */
const CACHE_VERSION = '1.0.0';

/**
 * Generate MD5 hash from server configurations
 */
export function generateConfigHash(configs: ServerConfig[]): string {
  const json = JSON.stringify(configs, null, 0);
  return createHash('md5').update(json).digest('hex');
}

/**
 * Get cache file path for given configuration hash
 *
 * The cache root defaults to the user's home directory, but can be overridden
 * with `MCP_WRAPPER_CACHE_DIR` — e.g. to isolate per-run state in tests or
 * containers that share a home directory across concurrent processes.
 */
export function getCacheFilePath(hash: string): string {
  const cacheRoot = process.env.MCP_WRAPPER_CACHE_DIR ?? homedir();
  return join(cacheRoot, '.mcp-wrapper-server', 'descriptions', `${hash}.json`);
}

/**
 * Ensure cache directory exists, creating it if necessary
 */
export async function ensureCacheDirectory(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  try {
    await mkdir(dir, { recursive: true });
    debug(`Cache directory ensured: ${dir}`);
  } catch (error) {
    warn(`Failed to create cache directory: ${dir}`, error);
    throw new Error(`Failed to create cache directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Write aggregated tools to cache file
 */
export async function writeCacheFile(hash: string, tools: AggregatedTools): Promise<void> {
  const filePath = getCacheFilePath(hash);

  try {
    await ensureCacheDirectory(filePath);

    const cached: CachedToolDescription = {
      version: CACHE_VERSION,
      configHash: hash,
      timestamp: Date.now(),
      allTools: tools.allTools,
      allowedTools: tools.allowedTools,
      description: tools.description
    };

    const json = JSON.stringify(cached, null, 2);
    await writeFile(filePath, json, 'utf-8');

    info(`Cache written successfully: ${filePath}`);
  } catch (error) {
    warn(`Failed to write cache file: ${filePath}`, error);
    throw new Error(`Failed to write cache file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Read and validate cache file
 */
export async function readCacheFile(hash: string): Promise<AggregatedTools | null> {
  const filePath = getCacheFilePath(hash);

  try {
    // Check if file exists
    await access(filePath, constants.R_OK);

    // Read file contents
    const contents = await readFile(filePath, 'utf-8');

    // Parse JSON
    const data: unknown = JSON.parse(contents);

    // Validate structure
    const cached = validateCachedToolDescription(data);

    // Verify hash matches
    if (cached.configHash !== hash) {
      warn(`Cache hash mismatch: expected ${hash}, got ${cached.configHash}`);
      return null;
    }

    info(`Cache hit: ${filePath}`);

    return {
      allTools: cached.allTools,
      allowedTools: cached.allowedTools,
      description: cached.description
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      debug(`Cache miss: ${filePath}`);
      return null;
    }

    warn(`Failed to read cache file: ${filePath}`, error);
    return null;
  }
}

/**
 * Check if cache file exists and is valid
 */
export async function isCacheValid(hash: string): Promise<boolean> {
  try {
    const cached = await readCacheFile(hash);
    return cached !== null;
  } catch {
    return false;
  }
}
