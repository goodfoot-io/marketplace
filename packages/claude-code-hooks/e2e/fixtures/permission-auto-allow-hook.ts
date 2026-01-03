/**
 * Test fixture: PermissionRequest hook that auto-approves safe operations.
 *
 * Used to verify that PermissionRequest hooks can automatically allow
 * tool executions without user interaction.
 */

import { permissionRequestHook, permissionRequestOutput } from '../../src/index.js';

export default permissionRequestHook({ matcher: 'Bash' }, (input, { logger }) => {
  const command = input.toolInput as { command?: string };

  // Only auto-allow echo commands for safety in E2E tests
  if (command.command?.startsWith('echo ')) {
    logger.info('Auto-allowing echo command', { command: command.command });
    return permissionRequestOutput({
      systemMessage: 'E2E_PERMISSION: Echo command auto-approved.',
      hookSpecificOutput: {
        decision: { behavior: 'allow' }
      }
    });
  }

  // Fall through to normal permission prompt for other commands
  logger.info('Falling through to normal permission', { command: command.command });
  return permissionRequestOutput({});
});
