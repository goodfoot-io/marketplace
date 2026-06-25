# The four design dimensions

Scope: the framework's four orthogonal dimensions for describing a page — keep them distinct, never collapsed into one page-type field. The conceptual-model hub; route to each dimension.

A page has a value on each of four independent dimensions. Collapsing them into a single "page type" field is the most common modeling error.

- **Documentation mode** — the reader's intent: learning, doing, looking up, understanding (Diátaxis). Read `documentation-modes.md`.
- **Topic type** — the information structure: concept, task, reference, troubleshooting, glossary. Read `topic-types.md`.
- **Page genre** — how the content is used: hub, runbook, ADR, changelog, architecture overview, policy, checklist, migration guide. Read `page-genres.md`.
- **Metadata** — scope, ownership, applicability, status, version, retrieval context. Read `metadata-model.md`.

A single page is, for example, a how-to (mode) task (type) runbook (genre) carrying owner and version (metadata). Name each dimension separately rather than forcing one label.

## In the repo

Diátaxis modes map to repo artifacts: explanation → an architecture wiki page; how-to → a task script or guide; reference → generated docs, a schema, a config doc; decision → an ADR, commit, or PR. Do not let one README be all four.

- **Apply these dimensions when typing a page**: `reference/principles/02-typed-source-of-truth-topics/modes-and-genres.md` — the typing action; genre catalog at `reference/concepts/page-genres.md`.
- **Look up a term's definition**: `glossary.md` — the framework's preferred terms, with definitions and owners.
- **Route a fact to its owning layer** (a separate concern from typing): `reference/foundations.md` layered source of truth.
