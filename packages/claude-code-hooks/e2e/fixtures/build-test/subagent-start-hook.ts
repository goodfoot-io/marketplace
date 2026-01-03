/**
 * Test fixture: SubagentStart hook with matcher.
 *
 * Used to verify SubagentStart hooks are built correctly.
 */

import { subagentStartHook, subagentStartOutput } from '../../../src/index.js';

export default subagentStartHook({ matcher: 'explore' }, (input, { logger }) => {
  logger.info('Subagent starting', {
    agentId: input.agentId,
    agentType: input.agentType
  });
  return subagentStartOutput({
    hookSpecificOutput: { additionalContext: 'Build test: Explore context' }
  });
});
