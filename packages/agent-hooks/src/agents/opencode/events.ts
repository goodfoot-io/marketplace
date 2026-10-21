/** V2 permission evaluation always surfaces errors; enrichment hooks may opt into continue. @module */
import type { UnexpectedErrorPolicy } from "../../core/types.js";
import { OPENCODE_HOOK_NAMES, type OpenCodeHookName } from "./types.js";

/** Callbacks that must always surface failures — never eligible for `"continue"`. */
export const POLICY_ENFORCING_EVENTS = ["permission.evaluate"] as const satisfies readonly OpenCodeHookName[];

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
