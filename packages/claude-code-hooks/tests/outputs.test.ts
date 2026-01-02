/**
 * Unit tests for output builder functions.
 *
 * Tests all 12 output builder functions for:
 * - Correct exit codes
 * - Correct JSON output structure
 * - BaseOptions (block, error, continue, suppressOutput, systemMessage)
 * - Hook-specific options
 * - Empty options semantics
 */

import { describe, it, expect } from 'vitest';
import {
  EXIT_CODES,
  preToolUseOutput,
  postToolUseOutput,
  postToolUseFailureOutput,
  userPromptSubmitOutput,
  sessionStartOutput,
  sessionEndOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  notificationOutput,
  preCompactOutput,
  permissionRequestOutput
} from '../src/outputs.js';

describe('EXIT_CODES', () => {
  it('defines correct exit code constants', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
    expect(EXIT_CODES.ERROR).toBe(1);
    expect(EXIT_CODES.BLOCK).toBe(2);
  });
});

describe('preToolUseOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = preToolUseOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
    expect(result.stderr).toBeUndefined();
  });

  it('produces allow decision with permissionDecision=allow', () => {
    const result = preToolUseOutput({ allow: true });
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: undefined
    });
  });

  it('produces allow decision with updatedInput', () => {
    const result = preToolUseOutput({
      allow: true,
      updatedInput: { command: 'ls -la' }
    });
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: { command: 'ls -la' }
    });
  });

  it('produces deny decision with permissionDecision=deny', () => {
    const result = preToolUseOutput({ deny: 'Dangerous command' });
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Dangerous command'
    });
  });

  it('produces ask decision with permissionDecision=ask', () => {
    const result = preToolUseOutput({ ask: 'Are you sure?' });
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: 'Are you sure?'
    });
  });

  it('allows updatedInput without explicit allow', () => {
    const result = preToolUseOutput({ updatedInput: { file: '/tmp/test' } });
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PreToolUse',
      updatedInput: { file: '/tmp/test' }
    });
  });

  it('handles block option with exit code 2', () => {
    const result = preToolUseOutput({ block: 'Operation blocked' });
    expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
    expect(result.stdout.stopReason).toBe('Operation blocked');
    expect(result.stderr).toBe('Operation blocked');
  });

  it('handles error option with exit code 1', () => {
    const result = preToolUseOutput({ error: 'Something went wrong' });
    expect(result.exitCode).toBe(EXIT_CODES.ERROR);
    expect(result.stdout).toEqual({});
    expect(result.stderr).toBe('Something went wrong');
  });

  it('handles systemMessage base option', () => {
    const result = preToolUseOutput({
      allow: true,
      systemMessage: 'Tool was allowed'
    });
    expect(result.stdout.systemMessage).toBe('Tool was allowed');
  });

  it('handles continue base option', () => {
    const result = preToolUseOutput({ allow: true, continue: true });
    expect(result.stdout.continue).toBe(true);
  });

  it('handles suppressOutput base option', () => {
    const result = preToolUseOutput({ allow: true, suppressOutput: true });
    expect(result.stdout.suppressOutput).toBe(true);
  });

  it('block option includes systemMessage when provided', () => {
    const result = preToolUseOutput({
      block: 'Blocked',
      systemMessage: 'Contact admin'
    });
    expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
    expect(result.stdout.stopReason).toBe('Blocked');
    expect(result.stdout.systemMessage).toBe('Contact admin');
  });
});

describe('postToolUseOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = postToolUseOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('produces additionalContext in hookSpecificOutput', () => {
    const result = postToolUseOutput({ additionalContext: 'File was read' });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PostToolUse',
      additionalContext: 'File was read',
      updatedMCPToolOutput: undefined
    });
  });

  it('produces updatedMCPToolOutput in hookSpecificOutput', () => {
    const result = postToolUseOutput({
      updatedMCPToolOutput: { modified: true, data: 'test' }
    });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PostToolUse',
      additionalContext: undefined,
      updatedMCPToolOutput: { modified: true, data: 'test' }
    });
  });

  it('handles block option', () => {
    const result = postToolUseOutput({ block: 'Blocked after tool use' });
    expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
    expect(result.stderr).toBe('Blocked after tool use');
  });

  it('handles error option', () => {
    const result = postToolUseOutput({ error: 'Post-tool error' });
    expect(result.exitCode).toBe(EXIT_CODES.ERROR);
    expect(result.stderr).toBe('Post-tool error');
  });
});

describe('postToolUseFailureOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = postToolUseFailureOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('produces additionalContext in hookSpecificOutput', () => {
    const result = postToolUseFailureOutput({
      additionalContext: 'Try alternative approach'
    });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PostToolUseFailure',
      additionalContext: 'Try alternative approach'
    });
  });

  it('handles block option', () => {
    const result = postToolUseFailureOutput({ block: 'Critical failure' });
    expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
  });
});

describe('userPromptSubmitOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = userPromptSubmitOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('produces additionalContext in hookSpecificOutput', () => {
    const result = userPromptSubmitOutput({
      additionalContext: 'Project uses TypeScript'
    });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'UserPromptSubmit',
      additionalContext: 'Project uses TypeScript'
    });
  });
});

describe('sessionStartOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = sessionStartOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('produces additionalContext in hookSpecificOutput', () => {
    const result = sessionStartOutput({
      additionalContext: JSON.stringify({ initialized: true })
    });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'SessionStart',
      additionalContext: '{"initialized":true}'
    });
  });

  it('handles systemMessage without additionalContext', () => {
    const result = sessionStartOutput({ systemMessage: 'Welcome message' });
    expect(result.stdout.systemMessage).toBe('Welcome message');
    expect(result.stdout.hookSpecificOutput).toBeUndefined();
  });
});

describe('sessionEndOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = sessionEndOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('handles systemMessage', () => {
    const result = sessionEndOutput({ systemMessage: 'Session cleanup complete' });
    expect(result.stdout.systemMessage).toBe('Session cleanup complete');
  });

  it('handles block option', () => {
    const result = sessionEndOutput({ block: 'Cannot end session' });
    expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
  });
});

describe('stopOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = stopOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('produces approve decision at top-level', () => {
    const result = stopOutput({ decision: 'approve' });
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout.decision).toBe('approve');
  });

  it('produces block decision with reason at top-level', () => {
    const result = stopOutput({
      decision: 'block',
      reason: 'Uncommitted changes present'
    });
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout.decision).toBe('block');
    expect(result.stdout.reason).toBe('Uncommitted changes present');
  });

  it('handles systemMessage with decision', () => {
    const result = stopOutput({
      decision: 'block',
      reason: 'Changes pending',
      systemMessage: 'Please commit before stopping'
    });
    expect(result.stdout.systemMessage).toBe('Please commit before stopping');
    expect(result.stdout.decision).toBe('block');
  });

  it('block base option overrides decision', () => {
    // When block base option is used, it takes precedence
    const result = stopOutput({ block: 'Hard block' });
    expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
    expect(result.stdout.stopReason).toBe('Hard block');
  });
});

describe('subagentStartOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = subagentStartOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('produces additionalContext in hookSpecificOutput', () => {
    const result = subagentStartOutput({
      additionalContext: 'Focus on patterns'
    });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'SubagentStart',
      additionalContext: 'Focus on patterns'
    });
  });
});

describe('subagentStopOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = subagentStopOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('handles systemMessage', () => {
    const result = subagentStopOutput({ systemMessage: 'Subagent completed' });
    expect(result.stdout.systemMessage).toBe('Subagent completed');
  });
});

describe('notificationOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = notificationOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('handles systemMessage', () => {
    const result = notificationOutput({
      systemMessage: 'Notification forwarded to Slack'
    });
    expect(result.stdout.systemMessage).toBe('Notification forwarded to Slack');
  });
});

describe('preCompactOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = preCompactOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('handles systemMessage for context preservation', () => {
    const result = preCompactOutput({
      systemMessage: 'Remember: strict mode is enabled'
    });
    expect(result.stdout.systemMessage).toBe('Remember: strict mode is enabled');
  });
});

describe('permissionRequestOutput', () => {
  it('produces exit 0 and empty JSON for empty options', () => {
    const result = permissionRequestOutput({});
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.stdout).toEqual({});
  });

  it('produces allow decision in hookSpecificOutput', () => {
    const result = permissionRequestOutput({ allow: true });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'allow',
        updatedInput: undefined,
        updatedPermissions: undefined
      }
    });
  });

  it('produces allow decision with updatedInput', () => {
    const result = permissionRequestOutput({
      allow: true,
      updatedInput: { file_path: '/safe/path/file.txt' }
    });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'allow',
        updatedInput: { file_path: '/safe/path/file.txt' },
        updatedPermissions: undefined
      }
    });
  });

  it('produces allow decision with updatedPermissions', () => {
    const updatedPermissions = [
      {
        type: 'addRules' as const,
        rules: [{ toolName: 'Read', ruleContent: '/tmp/*' }],
        behavior: 'allow' as const,
        destination: 'session' as const
      }
    ];
    const result = permissionRequestOutput({
      allow: true,
      updatedPermissions
    });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'allow',
        updatedInput: undefined,
        updatedPermissions
      }
    });
  });

  it('produces deny decision in hookSpecificOutput', () => {
    const result = permissionRequestOutput({ deny: true });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'deny',
        message: undefined,
        interrupt: undefined
      }
    });
  });

  it('produces deny decision with message and interrupt', () => {
    const result = permissionRequestOutput({
      deny: true,
      message: 'Operation not allowed',
      interrupt: true
    });
    expect(result.stdout.hookSpecificOutput).toEqual({
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'deny',
        message: 'Operation not allowed',
        interrupt: true
      }
    });
  });

  it('handles block option', () => {
    const result = permissionRequestOutput({ block: 'Permission denied' });
    expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
  });
});

describe('BaseOptions handling across all builders', () => {
  const outputBuilders = [
    { name: 'preToolUseOutput', fn: preToolUseOutput },
    { name: 'postToolUseOutput', fn: postToolUseOutput },
    { name: 'postToolUseFailureOutput', fn: postToolUseFailureOutput },
    { name: 'userPromptSubmitOutput', fn: userPromptSubmitOutput },
    { name: 'sessionStartOutput', fn: sessionStartOutput },
    { name: 'sessionEndOutput', fn: sessionEndOutput },
    { name: 'stopOutput', fn: stopOutput },
    { name: 'subagentStartOutput', fn: subagentStartOutput },
    { name: 'subagentStopOutput', fn: subagentStopOutput },
    { name: 'notificationOutput', fn: notificationOutput },
    { name: 'preCompactOutput', fn: preCompactOutput },
    { name: 'permissionRequestOutput', fn: permissionRequestOutput }
  ];

  for (const { name, fn } of outputBuilders) {
    describe(`${name}`, () => {
      it('block option produces exit code 2', () => {
        const result = fn({ block: 'Test block' });
        expect(result.exitCode).toBe(EXIT_CODES.BLOCK);
        expect(result.stderr).toBe('Test block');
      });

      it('error option produces exit code 1', () => {
        const result = fn({ error: 'Test error' });
        expect(result.exitCode).toBe(EXIT_CODES.ERROR);
        expect(result.stderr).toBe('Test error');
      });

      it('empty options produces exit code 0', () => {
        const result = fn({});
        expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      });
    });
  }
});
