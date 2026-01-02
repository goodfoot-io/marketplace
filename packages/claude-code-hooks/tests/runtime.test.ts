/**
 * Unit tests for the runtime module.
 *
 * Tests case transformation functions:
 * - snakeToCamelCase: Transforms snake_case keys to camelCase
 * - camelToSnakeCase: Transforms camelCase keys to snake_case
 * - Roundtrip preservation: snake -> camel -> snake preserves data
 */

import { describe, it, expect } from 'vitest';
import { snakeToCamelCase, camelToSnakeCase } from '../src/runtime.js';

describe('snakeToCamelCase', () => {
  describe('primitive values', () => {
    it('returns null unchanged', () => {
      expect(snakeToCamelCase(null)).toBeNull();
    });

    it('returns undefined unchanged', () => {
      expect(snakeToCamelCase(undefined)).toBeUndefined();
    });

    it('returns strings unchanged', () => {
      expect(snakeToCamelCase('hello_world')).toBe('hello_world');
    });

    it('returns numbers unchanged', () => {
      expect(snakeToCamelCase(42)).toBe(42);
    });

    it('returns booleans unchanged', () => {
      expect(snakeToCamelCase(true)).toBe(true);
      expect(snakeToCamelCase(false)).toBe(false);
    });
  });

  describe('simple objects', () => {
    it('transforms single snake_case key', () => {
      const input = { hello_world: 'value' };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({ helloWorld: 'value' });
    });

    it('transforms multiple snake_case keys', () => {
      const input = {
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john@example.com'
      };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: 'john@example.com'
      });
    });

    it('preserves already camelCase keys', () => {
      const input = { alreadyCamel: 'value', stillCamel: 'another' };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({ alreadyCamel: 'value', stillCamel: 'another' });
    });

    it('preserves single-word keys', () => {
      const input = { name: 'value', id: 123 };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({ name: 'value', id: 123 });
    });

    it('handles multiple underscores', () => {
      const input = { tool_use_id: '123', permission_mode_setting: 'strict' };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({ toolUseId: '123', permissionModeSetting: 'strict' });
    });
  });

  describe('nested objects', () => {
    it('transforms nested object keys', () => {
      const input = {
        outer_key: {
          inner_key: 'value',
          another_inner: 123
        }
      };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({
        outerKey: {
          innerKey: 'value',
          anotherInner: 123
        }
      });
    });

    it('transforms deeply nested objects', () => {
      const input = {
        level_one: {
          level_two: {
            level_three: {
              final_value: 'deep'
            }
          }
        }
      };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({
        levelOne: {
          levelTwo: {
            levelThree: {
              finalValue: 'deep'
            }
          }
        }
      });
    });
  });

  describe('arrays', () => {
    it('transforms objects within arrays', () => {
      const input = [{ first_item: 1 }, { second_item: 2 }];
      const result = snakeToCamelCase(input);
      expect(result).toEqual([{ firstItem: 1 }, { secondItem: 2 }]);
    });

    it('preserves primitive arrays', () => {
      const input = [1, 2, 3, 'hello', true];
      const result = snakeToCamelCase(input);
      expect(result).toEqual([1, 2, 3, 'hello', true]);
    });

    it('transforms nested arrays of objects', () => {
      const input = {
        items_list: [{ item_name: 'first' }, { item_name: 'second' }]
      };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({
        itemsList: [{ itemName: 'first' }, { itemName: 'second' }]
      });
    });

    it('handles empty arrays', () => {
      const input = { empty_array: [] };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({ emptyArray: [] });
    });
  });

  describe('real hook input examples', () => {
    it('transforms PreToolUse input', () => {
      const input = {
        hook_event_name: 'PreToolUse',
        session_id: 'abc123',
        transcript_path: '/path/to/transcript',
        cwd: '/workspace',
        permission_mode: 'default',
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
        tool_use_id: 'tu_123'
      };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({
        hookEventName: 'PreToolUse',
        sessionId: 'abc123',
        transcriptPath: '/path/to/transcript',
        cwd: '/workspace',
        permissionMode: 'default',
        toolName: 'Bash',
        toolInput: { command: 'ls -la' },
        toolUseId: 'tu_123'
      });
    });

    it('transforms SessionStart input', () => {
      const input = {
        hook_event_name: 'SessionStart',
        session_id: 'sess_456',
        transcript_path: '/path/to/transcript',
        cwd: '/workspace',
        permission_mode: 'strict',
        source: 'startup'
      };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({
        hookEventName: 'SessionStart',
        sessionId: 'sess_456',
        transcriptPath: '/path/to/transcript',
        cwd: '/workspace',
        permissionMode: 'strict',
        source: 'startup'
      });
    });

    it('transforms PostToolUseFailure input with nested error', () => {
      const input = {
        hook_event_name: 'PostToolUseFailure',
        session_id: 'abc',
        tool_name: 'Bash',
        tool_input: { command: 'invalid_command' },
        tool_use_id: 'tu_789',
        error: 'Command not found',
        is_interrupt: false
      };
      const result = snakeToCamelCase(input);
      expect(result).toEqual({
        hookEventName: 'PostToolUseFailure',
        sessionId: 'abc',
        toolName: 'Bash',
        toolInput: { command: 'invalid_command' },
        toolUseId: 'tu_789',
        error: 'Command not found',
        isInterrupt: false
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty object', () => {
      const input = {};
      const result = snakeToCamelCase(input);
      expect(result).toEqual({});
    });

    it('handles keys with leading underscore', () => {
      const input = { _private_key: 'value' };
      const result = snakeToCamelCase(input);
      // _private_key: the leading _ followed by lowercase letter is treated as part of snake_case
      // _p becomes P, then rivate_key becomes rivateKey, resulting in PrivateKey
      // This edge case doesn't apply to Claude Code hooks (no SDK fields start with underscore)
      expect(result).toHaveProperty('PrivateKey', 'value');
    });

    it('handles keys with trailing underscore', () => {
      const input = { trailing_: 'value' };
      const result = snakeToCamelCase(input);
      expect(result).toHaveProperty('trailing_', 'value');
    });

    it('handles keys with consecutive underscores', () => {
      const input = { double__underscore: 'value' };
      const result = snakeToCamelCase(input);
      // double__underscore with consecutive underscores becomes double_Underscore
      expect(result).toHaveProperty('double_Underscore', 'value');
    });
  });
});

describe('camelToSnakeCase', () => {
  describe('primitive values', () => {
    it('returns null unchanged', () => {
      expect(camelToSnakeCase(null)).toBeNull();
    });

    it('returns undefined unchanged', () => {
      expect(camelToSnakeCase(undefined)).toBeUndefined();
    });

    it('returns strings unchanged', () => {
      expect(camelToSnakeCase('helloWorld')).toBe('helloWorld');
    });

    it('returns numbers unchanged', () => {
      expect(camelToSnakeCase(42)).toBe(42);
    });

    it('returns booleans unchanged', () => {
      expect(camelToSnakeCase(true)).toBe(true);
      expect(camelToSnakeCase(false)).toBe(false);
    });
  });

  describe('simple objects', () => {
    it('transforms single camelCase key', () => {
      const input = { helloWorld: 'value' };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({ hello_world: 'value' });
    });

    it('transforms multiple camelCase keys', () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: 'john@example.com'
      };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({
        first_name: 'John',
        last_name: 'Doe',
        email_address: 'john@example.com'
      });
    });

    it('preserves already snake_case keys', () => {
      const input = { already_snake: 'value', still_snake: 'another' };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({ already_snake: 'value', still_snake: 'another' });
    });

    it('preserves single-word keys', () => {
      const input = { name: 'value', id: 123 };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({ name: 'value', id: 123 });
    });

    it('handles multiple capital letters', () => {
      const input = { toolUseId: '123', permissionModeSetting: 'strict' };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({ tool_use_id: '123', permission_mode_setting: 'strict' });
    });
  });

  describe('nested objects', () => {
    it('transforms nested object keys', () => {
      const input = {
        outerKey: {
          innerKey: 'value',
          anotherInner: 123
        }
      };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({
        outer_key: {
          inner_key: 'value',
          another_inner: 123
        }
      });
    });

    it('transforms deeply nested objects', () => {
      const input = {
        levelOne: {
          levelTwo: {
            levelThree: {
              finalValue: 'deep'
            }
          }
        }
      };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({
        level_one: {
          level_two: {
            level_three: {
              final_value: 'deep'
            }
          }
        }
      });
    });
  });

  describe('arrays', () => {
    it('transforms objects within arrays', () => {
      const input = [{ firstItem: 1 }, { secondItem: 2 }];
      const result = camelToSnakeCase(input);
      expect(result).toEqual([{ first_item: 1 }, { second_item: 2 }]);
    });

    it('preserves primitive arrays', () => {
      const input = [1, 2, 3, 'hello', true];
      const result = camelToSnakeCase(input);
      expect(result).toEqual([1, 2, 3, 'hello', true]);
    });

    it('transforms nested arrays of objects', () => {
      const input = {
        itemsList: [{ itemName: 'first' }, { itemName: 'second' }]
      };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({
        items_list: [{ item_name: 'first' }, { item_name: 'second' }]
      });
    });

    it('handles empty arrays', () => {
      const input = { emptyArray: [] };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({ empty_array: [] });
    });
  });

  describe('real hook output examples', () => {
    it('transforms PreToolUse output', () => {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          updatedInput: { command: 'safe_command' }
        }
      };
      const result = camelToSnakeCase(output);
      expect(result).toEqual({
        hook_specific_output: {
          hook_event_name: 'PreToolUse',
          permission_decision: 'allow',
          updated_input: { command: 'safe_command' }
        }
      });
    });

    it('transforms SessionStart output', () => {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: '{"initialized":true}'
        },
        systemMessage: 'Welcome'
      };
      const result = camelToSnakeCase(output);
      expect(result).toEqual({
        hook_specific_output: {
          hook_event_name: 'SessionStart',
          additional_context: '{"initialized":true}'
        },
        system_message: 'Welcome'
      });
    });

    it('transforms Stop output', () => {
      const output = {
        decision: 'block',
        reason: 'Pending changes',
        systemMessage: 'Please commit first'
      };
      const result = camelToSnakeCase(output);
      expect(result).toEqual({
        decision: 'block',
        reason: 'Pending changes',
        system_message: 'Please commit first'
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty object', () => {
      const input = {};
      const result = camelToSnakeCase(input);
      expect(result).toEqual({});
    });

    it('handles acronyms in keys', () => {
      const input = { userID: 'abc', httpURL: 'http://example.com' };
      const result = camelToSnakeCase(input);
      // Each capital letter becomes _lowercase
      expect(result).toEqual({
        user_i_d: 'abc',
        http_u_r_l: 'http://example.com'
      });
    });

    it('handles keys starting with capital letter', () => {
      const input = { FirstName: 'John' };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({ _first_name: 'John' });
    });
  });
});

describe('roundtrip transformations', () => {
  it('snake -> camel -> snake preserves hook input data', () => {
    const originalInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'abc123',
      transcript_path: '/path/to/transcript',
      cwd: '/workspace',
      permission_mode: 'default',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
      tool_use_id: 'tu_123'
    };

    const camelCase = snakeToCamelCase(originalInput);
    const backToSnake = camelToSnakeCase(camelCase);

    expect(backToSnake).toEqual(originalInput);
  });

  it('snake -> camel -> snake preserves nested arrays', () => {
    const originalInput = {
      permission_suggestions: [
        {
          type: 'add_rules',
          rules: [{ tool_name: 'Read', rule_content: '/tmp/*' }],
          behavior: 'allow',
          destination: 'session'
        }
      ]
    };

    const camelCase = snakeToCamelCase(originalInput);
    const backToSnake = camelToSnakeCase(camelCase);

    expect(backToSnake).toEqual(originalInput);
  });

  it('camel -> snake -> camel preserves hook output data', () => {
    const originalOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Dangerous command'
      },
      systemMessage: 'Command blocked'
    };

    const snakeCase = camelToSnakeCase(originalOutput);
    const backToCamel = snakeToCamelCase(snakeCase);

    expect(backToCamel).toEqual(originalOutput);
  });

  it('preserves primitive values through transformations', () => {
    const input = {
      string_value: 'hello',
      number_value: 42,
      boolean_value: true,
      null_value: null,
      array_value: [1, 2, 3]
    };

    const camelCase = snakeToCamelCase(input);
    const backToSnake = camelToSnakeCase(camelCase);

    expect(backToSnake).toEqual(input);
  });

  it('preserves deeply nested structures', () => {
    const input = {
      level_one: {
        level_two: {
          level_three: {
            deep_array: [
              { item_id: 1, item_name: 'first' },
              { item_id: 2, item_name: 'second' }
            ],
            deep_value: 'nested'
          }
        }
      }
    };

    const camelCase = snakeToCamelCase(input);
    const backToSnake = camelToSnakeCase(camelCase);

    expect(backToSnake).toEqual(input);
  });
});
