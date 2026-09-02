import type { Platform, PlatformPathKind } from "./types.js";

export type Verification = "verified" | "provisional" | "unavailable";
export interface PlatformFact<T> {
  readonly status: Verification;
  readonly value?: T;
}

export interface PlatformDefinition {
  readonly embeddedBash: PlatformFact<boolean>;
  readonly skillSigil: PlatformFact<string>;
  readonly skillNamespace: PlatformFact<"preserve" | "strip">;
  readonly skillInvoke: PlatformFact<"tool-block" | "mention" | "prose">;
  readonly subagents: PlatformFact<"claude" | "codex" | "antigravity">;
  readonly agentNaming: PlatformFact<"colon" | "flattened">;
  readonly agentSlotSuffix: PlatformFact<"MODEL" | "EFFORT">;
  readonly worktree: PlatformFact<"tools" | "commands">;
  readonly conventionsFile: PlatformFact<string>;
  readonly hostIdentity: PlatformFact<string>;
  readonly pluginRootVar: PlatformFact<string>;
  readonly logicalPaths: Readonly<Record<PlatformPathKind, PlatformFact<string>>>;
  readonly frontmatterKeys: PlatformFact<readonly string[]>;
}

const verified = <T>(value: T): PlatformFact<T> => ({ status: "verified", value });
const provisional = <T>(value: T): PlatformFact<T> => ({ status: "provisional", value });
const unavailable = <T>(): PlatformFact<T> => ({ status: "unavailable" });
/**
 * `skills`/`agents`/`hooks`/`plugin` have no plugin-agnostic default: a bare
 * constant here can only ever be one specific plugin's own path, which made
 * every other plugin that omitted `--platform-dir` silently publish into that
 * plugin's tree instead of its own. Leaving them `unavailable` fails closed —
 * every plugin must supply its own path — instead of failing open with a
 * default that is wrong for everyone but the one plugin it was copied from.
 * `conventions` is the one kind with a genuine platform-wide default: the host
 * convention file lives at a fixed repo-root path regardless of which plugin
 * is building.
 */
const logicalPaths = (conventions: string): Readonly<Record<PlatformPathKind, PlatformFact<string>>> => ({
  skills: unavailable(),
  agents: unavailable(),
  hooks: unavailable(),
  plugin: unavailable(),
  conventions: verified(conventions),
});

export const PLATFORM_DEFINITIONS = {
  "claude-code": {
    embeddedBash: verified(true),
    skillSigil: verified(""),
    skillNamespace: verified("preserve"),
    skillInvoke: verified("tool-block"),
    subagents: verified("claude"),
    agentNaming: verified("colon"),
    agentSlotSuffix: verified("MODEL"),
    worktree: verified("tools"),
    conventionsFile: verified("CLAUDE.md"),
    hostIdentity: verified(""),
    pluginRootVar: verified("$" + "{CLAUDE_PLUGIN_ROOT}"),
    logicalPaths: logicalPaths("CLAUDE.md"),
    frontmatterKeys: verified(["name", "description", "allowed-tools", "argument-hint", "model"]),
  },
  codex: {
    embeddedBash: unavailable(),
    skillSigil: verified("$"),
    skillNamespace: verified("preserve"),
    skillInvoke: verified("mention"),
    subagents: verified("codex"),
    agentNaming: verified("flattened"),
    agentSlotSuffix: verified("EFFORT"),
    worktree: verified("commands"),
    conventionsFile: verified("AGENTS.md"),
    hostIdentity: verified("You are a Codex sub-agent"),
    pluginRootVar: verified("$" + "{PLUGIN_ROOT}"),
    logicalPaths: logicalPaths("AGENTS.md"),
    frontmatterKeys: verified(["name", "description"]),
  },
  opencode: {
    embeddedBash: unavailable(),
    skillSigil: verified("$"),
    skillNamespace: verified("strip"),
    skillInvoke: verified("mention"),
    subagents: verified("codex"),
    agentNaming: verified("flattened"),
    agentSlotSuffix: verified("EFFORT"),
    worktree: verified("commands"),
    conventionsFile: verified("AGENTS.md"),
    hostIdentity: verified("You are a sub-agent running in OpenCode"),
    pluginRootVar: unavailable(),
    logicalPaths: logicalPaths("AGENTS.md"),
    frontmatterKeys: verified(["name", "description"]),
  },
  antigravity: {
    // Neither the official skills nor plugin documentation defines render-time
    // command substitution syntax; ordinary shell execution is not equivalent.
    embeddedBash: unavailable(),
    skillSigil: provisional(""),
    skillNamespace: provisional("strip"),
    skillInvoke: verified("prose"),
    subagents: verified("antigravity"),
    // Native agents are invoked by name through invoke_subagent; neither
    // supported reference spelling models that surface.
    agentNaming: unavailable(),
    // The documented agent model field has no environment-slot suffix syntax.
    agentSlotSuffix: unavailable(),
    // A subagent can request an isolated branch workspace, but no documented
    // direct enter/remove pair satisfies this helper's lifecycle contract.
    worktree: unavailable(),
    conventionsFile: verified("AGENTS.md"),
    // Official docs do not define a stable sentence injected by the host.
    hostIdentity: provisional("You are an Antigravity sub-agent"),
    // Plugins have a root plugin.json, but no documented plugin-root variable.
    pluginRootVar: unavailable(),
    // No plugin-agnostic default exists for any of these five: every real
    // plugin overrides every one of them via --platform-dir, including
    // `conventions` (Antigravity has no repo-root convention file the way
    // CLAUDE.md/AGENTS.md serve the other three platforms).
    logicalPaths: {
      skills: unavailable(),
      agents: unavailable(),
      // Hooks are additionally unsupported outright: they are a root
      // hooks.json file, not a hooks directory, and agy 1.1.21 reports the
      // tested fixture as skipped rather than positively processed.
      hooks: unavailable(),
      plugin: unavailable(),
      conventions: unavailable(),
    },
    frontmatterKeys: verified(["name", "description"]),
  },
} as const satisfies Readonly<Record<Platform, PlatformDefinition>>;
