/**
 * Tests for cache management
 */

import type { ServerConfig } from '../src/types/wrapper.js';
import { describe, it, expect } from '@jest/globals';
import { generateConfigHash, getCacheFilePath } from '../src/cache.js';

describe('Cache Management', () => {
  it('should generate consistent hash for same configuration', () => {
    const configs: ServerConfig[] = [
      {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      }
    ];

    const hash1 = generateConfigHash(configs);
    const hash2 = generateConfigHash(configs);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(32); // MD5 hash length
  });

  it('should generate different hash for different configuration', () => {
    const configs1: ServerConfig[] = [
      {
        name: 'test-server-1',
        transport: 'stdio',
        command: 'node',
        args: ['server1.js']
      }
    ];

    const configs2: ServerConfig[] = [
      {
        name: 'test-server-2',
        transport: 'stdio',
        command: 'node',
        args: ['server2.js']
      }
    ];

    const hash1 = generateConfigHash(configs1);
    const hash2 = generateConfigHash(configs2);

    expect(hash1).not.toBe(hash2);
  });

  it('should generate cache file path with hash', () => {
    const hash = 'abc123def456';
    const path = getCacheFilePath(hash);

    expect(path).toContain('.mcp-wrapper-server');
    expect(path).toContain('descriptions');
    expect(path).toContain('abc123def456.json');
  });
});
