/**
 * Test fixture: PreCompact hook with systemMessage.
 *
 * Used to verify PreCompact hooks are built correctly.
 */

import { preCompactHook, preCompactOutput } from '../../../src/index.js';

export default preCompactHook({}, (input, { logger }) => {
  logger.info('Pre-compact triggered', { trigger: input.trigger });
  return preCompactOutput({
    systemMessage: 'Build test: Compact prepared'
  });
});
