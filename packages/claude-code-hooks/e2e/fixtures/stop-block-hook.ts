/**
 * Test fixture: Stop hook that blocks with a reason.
 *
 * Used to verify that Stop hooks can successfully block Claude from stopping
 * and that the reason is communicated back.
 */

import { stopHook, stopOutput } from '../../src/index.js';

export default stopHook({}, async (_input, { logger }) => {
  logger.info('Blocking stop');

  return stopOutput({
    decision: 'block',
    reason: 'E2E_TEST_BLOCK_REASON: Cannot stop - pending test operations'
  });
});
