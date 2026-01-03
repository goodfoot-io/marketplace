/**
 * Unit tests for the runtime module.
 *
 * Tests case transformation functions:
 * - snakeToCamelCase: Transforms snake_case keys to camelCase
 * - camelToSnakeCase: Transforms camelCase keys to snake_case
 * - Roundtrip preservation: snake -> camel -> snake preserves data
 */

import { describe, it, expect } from 'vitest';
import {
  preToolUseOutput,
  postToolUseOutput,
  userPromptSubmitOutput,
  permissionRequestOutput,
  stopOutput,
  sessionStartOutput,
  notificationOutput
} from '../src/outputs.js';
import { snakeToCamelCase, camelToSnakeCase, convertToHookOutput } from '../src/runtime.js';

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

  describe('complex nested objects', () => {
    // Note: Hook output uses camelCase and should NOT be converted.
    // These tests verify the function works correctly on arbitrary nested objects.
    it('transforms deeply nested camelCase keys', () => {
      const input = {
        outerLevel: {
          innerLevel: {
            deepValue: 'test'
          },
          anotherKey: 'value'
        }
      };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({
        outer_level: {
          inner_level: {
            deep_value: 'test'
          },
          another_key: 'value'
        }
      });
    });

    it('transforms object with mixed content', () => {
      const input = {
        userName: 'john',
        isActive: true,
        accountSettings: {
          notifyEmail: true,
          preferredLanguage: 'en'
        }
      };
      const result = camelToSnakeCase(input);
      expect(result).toEqual({
        user_name: 'john',
        is_active: true,
        account_settings: {
          notify_email: true,
          preferred_language: 'en'
        }
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

  it('camel -> snake -> camel roundtrip preserves data', () => {
    // Note: Hook output uses camelCase and should NOT be converted.
    // This test verifies roundtrip data preservation for the utility functions.
    const originalData = {
      outerField: {
        innerName: 'PreToolUse',
        someDecision: 'deny',
        reasonText: 'Dangerous command'
      },
      messageField: 'Command blocked'
    };

    const snakeCase = camelToSnakeCase(originalData);
    const backToCamel = snakeToCamelCase(snakeCase);

    expect(backToCamel).toEqual(originalData);
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

describe('convertToHookOutput', () => {
  /**
   * Helper to safely access hookSpecificOutput as a record.
   * @param result - The output from convertToHookOutput
   * @returns The hookSpecificOutput property as a record
   */
  function getHookSpecific(result: ReturnType<typeof convertToHookOutput>): Record<string, unknown> {
    return result.stdout.hookSpecificOutput as unknown as Record<string, unknown>;
  }

  describe('PreToolUse wire format', () => {
    it('passes through hookSpecificOutput with permissionDecision', () => {
      const specificOutput = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: 'Dangerous command'
        }
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(result.stdout.hookSpecificOutput).toBeDefined();
      expect(hookSpecific.hookEventName).toBe('PreToolUse');
      expect(hookSpecific.permissionDecision).toBe('deny');
      expect(hookSpecific.permissionDecisionReason).toBe('Dangerous command');
    });

    it('includes updatedInput in hookSpecificOutput', () => {
      const specificOutput = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: 'allow',
          updatedInput: { command: 'ls -la' }
        }
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.updatedInput).toEqual({ command: 'ls -la' });
    });
  });

  describe('PostToolUse wire format', () => {
    it('passes through stopReason in stdout', () => {
      const specificOutput = postToolUseOutput({
        stopReason: 'Output contains sensitive data'
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.stopReason).toBe('Output contains sensitive data');
    });

    it('passes through additionalContext in hookSpecificOutput', () => {
      const specificOutput = postToolUseOutput({
        hookSpecificOutput: {
          additionalContext: 'File was modified'
        }
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(result.stdout.hookSpecificOutput).toBeDefined();
      expect(hookSpecific.additionalContext).toBe('File was modified');
    });

    it('includes updatedMCPToolOutput in hookSpecificOutput', () => {
      const specificOutput = postToolUseOutput({
        hookSpecificOutput: {
          updatedMCPToolOutput: { sanitized: true }
        }
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.updatedMCPToolOutput).toEqual({ sanitized: true });
    });
  });

  describe('UserPromptSubmit wire format', () => {
    it('passes through stopReason for blocking', () => {
      const specificOutput = userPromptSubmitOutput({
        stopReason: 'Prompt validation failed'
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.stopReason).toBe('Prompt validation failed');
    });

    it('passes through additionalContext in hookSpecificOutput', () => {
      const specificOutput = userPromptSubmitOutput({
        hookSpecificOutput: {
          additionalContext: 'User is admin'
        }
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.additionalContext).toBe('User is admin');
    });
  });

  describe('PermissionRequest wire format', () => {
    it('passes through decision in hookSpecificOutput', () => {
      const specificOutput = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: 'allow',
            updatedInput: { file_path: '/safe/path' }
          }
        }
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(result.stdout.hookSpecificOutput).toBeDefined();
      expect(hookSpecific.hookEventName).toBe('PermissionRequest');
      expect(hookSpecific.decision).toEqual({
        behavior: 'allow',
        updatedInput: { file_path: '/safe/path' }
      });
    });

    it('handles deny decision with message and interrupt', () => {
      const specificOutput = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: 'deny',
            message: 'Not allowed',
            interrupt: true
          }
        }
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.decision).toEqual({
        behavior: 'deny',
        message: 'Not allowed',
        interrupt: true
      });
    });
  });

  describe('Stop wire format', () => {
    it('keeps decision at top level for Stop hooks', () => {
      const specificOutput = stopOutput({
        decision: 'block',
        reason: 'Uncommitted changes'
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.decision).toBe('block');
      expect(result.stdout.reason).toBe('Uncommitted changes');
    });

    it('handles approve decision', () => {
      const specificOutput = stopOutput({
        decision: 'approve'
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.decision).toBe('approve');
    });
  });

  describe('SessionStart wire format', () => {
    it('passes through additionalContext in hookSpecificOutput', () => {
      const specificOutput = sessionStartOutput({
        hookSpecificOutput: {
          additionalContext: 'Project: my-app'
        }
      });

      const result = convertToHookOutput(specificOutput);
      const hookSpecific = getHookSpecific(result);

      expect(hookSpecific.additionalContext).toBe('Project: my-app');
    });
  });

  describe('common fields', () => {
    it('preserves continue, suppressOutput, systemMessage', () => {
      const specificOutput = sessionStartOutput({
        continue: true,
        suppressOutput: true,
        systemMessage: 'Welcome'
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.continue).toBe(true);
      expect(result.stdout.suppressOutput).toBe(true);
      expect(result.stdout.systemMessage).toBe('Welcome');
    });

    it('passes through stopReason in stdout', () => {
      const specificOutput = notificationOutput({
        stopReason: 'Notification blocked'
      });

      const result = convertToHookOutput(specificOutput);

      expect(result.stdout.stopReason).toBe('Notification blocked');
    });
  });
});
