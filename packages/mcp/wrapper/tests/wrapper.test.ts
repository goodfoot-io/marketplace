/**
 * Tests for MCP wrapper server
 */

import { describe, it, expect } from '@jest/globals';
import { parseCliArguments, main } from '../src/wrapper.js';

describe('parseCliArguments', () => {
  describe('single server - stdio transport', () => {
    it('should parse stdio transport with explicit flag', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'clickup',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@hauptsache.net/clickup-mcp'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'clickup',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@hauptsache.net/clickup-mcp']
      });
    });

    it('should parse stdio transport with default (no --transport flag)', () => {
      const argv = ['node', 'wrapper.js', '--', 'clickup', 'npx', '-y', '@hauptsache.net/clickup-mcp'];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'clickup',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@hauptsache.net/clickup-mcp']
      });
    });

    it('should parse stdio transport with command and no args', () => {
      const argv = ['node', 'wrapper.js', '--', 'simple', '--transport', 'stdio', 'my-server'];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'simple',
        transport: 'stdio',
        command: 'my-server',
        args: []
      });
    });

    it('should parse stdio transport with complex args', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'server',
        '--transport',
        'stdio',
        'node',
        'server.js',
        '--port',
        '3000',
        '--debug'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js', '--port', '3000', '--debug']
      });
    });
  });

  describe('single server - HTTP transport', () => {
    it('should parse HTTP transport with https URL', () => {
      const argv = ['node', 'wrapper.js', '--', 'hugging-face', '--transport', 'http', 'https://huggingface.co/mcp'];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'hugging-face',
        transport: 'http',
        url: 'https://huggingface.co/mcp'
      });
    });

    it('should parse HTTP transport with http URL', () => {
      const argv = ['node', 'wrapper.js', '--', 'local', '--transport', 'http', 'http://localhost:3000/mcp'];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'local',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });
    });

    it('should parse HTTP transport with query parameters', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'api',
        '--transport',
        'http',
        'https://api.example.com/mcp?token=abc123&version=v1'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'api',
        transport: 'http',
        url: 'https://api.example.com/mcp?token=abc123&version=v1'
      });
    });
  });

  describe('multiple servers - mixed transports', () => {
    it('should parse two servers with mixed transports (HTTP then stdio)', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'hugging-face',
        '--transport',
        'http',
        'https://huggingface.co/mcp',
        '--',
        'clickup',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@hauptsache.net/clickup-mcp'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'hugging-face',
        transport: 'http',
        url: 'https://huggingface.co/mcp'
      });
      expect(result[1]).toEqual({
        name: 'clickup',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@hauptsache.net/clickup-mcp']
      });
    });

    it('should parse two servers with mixed transports (stdio then HTTP)', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'clickup',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@hauptsache.net/clickup-mcp',
        '--',
        'hugging-face',
        '--transport',
        'http',
        'https://huggingface.co/mcp'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'clickup',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@hauptsache.net/clickup-mcp']
      });
      expect(result[1]).toEqual({
        name: 'hugging-face',
        transport: 'http',
        url: 'https://huggingface.co/mcp'
      });
    });

    it('should parse three servers with mixed transports', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'server1',
        '--transport',
        'http',
        'https://api1.example.com',
        '--',
        'server2',
        '--transport',
        'stdio',
        'node',
        'server2.js',
        '--',
        'server3',
        '--transport',
        'http',
        'https://api3.example.com'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'server1',
        transport: 'http',
        url: 'https://api1.example.com'
      });
      expect(result[1]).toEqual({
        name: 'server2',
        transport: 'stdio',
        command: 'node',
        args: ['server2.js']
      });
      expect(result[2]).toEqual({
        name: 'server3',
        transport: 'http',
        url: 'https://api3.example.com'
      });
    });

    it('should parse multiple servers with default stdio transport', () => {
      const argv = ['node', 'wrapper.js', '--', 'server1', 'node', 'server1.js', '--', 'server2', 'node', 'server2.js'];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'server1',
        transport: 'stdio',
        command: 'node',
        args: ['server1.js']
      });
      expect(result[1]).toEqual({
        name: 'server2',
        transport: 'stdio',
        command: 'node',
        args: ['server2.js']
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when no "--" separator found', () => {
      const argv = ['node', 'wrapper.js', 'clickup', 'npx'];

      expect(() => parseCliArguments(argv)).toThrow('No server configurations provided');
    });

    it('should throw error when no server configurations after "--"', () => {
      const argv = ['node', 'wrapper.js', '--'];

      expect(() => parseCliArguments(argv)).toThrow('No server configurations provided');
    });

    it('should throw error when server name is missing', () => {
      const argv = ['node', 'wrapper.js', '--', '--transport', 'stdio', 'npx'];

      expect(() => parseCliArguments(argv)).toThrow('Server name cannot start with "--"');
    });

    it('should throw error when --transport flag has no value', () => {
      const argv = ['node', 'wrapper.js', '--', 'clickup', '--transport'];

      expect(() => parseCliArguments(argv)).toThrow('--transport flag requires a value');
    });

    it('should throw error when --transport has invalid value', () => {
      const argv = ['node', 'wrapper.js', '--', 'clickup', '--transport', 'websocket', 'ws://example.com'];

      expect(() => parseCliArguments(argv)).toThrow('Invalid transport type "websocket"');
    });

    it('should throw error when stdio transport has no command', () => {
      const argv = ['node', 'wrapper.js', '--', 'clickup', '--transport', 'stdio'];

      expect(() => parseCliArguments(argv)).toThrow('stdio transport requires at least a command');
    });

    it('should throw error when stdio transport (default) has no command', () => {
      const argv = ['node', 'wrapper.js', '--', 'clickup'];

      expect(() => parseCliArguments(argv)).toThrow('stdio transport requires at least a command');
    });

    it('should throw error when HTTP transport has no URL', () => {
      const argv = ['node', 'wrapper.js', '--', 'hugging-face', '--transport', 'http'];

      expect(() => parseCliArguments(argv)).toThrow('http transport requires a URL');
    });

    it('should throw error when HTTP URL is invalid (no protocol)', () => {
      const argv = ['node', 'wrapper.js', '--', 'hugging-face', '--transport', 'http', 'example.com/mcp'];

      expect(() => parseCliArguments(argv)).toThrow('Invalid URL "example.com/mcp"');
    });

    it('should throw error when HTTP URL has wrong protocol', () => {
      const argv = ['node', 'wrapper.js', '--', 'hugging-face', '--transport', 'http', 'ws://example.com/mcp'];

      expect(() => parseCliArguments(argv)).toThrow('Invalid URL "ws://example.com/mcp"');
    });

    it('should throw error when HTTP URL has wrong protocol (ftp)', () => {
      const argv = ['node', 'wrapper.js', '--', 'server', '--transport', 'http', 'ftp://example.com'];

      expect(() => parseCliArguments(argv)).toThrow('Invalid URL "ftp://example.com"');
    });
  });

  describe('edge cases', () => {
    it('should handle server names with hyphens', () => {
      const argv = ['node', 'wrapper.js', '--', 'my-awesome-server', '--transport', 'stdio', 'node', 'server.js'];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('my-awesome-server');
    });

    it('should handle server names with underscores', () => {
      const argv = ['node', 'wrapper.js', '--', 'my_server_name', '--transport', 'stdio', 'node', 'server.js'];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('my_server_name');
    });

    it('should handle commands with absolute paths', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'server',
        '--transport',
        'stdio',
        '/usr/local/bin/custom-server',
        '--config',
        'prod'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'server',
        transport: 'stdio',
        command: '/usr/local/bin/custom-server',
        args: ['--config', 'prod']
      });
    });

    it('should handle URLs with ports', () => {
      const argv = ['node', 'wrapper.js', '--', 'local', '--transport', 'http', 'http://localhost:8080/mcp'];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'local',
        transport: 'http',
        url: 'http://localhost:8080/mcp'
      });
    });

    it('should handle args containing "--" string (not as separator)', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'server',
        '--transport',
        'stdio',
        'node',
        'server.js',
        '--flag',
        '--another-flag'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js', '--flag', '--another-flag']
      });
    });

    it('should skip empty groups created by consecutive "--" separators', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'server1',
        '--transport',
        'stdio',
        'node',
        'server1.js',
        '--',
        '--',
        '--',
        'server2',
        '--transport',
        'stdio',
        'node',
        'server2.js'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('server1');
      expect(result[1]?.name).toBe('server2');
    });

    it('should handle transport flag at different positions (after name)', () => {
      const argv = ['node', 'wrapper.js', '--', 'server', '--transport', 'stdio', 'node', 'server.js'];
      const result = parseCliArguments(argv);

      expect(result[0]?.transport).toBe('stdio');
    });
  });

  describe('HTTP header parsing', () => {
    it('should parse single header with -H flag', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'github',
        '--transport',
        'http',
        'https://api.github.com/mcp',
        '-H',
        'Authorization: Bearer token123'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'github',
        transport: 'http',
        url: 'https://api.github.com/mcp',
        headers: {
          Authorization: 'Bearer token123'
        }
      });
    });

    it('should parse single header with --header flag', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'api',
        '--transport',
        'http',
        'https://api.example.com',
        '--header',
        'X-API-Key: secret'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'api',
        transport: 'http',
        url: 'https://api.example.com',
        headers: {
          'X-API-Key': 'secret'
        }
      });
    });

    it('should parse multiple headers', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'api',
        '--transport',
        'http',
        'https://api.example.com',
        '-H',
        'Authorization: Bearer token',
        '-H',
        'Content-Type: application/json',
        '--header',
        'X-Custom-Header: value'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'api',
        transport: 'http',
        url: 'https://api.example.com',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value'
        }
      });
    });

    it('should parse header with colon in value', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'api',
        '--transport',
        'http',
        'https://api.example.com',
        '-H',
        'X-Custom: value:with:colons'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'api',
        transport: 'http',
        url: 'https://api.example.com',
        headers: {
          'X-Custom': 'value:with:colons'
        }
      });
    });

    it('should trim whitespace from header name and value', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'api',
        '--transport',
        'http',
        'https://api.example.com',
        '-H',
        '  Authorization  :  Bearer token  '
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'api',
        transport: 'http',
        url: 'https://api.example.com',
        headers: {
          Authorization: 'Bearer token'
        }
      });
    });

    it('should not include headers field if no headers provided', () => {
      const argv = ['node', 'wrapper.js', '--', 'api', '--transport', 'http', 'https://api.example.com'];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'api',
        transport: 'http',
        url: 'https://api.example.com'
      });
      expect(result[0]?.headers).toBeUndefined();
    });

    it('should throw error when -H flag has no value', () => {
      const argv = ['node', 'wrapper.js', '--', 'api', '--transport', 'http', 'https://api.example.com', '-H'];

      expect(() => parseCliArguments(argv)).toThrow('Server "api": -H flag requires a value');
    });

    it('should throw error when --header flag has no value', () => {
      const argv = ['node', 'wrapper.js', '--', 'api', '--transport', 'http', 'https://api.example.com', '--header'];

      expect(() => parseCliArguments(argv)).toThrow('Server "api": --header flag requires a value');
    });

    it('should throw error when header has no colon', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'api',
        '--transport',
        'http',
        'https://api.example.com',
        '-H',
        'InvalidHeader'
      ];

      expect(() => parseCliArguments(argv)).toThrow(
        'Server "api": Invalid header format "InvalidHeader". Expected "Header-Name: Header-Value"'
      );
    });

    it('should throw error when header name is empty', () => {
      const argv = ['node', 'wrapper.js', '--', 'api', '--transport', 'http', 'https://api.example.com', '-H', ': value'];

      expect(() => parseCliArguments(argv)).toThrow('Server "api": Header name cannot be empty in ": value"');
    });

    it('should allow header with empty value', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'api',
        '--transport',
        'http',
        'https://api.example.com',
        '-H',
        'X-Empty:'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'api',
        transport: 'http',
        url: 'https://api.example.com',
        headers: {
          'X-Empty': ''
        }
      });
    });

    it('should parse headers with stdio transport (headers are ignored for stdio)', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'server',
        '--transport',
        'stdio',
        'node',
        'server.js',
        '-H',
        'X-Header: value'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js', '-H', 'X-Header: value']
      });
    });

    it('should parse headers in complex multi-server scenario', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--',
        'github',
        '--transport',
        'http',
        'https://api.github.com/mcp',
        '-H',
        'Authorization: Bearer gh_token',
        '-H',
        'Accept: application/vnd.github.v3+json',
        '--',
        'clickup',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@hauptsache.net/clickup-mcp',
        '--',
        'custom-api',
        '--transport',
        'http',
        'https://custom.api.com',
        '--header',
        'X-API-Key: custom_key'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'github',
        transport: 'http',
        url: 'https://api.github.com/mcp',
        headers: {
          Authorization: 'Bearer gh_token',
          Accept: 'application/vnd.github.v3+json'
        }
      });
      expect(result[1]).toEqual({
        name: 'clickup',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@hauptsache.net/clickup-mcp']
      });
      expect(result[2]).toEqual({
        name: 'custom-api',
        transport: 'http',
        url: 'https://custom.api.com',
        headers: {
          'X-API-Key': 'custom_key'
        }
      });
    });
  });

  describe('real-world examples from plan', () => {
    it('should parse example from plan: single stdio with npx', () => {
      // Example: npx -y @goodfoot/mcp-wrapper-server -- clickup --transport stdio npx -y @hauptsache.net/clickup-mcp
      const argv = [
        'npx',
        '@goodfoot/mcp-wrapper-server',
        '--',
        'clickup',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@hauptsache.net/clickup-mcp'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'clickup',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@hauptsache.net/clickup-mcp']
      });
    });

    it('should parse example from plan: single HTTP', () => {
      // Example: npx -y @goodfoot/mcp-wrapper-server -- hugging-face --transport http https://huggingface.co/mcp
      const argv = [
        'npx',
        '@goodfoot/mcp-wrapper-server',
        '--',
        'hugging-face',
        '--transport',
        'http',
        'https://huggingface.co/mcp'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'hugging-face',
        transport: 'http',
        url: 'https://huggingface.co/mcp'
      });
    });

    it('should parse example from plan: multiple mixed transports', () => {
      // Example from plan: both hugging-face (http) and clickup (stdio)
      const argv = [
        'npx',
        '@goodfoot/mcp-wrapper-server',
        '--',
        'hugging-face',
        '--transport',
        'http',
        'https://huggingface.co/mcp',
        '--',
        'clickup',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@hauptsache.net/clickup-mcp'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'hugging-face',
        transport: 'http',
        url: 'https://huggingface.co/mcp'
      });
      expect(result[1]).toEqual({
        name: 'clickup',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@hauptsache.net/clickup-mcp']
      });
    });

    it('should parse configuration from .claude/settings.json example', () => {
      // From plan: "args": ["-y", "@goodfoot/mcp-wrapper-server", "--", "hugging-face", "--transport", "http", ...]
      const argv = [
        'npx',
        '-y',
        '@goodfoot/mcp-wrapper-server',
        '--',
        'hugging-face',
        '--transport',
        'http',
        'https://huggingface.co/mcp',
        '--',
        'clickup',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@hauptsache.net/clickup-mcp'
      ];
      const result = parseCliArguments(argv);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('hugging-face');
      expect(result[0]?.transport).toBe('http');
      expect(result[1]?.name).toBe('clickup');
      expect(result[1]?.transport).toBe('stdio');
    });
  });
});

describe('main', () => {
  describe('startup behavior', () => {
    it('should throw error when invoked without server configurations', async () => {
      // Mock process.argv to simulate no "--" separator
      const originalArgv = process.argv;
      process.argv = ['node', 'wrapper.js'];

      try {
        await expect(main()).rejects.toThrow('No server configurations provided');
      } finally {
        process.argv = originalArgv;
      }
    });

    it('should throw error when invoked with invalid server configuration', async () => {
      // Mock process.argv to simulate invalid config (stdio without command)
      const originalArgv = process.argv;
      process.argv = ['node', 'wrapper.js', '--', 'test-server'];

      try {
        await expect(main()).rejects.toThrow('stdio transport requires at least a command');
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('error handling', () => {
    it('should propagate errors from parseCliArguments', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'wrapper.js', '--', '--invalid'];

      try {
        await expect(main()).rejects.toThrow('Server name cannot start with "--"');
      } finally {
        process.argv = originalArgv;
      }
    });
  });
});
