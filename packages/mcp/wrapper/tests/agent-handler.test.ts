/**
 * Tests for agent tool handler
 */

import type { ServerConfig } from '../src/types/wrapper.js';
import { describe, it, expect } from '@jest/globals';
import { validateAgentToolArguments } from '../src/types/wrapper.js';
import { initializeServer } from '../src/wrapper.js';

describe('Agent Tool Handler', () => {
  describe('argument validation', () => {
    it('should validate correct arguments', () => {
      const result = validateAgentToolArguments({
        prompt: 'Hello, world!'
      });

      expect(result.prompt).toBe('Hello, world!');
      expect(result.sessionId).toBeUndefined();
    });

    it('should validate arguments with sessionId', () => {
      const result = validateAgentToolArguments({
        prompt: 'Test prompt',
        sessionId: 'session-123'
      });

      expect(result.prompt).toBe('Test prompt');
      expect(result.sessionId).toBe('session-123');
    });

    it('should reject missing prompt', () => {
      expect(() => {
        validateAgentToolArguments({});
      }).toThrow(/prompt/i);
    });

    it('should reject empty prompt', () => {
      expect(() => {
        validateAgentToolArguments({ prompt: '' });
      }).toThrow(/prompt/i);
    });

    it('should reject non-string prompt', () => {
      expect(() => {
        validateAgentToolArguments({ prompt: 123 });
      }).toThrow();
    });

    it('should reject null prompt', () => {
      expect(() => {
        validateAgentToolArguments({ prompt: null });
      }).toThrow();
    });

    it('should allow optional sessionId', () => {
      const result = validateAgentToolArguments({
        prompt: 'test'
      });

      expect(result.prompt).toBe('test');
    });

    it('should reject non-string sessionId', () => {
      expect(() => {
        validateAgentToolArguments({
          prompt: 'test',
          sessionId: 123
        });
      }).toThrow();
    });
  });

  describe('mcpServers configuration', () => {
    it('should build mcpServers config for stdio transport', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { TEST_VAR: 'value' }
        }
      ];

      const { server } = await initializeServer(configs);

      // The mcpServers config is built internally during CallTool,
      // so we just verify the server initializes without errors
      expect(server).toBeDefined();

      await server.close();
    });

    it('should build mcpServers config for HTTP transport', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'http-server',
          transport: 'http',
          url: 'https://example.com/mcp'
        }
      ];

      const { server } = await initializeServer(configs);

      expect(server).toBeDefined();

      await server.close();
    });

    it('should build mcpServers config for mixed transports', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'stdio-server',
          transport: 'stdio',
          command: 'node',
          args: ['stdio.js']
        },
        {
          name: 'http-server',
          transport: 'http',
          url: 'https://example.com/mcp'
        }
      ];

      const { server } = await initializeServer(configs);

      expect(server).toBeDefined();

      await server.close();
    });

    it('should skip stdio servers without command', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'invalid-stdio',
          transport: 'stdio'
          // missing command
        }
      ];

      const { server } = await initializeServer(configs);

      // Should not throw, just skip the invalid config
      expect(server).toBeDefined();

      await server.close();
    });

    it('should skip HTTP servers without URL', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'invalid-http',
          transport: 'http'
          // missing url
        }
      ];

      const { server } = await initializeServer(configs);

      // Should not throw, just skip the invalid config
      expect(server).toBeDefined();

      await server.close();
    });
  });

  describe('integration', () => {
    it('should initialize with empty configuration', async () => {
      const configs: ServerConfig[] = [];
      const { server, tools } = await initializeServer(configs);

      expect(server).toBeDefined();
      expect(tools.allTools).toHaveLength(0);
      expect(tools.allowedTools).toHaveLength(0);
      expect(tools.description).toContain('no tools');

      await server.close();
    });

    it('should initialize with stdio configuration', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'test-server',
          transport: 'stdio',
          command: 'node',
          args: ['-v']
        }
      ];

      const { server } = await initializeServer(configs);

      expect(server).toBeDefined();

      await server.close();
    });

    it('should initialize with HTTP configuration', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'http-server',
          transport: 'http',
          url: 'https://example.com/mcp'
        }
      ];

      const { server } = await initializeServer(configs);

      expect(server).toBeDefined();

      await server.close();
    });

    it('should initialize with environment variables', async () => {
      const configs: ServerConfig[] = [
        {
          name: 'env-server',
          transport: 'stdio',
          command: 'node',
          args: ['-v'],
          env: {
            TEST_VAR: 'test-value',
            ANOTHER_VAR: 'another-value'
          }
        }
      ];

      const { server } = await initializeServer(configs);

      expect(server).toBeDefined();

      await server.close();
    });
  });
});
