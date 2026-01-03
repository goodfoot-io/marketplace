/**
 * Test fixture: UserPromptSubmit hook that adds context to prompts.
 *
 * Used to verify that UserPromptSubmit hooks can inject additional context
 * that Claude will see when processing user prompts.
 */

import { userPromptSubmitHook, userPromptSubmitOutput } from '../../src/index.js';

export default userPromptSubmitHook({}, (input, { logger }) => {
  logger.info('UserPromptSubmit hook triggered', { promptLength: input.prompt.length });

  return userPromptSubmitOutput({
    hookSpecificOutput: { additionalContext: 'The secret word is "turnip"' }
  });
});
