/**
 * Test fixture: SubagentStop hook that can block subagent completion.
 *
 * Used to verify SubagentStop hooks are built correctly.
 */

import { subagentStopHook, subagentStopOutput } from '../../src/index.js';

export default subagentStopHook({ matcher: 'explore' }, (input, { logger }) => {
  logger.info('Subagent stopping', {
    agentId: input.agentId,
    agentType: input.agentType,
    agentTranscriptPath: input.agentTranscriptPath
  });
  return subagentStopOutput({
    decision: 'approve',
    systemMessage: 'E2E_SUBAGENT_STOP: Subagent stop approved.'
  });
});
