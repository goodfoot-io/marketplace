/**
 * Test fixture: SubagentStop hook with decision/reason.
 *
 * Used to verify SubagentStop hooks are built correctly with new features.
 */

import { subagentStopHook, subagentStopOutput } from '../../../src/index.js';

export default subagentStopHook({ matcher: 'explore' }, (input, { logger }) => {
  logger.info('Subagent stopping', {
    agentId: input.agentId
  });
  return subagentStopOutput({
    decision: 'approve',
    reason: 'Build test: Task complete'
  });
});
