# Changelog

## Unreleased

Added `skills/antigravity` for repository development and review of the typed Antigravity surface. The skill records the current release boundary: the package subpath, CLI build target, scaffolding, and production use remain unavailable pending an authoritative host contract and runnable end-to-end validation.

## 1.0.0

Initial release. Provides `skills/claude-code` and `skills/codex`, ported and adapted from `plugins/claude-code-hooks/skills/sdk` and `plugins/codex-hooks/skills/sdk` for `@goodfoot/agent-hooks`'s `./claude-code` and `./codex` subpath exports. Antigravity has no skill yet — Step 0 of the `@goodfoot/agent-hooks` consolidation descoped it to typed factories and a conformance matrix pending a runnable, non-interactive Antigravity CLI. Each skill opens by checking whether the project's `package.json` still depends on the deprecated `@goodfoot/claude-code-hooks` or `@goodfoot/codex-hooks` package and, if so, offers the repoint to `@goodfoot/agent-hooks`.
