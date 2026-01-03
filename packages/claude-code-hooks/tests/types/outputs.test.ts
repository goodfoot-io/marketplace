/**
 * Type inference tests for output builder types.
 *
 * These tests verify TypeScript correctly enforces type constraints at compile time.
 * They verify the wire format structure and correct return types.
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
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
  permissionRequestOutput,
  EXIT_CODES
} from '../../src/outputs.js';

describe('preToolUseOutput type constraints', () => {
  describe('valid option combinations', () => {
    it('allows valid permissionDecision allow', () => {
      const output = preToolUseOutput({
        hookSpecificOutput: { permissionDecision: 'allow' }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows permissionDecision allow with updatedInput', () => {
      const output = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: 'allow',
          updatedInput: { command: 'ls -la' }
        }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows valid permissionDecision deny', () => {
      const output = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: 'Not allowed'
        }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows valid permissionDecision ask', () => {
      const output = preToolUseOutput({
        hookSpecificOutput: {
          permissionDecision: 'ask',
          permissionDecisionReason: 'Confirm this action?'
        }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows empty options (default behavior)', () => {
      const output = preToolUseOutput({});
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows updatedInput without decision', () => {
      const output = preToolUseOutput({
        hookSpecificOutput: { updatedInput: { command: 'safe-cmd' } }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows common options with hookSpecificOutput', () => {
      const output = preToolUseOutput({
        hookSpecificOutput: { permissionDecision: 'allow' },
        systemMessage: 'Allowed with message'
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows stopReason (uses exit code 2)', () => {
      const output = preToolUseOutput({
        stopReason: 'Operation blocked'
      });
      expect(output.exitCode).toBe(EXIT_CODES.BLOCK);
    });
  });

  describe('return type verification', () => {
    it('returns PreToolUseOutput type with exitCode and stdout', () => {
      const output = preToolUseOutput({
        hookSpecificOutput: { permissionDecision: 'allow' }
      });
      expect(output).toHaveProperty('exitCode');
      expect(output).toHaveProperty('stdout');
      expect(output).toHaveProperty('_type', 'PreToolUse');
    });
  });
});

describe('permissionRequestOutput type constraints', () => {
  describe('valid option combinations', () => {
    it('allows valid allow decision', () => {
      const output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: { behavior: 'allow' }
        }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows allow with updatedInput', () => {
      const output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: 'allow',
            updatedInput: { file_path: '/safe/path' }
          }
        }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows allow with updatedPermissions', () => {
      const output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: 'allow',
            updatedPermissions: []
          }
        }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows valid deny decision', () => {
      const output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: { behavior: 'deny' }
        }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows deny with message', () => {
      const output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: 'deny',
            message: 'Permission denied'
          }
        }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows deny with interrupt', () => {
      const output = permissionRequestOutput({
        hookSpecificOutput: {
          decision: {
            behavior: 'deny',
            interrupt: true
          }
        }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows empty options (fall through)', () => {
      const output = permissionRequestOutput({});
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });
});

describe('stopOutput type constraints', () => {
  describe('valid option combinations', () => {
    it('allows approve decision', () => {
      const output = stopOutput({ decision: 'approve' });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows block decision with exit code 2', () => {
      const output = stopOutput({ decision: 'block' });
      expect(output.exitCode).toBe(EXIT_CODES.BLOCK);
    });

    it('allows block with reason', () => {
      const output = stopOutput({
        decision: 'block',
        reason: 'Cannot stop yet'
      });
      expect(output.exitCode).toBe(EXIT_CODES.BLOCK);
    });

    it('allows empty options (defaults to approve)', () => {
      const output = stopOutput({});
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output.stdout.decision).toBe('approve');
    });

    it('allows systemMessage with decision', () => {
      const output = stopOutput({
        decision: 'block',
        reason: 'Pending changes',
        systemMessage: 'Please commit changes first'
      });
      expect(output.exitCode).toBe(EXIT_CODES.BLOCK);
    });
  });

  describe('decision value type checking', () => {
    it('decision is typed as approve or block', () => {
      const approveOutput = stopOutput({ decision: 'approve' });
      expect(approveOutput.stdout.decision).toBe('approve');

      const blockOutput = stopOutput({ decision: 'block' });
      expect(blockOutput.stdout.decision).toBe('block');
    });
  });
});

describe('output builders with additionalContext in hookSpecificOutput', () => {
  it('postToolUseOutput accepts additionalContext', () => {
    const output = postToolUseOutput({
      hookSpecificOutput: { additionalContext: 'Extra info for Claude' }
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('postToolUseOutput accepts updatedMCPToolOutput', () => {
    const output = postToolUseOutput({
      hookSpecificOutput: { updatedMCPToolOutput: { modified: true } }
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('postToolUseFailureOutput accepts additionalContext', () => {
    const output = postToolUseFailureOutput({
      hookSpecificOutput: { additionalContext: 'Try another approach' }
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('userPromptSubmitOutput accepts additionalContext', () => {
    const output = userPromptSubmitOutput({
      hookSpecificOutput: { additionalContext: 'Project uses TypeScript strict mode' }
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('sessionStartOutput accepts additionalContext', () => {
    const output = sessionStartOutput({
      hookSpecificOutput: { additionalContext: JSON.stringify({ initialized: true }) }
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('subagentStartOutput accepts additionalContext', () => {
    const output = subagentStartOutput({
      hookSpecificOutput: { additionalContext: 'Focus on finding patterns' }
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});

describe('output builders without hook-specific options', () => {
  it('sessionEndOutput only accepts common options', () => {
    const output = sessionEndOutput({});
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('sessionEndOutput accepts systemMessage', () => {
    const output = sessionEndOutput({
      systemMessage: 'Cleanup complete'
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('subagentStopOutput accepts decision and reason', () => {
    const output = subagentStopOutput({
      decision: 'block',
      reason: 'Task incomplete'
    });
    expect(output.exitCode).toBe(EXIT_CODES.BLOCK);
  });

  it('notificationOutput only accepts common options', () => {
    const output = notificationOutput({});
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('preCompactOutput only accepts common options', () => {
    const output = preCompactOutput({});
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('preCompactOutput accepts systemMessage', () => {
    const output = preCompactOutput({
      systemMessage: 'Remember: strict mode enabled'
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});

describe('common options on all builders', () => {
  const builders = [
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

  describe('stopReason option', () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts stopReason option`, () => {
        const output = fn({ stopReason: 'Blocked' });
        expect(output.exitCode).toBe(EXIT_CODES.BLOCK);
      });
    }
  });

  describe('continue option', () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts continue option`, () => {
        const output = fn({ continue: true });
        expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
        expect(output.stdout.continue).toBe(true);
      });
    }
  });

  describe('suppressOutput option', () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts suppressOutput option`, () => {
        const output = fn({ suppressOutput: true });
        expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
        expect(output.stdout.suppressOutput).toBe(true);
      });
    }
  });

  describe('systemMessage option', () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts systemMessage option`, () => {
        const output = fn({ systemMessage: 'System message' });
        expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
        expect(output.stdout.systemMessage).toBe('System message');
      });
    }
  });
});

describe('Specific output type structure', () => {
  it('has required exitCode property', () => {
    const output = preToolUseOutput({});
    expect(typeof output.exitCode).toBe('number');
  });

  it('has required stdout property', () => {
    const output = preToolUseOutput({});
    expect(typeof output.stdout).toBe('object');
  });

  it('has _type property for hook identification', () => {
    const output = preToolUseOutput({});
    expect(output._type).toBe('PreToolUse');
  });

  it('stopReason is stored in stdout.stopReason', () => {
    const successOutput = preToolUseOutput({});
    expect(successOutput.stdout.stopReason).toBeUndefined();

    const blockOutput = preToolUseOutput({ stopReason: 'Reason' });
    expect(blockOutput.stdout.stopReason).toBe('Reason');
  });
});

describe('EXIT_CODES constants', () => {
  it('SUCCESS is 0', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
  });

  it('ERROR is 1', () => {
    expect(EXIT_CODES.ERROR).toBe(1);
  });

  it('BLOCK is 2', () => {
    expect(EXIT_CODES.BLOCK).toBe(2);
  });
});
