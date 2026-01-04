/**
 * Type-level tests for typed hook factory overloads.
 *
 * These tests verify that the typed overloads correctly narrow tool_input
 * types when a single known tool name is used as the matcher.
 */

import type {
  WriteToolInput,
  EditToolInput,
  MultiEditToolInput,
  ReadToolInput,
  BashToolInput,
  GlobToolInput,
  GrepToolInput
} from '../../src/index.js';
import { describe, it, expect } from 'vitest';
import {
  preToolUseHook,
  postToolUseHook,
  postToolUseFailureHook,
  permissionRequestHook,
  preToolUseOutput,
  postToolUseOutput,
  postToolUseFailureOutput,
  permissionRequestOutput
} from '../../src/index.js';

// These tests primarily verify TypeScript types at compile time.
// The runtime assertions are minimal since the behavior is unchanged.

describe('Typed Hook Overloads', () => {
  describe('preToolUseHook', () => {
    it('types tool_input as WriteToolInput when matcher is "Write"', () => {
      const hook = preToolUseHook({ matcher: 'Write' }, (input) => {
        // These should compile without casts - that's the test!
        const filePath: string = input.tool_input.file_path;
        const content: string = input.tool_input.content;
        expect(filePath).toBeDefined();
        expect(content).toBeDefined();
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Write');
      expect(hook.hookEventName).toBe('PreToolUse');
    });

    it('types tool_input as EditToolInput when matcher is "Edit"', () => {
      const hook = preToolUseHook({ matcher: 'Edit' }, (input) => {
        const filePath: string = input.tool_input.file_path;
        const oldString: string = input.tool_input.old_string;
        const newString: string = input.tool_input.new_string;
        const replaceAll: boolean | undefined = input.tool_input.replace_all;
        expect(filePath).toBeDefined();
        expect(oldString).toBeDefined();
        expect(newString).toBeDefined();
        // replaceAll is optional, just check type compiles
        void replaceAll;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Edit');
    });

    it('types tool_input as MultiEditToolInput when matcher is "MultiEdit"', () => {
      const hook = preToolUseHook({ matcher: 'MultiEdit' }, (input) => {
        const filePath: string = input.tool_input.file_path;
        const edits: Array<{ old_string: string; new_string: string }> = input.tool_input.edits;
        expect(filePath).toBeDefined();
        expect(Array.isArray(edits)).toBe(true);
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('MultiEdit');
    });

    it('types tool_input as ReadToolInput when matcher is "Read"', () => {
      const hook = preToolUseHook({ matcher: 'Read' }, (input) => {
        const filePath: string = input.tool_input.file_path;
        const offset: number | undefined = input.tool_input.offset;
        const limit: number | undefined = input.tool_input.limit;
        expect(filePath).toBeDefined();
        void offset;
        void limit;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Read');
    });

    it('types tool_input as BashToolInput when matcher is "Bash"', () => {
      const hook = preToolUseHook({ matcher: 'Bash' }, (input) => {
        const command: string = input.tool_input.command;
        const timeout: number | undefined = input.tool_input.timeout;
        const description: string | undefined = input.tool_input.description;
        expect(command).toBeDefined();
        void timeout;
        void description;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Bash');
    });

    it('types tool_input as GlobToolInput when matcher is "Glob"', () => {
      const hook = preToolUseHook({ matcher: 'Glob' }, (input) => {
        const pattern: string = input.tool_input.pattern;
        const path: string | undefined = input.tool_input.path;
        expect(pattern).toBeDefined();
        void path;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Glob');
    });

    it('types tool_input as GrepToolInput when matcher is "Grep"', () => {
      const hook = preToolUseHook({ matcher: 'Grep' }, (input) => {
        const pattern: string = input.tool_input.pattern;
        const path: string | undefined = input.tool_input.path;
        const glob: string | undefined = input.tool_input.glob;
        expect(pattern).toBeDefined();
        void path;
        void glob;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Grep');
    });

    it('falls back to unknown tool_input for non-known matchers', () => {
      // This uses the non-typed overload
      const hook = preToolUseHook({ matcher: 'CustomTool' }, (input) => {
        // tool_input is unknown, so we need casts
        const custom = input.tool_input as { custom: string };
        void custom;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('CustomTool');
    });

    it('falls back to unknown tool_input for multi-tool matchers', () => {
      // Multi-tool matchers use the non-typed overload
      const hook = preToolUseHook({ matcher: 'Write|Edit' }, (input) => {
        // tool_input is unknown for multi-tool matchers
        const filePath = (input.tool_input as { file_path?: string })?.file_path;
        void filePath;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Write|Edit');
    });

    it('includes timeout in typed config', () => {
      const hook = preToolUseHook({ matcher: 'Write', timeout: 5000 }, (input) => {
        const filePath: string = input.tool_input.file_path;
        void filePath;
        return preToolUseOutput({});
      });

      expect(hook.timeout).toBe(5000);
    });
  });

  describe('postToolUseHook', () => {
    it('types tool_input correctly for known tools', () => {
      const hook = postToolUseHook({ matcher: 'Read' }, (input) => {
        const filePath: string = input.tool_input.file_path;
        // PostToolUseInput also has tool_response
        expect(filePath).toBeDefined();
        expect(input.tool_response).toBeDefined();
        return postToolUseOutput({});
      });

      expect(hook.matcher).toBe('Read');
    });

    it('preserves tool_response in typed input', () => {
      postToolUseHook({ matcher: 'Bash' }, (input) => {
        const command: string = input.tool_input.command;
        const response: unknown = input.tool_response;
        void command;
        void response;
        return postToolUseOutput({});
      });
    });
  });

  describe('postToolUseFailureHook', () => {
    it('types tool_input correctly for known tools', () => {
      const hook = postToolUseFailureHook({ matcher: 'Bash' }, (input) => {
        const command: string = input.tool_input.command;
        // PostToolUseFailureInput also has error
        expect(command).toBeDefined();
        expect(input.error).toBeDefined();
        return postToolUseFailureOutput({});
      });

      expect(hook.matcher).toBe('Bash');
    });

    it('preserves error and is_interrupt in typed input', () => {
      postToolUseFailureHook({ matcher: 'Write' }, (input) => {
        const filePath: string = input.tool_input.file_path;
        const error: string = input.error;
        const isInterrupt: boolean | undefined = input.is_interrupt;
        void filePath;
        void error;
        void isInterrupt;
        return postToolUseFailureOutput({});
      });
    });
  });

  describe('permissionRequestHook', () => {
    it('types tool_input correctly for known tools', () => {
      const hook = permissionRequestHook({ matcher: 'Read' }, (input) => {
        const filePath: string = input.tool_input.file_path;
        // PermissionRequestInput also has tool_use_id
        expect(filePath).toBeDefined();
        expect(input.tool_use_id).toBeDefined();
        return permissionRequestOutput({});
      });

      expect(hook.matcher).toBe('Read');
    });

    it('preserves permission_suggestions in typed input', () => {
      permissionRequestHook({ matcher: 'Bash' }, (input) => {
        const command: string = input.tool_input.command;
        const suggestions = input.permission_suggestions;
        void command;
        void suggestions;
        return permissionRequestOutput({});
      });
    });
  });

  describe('Type inference verification', () => {
    // These tests verify that the type inference is working correctly
    // by checking that the tool_input types match expected interfaces

    it('Write tool_input matches WriteToolInput', () => {
      preToolUseHook({ matcher: 'Write' }, (input) => {
        // Verify type compatibility by assignment
        const _writeInput: WriteToolInput = input.tool_input;
        void _writeInput;
        return preToolUseOutput({});
      });
    });

    it('Edit tool_input matches EditToolInput', () => {
      preToolUseHook({ matcher: 'Edit' }, (input) => {
        const _editInput: EditToolInput = input.tool_input;
        void _editInput;
        return preToolUseOutput({});
      });
    });

    it('MultiEdit tool_input matches MultiEditToolInput', () => {
      preToolUseHook({ matcher: 'MultiEdit' }, (input) => {
        const _multiEditInput: MultiEditToolInput = input.tool_input;
        void _multiEditInput;
        return preToolUseOutput({});
      });
    });

    it('Read tool_input matches ReadToolInput', () => {
      preToolUseHook({ matcher: 'Read' }, (input) => {
        const _readInput: ReadToolInput = input.tool_input;
        void _readInput;
        return preToolUseOutput({});
      });
    });

    it('Bash tool_input matches BashToolInput', () => {
      preToolUseHook({ matcher: 'Bash' }, (input) => {
        const _bashInput: BashToolInput = input.tool_input;
        void _bashInput;
        return preToolUseOutput({});
      });
    });

    it('Glob tool_input matches GlobToolInput', () => {
      preToolUseHook({ matcher: 'Glob' }, (input) => {
        const _globInput: GlobToolInput = input.tool_input;
        void _globInput;
        return preToolUseOutput({});
      });
    });

    it('Grep tool_input matches GrepToolInput', () => {
      preToolUseHook({ matcher: 'Grep' }, (input) => {
        const _grepInput: GrepToolInput = input.tool_input;
        void _grepInput;
        return preToolUseOutput({});
      });
    });
  });
});
