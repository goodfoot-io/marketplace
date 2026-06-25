# Principle 2 — Use typed, source-of-truth topics

Scope: make each topic a typed, single-owner page; separate Diátaxis modes; resolve competing pages to one source of truth.

## In the repo

Code and config own behavior. Separate the modes: explanation → an architecture wiki page; how-to → a task script or guide; reference → generated docs, a schema, a config doc; decision → an ADR, commit, or PR (`reference/foundations.md`). Do not let one README be all four. Cross-file synthesis goes in a wiki page (`reference/tools/wiki.md`); one load-bearing unenforced coupling goes in a mesh (`reference/tools/git-mesh.md`); reference is generated from code where possible.

## Route within this principle

- **You must decide what gets its own page vs. a section**: read `topic-identity.md` — the smallest-meaningful-topic test and routing each fact to its owner.
- **You must type a page and pick its genre**: read `modes-and-genres.md` — the typing action; dimensions in `reference/concepts/design-dimensions.md`, genre catalog in `reference/concepts/page-genres.md`.
- **You are writing the why / mental model**: read `concept-pages.md` — the mental model: purpose, examples, prerequisites, and scope.
- **You are writing an action with verification**: read `task-pages.md` — the action, end state, prerequisites, and verification.
- **You are writing precise lookup data**: read `reference-pages.md` — precise, complete-in-scope lookup, generated from source to resist drift.
- **You are writing symptom-led or time-pressure operational content**: read `troubleshooting-and-runbooks.md` — symptom-led diagnosis and time-pressure runbooks with rollback and escalation.
- **Two pages claim the same topic, or authority is unclear**: read `canonicality.md` — pick one source of truth and mark it.
