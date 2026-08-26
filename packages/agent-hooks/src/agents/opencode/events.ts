/**
 * OpenCode callback policy split: which lifecycle callbacks may opt into
 * guarded fail-open (`"continue"`) behavior, and which must always surface
 * failures.
 *
 * Unlike Codex's advisory allow-list (transcribed from `codex-hooks/README.md`,
 * an external source-of-truth document), OpenCode has no prior source package
 * to transcribe from — this package *is* the source of truth for its own
 * OpenCode surface. The split below is derived directly from CARD.md's
 * Desired Functionality section (committed to the card repository, itself
 * the authorization for this contract): "Advisory callbacks can opt into
 * guarded fail-open behavior with observable diagnostics; policy-enforcing
 * callbacks default to surfacing failures."
 *
 * `permission.ask` is the only callback whose `output.status` is an
 * allow/deny/ask *security decision* — swallowing a failure there means the
 * decision was silently skipped, exactly the Codex precedent
 * (`PreToolUse`/`PermissionRequest`) this mirrors. Every other lifecycle
 * callback only observes or additively enriches (message/tool mutation,
 * shell env, event notification) and is therefore advisory.
 * @module
 */

import type { UnexpectedErrorPolicy } from "../../core/types.js";
import { OPENCODE_HOOK_NAMES, type OpenCodeHookName } from "./types.js";

/** Callbacks that must always surface failures — never eligible for `"continue"`. */
export const POLICY_ENFORCING_EVENTS = ["permission.ask"] as const satisfies readonly OpenCodeHookName[];

/** The policy-enforcing set as a literal union. */
export type PolicyEnforcingEventName = (typeof POLICY_ENFORCING_EVENTS)[number];

/** Type-level membership check: `true` only for policy-enforcing callback names. */
export type IsPolicyEnforcingEvent<TName extends OpenCodeHookName> = TName extends PolicyEnforcingEventName
  ? true
  : false;

/** The advisory allow-list as a literal union: every callback except {@link PolicyEnforcingEventName}. */
export type AdvisoryEventName = Exclude<OpenCodeHookName, PolicyEnforcingEventName>;

/**
 * The advisory allow-list: every OpenCode lifecycle callback except
 * {@link POLICY_ENFORCING_EVENTS}. Only these accept
 * `unexpectedError: "continue"`, enforced at compile time by
 * {@link AllowedUnexpectedErrorPolicy} and at call time by
 * {@link ../../core/define-hook.ts|the policy-gate pattern}.
 */
export const ADVISORY_EVENTS: readonly AdvisoryEventName[] = OPENCODE_HOOK_NAMES.filter(
  (name): name is AdvisoryEventName => !(POLICY_ENFORCING_EVENTS as readonly OpenCodeHookName[]).includes(name),
);

/**
 * The policy type a callback may carry, narrowed by allow-list membership:
 * advisory callbacks keep `"error" | "continue"`; every policy-enforcing
 * callback collapses to `"error"`.
 */
export type AllowedUnexpectedErrorPolicy<TName extends OpenCodeHookName> =
  IsPolicyEnforcingEvent<TName> extends true ? Exclude<UnexpectedErrorPolicy, "continue"> : UnexpectedErrorPolicy;
