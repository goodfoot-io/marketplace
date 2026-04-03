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
  sessionStartHook: "SessionStart",
  userPromptSubmitHook: "UserPromptSubmit",
  stopHook: "Stop",
};

export const EVENTS_WITH_MATCHER = new Set<HookEventName>(["PreToolUse", "PostToolUse", "SessionStart"]);
export const EVENTS_WITH_TEXT_OUTPUT = new Set<HookEventName>(["SessionStart", "UserPromptSubmit"]);
