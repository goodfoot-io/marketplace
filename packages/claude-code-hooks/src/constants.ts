/**
 * Shared constants for the CLI and scaffold modules.
 * @module
 */

import type { HookEventName } from "./types.js";

/**
 * Maps hook factory function names to their event names.
 */
export const HOOK_FACTORY_TO_EVENT: Record<string, HookEventName> = {
  preToolUseHook: "PreToolUse",
  postToolUseHook: "PostToolUse",
  postToolUseFailureHook: "PostToolUseFailure",
  notificationHook: "Notification",
  userPromptSubmitHook: "UserPromptSubmit",
  sessionStartHook: "SessionStart",
  sessionEndHook: "SessionEnd",
  stopHook: "Stop",
  subagentStartHook: "SubagentStart",
  subagentStopHook: "SubagentStop",
  preCompactHook: "PreCompact",
  permissionRequestHook: "PermissionRequest",
  setupHook: "Setup",
  teammateIdleHook: "TeammateIdle",
  taskCompletedHook: "TaskCompleted",
  elicitationHook: "Elicitation",
  elicitationResultHook: "ElicitationResult",
  configChangeHook: "ConfigChange",
  instructionsLoadedHook: "InstructionsLoaded",
  worktreeCreateHook: "WorktreeCreate",
  worktreeRemoveHook: "WorktreeRemove",
};
