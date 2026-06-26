# Baseline audit

Scope: establish the corpus's real state with counts before changing anything. Owns the audit checklist for Principle 8; runs at Step 2 of `reference/procedure.md`.

## Counts to take

Use `reference/tools/inventory-grep.md` for size, hubs, orphans, and duplicates; `reference/tools/git-history.md` for staleness; `wiki check` and `git mesh stale` for drift. Use exact command output for every count — never estimate or hand-count.

## Structural gap detection

- **Thin READMEs** (≤3 lines, or any directory README that states only a name or one-sentence purpose with no file listing, navigation, or cross-references): flag for expansion — each needs a heading, a scope statement, a how-to or quick-start section, and cross-references. Use `wc -l` per file to identify the short ones; read the one-liners to catch stubs above the line threshold.
- **Long documents** (>500 lines): flag for TOC addition. Every document over 500 lines needs both a scope statement at the top AND a table of contents.
- **Directories with 3+ .md files and no README**: flag for a directory-level hub.
- **Index/filesystem drift**: for every index or hub that enumerates files, diff it against `git ls-files <dir>` — flag missing entries to add and dangling entries to remove. An index is only as trustworthy as its last reconciliation.
- **Orphan scoping**: when detecting orphans, skip files in well-known template directories (`.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE/`) unless the project has an explicit convention that those files should be linked. Focus on files genuinely undocumented — policy files, standalone docs, unlinked guides.

## Diagnostics → actions

- **How many docs exist**: establish corpus size and cleanup scope — `git ls-files '*.md' | wc -l`.
- **How many are stale** (old last-commit date on a load-bearing doc): prioritize review, archival, or replacement — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-governance.md`.
- **`CODEOWNERS` coverage** maps areas to maintainers — provenance for the audience view and for handoff, not a defect to fix; docs are ownerless by default — `reference/foundations.md`.
- **How many are orphans** (no inbound path) or have no useful outbound links: link, redirect, archive, or delete — `reference/principles/04-multiple-paths/orphans-and-dead-ends.md`.
- **How many duplicate or contradict another page**: merge into a source of truth and resolve the conflict — `reference/principles/02-typed-source-of-truth-topics/canonicality.md`.
- **How many lack topic-type, mode, or genre classification, or required metadata**: classify and add metadata before reorganizing — `reference/principles/02-typed-source-of-truth-topics/modes-and-genres.md`, `reference/principles/05-controlled-vocabulary-and-metadata/metadata-fields.md`.
- **How many change frequently** (hot) vs never: protect and elevate the hot ones; reassess, link, or archive the cold ones — `analytics.md`.
- **How many are cited from tickets, alerts, or code**: protect their stability and durable identifiers — `reference/foundations.md` stable-identifier section.
- **Thin README (≤3 lines)** → expand via `reference/principles/03-hubs-orientation-and-routing/index.md`.
- **Long document, no TOC (>500 lines)** → add both scope and TOC via `reference/principles/03-hubs-orientation-and-routing/index.md`.
- **Directory with 3+ .md files, no README** → create hub via `reference/principles/03-hubs-orientation-and-routing/hub-necessity.md`.
