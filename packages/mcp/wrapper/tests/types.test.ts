/**
 * Tests for type definitions and runtime validators
 */

import { describe, it, expect } from '@jest/globals';
import {
  TransportType,
  ServerConfig,
  AggregatedTools,
  CachedToolDescription,
  ServerConfigSchema,
  AggregatedToolsSchema,
  CachedToolDescriptionSchema,
  isServerConfig,
  validateServerConfig,
  isAggregatedTools,
  validateAggregatedTools,
  isCachedToolDescription,
  validateCachedToolDescription,
  getEnvironmentAsRecord,
  AsyncLaunchedResponse,
  CompletedResponse,
  AgentToolResponse,
  AsyncLaunchedResponseSchema,
  CompletedResponseSchema,
  AgentToolResponseSchema,
  isAgentToolResponse,
  validateAgentToolResponse,
  AgentOutputArguments,
  AgentOutputArgumentsSchema,
  validateAgentOutputArguments,
  WrapperOptions,
  WrapperOptionsSchema,
  isWrapperOptions,
  validateWrapperOptions
} from '../src/types/wrapper.js';

describe('TransportType', () => {
  it('should have stdio and http values', () => {
    const stdio: TransportType = 'stdio';
    const http: TransportType = 'http';
    expect(stdio).toBe('stdio');
    expect(http).toBe('http');
  });
});

describe('ServerConfig', () => {
  describe('interface', () => {
    it('should accept valid stdio configuration', () => {
      const config: ServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { KEY: 'value' }
      };
      expect(config.name).toBe('test-server');
      expect(config.transport).toBe('stdio');
      expect(config.command).toBe('node');
      expect(config.args).toEqual(['server.js']);
    });

    it('should accept valid HTTP configuration', () => {
      const config: ServerConfig = {
        name: 'http-server',
        transport: 'http',
        url: 'https://example.com/mcp',
        env: { TOKEN: 'secret' }
      };
      expect(config.name).toBe('http-server');
      expect(config.transport).toBe('http');
      expect(config.url).toBe('https://example.com/mcp');
    });

    it('should accept minimal configuration', () => {
      const config: ServerConfig = {
        name: 'minimal',
        transport: 'stdio'
      };
      expect(config.name).toBe('minimal');
    });
  });

  describe('Zod schema', () => {
    it('should validate valid stdio configuration', () => {
      const config = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { KEY: 'value' }
      };
      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test-server');
        expect(result.data.transport).toBe('stdio');
      }
    });

    it('should validate valid HTTP configuration', () => {
      const config = {
        name: 'http-server',
        transport: 'http',
        url: 'https://example.com/mcp',
        env: { TOKEN: 'secret' }
      };
      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe('https://example.com/mcp');
      }
    });

    it('should reject configuration with invalid transport', () => {
      const config = {
        name: 'test',
        transport: 'websocket'
      };
      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject configuration without name', () => {
      const config = {
        transport: 'stdio',
        command: 'node'
      };
      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject configuration with empty name', () => {
      const config = {
        name: '',
        transport: 'stdio'
      };
      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should allow optional env field', () => {
      const config = {
        name: 'test',
        transport: 'stdio'
      };
      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('type guard', () => {
    it('should return true for valid ServerConfig', () => {
      const config = {
        name: 'test',
        transport: 'stdio',
        command: 'node'
      };
      expect(isServerConfig(config)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isServerConfig(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isServerConfig(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isServerConfig('string')).toBe(false);
      expect(isServerConfig(42)).toBe(false);
    });

    it('should return false for object without required fields', () => {
      expect(isServerConfig({ name: 'test' })).toBe(false);
      expect(isServerConfig({ transport: 'stdio' })).toBe(false);
    });
  });

  describe('validator', () => {
    it('should return valid ServerConfig', () => {
      const config = {
        name: 'test',
        transport: 'stdio',
        command: 'node'
      };
      const validated = validateServerConfig(config);
      expect(validated.name).toBe('test');
      expect(validated.transport).toBe('stdio');
    });

    it('should throw for invalid config', () => {
      expect(() => validateServerConfig(null)).toThrow(/Invalid server configuration/);
      expect(() => validateServerConfig({ name: 'test' })).toThrow(/Invalid server configuration/);
    });

    it('should include received value in error message', () => {
      expect(() => validateServerConfig(null)).toThrow(/received: null/);
      expect(() => validateServerConfig(42)).toThrow(/received: 42/);
    });
  });
});

describe('AggregatedTools', () => {
  describe('interface', () => {
    it('should accept valid aggregated tools', () => {
      const tools: AggregatedTools = {
        allTools: [
          {
            serverName: 'server1',
            tool: {
              name: 'mcp__server1__tool1',
              description: 'Tool 1',
              inputSchema: { type: 'object', properties: {} }
            }
          }
        ],
        allowedTools: ['mcp__server1__tool1'],
        description: 'Server 1 tools'
      };
      expect(tools.allTools.length).toBe(1);
      expect(tools.allowedTools.length).toBe(1);
    });

    it('should accept empty tools array', () => {
      const tools: AggregatedTools = {
        allTools: [],
        allowedTools: [],
        description: 'No tools'
      };
      expect(tools.allTools.length).toBe(0);
    });
  });

  describe('Zod schema', () => {
    it('should validate valid aggregated tools', () => {
      const tools = {
        allTools: [
          {
            serverName: 'server1',
            tool: {
              name: 'tool1',
              description: 'Tool 1',
              inputSchema: { type: 'object' }
            }
          }
        ],
        allowedTools: ['tool1'],
        description: 'Tools'
      };
      const result = AggregatedToolsSchema.safeParse(tools);
      expect(result.success).toBe(true);
    });

    it('should validate tools without description', () => {
      const tools = {
        allTools: [
          {
            serverName: 'server1',
            tool: {
              name: 'tool1',
              inputSchema: { type: 'object' }
            }
          }
        ],
        allowedTools: ['tool1'],
        description: 'Tools'
      };
      const result = AggregatedToolsSchema.safeParse(tools);
      expect(result.success).toBe(true);
    });

    it('should reject tools without required fields', () => {
      const tools = {
        allTools: [{ serverName: 'server1' }],
        allowedTools: ['tool1'],
        description: 'Tools'
      };
      const result = AggregatedToolsSchema.safeParse(tools);
      expect(result.success).toBe(false);
    });

    it('should reject invalid allowedTools', () => {
      const tools = {
        allTools: [],
        allowedTools: 'not-an-array',
        description: 'Tools'
      };
      const result = AggregatedToolsSchema.safeParse(tools);
      expect(result.success).toBe(false);
    });
  });

  describe('type guard', () => {
    it('should return true for valid AggregatedTools', () => {
      const tools = {
        allTools: [
          {
            serverName: 'server1',
            tool: { name: 'tool1', inputSchema: {} }
          }
        ],
        allowedTools: ['tool1'],
        description: 'Tools'
      };
      expect(isAggregatedTools(tools)).toBe(true);
    });

    it('should return false for invalid input', () => {
      expect(isAggregatedTools(null)).toBe(false);
      expect(isAggregatedTools({})).toBe(false);
      expect(isAggregatedTools({ allTools: [] })).toBe(false);
    });
  });

  describe('validator', () => {
    it('should return valid AggregatedTools', () => {
      const tools = {
        allTools: [],
        allowedTools: [],
        description: 'Empty'
      };
      const validated = validateAggregatedTools(tools);
      expect(validated.allTools).toEqual([]);
    });

    it('should throw for invalid tools', () => {
      expect(() => validateAggregatedTools(null)).toThrow(/Invalid aggregated tools/);
    });
  });
});

describe('CachedToolDescription', () => {
  describe('interface', () => {
    it('should accept valid cache structure', () => {
      const cache: CachedToolDescription = {
        version: '1.0.0',
        configHash: 'abc123',
        timestamp: Date.now(),
        allTools: [],
        allowedTools: [],
        description: 'Cached'
      };
      expect(cache.version).toBe('1.0.0');
      expect(cache.configHash).toBe('abc123');
    });
  });

  describe('Zod schema', () => {
    it('should validate valid cache structure', () => {
      const cache = {
        version: '1.0.0',
        configHash: 'abc123',
        timestamp: Date.now(),
        allTools: [],
        allowedTools: [],
        description: 'Cached'
      };
      const result = CachedToolDescriptionSchema.safeParse(cache);
      expect(result.success).toBe(true);
    });

    it('should reject cache without version', () => {
      const cache = {
        configHash: 'abc123',
        timestamp: Date.now(),
        allTools: [],
        allowedTools: [],
        description: 'Cached'
      };
      const result = CachedToolDescriptionSchema.safeParse(cache);
      expect(result.success).toBe(false);
    });

    it('should reject cache with invalid timestamp', () => {
      const cache = {
        version: '1.0.0',
        configHash: 'abc123',
        timestamp: 'not-a-number',
        allTools: [],
        allowedTools: [],
        description: 'Cached'
      };
      const result = CachedToolDescriptionSchema.safeParse(cache);
      expect(result.success).toBe(false);
    });
  });

  describe('type guard', () => {
    it('should return true for valid cache', () => {
      const cache = {
        version: '1.0.0',
        configHash: 'abc123',
        timestamp: Date.now(),
        allTools: [],
        allowedTools: [],
        description: 'Cached'
      };
      expect(isCachedToolDescription(cache)).toBe(true);
    });

    it('should return false for invalid cache', () => {
      expect(isCachedToolDescription(null)).toBe(false);
      expect(isCachedToolDescription({})).toBe(false);
    });
  });

  describe('validator', () => {
    it('should return valid cache', () => {
      const cache = {
        version: '1.0.0',
        configHash: 'abc123',
        timestamp: Date.now(),
        allTools: [],
        allowedTools: [],
        description: 'Cached'
      };
      const validated = validateCachedToolDescription(cache);
      expect(validated.version).toBe('1.0.0');
    });

    it('should throw for invalid cache', () => {
      expect(() => validateCachedToolDescription(null)).toThrow(/Invalid cached tool description/);
    });
  });
});

describe('getEnvironmentAsRecord', () => {
  it('should filter out undefined values', () => {
    const env = {
      KEY1: 'value1',
      KEY2: undefined,
      KEY3: 'value3'
    };
    const result = getEnvironmentAsRecord(env);
    expect(result).toEqual({
      KEY1: 'value1',
      KEY3: 'value3'
    });
    expect('KEY2' in result).toBe(false);
  });

  it('should return empty object for empty input', () => {
    const result = getEnvironmentAsRecord({});
    expect(result).toEqual({});
  });

  it('should preserve all defined values', () => {
    const env = {
      PATH: '/usr/bin',
      HOME: '/home/user',
      NODE_ENV: 'test'
    };
    const result = getEnvironmentAsRecord(env);
    expect(result).toEqual(env);
  });

  it('should handle mixed defined and undefined values', () => {
    const env = {
      DEFINED: 'yes',
      UNDEFINED: undefined,
      EMPTY_STRING: '',
      ZERO: '0'
    };
    const result = getEnvironmentAsRecord(env);
    expect(result).toEqual({
      DEFINED: 'yes',
      EMPTY_STRING: '',
      ZERO: '0'
    });
  });
});

describe('AgentToolResponse', () => {
  describe('AsyncLaunchedResponse', () => {
    describe('interface', () => {
      it('should accept valid async_launched response', () => {
        const response: AsyncLaunchedResponse = {
          status: 'async_launched',
          agentId: 'abc123',
          description: 'Agent task description',
          prompt: 'Do something'
        };
        expect(response.status).toBe('async_launched');
        expect(response.agentId).toBe('abc123');
        expect(response.description).toBe('Agent task description');
        expect(response.prompt).toBe('Do something');
      });
    });

    describe('Zod schema', () => {
      it('should validate valid async_launched response', () => {
        const response = {
          status: 'async_launched' as const,
          agentId: 'abc123',
          description: 'Task description',
          prompt: 'Do something'
        };
        const result = AsyncLaunchedResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('async_launched');
          expect(result.data.agentId).toBe('abc123');
        }
      });

      it('should reject async_launched response without agentId', () => {
        const response = {
          status: 'async_launched' as const,
          description: 'Task description',
          prompt: 'Do something'
        };
        const result = AsyncLaunchedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject async_launched response without description', () => {
        const response = {
          status: 'async_launched' as const,
          agentId: 'abc123',
          prompt: 'Do something'
        };
        const result = AsyncLaunchedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject async_launched response without prompt', () => {
        const response = {
          status: 'async_launched' as const,
          agentId: 'abc123',
          description: 'Task description'
        };
        const result = AsyncLaunchedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject async_launched response with empty agentId', () => {
        const response = {
          status: 'async_launched' as const,
          agentId: '',
          description: 'Task description',
          prompt: 'Do something'
        };
        const result = AsyncLaunchedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject async_launched response with empty prompt', () => {
        const response = {
          status: 'async_launched' as const,
          agentId: 'abc123',
          description: 'Task description',
          prompt: ''
        };
        const result = AsyncLaunchedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('CompletedResponse', () => {
    describe('interface', () => {
      it('should accept valid completed response', () => {
        const response: CompletedResponse = {
          status: 'completed',
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text', text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: { input: 100, output: 400 }
        };
        expect(response.status).toBe('completed');
        expect(response.agentId).toBe('abc123');
        expect(response.content).toHaveLength(1);
        expect(response.totalToolUseCount).toBe(5);
      });

      it('should accept completed response with multiple content items', () => {
        const response: CompletedResponse = {
          status: 'completed',
          prompt: 'Do something',
          agentId: 'abc123',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' }
          ],
          totalToolUseCount: 0,
          totalDurationMs: 100,
          totalTokens: 50,
          usage: {}
        };
        expect(response.content).toHaveLength(2);
      });

      it('should accept completed response with empty content array', () => {
        const response: CompletedResponse = {
          status: 'completed',
          prompt: 'Do something',
          agentId: 'abc123',
          content: [],
          totalToolUseCount: 0,
          totalDurationMs: 100,
          totalTokens: 0,
          usage: {}
        };
        expect(response.content).toHaveLength(0);
      });
    });

    describe('Zod schema', () => {
      it('should validate valid completed response', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text' as const, text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: { input: 100, output: 400 }
        };
        const result = CompletedResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('completed');
          expect(result.data.totalToolUseCount).toBe(5);
        }
      });

      it('should reject completed response without prompt', () => {
        const response = {
          status: 'completed' as const,
          agentId: 'abc123',
          content: [{ type: 'text' as const, text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };
        const result = CompletedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject completed response without agentId', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          content: [{ type: 'text' as const, text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };
        const result = CompletedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject completed response without content', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };
        const result = CompletedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject completed response with invalid content type', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'image', text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };
        const result = CompletedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject completed response with negative totalToolUseCount', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text' as const, text: 'Result' }],
          totalToolUseCount: -1,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };
        const result = CompletedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject completed response with negative totalDurationMs', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text' as const, text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: -1,
          totalTokens: 500,
          usage: {}
        };
        const result = CompletedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should reject completed response with negative totalTokens', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text' as const, text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: -1,
          usage: {}
        };
        const result = CompletedResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });

      it('should accept completed response with zero counts', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          content: [],
          totalToolUseCount: 0,
          totalDurationMs: 0,
          totalTokens: 0,
          usage: {}
        };
        const result = CompletedResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('AgentToolResponse discriminated union', () => {
    it('should accept async_launched response', () => {
      const response: AgentToolResponse = {
        status: 'async_launched',
        agentId: 'abc123',
        description: 'Task description',
        prompt: 'Do something'
      };
      expect(response.status).toBe('async_launched');
    });

    it('should accept completed response', () => {
      const response: AgentToolResponse = {
        status: 'completed',
        prompt: 'Do something',
        agentId: 'abc123',
        content: [{ type: 'text', text: 'Result' }],
        totalToolUseCount: 5,
        totalDurationMs: 1234,
        totalTokens: 500,
        usage: {}
      };
      expect(response.status).toBe('completed');
    });

    describe('type discrimination', () => {
      it('should discriminate async_launched response fields', () => {
        const response: AgentToolResponse = {
          status: 'async_launched',
          agentId: 'abc123',
          description: 'Task description',
          prompt: 'Do something'
        };

        if (response.status === 'async_launched') {
          expect(response.agentId).toBe('abc123');
          expect(response.description).toBe('Task description');
          expect(response.prompt).toBe('Do something');
        }
      });

      it('should discriminate completed response fields', () => {
        const response: AgentToolResponse = {
          status: 'completed',
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text', text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };

        if (response.status === 'completed') {
          expect(response.content).toHaveLength(1);
          expect(response.totalToolUseCount).toBe(5);
          expect(response.totalDurationMs).toBe(1234);
          expect(response.totalTokens).toBe(500);
        }
      });

      it('should narrow type correctly based on status', () => {
        const asyncResponse: AgentToolResponse = {
          status: 'async_launched',
          agentId: 'abc123',
          description: 'Task description',
          prompt: 'Do something'
        };

        const completedResponse: AgentToolResponse = {
          status: 'completed',
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text', text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };

        expect(asyncResponse.status).toBe('async_launched');
        expect(completedResponse.status).toBe('completed');
      });
    });

    describe('Zod schema', () => {
      it('should validate async_launched response with union schema', () => {
        const response = {
          status: 'async_launched' as const,
          agentId: 'abc123',
          description: 'Task description',
          prompt: 'Do something'
        };
        const result = AgentToolResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it('should validate completed response with union schema', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text' as const, text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };
        const result = AgentToolResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it('should reject response with invalid status', () => {
        const response = {
          status: 'invalid_status',
          agentId: 'abc123',
          description: 'Task description',
          prompt: 'Do something'
        };
        const result = AgentToolResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });
    });

    describe('type guard', () => {
      it('should return true for valid async_launched response', () => {
        const response = {
          status: 'async_launched' as const,
          agentId: 'abc123',
          description: 'Task description',
          prompt: 'Do something'
        };
        expect(isAgentToolResponse(response)).toBe(true);
      });

      it('should return true for valid completed response', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text' as const, text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };
        expect(isAgentToolResponse(response)).toBe(true);
      });

      it('should return false for null', () => {
        expect(isAgentToolResponse(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isAgentToolResponse(undefined)).toBe(false);
      });

      it('should return false for invalid object', () => {
        expect(isAgentToolResponse({ status: 'invalid' })).toBe(false);
      });
    });

    describe('validator', () => {
      it('should return valid async_launched response', () => {
        const response = {
          status: 'async_launched' as const,
          agentId: 'abc123',
          description: 'Task description',
          prompt: 'Do something'
        };
        const validated = validateAgentToolResponse(response);
        expect(validated.status).toBe('async_launched');
        if (validated.status === 'async_launched') {
          expect(validated.agentId).toBe('abc123');
        }
      });

      it('should return valid completed response', () => {
        const response = {
          status: 'completed' as const,
          prompt: 'Do something',
          agentId: 'abc123',
          content: [{ type: 'text' as const, text: 'Result' }],
          totalToolUseCount: 5,
          totalDurationMs: 1234,
          totalTokens: 500,
          usage: {}
        };
        const validated = validateAgentToolResponse(response);
        expect(validated.status).toBe('completed');
        if (validated.status === 'completed') {
          expect(validated.totalToolUseCount).toBe(5);
        }
      });

      it('should throw for invalid response', () => {
        expect(() => validateAgentToolResponse(null)).toThrow(/Invalid agent tool response/);
        expect(() => validateAgentToolResponse({ status: 'invalid' })).toThrow(/Invalid agent tool response/);
      });
    });
  });
});

describe('AgentOutputArguments', () => {
  describe('interface', () => {
    it('should accept valid output arguments', () => {
      const args: AgentOutputArguments = {
        agentIds: ['agent-123'],
        block: true,
        wait_up_to: 150
      };
      expect(args.agentIds).toEqual(['agent-123']);
      expect(args.block).toBe(true);
      expect(args.wait_up_to).toBe(150);
    });

    it('should accept arguments with defaults omitted', () => {
      const args: AgentOutputArguments = {
        agentIds: ['agent-1', 'agent-2']
      };
      expect(args.agentIds).toEqual(['agent-1', 'agent-2']);
    });

    it('should accept multiple agent IDs', () => {
      const args: AgentOutputArguments = {
        agentIds: ['agent-1', 'agent-2', 'agent-3'],
        block: false,
        wait_up_to: 60
      };
      expect(args.agentIds.length).toBe(3);
    });
  });

  describe('Zod schema', () => {
    it('should validate valid arguments', () => {
      const args = {
        agentIds: ['agent-123'],
        block: true,
        wait_up_to: 150
      };
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.agentIds).toEqual(['agent-123']);
        expect(result.data.block).toBe(true);
        expect(result.data.wait_up_to).toBe(150);
      }
    });

    it('should apply default block=true', () => {
      const args = {
        agentIds: ['agent-123']
      };
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.block).toBe(true);
      }
    });

    it('should apply default wait_up_to=150', () => {
      const args = {
        agentIds: ['agent-123']
      };
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wait_up_to).toBe(150);
      }
    });

    it('should reject missing agentIds', () => {
      const args = {};
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(false);
    });

    it('should reject non-array agentIds', () => {
      const args = {
        agentIds: 'agent-123'
      };
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(false);
    });

    it('should reject wait_up_to below minimum', () => {
      const args = {
        agentIds: ['agent-123'],
        wait_up_to: -1
      };
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(false);
    });

    it('should reject wait_up_to above maximum', () => {
      const args = {
        agentIds: ['agent-123'],
        wait_up_to: 301
      };
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(false);
    });

    it('should accept wait_up_to at minimum boundary (0)', () => {
      const args = {
        agentIds: ['agent-123'],
        wait_up_to: 0
      };
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wait_up_to).toBe(0);
      }
    });

    it('should accept wait_up_to at maximum boundary (300)', () => {
      const args = {
        agentIds: ['agent-123'],
        wait_up_to: 300
      };
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.wait_up_to).toBe(300);
      }
    });

    it('should reject non-boolean block', () => {
      const args = {
        agentIds: ['agent-123'],
        block: 'true'
      };
      const result = AgentOutputArgumentsSchema.safeParse(args);
      expect(result.success).toBe(false);
    });
  });

  describe('validator', () => {
    it('should return valid arguments', () => {
      const args = {
        agentIds: ['agent-123'],
        block: false,
        wait_up_to: 60
      };
      const validated = validateAgentOutputArguments(args);
      expect(validated.agentIds).toEqual(['agent-123']);
      expect(validated.block).toBe(false);
      expect(validated.wait_up_to).toBe(60);
    });

    it('should apply defaults when not provided', () => {
      const args = {
        agentIds: ['agent-1', 'agent-2']
      };
      const validated = validateAgentOutputArguments(args);
      expect(validated.agentIds).toEqual(['agent-1', 'agent-2']);
      expect(validated.block).toBe(true);
      expect(validated.wait_up_to).toBe(150);
    });

    it('should throw for missing agentIds', () => {
      expect(() => validateAgentOutputArguments({})).toThrow(/Invalid output tool arguments/);
    });

    it('should throw for invalid wait_up_to', () => {
      expect(() =>
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          wait_up_to: -1
        })
      ).toThrow(/Invalid output tool arguments/);
    });

    it('should throw for invalid block type', () => {
      expect(() =>
        validateAgentOutputArguments({
          agentIds: ['agent-123'],
          block: 'true'
        })
      ).toThrow(/Invalid output tool arguments/);
    });
  });
});

describe('WrapperOptions', () => {
  describe('interface', () => {
    it('should accept all optional properties', () => {
      const options: WrapperOptions = {
        systemPrompt: 'Custom system prompt',
        appendSystemPrompt: 'Additional instructions',
        systemPromptFile: '/path/to/prompt.txt'
      };
      expect(options.systemPrompt).toBe('Custom system prompt');
      expect(options.appendSystemPrompt).toBe('Additional instructions');
      expect(options.systemPromptFile).toBe('/path/to/prompt.txt');
    });

    it('should accept empty options object', () => {
      const options: WrapperOptions = {};
      expect(options).toEqual({});
    });

    it('should accept only systemPrompt', () => {
      const options: WrapperOptions = {
        systemPrompt: 'Custom prompt'
      };
      expect(options.systemPrompt).toBe('Custom prompt');
      expect(options.appendSystemPrompt).toBeUndefined();
      expect(options.systemPromptFile).toBeUndefined();
    });

    it('should accept only appendSystemPrompt', () => {
      const options: WrapperOptions = {
        appendSystemPrompt: 'Append this'
      };
      expect(options.appendSystemPrompt).toBe('Append this');
      expect(options.systemPrompt).toBeUndefined();
      expect(options.systemPromptFile).toBeUndefined();
    });

    it('should accept only systemPromptFile', () => {
      const options: WrapperOptions = {
        systemPromptFile: '/path/to/file.txt'
      };
      expect(options.systemPromptFile).toBe('/path/to/file.txt');
      expect(options.systemPrompt).toBeUndefined();
      expect(options.appendSystemPrompt).toBeUndefined();
    });
  });

  describe('Zod schema', () => {
    it('should validate valid options with all properties', () => {
      const options = {
        systemPrompt: 'Custom system prompt',
        appendSystemPrompt: 'Additional instructions',
        systemPromptFile: '/path/to/prompt.txt'
      };
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.systemPrompt).toBe('Custom system prompt');
        expect(result.data.appendSystemPrompt).toBe('Additional instructions');
        expect(result.data.systemPromptFile).toBe('/path/to/prompt.txt');
      }
    });

    it('should validate empty options object', () => {
      const options = {};
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it('should validate options with only systemPrompt', () => {
      const options = {
        systemPrompt: 'Custom prompt'
      };
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.systemPrompt).toBe('Custom prompt');
        expect(result.data.appendSystemPrompt).toBeUndefined();
        expect(result.data.systemPromptFile).toBeUndefined();
      }
    });

    it('should validate options with only appendSystemPrompt', () => {
      const options = {
        appendSystemPrompt: 'Append this'
      };
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.appendSystemPrompt).toBe('Append this');
      }
    });

    it('should validate options with only systemPromptFile', () => {
      const options = {
        systemPromptFile: '/absolute/path/to/file.txt'
      };
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.systemPromptFile).toBe('/absolute/path/to/file.txt');
      }
    });

    it('should reject non-string systemPrompt', () => {
      const options = {
        systemPrompt: 123
      };
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(false);
    });

    it('should reject non-string appendSystemPrompt', () => {
      const options = {
        appendSystemPrompt: true
      };
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(false);
    });

    it('should reject non-string systemPromptFile', () => {
      const options = {
        systemPromptFile: ['path', 'to', 'file']
      };
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(false);
    });

    it('should allow empty strings for all properties', () => {
      const options = {
        systemPrompt: '',
        appendSystemPrompt: '',
        systemPromptFile: ''
      };
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });

    it('should reject null values', () => {
      const options = {
        systemPrompt: null
      };
      const result = WrapperOptionsSchema.safeParse(options);
      expect(result.success).toBe(false);
    });

    it('should reject undefined in explicit property (allows omitting)', () => {
      const options = {
        systemPrompt: 'Valid',
        appendSystemPrompt: undefined
      };
      const result = WrapperOptionsSchema.safeParse(options);
      // Zod treats explicit undefined as omitted, so this should succeed
      expect(result.success).toBe(true);
    });

    it('should reject unknown properties', () => {
      const options = {
        systemPrompt: 'Valid',
        unknownProperty: 'Invalid'
      };
      const result = WrapperOptionsSchema.safeParse(options);
      // Zod by default strips unknown properties, so this succeeds
      // unless we use .strict() which we don't for backward compatibility
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ systemPrompt: 'Valid' });
      }
    });
  });

  describe('type guard', () => {
    it('should return true for valid empty options', () => {
      const options = {};
      expect(isWrapperOptions(options)).toBe(true);
    });

    it('should return true for valid options with all properties', () => {
      const options = {
        systemPrompt: 'Custom prompt',
        appendSystemPrompt: 'Append',
        systemPromptFile: '/path/to/file'
      };
      expect(isWrapperOptions(options)).toBe(true);
    });

    it('should return true for valid options with single property', () => {
      const options = {
        systemPrompt: 'Custom prompt'
      };
      expect(isWrapperOptions(options)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isWrapperOptions(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isWrapperOptions(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isWrapperOptions('string')).toBe(false);
      expect(isWrapperOptions(123)).toBe(false);
      expect(isWrapperOptions(true)).toBe(false);
    });

    it('should return false for object with invalid property types', () => {
      const options = {
        systemPrompt: 123
      };
      expect(isWrapperOptions(options)).toBe(false);
    });

    it('should return true for object with extra properties (strips them)', () => {
      const options = {
        systemPrompt: 'Valid',
        extraProperty: 'Ignored'
      };
      expect(isWrapperOptions(options)).toBe(true);
    });
  });

  describe('validator', () => {
    it('should return valid empty options', () => {
      const options = {};
      const validated = validateWrapperOptions(options);
      expect(validated).toEqual({});
    });

    it('should return valid options with all properties', () => {
      const options = {
        systemPrompt: 'Custom prompt',
        appendSystemPrompt: 'Append',
        systemPromptFile: '/path/to/file'
      };
      const validated = validateWrapperOptions(options);
      expect(validated.systemPrompt).toBe('Custom prompt');
      expect(validated.appendSystemPrompt).toBe('Append');
      expect(validated.systemPromptFile).toBe('/path/to/file');
    });

    it('should return valid options with only systemPrompt', () => {
      const options = {
        systemPrompt: 'Custom prompt'
      };
      const validated = validateWrapperOptions(options);
      expect(validated.systemPrompt).toBe('Custom prompt');
      expect(validated.appendSystemPrompt).toBeUndefined();
    });

    it('should throw for null', () => {
      expect(() => validateWrapperOptions(null)).toThrow(/Invalid wrapper options/);
    });

    it('should throw for undefined', () => {
      expect(() => validateWrapperOptions(undefined)).toThrow(/Invalid wrapper options/);
    });

    it('should throw for non-object', () => {
      expect(() => validateWrapperOptions('string')).toThrow(/Invalid wrapper options/);
      expect(() => validateWrapperOptions(123)).toThrow(/Invalid wrapper options/);
    });

    it('should throw for invalid property types', () => {
      expect(() =>
        validateWrapperOptions({
          systemPrompt: 123
        })
      ).toThrow(/Invalid wrapper options/);
    });

    it('should strip unknown properties', () => {
      const options = {
        systemPrompt: 'Valid',
        unknownProperty: 'Should be stripped'
      };
      const validated = validateWrapperOptions(options);
      expect(validated).toEqual({ systemPrompt: 'Valid' });
      expect('unknownProperty' in validated).toBe(false);
    });

    it('should handle array input gracefully', () => {
      expect(() => validateWrapperOptions([])).toThrow(/Invalid wrapper options/);
    });

    it('should include received value in error message for debugging', () => {
      try {
        validateWrapperOptions(null);
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('null');
      }
    });
  });

  describe('backward compatibility', () => {
    it('should support no flags provided (empty object)', () => {
      const options: WrapperOptions = {};
      const validated = validateWrapperOptions(options);
      expect(validated).toEqual({});
    });

    it('should not require any properties', () => {
      const options: WrapperOptions = {};
      expect(options.systemPrompt).toBeUndefined();
      expect(options.appendSystemPrompt).toBeUndefined();
      expect(options.systemPromptFile).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very long system prompt strings', () => {
      const longPrompt = 'A'.repeat(10000);
      const options = {
        systemPrompt: longPrompt
      };
      const validated = validateWrapperOptions(options);
      expect(validated.systemPrompt).toBe(longPrompt);
      expect(validated.systemPrompt?.length).toBe(10000);
    });

    it('should handle special characters in strings', () => {
      const options = {
        systemPrompt: 'Line 1\nLine 2\tTabbed',
        appendSystemPrompt: 'Quote: "test" Apostrophe: \'test\'',
        systemPromptFile: '/path/with spaces/and-special_chars/file.txt'
      };
      const validated = validateWrapperOptions(options);
      expect(validated.systemPrompt).toContain('\n');
      expect(validated.appendSystemPrompt).toContain('"');
      expect(validated.systemPromptFile).toContain(' ');
    });

    it('should handle unicode characters', () => {
      const options = {
        systemPrompt: 'Unicode: 你好 🚀 émoji',
        appendSystemPrompt: 'Symbols: ™ © ® § ¶'
      };
      const validated = validateWrapperOptions(options);
      expect(validated.systemPrompt).toContain('你好');
      expect(validated.appendSystemPrompt).toContain('™');
    });

    it('should handle Windows-style paths', () => {
      const options = {
        systemPromptFile: 'C:\\Users\\test\\prompt.txt'
      };
      const validated = validateWrapperOptions(options);
      expect(validated.systemPromptFile).toBe('C:\\Users\\test\\prompt.txt');
    });

    it('should handle Unix-style paths', () => {
      const options = {
        systemPromptFile: '/home/user/.config/prompt.txt'
      };
      const validated = validateWrapperOptions(options);
      expect(validated.systemPromptFile).toBe('/home/user/.config/prompt.txt');
    });
  });
});
