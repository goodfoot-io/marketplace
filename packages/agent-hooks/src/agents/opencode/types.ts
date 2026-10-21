/** OpenCode V2 native plugin and domain hook types, derived from the installed SDK. @module */
import type { Plugin as NativePlugin, PluginOptions } from "@opencode/plugin";
import type { AISDKHooks } from "@opencode/plugin/promise/aisdk";
import type { PermissionHooks } from "@opencode/plugin/promise/permission";
import type { Hooks as DomainHooks } from "@opencode/plugin/promise/registration";
import type { SessionHooks } from "@opencode/plugin/promise/session";
import type { ShellHooks } from "@opencode/plugin/promise/shell";
import type { ToolDomain } from "@opencode/plugin/promise/tool";

type HookSpec<T> = T extends DomainHooks<infer Spec> ? Spec : never;
type Prefix<Domain extends string, Spec> = {
  [Name in keyof Spec as Name extends string ? `${Domain}.${Name}` : never]: (
    event: Spec[Name],
  ) => Promise<void> | void;
};
/** V2 hook callbacks, named by their owning domain and registration name. */
export type Hooks = Prefix<"aisdk", AISDKHooks> &
  Prefix<"session", SessionHooks> &
  Prefix<"permission", PermissionHooks> &
  Prefix<"shell", ShellHooks> &
  Prefix<"tool", HookSpec<ToolDomain["hook"]>>;
/** The V2 setup callback. */
export type Plugin = NativePlugin.Plugin["setup"];
export type PluginInput = NativePlugin.Context;
export type PluginModule = NativePlugin.Plugin;
export type { PluginOptions };
export const OPENCODE_HOOK_NAMES = [
  "aisdk.sdk",
  "aisdk.language",
  "session.prompt",
  "session.context",
  "session.compaction",
  "session.generate",
  "session.title",
  "session.model.request",
  "session.http.request",
  "session.http.response",
  "session.experimental.ws.handshake",
  "session.experimental.ws.send",
  "session.experimental.ws.receive",
  "session.retry",
  "permission.evaluate",
  "shell.create.before",
  "tool.execute.before",
  "tool.execute.after",
] as const satisfies readonly (keyof Hooks)[];
export type OpenCodeHookName = (typeof OPENCODE_HOOK_NAMES)[number];
export type OpenCodeHookHandler<TName extends OpenCodeHookName> = Hooks[TName];
