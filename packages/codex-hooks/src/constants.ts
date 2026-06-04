import type { HookEventName } from "./types.js";

export const PACKAGE_NAME = "@goodfoot/codex-hooks";
export const DEFAULT_TIMEOUT_MS = 600_000;
export const DEFAULT_STATUS_MESSAGE = undefined;
export const DEFAULT_ESBUILD_LOADERS = {
  ".md": "text",
} as const;

export const HOOK_FACTORY_TO_EVENT: Record<string, HookEventName> = {
  preToolUseHook: "PreToolUse",
  postToolUseHook: "PostToolUse",
  permissionRequestHook: "PermissionRequest",
  userPromptSubmitHook: "UserPromptSubmit",
  sessionStartHook: "SessionStart",
  subagentStartHook: "SubagentStart",
  stopHook: "Stop",
  subagentStopHook: "SubagentStop",
  preCompactHook: "PreCompact",
  postCompactHook: "PostCompact",
};

export const EVENTS_WITH_MATCHER = new Set<HookEventName>([
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "SessionStart",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
]);

export const EVENTS_WITH_TEXT_OUTPUT = new Set<HookEventName>(["SessionStart", "UserPromptSubmit", "SubagentStart"]);
