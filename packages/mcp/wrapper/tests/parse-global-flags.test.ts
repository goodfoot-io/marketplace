/**
 * Tests for parseGlobalFlags function
 * Tests the parsing of global CLI flags before server configurations
 */

import type { WrapperOptions } from '../src/types/wrapper.js';
import { describe, it, expect } from '@jest/globals';
import { parseGlobalFlags } from '../src/wrapper.js';

describe('parseGlobalFlags', () => {
  describe('basic functionality', () => {
    it('should return empty options when no flags are provided', () => {
      const argv = ['node', 'wrapper.js', '--', 'server-name', 'command'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({});
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--', 'server-name', 'command']);
    });

    it('should return empty options when argv ends before first "--"', () => {
      const argv = ['node', 'wrapper.js'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({});
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js']);
    });

    it('should extract --system-prompt flag with value', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', 'Custom prompt', '--', 'server-name', 'command'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'Custom prompt'
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--', 'server-name', 'command']);
    });

    it('should extract --append-system-prompt flag with value', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--append-system-prompt',
        'Additional context',
        '--',
        'server-name',
        'command'
      ];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        appendSystemPrompt: 'Additional context'
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--', 'server-name', 'command']);
    });

    it('should extract --system-prompt-file flag with value', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--system-prompt-file',
        '/path/to/prompt.txt',
        '--',
        'server-name',
        'command'
      ];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPromptFile: '/path/to/prompt.txt'
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--', 'server-name', 'command']);
    });
  });

  describe('multiple flags handling', () => {
    it('should handle multiple global flags in any order', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--other-flag',
        'value',
        '--system-prompt',
        'My prompt',
        '--another-flag',
        '--',
        'server-name',
        'command'
      ];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'My prompt'
      });
      // Other flags should be preserved in remaining argv
      expect(result.remainingArgv).toEqual([
        'node',
        'wrapper.js',
        '--other-flag',
        'value',
        '--another-flag',
        '--',
        'server-name',
        'command'
      ]);
    });

    it('should preserve flags that are not system prompt flags', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--some-flag',
        'value',
        '--system-prompt',
        'Prompt',
        '--another',
        '--',
        'server'
      ];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'Prompt'
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--some-flag', 'value', '--another', '--', 'server']);
    });
  });

  describe('validation - mutual exclusivity', () => {
    it('should throw error when --system-prompt and --append-system-prompt are both provided', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--system-prompt',
        'Prompt 1',
        '--append-system-prompt',
        'Prompt 2',
        '--',
        'server'
      ];

      expect(() => parseGlobalFlags(argv)).toThrow(
        'Only one system prompt flag can be used at a time: --system-prompt, --append-system-prompt, or --system-prompt-file'
      );
    });

    it('should throw error when --system-prompt and --system-prompt-file are both provided', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--system-prompt',
        'Prompt',
        '--system-prompt-file',
        '/path/to/file',
        '--',
        'server'
      ];

      expect(() => parseGlobalFlags(argv)).toThrow(
        'Only one system prompt flag can be used at a time: --system-prompt, --append-system-prompt, or --system-prompt-file'
      );
    });

    it('should throw error when --append-system-prompt and --system-prompt-file are both provided', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--append-system-prompt',
        'Append',
        '--system-prompt-file',
        '/path/to/file',
        '--',
        'server'
      ];

      expect(() => parseGlobalFlags(argv)).toThrow(
        'Only one system prompt flag can be used at a time: --system-prompt, --append-system-prompt, or --system-prompt-file'
      );
    });

    it('should throw error when all three system prompt flags are provided', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--system-prompt',
        'Prompt',
        '--append-system-prompt',
        'Append',
        '--system-prompt-file',
        '/path/to/file',
        '--',
        'server'
      ];

      expect(() => parseGlobalFlags(argv)).toThrow(
        'Only one system prompt flag can be used at a time: --system-prompt, --append-system-prompt, or --system-prompt-file'
      );
    });
  });

  describe('error handling - missing values', () => {
    it('should throw error when --system-prompt has no value', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', '--', 'server', 'command'];

      expect(() => parseGlobalFlags(argv)).toThrow('--system-prompt flag requires a value');
    });

    it('should throw error when --append-system-prompt has no value', () => {
      const argv = ['node', 'wrapper.js', '--append-system-prompt', '--', 'server', 'command'];

      expect(() => parseGlobalFlags(argv)).toThrow('--append-system-prompt flag requires a value');
    });

    it('should throw error when --system-prompt-file has no value', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt-file', '--', 'server', 'command'];

      expect(() => parseGlobalFlags(argv)).toThrow('--system-prompt-file flag requires a value');
    });

    it('should throw error when --system-prompt is at end of argv without value', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt'];

      expect(() => parseGlobalFlags(argv)).toThrow('--system-prompt flag requires a value');
    });

    it('should throw error when --append-system-prompt is at end of argv without value', () => {
      const argv = ['node', 'wrapper.js', '--append-system-prompt'];

      expect(() => parseGlobalFlags(argv)).toThrow('--append-system-prompt flag requires a value');
    });

    it('should throw error when --system-prompt-file is at end of argv without value', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt-file'];

      expect(() => parseGlobalFlags(argv)).toThrow('--system-prompt-file flag requires a value');
    });
  });

  describe('edge cases', () => {
    it('should handle empty argv array', () => {
      const argv: string[] = [];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({});
      expect(result.remainingArgv).toEqual([]);
    });

    it('should handle argv with only script name', () => {
      const argv = ['node', 'wrapper.js'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({});
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js']);
    });

    it('should handle system prompt with empty string value', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', '', '--', 'server', 'command'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: ''
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--', 'server', 'command']);
    });

    it('should handle append system prompt with empty string value', () => {
      const argv = ['node', 'wrapper.js', '--append-system-prompt', '', '--', 'server', 'command'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        appendSystemPrompt: ''
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--', 'server', 'command']);
    });

    it('should handle system prompt file with empty string value', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt-file', '', '--', 'server', 'command'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPromptFile: ''
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--', 'server', 'command']);
    });

    it('should handle values that start with dashes', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', '--not-a-flag', '--', 'server', 'command'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: '--not-a-flag'
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--', 'server', 'command']);
    });

    it('should handle multi-word prompt values', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--system-prompt',
        'You are a helpful assistant with multiple capabilities',
        '--',
        'server'
      ];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'You are a helpful assistant with multiple capabilities'
      });
    });

    it('should handle file paths with spaces', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt-file', '/path/to/my file.txt', '--', 'server'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPromptFile: '/path/to/my file.txt'
      });
    });

    it('should handle Windows-style paths', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt-file', 'C:\\Users\\user\\prompt.txt', '--', 'server'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPromptFile: 'C:\\Users\\user\\prompt.txt'
      });
    });

    it('should handle relative paths in --system-prompt-file', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt-file', './prompts/custom.txt', '--', 'server'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPromptFile: './prompts/custom.txt'
      });
    });

    it('should handle special characters in prompt values', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', 'Prompt with "quotes" and $pecial ch@rs!', '--', 'server'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'Prompt with "quotes" and $pecial ch@rs!'
      });
    });

    it('should handle unicode characters in prompt values', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', '你好世界 🌍', '--', 'server'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: '你好世界 🌍'
      });
    });
  });

  describe('position independence', () => {
    it('should extract flag at the beginning of argv', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', 'Prompt', '--', 'server'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'Prompt'
      });
    });

    it('should extract flag in the middle of global flags', () => {
      const argv = ['node', 'wrapper.js', '--foo', 'bar', '--system-prompt', 'Prompt', '--baz', '--', 'server'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'Prompt'
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--foo', 'bar', '--baz', '--', 'server']);
    });

    it('should extract flag just before "--" separator', () => {
      const argv = ['node', 'wrapper.js', '--foo', '--system-prompt', 'Prompt', '--', 'server'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'Prompt'
      });
      expect(result.remainingArgv).toEqual(['node', 'wrapper.js', '--foo', '--', 'server']);
    });
  });

  describe('backward compatibility', () => {
    it('should not affect server configuration parsing when no system prompt flags', () => {
      const argv = ['node', 'wrapper.js', '--', 'server-name', '--transport', 'stdio', 'npx', '-y', '@test/server'];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({});
      expect(result.remainingArgv).toEqual([
        'node',
        'wrapper.js',
        '--',
        'server-name',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@test/server'
      ]);
    });

    it('should preserve server flags after extraction', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--system-prompt',
        'Prompt',
        '--',
        'server-name',
        '--transport',
        'http',
        'https://example.com',
        '--',
        'server2',
        'command'
      ];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'Prompt'
      });
      expect(result.remainingArgv).toEqual([
        'node',
        'wrapper.js',
        '--',
        'server-name',
        '--transport',
        'http',
        'https://example.com',
        '--',
        'server2',
        'command'
      ]);
    });
  });

  describe('return value structure', () => {
    it('should return object with options and remainingArgv properties', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', 'Prompt', '--', 'server'];
      const result = parseGlobalFlags(argv);

      expect(result).toHaveProperty('options');
      expect(result).toHaveProperty('remainingArgv');
      expect(typeof result.options).toBe('object');
      expect(Array.isArray(result.remainingArgv)).toBe(true);
    });

    it('should return options conforming to WrapperOptions type', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', 'Prompt', '--', 'server'];
      const result = parseGlobalFlags(argv);

      const options: WrapperOptions = result.options;
      expect(options).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle real-world example: single server with custom prompt', () => {
      const argv = [
        'node',
        '/path/to/wrapper.js',
        '--system-prompt',
        'You are a specialized database assistant',
        '--',
        'postgres',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@modelcontextprotocol/server-postgres'
      ];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPrompt: 'You are a specialized database assistant'
      });
      expect(result.remainingArgv).toEqual([
        'node',
        '/path/to/wrapper.js',
        '--',
        'postgres',
        '--transport',
        'stdio',
        'npx',
        '-y',
        '@modelcontextprotocol/server-postgres'
      ]);
    });

    it('should handle real-world example: multiple servers with append prompt', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--append-system-prompt',
        'Focus on security best practices',
        '--',
        'github',
        'npx',
        '-y',
        '@modelcontextprotocol/server-github',
        '--',
        'filesystem',
        'npx',
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/workspace'
      ];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        appendSystemPrompt: 'Focus on security best practices'
      });
      expect(result.remainingArgv).toEqual([
        'node',
        'wrapper.js',
        '--',
        'github',
        'npx',
        '-y',
        '@modelcontextprotocol/server-github',
        '--',
        'filesystem',
        'npx',
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/workspace'
      ]);
    });

    it('should handle real-world example: HTTP server with system prompt file', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--system-prompt-file',
        '/home/user/.config/mcp/prompts/custom.txt',
        '--',
        'api-server',
        '--transport',
        'http',
        'https://api.example.com/mcp',
        '-H',
        'Authorization: Bearer token123'
      ];
      const result = parseGlobalFlags(argv);

      expect(result.options).toEqual({
        systemPromptFile: '/home/user/.config/mcp/prompts/custom.txt'
      });
      expect(result.remainingArgv).toEqual([
        'node',
        'wrapper.js',
        '--',
        'api-server',
        '--transport',
        'http',
        'https://api.example.com/mcp',
        '-H',
        'Authorization: Bearer token123'
      ]);
    });
  });
});
