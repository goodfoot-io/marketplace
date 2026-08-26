/**
 * `@goodfoot/agent-hooks/opencode` — the OpenCode agent surface.
 *
 * Re-exports OpenCode-native types (narrowed from `@opencode-ai/plugin`),
 * the advisory/policy-enforcing callback split, the shared error-policy
 * vocabulary, and the plugin authoring primitives. No default export at this
 * subpath — `defineOpenCodePlugin`'s *return value* is the `{ id, server }`
 * default export a plugin author's own module produces, not something this
 * barrel exports itself.
 * @module
 */

// Advisory / policy-enforcing callback split
export type {
  AdvisoryEventName,
  AllowedUnexpectedErrorPolicy,
  IsPolicyEnforcingEvent,
  PolicyEnforcingEventName,
} from "./events.js";
export { ADVISORY_EVENTS, POLICY_ENFORCING_EVENTS } from "./events.js";
// Plugin authoring primitives
export type { RootSessionRegistry } from "./plugin.js";
export { createRootSessionRegistry, defineOpenCodePlugin, guardAdvisory } from "./plugin.js";

// Shared error-policy vocabulary (re-exported from core)
export type { UnexpectedErrorHandler, UnexpectedErrorPolicy } from "./policy.js";
export { applyOpenCodeErrorPolicy } from "./policy.js";
// OpenCode-native types (re-exported/narrowed from @opencode-ai/plugin)
export type {
  Hooks,
  OpenCodeHookHandler,
  OpenCodeHookName,
  Plugin,
  PluginInput,
  PluginModule,
  PluginOptions,
} from "./types.js";
export { OPENCODE_HOOK_NAMES } from "./types.js";
