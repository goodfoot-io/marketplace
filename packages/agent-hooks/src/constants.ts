/**
 * Shared constants for the CLI and scaffold modules.
 * @module
 */

import type { HookEventName } from "./agents/claude-code/types.js";

/**
 * Maps hook factory function names to their event names.
 */
export const HOOK_FACTORY_TO_EVENT: Record<string, HookEventName> = {
  preToolUseHook: "PreToolUse",
  postToolUseHook: "PostToolUse",
  postToolUseFailureHook: "PostToolUseFailure",
  postToolBatchHook: "PostToolBatch",
  notificationHook: "Notification",
  userPromptExpansionHook: "UserPromptExpansion",
  userPromptSubmitHook: "UserPromptSubmit",
  sessionStartHook: "SessionStart",
  sessionEndHook: "SessionEnd",
  stopHook: "Stop",
  stopFailureHook: "StopFailure",
  subagentStartHook: "SubagentStart",
  subagentStopHook: "SubagentStop",
  preCompactHook: "PreCompact",
  postCompactHook: "PostCompact",
  permissionRequestHook: "PermissionRequest",
  permissionDeniedHook: "PermissionDenied",
  setupHook: "Setup",
  teammateIdleHook: "TeammateIdle",
  taskCreatedHook: "TaskCreated",
  taskCompletedHook: "TaskCompleted",
  elicitationHook: "Elicitation",
  elicitationResultHook: "ElicitationResult",
  configChangeHook: "ConfigChange",
  instructionsLoadedHook: "InstructionsLoaded",
  worktreeCreateHook: "WorktreeCreate",
  worktreeRemoveHook: "WorktreeRemove",
  cwdChangedHook: "CwdChanged",
  fileChangedHook: "FileChanged",
  messageDisplayHook: "MessageDisplay",
};
