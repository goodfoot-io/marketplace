/**
 * Tests for logger
 *
 * Testing approach: Verify logging behavior by checking environment variable
 * handling and ensuring functions execute without errors. The actual stderr
 * output is validated through manual testing and usage in the application.
 */

import * as logger from '../src/logger.js';

describe('Logger', () => {
  let originalEnv: string | undefined;
  let consoleErrorCalls: Array<unknown[]> = [];
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Save original environment variable
    originalEnv = process.env.MCP_WRAPPER_SERVER_LOGGING;

    // Track console.error calls
    consoleErrorCalls = [];
    originalConsoleError = console.error;
    console.error = (...args: unknown[]): void => {
      consoleErrorCalls.push(args);
    };
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;

    // Restore original environment variable
    if (originalEnv === undefined) {
      delete process.env.MCP_WRAPPER_SERVER_LOGGING;
    } else {
      process.env.MCP_WRAPPER_SERVER_LOGGING = originalEnv;
    }
  });

  describe('when logging is disabled (default)', () => {
    beforeEach(() => {
      delete process.env.MCP_WRAPPER_SERVER_LOGGING;
      consoleErrorCalls = [];
    });

    it('debug should not call console.error', () => {
      logger.debug('test message');
      expect(consoleErrorCalls).toHaveLength(0);
    });

    it('info should not call console.error', () => {
      logger.info('test message');
      expect(consoleErrorCalls).toHaveLength(0);
    });

    it('warn should not call console.error', () => {
      logger.warn('test message');
      expect(consoleErrorCalls).toHaveLength(0);
    });

    it('error should not call console.error', () => {
      logger.error('test message');
      expect(consoleErrorCalls).toHaveLength(0);
    });

    it('should not call console.error with additional arguments', () => {
      logger.debug('test', { foo: 'bar' }, 42);
      expect(consoleErrorCalls).toHaveLength(0);
    });

    it('should not throw errors when logging disabled', () => {
      expect(() => {
        logger.debug('test');
        logger.info('test');
        logger.warn('test');
        logger.error('test');
      }).not.toThrow();
    });
  });

  describe('when logging is enabled', () => {
    beforeEach(() => {
      process.env.MCP_WRAPPER_SERVER_LOGGING = 'true';
      consoleErrorCalls = [];
    });

    it('debug should call console.error with [DEBUG] prefix', () => {
      logger.debug('test message');
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[DEBUG]', 'test message']);
    });

    it('info should call console.error with [INFO] prefix', () => {
      logger.info('test message');
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[INFO]', 'test message']);
    });

    it('warn should call console.error with [WARN] prefix', () => {
      logger.warn('test message');
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[WARN]', 'test message']);
    });

    it('error should call console.error with [ERROR] prefix', () => {
      logger.error('test message');
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[ERROR]', 'test message']);
    });

    it('should call console.error with additional arguments', () => {
      const obj = { foo: 'bar' };
      const num = 42;
      logger.debug('test', obj, num);
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[DEBUG]', 'test', obj, num]);
    });

    it('should call console.error for multiple messages', () => {
      logger.info('first message');
      logger.warn('second message');
      expect(consoleErrorCalls).toHaveLength(2);
      expect(consoleErrorCalls[0]).toEqual(['[INFO]', 'first message']);
      expect(consoleErrorCalls[1]).toEqual(['[WARN]', 'second message']);
    });

    it('should not throw errors when logging enabled', () => {
      expect(() => {
        logger.debug('test');
        logger.info('test');
        logger.warn('test');
        logger.error('test');
      }).not.toThrow();
    });
  });

  describe('environment variable handling', () => {
    beforeEach(() => {
      consoleErrorCalls = [];
    });

    it('should not log when MCP_WRAPPER_SERVER_LOGGING is "false"', () => {
      process.env.MCP_WRAPPER_SERVER_LOGGING = 'false';
      logger.info('test');
      expect(consoleErrorCalls).toHaveLength(0);
    });

    it('should not log when MCP_WRAPPER_SERVER_LOGGING is empty string', () => {
      process.env.MCP_WRAPPER_SERVER_LOGGING = '';
      logger.info('test');
      expect(consoleErrorCalls).toHaveLength(0);
    });

    it('should not log when MCP_WRAPPER_SERVER_LOGGING is "1"', () => {
      process.env.MCP_WRAPPER_SERVER_LOGGING = '1';
      logger.info('test');
      expect(consoleErrorCalls).toHaveLength(0);
    });

    it('should not log when MCP_WRAPPER_SERVER_LOGGING is "yes"', () => {
      process.env.MCP_WRAPPER_SERVER_LOGGING = 'yes';
      logger.info('test');
      expect(consoleErrorCalls).toHaveLength(0);
    });

    it('should only log when MCP_WRAPPER_SERVER_LOGGING is exactly "true"', () => {
      process.env.MCP_WRAPPER_SERVER_LOGGING = 'true';
      logger.info('test message');
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[INFO]', 'test message']);
    });
  });

  describe('log level functionality', () => {
    beforeEach(() => {
      process.env.MCP_WRAPPER_SERVER_LOGGING = 'true';
      consoleErrorCalls = [];
    });

    it('debug level should work independently', () => {
      logger.debug('debug only');
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[DEBUG]', 'debug only']);
    });

    it('info level should work independently', () => {
      logger.info('info only');
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[INFO]', 'info only']);
    });

    it('warn level should work independently', () => {
      logger.warn('warn only');
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[WARN]', 'warn only']);
    });

    it('error level should work independently', () => {
      logger.error('error only');
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0]).toEqual(['[ERROR]', 'error only']);
    });

    it('all levels should be available simultaneously', () => {
      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');

      expect(consoleErrorCalls).toHaveLength(4);
      expect(consoleErrorCalls[0]).toEqual(['[DEBUG]', 'debug msg']);
      expect(consoleErrorCalls[1]).toEqual(['[INFO]', 'info msg']);
      expect(consoleErrorCalls[2]).toEqual(['[WARN]', 'warn msg']);
      expect(consoleErrorCalls[3]).toEqual(['[ERROR]', 'error msg']);
    });
  });

  describe('stderr output verification', () => {
    it('should use console.error which outputs to stderr', () => {
      // This test verifies the implementation uses console.error
      // console.error writes to stderr by default in Node.js
      process.env.MCP_WRAPPER_SERVER_LOGGING = 'true';
      consoleErrorCalls = [];

      logger.info('stderr test');

      // Verify console.error was called (which writes to stderr)
      expect(consoleErrorCalls).toHaveLength(1);
      expect(consoleErrorCalls[0][0]).toBe('[INFO]');
    });
  });
});
