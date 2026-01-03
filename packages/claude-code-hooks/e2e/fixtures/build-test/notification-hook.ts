/**
 * Test fixture: Notification hook with matcher.
 *
 * Used to verify notification hooks are built correctly.
 */

import { notificationHook, notificationOutput } from '../../../src/index.js';

export default notificationHook({ matcher: 'idle_prompt' }, (input, { logger }) => {
  logger.info('Notification received', {
    type: input.notificationType,
    message: input.message
  });
  return notificationOutput({});
});
