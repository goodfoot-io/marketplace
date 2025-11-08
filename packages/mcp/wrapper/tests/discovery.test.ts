/**
 * Tool discovery tests
 */

import type { ServerConfig } from '../src/types/wrapper.js';
import { rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readCacheFile, writeCacheFile, generateConfigHash } from '../src/cache.js';
import { discoverTools } from '../src/discovery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, 'fixtures');

describe('discoverTools', () => {
  let originalEnv: string | undefined;
  let originalIgnoreCacheEnv: string | undefined;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env.MCP_WRAPPER_SERVER_LOGGING;
    originalIgnoreCacheEnv = process.env.MCP_WRAPPER_IGNORE_CACHE;
    process.env.MCP_WRAPPER_SERVER_LOGGING = 'false';
  });

  afterEach(async () => {
    // Restore env
    if (originalEnv === undefined) {
      delete process.env.MCP_WRAPPER_SERVER_LOGGING;
    } else {
      process.env.MCP_WRAPPER_SERVER_LOGGING = originalEnv;
    }

    if (originalIgnoreCacheEnv === undefined) {
      delete process.env.MCP_WRAPPER_IGNORE_CACHE;
    } else {
      process.env.MCP_WRAPPER_IGNORE_CACHE = originalIgnoreCacheEnv;
    }

    // Clean up cache directory to prevent test pollution
    try {
      await rm('/home/node/.mcp-wrapper-server/descriptions', { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('cache behavior', () => {
    it('should return empty tools for empty configuration', async () => {
      const configs: ServerConfig[] = [];
      const result = await discoverTools(configs);

      expect(result).toEqual({
        allTools: [],
        allowedTools: [],
        description: 'Multi-tool agent (no tools discovered yet)'
      });
    });

    it('should use cached tools when cache exists', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'echo',
          args: ['hello']
        }
      ];

      // Create a cache file with known content
      const hash = generateConfigHash(configs);
      await writeCacheFile(hash, {
        allTools: [
          {
            serverName: 'test-server',
            tool: {
              name: 'test_tool',
              description: 'A test tool',
              inputSchema: { type: 'object', properties: {} }
            }
          }
        ],
        allowedTools: ['test_tool'],
        description: 'Test tool agent'
      });

      // Discovery should use cache
      const result = await discoverTools(configs);

      expect(result.allTools).toHaveLength(1);
      expect(result.allowedTools).toEqual(['test_tool']);
      expect(result.description).toBe('Test tool agent');
    });

    it('should perform discovery when cache does not exist', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'echo-server',
          transport: 'stdio',
          command: 'node',
          args: ['-e', 'process.exit(0)'] // Simple command that exits immediately
        }
      ];

      const result = await discoverTools(configs);

      // Should return a result (even if tools are empty due to quick exit)
      expect(result).toHaveProperty('allTools');
      expect(result).toHaveProperty('allowedTools');
      expect(result).toHaveProperty('description');
    });
  });

  describe('stdio transport', () => {
    it('should discover tools from stdio server', async () => {
      const scriptPath = join(fixturesDir, 'test-server.mjs');

      const configs: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'node',
          args: [scriptPath],
          env: {
            NODE_PATH: join(__dirname, '..', 'node_modules')
          }
        }
      ];

      const result = await discoverTools(configs);

      expect(result.allTools).toHaveLength(1);
      expect(result.allTools[0].serverName).toBe('test-server');
      expect(result.allTools[0].tool.name).toBe('test_tool');
      expect(result.allowedTools).toContain('test_tool');
      // AI-generated description should be non-empty and meaningful
      expect(result.description).toBeTruthy();
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
    });

    it('should handle stdio server that times out', async () => {
      const scriptPath = join(fixturesDir, 'hanging-server.mjs');

      const configs: ServerConfig[] = [
        {
          name: 'hanging-server',
          transport: 'stdio',
          command: 'node',
          args: [scriptPath],
          env: {
            NODE_PATH: join(__dirname, '..', 'node_modules')
          }
        }
      ];

      const result = await discoverTools(configs);

      // Should return empty result, not throw
      expect(result.allTools).toHaveLength(0);
      expect(result.allowedTools).toHaveLength(0);
    }, 15000); // 15 second timeout for this test (discovery timeout is 10s)

    it('should handle stdio server that errors during discovery', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'error-server',
          transport: 'stdio',
          command: 'node',
          args: ['-e', 'throw new Error("Discovery failed")']
        }
      ];

      const result = await discoverTools(configs);

      // Should return empty result, not throw
      expect(result.allTools).toHaveLength(0);
      expect(result.allowedTools).toHaveLength(0);
    });
  });

  describe('multiple servers', () => {
    it('should discover tools from multiple servers', async () => {
      const script1Path = join(fixturesDir, 'server1.mjs');
      const script2Path = join(fixturesDir, 'server2.mjs');

      const configs: ServerConfig[] = [
        {
          name: 'server1',
          transport: 'stdio',
          command: 'node',
          args: [script1Path],
          env: {
            NODE_PATH: join(__dirname, '..', 'node_modules')
          }
        },
        {
          name: 'server2',
          transport: 'stdio',
          command: 'node',
          args: [script2Path],
          env: {
            NODE_PATH: join(__dirname, '..', 'node_modules')
          }
        }
      ];

      const result = await discoverTools(configs);

      expect(result.allTools).toHaveLength(2);
      expect(result.allowedTools).toHaveLength(2);
      expect(result.allowedTools).toContain('tool1');
      expect(result.allowedTools).toContain('tool2');
    });

    it('should continue discovery if one server fails', async () => {
      const workingPath = join(fixturesDir, 'working-server.mjs');

      const configs: ServerConfig[] = [
        {
          name: 'failing-server',
          transport: 'stdio',
          command: 'node',
          args: ['-e', 'process.exit(1)']
        },
        {
          name: 'working-server',
          transport: 'stdio',
          command: 'node',
          args: [workingPath],
          env: {
            NODE_PATH: join(__dirname, '..', 'node_modules')
          }
        }
      ];

      const result = await discoverTools(configs);

      // Should have tools from working server only
      expect(result.allTools).toHaveLength(1);
      expect(result.allTools[0].serverName).toBe('working-server');
      expect(result.allowedTools).toContain('working_tool');
    });
  });

  describe('description generation', () => {
    it('should generate AI-powered description from discovered tools', async () => {
      const scriptPath = join(fixturesDir, 'multi-tool-server.mjs');

      const configs: ServerConfig[] = [
        {
          name: 'multi-tool-server',
          transport: 'stdio',
          command: 'node',
          args: [scriptPath],
          env: {
            NODE_PATH: join(__dirname, '..', 'node_modules')
          }
        }
      ];

      const result = await discoverTools(configs);

      // AI-generated descriptions will vary but should be non-empty and meaningful
      expect(result.description).toBeTruthy();
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
      // Should contain some indication of task management capabilities
      expect(result.description.toLowerCase()).toMatch(/task|manage|create|list/);
    });

    it('should handle default description when no tools found', async () => {
      const configs: ServerConfig[] = [];

      const result = await discoverTools(configs);

      expect(result.description).toBe('Multi-tool agent (no tools discovered yet)');
    });
  });

  describe('cache persistence', () => {
    it('should write discovered tools to cache', async () => {
      const scriptPath = join(fixturesDir, 'test-server.mjs');

      const configs: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'node',
          args: [scriptPath],
          env: {
            NODE_PATH: join(__dirname, '..', 'node_modules')
          }
        }
      ];

      // First call - should discover and cache
      const result1 = await discoverTools(configs);
      expect(result1.allTools).toHaveLength(1);

      // Verify cache was written
      const hash = generateConfigHash(configs);
      const cached = await readCacheFile(hash);
      expect(cached).not.toBeNull();
      expect(cached?.allTools).toHaveLength(1);
      expect(cached?.allTools[0].tool.name).toBe('test_tool');
    });
  });

  describe('MCP_WRAPPER_IGNORE_CACHE environment variable', () => {
    it('should bypass cache when MCP_WRAPPER_IGNORE_CACHE is set to "true"', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'echo',
          args: ['hello']
        }
      ];

      // Create a cache file with specific content
      const hash = generateConfigHash(configs);
      await writeCacheFile(hash, {
        allTools: [
          {
            serverName: 'test-server',
            tool: {
              name: 'cached_tool',
              description: 'This is from cache',
              inputSchema: { type: 'object', properties: {} }
            }
          }
        ],
        allowedTools: ['cached_tool'],
        description: 'Cached description'
      });

      // Set env var to ignore cache
      process.env.MCP_WRAPPER_IGNORE_CACHE = 'true';

      // Discovery should bypass cache and perform fresh discovery
      const result = await discoverTools(configs);

      // Result should NOT contain the cached tool
      // (echo command won't return MCP tools, so should be empty)
      expect(result.allTools.length).toBe(0);
      expect(result.allowedTools).toEqual([]);
      expect(result.description).not.toBe('Cached description');
    });

    it('should use cache normally when MCP_WRAPPER_IGNORE_CACHE is not set', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'echo',
          args: ['hello']
        }
      ];

      // Create a cache file
      const hash = generateConfigHash(configs);
      await writeCacheFile(hash, {
        allTools: [
          {
            serverName: 'test-server',
            tool: {
              name: 'cached_tool',
              description: 'This is from cache',
              inputSchema: { type: 'object', properties: {} }
            }
          }
        ],
        allowedTools: ['cached_tool'],
        description: 'Cached description'
      });

      // Don't set MCP_WRAPPER_IGNORE_CACHE (should use cache)
      delete process.env.MCP_WRAPPER_IGNORE_CACHE;

      // Discovery should use cache
      const result = await discoverTools(configs);

      // Result should contain the cached tool
      expect(result.allTools).toHaveLength(1);
      expect(result.allTools[0].tool.name).toBe('cached_tool');
      expect(result.allowedTools).toEqual(['cached_tool']);
      expect(result.description).toBe('Cached description');
    });

    it('should use cache normally when MCP_WRAPPER_IGNORE_CACHE is set to "false"', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'echo',
          args: ['hello']
        }
      ];

      // Create a cache file
      const hash = generateConfigHash(configs);
      await writeCacheFile(hash, {
        allTools: [
          {
            serverName: 'test-server',
            tool: {
              name: 'cached_tool',
              description: 'This is from cache',
              inputSchema: { type: 'object', properties: {} }
            }
          }
        ],
        allowedTools: ['cached_tool'],
        description: 'Cached description'
      });

      // Set env var to false (should use cache)
      process.env.MCP_WRAPPER_IGNORE_CACHE = 'false';

      // Discovery should use cache
      const result = await discoverTools(configs);

      // Result should contain the cached tool
      expect(result.allTools).toHaveLength(1);
      expect(result.allTools[0].tool.name).toBe('cached_tool');
      expect(result.allowedTools).toEqual(['cached_tool']);
      expect(result.description).toBe('Cached description');
    });

    it('should still write to cache after bypassing it when MCP_WRAPPER_IGNORE_CACHE is "true"', async () => {
      const scriptPath = join(fixturesDir, 'test-server.mjs');

      const configs: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'node',
          args: [scriptPath],
          env: {
            NODE_PATH: join(__dirname, '..', 'node_modules')
          }
        }
      ];

      // Create an old cache file
      const hash = generateConfigHash(configs);
      await writeCacheFile(hash, {
        allTools: [
          {
            serverName: 'test-server',
            tool: {
              name: 'old_cached_tool',
              description: 'Old cache',
              inputSchema: { type: 'object', properties: {} }
            }
          }
        ],
        allowedTools: ['old_cached_tool'],
        description: 'Old cached description'
      });

      // Set env var to ignore cache
      process.env.MCP_WRAPPER_IGNORE_CACHE = 'true';

      // Discover with cache bypass
      const result = await discoverTools(configs);

      // Should have performed fresh discovery
      expect(result.allTools).toHaveLength(1);
      expect(result.allTools[0].tool.name).toBe('test_tool'); // From actual discovery, not cache

      // Verify that cache was updated with new discovery
      const cached = await readCacheFile(hash);
      expect(cached).not.toBeNull();
      expect(cached?.allTools).toHaveLength(1);
      expect(cached?.allTools[0].tool.name).toBe('test_tool'); // Updated cache
      expect(cached?.description).not.toBe('Old cached description'); // Updated description
    });
  });
});
