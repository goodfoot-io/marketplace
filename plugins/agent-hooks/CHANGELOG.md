# Changelog

## 1.0.4

Backfills real entries for 1.0.1 through 1.0.3; staging that edit under `plugins/agent-hooks/` triggered the pre-commit hook's own version bump, the same hook-managed pattern already hit by a15c24a and c16383a's follow-up. No functional change.

## 1.0.3

Migrated onto the `agent-skills` bundler. The per-agent skills are now rendered from Eta templates under `skills-src/agent-hooks/` into the Claude Code, Codex, and OpenCode trees, so the three platform copies are generated from one source instead of maintained separately.

## 1.0.2

Added `skills/antigravity` for repository development and review of the typed Antigravity surface. The skill records the current release boundary: the package subpath, CLI build target, scaffolding, and production use remain unavailable pending an authoritative host contract and runnable end-to-end validation.

## 1.0.1

Published the plugin-only layout: `plugins/agent-hooks` with its per-agent skills, deprecation notices on the superseded packages, and the CHANGELOG rollups.

## 1.0.0

Initial release. Provides `skills/claude-code` and `skills/codex`, ported and adapted from `plugins/claude-code-hooks/skills/sdk` and `plugins/codex-hooks/skills/sdk` for `@goodfoot/agent-hooks`'s `./claude-code` and `./codex` subpath exports. Antigravity has no skill yet — Step 0 of the `@goodfoot/agent-hooks` consolidation descoped it to typed factories and a conformance matrix pending a runnable, non-interactive Antigravity CLI. Each skill opens by checking whether the project's `package.json` still depends on the deprecated `@goodfoot/claude-code-hooks` or `@goodfoot/codex-hooks` package and, if so, offers the repoint to `@goodfoot/agent-hooks`.
