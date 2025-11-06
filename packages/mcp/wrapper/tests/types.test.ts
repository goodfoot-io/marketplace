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
  getEnvironmentAsRecord
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
