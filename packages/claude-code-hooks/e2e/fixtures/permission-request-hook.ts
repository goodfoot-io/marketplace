/**
 * Test fixture: PermissionRequest hook with auto-allow decision.
 *
 * Used to verify PermissionRequest hooks are built correctly.
 */

import { permissionRequestHook, permissionRequestOutput } from '../../src/index.js';

export default permissionRequestHook({ matcher: 'Read' }, (input, { logger }) => {
  logger.info('Permission requested', {
    toolName: input.toolName
  });
  return permissionRequestOutput({
    hookSpecificOutput: {
      decision: { behavior: 'allow' }
    }
  });
});
