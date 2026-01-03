/**
 * Test fixture: UserPromptSubmit hook with additionalContext.
 *
 * Used to verify UserPromptSubmit hooks are built correctly.
 */

import { userPromptSubmitHook, userPromptSubmitOutput } from '../../../src/index.js';

export default userPromptSubmitHook({}, (input, { logger }) => {
  logger.info('User prompt submitted', {
    prompt: input.prompt?.substring(0, 50)
  });
  return userPromptSubmitOutput({
    hookSpecificOutput: { additionalContext: 'Build test: Prompt received' }
  });
});
