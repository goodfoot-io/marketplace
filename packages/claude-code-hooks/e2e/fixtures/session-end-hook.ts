/**
 * Test fixture: SessionEnd hook that logs session end.
 *
 * Used to verify SessionEnd hooks are built correctly.
 */

import { sessionEndHook, sessionEndOutput } from '../../src/index.js';

export default sessionEndHook({ matcher: 'logout' }, (input, { logger }) => {
  logger.info('Session ending', {
    sessionId: input.sessionId,
    reason: input.reason
  });
  return sessionEndOutput({
    systemMessage: 'E2E_SESSION_END: Session ended.'
  });
});
