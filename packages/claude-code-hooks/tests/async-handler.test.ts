/**
 * Tests for async handler support.
 */

import type { PreToolUseInput, StopInput } from '../src/inputs.js';
import { describe, it, expect } from 'vitest';
import { stopHook, stopOutput, preToolUseHook, preToolUseOutput, Logger } from '../src/index.js';

describe('async handler support', () => {
  const mockLogger = new Logger();
  const mockContext = { logger: mockLogger };

  const baseInput = {
    sessionId: 'test-session',
    transcriptPath: '/tmp/transcript.jsonl',
    cwd: '/tmp',
    claudeCodeVersion: '1.0.0'
  };

  it('supports sync handlers', async () => {
    const hook = stopHook({}, (_input, { logger: _logger }) => {
      return stopOutput({ decision: 'approve' });
    });

    const mockInput: StopInput = {
      ...baseInput,
      hookEventName: 'Stop',
      stopHookActive: false
    };

    const result = await hook(mockInput, mockContext);
    expect(result._type).toBe('Stop');
    expect(result.stdout.decision).toBe('approve');
  });

  it('supports async handlers', async () => {
    const hook = stopHook({}, async (_input, { logger: _logger }) => {
      await Promise.resolve(); // simulate async operation
      return stopOutput({ decision: 'block', reason: 'async reason' });
    });

    const mockInput: StopInput = {
      ...baseInput,
      hookEventName: 'Stop',
      stopHookActive: false
    };

    const result = await hook(mockInput, mockContext);
    expect(result._type).toBe('Stop');
    expect(result.stdout.decision).toBe('block');
    expect(result.stdout.reason).toBe('async reason');
  });

  it('supports async handlers with real async operations', async () => {
    const hook = preToolUseHook({ matcher: 'Bash' }, async (_input, { logger: _logger }) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return preToolUseOutput({
        hookSpecificOutput: { permissionDecision: 'allow' }
      });
    });

    const mockInput: PreToolUseInput = {
      ...baseInput,
      hookEventName: 'PreToolUse',
      toolName: 'Bash',
      toolInput: { command: 'echo test' },
      toolUseId: 'test-tool-use-id'
    };

    const result = await hook(mockInput, mockContext);
    expect(result._type).toBe('PreToolUse');
    expect(result.stdout.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
  });
});
