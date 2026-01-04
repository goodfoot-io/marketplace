/**
 * Test fixture: SubagentStart hook that adds context to subagent.
 *
 * Used to verify SubagentStart hooks are built correctly.
 */

import { subagentStartHook, subagentStartOutput } from '../../src/index.js';

export default subagentStartHook({ matcher: 'explore' }, (input, { logger }) => {
  logger.info('Subagent starting', {
    agent_id: input.agent_id,
    agent_type: input.agent_type
  });
  return subagentStartOutput({
    hookSpecificOutput: { additionalContext: 'E2E_SUBAGENT_START: Subagent context added.' }
  });
});
