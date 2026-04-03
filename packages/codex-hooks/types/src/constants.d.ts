import type { HookEventName } from "./types.js";
export declare const PACKAGE_NAME = "@goodfoot/codex-hooks";
export declare const DEFAULT_TIMEOUT_MS = 600000;
export declare const DEFAULT_STATUS_MESSAGE: undefined;
export declare const DEFAULT_ESBUILD_LOADERS: {
    readonly ".md": "text";
};
export declare const HOOK_FACTORY_TO_EVENT: Record<string, HookEventName>;
export declare const EVENTS_WITH_MATCHER: Set<HookEventName>;
export declare const EVENTS_WITH_TEXT_OUTPUT: Set<HookEventName>;
