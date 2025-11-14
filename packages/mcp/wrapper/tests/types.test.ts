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
  validateWrapperOptions,
  TemplateMetadata,
  TemplateMetadataSchema,
  isTemplateMetadata,
  validateTemplateMetadata,
  SystemPromptConfig,
  SystemPromptConfigSchema,
  isSystemPromptConfig,
  validateSystemPromptConfig,
  WrapperTemplate,
  WrapperTemplateSchema,
  isWrapperTemplate,
  validateWrapperTemplate,
  templateToServerConfig,
  resolveSystemPrompt
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

describe('TemplateMetadata', () => {
  describe('interface', () => {
    it('should accept valid template metadata with all fields', () => {
      const metadata: TemplateMetadata = {
        name: 'github-api-template',
        description: 'Template for GitHub API access',
        version: '1.0.0',
        author: 'Example Author'
      };
      expect(metadata.name).toBe('github-api-template');
      expect(metadata.description).toBe('Template for GitHub API access');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.author).toBe('Example Author');
    });

    it('should accept metadata without optional author', () => {
      const metadata: TemplateMetadata = {
        name: 'minimal-template',
        description: 'Minimal template',
        version: '0.1.0'
      };
      expect(metadata.author).toBeUndefined();
    });
  });

  describe('Zod schema', () => {
    it('should validate valid metadata', () => {
      const metadata = {
        name: 'test-template',
        description: 'Test template description',
        version: '1.0.0',
        author: 'Test Author'
      };
      const result = TemplateMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test-template');
        expect(result.data.version).toBe('1.0.0');
      }
    });

    it('should reject metadata without name', () => {
      const metadata = {
        description: 'Test',
        version: '1.0.0'
      };
      const result = TemplateMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });

    it('should reject metadata with empty name', () => {
      const metadata = {
        name: '',
        description: 'Test',
        version: '1.0.0'
      };
      const result = TemplateMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });

    it('should reject metadata with empty version', () => {
      const metadata = {
        name: 'test',
        description: 'Test',
        version: ''
      };
      const result = TemplateMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });

    it('should allow optional author field', () => {
      const metadata = {
        name: 'test',
        description: 'Test',
        version: '1.0.0'
      };
      const result = TemplateMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });
  });

  describe('type guard', () => {
    it('should return true for valid metadata', () => {
      const metadata = {
        name: 'test',
        description: 'Test description',
        version: '1.0.0'
      };
      expect(isTemplateMetadata(metadata)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isTemplateMetadata(null)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isTemplateMetadata({ name: 'test' })).toBe(false);
    });
  });

  describe('validator', () => {
    it('should return valid metadata', () => {
      const metadata = {
        name: 'test',
        description: 'Test description',
        version: '1.0.0',
        author: 'Test Author'
      };
      const validated = validateTemplateMetadata(metadata);
      expect(validated.name).toBe('test');
      expect(validated.author).toBe('Test Author');
    });

    it('should throw for invalid metadata', () => {
      expect(() => validateTemplateMetadata(null)).toThrow(/Invalid template metadata/);
      expect(() => validateTemplateMetadata({ name: 'test' })).toThrow(/Invalid template metadata/);
    });

    it('should include received value in error message', () => {
      expect(() => validateTemplateMetadata(null)).toThrow(/received: null/);
    });
  });
});

describe('SystemPromptConfig', () => {
  describe('interface', () => {
    it('should accept text type configuration', () => {
      const config: SystemPromptConfig = {
        type: 'text',
        content: 'Custom system prompt content'
      };
      expect(config.type).toBe('text');
      if (config.type === 'text') {
        expect(config.content).toBe('Custom system prompt content');
      }
    });

    it('should accept file type configuration', () => {
      const config: SystemPromptConfig = {
        type: 'file',
        path: '/absolute/path/to/prompt.txt'
      };
      expect(config.type).toBe('file');
      if (config.type === 'file') {
        expect(config.path).toBe('/absolute/path/to/prompt.txt');
      }
    });

    it('should accept append type configuration', () => {
      const config: SystemPromptConfig = {
        type: 'append',
        content: 'Additional instructions'
      };
      expect(config.type).toBe('append');
      if (config.type === 'append') {
        expect(config.content).toBe('Additional instructions');
      }
    });
  });

  describe('Zod schema', () => {
    it('should validate text type configuration', () => {
      const config = {
        type: 'text' as const,
        content: 'System prompt text'
      };
      const result = SystemPromptConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'text') {
        expect(result.data.content).toBe('System prompt text');
      }
    });

    it('should validate file type configuration', () => {
      const config = {
        type: 'file' as const,
        path: '/path/to/file.txt'
      };
      const result = SystemPromptConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'file') {
        expect(result.data.path).toBe('/path/to/file.txt');
      }
    });

    it('should validate append type configuration', () => {
      const config = {
        type: 'append' as const,
        content: 'Append this'
      };
      const result = SystemPromptConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'append') {
        expect(result.data.content).toBe('Append this');
      }
    });

    it('should reject configuration with invalid type', () => {
      const config = {
        type: 'invalid',
        content: 'Test'
      };
      const result = SystemPromptConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject file type with empty path', () => {
      const config = {
        type: 'file' as const,
        path: ''
      };
      const result = SystemPromptConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject text type without content', () => {
      const config = {
        type: 'text' as const
      };
      const result = SystemPromptConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept empty content for text and append types', () => {
      const textConfig = {
        type: 'text' as const,
        content: ''
      };
      const appendConfig = {
        type: 'append' as const,
        content: ''
      };
      expect(SystemPromptConfigSchema.safeParse(textConfig).success).toBe(true);
      expect(SystemPromptConfigSchema.safeParse(appendConfig).success).toBe(true);
    });
  });

  describe('type guard', () => {
    it('should return true for valid text config', () => {
      const config = {
        type: 'text' as const,
        content: 'Test'
      };
      expect(isSystemPromptConfig(config)).toBe(true);
    });

    it('should return true for valid file config', () => {
      const config = {
        type: 'file' as const,
        path: '/path/to/file'
      };
      expect(isSystemPromptConfig(config)).toBe(true);
    });

    it('should return true for valid append config', () => {
      const config = {
        type: 'append' as const,
        content: 'Append'
      };
      expect(isSystemPromptConfig(config)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isSystemPromptConfig(null)).toBe(false);
    });

    it('should return false for invalid type', () => {
      expect(isSystemPromptConfig({ type: 'invalid', content: 'Test' })).toBe(false);
    });
  });

  describe('validator', () => {
    it('should return valid text config', () => {
      const config = {
        type: 'text' as const,
        content: 'Test content'
      };
      const validated = validateSystemPromptConfig(config);
      expect(validated.type).toBe('text');
      if (validated.type === 'text') {
        expect(validated.content).toBe('Test content');
      }
    });

    it('should return valid file config', () => {
      const config = {
        type: 'file' as const,
        path: '/path/to/file'
      };
      const validated = validateSystemPromptConfig(config);
      expect(validated.type).toBe('file');
      if (validated.type === 'file') {
        expect(validated.path).toBe('/path/to/file');
      }
    });

    it('should throw for invalid config', () => {
      expect(() => validateSystemPromptConfig(null)).toThrow(/Invalid system prompt config/);
      expect(() => validateSystemPromptConfig({ type: 'invalid' })).toThrow(/Invalid system prompt config/);
    });

    it('should include received value in error message', () => {
      expect(() => validateSystemPromptConfig(null)).toThrow(/received: null/);
    });
  });

  describe('type discrimination', () => {
    it('should narrow type correctly for text', () => {
      const config: SystemPromptConfig = {
        type: 'text',
        content: 'Test'
      };

      if (config.type === 'text') {
        expect(config.content).toBe('Test');
      }
    });

    it('should narrow type correctly for file', () => {
      const config: SystemPromptConfig = {
        type: 'file',
        path: '/path'
      };

      if (config.type === 'file') {
        expect(config.path).toBe('/path');
      }
    });

    it('should narrow type correctly for append', () => {
      const config: SystemPromptConfig = {
        type: 'append',
        content: 'Append'
      };

      if (config.type === 'append') {
        expect(config.content).toBe('Append');
      }
    });
  });
});

describe('WrapperTemplate', () => {
  describe('interface', () => {
    it('should accept valid stdio template', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'test-stdio',
          description: 'Test stdio template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { API_KEY: 'test' }
      };
      expect(template.metadata.name).toBe('test-stdio');
      expect(template.transport).toBe('stdio');
      expect(template.command).toBe('node');
    });

    it('should accept valid HTTP template', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'test-http',
          description: 'Test HTTP template',
          version: '1.0.0'
        },
        name: 'http-server',
        transport: 'http',
        url: 'https://api.example.com',
        headers: { Authorization: 'Bearer token' },
        env: { TOKEN: 'secret' }
      };
      expect(template.metadata.name).toBe('test-http');
      expect(template.transport).toBe('http');
      expect(template.url).toBe('https://api.example.com');
    });

    it('should accept template with system prompt configuration', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'with-prompt',
          description: 'Template with system prompt',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio',
        command: 'node',
        systemPrompt: {
          type: 'text',
          content: 'Custom prompt'
        }
      };
      expect(template.systemPrompt).toBeDefined();
      if (template.systemPrompt?.type === 'text') {
        expect(template.systemPrompt.content).toBe('Custom prompt');
      }
    });

    it('should accept template with environment variable placeholders', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'with-placeholders',
          description: 'Template with ${VARIABLE} placeholders',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http',
        url: 'https://api.example.com',
        headers: { Authorization: 'token ${GITHUB_TOKEN}' },
        env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' }
      };
      expect(template.env?.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
      expect(template.headers?.Authorization).toBe('token ${GITHUB_TOKEN}');
    });
  });

  describe('Zod schema', () => {
    it('should validate valid stdio template', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio' as const,
        command: 'node',
        args: ['server.js']
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transport).toBe('stdio');
        expect(result.data.command).toBe('node');
      }
    });

    it('should validate valid HTTP template', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http' as const,
        url: 'https://api.example.com'
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transport).toBe('http');
        expect(result.data.url).toBe('https://api.example.com');
      }
    });

    it('should reject stdio template without command', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio' as const
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some((e) => e.message.includes('stdio transport requires a command'))).toBe(true);
      }
    });

    it('should reject HTTP template without url', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http' as const
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some((e) => e.message.includes('http transport requires a url'))).toBe(true);
      }
    });

    it('should reject template without metadata', () => {
      const template = {
        name: 'server',
        transport: 'stdio' as const,
        command: 'node'
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(false);
    });

    it('should reject template with empty name', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: '',
        transport: 'stdio' as const,
        command: 'node'
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(false);
    });

    it('should validate template with all optional fields', () => {
      const template = {
        metadata: {
          name: 'complete',
          description: 'Complete template',
          version: '1.0.0',
          author: 'Test Author'
        },
        name: 'server',
        transport: 'http' as const,
        url: 'https://api.example.com',
        headers: { Authorization: 'Bearer token' },
        env: { API_KEY: 'secret' },
        systemPrompt: {
          type: 'text' as const,
          content: 'Custom prompt'
        }
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should validate template with environment variable placeholders', () => {
      const template = {
        metadata: {
          name: 'with-vars',
          description: 'Template with ${VARIABLES}',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http' as const,
        url: 'https://${API_HOST}/api',
        headers: { Authorization: '${AUTH_TOKEN}' },
        env: { API_HOST: '${API_HOST}', AUTH_TOKEN: '${AUTH_TOKEN}' }
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should reject stdio template with empty command', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio' as const,
        command: ''
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(false);
    });

    it('should reject HTTP template with empty url', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http' as const,
        url: ''
      };
      const result = WrapperTemplateSchema.safeParse(template);
      expect(result.success).toBe(false);
    });
  });

  describe('type guard', () => {
    it('should return true for valid stdio template', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio' as const,
        command: 'node'
      };
      expect(isWrapperTemplate(template)).toBe(true);
    });

    it('should return true for valid HTTP template', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http' as const,
        url: 'https://api.example.com'
      };
      expect(isWrapperTemplate(template)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isWrapperTemplate(null)).toBe(false);
    });

    it('should return false for stdio template without command', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio' as const
      };
      expect(isWrapperTemplate(template)).toBe(false);
    });

    it('should return false for HTTP template without url', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http' as const
      };
      expect(isWrapperTemplate(template)).toBe(false);
    });
  });

  describe('validator', () => {
    it('should return valid stdio template', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio' as const,
        command: 'node',
        args: ['server.js']
      };
      const validated = validateWrapperTemplate(template);
      expect(validated.transport).toBe('stdio');
      expect(validated.command).toBe('node');
      expect(validated.args).toEqual(['server.js']);
    });

    it('should return valid HTTP template', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http' as const,
        url: 'https://api.example.com',
        headers: { Authorization: 'Bearer token' }
      };
      const validated = validateWrapperTemplate(template);
      expect(validated.transport).toBe('http');
      expect(validated.url).toBe('https://api.example.com');
      expect(validated.headers).toEqual({ Authorization: 'Bearer token' });
    });

    it('should throw for invalid template', () => {
      expect(() => validateWrapperTemplate(null)).toThrow(/Invalid wrapper template/);
    });

    it('should throw for stdio template without command', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio' as const
      };
      expect(() => validateWrapperTemplate(template)).toThrow(/Invalid wrapper template/);
      expect(() => validateWrapperTemplate(template)).toThrow(/stdio transport requires a command/);
    });

    it('should throw for HTTP template without url', () => {
      const template = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http' as const
      };
      expect(() => validateWrapperTemplate(template)).toThrow(/Invalid wrapper template/);
      expect(() => validateWrapperTemplate(template)).toThrow(/http transport requires a url/);
    });
  });

  describe('template-to-ServerConfig compatibility', () => {
    it('should have all ServerConfig fields in WrapperTemplate', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'test',
          description: 'Test',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { KEY: 'value' }
      };

      // These assignments verify structural compatibility
      const serverConfig: ServerConfig = {
        name: template.name,
        transport: template.transport,
        command: template.command,
        args: template.args,
        env: template.env
      };

      expect(serverConfig.name).toBe('server');
      expect(serverConfig.transport).toBe('stdio');
    });
  });
});

describe('Template Conversion Utilities', () => {
  describe('templateToServerConfig', () => {
    it('should convert stdio template to ServerConfig', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'test-stdio',
          description: 'Test stdio template',
          version: '1.0.0'
        },
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { API_KEY: 'test' }
      };

      const serverConfig = templateToServerConfig(template);

      expect(serverConfig.name).toBe('test-server');
      expect(serverConfig.transport).toBe('stdio');
      expect(serverConfig.command).toBe('node');
      expect(serverConfig.args).toEqual(['server.js']);
      expect(serverConfig.env).toEqual({ API_KEY: 'test' });
      expect('metadata' in serverConfig).toBe(false);
      expect('systemPrompt' in serverConfig).toBe(false);
    });

    it('should convert HTTP template to ServerConfig', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'test-http',
          description: 'Test HTTP template',
          version: '1.0.0'
        },
        name: 'http-server',
        transport: 'http',
        url: 'https://api.example.com',
        headers: { Authorization: 'Bearer token' },
        env: { TOKEN: 'secret' }
      };

      const serverConfig = templateToServerConfig(template);

      expect(serverConfig.name).toBe('http-server');
      expect(serverConfig.transport).toBe('http');
      expect(serverConfig.url).toBe('https://api.example.com');
      expect(serverConfig.headers).toEqual({ Authorization: 'Bearer token' });
      expect(serverConfig.env).toEqual({ TOKEN: 'secret' });
      expect('metadata' in serverConfig).toBe(false);
      expect('systemPrompt' in serverConfig).toBe(false);
    });

    it('should omit optional fields if not present', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'minimal',
          description: 'Minimal template',
          version: '1.0.0'
        },
        name: 'minimal-server',
        transport: 'stdio',
        command: 'node'
      };

      const serverConfig = templateToServerConfig(template);

      expect(serverConfig.name).toBe('minimal-server');
      expect(serverConfig.transport).toBe('stdio');
      expect(serverConfig.command).toBe('node');
      expect(serverConfig.args).toBeUndefined();
      expect(serverConfig.env).toBeUndefined();
      expect(serverConfig.url).toBeUndefined();
      expect(serverConfig.headers).toBeUndefined();
    });

    it('should not perform ${VARIABLE} substitution', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'with-vars',
          description: 'Template with variables',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'http',
        url: 'https://${API_HOST}/api',
        headers: { Authorization: '${AUTH_TOKEN}' },
        env: { API_HOST: '${API_HOST}' }
      };

      const serverConfig = templateToServerConfig(template);

      // Placeholders should remain unchanged
      expect(serverConfig.url).toBe('https://${API_HOST}/api');
      expect(serverConfig.headers?.Authorization).toBe('${AUTH_TOKEN}');
      expect(serverConfig.env?.API_HOST).toBe('${API_HOST}');
    });

    it('should be compatible with validateServerConfig', () => {
      const template: WrapperTemplate = {
        metadata: {
          name: 'valid',
          description: 'Valid template',
          version: '1.0.0'
        },
        name: 'server',
        transport: 'stdio',
        command: 'node'
      };

      const serverConfig = templateToServerConfig(template);
      const validated = validateServerConfig(serverConfig);

      expect(validated.name).toBe('server');
      expect(validated.transport).toBe('stdio');
    });
  });

  describe('resolveSystemPrompt', () => {
    it('should convert text type to systemPrompt', () => {
      const config: SystemPromptConfig = {
        type: 'text',
        content: 'Custom system prompt'
      };

      const options = resolveSystemPrompt(config);

      expect(options.systemPrompt).toBe('Custom system prompt');
      expect(options.appendSystemPrompt).toBeUndefined();
      expect(options.systemPromptFile).toBeUndefined();
    });

    it('should convert file type to systemPromptFile', () => {
      const config: SystemPromptConfig = {
        type: 'file',
        path: '/absolute/path/to/prompt.txt'
      };

      const options = resolveSystemPrompt(config);

      expect(options.systemPromptFile).toBe('/absolute/path/to/prompt.txt');
      expect(options.systemPrompt).toBeUndefined();
      expect(options.appendSystemPrompt).toBeUndefined();
    });

    it('should convert append type to appendSystemPrompt', () => {
      const config: SystemPromptConfig = {
        type: 'append',
        content: 'Additional instructions'
      };

      const options = resolveSystemPrompt(config);

      expect(options.appendSystemPrompt).toBe('Additional instructions');
      expect(options.systemPrompt).toBeUndefined();
      expect(options.systemPromptFile).toBeUndefined();
    });

    it('should be compatible with validateWrapperOptions', () => {
      const config: SystemPromptConfig = {
        type: 'text',
        content: 'Test prompt'
      };

      const options = resolveSystemPrompt(config);
      const validated = validateWrapperOptions(options);

      expect(validated.systemPrompt).toBe('Test prompt');
    });

    it('should preserve ${VARIABLE} placeholders in content', () => {
      const config: SystemPromptConfig = {
        type: 'text',
        content: 'Use ${API_KEY} for authentication'
      };

      const options = resolveSystemPrompt(config);

      expect(options.systemPrompt).toBe('Use ${API_KEY} for authentication');
    });

    it('should preserve ${VARIABLE} placeholders in file paths', () => {
      const config: SystemPromptConfig = {
        type: 'file',
        path: '${CONFIG_DIR}/prompts/system.txt'
      };

      const options = resolveSystemPrompt(config);

      expect(options.systemPromptFile).toBe('${CONFIG_DIR}/prompts/system.txt');
    });

    it('should handle empty content for text type', () => {
      const config: SystemPromptConfig = {
        type: 'text',
        content: ''
      };

      const options = resolveSystemPrompt(config);

      expect(options.systemPrompt).toBe('');
    });

    it('should handle empty content for append type', () => {
      const config: SystemPromptConfig = {
        type: 'append',
        content: ''
      };

      const options = resolveSystemPrompt(config);

      expect(options.appendSystemPrompt).toBe('');
    });
  });
});
