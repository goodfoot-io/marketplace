/**
 * Test fixture: SessionStart hook with 'startup' matcher.
 *
 * Used to verify that SessionStart matchers correctly filter by source type.
 * This hook only fires on fresh session startups, not on resume/clear/compact.
 */

import { sessionStartHook, sessionStartOutput } from '../../src/index.js';

export default sessionStartHook({ matcher: 'startup' }, (input, { logger }) => {
  logger.info('SessionStart matcher hook triggered', { source: input.source });

  return sessionStartOutput({
    hookSpecificOutput: { additionalContext: 'E2E_STARTUP_MATCHER: This only appears on fresh startups.' }
  });
});
