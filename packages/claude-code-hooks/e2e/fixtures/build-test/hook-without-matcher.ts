/**
 * Test fixture: SessionStart hook without a matcher.
 *
 * Used to verify hooks without matchers are handled correctly.
 */

import { sessionStartHook, sessionStartOutput } from '../../../src/index.js';

export default sessionStartHook({}, (input, { logger }) => {
  logger.info('Session started', { sessionId: input.sessionId });
  return sessionStartOutput({
    hookSpecificOutput: { additionalContext: 'Build test: Session initialized' }
  });
});
