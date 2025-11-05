/**
 * Cache management for tool descriptions
 */

import type { ServerConfig } from './types/wrapper.js';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Generate MD5 hash from server configurations
 */
export function generateConfigHash(configs: ServerConfig[]): string {
  const json = JSON.stringify(configs, null, 0);
  return createHash('md5').update(json).digest('hex');
}

/**
 * Get cache file path for given configuration hash
 */
export function getCacheFilePath(hash: string): string {
  return join(homedir(), '.mcp-wrapper-server', 'descriptions', `${hash}.json`);
}
