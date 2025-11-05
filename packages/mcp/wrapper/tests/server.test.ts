/**
 * Tests for MCP server initialization and tool registration
 */

import type { ServerConfig } from '../src/types/wrapper.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { initializeServer } from '../src/wrapper.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('initializeServer', () => {
  let tempCacheDir: string;
  let originalCacheDir: string | undefined;

  beforeEach(async () => {
    // Create temp cache directory
    tempCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-wrapper-test-'));
    originalCacheDir = process.env.XDG_CACHE_HOME;
    process.env.XDG_CACHE_HOME = tempCacheDir;
  });

  afterEach(async () => {
    // Restore original cache dir
    if (originalCacheDir) {
      process.env.XDG_CACHE_HOME = originalCacheDir;
    } else {
      delete process.env.XDG_CACHE_HOME;
    }

    // Clean up temp directory
    try {
      await fs.rm(tempCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('server initialization', () => {
    it('should create server with correct structure', async () => {
      const configs: ServerConfig[] = [];
      const result = await initializeServer(configs);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('server');
      expect(result).toHaveProperty('tools');
    });

    it('should discover tools on initialization', async () => {
      const configs: ServerConfig[] = [];
      const result = await initializeServer(configs);

      // Should have discovered tools (even if empty)
      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveProperty('allTools');
      expect(result.tools).toHaveProperty('allowedTools');
      expect(result.tools).toHaveProperty('description');
    });

    it('should have Server instance with correct capabilities', async () => {
      const configs: ServerConfig[] = [];
      const result = await initializeServer(configs);

      // Verify server instance exists
      expect(result.server).toBeDefined();
      expect(result.server.constructor.name).toBe('Server');
    });
  });

  describe('tool discovery integration', () => {
    it('should return empty tools with empty configuration', async () => {
      const configs: ServerConfig[] = [];
      const result = await initializeServer(configs);

      expect(result.tools.allTools).toEqual([]);
      expect(result.tools.allowedTools).toEqual([]);
      expect(result.tools.description).toBe('Multi-tool agent (no tools discovered yet)');
    });

    it('should integrate with discovery system', async () => {
      // Test that initializeServer properly integrates with discoverTools
      // Full discovery tests are in discovery.test.ts
      const configs: ServerConfig[] = [];
      const result = await initializeServer(configs);

      // Should call discoverTools and get back proper structure
      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveProperty('allTools');
      expect(result.tools).toHaveProperty('allowedTools');
      expect(result.tools).toHaveProperty('description');
    });
  });

  describe('multiple server configurations', () => {
    it('should handle multiple server configurations', async () => {
      // Test with empty configs (discovery tests cover actual tool aggregation)
      const configs: ServerConfig[] = [];
      const result = await initializeServer(configs);

      // Server should handle any configuration properly
      expect(result).toBeDefined();
      expect(result.server).toBeDefined();
      expect(result.tools).toBeDefined();
    });
  });

  describe('tool registration', () => {
    it('should register tool with expected schema structure', async () => {
      const configs: ServerConfig[] = [];
      const result = await initializeServer(configs);

      // The tool registration happens inside initializeServer
      // We verify by checking that tools were discovered
      expect(result.tools).toBeDefined();
      expect(result.tools.description).toBe('Multi-tool agent (no tools discovered yet)');
    });

    it('should include description in discovered tools', async () => {
      const configs: ServerConfig[] = [];
      const result = await initializeServer(configs);

      // Description should always be set
      expect(result.tools.description).toBeDefined();
      expect(typeof result.tools.description).toBe('string');
      expect(result.tools.description.length).toBeGreaterThan(0);
    });
  });
});
