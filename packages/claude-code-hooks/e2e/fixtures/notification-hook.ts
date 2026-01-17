/**
 * Test fixture: Notification hook that logs notification details.
 *
 * Used to verify Notification hooks are built correctly.
 */

import { notificationHook, notificationOutput } from "../../src/index.js";

export default notificationHook({ matcher: "idle_prompt" }, (input, { logger }) => {
  logger.info("Notification received", {
    message: input.message,
    title: input.title,
    notification_type: input.notification_type,
  });
  return notificationOutput({
    systemMessage: "E2E_NOTIFICATION: Notification received.",
  });
});
