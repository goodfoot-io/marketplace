/**
 * Test fixture: PreToolUse hook with multi-tool matcher.
 *
 * Used to verify that matchers support regex alternation patterns
 * to match multiple tool names.
 */

import { preToolUseHook, preToolUseOutput } from '../../src/index.js';

export default preToolUseHook({ matcher: 'Read|Glob|Grep' }, (input, { logger }) => {
  logger.info('Multi-matcher hook triggered', { toolName: input.toolName });

  return preToolUseOutput({
    systemMessage: `E2E_MULTI_MATCHER: Tool ${input.toolName} matched by Read|Glob|Grep pattern.`,
    hookSpecificOutput: { permissionDecision: 'allow' }
  });
});
