/**
 * Type inference tests for HookInput types.
 *
 * These tests verify TypeScript correctly enforces type constraints at compile time.
 * The tests verify compile-time behavior through type assertions and type narrowing.
 * @module
 */

import type {
  HookInput,
  PreToolUseInput,
  PostToolUseInput,
  PostToolUseFailureInput,
  NotificationInput,
  UserPromptSubmitInput,
  SessionStartInput,
  SessionEndInput,
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  PreCompactInput,
  PermissionRequestInput
} from '../../src/types/inputs.js';
import { describe, it, expect } from 'vitest';

describe('HookInput discriminated union', () => {
  describe('type narrowing', () => {
    it('narrows correctly on hookEventName', () => {
      const handleHook = (input: HookInput): string => {
        switch (input.hookEventName) {
          case 'PreToolUse':
            // TypeScript should know input.toolName exists
            return input.toolName;
          case 'PostToolUse':
            // TypeScript should know input.toolResponse exists
            return String(input.toolResponse);
          case 'SessionStart':
            // TypeScript should know input.source exists
            return input.source;
          case 'Stop':
            // TypeScript should know input.stopHookActive exists
            return String(input.stopHookActive);
          case 'PostToolUseFailure':
            return input.error;
          case 'Notification':
            return input.message;
          case 'UserPromptSubmit':
            return input.prompt;
          case 'SessionEnd':
            return input.reason;
          case 'SubagentStart':
            return input.agentId;
          case 'SubagentStop':
            return input.agentTranscriptPath;
          case 'PreCompact':
            return input.trigger;
          case 'PermissionRequest':
            return input.toolName;
          default: {
            // Exhaustiveness check
            const _exhaustive: never = input;
            return _exhaustive;
          }
        }
      };

      // Just verify the function is callable
      expect(handleHook).toBeDefined();
    });

    it('provides correct fields after narrowing to PreToolUse', () => {
      const handlePreToolUse = (input: HookInput): void => {
        if (input.hookEventName === 'PreToolUse') {
          // All these should be valid
          const _toolName: string = input.toolName;
          const _toolInput: unknown = input.toolInput;
          const _toolUseId: string = input.toolUseId;
          const _sessionId: string = input.sessionId;

          expect(_toolName).toBeDefined();
          expect(_toolInput).toBeDefined();
          expect(_toolUseId).toBeDefined();
          expect(_sessionId).toBeDefined();
        }
      };

      expect(handlePreToolUse).toBeDefined();
    });

    it('provides correct fields after narrowing to SessionStart', () => {
      const handleSessionStart = (input: HookInput): void => {
        if (input.hookEventName === 'SessionStart') {
          // source should be one of the specific values
          const _source: 'startup' | 'resume' | 'clear' | 'compact' = input.source;
          const _sessionId: string = input.sessionId;

          expect(_source).toBeDefined();
          expect(_sessionId).toBeDefined();
        }
      };

      expect(handleSessionStart).toBeDefined();
    });
  });

  describe('individual input type fields', () => {
    it('PreToolUseInput has all required fields', () => {
      const input: PreToolUseInput = {
        hookEventName: 'PreToolUse',
        sessionId: 'sess-123',
        transcriptPath: '/path/to/transcript',
        cwd: '/workspace',
        toolName: 'Bash',
        toolInput: { command: 'ls -la' },
        toolUseId: 'tool-456'
      };

      expect(input.hookEventName).toBe('PreToolUse');
      expect(input.toolName).toBe('Bash');
      expect(input.toolInput).toEqual({ command: 'ls -la' });
    });

    it('PostToolUseInput has toolResponse field', () => {
      const input: PostToolUseInput = {
        hookEventName: 'PostToolUse',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        toolName: 'Read',
        toolInput: { file_path: '/test.txt' },
        toolResponse: 'file contents',
        toolUseId: 'tool-789'
      };

      expect(input.toolResponse).toBe('file contents');
    });

    it('PostToolUseFailureInput has error and optional isInterrupt', () => {
      const input: PostToolUseFailureInput = {
        hookEventName: 'PostToolUseFailure',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        toolName: 'Bash',
        toolInput: { command: 'bad-cmd' },
        toolUseId: 'tool-999',
        error: 'Command failed',
        isInterrupt: true
      };

      expect(input.error).toBe('Command failed');
      expect(input.isInterrupt).toBe(true);
    });

    it('NotificationInput has message and optional title', () => {
      const input: NotificationInput = {
        hookEventName: 'Notification',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        message: 'Task completed',
        title: 'Success',
        notificationType: 'info'
      };

      expect(input.message).toBe('Task completed');
      expect(input.title).toBe('Success');
    });

    it('UserPromptSubmitInput has prompt field', () => {
      const input: UserPromptSubmitInput = {
        hookEventName: 'UserPromptSubmit',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        prompt: 'Write a function'
      };

      expect(input.prompt).toBe('Write a function');
    });

    it('SessionStartInput has source field with specific values', () => {
      const inputs: SessionStartInput[] = [
        {
          hookEventName: 'SessionStart',
          sessionId: 'sess-1',
          transcriptPath: '/path',
          cwd: '/workspace',
          source: 'startup'
        },
        {
          hookEventName: 'SessionStart',
          sessionId: 'sess-2',
          transcriptPath: '/path',
          cwd: '/workspace',
          source: 'resume'
        },
        {
          hookEventName: 'SessionStart',
          sessionId: 'sess-3',
          transcriptPath: '/path',
          cwd: '/workspace',
          source: 'clear'
        },
        {
          hookEventName: 'SessionStart',
          sessionId: 'sess-4',
          transcriptPath: '/path',
          cwd: '/workspace',
          source: 'compact'
        }
      ];

      expect(inputs.map((i) => i.source)).toEqual(['startup', 'resume', 'clear', 'compact']);
    });

    it('SessionEndInput has reason field', () => {
      const input: SessionEndInput = {
        hookEventName: 'SessionEnd',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        reason: 'User exit'
      };

      expect(input.reason).toBe('User exit');
    });

    it('StopInput has stopHookActive field', () => {
      const input: StopInput = {
        hookEventName: 'Stop',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        stopHookActive: true
      };

      expect(input.stopHookActive).toBe(true);
    });

    it('SubagentStartInput has agentId and agentType', () => {
      const input: SubagentStartInput = {
        hookEventName: 'SubagentStart',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        agentId: 'agent-001',
        agentType: 'explore'
      };

      expect(input.agentId).toBe('agent-001');
      expect(input.agentType).toBe('explore');
    });

    it('SubagentStopInput has agentTranscriptPath', () => {
      const input: SubagentStopInput = {
        hookEventName: 'SubagentStop',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        stopHookActive: false,
        agentId: 'agent-001',
        agentTranscriptPath: '/path/to/agent/transcript'
      };

      expect(input.agentTranscriptPath).toBe('/path/to/agent/transcript');
    });

    it('PreCompactInput has trigger and customInstructions', () => {
      const input: PreCompactInput = {
        hookEventName: 'PreCompact',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        trigger: 'manual',
        customInstructions: 'Custom instructions here'
      };

      expect(input.trigger).toBe('manual');
      expect(input.customInstructions).toBe('Custom instructions here');
    });

    it('PermissionRequestInput has toolName and permissionSuggestions', () => {
      const input: PermissionRequestInput = {
        hookEventName: 'PermissionRequest',
        sessionId: 'sess-123',
        transcriptPath: '/path',
        cwd: '/workspace',
        toolName: 'Bash',
        toolInput: { command: 'rm file.txt' },
        permissionSuggestions: []
      };

      expect(input.toolName).toBe('Bash');
      expect(input.permissionSuggestions).toEqual([]);
    });
  });

  describe('BaseHookInput fields', () => {
    it('all inputs have base fields', () => {
      const inputs: HookInput[] = [
        {
          hookEventName: 'PreToolUse',
          sessionId: 'sess-1',
          transcriptPath: '/path1',
          cwd: '/cwd1',
          toolName: 'Bash',
          toolInput: {},
          toolUseId: 'tool-1'
        },
        {
          hookEventName: 'SessionStart',
          sessionId: 'sess-2',
          transcriptPath: '/path2',
          cwd: '/cwd2',
          source: 'startup'
        }
      ];

      for (const input of inputs) {
        // All inputs should have these base fields
        expect(input.sessionId).toBeDefined();
        expect(input.transcriptPath).toBeDefined();
        expect(input.cwd).toBeDefined();
      }
    });

    it('permissionMode is optional on all inputs', () => {
      const inputWithMode: PreToolUseInput = {
        hookEventName: 'PreToolUse',
        sessionId: 'test',
        transcriptPath: '/path',
        cwd: '/cwd',
        toolName: 'Bash',
        toolInput: {},
        toolUseId: 'tool-1',
        permissionMode: 'bypassPermissions'
      };

      const inputWithoutMode: PreToolUseInput = {
        hookEventName: 'PreToolUse',
        sessionId: 'test',
        transcriptPath: '/path',
        cwd: '/cwd',
        toolName: 'Bash',
        toolInput: {},
        toolUseId: 'tool-1'
      };

      expect(inputWithMode.permissionMode).toBe('bypassPermissions');
      expect(inputWithoutMode.permissionMode).toBeUndefined();
    });
  });

  describe('type assignability', () => {
    it('specific input types are assignable to HookInput', () => {
      const preToolUse: PreToolUseInput = {
        hookEventName: 'PreToolUse',
        sessionId: 'test',
        transcriptPath: '/path',
        cwd: '/cwd',
        toolName: 'Bash',
        toolInput: {},
        toolUseId: 'tool-1'
      };

      const sessionStart: SessionStartInput = {
        hookEventName: 'SessionStart',
        sessionId: 'test',
        transcriptPath: '/path',
        cwd: '/cwd',
        source: 'startup'
      };

      // Both should be assignable to HookInput
      const inputs: HookInput[] = [preToolUse, sessionStart];
      expect(inputs.length).toBe(2);
    });

    it('HookInput union includes all 12 hook types', () => {
      // Create an array with one of each type to verify they all work
      const allInputs: HookInput[] = [
        {
          hookEventName: 'PreToolUse',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          toolName: 'T',
          toolInput: {},
          toolUseId: 'id'
        },
        {
          hookEventName: 'PostToolUse',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          toolName: 'T',
          toolInput: {},
          toolResponse: {},
          toolUseId: 'id'
        },
        {
          hookEventName: 'PostToolUseFailure',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          toolName: 'T',
          toolInput: {},
          toolUseId: 'id',
          error: 'err'
        },
        {
          hookEventName: 'Notification',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          message: 'm',
          notificationType: 'info'
        },
        {
          hookEventName: 'UserPromptSubmit',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          prompt: 'p'
        },
        {
          hookEventName: 'SessionStart',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          source: 'startup'
        },
        {
          hookEventName: 'SessionEnd',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          reason: 'r'
        },
        {
          hookEventName: 'Stop',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          stopHookActive: false
        },
        {
          hookEventName: 'SubagentStart',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          agentId: 'a',
          agentType: 't'
        },
        {
          hookEventName: 'SubagentStop',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          stopHookActive: false,
          agentId: 'a',
          agentTranscriptPath: '/atp'
        },
        {
          hookEventName: 'PreCompact',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          trigger: 'manual',
          customInstructions: null
        },
        {
          hookEventName: 'PermissionRequest',
          sessionId: 's',
          transcriptPath: '/p',
          cwd: '/c',
          toolName: 'T',
          toolInput: {}
        }
      ];

      expect(allInputs.length).toBe(12);
    });
  });
});
