/**
 * Type inference tests for output builder types.
 *
 * These tests verify TypeScript correctly enforces type constraints at compile time.
 * They verify mutual exclusivity of options and correct return types.
 * @module
 */

import type { HookOutput } from '../../src/outputs.js';
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
    it('allows valid allow option', () => {
      const output = preToolUseOutput({ allow: true });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows allow with updatedInput', () => {
      const output = preToolUseOutput({
        allow: true,
        updatedInput: { command: 'ls -la' }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows valid deny option', () => {
      const output = preToolUseOutput({ deny: 'Not allowed' });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows valid ask option', () => {
      const output = preToolUseOutput({ ask: 'Confirm this action?' });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows empty options (default behavior)', () => {
      const output = preToolUseOutput({});
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows updatedInput without decision', () => {
      const output = preToolUseOutput({
        updatedInput: { command: 'safe-cmd' }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows base options with decision', () => {
      const output = preToolUseOutput({
        allow: true,
        systemMessage: 'Allowed with message'
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows block option (uses exit code 2)', () => {
      const output = preToolUseOutput({
        block: 'Operation blocked'
      });
      expect(output.exitCode).toBe(EXIT_CODES.BLOCK);
    });

    it('allows error option (uses exit code 1)', () => {
      const output = preToolUseOutput({
        error: 'Something went wrong'
      });
      expect(output.exitCode).toBe(EXIT_CODES.ERROR);
    });
  });

  describe('return type verification', () => {
    it('returns HookOutput type', () => {
      const output: HookOutput = preToolUseOutput({ allow: true });
      expect(output).toHaveProperty('exitCode');
      expect(output).toHaveProperty('stdout');
    });
  });
});

describe('permissionRequestOutput type constraints', () => {
  describe('valid option combinations', () => {
    it('allows valid allow option', () => {
      const output = permissionRequestOutput({ allow: true });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows allow with updatedInput', () => {
      const output = permissionRequestOutput({
        allow: true,
        updatedInput: { file_path: '/safe/path' }
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows allow with updatedPermissions', () => {
      const output = permissionRequestOutput({
        allow: true,
        updatedPermissions: []
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows valid deny option', () => {
      const output = permissionRequestOutput({ deny: true });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows deny with message', () => {
      const output = permissionRequestOutput({
        deny: true,
        message: 'Permission denied'
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows deny with interrupt', () => {
      const output = permissionRequestOutput({
        deny: true,
        interrupt: true
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

    it('allows block decision', () => {
      const output = stopOutput({ decision: 'block' });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows block with reason', () => {
      const output = stopOutput({
        decision: 'block',
        reason: 'Cannot stop yet'
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows empty options (no decision)', () => {
      const output = stopOutput({});
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('allows systemMessage with decision', () => {
      const output = stopOutput({
        decision: 'block',
        reason: 'Pending changes',
        systemMessage: 'Please commit changes first'
      });
      expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });

  describe('decision value type checking', () => {
    it('decision is typed as approve or block', () => {
      // This compiles because 'approve' is a valid decision
      const approveOutput = stopOutput({ decision: 'approve' });
      expect(approveOutput.stdout.decision).toBe('approve');

      // This compiles because 'block' is a valid decision
      const blockOutput = stopOutput({ decision: 'block' });
      expect(blockOutput.stdout.decision).toBe('block');
    });
  });
});

describe('output builders with additionalContext', () => {
  it('postToolUseOutput accepts additionalContext', () => {
    const output = postToolUseOutput({
      additionalContext: 'Extra info for Claude'
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('postToolUseOutput accepts updatedMCPToolOutput', () => {
    const output = postToolUseOutput({
      updatedMCPToolOutput: { modified: true }
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('postToolUseFailureOutput accepts additionalContext', () => {
    const output = postToolUseFailureOutput({
      additionalContext: 'Try another approach'
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('userPromptSubmitOutput accepts additionalContext', () => {
    const output = userPromptSubmitOutput({
      additionalContext: 'Project uses TypeScript strict mode'
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('sessionStartOutput accepts additionalContext', () => {
    const output = sessionStartOutput({
      additionalContext: JSON.stringify({ initialized: true })
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('subagentStartOutput accepts additionalContext', () => {
    const output = subagentStartOutput({
      additionalContext: 'Focus on finding patterns'
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});

describe('output builders without hook-specific options', () => {
  it('sessionEndOutput only accepts base options', () => {
    const output = sessionEndOutput({});
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('sessionEndOutput accepts systemMessage', () => {
    const output = sessionEndOutput({
      systemMessage: 'Cleanup complete'
    });
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('subagentStopOutput only accepts base options', () => {
    const output = subagentStopOutput({});
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('notificationOutput only accepts base options', () => {
    const output = notificationOutput({});
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('preCompactOutput only accepts base options', () => {
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

describe('base options on all builders', () => {
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

  describe('block option', () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts block option`, () => {
        const output = fn({ block: 'Blocked' });
        expect(output.exitCode).toBe(EXIT_CODES.BLOCK);
      });
    }
  });

  describe('error option', () => {
    for (const { name, fn } of builders) {
      it(`${name} accepts error option`, () => {
        const output = fn({ error: 'Error occurred' });
        expect(output.exitCode).toBe(EXIT_CODES.ERROR);
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

describe('HookOutput structure', () => {
  it('has required exitCode property', () => {
    const output = preToolUseOutput({});
    expect(typeof output.exitCode).toBe('number');
  });

  it('has required stdout property', () => {
    const output = preToolUseOutput({});
    expect(typeof output.stdout).toBe('object');
  });

  it('has optional stderr property', () => {
    const successOutput = preToolUseOutput({});
    expect(successOutput.stderr).toBeUndefined();

    const blockOutput = preToolUseOutput({ block: 'Reason' });
    expect(blockOutput.stderr).toBe('Reason');
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
