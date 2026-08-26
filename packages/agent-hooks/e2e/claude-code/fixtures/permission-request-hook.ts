/**
 * Test fixture: PermissionRequest hook with auto-allow decision.
 *
 * Used to verify PermissionRequest hooks are built correctly.
 */

import { permissionRequestHook, permissionRequestOutput } from "../../../src/agents/claude-code/index.js";

export default permissionRequestHook({ matcher: "Read" }, (input, { logger }) => {
  logger.info("Permission requested", {
    tool_name: input.tool_name,
  });
  return permissionRequestOutput({
    hookSpecificOutput: {
      decision: { behavior: "allow" },
    },
  });
});
