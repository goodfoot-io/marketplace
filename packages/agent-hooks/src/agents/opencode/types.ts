/**
 * OpenCode-native types for `@goodfoot/agent-hooks/opencode`.
 *
 * OpenCode loads a long-lived, in-process plugin module rather than spawning
 * a one-shot command-hook process: {@link PluginModule} (`{ id?, server }`)
 * or a bare {@link Plugin} function is what OpenCode's real loader accepts —
 * verified directly against the installed `@opencode-ai/plugin@1.18.23`
 * `.d.ts`, not the (looser) public docs page. This module re-exports and
 * narrows those upstream types; it never redeclares OpenCode's callback
 * input/output shapes by hand, so this surface can't drift from the SDK it
 * wraps.
 * @module
 */

import type { Hooks, Plugin, PluginInput, PluginModule, PluginOptions } from "@opencode-ai/plugin";

export type { Hooks, Plugin, PluginInput, PluginModule, PluginOptions };

/**
 * The stable, lifecycle-callback keys of {@link Hooks} — excludes `tool`
 * (custom tool definitions, not a lifecycle callback), `auth` and `provider`
 * (static registration objects), and `dispose` (a no-argument cleanup
 * callback with no policy semantics of its own).
 *
 * Order matches declaration order in the upstream `Hooks` interface.
 */
export const OPENCODE_HOOK_NAMES = [
  "event",
  "config",
  "chat.message",
  "chat.params",
  "chat.headers",
  "permission.ask",
  "command.execute.before",
  "tool.execute.before",
  "shell.env",
  "tool.execute.after",
  "experimental.chat.messages.transform",
  "experimental.chat.system.transform",
  "experimental.provider.small_model",
  "experimental.session.compacting",
  "experimental.compaction.autocontinue",
  "experimental.text.complete",
  "tool.definition",
] as const satisfies readonly (keyof Hooks)[];

/** Literal union of {@link OPENCODE_HOOK_NAMES}. */
export type OpenCodeHookName = (typeof OPENCODE_HOOK_NAMES)[number];

/** The handler type for a given lifecycle callback name, narrowed from {@link Hooks}. */
export type OpenCodeHookHandler<TName extends OpenCodeHookName> = NonNullable<Hooks[TName]>;
