import type { HookEventName } from "./types.js";

export const PACKAGE_NAME = "@goodfoot/agent-hooks";

/** The host's own default handler timeout, in seconds (`CONTRACT.md`, Hook Handler Fields). */
export const DEFAULT_TIMEOUT_SECONDS = 30;

export const DEFAULT_ESBUILD_LOADERS = {
  ".md": "text",
} as const;

/** Maps each exported factory name to the event it binds. */
export const HOOK_FACTORY_TO_EVENT: Record<string, HookEventName> = {
  preToolUseHook: "PreToolUse",
  postToolUseHook: "PostToolUse",
  preInvocationHook: "PreInvocation",
  postInvocationHook: "PostInvocation",
  stopHook: "Stop",
};

/**
 * Events whose `hooks.json` entry is a grouped `{ matcher, hooks }` wrapper.
 * The remaining three are flat lists of handler objects; the host ignores a
 * matcher on them.
 */
export const GROUPED_EVENTS = new Set<HookEventName>(["PreToolUse", "PostToolUse"]);
