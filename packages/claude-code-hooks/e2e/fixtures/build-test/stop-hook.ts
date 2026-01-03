/**
 * Test fixture: Stop hook with decision.
 *
 * Used to verify Stop hooks are built correctly.
 */

import { stopHook, stopOutput } from '../../../src/index.js';

export default stopHook({}, (input, { logger }) => {
  logger.info('Stop requested', { stopHookActive: input.stopHookActive });
  return stopOutput({
    decision: 'approve',
    reason: 'Build test: Approved stop'
  });
});
