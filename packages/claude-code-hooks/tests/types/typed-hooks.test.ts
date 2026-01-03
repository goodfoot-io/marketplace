/**
 * Type-level tests for typed hook factory overloads.
 *
 * These tests verify that the typed overloads correctly narrow toolInput
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
    it('types toolInput as WriteToolInput when matcher is "Write"', () => {
      const hook = preToolUseHook({ matcher: 'Write' }, (input) => {
        // These should compile without casts - that's the test!
        const filePath: string = input.toolInput.file_path;
        const content: string = input.toolInput.content;
        expect(filePath).toBeDefined();
        expect(content).toBeDefined();
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Write');
      expect(hook.hookEventName).toBe('PreToolUse');
    });

    it('types toolInput as EditToolInput when matcher is "Edit"', () => {
      const hook = preToolUseHook({ matcher: 'Edit' }, (input) => {
        const filePath: string = input.toolInput.file_path;
        const oldString: string = input.toolInput.old_string;
        const newString: string = input.toolInput.new_string;
        const replaceAll: boolean | undefined = input.toolInput.replace_all;
        expect(filePath).toBeDefined();
        expect(oldString).toBeDefined();
        expect(newString).toBeDefined();
        // replaceAll is optional, just check type compiles
        void replaceAll;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Edit');
    });

    it('types toolInput as MultiEditToolInput when matcher is "MultiEdit"', () => {
      const hook = preToolUseHook({ matcher: 'MultiEdit' }, (input) => {
        const filePath: string = input.toolInput.file_path;
        const edits: Array<{ old_string: string; new_string: string }> = input.toolInput.edits;
        expect(filePath).toBeDefined();
        expect(Array.isArray(edits)).toBe(true);
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('MultiEdit');
    });

    it('types toolInput as ReadToolInput when matcher is "Read"', () => {
      const hook = preToolUseHook({ matcher: 'Read' }, (input) => {
        const filePath: string = input.toolInput.file_path;
        const offset: number | undefined = input.toolInput.offset;
        const limit: number | undefined = input.toolInput.limit;
        expect(filePath).toBeDefined();
        void offset;
        void limit;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Read');
    });

    it('types toolInput as BashToolInput when matcher is "Bash"', () => {
      const hook = preToolUseHook({ matcher: 'Bash' }, (input) => {
        const command: string = input.toolInput.command;
        const timeout: number | undefined = input.toolInput.timeout;
        const description: string | undefined = input.toolInput.description;
        expect(command).toBeDefined();
        void timeout;
        void description;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Bash');
    });

    it('types toolInput as GlobToolInput when matcher is "Glob"', () => {
      const hook = preToolUseHook({ matcher: 'Glob' }, (input) => {
        const pattern: string = input.toolInput.pattern;
        const path: string | undefined = input.toolInput.path;
        expect(pattern).toBeDefined();
        void path;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Glob');
    });

    it('types toolInput as GrepToolInput when matcher is "Grep"', () => {
      const hook = preToolUseHook({ matcher: 'Grep' }, (input) => {
        const pattern: string = input.toolInput.pattern;
        const path: string | undefined = input.toolInput.path;
        const glob: string | undefined = input.toolInput.glob;
        expect(pattern).toBeDefined();
        void path;
        void glob;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Grep');
    });

    it('falls back to unknown toolInput for non-known matchers', () => {
      // This uses the non-typed overload
      const hook = preToolUseHook({ matcher: 'CustomTool' }, (input) => {
        // toolInput is unknown, so we need casts
        const custom = input.toolInput as { custom: string };
        void custom;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('CustomTool');
    });

    it('falls back to unknown toolInput for multi-tool matchers', () => {
      // Multi-tool matchers use the non-typed overload
      const hook = preToolUseHook({ matcher: 'Write|Edit' }, (input) => {
        // toolInput is unknown for multi-tool matchers
        const filePath = (input.toolInput as { file_path?: string })?.file_path;
        void filePath;
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Write|Edit');
    });

    it('includes timeout in typed config', () => {
      const hook = preToolUseHook({ matcher: 'Write', timeout: 5000 }, (input) => {
        const filePath: string = input.toolInput.file_path;
        void filePath;
        return preToolUseOutput({});
      });

      expect(hook.timeout).toBe(5000);
    });
  });

  describe('postToolUseHook', () => {
    it('types toolInput correctly for known tools', () => {
      const hook = postToolUseHook({ matcher: 'Read' }, (input) => {
        const filePath: string = input.toolInput.file_path;
        // PostToolUseInput also has toolResponse
        expect(filePath).toBeDefined();
        expect(input.toolResponse).toBeDefined();
        return postToolUseOutput({});
      });

      expect(hook.matcher).toBe('Read');
    });

    it('preserves toolResponse in typed input', () => {
      postToolUseHook({ matcher: 'Bash' }, (input) => {
        const command: string = input.toolInput.command;
        const response: unknown = input.toolResponse;
        void command;
        void response;
        return postToolUseOutput({});
      });
    });
  });

  describe('postToolUseFailureHook', () => {
    it('types toolInput correctly for known tools', () => {
      const hook = postToolUseFailureHook({ matcher: 'Bash' }, (input) => {
        const command: string = input.toolInput.command;
        // PostToolUseFailureInput also has error
        expect(command).toBeDefined();
        expect(input.error).toBeDefined();
        return postToolUseFailureOutput({});
      });

      expect(hook.matcher).toBe('Bash');
    });

    it('preserves error and isInterrupt in typed input', () => {
      postToolUseFailureHook({ matcher: 'Write' }, (input) => {
        const filePath: string = input.toolInput.file_path;
        const error: string = input.error;
        const isInterrupt: boolean | undefined = input.isInterrupt;
        void filePath;
        void error;
        void isInterrupt;
        return postToolUseFailureOutput({});
      });
    });
  });

  describe('permissionRequestHook', () => {
    it('types toolInput correctly for known tools', () => {
      const hook = permissionRequestHook({ matcher: 'Read' }, (input) => {
        const filePath: string = input.toolInput.file_path;
        // PermissionRequestInput also has toolUseId
        expect(filePath).toBeDefined();
        expect(input.toolUseId).toBeDefined();
        return permissionRequestOutput({});
      });

      expect(hook.matcher).toBe('Read');
    });

    it('preserves permissionSuggestions in typed input', () => {
      permissionRequestHook({ matcher: 'Bash' }, (input) => {
        const command: string = input.toolInput.command;
        const suggestions = input.permissionSuggestions;
        void command;
        void suggestions;
        return permissionRequestOutput({});
      });
    });
  });

  describe('Type inference verification', () => {
    // These tests verify that the type inference is working correctly
    // by checking that the toolInput types match expected interfaces

    it('Write toolInput matches WriteToolInput', () => {
      preToolUseHook({ matcher: 'Write' }, (input) => {
        // Verify type compatibility by assignment
        const _writeInput: WriteToolInput = input.toolInput;
        void _writeInput;
        return preToolUseOutput({});
      });
    });

    it('Edit toolInput matches EditToolInput', () => {
      preToolUseHook({ matcher: 'Edit' }, (input) => {
        const _editInput: EditToolInput = input.toolInput;
        void _editInput;
        return preToolUseOutput({});
      });
    });

    it('MultiEdit toolInput matches MultiEditToolInput', () => {
      preToolUseHook({ matcher: 'MultiEdit' }, (input) => {
        const _multiEditInput: MultiEditToolInput = input.toolInput;
        void _multiEditInput;
        return preToolUseOutput({});
      });
    });

    it('Read toolInput matches ReadToolInput', () => {
      preToolUseHook({ matcher: 'Read' }, (input) => {
        const _readInput: ReadToolInput = input.toolInput;
        void _readInput;
        return preToolUseOutput({});
      });
    });

    it('Bash toolInput matches BashToolInput', () => {
      preToolUseHook({ matcher: 'Bash' }, (input) => {
        const _bashInput: BashToolInput = input.toolInput;
        void _bashInput;
        return preToolUseOutput({});
      });
    });

    it('Glob toolInput matches GlobToolInput', () => {
      preToolUseHook({ matcher: 'Glob' }, (input) => {
        const _globInput: GlobToolInput = input.toolInput;
        void _globInput;
        return preToolUseOutput({});
      });
    });

    it('Grep toolInput matches GrepToolInput', () => {
      preToolUseHook({ matcher: 'Grep' }, (input) => {
        const _grepInput: GrepToolInput = input.toolInput;
        void _grepInput;
        return preToolUseOutput({});
      });
    });
  });
});
