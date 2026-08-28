---
name: agent-skills
description: "Load this skill when working with @goodfoot/agent-skills: running
  the build or lint CLI, authoring portable .md.eta templates, choosing Eta
  helpers, porting or reviewing per-platform generated output, or targeting
  Antigravity."
---

# @goodfoot/agent-skills

One authored template tree renders per-platform skill trees for Claude Code, Codex, OpenCode, and Antigravity. Load the reference for your task before acting:

- `reference/cli-and-helpers.md` — build/lint CLI grammar, transactional publish semantics, helper composition rules, and a known lint false positive. Load before running `agent-skills build` or `agent-skills lint`, or when choosing helpers.
- `reference/template-authoring.md` — `.md.eta` invariants, front-config (`platforms`, `outputName`, lint suppressions), opaque assets, and the review checklist. Load before writing or reviewing templates.
- `reference/platform-behavior.md` — verified platform distinctions, dialect vs. substance, and the porting review procedure. Load before porting a skill between platforms or reviewing rendered output.
- `reference/antigravity.md` — what Antigravity support does and does not cover. Load whenever Antigravity is in scope.
- `reference/helper-reference.md` — the generated helper-by-platform matrix. Consult for any helper's per-platform status.
