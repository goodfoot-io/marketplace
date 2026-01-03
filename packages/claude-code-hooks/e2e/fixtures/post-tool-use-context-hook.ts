/**
 * Test fixture: PostToolUse hook that adds context after tool execution.
 *
 * Used to verify that PostToolUse hooks can inject additional context
 * into the conversation after a tool completes.
 */

import { postToolUseHook, postToolUseOutput } from '../../src/index.js';

export default postToolUseHook({ matcher: 'Bash' }, (input, { logger }) => {
  logger.info('PostToolUse hook triggered', { toolName: input.toolName });

  return postToolUseOutput({
    hookSpecificOutput: { additionalContext: 'E2E_POST_TOOL_CONTEXT: Command completed successfully.' }
  });
});
