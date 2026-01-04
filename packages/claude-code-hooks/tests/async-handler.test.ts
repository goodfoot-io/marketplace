/**
 * Tests for async handler support.
 */

import type { TypedPreToolUseInput } from '../src/hooks.js';
import type { StopInput } from '../src/inputs.js';
import { describe, it, expect } from 'vitest';
import { stopHook, stopOutput, preToolUseHook, preToolUseOutput, Logger } from '../src/index.js';

describe('async handler support', () => {
  // Logger is silent by default (no stdout/stderr output) — no mocking needed
  const logger = new Logger();
  const context = { logger };

  const baseInput = {
    session_id: 'test-session',
    transcript_path: '/tmp/transcript.jsonl',
    cwd: '/tmp',
    claude_code_version: '1.0.0'
  };

  it('supports sync handlers', async () => {
    const hook = stopHook({}, (_input, { logger: _logger }) => {
      return stopOutput({ decision: 'approve' });
    });

    const mockInput: StopInput = {
      ...baseInput,
      hook_event_name: 'Stop',
      stop_hook_active: false
    };

    const result = await hook(mockInput, context);
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
      hook_event_name: 'Stop',
      stop_hook_active: false
    };

    const result = await hook(mockInput, context);
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

    const mockInput: TypedPreToolUseInput<'Bash'> = {
      ...baseInput,
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo test' },
      tool_use_id: 'test-tool-use-id'
    };

    const result = await hook(mockInput, context);
    expect(result._type).toBe('PreToolUse');
    expect(result.stdout.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
  });
});
