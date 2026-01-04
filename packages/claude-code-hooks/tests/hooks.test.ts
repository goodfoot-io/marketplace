/**
 * Unit tests for hook factory functions.
 *
 * Tests:
 * - All 12 hook factories return properly typed functions
 * - HookFunction has correct metadata (hook_event_name, matcher, timeout)
 * - Handler receives correct context (logger)
 */

import type { HookContext, SessionStartContext } from '../src/hooks.js';
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
} from '../src/inputs.js';
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
    hook_event_name: 'PreToolUse',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
    tool_use_id: 'tu_123'
  };
}

function createPostToolUseInput(): PostToolUseInput {
  return {
    hook_event_name: 'PostToolUse',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
    tool_use_id: 'tu_123',
    tool_response: 'file1.txt\nfile2.txt'
  };
}

function createPostToolUseFailureInput(): PostToolUseFailureInput {
  return {
    hook_event_name: 'PostToolUseFailure',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    tool_name: 'Bash',
    tool_input: { command: 'invalid' },
    tool_use_id: 'tu_123',
    error: 'Command not found',
    is_interrupt: false
  };
}

function createNotificationInput(): NotificationInput {
  return {
    hook_event_name: 'Notification',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    message: 'Task completed',
    notification_type: 'info'
  };
}

function createUserPromptSubmitInput(): UserPromptSubmitInput {
  return {
    hook_event_name: 'UserPromptSubmit',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    prompt: 'Help me with this code'
  };
}

function createSessionStartInput(): SessionStartInput {
  return {
    hook_event_name: 'SessionStart',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    source: 'startup'
  };
}

function createSessionEndInput(): SessionEndInput {
  return {
    hook_event_name: 'SessionEnd',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    reason: 'other'
  };
}

function createStopInput(): StopInput {
  return {
    hook_event_name: 'Stop',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    stop_hook_active: true
  };
}

function createSubagentStartInput(): SubagentStartInput {
  return {
    hook_event_name: 'SubagentStart',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    agent_id: 'agent_123',
    agent_type: 'explore'
  };
}

function createSubagentStopInput(): SubagentStopInput {
  return {
    hook_event_name: 'SubagentStop',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    stop_hook_active: false,
    agent_id: 'agent_123',
    agent_type: 'explore',
    agent_transcript_path: '/path/to/agent/transcript'
  };
}

function createPreCompactInput(): PreCompactInput {
  return {
    hook_event_name: 'PreCompact',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    trigger: 'auto',
    custom_instructions: null
  };
}

function createPermissionRequestInput(): PermissionRequestInput {
  return {
    hook_event_name: 'PermissionRequest',
    session_id: 'test-session',
    transcript_path: '/path/to/transcript',
    cwd: '/workspace',
    permission_mode: 'default',
    tool_name: 'Bash',
    tool_input: { command: 'rm -rf /' },
    tool_use_id: 'tool_use_123'
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
      expect(receivedInput?.tool_name).toBe('Bash');
      expect(receivedInput?.hook_event_name).toBe('PreToolUse');
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

    it('handler receives PostToolUseInput with tool_response', async () => {
      let receivedInput: PostToolUseInput | undefined;

      const hook = postToolUseHook({}, (input) => {
        receivedInput = input;
        return postToolUseOutput({});
      });

      await hook(createPostToolUseInput(), { logger: testLogger });

      expect(receivedInput?.tool_response).toBe('file1.txt\nfile2.txt');
    });
  });

  describe('postToolUseFailureHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = postToolUseFailureHook({}, () => postToolUseFailureOutput({}));
      expect(hook.hookEventName).toBe('PostToolUseFailure');
    });

    it('handler receives error and is_interrupt fields', async () => {
      let receivedInput: PostToolUseFailureInput | undefined;

      const hook = postToolUseFailureHook({}, (input) => {
        receivedInput = input;
        return postToolUseFailureOutput({});
      });

      await hook(createPostToolUseFailureInput(), { logger: testLogger });

      expect(receivedInput?.error).toBe('Command not found');
      expect(receivedInput?.is_interrupt).toBe(false);
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
      expect(receivedInput?.notification_type).toBe('info');
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

      const sessionStartContext: SessionStartContext = {
        logger: testLogger,
        persistEnvVar: () => {},
        persistEnvVars: () => {}
      };
      await hook(createSessionStartInput(), sessionStartContext);

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

    it('handler receives stop_hook_active field', async () => {
      let receivedInput: StopInput | undefined;

      const hook = stopHook({}, (input) => {
        receivedInput = input;
        return stopOutput({});
      });

      await hook(createStopInput(), { logger: testLogger });

      expect(receivedInput?.stop_hook_active).toBe(true);
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

    it('supports matcher for agent_type', () => {
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

      expect(receivedInput?.agent_id).toBe('agent_123');
      expect(receivedInput?.agent_type).toBe('explore');
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

      expect(receivedInput?.agent_transcript_path).toBe('/path/to/agent/transcript');
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

    it('handler receives trigger and custom_instructions', async () => {
      let receivedInput: PreCompactInput | undefined;

      const hook = preCompactHook({}, (input) => {
        receivedInput = input;
        return preCompactOutput({});
      });

      await hook(createPreCompactInput(), { logger: testLogger });

      expect(receivedInput?.trigger).toBe('auto');
      expect(receivedInput?.custom_instructions).toBeNull();
    });
  });

  describe('permissionRequestHook', () => {
    it('returns a HookFunction with correct hookEventName', () => {
      const hook = permissionRequestHook({}, () => permissionRequestOutput({}));
      expect(hook.hookEventName).toBe('PermissionRequest');
    });

    it('supports matcher for tool_name', () => {
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

      expect(receivedInput?.tool_name).toBe('Bash');
      expect(receivedInput?.tool_input).toEqual({ command: 'rm -rf /' });
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
        const sessionStartContext: SessionStartContext = {
          logger: testLogger,
          persistEnvVar: () => {},
          persistEnvVars: () => {}
        };
        const result = hook(createSessionStartInput(), sessionStartContext);
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
