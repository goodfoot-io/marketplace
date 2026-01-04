/**
 * Unit tests for the logger system.
 *
 * Tests:
 * - Log levels (debug, info, warn, error)
 * - Event subscription (.on() returns unsubscribe function)
 * - logError structured error logging
 * - File output functionality
 * - Context setting/clearing
 */

import type { LogEvent } from '../src/logger.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Logger, LOG_LEVELS } from '../src/logger.js';

describe('LOG_LEVELS constant', () => {
  it('defines all four log levels in severity order', () => {
    expect(LOG_LEVELS).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('has debug as lowest severity', () => {
    expect(LOG_LEVELS[0]).toBe('debug');
  });

  it('has error as highest severity', () => {
    expect(LOG_LEVELS[3]).toBe('error');
  });
});

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  afterEach(() => {
    logger.close();
  });

  describe('log methods', () => {
    it('debug() emits log event at debug level', () => {
      const events: LogEvent[] = [];
      logger.on('debug', (event) => events.push(event));

      logger.debug('Debug message');

      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('debug');
      expect(events[0].message).toBe('Debug message');
    });

    it('info() emits log event at info level', () => {
      const events: LogEvent[] = [];
      logger.on('info', (event) => events.push(event));

      logger.info('Info message');

      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('info');
      expect(events[0].message).toBe('Info message');
    });

    it('warn() emits log event at warn level', () => {
      const events: LogEvent[] = [];
      logger.on('warn', (event) => events.push(event));

      logger.warn('Warning message');

      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('warn');
      expect(events[0].message).toBe('Warning message');
    });

    it('error() emits log event at error level', () => {
      const events: LogEvent[] = [];
      logger.on('error', (event) => events.push(event));

      logger.error('Error message');

      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('error');
      expect(events[0].message).toBe('Error message');
    });

    it('includes context when provided', () => {
      const events: LogEvent[] = [];
      logger.on('info', (event) => events.push(event));

      logger.info('Message with context', { key: 'value', count: 42 });

      expect(events[0].context).toEqual({ key: 'value', count: 42 });
    });

    it('includes ISO timestamp', () => {
      const events: LogEvent[] = [];
      logger.on('info', (event) => events.push(event));

      logger.info('Test message');

      expect(events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('event subscription', () => {
    it('on() returns unsubscribe function', () => {
      const events: LogEvent[] = [];
      const unsubscribe = logger.on('info', (event) => events.push(event));

      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribe() stops receiving events', () => {
      const events: LogEvent[] = [];
      const unsubscribe = logger.on('info', (event) => events.push(event));

      logger.info('First message');
      expect(events).toHaveLength(1);

      unsubscribe();

      logger.info('Second message');
      expect(events).toHaveLength(1); // Still only the first message
    });

    it('supports multiple handlers for same level', () => {
      const events1: LogEvent[] = [];
      const events2: LogEvent[] = [];

      logger.on('warn', (event) => events1.push(event));
      logger.on('warn', (event) => events2.push(event));

      logger.warn('Warning');

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });

    it('handlers are independent per level', () => {
      const debugEvents: LogEvent[] = [];
      const infoEvents: LogEvent[] = [];
      const warnEvents: LogEvent[] = [];
      const errorEvents: LogEvent[] = [];

      logger.on('debug', (event) => debugEvents.push(event));
      logger.on('info', (event) => infoEvents.push(event));
      logger.on('warn', (event) => warnEvents.push(event));
      logger.on('error', (event) => errorEvents.push(event));

      logger.info('Info only');

      expect(debugEvents).toHaveLength(0);
      expect(infoEvents).toHaveLength(1);
      expect(warnEvents).toHaveLength(0);
      expect(errorEvents).toHaveLength(0);
    });

    it('handler exceptions are silently ignored', () => {
      const events: LogEvent[] = [];

      // First handler throws
      logger.on('info', () => {
        throw new Error('Handler error');
      });

      // Second handler should still receive events
      logger.on('info', (event) => events.push(event));

      // Should not throw
      expect(() => logger.info('Test')).not.toThrow();

      // Second handler should have received the event
      expect(events).toHaveLength(1);
    });
  });

  describe('logError', () => {
    it('logs Error instances with full structure', () => {
      const events: LogEvent[] = [];
      logger.on('error', (event) => events.push(event));

      const error = new Error('Something went wrong');
      logger.logError(error, 'Operation failed');

      expect(events).toHaveLength(1);
      expect(events[0].level).toBe('error');
      expect(events[0].message).toBe('Operation failed');
      expect(events[0].error).toBeDefined();
      expect(events[0].error?.name).toBe('Error');
      expect(events[0].error?.message).toBe('Something went wrong');
      expect(events[0].error?.stack).toBeDefined();
    });

    it('logs TypeError with correct name', () => {
      const events: LogEvent[] = [];
      logger.on('error', (event) => events.push(event));

      const error = new TypeError('Invalid type');
      logger.logError(error, 'Type error occurred');

      expect(events[0].error?.name).toBe('TypeError');
      expect(events[0].error?.message).toBe('Invalid type');
    });

    it('logs non-Error values as UnknownError', () => {
      const events: LogEvent[] = [];
      logger.on('error', (event) => events.push(event));

      logger.logError('string error', 'Something failed');

      expect(events[0].error?.name).toBe('UnknownError');
      expect(events[0].error?.message).toBe('string error');
    });

    it('logs null as UnknownError', () => {
      const events: LogEvent[] = [];
      logger.on('error', (event) => events.push(event));

      logger.logError(null, 'Null error');

      expect(events[0].error?.name).toBe('UnknownError');
      expect(events[0].error?.message).toBe('null');
    });

    it('includes context when provided', () => {
      const events: LogEvent[] = [];
      logger.on('error', (event) => events.push(event));

      logger.logError(new Error('Test'), 'Failed', { operation: 'test', id: 123 });

      expect(events[0].context).toEqual({ operation: 'test', id: 123 });
    });

    it('extracts error cause chain', () => {
      const events: LogEvent[] = [];
      logger.on('error', (event) => events.push(event));

      const rootCause = new Error('Root cause');
      const wrappedError = new Error('Wrapped error', { cause: rootCause });
      logger.logError(wrappedError, 'Error with cause');

      expect(events[0].error?.cause).toBeDefined();
      expect(events[0].error?.cause?.name).toBe('Error');
      expect(events[0].error?.cause?.message).toBe('Root cause');
    });

    it('extracts deep cause chain', () => {
      const events: LogEvent[] = [];
      logger.on('error', (event) => events.push(event));

      const level3 = new Error('Level 3');
      const level2 = new Error('Level 2', { cause: level3 });
      const level1 = new Error('Level 1', { cause: level2 });

      logger.logError(level1, 'Deep error chain');

      expect(events[0].error?.message).toBe('Level 1');
      expect(events[0].error?.cause?.message).toBe('Level 2');
      expect(events[0].error?.cause?.cause?.message).toBe('Level 3');
    });
  });

  describe('context management', () => {
    it('setContext() enriches log events with hookType', () => {
      const events: LogEvent[] = [];
      logger.on('info', (event) => events.push(event));

      logger.setContext('PreToolUse', undefined);
      logger.info('Test message');

      expect(events[0].hookType).toBe('PreToolUse');
    });

    it('setContext() enriches log events with input', () => {
      const events: LogEvent[] = [];
      logger.on('info', (event) => events.push(event));

      const input = { session_id: 'abc', tool_name: 'Bash' };
      logger.setContext('PreToolUse', input);
      logger.info('Test message');

      expect(events[0].input).toEqual(input);
    });

    it('clearContext() removes hook context', () => {
      const events: LogEvent[] = [];
      logger.on('info', (event) => events.push(event));

      logger.setContext('PreToolUse', { session_id: 'abc' });
      logger.clearContext();
      logger.info('Test message');

      expect(events[0].hookType).toBeUndefined();
      expect(events[0].input).toBeUndefined();
    });

    it('logError includes context from setContext', () => {
      const events: LogEvent[] = [];
      logger.on('error', (event) => events.push(event));

      logger.setContext('SessionStart', { session_id: 'test123' });
      logger.logError(new Error('Test'), 'Error with context');

      expect(events[0].hookType).toBe('SessionStart');
      expect(events[0].input).toEqual({ session_id: 'test123' });
    });
  });

  describe('file output', () => {
    let tempDir: string;
    let logFilePath: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
      logFilePath = path.join(tempDir, 'test.log');
    });

    afterEach(() => {
      logger.close();
      // Clean up temp files
      try {
        if (fs.existsSync(logFilePath)) {
          fs.unlinkSync(logFilePath);
        }
        fs.rmdirSync(tempDir);
      } catch {
        // Ignore cleanup errors
      }
    });

    it('writes log events to file as JSON Lines', () => {
      logger = new Logger({ logFilePath });

      logger.info('First message');
      logger.warn('Second message');
      logger.close();

      const content = fs.readFileSync(logFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);

      const first = JSON.parse(lines[0]) as LogEvent;
      expect(first.level).toBe('info');
      expect(first.message).toBe('First message');

      const second = JSON.parse(lines[1]) as LogEvent;
      expect(second.level).toBe('warn');
      expect(second.message).toBe('Second message');
    });

    it('creates parent directories if they do not exist', () => {
      const nestedPath = path.join(tempDir, 'nested', 'deep', 'test.log');
      logger = new Logger({ logFilePath: nestedPath });

      logger.info('Test message');
      logger.close();

      expect(fs.existsSync(nestedPath)).toBe(true);

      // Clean up
      fs.unlinkSync(nestedPath);
      fs.rmdirSync(path.dirname(nestedPath));
      fs.rmdirSync(path.dirname(path.dirname(nestedPath)));
    });

    it('setLogFile() enables file logging at runtime', () => {
      logger = new Logger();

      logger.info('Before file - not logged');
      logger.setLogFile(logFilePath);
      logger.info('After file - logged');
      logger.close();

      const content = fs.readFileSync(logFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(1);
      const event = JSON.parse(lines[0]) as LogEvent;
      expect(event.message).toBe('After file - logged');
    });

    it('setLogFile(null) disables file logging', () => {
      logger = new Logger({ logFilePath });

      logger.info('First message');
      logger.setLogFile(null);
      logger.info('Second message - not logged');
      logger.close();

      const content = fs.readFileSync(logFilePath, 'utf-8');
      const lines = content
        .trim()
        .split('\n')
        .filter((l) => l.length > 0);

      expect(lines).toHaveLength(1);
    });
  });

  describe('hasDestinations()', () => {
    it('returns false when no destinations configured', () => {
      logger = new Logger();
      expect(logger.hasDestinations()).toBe(false);
    });

    it('returns true when handler is registered', () => {
      logger = new Logger();
      logger.on('info', () => {});
      expect(logger.hasDestinations()).toBe(true);
    });

    it('returns true when file path is configured', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
      const logFilePath = path.join(tempDir, 'test.log');

      try {
        logger = new Logger({ logFilePath });
        expect(logger.hasDestinations()).toBe(true);
      } finally {
        logger.close();
        try {
          if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
          fs.rmdirSync(tempDir);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('returns false after unsubscribing all handlers', () => {
      logger = new Logger();
      const unsub1 = logger.on('info', () => {});
      const unsub2 = logger.on('error', () => {});

      expect(logger.hasDestinations()).toBe(true);

      unsub1();
      unsub2();

      expect(logger.hasDestinations()).toBe(false);
    });
  });

  describe('close()', () => {
    it('can be called multiple times safely', () => {
      logger = new Logger();

      expect(() => {
        logger.close();
        logger.close();
        logger.close();
      }).not.toThrow();
    });

    it('closes file handle', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
      const logFilePath = path.join(tempDir, 'test.log');

      try {
        logger = new Logger({ logFilePath });
        logger.info('Before close');
        logger.close();

        // After close, writing should not throw but also not write
        // (the file handle is null)
        expect(() => logger.info('After close')).not.toThrow();
      } finally {
        try {
          if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
          fs.rmdirSync(tempDir);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });
});

describe('logger singleton', () => {
  it('exports a singleton logger instance', async () => {
    // Import the singleton
    const { logger } = await import('../src/logger.js');

    expect(logger).toBeInstanceOf(Logger);
  });
});
