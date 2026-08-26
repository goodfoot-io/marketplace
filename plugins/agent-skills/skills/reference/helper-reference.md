# Portable helper reference

This file is shared by the `agent-skills` documentation skills. Its generated region is rendered from the `@goodfoot/agent-skills` typed platform table without changing hand-authored guidance.

Do not edit the generated region by hand. Run `node plugins/agent-skills/scripts/sync-helper-reference.mjs` after changing the core helper-reference model, or pass `--check` to verify freshness without writing.

<!-- BEGIN GENERATED AGENT-SKILLS HELPER REFERENCE -->

| Helper | Description | claude-code | codex | opencode | antigravity |
| --- | --- | --- | --- | --- | --- |
| it.skillRef | Render a prose skill reference. |  (verified) | $ (verified) | $ (verified) |  (provisional) |
| it.skillInvoke | Render a skill activation instruction. | tool-block (verified) | mention (verified) | mention (verified) | prose (provisional) |
| it.agentRef | Render a canonical agent reference. | colon (verified) | flattened (verified) | flattened (verified) | unavailable (unavailable) |
| it.agentSlotVar | Render an agent model or effort slot. | MODEL (verified) | EFFORT (verified) | EFFORT (verified) | unavailable (unavailable) |
| it.conventionsFile | Name the host conventions file. | CLAUDE.md (verified) | AGENTS.md (verified) | AGENTS.md (verified) | AGENTS.md (provisional) |
| it.hostIdentity | Render the platform host identity. |  (verified) | You are a Codex sub-agent (verified) | You are a sub-agent running in OpenCode (verified) | You are an Antigravity sub-agent (provisional) |
| it.pluginRootVar | Render the plugin-root variable. | ${CLAUDE_PLUGIN_ROOT} (verified) | ${PLUGIN_ROOT} (verified) | unavailable (unavailable) | unavailable (unavailable) |

<!-- END GENERATED AGENT-SKILLS HELPER REFERENCE -->

All skill and agent identifiers passed to helpers are canonical, unsigiled inputs. A helper with no value for the active platform throws an error containing its helper name and platform. No helper falls through to a different platform.
