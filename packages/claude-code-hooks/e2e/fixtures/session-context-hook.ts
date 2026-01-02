/**
 * Test fixture: SessionStart hook that injects additional context.
 *
 * Used to verify that SessionStart hooks can successfully inject context
 * that Claude will see and acknowledge.
 */

import { sessionStartHook, sessionStartOutput } from '../../src/index.js';

export default sessionStartHook({ matcher: 'startup' }, async (_input, { logger }) => {
  logger.info('Injecting session context');

  return sessionStartOutput({
    additionalContext: 'E2E_TEST_CONTEXT: The magic test word is "HOOK_INJECTED_BANANA".'
  });
});
