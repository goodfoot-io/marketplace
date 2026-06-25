# Anti-duplication

Scope: keep hubs authoritative about routing, not about facts, so they do not go stale. Owns the hub-vs-source-of-truth boundary for Principle 3.

## In the repo

When `AGENTS.md`/`CLAUDE.md` duplicate code facts, reduce them to norms plus routing and move the facts to owned pages or code (`reference/foundations.md`).

## Diagnostics → actions

- **A hub restates content that belongs in a source-of-truth page**: replace the detail with a short summary and a link.
- **A hub will go stale because it duplicates volatile detail**: move those facts to an owned page or a generated reference — `reference/principles/02-typed-source-of-truth-topics/reference-pages.md`.
- **Detail can be a link**: link out and keep the hub's focus; make summaries deliberately short and orientation-level — `reference/principles/06-information-scent/summaries-and-previews.md`.
- **An excerpt must appear in the hub**: use a reusable snippet or a generated index where governance supports it, not a hand-copied paste.
- **Define hub authority as routing, orientation, and scope** — not source-of-truth detail.
- **A hub copies status, ownership, or version already stored in metadata**: generate those fields or link the authoritative metadata, showing provenance and freshness where they affect trust — `reference/principles/05-controlled-vocabulary-and-metadata/metadata-governance.md`.
