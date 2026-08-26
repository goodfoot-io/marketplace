/**
 * OpenCode advisory/policy-enforcing split enumeration test, mirroring
 * `tests/agents/codex/advisory-allow-list.test.ts`'s two-independent-
 * transcriptions pattern.
 *
 * Unlike Codex, there is no external README to transcribe from — this
 * package is the source of truth for its own OpenCode surface. The citation
 * is CARD.md's Desired Functionality section (committed to the card
 * repository): "Advisory callbacks can opt into guarded fail-open behavior
 * with observable diagnostics; policy-enforcing callbacks default to
 * surfacing failures." `events.ts` names `permission.ask` as the sole
 * policy-enforcing callback — the only one whose output is an allow/deny
 * security decision. This file is the second, independent transcription of
 * that same derivation, written directly below rather than imported.
 */

import { describe, expect, it } from "vitest";
import { ADVISORY_EVENTS, OPENCODE_HOOK_NAMES, POLICY_ENFORCING_EVENTS } from "../../../src/agents/opencode/index.js";

/** Second independent transcription of the CARD.md-derived split. */
const TEST_POLICY_ENFORCING: readonly string[] = ["permission.ask"];
const TEST_ADVISORY: readonly string[] = [
  "event",
  "config",
  "chat.message",
  "chat.params",
  "chat.headers",
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
];

describe("opencode advisory/policy-enforcing split derivation", () => {
  it("OPENCODE_HOOK_NAMES holds exactly 17 unique entries", () => {
    expect(OPENCODE_HOOK_NAMES).toHaveLength(17);
    expect(new Set(OPENCODE_HOOK_NAMES).size).toBe(17);
  });

  it("POLICY_ENFORCING_EVENTS equals the second transcription of the CARD.md-derived set", () => {
    expect([...POLICY_ENFORCING_EVENTS]).toEqual(TEST_POLICY_ENFORCING);
  });

  it("ADVISORY_EVENTS equals every hook name except the policy-enforcing set", () => {
    expect([...ADVISORY_EVENTS].sort()).toEqual([...TEST_ADVISORY].sort());
    expect(ADVISORY_EVENTS).toHaveLength(OPENCODE_HOOK_NAMES.length - POLICY_ENFORCING_EVENTS.length);
  });

  it("the two sets partition OPENCODE_HOOK_NAMES with no overlap and no gaps", () => {
    const union = new Set([...ADVISORY_EVENTS, ...POLICY_ENFORCING_EVENTS]);
    expect(union).toEqual(new Set(OPENCODE_HOOK_NAMES));
    const intersection = ADVISORY_EVENTS.filter((name) =>
      (POLICY_ENFORCING_EVENTS as readonly string[]).includes(name),
    );
    expect(intersection).toHaveLength(0);
  });
});
