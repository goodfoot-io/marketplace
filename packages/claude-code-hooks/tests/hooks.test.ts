/**
 * Unit tests for hook factory functions.
 *
 * Tests:
 * - All 12 hook factories return properly typed functions
 * - HookFunction has correct metadata (hookEventName, matcher, timeout)
 * - Handler receives correct context (logger)
 */

import type { HookContext } from '../src/hooks.js';
import type {
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
} from '../src/types/inputs.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  preToolUseHook,
  postToolUseHook,
  postToolUseFailureHook,
  notificationHook,
  userPromptSubmitHook,
  sessionStartHook,
  sessionEndHook,
  stopHook,
  subagentStartHook,
  subagentStopHook,
  preCompactHook,
  permissionRequestHook
} from '../src/hooks.js';
import { Logger } from '../src/logger.js';
import {
  preToolUseOutput,
  postToolUseOutput,
  postToolUseFailureOutput,
  notificationOutput,
  userPromptSubmitOutput,
  sessionStartOutput,
  sessionEndOutput,
  stopOutput,
  subagentStartOutput,
  subagentStopOutput,
  preCompactOutput,
  permissionRequestOutput
} from '../src/outputs.js';

// Helper to create minimal valid inputs for each hook type
function createPreToolUseInput(): PreToolUseInput {
  return {
    hookEventName: 'PreToolUse',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    toolName: 'Bash',
    toolInput: { command: 'ls' },
    toolUseId: 'tu_123'
  };
}

function createPostToolUseInput(): PostToolUseInput {
  return {
    hookEventName: 'PostToolUse',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    toolName: 'Bash',
    toolInput: { command: 'ls' },
    toolUseId: 'tu_123',
    toolResponse: 'file1.txt\nfile2.txt'
  };
}

function createPostToolUseFailureInput(): PostToolUseFailureInput {
  return {
    hookEventName: 'PostToolUseFailure',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    toolName: 'Bash',
    toolInput: { command: 'invalid' },
    toolUseId: 'tu_123',
    error: 'Command not found',
    isInterrupt: false
  };
}

function createNotificationInput(): NotificationInput {
  return {
    hookEventName: 'Notification',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    message: 'Task completed',
    notificationType: 'info'
  };
}

function createUserPromptSubmitInput(): UserPromptSubmitInput {
  return {
    hookEventName: 'UserPromptSubmit',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    prompt: 'Help me with this code'
  };
}

function createSessionStartInput(): SessionStartInput {
  return {
    hookEventName: 'SessionStart',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    source: 'startup'
  };
}

function createSessionEndInput(): SessionEndInput {
  return {
    hookEventName: 'SessionEnd',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    reason: 'other'
  };
}

function createStopInput(): StopInput {
  return {
    hookEventName: 'Stop',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    stopHookActive: true
  };
}

function createSubagentStartInput(): SubagentStartInput {
  return {
    hookEventName: 'SubagentStart',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    agentId: 'agent_123',
    agentType: 'explore'
  };
}

function createSubagentStopInput(): SubagentStopInput {
  return {
    hookEventName: 'SubagentStop',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    stopHookActive: false,
    agentId: 'agent_123',
    agentTranscriptPath: '/path/to/agent/transcript'
  };
}

function createPreCompactInput(): PreCompactInput {
  return {
    hookEventName: 'PreCompact',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    trigger: 'auto',
    customInstructions: null
  };
}

function createPermissionRequestInput(): PermissionRequestInput {
  return {
    hookEventName: 'PermissionRequest',
    sessionId: 'test-session',
    transcriptPath: '/path/to/transcript',
    cwd: '/workspace',
    permissionMode: 'default',
    toolName: 'Bash',
    toolInput: { command: 'rm -rf /' },
    toolUseId: 'tool_use_123'
  };
}

describe('Hook Factory Functions', () => {
  let testLogger: Logger;

  beforeEach(() => {
    testLogger = new Logger();
  });

  afterEach(() => {
    testLogger.close();
  });

  describe('preToolUseHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = preToolUseHook({}, () => preToolUseOutput({}));

      expect(hook.hookEventName).toBe('PreToolUse');
    });

    it('attaches matcher from config', () => {
      const hook = preToolUseHook({ matcher: 'Bash' }, () => preToolUseOutput({}));

      expect(hook.matcher).toBe('Bash');
    });

    it('attaches timeout from config', () => {
      const hook = preToolUseHook({ timeout: 5000 }, () => preToolUseOutput({}));

      expect(hook.timeout).toBe(5000);
    });

    it('attaches both matcher and timeout', () => {
      const hook = preToolUseHook({ matcher: 'Read|Write', timeout: 10000 }, () => preToolUseOutput({}));

      expect(hook.matcher).toBe('Read|Write');
      expect(hook.timeout).toBe(10000);
    });

    it('handler receives typed input', async () => {
      let receivedInput: PreToolUseInput | undefined;

      const hook = preToolUseHook({}, (input) => {
        receivedInput = input;
        return preToolUseOutput({});
      });

      const input = createPreToolUseInput();
      await hook(input, { logger: testLogger });

      expect(receivedInput).toBeDefined();
      expect(receivedInput?.toolName).toBe('Bash');
      expect(receivedInput?.hookEventName).toBe('PreToolUse');
    });

    it('handler receives logger in context', async () => {
      let receivedContext: HookContext | undefined;

      const hook = preToolUseHook({}, (_input, context) => {
        receivedContext = context;
        return preToolUseOutput({});
      });

      await hook(createPreToolUseInput(), { logger: testLogger });

      expect(receivedContext).toBeDefined();
      expect(receivedContext?.logger).toBe(testLogger);
    });

    it('returns handler output', async () => {
      const hook = preToolUseHook({}, () =>
        preToolUseOutput({
          hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: 'Blocked' }
        })
      );

      const result = await hook(createPreToolUseInput(), { logger: testLogger });

      expect(result.stdout.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
      if (result.stdout.hookSpecificOutput?.hookEventName === 'PreToolUse') {
        expect(result.stdout.hookSpecificOutput.permissionDecision).toBe('deny');
        expect(result.stdout.hookSpecificOutput.permissionDecisionReason).toBe('Blocked');
      }
    });
  });

  describe('postToolUseHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = postToolUseHook({}, () => postToolUseOutput({}));
      expect(hook.hookEventName).toBe('PostToolUse');
    });

    it('handler receives PostToolUseInput with toolResponse', async () => {
      let receivedInput: PostToolUseInput | undefined;

      const hook = postToolUseHook({}, (input) => {
        receivedInput = input;
        return postToolUseOutput({});
      });

      await hook(createPostToolUseInput(), { logger: testLogger });

      expect(receivedInput?.toolResponse).toBe('file1.txt\nfile2.txt');
    });
  });

  describe('postToolUseFailureHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = postToolUseFailureHook({}, () => postToolUseFailureOutput({}));
      expect(hook.hookEventName).toBe('PostToolUseFailure');
    });

    it('handler receives error and isInterrupt fields', async () => {
      let receivedInput: PostToolUseFailureInput | undefined;

      const hook = postToolUseFailureHook({}, (input) => {
        receivedInput = input;
        return postToolUseFailureOutput({});
      });

      await hook(createPostToolUseFailureInput(), { logger: testLogger });

      expect(receivedInput?.error).toBe('Command not found');
      expect(receivedInput?.isInterrupt).toBe(false);
    });
  });

  describe('notificationHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = notificationHook({}, () => notificationOutput({}));
      expect(hook.hookEventName).toBe('Notification');
    });

    it('handler receives notification fields', async () => {
      let receivedInput: NotificationInput | undefined;

      const hook = notificationHook({}, (input) => {
        receivedInput = input;
        return notificationOutput({});
      });

      await hook(createNotificationInput(), { logger: testLogger });

      expect(receivedInput?.message).toBe('Task completed');
      expect(receivedInput?.notificationType).toBe('info');
    });
  });

  describe('userPromptSubmitHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = userPromptSubmitHook({}, () => userPromptSubmitOutput({}));
      expect(hook.hookEventName).toBe('UserPromptSubmit');
    });

    it('handler receives prompt field', async () => {
      let receivedInput: UserPromptSubmitInput | undefined;

      const hook = userPromptSubmitHook({}, (input) => {
        receivedInput = input;
        return userPromptSubmitOutput({});
      });

      await hook(createUserPromptSubmitInput(), { logger: testLogger });

      expect(receivedInput?.prompt).toBe('Help me with this code');
    });
  });

  describe('sessionStartHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = sessionStartHook({}, () => sessionStartOutput({}));
      expect(hook.hookEventName).toBe('SessionStart');
    });

    it('supports matcher for source field', () => {
      const hook = sessionStartHook({ matcher: 'startup' }, () => sessionStartOutput({}));
      expect(hook.matcher).toBe('startup');
    });

    it('handler receives source field', async () => {
      let receivedInput: SessionStartInput | undefined;

      const hook = sessionStartHook({}, (input) => {
        receivedInput = input;
        return sessionStartOutput({});
      });

      await hook(createSessionStartInput(), { logger: testLogger });

      expect(receivedInput?.source).toBe('startup');
    });
  });

  describe('sessionEndHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = sessionEndHook({}, () => sessionEndOutput({}));
      expect(hook.hookEventName).toBe('SessionEnd');
    });

    it('handler receives reason field', async () => {
      let receivedInput: SessionEndInput | undefined;

      const hook = sessionEndHook({}, (input) => {
        receivedInput = input;
        return sessionEndOutput({});
      });

      await hook(createSessionEndInput(), { logger: testLogger });

      expect(receivedInput?.reason).toBe('other');
    });
  });

  describe('stopHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = stopHook({}, () => stopOutput({}));
      expect(hook.hookEventName).toBe('Stop');
    });

    it('handler receives stopHookActive field', async () => {
      let receivedInput: StopInput | undefined;

      const hook = stopHook({}, (input) => {
        receivedInput = input;
        return stopOutput({});
      });

      await hook(createStopInput(), { logger: testLogger });

      expect(receivedInput?.stopHookActive).toBe(true);
    });

    it('returns correct output for block decision', async () => {
      const hook = stopHook({}, () => stopOutput({ decision: 'block', reason: 'Pending changes' }));

      const result = await hook(createStopInput(), { logger: testLogger });

      expect(result.stdout.decision).toBe('block');
      expect(result.stdout.reason).toBe('Pending changes');
    });
  });

  describe('subagentStartHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = subagentStartHook({}, () => subagentStartOutput({}));
      expect(hook.hookEventName).toBe('SubagentStart');
    });

    it('supports matcher for agentType', () => {
      const hook = subagentStartHook({ matcher: 'explore' }, () => subagentStartOutput({}));
      expect(hook.matcher).toBe('explore');
    });

    it('handler receives agent fields', async () => {
      let receivedInput: SubagentStartInput | undefined;

      const hook = subagentStartHook({}, (input) => {
        receivedInput = input;
        return subagentStartOutput({});
      });

      await hook(createSubagentStartInput(), { logger: testLogger });

      expect(receivedInput?.agentId).toBe('agent_123');
      expect(receivedInput?.agentType).toBe('explore');
    });
  });

  describe('subagentStopHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = subagentStopHook({}, () => subagentStopOutput({}));
      expect(hook.hookEventName).toBe('SubagentStop');
    });

    it('handler receives transcript path', async () => {
      let receivedInput: SubagentStopInput | undefined;

      const hook = subagentStopHook({}, (input) => {
        receivedInput = input;
        return subagentStopOutput({});
      });

      await hook(createSubagentStopInput(), { logger: testLogger });

      expect(receivedInput?.agentTranscriptPath).toBe('/path/to/agent/transcript');
    });
  });

  describe('preCompactHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = preCompactHook({}, () => preCompactOutput({}));
      expect(hook.hookEventName).toBe('PreCompact');
    });

    it('supports matcher for trigger', () => {
      const hook = preCompactHook({ matcher: 'manual' }, () => preCompactOutput({}));
      expect(hook.matcher).toBe('manual');
    });

    it('handler receives trigger and customInstructions', async () => {
      let receivedInput: PreCompactInput | undefined;

      const hook = preCompactHook({}, (input) => {
        receivedInput = input;
        return preCompactOutput({});
      });

      await hook(createPreCompactInput(), { logger: testLogger });

      expect(receivedInput?.trigger).toBe('auto');
      expect(receivedInput?.customInstructions).toBeNull();
    });
  });

  describe('permissionRequestHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = permissionRequestHook({}, () => permissionRequestOutput({}));
      expect(hook.hookEventName).toBe('PermissionRequest');
    });

    it('supports matcher for toolName', () => {
      const hook = permissionRequestHook({ matcher: 'Bash' }, () => permissionRequestOutput({}));
      expect(hook.matcher).toBe('Bash');
    });

    it('handler receives permission request fields', async () => {
      let receivedInput: PermissionRequestInput | undefined;

      const hook = permissionRequestHook({}, (input) => {
        receivedInput = input;
        return permissionRequestOutput({});
      });

      await hook(createPermissionRequestInput(), { logger: testLogger });

      expect(receivedInput?.toolName).toBe('Bash');
      expect(receivedInput?.toolInput).toEqual({ command: 'rm -rf /' });
    });
  });

  describe('All factories share common behavior', () => {
    describe('preToolUseHook common behavior', () => {
      it('returns a callable async function', async () => {
        const hook = preToolUseHook({}, () => preToolUseOutput({}));
        expect(typeof hook).toBe('function');
        const result = hook(createPreToolUseInput(), { logger: testLogger });
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toHaveProperty('stdout');
      });

      it('has undefined matcher when not provided', () => {
        const hook = preToolUseHook({}, () => preToolUseOutput({}));
        expect(hook.matcher).toBeUndefined();
      });

      it('has undefined timeout when not provided', () => {
        const hook = preToolUseHook({}, () => preToolUseOutput({}));
        expect(hook.timeout).toBeUndefined();
      });

      it('supports async handlers', async () => {
        let executed = false;
        const hook = preToolUseHook({}, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          executed = true;
          return preToolUseOutput({});
        });
        await hook(createPreToolUseInput(), { logger: testLogger });
        expect(executed).toBe(true);
      });

      it('supports sync handlers returning PreToolUseOutput', async () => {
        const output = preToolUseOutput({ continue: true });
        const hook = preToolUseHook({}, () => output);
        const result = await hook(createPreToolUseInput(), { logger: testLogger });
        expect(result).toBe(output);
      });
    });

    describe('sessionStartHook common behavior', () => {
      it('returns a callable async function', async () => {
        const hook = sessionStartHook({}, () => sessionStartOutput({}));
        expect(typeof hook).toBe('function');
        const result = hook(createSessionStartInput(), { logger: testLogger });
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toHaveProperty('stdout');
      });

      it('has undefined matcher when not provided', () => {
        const hook = sessionStartHook({}, () => sessionStartOutput({}));
        expect(hook.matcher).toBeUndefined();
      });

      it('has undefined timeout when not provided', () => {
        const hook = sessionStartHook({}, () => sessionStartOutput({}));
        expect(hook.timeout).toBeUndefined();
      });
    });

    describe('stopHook common behavior', () => {
      it('returns a callable async function', async () => {
        const hook = stopHook({}, () => stopOutput({}));
        expect(typeof hook).toBe('function');
        const result = hook(createStopInput(), { logger: testLogger });
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toHaveProperty('stdout');
      });
    });

    describe('permissionRequestHook common behavior', () => {
      it('returns a callable async function', async () => {
        const hook = permissionRequestHook({}, () => permissionRequestOutput({}));
        expect(typeof hook).toBe('function');
        const result = hook(createPermissionRequestInput(), { logger: testLogger });
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toHaveProperty('stdout');
      });
    });
  });
});
