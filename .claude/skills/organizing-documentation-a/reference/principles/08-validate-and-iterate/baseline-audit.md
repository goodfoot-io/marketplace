# Baseline audit

Scope: establish the corpus's real state with counts before changing anything. Owns the audit checklist for Principle 8; runs at Step 2 of `reference/procedure.md`.

## Counts to take

Use `reference/tools/inventory-grep.md` for size, hubs, orphans, and duplicates; `reference/tools/git-history.md` for staleness; `wiki check` and `git mesh stale` for drift.

## Diagnostics → actions

- **How many docs exist**: establish corpus size and cleanup scope — `git ls-files '*.md' | wc -l`.
- **How many are stale** (old last-commit date on a load-bearing doc): prioritize review, archival, or replacement — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-governance.md`.
- **`CODEOWNERS` coverage** maps areas to maintainers — provenance for the audience view and for handoff, not a defect to fix; docs are ownerless by default — `reference/foundations.md`.
- **How many are orphans** (no inbound path) or have no useful outbound links: link, redirect, archive, or delete — `reference/principles/04-multiple-paths/orphans-and-dead-ends.md`.
- **How many duplicate or contradict another page**: merge into a source of truth and resolve the conflict — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.
- **How many lack topic-type, mode, or genre classification, or required metadata**: classify and add metadata before reorganizing — `reference/principles/02-typed-source-of-truth-topics/modes-and-genres.md`, `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
- **How many change frequently** (hot) vs never: protect and elevate the hot ones; reassess, link, or archive the cold ones — `analytics.md`.
- **How many are cited from tickets, alerts, or code**: protect their stability and durable identifiers — `reference/foundations.md` stable-identifier section.
