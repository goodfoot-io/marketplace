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
  readonly subagents: PlatformFact<"claude" | "codex">;
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
const paths = (prefix: string, conventions: string): Readonly<Record<PlatformPathKind, PlatformFact<string>>> => ({
  skills: verified(`${prefix}/skills`),
  agents: verified(`${prefix}/agents`),
  hooks: verified(`${prefix}/hooks`),
  plugin: verified(prefix),
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
    logicalPaths: paths("plugins-claude/goodfoot", "CLAUDE.md"),
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
    logicalPaths: paths("plugins-codex/goodfoot", "AGENTS.md"),
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
    logicalPaths: paths("plugins-opencode/goodfoot", "AGENTS.md"),
    frontmatterKeys: verified(["name", "description"]),
  },
  antigravity: {
    embeddedBash: unavailable(),
    skillSigil: provisional(""),
    skillNamespace: provisional("strip"),
    skillInvoke: provisional("prose"),
    subagents: unavailable(),
    agentNaming: unavailable(),
    agentSlotSuffix: unavailable(),
    worktree: unavailable(),
    conventionsFile: provisional("AGENTS.md"),
    hostIdentity: provisional("You are an Antigravity sub-agent"),
    pluginRootVar: unavailable(),
    logicalPaths: {
      skills: provisional("skills"),
      agents: unavailable(),
      hooks: unavailable(),
      plugin: unavailable(),
      conventions: provisional("AGENTS.md"),
    },
    frontmatterKeys: provisional(["name", "description"]),
  },
} as const satisfies Readonly<Record<Platform, PlatformDefinition>>;
