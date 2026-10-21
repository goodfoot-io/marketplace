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

OpenCode 2.1.2 uses `@goodfoot/agent-hooks/opencode` with `@opencode/plugin@^2.1.2`.
Build with `--agent opencode -i "src/**/*.ts" -o .opencode/plugins`.
Default-export `defineOpenCodePlugin({ id, async setup(ctx) { ... } })`;
register native hooks with `await ctx.tool.hook("execute.before", event => { ... })`.
Callbacks receive one mutable event; tool arguments live in `event.input`.
Use `ctx.skill.transform` for skill contributions and `ctx.event.subscribe` for events.
Return cleanup from `setup` for owned resources. Configuration uses `plugins`.
V1 functions, `{ server }` exports, returned hook maps, and `config` callbacks are unsupported.

Builds omit inline sourcemaps by default for smaller, reviewable, reproducible artifacts. Pass `--sourcemap` explicitly when original TypeScript locations are needed in runtime stack traces.

Do not answer from one host's reference about another host: the hosts differ in substance (hook vocabularies, output envelopes, capabilities), not just syntax.
