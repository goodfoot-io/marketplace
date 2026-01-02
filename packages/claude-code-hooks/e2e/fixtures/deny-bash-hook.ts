/**
 * Test fixture: PreToolUse hook that denies all Bash commands.
 *
 * Used to verify that PreToolUse hooks can successfully block tool execution.
 */

import { preToolUseHook, preToolUseOutput } from '../../src/index.js';

export default preToolUseHook({ matcher: 'Bash' }, async (input, { logger }) => {
  const command = (input.toolInput as { command?: string }).command ?? '';
  logger.info('Denying Bash command', { command });

  return preToolUseOutput({
    deny: 'Bash commands are blocked by test hook'
  });
});
