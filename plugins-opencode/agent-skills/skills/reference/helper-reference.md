# Portable helper reference

This file is shared by the `agent-skills` documentation skills. Its generated region is rendered from the `@goodfoot/agent-skills` typed platform table without changing hand-authored guidance.

Do not edit the generated region by hand. Run `node plugins/agent-skills/scripts/sync-helper-reference.mjs` after changing the core helper-reference model, or pass `--check` to verify freshness without writing.

<!-- BEGIN GENERATED AGENT-SKILLS HELPER REFERENCE -->

| Helper | Inputs | Description | claude-code | codex | opencode | antigravity |
| --- | --- | --- | --- | --- | --- | --- |
| it.platform | none | Active canonical platform. | claude-code (verified) | codex (verified) | opencode (verified) | antigravity (verified) |
| it.is | ...Platform | Test canonical platform membership. | claude-code (verified) | codex (verified) | opencode (verified) | antigravity (verified) |
| it.variant | VariantMap<T> | Select one exhaustive platform branch. | claude-code (verified) | codex (verified) | opencode (verified) | antigravity (verified) |
| it.skillRef | skillId | Render a prose skill reference. |  (verified) | $ (verified) | $ (verified) |  (provisional) |
| it.skillInvoke | skillId | Render a skill activation instruction. | tool-block (verified) | mention (verified) | mention (verified) | prose (provisional) |
| it.agentRef | plugin:dir:file | Render a canonical agent reference. | colon (verified) | flattened (verified) | flattened (verified) | unavailable (unavailable) |
| it.agentSlotVar | role | Render an agent model or effort slot. | MODEL (verified) | EFFORT (verified) | EFFORT (verified) | unavailable (unavailable) |
| it.conventionsFile | none | Name the host conventions file. | CLAUDE.md (verified) | AGENTS.md (verified) | AGENTS.md (verified) | AGENTS.md (provisional) |
| it.hostIdentity | role? | Render the platform host identity. |  (verified) | You are a Codex sub-agent (verified) | You are a sub-agent running in OpenCode (verified) | You are an Antigravity sub-agent (provisional) |
| it.pluginRootVar | none | Render the plugin-root variable. | `${CLAUDE_PLUGIN_ROOT}` (verified) | `${PLUGIN_ROOT}` (verified) | unavailable (unavailable) | unavailable (unavailable) |
| it.platformDir | logicalPathKind | Resolve a configured logical platform path. | configured path (undefined) | configured path (undefined) | configured path (undefined) | configured path (undefined) |
| it.frontmatter | object | Serialize validated stable frontmatter. | name,description,allowed-tools,argument-hint,model (verified) | name,description (verified) | name,description (verified) | name,description (provisional) |
| it.subagent.dispatch | type, options? | Render a subagent dispatch operation. | claude (verified) | codex (verified) | codex (verified) | unavailable (unavailable) |
| it.subagent.reengage | { live? } | Render live/completed re-engagement. | claude (verified) | codex (verified) | codex (verified) | unavailable (unavailable) |
| it.subagent.resultChannel | orchestrator? | Render the result recipient. | claude-code (verified) | codex (verified) | opencode (verified) | antigravity (verified) |
| it.worktree.enter | none | Render worktree entry. | tools (verified) | commands (verified) | commands (verified) | unavailable (unavailable) |
| it.worktree.remove | none | Render worktree removal. | tools (verified) | commands (verified) | commands (verified) | unavailable (unavailable) |

<!-- END GENERATED AGENT-SKILLS HELPER REFERENCE -->

All skill and agent identifiers passed to helpers are canonical, unsigiled inputs. A helper with no value for the active platform throws an error containing its helper name and platform. No helper falls through to a different platform.
