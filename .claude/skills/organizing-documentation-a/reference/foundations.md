# Foundations

Scope: the framework's foundational distinctions, applied to a git repository — layered source of truth, the repo-native stable identifier, and agents as first-class readers. Load before any organizing work. The four design dimensions live in `reference/concepts/design-dimensions.md`; browse all concepts in `reference/concepts/index.md`. The jobs and loop live in `reference/jobs/index.md` and `reference/procedure.md`.

## 1. Layered source of truth

A repository has no single source-of-truth page. Route each fact to the layer that owns it; when a doc restates what another layer owns, cut it and link.

| Owns | Layer |
|---|---|
| Behavior | code and config |
| Orientation and working norms | root and module `README`, `AGENTS.md`, `CLAUDE.md` |
| Cross-file synthesis anchored to source | a wiki page (`wiki` tool) |
| One load-bearing, unenforced coupling | a mesh (`git mesh`) |
| Decision history | commits, PRs, `CHANGELOG`, ADRs |

- **A README or page restates what code defines**: cut it; link the code as owner and keep only synthesis the code cannot express. The inclusion test for a synthesis page is in `reference/tools/wiki.md`.
- **A fact has two homes**: pick the owner above and replace the other copy with a link.
- **A claim is decision history** ("we chose X because Y"): it belongs in the commit/PR/ADR; link it, do not fold it into current instructions.
- **A value is generated from an authoritative source**: generate, do not duplicate — record provenance and let the owner review (`reference/principles/05-controlled-vocabulary-and-metadata/metadata-governance.md`).

## 2. Repo-native stable identifier

The durable reference target is a SHA-pinned fragment link (`path#Lstart-Lend` with a pinned commit SHA) or a durable mesh name — never a bare line number and never a renamable title. There is no SEO "canonical URL" here; do not use that phrase for editorial authority.

- **A durable reference uses a bare line number or a title that may be renamed**: re-anchor it as a SHA-pinned fragment link (`reference/tools/wiki.md` pins SHAs) or a mesh name (`reference/tools/git-mesh.md` mints names).
- **Distinguish four ideas, kept separate**: the owner of a fact (§1) is not the preferred term (a vocabulary label, `reference/principles/05-controlled-vocabulary-and-metadata/vocabulary.md`) is not the durable target (this section) is not an SEO canonical URL (irrelevant here). Definitions: `reference/concepts/glossary.md`.

## 3. Agents are first-class readers

Agents enter through `AGENTS.md`/`CLAUDE.md`, grep, and retrieval — usually with no navigation context. Design for them beside humans.

- **Claude organizes and detects; it does not govern**: Claude structures docs and surfaces governance gaps (drift, staleness, duplication, contradiction), but cadence, approvals, and enforcement are the human maintainer's. Docs are ownerless by default — provenance (authorship, `CODEOWNERS`, `git log --author`) is not accountability; a doc gets no owner field, and an unowned doc is normal, not a gap.
- **A reader may arrive at a file with no neighbors**: open it with a one-line scope statement and headings that stay meaningful when extracted.
- **A cross-file relationship lives only in tribal memory**: record it in a mesh `why` so an agent retrieving one chunk learns it (`reference/tools/git-mesh.md`). Full treatment in `reference/principles/07-nonlinear-information-seeking/index.md`.
