---
name: agent-hooks
description: Load this skill immediately after a user mentions
  "@goodfoot/agent-hooks", Claude Code hooks, Codex hooks, or Antigravity hooks.
---

# @goodfoot/agent-hooks

`@goodfoot/agent-hooks` compiles TypeScript hook sources into executables for a host agent. Identify the host the user is targeting, then load that host's reference before writing, building, or debugging any hook — each host has its own build command, hook types, output shapes, and limits:

- `reference/claude-code.md` — Claude Code hooks (`@goodfoot/agent-hooks/claude-code`): build/scaffold commands, the full hook-type capability table, typed tool inputs, patterns, and configuration. Detailed references live in `reference/claude-code/`.
- `reference/codex.md` — Codex hooks (`@goodfoot/agent-hooks/codex`): build/scaffold commands, the 10 hook types, `tool_input` narrowing, Codex-specific limits, and command-emission modes. Detailed references live in `reference/codex/`.
- `reference/antigravity.md` — Antigravity hooks (`@goodfoot/agent-hooks/antigravity`): the 5 events, the named-hook `hooks.json` shape, and the exit-0 wire invariant. Load whenever Antigravity hooks come up.
- `reference/smoke-test.md` — host-independent: how to prove a compiled hook installs and fires, and how to label the result. Load before claiming a hook works on any host.

`--agent opencode` also builds, emitting plugin modules rather than a manifest; it has no dedicated reference yet.

Do not answer from one host's reference about another host: the hosts differ in substance (hook vocabularies, output envelopes, capabilities), not just syntax.
