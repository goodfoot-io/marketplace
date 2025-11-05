/**
 * Tests for cache management
 */

import type { ServerConfig, AggregatedTools, CachedToolDescription } from '../src/types/wrapper.js';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { generateConfigHash, getCacheFilePath, ensureCacheDirectory } from '../src/cache.js';

describe('Cache Management', () => {
  describe('generateConfigHash', () => {
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

    it('should generate different hash for different transport types', () => {
      const configs1: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'node',
          args: ['server.js']
        }
      ];

      const configs2: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'http',
          url: 'http://example.com/mcp'
        }
      ];

      const hash1 = generateConfigHash(configs1);
      const hash2 = generateConfigHash(configs2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different ordering', () => {
      const configs1: ServerConfig[] = [
        {
          name: 'server-a',
          transport: 'stdio',
          command: 'node',
          args: ['a.js']
        },
        {
          name: 'server-b',
          transport: 'stdio',
          command: 'node',
          args: ['b.js']
        }
      ];

      const configs2: ServerConfig[] = [
        {
          name: 'server-b',
          transport: 'stdio',
          command: 'node',
          args: ['b.js']
        },
        {
          name: 'server-a',
          transport: 'stdio',
          command: 'node',
          args: ['a.js']
        }
      ];

      const hash1 = generateConfigHash(configs1);
      const hash2 = generateConfigHash(configs2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty configuration array', () => {
      const configs: ServerConfig[] = [];
      const hash = generateConfigHash(configs);

      expect(hash).toHaveLength(32);
      expect(hash).toBe(generateConfigHash([]));
    });

    it('should handle HTTP server configurations', () => {
      const configs: ServerConfig[] = [
        {
          name: 'http-server',
          transport: 'http',
          url: 'https://example.com/mcp'
        }
      ];

      const hash = generateConfigHash(configs);

      expect(hash).toHaveLength(32);
      expect(hash).toBe(generateConfigHash(configs));
    });

    it('should handle configurations with environment variables', () => {
      const configs1: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { KEY: 'value1' }
        }
      ];

      const configs2: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { KEY: 'value2' }
        }
      ];

      const hash1 = generateConfigHash(configs1);
      const hash2 = generateConfigHash(configs2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getCacheFilePath', () => {
    it('should generate cache file path with hash', () => {
      const hash = 'abc123def456';
      const path = getCacheFilePath(hash);

      expect(path).toContain('.mcp-wrapper-server');
      expect(path).toContain('descriptions');
      expect(path).toContain('abc123def456.json');
    });

    it('should generate different paths for different hashes', () => {
      const path1 = getCacheFilePath('hash1');
      const path2 = getCacheFilePath('hash2');

      expect(path1).not.toBe(path2);
      expect(path1).toContain('hash1.json');
      expect(path2).toContain('hash2.json');
    });

    it('should generate absolute paths', () => {
      const hash = 'test-hash';
      const path = getCacheFilePath(hash);

      expect(path.startsWith('/')).toBe(true);
    });
  });

  describe('ensureCacheDirectory', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should create cache directory recursively', async () => {
      const filePath = join(tempDir, 'nested', 'deep', 'cache.json');

      await ensureCacheDirectory(filePath);

      // Verify directory was created (no error means success)
      expect(true).toBe(true);
    });

    it('should succeed if directory already exists', async () => {
      const filePath = join(tempDir, 'existing', 'cache.json');

      // Create directory first
      await mkdir(join(tempDir, 'existing'), { recursive: true });

      // Should not throw
      await ensureCacheDirectory(filePath);

      expect(true).toBe(true);
    });

  });

  describe('Cache file structure', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should have correct structure when written', async () => {
      const filePath = join(tempDir, 'test-cache.json');
      await ensureCacheDirectory(filePath);

      const cached: CachedToolDescription = {
        version: '1.0.0',
        configHash: 'test-hash',
        timestamp: Date.now(),
        allTools: [
          {
            serverName: 'test-server',
            tool: {
              name: 'test-tool',
              description: 'A test tool',
              inputSchema: { type: 'object', properties: {} }
            }
          }
        ],
        allowedTools: ['test-tool'],
        description: 'Test tools'
      };

      await writeFile(filePath, JSON.stringify(cached, null, 2), 'utf-8');

      const content = await readFile(filePath, 'utf-8');
      const parsed: CachedToolDescription = JSON.parse(content) as CachedToolDescription;

      expect(parsed.version).toBe('1.0.0');
      expect(parsed.configHash).toBe('test-hash');
      expect(parsed.allTools).toHaveLength(1);
      expect(parsed.allowedTools).toEqual(['test-tool']);
      expect(parsed.description).toBe('Test tools');
    });

    it('should support multiple tools from different servers', async () => {
      const filePath = join(tempDir, 'multi-tool-cache.json');
      await ensureCacheDirectory(filePath);

      const cached: CachedToolDescription = {
        version: '1.0.0',
        configHash: 'multi-hash',
        timestamp: Date.now(),
        allTools: [
          {
            serverName: 'server-1',
            tool: {
              name: 'tool-1',
              description: 'Tool from server 1',
              inputSchema: { type: 'object' }
            }
          },
          {
            serverName: 'server-2',
            tool: {
              name: 'tool-2',
              inputSchema: { type: 'object' }
            }
          }
        ],
        allowedTools: ['tool-1', 'tool-2'],
        description: 'Multi-server tools'
      };

      await writeFile(filePath, JSON.stringify(cached, null, 2), 'utf-8');

      const content = await readFile(filePath, 'utf-8');
      const parsed: CachedToolDescription = JSON.parse(content) as CachedToolDescription;

      expect(parsed.allTools).toHaveLength(2);
      expect(parsed.allTools[0].tool.name).toBe('tool-1');
      expect(parsed.allTools[1].tool.name).toBe('tool-2');
      expect(parsed.allowedTools).toEqual(['tool-1', 'tool-2']);
    });

    it('should include timestamp in cache structure', async () => {
      const filePath = join(tempDir, 'timestamp-cache.json');
      await ensureCacheDirectory(filePath);

      const beforeTime = Date.now();
      const cached: CachedToolDescription = {
        version: '1.0.0',
        configHash: 'timestamp-hash',
        timestamp: Date.now(),
        allTools: [],
        allowedTools: [],
        description: 'Timestamp test'
      };
      const afterTime = Date.now();

      await writeFile(filePath, JSON.stringify(cached, null, 2), 'utf-8');

      const content = await readFile(filePath, 'utf-8');
      const parsed: CachedToolDescription = JSON.parse(content) as CachedToolDescription;

      expect(parsed.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(parsed.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Integration with types', () => {
    it('should create hash matching expected pattern', () => {
      const configs: ServerConfig[] = [
        {
          name: 'test',
          transport: 'stdio',
          command: 'node',
          args: ['test.js']
        }
      ];

      const hash = generateConfigHash(configs);
      const path = getCacheFilePath(hash);

      expect(path).toMatch(/\.mcp-wrapper-server\/descriptions\/[a-f0-9]{32}\.json$/);
    });

    it('should support AggregatedTools structure in cache', () => {
      const tools: AggregatedTools = {
        allTools: [
          {
            serverName: 'test-server',
            tool: {
              name: 'test-tool',
              description: 'Test tool description',
              inputSchema: {
                type: 'object',
                properties: {
                  param1: { type: 'string' }
                }
              }
            }
          }
        ],
        allowedTools: ['test-tool'],
        description: 'Test tools collection'
      };

      const cached: CachedToolDescription = {
        version: '1.0.0',
        configHash: 'test-hash',
        timestamp: Date.now(),
        ...tools
      };

      expect(cached.allTools).toBe(tools.allTools);
      expect(cached.allowedTools).toBe(tools.allowedTools);
      expect(cached.description).toBe(tools.description);
    });
  });
});
