---
name: platform-behavior
description: Load this skill when porting generated skills among Claude Code, Codex, OpenCode, and Antigravity or reviewing platform-specific @goodfoot/agent-skills output.
---

# Review per-platform behavior

Treat platform output as a dialect selected from one typed definition table, not as a family of copied documents. The platform table drives helpers, frontmatter allowlists, lint rules, and generated helper documentation together.

## Verified platform distinctions

- Claude Code uses `CLAUDE.md` for repository conventions, while Codex and OpenCode use `AGENTS.md`.
- Skill references retain namespaces for Claude Code and Codex. OpenCode drops the namespace. Codex and OpenCode use their native skill sigils where required; Claude Code invocation is a block-level Skill-tool form.
- Canonical agent IDs have three segments. Codex and OpenCode flatten the latter two segments for their native form; templates must not pre-flatten them.
- Claude Code agent effort slots use a model placeholder. Codex and OpenCode use an effort placeholder.
- Worktree, subagent, plugin-root, frontmatter, and destination syntax is platform-defined. Use helpers instead of spelling these values in portable templates.

Consult `${CLAUDE_PLUGIN_ROOT}/skills/reference/helper-reference.md` for the current helper-by-platform classifications. A `verified` cell is grounded in a supported repository or host surface. A `provisional` cell is visibly tentative. An `unavailable` cell must fail during rendering rather than inherit a value from another platform.

## Porting review

Render each selected platform and review the output in that platform's dialect. Check exact bytes and inventory, including opaque assets, rather than comparing only Markdown meaning. In particular, inspect skill and agent references, conventions filenames, native frontmatter keys, logical destination roots, block-level invocation whitespace, and forbidden plugin-root variables inside skill Markdown.

Multiple targets for one platform must receive the same already-rendered bytes. If two sources or normalized targets collide, or an output is nested inside an input tree, stop and correct the configuration rather than choosing a winner.
