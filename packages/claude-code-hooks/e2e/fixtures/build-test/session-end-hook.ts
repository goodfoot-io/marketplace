/**
 * Test fixture: SessionEnd hook.
 *
 * Used to verify SessionEnd hooks are built correctly.
 */

import { sessionEndHook, sessionEndOutput } from '../../../src/index.js';

export default sessionEndHook({ matcher: 'logout' }, (input, { logger }) => {
  logger.info('Session ending', { reason: input.reason });
  return sessionEndOutput({});
});
