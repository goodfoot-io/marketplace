/**
 * Test fixture: PostToolUseFailure hook.
 *
 * Used to verify PostToolUseFailure hooks are built correctly.
 */

import { postToolUseFailureHook, postToolUseFailureOutput } from '../../../src/index.js';

export default postToolUseFailureHook({ matcher: '.*' }, (input, { logger }) => {
  logger.error('Tool failed', {
    toolName: input.toolName,
    error: input.error
  });
  return postToolUseFailureOutput({
    hookSpecificOutput: { additionalContext: 'Build test: Failure logged' }
  });
});
