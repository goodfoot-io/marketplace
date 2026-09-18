import type { PlatformPathKind } from "./types.js";
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
    /**
     * The host agent's own name, for prose addressed to whoever is reading the
     * rendered file. Distinct from `hostIdentity`, which is the sentence the host
     * injects into a sub-agent and is empty on Claude Code: a template that says
     * "write for the agent reading this" needs the name even where the host
     * injects nothing, and on Claude Code the host product (`Claude Code`) and
     * its agent (`Claude`) are not the same word.
     */
    readonly hostAgentName: PlatformFact<string>;
    readonly pluginRootVar: PlatformFact<string>;
    readonly logicalPaths: Readonly<Record<PlatformPathKind, PlatformFact<string>>>;
    readonly frontmatterKeys: PlatformFact<readonly string[]>;
}
export declare const PLATFORM_DEFINITIONS: {
    readonly "claude-code": {
        readonly embeddedBash: PlatformFact<boolean>;
        readonly skillSigil: PlatformFact<string>;
        readonly skillNamespace: PlatformFact<"preserve">;
        readonly skillInvoke: PlatformFact<"tool-block">;
        readonly subagents: PlatformFact<"claude">;
        readonly agentNaming: PlatformFact<"colon">;
        readonly agentSlotSuffix: PlatformFact<"MODEL">;
        readonly worktree: PlatformFact<"tools">;
        readonly conventionsFile: PlatformFact<string>;
        readonly hostIdentity: PlatformFact<string>;
        readonly hostAgentName: PlatformFact<string>;
        readonly pluginRootVar: PlatformFact<string>;
        readonly logicalPaths: Readonly<Record<PlatformPathKind, PlatformFact<string>>>;
        readonly frontmatterKeys: PlatformFact<string[]>;
    };
    readonly codex: {
        readonly embeddedBash: PlatformFact<boolean>;
        readonly skillSigil: PlatformFact<string>;
        readonly skillNamespace: PlatformFact<"preserve">;
        readonly skillInvoke: PlatformFact<"mention">;
        readonly subagents: PlatformFact<"codex">;
        readonly agentNaming: PlatformFact<"flattened">;
        readonly agentSlotSuffix: PlatformFact<"EFFORT">;
        readonly worktree: PlatformFact<"commands">;
        readonly conventionsFile: PlatformFact<string>;
        readonly hostIdentity: PlatformFact<string>;
        readonly hostAgentName: PlatformFact<string>;
        readonly pluginRootVar: PlatformFact<string>;
        readonly logicalPaths: Readonly<Record<PlatformPathKind, PlatformFact<string>>>;
        readonly frontmatterKeys: PlatformFact<string[]>;
    };
    readonly opencode: {
        readonly embeddedBash: PlatformFact<boolean>;
        readonly skillSigil: PlatformFact<string>;
        readonly skillNamespace: PlatformFact<"strip">;
        readonly skillInvoke: PlatformFact<"mention">;
        readonly subagents: PlatformFact<"codex">;
        readonly agentNaming: PlatformFact<"flattened">;
        readonly agentSlotSuffix: PlatformFact<"EFFORT">;
        readonly worktree: PlatformFact<"commands">;
        readonly conventionsFile: PlatformFact<string>;
        readonly hostIdentity: PlatformFact<string>;
        readonly hostAgentName: PlatformFact<string>;
        readonly pluginRootVar: PlatformFact<string>;
        readonly logicalPaths: Readonly<Record<PlatformPathKind, PlatformFact<string>>>;
        readonly frontmatterKeys: PlatformFact<string[]>;
    };
    readonly antigravity: {
        readonly embeddedBash: PlatformFact<boolean>;
        readonly skillSigil: PlatformFact<string>;
        readonly skillNamespace: PlatformFact<"strip">;
        readonly skillInvoke: PlatformFact<"prose">;
        readonly subagents: PlatformFact<"antigravity">;
        readonly agentNaming: PlatformFact<"colon" | "flattened">;
        readonly agentSlotSuffix: PlatformFact<"EFFORT" | "MODEL">;
        readonly worktree: PlatformFact<"commands" | "tools">;
        readonly conventionsFile: PlatformFact<string>;
        readonly hostIdentity: PlatformFact<string>;
        readonly hostAgentName: PlatformFact<string>;
        readonly pluginRootVar: PlatformFact<string>;
        readonly logicalPaths: {
            readonly skills: PlatformFact<string>;
            readonly agents: PlatformFact<string>;
            readonly hooks: PlatformFact<string>;
            readonly plugin: PlatformFact<string>;
            readonly conventions: PlatformFact<string>;
        };
        readonly frontmatterKeys: PlatformFact<string[]>;
    };
};
