/**
 * Type inference tests for hook factory types.
 *
 * These tests verify TypeScript correctly enforces type constraints at compile time.
 * They verify hook factories enforce correct input type narrowing and return types.
 * @module
 */

import type { HookOutput, HookConfig, HookContext, HookFunction, HookHandler } from '../../src/index.js';
import type {
  PreToolUseInput,
  PostToolUseInput,
  SessionStartInput,
  StopInput,
  PermissionRequestInput
} from '../../src/types/inputs.js';
import { describe, it, expect } from 'vitest';
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
  permissionRequestHook,
  preToolUseOutput,
  postToolUseOutput,
  sessionStartOutput,
  stopOutput,
  permissionRequestOutput,
  EXIT_CODES
} from '../../src/index.js';

describe('hook factory type enforcement', () => {
  describe('preToolUseHook', () => {
    it('enforces PreToolUseInput type in handler', () => {
      const hook = preToolUseHook({}, async (input, { logger }) => {
        // TypeScript knows these properties exist
        const toolName: string = input.toolName;
        const toolInput: unknown = input.toolInput;
        const toolUseId: string = input.toolUseId;
        const hookEventName: 'PreToolUse' = input.hookEventName;

        expect(toolName).toBeDefined();
        expect(toolInput).toBeDefined();
        expect(toolUseId).toBeDefined();
        expect(hookEventName).toBe('PreToolUse');
        expect(logger).toBeDefined();

        return preToolUseOutput({ allow: true });
      });

      expect(hook.hookEventName).toBe('PreToolUse');
    });

    it('requires handler to return HookOutput', () => {
      const hook = preToolUseHook({}, async () => {
        // Return type must be HookOutput
        return preToolUseOutput({ allow: true });
      });

      expect(hook).toBeDefined();
    });

    it('accepts config with matcher', () => {
      const hook = preToolUseHook({ matcher: 'Bash' }, async () => {
        return preToolUseOutput({});
      });

      expect(hook.matcher).toBe('Bash');
    });

    it('accepts config with timeout', () => {
      const hook = preToolUseHook({ timeout: 5000 }, async () => {
        return preToolUseOutput({});
      });

      expect(hook.timeout).toBe(5000);
    });
  });

  describe('postToolUseHook', () => {
    it('enforces PostToolUseInput type in handler', () => {
      const hook = postToolUseHook({}, async (input) => {
        // TypeScript knows toolResponse exists on PostToolUseInput
        const toolResponse: unknown = input.toolResponse;
        const toolName: string = input.toolName;
        const hookEventName: 'PostToolUse' = input.hookEventName;

        expect(toolResponse).toBeDefined();
        expect(toolName).toBeDefined();
        expect(hookEventName).toBe('PostToolUse');

        return postToolUseOutput({});
      });

      expect(hook.hookEventName).toBe('PostToolUse');
    });
  });

  describe('sessionStartHook', () => {
    it('enforces SessionStartInput type in handler', () => {
      const hook = sessionStartHook({}, async (input) => {
        // TypeScript knows source exists on SessionStartInput
        const source: 'startup' | 'resume' | 'clear' | 'compact' = input.source;
        const hookEventName: 'SessionStart' = input.hookEventName;

        expect(source).toBeDefined();
        expect(hookEventName).toBe('SessionStart');

        return sessionStartOutput({});
      });

      expect(hook.hookEventName).toBe('SessionStart');
    });

    it('allows matching on source', () => {
      const hook = sessionStartHook({ matcher: 'startup' }, async () => {
        return sessionStartOutput({});
      });

      expect(hook.matcher).toBe('startup');
    });
  });

  describe('stopHook', () => {
    it('enforces StopInput type in handler', () => {
      const hook = stopHook({}, async (input) => {
        // TypeScript knows stopHookActive exists on StopInput
        const stopHookActive: boolean = input.stopHookActive;
        const hookEventName: 'Stop' = input.hookEventName;

        expect(typeof stopHookActive).toBe('boolean');
        expect(hookEventName).toBe('Stop');

        return stopOutput({});
      });

      expect(hook.hookEventName).toBe('Stop');
    });

    it('allows block and approve decisions', () => {
      const approveHook = stopHook({}, async () => {
        return stopOutput({ decision: 'approve' });
      });

      const blockHook = stopHook({}, async () => {
        return stopOutput({ decision: 'block', reason: 'Pending changes' });
      });

      expect(approveHook).toBeDefined();
      expect(blockHook).toBeDefined();
    });
  });

  describe('permissionRequestHook', () => {
    it('enforces PermissionRequestInput type in handler', () => {
      const hook = permissionRequestHook({}, async (input) => {
        // TypeScript knows these fields exist
        const toolName: string = input.toolName;
        const toolInput: unknown = input.toolInput;
        const hookEventName: 'PermissionRequest' = input.hookEventName;

        expect(toolName).toBeDefined();
        expect(toolInput).toBeDefined();
        expect(hookEventName).toBe('PermissionRequest');

        return permissionRequestOutput({});
      });

      expect(hook.hookEventName).toBe('PermissionRequest');
    });
  });
});

describe('HookFunction type properties', () => {
  it('has hookEventName property', () => {
    const hook = preToolUseHook({}, async () => preToolUseOutput({}));
    expect(hook.hookEventName).toBe('PreToolUse');
  });

  it('has optional matcher property', () => {
    const hookWithMatcher = preToolUseHook({ matcher: 'Bash' }, async () => preToolUseOutput({}));
    expect(hookWithMatcher.matcher).toBe('Bash');

    const hookWithoutMatcher = preToolUseHook({}, async () => preToolUseOutput({}));
    expect(hookWithoutMatcher.matcher).toBeUndefined();
  });

  it('has optional timeout property', () => {
    const hookWithTimeout = preToolUseHook({ timeout: 10000 }, async () => preToolUseOutput({}));
    expect(hookWithTimeout.timeout).toBe(10000);

    const hookWithoutTimeout = preToolUseHook({}, async () => preToolUseOutput({}));
    expect(hookWithoutTimeout.timeout).toBeUndefined();
  });

  it('is callable with input and context', async () => {
    const hook = preToolUseHook({}, async (input) => {
      // Conditional logic that always returns valid output
      if (input.toolName === 'Read') {
        return preToolUseOutput({ allow: true });
      }
      return preToolUseOutput({ deny: 'Not Read tool' });
    });

    const mockInput: PreToolUseInput = {
      hookEventName: 'PreToolUse',
      sessionId: 'test',
      transcriptPath: '/path',
      cwd: '/cwd',
      toolName: 'Read',
      toolInput: {},
      toolUseId: 'tool-1'
    };

    // Import and use the actual Logger class
    const { Logger } = await import('../../src/logger.js');
    const testLogger = new Logger();

    const mockContext: HookContext = {
      logger: testLogger
    };

    const result = await hook(mockInput, mockContext);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});

describe('HookContext type', () => {
  it('provides logger in context', () => {
    const hook = preToolUseHook({}, async (_input, { logger }) => {
      // Logger should have all standard methods
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.logError).toBe('function');
      expect(typeof logger.on).toBe('function');

      return preToolUseOutput({});
    });

    expect(hook).toBeDefined();
  });
});

describe('HookConfig type', () => {
  it('accepts empty config', () => {
    const config: HookConfig = {};
    expect(config).toBeDefined();
  });

  it('accepts matcher string', () => {
    const config: HookConfig = { matcher: 'Bash|Read|Write' };
    expect(config.matcher).toBe('Bash|Read|Write');
  });

  it('accepts timeout number', () => {
    const config: HookConfig = { timeout: 30000 };
    expect(config.timeout).toBe(30000);
  });

  it('accepts both matcher and timeout', () => {
    const config: HookConfig = { matcher: 'Bash', timeout: 5000 };
    expect(config.matcher).toBe('Bash');
    expect(config.timeout).toBe(5000);
  });
});

describe('HookHandler type', () => {
  it('is a function taking input and context', () => {
    const handler: HookHandler<PreToolUseInput> = async (input, context) => {
      expect(input.toolName).toBeDefined();
      expect(context.logger).toBeDefined();
      return preToolUseOutput({});
    };

    expect(handler).toBeDefined();
  });

  it('can be synchronous', () => {
    const syncHandler: HookHandler<PreToolUseInput> = (input) => {
      // Conditional logic that always returns valid output
      if (input.toolName === 'Read') {
        return preToolUseOutput({ allow: true });
      }
      return preToolUseOutput({ deny: 'Not Read tool' });
    };

    expect(syncHandler).toBeDefined();
  });

  it('can be asynchronous', () => {
    const asyncHandler: HookHandler<PreToolUseInput> = async (input) => {
      await Promise.resolve();
      // Conditional logic that always returns valid output
      if (input.toolName === 'Read') {
        return preToolUseOutput({ allow: true });
      }
      return preToolUseOutput({ deny: 'Not Read tool' });
    };

    expect(asyncHandler).toBeDefined();
  });
});

describe('all hook factories', () => {
  const factories = [
    { name: 'preToolUseHook', factory: preToolUseHook },
    { name: 'postToolUseHook', factory: postToolUseHook },
    { name: 'postToolUseFailureHook', factory: postToolUseFailureHook },
    { name: 'notificationHook', factory: notificationHook },
    { name: 'userPromptSubmitHook', factory: userPromptSubmitHook },
    { name: 'sessionStartHook', factory: sessionStartHook },
    { name: 'sessionEndHook', factory: sessionEndHook },
    { name: 'stopHook', factory: stopHook },
    { name: 'subagentStartHook', factory: subagentStartHook },
    { name: 'subagentStopHook', factory: subagentStopHook },
    { name: 'preCompactHook', factory: preCompactHook },
    { name: 'permissionRequestHook', factory: permissionRequestHook }
  ];

  describe('return HookFunction', () => {
    for (const { name, factory } of factories) {
      it(`${name} returns HookFunction`, () => {
        // Need to cast to avoid complex generic inference issues
        const hook = (factory as typeof preToolUseHook)({}, async () => preToolUseOutput({}));
        expect(hook).toHaveProperty('hookEventName');
      });
    }
  });

  describe('accept HookConfig', () => {
    for (const { name, factory } of factories) {
      it(`${name} accepts config with matcher and timeout`, () => {
        const config: HookConfig = { matcher: 'test', timeout: 1000 };
        // Cast to avoid complex generic inference issues
        const hook = (factory as typeof preToolUseHook)(config, async () => preToolUseOutput({}));
        expect(hook.matcher).toBe('test');
        expect(hook.timeout).toBe(1000);
      });
    }
  });
});
