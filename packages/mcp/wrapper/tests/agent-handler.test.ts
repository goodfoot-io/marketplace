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
      expect(result.model).toBeUndefined();
      expect(result.resume).toBeUndefined();
    });

    it('should validate arguments with model', () => {
      const result = validateAgentToolArguments({
        prompt: 'Test prompt',
        model: 'haiku'
      });

      expect(result.prompt).toBe('Test prompt');
      expect(result.model).toBe('haiku');
    });

    it('should validate arguments with resume', () => {
      const result = validateAgentToolArguments({
        prompt: 'Continue from here',
        resume: 'agent-id-123'
      });

      expect(result.prompt).toBe('Continue from here');
      expect(result.resume).toBe('agent-id-123');
    });

    it('should validate all optional parameters together', () => {
      const result = validateAgentToolArguments({
        prompt: 'Full prompt',
        model: 'sonnet',
        resume: 'agent-id-456'
      });

      expect(result.prompt).toBe('Full prompt');
      expect(result.model).toBe('sonnet');
      expect(result.resume).toBe('agent-id-456');
    });

    it('should reject missing prompt', () => {
      expect(() => {
        validateAgentToolArguments({});
      }).toThrow(/prompt/i);
    });

    it('should reject empty prompt', () => {
      expect(() => {
        validateAgentToolArguments({
          prompt: ''
        });
      }).toThrow(/prompt/i);
    });

    it('should reject non-string prompt', () => {
      expect(() => {
        validateAgentToolArguments({
          prompt: 123
        });
      }).toThrow();
    });

    it('should reject null prompt', () => {
      expect(() => {
        validateAgentToolArguments({
          prompt: null
        });
      }).toThrow();
    });

    it('should reject invalid model', () => {
      expect(() => {
        validateAgentToolArguments({
          prompt: 'Test prompt',
          model: 'invalid-model'
        });
      }).toThrow();
    });

    it('should allow optional resume', () => {
      const result = validateAgentToolArguments({
        prompt: 'test'
      });

      expect(result.prompt).toBe('test');
      expect(result.resume).toBeUndefined();
    });

    it('should reject non-string resume', () => {
      expect(() => {
        validateAgentToolArguments({
          prompt: 'test',
          resume: 123
        });
      }).toThrow();
    });

    it('should accept valid session ID format for resume', () => {
      const result = validateAgentToolArguments({
        prompt: 'continue conversation',
        resume: 'session-abc123-def456'
      });

      expect(result.resume).toBe('session-abc123-def456');
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

  describe('resume functionality', () => {
    it('should accept resume parameter in tool arguments', () => {
      const result = validateAgentToolArguments({
        prompt: 'continue from previous session',
        resume: 'test-session-id'
      });

      expect(result.resume).toBe('test-session-id');
    });

    it('should accept resume with model parameter', () => {
      const result = validateAgentToolArguments({
        prompt: 'continue with haiku model',
        model: 'haiku',
        resume: 'test-session-id-2'
      });

      expect(result.prompt).toBe('continue with haiku model');
      expect(result.model).toBe('haiku');
      expect(result.resume).toBe('test-session-id-2');
    });

    it('should work without resume parameter', () => {
      const result = validateAgentToolArguments({
        prompt: 'start new session'
      });

      expect(result.prompt).toBe('start new session');
      expect(result.resume).toBeUndefined();
    });
  });

  describe('run_in_background parameter', () => {
    it('should accept run_in_background as true', () => {
      const result = validateAgentToolArguments({
        prompt: 'background task',
        run_in_background: true
      });

      expect(result.prompt).toBe('background task');
      expect(result.run_in_background).toBe(true);
    });

    it('should accept run_in_background as false', () => {
      const result = validateAgentToolArguments({
        prompt: 'foreground task',
        run_in_background: false
      });

      expect(result.prompt).toBe('foreground task');
      expect(result.run_in_background).toBe(false);
    });

    it('should work without run_in_background parameter (undefined)', () => {
      const result = validateAgentToolArguments({
        prompt: 'default task'
      });

      expect(result.prompt).toBe('default task');
      expect(result.run_in_background).toBeUndefined();
    });

    it('should reject non-boolean run_in_background', () => {
      expect(() => {
        validateAgentToolArguments({
          prompt: 'test',
          run_in_background: 'true'
        });
      }).toThrow();
    });

    it('should reject number for run_in_background', () => {
      expect(() => {
        validateAgentToolArguments({
          prompt: 'test',
          run_in_background: 1
        });
      }).toThrow();
    });

    it('should reject null for run_in_background', () => {
      expect(() => {
        validateAgentToolArguments({
          prompt: 'test',
          run_in_background: null
        });
      }).toThrow();
    });

    it('should accept run_in_background with all other parameters', () => {
      const result = validateAgentToolArguments({
        prompt: 'complete task',
        model: 'haiku',
        resume: 'agent-123',
        run_in_background: true
      });

      expect(result.prompt).toBe('complete task');
      expect(result.model).toBe('haiku');
      expect(result.resume).toBe('agent-123');
      expect(result.run_in_background).toBe(true);
    });

    it('should accept run_in_background with model parameter', () => {
      const result = validateAgentToolArguments({
        prompt: 'task with model',
        model: 'sonnet',
        run_in_background: true
      });

      expect(result.model).toBe('sonnet');
      expect(result.run_in_background).toBe(true);
    });

    it('should accept run_in_background with resume parameter', () => {
      const result = validateAgentToolArguments({
        prompt: 'resume in background',
        resume: 'agent-456',
        run_in_background: true
      });

      expect(result.resume).toBe('agent-456');
      expect(result.run_in_background).toBe(true);
    });
  });

  describe('response format', () => {
    it('should document session ID format in response', () => {
      // This test documents the expected response format
      const exampleResponse = `Session ID: abc123-def456

---

This is the agent's response text.`;

      // Extract session ID from response
      const sessionIdMatch = exampleResponse.match(/^Session ID: (.+)$/m);
      expect(sessionIdMatch).not.toBeNull();

      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        expect(sessionId).toBe('abc123-def456');

        // Extract result text (everything after the separator)
        const separatorIndex = exampleResponse.indexOf('---');
        const resultText = exampleResponse.substring(separatorIndex + 3).trim();
        expect(resultText).toBe("This is the agent's response text.");
      }
    });

    it('should handle response without session ID', () => {
      const exampleResponse = 'This is a response without session ID.';

      // Should not match session ID pattern
      const sessionIdMatch = exampleResponse.match(/^Session ID: (.+)$/m);
      expect(sessionIdMatch).toBeNull();

      // Result text is the entire response
      expect(exampleResponse).toBe('This is a response without session ID.');
    });
  });
});
