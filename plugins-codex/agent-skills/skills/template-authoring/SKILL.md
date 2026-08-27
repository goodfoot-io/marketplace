---
name: template-authoring
description: Load this skill when authoring or reviewing portable .md.eta
  templates, agent-skills front-config, includes, layouts, or opaque assets for
  @goodfoot/agent-skills.
---

# Author portable skill templates

Use one source tree for every platform. Markdown templates end in `.md.eta` and render to the same relative path without `.eta`. Files that are not templates are opaque assets: keep them beside the templates so the build copies their bytes and executable mode into each selected output tree.

## Template invariants

`@goodfoot/agent-skills` renders with Eta using `autoEscape: false` and `autoTrim: false`. Whitespace is therefore authored output, not formatting noise. Use Eta's native `include()` and `layout()` support for reusable fragments, and keep every include inside the declared source root.

Prefer portable helpers over literal platform syntax. Load the `agent-skills:cli-and-helpers` skill for the supported helper surface and CLI grammar. Raw `it.platform` conditionals are an escape hatch for cases the helper model does not cover; a new repeated dialect difference belongs in the platform definitions and helper reference instead.

## Optional front-config

A template may begin at byte zero with one YAML configuration block:

```markdown
<!-- agent-skills
platforms:
  - claude-code
  - codex
outputName: SKILL.md
-->
Rendered content begins on this byte.
```

The opening sentinel must be exactly `<!-- agent-skills`, and the block ends at `-->`. It is compiler configuration and is removed by offsets without consuming the next byte. It must not be confused with rendered `---` skill frontmatter.

Only the package-supported keys are valid: `platforms`, `outputName`, content `kind`, and narrowly scoped lint suppressions. Platform IDs must be canonical. Output names must be relative, non-empty, and must not contain `..`. Do not rely on unknown keys being ignored: invalid configuration fails before rendering.

Use `platforms` to gate emission and `outputName` when the same logical file needs a platform-specific filename. Use `it.frontmatter(...)` for rendered skill frontmatter so the platform allowlist and stable YAML key order are applied.

## Review checklist

- Every platform branch is explicit; missing or extra variants are errors.
- Includes, layouts, and assets remain beneath the declared source root.
- Markdown whitespace is intentional and survives byte-exact comparison.
- Platform references use helpers rather than copied host-specific prose.
- Lint suppressions are rule-specific and line-bounded, never blanket exemptions.
- Opaque binaries and scripts remain beside their owning template and preserve executable intent.
