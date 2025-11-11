/**
 * Tests for help functionality
 * Tests help flag handling and help text display for CLI
 */

import { describe, it, expect } from '@jest/globals';
import { parseCliArguments, displayHelp } from '../src/wrapper.js';

describe('Help Functionality', () => {
  describe('displayHelp', () => {
    it('should return help text with usage section', () => {
      const helpText = displayHelp();

      expect(helpText).toContain('Usage:');
      expect(helpText).toContain('wrapper-mcp-server');
    });

    it('should document the three system prompt flags', () => {
      const helpText = displayHelp();

      expect(helpText).toContain('--system-prompt');
      expect(helpText).toContain('--append-system-prompt');
      expect(helpText).toContain('--system-prompt-file');
    });

    it('should explain server configuration syntax with "--" separators', () => {
      const helpText = displayHelp();

      expect(helpText).toContain('--');
      expect(helpText).toContain('server-name');
      expect(helpText).toContain('--transport');
    });

    it('should include examples of common usage patterns', () => {
      const helpText = displayHelp();

      expect(helpText).toContain('Examples:');
      expect(helpText).toContain('stdio');
    });

    it('should document that system prompt flags are mutually exclusive', () => {
      const helpText = displayHelp();

      expect(helpText).toContain('mutually exclusive');
    });

    it('should explain both stdio and http transport types', () => {
      const helpText = displayHelp();

      expect(helpText).toContain('stdio');
      expect(helpText).toContain('http');
    });
  });

  describe('parseCliArguments with help flag', () => {
    it('should detect -h flag and throw with help text', () => {
      const argv = ['node', 'wrapper.js', '-h'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('Usage:');
        expect((error as Error).message).toContain('--system-prompt');
      }
    });

    it('should detect --help flag and throw with help text', () => {
      const argv = ['node', 'wrapper.js', '--help'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('Usage:');
        expect((error as Error).message).toContain('--system-prompt');
      }
    });

    it('should detect -h flag even with other arguments', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', 'test', '-h', '--', 'server', 'cmd'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should detect --help flag after global flags', () => {
      const argv = ['node', 'wrapper.js', '--append-system-prompt', 'extra', '--help'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should prioritize help flag over parsing errors', () => {
      // Invalid arguments, but -h should take priority
      const argv = ['node', 'wrapper.js', '--invalid-flag', '-h'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('Usage:');
        expect((error as Error).message).not.toContain('invalid');
      }
    });
  });

  describe('parseCliArguments with invalid arguments', () => {
    it('should show help when no server configurations provided', () => {
      const argv = ['node', 'wrapper.js'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('No server configurations provided');
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should show help when "--" provided but no server config follows', () => {
      const argv = ['node', 'wrapper.js', '--'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('No server configurations provided');
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should show help when system prompt flag is missing its value', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('--system-prompt flag requires a value');
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should show help when system prompt flag value is "--"', () => {
      const argv = ['node', 'wrapper.js', '--system-prompt', '--', 'server', 'cmd'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('--system-prompt flag requires a value');
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should show help when multiple system prompt flags are used', () => {
      const argv = [
        'node',
        'wrapper.js',
        '--system-prompt',
        'test',
        '--append-system-prompt',
        'extra',
        '--',
        'server',
        'cmd'
      ];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('Only one system prompt flag');
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should show help when server name starts with "--"', () => {
      const argv = ['node', 'wrapper.js', '--', '--invalid-server', 'cmd'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('Server name cannot start with "--"');
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should show help when transport value is invalid', () => {
      const argv = ['node', 'wrapper.js', '--', 'server', '--transport', 'invalid', 'cmd'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('Invalid transport type');
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should show help when stdio transport has no command', () => {
      const argv = ['node', 'wrapper.js', '--', 'server', '--transport', 'stdio'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('stdio transport requires at least a command');
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should show help when http transport has no URL', () => {
      const argv = ['node', 'wrapper.js', '--', 'server', '--transport', 'http'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('http transport requires a URL');
        expect((error as Error).message).toContain('Usage:');
      }
    });

    it('should show help when http URL is invalid', () => {
      const argv = ['node', 'wrapper.js', '--', 'server', '--transport', 'http', 'invalid-url'];

      expect(() => parseCliArguments(argv)).toThrow();
      try {
        parseCliArguments(argv);
      } catch (error) {
        expect((error as Error).message).toContain('Invalid URL');
        expect((error as Error).message).toContain('Must start with http:// or https://');
        expect((error as Error).message).toContain('Usage:');
      }
    });
  });

  describe('help text content validation', () => {
    it('should include correct usage pattern', () => {
      const helpText = displayHelp();

      expect(helpText).toMatch(/wrapper-mcp-server.*\[--system-prompt/);
      expect(helpText).toMatch(/--.*server-name.*--transport/);
    });

    it('should describe --system-prompt flag correctly', () => {
      const helpText = displayHelp();

      expect(helpText).toContain('--system-prompt <text>');
      expect(helpText).toMatch(/Replace.*system prompt/i);
    });

    it('should describe --append-system-prompt flag correctly', () => {
      const helpText = displayHelp();

      expect(helpText).toContain('--append-system-prompt <text>');
      expect(helpText).toMatch(/Append.*system prompt/i);
    });

    it('should describe --system-prompt-file flag correctly', () => {
      const helpText = displayHelp();

      expect(helpText).toContain('--system-prompt-file <path>');
      expect(helpText).toMatch(/Load.*file/i);
    });

    it('should show stdio transport example', () => {
      const helpText = displayHelp();

      expect(helpText).toMatch(/--.*server.*--transport stdio/);
      expect(helpText).toContain('npx');
    });

    it('should show http transport example', () => {
      const helpText = displayHelp();

      expect(helpText).toMatch(/--.*server.*--transport http/);
      expect(helpText).toMatch(/https?:\/\//);
    });

    it('should show multiple server example', () => {
      const helpText = displayHelp();

      // Should have multiple "--" separators in examples
      const separatorCount = (helpText.match(/\s--\s/g) || []).length;
      expect(separatorCount).toBeGreaterThanOrEqual(2);
    });

    it('should show system prompt flag usage example', () => {
      const helpText = displayHelp();

      expect(helpText).toMatch(/--system-prompt.*--.*server/i);
    });
  });
});
